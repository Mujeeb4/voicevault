"""
Admin endpoints for managing recording questions
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.db import transaction
from django.http import HttpResponse
from .models import RecordingQuestion
from .serializers import RecordingQuestionSerializer
from apps.users.models import AuditLog, User
from services.plan_limits import FREE_LIMITS, get_limits
from utils.admin_auth import get_authenticated_user, is_admin_user, require_admin
import csv
import logging

logger = logging.getLogger(__name__)


def audit_question_action(request, action, target_id=None, metadata=None):
    AuditLog.objects.create(
        user=request.admin_user,
        action=action,
        target_type='recording_question',
        target_id=str(target_id) if target_id else None,
        metadata=metadata or {},
    )


class QuestionPagination(PageNumberPagination):
    """Pagination for questions"""
    page_size = 30
    page_size_query_param = 'per_page'
    max_page_size = 100


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow anyone to view questions
def get_questions(request):
    """
    Get all recording questions (public endpoint - no auth required for viewing)
    
    Query Parameters:
        domain (optional): Filter by domain
        is_active (optional): Filter by active status
        search (optional): Search in question text
        page (optional): Page number
        per_page (optional): Results per page
    
    Response:
        {
            "count": 30,
            "next": "url",
            "previous": "url",
            "results": [
                {
                    "id": "uuid",
                    "question_text": "...",
                    "domain": "childhood",
                    "order": 1,
                    "is_active": true,
                    "tip": "...",
                    "suggested_duration_seconds": 60
                }
            ]
        }
    """
    try:
        requesting_user = get_authenticated_user(request)
        is_admin_request = is_admin_user(requesting_user)

        # Build query
        questions = RecordingQuestion.objects.all()
        if not is_admin_request:
            questions = questions.filter(is_active=True)
        
        # Filter by domain
        domain = request.GET.get('domain')
        if domain:
            questions = questions.filter(domain=domain)
        
        # Filter by active status
        is_active = request.GET.get('is_active')
        if is_admin_request and is_active is not None:
            questions = questions.filter(is_active=is_active.lower() == 'true')
        
        # Search
        search = request.GET.get('search')
        if search:
            questions = questions.filter(
                Q(question_text__icontains=search) |
                Q(tip__icontains=search)
            )
        
        # Order
        questions = questions.order_by('order')

        # Logged-in free users see the free guided-question allowance.
        supabase_user = getattr(request, 'supabase_user', None)
        if supabase_user and not is_admin_request:
            try:
                user = User.objects.get(id=str(supabase_user.id))
                question_limit = get_limits(user)['recording_questions']
                questions = questions[:question_limit]
            except User.DoesNotExist:
                questions = questions[:FREE_LIMITS['recording_questions']]
        
        # Paginate
        paginator = QuestionPagination()
        paginated_questions = paginator.paginate_queryset(questions, request)
        
        serializer = RecordingQuestionSerializer(paginated_questions, many=True)
        
        return paginator.get_paginated_response(serializer.data)
    
    except Exception as e:
        logger.error("Error fetching questions: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to fetch questions'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def create_question(request):
    """
    Create a new recording question
    
    Request Body:
        {
            "question_text": "What was your favorite childhood memory?",
            "domain": "childhood",
            "order": 1,
            "tip": "Think about specific details and emotions",
            "suggested_duration_seconds": 60,
            "is_active": true
        }
    
    Response:
        {
            "id": "uuid",
            "question_text": "...",
            "domain": "childhood",
            "order": 1,
            ...
        }
    """
    try:
        serializer = RecordingQuestionSerializer(data=request.data)
        
        if serializer.is_valid():
            question = serializer.save()
            audit_question_action(request, 'admin_question_create', question.id, {'order': question.order})
            logger.info(f"Question created: {question.id}")
            
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
    except Exception as e:
        logger.error("Error creating question: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to create question'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def get_question(request, question_id):
    """
    Get a specific question by ID
    
    Response:
        {
            "id": "uuid",
            "question_text": "...",
            "domain": "childhood",
            "order": 1,
            ...
        }
    """
    try:
        question = RecordingQuestion.objects.get(id=question_id)
        serializer = RecordingQuestionSerializer(question)
        
        return Response(serializer.data)
    
    except RecordingQuestion.DoesNotExist:
        return Response(
            {'error': 'Question not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error("Error fetching question: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to fetch question'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT', 'PATCH'])
@permission_classes([AllowAny])
@require_admin
def update_question(request, question_id):
    """
    Update a recording question
    
    Request Body:
        {
            "question_text": "Updated question text",
            "tip": "Updated tip",
            "is_active": false
        }
    
    Response:
        {
            "id": "uuid",
            "question_text": "Updated question text",
            ...
        }
    """
    try:
        question = RecordingQuestion.objects.get(id=question_id)
        
        partial = request.method == 'PATCH'
        serializer = RecordingQuestionSerializer(
            question,
            data=request.data,
            partial=partial
        )
        
        if serializer.is_valid():
            question = serializer.save()
            audit_question_action(
                request,
                'admin_question_update',
                question.id,
                {'updated_fields': sorted(request.data.keys())},
            )
            logger.info(f"Question updated: {question.id}")
            
            return Response(serializer.data)
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
    except RecordingQuestion.DoesNotExist:
        return Response(
            {'error': 'Question not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error("Error updating question: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to update question'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([AllowAny])
@require_admin
def delete_question(request, question_id):
    """
    Delete a recording question
    
    Response:
        {
            "message": "Question deleted successfully"
        }
    """
    try:
        with transaction.atomic():
            question = RecordingQuestion.objects.select_for_update().get(id=question_id)
            audit_question_action(
                request,
                'admin_question_delete',
                question.id,
                {'question_text': question.question_text[:200], 'order': question.order},
            )
            question.delete()
        
        logger.info(f"Question deleted: {question_id}")
        
        return Response(
            {'message': 'Question deleted successfully'},
            status=status.HTTP_200_OK
        )
    
    except RecordingQuestion.DoesNotExist:
        return Response(
            {'error': 'Question not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error("Error deleting question: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to delete question'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def reorder_questions(request):
    """
    Reorder questions
    
    Request Body:
        {
            "questions": [
                {"id": "uuid1", "order": 1},
                {"id": "uuid2", "order": 2},
                ...
            ]
        }
    
    Response:
        {
            "message": "Questions reordered successfully",
            "updated_count": 30
        }
    """
    try:
        questions_data = request.data.get('questions', [])
        
        if not questions_data:
            return Response(
                {'error': 'No questions provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not isinstance(questions_data, list) or any(not isinstance(item, dict) for item in questions_data):
            return Response({'error': 'questions must be a non-empty list of objects'}, status=status.HTTP_400_BAD_REQUEST)

        question_ids = [str(item.get('id', '')) for item in questions_data]
        new_orders = [item.get('order') for item in questions_data]
        if any(not question_id for question_id in question_ids):
            return Response({'error': 'Every question requires an id'}, status=status.HTTP_400_BAD_REQUEST)
        if any(type(order) is not int or order < 1 for order in new_orders):
            return Response({'error': 'Every order must be a positive integer'}, status=status.HTTP_400_BAD_REQUEST)
        if len(set(question_ids)) != len(question_ids) or len(set(new_orders)) != len(new_orders):
            return Response({'error': 'Question ids and orders must be unique'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            questions = list(RecordingQuestion.objects.select_for_update().filter(id__in=question_ids))
            found_ids = {str(question.id) for question in questions}
            missing_ids = sorted(set(question_ids) - found_ids)
            if missing_ids:
                return Response(
                    {'error': 'Question not found', 'missing_ids': missing_ids},
                    status=status.HTTP_404_NOT_FOUND,
                )
            order_by_id = dict(zip(question_ids, new_orders))
            conflicts = []
            for question in questions:
                destination = order_by_id[str(question.id)]
                if RecordingQuestion.objects.filter(domain=question.domain, order=destination).exclude(id__in=question_ids).exists():
                    conflicts.append({'id': str(question.id), 'domain': question.domain, 'order': destination})
            if conflicts:
                return Response(
                    {'error': 'order_conflict', 'conflicts': conflicts},
                    status=status.HTTP_409_CONFLICT,
                )
            # Move rows out of the destination range first to avoid transient unique conflicts.
            for offset, question in enumerate(questions, start=1):
                question.order = -1000000 - offset
                question.save(update_fields=['order', 'updated_at'])
            for question in questions:
                question.order = order_by_id[str(question.id)]
                question.save(update_fields=['order', 'updated_at'])
            audit_question_action(
                request,
                'admin_question_reorder',
                metadata={'question_ids': question_ids, 'orders': new_orders},
            )

        updated_count = len(questions)
        
        logger.info(f"Reordered {updated_count} questions")
        
        return Response({
            'message': 'Questions reordered successfully',
            'updated_count': updated_count
        })
    
    except Exception as e:
        logger.error("Error reordering questions: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to reorder questions'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def seed_default_questions(request):
    """
    Seed database with 30 default questions
    
    Response:
        {
            "message": "30 default questions created",
            "count": 30
        }
    """
    try:
        # Default questions
        default_questions = [
            # Childhood (5)
            {"question_text": "Tell me about your earliest childhood memory.", "domain": "childhood", "order": 1},
            {"question_text": "What was your favorite thing to do as a child?", "domain": "childhood", "order": 2},
            {"question_text": "Describe your childhood home and neighborhood.", "domain": "childhood", "order": 3},
            {"question_text": "Who were your best friends growing up?", "domain": "childhood", "order": 4},
            {"question_text": "What did you want to be when you grew up?", "domain": "childhood", "order": 5},
            
            # Family (5)
            {"question_text": "Tell me about your parents and siblings.", "domain": "family", "order": 6},
            {"question_text": "What family traditions were most important to you?", "domain": "family", "order": 7},
            {"question_text": "Describe a memorable family vacation or gathering.", "domain": "family", "order": 8},
            {"question_text": "What values did your family instill in you?", "domain": "family", "order": 9},
            {"question_text": "How has your family shaped who you are today?", "domain": "family", "order": 10},
            
            # Career (5)
            {"question_text": "What was your first job?", "domain": "career", "order": 11},
            {"question_text": "Tell me about your career journey and major milestones.", "domain": "career", "order": 12},
            {"question_text": "What work are you most proud of?", "domain": "career", "order": 13},
            {"question_text": "Describe your biggest professional challenge.", "domain": "career", "order": 14},
            {"question_text": "What advice would you give about career success?", "domain": "career", "order": 15},
            
            # Wisdom (5)
            {"question_text": "What is the most important lesson you've learned in life?", "domain": "wisdom", "order": 16},
            {"question_text": "What advice would you give your younger self?", "domain": "wisdom", "order": 17},
            {"question_text": "What does success mean to you?", "domain": "wisdom", "order": 18},
            {"question_text": "What does happiness mean to you?", "domain": "wisdom", "order": 19},
            {"question_text": "What legacy do you want to leave behind?", "domain": "wisdom", "order": 20},
            
            # Challenges (5)
            {"question_text": "Tell me about a difficult time you overcame.", "domain": "challenges", "order": 21},
            {"question_text": "What failure taught you the most?", "domain": "challenges", "order": 22},
            {"question_text": "How do you handle stress and adversity?", "domain": "challenges", "order": 23},
            {"question_text": "What gives you strength during hard times?", "domain": "challenges", "order": 24},
            {"question_text": "What would you do differently if you could?", "domain": "challenges", "order": 25},
            
            # Personality (5)
            {"question_text": "How would your friends describe you?", "domain": "personality", "order": 26},
            {"question_text": "What are you passionate about?", "domain": "personality", "order": 27},
            {"question_text": "What makes you laugh?", "domain": "personality", "order": 28},
            {"question_text": "What are your core values?", "domain": "personality", "order": 29},
            {"question_text": "What brings you the most joy in life?", "domain": "personality", "order": 30},
        ]
        
        created_count = 0
        
        for q_data in default_questions:
            # Check if question already exists at this order
            existing = RecordingQuestion.objects.filter(order=q_data['order']).first()
            if not existing:
                RecordingQuestion.objects.create(**q_data)
                created_count += 1

        audit_question_action(request, 'admin_question_seed', metadata={'created_count': created_count})
        
        logger.info(f"Seeded {created_count} default questions")
        
        return Response({
            'message': f'{created_count} default questions created',
            'count': created_count,
            'total': RecordingQuestion.objects.count()
        })
    
    except Exception as e:
        logger.error("Error seeding questions: %s", e.__class__.__name__)
        return Response(
            {'error': 'Failed to seed questions'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def bulk_update_questions(request):
    question_ids = request.data.get('question_ids', [])
    if not isinstance(question_ids, list) or not question_ids:
        return Response(
            {'error': 'question_ids must be a non-empty list'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    updates = {}
    if 'is_active' in request.data:
        if not isinstance(request.data.get('is_active'), bool):
            return Response({'error': 'is_active must be a boolean'}, status=status.HTTP_400_BAD_REQUEST)
        updates['is_active'] = request.data.get('is_active')

    if not updates:
        return Response(
            {'error': 'No supported updates provided'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    questions = RecordingQuestion.objects.filter(id__in=question_ids)
    found_ids = {str(value) for value in questions.values_list('id', flat=True)}
    missing_ids = sorted({str(value) for value in question_ids} - found_ids)
    if missing_ids:
        return Response({'error': 'Question not found', 'missing_ids': missing_ids}, status=status.HTTP_404_NOT_FOUND)
    updated_count = questions.update(**updates)
    audit_question_action(
        request,
        'admin_question_bulk_update',
        metadata={'question_ids': [str(value) for value in question_ids], 'updates': updates, 'updated_count': updated_count},
    )
    return Response({'updated_count': updated_count})


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def bulk_delete_questions(request):
    question_ids = request.data.get('question_ids', [])
    if not isinstance(question_ids, list) or not question_ids:
        return Response(
            {'error': 'question_ids must be a non-empty list'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    questions = RecordingQuestion.objects.filter(id__in=question_ids)
    found_ids = {str(value) for value in questions.values_list('id', flat=True)}
    requested_ids = {str(value) for value in question_ids}
    missing_ids = sorted(requested_ids - found_ids)
    if missing_ids:
        return Response({'error': 'Question not found', 'missing_ids': missing_ids}, status=status.HTTP_404_NOT_FOUND)
    with transaction.atomic():
        deleted_questions = list(questions.values('id', 'question_text', 'order'))
        deleted_count, _ = questions.delete()
        audit_question_action(
            request,
            'admin_question_bulk_delete',
            metadata={
                'questions': [
                    {'id': str(item['id']), 'question_text': item['question_text'][:200], 'order': item['order']}
                    for item in deleted_questions
                ],
                'deleted_count': len(deleted_questions),
            },
        )
    return Response({'deleted_count': len(deleted_questions)})


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def export_questions(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="recording_questions.csv"'
    writer = csv.writer(response)
    writer.writerow([
        'id',
        'order',
        'domain',
        'is_active',
        'suggested_duration_seconds',
        'question_text',
        'tip',
    ])

    for question in RecordingQuestion.objects.order_by('order'):
        writer.writerow([
            question.id,
            question.order,
            question.domain,
            question.is_active,
            question.suggested_duration_seconds,
            question.question_text,
            question.tip or '',
        ])

    return response
