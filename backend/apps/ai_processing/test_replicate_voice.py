"""Offline regressions for reference phrasing, speech input and paid-call deduplication."""
import io
import json
import math
import shutil
import tempfile
import wave
from array import array
from email.parser import BytesParser
from email.policy import default
from pathlib import Path
from types import SimpleNamespace
from unittest import skipUnless
from unittest.mock import Mock, patch

import httpx
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from openai import OpenAI

from apps.ai_processing.models import AIConfiguration, ProcessingQueue
from apps.ai_processing.views import VoicePreviewView
from apps.chat.models import Conversation
from apps.users.models import FamilyMember, User
from services.plan_limits import LimitResult
from services.replicate_voice import generate_audio, prepare_reference, run_preview
from services.speech import (
    prepare_speech_text, synthesis_profile, synthesis_profile_id, voice_cache_identity,
)
from services.voice_reference import build_reference, punctuate_timed_words, select_reference_window


def timestamped_words():
    return [
        {'word': 'I', 'start': 0.5, 'end': 1.2},
        {'word': 'remember', 'start': 1.3, 'end': 2.1},
        {'word': 'home.', 'start': 2.2, 'end': 3.5},
        {'word': 'We', 'start': 4.0, 'end': 5.0},
        {'word': 'ate', 'start': 5.3, 'end': 6.5},
        {'word': 'together.', 'start': 6.8, 'end': 10.0},
        {'word': 'And', 'start': 10.8, 'end': 11.5},
    ]


class SpeechTextTests(SimpleTestCase):
    def test_markdown_paragraphs_become_punctuated_speech(self):
        text = '## My memory\n\nI **remember** [home](https://example.com)\n- We ate together\n- Did you know?'
        self.assertEqual(prepare_speech_text(text),
                         'My memory. I remember home. We ate together. Did you know?')

    def test_keeps_wording_numbers_questions_and_natural_punctuation(self):
        for text in ['I paid 2.50. Really?', 'Wait... I remember now!',
                     'She said, “Come home.”', 'کیا حال ہے؟', '你好。', "It's my first memory."]:
            with self.subTest(text=text):
                self.assertEqual(prepare_speech_text(text), text)

    def test_normalization_is_idempotent_for_preview_and_worker(self):
        text = prepare_speech_text('1. I remember\n2. She said, “Come home”')
        self.assertEqual(text, 'I remember. She said, “Come home.”')
        self.assertEqual(prepare_speech_text(text), text)

    def test_empty_markup_is_empty_speech(self):
        self.assertEqual(prepare_speech_text('  \n  '), '')
        self.assertEqual(prepare_speech_text('## \n...'), '')

    def test_existing_pause_punctuation_does_not_get_extra_period(self):
        self.assertEqual(prepare_speech_text('My son,\n\nI remember you.'), 'My son, I remember you.')

    def test_soft_line_wrapping_does_not_insert_mid_sentence_pause(self):
        self.assertEqual(prepare_speech_text('I remember the front steps\nof our old home.'),
                         'I remember the front steps of our old home.')


