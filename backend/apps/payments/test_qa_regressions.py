"""Regression tests: a refunded payment must not grant Premium again; unusable credit checkouts are reported."""
import uuid
from unittest import mock

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.payments import views
from apps.payments.models import Payment
from apps.users.models import User
from utils.supabase_auth import SupabaseUser


def paid_session(user, **extra):
    return {
        'id': 'cs_test_1', 'payment_intent': 'pi_test_1', 'customer': 'cus_1', 'amount_total': 14999,
        'currency': 'usd', 'payment_status': 'paid', 'status': 'complete',
        'metadata': {'user_id': str(user.id), 'package_tier': 'premium'}, **extra,
    }


class RefundedPaymentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(id=uuid.uuid4(), email='buyer@example.com', full_name='Buyer')

    def refund(self):
        Payment.objects.filter(stripe_payment_intent_id='pi_test_1').update(status='refunded')
        User.objects.filter(id=self.user.id).update(
            is_premium=False, plan_type='free', lifetime_access=False, payment_completed=False, package_tier='free',
        )

    def test_replaying_a_refunded_checkout_does_not_restore_premium(self):
        session = paid_session(self.user)
        with mock.patch.object(views, 'send_premium_activated_email') as email:
            views.handle_checkout_completed(session)
            self.user.refresh_from_db()
            self.assertTrue(self.user.has_premium_access)

            self.refund()
            views.handle_checkout_completed(session)  # webhook retry or success-page revisit

            self.user.refresh_from_db()
            self.assertFalse(self.user.has_premium_access)
            self.assertEqual(Payment.objects.get(stripe_payment_intent_id='pi_test_1').status, 'refunded')
            self.assertEqual(email.call_count, 1)

    def test_a_new_payment_after_a_refund_still_grants_premium(self):
        with mock.patch.object(views, 'send_premium_activated_email'):
            views.handle_checkout_completed(paid_session(self.user))
            self.refund()
            views.handle_checkout_completed(paid_session(self.user, id='cs_test_2', payment_intent='pi_test_2'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.has_premium_access)

    def test_paid_credit_checkout_that_cannot_be_credited_is_not_reported_as_success(self):
        session = paid_session(self.user, metadata={
            'user_id': str(self.user.id), 'purchase_type': 'credits',
            'family_member_id': str(uuid.uuid4()), 'credits': '5',
        })
        request = APIRequestFactory().post('/api/payments/confirm-checkout/', {'session_id': 'cs_test_1'}, format='json')
        request.supabase_user = SupabaseUser(str(self.user.id), self.user.email, {})
        with mock.patch.object(views.stripe.checkout.Session, 'retrieve', return_value=session):
            response = views.confirm_checkout_session(request)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['error'], 'credits_not_applied')
