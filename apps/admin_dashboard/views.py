"""
Admin dashboard API views.
"""
import logging
from decimal import Decimal

from django.core.paginator import Paginator
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.ai_processing.models import APIUsageTracking, ProcessingQueue
from apps.ai_processing.tasks import (
    analyze_personality_task,
    clone_voice_task,
    finalize_ai_task,
    transcribe_audio_task,
)
from apps.chat.models import Conversation
from apps.payments.models import Payment
from apps.recordings.models import AudioRecording, RecordingQuestion
from apps.users.models import AuditLog, FamilyMember, User
from services.plan_limits import can_clone_voice
from utils.admin_auth import require_admin

logger = logging.getLogger(__name__)


def money_to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return value


def cents_to_dollars(cents):
    return round((cents or 0) / 100, 2)


def paginate_queryset(queryset, request, default_limit=20, max_limit=100):
    page = max(int(request.GET.get('page', 1) or 1), 1)
    limit = min(max(int(request.GET.get('limit', default_limit) or default_limit), 1), max_limit)
    paginator = Paginator(queryset, limit)
    current_page = paginator.get_page(page)
    return paginator.count, list(current_page.object_list)


def serialize_user(user):
    recordings = list(
        AudioRecording.objects
        .filter(user=user)
        .order_by('-created_at')[:5]
        .values('id', 'storage_path', 'duration_seconds', 'created_at')
    )

    return {
        'id': str(user.id),
        'email': user.email,
        'full_name': user.full_name,
        'package_tier': user.package_tier,
        'plan_type': user.plan_type,
        'is_premium': user.is_premium,
        'premium_purchased_at': user.premium_purchased_at.isoformat() if user.premium_purchased_at else None,
        'lifetime_access': user.lifetime_access,
        'recording_completed': user.recording_completed,
        'recording_started_at': user.recording_started_at.isoformat() if user.recording_started_at else None,
        'ai_ready': user.ai_ready,
        'ai_processing_started_at': user.ai_processing_started_at.isoformat() if user.ai_processing_started_at else None,
        'ai_processing_completed_at': user.ai_processing_completed_at.isoformat() if user.ai_processing_completed_at else None,
        'payment_completed': user.payment_completed,
        'payment_amount': user.payment_amount,
        'stripe_customer_id': user.stripe_customer_id,
        'stripe_payment_intent_id': user.stripe_payment_intent_id,
        'family_members_count': getattr(user, 'family_members_count', None)
        if hasattr(user, 'family_members_count') else FamilyMember.objects.filter(ai_owner=user).count(),
        'conversations_count': getattr(user, 'conversations_count', None)
        if hasattr(user, 'conversations_count') else Conversation.objects.filter(ai_owner=user).count(),
        'recordings': [
            {
                'id': str(item['id']),
                'storage_path': item['storage_path'],
                'duration_seconds': item['duration_seconds'],
                'created_at': item['created_at'].isoformat(),
            }
            for item in recordings
        ],
        'created_at': user.created_at.isoformat(),
        'updated_at': user.updated_at.isoformat(),
        'last_login_at': user.last_login_at.isoformat() if user.last_login_at else None,
    }


def get_processing_status_for_user(user):
    tasks = list(ProcessingQueue.objects.filter(user=user).order_by('-created_at'))
    if user.ai_ready:
        return 'complete', None, None, None
    if any(task.status == 'failed' for task in tasks):
        failed = next(task for task in tasks if task.status == 'failed')
        return 'failed', failed.started_at, failed.completed_at, failed.error_message
    if any(task.status == 'processing' for task in tasks):
        active = next(task for task in tasks if task.status == 'processing')
        return 'in_progress', active.started_at, active.completed_at, None
    if tasks:
        latest = tasks[0]
        return 'pending', latest.started_at, latest.completed_at, None
    if AudioRecording.objects.filter(user=user, upload_status='complete').exists():
        return 'recorded_and_uploaded', None, None, None
    return 'pending', None, None, None


