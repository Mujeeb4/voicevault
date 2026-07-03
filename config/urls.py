"""
URL configuration for VoiceVault project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/recordings/', include('apps.recordings.urls')),
    path('api/chat/', include('apps.chat.urls')),
    path('api/family/', include('apps.users.urls_family')),
    path('api/admin/', include('apps.admin_dashboard.urls')),
    path('api/admin/', include('apps.ai_processing.urls')),
    path('api/payments/', include('apps.payments.urls')),
]

# Serve media files in development, and in single-container local-storage deployments.
if settings.DEBUG or getattr(settings, 'STORAGE_BACKEND', '') == 'local':
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
