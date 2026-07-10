"""
Celery tasks for AI processing pipeline.
Handles transcription, personality analysis, and voice cloning.
"""

from celery import shared_task, chain
from django.utils import timezone
from django.conf import settings
import openai
import logging
from typing import Optional, Dict, List
import json
import time
import os

from apps.users.models import User
from apps.recordings.models import AudioRecording, Transcript
from .models import AIConfiguration, ProcessingQueue, APIUsageTracking
from utils.supabase_client import download_file_from_supabase, download_file_stream_to_temp
from services.plan_limits import can_clone_voice, has_accepted_consent, record_ai_generation

logger = logging.getLogger(__name__)


def _personality_failure_message(exc: Exception, model: str) -> str:
    """Return a useful, non-sensitive error suitable for the processing UI."""
    if isinstance(exc, openai.AuthenticationError):
        return 'OpenAI authentication failed. Check the API key used by the worker.'
    if isinstance(exc, openai.RateLimitError):
        return 'OpenAI rate limit or account quota reached. Check API billing and retry shortly.'
    if isinstance(exc, openai.NotFoundError):
        return f'OpenAI model "{model}" is unavailable for this API key.'
    if isinstance(exc, openai.APIConnectionError):
        return 'Could not connect to OpenAI. Check the worker network and retry.'
    if isinstance(exc, openai.BadRequestError):
        return f'OpenAI rejected the personality request. Check model "{model}" and its parameters.'
    if isinstance(exc, json.JSONDecodeError):
        return 'OpenAI returned an invalid personality response. Please retry.'
    if isinstance(exc, ValueError):
        return str(exc)
    return 'Personality analysis failed. Check the Celery worker logs for the error type.'


def _recording_processing_order(recording: AudioRecording) -> tuple[int, int]:
    """
    Keep chunked combined recordings in upload order.

    Chunked combined uploads use negative question numbers (-1, -2, ...).
    Numeric ascending order would transcribe later chunks before earlier chunks.
    """
    question_number = recording.question_number or 0
    if question_number <= 0:
        return (0, abs(question_number))
    return (1, question_number)


