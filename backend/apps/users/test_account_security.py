"""Token revocation, password policy, password reset and account deletion."""
from datetime import datetime, timedelta
from unittest.mock import patch

import jwt
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import mail, signing
from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.chat.models import Conversation
from apps.recordings.models import AudioRecording
from apps.users.models import FamilyMember, User
from apps.users.views_auth import RESET_SALT, generate_jwt_token, make_reset_token
from utils.jwt_tokens import signing_key

PW = 'Orchid-Harbor-4821'
NEW_PW = 'Granite-Lantern-9157'


def make_user(email='owner@example.com', **kwargs):
    return User.objects.create(
        email=email, full_name='Owner', password_hash=make_password(PW), email_verified=True, **kwargs
    )


def bearer(token):
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


@override_settings(MIDDLEWARE=list(settings.MIDDLEWARE) + ['utils.supabase_auth.SupabaseAuthMiddleware'])
class ApiCase(TestCase):
    def setUp(self):
        cache.clear()

    def post(self, path, data=None, token=None):
        return self.client.post(path, data or {}, content_type='application/json',
                                **(bearer(token) if token else {}))


class TokenRevocationTests(ApiCase):
    def test_tokens_carry_version_and_work(self):
        user = make_user()
        tokens = generate_jwt_token(user)
        self.assertEqual(jwt.decode(tokens['access'], options={'verify_signature': False})['tv'], 0)
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(tokens['access'])).status_code, 200)

    def test_tokens_missing_required_claims_or_signed_with_the_old_key_are_rejected(self):
        user = make_user()
        now = datetime.utcnow()
        base = {'sub': str(user.id), 'email': user.email, 'iat': now, 'exp': now + timedelta(hours=1)}
        # No issuer/audience (the format before this change), and signed with SECRET_KEY directly
        old_style = jwt.encode({**base, 'type': 'access'}, settings.SECRET_KEY, algorithm='HS256')
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(old_style)).status_code, 401)
        # Right key but no exp claim
        no_exp = {k: v for k, v in base.items() if k != 'exp'}
        unexpiring = jwt.encode({**no_exp, 'type': 'access', 'iss': 'voicevault', 'aud': 'voicevault-api'},
                                signing_key(), algorithm='HS256')
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(unexpiring)).status_code, 401)

    def test_password_change_revokes_old_tokens_and_returns_fresh_ones(self):
        user = make_user()
        old = generate_jwt_token(user)
        response = self.post('/api/users/change-password/',
                             {'current_password': PW, 'new_password': NEW_PW}, token=old['access'])
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('tokens', response.json())
        fresh_access = response.cookies['vv_access'].value
        fresh_refresh = response.cookies['vv_refresh'].value
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(old['access'])).status_code, 401)
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': old['refresh']}).status_code, 401)
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(fresh_access)).status_code, 200)
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': fresh_refresh}).status_code, 200)

    def test_logout_revokes_presented_refresh_token_only(self):
        user = make_user()
        a, b = generate_jwt_token(user), generate_jwt_token(user)
        self.assertEqual(self.post('/api/users/logout/', {'refresh': a['refresh']}).status_code, 200)
        self.assertNotEqual(self.post('/api/users/refresh/', {'refresh': a['refresh']}).status_code, 200)
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': b['refresh']}).status_code, 200)

    def test_refresh_token_works_once_and_reuse_later_ends_every_session(self):
        user = make_user()
        tokens = generate_jwt_token(user)
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': tokens['refresh']}).status_code, 200)
        # Reused a moment later (another tab): told to retry, nothing revoked
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': tokens['refresh']}).status_code, 409)
        user.refresh_from_db()
        self.assertEqual(user.token_version, 0)
        # Reused after the grace window: treated as stolen, all sessions end
        from apps.users.models import RevokedToken
        RevokedToken.objects.update(created_at=datetime.now(tz=__import__('datetime').timezone.utc) - timedelta(minutes=5))
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': tokens['refresh']}).status_code, 401)
        user.refresh_from_db()
        self.assertEqual(user.token_version, 1)

    def test_cookie_session_needs_the_csrf_header_for_writes(self):
        user = make_user()
        tokens = generate_jwt_token(user)
        self.client.cookies['vv_access'] = tokens['access']
        self.assertEqual(self.client.get('/api/users/profile/').status_code, 200)
        data = {'full_name': 'New Name'}
        self.assertEqual(self.client.patch('/api/users/profile/', data, content_type='application/json').status_code, 403)
        ok = self.client.patch('/api/users/profile/', data, content_type='application/json',
                               HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(ok.status_code, 200)

    def test_logout_all_devices_bumps_version(self):
        user = make_user()
        tokens = generate_jwt_token(user)
        self.post('/api/users/logout/', {'refresh': tokens['refresh'], 'all_devices': True})
        user.refresh_from_db()
        self.assertEqual(user.token_version, 1)
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(tokens['access'])).status_code, 401)
        self.assertEqual(self.post('/api/users/refresh/', {'refresh': tokens['refresh']}).status_code, 401)

    def test_logout_with_garbage_is_harmless(self):
        self.assertEqual(self.post('/api/users/logout/', {'refresh': 'nope', 'all_devices': True}).status_code, 200)


