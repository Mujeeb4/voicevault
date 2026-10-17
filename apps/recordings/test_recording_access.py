from unittest.mock import patch
from pathlib import Path
import tempfile

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.recordings.models import AudioRecording
from apps.users.models import User
from apps.users.views_auth import generate_jwt_token


@override_settings(MIDDLEWARE=['utils.supabase_auth.SupabaseAuthMiddleware'])
class RecordingAccessTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create(email='owner@example.com', full_name='Owner')
        self.other = User.objects.create(email='other@example.com', full_name='Other')
        self.recording = self.create_recording(self.owner)
        self.other_recording = self.create_recording(self.other)
        self.client = APIClient()

    def create_recording(self, user):
        return AudioRecording.objects.create(
            user=user, storage_path=f'{user.id}/sample.mp3',
            public_url='http://localhost/media/sample.mp3', file_size_bytes=1000,
            format='mp3', question_number=1, question_text='Test', domain='childhood',
            duration_seconds=5, upload_status='complete',
        )

    def authenticate(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + generate_jwt_token(self.owner)['access'])

    def test_anonymous_requests_are_rejected(self):
        self.assertEqual(self.client.get('/api/recordings/').status_code, 401)
        self.assertEqual(self.client.delete(f'/api/recordings/{self.recording.id}/').status_code, 401)

    def test_app_jwt_lists_only_owners_recordings(self):
        self.authenticate()
        response = self.client.get('/api/recordings/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data['recordings']], [str(self.recording.id)])

    @override_settings(DEBUG=False, STORAGE_BACKEND='local')
    def test_production_playback_preserves_bytes_and_requires_signed_owner_link(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            path = Path(media_root) / 'storage' / 'recordings' / self.recording.storage_path
            path.parent.mkdir(parents=True)
            original = b'ID3' + b'original recording bytes' * 100
            path.write_bytes(original)
            self.authenticate()
            listing = self.client.get('/api/recordings/')
            url = listing.data['recordings'][0]['public_url']
            self.assertTrue(url.startswith(f'/api/recordings/{self.recording.id}/audio/'))
            self.client.credentials()
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response['Content-Type'], 'audio/mpeg')
            self.assertEqual(b''.join(response.streaming_content), original)
            response.close()
            self.assertEqual(self.client.get(f'/api/recordings/{self.recording.id}/audio/').status_code, 401)
            other_url = url.replace(str(self.recording.id), str(self.other_recording.id), 1)
            self.assertEqual(self.client.get(other_url).status_code, 403)

    @patch('apps.recordings.views.delete_file_from_supabase', return_value=True)
    def test_app_jwt_cannot_delete_another_owners_recording(self, delete_file):
        self.authenticate()
        response = self.client.delete(f'/api/recordings/{self.other_recording.id}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(AudioRecording.objects.filter(id=self.other_recording.id).exists())
        delete_file.assert_not_called()

    @patch('apps.recordings.views.delete_file_from_supabase', return_value=True)
    def test_app_jwt_can_delete_own_recording(self, delete_file):
        self.authenticate()
        response = self.client.delete(f'/api/recordings/{self.recording.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(AudioRecording.objects.filter(id=self.recording.id).exists())
        delete_file.assert_called_once()
