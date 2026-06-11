"""
AI processing models for personality analysis and voice cloning.
"""
import uuid
from django.db import models
from apps.users.models import User


class AIConfiguration(models.Model):
    """
    AI configuration and personality data for each user.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='ai_config'
    )
    
    # Voice cloning
    voice_clone_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    voice_quality_score = models.FloatField(null=True, blank=True, help_text="0.00 to 1.00")
    voice_similarity_target = models.FloatField(default=0.85)
    
    # AI configuration
    system_prompt = models.TextField(help_text="Complete system prompt for GPT-4")
    ai_model = models.CharField(max_length=50, default='gpt-4')
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=500)
    
    # Personality data (JSON structure)
    personality_data = models.JSONField(default=dict, help_text="Structured personality analysis")
    
    # Quality control
    quality_approved = models.BooleanField(default=False)
    admin_approved = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ai_configurations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['voice_clone_id']),
        ]
    
    def __str__(self):
        return f"AI Config for {self.user.email}"


class ProcessingQueue(models.Model):
    """
    Queue for tracking async AI processing tasks.
    """
    TASK_TYPE_CHOICES = [
        ('transcribe', 'Transcribe'),
        ('analyze_personality', 'Analyze Personality'),
        ('clone_voice', 'Clone Voice'),
        ('test_ai', 'Test AI'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('complete', 'Complete'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task_type = models.CharField(max_length=30, choices=TASK_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.IntegerField(default=5, help_text="1-10, higher is more important")
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Error handling
    error_message = models.TextField(null=True, blank=True)
    retry_count = models.IntegerField(default=0)
    
    # Task data
    task_data = models.JSONField(default=dict, help_text="Task-specific parameters")
    result_data = models.JSONField(null=True, blank=True, help_text="Task results")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'processing_queue'
        ordering = ['-priority', 'created_at']
        indexes = [
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['user']),
        ]
    
    def __str__(self):
        return f"{self.task_type} - {self.status} - {self.user.email}"


class APIUsageTracking(models.Model):
    """
    Track API usage and costs for OpenAI and ElevenLabs.
    """
    API_PROVIDER_CHOICES = [
        ('openai', 'OpenAI'),
        ('elevenlabs', 'ElevenLabs'),
    ]
    
    OPERATION_CHOICES = [
        ('transcribe', 'Transcribe'),
        ('chat', 'Chat'),
        ('voice_generation', 'Voice Generation'),
        ('personality_analysis', 'Personality Analysis'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    api_provider = models.CharField(max_length=20, choices=API_PROVIDER_CHOICES)
    operation = models.CharField(max_length=30, choices=OPERATION_CHOICES)
    
    # Usage metrics
    tokens_used = models.IntegerField(null=True, blank=True, help_text="For OpenAI")
    characters_used = models.IntegerField(null=True, blank=True, help_text="For ElevenLabs")
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0.0000)
    
    # Request details
    request_id = models.CharField(max_length=255, null=True, blank=True)
    response_time_ms = models.IntegerField(null=True, blank=True)
    success = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'api_usage_tracking'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['api_provider']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.api_provider} - {self.operation} - {self.created_at}"

