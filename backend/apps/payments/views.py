"""
Stripe payment views for VoiceVault.
Handles checkout sessions, webhooks, and payment status.
"""
import logging
import stripe
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.chat.utils import validate_chat_access
from apps.users.models import FamilyMember, User
from apps.payments.models import CreditPurchase, Payment
from services.plan_limits import add_question_credits, is_premium, question_allowance, quota_status
from utils.email_service import send_payment_failed_email, send_premium_activated_email
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Single lifetime Premium pricing
PREMIUM_PRICE = {
    'price_id': getattr(settings, 'STRIPE_PREMIUM_ONE_TIME_PRICE_ID', ''),
    'amount': getattr(settings, 'STRIPE_PREMIUM_ONE_TIME_AMOUNT_CENTS', 14999),
    'currency': getattr(settings, 'STRIPE_PREMIUM_CURRENCY', 'usd'),
    'name': 'VoiceVault Premium',
    'tier': 'premium',
    'payment_type': 'one_time',
}


def _configured_price_id(value):
    """Return a usable Stripe price id, ignoring example/template values."""
    price_id = (value or '').strip()
    placeholder_markers = ('your', 'example', 'xxx')
    if not price_id.startswith('price_') or any(
        marker in price_id.lower() for marker in placeholder_markers
    ):
        return ''
    return price_id


def _checkout_frontend_url(request):
    """Return the app origin that should receive Stripe's checkout redirect."""
    configured_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    request_origin = request.headers.get('Origin', '').rstrip('/')
    if getattr(settings, 'DEBUG', False) and request_origin in {
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    }:
        return request_origin
    return configured_url


