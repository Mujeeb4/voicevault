"""
URL routing for family management - Invitation system and member management.
"""
from django.urls import path
from apps.users import views_family

app_name = 'family'

urlpatterns = [
    # Invite family member (AI owner only)
    path('invite/', views_family.invite_family_member, name='invite'),
    
    # Accept invitation (public endpoint, uses token)
    path('accept-invite/<str:token>/', views_family.accept_invitation, name='accept_invite'),
    
    # Get invitation details (public endpoint, preview before accepting)
    path('invitation/<str:token>/', views_family.get_invitation_details, name='invitation_details'),
    
    # List all family members (AI owner only)
    path('members/', views_family.list_family_members, name='list_members'),
    
    # Remove family member (AI owner only)
    path('members/<uuid:member_id>/', views_family.remove_family_member, name='remove_member'),
    
    # Resend invitation (AI owner only)
    path('members/<uuid:member_id>/resend/', views_family.resend_invitation, name='resend_invitation'),
    
    # List AIs the authenticated user has access to (for chat page)
    path('accessible-ais/', views_family.accessible_ais, name='accessible_ais'),
]

