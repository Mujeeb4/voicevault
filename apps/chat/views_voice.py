"""
Voice input transcription endpoint for chat.
Allows family members to send voice messages that are transcribed before being sent to AI.
"""
import logging
import tempfile
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import openai
from django.conf import settings

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
@api_view(['POST'])
@permission_classes([AllowAny])  # Auth handled by middleware
def transcribe_voice_input(request):
    """
    Transcribe voice input from family members.
    
    POST /api/chat/transcribe-voice/
    Body: multipart/form-data with 'audio' file
    
    Returns:
        {
            "transcript": "transcribed text",
            "success": true
        }
    """
    try:
        # Check authentication
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get audio file from request
        if 'audio' not in request.FILES:
            return Response(
                {'error': 'missing_audio', 'message': 'Audio file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        audio_file = request.FILES['audio']
        
        # Validate file size (max 25MB for Whisper)
        max_size = 25 * 1024 * 1024  # 25MB
        if audio_file.size > max_size:
            return Response(
                {'error': 'file_too_large', 'message': f'Audio file too large (max {max_size / 1024 / 1024}MB)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file type
        allowed_types = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
        if audio_file.content_type not in allowed_types:
            return Response(
                {'error': 'invalid_file_type', 'message': f'Invalid file type. Allowed: {", ".join(allowed_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{audio_file.name.split(".")[-1]}') as temp_file:
            for chunk in audio_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name
        
        try:
            # Initialize OpenAI client (without proxies for Python 3.14 compat)
            import httpx
            import openai
            http_client = httpx.Client(timeout=300.0)
            client = openai.OpenAI(
                api_key=settings.OPENAI_API_KEY,
                http_client=http_client
            )
            
            # Transcribe using Whisper
            logger.info(f"Transcribing voice input for user {request.supabase_user.id}")
            with open(temp_file_path, 'rb') as audio_data:
                transcript = client.audio.transcriptions.create(
                    model='whisper-1',
                    file=audio_data,
                    language='en',  # Can be made configurable
                )
            
            transcript_text = transcript.text.strip()
            
            if not transcript_text:
                return Response(
                    {'error': 'no_speech_detected', 'message': 'No speech detected in audio'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Voice input transcribed successfully: {len(transcript_text)} characters")
            
            return Response({
                'transcript': transcript_text,
                'success': True,
            }, status=status.HTTP_200_OK)
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error("Error transcribing voice input: %s", e.__class__.__name__, exc_info=True)
        return Response(
            {'error': 'transcription_failed', 'message': 'Failed to transcribe audio. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
