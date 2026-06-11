"""
Invitation token management for family invitations.
Secure token generation and validation with 7-day expiry.
"""
import secrets
import hashlib
from datetime import timedelta
from typing import Optional, Tuple
from django.core.cache import cache
from django.utils import timezone
from apps.users.models import FamilyMember


# Token configuration
TOKEN_LENGTH = 32  # 32 bytes = 256 bits
TOKEN_EXPIRY_DAYS = 7
CACHE_PREFIX = 'invitation_token:'


def generate_invitation_token(family_member: FamilyMember) -> Tuple[str, str]:
    """
    Generate a secure invitation token for a family member.
    
    Args:
        family_member: FamilyMember instance
        
    Returns:
        Tuple of (token, invitation_url)
    """
    # Generate secure random token
    token = secrets.token_urlsafe(TOKEN_LENGTH)
    
    # Create cache key
    cache_key = f"{CACHE_PREFIX}{token}"
    
    # Store family member ID in cache with 7-day expiry
    expiry_seconds = TOKEN_EXPIRY_DAYS * 24 * 60 * 60
    cache.set(cache_key, str(family_member.id), timeout=expiry_seconds)
    
    # Generate invitation URL
    # Note: FRONTEND_URL should be configured in settings
    from decouple import config
    frontend_url = config('FRONTEND_URL', default='https://voicevault.com')
    invitation_url = f"{frontend_url}/accept-invite/{token}"
    
    return token, invitation_url


def validate_invitation_token(token: str) -> Optional[FamilyMember]:
    """
    Validate invitation token and return associated FamilyMember.
    
    Args:
        token: Invitation token string
        
    Returns:
        FamilyMember if token is valid, None otherwise
    """
    if not token:
        return None
    
    # Get family member ID from cache
    cache_key = f"{CACHE_PREFIX}{token}"
    family_member_id = cache.get(cache_key)
    
    if not family_member_id:
        # Token expired or doesn't exist
        return None
    
    try:
        # Get family member
        family_member = FamilyMember.objects.select_related('ai_owner').get(
            id=family_member_id
        )
        
        # Check if already accepted
        if family_member.has_access:
            # Already accepted, token should not be reused
            return None
        
        return family_member
        
    except FamilyMember.DoesNotExist:
        return None


def invalidate_invitation_token(token: str) -> bool:
    """
    Invalidate (delete) an invitation token.
    Use this after successful acceptance or when canceling invitation.
    
    Args:
        token: Invitation token to invalidate
        
    Returns:
        True if token was found and deleted, False otherwise
    """
    cache_key = f"{CACHE_PREFIX}{token}"
    return cache.delete(cache_key) > 0


def get_token_expiry_time() -> timezone.datetime:
    """
    Get the expiry datetime for new tokens.
    
    Returns:
        Datetime when token will expire (now + 7 days)
    """
    return timezone.now() + timedelta(days=TOKEN_EXPIRY_DAYS)


def cleanup_expired_invitations():
    """
    Cleanup family members with expired invitations (not accepted after 30 days).
    This should be run as a periodic Celery task.
    """
    from datetime import timedelta
    
    cutoff_date = timezone.now() - timedelta(days=30)
    
    # Find family members with expired invitations
    expired_invitations = FamilyMember.objects.filter(
        has_access=False,
        invitation_sent_at__lt=cutoff_date
    )
    
    count = expired_invitations.count()
    
    # Delete expired invitations
    expired_invitations.delete()
    
    return count

