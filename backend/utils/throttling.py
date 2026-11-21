"""
Custom throttling classes for VoiceVault.
Provides granular rate limiting to balance security with user experience.
"""
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from functools import wraps


class AccountRateThrottle(UserRateThrottle):
    """
    Rate limit per signed-in account, falling back to the client IP when signed out.

    VoiceVault authenticates with its own middleware (request.supabase_user), so DRF
    sees every request as anonymous and UserRateThrottle would key on IP only. Keying
    on the account means switching IPs doesn't reset a user's limit.
    """

    def get_cache_key(self, request, view):
        account = getattr(request, 'supabase_user', None)
        ident = f'account-{account.id}' if account else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


def allow_request(throttle_class, request) -> bool:
    """Apply a DRF throttle in a plain Django view (e.g. the streaming chat endpoint)."""
    return throttle_class().allow_request(request, None)


class BurstRateThrottle(AccountRateThrottle):
    """
    Allows burst of requests but limits sustained high-rate usage.
    Good for page loads that make multiple API calls.
    """
    scope = 'burst'


class SustainedRateThrottle(AccountRateThrottle):
    """
    Lower rate for sustained usage over time.
    Prevents abuse while allowing normal usage patterns.
    """
    scope = 'sustained'


class AuthEndpointThrottle(AnonRateThrottle):
    """
    Specific throttle for auth endpoints (login, signup, refresh).
    More restrictive to prevent brute force attacks.
    """
    scope = 'auth'


class ProfileThrottle(AccountRateThrottle):
    """
    Higher rate limit for profile endpoints that are called frequently.
    """
    scope = 'profile'


class ChatThrottle(AccountRateThrottle):
    """
    Moderate rate limit for chat endpoints.
    """
    scope = 'chat'


class UploadThrottle(AccountRateThrottle):
    """
    Lower rate limit for upload endpoints (resource intensive).
    """
    scope = 'upload'


class ProcessingThrottle(AccountRateThrottle):
    """
    Very low rate limit for AI processing endpoints.
    """
    scope = 'processing'


def no_throttle(view_func):
    """
    Decorator to disable throttling for a view function.
    Use this for endpoints that are called very frequently (e.g., profile, accessible-ais).
    
    Usage:
        @api_view(['GET'])
        @no_throttle
        def my_view(request):
            ...
    """
    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        return view_func(*args, **kwargs)
    
    wrapped_view.throttle_classes = []
    return wrapped_view
