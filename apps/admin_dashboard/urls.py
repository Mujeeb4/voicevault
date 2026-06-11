"""
Admin dashboard API routes.
"""
from django.urls import path

from . import views

urlpatterns = [
    path('me/', views.admin_me, name='admin-me'),
    path('stats/', views.admin_stats, name='admin-stats'),
    path('users/', views.admin_users, name='admin-users'),
    path('users/<uuid:user_id>/', views.admin_user_detail, name='admin-user-detail'),
    path('processing/', views.admin_processing_jobs, name='admin-processing-jobs'),
    path('batch-process-pending/', views.admin_batch_process_pending, name='admin-batch-process-pending'),
    path('batch-retry-failed/', views.admin_batch_retry_failed, name='admin-batch-retry-failed'),
    path('payments/', views.admin_payments, name='admin-payments'),
    path('logs/', views.admin_logs, name='admin-logs'),
]