class SignupEnumerationTests(ApiCase):
    """Signing up with a registered email looks the same as a new signup; the owner is emailed."""

    def signup(self, email):
        return self.post('/api/users/signup/', {
            'email': email, 'password': NEW_PW, 'full_name': 'Someone', 'accepted_terms': True,
        })

    def test_existing_email_gets_the_new_signup_response_and_one_notice(self):
        make_user('taken@example.com')
        new = self.signup('fresh@example.com')
        mail.outbox.clear()
        existing = self.signup('taken@example.com')
        self.assertEqual(existing.status_code, new.status_code)
        self.assertEqual(set(existing.json()), set(new.json()))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('already have', mail.outbox[0].subject)
        # Repeats within the hour send nothing more
        self.signup('taken@example.com')
        self.assertEqual(len(mail.outbox), 1)


class PasswordPolicyTests(ApiCase):
    def test_signup_rejects_weak_passwords(self):
        for weak in ['password', '12345678', 'owner@example.com', 'short1']:
            response = self.post('/api/users/signup/', { 'accepted_terms': True,
                'email': 'owner@example.com', 'password': weak, 'full_name': 'Owner'})
            self.assertEqual(response.status_code, 400, weak)
            body = response.json()
            self.assertEqual(body['error'], 'invalid_password')
            self.assertTrue(body['errors']['password'])
        self.assertFalse(User.objects.exists())

    @patch('apps.users.views_auth.send_verification_email')
    def test_signup_accepts_strong_password(self, _):
        response = self.post('/api/users/signup/', { 'accepted_terms': True,
            'email': 'owner@example.com', 'password': PW, 'full_name': 'Owner'})
        self.assertEqual(response.status_code, 201)

    def test_change_password_rejects_weak(self):
        user = make_user()
        token = generate_jwt_token(user)['access']
        response = self.post('/api/users/change-password/',
                             {'current_password': PW, 'new_password': '12345678'}, token=token)
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.json()['errors']['new_password'])
        user.refresh_from_db()
        self.assertEqual(user.token_version, 0)


class PasswordResetTests(ApiCase):
    def request_reset(self, email):
        return self.post('/api/users/password-reset/request/', {'email': email})

    def token_from_mail(self):
        body = mail.outbox[-1].body
        return body.split('token=')[1].split()[0]

    def test_happy_path(self):
        user = make_user()
        user.email_verified = False
        user.save()
        old = generate_jwt_token(user)
        self.assertEqual(self.request_reset(user.email).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('/reset-password?token=', mail.outbox[0].body)
        token = self.token_from_mail()
        response = self.post('/api/users/password-reset/confirm/', {'token': token, 'new_password': NEW_PW})
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(check_password(NEW_PW, user.password_hash))
        self.assertTrue(user.email_verified)
        self.assertEqual(user.token_version, 1)
        self.assertEqual(len(mail.outbox), 2)  # reset link + password-changed notice
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(old['access'])).status_code, 401)
        login = self.post('/api/users/login/', {'email': user.email, 'password': NEW_PW})
        self.assertEqual(login.status_code, 200)

    def test_token_is_single_use(self):
        user = make_user()
        token = make_reset_token(user)
        self.assertEqual(
            self.post('/api/users/password-reset/confirm/', {'token': token, 'new_password': NEW_PW}).status_code, 200)
        again = self.post('/api/users/password-reset/confirm/', {'token': token, 'new_password': 'Another-Pass-7731'})
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.json()['error'], 'token_used')

    def test_expired_and_invalid_tokens(self):
        user = make_user()
        expired = make_reset_token(user)
        with patch('django.core.signing.time.time', return_value=__import__('time').time() + 3601):
            response = self.post('/api/users/password-reset/confirm/', {'token': expired, 'new_password': NEW_PW})
        self.assertEqual(response.json()['error'], 'token_expired')
        garbage = self.post('/api/users/password-reset/confirm/', {'token': 'abc', 'new_password': NEW_PW})
        self.assertEqual(garbage.json()['error'], 'invalid_token')
        wrong_salt = signing.dumps({'uid': str(user.id), 'p': 'x'}, salt='other')
        self.assertEqual(
            self.post('/api/users/password-reset/confirm/', {'token': wrong_salt, 'new_password': NEW_PW}).json()['error'],
            'invalid_token')

    def test_weak_password_rejected_and_token_still_usable(self):
        user = make_user()
        token = make_reset_token(user)
        weak = self.post('/api/users/password-reset/confirm/', {'token': token, 'new_password': 'password'})
        self.assertEqual(weak.status_code, 400)
        self.assertTrue(weak.json()['errors']['new_password'])
        self.assertEqual(
            self.post('/api/users/password-reset/confirm/', {'token': token, 'new_password': NEW_PW}).status_code, 200)

    def test_request_does_not_reveal_account_existence(self):
        make_user()
        known = self.request_reset('owner@example.com')
        unknown = self.request_reset('nobody@example.com')
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(len(mail.outbox), 1)


