"""Regression coverage for the SDK failure that silently selected Rachel."""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import TestCase, SimpleTestCase, override_settings
from elevenlabs import ElevenLabs

from apps.ai_processing.models import AIConfiguration, ProcessingQueue
from apps.ai_processing.tasks import clone_voice_task
from apps.chat.tasks import generate_audio_sync, generate_audio_async
from apps.recordings.models import AudioRecording
from apps.users.models import User
from services.voice_cloning import create_voice_clone, LEGACY_FALLBACK_VOICE_ID


class VoiceSDKTests(SimpleTestCase):
    def test_installed_sdk_supports_used_endpoint(self):
        client = ElevenLabs(api_key='test')
        self.assertTrue(callable(client.voices.ivc.create))

    def test_real_sdk_serializes_multipart_labels_as_dictionary(self):
        import httpx
        from email.parser import BytesParser
        from email.policy import default
        import json

        def handle(request):
            message = BytesParser(policy=default).parsebytes(
                f"Content-Type: {request.headers['content-type']}\r\n\r\n".encode() + request.read()
            )
            fields = {
                part.get_param('name', header='content-disposition'): part.get_payload(decode=True)
                for part in message.iter_parts()
            }
            self.assertEqual(json.loads(fields['labels']), {})
            self.assertEqual(fields['files'], b'recorded audio')
            self.assertEqual(request.url.path, '/v1/voices/add')
            return httpx.Response(200, json={'voice_id': 'actual-clone', 'requires_verification': False})

        with httpx.Client(transport=httpx.MockTransport(handle)) as http_client:
            client = ElevenLabs(api_key='test', httpx_client=http_client)
            self.assertEqual(create_voice_clone(client, name='Test', description='Test', files=[('sample.mp3', b'recorded audio')]), 'actual-clone')

    def test_create_uses_ivc_and_returns_provider_id(self):
        client = Mock()
        client.voices.ivc.create.return_value = SimpleNamespace(voice_id='real-clone', requires_verification=False)
        self.assertEqual(create_voice_clone(client, name='Clone', description='Test', files=[b'audio']), 'real-clone')
        client.voices.ivc.create.assert_called_once_with(name='Clone', description='Test', files=[b'audio'], labels={})
        client.voices.add.assert_not_called()

    def test_verification_and_preset_are_not_successful_clones(self):
        for voice_id, verification in [('clone', True), (LEGACY_FALLBACK_VOICE_ID, False), ('', False)]:
            with self.subTest(voice_id=voice_id, verification=verification):
                client = Mock()
                client.voices.ivc.create.return_value = SimpleNamespace(voice_id=voice_id, requires_verification=verification)
                with self.assertRaises(ValueError):
                    create_voice_clone(client, name='Clone', description='Test', files=[b'audio'])