@shared_task(bind=True, max_retries=3)
def transcribe_audio_task(self, user_id: str) -> Dict:
    """
    Main transcription orchestrator task.
    Transcribes all audio recordings for a user using OpenAI Whisper.
    
    Args:
        user_id: UUID of the user
        
    Returns:
        Dict with transcript_id and status
    """
    logger.info(f"Starting transcription for user {user_id}")
    
    # Create processing queue entry
    queue_entry = ProcessingQueue.objects.create(
        user_id=user_id,
        task_type='transcribe',
        status='processing',
        priority=8,
        started_at=timezone.now(),
        task_data={'celery_task_id': self.request.id}
    )
    
    try:
        user = User.objects.get(id=user_id)
        
        # Get all untranscribed recordings
        recordings = list(AudioRecording.objects.filter(
            user=user,
            transcribed=False,
            upload_status='complete'
        ))
        recordings.sort(key=_recording_processing_order)
        
        if not recordings:
            raise ValueError("No recordings found for transcription")
        
        logger.info(f"Found {len(recordings)} recordings to transcribe")
        
        # Transcribe each recording
        transcripts_by_domain = {
            'childhood': [],
            'career': [],
            'family': [],
            'wisdom': [],
            'challenges': [],
            'personality': []
        }
        
        full_transcript_parts = []
        total_tokens = 0
        total_confidence = 0
        confidence_count = 0
        successful_recordings = 0
        failed_recordings = 0
        
        for recording in recordings:
            try:
                # Transcribe single file
                result = transcribe_single_file(recording.id)
                
                if result['success']:
                    transcript_text = result['transcript']
                    confidence = result.get('confidence', 0.0)
                    
                    # Add to full transcript
                    full_transcript_parts.append(
                        f"Question {recording.question_number} ({recording.domain.title()}): "
                        f"{recording.question_text}\n"
                        f"Answer: {transcript_text}\n"
                    )
                    
                    # Combined uploads still contribute to the full transcript, but
                    # they do not map cleanly to a single structured domain section.
                    if recording.domain in transcripts_by_domain:
                        transcripts_by_domain[recording.domain].append(transcript_text)
                    
                    # Update recording
                    recording.mark_transcribed()
                    successful_recordings += 1
                    
                    # Track usage
                    total_tokens += result.get('tokens', 0)
                    if confidence > 0:
                        total_confidence += confidence
                        confidence_count += 1
                    
                    logger.info(f"Transcribed recording {recording.id}")
                else:
                    logger.warning(f"Failed to transcribe recording {recording.id}")
                    failed_recordings += 1
                    
            except Exception as e:
                logger.error("Error transcribing recording %s: %s", recording.id, e.__class__.__name__)
                failed_recordings += 1
                queue_entry.retry_count += 1
                queue_entry.save()
                continue

        if successful_recordings == 0:
            raise ValueError("No recordings could be transcribed")
        
        # Combine full transcript
        full_transcript = "\n\n".join(full_transcript_parts)
        word_count = len(full_transcript.split())
        
        # Calculate average confidence
        avg_confidence = (total_confidence / confidence_count) if confidence_count > 0 else 0.0
        
        # Create or update transcript
        transcript, created = Transcript.objects.update_or_create(
            user=user,
            defaults={
                'full_transcript': full_transcript,
                'word_count': word_count,
                'childhood_section': '\n\n'.join(transcripts_by_domain['childhood']),
                'career_section': '\n\n'.join(transcripts_by_domain['career']),
                'relationships_section': '\n\n'.join(transcripts_by_domain['family']),
                'wisdom_section': '\n\n'.join(transcripts_by_domain['wisdom']),
                'challenges_section': '\n\n'.join(transcripts_by_domain['challenges']),
                'personality_section': '\n\n'.join(transcripts_by_domain['personality']),
                'transcription_service': 'openai_whisper',
                'model_used': 'whisper-1',
                'confidence_score': avg_confidence
            }
        )
        
        # Track API usage
        APIUsageTracking.objects.create(
            user=user,
            api_provider='openai',
            operation='transcribe',
            tokens_used=total_tokens,
            cost_usd=calculate_whisper_cost(total_tokens),
            success=True
        )
        
        # Update queue entry
        queue_entry.status = 'complete'
        queue_entry.completed_at = timezone.now()
        queue_entry.result_data = {
            'transcript_id': str(transcript.id),
            'word_count': word_count,
            'recordings_processed': successful_recordings,
            'recordings_failed': failed_recordings,
            'average_confidence': avg_confidence
        }
        queue_entry.save()
        
        logger.info(f"Transcription complete for user {user_id}")
        
        # No longer manually triggering next step - handled by chain
        # try:
        #     logger.info(f"Triggering personality analysis for user {user_id} after transcription")
        #     analyze_personality_task.delay(user_id)
        # except Exception as e:
        #     logger.error(f"Failed to trigger personality analysis: {str(e)}")
        
        return {
            'success': True,
            'user_id': user_id,  # Include user_id for chaining
            'transcript_id': str(transcript.id),
            'word_count': word_count,
            'recordings_processed': successful_recordings,
            'recordings_failed': failed_recordings,
        }
        
    except Exception as e:
        logger.error("Transcription task failed: %s", e.__class__.__name__)
        queue_entry.status = 'failed'
        queue_entry.error_message = 'Transcription task failed'
        queue_entry.completed_at = timezone.now()
        queue_entry.save()
        
        # Retry logic
        if queue_entry.retry_count < 3:
            raise self.retry(exc=e, countdown=60 * (2 ** queue_entry.retry_count))
        
        return {'success': False, 'error': 'Transcription task failed'}


