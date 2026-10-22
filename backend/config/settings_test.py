"""Hermetic test configuration. Never read deployment credentials or services."""
import os

# These overrides precede importing base settings: no .env parsing, cloud database,
# Redis startup connection, or real provider credentials can leak into tests.
os.environ['VOICEVAULT_LOAD_ENV'] = 'false'
for _name, _value in {
    'SECRET_KEY': 'test-only-secret-key-not-for-deployment',
    'DEBUG': 'true',
    'DATABASE_URL': 'sqlite:///:memory:',
    'REDIS_URL': '',
    'CELERY_BROKER_URL': 'memory://',
    'CELERY_RESULT_BACKEND': 'cache+memory://',
    'SUPABASE_URL': '',
    'SUPABASE_KEY': '',
    'SUPABASE_SERVICE_KEY': '',
    'OPENAI_API_KEY': 'sk-test-key',
    'QWEN_API_KEY': '',
    'ELEVENLABS_API_KEY': 'test-key',
    'REPLICATE_API_TOKEN': '',
    'STRIPE_MODE': 'test',
    'STRIPE_SECRET_KEY': 'sk_test_key',
    'STRIPE_TEST_SECRET_KEY': 'sk_test_key',
    'STRIPE_WEBHOOK_SECRET': 'whsec_test',
    'STRIPE_TEST_WEBHOOK_SECRET': 'whsec_test',
    'STORAGE_BACKEND': 'local',
    'CHAT_PROVIDER': 'openai',
    'VOICE_PROVIDER': 'elevenlabs',
    'SECURE_SSL_REDIRECT': 'false',
    'EMAIL_BACKEND': 'django.core.mail.backends.locmem.EmailBackend',
}.items():
    os.environ[_name] = _value

from .settings import *  # noqa: F403,E402

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
FRONTEND_URL = 'http://localhost:3000'
CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']
CORS_ALLOW_ALL_ORIGINS = False
# Most existing view tests attach their authenticated identity explicitly.
MIDDLEWARE = [item for item in MIDDLEWARE if item not in {  # noqa: F405
    'utils.supabase_auth.SupabaseAuthMiddleware',
    'utils.db_middleware.DatabaseConnectionMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
}]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
TEST_RUNNER = 'config.test_runner.OfflineTestRunner'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
