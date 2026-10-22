from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.users.models import FamilyMember, User
from apps.users.views_family import accept_invitation, accessible_ais
from apps.users.views_auth import generate_jwt_token
from utils.invitation_tokens import generate_invitation_token, validate_invitation_token
from utils.supabase_auth import SupabaseUser


class InvitationAcceptanceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.owner = User.objects.create(email='owner@example.com', full_name='Owner')
        self.recipient = User.objects.create(email='recipient@example.com', full_name='Recipient')
        self.other = User.objects.create(email='other@example.com', full_name='Other')
        self.member = FamilyMember.objects.create(
            ai_owner=self.owner, email='RECIPIENT@example.com',
            full_name='Recipient', relationship='child',
        )
        self.token, _ = generate_invitation_token(self.member)

    def request(self, user=None, data=None):
        request = self.factory.post('/accept/', data or {}, format='json')
        if user:
            request.supabase_user = SupabaseUser(str(user.id), user.email, {})
        return request

    def test_anonymous_cannot_accept_or_supply_a_user_id(self):
        response = accept_invitation(
            self.request(data={'user_id': str(self.recipient.id)}), self.token,
        )
        self.assertEqual(response.status_code, 401)
        self.member.refresh_from_db()
        self.assertFalse(self.member.has_access)
        self.assertIsNotNone(validate_invitation_token(self.token))

    def test_other_account_cannot_accept_or_consume_token(self):
        response = accept_invitation(
            self.request(self.other, {'user_id': str(self.recipient.id)}), self.token,
        )
        self.assertEqual(response.status_code, 403)
        self.member.refresh_from_db()
        self.assertFalse(self.member.has_access)
        self.assertIsNone(self.member.user_account)
        self.assertIsNotNone(validate_invitation_token(self.token))

    @patch('apps.users.views_family.send_welcome_email')
    @patch('apps.users.views_family.send_invitation_accepted_email')
    def test_matching_recipient_accepts_case_insensitively(self, owner_mail, welcome_mail):
        response = accept_invitation(self.request(self.recipient), self.token)
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertTrue(self.member.has_access)
        self.assertEqual(self.member.user_account, self.recipient)
        self.assertIsNone(validate_invitation_token(self.token))
        welcome_mail.assert_called_once()
        owner_mail.assert_called_once()
        self.owner.ai_ready = True
        self.owner.save(update_fields=['ai_ready'])
        request = self.factory.get('/api/family/accessible-ais/')
        request.supabase_user = SupabaseUser(str(self.recipient.id), self.recipient.email, {})
        self.assertIn(str(self.owner.id), [item['id'] for item in accessible_ais(request).data['results']])

    @override_settings(FRONTEND_URL='https://frontend.example.com/')
    def test_invite_url_uses_backend_frontend_configuration(self):
        token, url = generate_invitation_token(self.member)
        self.assertEqual(url, f'https://frontend.example.com/accept-invite/{token}')

    @override_settings(MIDDLEWARE=[
        'django.middleware.security.SecurityMiddleware',
        'utils.supabase_auth.SupabaseAuthMiddleware',
    ])
    @patch('apps.users.views_family.send_welcome_email')
    @patch('apps.users.views_family.send_invitation_accepted_email')
    def test_real_middleware_authenticates_recipient_on_accept_route(self, owner_mail, welcome_mail):
        token = generate_jwt_token(self.recipient)['access']
        response = self.client.post(
            f'/api/family/accept-invite/{self.token}/', {},
            content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.user_account, self.recipient)

    @override_settings(MIDDLEWARE=[
        'django.middleware.security.SecurityMiddleware',
        'utils.supabase_auth.SupabaseAuthMiddleware',
    ])
    def test_real_middleware_rejects_wrong_recipient_and_anonymous_acceptance(self):
        path = f'/api/family/accept-invite/{self.token}/'
        self.assertEqual(self.client.post(path, {}).status_code, 401)
        token = generate_jwt_token(self.other)['access']
        response = self.client.post(path, {}, HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, 403)
        self.member.refresh_from_db()
        self.assertFalse(self.member.has_access)
