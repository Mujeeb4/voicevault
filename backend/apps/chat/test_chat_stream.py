"""Regression coverage for the full SSE completion path."""
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.test import RequestFactory, TestCase, override_settings

from apps.ai_processing.models import AIConfiguration, APIUsageTracking
from apps.chat.models import Conversation
from apps.chat.views import chat_streaming, _conversation_audio_playback_url, stream_conversation_audio
from apps.recordings.models import Transcript
from apps.users.models import FamilyMember, User, UsageQuota
from services.plan_limits import LimitResult


class ChatStreamTests(TestCase):
    @override_settings(STORAGE_BACKEND='supabase')
    def test_supabase_audio_uses_uploaded_object_url_without_local_file_route(self):
        owner = User.objects.create(email='remote-audio@example.com', full_name='Owner')
        member = FamilyMember.objects.create(
            ai_owner=owner, email=owner.email, relationship='self', has_access=True,
        )
        audio_url = 'https://project.supabase.co/storage/v1/object/public/responses/owner/response.mp3'
        conversation = Conversation.objects.create(
            ai_owner=owner, question_text='Hello?', response_text='Hello.',
            audio_url=audio_url, family_member=member, response_time_ms=10,
        )
        self.assertEqual(_conversation_audio_playback_url(conversation, owner), audio_url)

    @override_settings(CHAT_PROVIDER='qwen', QWEN_API_KEY='test-key', VOICE_PROVIDER='replicate')
    @patch('apps.chat.views.generate_audio_async.apply_async', return_value=SimpleNamespace(id='queued-test-task'))
    @patch('apps.chat.views.is_celery_available', return_value=True)
    @patch('apps.chat.views.can_generate_voice_response', return_value=LimitResult(True))
    @patch('apps.chat.views.get_cached_response', return_value=None)
    @patch('openai.OpenAI')
    def test_qwen_dictionary_usage_queues_voice_and_completes_stream(
        self, openai_client, _cache, _voice, _celery_available, audio_queue,
    ):
        owner = User.objects.create(
            email='stream-test@example.com', full_name='Stream Tester',
            ai_ready=True, is_premium=True,
        )
        AIConfiguration.objects.create(
            user=owner, system_prompt='Answer naturally', voice_provider='replicate',
            voice_clone_id='replicate:qwen3-tts', voice_reference_path='recordings/test.wav',
            voice_reference_text='I grew up near the sea.',
        )
        Transcript.objects.create(user=owner, full_transcript='I grew up near the sea.')

        openai_client.return_value.chat.completions.create.return_value = [
            SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='Hello.'))], usage=None),
            SimpleNamespace(choices=[], usage={'total_tokens': 42}),
        ]
        request = RequestFactory().post(
            '/api/chat/stream/',
            data=json.dumps({'ai_owner_id': str(owner.id), 'question': 'How are you?'}),
            content_type='application/json',
        )
        request.supabase_user = SimpleNamespace(id=owner.id)

        response = chat_streaming(request)
        self.assertEqual(response.status_code, 200)
        events = [json.loads(line.removeprefix('data: ')) for chunk in response.streaming_content
                  for line in chunk.decode().splitlines() if line.startswith('data: ')]

        self.assertEqual([event['type'] for event in events],
                         ['text_chunk', 'text_complete', 'audio_processing', 'complete'])
        self.assertEqual(events[1]['tokens'], 42)
        audio_queue.assert_called_once()
        self.assertEqual(events[2]['task_id'], 'queued-test-task')
        self.assertEqual(Conversation.objects.get().response_text, 'Hello.')
        self.assertEqual(APIUsageTracking.objects.get().tokens_used, 42)
        self.assertEqual(UsageQuota.objects.get(user=owner).text_messages_used_this_month, 1)

        # Replicate returns WAV; its protected playback endpoint must serve WAV correctly.
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            audio_path = Path(media_root) / 'storage' / 'responses' / 'test.wav'
            audio_path.parent.mkdir(parents=True)
            audio_path.write_bytes(b'RIFF' + b'\x00' * 32)
            conversation = Conversation.objects.get()
            conversation.audio_url = '/media/storage/responses/test.wav'
            conversation.save(update_fields=['audio_url'])
            playback_url = _conversation_audio_playback_url(conversation, owner)
            playback = stream_conversation_audio(RequestFactory().get(playback_url), conversation.id)
            self.assertEqual(playback.status_code, 200)
            self.assertEqual(playback['Content-Type'], 'audio/wav')
            self.assertIn('.wav', playback['Content-Disposition'])
            playback.close()
