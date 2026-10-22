"""
Payment models for Stripe integration.
"""
import uuid
from django.db import models
from apps.users.models import User


class Payment(models.Model):
    """
    Model for tracking Stripe payments.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    PACKAGE_CHOICES = [
        ('free', 'Memory Starter'),
        ('premium', 'VoiceVault'),
    ]
    PAYMENT_TYPE_CHOICES = [
        ('one_time', 'One-time'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    
    # Stripe information
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True, db_index=True)
    stripe_customer_id = models.CharField(max_length=255, db_index=True)
    
    # Payment details
    amount_cents = models.IntegerField(help_text="Amount in cents")
    currency = models.CharField(max_length=3, default='usd')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    package_tier = models.CharField(max_length=20, choices=PACKAGE_CHOICES)
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='one_time')
    payment_method = models.CharField(max_length=255, null=True, blank=True)
    receipt_url = models.URLField(max_length=1000, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['user']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Payment {self.stripe_payment_intent_id} - {self.status}"
