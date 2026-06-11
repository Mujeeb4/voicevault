"""
Custom throttling classes for VoiceVault.
Provides granular rate limiting to balance security with user experience.
"""
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from functools import wraps


class BurstRateThrottle(UserRateThrottle):
    """
    Allows burst of requests but limits sustained high-rate usage.
    Good for page loads that make multiple API calls.
    """
    scope = 'burst'


class SustainedRateThrottle(UserRateThrottle):
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


class ProfileThrottle(UserRateThrottle):
    """
    Higher rate limit for profile endpoints that are called frequently.
    """
    scope = 'profile'


class ChatThrottle(UserRateThrottle):
    """
    Moderate rate limit for chat endpoints.
    """
    scope = 'chat'


class UploadThrottle(UserRateThrottle):
    """
    Lower rate limit for upload endpoints (resource intensive).
    """
    scope = 'upload'


class ProcessingThrottle(UserRateThrottle):
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
