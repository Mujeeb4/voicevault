from django.test import TestCase, RequestFactory, override_settings
from django.urls import reverse
from unittest.mock import patch, MagicMock
from rest_framework import status
from apps.users.models import User, ConsentRecord
from apps.recordings.models import AudioRecording, Transcript
from apps.ai_processing.models import APIUsageTracking, ProcessingQueue
from apps.ai_processing.tasks import _recording_processing_order, transcribe_audio_task
from apps.ai_processing.views import (
    AnalyzePersonalityView,
    CloneVoiceView,
    TranscribeAudioView,
    RunFullPipelineView,
)
from utils.supabase_auth import SupabaseUser

class AIProcessingViewsTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        
        # Create a test user
        self.user = User.objects.create(
            email='test@example.com',
            full_name='Test User',
            package_tier='free',
            plan_type='free',
            is_premium=False
        )
        
        # Mock Supabase user for middleware simulation
        self.supabase_user = SupabaseUser(
            user_id=str(self.user.id),
            email=self.user.email,
            token_data={'sub': str(self.user.id), 'email': self.user.email}
        )

    @patch('apps.ai_processing.views.transcribe_audio_task')
    def test_transcribe_audio_view_allowed_for_free_user(self, mock_transcribe_task):
        """Verify that free users can trigger transcription (can_clone_voice limit bypassed)."""
        # Create a recording for the user
        AudioRecording.objects.create(
            user=self.user,
            storage_path='test/path.mp3',
            public_url='http://example.com/test.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=1,
            question_text='Test question',
            domain='childhood',
            upload_status='complete'
        )
        
        # Setup request
        request = self.factory.post(f'/api/admin/process/transcribe/{self.user.id}/')
        request.supabase_user = self.supabase_user
        
        # Run view
        view = TranscribeAudioView.as_view()
        response = view(request, user_id=self.user.id)
        
        # Assertions
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('Transcription task started', response.data['message'])
        mock_transcribe_task.delay.assert_called_once_with(str(self.user.id))

    @override_settings(AI_MIN_WORDS_FOR_PERSONALITY=50)
    @patch('apps.ai_processing.views.analyze_personality_task')
    def test_personality_retry_uses_configured_transcript_minimum(self, mock_personality_task):
        """The retry endpoint must use the same transcript threshold as the worker."""
        Transcript.objects.create(
            user=self.user,
            full_transcript='word ' * 50,
            word_count=50,
        )
        mock_personality_task.delay.return_value.id = 'personality-task-id'

        request = self.factory.post(f'/api/admin/process/personality/{self.user.id}/')
        request.supabase_user = self.supabase_user

        response = AnalyzePersonalityView.as_view()(request, user_id=self.user.id)

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_personality_task.delay.assert_called_once_with(str(self.user.id))

    @patch('apps.ai_processing.views.transcribe_audio_task')
    @patch('apps.ai_processing.views.analyze_personality_task')
    @patch('apps.ai_processing.views.clone_voice_task')
    @patch('apps.ai_processing.views.finalize_ai_task')
    @patch('celery.chain')
    def test_run_full_pipeline_view_for_free_user(self, mock_chain, mock_finalize, mock_clone, mock_analyze, mock_transcribe):
        """Verify that full pipeline view omits clone_voice_task for free users."""
        # Create a recording
        AudioRecording.objects.create(
            user=self.user,
            storage_path='test/path.mp3',
            public_url='http://example.com/test.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=1,
            question_text='Test question',
            domain='childhood',
            upload_status='complete'
        )
        
        # Setup request
        request = self.factory.post(f'/api/admin/process/full-pipeline/{self.user.id}/')
        request.supabase_user = self.supabase_user
        
        # Run view
        view = RunFullPipelineView.as_view()
        response = view(request, user_id=self.user.id)
        
        # Assertions
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        
        # Verify clone_voice_task was NOT chained (only transcribe, analyze, finalize)
        # Check that we built the chain correctly
        mock_chain.assert_called_once()
        chain_args = mock_chain.call_args[0]
        
        # There should be 3 tasks in the chain: transcribe, analyze, finalize
        self.assertEqual(len(chain_args), 3)
        
        # Verify the signatures are created for the correct tasks
        mock_transcribe.si.assert_called_once_with(str(self.user.id))
        mock_analyze.si.assert_called_once_with(str(self.user.id))
        mock_finalize.si.assert_called_once_with(str(self.user.id))
        mock_clone.si.assert_not_called()

    @patch('apps.ai_processing.views.transcribe_audio_task')
    @patch('apps.ai_processing.views.analyze_personality_task')
    @patch('apps.ai_processing.views.clone_voice_task')
    @patch('apps.ai_processing.views.finalize_ai_task')
    @patch('celery.chain')
    def test_run_full_pipeline_view_for_premium_user_with_consent(self, mock_chain, mock_finalize, mock_clone, mock_analyze, mock_transcribe):
        """Verify that full pipeline view includes clone_voice_task for premium users with consent."""
        # Upgrade user to premium
        self.user.is_premium = True
        self.user.plan_type = 'premium'
        self.user.save()
        
        # Add voice cloning consent
        ConsentRecord.objects.create(
            user=self.user,
            consent_type='voice_cloning',
            accepted=True
        )
        
        # Create a recording
        AudioRecording.objects.create(
            user=self.user,
            storage_path='test/path.mp3',
            public_url='http://example.com/test.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=1,
            question_text='Test question',
            domain='childhood',
            upload_status='complete'
        )
        
        # Setup request
        request = self.factory.post(f'/api/admin/process/full-pipeline/{self.user.id}/')
        request.supabase_user = self.supabase_user
        
        # Run view
        view = RunFullPipelineView.as_view()
        response = view(request, user_id=self.user.id)
        
        # Assertions
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        
        # Verify clone_voice_task WAS chained (transcribe, analyze, clone, finalize)
        mock_chain.assert_called_once()
        chain_args = mock_chain.call_args[0]
        
        # There should be 4 tasks in the chain
        self.assertEqual(len(chain_args), 4)
        
        # Verify signatures
        mock_transcribe.si.assert_called_once_with(str(self.user.id))
        mock_analyze.si.assert_called_once_with(str(self.user.id))
        mock_clone.si.assert_called_once_with(str(self.user.id))
        mock_finalize.si.assert_called_once_with(str(self.user.id))

    def test_recording_processing_order_keeps_chunked_combined_uploads_in_sequence(self):
        """Chunked combined uploads use negative question numbers but must process part 1 first."""
        recordings = [
            AudioRecording(
                user=self.user,
                storage_path='test/part-2.mp3',
                public_url='http://example.com/part-2.mp3',
                file_size_bytes=1000,
                format='mp3',
                question_number=-2,
                question_text='Part 2',
                domain='combined',
                upload_status='complete',
            ),
            AudioRecording(
                user=self.user,
                storage_path='test/part-1.mp3',
                public_url='http://example.com/part-1.mp3',
                file_size_bytes=1000,
                format='mp3',
                question_number=-1,
                question_text='Part 1',
                domain='combined',
                upload_status='complete',
            ),
            AudioRecording(
                user=self.user,
                storage_path='test/question-1.mp3',
                public_url='http://example.com/question-1.mp3',
                file_size_bytes=1000,
                format='mp3',
                question_number=1,
                question_text='Question 1',
                domain='childhood',
                upload_status='complete',
            ),
        ]

        ordered = sorted(recordings, key=_recording_processing_order)

        self.assertEqual([recording.question_number for recording in ordered], [-1, -2, 1])

    @patch('apps.ai_processing.views.clone_voice_task')
    @patch('apps.ai_processing.views.finalize_ai_task')
    @patch('celery.chain')
    def test_clone_voice_view_accepts_60_second_audio_threshold(self, mock_chain, mock_finalize, mock_clone):
        """Voice clone trigger should use the same 60-second minimum as the worker task."""
        self.user.is_premium = True
        self.user.plan_type = 'premium'
        self.user.save()
        ConsentRecord.objects.create(user=self.user, consent_type='voice_cloning', accepted=True)

        AudioRecording.objects.create(
            user=self.user,
            storage_path='test/short.mp3',
            public_url='http://example.com/short.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=1,
            question_text='Short clip',
            domain='childhood',
            upload_status='complete',
            duration_seconds=60,
        )

        request = self.factory.post(f'/api/admin/process/voice-clone/{self.user.id}/')
        request.supabase_user = self.supabase_user

        response = CloneVoiceView.as_view()(request, user_id=self.user.id)

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_chain.assert_called_once()
        mock_clone.si.assert_called_once_with(str(self.user.id))
        mock_finalize.si.assert_called_once_with(str(self.user.id))

    @patch('apps.ai_processing.views.clone_voice_task')
    @patch('apps.ai_processing.views.finalize_ai_task')
    @patch('celery.chain')
    def test_clone_voice_view_requires_consent_for_premium_users(self, mock_chain, mock_finalize, mock_clone):
        """Voice clone trigger should reject premium users who have not accepted consent."""
        self.user.is_premium = True
        self.user.plan_type = 'premium'
        self.user.save()

        AudioRecording.objects.create(
            user=self.user,
            storage_path='test/long.mp3',
            public_url='http://example.com/long.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=1,
            question_text='Long clip',
            domain='childhood',
            upload_status='complete',
            duration_seconds=120,
        )

        request = self.factory.post(f'/api/admin/process/voice-clone/{self.user.id}/')
        request.supabase_user = self.supabase_user

        response = CloneVoiceView.as_view()(request, user_id=self.user.id)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['error'], 'voice_cloning_consent')
        mock_chain.assert_not_called()

    @patch('apps.ai_processing.tasks.transcribe_single_file')
    def test_transcribe_audio_task_processes_chunked_combined_uploads_in_sequence(self, mock_transcribe_single_file):
        """The task should call Whisper on combined chunks in upload order."""
        part_two = AudioRecording.objects.create(
            user=self.user,
            storage_path='test/part-2.mp3',
            public_url='http://example.com/part-2.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=-2,
            question_text='Part 2',
            domain='combined',
            upload_status='complete',
        )
        part_one = AudioRecording.objects.create(
            user=self.user,
            storage_path='test/part-1.mp3',
            public_url='http://example.com/part-1.mp3',
            file_size_bytes=1000,
            format='mp3',
            question_number=-1,
            question_text='Part 1',
            domain='combined',
            upload_status='complete',
        )
        mock_transcribe_single_file.return_value = {
            'success': True,
            'transcript': 'test transcript',
            'confidence': 0.9,
            'tokens': 10,
        }

        result = transcribe_audio_task.apply(args=[str(self.user.id)]).get()

        called_ids = [call.args[0] for call in mock_transcribe_single_file.call_args_list]
        self.assertEqual(called_ids, [part_one.id, part_two.id])
        self.assertTrue(result['success'])
        self.assertEqual(result['recordings_processed'], 2)
        self.assertTrue(Transcript.objects.filter(user=self.user).exists())
        self.assertEqual(APIUsageTracking.objects.filter(user=self.user, operation='transcribe').count(), 1)
        self.assertEqual(ProcessingQueue.objects.filter(user=self.user, task_type='transcribe', status='complete').count(), 1)
