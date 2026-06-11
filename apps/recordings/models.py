"""
Audio recordings and transcripts models.
"""
import uuid
from django.db import models
from apps.users.models import User


class RecordingQuestion(models.Model):
    """
    Questions that users answer during voice recording session
    """
    DOMAIN_CHOICES = [
        ('childhood', 'Childhood'),
        ('family', 'Family'),
        ('career', 'Career'),
        ('wisdom', 'Wisdom'),
        ('challenges', 'Challenges'),
        ('personality', 'Personality'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Question details
    question_text = models.TextField(help_text="The question to ask the user")
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES)
    order = models.IntegerField(default=0, help_text="Display order (1-30)")
    
    # Metadata
    is_active = models.BooleanField(default=True, help_text="Is this question active?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Tips for the user
    tip = models.TextField(
        blank=True,
        null=True,
        help_text="Helpful tip for answering this question"
    )
    
    # Expected duration
    suggested_duration_seconds = models.IntegerField(
        default=60,
        help_text="Suggested answer duration in seconds"
    )
    
    class Meta:
        ordering = ['order']
        unique_together = ['domain', 'order']
        indexes = [
            models.Index(fields=['domain', 'order']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.order}. {self.question_text[:50]}..."
    
    @classmethod
    def get_active_questions(cls):
        """Get all active questions in order"""
        return cls.objects.filter(is_active=True).order_by('order')
    
    @classmethod
    def get_questions_by_domain(cls, domain):
        """Get active questions for a specific domain"""
        return cls.objects.filter(
            is_active=True,
            domain=domain
        ).order_by('order')


class AudioRecording(models.Model):
    """
    Model for storing audio recordings metadata.
    Actual audio files are stored in Supabase Storage.
    """
    FORMAT_CHOICES = [
        ('webm', 'WebM'),
        ('mp3', 'MP3'),
        ('wav', 'WAV'),
    ]
    
    DOMAIN_CHOICES = [
        ('childhood', 'Childhood'),
        ('career', 'Career'),
        ('family', 'Family'),
        ('wisdom', 'Wisdom'),
        ('challenges', 'Challenges'),
        ('personality', 'Personality'),
        ('combined', 'Combined'),  # For combined file uploads
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('uploading', 'Uploading'),
        ('complete', 'Complete'),
        ('failed', 'Failed'),
    ]
    
    NOISE_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='recordings'
    )
    
    # Storage information
    storage_path = models.CharField(max_length=500, unique=True)
    public_url = models.URLField(max_length=1000)
    file_size_bytes = models.BigIntegerField()
    duration_seconds = models.FloatField(null=True, blank=True)
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    
    # Question metadata
    question_number = models.IntegerField()
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES)
    question_text = models.TextField()
    
    # Quality metrics
    quality_score = models.FloatField(null=True, blank=True, help_text="0.00 to 1.00")
    background_noise = models.CharField(
        max_length=10,
        choices=NOISE_CHOICES,
        null=True,
        blank=True
    )
    
    # Status
    upload_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transcribed = models.BooleanField(default=False, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audio_recordings'
        ordering = ['question_number']
        unique_together = [['user', 'question_number']]
        indexes = [
            models.Index(fields=['user', 'question_number']),
            models.Index(fields=['user']),
            models.Index(fields=['transcribed']),
            models.Index(fields=['domain']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - Question #{self.question_number}"
    
    def mark_transcribed(self):
        """Mark this recording as transcribed."""
        self.transcribed = True
        self.save(update_fields=['transcribed'])
    
    def calculate_duration(self):
        """
        Extract duration from audio file metadata.
        This would require additional audio processing library.
        """
        # TODO: Implement using mutagen or similar library
        pass


class Transcript(models.Model):
    """
    Model for storing complete transcripts for a user.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='transcript'
    )
    
    # Full transcript
    full_transcript = models.TextField(help_text="Complete transcript of all recordings")
    word_count = models.IntegerField(default=0)
    
    # Segmented sections by domain
    childhood_section = models.TextField(null=True, blank=True)
    career_section = models.TextField(null=True, blank=True)
    relationships_section = models.TextField(null=True, blank=True)
    wisdom_section = models.TextField(null=True, blank=True)
    challenges_section = models.TextField(null=True, blank=True)
    personality_section = models.TextField(null=True, blank=True)
    
    # Metadata
    transcription_service = models.CharField(max_length=50, default='openai_whisper')
    model_used = models.CharField(max_length=50, default='whisper-1')
    confidence_score = models.FloatField(null=True, blank=True, help_text="0.00 to 1.00")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'transcripts'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Transcript for {self.user.email}"
    
    def get_section(self, domain):
        """
        Get transcript section by domain name.
        
        Args:
            domain: Domain name (childhood, career, etc.)
            
        Returns:
            str: Section text or empty string
        """
        section_map = {
            'childhood': self.childhood_section,
            'career': self.career_section,
            'family': self.relationships_section,
            'wisdom': self.wisdom_section,
            'challenges': self.challenges_section,
            'personality': self.personality_section,
        }
        return section_map.get(domain, '')

