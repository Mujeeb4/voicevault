"""
Chat and conversation models.
"""
import uuid
from django.db import models
from apps.users.models import User, FamilyMember


class Conversation(models.Model):
    """
    Model for storing chat conversations between family members and AI.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ai_owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='conversations'
    )
    family_member = models.ForeignKey(
        FamilyMember,
        on_delete=models.CASCADE
    )
    
    # Conversation content
    question_text = models.TextField()
    response_text = models.TextField()
    audio_url = models.URLField(max_length=1000, null=True, blank=True)
    
    # Performance metrics
    response_time_ms = models.IntegerField(help_text="Total response generation time")
    gpt_tokens_used = models.IntegerField(null=True, blank=True)
    elevenlabs_characters_used = models.IntegerField(null=True, blank=True)
    
    # Feedback
    user_rating = models.IntegerField(
        null=True,
        blank=True,
        help_text="1-5 star rating"
    )
    user_feedback = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'conversations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ai_owner', 'created_at']),
            models.Index(fields=['family_member']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Conversation with {self.ai_owner.email} at {self.created_at}"