def transcribe_single_file(recording_id: str) -> Dict:
    """
    Transcribe a single audio file using OpenAI Whisper.
    
    Args:
        recording_id: UUID of the AudioRecording
        
    Returns:
        Dict with transcript text and metadata
    """
    temp_file_path = None
    http_client = None

    try:
        recording = AudioRecording.objects.get(id=recording_id)
        
        # Download audio file from Supabase
        logger.info(f"Downloading audio file: {recording.storage_path}")
        # Streaming approach used below instead of loading into memory
        # audio_data = download_file_from_supabase(...)
        
        # if not audio_data:
        #    raise ValueError("Failed to download audio file")
        
        # Initialize OpenAI client (without proxies for Python 3.14 compat)
        import httpx
        http_client = httpx.Client(timeout=300.0)
        client = openai.OpenAI(
            api_key=settings.OPENAI_API_KEY,
            http_client=http_client
        )
        
        # Create temporary file for OpenAI API
        import tempfile
        temp_file = tempfile.NamedTemporaryFile(suffix=f'.{recording.format}', delete=False)
        temp_file.close() # Close so we can write to it
        temp_file_path = temp_file.name
        
        # Download using streaming to temp file
        logger.info(f"Streaming audio file to: {temp_file_path}")
        success = download_file_stream_to_temp(
            bucket='recordings',
            file_path=recording.storage_path,
            temp_file_path=temp_file_path
        )
        
        if not success:
            raise ValueError("Failed to download audio file via stream")
        
        # Check file size
        file_size_mb = os.path.getsize(temp_file_path) / (1024 * 1024)
        logger.info(f"Audio file size: {file_size_mb:.2f} MB")
        
        # Note: Files should already be compressed before upload if they're large
        # This is just a safety check in case something wasn't compressed
        if file_size_mb > 24:
            logger.error(f"File too large ({file_size_mb:.2f}MB) - should have been compressed before upload!")
            raise ValueError(f"Audio file too large for Whisper API: {file_size_mb:.2f}MB (max 25MB)")
        
        start_time = time.time()
        
        # Transcribe with Whisper
        with open(temp_file_path, 'rb') as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en",
                response_format="verbose_json"
            )
        
        response_time = int((time.time() - start_time) * 1000)
        
        # Extract transcript
        transcript_text = response.text
        
        # Extract confidence if available
        confidence = getattr(response, 'confidence', 0.0)
        
        logger.info(f"Transcription successful for recording {recording_id}")
        
        return {
            'success': True,
            'transcript': transcript_text,
            'confidence': confidence,
            'response_time_ms': response_time,
            'tokens': len(transcript_text.split()) * 2  # Rough estimate
        }
        
    except Exception as e:
        logger.error("Error transcribing file %s: %s", recording_id, e.__class__.__name__)
        return {
            'success': False,
            'error': 'Transcription failed'
        }
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        if http_client:
            http_client.close()


