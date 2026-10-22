"""Replicate Qwen3-TTS Base voice cloning with a saved, matching audio/text reference."""
import base64
import binascii
import hashlib
import hmac
import io
import logging
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from utils.supabase_client import download_file_from_supabase, download_file_stream_to_temp, upload_file_to_supabase

logger = logging.getLogger(__name__)
API = 'https://api.replicate.com/v1'


def prepare_reference(user):
    """Clip one of the user's recordings and transcribe that exact clip."""
    from apps.recordings.models import AudioRecording
    from apps.ai_processing.models import AIConfiguration
    recordings = AudioRecording.objects.filter(user=user, upload_status='complete', duration_seconds__gte=3)
    recording = sorted(recordings, key=lambda item: (item.quality_score or 0, item.duration_seconds or 0), reverse=True)
    if not recording:
        raise ValueError('Record at least three seconds of clear speech before cloning.')
    recording = recording[0]
    if not settings.OPENAI_API_KEY:
        raise ValueError('OpenAI transcription key is required to prepare the matching reference text.')
    with tempfile.TemporaryDirectory(prefix='voicevault-reference-') as directory:
        source = str(Path(directory) / f'source.{recording.format}')
        reference = str(Path(directory) / 'reference.wav')
        if not download_file_stream_to_temp('recordings', recording.storage_path, source):
            raise ValueError('Could not read the voice recording from storage.')
        process = subprocess.run(
            ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', source, '-t', '20',
             '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', reference],
            capture_output=True, timeout=90, check=False,
        )
        if process.returncode or not Path(reference).exists() or Path(reference).stat().st_size < 10000:
            raise ValueError('The voice recording could not be converted to a usable reference clip.')
        from openai import OpenAI
        with open(reference, 'rb') as audio:
            transcript = OpenAI(api_key=settings.OPENAI_API_KEY).audio.transcriptions.create(
                model='whisper-1', file=audio
            ).text.strip()
        if len(transcript.split()) < 3:
            raise ValueError('The reference clip contains too little recognizable speech.')
        audio_bytes = Path(reference).read_bytes()
    digest = hashlib.sha256(audio_bytes + transcript.encode()).hexdigest()[:24]
    path = f'{user.id}/voice-reference-{digest}.wav'
    if not upload_file_to_supabase('recordings', path, io.BytesIO(audio_bytes)):
        raise ValueError('Could not store the voice reference clip.')
    config, _ = AIConfiguration.objects.get_or_create(
        user=user, defaults={'system_prompt': 'Temporary prompt - will be updated by personality analysis'}
    )
    config.voice_provider = 'replicate'
    config.voice_reference_path = path
    config.voice_reference_text = transcript
    config.voice_clone_id = f'replicate:{digest}'
    config.voice_quality_score = None
    config.quality_approved = False
    config.save(update_fields=['voice_provider', 'voice_reference_path', 'voice_reference_text',
                               'voice_clone_id', 'voice_quality_score', 'quality_approved', 'updated_at'])
    return config


def _headers():
    if not settings.REPLICATE_API_TOKEN:
        raise ValueError('REPLICATE_API_TOKEN is missing.')
    return {'Authorization': f'Bearer {settings.REPLICATE_API_TOKEN}', 'Content-Type': 'application/json'}


def _prediction(prediction_id):
    with httpx.Client(timeout=25) as client:
        response = client.get(f'{API}/predictions/{prediction_id}', headers=_headers())
        response.raise_for_status()
        return response.json()


def _create_prediction(payload):
    payload['version'] = settings.REPLICATE_MODEL_VERSION
    with httpx.Client(timeout=45) as client:
        response = client.post(f'{API}/predictions', headers=_headers(), json=payload)
        response.raise_for_status()
        return response.json()


def _output_bytes(output):
    if isinstance(output, list) and len(output) == 1:
        output = output[0]
    if not isinstance(output, str):
        raise ValueError('Replicate returned no audio file.')
    parsed = urlparse(output)
    if parsed.scheme != 'https' or not (parsed.hostname == 'replicate.delivery' or
                                          (parsed.hostname or '').endswith('.replicate.delivery')):
        raise ValueError('Replicate returned an unexpected audio URL.')
    with httpx.Client(timeout=50, follow_redirects=False) as client:
        with client.stream('GET', output) as response:
            response.raise_for_status()
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > 25 * 1024 * 1024:
                    raise ValueError('Replicate audio exceeds the storage limit.')
    if len(content) < 1000:
        raise ValueError('Replicate returned an empty audio file.')
    if content[:4] == b'RIFF':
        return bytes(content), 'wav'
    if content[:3] == b'ID3' or content[:2] == b'\xff\xfb':
        return bytes(content), 'mp3'
    raise ValueError('Replicate returned an unsupported audio format.')


