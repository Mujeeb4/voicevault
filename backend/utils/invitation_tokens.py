"""
Invitation token management for family invitations.
Secure token generation and validation with 7-day expiry.
"""
import secrets
import hashlib
from datetime import timedelta
from typing import Optional, Tuple
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from apps.users.models import FamilyInvitation, FamilyMember


# Token configuration
TOKEN_LENGTH = 32  # 32 bytes = 256 bits
TOKEN_EXPIRY_DAYS = 7
CACHE_PREFIX = 'invitation_token:'  # legacy cache-only storage; transitional fallback only


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_invitation_token(family_member: FamilyMember, personal_message: str = '') -> Tuple[str, str]:
    """
    Create a durable (database-backed) invitation for a family member.

    Any earlier pending invitation for the same inviter/email is revoked so
    only the most recently emailed link works.

    Returns:
        Tuple of (token, invitation_url)
    """
    token = secrets.token_urlsafe(TOKEN_LENGTH)
    with transaction.atomic():
        FamilyInvitation.objects.filter(
            inviter=family_member.ai_owner, email__iexact=family_member.email, status='pending'
        ).update(status='revoked')
        FamilyInvitation.objects.create(
            token_hash=hash_token(token),
            family_member=family_member,
            inviter=family_member.ai_owner,
            email=family_member.email,
            personal_message=personal_message or '',
            expires_at=get_token_expiry_time(),
        )

    frontend_url = settings.FRONTEND_URL.rstrip('/')
    invitation_url = f"{frontend_url}/accept-invite/{token}"
    return token, invitation_url


def _get_invitation(token: str) -> Optional[FamilyInvitation]:
    return FamilyInvitation.objects.select_related(
        'family_member', 'family_member__ai_owner'
    ).filter(token_hash=hash_token(token)).first()


def validate_invitation_token(token: str) -> Optional[FamilyMember]:
    """
    Return the FamilyMember for a usable invitation token, else None.

    Looks in the database first. TRANSITIONAL: a token that is not in the
    database falls back to the legacy cache lookup so invitations emailed
    before the DB model shipped keep working until they expire (7 days).
    TODO: remove the cache fallback (and CACHE_PREFIX) once those have expired.
    """
    if not token:
        return None

    invitation = _get_invitation(token)
    if invitation is not None:
        if invitation.status != 'pending':
            return None
        if invitation.expires_at <= timezone.now():
            FamilyInvitation.objects.filter(pk=invitation.pk, status='pending').update(status='expired')
            return None
        member = invitation.family_member
        return None if member.has_access else member

    # Legacy cache fallback (transitional)
    family_member_id = cache.get(f"{CACHE_PREFIX}{token}")
    if not family_member_id:
        return None
    try:
        member = FamilyMember.objects.select_related('ai_owner').get(id=family_member_id)
    except FamilyMember.DoesNotExist:
        return None
    return None if member.has_access else member


def get_invitation_expiry(token: str):
    """Actual expiry of a token, or None if unknown (e.g. legacy cache token)."""
    invitation = _get_invitation(token) if token else None
    return invitation.expires_at if invitation else None


def consume_invitation_token(token: str, accepted_by=None) -> bool:
    """
    Atomically mark an invitation accepted. Returns True for exactly one caller;
    expired, revoked or already-used tokens return False.
    """
    if not token:
        return False
    updated = FamilyInvitation.objects.filter(
        token_hash=hash_token(token), status='pending', expires_at__gt=timezone.now()
    ).update(status='accepted', accepted_at=timezone.now(), accepted_by=accepted_by)
    if updated:
        cache.delete(f"{CACHE_PREFIX}{token}")
        return True
    if FamilyInvitation.objects.filter(token_hash=hash_token(token)).exists():
        return False
    # Legacy cache token (transitional): deletion is the single-use gate.
    return cache.delete(f"{CACHE_PREFIX}{token}") > 0


def invalidate_invitation_token(token: str) -> bool:
    """Revoke an invitation token (database and legacy cache)."""
    revoked = FamilyInvitation.objects.filter(
        token_hash=hash_token(token), status='pending'
    ).update(status='revoked')
    deleted = cache.delete(f"{CACHE_PREFIX}{token}")
    return bool(revoked) or bool(deleted)


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

