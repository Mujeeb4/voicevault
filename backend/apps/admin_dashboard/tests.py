from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.admin_dashboard import views
from apps.payments.models import Payment
from apps.users.models import AuditLog, User
from utils.supabase_auth import SupabaseUser


@override_settings(ADMIN_EMAILS='admin@example.com', STRIPE_SECRET_KEY='sk_test_example')
class AdminDashboardRegressionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create(email='admin@example.com', full_name='Admin')
        self.user = User.objects.create(email='user@example.com', full_name='User')

    def request(self, method, path, data=None):
        request = getattr(self.factory, method)(path, data or {}, format='json')
        request.supabase_user = SupabaseUser(str(self.admin.id), self.admin.email, {})
        return request

    def test_malformed_pagination_returns_400(self):
        response = views.admin_users(self.request('get', '/api/admin/users/?page=abc'))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'validation_error')

    def test_admin_cannot_delete_self(self):
        response = views.admin_user_detail(
            self.request('delete', f'/api/admin/users/{self.admin.id}/'),
            user_id=self.admin.id,
        )
        self.assertEqual(response.status_code, 409)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_user_patch_rejects_wrong_boolean_type(self):
        response = views.admin_user_detail(
            self.request('patch', f'/api/admin/users/{self.user.id}/', {'ai_ready': 'yes'}),
            user_id=self.user.id,
        )
        self.assertEqual(response.status_code, 400)

    def test_processing_user_filter_is_applied(self):
        response = views.admin_processing_jobs(
            self.request('get', f'/api/admin/processing/?user={self.user.id}')
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['user_id'], str(self.user.id))

    @patch('apps.admin_dashboard.views.stripe.Refund.create')
    def test_refund_updates_payment_access_and_audit(self, refund_create):
        refund_create.return_value.id = 're_test_123'
        self.user.activate_premium(payment_intent_id='pi_test_123', customer_id='cus_test', amount_cents=14999)
        payment = Payment.objects.create(
            user=self.user,
            stripe_payment_intent_id='pi_test_123',
            stripe_customer_id='cus_test',
            amount_cents=14999,
            status='succeeded',
            package_tier='premium',
        )
        response = views.admin_refund_payment(
            self.request('post', f'/api/admin/payments/{payment.id}/refund/'),
            payment_id=payment.id,
        )
        self.assertEqual(response.status_code, 200)
        payment.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(payment.status, 'refunded')
        self.assertFalse(self.user.has_premium_access)
        self.assertTrue(AuditLog.objects.filter(action='admin_payment_refund', target_id=str(payment.id)).exists())
