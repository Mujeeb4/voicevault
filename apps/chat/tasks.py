"""
Celery tasks for chat system - Async audio generation.
Generates voice audio in background while user reads text.
Also provides synchronous fallback when Celery/Redis is unavailable.
"""
import logging
import time
from typing import Dict, Optional
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_audio_sync(
    response_text: str,
    voice_id: str,
    conversation_id: str,
    ai_owner_id: str
) -> Dict:
    """
    Generate audio SYNCHRONOUSLY - used as fallback when Celery/Redis is unavailable.
    This blocks the request but ensures users still get voice responses.
    
    Args:
        response_text: The text to convert to speech
        voice_id: ElevenLabs voice clone ID
        conversation_id: UUID of conversation to update
        ai_owner_id: UUID of AI owner (for storage path)
        
    Returns:
        Dict with audio_url and generation stats
    """
    from apps.chat.models import Conversation
    from apps.ai_processing.models import APIUsageTracking
    from utils.supabase_client import upload_file_to_supabase
    from apps.chat.utils import calculate_elevenlabs_turbo_cost
    from services.plan_limits import can_generate_voice_response, record_voice_response
    
    start_time = time.time()
    
    try:
        logger.info(f"[SYNC] Generating audio for conversation {conversation_id}")
        from apps.users.models import User
        ai_owner = User.objects.get(id=ai_owner_id)
        voice_limit = can_generate_voice_response(ai_owner)
        if not voice_limit.allowed:
            return {
                'success': False,
                'error': voice_limit.message,
                'upgrade_required': voice_limit.upgrade_required,
            }
        
        # Import ElevenLabs (lazy import to avoid startup issues)
        try:
            from elevenlabs import generate, set_api_key, Voice, VoiceSettings
        except ImportError:
            logger.error("ElevenLabs library not installed")
            return {
                'success': False,
                'error': 'ElevenLabs library not available'
            }
        
        # Check if ElevenLabs API key is configured
        from decouple import config
        api_key = config('ELEVENLABS_API_KEY', default='')
        if not api_key:
            logger.error("ElevenLabs API key not configured")
            return {
                'success': False,
                'error': 'ElevenLabs API key not configured'
            }
        
        # Set ElevenLabs API key
        set_api_key(api_key)
        
        # Generate audio with voice settings
        audio = generate(
            text=response_text,
            voice=Voice(
                voice_id=voice_id,
                settings=VoiceSettings(
                    stability=0.75,
                    similarity_boost=0.85
                )
            )
        )
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"[SYNC] Audio generated in {generation_time_ms}ms")
        
        # Upload to Supabase Storage
        timestamp = int(time.time())
        filename = f"responses/{ai_owner_id}/{timestamp}_{conversation_id}.mp3"
        
        # Convert audio to bytes if needed
        if hasattr(audio, 'read'):
            audio_bytes = audio.read()
        elif isinstance(audio, bytes):
            audio_bytes = audio
        else:
            # If it's a generator, consume it
            audio_bytes = b''.join(audio)
        
        # Create file-like object for upload
        import io
        audio_file = io.BytesIO(audio_bytes)
        
        # Upload to storage
        audio_url = upload_file_to_supabase(
            bucket='responses',
            file_path=filename,
            file_object=audio_file
        )
        
        upload_time_ms = int((time.time() - start_time) * 1000) - generation_time_ms
        total_time_ms = int((time.time() - start_time) * 1000)
        
        logger.info(f"[SYNC] Audio uploaded in {upload_time_ms}ms. Total: {total_time_ms}ms")
        
        # Update conversation with audio URL
        try:
            conversation = Conversation.objects.get(id=conversation_id)
            conversation.audio_url = audio_url
            conversation.elevenlabs_characters_used = len(response_text)
            conversation.save(update_fields=['audio_url', 'elevenlabs_characters_used'])
            record_voice_response(ai_owner, conversation_id)
        except Conversation.DoesNotExist:
            logger.error(f"Conversation {conversation_id} not found")
        
        # Track API usage
        character_count = len(response_text)
        cost = calculate_elevenlabs_turbo_cost(character_count)
        
        try:
            APIUsageTracking.objects.create(
                user_id=ai_owner_id,
                api_provider='elevenlabs',
                operation='voice_generation',
                characters_used=character_count,
                cost_usd=cost,
                response_time_ms=generation_time_ms,
                success=True
            )
        except Exception:
            pass
        
        return {
            'success': True,
            'audio_url': audio_url,
            'generation_time_ms': generation_time_ms,
            'upload_time_ms': upload_time_ms,
            'total_time_ms': total_time_ms,
            'characters_used': character_count,
            'cost_usd': float(cost),
            'sync': True
        }
        
    except Exception as e:
        logger.error("[SYNC] Audio generation failed: %s", e.__class__.__name__)
        
        return {
            'success': False,
            'error': 'Audio generation failed',
            'sync': True
        }


