from types import SimpleNamespace
from unittest.mock import patch

import stripe

from django.core.cache import cache
from django.core.checks import run_checks
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.payments import views
from apps.payments.models import CreditPurchase
from apps.users.models import FamilyMember, User
from services import plan_limits
from services.ai_costs import pricing_report, suggested_credit_price_cents, worst_case_question_cost_usd
from utils.supabase_auth import SupabaseUser


class ThrottleIsolationMixin:
    """These views are rate limited per client; clear the counts so tests don't throttle each other."""
    def setUp(self):
        cache.clear()
        super().setUp()

    def tearDown(self):
        cache.clear()
        super().tearDown()


def premium_owner(email='owner@example.com'):
    owner = User.objects.create(email=email, full_name='Owner', ai_ready=True)
    owner.activate_premium()
    return owner


def family_member(owner, email='child@example.com', **fields):
    account = User.objects.create(email=email, full_name='Child')
    return FamilyMember.objects.create(
        ai_owner=owner, email=email, relationship='child', has_access=True, user_account=account, **fields
    )


@override_settings(PREMIUM_QUESTIONS_PER_FAMILY_MEMBER=2)
class QuestionAllowanceTests(TestCase):
    def setUp(self):
        self.owner = premium_owner()
        self.member = family_member(self.owner)

    def reserve(self):
        return plan_limits.reserve_question(self.owner, self.member)

    def test_included_questions_are_used_before_credits(self):
        self.member.credit_balance = 1
        self.member.save()

        sources = [self.reserve()[1] for _ in range(3)]

        self.assertEqual(sources, ['included', 'included', 'credit'])
        self.member.refresh_from_db()
        self.assertEqual((self.member.included_questions_used, self.member.credit_balance), (2, 0))

    def test_question_is_refused_with_credits_required_once_everything_is_used(self):
        self.reserve()
        self.reserve()

        result, source = self.reserve()

        self.assertFalse(result.allowed)
        self.assertIsNone(source)
        self.assertTrue(result.as_error()['credits_required'])
        self.assertFalse(result.as_error()['upgrade_required'])

    def test_refund_returns_the_question_to_where_it_came_from(self):
        self.member.credit_balance = 1
        self.member.save()
        _, first = self.reserve()
        self.reserve()
        _, from_credit = self.reserve()

        plan_limits.refund_question(self.member, from_credit)
        plan_limits.refund_question(self.member, first)

        self.member.refresh_from_db()
        self.assertEqual((self.member.included_questions_used, self.member.credit_balance), (1, 1))

    def test_each_family_member_has_their_own_allowance(self):
        other = family_member(self.owner, email='sibling@example.com')
        self.reserve()
        self.reserve()

        result, source = plan_limits.reserve_question(self.owner, other)

        self.assertTrue(result.allowed)
        self.assertEqual(source, 'included')

    def test_free_vault_keeps_its_monthly_message_limit(self):
        free_owner = User.objects.create(email='free@example.com', full_name='Free', ai_ready=True)
        member = family_member(free_owner, email='free-child@example.com')

        result, source = plan_limits.reserve_question(free_owner, member)

        self.assertTrue(result.allowed)
        self.assertEqual(source, 'free_plan')

    def test_premium_voice_answer_is_part_of_the_question(self):
        self.assertTrue(plan_limits.can_generate_voice_response(self.owner).allowed)


class FamilyMemberLimitTests(TestCase):
    @override_settings(PREMIUM_MAX_FAMILY_MEMBERS=1)
    def test_family_limit_comes_from_settings_and_ignores_the_owners_own_record(self):
        owner = premium_owner()
        FamilyMember.objects.create(ai_owner=owner, email=owner.email, relationship='self', has_access=True)

        self.assertTrue(plan_limits.can_invite_family_member(owner).allowed)
        family_member(owner)
        self.assertFalse(plan_limits.can_invite_family_member(owner).allowed)
        self.assertEqual(plan_limits.get_limits(owner)['family_members'], 1)

    @override_settings(FREE_MAX_FAMILY_MEMBERS=3)
    def test_free_family_limit_comes_from_settings(self):
        owner = User.objects.create(email='free@example.com', full_name='Free')
        self.assertEqual(plan_limits.get_limits(owner)['family_members'], 3)


