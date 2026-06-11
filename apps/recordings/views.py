"""
Views for recordings app - file upload and management.
"""
import os
import uuid
import json
from datetime import datetime
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
import logging

from .models import AudioRecording
from .serializers import AudioRecordingSerializer, AudioRecordingUploadSerializer
from apps.users.models import User
from services.plan_limits import (
    can_upload_recording,
    record_recording_usage,
    validate_audio_file,
)
from utils.supabase_client import upload_file_to_supabase, delete_file_from_supabase

logger = logging.getLogger(__name__)


class AudioRecordingUploadView(APIView):
    """
    POST /api/recordings/upload/
    Upload combined audio recording to Supabase Storage.
    Accepts either:
    1. Combined file (all questions in one file) - NEW format
    2. Individual question file - OLD format (for backward compatibility)
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself
    
    def post(self, request):
        # Get or create user based on Supabase auth
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get or create user in database
        user, created = User.objects.get_or_create(
            id=request.supabase_user.id,
            defaults={
                'email': request.supabase_user.email,
                'full_name': request.supabase_user.email.split('@')[0],
            }
        )
        
        # Check if this is a combined upload (new format) or individual question (old format)
        audio_file = request.FILES.get('audio_file')
        if not audio_file:
            return Response(
                {'error': 'validation_error', 'message': 'audio_file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for combined upload format (has recording_metadata)
        recording_metadata = request.data.get('recording_metadata')
        if recording_metadata:
            # NEW FORMAT: Combined file upload
            try:
                if isinstance(recording_metadata, str):
                    metadata = json.loads(recording_metadata)
                else:
                    metadata = recording_metadata

                chunk_index = int(metadata.get('chunk_index') or 1)
                total_chunks = int(metadata.get('total_chunks') or 1)
                is_final_chunk = bool(metadata.get('is_final_chunk', chunk_index >= total_chunks))
                if chunk_index < 1 or total_chunks < 1 or chunk_index > total_chunks:
                    return Response(
                        {'error': 'validation_error', 'message': 'Invalid upload chunk metadata'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Determine file format
                file_extension = audio_file.name.split('.')[-1].lower()
                file_validation = validate_audio_file(audio_file)
                if not file_validation.allowed:
                    return Response(file_validation.as_error(), status=status.HTTP_400_BAD_REQUEST)

                # Get duration from request (if provided)
                duration_seconds = request.data.get('duration_seconds')
                if duration_seconds:
                    try:
                        duration_seconds = float(duration_seconds)
                    except (ValueError, TypeError):
                        duration_seconds = None

                combined_question_number = 0 if total_chunks == 1 else -chunk_index

                # Starting a chunked upload replaces any previous combined upload set.
                if total_chunks > 1 and chunk_index == 1:
                    old_combined_recordings = AudioRecording.objects.filter(
                        user=user,
                        domain='combined',
                        question_number__lte=0,
                    )
                    for old_recording in old_combined_recordings:
                        try:
                            delete_file_from_supabase(
                                bucket='recordings',
                                file_path=old_recording.storage_path
                            )
                        except Exception as e:
                            logger.warning("Failed to delete old combined chunk: %s", e.__class__.__name__)
                    old_combined_recordings.delete()

                # Check if this combined part already exists
                existing_combined = AudioRecording.objects.filter(
                    user=user,
                    question_number=combined_question_number
                ).first()

                limit_check = can_upload_recording(
                    user,
                    file_size_bytes=audio_file.size,
                    duration_seconds=duration_seconds,
                    question_number=None,
                    replacing_recording=existing_combined,
                )
                if not limit_check.allowed:
                    return Response(limit_check.as_error(), status=status.HTTP_402_PAYMENT_REQUIRED)
                
                # Generate unique filename for combined file
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                if total_chunks > 1:
                    storage_path = f"{user.id}/combined_part_{chunk_index}_of_{total_chunks}_{timestamp}.{file_extension}"
                else:
                    storage_path = f"{user.id}/combined_{timestamp}.{file_extension}"
                
                # Upload to Supabase Storage
                logger.info("Uploading combined recording for user %s", user.id)
                public_url = upload_file_to_supabase(
                    bucket='recordings',
                    file_path=storage_path,
                    file_object=audio_file
                )
                
                if not public_url:
                    raise Exception("Failed to get public URL from Supabase")
                
                # If exists, delete old file from Supabase and update record
                if existing_combined:
                    # Delete old file from Supabase Storage
                    logger.info("Deleting previous combined recording for user %s", user.id)
                    try:
                        delete_file_from_supabase(
                            bucket='recordings',
                            file_path=existing_combined.storage_path
                        )
                    except Exception as e:
                        logger.warning("Failed to delete old recording: %s", e.__class__.__name__)
                    
                    # Update existing record
                    existing_combined.storage_path = storage_path
                    existing_combined.public_url = public_url
                    existing_combined.file_size_bytes = audio_file.size
                    existing_combined.format = file_extension
                    existing_combined.duration_seconds = duration_seconds
                    existing_combined.upload_status = 'complete'
                    existing_combined.transcribed = False  # Reset transcribed flag for new upload
                    existing_combined.save()
                    
                    recording = existing_combined
                    logger.info(f"Updated existing combined recording: {recording.id}")
                else:
                    # Create new combined recording record
                    recording = AudioRecording.objects.create(
                        user=user,
                        storage_path=storage_path,
                        public_url=public_url,
                        file_size_bytes=audio_file.size,
                        format=file_extension,
                        question_number=combined_question_number,  # 0 single combined, negative numbers chunked combined
                        question_text=(
                            f'Combined recording part {chunk_index} of {total_chunks}'
                            if total_chunks > 1
                            else 'Combined recording from all questions'
                        ),
                        domain='combined',
                        duration_seconds=duration_seconds,
                        upload_status='complete'
                    )
                    logger.info(f"Created new combined recording: {recording.id}")

                record_recording_usage(
                    user,
                    action='recording_upload',
                    target_id=str(recording.id),
                    metadata={
                        'question_number': recording.question_number,
                        'duration_seconds': duration_seconds,
                        'file_size_bytes': audio_file.size,
                        'chunk_index': chunk_index,
                        'total_chunks': total_chunks,
                        'is_final_chunk': is_final_chunk,
                    },
                )
                
                logger.info(f"Combined recording created successfully: {recording.id}")
                
                # Automatically trigger AI processing pipeline after successful upload
                try:
                    from apps.ai_processing.tasks import transcribe_audio_task
                    from celery import chain
                    from apps.ai_processing.tasks import (
                        analyze_personality_task,
                        clone_voice_task,
                        finalize_ai_task
                    )
                    from services.plan_limits import can_clone_voice
                    
                    # Check if processing has already been started
                    from apps.ai_processing.models import ProcessingQueue
                    existing_tasks = ProcessingQueue.objects.filter(
                        user=user,
                        task_type__in=['transcribe', 'analyze_personality', 'clone_voice']
                    ).exists()
                    
                    if is_final_chunk and not existing_tasks:
                        # Start the full processing pipeline
                        logger.info(f"Triggering full AI processing pipeline for user {user.id}")
                        # Use immutable signatures (.si()) to pass user_id explicitly
                        # This avoids passing previous task result as first argument
                        if can_clone_voice(user).allowed:
                            pipeline = chain(
                                transcribe_audio_task.si(str(user.id)),
                                analyze_personality_task.si(str(user.id)),
                                clone_voice_task.si(str(user.id)),
                                finalize_ai_task.si(str(user.id))
                            )
                        else:
                            pipeline = chain(
                                transcribe_audio_task.si(str(user.id)),
                                analyze_personality_task.si(str(user.id)),
                                finalize_ai_task.si(str(user.id))
                            )
                        result = pipeline.apply_async()
                        logger.info(f"Full pipeline queued for user {user.id}: {result.id}")
                    elif not is_final_chunk:
                        logger.info("Combined recording chunk %s/%s uploaded; waiting for final chunk", chunk_index, total_chunks)
                    else:
                        logger.info(f"Processing pipeline already exists for user {user.id}, skipping auto-trigger")
                except Exception as e:
                    logger.error("Failed to trigger processing pipeline: %s", e.__class__.__name__, exc_info=True)
                    # Don't fail the upload if processing trigger fails - user can trigger manually
                
                # Return response matching frontend expectations
                return Response({
                    'recording_id': str(recording.id),
                    'storage_path': recording.storage_path,
                    'public_url': recording.public_url,
                    'status': 'complete',
                    'created_at': recording.created_at.isoformat(),
                }, status=status.HTTP_201_CREATED)
                
            except json.JSONDecodeError:
                return Response(
                    {'error': 'validation_error', 'message': 'Invalid JSON in recording_metadata'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except IntegrityError as e:
                logger.error("Database integrity error on combined upload: %s", e.__class__.__name__, exc_info=True)
                # Try to handle the duplicate by updating existing record
                try:
                    existing_combined = AudioRecording.objects.get(
                        user=user,
                        question_number=combined_question_number
                    )
                    # Delete old file and update
                    try:
                        delete_file_from_supabase(
                            bucket='recordings',
                            file_path=existing_combined.storage_path
                        )
                    except Exception:
                        pass  # Ignore delete errors
                    
                    existing_combined.storage_path = storage_path
                    existing_combined.public_url = public_url
                    existing_combined.file_size_bytes = audio_file.size
                    existing_combined.format = file_extension
                    existing_combined.duration_seconds = duration_seconds
                    existing_combined.upload_status = 'complete'
                    existing_combined.transcribed = False
                    existing_combined.save()
                    
                    return Response({
                        'recording_id': str(existing_combined.id),
                        'storage_path': existing_combined.storage_path,
                        'public_url': existing_combined.public_url,
                        'status': 'complete',
                        'created_at': existing_combined.created_at.isoformat(),
                    }, status=status.HTTP_200_OK)
                except AudioRecording.DoesNotExist:
                    return Response(
                        {
                            'error': 'database_error',
                            'message': 'Failed to save recording. Please try again.'
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            except Exception as e:
                logger.error("Combined upload error: %s", e.__class__.__name__, exc_info=True)
                return Response(
                    {'error': 'upload_failed', 'message': 'Failed to upload file. Please try again.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # OLD FORMAT: Individual question upload (backward compatibility)
            serializer = AudioRecordingUploadSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {
                        'error': 'validation_error',
                        'message': 'Invalid request data',
                        'details': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            audio_file = serializer.validated_data['audio_file']
            file_validation = validate_audio_file(audio_file)
            if not file_validation.allowed:
                return Response(file_validation.as_error(), status=status.HTTP_400_BAD_REQUEST)

            question_number = serializer.validated_data['question_number']
            question_text = serializer.validated_data['question_text']
            domain = serializer.validated_data['domain']
            duration_seconds = request.data.get('duration_seconds')
            if duration_seconds:
                try:
                    duration_seconds = float(duration_seconds)
                except (ValueError, TypeError):
                    duration_seconds = None
            
            # Check if question number already exists for this user
            if AudioRecording.objects.filter(user=user, question_number=question_number).exists():
                return Response(
                    {
                        'error': 'duplicate_question',
                        'message': f'Question {question_number} already exists for this user'
                    },
                    status=status.HTTP_409_CONFLICT
                )
            
            limit_check = can_upload_recording(
                user,
                file_size_bytes=audio_file.size,
                duration_seconds=duration_seconds,
                question_number=question_number,
            )
            if not limit_check.allowed:
                return Response(limit_check.as_error(), status=status.HTTP_402_PAYMENT_REQUIRED)
            
            try:
                # Determine file format
                file_extension = audio_file.name.split('.')[-1].lower()
                
                # Generate unique filename
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                storage_path = f"{user.id}/question_{question_number}_{timestamp}.{file_extension}"
                
                # Upload to Supabase Storage
                logger.info("Uploading question recording for user %s", user.id)
                public_url = upload_file_to_supabase(
                    bucket='recordings',
                    file_path=storage_path,
                    file_object=audio_file
                )
                
                if not public_url:
                    raise Exception("Failed to get public URL from Supabase")
                
                # Create database record
                recording = AudioRecording.objects.create(
                    user=user,
                    storage_path=storage_path,
                    public_url=public_url,
                    file_size_bytes=audio_file.size,
                    format=file_extension,
                    question_number=question_number,
                    question_text=question_text,
                    domain=domain,
                    duration_seconds=duration_seconds,
                    upload_status='complete'
                )
                record_recording_usage(
                    user,
                    action='recording_upload',
                    target_id=str(recording.id),
                    metadata={
                        'question_number': question_number,
                        'duration_seconds': duration_seconds,
                        'file_size_bytes': audio_file.size,
                    },
                )
                
                logger.info(f"Recording created successfully: {recording.id}")
                
                # Serialize and return
                response_serializer = AudioRecordingSerializer(recording)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
                
            except IntegrityError as e:
                logger.error("Database integrity error: %s", e.__class__.__name__)
                return Response(
                    {
                        'error': 'database_error',
                        'message': 'Failed to save recording metadata'
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                logger.error("Upload error: %s", e.__class__.__name__)
                return Response(
                    {
                        'error': 'upload_failed',
                        'message': 'Failed to upload file. Please try again.'
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class AudioRecordingListView(APIView):
    """
    GET /api/recordings/
    List all recordings for authenticated user.
    """
    
    def get(self, request):
        # Check authentication
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = User.objects.get(id=request.supabase_user.id)
        except User.DoesNotExist:
            return Response(
                {
                    'count': 0,
                    'total_duration_seconds': 0,
                    'recordings': []
                },
                status=status.HTTP_200_OK
            )
        
        # Get query parameters for filtering
        domain = request.query_params.get('domain', None)
        transcribed = request.query_params.get('transcribed', None)
        
        # Build query
        queryset = AudioRecording.objects.filter(user=user)
        
        if domain:
            queryset = queryset.filter(domain=domain)
        
        if transcribed is not None:
            transcribed_bool = transcribed.lower() == 'true'
            queryset = queryset.filter(transcribed=transcribed_bool)
        
        # Order by question number
        queryset = queryset.order_by('question_number')
        
        # Calculate totals
        recordings = list(queryset)
        total_duration = sum(
            r.duration_seconds for r in recordings if r.duration_seconds
        ) or 0
        
        # Serialize
        serializer = AudioRecordingSerializer(recordings, many=True)
        
        return Response(
            {
                'count': len(recordings),
                'total_duration_seconds': total_duration,
                'recordings': serializer.data
            },
            status=status.HTTP_200_OK
        )


class AudioRecordingDeleteView(APIView):
    """
    DELETE /api/recordings/{recording_id}/
    Delete a recording.
    """
    
    def delete(self, request, recording_id):
        # Check authentication
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = User.objects.get(id=request.supabase_user.id)
        except User.DoesNotExist:
            return Response(
                {'error': 'not_found', 'message': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get recording
        recording = get_object_or_404(AudioRecording, id=recording_id)
        
        # Check ownership
        if recording.user.id != user.id:
            return Response(
                {'error': 'permission_denied', 'message': 'You do not own this recording'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Delete from Supabase Storage
            logger.info("Deleting recording %s", recording_id)
            delete_success = delete_file_from_supabase(
                bucket='recordings',
                file_path=recording.storage_path
            )
            
            if not delete_success:
                logger.warning("Failed to delete file from storage for recording %s", recording_id)
            
            # Delete database record
            deleted_metadata = {
                'question_number': recording.question_number,
                'duration_seconds': recording.duration_seconds,
                'file_size_bytes': recording.file_size_bytes,
            }
            recording.delete()
            record_recording_usage(
                user,
                action='recording_delete',
                target_id=str(recording_id),
                metadata=deleted_metadata,
            )
            
            logger.info(f"Recording deleted successfully: {recording_id}")
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            logger.error("Delete error: %s", e.__class__.__name__)
            return Response(
                {
                    'error': 'delete_failed',
                    'message': 'Failed to delete recording. Please try again.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