def is_celery_available() -> bool:
    """Check if Celery/Redis connection is available."""
    try:
        from config.celery import app
        # Try to ping Redis with a short timeout
        inspector = app.control.inspect(timeout=1.0)
        # If we can get ping response, Redis is available
        ping_result = inspector.ping()
        return ping_result is not None
    except Exception as e:
        logger.warning("Celery/Redis not available: %s", e.__class__.__name__)
        return False


@shared_task(bind=True, max_retries=3)
def generate_audio_async(
    self,
    response_text: str,
    voice_id: str,
    conversation_id: str,
    ai_owner_id: str
) -> Dict:
    """
    Generate audio for chat response in background (400-600ms with Turbo v2.5).
    This runs asynchronously while user reads the text response.
    
    Args:
        response_text: The text to convert to speech
        voice_id: ElevenLabs voice clone ID
        conversation_id: UUID of conversation to update
        ai_owner_id: UUID of AI owner (for storage path)
        
    Returns:
        Dict with audio_url and generation stats
    """
    from apps.chat.models import Conversation
    from apps.ai_processing.models import APIUsageTracking
    from utils.supabase_client import upload_file_to_supabase
    from apps.chat.utils import calculate_elevenlabs_turbo_cost
    from services.plan_limits import can_generate_voice_response, record_voice_response
    
    start_time = time.time()
    
    try:
        logger.info(f"Generating audio for conversation {conversation_id}")
        from apps.users.models import User
        ai_owner = User.objects.get(id=ai_owner_id)
        voice_limit = can_generate_voice_response(ai_owner)
        if not voice_limit.allowed:
            return {
                'success': False,
                'error': voice_limit.message,
                'upgrade_required': voice_limit.upgrade_required,
            }
        
        # Import ElevenLabs (lazy import to avoid startup issues)
        try:
            from elevenlabs import generate, set_api_key, Voice, VoiceSettings
        except ImportError:
            logger.error("ElevenLabs library not installed")
            return {
                'success': False,
                'error': 'ElevenLabs library not available'
            }
        
        # Check if ElevenLabs API key is configured
        from decouple import config
        api_key = config('ELEVENLABS_API_KEY', default='')
        if not api_key:
            logger.error("ElevenLabs API key not configured")
            return {
                'success': False,
                'error': 'ElevenLabs API key not configured'
            }
        
        # Set ElevenLabs API key
        set_api_key(api_key)
        
        # Generate audio with voice settings
        audio = generate(
            text=response_text,
            voice=Voice(
                voice_id=voice_id,
                settings=VoiceSettings(
                    stability=0.75,
                    similarity_boost=0.85
                )
            )
        )
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Audio generated in {generation_time_ms}ms")
        
        # Upload to Supabase Storage
        timestamp = int(time.time())
        filename = f"responses/{ai_owner_id}/{timestamp}_{conversation_id}.mp3"
        
        # Convert audio to bytes if needed
        if hasattr(audio, 'read'):
            audio_bytes = audio.read()
        elif isinstance(audio, bytes):
            audio_bytes = audio
        else:
            # If it's a generator, consume it
            audio_bytes = b''.join(audio)
        
        # Create file-like object for upload
        import io
        audio_file = io.BytesIO(audio_bytes)
        
        # Upload to storage
        audio_url = upload_file_to_supabase(
            bucket='responses',
            file_path=filename,
            file_object=audio_file
        )
        
        upload_time_ms = int((time.time() - start_time) * 1000) - generation_time_ms
        total_time_ms = int((time.time() - start_time) * 1000)
        
        logger.info(f"Audio uploaded in {upload_time_ms}ms. Total: {total_time_ms}ms")
        
        # Update conversation with audio URL
        try:
            conversation = Conversation.objects.get(id=conversation_id)
            conversation.audio_url = audio_url
            conversation.elevenlabs_characters_used = len(response_text)
            conversation.save(update_fields=['audio_url', 'elevenlabs_characters_used'])
            record_voice_response(ai_owner, conversation_id)
        except Conversation.DoesNotExist:
            logger.error(f"Conversation {conversation_id} not found")
        
        # Track API usage
        character_count = len(response_text)
        cost = calculate_elevenlabs_turbo_cost(character_count)
        
        APIUsageTracking.objects.create(
            user_id=ai_owner_id,
            api_provider='elevenlabs',
            operation='voice_generation',
            characters_used=character_count,
            cost_usd=cost,
            response_time_ms=generation_time_ms,
            success=True
        )
        
        return {
            'success': True,
            'audio_url': audio_url,
            'generation_time_ms': generation_time_ms,
            'upload_time_ms': upload_time_ms,
            'total_time_ms': total_time_ms,
            'characters_used': character_count,
            'cost_usd': float(cost)
        }
        
    except Exception as e:
        logger.error("Audio generation failed: %s", e.__class__.__name__)
        
        # Track failed API call
        try:
            APIUsageTracking.objects.create(
                user_id=ai_owner_id,
                api_provider='elevenlabs',
                operation='voice_generation',
                characters_used=0,
                cost_usd=0.0,
                success=False
            )
        except Exception:
            pass
        
        # Retry logic
        if self.request.retries < 3:
            # Exponential backoff: 5s, 10s, 20s
            countdown = 5 * (2 ** self.request.retries)
            logger.info(f"Retrying audio generation in {countdown}s (attempt {self.request.retries + 1}/3)")
            raise self.retry(exc=e, countdown=countdown)
        
        return {
            'success': False,
            'error': 'Audio generation failed',
            'retries': self.request.retries
        }


