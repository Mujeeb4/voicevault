"""
URL routing for recordings app.
"""
from django.urls import path, include
from .audio import stream_recording_audio
from .views import (
    AudioRecordingUploadView,
    AudioRecordingListView,
    AudioRecordingDeleteView,
)

urlpatterns = [
    path('upload/', AudioRecordingUploadView.as_view(), name='recording-upload'),
    path('', AudioRecordingListView.as_view(), name='recording-list'),
    path('<uuid:recording_id>/audio/', stream_recording_audio, name='recording-audio'),
    path('<uuid:recording_id>/', AudioRecordingDeleteView.as_view(), name='recording-delete'),
    # Questions endpoints
    path('questions/', include('apps.recordings.urls_questions')),
]