def refresh_prediction(conversation_id):
    """Complete a known prediction once; safe for a worker and signed webhook to race."""
    from apps.chat.models import Conversation
    from apps.ai_processing.models import APIUsageTracking
    from services.plan_limits import can_generate_voice_response, record_voice_response
    conversation = Conversation.objects.select_related('ai_owner__ai_config').get(id=conversation_id)
    if conversation.audio_url:
        return {'success': True, 'audio_url': conversation.audio_url}
    if not conversation.replicate_prediction_id:
        return {'success': False, 'pending': True}
    prediction = _prediction(conversation.replicate_prediction_id)
    state = prediction.get('status')
    if state in ('starting', 'processing'):
        return {'success': True, 'pending': True}
    if state != 'succeeded':
        Conversation.objects.filter(id=conversation_id, audio_url__isnull=True).update(
            replicate_audio_status='failed', replicate_audio_error='Replicate voice generation failed.'
        )
        return {'success': False, 'error': 'Replicate voice generation failed.'}
    if not conversation.ai_owner.ai_config.has_cloned_voice or not can_generate_voice_response(conversation.ai_owner).allowed:
        return {'success': False, 'error': 'Voice cloning is no longer available for this account.'}
    audio_bytes, extension = _output_bytes(prediction.get('output'))
    path = f'responses/{conversation.ai_owner_id}/replicate-{conversation.replicate_prediction_id}.{extension}'
    audio_url = upload_file_to_supabase('responses', path, io.BytesIO(audio_bytes))
    if not audio_url:
        raise ValueError('Could not store the generated voice audio.')
    with transaction.atomic():
        locked = Conversation.objects.select_for_update().get(id=conversation_id)
        if not locked.audio_url:
            locked.audio_url = audio_url
            locked.replicate_audio_status = 'complete'
            locked.replicate_audio_error = ''
            locked.save(update_fields=['audio_url', 'replicate_audio_status', 'replicate_audio_error'])
            record_voice_response(conversation.ai_owner, conversation_id)
            APIUsageTracking.objects.create(
                user=conversation.ai_owner, api_provider='replicate', operation='voice_generation',
                characters_used=len(conversation.response_text), request_id=conversation.replicate_prediction_id,
                cost_usd=None, success=True,
            )
        else:
            audio_url = locked.audio_url
    return {'success': True, 'audio_url': audio_url}


def generate_audio(response_text, voice_id, conversation_id, ai_owner_id):
    """Submit at most one paid prediction per conversation, then poll its result."""
    from apps.chat.models import Conversation
    from services.plan_limits import can_generate_voice_response
    with transaction.atomic():
        # Lock only the conversation row. Joining the optional reverse ai_config
        # relationship here creates a nullable outer join that PostgreSQL cannot lock.
        conversation = Conversation.objects.select_for_update().get(id=conversation_id)
        config = conversation.ai_owner.ai_config
        if str(conversation.ai_owner_id) != str(ai_owner_id) or not config.has_cloned_voice or \
                config.voice_provider != 'replicate' or config.voice_clone_id != voice_id:
            return {'success': False, 'error': 'A valid Replicate voice reference is required.'}
        limit = can_generate_voice_response(conversation.ai_owner)
        if not limit.allowed:
            return {'success': False, 'error': limit.message, 'upgrade_required': limit.upgrade_required}
        if conversation.audio_url:
            return {'success': True, 'audio_url': conversation.audio_url}
        if conversation.replicate_audio_status == 'failed':
            return {'success': False, 'error': conversation.replicate_audio_error}
        existing_id = conversation.replicate_prediction_id
        if not existing_id and conversation.replicate_audio_status == 'submitting':
            return {'success': True, 'pending': True}
        if not existing_id:
            conversation.replicate_audio_status = 'submitting'
            conversation.save(update_fields=['replicate_audio_status'])
            reference_path = config.voice_reference_path
            reference_text = config.voice_reference_text
    if not existing_id:
        try:
            reference = download_file_from_supabase('recordings', reference_path)
            if not reference or len(reference) > 1_000_000:
                raise ValueError('The saved voice reference is missing or too large.')
            payload = {'input': {
                'mode': 'voice_clone', 'text': response_text,
                'reference_audio': 'data:audio/wav;base64,' + base64.b64encode(reference).decode(),
                'reference_text': reference_text, 'language': settings.REPLICATE_LANGUAGE,
            }}
            if settings.REPLICATE_WEBHOOK_URL:
                payload['webhook'] = settings.REPLICATE_WEBHOOK_URL
                payload['webhook_events_filter'] = ['completed']
            prediction = _create_prediction(payload)
            existing_id = prediction['id']
            Conversation.objects.filter(id=conversation_id, replicate_prediction_id='').update(
                replicate_prediction_id=existing_id, replicate_audio_status='processing'
            )
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            logger.warning('Replicate submission failed for conversation %s: %s', conversation_id, exc.__class__.__name__)
            # An HTTP timeout can follow a successful paid submission. Never issue a second POST automatically.
            Conversation.objects.filter(id=conversation_id).update(
                replicate_audio_status='failed', replicate_audio_error='Replicate submission failed. Check the provider dashboard before retrying.'
            )
            return {'success': False, 'error': 'Replicate submission failed. Check the provider dashboard before retrying.'}
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            result = refresh_prediction(conversation_id)
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning('Replicate status check failed: %s', exc.__class__.__name__)
            return {'success': True, 'pending': True}
        if not result.get('pending'):
            return result
        time.sleep(2)
    return {'success': True, 'pending': True}


