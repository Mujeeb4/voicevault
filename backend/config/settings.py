"""
Django settings for VoiceVault project.
"""
import os
from pathlib import Path
from urllib.parse import urlparse
from django.core.exceptions import ImproperlyConfigured
from decouple import Config, RepositoryEmpty, RepositoryEnv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
# Resolve only this service's environment file, never a parent/frontend .env.
# Tests disable file loading before importing this module.
_env_path = BASE_DIR / '.env'
config = Config(
    RepositoryEnv(str(_env_path))
    if os.environ.get('VOICEVAULT_LOAD_ENV', 'true').lower() not in {'0', 'false'} and _env_path.is_file()
    else RepositoryEmpty()
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=False, cast=bool)

# SECURITY WARNING: keep the secret key used in production secret.
SECRET_KEY = config('SECRET_KEY', default='')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-dev-only-change-me'
    else:
        raise ImproperlyConfigured('SECRET_KEY must be set when DEBUG is False.')
if not DEBUG and SECRET_KEY.startswith('django-insecure'):
    raise ImproperlyConfigured('Use a strong SECRET_KEY when DEBUG is False.')

ALLOWED_HOSTS = [host.strip() for host in config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1',
).split(',') if host.strip()]
for internal_host in ('localhost', '127.0.0.1'):
    if internal_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(internal_host)

# Comma-separated list of emails allowed to use admin-only API endpoints.
ADMIN_EMAILS = config('ADMIN_EMAILS', default='')

# Proxy Configuration (Render)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=not DEBUG, cast=bool)
SECURE_REDIRECT_EXEMPT = [r'^api/health/$', r'^api/ready/$']
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=not DEBUG, cast=bool)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=not DEBUG, cast=bool)
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = config('SESSION_COOKIE_AGE', default=60 * 60 * 2, cast=int)
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
REFERRER_POLICY = 'same-origin'
if not DEBUG:
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True, cast=bool)
    SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=True, cast=bool)

# CSRF Settings (add your frontend URLs for production via env)
_csrf_origins = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000' if DEBUG else '',
)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins.split(',') if o.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party apps
    'rest_framework',
    'corsheaders',
    
    # Local apps
    'apps.users',
    'apps.recordings',
    'apps.ai_processing',
    'apps.chat',
    'apps.payments',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'utils.db_middleware.DatabaseConnectionMiddleware',  # CRITICAL: Close DB connections for Supabase free tier
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'utils.supabase_auth.SupabaseAuthMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database - Supabase PostgreSQL
import dj_database_url

# Try to use DATABASE_URL first, fall back to individual variables
DATABASE_URL = config('DATABASE_URL', default=None)


def _database_ssl_default(database_url: str) -> bool:
    """Require SSL by default except for local Docker/dev database hosts."""
    hostname = (urlparse(database_url).hostname or '').lower()
    return hostname not in {'localhost', '127.0.0.1', 'postgres', 'db'}

if DATABASE_URL:
    # Check if using Supabase Transaction Pooler (port 6543) or Session Pooler (port 5432)
    is_transaction_pooler = ':6543' in DATABASE_URL
    is_session_pooler = 'pooler.supabase.com' in DATABASE_URL
    
    # CRITICAL: For Supabase free tier, close connections immediately to avoid
    # hitting the max clients limit (13 connections on free tier)
    # conn_max_age=0 means Django closes the connection after each request
    DB_SSL_REQUIRE = config('DB_SSL_REQUIRE', default=_database_ssl_default(DATABASE_URL), cast=bool)

    db_config = dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=0,  # ALWAYS close connections immediately for Supabase free tier
        conn_health_checks=True,
        ssl_require=DB_SSL_REQUIRE,
    )
    
    # PostgreSQL-only stability options must never leak into SQLite test URLs.
    if db_config.get('ENGINE') == 'django.db.backends.postgresql':
        db_config.setdefault('OPTIONS', {})
        db_options = {
            'connect_timeout': 60,
            'keepalives': 1,
            'keepalives_idle': 30,
            'keepalives_interval': 10,
            'keepalives_count': 5,
            'options': '-c statement_timeout=60000',
        }
        if DB_SSL_REQUIRE:
            db_options['sslmode'] = 'require'
        db_config['OPTIONS'].update(db_options)

        if is_transaction_pooler:
            db_config['OPTIONS'].update({'options': '-c statement_timeout=60000'})
        # Transaction pooler requires prepared statements to be disabled
        # This is handled automatically by psycopg3 when using simple query mode
        
    DATABASES = {
        'default': db_config
    }
