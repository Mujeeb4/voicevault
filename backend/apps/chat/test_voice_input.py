from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from apps.chat.views_voice import transcribe_voice_input
from utils.supabase_auth import SupabaseUser


class VoiceInputContractTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    @patch('openai.OpenAI')
    def test_nameless_browser_blob_uses_supported_extension(self, client_type):
        observed_paths = []

        def transcribe(**kwargs):
            observed_paths.append(kwargs['file'].name)
            self.assertTrue(kwargs['file'].name.endswith('.webm'))
            return SimpleNamespace(text=' Hello from a browser blob ')

        client_type.return_value.audio.transcriptions.create.side_effect = transcribe
        audio = SimpleUploadedFile('blob', b'\x1a\x45\xdf\xa3webm audio', content_type='audio/webm;codecs=opus')
        request = APIRequestFactory().post('/api/chat/transcribe-voice/', {'audio': audio}, format='multipart')
        request.supabase_user = SupabaseUser('recipient-id', 'recipient@example.com', {})
        response = transcribe_voice_input(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['transcript'], 'Hello from a browser blob')
        self.assertFalse(Path(observed_paths[0]).exists())

    @patch('openai.OpenAI')
    def test_unsupported_audio_is_rejected_before_provider_request(self, client_type):
        audio = SimpleUploadedFile('file.webm', b'not audio', content_type='text/plain')
        request = APIRequestFactory().post('/api/chat/transcribe-voice/', {'audio': audio}, format='multipart')
        request.supabase_user = SupabaseUser('recipient-id', 'recipient@example.com', {})
        response = transcribe_voice_input(request)
        self.assertEqual(response.status_code, 400)
        client_type.assert_not_called()

    @patch('openai.OpenAI')
    def test_safari_mp4_audio_is_accepted(self, client_type):
        observed = []

        def transcribe(**kwargs):
            observed.append(kwargs['file'].name)
            return SimpleNamespace(text='hello from safari')

        client_type.return_value.audio.transcriptions.create.side_effect = transcribe
        audio = SimpleUploadedFile('voice-input.m4a', b'\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00', content_type='audio/mp4')
        request = APIRequestFactory().post('/api/chat/transcribe-voice/', {'audio': audio}, format='multipart')
        request.supabase_user = SupabaseUser('recipient-id', 'recipient@example.com', {})
        response = transcribe_voice_input(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(observed[0].endswith('.m4a'))

    @patch('openai.OpenAI')
    def test_disguised_non_audio_is_rejected(self, client_type):
        audio = SimpleUploadedFile('voice-input.m4a', b'<html>not audio at all</html>', content_type='audio/mp4')
        request = APIRequestFactory().post('/api/chat/transcribe-voice/', {'audio': audio}, format='multipart')
        request.supabase_user = SupabaseUser('recipient-id', 'recipient@example.com', {})
        response = transcribe_voice_input(request)
        self.assertEqual(response.status_code, 400)
        client_type.assert_not_called()