def queue_full_pipeline_for_user(user):
    from celery import chain

    if can_clone_voice(user).allowed:
        pipeline = chain(
            transcribe_audio_task.si(str(user.id)),
            analyze_personality_task.si(str(user.id)),
            clone_voice_task.si(str(user.id)),
            finalize_ai_task.si(str(user.id)),
        )
    else:
        pipeline = chain(
            transcribe_audio_task.si(str(user.id)),
            analyze_personality_task.si(str(user.id)),
            finalize_ai_task.si(str(user.id)),
        )

    return pipeline.apply_async()


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def admin_me(request):
    return Response({
        'id': str(request.admin_user.id),
        'email': request.admin_user.email,
        'full_name': request.admin_user.full_name,
        'is_admin': True,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def admin_stats(request):
    since = timezone.now() - timezone.timedelta(days=7)
    payments = Payment.objects.all()
    succeeded_payments = payments.filter(status='succeeded')
    failed_tasks = ProcessingQueue.objects.filter(status='failed').count()
    failed_recordings = AudioRecording.objects.filter(upload_status='failed').count()
    failed_api_calls = APIUsageTracking.objects.filter(success=False).count()
    api_usage = APIUsageTracking.objects.aggregate(
        openai_calls=Count('id', filter=Q(api_provider='openai')),
        elevenlabs_calls=Count('id', filter=Q(api_provider='elevenlabs')),
        total_cost=Sum('cost_usd'),
    )

    recent_payments = [
        serialize_payment(payment)
        for payment in Payment.objects.select_related('user').order_by('-created_at')[:5]
    ]
    recent_failures = build_failure_logs(limit=5)

    return Response({
        'total_users': User.objects.count(),
        'total_recordings': AudioRecording.objects.count(),
        'total_conversations': Conversation.objects.count(),
        'ai_ready_count': User.objects.filter(ai_ready=True).count(),
        'processing_count': ProcessingQueue.objects.filter(status__in=['pending', 'processing']).count(),
        'failed_count': failed_tasks + failed_recordings + failed_api_calls,
        'recent_signups': User.objects.filter(created_at__gte=since).count(),
        'active_questions': RecordingQuestion.objects.filter(is_active=True).count(),
        'inactive_questions': RecordingQuestion.objects.filter(is_active=False).count(),
        'payments_total': payments.count(),
        'payments_succeeded': succeeded_payments.count(),
        'payments_failed': payments.filter(status='failed').count(),
        'revenue_cents': succeeded_payments.aggregate(total=Sum('amount_cents'))['total'] or 0,
        'revenue_display': f"${cents_to_dollars(succeeded_payments.aggregate(total=Sum('amount_cents'))['total'] or 0):,.2f}",
        'pending_processing': ProcessingQueue.objects.filter(status='pending').count(),
        'failed_processing': failed_tasks,
        'api_usage': {
            'openai_calls': api_usage['openai_calls'] or 0,
            'elevenlabs_calls': api_usage['elevenlabs_calls'] or 0,
            'total_cost': money_to_float(api_usage['total_cost']),
        },
        'recent_payments': recent_payments,
        'recent_failures': recent_failures,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def admin_users(request):
    queryset = User.objects.annotate(
        family_members_count=Count('family_members', distinct=True),
        conversations_count=Count('conversations', distinct=True),
    )

    search = request.GET.get('search')
    if search:
        queryset = queryset.filter(Q(email__icontains=search) | Q(full_name__icontains=search))

    user_status = request.GET.get('status')
    if user_status == 'completed':
        queryset = queryset.filter(ai_ready=True)
    elif user_status == 'processing':
        queryset = queryset.filter(ai_ready=False, ai_processing_started_at__isnull=False)
    elif user_status == 'failed':
        queryset = queryset.filter(processingqueue__status='failed').distinct()
    elif user_status == 'paid':
        queryset = queryset.filter(payment_completed=True)

    count, users = paginate_queryset(queryset.order_by('-created_at'), request)
    return Response({'count': count, 'results': [serialize_user(user) for user in users]})


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([AllowAny])
@require_admin
def admin_user_detail(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'not_found', 'message': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(serialize_user(user))

    if request.method == 'DELETE':
        AuditLog.objects.create(
            user=request.admin_user,
            action='admin_user_delete',
            target_type='user',
            target_id=str(user.id),
            metadata={'target_email': user.email},
        )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    allowed_fields = {
        'full_name',
        'package_tier',
        'plan_type',
        'is_premium',
        'lifetime_access',
        'recording_completed',
        'ai_ready',
        'payment_completed',
    }
    updates = {
        key: value
        for key, value in request.data.items()
        if key in allowed_fields
    }
    if not updates:
        return Response({'error': 'validation_error', 'message': 'No supported fields provided'}, status=status.HTTP_400_BAD_REQUEST)

    for key, value in updates.items():
        setattr(user, key, value)
    user.save(update_fields=list(updates.keys()) + ['updated_at'])

    AuditLog.objects.create(
        user=request.admin_user,
        action='admin_user_update',
        target_type='user',
        target_id=str(user.id),
        metadata={'updated_fields': sorted(updates.keys())},
    )
    return Response(serialize_user(user))


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def admin_processing_jobs(request):
    users = User.objects.all().order_by('-updated_at')
    requested_status = request.GET.get('status')
    rows = []

    for user in users:
        job_status, started_at, completed_at, error_message = get_processing_status_for_user(user)
        if requested_status and requested_status != job_status:
            continue
        rows.append({
            'user_id': str(user.id),
            'user_name': user.full_name,
            'user_email': user.email,
            'status': job_status,
            'steps': {},
            'started_at': started_at.isoformat() if started_at else (
                user.ai_processing_started_at.isoformat() if user.ai_processing_started_at else None
            ),
            'completed_at': completed_at.isoformat() if completed_at else (
                user.ai_processing_completed_at.isoformat() if user.ai_processing_completed_at else None
            ),
            'error_message': error_message,
        })

    page = max(int(request.GET.get('page', 1) or 1), 1)
    limit = min(max(int(request.GET.get('limit', 20) or 20), 1), 100)
    paginator = Paginator(rows, limit)
    current_page = paginator.get_page(page)
    return Response({'count': paginator.count, 'results': list(current_page.object_list)})


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def admin_batch_process_pending(request):
    users = (
        User.objects
        .filter(ai_ready=False, recordings__upload_status='complete')
        .exclude(processingqueue__status__in=['pending', 'processing'])
        .distinct()
    )
    triggered_count = 0

    for user in users:
        try:
            queue_full_pipeline_for_user(user)
            triggered_count += 1
        except Exception as exc:
            logger.error("Admin batch pending processing failed: %s", exc.__class__.__name__)

    AuditLog.objects.create(
        user=request.admin_user,
        action='admin_batch_process_pending',
        target_type='processing',
        metadata={'triggered_count': triggered_count},
    )
    return Response({'triggered_count': triggered_count}, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def admin_batch_retry_failed(request):
    failed_user_ids = (
        ProcessingQueue.objects
        .filter(status='failed')
        .values_list('user_id', flat=True)
        .distinct()
    )
    users = User.objects.filter(id__in=failed_user_ids, recordings__upload_status='complete').distinct()
    triggered_count = 0

    for user in users:
        try:
            ProcessingQueue.objects.filter(user=user, status='failed').update(status='pending', error_message='')
            queue_full_pipeline_for_user(user)
            triggered_count += 1
        except Exception as exc:
            logger.error("Admin batch retry failed: %s", exc.__class__.__name__)

    AuditLog.objects.create(
        user=request.admin_user,
        action='admin_batch_retry_failed',
        target_type='processing',
        metadata={'triggered_count': triggered_count},
    )
    return Response({'triggered_count': triggered_count}, status=status.HTTP_202_ACCEPTED)


def serialize_payment(payment):
    return {
        'id': str(payment.id),
        'user_id': str(payment.user_id),
        'user_name': payment.user.full_name,
        'user_email': payment.user.email,
        'stripe_payment_intent_id': payment.stripe_payment_intent_id,
        'stripe_customer_id': payment.stripe_customer_id,
        'amount_cents': payment.amount_cents,
        'amount_display': f"${cents_to_dollars(payment.amount_cents):,.2f}",
        'currency': payment.currency.upper(),
        'status': payment.status,
        'package_tier': payment.package_tier,
        'payment_type': payment.payment_type,
        'payment_method': payment.payment_method,
        'receipt_url': payment.receipt_url,
        'created_at': payment.created_at.isoformat(),
        'updated_at': payment.updated_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def admin_payments(request):
    queryset = Payment.objects.select_related('user').order_by('-created_at')
    payment_status = request.GET.get('status')
    search = request.GET.get('search')

    if payment_status and payment_status != 'all':
        queryset = queryset.filter(status=payment_status)
    if search:
        queryset = queryset.filter(
            Q(user__email__icontains=search)
            | Q(user__full_name__icontains=search)
            | Q(stripe_payment_intent_id__icontains=search)
        )

    count, payments = paginate_queryset(queryset, request)
    return Response({'count': count, 'results': [serialize_payment(payment) for payment in payments]})


def build_failure_logs(limit=None):
    logs = []

    for task in ProcessingQueue.objects.select_related('user').filter(status='failed').order_by('-created_at')[:limit or 50]:
        logs.append({
            'id': str(task.id),
            'source': 'processing',
            'level': 'error',
            'message': task.error_message or 'Processing task failed',
            'user_id': str(task.user_id),
            'user_email': task.user.email,
            'context': task.task_type,
            'created_at': task.created_at.isoformat(),
        })

    for recording in AudioRecording.objects.select_related('user').filter(upload_status='failed').order_by('-created_at')[:limit or 50]:
        logs.append({
            'id': str(recording.id),
            'source': 'recording',
            'level': 'error',
            'message': 'Recording upload failed',
            'user_id': str(recording.user_id),
            'user_email': recording.user.email,
            'context': recording.question_text[:120],
            'created_at': recording.created_at.isoformat(),
        })

    for usage in APIUsageTracking.objects.select_related('user').filter(success=False).order_by('-created_at')[:limit or 50]:
        logs.append({
            'id': str(usage.id),
            'source': usage.api_provider,
            'level': 'warning',
            'message': f"{usage.operation} API call failed",
            'user_id': str(usage.user_id) if usage.user_id else None,
            'user_email': usage.user.email if usage.user else None,
            'context': usage.request_id or '',
            'created_at': usage.created_at.isoformat(),
        })

    logs.sort(key=lambda item: item['created_at'], reverse=True)
    return logs[:limit] if limit else logs


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def admin_logs(request):
    log_type = request.GET.get('type', 'failures')
    limit = min(max(int(request.GET.get('limit', 50) or 50), 1), 100)

    if log_type == 'audit':
        logs = [
            {
                'id': str(log.id),
                'source': 'audit',
                'level': 'info',
                'message': log.action,
                'user_id': str(log.user_id) if log.user_id else None,
                'user_email': log.user.email if log.user else None,
                'context': f"{log.target_type}:{log.target_id or ''}",
                'metadata': log.metadata,
                'created_at': log.created_at.isoformat(),
            }
            for log in AuditLog.objects.select_related('user').order_by('-created_at')[:limit]
        ]
    else:
        logs = build_failure_logs(limit=limit)

    return Response({'count': len(logs), 'results': logs})
