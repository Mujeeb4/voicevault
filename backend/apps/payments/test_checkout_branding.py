from unittest.mock import patch

import stripe
from django.test import SimpleTestCase

from apps.payments import views


class CheckoutBrandingTests(SimpleTestCase):
    """Checkout says VoiceVault, and branding can never block a payment."""

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_first_attempt_has_name_logo_suffix_and_api_version(self, create):
        create.return_value = object()
        views._create_checkout_session('https://voicevault.life/', mode='payment', customer='cus_1')

        kwargs = create.call_args.kwargs
        self.assertEqual(create.call_count, 1)
        self.assertEqual(kwargs['branding_settings']['display_name'], 'VoiceVault')
        self.assertEqual(kwargs['branding_settings']['logo'], {'type': 'url', 'url': 'https://voicevault.life/logo.png'})
        self.assertEqual(kwargs['stripe_version'], views.CHECKOUT_BRANDING_API_VERSION)
        self.assertEqual(kwargs['payment_intent_data']['statement_descriptor_suffix'], 'VOICEVAULT')
        self.assertEqual(kwargs['customer'], 'cus_1')

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_existing_payment_intent_data_is_kept(self, create):
        create.return_value = object()
        views._create_checkout_session(
            'https://voicevault.life', payment_intent_data={'setup_future_usage': 'off_session', 'metadata': {'a': '1'}}
        )
        intent = create.call_args.kwargs['payment_intent_data']
        self.assertEqual(intent['setup_future_usage'], 'off_session')
        self.assertEqual(intent['metadata'], {'a': '1'})
        self.assertEqual(intent['statement_descriptor_suffix'], 'VOICEVAULT')

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_rejected_logo_falls_back_to_name_only_then_plain(self, create):
        err = stripe.error.InvalidRequestError('bad param', 'branding_settings')
        create.side_effect = [err, err, 'plain-session']

        result = views._create_checkout_session('https://voicevault.life', mode='payment')

        self.assertEqual(result, 'plain-session')
        second, third = create.call_args_list[1].kwargs, create.call_args_list[2].kwargs
        self.assertEqual(second['branding_settings'], {'display_name': 'VoiceVault'})
        self.assertNotIn('branding_settings', third)
        self.assertNotIn('stripe_version', third)
        self.assertNotIn('payment_intent_data', third)

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_non_parameter_errors_are_not_retried(self, create):
        create.side_effect = stripe.error.APIConnectionError('network down')
        with self.assertRaises(stripe.error.APIConnectionError):
            views._create_checkout_session('https://voicevault.life', mode='payment')
        self.assertEqual(create.call_count, 1)

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_plain_failure_is_raised_when_every_attempt_is_rejected(self, create):
        create.side_effect = stripe.error.InvalidRequestError('nope', None)
        with self.assertRaises(stripe.error.InvalidRequestError):
            views._create_checkout_session('https://voicevault.life', mode='payment')
        self.assertEqual(create.call_count, 3)
