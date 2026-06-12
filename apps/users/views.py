"""
Views for users app.
"""
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from .models import ConsentRecord, User
from .serializers import UserSerializer
from django.db import connection
import logging

logger = logging.getLogger(__name__)


class UserProfileView(APIView):
    """
    GET /api/users/profile/
    Get or create user profile based on Supabase auth.
    
    PATCH /api/users/profile/
    Update user profile.
    """
    permission_classes = [AllowAny]  # We handle auth in the view itself via middleware
    throttle_classes = []  # No throttle - profile is called frequently on page loads
    
    def get(self, request):
        # Check authentication
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            logger.warning("Unauthorized profile access attempt")
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get or create user
        user, created = User.objects.get_or_create(
            id=request.supabase_user.id,
            defaults={
                'email': request.supabase_user.email,
                'full_name': request.supabase_user.email.split('@')[0],
            }
        )
        
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def patch(self, request):
        # Check authentication
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = User.objects.get(id=request.supabase_user.id)
        except User.DoesNotExist:
            return Response(
                {'error': 'not_found', 'message': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(
            {
                'error': 'validation_error',
                'message': 'Invalid data',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )


class HealthCheckView(APIView):
    """
    GET /api/users/health/
    Health check endpoint for monitoring and load balancers.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        try:
            # Check database connection (Disabled for debugging deployment timeouts)
            # with connection.cursor() as cursor:
            #     cursor.execute("SELECT 1")
            
            return Response({
                'status': 'healthy',
                'service': 'voicevault',
                'database': 'skipped_check'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error("Health check failed: %s", e.__class__.__name__)
            return Response({
                'status': 'unhealthy',
                'service': 'voicevault',
                'database': 'disconnected',
                'error': 'health_check_failed'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class ConsentRecordView(APIView):
    """
    POST /api/users/consent/
    Store explicit consent for sensitive VoiceVault actions.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not hasattr(request, 'supabase_user') or not request.supabase_user:
            return Response(
                {'error': 'authentication_required', 'message': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        consent_type = request.data.get('consent_type')
        accepted = bool(request.data.get('accepted', False))
        valid_types = {choice[0] for choice in ConsentRecord.CONSENT_TYPES}
        if consent_type not in valid_types:
            return Response(
                {'error': 'invalid_consent_type', 'message': 'Unsupported consent type'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(id=request.supabase_user.id)
        except User.DoesNotExist:
            return Response(
                {'error': 'not_found', 'message': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip_address and ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()

        consent = ConsentRecord.objects.create(
            user=user,
            consent_type=consent_type,
            accepted=accepted,
            accepted_at=timezone.now() if accepted else None,
            ip_address=ip_address or None,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )

        if consent_type == 'voice_cloning' and accepted and user.is_premium:
            try:
                from apps.ai_processing.tasks import clone_voice_task, finalize_ai_task
                from apps.ai_processing.models import ProcessingQueue
                from celery import chain

                has_recordings = user.audio_recordings.filter(upload_status='complete').exists()
                is_cloning = ProcessingQueue.objects.filter(
                    user=user,
                    task_type='clone_voice',
                    status__in=['processing', 'complete']
                ).exists()

                if has_recordings and not is_cloning:
                    pipeline = chain(
                        clone_voice_task.si(str(user.id)).set(queue='voice'),
                        finalize_ai_task.si(str(user.id)).set(queue='default')
                    )
                    pipeline.apply_async()
            except Exception:
                logger.warning('Could not queue post-consent voice processing for user %s', user.id, exc_info=True)

        return Response({
            'id': str(consent.id),
            'consent_type': consent.consent_type,
            'accepted': consent.accepted,
            'accepted_at': consent.accepted_at.isoformat() if consent.accepted_at else None,
        }, status=status.HTTP_201_CREATED)
