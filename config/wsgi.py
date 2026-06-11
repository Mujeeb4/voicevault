"""
WSGI config for VoiceVault project.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Avoid leaking Gunicorn's exact version in the HTTP Server header.
try:
    import gunicorn.http.wsgi

    gunicorn.http.wsgi.SERVER = 'VoiceVault'
except Exception:
    pass

application = get_wsgi_application()
