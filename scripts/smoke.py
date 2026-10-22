#!/usr/bin/env python3
"""Exercise the frontend and its Django API proxy using only Python's stdlib.

Run against a disposable stack with local storage and blank provider credentials:
    python3 scripts/smoke.py --url http://localhost:3000 --upload-draft

A unique account remains in the database after each run. The optional upload is
a non-final combined recording part: it never queues the AI processing pipeline.
Finalizing an upload is deliberately excluded because it invokes paid providers.
"""

import argparse
import io
import ipaddress
import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave


class SmokeFailure(Exception):
    """A failed assertion with a message safe to print."""


def require(condition, message):
    if not condition:
        raise SmokeFailure(message)


class NoRedirects(urllib.request.HTTPRedirectHandler):
    """Never follow redirects carrying credentials or hiding proxy failures."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, origin, timeout):
        self.origin = origin
        self.timeout = timeout
        self.token = None
        self.opener = urllib.request.build_opener(NoRedirects())

    def request(self, method, path, payload=None, *, authenticated=False,
                expected=200, content_type=None, raw=False):
        require(path.startswith('/') and not path.startswith('//'),
                'Requests must use a same-origin absolute path')
        label = f'{method} {urllib.parse.urlsplit(path).path}'
        headers = {'Accept': 'application/json'}
        if authenticated:
            require(bool(self.token), f'{label}: no access token available')
            headers['Authorization'] = f'Bearer {self.token}'
        if isinstance(payload, (dict, list)):
            payload = json.dumps(payload).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        elif content_type:
            headers['Content-Type'] = content_type
        request = urllib.request.Request(self.origin + path, data=payload,
                                         headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                status, body = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read()
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            # Exception strings may contain URLs or credentials. Print neither.
            raise SmokeFailure(f'{label}: transport failure ({type(error).__name__})') from None
        require(status == expected, f'{label}: expected HTTP {expected}, received {status}')
        if raw:
            return body
        if not body:
            return None
        try:
            return json.loads(body)
        except (ValueError, UnicodeError):
            raise SmokeFailure(f'{label}: response is not JSON') from None


def check_tokens(data, label):
    require(isinstance(data, dict), f'{label}: response must be an object')
    require(all(isinstance(data.get(key), str) and data[key]
                for key in ('access', 'refresh')), f'{label}: missing access/refresh tokens')


def check_questions(data):
    require(isinstance(data, dict) and isinstance(data.get('results'), list),
            'Questions response must contain a results array')
    require(isinstance(data.get('count'), int), 'Questions response must contain count')
    require(bool(data['results']), 'No guided questions found; seed the disposable stack first')
    for question in data['results']:
        require(all(key in question for key in ('id', 'question_text', 'order', 'domain')),
                'A question is missing required frontend fields')
        require(question.get('is_active') is True, 'Public questions included an inactive question')


def upload_draft(client, large=False):
    """Validate multipart storage and signed playback without finalizing/queuing AI."""
    duration = 400 if large else 1
    wav_data = io.BytesIO()
    with wave.open(wav_data, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\x00\x00' * 16000 * duration)
    audio_bytes = wav_data.getvalue()
    metadata = {
        'questions_answered': 1,
        'file_format': 'wav',
        'file_size_bytes': len(audio_bytes),
        'chunk_index': 1,
        'total_chunks': 2,
        'is_final_chunk': False,
        'total_duration_seconds': duration * 2,
    }
    boundary = 'voicevault-smoke-' + uuid.uuid4().hex
    chunks = []
    for name, value in [('duration_seconds', str(duration)),
                        ('recording_metadata', json.dumps(metadata))]:
        chunks.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
                       f'\r\n\r\n{value}\r\n').encode())
    chunks.append((f'--{boundary}\r\nContent-Disposition: form-data; name="audio_file"; '
                   'filename="smoke.wav"\r\nContent-Type: audio/wav\r\n\r\n').encode())
    chunks.extend([audio_bytes, f'\r\n--{boundary}--\r\n'.encode()])
    uploaded = client.request('POST', '/api/recordings/upload/', b''.join(chunks),
                              authenticated=True, expected=201,
                              content_type=f'multipart/form-data; boundary={boundary}')
    recording_id = uploaded.get('recording_id')
    require(bool(recording_id) and uploaded.get('status') == 'complete',
            'Draft upload did not return a completed storage record')
    try:
        profile = client.request('GET', '/api/users/profile/', authenticated=True)
        require(profile.get('recording_completed') is False,
                'Non-final upload unexpectedly finalized the recording')
        client.request('GET', f"/api/admin/process/status/{profile['id']}/", authenticated=True)
        profile = client.request('GET', '/api/users/profile/', authenticated=True)
        require(profile.get('recording_completed') is False,
                'Reading processing status prematurely finalized a draft recording')
        recordings = client.request('GET', '/api/recordings/', authenticated=True)
        matches = [item for item in recordings.get('recordings', [])
                   if item.get('id') == recording_id]
        require(len(matches) == 1, 'Uploaded draft was missing from recording list')
        playback_path = uploaded.get('public_url', '')
        require(playback_path.startswith('/api/recordings/'),
                'Draft playback is not a same-origin protected URL; use STORAGE_BACKEND=local')
        playback = client.request('GET', playback_path, raw=True)
        require(playback == audio_bytes, 'Protected WAV playback differs from uploaded bytes')
    finally:
        client.request('DELETE', f'/api/recordings/{recording_id}/',
                       authenticated=True, expected=204)
    recordings = client.request('GET', '/api/recordings/', authenticated=True)
    require(recordings.get('count') == 0, 'Draft deletion left a recording behind')
    print(f'PASS {len(audio_bytes):,}-byte non-final WAV upload, unchanged completion flag, protected playback, and deletion')


def run(args):
    parsed = urllib.parse.urlsplit(args.url)
    require(parsed.scheme in ('http', 'https') and bool(parsed.hostname),
            '--url must be an HTTP(S) origin')
    require(not parsed.username and not parsed.password and not parsed.query
            and not parsed.fragment and parsed.path in ('', '/'),
            '--url must be an origin without credentials, path, query, or fragment')
    try:
        is_local = parsed.hostname == 'localhost' or ipaddress.ip_address(parsed.hostname).is_loopback
    except ValueError:
        is_local = parsed.hostname == 'localhost'
    require(is_local or args.allow_remote,
            'Refusing a non-local URL. Use --allow-remote only for an authorized disposable stack.')
    require(args.timeout > 0, '--timeout must be positive')
    client = Client(args.url.rstrip('/'), args.timeout)
    print('WARNING: Use a disposable database, local storage, and blank provider credentials.')
    print('A unique test account will remain; no paid APIs or payment endpoints are exercised.')

    home = client.request('GET', '/', raw=True)
    require(b'<html' in home.lower(), 'Frontend root did not serve an HTML page')
    health = client.request('GET', '/api/health/')
    require(health.get('status') == 'ok', 'Liveness probe did not report ok')
    ready = client.request('GET', '/api/ready/')
    require(ready.get('status') == 'ok' and ready.get('checks', {}).get('database') == 'ok',
            'Readiness probe did not confirm database connectivity')
    check_questions(client.request('GET', '/api/recordings/questions/?is_active=true'))
    client.request('GET', '/api/users/profile/', expected=401)
    print('PASS frontend HTML, proxied liveness/readiness, public questions, and unauthenticated protection')

    email = f'smoke-{uuid.uuid4().hex}@example.com'
    credentials = {'email': email, 'password': secrets.token_urlsafe(32)}
    signed_up = client.request('POST', '/api/users/signup/',
                               {**credentials, 'full_name': 'Disposable Smoke Test'}, expected=201)
    check_tokens(signed_up.get('tokens'), 'Signup')
    user_id = signed_up.get('user', {}).get('id')
    require(bool(user_id), 'Signup did not return a user ID')
    logged_in = client.request('POST', '/api/users/login/', credentials)
    check_tokens(logged_in.get('tokens'), 'Login')
    require(logged_in.get('user', {}).get('id') == user_id,
            'Login returned a different account')
    client.token = logged_in['tokens']['access']
    profile = client.request('GET', '/api/users/profile/', authenticated=True)
    require(profile.get('id') == user_id and profile.get('email') == email,
            'Authenticated profile does not match the test account')
    require(profile.get('recording_completed') is False,
            'A new account unexpectedly has a completed recording')
    require(profile.get('is_admin') is False, 'A new account unexpectedly has admin privileges')
    check_questions(client.request('GET', '/api/recordings/questions/?is_active=true',
                                   authenticated=True))
    client.request('GET', '/api/admin/stats/', authenticated=True, expected=403)
    refreshed = client.request('POST', '/api/users/refresh/',
                               {'refresh': logged_in['tokens']['refresh']})
    check_tokens(refreshed, 'Refresh')
    client.token = refreshed['access']
    profile = client.request('GET', '/api/users/profile/', authenticated=True)
    require(profile.get('id') == user_id, 'Refreshed token did not authenticate the same account')
    client.request('POST', '/api/users/refresh/', {'refresh': refreshed['access']}, expected=401)
    print('PASS real signup, login, profile, token refresh, token-type rejection, and admin isolation')

    if args.upload_draft or args.large_upload:
        upload_draft(client, large=args.large_upload)
    else:
        print('SKIP recording storage check (enable with --upload-draft)')
    print('SKIP final upload/completion transition: finalization automatically queues AI providers')

    client.request('POST', '/api/users/logout/', {}, authenticated=True)
    client.token = None  # Logout is stateless: the browser discards its JWTs.
    client.request('GET', '/api/users/profile/', expected=401)
    client.token = 'invalid-smoke-token'
    client.request('GET', '/api/users/profile/', authenticated=True, expected=401)
    print('PASS signout, missing-token rejection, and invalid-token rejection')
    print('All smoke checks passed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--url', default='http://localhost:3000', help='Frontend origin')
    parser.add_argument('--allow-remote', action='store_true',
                        help='Explicitly permit a non-local disposable test environment')
    parser.add_argument('--upload-draft', action='store_true',
                        help='Upload/play/delete a non-final WAV part using local storage; never queue AI')
    parser.add_argument('--large-upload', action='store_true',
                        help='Exercise proxy body limits with a 12.8 MB non-final WAV draft')
    parser.add_argument('--timeout', type=float, default=30,
                        help='Timeout per HTTP request in seconds (default: 30)')
    args = parser.parse_args()
    try:
        run(args)
    except (SmokeFailure, ValueError, KeyError, TypeError, AttributeError) as error:
        # Assertion messages are controlled; unexpected response content is never printed.
        message = str(error) if isinstance(error, SmokeFailure) else type(error).__name__
        print(f'FAIL: {message}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('FAIL: interrupted', file=sys.stderr)
        return 130
    return 0


if __name__ == '__main__':
    sys.exit(main())
