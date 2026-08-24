from datetime import datetime, timedelta

import jwt
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.users.models import User
from apps.users.views import UserProfileView
from apps.users.views_auth import LoginView, RefreshTokenView, SignupView, generate_jwt_token
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