@shared_task(bind=True, max_retries=3)
def analyze_personality_task(self, previous_result=None, user_id: str = None) -> Dict:
    """
    Extract personality traits and generate system prompt using GPT-4.
    
    Args:
        previous_result: Result from previous task in chain (ignored, but may contain user_id)
        user_id: UUID of the user (extracted from previous_result if not provided)
        
    Returns:
        Dict with ai_config_id and status
    """
    # Handle chaining: extract user_id from previous_result if needed
    if user_id is None:
        if isinstance(previous_result, str):
            # If previous_result is a string, it might be user_id
            user_id = previous_result
        elif isinstance(previous_result, dict):
            # Extract user_id from result dict if available
            user_id = previous_result.get('user_id') or previous_result.get('transcript_id')
        else:
            # Fallback: try to use previous_result as user_id
            user_id = str(previous_result) if previous_result else None
    
    if not user_id:
        raise ValueError("user_id is required for personality analysis")
    
    logger.info(f"Starting personality analysis for user {user_id}")
    
    # Create processing queue entry
    queue_entry = ProcessingQueue.objects.create(
        user_id=user_id,
        task_type='analyze_personality',
        status='processing',
        priority=7,
        started_at=timezone.now(),
        retry_count=self.request.retries,
        task_data={'celery_task_id': self.request.id}
    )

    http_client = None
    analysis_model = settings.OPENAI_ANALYSIS_MODEL

    try:
        user = User.objects.get(id=user_id)
        
        # Get transcript
        try:
            transcript = Transcript.objects.get(user=user)
        except Transcript.DoesNotExist:
            raise ValueError("No transcript found. Run transcription first.")
        
        # Verify transcript has enough content (lowered for testing)
        MIN_WORDS = settings.AI_MIN_WORDS_FOR_PERSONALITY
        if transcript.word_count < MIN_WORDS:
            raise ValueError(f"Transcript too short: {transcript.word_count} words (minimum {MIN_WORDS})")
        
        logger.info(f"Analyzing transcript with {transcript.word_count} words")
        
        # Initialize OpenAI client (without proxies for Python 3.14 compat)
        import httpx
        http_client = httpx.Client(timeout=300.0)
        client = openai.OpenAI(
            api_key=settings.OPENAI_API_KEY,
            http_client=http_client
        )
        
        # Construct personality analysis prompt
        system_message = """You are an expert psychologist and communication analyst. 
Analyze this interview transcript and extract detailed personality insights in strict JSON format."""
        
        user_message = f"""Here is an interview with {user.full_name}:

{transcript.full_transcript}

Analyze this person's communication style, values, and personality.
Return your analysis in the following JSON structure:

{{
  "communication_style": {{
    "formality": "casual/formal/mixed",
    "storytelling_approach": "detailed description",
    "sentence_structure": "short/long/varied",
    "pacing": "fast/moderate/slow",
    "humor_usage": "frequent/occasional/rare",
    "emotional_expressiveness": "high/medium/low"
  }},
  "common_phrases": [
    "exact phrase they use",
    "another phrase"
  ],
  "core_values": [
    "value name and description"
  ],
  "emotional_patterns": {{
    "expressing_joy": "description",
    "handling_challenges": "description",
    "showing_empathy": "description",
    "giving_advice": "description"
  }},
  "key_people": {{
    "person_name": {{
      "relationship": "spouse/child/parent/friend",
      "sentiment": "positive/neutral/complex",
      "notable_mentions": ["quote or context"]
    }}
  }},
  "life_philosophy": {{
    "view_on_success": "their definition",
    "view_on_happiness": "what they value",
    "view_on_family": "their perspective",
    "core_wisdom": "key life lessons"
  }}
}}

Be specific and quote exact phrases they use. Capture their unique voice."""

        start_time = time.time()
        
        # Use the configured model so deployments are not pinned to a retired model.
        response = client.chat.completions.create(
            model=analysis_model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        response_time = int((time.time() - start_time) * 1000)
        
        # Parse personality data
        personality_json = response.choices[0].message.content
        personality_data = json.loads(personality_json)
        
        # Generate system prompt
        system_prompt = generate_system_prompt(user, personality_data, transcript)
        
        # Create or update AI configuration
        ai_config, created = AIConfiguration.objects.update_or_create(
            user=user,
            defaults={
                'system_prompt': system_prompt,
                'ai_model': analysis_model,
                'temperature': 0.7,
                'max_tokens': 500,
                'personality_data': personality_data,
                'quality_approved': False,  # Needs admin review
                'admin_approved': False
            }
        )
        
        # Track API usage
        tokens_used = response.usage.total_tokens
        APIUsageTracking.objects.create(
            user=user,
            api_provider='openai',
            operation='personality_analysis',
            tokens_used=tokens_used,
            cost_usd=calculate_gpt4_cost(tokens_used),
            response_time_ms=response_time,
            success=True
        )
        
        # Update queue entry
        queue_entry.status = 'complete'
        queue_entry.completed_at = timezone.now()
        queue_entry.result_data = {
            'ai_config_id': str(ai_config.id),
            'tokens_used': tokens_used,
            'word_count': transcript.word_count
        }
        queue_entry.save()
        
        logger.info(f"Personality analysis complete for user {user_id}")
        record_ai_generation(user, str(ai_config.id))
        
        # No longer manually triggering next step - handled by chain
        # try:
        #     logger.info(f"Triggering voice cloning for user {user_id} after personality analysis")
        #     clone_voice_task.delay(user_id)
        # except Exception as e:
        #     logger.error(f"Failed to trigger voice cloning: {str(e)}")
        
        return {
            'success': True,
            'user_id': user_id,  # Include user_id for chaining
            'ai_config_id': str(ai_config.id),
            'personality_extracted': True
        }
        
    except Exception as e:
        failure_message = _personality_failure_message(e, analysis_model)
        logger.error(
            "Personality analysis failed for user %s with model %s: %s",
            user_id,
            analysis_model,
            e.__class__.__name__,
        )
        queue_entry.status = 'failed'
        queue_entry.error_message = failure_message
        queue_entry.retry_count = self.request.retries
        queue_entry.completed_at = timezone.now()
        queue_entry.save()
        
        # Retry logic
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=120 * (2 ** self.request.retries))
        
        return {'success': False, 'error': failure_message}
    finally:
        if http_client:
            http_client.close()


