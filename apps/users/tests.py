from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.users.models import User
from apps.users.views import UserProfileView
from apps.users.views_auth import SignupView
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
