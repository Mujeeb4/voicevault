"""Short-lived playback URLs for private local recordings in production."""
from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .models import AudioRecording
from utils.supabase_client import _local_storage_path


TOKEN_SALT = 'voicevault.recordings.audio'
TOKEN_MAX_AGE = 2 * 60 * 60


def recording_playback_url(recording):
    if settings.STORAGE_BACKEND != 'local':
        return recording.public_url
    token = signing.dumps(
        {'recording_id': str(recording.id), 'user_id': str(recording.user_id)},
        salt=TOKEN_SALT,
    )
    return f'/api/recordings/{recording.id}/audio/?token={token}'


@require_http_methods(['GET'])
def stream_recording_audio(request, recording_id):
    if settings.STORAGE_BACKEND != 'local':
        raise Http404('Recording not found')
    try:
        payload = signing.loads(request.GET.get('token', ''), salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
    except signing.BadSignature:
        return JsonResponse({'error': 'Invalid or expired recording link'}, status=401)
    if payload.get('recording_id') != str(recording_id):
        return JsonResponse({'error': 'Invalid recording link'}, status=403)
    recording = get_object_or_404(AudioRecording, id=recording_id, upload_status='complete')
    if payload.get('user_id') != str(recording.user_id):
        return JsonResponse({'error': 'Invalid recording link'}, status=403)
    try:
        path = _local_storage_path('recordings', recording.storage_path)
    except ValueError:
        raise Http404('Recording not found')
    types = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'webm': 'audio/webm'}
    if not path.is_file() or recording.format not in types:
        raise Http404('Recording not found')
    response = FileResponse(
        path.open('rb'), content_type=types[recording.format],
        filename=f'voicevault_recording_{recording.id}.{recording.format}',
    )
    response['Cache-Control'] = 'private, max-age=300'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