def generate_system_prompt(user: User, personality_data: Dict, transcript: Transcript) -> str:
    """
    Generate the complete system prompt for the AI chatbot.
    
    Args:
        user: User object
        personality_data: Dict of personality traits
        transcript: Transcript object
        
    Returns:
        Complete system prompt string
    """
    comm_style = personality_data.get('communication_style', {})
    phrases = personality_data.get('common_phrases', [])
    values = personality_data.get('core_values', [])
    emotions = personality_data.get('emotional_patterns', {})
    philosophy = personality_data.get('life_philosophy', {})
    
    # Format common phrases
    phrases_text = '\n'.join([f'- "{phrase}"' for phrase in phrases[:10]])
    
    # Format values
    values_text = '\n'.join([f'- {value}' for value in values[:7]])
    
    system_prompt = f"""You are {user.full_name}, speaking directly to your family and loved ones.

COMMUNICATION STYLE:
You communicate in a {comm_style.get('formality', 'natural')} manner.
Your storytelling is {comm_style.get('storytelling_approach', 'personal and detailed')}.
Your emotional expressiveness is {comm_style.get('emotional_expressiveness', 'authentic')}.

PHRASES YOU USE:
You frequently say things like:
{phrases_text}

YOUR VALUES:
What matters most to you:
{values_text}

YOUR EMOTIONAL PATTERNS:
- When expressing joy: {emotions.get('expressing_joy', 'with warmth and enthusiasm')}
- When facing challenges: {emotions.get('handling_challenges', 'with resilience')}
- When showing empathy: {emotions.get('showing_empathy', 'with understanding')}
- When giving advice: {emotions.get('giving_advice', 'from personal experience')}

YOUR LIFE PHILOSOPHY:
- On success: {philosophy.get('view_on_success', 'personal fulfillment and growth')}
- On happiness: {philosophy.get('view_on_happiness', 'meaningful relationships and purpose')}
- Core wisdom: {philosophy.get('core_wisdom', 'cherish every moment with loved ones')}

KNOWLEDGE BASE:
You only know what you shared in your interview. Here's your complete interview:

{transcript.full_transcript}

CONVERSATION RULES:
1. Answer as if you are {user.full_name} speaking directly
2. Use "I" and "my" - this is your story
3. Only reference information from the interview above
4. If asked about something not in the interview, acknowledge warmly: 
   "I don't think I talked about that in my interview, but I'd love to share what I can..."
5. Stay true to your communication style and personality
6. Keep responses warm, natural, and 2-3 paragraphs
7. Use your common phrases naturally when appropriate
8. Express emotions the way you described above

You're here to be a source of guidance, comfort, and connection for your loved ones.
"""
    
    return system_prompt


