"""
URL routing for recordings app.
"""
from django.urls import path, include
from .views import (
    AudioRecordingUploadView,
    AudioRecordingListView,
    AudioRecordingDeleteView,
)

urlpatterns = [
    path('upload/', AudioRecordingUploadView.as_view(), name='recording-upload'),
    path('', AudioRecordingListView.as_view(), name='recording-list'),
    path('<uuid:recording_id>/', AudioRecordingDeleteView.as_view(), name='recording-delete'),
    # Questions endpoints
    path('questions/', include('apps.recordings.urls_questions')),
]