else:
    # Fall back to individual variables
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='postgres'),
            'USER': config('DB_USER', default='postgres'),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(config('MEDIA_ROOT', default=str(BASE_DIR / 'media')))

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ] + (['rest_framework.renderers.BrowsableAPIRenderer'] if DEBUG else []),
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
    'EXCEPTION_HANDLER': 'utils.exceptions.custom_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    
    # Throttling / Rate Limiting
    # Balanced for Supabase free tier while allowing normal frontend usage
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'utils.throttling.BurstRateThrottle',
        'utils.throttling.SustainedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Anonymous users (not logged in)
        'anon': '60/minute',
        
        # Authenticated users - burst allows quick page loads
        'burst': '30/second',      # Allow 30 requests per second for page loads
        'sustained': '300/minute', # But only 300 per minute sustained
        
        # Specific endpoint throttles
        'profile': '60/minute',    # Profile checks
        'auth': '10/minute',       # Login/signup/refresh - prevent brute force
        'chat': '30/minute',       # Chat messages
        'upload': '10/minute',     # File uploads
        'processing': '5/minute',  # AI processing triggers
    },
}

# CORS Settings
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=False, cast=bool)
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='http://localhost:3000,http://127.0.0.1:3000' if DEBUG else '',
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = not CORS_ALLOW_ALL_ORIGINS

# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 104857600  # 100MB in bytes
DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600  # 100MB in bytes

# Supabase Settings
STORAGE_BACKEND = config('STORAGE_BACKEND', default='supabase').lower()
LOCAL_STORAGE_PUBLIC_URL = config('LOCAL_STORAGE_PUBLIC_URL', default='http://localhost:8000').rstrip('/')
SUPABASE_URL = config('SUPABASE_URL', default='')
SUPABASE_KEY = config('SUPABASE_KEY', default='')
SUPABASE_SERVICE_KEY = config('SUPABASE_SERVICE_KEY', default='')
SUPABASE_STORAGE_BUCKET_RECORDINGS = config('SUPABASE_STORAGE_BUCKET_RECORDINGS', default='recordings')
SUPABASE_STORAGE_BUCKET_RESPONSES = config('SUPABASE_STORAGE_BUCKET_RESPONSES', default='responses')

# Celery Configuration
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes

# Connections are opened lazily. A deployment with configured Redis must report
# outages instead of silently splitting cache state across web/worker processes.
REDIS_URL = config('REDIS_URL', default='').strip()
if 'upstash.io' in REDIS_URL and REDIS_URL.startswith('redis://'):
    REDIS_URL = REDIS_URL.replace('redis://', 'rediss://', 1)

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'KEY_PREFIX': 'voicevault',
            'TIMEOUT': 604800,
            'OPTIONS': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
            },
        },
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'voicevault-local',
        },
    }

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=REDIS_URL or None)
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=REDIS_URL or None)
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=False, cast=bool)
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# Require certificate verification for every TLS Redis deployment.
import ssl
if (CELERY_BROKER_URL or '').startswith('rediss://'):
    CELERY_BROKER_USE_SSL = {'ssl_cert_reqs': ssl.CERT_REQUIRED}
if (CELERY_RESULT_BACKEND or '').startswith('rediss://'):
    CELERY_REDIS_BACKEND_USE_SSL = {'ssl_cert_reqs': ssl.CERT_REQUIRED}

# OpenAI Settings
OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
OPENAI_ANALYSIS_MODEL = config('OPENAI_ANALYSIS_MODEL', default='gpt-4.1-mini')
OPENAI_CHAT_MODEL = config('OPENAI_CHAT_MODEL', default='gpt-4o')

# Text chat can use QwenCloud while voice generation stays on Replicate.
CHAT_PROVIDER = config('CHAT_PROVIDER', default='openai').lower()
QWEN_API_KEY = config('QWEN_API_KEY', default='')
QWEN_CHAT_MODEL = config('QWEN_CHAT_MODEL', default='qwen3.8-flash')
QWEN_CHAT_BASE_URL = config(
    'QWEN_CHAT_BASE_URL',
    default='https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
)

