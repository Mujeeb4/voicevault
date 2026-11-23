"""
Apply a Stripe refund to our own records.

Refunds can be issued from the admin dashboard or directly in Stripe. Stripe tells us
about both through the charge.refunded webhook, so this is the one place that turns a
full refund into: payment marked refunded, Premium removed (unless the user has another
paid purchase), purchased credits taken back, and the customer told. Safe to run twice.
"""
import logging

from django.db import transaction
from django.utils import timezone

from apps.payments.models import CreditPurchase, Payment
from apps.users.models import FamilyMember, User
from utils.email_service import send_refund_email

logger = logging.getLogger(__name__)


def is_fully_refunded(charge) -> bool:
    amount = charge.get('amount') or 0
    refunded = charge.get('amount_refunded') or 0
    return bool(charge.get('refunded')) or (amount > 0 and refunded >= amount)


def handle_charge_refunded(charge) -> str:
    """Returns what was done: premium, credits, partial, unknown or already_done."""
    if not is_fully_refunded(charge):
        logger.info("Partial refund on charge %s; no access changed", charge.get('id'))
        return 'partial'

    payment_intent_id = charge.get('payment_intent')
    if not payment_intent_id:
        return 'unknown'
    amount = charge.get('amount_refunded') or charge.get('amount')
    currency = charge.get('currency') or 'usd'

    with transaction.atomic():
        payment = Payment.objects.select_for_update().filter(
            stripe_payment_intent_id=payment_intent_id
        ).first()
        if payment:
            if payment.status == 'refunded':
                return 'already_done'
            payment.status = 'refunded'
            payment.save(update_fields=['status', 'updated_at'])
            user = User.objects.select_for_update().get(id=payment.user_id)
            other_paid = Payment.objects.filter(user=user, status='succeeded').exclude(id=payment.id).exists()
            if not other_paid:
                user.package_tier = 'free'
                user.plan_type = 'free'
                user.is_premium = False
                user.lifetime_access = False
                user.payment_completed = False
                user.save(update_fields=[
                    'package_tier', 'plan_type', 'is_premium', 'lifetime_access',
                    'payment_completed', 'updated_at',
                ])
            result, to_email, to_name, premium = 'premium', user.email, user.full_name, True
        else:
            purchase = CreditPurchase.objects.select_for_update().filter(
                stripe_payment_intent_id=payment_intent_id
            ).first()
            if not purchase:
                logger.warning("Refunded charge %s matches no payment on record", charge.get('id'))
                return 'unknown'
            if purchase.refunded_at:
                return 'already_done'
            # Take back only credits still unused; credits already spent are not clawed back
            member = FamilyMember.objects.select_for_update().get(id=purchase.family_member_id)
            take_back = min(purchase.credits, member.credit_balance)
            if take_back:
                member.credit_balance -= take_back
                member.save(update_fields=['credit_balance'])
            purchase.refunded_at = timezone.now()
            purchase.save(update_fields=['refunded_at'])
            buyer = purchase.buyer
            result = 'credits'
            to_email = buyer.email if buyer else None
            to_name = buyer.full_name if buyer else ''
            premium = False

    logger.info("Refund applied for charge %s: %s", charge.get('id'), result)
    if to_email:
        send_refund_email(to_email, to_name, amount_cents=amount, currency=currency, premium=premium)
    return result