class ReferenceSelectionTests(SimpleTestCase):
    def test_sentence_punctuation_is_recovered_from_full_transcript(self):
        words = [dict(word, word=word['word'].rstrip('.')) for word in timestamped_words()]
        punctuated = punctuate_timed_words(words, 'I remember home. We ate together. And')
        self.assertEqual(punctuated[2]['word'], 'home.')
        self.assertEqual(punctuated[5]['word'], 'together.')
        self.assertEqual(select_reference_window(punctuated, 20), (0.38, 10.18))

    def test_missing_word_is_not_assigned_a_guessed_timestamp(self):
        with self.assertRaisesMessage(ValueError, 'matched to its timestamps'):
            punctuate_timed_words(timestamped_words(), 'I remember my home. We ate together. And')

    def test_character_alignment_handles_casefold_and_decimal_punctuation(self):
        words = [{'word': 'Straße', 'start': 0, 'end': 1},
                 {'word': '2.', 'start': 1.1, 'end': 1.5},
                 {'word': '50', 'start': 1.6, 'end': 2}]
        result = punctuate_timed_words(words, 'Straße 2.50.')
        self.assertEqual([item['word'] for item in result], ['Straße', '2', '50.'])

    def test_keeps_complete_sentences_and_ignores_trailing_fragment(self):
        start, end = select_reference_window(timestamped_words(), 20)
        self.assertAlmostEqual(start, 0.38)
        self.assertAlmostEqual(end, 10.18)

    def test_can_select_after_first_twenty_seconds(self):
        words = [
            {'word': 'A', 'start': 0, 'end': 1},
            {'word': 'long', 'start': 1.2, 'end': 2},
            {'word': 'sentence.', 'start': 2.1, 'end': 23},
        ] + [dict(word, start=word['start'] + 24, end=word['end'] + 24)
             for word in timestamped_words()]
        start, end = select_reference_window(words, 50)
        self.assertGreater(start, 23)
        self.assertLessEqual(end - start, 20)

    def test_no_sentence_does_not_fall_back_to_hard_cut(self):
        words = [dict(word, word=word['word'].rstrip('.')) for word in timestamped_words()]
        with self.assertRaisesMessage(ValueError, 'complete sentence'):
            select_reference_window(words, 20)

    def test_long_sentence_is_not_cut_in_middle(self):
        words = [
            {'word': 'I', 'start': 0, 'end': 1},
            {'word': 'remember', 'start': 1.2, 'end': 2},
            {'word': 'home.', 'start': 2.1, 'end': 25},
        ]
        with self.assertRaisesMessage(ValueError, 'complete sentence'):
            select_reference_window(words, 30)

    def test_abbreviation_is_not_a_sentence_boundary(self):
        words = [
            {'word': 'I', 'start': 0.5, 'end': 1},
            {'word': 'met', 'start': 1.1, 'end': 1.5},
            {'word': 'Dr.', 'start': 1.6, 'end': 4.0},
            {'word': 'Smith', 'start': 4.1, 'end': 4.5},
        ]
        with self.assertRaisesMessage(ValueError, 'complete sentence'):
            select_reference_window(words, 10)

    def test_drops_sentence_ending_at_analysis_cut(self):
        words = [dict(word, start=word['start'] + 50, end=word['end'] + 50)
                 for word in timestamped_words()[:6]]
        start, end = select_reference_window(words, 60)
        self.assertLess(end, 55)

    def test_invalid_timestamps_fail_cleanly(self):
        for start, end in [(-1, 2), (math.nan, 2), (1, math.inf), (2, 1), (1, 21)]:
            with self.subTest(start=start, end=end), self.assertRaises(ValueError):
                select_reference_window([{'word': 'Hello.', 'start': start, 'end': end}], 20)

    @skipUnless(shutil.which('ffmpeg'), 'FFmpeg is required for reference preparation')
    def test_real_ffmpeg_and_sdk_crop_preserves_pause_and_transcribes_exact_bytes(self):
        requests = []

        def handle(request):
            message = BytesParser(policy=default).parsebytes(
                f"Content-Type: {request.headers['content-type']}\r\n\r\n".encode() + request.read()
            )
            fields = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True)
                      for part in message.iter_parts()}
            requests.append(fields)
            result = {'text': 'I remember home. We ate together.'}
            if len(requests) == 1:
                words = [dict(word, word=word['word'].rstrip('.')) for word in timestamped_words()]
                result.update(text='I remember home. We ate together. And', words=words,
                              duration=60, language='english', task='transcribe')
            return httpx.Response(200, json=result)

        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.wav'
            with wave.open(str(source), 'wb') as audio:
                audio.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
                # Fixed-amplitude signal with an internal 500ms gap, no private fixtures.
                audio.writeframes(array('h', [1000] * 84000 + [0] * 12000 + [1000] * 1584000).tobytes())
            with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
                client = OpenAI(api_key='test', http_client=transport)
                content, transcript = build_reference(source, directory, client.audio.transcriptions)
        self.assertEqual(len(requests), 2)
        self.assertEqual(requests[0]['response_format'], b'verbose_json')
        self.assertEqual(requests[0]['timestamp_granularities[]'], b'word')
        with wave.open(io.BytesIO(requests[0]['file']), 'rb') as audio:
            self.assertEqual(audio.getnframes() / audio.getframerate(), 60)
        self.assertEqual(requests[1]['file'], content)
        self.assertEqual(transcript, 'I remember home. We ate together.')
        with wave.open(io.BytesIO(content), 'rb') as audio:
            self.assertEqual((audio.getnchannels(), audio.getframerate(), audio.getsampwidth()), (1, 24000, 2))
            self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 9.8, places=2)
            audio.setpos(int(3.3 * 24000))
            self.assertEqual(audio.readframes(2400), b'\0' * 4800)