@override_settings(ELEVENLABS_API_KEY='test')
class VoiceCloningTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='clone-test@example.com', full_name='Clone Test')
        self.config = AIConfiguration.objects.create(user=self.user, system_prompt='Test')
        AudioRecording.objects.create(
            user=self.user, storage_path='test.mp3', public_url='http://localhost/test.mp3',
            file_size_bytes=100, format='mp3', question_number=1,
            question_text='Test', domain='childhood', duration_seconds=90, upload_status='complete',
        )
        self.paths = []

    def download(self, **kwargs):
        path = Path(kwargs['temp_file_path'])
        self.paths.append(path)
        path.write_bytes(b'test audio')
        return True

    def run_clone(self, client):
        with patch('apps.ai_processing.tasks.can_clone_voice', return_value=SimpleNamespace(allowed=True)), \
             patch('apps.ai_processing.tasks.download_file_stream_to_temp', side_effect=self.download), \
             patch('elevenlabs.ElevenLabs', return_value=client):
            return clone_voice_task.apply(args=[str(self.user.id)], retries=3, throw=True).result

    def test_failure_does_not_persist_preset_or_report_success(self):
        client = Mock()
        client.voices.ivc.create.side_effect = RuntimeError('provider unavailable')
        result = self.run_clone(client)
        self.assertFalse(result['success'])
        self.config.refresh_from_db()
        self.assertIsNone(self.config.voice_clone_id)
        self.assertEqual(ProcessingQueue.objects.get().status, 'failed')
        self.assertTrue(all(not p.exists() for p in self.paths))

    def test_success_persists_actual_clone_without_fabricating_quality(self):
        client = Mock()
        client.voices.ivc.create.return_value = SimpleNamespace(voice_id='real-clone', requires_verification=False)
        result = self.run_clone(client)
        self.assertTrue(result['success'])
        self.config.refresh_from_db()
        self.assertEqual(self.config.voice_clone_id, 'real-clone')
        self.assertIsNone(self.config.voice_quality_score)
        self.assertFalse(self.config.quality_approved)
        self.assertEqual(ProcessingQueue.objects.get().status, 'complete')
        self.assertTrue(all(not p.exists() for p in self.paths))

    def test_missing_sample_fails_before_api_call(self):
        with patch('apps.ai_processing.tasks.can_clone_voice', return_value=SimpleNamespace(allowed=True)), \
             patch('apps.ai_processing.tasks.download_file_stream_to_temp', return_value=False), \
             patch('elevenlabs.ElevenLabs') as client:
            result = clone_voice_task.apply(args=[str(self.user.id)], throw=True).result
        self.assertFalse(result['success'])
        client.assert_not_called()

    def test_old_ready_flag_cannot_hide_a_preset_substitution(self):
        from django.test import RequestFactory
        from apps.ai_processing.views import ProcessingStatusView
        self.user.ai_ready = True
        self.user.save()
        self.config.voice_clone_id = LEGACY_FALLBACK_VOICE_ID
        self.config.save()
        ProcessingQueue.objects.create(user=self.user, task_type='clone_voice', status='complete')
        request = RequestFactory().get('/status/')
        with patch('apps.ai_processing.views.authorize_processing_access', return_value=None):
            response = ProcessingStatusView.as_view()(request, user_id=self.user.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['overall_status'], 'failed')
        self.assertEqual(response.data['steps']['voice_cloning']['status'], 'failed')

    def test_existing_preset_is_blocked_in_sync_and_async_speech(self):
        self.config.voice_clone_id = LEGACY_FALLBACK_VOICE_ID
        self.config.save()
        self.assertFalse(self.config.has_cloned_voice)
        args = ('Hello', LEGACY_FALLBACK_VOICE_ID, 'unused-conversation', str(self.user.id))
        with patch('elevenlabs.ElevenLabs') as client:
            self.assertFalse(generate_audio_sync(*args)['success'])
            self.assertFalse(generate_audio_async.apply(args=args, throw=True).result['success'])
        client.assert_not_called()


class VoiceCacheTests(SimpleTestCase):
    def test_recloning_cannot_reuse_old_voice_audio(self):
        from apps.chat.utils import get_cache_key
        self.assertNotEqual(get_cache_key('Hello', 'owner', 'old-clone'), get_cache_key('Hello', 'owner', 'new-clone'))
        self.assertTrue(get_cache_key('Hello', 'owner', 'new-clone').startswith('chat:v2:'))


class LegacyVoiceCleanupTests(TestCase):
    def test_migration_clears_only_preset_and_marks_old_success_failed(self):
        from importlib import import_module
        from django.apps import apps
        from django.db import connection
        preset_user = User.objects.create(email='preset@example.com', full_name='Preset', ai_ready=True)
        real_user = User.objects.create(email='real@example.com', full_name='Real')
        preset = AIConfiguration.objects.create(user=preset_user, system_prompt='Test', voice_clone_id=LEGACY_FALLBACK_VOICE_ID, voice_quality_score=0.7)
        real = AIConfiguration.objects.create(user=real_user, system_prompt='Test', voice_clone_id='real-clone')
        task = ProcessingQueue.objects.create(user=preset_user, task_type='clone_voice', status='complete')
        migration = import_module('apps.ai_processing.migrations.0002_remove_preset_voice_fallback')
        migration.remove_preset_substitutions(apps, SimpleNamespace(connection=connection))
        preset.refresh_from_db(); real.refresh_from_db(); task.refresh_from_db()
        self.assertIsNone(preset.voice_clone_id)
        self.assertIsNone(preset.voice_quality_score)
        preset_user.refresh_from_db()
        self.assertFalse(preset_user.ai_ready)
        self.assertEqual(task.status, 'failed')
        self.assertEqual(real.voice_clone_id, 'real-clone')
