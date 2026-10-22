"""
URL routing for recording questions management
"""
from django.urls import path
from . import views_questions

urlpatterns = [
    # List and create questions
    path('', views_questions.get_questions, name='get_questions'),
    path('create/', views_questions.create_question, name='create_question'),
    
    # Get, update, delete specific question
    path('<uuid:question_id>/', views_questions.get_question, name='get_question'),
    path('<uuid:question_id>/update/', views_questions.update_question, name='update_question'),
    path('<uuid:question_id>/delete/', views_questions.delete_question, name='delete_question'),
    
    # Bulk operations
    path('reorder/', views_questions.reorder_questions, name='reorder_questions'),
    path('seed/', views_questions.seed_default_questions, name='seed_questions'),
    path('bulk-update/', views_questions.bulk_update_questions, name='bulk_update_questions'),
    path('bulk-delete/', views_questions.bulk_delete_questions, name='bulk_delete_questions'),
    path('export/', views_questions.export_questions, name='export_questions'),
]
