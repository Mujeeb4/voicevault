from django.core import mail
from django.test import TestCase

from apps.payments.models import CreditPurchase, Payment
from apps.payments.refunds import handle_charge_refunded
from apps.users.models import FamilyMember, User


def _charge(pi, amount=3000, refunded=3000):
    return {'id': 'ch_1', 'payment_intent': pi, 'amount': amount,
            'amount_refunded': refunded, 'refunded': refunded >= amount, 'currency': 'usd'}


class ChargeRefundedTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='buyer@example.com', full_name='Buyer One', password_hash='x')
        self.user.activate_premium(payment_intent_id='pi_1', customer_id='cus_1', amount_cents=3000)
        self.payment = Payment.objects.create(
            user=self.user, stripe_payment_intent_id='pi_1', stripe_customer_id='cus_1',
            amount_cents=3000, status='succeeded', package_tier='premium')
        mail.outbox = []

    def test_full_refund_turns_premium_off_and_emails(self):
        self.assertEqual(handle_charge_refunded(_charge('pi_1')), 'premium')
        self.payment.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.payment.status, 'refunded')
        self.assertFalse(self.user.is_premium)
        self.assertFalse(self.user.lifetime_access)
        self.assertEqual(self.user.plan_type, 'free')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['buyer@example.com'])

    def test_running_twice_is_a_noop(self):
        handle_charge_refunded(_charge('pi_1'))
        self.assertEqual(handle_charge_refunded(_charge('pi_1')), 'already_done')
        self.assertEqual(len(mail.outbox), 1)

    def test_partial_refund_changes_nothing(self):
        self.assertEqual(handle_charge_refunded(_charge('pi_1', refunded=1000)), 'partial')
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_premium)
        self.assertEqual(len(mail.outbox), 0)

    def test_other_paid_purchase_keeps_premium(self):
        Payment.objects.create(user=self.user, stripe_payment_intent_id='pi_2', stripe_customer_id='cus_1',
                               amount_cents=3000, status='succeeded', package_tier='premium')
        handle_charge_refunded(_charge('pi_1'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_premium)

    def test_unknown_charge_is_ignored(self):
        self.assertEqual(handle_charge_refunded(_charge('pi_missing')), 'unknown')
        self.assertEqual(len(mail.outbox), 0)

    def test_refunded_payment_cannot_reactivate_premium(self):
        from apps.payments.views import handle_checkout_completed
        handle_charge_refunded(_charge('pi_1'))
        handle_checkout_completed({'id': 'cs_1', 'payment_intent': 'pi_1', 'customer': 'cus_1',
                                   'metadata': {'user_id': str(self.user.id)}, 'amount_total': 3000})
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_premium)


class CreditRefundTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create(email='owner@example.com', full_name='Owner', password_hash='x')
        self.member = FamilyMember.objects.create(
            ai_owner=self.owner, email='fam@example.com', full_name='Fam', relationship='child',
            credit_balance=10)
        self.purchase = CreditPurchase.objects.create(
            family_member=self.member, buyer=self.owner, stripe_payment_intent_id='pi_c',
            credits=15, amount_cents=500)
        mail.outbox = []

    def test_refund_removes_only_unused_credits_once(self):
        self.assertEqual(handle_charge_refunded(_charge('pi_c', 500, 500)), 'credits')
        self.member.refresh_from_db()
        self.assertEqual(self.member.credit_balance, 0)
        self.assertEqual(handle_charge_refunded(_charge('pi_c', 500, 500)), 'already_done')
        self.assertEqual(len(mail.outbox), 1)
