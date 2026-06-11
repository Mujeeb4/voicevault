"""
Supabase JWT authentication middleware for Django.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
import jwt
import logging

logger = logging.getLogger(__name__)


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
        '/api/family/accept-invite/',
        '/api/family/invitation/',
        '/api/payments/webhook/',
        '/api/payments/packages/',
        '/api/users/signup/',
        '/api/users/login/',
        '/api/users/refresh/',
    ]
    
    def process_request(self, request):
        """
        Process incoming request and verify JWT token.
        """
        # Skip authentication for excluded paths
        for path in self.EXCLUDED_PATHS:
            if request.path.startswith(path):
                return None
        
        # Get Authorization header
        auth_header = request.headers.get('Authorization', '')
        
        logger.debug("Auth header present for %s: %s", request.path, bool(auth_header))
        
        if not auth_header.startswith('Bearer '):
            # No auth header - set anonymous user
            logger.debug(f"No Bearer token found for {request.path}")
            request.supabase_user = None
            return None
        
        # Extract token
        token = auth_header.replace('Bearer ', '').strip()
        
        if not token:
            return JsonResponse(
                {'error': 'authentication_required', 'message': 'No token provided'},
                status=401
            )
        
        try:
            # Verify JWT token with Django SECRET_KEY (same as used for signing)
            jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
            
            decoded = jwt.decode(
                token,
                jwt_secret,
                algorithms=['HS256']
            )
            
            # Extract user information
            user_id = decoded.get('sub')
            email = decoded.get('email')
            token_type = decoded.get('type')
            
            # Only accept access tokens for API requests
            if token_type != 'access':
                return JsonResponse(
                    {'error': 'invalid_token', 'message': 'Invalid token type. Access token required.'},
                    status=401
                )
            
            if not user_id or not email:
                return JsonResponse(
                    {'error': 'invalid_token', 'message': 'Token missing required fields'},
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
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        
        decoded = jwt.decode(
            token,
            jwt_secret,
            algorithms=['HS256']
        )
        
        user_id = decoded.get('sub')
        email = decoded.get('email')
        token_type = decoded.get('type')
        
        if token_type != 'access' or not user_id or not email:
            return None
        
        return SupabaseUser(
            user_id=user_id,
            email=email,
            token_data=decoded
        )
        
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, Exception) as e:
        logger.warning("Token verification failed: %s", e.__class__.__name__)
        return None
