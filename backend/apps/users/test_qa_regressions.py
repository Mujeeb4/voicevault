"""Regression tests for the QA audit fixes in sign-in, signup, password reset and admin."""
import uuid
from unittest import mock

from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.db.models import F
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.admin_dashboard import views as admin_views
from apps.users import views_auth
from apps.users.models import User
from utils.supabase_auth import SupabaseUser

PASSWORD = 'Str0ng!Passw0rd#9'


def post(view, data, path='/api/users/x/'):
    request = APIRequestFactory().post(path, data, format='json')
    return view.as_view()(request)


class MalformedInputTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_signup_accepts_null_phone_number(self):
        with mock.patch.object(views_auth, 'send_verification_email', return_value=True):
            response = post(views_auth.SignupView, {
                'email': 'new@example.com', 'password': PASSWORD, 'full_name': 'New Person', 'phone_number': None,
            })
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(User.objects.get(email='new@example.com').phone_number)

    def test_signup_and_login_reject_non_text_email_with_400(self):
        self.assertEqual(post(views_auth.SignupView, {'email': 123, 'password': 'x', 'full_name': 'A'}).status_code, 400)
        self.assertEqual(post(views_auth.LoginView, {'email': 123, 'password': 'x'}).status_code, 400)
        self.assertEqual(post(views_auth.LoginView, {'email': 'a@example.com', 'password': 123}).status_code, 400)


class LoginDoesNotOverwriteConcurrentChangesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create(
            email='racer@example.com', full_name='Racer', password_hash=make_password(PASSWORD), email_verified=True,
        )

    def test_changes_made_during_the_password_check_survive_login(self):
        real_check = views_auth.check_password

        def check_then_change_elsewhere(password, hashed):
            ok = real_check(password, hashed)
            # A purchase and a session revocation land while the password is being checked
            User.objects.filter(id=self.user.id).update(is_premium=True, token_version=F('token_version') + 1)
            return ok

        with mock.patch.object(views_auth, 'check_password', side_effect=check_then_change_elsewhere):
            response = post(views_auth.LoginView, {'email': 'racer@example.com', 'password': PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_premium)
        self.assertEqual(self.user.token_version, 1)
        self.assertIsNotNone(self.user.last_login_at)


class ResetAndCooldownTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create(
            email='locked@example.com', full_name='Locked', password_hash=make_password(PASSWORD), email_verified=True,
        )

    def test_password_reset_ends_the_login_lockout(self):
        for _ in range(20):
            views_auth._record_login_failure('locked@example.com')
        self.assertTrue(cache.get(views_auth._login_failure_key('locked@example.com')))
        with mock.patch.object(views_auth, 'send_password_changed_email'):
            response = post(views_auth.PasswordResetConfirmView, {
                'token': views_auth.make_reset_token(self.user), 'new_password': 'An0ther!Str0ng#Pass42',
            })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(cache.get(views_auth._login_failure_key('locked@example.com')))

    def test_reset_and_resend_emails_are_limited_to_one_a_minute_per_address(self):
        same_answer = []
        with mock.patch.object(views_auth, 'send_password_reset_email') as reset_email, \
                mock.patch.object(views_auth, 'send_verification_for') as verify_email:
            User.objects.filter(id=self.user.id).update(email_verified=False)
            for _ in range(3):
                same_answer.append(post(views_auth.PasswordResetRequestView, {'email': 'locked@example.com'}).status_code)
                same_answer.append(post(views_auth.ResendVerificationView, {'email': 'locked@example.com'}).status_code)
        self.assertEqual(set(same_answer), {200})
        self.assertEqual(reset_email.call_count, 1)
        self.assertEqual(verify_email.call_count, 1)


@override_settings(ADMIN_EMAILS='admin@example.com')
class AdminPremiumRevokeTests(TestCase):
    def test_turning_premium_off_clears_every_premium_flag(self):
        admin = User.objects.create(email='admin@example.com', full_name='Admin')
        member = User.objects.create(
            email='paid@example.com', full_name='Paid', is_premium=True, plan_type='premium',
            lifetime_access=True, payment_completed=True, package_tier='premium',
        )
        request = APIRequestFactory().patch(f'/api/admin/users/{member.id}/', {'is_premium': False}, format='json')
        request.supabase_user = SupabaseUser(str(admin.id), admin.email, {})
        response = admin_views.admin_user_detail(request, user_id=member.id)
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        member.refresh_from_db()
        self.assertFalse(member.has_premium_access)
        self.assertEqual((member.plan_type, member.package_tier), ('free', 'free'))
