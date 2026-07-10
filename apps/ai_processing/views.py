"""
Admin views for triggering AI processing tasks.
"""
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.shortcuts import get_object_or_404
import logging

from apps.users.models import User
from apps.recordings.models import AudioRecording, Transcript
from .models import AIConfiguration, ProcessingQueue
from .tasks import (
    transcribe_audio_task,
    analyze_personality_task,
    clone_voice_task,
    test_ai_quality_task,
    finalize_ai_task
)
from services.plan_limits import can_clone_voice
from utils.admin_auth import is_admin_email

logger = logging.getLogger(__name__)


def authorize_processing_access(request, user_id, action):
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'authentication_required', 'message': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    requesting_user_id = str(request.supabase_user.id).lower().strip()
    target_user_id = str(user_id).lower().strip()
    if requesting_user_id == target_user_id or is_admin_email(request.supabase_user.email):
        return None

    logger.warning(
        "Permission denied - User %s tried to %s for %s",
        requesting_user_id,
        action,
        target_user_id,
    )
    return Response(
        {'error': 'permission_denied', 'message': 'Admin access required for this account'},
        status=status.HTTP_403_FORBIDDEN
    )


class TranscribeAudioView(APIView):
    """
    POST /api/admin/process/transcribe/<user_id>/
    Trigger audio transcription for a user.
    Users can trigger their own processing.
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself
    
    def post(self, request, user_id):
        denied = authorize_processing_access(request, user_id, 'trigger transcription')
        if denied:
            return denied
        """Trigger transcription task."""
        try:
            user = get_object_or_404(User, id=user_id)
            
            # Check if recordings exist
            recordings_count = AudioRecording.objects.filter(
                user=user,
                upload_status='complete'
            ).count()
            
            if recordings_count == 0:
                return Response(
                    {
                        'error': 'no_recordings',
                        'message': 'No completed recordings found for this user'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if already transcribed
            if Transcript.objects.filter(user=user).exists():
                return Response(
                    {
                        'warning': 'already_transcribed',
                        'message': 'User already has a transcript. This will overwrite it.'
                    },
                    status=status.HTTP_200_OK
                )
            
            # Queue the transcription task
            task = transcribe_audio_task.delay(str(user_id))
            
            logger.info(f"Transcription task queued for user {user_id}: {task.id}")
            
            return Response(
                {
                    'message': 'Transcription task started',
                    'task_id': task.id,
                    'user_id': str(user_id),
                    'recordings_count': recordings_count,
                    'status': 'pending'
                },
                status=status.HTTP_202_ACCEPTED
            )
            
        except Exception as e:
            logger.error("Error starting transcription: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'task_failed',
                    'message': 'Failed to start transcription'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AnalyzePersonalityView(APIView):
    """
    POST /api/admin/process/personality/<user_id>/
    Trigger personality analysis for a user.
    Users can trigger their own processing.
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself
    
    def post(self, request, user_id):
        denied = authorize_processing_access(request, user_id, 'trigger personality analysis')
        if denied:
            return denied
        """Trigger personality analysis task."""
        try:
            user = get_object_or_404(User, id=user_id)
            
            # Check if transcript exists
            try:
                transcript = Transcript.objects.get(user=user)
            except Transcript.DoesNotExist:
                return Response(
                    {
                        'error': 'no_transcript',
                        'message': 'No transcript found. Run transcription first.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check transcript length
            minimum_words = settings.AI_MIN_WORDS_FOR_PERSONALITY
            if transcript.word_count < minimum_words:
                return Response(
                    {
                        'error': 'transcript_too_short',
                        'message': (
                            f'Transcript has only {transcript.word_count} words '
                            f'(minimum {minimum_words})'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Queue the personality analysis task
            task = analyze_personality_task.delay(str(user_id))
            
            logger.info(f"Personality analysis task queued for user {user_id}: {task.id}")
            
            return Response(
                {
                    'message': 'Personality analysis task started',
                    'task_id': task.id,
                    'user_id': str(user_id),
                    'transcript_words': transcript.word_count,
                    'status': 'pending'
                },
                status=status.HTTP_202_ACCEPTED
            )
            
        except Exception as e:
            logger.error("Error starting personality analysis: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'task_failed',
                    'message': 'Failed to start personality analysis'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CloneVoiceView(APIView):
    """
    POST /api/admin/process/voice-clone/<user_id>/
    Trigger voice cloning for a user.
    Users can trigger their own processing.
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself
    
    def post(self, request, user_id):
        denied = authorize_processing_access(request, user_id, 'trigger voice cloning')
        if denied:
            return denied
        """Trigger voice cloning task."""
        try:
            user = get_object_or_404(User, id=user_id)
            
            # Check if recordings exist
            recordings = AudioRecording.objects.filter(
                user=user,
                upload_status='complete'
            )
            
            if not recordings.exists():
                return Response(
                    {
                        'error': 'no_recordings',
                        'message': 'No recordings found for voice cloning'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check premium and consent before queueing the task.
            clone_limit = can_clone_voice(user)
            if not clone_limit.allowed:
                return Response(
                    {
                        'error': clone_limit.limit_key or 'voice_cloning_not_allowed',
                        'message': clone_limit.message,
                        'upgrade_required': clone_limit.upgrade_required,
                    },
                    status=status.HTTP_403_FORBIDDEN if clone_limit.limit_key == 'voice_cloning_consent' or clone_limit.upgrade_required else status.HTTP_400_BAD_REQUEST,
                )

            # Calculate total duration
            total_duration = sum(r.duration_seconds or 0 for r in recordings)

            # Match the worker task requirement: 60 seconds minimum.
            if total_duration < 60:
                return Response(
                    {
                        'error': 'insufficient_audio',
                        'message': f'Only {total_duration:.1f} seconds of audio (minimum 60s required)'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Queue the voice cloning task followed by finalization in sequence
            from celery import chain
            pipeline = chain(
                clone_voice_task.si(str(user_id)).set(queue='voice'),
                finalize_ai_task.si(str(user_id)).set(queue='default'),
            )
            result = pipeline.apply_async()
            
            logger.info(f"Voice cloning task queued for user {user_id}: {result.id}")
            
            return Response(
                {
                    'message': 'Voice cloning task started',
                    'task_id': result.id,
                    'user_id': str(user_id),
                    'recordings_count': recordings.count(),
                    'total_duration_seconds': total_duration,
                    'status': 'pending'
                },
                status=status.HTTP_202_ACCEPTED
            )
            
        except Exception as e:
            logger.error("Error starting voice cloning: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'task_failed',
                    'message': 'Failed to start voice cloning'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FinalizeAIView(APIView):
    """
    POST /api/admin/process/finalize/<user_id>/
    Finalize AI and mark user as ready.
    Users can trigger their own processing.
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself
    
    def post(self, request, user_id):
        denied = authorize_processing_access(request, user_id, 'trigger finalization')
        if denied:
            return denied
        """Finalize AI for a user."""
        try:
            user = get_object_or_404(User, id=user_id)
            
            # Check all components
            try:
                transcript = Transcript.objects.get(user=user)
                ai_config = AIConfiguration.objects.get(user=user)
            except Transcript.DoesNotExist:
                return Response(
                    {
                        'error': 'missing_components',
                        'message': 'Transcript not found. Complete all processing steps first.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            except AIConfiguration.DoesNotExist:
                return Response(
                    {
                        'error': 'missing_components',
                        'message': 'AI Configuration not found. Complete personality analysis first.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Queue the finalization task
            task = finalize_ai_task.delay(str(user_id))
            
            logger.info(f"AI finalization task queued for user {user_id}: {task.id}")
            
            return Response(
                {
                    'message': 'AI finalization started',
                    'task_id': task.id,
                    'user_id': str(user_id),
                    'status': 'pending'
                },
                status=status.HTTP_202_ACCEPTED
            )
            
        except Exception as e:
            logger.error("Error finalizing AI: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'task_failed',
                    'message': 'Failed to finalize AI'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProcessingStatusView(APIView):
    """
    GET /api/admin/process/status/<user_id>/
    Get processing status for a user.
    Users can view their own status, admins can view any user's status.
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself
    
    def get(self, request, user_id):
        """Get processing status."""
        try:
            denied = authorize_processing_access(request, user_id, 'view processing status')
            if denied:
                return denied

            user = get_object_or_404(User, id=user_id)
            
            # Get all processing tasks for this user
            tasks = ProcessingQueue.objects.filter(user=user).order_by('-created_at')
            
            # Check component statuses
            has_recordings = AudioRecording.objects.filter(
                user=user,
                upload_status='complete'
            ).exists()
            
            # Auto-correct recording completion status if recordings exist but DB flag is missing
            if has_recordings and not user.recording_completed:
                user.mark_recording_complete()
                logger.info(f"Auto-marked user {user_id} as recording_completed after detecting completed recordings")
            
            has_transcript = Transcript.objects.filter(user=user).exists()
            has_ai_config = AIConfiguration.objects.filter(user=user).exists()
            
            # Get latest task for each type
            latest_tasks = {}
            for task in tasks:
                if task.task_type not in latest_tasks:
                    latest_tasks[task.task_type] = {
                        'status': task.status,
                        'started_at': task.started_at,
                        'completed_at': task.completed_at,
                        'error_message': task.error_message,
                        'retry_count': task.retry_count
                    }
            
            # Determine overall status
            # Check if all processing is actually complete (even if ai_ready hasn't been set)
            all_processing_complete = False
            if has_transcript and has_ai_config:
                try:
                    ai_config_check = AIConfiguration.objects.get(user=user)
                    all_processing_complete = bool(
                        ai_config_check.voice_clone_id and 
                        ai_config_check.personality_data
                    )
                except AIConfiguration.DoesNotExist:
                    pass
            
            if user.ai_ready or all_processing_complete:
                overall_status = 'complete'
                # If all processing is done but ai_ready isn't set, auto-set it
                if all_processing_complete and not user.ai_ready:
                    user.mark_ai_ready()
                    logger.info(f"Auto-marked user {user_id} as ai_ready after detecting completed processing")
            elif any(t.get('status') == 'processing' for t in latest_tasks.values()):
                overall_status = 'in_progress'
            elif any(t.get('status') == 'failed' for t in latest_tasks.values()):
                overall_status = 'failed'
            elif has_recordings and not has_transcript and not latest_tasks:
                # Recordings uploaded but no processing tasks started yet
                overall_status = 'recorded_and_uploaded'
            elif has_recordings and not has_transcript:
                # Recordings exist, processing should start soon
                overall_status = 'pending'
            elif has_transcript and not has_ai_config:
                overall_status = 'pending'
            else:
                overall_status = 'pending'
            
            # Build steps object matching frontend expectations
            from django.utils import timezone
            
            # Helper function to map task status to frontend status
            def map_status(task_status):
                """Map backend task status to frontend ProcessingStatus"""
                if task_status == 'complete':
                    return 'complete'
                elif task_status == 'processing':
                    return 'in_progress'
                elif task_status == 'failed':
                    return 'failed'
                else:
                    return 'pending'
            
            # Transcription step
            transcription_task = latest_tasks.get('transcribe', {})
            if has_transcript:
                transcription_status = 'complete'
            else:
                transcription_status = map_status(transcription_task.get('status', 'pending'))
            
            # Personality analysis step
            personality_task = latest_tasks.get('analyze_personality', {})
            if has_ai_config:
                personality_status = 'complete'
            else:
                personality_status = map_status(personality_task.get('status', 'pending'))
            
            # Voice cloning step
            voice_clone_task = latest_tasks.get('clone_voice', {})
            
            # Check if voice cloning is actually complete (ai_config has voice_clone_id)
            voice_clone_complete = False
            if has_ai_config:
                try:
                    ai_config_check = AIConfiguration.objects.get(user=user)
                    voice_clone_complete = bool(ai_config_check.voice_clone_id)
                except AIConfiguration.DoesNotExist:
                    pass
            
            if voice_clone_complete:
                voice_clone_status = 'complete'
            else:
                voice_clone_status = map_status(voice_clone_task.get('status', 'pending'))
            
            # Get transcript info if exists (include full transcript for voice cloning step)
            transcript_info = None
            full_transcript_text = None
            if has_transcript:
                try:
                    transcript = Transcript.objects.get(user=user)
                    transcript_info = {
                        'transcript': transcript.full_transcript[:100] + '...' if len(transcript.full_transcript) > 100 else transcript.full_transcript,
                        'word_count': transcript.word_count
                    }
                    # Store full transcript for voice cloning step display
                    full_transcript_text = transcript.full_transcript
                except Transcript.DoesNotExist:
                    pass
            
            # Get AI config info if exists
            ai_config_info = None
            if has_ai_config:
                try:
                    ai_config = AIConfiguration.objects.get(user=user)
                    ai_config_info = {
                        'voice_clone_id': ai_config.voice_clone_id,
                        'quality_score': ai_config.voice_quality_score
                    }
                except AIConfiguration.DoesNotExist:
                    pass
            
            return Response(
                {
                    'user_id': str(user_id),
                    'ai_ready': user.ai_ready,
                    'overall_status': overall_status,
                    'steps': {
                        'transcription': {
                            'status': transcription_status,
                            'error': transcription_task.get('error_message'),
                            'result': transcript_info,
                            'full_transcript': full_transcript_text  # Include full transcript for display
                        },
                        'personality_analysis': {
                            'status': personality_status,
                            'error': personality_task.get('error_message'),
                            'result': None  # Can be enhanced later
                        },
                        'voice_cloning': {
                            'status': voice_clone_status,
                            'error': voice_clone_task.get('error_message'),
                            'result': ai_config_info
                        }
                    },
                    'created_at': user.ai_processing_started_at.isoformat() if user.ai_processing_started_at else timezone.now().isoformat(),
                    'updated_at': timezone.now().isoformat()
                },
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error("Error getting processing status: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'status_failed',
                    'message': 'Failed to get processing status'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RunFullPipelineView(APIView):
    """
    POST /api/admin/process/full-pipeline/<user_id>/
    Run the complete AI processing pipeline in sequence.
    """
    permission_classes = [AllowAny]
    
    def post(self, request, user_id):
        denied = authorize_processing_access(request, user_id, 'trigger pipeline')
        if denied:
            return denied
            
        """Run full processing pipeline."""
        try:
            user = get_object_or_404(User, id=user_id)
            
            # Check if recordings exist
            recordings_count = AudioRecording.objects.filter(
                user=user,
                upload_status='complete'
            ).count()
            
            if recordings_count == 0:
                return Response(
                    {
                        'error': 'no_recordings',
                        'message': 'No recordings found. User must upload audio first.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Reset user AI status before enqueuing processing pipeline
            user.reset_ai_ready()
            
            # Chain tasks in sequence
            from celery import chain
            
            # Use immutable signatures (.si()) to pass user_id explicitly
            # This avoids passing previous task result as first argument
            if can_clone_voice(user).allowed:
                pipeline = chain(
                    transcribe_audio_task.si(str(user_id)).set(queue='transcription'),
                    analyze_personality_task.si(str(user_id)).set(queue='analysis'),
                    clone_voice_task.si(str(user_id)).set(queue='voice'),
                    finalize_ai_task.si(str(user_id)).set(queue='default'),
                )
            else:
                pipeline = chain(
                    transcribe_audio_task.si(str(user_id)).set(queue='transcription'),
                    analyze_personality_task.si(str(user_id)).set(queue='analysis'),
                    finalize_ai_task.si(str(user_id)).set(queue='default'),
                )
            
            result = pipeline.apply_async()
            
            logger.info(f"Full pipeline queued for user {user_id}: {result.id}")
            
            return Response(
                {
                    'message': 'Full AI processing pipeline started',
                    'pipeline_id': result.id,
                    'user_id': str(user_id),
                    'recordings_count': recordings_count,
                    'steps': [
                        'transcription',
                        'personality_analysis',
                        'voice_cloning',
                        'finalization'
                    ],
                    'status': 'pending'
                },
                status=status.HTTP_202_ACCEPTED
            )
            
        except Exception as e:
            logger.error("Error starting full pipeline: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'pipeline_failed',
                    'message': 'Failed to start processing pipeline'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
