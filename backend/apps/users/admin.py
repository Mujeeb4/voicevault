from django.contrib import admin
from django.utils import timezone

from .models import AuditLog, ConsentRecord, FamilyMember, UsageQuota, User
from services.plan_limits import next_month_start


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = [
        'email',
        'full_name',
        'plan_type',
        'is_premium',
        'payment_completed',
        'recording_completed',
        'ai_ready',
        'premium_purchased_at',
        'created_at',
    ]
    list_filter = ['plan_type', 'is_premium', 'lifetime_access', 'recording_completed', 'ai_ready', 'payment_completed']
    search_fields = ['email', 'full_name', 'stripe_customer_id', 'stripe_payment_intent_id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'premium_purchased_at']
    date_hierarchy = 'created_at'
    actions = ['mark_as_premium', 'revoke_premium', 'reset_usage_limits']

    @admin.action(description='Mark selected users as Premium')
    def mark_as_premium(self, request, queryset):
        for user in queryset:
            user.activate_premium()

    @admin.action(description='Revoke Premium from selected users')
    def revoke_premium(self, request, queryset):
        queryset.update(
            plan_type='free',
            package_tier='free',
            is_premium=False,
            lifetime_access=False,
            payment_completed=False,
        )

    @admin.action(description='Reset monthly usage limits')
    def reset_usage_limits(self, request, queryset):
        UsageQuota.objects.filter(user__in=queryset).update(
            text_messages_used_this_month=0,
            voice_responses_used_this_month=0,
            quota_reset_date=next_month_start(timezone.localdate()),
        )


@admin.register(FamilyMember)
class FamilyMemberAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'email', 'ai_owner', 'relationship', 'has_access', 'conversation_count']
    list_filter = ['relationship', 'has_access']
    search_fields = ['email', 'full_name', 'ai_owner__email']
    readonly_fields = ['id', 'created_at', 'invitation_sent_at']


@admin.register(UsageQuota)
class UsageQuotaAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'recording_minutes_used',
        'recording_storage_used_mb',
        'text_messages_used_this_month',
        'voice_responses_used_this_month',
        'family_invites_used',
        'ai_generations_used',
        'quota_reset_date',
    ]
    search_fields = ['user__email', 'user__full_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ConsentRecord)
class ConsentRecordAdmin(admin.ModelAdmin):
    list_display = ['user', 'consent_type', 'accepted', 'accepted_at', 'consent_version', 'created_at']
    list_filter = ['consent_type', 'accepted', 'consent_version']
    search_fields = ['user__email', 'user__full_name', 'ip_address']
    readonly_fields = ['created_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'target_type', 'target_id', 'created_at']
    list_filter = ['action', 'target_type']
    search_fields = ['user__email', 'action', 'target_type', 'target_id']
    readonly_fields = ['user', 'action', 'target_type', 'target_id', 'metadata', 'created_at']
    date_hierarchy = 'created_at'