@override_settings(VOICE_PROVIDER='replicate', REPLICATE_LANGUAGE='English')
class ReplicateSpeechTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create(email='qwen-voice@example.com', full_name='Owner', is_premium=True)
        self.config = AIConfiguration.objects.create(
            user=self.owner, system_prompt='Test', voice_provider='replicate',
            voice_clone_id='replicate:test', voice_reference_path='reference.wav',
            voice_reference_text='I remember home.',
        )
        self.member = FamilyMember.objects.create(
            ai_owner=self.owner, email=self.owner.email, relationship='self', has_access=True,
        )
        self.conversation = Conversation.objects.create(
            ai_owner=self.owner, family_member=self.member, question_text='Remember?',
            response_text='I **remember** home\n\nWe ate together', response_time_ms=1,
        )
        self.limit_patch = patch('services.plan_limits.can_generate_voice_response', return_value=LimitResult(True))
        self.limit_patch.start()
        self.addCleanup(self.limit_patch.stop)

    def generate(self):
        return generate_audio(self.conversation.response_text, self.config.voice_clone_id,
                              self.conversation.id, self.owner.id)

    def preview_queue(self, **overrides):
        data = {'text': self.conversation.response_text, 'voice_id': self.config.voice_clone_id,
                'synthesis_profile': synthesis_profile()}
        data.update(overrides)
        return ProcessingQueue.objects.create(user=self.owner, task_type='voice_preview', task_data=data)

    @patch('services.replicate_voice.refresh_prediction', return_value={'success': True, 'audio_url': '/test.wav'})
    @patch('services.replicate_voice._create_prediction', return_value={'id': 'prediction-1'})
    @patch('services.replicate_voice.download_file_from_supabase', return_value=b'reference audio')
    def test_chat_normalizes_speech_and_does_not_submit_twice(self, _download, create, _refresh):
        self.assertTrue(self.generate()['success'])
        self.assertTrue(self.generate()['success'])
        create.assert_called_once()
        payload = create.call_args.args[0]
        self.assertEqual(payload['input']['text'], 'I remember home. We ate together.')
        self.assertEqual(payload['input']['reference_text'], self.config.voice_reference_text)
        self.assertEqual(payload['input']['language'], 'English')
        self.assertEqual(payload['version'], synthesis_profile()['version'])
        self.assertNotIn('style_instruction', payload['input'])
        self.assertNotIn('speaker', payload['input'])
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.response_text, 'I **remember** home\n\nWe ate together')

    @patch('services.replicate_voice._create_prediction', side_effect=httpx.ReadTimeout('interrupted'))
    @patch('services.replicate_voice.download_file_from_supabase', return_value=b'reference audio')
    def test_unknown_submission_result_is_not_retried(self, _download, create):
        self.assertFalse(self.generate()['success'])
        self.assertFalse(self.generate()['success'])
        create.assert_called_once()

    @patch('services.replicate_voice._create_prediction')
    def test_changed_reference_blocks_queued_chat(self, create):
        self.config.voice_clone_id = 'replicate:new-reference'
        self.config.save()
        result = generate_audio('Hello.', 'replicate:test', self.conversation.id, self.owner.id)
        self.assertFalse(result['success'])
        create.assert_not_called()

    @patch('services.replicate_voice.refresh_preview', return_value={'status': 'complete'})
    @patch('services.replicate_voice._create_prediction', return_value={'id': 'preview-1'})
    @patch('services.replicate_voice.download_file_from_supabase', return_value=b'reference audio')
    def test_preview_uses_same_speech_input_and_deduplicates_worker_delivery(self, _download, create, _refresh):
        queue = self.preview_queue()
        run_preview(queue.id)
        run_preview(queue.id)
        create.assert_called_once()
        self.assertEqual(create.call_args.args[0]['input']['text'], 'I remember home. We ate together.')

    @patch('services.replicate_voice._create_prediction')
    @patch('services.replicate_voice.download_file_from_supabase')
    def test_stale_preview_profile_is_rejected_before_submission(self, download, create):
        queue = self.preview_queue()
        with override_settings(REPLICATE_LANGUAGE='auto'):
            self.assertEqual(run_preview(queue.id)['status'], 'failed')
        download.assert_not_called()
        create.assert_not_called()

    @patch('services.replicate_voice._create_prediction')
    def test_old_preview_without_profile_requires_new_preview(self, create):
        queue = self.preview_queue()
        queue.task_data.pop('synthesis_profile')
        queue.save()
        self.assertEqual(run_preview(queue.id)['status'], 'failed')
        create.assert_not_called()

    @patch('services.replicate_voice._create_prediction', side_effect=httpx.ReadTimeout('interrupted'))
    @patch('services.replicate_voice.download_file_from_supabase', return_value=b'reference audio')
    def test_preview_timeout_cannot_resubmit_on_worker_redelivery(self, _download, create):
        queue = self.preview_queue()
        self.assertEqual(run_preview(queue.id)['status'], 'failed')
        self.assertEqual(run_preview(queue.id)['status'], 'failed')
        create.assert_called_once()

    @patch('apps.ai_processing.tasks.generate_voice_preview_task.apply_async')
    @patch('apps.ai_processing.views.can_clone_voice', return_value=LimitResult(True))
    @patch('apps.ai_processing.views.authorize_processing_access', return_value=None)
    def test_preview_request_reuses_only_matching_profile(self, _auth, _limit, submit):
        def post(text='I remember home'):
            request = RequestFactory().post('/preview/', data=json.dumps({'text': text}),
                                            content_type='application/json')
            return VoicePreviewView.as_view()(request, user_id=self.owner.id)

        first = post()
        self.assertEqual(first.status_code, 202)
        second = post('I remember home.')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data['preview_id'], second.data['preview_id'])
        submit.assert_called_once()
        with override_settings(REPLICATE_LANGUAGE='auto'):
            changed = post()
        self.assertEqual(changed.status_code, 202)
        self.assertNotEqual(first.data['preview_id'], changed.data['preview_id'])
        self.assertEqual(submit.call_count, 2)

    @patch('apps.ai_processing.tasks.generate_voice_preview_task.apply_async')
    @patch('apps.ai_processing.views.can_clone_voice', return_value=LimitResult(True))
    @patch('apps.ai_processing.views.authorize_processing_access', return_value=None)
    def test_failed_preview_same_profile_stays_deduplicated(self, _auth, _limit, submit):
        queue = self.preview_queue(text='I remember home.')
        queue.status = 'failed'
        queue.save()
        request = RequestFactory().post('/preview/', data=json.dumps({'text': 'I remember home'}),
                                        content_type='application/json')
        response = VoicePreviewView.as_view()(request, user_id=self.owner.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['preview_id'], str(queue.id))
        submit.assert_not_called()

    def test_chat_cache_changes_with_model_language_and_text_revision(self):
        baseline = voice_cache_identity(self.config)
        self.assertEqual(baseline, voice_cache_identity(self.config))
        for changes in ({'REPLICATE_LANGUAGE': 'auto'}, {'REPLICATE_MODEL_VERSION': 'test-version'}):
            with override_settings(**changes):
                self.assertNotEqual(baseline, voice_cache_identity(self.config))
        with patch('services.speech.SPEECH_TEXT_VERSION', 'new-text-rules'):
            self.assertNotEqual(baseline, voice_cache_identity(self.config))
        self.assertNotEqual(synthesis_profile_id(), synthesis_profile_id({'version': 'different'}))

    @patch('services.replicate_voice.download_file_stream_to_temp', return_value=True)
    @patch('services.replicate_voice.build_reference', side_effect=ValueError('No complete sentence'))
    @patch('services.replicate_voice.upload_file_to_supabase')
    def test_reference_selection_failure_preserves_existing_voice(self, upload, _build, _download):
        from apps.recordings.models import AudioRecording
        AudioRecording.objects.create(
            user=self.owner, storage_path='recording.wav', public_url='http://localhost/recording.wav',
            file_size_bytes=1000, format='wav', question_number=1, question_text='Memory?',
            domain='childhood', duration_seconds=30, upload_status='complete',
        )
        with self.assertRaisesMessage(ValueError, 'No complete sentence'):
            prepare_reference(self.owner)
        self.config.refresh_from_db()
        self.assertEqual(self.config.voice_clone_id, 'replicate:test')
        self.assertEqual(self.config.voice_reference_path, 'reference.wav')
        upload.assert_not_called()

    @patch('services.replicate_voice.download_file_stream_to_temp', return_value=True)
    @patch('services.replicate_voice.build_reference', return_value=(b'complete reference', 'I remember home.'))
    @patch('services.replicate_voice.upload_file_to_supabase', return_value='stored')
    def test_success_stores_matching_reference_with_new_identity(self, upload, build, _download):
        from apps.recordings.models import AudioRecording
        AudioRecording.objects.create(
            user=self.owner, storage_path='recording.wav', public_url='http://localhost/recording.wav',
            file_size_bytes=1000, format='wav', question_number=1, question_text='Memory?',
            domain='childhood', duration_seconds=30, upload_status='complete',
        )
        with patch('openai.OpenAI', return_value=Mock()):
            prepare_reference(self.owner)
        build.assert_called_once()
        self.config.refresh_from_db()
        self.assertNotEqual(self.config.voice_clone_id, 'replicate:test')
        self.assertTrue(self.config.voice_clone_id.startswith('replicate:'))
        self.assertTrue(self.config.voice_reference_path.startswith(f'{self.owner.id}/voice-reference-'))
        self.assertEqual(self.config.voice_reference_text, 'I remember home.')
        self.assertEqual(upload.call_args.args[2].getvalue(), b'complete reference')
        self.assertFalse(self.config.quality_approved)