@api_view(['POST'])
@permission_classes([AllowAny])
def create_checkout_session(request):
    """
    Create a Stripe Checkout session for VoiceVault membership.
    
    Response:
        {
            "checkout_url": "https://checkout.stripe.com/...",
            "session_id": "cs_..."
        }
    """
    requested_tier = request.data.get('package_tier', 'premium')
    if requested_tier != 'premium':
        return Response(
            {'error': 'invalid_package', 'message': 'Only the premium package is available'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get authenticated user
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if already paid
    if user.has_premium_access:
        return Response(
            {'error': 'You already have VoiceVault Premium'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Single membership plan
    package = PREMIUM_PRICE
    package_tier = package['tier']
    
    try:
        # Create or get the Stripe customer (replacing one left over from test mode)
        customer_id = _ensure_stripe_customer(user)
        
        # Get frontend URL for redirects
        frontend_url = _checkout_frontend_url(request)
        
        line_item = {
            'quantity': 1,
        }
        price_id = _configured_price_id(package['price_id'])
        if price_id:
            line_item['price'] = price_id
        else:
            line_item['price_data'] = {
                'currency': package['currency'],
                'product_data': {
                    'name': package['name'],
                    'description': 'One-time lifetime Premium access for one VoiceVault vault',
                },
                'unit_amount': package['amount'],
            }

        # Create one-time Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            mode='payment',
            line_items=[line_item],
            metadata={
                'user_id': str(user.id),
                'package_tier': package_tier,
                'plan_type': 'premium',
                'payment_type': package['payment_type'],
                'stripe_mode': getattr(settings, 'STRIPE_MODE', 'test'),
            },
            success_url=f'{frontend_url}/pricing/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/pricing?canceled=true',
        )
        
        logger.info(f"Checkout session created for user {user_id}: {checkout_session.id}")
        
        return Response({
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id,
        }, status=status.HTTP_200_OK)
        
    except stripe.error.StripeError as e:
        logger.error("Stripe error creating checkout session: %s", e.__class__.__name__)
        return Response(
            {'error': 'Payment service error. Please try again.'},
            status=status.HTTP_502_BAD_GATEWAY
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_checkout_session(request):
    """
    Confirm a Stripe Checkout session after redirect.

    This makes local testing resilient when Stripe CLI webhooks are not running
    or arrive after the user is returned to the app.
    """
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    session_id = request.data.get('session_id')
    if not session_id:
        return Response(
            {'error': 'session_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user_id = str(request.supabase_user.id)

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        logger.error("Stripe error retrieving checkout session: %s", e.__class__.__name__)
        return Response(
            {'error': 'Payment verification error. Please try again.'},
            status=status.HTTP_502_BAD_GATEWAY
        )

    metadata_user_id = session.get('metadata', {}).get('user_id')
    if metadata_user_id != user_id:
        logger.warning(
            "Checkout session user mismatch: session=%s metadata_user=%s auth_user=%s",
            session_id,
            metadata_user_id,
            user_id,
        )
        return Response(
            {'error': 'Checkout session does not belong to this user'},
            status=status.HTTP_403_FORBIDDEN
        )

    payment_status = session.get('payment_status')
    if payment_status == 'paid' and _is_credit_purchase(session):
        family_member = handle_credit_checkout_completed(session)
        if family_member is None:
            # Paid, but the credits could not be attributed (unusable metadata): say so
            # instead of reporting success, so it gets noticed and fixed by hand
            logger.critical("Paid credit checkout %s could not be credited", session_id)
            return Response(
                {'error': 'credits_not_applied',
                 'message': 'Your payment was received but the credits could not be added. Please contact support.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({
            'payment_completed': True,
            'purchase_type': 'credits',
            'payment_status': payment_status,
            'session_status': session.get('status'),
            'questions': question_allowance(family_member) if family_member else None,
        }, status=status.HTTP_200_OK)
    if payment_status == 'paid':
        handle_checkout_completed(session)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'payment_completed': user.payment_completed,
            'is_premium': user.has_premium_access,
            'payment_status': payment_status,
            'session_status': session.get('status'),
        }, status=status.HTTP_200_OK)

    return Response({
        'payment_completed': False,
        'is_premium': False,
        'payment_status': payment_status,
        'session_status': session.get('status'),
    }, status=status.HTTP_202_ACCEPTED)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    Handle Stripe webhooks.
    
    Listens for:
        - checkout.session.completed
        - payment_intent.succeeded
        - payment_intent.payment_failed
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '') or ''

    # With an empty secret anyone could sign events, so refuse them all (Stripe retries
    # once the secret is set) rather than verify against a blank key
    if not webhook_secret.startswith('whsec_'):
        logger.critical("STRIPE_WEBHOOK_SECRET is missing or invalid; rejecting Stripe webhooks")
        return HttpResponse(status=500)

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        logger.error("Invalid webhook payload: %s", e.__class__.__name__)
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.error("Invalid webhook signature: %s", e.__class__.__name__)
        return HttpResponse(status=400)
    
    # Act only on Stripe's own copy of the object, fetched by id, never on the event
    # body alone: even an event that passed verification can't grant anything unpaid
    event_type = event['type']
    try:
        if event_type == 'checkout.session.completed':
            session = stripe.checkout.Session.retrieve(event['data']['object']['id'])
            if session.get('payment_status') == 'paid':
                handle_checkout_completed(session)
            else:
                logger.info("Checkout session %s completed without payment; nothing granted", session.get('id'))
        elif event_type in ('payment_intent.succeeded', 'payment_intent.payment_failed'):
            payment_intent = stripe.PaymentIntent.retrieve(event['data']['object']['id'])
            if event_type == 'payment_intent.succeeded' and payment_intent.get('status') == 'succeeded':
                logger.info("Payment intent succeeded: %s", payment_intent['id'])
                handle_saved_card_payment_succeeded(payment_intent)
            elif event_type == 'payment_intent.payment_failed' and payment_intent.get('status') != 'succeeded':
                logger.warning("Payment failed: %s", payment_intent['id'])
                handle_payment_failed(payment_intent)
    except stripe.error.StripeError as e:
        # Stripe retries the webhook, so a temporary API failure loses nothing
        logger.error("Could not fetch %s from Stripe: %s", event_type, e.__class__.__name__)
        return HttpResponse(status=500)

    return HttpResponse(status=200)


def handle_checkout_completed(session):
    """
    Handle successful checkout.
    
    - Create Payment record
    - Update user payment status
    - Set package tier
    """
    if _is_credit_purchase(session):
        handle_credit_checkout_completed(session)
        return

    user_id = session['metadata'].get('user_id')
    package_tier = session['metadata'].get('package_tier', 'premium')
    payment_intent_id = session.get('payment_intent') or session['id']
    
    if not user_id:
        logger.error(f"No user_id in checkout session metadata: {session['id']}")
        return
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User not found for checkout: {user_id}")
        return
    
    # A refunded payment must never grant Premium again: Stripe keeps reporting the
    # checkout session as paid after a refund, and webhook retries or a revisit of the
    # success page would otherwise re-activate it.
    if Payment.objects.filter(stripe_payment_intent_id=payment_intent_id, status='refunded').exists():
        logger.info("Checkout %s was refunded; Premium not re-activated for user %s", session['id'], user_id)
        return

    # Create Payment record. `created` marks the first time we see this payment,
    # so webhook retries and the confirm endpoint never send duplicate emails.
    payment_created = False
    try:
        payment, payment_created = Payment.objects.update_or_create(
            stripe_payment_intent_id=payment_intent_id,
            defaults={
                'user': user,
                'stripe_customer_id': session.get('customer', ''),
                'amount_cents': session.get('amount_total') or PREMIUM_PRICE['amount'],
                'currency': session.get('currency') or PREMIUM_PRICE['currency'],
                'status': 'succeeded',
                'package_tier': package_tier,
                'payment_type': 'one_time',
                'receipt_url': session.get('receipt_url', ''),
            }
        )
        logger.info(f"Payment record created: {payment.id}")
    except Exception as e:
        logger.error("Error creating payment record: %s", e.__class__.__name__)
    
    user.activate_premium(
        payment_intent_id=payment_intent_id,
        customer_id=session.get('customer', ''),
        amount_cents=session.get('amount_total') or PREMIUM_PRICE['amount'],
    )
    
    logger.info(f"User {user_id} payment completed: {package_tier}")

    if payment_created:
        send_premium_activated_email(
            user.email,
            user.full_name,
            amount_cents=session.get('amount_total') or PREMIUM_PRICE['amount'],
            currency=session.get('currency') or PREMIUM_PRICE['currency'],
            receipt_url=session.get('receipt_url') or None,
        )


def handle_payment_failed(payment_intent):
    """Email the customer once per failed PaymentIntent (webhooks may be retried)."""
    intent_id = payment_intent.get('id')
    customer_id = payment_intent.get('customer')
    if not intent_id or not customer_id:
        return
    # Failed credit refills are reported in the app; this email is about Premium
    if (payment_intent.get('metadata') or {}).get('purchase_type') == 'credits':
        return
    user = User.objects.filter(stripe_customer_id=customer_id).first()
    if not user or user.has_premium_access:
        return
    # cache.add is atomic: only the first delivery for this intent sends.
    if not cache.add(f'payment_failed_email:{intent_id}', 1, 60 * 60 * 24):
        return
    send_payment_failed_email(user.email, user.full_name)


# ============================================================================
# QUESTION CREDITS
# ============================================================================

# Marks payment intents from one-click refills, which have no checkout session
CREDIT_SOURCE_SAVED_CARD = 'saved_card'


def _is_credit_purchase(session) -> bool:
    return (session.get('metadata') or {}).get('purchase_type') == 'credits'


def apply_credit_purchase(*, family_member_id, credits, buyer_id=None, checkout_session_id=None,
                          payment_intent_id=None, amount_cents=None, currency=None, receipt_url=None):
    """
    Add purchased credits to a family member exactly once per Stripe payment.

    Webhooks, the checkout redirect and the refill response can all report the
    same payment; the unique Stripe id on CreditPurchase makes repeats no-ops.
    Returns (family_member, created), or (None, False) for unusable metadata.
    """
    try:
        family_member = FamilyMember.objects.get(id=family_member_id)
        credits = int(credits)
    except (FamilyMember.DoesNotExist, TypeError, ValueError, ValidationError):
        logger.error("Credit purchase %s has invalid metadata", checkout_session_id or payment_intent_id)
        return None, False

    if checkout_session_id:
        lookup = {'stripe_checkout_session_id': checkout_session_id}
        extra = {'stripe_payment_intent_id': payment_intent_id or None}
    else:
        lookup = {'stripe_payment_intent_id': payment_intent_id}
        extra = {}
    try:
        with transaction.atomic():
            _, created = CreditPurchase.objects.get_or_create(
                **lookup,
                defaults={
                    **extra,
                    'family_member': family_member,
                    'buyer_id': buyer_id or None,
                    'credits': credits,
                    'amount_cents': amount_cents or credits * settings.CREDIT_UNIT_PRICE_CENTS,
                    'currency': currency or settings.STRIPE_PREMIUM_CURRENCY,
                    'receipt_url': receipt_url or None,
                },
            )
            if created:
                add_question_credits(family_member, credits)
    except IntegrityError:
        # A concurrent report of the same payment won the insert and added the credits
        created = False

    if created:
        logger.info("Added %s question credits to family member %s", credits, family_member.id)
    family_member.refresh_from_db(fields=['credit_balance', 'included_questions_used'])
    return family_member, created


def _remember_card(buyer_id, payment_intent_id):
    """Store the card Stripe saved during checkout, so the next refill is one click."""
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id, expand=['payment_method'])
        payment_method = intent.payment_method
        card = payment_method.card
        User.objects.filter(id=buyer_id).update(
            saved_payment_method_id=payment_method.id,
            saved_card_brand=card.brand or '',
            saved_card_last4=card.last4 or '',
        )
    except (stripe.error.StripeError, AttributeError) as e:
        logger.warning("Could not save card from credit purchase: %s", e.__class__.__name__)


def handle_credit_checkout_completed(session):
    """Credit a completed credit checkout and keep its card for later refills."""
    metadata = session.get('metadata') or {}
    family_member, created = apply_credit_purchase(
        family_member_id=metadata.get('family_member_id'),
        credits=metadata.get('credits'),
        buyer_id=metadata.get('user_id'),
        checkout_session_id=session['id'],
        payment_intent_id=session.get('payment_intent'),
        amount_cents=session.get('amount_total'),
        currency=session.get('currency'),
        receipt_url=session.get('receipt_url'),
    )
    if created and metadata.get('save_card') == 'true' and session.get('payment_intent'):
        _remember_card(metadata.get('user_id'), session['payment_intent'])
    return family_member


def handle_saved_card_payment_succeeded(payment_intent):
    """Webhook backup for one-click refills, in case the request ended before crediting."""
    metadata = payment_intent.get('metadata') or {}
    if metadata.get('purchase_type') != 'credits' or metadata.get('credit_source') != CREDIT_SOURCE_SAVED_CARD:
        return
    apply_credit_purchase(
        family_member_id=metadata.get('family_member_id'),
        credits=metadata.get('credits'),
        buyer_id=metadata.get('user_id'),
        payment_intent_id=payment_intent['id'],
        amount_cents=payment_intent.get('amount'),
        currency=payment_intent.get('currency'),
    )


def _forget_saved_card(user):
    user.saved_payment_method_id = ''
    user.saved_card_brand = ''
    user.saved_card_last4 = ''


def _ensure_stripe_customer(user):
    """
    Return the buyer's Stripe customer id, creating a customer if there is none.

    A stored id can belong to the other Stripe mode (test ids stop existing when
    the site switches to live keys) or to a deleted customer. Those are replaced,
    and the card saved on them is forgotten, instead of failing the checkout.
    """
    if user.stripe_customer_id:
        try:
            customer = stripe.Customer.retrieve(user.stripe_customer_id)
            if not getattr(customer, 'deleted', False):
                return user.stripe_customer_id
        except stripe.error.InvalidRequestError as e:
            if getattr(e, 'code', None) != 'resource_missing':
                raise
        logger.info("Replacing unusable Stripe customer for user %s", user.id)
        _forget_saved_card(user)
    customer = stripe.Customer.create(email=user.email, name=user.full_name, metadata={'user_id': str(user.id)})
    user.stripe_customer_id = customer.id
    user.save(update_fields=['stripe_customer_id', 'saved_payment_method_id', 'saved_card_brand', 'saved_card_last4'])
    return customer.id


def _saved_card(user):
    if not (user.saved_payment_method_id and user.stripe_customer_id):
        return None
    return {'brand': user.saved_card_brand, 'last4': user.saved_card_last4}


def _chat_member_for_request(request, ai_owner_id):
    """Return (family_member, ai_owner, user, error_response) for the signed-in user and this vault."""
    if not getattr(request, 'supabase_user', None):
        return None, None, None, Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    if not ai_owner_id:
        return None, None, None, Response({'error': 'ai_owner_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(id=str(request.supabase_user.id))
        ai_owner = User.objects.get(id=ai_owner_id)
    except (User.DoesNotExist, ValidationError, ValueError):
        return None, None, None, Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    has_access, family_member, error_msg = validate_chat_access(ai_owner, user)
    if not has_access or family_member is None:
        return None, None, None, Response(
            {'error': error_msg or 'You are not authorized to chat with this AI.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return family_member, ai_owner, user, None


def _credit_purchase_request(request):
    """Validate a credit purchase: (family_member, ai_owner, buyer, credits, error_response)."""
    family_member, ai_owner, buyer, error = _chat_member_for_request(request, request.data.get('ai_owner_id'))
    if error:
        return None, None, None, 0, error
    if not is_premium(ai_owner):
        return None, None, None, 0, Response(
            {'error': 'Credits are available once this vault has VoiceVault Premium.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        credits = int(request.data.get('credits'))
    except (TypeError, ValueError):
        credits = 0
    if not settings.CREDIT_MIN_PURCHASE <= credits <= settings.CREDIT_MAX_PURCHASE:
        return None, None, None, 0, Response(
            {'error': f'Choose between {settings.CREDIT_MIN_PURCHASE} and {settings.CREDIT_MAX_PURCHASE} credits.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return family_member, ai_owner, buyer, credits, None


def _credit_metadata(buyer, family_member, ai_owner, credits):
    return {
        'purchase_type': 'credits',
        'user_id': str(buyer.id),
        'family_member_id': str(family_member.id),
        'ai_owner_id': str(ai_owner.id),
        'credits': str(credits),
        'stripe_mode': getattr(settings, 'STRIPE_MODE', 'test'),
    }


def _credit_description(ai_owner):
    return f"Questions for {ai_owner.full_name or 'your loved one'}'s AI (1 credit = 1 question)"


@api_view(['GET'])
@permission_classes([AllowAny])
def get_question_credits(request):
    """
    Questions left for the signed-in family member in one vault, and their saved card.

    GET /api/payments/credits/?ai_owner_id=<uuid>
    """
    family_member, ai_owner, user, error = _chat_member_for_request(request, request.query_params.get('ai_owner_id'))
    if error:
        return error
    return Response({
        'is_premium_vault': is_premium(ai_owner),
        'can_buy_credits': is_premium(ai_owner),
        'saved_card': _saved_card(user),
        **question_allowance(family_member),
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_credit_checkout_session(request):
    """
    Start a Stripe Checkout for question credits, bought by the family member for one vault.
    Stripe saves the card to the buyer's customer for one-click refills.

    POST /api/payments/credits/checkout/
    Body: {"ai_owner_id": "<uuid>", "credits": 100}
    """
    family_member, ai_owner, buyer, credits, error = _credit_purchase_request(request)
    if error:
        return error

    return_url = f'{_checkout_frontend_url(request)}/chat/{ai_owner.id}'
    try:
        checkout_session = stripe.checkout.Session.create(
            mode='payment',
            payment_method_types=['card'],
            customer=_ensure_stripe_customer(buyer),
            line_items=[{
                'quantity': credits,
                'price_data': {
                    'currency': settings.STRIPE_PREMIUM_CURRENCY,
                    'unit_amount': settings.CREDIT_UNIT_PRICE_CENTS,
                    'product_data': {
                        'name': 'VoiceVault question credits',
                        'description': _credit_description(ai_owner),
                    },
                },
            }],
            # Saves the card for later refills; Checkout shows the customer that it will be saved
            # Metadata on the intent too, so a declined card isn't mistaken for a failed Premium payment
            payment_intent_data={
                'setup_future_usage': 'off_session',
                'metadata': _credit_metadata(buyer, family_member, ai_owner, credits),
            },
            metadata={**_credit_metadata(buyer, family_member, ai_owner, credits), 'save_card': 'true'},
            success_url=f'{return_url}?credits_session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{return_url}?credits=canceled',
        )
    except stripe.error.StripeError as e:
        logger.error("Stripe error creating credit checkout: %s", e.__class__.__name__)
        return Response({'error': 'Payment service error. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
        'checkout_url': checkout_session.url,
        'session_id': checkout_session.id,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def buy_credits_with_saved_card(request):
    """
    One-click refill: charge the buyer's saved card and add the credits.

    POST /api/payments/credits/refill/
    Body: {"ai_owner_id": "<uuid>", "credits": 100, "request_id": "<unique per click>"}

    When the card can't be charged without the buyer (declined, or the bank asks
    for verification), responds 402 with requires_checkout so the app opens Checkout.
    """
    family_member, ai_owner, buyer, credits, error = _credit_purchase_request(request)
    if error:
        return error
    if not _saved_card(buyer):
        return Response(
            {'error': 'No saved card yet. Please pay with a card first.', 'requires_checkout': True},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # The same request id never charges twice, even if the click is sent again. It is
    # required: without one a retried request could charge the card a second time.
    request_id = str(request.data.get('request_id') or '')[:100]
    if not request_id:
        return Response({'error': 'request_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    idempotency = {'idempotency_key': f'credit-refill-{buyer.id}-{request_id}'}
    try:
        intent = stripe.PaymentIntent.create(
            amount=credits * settings.CREDIT_UNIT_PRICE_CENTS,
            currency=settings.STRIPE_PREMIUM_CURRENCY,
            customer=buyer.stripe_customer_id,
            payment_method=buyer.saved_payment_method_id,
            payment_method_types=['card'],
            confirm=True,
            description=_credit_description(ai_owner),
            metadata={
                **_credit_metadata(buyer, family_member, ai_owner, credits),
                'credit_source': CREDIT_SOURCE_SAVED_CARD,
            },
            **idempotency,
        )
    except stripe.error.CardError:
        return Response(
            {'error': 'Your saved card was declined. Please use another card.', 'requires_checkout': True},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    except stripe.error.InvalidRequestError as e:
        if getattr(e, 'code', None) != 'resource_missing':
            logger.error("Stripe error charging saved card: %s", e.__class__.__name__)
            return Response({'error': 'Payment service error. Please try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)
        # The saved card or its customer no longer exists at Stripe (for example a
        # test-mode card after switching to live keys): forget it and use Checkout
        _forget_saved_card(buyer)
        buyer.save(update_fields=['saved_payment_method_id', 'saved_card_brand', 'saved_card_last4'])
        return Response(
            {'error': 'Please enter your card again.', 'requires_checkout': True},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )
    except stripe.error.StripeError as e:
        logger.error("Stripe error charging saved card: %s", e.__class__.__name__)
        return Response({'error': 'Payment service error. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)

    if intent.status != 'succeeded':
        # Usually the bank wants 3D Secure verification, which Checkout handles
        try:
            stripe.PaymentIntent.cancel(intent.id)
        except stripe.error.StripeError:
            pass
        return Response(
            {'error': 'Your bank needs to confirm this payment. Continuing to secure checkout.',
             'requires_checkout': True},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    family_member, _ = apply_credit_purchase(
        family_member_id=family_member.id,
        credits=credits,
        buyer_id=buyer.id,
        payment_intent_id=intent.id,
        amount_cents=intent.amount,
        currency=intent.currency,
    )
    return Response({
        'payment_completed': True,
        'purchase_type': 'credits',
        'questions': question_allowance(family_member) if family_member else None,
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def remove_saved_card(request):
    """
    Remove the saved card: detach it at Stripe and forget it here.

    DELETE /api/payments/credits/saved-card/
    """
    if not getattr(request, 'supabase_user', None):
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        user = User.objects.get(id=str(request.supabase_user.id))
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if user.saved_payment_method_id:
        try:
            stripe.PaymentMethod.detach(user.saved_payment_method_id)
        except stripe.error.InvalidRequestError:
            pass  # Already detached or deleted at Stripe
        except stripe.error.StripeError as e:
            logger.error("Stripe error removing saved card: %s", e.__class__.__name__)
            return Response({'error': 'Could not remove the card. Please try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)
    user.saved_payment_method_id = ''
    user.saved_card_brand = ''
    user.saved_card_last4 = ''
    user.save(update_fields=['saved_payment_method_id', 'saved_card_brand', 'saved_card_last4'])
    return Response({'saved_card': None}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_payment_status(request):
    """
    Get payment status for authenticated user.
    
    Response:
        {
            "payment_completed": true,
            "package_tier": "premium",
            "can_record": true
        }
    """
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    return Response({
        'payment_completed': user.payment_completed,
        'package_tier': user.package_tier,
        'plan_type': user.plan_type,
        'is_premium': user.has_premium_access,
        'lifetime_access': user.lifetime_access,
        'can_record': True,
        'can_invite_family': True,
        'usage_quota': quota_status(user),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_billing_details(request):
    """
    Get billing and payment details for the authenticated user.
    Used by Settings > Billing section.
    """
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    user_id = str(request.supabase_user.id)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if not user.has_premium_access:
        return Response({
            'is_paid': False,
            'plan_name': None,
            'amount_paid_cents': None,
            'paid_at': None,
            'payment_method_display': None,
            'is_lifetime': True,
            'receipt_url': None,
        }, status=status.HTTP_200_OK)

    # Get latest successful payment
    latest = (
        Payment.objects.filter(user=user, status='succeeded')
        .order_by('-created_at')
        .first()
    )
    amount_cents = user.payment_amount or (latest.amount_cents if latest else PREMIUM_PRICE['amount'])
    paid_at = latest.created_at.isoformat() if latest else None
    receipt_url = latest.receipt_url if latest and getattr(latest, 'receipt_url', None) else None

    # Payment method display: we don't store last4; show generic or try Stripe
    payment_method_display = 'Card (via Stripe)'
    if user.stripe_customer_id and stripe.api_key:
        try:
            pm_list = stripe.Customer.list_payment_methods(user.stripe_customer_id, type='card')
            if pm_list.data:
                pm = pm_list.data[0]
                if getattr(pm, 'card', None) and getattr(pm.card, 'last4', None):
                    payment_method_display = f"Card ending in {pm.card.last4}"
        except Exception:
            pass

    return Response({
        'is_paid': True,
        'plan_name': PREMIUM_PRICE.get('name', 'VoiceVault Premium'),
        'amount_paid_cents': amount_cents,
        'paid_at': paid_at,
        'payment_method_display': payment_method_display,
        'is_lifetime': True,
        'receipt_url': receipt_url,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_packages(request):
    """
    Get available packages and pricing.
    
    Response:
        {
            "packages": [
                {
                    "tier": "free",
                    "name": "Memory Starter",
                    "price": 0,
                    "features": [...]
                }
            ]
        }
    """
    premium_amount_cents = PREMIUM_PRICE['amount']
    premium_price = premium_amount_cents / 100
    currency = PREMIUM_PRICE['currency'].upper()
    currency_symbols = {'USD': '$', 'CAD': 'C$', 'GBP': '£', 'EUR': '€'}
    symbol = currency_symbols.get(currency, f'{currency} ')
    premium_price_display = f'{symbol}{premium_price:,.2f}'
    credit_price_display = f'{symbol}{settings.CREDIT_UNIT_PRICE_CENTS / 100:,.2f}'
    max_family = settings.PREMIUM_MAX_FAMILY_MEMBERS
    included_questions = settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER
    free_family = settings.FREE_MAX_FAMILY_MEMBERS

    packages = [
        {
            'tier': 'free',
            'name': 'Memory Starter',
            'price': 0,
            'price_display': '$0',
            'features': [
                '5 guided questions',
                '15 minutes of recordings',
                'Basic AI personality',
                '5 family chat messages',
                f"{free_family} family invitation{'s' if free_family != 1 else ''}",
                'Text-only chat',
                'No voice cloning',
            ],
            'highlighted': False,
        },
        {
            'tier': 'premium',
            'name': 'VoiceVault Premium',
            'price': premium_price,
            'price_display': premium_price_display,
            'currency': currency,
            'features': [
                '30 guided questions + optional reflection',
                'Up to 5 hours of memories',
                'Advanced AI personality',
                'Voice cloning included',
                f'Up to {max_family} family members',
                f'{included_questions} conversations per family member, answered in text and voice',
                f'More conversations anytime with credits ({credit_price_display} each)',
                'Biography PDF export',
            ],
            'highlighted': True,
            'family_members': max_family,
            'questions_per_family_member': included_questions,
            'credit_unit_price_cents': settings.CREDIT_UNIT_PRICE_CENTS,
        },
    ]
    
    return Response({'packages': packages}, status=status.HTTP_200_OK)
