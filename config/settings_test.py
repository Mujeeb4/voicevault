"""
Test settings for VoiceVault - uses SQLite instead of PostgreSQL for basic testing
"""
from .settings import *  # Import all settings from main settings

# Override database to use SQLite for testing
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'test_db.sqlite3',
    }
}

# Disable Supabase for basic testing
SUPABASE_URL = 'https://test-project.supabase.co'
SUPABASE_KEY = 'test-key'
SUPABASE_SERVICE_KEY = 'test-service-key'

# Use test API keys
OPENAI_API_KEY = 'sk-test-key'
ELEVENLABS_API_KEY = 'test-key'
STRIPE_SECRET_KEY = 'sk_test_key'
STRIPE_WEBHOOK_SECRET = 'whsec_test'

# Simplified middleware for testing (skip Supabase auth)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # 'utils.supabase_auth.SupabaseAuthMiddleware',  # Disabled for testing
]

# Disable Celery for basic tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Use local memory cache for testing (no Redis needed)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'test-cache',
        'KEY_PREFIX': 'voicevault_test',
        'TIMEOUT': 604800,
    }
}

print("✅ Using test settings with SQLite database")

