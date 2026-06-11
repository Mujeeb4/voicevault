"""
Database connection middleware for Supabase free tier optimization.

This middleware ensures that database connections are properly closed after each request
to avoid hitting Supabase's connection limits (13 connections on free tier).
"""
from django.db import connection, connections
from django.utils.deprecation import MiddlewareMixin
import logging
import time

logger = logging.getLogger(__name__)


class DatabaseConnectionMiddleware(MiddlewareMixin):
    """
    Middleware to manage database connections for Supabase free tier.
    
    Key features:
    1. Closes stale connections at the start of each request
    2. Ensures connections are closed after each request
    3. Tracks and logs connection issues for debugging
    """
    
    def process_request(self, request):
        """
        Close any stale connections at the start of a request.
        This prevents "connection already closed" errors.
        """
        try:
            # Close old connections across all configured databases
            for conn_name in connections:
                conn = connections[conn_name]
                # Close connection if it's stale
                if conn.connection is not None:
                    try:
                        conn.ensure_connection()
                    except Exception as e:
                        logger.warning("Closing stale connection %s: %s", conn_name, e.__class__.__name__)
                        conn.close()
        except Exception as e:
            logger.error("Error in process_request connection cleanup: %s", e.__class__.__name__)
        
        return None
    
    def process_response(self, request, response):
        """
        Close all database connections after each request.
        Critical for Supabase free tier with limited connections.
        """
        self._close_connections()
        return response
    
    def process_exception(self, request, exception):
        """
        Close connections even if an exception occurred.
        """
        self._close_connections()
        return None
    
    def _close_connections(self):
        """
        Close all database connections.
        """
        try:
            for conn_name in connections:
                try:
                    connections[conn_name].close()
                except Exception as e:
                    logger.debug("Error closing connection %s: %s", conn_name, e.__class__.__name__)
        except Exception as e:
            logger.error("Error in _close_connections: %s", e.__class__.__name__)


def close_db_connection(func):
    """
    Decorator to ensure database connection is closed after function execution.
    Use this for long-running operations or Celery tasks.
    
    Example:
        @close_db_connection
        def my_task():
            # Do database work
            pass
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        finally:
            try:
                for conn_name in connections:
                    connections[conn_name].close()
            except Exception as e:
                logger.error("Error closing connections in decorator: %s", e.__class__.__name__)
    
    return wrapper


class ConnectionLimitThrottler:
    """
    Simple in-memory throttler to prevent too many concurrent database operations.
    This helps avoid overwhelming Supabase's connection pool.
    """
    
    def __init__(self, max_concurrent: int = 10):
        self.max_concurrent = max_concurrent
        self._active = 0
        self._lock = None  # Will be imported lazily to avoid circular imports
    
    def _get_lock(self):
        if self._lock is None:
            import threading
            self._lock = threading.Lock()
        return self._lock
    
    def acquire(self, timeout: float = 5.0) -> bool:
        """
        Try to acquire a slot for a database operation.
        Returns True if acquired, False if would exceed limit.
        """
        with self._get_lock():
            if self._active >= self.max_concurrent:
                logger.warning(f"Connection throttle: {self._active}/{self.max_concurrent} active")
                return False
            self._active += 1
            return True
    
    def release(self):
        """Release a slot after operation completes."""
        with self._get_lock():
            self._active = max(0, self._active - 1)
    
    def __enter__(self):
        if not self.acquire():
            raise Exception("Too many concurrent database operations")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
        return False


# Global throttler instance - limit to 10 concurrent DB operations
# Supabase free tier allows 13 connections, leave 3 for admin/migrations
db_throttler = ConnectionLimitThrottler(max_concurrent=10)
