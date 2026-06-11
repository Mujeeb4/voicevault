"""
URL routing for AI processing admin endpoints.
"""
from django.urls import path
from .views import (
    TranscribeAudioView,
    AnalyzePersonalityView,
    CloneVoiceView,
    FinalizeAIView,
    ProcessingStatusView,
    RunFullPipelineView
)

urlpatterns = [
    path('process/transcribe/<uuid:user_id>/', TranscribeAudioView.as_view(), name='admin-transcribe'),
    path('process/personality/<uuid:user_id>/', AnalyzePersonalityView.as_view(), name='admin-personality'),
    path('process/voice-clone/<uuid:user_id>/', CloneVoiceView.as_view(), name='admin-voice-clone'),
    path('process/finalize/<uuid:user_id>/', FinalizeAIView.as_view(), name='admin-finalize'),
    path('process/status/<uuid:user_id>/', ProcessingStatusView.as_view(), name='admin-status'),
    path('process/full-pipeline/<uuid:user_id>/', RunFullPipelineView.as_view(), name='admin-full-pipeline'),
]

