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
    @patch('apps.payments.views.stripe.Customer.retrieve')
    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_debug_checkout_returns_to_the_local_origin(self, session_create, customer_retrieve):
        customer_retrieve.return_value.deleted = False
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


class PaymentEmailTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = User.objects.create(
            email='buyer2@example.com', full_name='Buyer Two', stripe_customer_id='cus_mail'
        )

    def session(self):
        return {
            'id': 'cs_mail',
            'payment_intent': 'pi_mail',
            'customer': 'cus_mail',
            'amount_total': 14999,
            'currency': 'usd',
            'metadata': {'user_id': str(self.user.id), 'package_tier': 'premium'},
        }

    @patch('apps.payments.views.send_premium_activated_email')
    def test_checkout_completed_sends_receipt_once(self, send_email):
        views.handle_checkout_completed(self.session())
        views.handle_checkout_completed(self.session())  # webhook retry / confirm endpoint
        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.args[0], 'buyer2@example.com')

    @patch('apps.payments.views.send_payment_failed_email')
    def test_payment_failed_sends_once_per_intent(self, send_email):
        intent = {'id': 'pi_fail', 'customer': 'cus_mail'}
        views.handle_payment_failed(intent)
        views.handle_payment_failed(intent)
        send_email.assert_called_once_with('buyer2@example.com', 'Buyer Two')

    @patch('apps.payments.views.send_payment_failed_email')
    def test_payment_failed_unknown_customer_sends_nothing(self, send_email):
        views.handle_payment_failed({'id': 'pi_x', 'customer': 'cus_unknown'})
        send_email.assert_not_called()

    def test_branded_emails_render_html_and_text(self):
        from django.core import mail
        from utils import email_service
        self.assertTrue(email_service.send_premium_activated_email(
            'buyer2@example.com', 'Buyer <b>Two</b>', 14999, 'usd'))
        self.assertTrue(email_service.send_invitation_email(
            'a@example.com', 'A', 'Owner', 'Son', 'http://x/y', '<script>x</script>'))
        self.assertEqual(len(mail.outbox), 2)
        html = mail.outbox[0].alternatives[0][0]
        self.assertIn('#0A7552', html)
        self.assertIn('$149.99', mail.outbox[0].body)
        self.assertNotIn('<b>Two</b>', html)
        self.assertNotIn('<script>', mail.outbox[1].alternatives[0][0])


class StripeWebhookSecurityTests(TestCase):
    """The webhook grants nothing on its own word: it needs a real secret and Stripe's own copy of the payment."""

    def setUp(self):
        self.user = User.objects.create(email='buyer@example.com', full_name='Buyer')
        self.factory = APIRequestFactory()

    def post_event(self, event_type='checkout.session.completed', object_id='cs_1'):
        request = self.factory.post('/api/payments/webhook/', data=b'{}', content_type='application/json',
                                    HTTP_STRIPE_SIGNATURE='t=1,v1=x')
        event = {'type': event_type, 'data': {'object': {'id': object_id}}}
        with patch('apps.payments.views.stripe.Webhook.construct_event', return_value=event):
            return views.stripe_webhook(request)

    def stripe_session(self, payment_status):
        return {'id': 'cs_1', 'payment_status': payment_status, 'payment_intent': 'pi_1', 'amount_total': 14999,
                'currency': 'usd', 'customer': 'cus_1', 'metadata': {'user_id': str(self.user.id)}}

    @override_settings(STRIPE_WEBHOOK_SECRET='')
    @patch('apps.payments.views.stripe.checkout.Session.retrieve')
    def test_missing_secret_rejects_every_event(self, retrieve):
        response = self.post_event()
        self.assertEqual(response.status_code, 500)
        retrieve.assert_not_called()
        self.user.refresh_from_db()
        self.assertFalse(self.user.has_premium_access)

    @override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
    @patch('apps.payments.views.stripe.checkout.Session.retrieve')
    def test_event_for_an_unpaid_session_grants_nothing(self, retrieve):
        retrieve.return_value = self.stripe_session('unpaid')
        response = self.post_event()
        self.assertEqual(response.status_code, 200)
        retrieve.assert_called_once_with('cs_1')
        self.user.refresh_from_db()
        self.assertFalse(self.user.has_premium_access)

    @override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
    @patch('apps.payments.views.send_premium_activated_email')
    @patch('apps.payments.views.stripe.checkout.Session.retrieve')
    def test_paid_session_fetched_from_stripe_activates_premium(self, retrieve, _email):
        retrieve.return_value = self.stripe_session('paid')
        response = self.post_event()
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.has_premium_access)

    @override_settings(STRIPE_WEBHOOK_SECRET='whsec_test')
    @patch('apps.payments.views.stripe.checkout.Session.retrieve')
    def test_stripe_outage_asks_stripe_to_retry(self, retrieve):
        import stripe
        retrieve.side_effect = stripe.error.APIConnectionError('down')
        self.assertEqual(self.post_event().status_code, 500)


@override_settings(FOUNDING_OFFER_SPOTS=2, PREMIUM_LIST_PRICE_CENTS=14999)
class FoundingOfferTests(TestCase):
    """The price shown and the price charged agree, and founding checkouts expire quickly."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(email='founder@example.com', full_name='Founder')
        self.price = patch.dict(views.PREMIUM_PRICE, {'amount': 11900, 'price_id': '', 'currency': 'usd'})
        self.price.start()
        self.addCleanup(self.price.stop)

    def checkout(self):
        request = self.factory.post('/api/payments/create-checkout/', {'package_tier': 'premium'}, format='json')
        request.supabase_user = SupabaseUser(str(self.user.id), self.user.email, {})
        with patch('apps.payments.views.stripe.Customer.create') as customer, \
                patch('apps.payments.views.stripe.checkout.Session.create') as create:
            customer.return_value.id = 'cus_1'
            create.return_value.id = 'cs_1'
            create.return_value.url = 'https://checkout.stripe.test/cs_1'
            response = views.create_checkout_session(request)
        self.assertEqual(response.status_code, 200)
        return create.call_args.kwargs

    def premium_package(self):
        response = views.get_packages(self.factory.get('/api/payments/packages/'))
        return [p for p in response.data['packages'] if p['tier'] == 'premium'][0]

    def sell(self, count):
        from apps.payments.models import Payment
        for i in range(count):
            buyer = User.objects.create(email=f'paid{i}@example.com', full_name='Paid')
            Payment.objects.create(user=buyer, stripe_payment_intent_id=f'pi_{i}', amount_cents=11900,
                                   currency='usd', status='succeeded', package_tier='premium')

    def test_founding_price_while_spots_remain_with_a_short_checkout(self):
        self.sell(1)
        kwargs = self.checkout()
        self.assertEqual(kwargs['line_items'][0]['price_data']['unit_amount'], 11900)
        self.assertIn('expires_at', kwargs)
        package = self.premium_package()
        self.assertEqual(package['price'], 119.0)
        self.assertTrue(package['founding_active'])
        self.assertEqual(package['founding_spots_left'], 1)

    def test_list_price_everywhere_once_sold_out(self):
        self.sell(2)
        kwargs = self.checkout()
        self.assertEqual(kwargs['line_items'][0]['price_data']['unit_amount'], 14999)
        self.assertNotIn('expires_at', kwargs)
        package = self.premium_package()
        self.assertEqual(package['price'], 149.99)
        self.assertFalse(package['founding_active'])
