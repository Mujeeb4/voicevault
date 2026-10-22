import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

from django.conf import settings
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings


class HealthProbeTests(TestCase):
    def test_liveness_does_not_open_database_connection(self):
        with patch('config.health.connection.cursor', side_effect=AssertionError('No DB expected')):
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_readiness_checks_database(self):
        response = self.client.get('/api/ready/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['database'], 'ok')

    def test_readiness_fails_without_database_and_hides_exception(self):
        with patch('config.health.connection.cursor', side_effect=OperationalError('private database details')):
            response = self.client.get('/api/ready/')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private database details', response.content.decode())

    @override_settings(REDIS_URL='redis://cache.invalid:6379/0')
    def test_readiness_fails_if_configured_redis_is_unavailable(self):
        with patch('config.health.cache.set', side_effect=ConnectionError('private redis details')):
            response = self.client.get('/api/ready/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['checks']['cache'], 'unavailable')

    @override_settings(REDIS_URL='redis://cache.invalid:6379/0')
    def test_readiness_cache_key_does_not_collide_between_probes(self):
        with patch('config.health.cache.set') as write, patch('config.health.cache.get', return_value='ok'), patch('config.health.cache.delete'):
            self.assertEqual(self.client.get('/api/ready/').status_code, 200)
            self.assertEqual(self.client.get('/api/ready/').status_code, 200)
        self.assertNotEqual(write.call_args_list[0].args[0], write.call_args_list[1].args[0])

    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_internal_health_probes_work_over_http(self):
        self.assertEqual(self.client.get('/api/health/').status_code, 200)
        self.assertEqual(self.client.get('/api/ready/').status_code, 200)

    def test_api_preflight_allows_configured_frontend(self):
        response = self.client.options('/api/users/profile/',
            HTTP_ORIGIN='http://localhost:3000',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Access-Control-Allow-Origin'], 'http://localhost:3000')


class StandaloneSettingsTests(SimpleTestCase):
    def test_production_settings_are_backend_only_and_make_no_network_calls(self):
        env = os.environ.copy()
        env.update({
            'VOICEVAULT_LOAD_ENV': 'false',
            'DJANGO_SETTINGS_MODULE': 'config.settings',
            'SECRET_KEY': 'a-unique-long-production-like-secret-for-settings-tests-19384',
            'DEBUG': 'false',
            'DATABASE_URL': 'postgresql://user:password@postgres:5432/voicevault',
            'REDIS_URL': 'rediss://cache.invalid:6379/0',
            'CELERY_BROKER_URL': 'rediss://cache.invalid:6379/0',
            'CELERY_RESULT_BACKEND': 'rediss://cache.invalid:6379/0',
            'ADMIN_EMAILS': '',
            'NEXT_PUBLIC_ADMIN_EMAILS': 'frontend-only@example.com',
        })
        env.pop('CORS_ALLOWED_ORIGINS', None)
        env.pop('CSRF_TRUSTED_ORIGINS', None)
        script = '''
import json, socket, ssl
def reject(*args, **kwargs):
    raise AssertionError('Settings must not access network')
socket.create_connection = reject
socket.socket.connect = reject
from config import settings
assert settings.CORS_ALLOWED_ORIGINS == []
assert settings.CSRF_TRUSTED_ORIGINS == []
assert settings.ADMIN_EMAILS == ''
assert settings.CACHES['default']['BACKEND'].endswith('RedisCache')
assert settings.CELERY_BROKER_USE_SSL['ssl_cert_reqs'] == ssl.CERT_REQUIRED
assert settings.DATABASES['default']['HOST'] == 'postgres'
assert (settings.BASE_DIR / 'manage.py').is_file()
assert (settings.BASE_DIR / 'apps').is_dir()
assert not (settings.BASE_DIR / 'frontend').exists()
print(json.dumps({'status': 'ok'}))
'''
        result = subprocess.run(
            [sys.executable, '-c', script], cwd=settings.BASE_DIR,
            env=env, capture_output=True, text=True, timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {'status': 'ok'})