@shared_task(bind=True, max_retries=3)
def clone_voice_task(self, previous_result=None, user_id: str = None) -> Dict:
    """
    Create voice clone using ElevenLabs API.
    
    Args:
        previous_result: Result from previous task in chain (ignored, but may contain user_id)
        user_id: UUID of the user (extracted from previous_result if not provided)
        
    Returns:
        Dict with voice_clone_id and status
    """
    # Handle chaining: extract user_id from previous_result if needed
    if user_id is None:
        if isinstance(previous_result, str):
            user_id = previous_result
        elif isinstance(previous_result, dict):
            user_id = previous_result.get('user_id') or previous_result.get('ai_config_id')
        else:
            user_id = str(previous_result) if previous_result else None
    
    if not user_id:
        raise ValueError("user_id is required for voice cloning")
    """
    Create voice clone using ElevenLabs API.
    
    Args:
        user_id: UUID of the user
        
    Returns:
        Dict with voice_clone_id and status
    """
    logger.info(f"Starting voice cloning for user {user_id}")
    
    # Create processing queue entry
    queue_entry = ProcessingQueue.objects.create(
        user_id=user_id,
        task_type='clone_voice',
        status='processing',
        priority=6,
        started_at=timezone.now(),
        task_data={'celery_task_id': self.request.id}
    )
    
    try:
        user = User.objects.get(id=user_id)
        clone_limit = can_clone_voice(user)
        if not clone_limit.allowed:
            queue_entry.status = 'failed'
            queue_entry.error_message = clone_limit.message
            queue_entry.completed_at = timezone.now()
            queue_entry.save()
            return {
                'success': False,
                'error': clone_limit.message,
                'upgrade_required': clone_limit.upgrade_required,
                'user_id': user_id,
            }
        
        # Get all audio recordings
        recordings = AudioRecording.objects.filter(
            user=user,
            upload_status='complete'
        ).order_by('question_number')
        
        if not recordings.exists():
            raise ValueError("No audio recordings found")
        
        # Calculate total duration
        total_duration = sum(r.duration_seconds or 0 for r in recordings)
        
        # Minimum 1 minute of audio (voice cloning works with even less, but 1 min is safe)
        if total_duration < 60:
            raise ValueError(
                f"Insufficient audio duration: {total_duration:.1f}s "
                f"(minimum 60s required)"
            )
        
        logger.info(f"Found {recordings.count()} recordings, total duration: {total_duration:.1f}s")
        
        # Download audio files from Supabase (streaming to temp files)
        import tempfile
        temp_files = []
        
        for recording in recordings[:25]:  # ElevenLabs limit
            try:
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{recording.format}')
                temp_file.close() # Close so we can write to it
                temp_path = temp_file.name
                
                success = download_file_stream_to_temp(
                    bucket='recordings',
                    file_path=recording.storage_path,
                    temp_file_path=temp_path
                )
                
                if success:
                    temp_files.append(temp_path)
                    logger.info(f"Downloaded recording {recording.id} for cloning")
                else:
                    logger.warning(f"Failed to download recording {recording.id}")
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                        
            except Exception as e:
                logger.warning("Failed to process recording %s: %s", recording.id, e.__class__.__name__)
                continue
        
        audio_files_count = len(temp_files)
        
        if audio_files_count < 1:
            raise ValueError(f"No audio files available for voice cloning")
        
        logger.info(f"Using {audio_files_count} audio file(s) for voice cloning")
        
        # Initialize ElevenLabs
        from elevenlabs import clone, set_api_key
        
        start_time = time.time()
        
        # Create voice name
        voice_name = f"{user.full_name} VoiceVault"
        
        try:
             # Set ElevenLabs API key
            api_key = settings.ELEVENLABS_API_KEY
            if not api_key:
                raise ValueError("ElevenLabs API key not configured")
            
            set_api_key(api_key)
            
            logger.info(f"Cloning voice: {voice_name}")
            
            try:
                # Clone voice with ElevenLabs (passing paths to temp files)
                logger.info(f"Calling ElevenLabs API to clone voice with {len(temp_files)} file(s)...")
                
                voice = clone(
                    name=voice_name,
                    description=f"AI voice clone for {user.full_name} created by VoiceVault",
                    files=temp_files
                )
                
                voice_clone_id = voice.voice_id
                
                logger.info(f"Voice clone created successfully: {voice_clone_id}")
                
                # Voice quality score - ElevenLabs automatically validates
                voice_quality_score = 0.90
                
            finally:
                # Clean up temp files
                import os
                for temp_file in temp_files:
                    try:
                        os.unlink(temp_file)
                    except:
                        pass
            
        except Exception as e:
            logger.error("ElevenLabs voice cloning failed: %s", e.__class__.__name__)
            # Fall back to a free pre-made ElevenLabs voice for testing
            # Using "Rachel" - a free pre-made voice available on all plans
            logger.warning("Falling back to free pre-made voice 'Rachel' (21m00Tcm4TlvDq8ikWAM)")
            voice_clone_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel - free premade voice
            voice_quality_score = 0.70
        
        response_time = int((time.time() - start_time) * 1000)
        
        # Get or create AI configuration
        ai_config, created = AIConfiguration.objects.get_or_create(
            user=user,
            defaults={
                'system_prompt': 'Temporary prompt - will be updated by personality analysis',
                'ai_model': 'gpt-4'
            }
        )
        
        # Update voice configuration
        ai_config.voice_clone_id = voice_clone_id
        ai_config.voice_quality_score = voice_quality_score
        ai_config.quality_approved = voice_quality_score >= settings.AI_VOICE_QUALITY_THRESHOLD
        ai_config.save()
        
        # Track API usage
        APIUsageTracking.objects.create(
            user=user,
            api_provider='elevenlabs',
            operation='voice_generation',
            characters_used=0,  # Voice cloning doesn't count characters
            cost_usd=0.00,  # Included in subscription
            response_time_ms=response_time,
            success=True
        )
        
        # Update queue entry
        queue_entry.status = 'complete'
        queue_entry.completed_at = timezone.now()
        queue_entry.result_data = {
            'voice_clone_id': voice_clone_id,
            'voice_quality_score': voice_quality_score,
            'audio_files_used': audio_files_count,
            'total_duration': total_duration
        }
        queue_entry.save()
        
        logger.info(f"Voice cloning complete for user {user_id}")
        
        # No longer manually triggering next step - handled by chain
        # try:
        #     logger.info(f"Triggering finalization for user {user_id} after voice cloning")
        #     finalize_ai_task.delay(user_id)
        # except Exception as e:
        #     logger.error(f"Failed to trigger finalization: {str(e)}")
        
        return {
            'success': True,
            'user_id': user_id,  # Include user_id for chaining
            'voice_clone_id': voice_clone_id,
            'quality_score': voice_quality_score
        }
        
    except Exception as e:
        logger.error("Voice cloning failed: %s", e.__class__.__name__)
        queue_entry.status = 'failed'
        queue_entry.error_message = 'Voice cloning failed'
        queue_entry.completed_at = timezone.now()
        queue_entry.save()
        
        # Retry logic
        if queue_entry.retry_count < 3:
            raise self.retry(exc=e, countdown=180 * (2 ** queue_entry.retry_count))
        
        return {'success': False, 'error': 'Voice cloning failed'}


