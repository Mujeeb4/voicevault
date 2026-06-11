"""
DRF Serializers for recordings app.
"""
from rest_framework import serializers
from .models import AudioRecording, Transcript, RecordingQuestion


class AudioRecordingSerializer(serializers.ModelSerializer):
    """Serializer for AudioRecording model."""
    
    class Meta:
        model = AudioRecording
        fields = [
            'id',
            'question_number',
            'question_text',
            'domain',
            'storage_path',
            'public_url',
            'file_size_bytes',
            'duration_seconds',
            'format',
            'quality_score',
            'background_noise',
            'upload_status',
            'transcribed',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'storage_path',
            'public_url',
            'file_size_bytes',
            'upload_status',
            'transcribed',
            'created_at',
        ]


class AudioRecordingUploadSerializer(serializers.Serializer):
    """Serializer for audio file upload."""
    
    audio_file = serializers.FileField(required=True)
    question_number = serializers.IntegerField(min_value=1, max_value=30, required=True)
    question_text = serializers.CharField(required=True)
    domain = serializers.ChoiceField(
        choices=['childhood', 'career', 'family', 'wisdom', 'challenges', 'personality'],
        required=True
    )
    
    def validate_audio_file(self, value):
        """Validate audio file format and size."""
        # Check file size (100MB max)
        max_size = 100 * 1024 * 1024  # 100MB in bytes
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File size exceeds maximum limit of 100MB. File size: {value.size / (1024*1024):.2f}MB"
            )
        
        # Check file extension
        allowed_extensions = ['webm', 'mp3', 'wav']
        file_name = value.name.lower()
        extension = file_name.split('.')[-1] if '.' in file_name else ''
        
        if extension not in allowed_extensions:
            raise serializers.ValidationError(
                f"Invalid file format. Allowed formats: {', '.join(allowed_extensions)}"
            )
        
        return value


class TranscriptSerializer(serializers.ModelSerializer):
    """Serializer for Transcript model."""
    
    class Meta:
        model = Transcript
        fields = [
            'id',
            'user',
            'full_transcript',
            'word_count',
            'childhood_section',
            'career_section',
            'relationships_section',
            'wisdom_section',
            'challenges_section',
            'personality_section',
            'transcription_service',
            'model_used',
            'confidence_score',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class RecordingQuestionSerializer(serializers.ModelSerializer):
    """Serializer for RecordingQuestion model."""
    
    class Meta:
        model = RecordingQuestion
        fields = [
            'id',
            'question_text',
            'domain',
            'order',
            'is_active',
            'tip',
            'suggested_duration_seconds',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

