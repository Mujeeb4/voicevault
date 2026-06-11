"""
Authentication views for signup, login, logout, and token refresh.
Following .cursorrules patterns
"""
import jwt
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from utils.throttling import AuthEndpointThrottle
from .models import User
from .serializers import UserSerializer
import logging

logger = logging.getLogger(__name__)


def generate_jwt_token(user: User) -> dict:
    """
    Generate JWT access and refresh tokens for a user.
    Following .cursorrules patterns
    """
    now = datetime.utcnow()
    
    # Access token (expires in 1 hour)
    access_payload = {
        'sub': str(user.id),
        'email': user.email,
        'type': 'access',
        'iat': now,
        'exp': now + timedelta(hours=1),
    }
    
    # Refresh token (expires in 7 days)
    refresh_payload = {
        'sub': str(user.id),
        'email': user.email,
        'type': 'refresh',
        'iat': now,
        'exp': now + timedelta(days=7),
    }
    
    # Get JWT secret from settings (use SECRET_KEY as fallback)
    jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    
    access_token = jwt.encode(access_payload, jwt_secret, algorithm='HS256')
    refresh_token = jwt.encode(refresh_payload, jwt_secret, algorithm='HS256')
    
    return {
        'access': access_token,
        'refresh': refresh_token,
    }


class SignupView(APIView):
    """
    POST /api/users/signup/
    Create a new user account.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AuthEndpointThrottle]  # Stricter rate limit for auth
    
    def post(self, request):
        try:
            email = request.data.get('email', '').strip().lower()
            password = request.data.get('password', '')
            full_name = request.data.get('full_name', '').strip()
            phone_number = request.data.get('phone_number', '').strip()
            
            # Validation
            if not email:
                return Response(
                    {'error': 'email_required', 'message': 'Email is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not password or len(password) < 8:
                return Response(
                    {'error': 'invalid_password', 'message': 'Password must be at least 8 characters'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not full_name:
                return Response(
                    {'error': 'full_name_required', 'message': 'Full name is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if user already exists
            if User.objects.filter(email=email).exists():
                return Response(
                    {'error': 'email_exists', 'message': 'An account with this email already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create user
            user = User.objects.create(
                email=email,
                full_name=full_name,
                password_hash=make_password(password),  # Store hashed password
            )
            
            # Update last login
            user.last_login_at = timezone.now()
            user.save()
            
            # Generate tokens
            tokens = generate_jwt_token(user)
            
            # Serialize user
            serializer = UserSerializer(user)
            
            logger.info("New user signed up: %s", user.id)
            
            return Response(
                {
                    'user': serializer.data,
                    'tokens': tokens,
                },
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error("Signup error: %s", e.__class__.__name__, exc_info=True)
            return Response(
                {'error': 'signup_failed', 'message': 'Failed to create account. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoginView(APIView):
    """
    POST /api/users/login/
    Authenticate user and return JWT tokens.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AuthEndpointThrottle]  # Stricter rate limit for auth
    
    def post(self, request):
        from django.db import OperationalError, connection
        import time
        
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        
        # Validation
        if not email or not password:
            return Response(
                {'error': 'invalid_credentials', 'message': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.debug("Login attempt received")
        
        # Retry logic for database connection issues
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Close any stale connection first
                connection.close_if_unusable_or_obsolete()
                
                # Get user
                logger.debug(f"Querying database for user (attempt {attempt + 1})...")
                user = User.objects.get(email=email)
                logger.debug(f"User found: {user.id}")
                break  # Success, exit retry loop
                
            except OperationalError as e:
                last_error = e
                logger.warning("Database connection error on login attempt %s: %s", attempt + 1, e.__class__.__name__)
                
                # Close the failed connection
                try:
                    connection.close()
                except Exception:
                    pass
                
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))  # Wait 1s, 2s, 3s
                    continue
                else:
                    logger.error("Login failed after %s attempts: %s", max_retries, e.__class__.__name__)
                    return Response(
                        {'error': 'service_unavailable', 'message': 'Database temporarily unavailable. Please try again.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )
                    
            except User.DoesNotExist:
                logger.warning("Login failed: user not found")
                return Response(
                    {'error': 'invalid_credentials', 'message': 'Invalid email or password'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        try:
            # Check password
            if not hasattr(user, 'password_hash') or not user.password_hash:
                # User doesn't have password set (maybe created via Supabase)
                return Response(
                    {'error': 'invalid_credentials', 'message': 'Invalid email or password'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            if not check_password(password, user.password_hash):
                return Response(
                    {'error': 'invalid_credentials', 'message': 'Invalid email or password'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Update last login
            user.last_login_at = timezone.now()
            user.save()
            
            # Generate tokens
            tokens = generate_jwt_token(user)
            
            # Serialize user
            serializer = UserSerializer(user)
            
            logger.info("User logged in: %s", user.id)
            
            return Response(
                {
                    'user': serializer.data,
                    'tokens': tokens,
                },
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error("Login error: %s", e.__class__.__name__, exc_info=True)
            return Response(
                {'error': 'login_failed', 'message': 'Login failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LogoutView(APIView):
    """
    POST /api/users/logout/
    Logout user (client should discard tokens).
    """
    permission_classes = [AllowAny]  # Allow any since logout is client-side
    
    def post(self, request):
        # In a stateless JWT system, logout is handled client-side
        # But we can log it for analytics
        user_id = 'anonymous'
        if hasattr(request, 'supabase_user') and request.supabase_user:
            user_id = request.supabase_user.id
        logger.info("User logged out: %s", user_id)
        
        return Response(
            {'message': 'Logged out successfully'},
            status=status.HTTP_200_OK
        )


class RefreshTokenView(APIView):
    """
    POST /api/users/refresh/
    Refresh access token using refresh token.
    """
    permission_classes = [AllowAny]
    throttle_classes = []  # No throttle - refresh is essential for auth flow
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh', '')
            
            if not refresh_token:
                return Response(
                    {'error': 'refresh_token_required', 'message': 'Refresh token is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify refresh token
            jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
            
            try:
                payload = jwt.decode(refresh_token, jwt_secret, algorithms=['HS256'])
            except jwt.ExpiredSignatureError:
                return Response(
                    {'error': 'token_expired', 'message': 'Refresh token has expired'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            except jwt.InvalidTokenError:
                return Response(
                    {'error': 'invalid_token', 'message': 'Invalid refresh token'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Check token type
            if payload.get('type') != 'refresh':
                return Response(
                    {'error': 'invalid_token', 'message': 'Invalid token type'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Get user
            user_id = payload.get('sub')
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'user_not_found', 'message': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Generate new access token
            tokens = generate_jwt_token(user)
            
            return Response(
                tokens,
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error("Token refresh error: %s", e.__class__.__name__, exc_info=True)
            return Response(
                {'error': 'refresh_failed', 'message': 'Failed to refresh token'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