@shared_task
def cleanup_old_audio_files(days_old: int = 30):
    """
    Cleanup audio files older than specified days.
    Run this as a periodic task to save storage.
    
    Args:
        days_old: Delete files older than this many days
    """
    from datetime import timedelta
    from apps.chat.models import Conversation
    from utils.supabase_client import delete_file_from_supabase
    
    cutoff_date = timezone.now() - timedelta(days=days_old)
    
    # Find old conversations with audio
    old_conversations = Conversation.objects.filter(
        created_at__lt=cutoff_date,
        audio_url__isnull=False
    )
    
    deleted_count = 0
    error_count = 0
    
    for conversation in old_conversations:
        if not conversation.audio_url:
            continue
        
        try:
            # Extract file path from URL
            # Format: https://.../storage/v1/object/public/responses/path/to/file.mp3
            path_parts = conversation.audio_url.split('/responses/')
            if len(path_parts) > 1:
                file_path = path_parts[1]
                
                # Delete from Supabase
                delete_file_from_supabase(bucket='responses', file_path=file_path)
                
                # Clear audio URL from conversation
                conversation.audio_url = None
                conversation.save(update_fields=['audio_url'])
                
                deleted_count += 1
        except Exception as e:
            logger.error("Failed to delete audio for conversation %s: %s", conversation.id, e.__class__.__name__)
            error_count += 1
    
    logger.info(f"Cleanup complete: {deleted_count} deleted, {error_count} errors")
    
    return {
        'deleted': deleted_count,
        'errors': error_count,
        'cutoff_date': cutoff_date.isoformat()
    }
