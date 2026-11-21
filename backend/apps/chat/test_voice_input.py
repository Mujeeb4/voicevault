from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.chat.views_voice import transcribe_voice_input
from apps.users.models import FamilyMember, User
from utils.supabase_auth import SupabaseUser

WEBM = b'\x1a\x45\xdf\xa3webm audio'
M4A = b'\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00'


# The audio bytes in these tests are stubs, so their length is patched in
@patch('apps.chat.views_voice.audio_duration_seconds', return_value=5.0)
class VoiceInputContractTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create(email='owner@example.com', full_name='Owner', ai_ready=True)
        self.recipient = User.objects.create(email='recipient@example.com', full_name='Recipient')
        FamilyMember.objects.create(
            ai_owner=self.owner, email=self.recipient.email, relationship='child',
            has_access=True, user_account=self.recipient,
        )

    def tearDown(self):
        cache.clear()

    def post(self, audio, user=None, ai_owner_id=None):
        user = user or self.recipient
        data = {'audio': audio, 'ai_owner_id': str(ai_owner_id or self.owner.id)}
        request = APIRequestFactory().post('/api/chat/transcribe-voice/', data, format='multipart')
        request.supabase_user = SupabaseUser(str(user.id), user.email, {})
        return transcribe_voice_input(request)

    @patch('openai.OpenAI')
    def test_nameless_browser_blob_uses_supported_extension(self, client_type, _duration):
        observed_paths = []

        def transcribe(**kwargs):
            observed_paths.append(kwargs['file'].name)
            self.assertTrue(kwargs['file'].name.endswith('.webm'))
            return SimpleNamespace(text=' Hello from a browser blob ')

        client_type.return_value.audio.transcriptions.create.side_effect = transcribe
        response = self.post(SimpleUploadedFile('blob', WEBM, content_type='audio/webm;codecs=opus'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['transcript'], 'Hello from a browser blob')
        self.assertFalse(Path(observed_paths[0]).exists())

    @patch('openai.OpenAI')
    def test_unsupported_audio_is_rejected_before_provider_request(self, client_type, _duration):
        response = self.post(SimpleUploadedFile('file.webm', b'not audio', content_type='text/plain'))
        self.assertEqual(response.status_code, 400)
        client_type.assert_not_called()

    @patch('openai.OpenAI')
    def test_safari_mp4_audio_is_accepted(self, client_type, _duration):
        observed = []

        def transcribe(**kwargs):
            observed.append(kwargs['file'].name)
            return SimpleNamespace(text='hello from safari')

        client_type.return_value.audio.transcriptions.create.side_effect = transcribe
        response = self.post(SimpleUploadedFile('voice-input.m4a', M4A, content_type='audio/mp4'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(observed[0].endswith('.m4a'))

    @patch('openai.OpenAI')
    def test_disguised_non_audio_is_rejected(self, client_type, _duration):
        response = self.post(SimpleUploadedFile('voice-input.m4a', b'<html>not audio at all</html>', content_type='audio/mp4'))
        self.assertEqual(response.status_code, 400)
        client_type.assert_not_called()

    @patch('openai.OpenAI')
    def test_people_outside_the_vault_cannot_transcribe(self, client_type, _duration):
        stranger = User.objects.create(email='stranger@example.com', full_name='Stranger')
        response = self.post(SimpleUploadedFile('blob', WEBM, content_type='audio/webm'), user=stranger)
        self.assertEqual(response.status_code, 403)
        client_type.assert_not_called()

    @patch('openai.OpenAI')
    def test_unreadable_audio_is_not_sent_to_the_provider(self, client_type, duration):
        duration.return_value = None
        response = self.post(SimpleUploadedFile('blob', WEBM, content_type='audio/webm'))
        self.assertEqual(response.status_code, 400)
        client_type.assert_not_called()

    @override_settings(VOICE_QUESTION_MAX_SECONDS=120)
    @patch('apps.chat.views_voice.trim_audio_file', side_effect=lambda path, seconds: path)
    @patch('openai.OpenAI')
    def test_long_audio_that_cannot_be_trimmed_is_refused(self, client_type, _trim, duration):
        duration.return_value = 3600.0
        response = self.post(SimpleUploadedFile('blob', WEBM, content_type='audio/webm'))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'audio_too_long')
        client_type.assert_not_called()

    @override_settings(VOICE_TRANSCRIPTIONS_PER_DAY=1)
    @patch('openai.OpenAI')
    def test_daily_cap_stops_further_transcriptions(self, client_type, _duration):
        client_type.return_value.audio.transcriptions.create.return_value = SimpleNamespace(text='hi')
        self.assertEqual(self.post(SimpleUploadedFile('blob', WEBM, content_type='audio/webm')).status_code, 200)
        response = self.post(SimpleUploadedFile('blob', WEBM, content_type='audio/webm'))
        self.assertEqual(response.status_code, 429)
        self.assertEqual(client_type.return_value.audio.transcriptions.create.call_count, 1)
