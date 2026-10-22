"""
Custom exception handler for Django REST Framework.
Optimized for Supabase free tier with better database error handling.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import OperationalError, InterfaceError
from django.db.utils import DatabaseError
import logging
from utils.security import safe_exception_name

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that formats errors consistently.
    Includes special handling for database connection errors (Supabase free tier).
    """
    # Handle database connection errors first
    if isinstance(exc, (OperationalError, InterfaceError)):
        error_str = str(exc).lower()
        
        # Check for common Supabase connection limit errors
        if any(msg in error_str for msg in [
            'too many clients',
            'connection refused', 
            'connection timed out',
            'server closed the connection',
            'connection already closed',
            'no connection to the server',
            'connection terminated',
            'ssl connection has been closed',
        ]):
            logger.error("Database connection error (likely Supabase limit): %s", safe_exception_name(exc))
            
            # Try to close all connections to free up the pool
            try:
                from django.db import connections
                for conn in connections:
                    connections[conn].close()
            except Exception:
                pass
            
            return Response(
                {
                    'error': 'service_busy',
                    'message': 'The service is temporarily busy. Please try again in a few seconds.',
                    'retry_after': 3,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                headers={'Retry-After': '3'}
            )
        
        # Other database errors
        logger.error("Database error: %s", safe_exception_name(exc), exc_info=True)
        return Response(
            {
                'error': 'database_error',
                'message': 'A database error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Handle other database errors
    if isinstance(exc, DatabaseError):
        logger.error("Database error: %s", safe_exception_name(exc), exc_info=True)
        return Response(
            {
                'error': 'database_error',
                'message': 'A database error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # If response is None, it means DRF didn't handle it
    if response is None:
        # Log the error
        logger.error("Unhandled exception: %s", safe_exception_name(exc), exc_info=True)
        
        # Return generic error response
        return Response(
            {
                'error': 'internal_error',
                'message': 'An internal error occurred. Please try again later.',
                'details': None
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Customize the response format
    if isinstance(response.data, dict):
        custom_response = {
            'error': 'validation_error' if response.status_code == 400 else 'error',
            'message': 'Request failed',
            'details': response.data
        }
        response.data = custom_response
    
    return response


class AINotReadyException(Exception):
    """Raised when AI is not ready for chat."""
    pass


class AccessDeniedException(Exception):
    """Raised when user doesn't have access to resource."""
    pass


class InsufficientAudioException(Exception):
    """Raised when there's not enough audio for processing."""
    pass


class APIFailureException(Exception):
    """Raised when external API call fails."""
    pass
