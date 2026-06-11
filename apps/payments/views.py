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

from apps.users.models import User
from apps.payments.models import Payment
from services.plan_limits import quota_status

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
    # Get authenticated user
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    user_email = request.supabase_user.email
    
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
        # Create or get Stripe customer
        if user.stripe_customer_id:
            customer_id = user.stripe_customer_id
        else:
            customer = stripe.Customer.create(
                email=user_email,
                name=user.full_name,
                metadata={'user_id': str(user.id)}
            )
            customer_id = customer.id
            user.stripe_customer_id = customer_id
            user.save(update_fields=['stripe_customer_id'])
        
        # Get frontend URL for redirects
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        line_item = {
            'quantity': 1,
        }
        if package['price_id']:
            line_item['price'] = package['price_id']
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
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '')
    
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
    
    # Handle events
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_checkout_completed(session)
    elif event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        logger.info(f"Payment intent succeeded: {payment_intent['id']}")
    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        logger.warning(f"Payment failed: {payment_intent['id']}")
    
    return HttpResponse(status=200)


def handle_checkout_completed(session):
    """
    Handle successful checkout.
    
    - Create Payment record
    - Update user payment status
    - Set package tier
    """
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
    
    # Create Payment record
    try:
        payment, _ = Payment.objects.update_or_create(
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
                '1 family invitation',
                'Text-only chat',
                'No voice cloning',
            ],
            'highlighted': False,
        },
        {
            'tier': 'premium',
            'name': 'VoiceVault Premium',
            'price': 149.99,
            'price_display': '$149.99',
            'features': [
                '30+ guided questions',
                'Up to 5 hours of memories',
                'Advanced AI personality',
                'Voice cloning included',
                '200 voice responses/month',
                '1,000 text messages/month',
                'Up to 10 family members',
                'Biography PDF export',
            ],
            'highlighted': True,
        },
    ]
    
    return Response({'packages': packages}, status=status.HTTP_200_OK)
