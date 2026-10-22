"""Shared password policy: 8-128 characters plus Django's configured validators."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response


def password_policy_errors(password, user=None) -> list:
    """Return a list of human-readable problems (empty when the password is acceptable)."""
    if not isinstance(password, str) or len(password) < 8 or len(password) > 128:
        return ['Password must be between 8 and 128 characters']
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        return list(exc.messages)
    return []


def password_policy_response(password, user=None, field='password'):
    """A 400 in the existing error format, with per-field detail, or None when valid."""
    problems = password_policy_errors(password, user)
    if not problems:
        return None
    return Response(
        {
            'error': 'invalid_password',
            'message': ' '.join(problems),
            'errors': {field: problems},
        },
        status=status.HTTP_400_BAD_REQUEST,
    )