def verify_webhook(headers, body):
    """Verify Replicate's signed raw-body webhook and five-minute freshness window."""
    key = settings.REPLICATE_WEBHOOK_KEY
    if not key or not key.startswith('whsec_'):
        return False
    webhook_id = headers.get('webhook-id', '')
    timestamp = headers.get('webhook-timestamp', '')
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
        secret = base64.b64decode(key[6:])
        digest = base64.b64encode(hmac.new(secret,
            webhook_id.encode() + b'.' + timestamp.encode() + b'.' + body,
            hashlib.sha256).digest()).decode()
        return any(hmac.compare_digest(part.strip(), 'v1,' + digest)
                   for part in headers.get('webhook-signature', '').split(' '))
    except (ValueError, TypeError, binascii.Error):
        return False


def refresh_preview(queue_id):
    """Save a preview prediction exactly once and return its current status."""
    from apps.ai_processing.models import ProcessingQueue, APIUsageTracking
    queue = ProcessingQueue.objects.select_related('user').get(id=queue_id, task_type='voice_preview')
    if queue.status == 'complete':
        return {'status': 'complete'}
    if queue.status == 'failed':
        return {'status': 'failed', 'error': queue.error_message}
    prediction_id = (queue.result_data or {}).get('prediction_id')
    if not prediction_id:
        return {'status': 'processing'}
    prediction = _prediction(prediction_id)
    state = prediction.get('status')
    if state in ('starting', 'processing'):
        return {'status': 'processing'}
    if state != 'succeeded':
        ProcessingQueue.objects.filter(id=queue_id, status='processing').update(
            status='failed', error_message='Replicate voice preview failed.', completed_at=timezone.now()
        )
        return {'status': 'failed', 'error': 'Replicate voice preview failed.'}
    audio_bytes, extension = _output_bytes(prediction.get('output'))
    path = f'previews/{queue.user_id}/{queue.id}.{extension}'
    if not upload_file_to_supabase('responses', path, io.BytesIO(audio_bytes)):
        raise ValueError('Could not store the voice preview.')
    with transaction.atomic():
        locked = ProcessingQueue.objects.select_for_update().get(id=queue_id)
        if locked.status != 'complete':
            locked.status = 'complete'
            locked.completed_at = timezone.now()
            locked.result_data = {'prediction_id': prediction_id, 'audio_path': path, 'format': extension}
            locked.save(update_fields=['status', 'completed_at', 'result_data'])
            APIUsageTracking.objects.create(
                user=queue.user, api_provider='replicate', operation='voice_generation',
                characters_used=len(queue.task_data['text']), request_id=prediction_id,
                cost_usd=None, success=True,
            )
    return {'status': 'complete'}


def run_preview(queue_id):
    """Celery worker entry point; a queued preview gets at most one paid POST."""
    from apps.ai_processing.models import ProcessingQueue
    with transaction.atomic():
        # Fetch the configuration separately so FOR UPDATE does not lock a nullable join.
        queue = ProcessingQueue.objects.select_for_update().get(
            id=queue_id, task_type='voice_preview'
        )
        if queue.status != 'pending':
            return {'status': queue.status}
        config = queue.user.ai_config
        if not config.has_cloned_voice or config.voice_clone_id != queue.task_data.get('voice_id'):
            queue.status = 'failed'
            queue.error_message = 'The saved voice reference has changed. Start a new preview.'
            queue.save(update_fields=['status', 'error_message'])
            return {'status': 'failed', 'error': queue.error_message}
        queue.status = 'processing'
        queue.started_at = timezone.now()
        queue.save(update_fields=['status', 'started_at'])
        reference_path = config.voice_reference_path
        reference_text = config.voice_reference_text
        text = queue.task_data['text']
    try:
        reference = download_file_from_supabase('recordings', reference_path)
        if not reference or len(reference) > 1_000_000:
            raise ValueError('The saved voice reference is missing or too large.')
        payload = {'input': {
            'mode': 'voice_clone', 'text': text,
            'reference_audio': 'data:audio/wav;base64,' + base64.b64encode(reference).decode(),
            'reference_text': reference_text, 'language': settings.REPLICATE_LANGUAGE,
        }}
        if settings.REPLICATE_WEBHOOK_URL:
            payload['webhook'] = settings.REPLICATE_WEBHOOK_URL
            payload['webhook_events_filter'] = ['completed']
        prediction = _create_prediction(payload)
        ProcessingQueue.objects.filter(id=queue_id).update(result_data={'prediction_id': prediction['id']})
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning('Replicate preview submission failed: %s', exc.__class__.__name__)
        ProcessingQueue.objects.filter(id=queue_id).update(
            status='failed', error_message='Replicate preview submission failed. Check the provider dashboard before retrying.',
            completed_at=timezone.now(),
        )
        return {'status': 'failed'}
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            result = refresh_preview(queue_id)
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning('Replicate preview status check failed: %s', exc.__class__.__name__)
            return {'status': 'processing'}
        if result['status'] != 'processing':
            return result
        time.sleep(2)
    return {'status': 'processing'}
