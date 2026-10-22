import time
from datetime import datetime, timedelta

import jwt
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.users.models import User
from apps.users.views import UserProfileView
from apps.users.views_auth import ChangePasswordView, LoginView, RefreshTokenView, SignupView, generate_jwt_token
from utils.supabase_auth import SupabaseUser


class UserProfileRegressionTests(TestCase):
    def test_profile_patch_cannot_change_email_or_entitlements(self):
        user = User.objects.create(email='owner@example.com', full_name='Owner')
        request = APIRequestFactory().patch('/api/users/profile/', {
            'email': 'attacker@example.com',
            'full_name': 'Updated Owner',
            'is_premium': True,
        }, format='json')
        request.supabase_user = SupabaseUser(str(user.id), user.email, {})
        response = UserProfileView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.email, 'owner@example.com')
        self.assertEqual(user.full_name, 'Updated Owner')
        self.assertFalse(user.is_premium)


class SignupRegressionTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_signup_persists_optional_phone_number(self):
        request = APIRequestFactory().post('/api/users/signup/', {
            'email': 'new-owner@example.com',
            'password': 'strong-pass-123',
            'full_name': 'New Owner',
            'phone_number': '+1 202 555 0199',
        }, format='json')

        response = SignupView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            User.objects.get(email='new-owner@example.com').phone_number,
            '+1 202 555 0199',
        )

    @patch('apps.users.views_auth.send_verification_email')
    @patch('apps.users.views_auth.send_account_welcome_email')
    def test_signup_requires_verification_and_issues_no_tokens(self, welcome, verify):
        request = APIRequestFactory().post('/api/users/signup/', {
            'email': 'welcome@example.com',
            'password': 'strong-pass-123',
            'full_name': 'Welcome Owner',
        }, format='json')
        response = SignupView.as_view()(request)
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('tokens', response.data)
        self.assertTrue(response.data['verification_required'])
        user = User.objects.get(email='welcome@example.com')
        self.assertFalse(user.email_verified)
        self.assertIsNone(user.last_login_at)
        welcome.assert_not_called()
        verify.assert_called_once()
        self.assertIn('/verify-email?token=', verify.call_args[0][2])

    def test_signup_rejects_malformed_email(self):
        request = APIRequestFactory().post('/api/users/signup/', {
            'email': 'not-an-email',
            'password': 'strong-pass-123',
            'full_name': 'New Owner',
        }, format='json')

        response = SignupView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'invalid_email')
        self.assertFalse(User.objects.exists())

    def test_signup_rejects_oversized_phone_number(self):
        request = APIRequestFactory().post('/api/users/signup/', {
            'email': 'new-owner@example.com',
            'password': 'strong-pass-123',
            'full_name': 'New Owner',
            'phone_number': '1' * 21,
        }, format='json')

        response = SignupView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'invalid_phone_number')


class TokenRegressionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.user = User.objects.create(
            email='auth-owner@example.com',
            full_name='Auth Owner',
            password_hash=make_password('strong-pass-123'),
            email_verified=True,
        )

    def test_login_and_refresh_happy_path(self):
        login_request = self.factory.post('/api/users/login/', {
            'email': 'AUTH-OWNER@EXAMPLE.COM',
            'password': 'strong-pass-123',
        }, format='json')
        login_response = LoginView.as_view()(login_request)
        self.assertEqual(login_response.status_code, 200)

        refresh_request = self.factory.post('/api/users/refresh/', {
            'refresh': login_response.data['tokens']['refresh'],
        }, format='json')
        refresh_response = RefreshTokenView.as_view()(refresh_request)
        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn('access', refresh_response.data)

    def test_refresh_rejects_access_and_expired_tokens(self):
        tokens = generate_jwt_token(self.user)
        access_request = self.factory.post('/api/users/refresh/', {
            'refresh': tokens['access'],
        }, format='json')
        self.assertEqual(RefreshTokenView.as_view()(access_request).status_code, 401)

        expired = jwt.encode(
            {
                'sub': str(self.user.id),
                'email': self.user.email,
                'type': 'refresh',
                'iat': datetime.utcnow() - timedelta(days=8),
                'exp': datetime.utcnow() - timedelta(days=1),
            },
            getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY),
            algorithm='HS256',
        )
        expired_request = self.factory.post('/api/users/refresh/', {
            'refresh': expired,
        }, format='json')
        self.assertEqual(RefreshTokenView.as_view()(expired_request).status_code, 401)


class ChangePasswordRegressionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(
            email='password-owner@example.com',
            full_name='Password Owner',
            password_hash=make_password('current-pass-123'),
            email_verified=True,
        )

    def request(self, current_password, new_password):
        request = self.factory.post('/api/users/change-password/', {
            'current_password': current_password,
            'new_password': new_password,
        }, format='json')
        request.supabase_user = SupabaseUser(str(self.user.id), self.user.email, {})
        return request

    def test_change_password_verifies_current_password(self):
        response = ChangePasswordView.as_view()(
            self.request('wrong-pass-123', 'new-strong-pass-123')
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'invalid_current_password')

    def test_change_password_updates_login_credentials(self):
        response = ChangePasswordView.as_view()(
            self.request('current-pass-123', 'new-strong-pass-123')
        )
        self.assertEqual(response.status_code, 200)

        login_request = self.factory.post('/api/users/login/', {
            'email': self.user.email,
            'password': 'new-strong-pass-123',
        }, format='json')
        self.assertEqual(LoginView.as_view()(login_request).status_code, 200)


class ChangePasswordEmailTests(ChangePasswordRegressionTests):
    @patch('apps.users.views_auth.send_password_changed_email')
    def test_successful_change_sends_notice(self, send_email):
        response = ChangePasswordView.as_view()(
            self.request('current-pass-123', 'new-strong-pass-123')
        )
        self.assertEqual(response.status_code, 200)
        send_email.assert_called_once_with(self.user.email, 'Password Owner')

    @patch('apps.users.views_auth.send_password_changed_email')
    def test_failed_change_sends_nothing(self, send_email):
        ChangePasswordView.as_view()(self.request('wrong-pass-123', 'new-strong-pass-123'))
        send_email.assert_not_called()


class EmailVerificationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.user = User.objects.create(
            email='verify@example.com',
            full_name='Verify Me',
            password_hash=make_password('strong-pass-123'),
        )

    def _verify(self, token):
        from apps.users.views_auth import VerifyEmailView
        return VerifyEmailView.as_view()(self.factory.post('/api/users/verify-email/', {'token': token}, format='json'))

    def _login(self):
        return LoginView.as_view()(self.factory.post('/api/users/login/', {
            'email': 'verify@example.com', 'password': 'strong-pass-123'}, format='json'))

    def test_model_default_is_unverified(self):
        self.assertFalse(self.user.email_verified)

    def test_login_blocked_until_verified(self):
        response = self._login()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'email_not_verified')
        bad = LoginView.as_view()(self.factory.post('/api/users/login/', {
            'email': 'verify@example.com', 'password': 'wrong-password'}, format='json'))
        self.assertEqual(bad.data['error'], 'invalid_credentials')

    def test_refresh_blocked_for_unverified(self):
        tokens = generate_jwt_token(self.user)
        response = RefreshTokenView.as_view()(self.factory.post(
            '/api/users/refresh/', {'refresh': tokens['refresh']}, format='json'))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'email_not_verified')

    @patch('apps.users.views_auth.send_account_welcome_email')
    def test_verify_works_once_and_sends_welcome(self, welcome):
        from apps.users.views_auth import make_verification_token
        token = make_verification_token(self.user)
        self.assertEqual(self._verify(token).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        welcome.assert_called_once_with('verify@example.com', 'Verify Me')
        again = self._verify(token)
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.data['error'], 'token_used')
        self.assertEqual(self._login().status_code, 200)

    def test_invalid_and_expired_tokens(self):
        from apps.users.views_auth import make_verification_token
        self.assertEqual(self._verify('garbage').data['error'], 'invalid_token')
        self.assertEqual(self._verify('').data['error'], 'token_required')
        token = make_verification_token(self.user)
        with patch('django.core.signing.time.time', return_value=time.time() + 25 * 3600):
            self.assertEqual(self._verify(token).data['error'], 'token_expired')
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    @patch('apps.users.views_auth.send_verification_email')
    def test_resend_does_not_leak_existence(self, verify):
        from apps.users.views_auth import ResendVerificationView
        def call(email):
            return ResendVerificationView.as_view()(self.factory.post(
                '/api/users/resend-verification/', {'email': email}, format='json'))
        known = call('verify@example.com')
        unknown = call('nobody@example.com')
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(verify.call_count, 1)
        User.objects.filter(id=self.user.id).update(email_verified=True)
        call('verify@example.com')
        self.assertEqual(verify.call_count, 1)
