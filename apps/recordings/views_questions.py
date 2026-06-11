"""
Admin endpoints for managing recording questions
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.http import HttpResponse
from .models import RecordingQuestion
from .serializers import RecordingQuestionSerializer
from apps.users.models import User
from services.plan_limits import FREE_LIMITS, get_limits
from utils.admin_auth import get_authenticated_user, is_admin_user, require_admin
import csv
import logging

logger = logging.getLogger(__name__)


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
        question = RecordingQuestion.objects.get(id=question_id)
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
        
        updated_count = 0
        
        for item in questions_data:
            question_id = item.get('id')
            new_order = item.get('order')
            
            if question_id and new_order is not None:
                try:
                    question = RecordingQuestion.objects.get(id=question_id)
                    question.order = new_order
                    question.save()
                    updated_count += 1
                except RecordingQuestion.DoesNotExist:
                    continue
        
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
        updates['is_active'] = bool(request.data.get('is_active'))

    if not updates:
        return Response(
            {'error': 'No supported updates provided'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    updated_count = RecordingQuestion.objects.filter(id__in=question_ids).update(**updates)
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

    deleted_count, _ = RecordingQuestion.objects.filter(id__in=question_ids).delete()
    return Response({'deleted_count': deleted_count})


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