class CreditPurchaseTests(ThrottleIsolationMixin, TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = premium_owner()
        self.member = family_member(self.owner)

    def checkout_request(self, credits, user=None):
        user = user or self.member.user_account
        request = self.factory.post(
            '/api/payments/credits/checkout/', {'ai_owner_id': str(self.owner.id), 'credits': credits}, format='json'
        )
        request.supabase_user = SupabaseUser(str(user.id), user.email, {})
        return request

    def session(self, session_id='cs_credits', credits=50):
        return {
            'id': session_id,
            'payment_intent': 'pi_credits',
            'amount_total': credits * 20,
            'currency': 'usd',
            'metadata': {
                'purchase_type': 'credits',
                'user_id': str(self.member.user_account_id),
                'family_member_id': str(self.member.id),
                'credits': str(credits),
            },
        }

    @patch('apps.payments.views.stripe.Customer.create')
    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_checkout_charges_the_unit_price_and_saves_the_card(self, session_create, customer_create):
        customer_create.return_value.id = 'cus_member'
        session_create.return_value.id = 'cs_credits'
        session_create.return_value.url = 'https://checkout.stripe.test/cs_credits'

        response = views.create_credit_checkout_session(self.checkout_request(50))

        self.assertEqual(response.status_code, 200)
        kwargs = session_create.call_args.kwargs
        self.assertEqual(kwargs['line_items'][0]['quantity'], 50)
        self.assertEqual(kwargs['line_items'][0]['price_data']['unit_amount'], 20)
        self.assertEqual(kwargs['metadata']['family_member_id'], str(self.member.id))
        self.assertEqual(kwargs['customer'], 'cus_member')
        self.assertEqual(kwargs['payment_intent_data']['setup_future_usage'], 'off_session')
        # The intent carries the credit metadata, so a decline isn't treated as a failed Premium payment
        self.assertEqual(kwargs['payment_intent_data']['metadata']['purchase_type'], 'credits')
        self.member.user_account.refresh_from_db()
        self.assertEqual(self.member.user_account.stripe_customer_id, 'cus_member')

    @patch('apps.payments.views.stripe.Customer.create')
    @patch('apps.payments.views.stripe.Customer.retrieve')
    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_checkout_replaces_a_customer_left_over_from_test_mode(self, session_create, retrieve, create):
        buyer = self.member.user_account
        buyer.stripe_customer_id = 'cus_from_test_mode'
        buyer.saved_payment_method_id = 'pm_from_test_mode'
        buyer.saved_card_last4 = '4242'
        buyer.save()
        retrieve.side_effect = stripe.error.InvalidRequestError('No such customer', 'id', code='resource_missing')
        create.return_value.id = 'cus_live'
        session_create.return_value.id = 'cs_credits'
        session_create.return_value.url = 'https://checkout.stripe.test/cs_credits'

        response = views.create_credit_checkout_session(self.checkout_request(50))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(session_create.call_args.kwargs['customer'], 'cus_live')
        buyer.refresh_from_db()
        self.assertEqual(buyer.stripe_customer_id, 'cus_live')
        self.assertEqual(buyer.saved_payment_method_id, '')

    @patch('apps.payments.views.send_payment_failed_email')
    def test_declined_credit_checkout_does_not_send_the_premium_failure_email(self, send_email):
        buyer = self.member.user_account
        buyer.stripe_customer_id = 'cus_member'
        buyer.save(update_fields=['stripe_customer_id'])
        views.handle_payment_failed({
            'id': 'pi_declined_credits',
            'customer': 'cus_member',
            'metadata': {'purchase_type': 'credits'},
        })
        send_email.assert_not_called()

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_checkout_rejects_amounts_outside_the_allowed_range(self, session_create):
        for credits in (1, 100000, 'lots'):
            response = views.create_credit_checkout_session(self.checkout_request(credits))
            self.assertEqual(response.status_code, 400)
        session_create.assert_not_called()

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_people_outside_the_vault_cannot_buy_credits_for_it(self, session_create):
        stranger = User.objects.create(email='stranger@example.com', full_name='Stranger')
        response = views.create_credit_checkout_session(self.checkout_request(50, user=stranger))
        self.assertEqual(response.status_code, 403)
        session_create.assert_not_called()

    @patch('apps.payments.views.stripe.checkout.Session.create')
    def test_free_vaults_cannot_buy_credits(self, session_create):
        free_owner = User.objects.create(email='free@example.com', full_name='Free', ai_ready=True)
        member = family_member(free_owner, email='free-child@example.com')
        request = self.factory.post(
            '/api/payments/credits/checkout/', {'ai_owner_id': str(free_owner.id), 'credits': 50}, format='json'
        )
        request.supabase_user = SupabaseUser(str(member.user_account_id), member.email, {})

        response = views.create_credit_checkout_session(request)

        self.assertEqual(response.status_code, 400)
        session_create.assert_not_called()

    def test_completed_checkout_adds_credits_once_and_does_not_grant_premium(self):
        buyer = self.member.user_account
        views.handle_checkout_completed(self.session())
        views.handle_checkout_completed(self.session())

        self.member.refresh_from_db()
        buyer.refresh_from_db()
        self.assertEqual(self.member.credit_balance, 50)
        self.assertEqual(CreditPurchase.objects.count(), 1)
        self.assertFalse(buyer.has_premium_access)

    @patch('apps.payments.views.stripe.PaymentIntent.retrieve')
    def test_completed_checkout_remembers_the_saved_card(self, retrieve):
        retrieve.return_value.payment_method.id = 'pm_card'
        retrieve.return_value.payment_method.card.brand = 'visa'
        retrieve.return_value.payment_method.card.last4 = '4242'
        session = self.session()
        session['metadata']['save_card'] = 'true'

        views.handle_checkout_completed(session)

        buyer = self.member.user_account
        buyer.refresh_from_db()
        self.assertEqual((buyer.saved_payment_method_id, buyer.saved_card_brand, buyer.saved_card_last4),
                         ('pm_card', 'visa', '4242'))

    def test_credit_balance_endpoint_reports_remaining_questions(self):
        self.member.credit_balance = 7
        self.member.save()
        user = self.member.user_account
        request = self.factory.get('/api/payments/credits/', {'ai_owner_id': str(self.owner.id)})
        request.supabase_user = SupabaseUser(str(user.id), user.email, {})

        response = views.get_question_credits(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['credit_balance'], 7)
        self.assertEqual(response.data['questions_remaining'], 107)


class SavedCardRefillTests(ThrottleIsolationMixin, TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = premium_owner()
        self.member = family_member(self.owner)
        self.buyer = self.member.user_account
        self.buyer.stripe_customer_id = 'cus_member'
        self.buyer.saved_payment_method_id = 'pm_card'
        self.buyer.saved_card_brand = 'visa'
        self.buyer.saved_card_last4 = '4242'
        self.buyer.save()

    def refill(self, credits=100, request_id='click-1'):
        request = self.factory.post(
            '/api/payments/credits/refill/',
            {'ai_owner_id': str(self.owner.id), 'credits': credits, 'request_id': request_id}, format='json',
        )
        request.supabase_user = SupabaseUser(str(self.buyer.id), self.buyer.email, {})
        return views.buy_credits_with_saved_card(request)

    def intent(self, status='succeeded'):
        return SimpleNamespace(id='pi_refill', status=status, amount=2000, currency='usd')

    @patch('apps.payments.views.stripe.PaymentIntent.create')
    def test_refill_charges_the_saved_card_once_and_adds_credits(self, create):
        create.return_value = self.intent()

        response = self.refill()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['questions']['credit_balance'], 100)
        kwargs = create.call_args.kwargs
        self.assertEqual((kwargs['customer'], kwargs['payment_method'], kwargs['amount']), ('cus_member', 'pm_card', 2000))
        self.assertTrue(kwargs['confirm'])
        self.assertEqual(kwargs['idempotency_key'], f'credit-refill-{self.buyer.id}-click-1')

        # The payment_intent.succeeded webhook for the same refill adds nothing more
        views.handle_saved_card_payment_succeeded({
            'id': 'pi_refill', 'amount': 2000, 'currency': 'usd', 'metadata': kwargs['metadata'],
        })
        self.member.refresh_from_db()
        self.assertEqual(self.member.credit_balance, 100)
        self.assertEqual(CreditPurchase.objects.count(), 1)

    @patch('apps.payments.views.stripe.PaymentIntent.create')
    def test_webhook_credits_a_refill_whose_request_ended_early(self, create):
        views.handle_saved_card_payment_succeeded({
            'id': 'pi_lost', 'amount': 1000, 'currency': 'usd',
            'metadata': {'purchase_type': 'credits', 'credit_source': 'saved_card',
                         'family_member_id': str(self.member.id), 'user_id': str(self.buyer.id), 'credits': '50'},
        })
        self.member.refresh_from_db()
        self.assertEqual(self.member.credit_balance, 50)

    @patch('apps.payments.views.stripe.PaymentIntent.create')
    def test_declined_card_falls_back_to_checkout(self, create):
        create.side_effect = stripe.error.CardError('declined', None, 'card_declined')

        response = self.refill()

        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.data['requires_checkout'])
        self.member.refresh_from_db()
        self.assertEqual(self.member.credit_balance, 0)

    @patch('apps.payments.views.stripe.PaymentIntent.create')
    def test_card_left_over_from_test_mode_is_forgotten_and_checkout_used(self, create):
        create.side_effect = stripe.error.InvalidRequestError(
            'No such PaymentMethod', 'payment_method', code='resource_missing'
        )

        response = self.refill()

        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.data['requires_checkout'])
        self.member.user_account.refresh_from_db()
        self.assertEqual(self.member.user_account.saved_payment_method_id, '')
        self.member.refresh_from_db()
        self.assertEqual(self.member.credit_balance, 0)

    @patch('apps.payments.views.stripe.PaymentIntent.cancel')
    @patch('apps.payments.views.stripe.PaymentIntent.create')
    def test_bank_verification_falls_back_to_checkout(self, create, cancel):
        create.return_value = self.intent(status='requires_action')

        response = self.refill()

        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.data['requires_checkout'])
        cancel.assert_called_once_with('pi_refill')
        self.assertFalse(CreditPurchase.objects.exists())

    @patch('apps.payments.views.stripe.PaymentIntent.create')
    def test_refill_without_a_saved_card_asks_for_checkout(self, create):
        self.buyer.saved_payment_method_id = ''
        self.buyer.save()

        response = self.refill()

        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data['requires_checkout'])
        create.assert_not_called()

    @patch('apps.payments.views.stripe.PaymentMethod.detach')
    def test_removing_the_card_detaches_it_at_stripe(self, detach):
        request = self.factory.delete('/api/payments/credits/saved-card/')
        request.supabase_user = SupabaseUser(str(self.buyer.id), self.buyer.email, {})

        response = views.remove_saved_card(request)

        self.assertEqual(response.status_code, 200)
        detach.assert_called_once_with('pm_card')
        self.buyer.refresh_from_db()
        self.assertEqual(self.buyer.saved_payment_method_id, '')


