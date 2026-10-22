from unittest.mock import patch

from django.test import TestCase
from django.test import override_settings
from rest_framework.test import APIRequestFactory

from apps.payments import views
from apps.users.models import User
from utils.supabase_auth import SupabaseUser


class CheckoutRegressionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(email='buyer@example.com', full_name='Buyer')

    def request(self, data, origin=None):
        extra = {'HTTP_ORIGIN': origin} if origin else {}
        request = self.factory.post(
            '/api/payments/create-checkout/', data, format='json', **extra
        )
        request.supabase_user = SupabaseUser(str(self.user.id), self.user.email, {})
        return request

    def test_invalid_package_is_rejected_without_calling_stripe(self):
        with patch('apps.payments.views.stripe.checkout.Session.create') as create_session:
            response = views.create_checkout_session(self.request({'package_tier': 'family'}))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'invalid_package')
        create_session.assert_not_called()

    @patch('apps.payments.views.stripe.checkout.Session.create')
    @patch('apps.payments.views.stripe.Customer.create')
    def test_valid_checkout_returns_url(self, customer_create, session_create):
        customer_create.return_value.id = 'cus_test'
        session_create.return_value.id = 'cs_test'
        session_create.return_value.url = 'https://checkout.stripe.test/cs_test'
        response = views.create_checkout_session(self.request({'package_tier': 'premium'}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['session_id'], 'cs_test')

    @patch('apps.payments.views.stripe.checkout.Session.create')
    @patch('apps.payments.views.stripe.Customer.create')
    def test_placeholder_price_id_falls_back_to_inline_price_data(
        self, customer_create, session_create
    ):
        customer_create.return_value.id = 'cus_test'
        session_create.return_value.id = 'cs_test'
        session_create.return_value.url = 'https://checkout.stripe.test/cs_test'

        with patch.dict(
            views.PREMIUM_PRICE,
            {'price_id': 'price_your_premium_price_id', 'amount': 14999, 'currency': 'usd'},
        ):
            response = views.create_checkout_session(
                self.request({'package_tier': 'premium'})
            )

        self.assertEqual(response.status_code, 200)
        line_item = session_create.call_args.kwargs['line_items'][0]
        self.assertNotIn('price', line_item)
        self.assertEqual(line_item['price_data']['unit_amount'], 14999)
        self.assertEqual(line_item['price_data']['currency'], 'usd')

    @override_settings(DEBUG=True, FRONTEND_URL='https://production.example')
    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_debug_checkout_returns_to_the_local_origin(self, session_create):
        self.user.stripe_customer_id = 'cus_existing'
        self.user.save(update_fields=['stripe_customer_id'])
        session_create.return_value.id = 'cs_test'
        session_create.return_value.url = 'https://checkout.stripe.test/cs_test'

        response = views.create_checkout_session(
            self.request({'package_tier': 'premium'}, origin='http://localhost:3000')
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            session_create.call_args.kwargs['success_url'],
            'http://localhost:3000/pricing/success?session_id={CHECKOUT_SESSION_ID}',
        )
        self.assertEqual(
            session_create.call_args.kwargs['cancel_url'],
            'http://localhost:3000/pricing?canceled=true',
        )

    def test_packages_use_checkout_price_configuration(self):
        request = self.factory.get('/api/payments/packages/')
        with patch.dict(views.PREMIUM_PRICE, {'amount': 14999, 'currency': 'usd'}):
            response = views.get_packages(request)

        premium = next(item for item in response.data['packages'] if item['tier'] == 'premium')
        self.assertEqual(premium['price'], 149.99)
        self.assertEqual(premium['price_display'], '$149.99')
        self.assertEqual(premium['currency'], 'USD')