# ElevenLabs Settings
ELEVENLABS_API_KEY = config('ELEVENLABS_API_KEY', default='')
ELEVENLABS_MODEL = config('ELEVENLABS_MODEL', default='eleven_v3')
REPLICATE_API_TOKEN = config('REPLICATE_API_TOKEN', default='')
REPLICATE_WEBHOOK_KEY = config('REPLICATE_WEBHOOK_KEY', default='')
REPLICATE_WEBHOOK_URL = config('REPLICATE_WEBHOOK_URL', default='')
REPLICATE_MODEL = 'qwen/qwen3-tts'
REPLICATE_MODEL_VERSION = config('REPLICATE_MODEL_VERSION', default='d490a561cf1171a8dc3d96d1e57efffea7dd34607148bb641f3d9de4e38c472e')
REPLICATE_LANGUAGE = 'auto'
VOICE_PROVIDER = config('VOICE_PROVIDER', default='replicate' if REPLICATE_API_TOKEN else 'elevenlabs').lower()

# Stripe Settings
STRIPE_MODE = config('STRIPE_MODE', default='test').lower()
if STRIPE_MODE not in ['test', 'live']:
    STRIPE_MODE = 'test'


def _first_non_empty_config(*names: str, default: str = '') -> str:
    """Return the first configured env value that is not an empty string."""
    for name in names:
        value = config(name, default='')
        if value:
            return value
    return default


if STRIPE_MODE == 'live':
    STRIPE_SECRET_KEY = _first_non_empty_config('STRIPE_LIVE_SECRET_KEY', 'STRIPE_SECRET_KEY')
    STRIPE_PUBLISHABLE_KEY = _first_non_empty_config('STRIPE_LIVE_PUBLISHABLE_KEY', 'STRIPE_PUBLISHABLE_KEY')
    STRIPE_WEBHOOK_SECRET = _first_non_empty_config('STRIPE_LIVE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET')
    STRIPE_PREMIUM_ONE_TIME_PRICE_ID = _first_non_empty_config(
        'STRIPE_LIVE_PREMIUM_ONE_TIME_PRICE_ID',
        'STRIPE_PREMIUM_ONE_TIME_PRICE_ID',
        'STRIPE_PREMIUM_PRICE_ID',
    )
else:
    STRIPE_SECRET_KEY = _first_non_empty_config('STRIPE_TEST_SECRET_KEY', 'STRIPE_SECRET_KEY')
    STRIPE_PUBLISHABLE_KEY = _first_non_empty_config('STRIPE_TEST_PUBLISHABLE_KEY', 'STRIPE_PUBLISHABLE_KEY')
    STRIPE_WEBHOOK_SECRET = _first_non_empty_config('STRIPE_TEST_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET')
    STRIPE_PREMIUM_ONE_TIME_PRICE_ID = _first_non_empty_config(
        'STRIPE_TEST_PREMIUM_ONE_TIME_PRICE_ID',
        'STRIPE_PREMIUM_ONE_TIME_PRICE_ID',
        'STRIPE_PREMIUM_PRICE_ID',
    )

STRIPE_PREMIUM_ONE_TIME_AMOUNT_CENTS = config('STRIPE_PREMIUM_ONE_TIME_AMOUNT_CENTS', default=14999, cast=int)
STRIPE_PREMIUM_CURRENCY = config('STRIPE_PREMIUM_CURRENCY', default='usd')

# Email Settings
# Use SMTP backend by default in production; console backend is only for local dev with DEBUG=True
_default_email_backend = (
    'django.core.mail.backends.console.EmailBackend' if DEBUG
    else 'django.core.mail.backends.smtp.EmailBackend'
)
EMAIL_BACKEND = config('EMAIL_BACKEND', default=_default_email_backend)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='VoiceVault <noreply@voicevault.com>')

# Frontend URL (for redirects)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000').rstrip('/')

# Stripe Price IDs (legacy names retained for compatibility)
STRIPE_LITE_PRICE_ID = config('STRIPE_LITE_PRICE_ID', default='')
STRIPE_PREMIUM_PRICE_ID = config('STRIPE_PREMIUM_PRICE_ID', default='')
STRIPE_FAMILY_PRICE_ID = config('STRIPE_FAMILY_PRICE_ID', default='')


# AI Processing Settings
AI_MIN_WORDS_FOR_PERSONALITY = 50  # Minimum words to extract personality
AI_VOICE_QUALITY_THRESHOLD = 0.85  # Minimum quality score to auto-approve
AI_PRODUCTION_MIN_WORDS = 500  # Minimum words for production-ready AI
AI_SYSTEM_PROMPT_MIN_LENGTH = 100  # Minimum length of generated system prompt


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'redact_sensitive': {
            '()': 'utils.security.SensitiveDataFilter',
        },
    },
    'formatters': {
        'standard': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'filters': ['redact_sensitive'],
            'formatter': 'standard',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': config('LOG_LEVEL', default='INFO'),
    },
}
