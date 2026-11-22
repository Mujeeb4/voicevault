import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest import skipUnless
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory
from apps.recordings.views import AudioRecordingUploadView

from apps.recordings.models import AudioRecording
from apps.users.models import ConsentRecord, User
from apps.users.views_auth import generate_jwt_token
from services.audio_normalize import AudioConversionError, normalize_audio_file


def make_m4a():
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / 'tone.m4a'
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
             '-c:a', 'aac', str(target)], check=True,
        )
        return target.read_bytes()


@override_settings(MIDDLEWARE=['utils.supabase_auth.SupabaseAuthMiddleware'])
class AudioUploadFormatTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='safari@example.com', full_name='Safari User')
        ConsentRecord.objects.create(user=self.user, consent_type='voice_recording', accepted=True)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + generate_jwt_token(self.user)['access'])

    def upload(self, name, content, content_type):
        audio = SimpleUploadedFile(name, content, content_type=content_type)
        return self.client.post('/api/recordings/upload/', {
            'audio_file': audio, 'question_number': 1, 'question_text': 'Q', 'domain': 'childhood',
            'duration_seconds': '1',
        }, format='multipart')

    @skipUnless(shutil.which('ffmpeg'), 'ffmpeg not installed')
    @patch('apps.recordings.views.upload_file_to_supabase', return_value='http://localhost/x.mp3')
    def test_safari_m4a_is_accepted_and_stored_as_mp3(self, upload):
        response = self.upload('recording.m4a', make_m4a(), 'audio/mp4')
        self.assertEqual(response.status_code, 201, response.data)
        recording = AudioRecording.objects.get(user=self.user)
        self.assertEqual(recording.format, 'mp3')
        self.assertTrue(recording.storage_path.endswith('.mp3'))
        stored = upload.call_args.kwargs['file_object']
        self.assertTrue(stored.name.endswith('.mp3'))

    @patch('apps.recordings.views.upload_file_to_supabase', return_value='http://localhost/x.mp3')
    def test_disguised_non_audio_file_is_rejected(self, upload):
        for name, content_type in (('recording.m4a', 'audio/mp4'), ('recording.webm', 'audio/webm'),
                                   ('recording.ogg', 'audio/ogg'), ('recording.aac', 'audio/aac')):
            response = self.upload(name, b'<script>alert(1)</script>' * 10, content_type)
            self.assertEqual(response.status_code, 400, name)
        upload.assert_not_called()
        self.assertFalse(AudioRecording.objects.exists())

    @patch('apps.recordings.views.upload_file_to_supabase', return_value='http://localhost/x.mp3')
    def test_unsupported_extension_is_still_rejected(self, upload):
        response = self.upload('recording.exe', b'\x00\x00\x00\x20ftypM4A ' + b'\x00' * 20, 'audio/mp4')
        self.assertEqual(response.status_code, 400)
        upload.assert_not_called()

    @patch('apps.recordings.views.upload_file_to_supabase', return_value='http://localhost/x.mp3')
    def test_failed_conversion_returns_generic_error(self, upload):
        with patch('apps.recordings.views.normalize_audio_file', side_effect=AudioConversionError('boom /secret/path')):
            response = self.upload('recording.m4a', b'\x00\x00\x00\x20ftypM4A ' + b'\x00' * 40, 'audio/mp4')
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('secret', str(response.data))
        upload.assert_not_called()

    def test_native_formats_pass_through_unconverted(self):
        audio = SimpleUploadedFile('a.webm', b'\x1a\x45\xdf\xa3' + b'0' * 20, content_type='audio/webm')
        self.assertIs(normalize_audio_file(audio), audio)


def make_mp3(seconds):
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / 'long.mp3'
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'sine=frequency=440:duration={seconds}',
             '-ac', '1', '-ar', '8000', '-b:a', '8k', str(target)], check=True,
        )
        return target.read_bytes()


@override_settings(MIDDLEWARE=['utils.supabase_auth.SupabaseAuthMiddleware'])
class RecordingDurationLimitTests(TestCase):
    """The free plan's recording minutes are measured on the server, not taken from the browser."""

    def setUp(self):
        self.user = User.objects.create(email='free@example.com', full_name='Free User')
        ConsentRecord.objects.create(user=self.user, consent_type='voice_recording', accepted=True)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + generate_jwt_token(self.user)['access'])

    @skipUnless(shutil.which('ffmpeg'), 'ffmpeg not installed')
    @patch('apps.recordings.views.upload_file_to_supabase', return_value='http://localhost/x.mp3')
    def test_understated_duration_cannot_bypass_the_free_minutes_limit(self, upload):
        audio = SimpleUploadedFile('long.mp3', make_mp3(16 * 60), content_type='audio/mpeg')
        response = self.client.post('/api/recordings/upload/', {
            'audio_file': audio, 'question_number': 1, 'question_text': 'Q', 'domain': 'childhood',
            'duration_seconds': '1',
        }, format='multipart')
        self.assertEqual(response.status_code, 402, response.data)
        self.assertEqual(response.data['limit_key'], 'recording_minutes')
        upload.assert_not_called()

    @skipUnless(shutil.which('ffmpeg'), 'ffmpeg not installed')
    @patch('apps.recordings.views.upload_file_to_supabase', return_value='http://localhost/x.mp3')
    def test_stored_duration_is_the_measured_length(self, upload):
        audio = SimpleUploadedFile('short.mp3', make_mp3(3), content_type='audio/mpeg')
        response = self.client.post('/api/recordings/upload/', {
            'audio_file': audio, 'question_number': 1, 'question_text': 'Q', 'domain': 'childhood',
            'duration_seconds': '999',
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertAlmostEqual(AudioRecording.objects.get(user=self.user).duration_seconds, 3, delta=0.5)


class RecordingConsentRequiredTests(TestCase):
    def test_upload_is_refused_without_recording_consent(self):
        user = User.objects.create(email='noconsent@example.com', full_name='No Consent')
        request = APIRequestFactory().post('/api/recordings/upload/', {'audio_file': SimpleUploadedFile('a.mp3', b'x')}, format='multipart')
        request.supabase_user = type('U', (), {'id': user.id, 'email': user.email})()
        response = AudioRecordingUploadView.as_view()(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'recording_consent_required')
