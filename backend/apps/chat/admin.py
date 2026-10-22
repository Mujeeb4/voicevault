from django.contrib import admin
from .models import Conversation


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['ai_owner', 'family_member', 'user_rating', 'response_time_ms', 'created_at']
    list_filter = ['user_rating', 'created_at']
    search_fields = ['ai_owner__email', 'family_member__email', 'question_text', 'response_text']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'

