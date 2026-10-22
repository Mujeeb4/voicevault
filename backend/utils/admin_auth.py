"""
Server-side admin authorization helpers.
"""
from functools import wraps

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response

from apps.users.models import User


def get_admin_emails() -> set[str]:
    configured = getattr(settings, 'ADMIN_EMAILS', '')
    return {
        email.strip().lower()
        for email in configured.split(',')
        if email.strip()
    }


def is_admin_email(email: str | None) -> bool:
    return bool(email and email.lower() in get_admin_emails())


def is_admin_user(user: User | None) -> bool:
    return bool(user and is_admin_email(user.email))


def get_authenticated_user(request):
    supabase_user = getattr(request, 'supabase_user', None)
    if not supabase_user:
        return None

    try:
        return User.objects.get(id=supabase_user.id)
    except User.DoesNotExist:
        return None


def require_admin(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user = get_authenticated_user(request)
        if not user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not is_admin_user(user):
            return Response(
                {'error': 'permission_denied', 'message': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        request.admin_user = user
        return view_func(request, *args, **kwargs)

    return wrapper
