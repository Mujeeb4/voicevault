"""
URL routing for chat app - Streaming chat and conversation management.
"""
from django.urls import path
from apps.chat import views
from apps.chat import views_voice

app_name = 'chat'

urlpatterns = [
    # Streaming chat endpoint (CORE FEATURE) - Optimized for <1s response
    path('stream/', views.chat_streaming, name='chat_streaming'),
    
    # Voice input transcription
    path('transcribe-voice/', views_voice.transcribe_voice_input, name='transcribe_voice_input'),
    
    # Conversation history
    path('conversations/', views.get_conversation_history, name='conversation_history'),
    
    # Rate conversation
    path('conversations/<uuid:conversation_id>/rate/', views.rate_conversation, name='rate_conversation'),
    
    # Check audio generation status (for frontend polling)
    path('audio-status/<str:task_id>/', views.get_audio_status, name='audio_status'),
]

