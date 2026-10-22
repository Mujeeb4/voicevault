from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['user', 'stripe_payment_intent_id', 'amount_cents', 'status', 'package_tier', 'created_at']
    list_filter = ['status', 'package_tier', 'currency']
    search_fields = ['user__email', 'stripe_payment_intent_id', 'stripe_customer_id']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'

