"""
User and FamilyMembers models for VoiceVault.
"""
import uuid
from django.db import models
from django.utils import timezone


class User(models.Model):
    """
    Main user model for AI owners and family members.
    """
    PACKAGE_CHOICES = [
        ('free', 'Memory Starter'),
        ('premium', 'VoiceVault'),
    ]
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('premium', 'Premium'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    password_hash = models.CharField(max_length=255, null=True, blank=True, help_text="Hashed password")
    package_tier = models.CharField(max_length=20, choices=PACKAGE_CHOICES, default='free')
    plan_type = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free', db_index=True)
    is_premium = models.BooleanField(default=False, db_index=True)
    premium_purchased_at = models.DateTimeField(null=True, blank=True)
    lifetime_access = models.BooleanField(default=False)
    
    # Recording status
    recording_completed = models.BooleanField(default=False)
    recording_started_at = models.DateTimeField(null=True, blank=True)
    
    # AI processing status
    ai_ready = models.BooleanField(default=False, db_index=True)
    ai_processing_started_at = models.DateTimeField(null=True, blank=True)
    ai_processing_completed_at = models.DateTimeField(null=True, blank=True)
    
    # Payment information
    stripe_customer_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    stripe_payment_id = models.CharField(max_length=255, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    payment_completed = models.BooleanField(default=False)
    payment_amount = models.IntegerField(default=0, help_text="Amount in cents")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['stripe_customer_id']),
            models.Index(fields=['ai_ready']),
            models.Index(fields=['created_at']),
            models.Index(fields=['plan_type']),
            models.Index(fields=['is_premium']),
        ]
    
    def __str__(self):
        return self.email
    
    def mark_recording_complete(self):
        """Mark that user has completed recording all audio."""
        self.recording_completed = True
        if not self.recording_started_at:
            self.recording_started_at = timezone.now()
        self.save(update_fields=['recording_completed', 'recording_started_at'])
    
    def mark_ai_ready(self):
        """Mark that AI is fully processed and ready for chat."""
        self.ai_ready = True
        self.ai_processing_completed_at = timezone.now()
        self.save(update_fields=['ai_ready', 'ai_processing_completed_at'])

    def activate_premium(self, payment_intent_id=None, customer_id=None, amount_cents=None):
        """Grant lifetime Premium access for this vault."""
        self.plan_type = 'premium'
        self.package_tier = 'premium'
        self.is_premium = True
        self.lifetime_access = True
        self.payment_completed = True
        self.premium_purchased_at = timezone.now()
        if payment_intent_id:
            self.stripe_payment_id = payment_intent_id
            self.stripe_payment_intent_id = payment_intent_id
        if customer_id:
            self.stripe_customer_id = customer_id
        if amount_cents is not None:
            self.payment_amount = amount_cents
        self.save(update_fields=[
            'plan_type',
            'package_tier',
            'is_premium',
            'lifetime_access',
            'payment_completed',
            'premium_purchased_at',
            'stripe_payment_id',
            'stripe_payment_intent_id',
            'stripe_customer_id',
            'payment_amount',
        ])

    @property
    def has_premium_access(self):
        """Compatibility helper while old code still checks payment_completed."""
        return self.is_premium or self.plan_type == 'premium' or self.lifetime_access or self.payment_completed


class UsageQuota(models.Model):
    """Per-vault usage counters for freemium and fair-use enforcement."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='usage_quota')

    recording_minutes_used = models.FloatField(default=0)
    recording_storage_used_mb = models.FloatField(default=0)

    text_messages_used_this_month = models.IntegerField(default=0)
    voice_responses_used_this_month = models.IntegerField(default=0)

    family_invites_used = models.IntegerField(default=0)
    ai_generations_used = models.IntegerField(default=0)

    quota_reset_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'usage_quotas'
        indexes = [
            models.Index(fields=['quota_reset_date']),
        ]

    def __str__(self):
        return f"Usage quota for {self.user.email}"


class ConsentRecord(models.Model):
    """Stores explicit user consent for sensitive AI and voice actions."""
    CONSENT_TYPES = [
        ('voice_cloning', 'Voice Cloning'),
        ('ai_personality_generation', 'AI Personality Generation'),
        ('family_access', 'Family Access'),
        ('terms_of_service', 'Terms of Service'),
        ('privacy_policy', 'Privacy Policy'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consent_records')
    consent_type = models.CharField(max_length=100, choices=CONSENT_TYPES)
    accepted = models.BooleanField(default=False)
    accepted_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    consent_version = models.CharField(max_length=50, default='2026-05')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consent_records'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'consent_type']),
            models.Index(fields=['accepted']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.consent_type} - {self.accepted}"


class AuditLog(models.Model):
    """Append-only audit trail for sensitive product and admin actions."""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=255)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=255, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['action']),
            models.Index(fields=['target_type', 'target_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.action} on {self.target_type}:{self.target_id}"


class FamilyMember(models.Model):
    """
    Family members who have access to chat with an AI.
    """
    RELATIONSHIP_CHOICES = [
        ('spouse', 'Spouse'),
        ('child', 'Child'),
        ('parent', 'Parent'),
        ('sibling', 'Sibling'),
        ('friend', 'Friend'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ai_owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='family_members'
    )
    email = models.EmailField()
    full_name = models.CharField(max_length=255, null=True, blank=True)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES)
    
    # Access control
    has_access = models.BooleanField(default=False)
    invitation_sent_at = models.DateTimeField(auto_now_add=True)
    invitation_accepted_at = models.DateTimeField(null=True, blank=True)
    
    # Link to user account (if they have one)
    user_account = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='family_access'
    )
    
    # Usage statistics
    conversation_count = models.IntegerField(default=0)
    last_conversation_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'family_members'
        ordering = ['-created_at']
        unique_together = [['ai_owner', 'email']]
        indexes = [
            models.Index(fields=['ai_owner', 'email']),
            models.Index(fields=['has_access']),
        ]
    
    def __str__(self):
        return f"{self.full_name or self.email} - {self.relationship} of {self.ai_owner.email}"
    
    def grant_access(self):
        """Grant access to this family member."""
        self.has_access = True
        self.invitation_accepted_at = timezone.now()
        self.save(update_fields=['has_access', 'invitation_accepted_at'])
    
    def increment_conversation_count(self):
        """Increment conversation count after a chat."""
        self.conversation_count += 1
        self.last_conversation_at = timezone.now()
        self.save(update_fields=['conversation_count', 'last_conversation_at'])