class DeleteAccountTests(ApiCase):
    def test_requires_authentication_and_correct_password(self):
        user = make_user()
        self.assertEqual(self.post('/api/users/delete-account/', {'password': PW}).status_code, 401)
        token = generate_jwt_token(user)['access']
        self.assertEqual(self.post('/api/users/delete-account/', {}, token=token).status_code, 400)
        wrong = self.post('/api/users/delete-account/', {'password': 'wrong'}, token=token)
        self.assertEqual(wrong.status_code, 400)
        self.assertTrue(User.objects.filter(id=user.id).exists())
        self.assertEqual(len(mail.outbox), 0)

    @patch('utils.supabase_client.delete_file_from_supabase')
    def test_deletes_user_data_files_and_sends_email(self, delete_file):
        user = make_user()
        path = f'{user.id}/combined_1.webm'
        recording = AudioRecording.objects.create(
            user=user, storage_path=path, public_url='http://x/y', file_size_bytes=10,
            format='webm', question_number=1, domain='career', question_text='Q?',
        )
        member = FamilyMember.objects.create(ai_owner=user, email='fam@example.com', relationship='child')
        other = make_user('other@example.com')
        link = FamilyMember.objects.create(ai_owner=other, email=user.email, relationship='child', user_account=user)
        Conversation.objects.create(
            ai_owner=user, family_member=member, question_text='q', response_text='r', response_time_ms=1,
            audio_url='http://h/storage/responses/responses/abc/x.mp3',
        )
        token = generate_jwt_token(user)['access']

        response = self.post('/api/users/delete-account/', {'password': PW}, token=token)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(id=user.id).exists())
        self.assertFalse(FamilyMember.objects.filter(id=member.id).exists())
        self.assertFalse(AudioRecording.objects.filter(id=recording.id).exists())
        self.assertFalse(Conversation.objects.exists())
        delete_file.assert_any_call(bucket='recordings', file_path=path)
        delete_file.assert_any_call(bucket='responses', file_path='responses/abc/x.mp3')
        link.refresh_from_db()
        self.assertIsNone(link.user_account_id)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('deleted', mail.outbox[0].subject)
        self.assertEqual(self.client.get('/api/users/profile/', **bearer(token)).status_code, 401)
        self.assertTrue(User.objects.filter(id=other.id).exists())


class SignupAgreementAndInviteTests(ApiCase):
    """Signup needs the 18+/Terms agreement (recorded), and an invitation link verifies the email."""

    def signup(self, email='invitee@example.com', **extra):
        return self.post('/api/users/signup/', {'email': email, 'password': NEW_PW, 'full_name': 'Invitee', **extra})

    def test_signup_without_the_agreement_is_refused(self):
        response = self.signup(accepted_terms=False)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'terms_required')
        self.assertFalse(User.objects.filter(email='invitee@example.com').exists())

    def test_agreement_is_recorded_with_a_date(self):
        from apps.users.models import ConsentRecord
        self.assertEqual(self.signup(accepted_terms=True).status_code, 201)
        user = User.objects.get(email='invitee@example.com')
        records = ConsentRecord.objects.filter(user=user, accepted=True)
        self.assertEqual(set(records.values_list('consent_type', flat=True)), {'terms_of_service', 'privacy_policy'})
        self.assertTrue(all(r.accepted_at for r in records))

    def test_signup_from_an_invitation_verifies_the_invited_email(self):
        from utils.invitation_tokens import generate_invitation_token
        owner = make_user('vault-owner@example.com', ai_ready=True)
        member = FamilyMember.objects.create(ai_owner=owner, email='invitee@example.com', relationship='child')
        token, _ = generate_invitation_token(member)
        mail.outbox.clear()
        response = self.signup(accepted_terms=True, invitation_token=token)
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()['verification_required'])
        self.assertTrue(User.objects.get(email='invitee@example.com').email_verified)
        self.assertEqual(len(mail.outbox), 0)
        # Signing in now works without the verification email
        self.assertEqual(self.post('/api/users/login/', {'email': 'invitee@example.com', 'password': NEW_PW}).status_code, 200)

    def test_an_invitation_for_another_email_does_not_verify(self):
        from utils.invitation_tokens import generate_invitation_token
        owner = make_user('vault-owner@example.com', ai_ready=True)
        member = FamilyMember.objects.create(ai_owner=owner, email='someone-else@example.com', relationship='child')
        token, _ = generate_invitation_token(member)
        response = self.signup(accepted_terms=True, invitation_token=token)
        self.assertTrue(response.json()['verification_required'])
        self.assertFalse(User.objects.get(email='invitee@example.com').email_verified)
