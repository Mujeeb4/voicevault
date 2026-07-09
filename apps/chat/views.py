"""
Chat API views - Streaming responses with <1s performance.
Implements optimized streaming, caching, and parallel audio generation.
Handles graceful fallback when Celery/Redis is unavailable.
"""
import json
import logging
import time
from typing import Generator
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from apps.users.models import User, FamilyMember
from apps.chat.models import Conversation
from apps.ai_processing.models import APIUsageTracking
from apps.chat.utils import (
    RAGContextBuilder,
    get_cached_response,
    cache_response,
    validate_chat_access,
    calculate_gpt4o_cost
)
from apps.chat.tasks import generate_audio_async, generate_audio_sync, is_celery_available
from services.plan_limits import (
    can_generate_voice_response,
    can_send_chat_message,
    record_chat_message,
)

logger = logging.getLogger(__name__)


# ============================================================================
# STREAMING CHAT ENDPOINT - Core Feature (Optimized for <1s response)
# ============================================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def chat_streaming(request):
    """
    Streaming chat endpoint with GPT-4o for sub-1 second perceived response time.
    
    Supports POST streaming and authenticated GET clients.
    
    Flow:
    1. Check cache (<50ms) - instant if hit
    2. Validate access (<100ms)
    3. Build optimized context (<50ms)
    4. Stream GPT-4o response (200-400ms to first token)
    5. Generate audio in background (parallel, 400-600ms)
    6. Cache response for future requests
    
    GET Query Parameters:
        ai_owner_id: UUID of AI owner
        message: The question to ask
    
    POST Request Body:
        {
            "ai_owner_id": "uuid",
            "question": "Dad, what advice do you have for me?"
        }
    
    Response: Server-Sent Events (text/event-stream)
        data: {"type": "text_chunk", "content": "Hello", "timestamp": 0.3}
        data: {"type": "text_complete", "full_text": "...", "tokens": 150}
        data: {"type": "audio_processing", "task_id": "...", "estimated_time": 600}
    """
    start_time = time.time()
    
    # Get request data (support both GET query params and POST body)
    if request.method == 'GET':
        ai_owner_id = request.GET.get('ai_owner_id')
        question = request.GET.get('message', '').strip()
    else:
        try:
            body = json.loads(request.body)
            ai_owner_id = body.get('ai_owner_id')
            question = body.get('question', '').strip()
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)
    
    # Validation
    if not ai_owner_id or not question:
        return JsonResponse(
            {'error': 'ai_owner_id and question are required'},
            status=400
        )
    
    if len(question) > 1000:
        return JsonResponse(
            {'error': 'Question too long (max 1000 characters)'},
            status=400
        )
    
    # Get AI owner
    try:
        ai_owner = User.objects.select_related('ai_config', 'transcript').get(id=ai_owner_id)
    except User.DoesNotExist:
        return JsonResponse(
            {'error': 'AI owner not found'},
            status=404
        )
    
    # Validate access using the Authorization header processed by middleware.
    supabase_user = getattr(request, 'supabase_user', None)

    if not supabase_user:
        return JsonResponse(
            {'error': 'Authentication required'},
            status=401
        )
    
    # Get User object from database using supabase_user.id
    try:
        requesting_user = User.objects.get(id=str(supabase_user.id))
    except User.DoesNotExist:
        return JsonResponse(
            {'error': 'User not found'},
            status=404
        )
    
    has_access, family_member, error_msg = validate_chat_access(ai_owner, requesting_user)
    
    if not has_access:
        return JsonResponse(
            {'error': error_msg},
            status=403
        )

    chat_limit = can_send_chat_message(ai_owner)
    if not chat_limit.allowed:
        if request.method == 'GET':
            return StreamingHttpResponse(
                iter([f"data: {json.dumps({'type': 'error', 'message': chat_limit.message, 'upgrade_required': chat_limit.upgrade_required})}\n\n"]),
                content_type='text/event-stream',
            )
        return JsonResponse(chat_limit.as_error(), status=402)
    
    # STEP 1: Check cache first (< 50ms) ⚡
    cached = get_cached_response(question, str(ai_owner_id))
    if cached:
        # INSTANT RESPONSE! Return cached data immediately
        cache_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Cache HIT! Response in {cache_time_ms}ms")

        def generate_cached_response():
            try:
                conversation = Conversation.objects.create(
                    ai_owner=ai_owner,
                    family_member=family_member,
                    question_text=question,
                    response_text=cached['text'],
                    audio_url=cached.get('audio'),
                    response_time_ms=cache_time_ms,
                    gpt_tokens_used=cached.get('tokens', 0),
                    elevenlabs_characters_used=0,
                )
                conversation_id = str(conversation.id)
                record_chat_message(ai_owner, conversation_id)
                if family_member:
                    family_member.increment_conversation_count()

                yield f"data: {json.dumps({'type': 'text_chunk', 'content': cached['text'], 'timestamp': round(time.time() - start_time, 3), 'cached': True})}\n\n"
                yield f"data: {json.dumps({'type': 'text_complete', 'full_text': cached['text'], 'tokens': cached.get('tokens', 0), 'stream_time_ms': cache_time_ms, 'cached': True})}\n\n"

                if cached.get('audio'):
                    yield f"data: {json.dumps({'type': 'audio_ready', 'audio_url': cached['audio'], 'conversation_id': conversation_id, 'cached': True})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'audio_unavailable', 'message': 'Voice is not cached for this response', 'conversation_id': conversation_id, 'cached': True})}\n\n"

                yield f"data: {json.dumps({'type': 'complete', 'conversation_id': conversation_id, 'total_time_ms': cache_time_ms, 'cached': True})}\n\n"
            finally:
                from django.db import connections
                for conn_name in connections:
                    try:
                        connections[conn_name].close()
                    except Exception:
                        pass

        response = StreamingHttpResponse(
            generate_cached_response(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
    
    # STEP 2: Stream response generator
    def generate_response() -> Generator[str, None, None]:
        """
        Generator function that streams GPT-4o response in real-time.
        Yields Server-Sent Events format.
        """
        response_text = ""
        tokens_used = 0
        conversation_id = None
        
        try:
            # Build optimized context
            context_builder = RAGContextBuilder(ai_owner)
            system_message = context_builder.build_optimized_context(
                question=question,
                family_member=family_member
            )
            
            # Import OpenAI (lazy import)
            try:
                import openai
                from decouple import config
                
                api_key = config('OPENAI_API_KEY', default='')
                if not api_key:
                    logger.error("OpenAI API key is not configured")
                    yield f"data: {json.dumps({'type': 'error', 'message': 'AI service is not configured'})}\n\n"
                    return
                
                # Initialize client (Python 3.14 compat fix)
                import httpx
                http_client = httpx.Client(timeout=300.0)
                client = openai.OpenAI(
                    api_key=api_key,
                    http_client=http_client
                )
                
            except ImportError:
                yield f"data: {json.dumps({'type': 'error', 'message': 'OpenAI library not installed'})}\n\n"
                return
            
            # STEP 3: Stream GPT-4o response (200-400ms to first token) ⚡
            stream_start = time.time()
            first_token_time = None
            
            stream = client.chat.completions.create(
                model="gpt-4o",  # FAST! 109 tokens/sec, 50% cheaper
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": question}
                ],
                temperature=0.7,
                max_tokens=300,  # Reduced for speed (2-3 sentences)
                stream=True
            )
            
            # Stream text chunks to client as they arrive
            chunk_count = 0
            for chunk in stream:
                # Record first token time
                if chunk_count == 0 and first_token_time is None:
                    first_token_time = int((time.time() - stream_start) * 1000)
                    logger.info(f"First token in {first_token_time}ms ⚡")
                
                # Check for content
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    
                    if hasattr(delta, 'content') and delta.content:
                        text_chunk = delta.content
                        response_text += text_chunk
                        chunk_count += 1
                        
                        # Send chunk to frontend immediately
                        timestamp = time.time() - start_time
                        yield f"data: {json.dumps({'type': 'text_chunk', 'content': text_chunk, 'timestamp': round(timestamp, 3)})}\n\n"
                
                # Check for usage info (at the end) -- NOTE: Requires stream_options={"include_usage": True}
                if hasattr(chunk, 'usage') and chunk.usage:
                    tokens_used = chunk.usage.total_tokens
            
            # Fallback token calculation if usage not returned (e.g. older library)
            if tokens_used == 0:
                # Estimate: ~4 chars per token for English text
                # Input estimate: ~200 tokens (system + context + question)
                # Output estimate: response length / 4
                response_tokens = len(response_text) / 4
                tokens_used = int(200 + response_tokens)
                logger.info(f"Estimated tokens used: {tokens_used}")
            
            stream_time_ms = int((time.time() - stream_start) * 1000)
            logger.info(f"Full text streamed in {stream_time_ms}ms ({chunk_count} chunks)")
            
            # STEP 4: Signal text complete
            yield f"data: {json.dumps({'type': 'text_complete', 'full_text': response_text, 'tokens': tokens_used, 'stream_time_ms': stream_time_ms})}\n\n"
            
            # STEP 5: Save conversation to database
            conversation = Conversation.objects.create(
                ai_owner=ai_owner,
                family_member=family_member,
                question_text=question,
                response_text=response_text,
                audio_url=None,  # Will be updated by background task
                response_time_ms=stream_time_ms,
                gpt_tokens_used=tokens_used,
                elevenlabs_characters_used=0  # Will be updated later
            )
            conversation_id = str(conversation.id)
            record_chat_message(ai_owner, conversation_id)
            
            # Track OpenAI usage
            cost = calculate_gpt4o_cost(tokens_used)
            APIUsageTracking.objects.create(
                user=ai_owner,
                api_provider='openai',
                operation='chat',
                tokens_used=tokens_used,
                cost_usd=cost,
                response_time_ms=stream_time_ms,
                success=True
            )
            
            # Update family member stats
            family_member.increment_conversation_count()
            
            # STEP 6: Generate audio - Try async first, fall back to sync if Celery unavailable
            voice_limit = can_generate_voice_response(ai_owner)
            if not voice_limit.allowed:
                yield f"data: {json.dumps({'type': 'audio_unavailable', 'message': voice_limit.message, 'upgrade_required': voice_limit.upgrade_required})}\n\n"
            elif ai_owner.ai_config and ai_owner.ai_config.voice_clone_id:
                try:
                    if is_celery_available():
                        # Queue async audio generation only when a worker is reachable.
                        audio_task = generate_audio_async.apply_async(
                            kwargs={
                                'response_text': response_text,
                                'voice_id': ai_owner.ai_config.voice_clone_id,
                                'conversation_id': conversation_id,
                                'ai_owner_id': str(ai_owner.id),
                            },
                            queue='voice',
                        )

                        yield f"data: {json.dumps({'type': 'audio_processing', 'task_id': audio_task.id, 'conversation_id': conversation_id, 'estimated_time_ms': 10000})}\n\n"
                    else:
                        raise RuntimeError('celery_worker_unavailable')

                except Exception as celery_error:
                    # Celery/Redis not available - generate audio synchronously.
                    logger.warning("Celery unavailable (%s), generating audio synchronously", celery_error.__class__.__name__)
                    yield f"data: {json.dumps({'type': 'audio_generating', 'message': 'Generating voice...', 'conversation_id': conversation_id})}\n\n"
                    
                    # Generate synchronously (blocks but ensures audio is delivered)
                    audio_result = generate_audio_sync(
                        response_text=response_text,
                        voice_id=ai_owner.ai_config.voice_clone_id,
                        conversation_id=conversation_id,
                        ai_owner_id=str(ai_owner.id)
                    )
                    
                    if audio_result.get('success') and audio_result.get('audio_url'):
                        yield f"data: {json.dumps({'type': 'audio_ready', 'audio_url': audio_result['audio_url'], 'conversation_id': conversation_id, 'generation_time_ms': audio_result.get('total_time_ms', 0)})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'audio_failed', 'error': audio_result.get('error', 'Audio generation failed'), 'conversation_id': conversation_id})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'audio_unavailable', 'message': 'Voice not configured'})}\n\n"
            
            # STEP 7: Cache for future requests (7 days)
            total_time_ms = int((time.time() - start_time) * 1000)
            cache_response(
                question=question,
                ai_owner_id=str(ai_owner_id),
                response_text=response_text,
                audio_url=None,  # Will be updated when audio is ready
                tokens_used=tokens_used,
                response_time_ms=total_time_ms
            )
            
            # Final success event
            yield f"data: {json.dumps({'type': 'complete', 'conversation_id': conversation_id, 'total_time_ms': total_time_ms})}\n\n"
            
        except Exception as e:
            logger.error("Streaming chat error: %s", e.__class__.__name__, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Unable to complete chat response'})}\n\n"
        finally:
            # CRITICAL: Close database connections after streaming
            # This is essential for Supabase free tier to avoid connection exhaustion
            from django.db import connections
            for conn_name in connections:
                try:
                    connections[conn_name].close()
                except Exception:
                    pass
    
    # Return streaming response
    response = StreamingHttpResponse(
        generate_response(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
    
    return response


# ============================================================================
# CONVERSATION HISTORY ENDPOINTS
# ============================================================================

class ConversationPagination(PageNumberPagination):
    """Custom pagination for conversations."""
    page_size = 20
    page_size_query_param = 'per_page'
    max_page_size = 100


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([])  # No throttle - called frequently on page loads
def get_conversation_history(request):
    """
    Get conversation history for an AI owner.
    
    Query Parameters:
        ai_owner_id (required): UUID of AI owner
        page (optional): Page number (default: 1)
        per_page (optional): Results per page (default: 20, max: 100)
    
    Response:
        {
            "count": 47,
            "next": "url",
            "previous": "url",
            "results": [
                {
                    "id": "uuid",
                    "question": "...",
                    "response": "...",
                    "audio_url": "...",
                    "created_at": "...",
                    "response_time_ms": 1200,
                    "user_rating": 5,
                    "user_feedback": "..."
                }
            ]
        }
    """
    ai_owner_id = request.query_params.get('ai_owner_id')
    
    if not ai_owner_id:
        return Response(
            {'error': 'ai_owner_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        ai_owner = User.objects.get(id=ai_owner_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'AI owner not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Validate access using Supabase authenticated user
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Get User object from database using supabase_user.id
    try:
        requesting_user = User.objects.get(id=str(request.supabase_user.id))
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    has_access, family_member, error_msg = validate_chat_access(ai_owner, requesting_user)
    
    if not has_access:
        return Response(
            {'error': error_msg},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get conversations (strictly filtered by family_member for isolation)
    # Even AI Owner has a 'self' family_member record for their own chats
    if family_member:
        conversations = Conversation.objects.filter(
            ai_owner=ai_owner,
            family_member=family_member
        ).order_by('-created_at')
    else:
        # Fallback: AI owner sees all conversations (only if 'self' member missing)
        conversations = Conversation.objects.filter(
            ai_owner=ai_owner
        ).select_related('family_member').order_by('-created_at')
    
    # Paginate
    paginator = ConversationPagination()
    paginated_conversations = paginator.paginate_queryset(conversations, request)
    
    # Serialize
    results = []
    for conv in paginated_conversations:
        results.append({
            'id': str(conv.id),
            'ai_owner': {
                'id': str(conv.ai_owner.id),
                'full_name': conv.ai_owner.full_name
            },
            'family_member': {
                'id': str(conv.family_member.id),
                'full_name': conv.family_member.full_name
            } if conv.family_member else None,
            'question_text': conv.question_text,
            'response_text': conv.response_text,
            'audio_url': conv.audio_url,
            'created_at': conv.created_at.isoformat(),
            'response_time_ms': conv.response_time_ms,
            'gpt_tokens_used': conv.gpt_tokens_used,
            'user_rating': conv.user_rating,
            'user_feedback': conv.user_feedback
        })
    
    return paginator.get_paginated_response(results)


@api_view(['POST'])
@permission_classes([AllowAny])
def rate_conversation(request, conversation_id):
    """
    Rate a conversation.
    
    Request Body:
        {
            "rating": 5,  # 1-5 stars
            "feedback": "This was so helpful!"  # Optional
        }
    
    Response:
        {
            "message": "Rating saved",
            "conversation_id": "uuid",
            "rating": 5
        }
    """
    rating = request.data.get('rating')
    feedback = request.data.get('feedback', '')
    
    # Validate rating
    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        return Response(
            {'error': 'Rating must be an integer between 1 and 5'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate feedback length
    if feedback and len(feedback) > 1000:
        return Response(
            {'error': 'Feedback too long (max 1000 characters)'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get conversation
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        return Response(
            {'error': 'Conversation not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Validate ownership using Supabase authenticated user
    if not hasattr(request, 'supabase_user') or not request.supabase_user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Get User object from database using supabase_user.id
    try:
        requesting_user = User.objects.get(id=str(request.supabase_user.id))
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if conversation.family_member.user_account != requesting_user:
        return Response(
            {'error': 'You can only rate your own conversations'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Update rating
    conversation.user_rating = rating
    conversation.user_feedback = feedback
    conversation.save(update_fields=['user_rating', 'user_feedback'])
    
    logger.info(f"Conversation {conversation_id} rated {rating} stars")
    
    return Response({
        'message': 'Rating saved successfully',
        'conversation_id': str(conversation.id),
        'rating': rating
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_audio_status(request, task_id):
    """
    Check status of async audio generation task.
    Frontend polls this endpoint to know when audio is ready.
    
    Response:
        {
            "status": "pending" | "processing" | "complete" | "failed",
            "audio_url": "..." (if complete),
            "error": "..." (if failed),
            "elapsed_time_ms": 450
        }
    """
    from celery.result import AsyncResult

    conversation_id = request.query_params.get('conversation_id')

    def conversation_audio_response():
        if not conversation_id:
            return None

        try:
            conversation = Conversation.objects.only('audio_url', 'elevenlabs_characters_used').get(id=conversation_id)
        except Conversation.DoesNotExist:
            return None

        if conversation.audio_url:
            return Response({
                'status': 'complete',
                'audio_url': conversation.audio_url,
                'conversation_id': conversation_id,
                'source': 'conversation',
            })

        return None

    db_response = conversation_audio_response()
    if db_response:
        return db_response

    try:
        task_result = AsyncResult(task_id)
    except Exception as exc:
        logger.warning("Could not read audio task status: %s", exc.__class__.__name__)
        return Response({
            'status': 'processing',
            'task_id': task_id,
            'conversation_id': conversation_id,
        })

    if task_result.ready():
        if task_result.successful():
            result = task_result.result or {}
            if not isinstance(result, dict):
                return Response({
                    'status': 'failed',
                    'error': 'Audio generation returned an invalid result',
                    'conversation_id': conversation_id,
                })

            if not result.get('success', True):
                return Response({
                    'status': 'failed',
                    'error': result.get('error', 'Audio generation failed'),
                    'upgrade_required': result.get('upgrade_required', False),
                    'conversation_id': conversation_id,
                })

            if result.get('audio_url'):
                return Response({
                    'status': 'complete',
                    'audio_url': result.get('audio_url'),
                    'generation_time_ms': result.get('generation_time_ms'),
                    'total_time_ms': result.get('total_time_ms'),
                    'conversation_id': conversation_id,
                    'source': 'task_result',
                })

            db_response = conversation_audio_response()
            if db_response:
                return db_response

            return Response({
                'status': 'failed',
                'error': 'Audio generation finished without an audio file',
                'conversation_id': conversation_id,
            })

        return Response({
            'status': 'failed',
            'error': str(task_result.result),
            'conversation_id': conversation_id,
        })

    return Response({
        'status': 'processing',
        'task_id': task_id,
        'conversation_id': conversation_id,
    })
