"""Regression tests for the combined-upload ordering fix (a failed upload must not delete old recordings)."""
import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.recordings.models import AudioRecording
from apps.users.models import ConsentRecord, User
from apps.users.views_auth import generate_jwt_token
from services.plan_limits import LimitResult


@override_settings(MIDDLEWARE=['utils.supabase_auth.SupabaseAuthMiddleware'])
class CombinedUploadReplacementTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='uploader@example.com', full_name='Uploader')
        ConsentRecord.objects.create(user=self.user, consent_type='voice_recording', accepted=True)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + generate_jwt_token(self.user)['access'])
        # A previous upload: one single combined file and a stale second part
        for number, path in ((0, 'old_single.mp3'), (-2, 'old_part2.mp3')):
            AudioRecording.objects.create(
                user=self.user, storage_path=f'{self.user.id}/{path}', public_url='http://x/' + path,
                file_size_bytes=1000, format='mp3', question_number=number, question_text='old',
                domain='combined', duration_seconds=60, upload_status='complete',
            )

    def post_part_one(self):
        audio = SimpleUploadedFile('part.webm', b'\x1a\x45\xdf\xa3' + b'0' * 40, content_type='audio/webm')
        return self.client.post('/api/recordings/upload/', {
            'audio_file': audio,
            'recording_metadata': json.dumps({'chunk_index': 1, 'total_chunks': 2, 'is_final_chunk': False}),
        }, format='multipart')

    def patches(self, **extra):
        return (
            patch('apps.recordings.views.normalize_audio_file', side_effect=lambda f: f),
            patch('apps.recordings.views.uploaded_audio_duration_seconds', return_value=30.0),
            patch('apps.recordings.views.upload_file_to_supabase', return_value='http://x/new.webm', **extra),
            patch('apps.recordings.views.delete_file_from_supabase'),
        )

    def test_limit_failure_keeps_earlier_recordings(self):
        normalize, duration, upload, delete = self.patches()
        with normalize, duration, upload, delete as deleted, patch(
            'apps.recordings.views.can_upload_recording',
            return_value=LimitResult(False, 'Recording minutes limit reached', True, 'recording_minutes'),
        ):
            response = self.post_part_one()
        self.assertEqual(response.status_code, 402)
        self.assertEqual(AudioRecording.objects.filter(user=self.user).count(), 2)
        deleted.assert_not_called()

    def test_storage_failure_keeps_earlier_recordings(self):
        normalize, duration, _upload, delete = self.patches()
        with normalize, duration, delete as deleted, patch(
            'apps.recordings.views.upload_file_to_supabase', side_effect=RuntimeError('storage down'),
        ):
            response = self.post_part_one()
        self.assertGreaterEqual(response.status_code, 400)
        self.assertEqual(AudioRecording.objects.filter(user=self.user).count(), 2)
        deleted.assert_not_called()

    def test_success_replaces_the_whole_earlier_set(self):
        normalize, duration, upload, delete = self.patches()
        with normalize, duration, upload, delete as deleted:
            response = self.post_part_one()
        self.assertEqual(response.status_code, 201, getattr(response, 'data', None))
        numbers = sorted(AudioRecording.objects.filter(user=self.user).values_list('question_number', flat=True))
        self.assertEqual(numbers, [-1])
        self.assertEqual(deleted.call_count, 2)
