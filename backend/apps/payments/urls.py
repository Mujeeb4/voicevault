"""
URL routing for payments.
"""
from django.urls import path
from apps.payments import views

app_name = 'payments'

urlpatterns = [
    # Create checkout session for package purchase
    path('create-checkout/', views.create_checkout_session, name='create_checkout'),
    path('confirm-checkout/', views.confirm_checkout_session, name='confirm_checkout'),
    
    # Stripe webhook endpoint
    path('webhook/', views.stripe_webhook, name='webhook'),
    
    # Get payment status for current user
    path('status/', views.get_payment_status, name='status'),
    
    # Get billing details for Settings
    path('billing/', views.get_billing_details, name='billing'),
    
    # Get available packages
    path('packages/', views.get_packages, name='packages'),
]