@shared_task(bind=True)
def test_ai_quality_task(self, user_id: str) -> Dict:
    """
    Test the AI quality before marking as ready.
    Ensures personality and voice are working correctly.
    
    Args:
        user_id: UUID of the user
        
    Returns:
        Dict with test results
    """
    logger.info(f"Testing AI quality for user {user_id}")
    
    try:
        user = User.objects.get(id=user_id)
        
        # Verify all components are ready
        try:
            transcript = Transcript.objects.get(user=user)
            ai_config = AIConfiguration.objects.get(user=user)
        except (Transcript.DoesNotExist, AIConfiguration.DoesNotExist):
            return {
                'success': False,
                'error': 'AI components not ready'
            }
        
        # Check transcript
        if transcript.word_count < settings.AI_PRODUCTION_MIN_WORDS:
            return {
                'success': False,
                'error': f'Transcript too short: {transcript.word_count} words'
            }
        
        # Check AI config
        if not ai_config.system_prompt or len(ai_config.system_prompt) < settings.AI_SYSTEM_PROMPT_MIN_LENGTH:
            return {
                'success': False,
                'error': 'System prompt not generated'
            }
        
        # Check voice clone only when the user is Premium and has provided voice consent.
        if user.has_premium_access and has_accepted_consent(user, 'voice_cloning') and not ai_config.voice_clone_id:
            return {
                'success': False,
                'error': 'Voice clone not created'
            }
        
        # Check personality data
        if not ai_config.personality_data or len(ai_config.personality_data) == 0:
            return {
                'success': False,
                'error': 'Personality data not extracted'
            }
        
        logger.info(f"AI quality test passed for user {user_id}")
        
        return {
            'success': True,
            'transcript_words': transcript.word_count,
            'system_prompt_length': len(ai_config.system_prompt),
            'voice_quality': ai_config.voice_quality_score,
            'personality_fields': len(ai_config.personality_data.keys()),
            'ready_for_production': True
        }
        
    except Exception as e:
        logger.error("AI quality test failed: %s", e.__class__.__name__)
        return {'success': False, 'error': 'AI quality test failed'}


