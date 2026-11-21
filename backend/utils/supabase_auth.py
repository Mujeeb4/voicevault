"""
Supabase JWT authentication middleware for Django.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
import jwt
from django.core.exceptions import ValidationError as DjangoValidationError
import logging

from utils.jwt_tokens import ACCESS_COOKIE, CSRF_HEADER, CSRF_HEADER_VALUE, decode_token

logger = logging.getLogger(__name__)


def token_is_current(user_id, token_version) -> bool:
    """True when the user still exists and the token's version matches theirs."""
    from apps.users.models import User

    try:
        current = User.objects.filter(id=user_id).values_list('token_version', flat=True).first()
    except (ValueError, TypeError, DjangoValidationError):
        return False
    if current is None:
        return False
    try:
        return int(token_version) == current
    except (TypeError, ValueError):
        return False


class SupabaseUser:
    """Custom user object for Supabase authenticated users."""
    
    def __init__(self, user_id: str, email: str, token_data: dict):
        self.id = user_id
        self.email = email
        self.is_authenticated = True
        self.token_data = token_data
    
    def __str__(self):
        return f"SupabaseUser({self.id})"


class SupabaseAuthMiddleware(MiddlewareMixin):
    """
    Middleware to verify Supabase JWT tokens and attach user to request.
    """
    
    EXCLUDED_PATHS = [
        '/admin/',
        '/api/family/invitation/',
        '/api/payments/webhook/',
        '/api/chat/replicate/webhook/',
        '/api/payments/packages/',
        '/api/users/signup/',
        '/api/users/verify-email/',
        '/api/users/resend-verification/',
        '/api/users/login/',
        '/api/users/refresh/',
        '/api/users/logout/',
        '/api/users/password-reset/',
    ]
    
    def process_request(self, request):
        """
        Process incoming request and verify JWT token.
        """
        # Skip authentication for excluded paths
        for path in self.EXCLUDED_PATHS:
            if request.path.startswith(path):
                return None
        
        # The token comes from the httpOnly cookie set at sign-in (browsers), or an
        # Authorization header (scripts and tests)
        auth_header = request.headers.get('Authorization', '')
        token = auth_header[len('Bearer '):].strip() if auth_header.startswith('Bearer ') else ''
        from_cookie = False
        if not token:
            token = request.COOKIES.get(ACCESS_COOKIE, '')
            from_cookie = bool(token)

        if not token:
            logger.debug("No credentials for %s", request.path)
            request.supabase_user = None
            return None

        # Cookies are sent automatically, so a cookie-authenticated write must also carry a
        # header that a cross-site page can't add (CSRF protection on top of SameSite=Strict)
        if from_cookie and request.method not in ('GET', 'HEAD', 'OPTIONS') \
                and request.headers.get(CSRF_HEADER) != CSRF_HEADER_VALUE:
            logger.warning("Cookie-authenticated %s to %s without the CSRF header", request.method, request.path)
            return JsonResponse(
                {'error': 'csrf_failed', 'message': 'Request rejected. Please reload the page and try again.'},
                status=403
            )

        try:
            decoded = decode_token(token, 'access')

            user_id = decoded.get('sub')
            email = decoded.get('email')

            if not user_id or not email:
                return JsonResponse(
                    {'error': 'invalid_token', 'message': 'Token missing required fields'},
                    status=401
                )
            
            # Revocation: one indexed primary-key lookup. Tokens minted before the
            # `tv` claim existed count as version 0, matching the column default.
            if not token_is_current(user_id, decoded.get('tv', 0)):
                return JsonResponse(
                    {'error': 'token_revoked', 'message': 'Session is no longer valid. Please sign in again.'},
                    status=401
                )

            # Create SupabaseUser object and attach to request
            request.supabase_user = SupabaseUser(
                user_id=user_id,
                email=email,
                token_data=decoded
            )
            
            logger.debug("Authenticated user id: %s", user_id)
            return None
            
        except jwt.ExpiredSignatureError:
            return JsonResponse(
                {'error': 'token_expired', 'message': 'Authentication token has expired'},
                status=401
            )
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid JWT token for %s: %s", request.path, e.__class__.__name__)
            return JsonResponse(
                {'error': 'invalid_token', 'message': 'Invalid authentication token'},
                status=401
            )
        except Exception as e:
            logger.error("Authentication error: %s", e.__class__.__name__)
            return JsonResponse(
                {'error': 'authentication_failed', 'message': 'Authentication failed'},
                status=401
            )


def verify_supabase_token(token: str):
    """
    Verify a Supabase JWT token and return a SupabaseUser object.
    Used for SSE endpoints where Authorization header is not available.
    
    Args:
        token: JWT token string
        
    Returns:
        SupabaseUser object if valid, None otherwise
    """
    if not token:
        return None
    
    try:
        decoded = decode_token(token, 'access')

        user_id = decoded.get('sub')
        email = decoded.get('email')
        token_type = decoded.get('type')
        
        if token_type != 'access' or not user_id or not email:
            return None

        if not token_is_current(user_id, decoded.get('tv', 0)):
            return None
        
        return SupabaseUser(
            user_id=user_id,
            email=email,
            token_data=decoded
        )
        
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, Exception) as e:
        logger.warning("Token verification failed: %s", e.__class__.__name__)
        return None
