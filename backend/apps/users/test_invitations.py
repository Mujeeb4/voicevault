from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.users.models import FamilyInvitation, FamilyMember, User
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


class DatabaseBackedInvitationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.owner = User.objects.create(email='owner2@example.com', full_name='Owner')
        self.recipient = User.objects.create(email='invitee@example.com', full_name='Invitee')
        self.member = FamilyMember.objects.create(
            ai_owner=self.owner, email='invitee@example.com', full_name='Invitee', relationship='child',
        )

    def accept(self, token, user=None):
        request = self.factory.post('/accept/', {}, format='json')
        request.supabase_user = SupabaseUser(str(user.id), user.email, {})
        with patch('apps.users.views_family.send_welcome_email'), \
                patch('apps.users.views_family.send_invitation_accepted_email'):
            return accept_invitation(request, token)

    def test_token_is_stored_hashed_and_survives_cache_flush(self):
        token, url = generate_invitation_token(self.member, 'Hi there')
        self.assertTrue(url.endswith(f'/accept-invite/{token}'))
        invitation = FamilyInvitation.objects.get()
        self.assertNotEqual(invitation.token_hash, token)
        self.assertEqual(invitation.personal_message, 'Hi there')
        self.assertEqual(invitation.status, 'pending')
        self.assertAlmostEqual(
            (invitation.expires_at - invitation.created_at).total_seconds(), 7 * 86400, delta=5
        )
        cache.clear()
        self.assertEqual(validate_invitation_token(token), self.member)

    def test_resend_revokes_previous_pending_token(self):
        old, _ = generate_invitation_token(self.member)
        new, _ = generate_invitation_token(self.member)
        self.assertIsNone(validate_invitation_token(old))
        self.assertIsNotNone(validate_invitation_token(new))
        self.assertEqual(FamilyInvitation.objects.filter(status='revoked').count(), 1)
        self.assertEqual(self.accept(old, self.recipient).status_code, 400)

    def test_accept_is_single_use_and_records_accepter(self):
        token, _ = generate_invitation_token(self.member)
        self.assertEqual(self.accept(token, self.recipient).status_code, 200)
        invitation = FamilyInvitation.objects.get()
        self.assertEqual(invitation.status, 'accepted')
        self.assertEqual(invitation.accepted_by, self.recipient)
        self.assertEqual(self.accept(token, self.recipient).status_code, 400)

    def test_expired_token_is_rejected_on_validate_and_accept(self):
        token, _ = generate_invitation_token(self.member)
        FamilyInvitation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertIsNone(validate_invitation_token(token))
        self.assertEqual(FamilyInvitation.objects.get().status, 'expired')
        self.assertEqual(self.accept(token, self.recipient).status_code, 400)
        self.member.refresh_from_db()
        self.assertFalse(self.member.has_access)

    def test_legacy_cache_token_still_works_once(self):
        cache.set('invitation_token:legacy-token', str(self.member.id), timeout=600)
        self.assertEqual(validate_invitation_token('legacy-token'), self.member)
        self.assertEqual(self.accept('legacy-token', self.recipient).status_code, 200)
        self.assertIsNone(validate_invitation_token('legacy-token'))
        self.assertEqual(self.accept('legacy-token', self.recipient).status_code, 400)

    def test_unknown_token_is_rejected(self):
        self.assertIsNone(validate_invitation_token('nope'))
        self.assertEqual(self.accept('nope', self.recipient).status_code, 400)
