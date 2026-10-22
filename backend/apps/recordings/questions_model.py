"""
Questions Model for VoiceVault
Stores the questions users answer during voice recording
"""
from django.db import models
import uuid


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