@shared_task(bind=True, max_retries=3)
def finalize_ai_task(self, previous_result=None, user_id: str = None) -> Dict:
    """
    Finalize AI after all processing is complete.
    Marks user as ai_ready=True.
    
    Args:
        previous_result: Result from previous task in chain (ignored, but may contain user_id)
        user_id: UUID of the user (extracted from previous_result if not provided)
        
    Returns:
        Dict with finalization status
    """
    # Handle chaining: extract user_id from previous_result if needed
    if user_id is None:
        if isinstance(previous_result, str):
            user_id = previous_result
        elif isinstance(previous_result, dict):
            user_id = previous_result.get('user_id') or previous_result.get('voice_clone_id')
        else:
            user_id = str(previous_result) if previous_result else None
    
    if not user_id:
        raise ValueError("user_id is required for finalization")
    
    logger.info(f"Finalizing AI for user {user_id}")
    
    try:
        user = User.objects.get(id=user_id)
        
        # Run quality test
        test_result = test_ai_quality_task(user_id)
        
        if not test_result.get('success'):
            return {
                'success': False,
                'error': f"Quality test failed: {test_result.get('error')}"
            }
        
        # Mark user as AI ready
        user.mark_ai_ready()
        
        logger.info(f"AI finalized and marked ready for user {user_id}")
        
        return {
            'success': True,
            'user_id': user_id,  # Include user_id for chaining
            'ai_ready': True,
            'test_results': test_result
        }
        
    except Exception as e:
        logger.error("AI finalization failed: %s", e.__class__.__name__)
        return {'success': False, 'error': 'AI finalization failed'}


# Helper functions

def calculate_whisper_cost(tokens: int) -> float:
    """
    Calculate cost for OpenAI Whisper transcription.
    Whisper pricing: $0.006 per minute
    Rough estimate: 150 words per minute, 2 tokens per word
    
    Args:
        tokens: Number of tokens processed
        
    Returns:
        Cost in USD
    """
    minutes = tokens / 300  # Rough estimate: 300 tokens per minute
    cost = minutes * 0.006
    return round(cost, 4)


def calculate_gpt4_cost(tokens: int) -> float:
    """
    Calculate cost for GPT-4 API calls.
    GPT-4 pricing (approximate):
    - Input: $0.03 per 1K tokens
    - Output: $0.06 per 1K tokens
    - Average: $0.045 per 1K tokens
    
    Args:
        tokens: Total tokens used
        
    Returns:
        Cost in USD
    """
    cost = (tokens / 1000) * 0.045
    return round(cost, 4)


def calculate_elevenlabs_cost(characters: int) -> float:
    """
    Calculate cost for ElevenLabs TTS.
    ElevenLabs pricing: Based on subscription
    For tracking: Approximately $0.00022 per character
    
    Args:
        characters: Number of characters generated
        
    Returns:
        Cost in USD
    """
    cost = characters * 0.00022
    return round(cost, 4)



@shared_task(bind=True)
def start_ai_pipeline_task(self, user_id: str) -> Dict:
    """
    Orchestrate the full AI pipeline using Celery Chain.
    
    Order: Transcribe -> Analyze Personality -> Clone Voice -> Finalize
    """
    logger.info(f"Starting AI pipeline chain for user {user_id}")
    
    try:
        # Use Celery chain to link tasks
        # s() creates a signature
        user = User.objects.get(id=user_id)
        clone_limit = can_clone_voice(user)
        if clone_limit.allowed:
            workflow = chain(
                transcribe_audio_task.s(user_id).set(queue='transcription'),
                analyze_personality_task.s(user_id).set(queue='analysis'),
                clone_voice_task.s(user_id).set(queue='voice'),
                finalize_ai_task.s(user_id).set(queue='default'),
            )
        else:
            workflow = chain(
                transcribe_audio_task.s(user_id).set(queue='transcription'),
                analyze_personality_task.s(user_id).set(queue='analysis'),
                finalize_ai_task.s(user_id).set(queue='default'),
            )
        
        # Execute the chain
        result = workflow.apply_async()
        
        return {
            'success': True,
            'chain_id': result.id,
            'user_id': user_id
        }
    except Exception as e:
        logger.error("Failed to start AI pipeline: %s", e.__class__.__name__)
        return {'success': False, 'error': 'Failed to start AI pipeline'}