@override_settings(
    CHAT_MAX_INPUT_TOKENS=2000, CHAT_MAX_OUTPUT_TOKENS=300,
    CHAT_INPUT_PRICE_PER_MILLION_USD=2.5, CHAT_OUTPUT_PRICE_PER_MILLION_USD=10,
    VOICE_REPLY_MAX_COST_USD=0.05, VOICE_QUESTION_MAX_SECONDS=120, TRANSCRIPTION_PRICE_PER_MINUTE_USD=0.006,
    STRIPE_FEE_PERCENT=2.9, STRIPE_FEE_FIXED_CENTS=30, TARGET_GROSS_MARGIN_PERCENT=50,
)
class AiCostTests(TestCase):
    def test_worst_case_adds_chat_voice_answer_and_voice_question(self):
        cost = worst_case_question_cost_usd()
        self.assertAlmostEqual(cost['chat'], 0.008)
        self.assertAlmostEqual(cost['voice_question'], 0.012)
        self.assertAlmostEqual(cost['total'], 0.07)

    @override_settings(CREDIT_UNIT_PRICE_CENTS=5, CREDIT_MIN_PURCHASE=25)
    def test_underpriced_credits_raise_a_startup_warning(self):
        ids = {warning.id for warning in run_checks()}
        self.assertIn('payments.W001', ids)

    @override_settings(CREDIT_MIN_PURCHASE=25)
    def test_suggested_credit_price_meets_the_target_margin(self):
        with override_settings(CREDIT_UNIT_PRICE_CENTS=suggested_credit_price_cents()):
            self.assertGreaterEqual(pricing_report()['credits']['margin_percent'], 50)
