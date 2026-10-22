from django.contrib import admin
from .models import AudioRecording, Transcript


@admin.register(AudioRecording)
class AudioRecordingAdmin(admin.ModelAdmin):
    list_display = ['user', 'question_number', 'domain', 'format', 'file_size_bytes', 'transcribed', 'upload_status', 'created_at']
    list_filter = ['domain', 'format', 'transcribed', 'upload_status', 'background_noise']
    search_fields = ['user__email', 'question_text']
    readonly_fields = ['id', 'created_at', 'storage_path', 'public_url']
    date_hierarchy = 'created_at'


@admin.register(Transcript)
class TranscriptAdmin(admin.ModelAdmin):
    list_display = ['user', 'word_count', 'transcription_service', 'confidence_score', 'created_at']
    list_filter = ['transcription_service', 'model_used']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at']

