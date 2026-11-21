"""
Sign-in tokens: issuing, verifying, and the httpOnly cookies that carry them.

The browser never sees the tokens: they live in httpOnly cookies, so a script injected
into the page (XSS) can't read or steal them. Cookies are SameSite=Strict, and writes
authenticated by cookie must also carry X-Requested-With (see SupabaseAuthMiddleware),
which a cross-site form or link can't add.
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone

import jwt
from django.conf import settings

JWT_ISSUER = 'voicevault'
JWT_AUDIENCE = 'voicevault-api'
ACCESS_LIFETIME = timedelta(hours=1)
REFRESH_LIFETIME = timedelta(days=7)

ACCESS_COOKIE = 'vv_access'
REFRESH_COOKIE = 'vv_refresh'
# The refresh token is only sent to the account endpoints (refresh, logout), not every request
REFRESH_COOKIE_PATH = '/api/users/'
CSRF_HEADER = 'X-Requested-With'
CSRF_HEADER_VALUE = 'XMLHttpRequest'


def signing_key() -> str:
    """
    Key for sign-in tokens, kept apart from SECRET_KEY's other uses (signed audio links,
    password reset and verification tokens). JWT_SECRET_KEY overrides it.
    """
    configured = getattr(settings, 'JWT_SECRET_KEY', '') or ''
    if configured:
        return configured
    return hmac.new(settings.SECRET_KEY.encode(), b'voicevault.jwt-signing', hashlib.sha256).hexdigest()


def issue_tokens(user) -> dict:
    now = datetime.now(dt_timezone.utc)
    claims = {
        'sub': str(user.id),
        'email': user.email,
        'tv': user.token_version,
        'iat': now,
        'iss': JWT_ISSUER,
        'aud': JWT_AUDIENCE,
    }
    access = {**claims, 'type': 'access', 'exp': now + ACCESS_LIFETIME, 'jti': uuid.uuid4().hex}
    refresh = {**claims, 'type': 'refresh', 'exp': now + REFRESH_LIFETIME, 'jti': uuid.uuid4().hex}
    key = signing_key()
    return {
        'access': jwt.encode(access, key, algorithm='HS256'),
        'refresh': jwt.encode(refresh, key, algorithm='HS256'),
    }


def decode_token(token: str, expected_type: str) -> dict:
    """
    Verify a sign-in token and return its claims.

    Raises jwt.ExpiredSignatureError for an expired token and jwt.InvalidTokenError for
    anything else wrong: bad signature, wrong type, issuer or audience, or a missing claim.
    """
    payload = jwt.decode(
        token,
        signing_key(),
        algorithms=['HS256'],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
        options={'require': ['exp', 'iat', 'sub', 'type', 'iss', 'aud']},
    )
    if payload.get('type') != expected_type:
        raise jwt.InvalidTokenError('Wrong token type')
    return payload


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _cookie_options():
    return {'httponly': True, 'secure': not settings.DEBUG, 'samesite': 'Strict'}


def set_auth_cookies(response, tokens: dict):
    response.set_cookie(
        ACCESS_COOKIE, tokens['access'], max_age=int(ACCESS_LIFETIME.total_seconds()), path='/',
        **_cookie_options(),
    )
    response.set_cookie(
        REFRESH_COOKIE, tokens['refresh'], max_age=int(REFRESH_LIFETIME.total_seconds()),
        path=REFRESH_COOKIE_PATH, **_cookie_options(),
    )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, path='/', samesite='Strict')
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, samesite='Strict')
    return response
