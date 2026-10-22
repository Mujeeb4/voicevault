from django.contrib import admin
from .models import AIConfiguration, ProcessingQueue, APIUsageTracking


@admin.register(AIConfiguration)
class AIConfigurationAdmin(admin.ModelAdmin):
    list_display = ['user', 'voice_clone_id', 'voice_quality_score', 'quality_approved', 'admin_approved', 'created_at']
    list_filter = ['quality_approved', 'admin_approved', 'ai_model']
    search_fields = ['user__email', 'voice_clone_id']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ProcessingQueue)
class ProcessingQueueAdmin(admin.ModelAdmin):
    list_display = ['user', 'task_type', 'status', 'priority', 'retry_count', 'created_at']
    list_filter = ['task_type', 'status', 'priority']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'


@admin.register(APIUsageTracking)
class APIUsageTrackingAdmin(admin.ModelAdmin):
    list_display = ['user', 'api_provider', 'operation', 'tokens_used', 'characters_used', 'cost_usd', 'success', 'created_at']
    list_filter = ['api_provider', 'operation', 'success']
    search_fields = ['user__email', 'request_id']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'

