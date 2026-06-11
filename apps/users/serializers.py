"""
DRF Serializers for users app.
"""
from rest_framework import serializers
from .models import User, FamilyMember
from services.plan_limits import quota_status
from utils.admin_auth import is_admin_user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'package_tier',
            'plan_type',
            'is_premium',
            'premium_purchased_at',
            'lifetime_access',
            'recording_completed',
            'ai_ready',
            'recording_started_at',
            'ai_processing_started_at',
            'ai_processing_completed_at',
            'payment_completed',
            'stripe_customer_id',
            'stripe_payment_intent_id',
            'usage_quota',
            'is_admin',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'package_tier',
            'recording_completed',
            'ai_ready',
            'recording_started_at',
            'ai_processing_started_at',
            'ai_processing_completed_at',
            'plan_type',
            'is_premium',
            'premium_purchased_at',
            'lifetime_access',
            'payment_completed',
            'stripe_customer_id',
            'stripe_payment_intent_id',
            'usage_quota',
            'is_admin',
            'created_at',
            'updated_at',
        ]

    usage_quota = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    def get_usage_quota(self, obj):
        return quota_status(obj)

    def get_is_admin(self, obj):
        return is_admin_user(obj)


class FamilyMemberSerializer(serializers.ModelSerializer):
    """Serializer for FamilyMember model."""
    
    class Meta:
        model = FamilyMember
        fields = [
            'id',
            'email',
            'full_name',
            'relationship',
            'has_access',
            'invitation_sent_at',
            'invitation_accepted_at',
            'conversation_count',
            'last_conversation_at',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'has_access',
            'invitation_sent_at',
            'invitation_accepted_at',
            'conversation_count',
            'last_conversation_at',
            'created_at',
        ]


class FamilyInviteSerializer(serializers.Serializer):
    """Serializer for family member invitation."""
    
    email = serializers.EmailField(required=True)
    full_name = serializers.CharField(required=True, max_length=255)
    relationship = serializers.ChoiceField(
        choices=['spouse', 'child', 'parent', 'sibling', 'friend'],
        required=True
    )
    personal_message = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500
    )
