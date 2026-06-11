"""
Family management views - Invitation system and member management.
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone

from apps.users.models import User, FamilyMember
from apps.users.serializers import FamilyInviteSerializer, FamilyMemberSerializer
from services.plan_limits import can_invite_family_member, is_premium, quota_status, record_family_invite
from utils.invitation_tokens import (
    generate_invitation_token,
    validate_invitation_token,
    invalidate_invitation_token,
    get_token_expiry_time
)
from utils.email_service import (
    send_invitation_email,
    send_invitation_accepted_email,
    send_access_removed_email,
    send_welcome_email
)

logger = logging.getLogger(__name__)


# ============================================================================
# ENDPOINT 1: INVITE FAMILY MEMBER
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def invite_family_member(request):
    """
    Invite a family member to chat with the AI.
    
    Request Body:
        {
            "email": "sarah@example.com",
            "full_name": "Sarah Johnson",
            "relationship": "child",
            "personal_message": "Hi Sarah, I created this so we can always talk. Love, Dad"
        }
    
    Response (201 Created):
        {
            "message": "Invitation sent successfully",
            "family_member_id": "uuid",
            "email": "sarah@example.com",
            "invitation_link": "https://voicevault.com/accept-invite/token123",
            "expires_at": "2026-01-18T10:00:00Z"
        }
    """
    # Get authenticated user from Supabase middleware
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    
    try:
        ai_owner = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if AI is ready
    if not ai_owner.ai_ready:
        return Response(
            {'error': 'AI is not ready yet. Please complete AI processing first.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    limit_check = can_invite_family_member(ai_owner)
    if not limit_check.allowed:
        return Response(limit_check.as_error(), status=status.HTTP_402_PAYMENT_REQUIRED)
    
    # Validate request data
    serializer = FamilyInviteSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': 'Invalid data', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    email = serializer.validated_data['email']
    full_name = serializer.validated_data.get('full_name', '')
    relationship = serializer.validated_data['relationship']
    personal_message = serializer.validated_data.get('personal_message', '')
    
    # Extract name from email if not provided
    if not full_name:
        full_name = email.split('@')[0].replace('.', ' ').replace('_', ' ').title()
    
    # Check if already invited
    existing = FamilyMember.objects.filter(
        ai_owner=ai_owner,
        email=email
    ).first()
    
    if existing:
        return Response(
            {
                'error': 'This email has already been invited',
                'family_member_id': str(existing.id),
                'has_access': existing.has_access
            },
            status=status.HTTP_409_CONFLICT
        )
    
    # Create family member record
    family_member = FamilyMember.objects.create(
        ai_owner=ai_owner,
        email=email,
        full_name=full_name,
        relationship=relationship,
        has_access=False
    )
    
    logger.info("Created family member invitation: %s", family_member.id)
    record_family_invite(ai_owner, str(family_member.id))
    
    # Generate invitation token
    token, invitation_link = generate_invitation_token(family_member)
    
    # Get expiry time
    expires_at = get_token_expiry_time()
    
    # Send invitation email
    email_sent = send_invitation_email(
        to_email=email,
        to_name=full_name,
        ai_owner_name=ai_owner.full_name,
        relationship=relationship,
        invitation_link=invitation_link,
        personal_message=personal_message if personal_message else None
    )
    
    if not email_sent:
        logger.warning(f"Email send failed for invitation {family_member.id}")
        # Still return success - user can resend later
    
    return Response({
        'message': 'Invitation sent successfully' if email_sent else 'Invitation created (email send failed - can resend)',
        'family_member_id': str(family_member.id),
        'email': email,
        'full_name': full_name,
        'relationship': relationship,
        'invitation_link': invitation_link,
        'expires_at': expires_at.isoformat(),
        'email_sent': email_sent
    }, status=status.HTTP_201_CREATED)


# ============================================================================
# ENDPOINT 1B: GET INVITATION DETAILS (Preview before accepting)
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_invitation_details(request, token):
    """
    Get invitation details for preview before accepting.
    This is a public endpoint - no auth required.
    
    URL Parameter:
        token: Invitation token from email link
    
    Response (200 OK):
        {
            "ai_owner": {
                "id": "uuid",
                "full_name": "John Smith"
            },
            "invitee_name": "Sarah Johnson",
            "invitee_email": "sarah@example.com",
            "relationship": "child",
            "expires_at": "2026-01-18T10:00:00Z",
            "is_expired": false,
            "already_accepted": false
        }
    """
    # Validate token
    family_member = validate_invitation_token(token)
    
    if not family_member:
        return Response(
            {'error': 'Invalid or expired invitation token'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get expiry time for this token
    expires_at = get_token_expiry_time()
    is_expired = timezone.now() > expires_at
    
    return Response({
        'ai_owner': {
            'id': str(family_member.ai_owner.id),
            'full_name': family_member.ai_owner.full_name
        },
        'invitee_name': family_member.full_name,
        'invitee_email': family_member.email,
        'relationship': family_member.relationship,
        'expires_at': expires_at.isoformat(),
        'is_expired': is_expired,
        'already_accepted': family_member.has_access
    }, status=status.HTTP_200_OK)


# ============================================================================
# ENDPOINT 2: ACCEPT INVITATION
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def accept_invitation(request, token):
    """
    Accept an invitation to access an AI.
    
    URL Parameter:
        token: Invitation token from email link
    
    Request Body (optional):
        {
            "user_id": "uuid"  // If user is authenticated
        }
    
    Response (200 OK):
        {
            "message": "Invitation accepted",
            "ai_owner": {
                "id": "uuid",
                "name": "John Smith",
                "relationship": "father"
            },
            "redirect_url": "/chat/uuid"
        }
    """
    # Validate token
    family_member = validate_invitation_token(token)
    
    if not family_member:
        return Response(
            {'error': 'Invalid or expired invitation token'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if already accepted
    if family_member.has_access:
        return Response(
            {'error': 'Invitation already accepted'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get user account if authenticated (using Supabase auth)
    user_account = None
    
    # First try: supabase_user from middleware
    if hasattr(request, 'supabase_user') and request.supabase_user:
        try:
            user_account = User.objects.get(id=str(request.supabase_user.id))
            logger.info("Linked user account via supabase_user")
        except User.DoesNotExist:
            logger.warning(f"Supabase user {request.supabase_user.id} not found in database")
    
    # Second try: user_id from request body
    if not user_account:
        user_id = request.data.get('user_id')
        if user_id:
            try:
                user_account = User.objects.get(id=user_id)
                logger.info("Linked user account via user_id")
            except User.DoesNotExist:
                pass
    
    # Third try: Find user by email (for new accounts created during signup)
    if not user_account:
        try:
            user_account = User.objects.get(email=family_member.email)
            logger.info("Linked user account via email")
        except User.DoesNotExist:
            logger.warning("No user account found for invitation recipient")
    
    # Grant access
    family_member.has_access = True
    family_member.invitation_accepted_at = timezone.now()
    family_member.user_account = user_account
    family_member.save(update_fields=['has_access', 'invitation_accepted_at', 'user_account'])
    
    logger.info("Invitation accepted: %s", family_member.id)
    
    # Invalidate token (one-time use)
    invalidate_invitation_token(token)
    
    # Send confirmation emails
    # 1. To family member (welcome)
    send_welcome_email(
        to_email=family_member.email,
        to_name=family_member.full_name,
        ai_owner_name=family_member.ai_owner.full_name
    )
    
    # 2. To AI owner (notification)
    send_invitation_accepted_email(
        to_email=family_member.ai_owner.email,
        family_member_name=family_member.full_name,
        relationship=family_member.relationship
    )
    
    return Response({
        'message': 'Invitation accepted successfully',
        'ai_owner': {
            'id': str(family_member.ai_owner.id),
            'name': family_member.ai_owner.full_name,
            'relationship': family_member.relationship
        },
        'redirect_url': f'/chat/{family_member.ai_owner.id}'
    }, status=status.HTTP_200_OK)


# ============================================================================
# ENDPOINT 3: LIST FAMILY MEMBERS
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def list_family_members(request):
    """
    List all family members for the authenticated AI owner.
    
    Query Parameters:
        user_id: UUID of AI owner (or from JWT)
    
    Response (200 OK):
        {
            "count": 5,
            "members": [
                {
                    "id": "uuid",
                    "email": "sarah@example.com",
                    "full_name": "Sarah Johnson",
                    "relationship": "child",
                    "has_access": true,
                    "invitation_sent_at": "2026-01-10T10:00:00Z",
                    "invitation_accepted_at": "2026-01-10T15:30:00Z",
                    "conversation_count": 12,
                    "last_conversation_at": "2026-01-11T09:00:00Z"
                }
            ]
        }
    """
    # Get authenticated user from Supabase middleware
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    
    try:
        ai_owner = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get all family members for this AI owner
    family_members = FamilyMember.objects.filter(
        ai_owner=ai_owner
    ).order_by('-created_at')
    
    # Serialize
    serializer = FamilyMemberSerializer(family_members, many=True)
    
    return Response({
        'count': family_members.count(),
        'members': serializer.data
    }, status=status.HTTP_200_OK)


# ============================================================================
# ENDPOINT 4: REMOVE FAMILY MEMBER
# ============================================================================

@api_view(['DELETE'])
@permission_classes([AllowAny])
def remove_family_member(request, member_id):
    """
    Remove a family member's access to the AI.
    
    URL Parameter:
        member_id: UUID of family member to remove
    
    Query Parameter:
        user_id: UUID of AI owner (for authentication)
    
    Response (204 No Content)
    """
    # Get authenticated user from Supabase middleware
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    
    try:
        ai_owner = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get family member
    try:
        family_member = FamilyMember.objects.get(
            id=member_id,
            ai_owner=ai_owner
        )
    except FamilyMember.DoesNotExist:
        return Response(
            {'error': 'Family member not found or you do not have permission'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Store email and name for notification
    member_email = family_member.email
    member_name = family_member.full_name
    
    # Delete family member record
    family_member.delete()
    
    logger.info("Family member removed: %s", member_id)
    
    # Send notification email
    send_access_removed_email(
        to_email=member_email,
        to_name=member_name,
        ai_owner_name=ai_owner.full_name
    )
    
    return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================================
# ENDPOINT 5: RESEND INVITATION
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def resend_invitation(request, member_id):
    """
    Resend invitation email to a family member.
    
    URL Parameter:
        member_id: UUID of family member
    
    Query Parameter:
        user_id: UUID of AI owner (for authentication)
    
    Response (200 OK):
        {
            "message": "Invitation resent",
            "email": "sarah@example.com",
            "invitation_link": "https://voicevault.com/accept-invite/newtoken456",
            "expires_at": "2026-01-18T10:00:00Z"
        }
    """
    # Get authenticated user from Supabase middleware
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    
    try:
        ai_owner = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get family member
    try:
        family_member = FamilyMember.objects.get(
            id=member_id,
            ai_owner=ai_owner
        )
    except FamilyMember.DoesNotExist:
        return Response(
            {'error': 'Family member not found or you do not have permission'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if already accepted
    if family_member.has_access:
        return Response(
            {'error': 'This family member has already accepted the invitation'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Generate new invitation token
    token, invitation_link = generate_invitation_token(family_member)
    
    # Get expiry time
    expires_at = get_token_expiry_time()
    
    # Get personal message if provided
    personal_message = request.data.get('personal_message', '')
    
    # Send invitation email
    email_sent = send_invitation_email(
        to_email=family_member.email,
        to_name=family_member.full_name,
        ai_owner_name=ai_owner.full_name,
        relationship=family_member.relationship,
        invitation_link=invitation_link,
        personal_message=personal_message if personal_message else None
    )
    
    if not email_sent:
        return Response(
            {'error': 'Failed to send email. Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Update invitation_sent_at timestamp
    family_member.invitation_sent_at = timezone.now()
    family_member.save(update_fields=['invitation_sent_at'])
    
    logger.info("Invitation resent: %s", member_id)
    
    return Response({
        'message': 'Invitation resent successfully',
        'email': family_member.email,
        'invitation_link': invitation_link,
        'expires_at': expires_at.isoformat()
    }, status=status.HTTP_200_OK)


# ============================================================================
# ENDPOINT 6: LIST ACCESSIBLE AIs (for family members)
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([])  # No throttle - called frequently on navigation
def accessible_ais(request):
    """
    List all AIs that the authenticated user has access to (as a family member).
    Also includes the user's own AI if they have one.
    
    This is used by the chat page to show which AIs the user can chat with.
    
    NOTE: No throttle on this endpoint - called frequently on navigation.
    
    Response (200 OK):
        {
            "results": [
                {
                    "id": "uuid",
                    "full_name": "John Smith",
                    "ai_ready": true,
                    "relationship": "father",
                    "invitation_accepted_at": "2026-01-10T15:30:00Z"
                }
            ]
        }
    """
    # Get authenticated user
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user_id = str(request.supabase_user.id)
    user_email = request.supabase_user.email
    
    accessible_list = []
    
    try:
        # 1. Check if user has their own AI ready
        try:
            user = User.objects.get(id=user_id)
            if user.ai_ready:
                accessible_list.append({
                    'id': str(user.id),
                    'full_name': user.full_name,
                    'ai_ready': True,
                    'relationship': 'self',
                    'invitation_accepted_at': user.ai_processing_completed_at.isoformat() if user.ai_processing_completed_at else None,
                    'plan_type': user.plan_type,
                    'is_premium': is_premium(user),
                    'voice_enabled': is_premium(user),
                    'usage_quota': quota_status(user),
                })
        except User.DoesNotExist:
            pass
        
        # 2. Find family member records where this user's email is invited
        #    and has_access = True (invitation accepted)
        family_access = FamilyMember.objects.filter(
            email=user_email,
            has_access=True
        ).select_related('ai_owner')
        
        for fm in family_access:
            if fm.ai_owner.ai_ready:
                accessible_list.append({
                    'id': str(fm.ai_owner.id),
                    'full_name': fm.ai_owner.full_name,
                    'ai_ready': True,
                    'relationship': fm.relationship,
                    'invitation_accepted_at': fm.invitation_accepted_at.isoformat() if fm.invitation_accepted_at else None,
                    'plan_type': fm.ai_owner.plan_type,
                    'is_premium': is_premium(fm.ai_owner),
                    'voice_enabled': is_premium(fm.ai_owner),
                    'usage_quota': quota_status(fm.ai_owner),
                })
        
        logger.info("Accessible AI list fetched: %s result(s)", len(accessible_list))
        
        return Response({
            'results': accessible_list
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error("Error fetching accessible AIs: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to load accessible AIs'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
