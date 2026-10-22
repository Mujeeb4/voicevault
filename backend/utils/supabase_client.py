"""
Supabase client utility for storage operations.
Optimized for Supabase free tier with connection reuse and rate limiting.
"""
from django.conf import settings
from supabase import create_client, Client
from typing import Optional, BinaryIO
import logging
import time
import httpx
import threading
import shutil
from pathlib import Path
from urllib.parse import quote

logger = logging.getLogger(__name__)

# Global client cache to avoid creating new connections for each request
_client_cache = {}
_client_lock = threading.Lock()
_last_request_time = 0
_min_request_interval = 0.1  # 100ms minimum between requests to avoid rate limits


def _use_local_storage() -> bool:
    return getattr(settings, 'STORAGE_BACKEND', 'supabase').lower() == 'local'


def _local_storage_path(bucket: str, file_path: str) -> Path:
    relative_path = Path(file_path)
    if relative_path.is_absolute() or '..' in relative_path.parts:
        raise ValueError("Invalid storage path")
    return Path(settings.MEDIA_ROOT) / 'storage' / bucket / relative_path


def _local_public_url(bucket: str, file_path: str) -> str:
    base_url = getattr(settings, 'LOCAL_STORAGE_PUBLIC_URL', 'http://localhost:8000').rstrip('/')
    media_url = settings.MEDIA_URL.strip('/')
    quoted_path = quote(file_path, safe='/')
    return f"{base_url}/{media_url}/storage/{bucket}/{quoted_path}"


def get_supabase_client(timeout: int = 300, force_new: bool = False) -> Client:
    """
    Initialize and return Supabase client with custom timeout.
    Uses connection caching to reduce the number of connections created.
    
    Args:
        timeout: Request timeout in seconds (default: 300 = 5 minutes)
        force_new: Force creating a new client instead of using cache
    
    Returns:
        Client: Initialized Supabase client
    """
    global _client_cache
    
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
    
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and Key must be configured in settings")
    
    cache_key = f"{timeout}"
    
    # Check cache first (thread-safe)
    with _client_lock:
        if not force_new and cache_key in _client_cache:
            client = _client_cache[cache_key]
            logger.debug(f"Reusing cached Supabase client (timeout={timeout})")
            return client
    
    # Create new client
    client = create_client(supabase_url, supabase_key)
    
    # Override the storage client's httpx client timeout
    try:
        if hasattr(client.storage, '_client'):
            client.storage._client.timeout = httpx.Timeout(timeout, read=timeout, write=timeout, connect=30.0)
    except Exception as e:
        logger.debug("Could not set custom timeout: %s", e.__class__.__name__)
    
    # Cache the client
    with _client_lock:
        _client_cache[cache_key] = client
    
    logger.debug(f"Created new Supabase client (timeout={timeout})")
    return client


def _rate_limit_check():
    """
    Simple rate limiting to avoid overwhelming Supabase storage API.
    Waits if requests are coming too fast.
    """
    global _last_request_time
    
    current_time = time.time()
    time_since_last = current_time - _last_request_time
    
    if time_since_last < _min_request_interval:
        sleep_time = _min_request_interval - time_since_last
        logger.debug(f"Rate limiting: sleeping {sleep_time:.3f}s")
        time.sleep(sleep_time)
    
    _last_request_time = time.time()


def upload_file_to_supabase(bucket: str, file_path: str, file_object: BinaryIO, max_retries: int = 3) -> Optional[str]:
    """
    Upload file to Supabase Storage with retry logic and rate limiting.
    
    Args:
        bucket: Storage bucket name
        file_path: Path/filename in storage (e.g., "user-id/question_1.webm")
        file_object: File object to upload
        max_retries: Maximum number of retry attempts (default: 3)
        
    Returns:
        str: Public URL of uploaded file, or None if failed
    """
    # Read file content once
    file_content = file_object.read()
    file_size_mb = len(file_content) / (1024 * 1024)

    if _use_local_storage():
        target_path = _local_storage_path(bucket, file_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(file_content)
        logger.info(f"File stored locally at {target_path}")
        return get_file_url(bucket, file_path)

    # Apply rate limiting
    _rate_limit_check()
    
    # Determine content type from file path
    content_type = "audio/mpeg"  # default
    if file_path.endswith('.mp3'):
        content_type = "audio/mpeg"
    elif file_path.endswith('.wav'):
        content_type = "audio/wav"
    elif file_path.endswith('.webm'):
        content_type = "audio/webm"
    elif file_path.endswith('.m4a'):
        content_type = "audio/mp4"
    
    for attempt in range(max_retries):
        try:
            # Create client with timeout based on file size (min 60s, +30s per MB)
            timeout = max(60, int(30 + file_size_mb * 30))
            logger.info(f"Upload attempt {attempt + 1}/{max_retries} with {timeout}s timeout for {file_size_mb:.2f}MB file")
            
            client = get_supabase_client(timeout=timeout)
            
            # Ensure bucket exists (only on first attempt)
            if attempt == 0:
                try:
                    buckets = client.storage.list_buckets()
                    bucket_names = [b.name for b in buckets]
                    
                    if bucket not in bucket_names:
                        logger.info(f"Creating bucket: {bucket}")
                        client.storage.create_bucket(
                            bucket,
                            options={
                                'public': True,
                                'fileSizeLimit': 52428800  # 50MB
                            }
                        )
                except Exception as bucket_error:
                    logger.warning(f"Bucket check/create warning: {str(bucket_error)}")
            
            # Check if file already exists and remove it
            try:
                client.storage.from_(bucket).remove([file_path])
                logger.info(f"Removed existing file: {file_path}")
            except:
                pass  # File doesn't exist, that's fine
            
            # Upload to Supabase Storage
            try:
                response = client.storage.from_(bucket).upload(
                    path=file_path,
                    file=file_content,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
                logger.info(f"Upload response: {response}")
            except Exception as upload_error:
                error_str = str(upload_error)
                
                # Check if it's a timeout error
                if 'timeout' in error_str.lower() or 'WriteTimeout' in error_str:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                        logger.warning(f"Upload timeout, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise Exception(f"Upload timed out after {max_retries} attempts. Check your internet connection or try a smaller file.")
                
                # For other errors, log and re-raise
                logger.error(f"Upload error: {error_str}")
                raise
            
            # Get public URL
            public_url = get_file_url(bucket, file_path)
            
            logger.info(f"File uploaded successfully to {bucket}/{file_path}")
            return public_url
            
        except Exception as e:
            error_str = str(e)
            
            # If it's the last attempt, raise the error
            if attempt >= max_retries - 1:
                logger.error(f"Error uploading file to Supabase after {max_retries} attempts: {error_str}")
                import traceback
                logger.error("Supabase upload traceback suppressed")
                
                # Provide helpful error message
                if 'timeout' in error_str.lower():
                    raise Exception(f"Upload timed out. Your file ({file_size_mb:.2f}MB) may be too large or your internet connection too slow. Try: 1) Compress the file further, 2) Check your internet connection, 3) Use a smaller audio file for testing")
                else:
                    raise Exception(f"Failed to upload file: {error_str}")
            
            # Otherwise, wait and retry
            wait_time = 2 ** attempt
            logger.warning(f"Attempt {attempt + 1} failed: {error_str}. Retrying in {wait_time}s...")
            time.sleep(wait_time)


def delete_file_from_supabase(bucket: str, file_path: str) -> bool:
    """
    Delete file from Supabase Storage.
    
    Args:
        bucket: Storage bucket name
        file_path: Path/filename in storage
        
    Returns:
        bool: True if deleted successfully, False otherwise
    """
    try:
        if _use_local_storage():
            target_path = _local_storage_path(bucket, file_path)
            if target_path.exists():
                target_path.unlink()
            logger.info(f"Local file deleted from {bucket}/{file_path}")
            return True

        client = get_supabase_client()
        
        response = client.storage.from_(bucket).remove([file_path])
        
        logger.info(f"File deleted successfully from {bucket}/{file_path}")
        return True
        
    except Exception as e:
        logger.error("Error deleting file from Supabase: %s", e.__class__.__name__)
        return False


def get_file_url(bucket: str, file_path: str) -> str:
    """
    Get public URL for a file in Supabase Storage.
    
    Args:
        bucket: Storage bucket name
        file_path: Path/filename in storage
        
    Returns:
        str: Public URL of the file
    """
    try:
        if _use_local_storage():
            return _local_public_url(bucket, file_path)

        client = get_supabase_client()
        
        # Get public URL
        public_url = client.storage.from_(bucket).get_public_url(file_path)
        
        return public_url
        
    except Exception as e:
        logger.error("Error getting file URL: %s", e.__class__.__name__)
        return ""


def download_file_from_supabase(bucket: str, file_path: str) -> Optional[bytes]:
    """
    Download file from Supabase Storage.
    
    Args:
        bucket: Storage bucket name
        file_path: Path/filename in storage
        
    Returns:
        bytes: File content, or None if failed
    """
    try:
        if _use_local_storage():
            target_path = _local_storage_path(bucket, file_path)
            if not target_path.exists():
                return None
            return target_path.read_bytes()

        client = get_supabase_client()
        
        response = client.storage.from_(bucket).download(file_path)
        
        logger.info(f"File downloaded successfully from {bucket}/{file_path}")
        return response
        
    except Exception as e:
        logger.error("Error downloading file from Supabase: %s", e.__class__.__name__)
        return None


def get_signed_url(bucket: str, file_path: str, expires_in: int = 3600) -> Optional[str]:
    """
    Get signed URL for a file in Supabase Storage.
    
    Args:
        bucket: Storage bucket name
        file_path: Path/filename in storage
        expires_in: Expiration time in seconds (default: 3600 = 1 hour)
        
    Returns:
        str: Signed URL of the file, or None if failed
    """
    try:
        if _use_local_storage():
            return get_file_url(bucket, file_path)

        client = get_supabase_client()
        
        # Get signed URL
        # Note: create_signed_url returns a dict or str depending on library version
        # We handle the dict response which is common
        response = client.storage.from_(bucket).create_signed_url(file_path, expires_in)
        
        if isinstance(response, dict) and 'signedURL' in response:
            return response['signedURL']
        elif isinstance(response, str):
            # Sometimes it might return the URL directly or a different dict structure
            # Check for generic 'signedUrl' vs 'signedURL' casing
            return response
        elif isinstance(response, dict) and 'error' in response:
             logger.error(f"Error creating signed URL: {response['error']}")
             return None
             
        # Fallback for newer client versions that might return an object
        if hasattr(response, 'signed_url'):
            return response.signed_url 
             
        return str(response)
        
    except Exception as e:
        logger.error("Error getting signed URL: %s", e.__class__.__name__)
        return None


def download_file_stream_to_temp(bucket: str, file_path: str, temp_file_path: str) -> bool:
    """
    Stream file from Supabase Storage directly to a temporary file.
    Uses signed URL and requests streaming to minimize memory usage.
    
    Args:
        bucket: Storage bucket name
        file_path: Path/filename in storage
        temp_file_path: Local path to write the streamed content to
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        if _use_local_storage():
            source_path = _local_storage_path(bucket, file_path)
            if not source_path.exists():
                raise FileNotFoundError(f"{bucket}/{file_path}")
            shutil.copyfile(source_path, temp_file_path)
            logger.info(f"Local file copied to {temp_file_path}")
            return True

        import requests
        
        # 1. Get signed URL
        signed_url = get_signed_url(bucket, file_path)
        if not signed_url:
            # Fallback to public URL if signed fails (e.g. public bucket)
            signed_url = get_file_url(bucket, file_path)
            
        if not signed_url:
            raise ValueError(f"Could not generate URL for {bucket}/{file_path}")
            
        logger.info(f"Streaming download from {bucket}/{file_path} to {temp_file_path}")
        
        # 2. Stream using requests
        with requests.get(signed_url, stream=True) as r:
            r.raise_for_status()
            with open(temp_file_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192): 
                    # If you have chunk encoded response uncomment if
                    # and set chunk_size parameter to None.
                    # if chunk: 
                    f.write(chunk)
                    
        logger.info(f"File streamed successfully to {temp_file_path}")
        return True
        
    except Exception as e:
        logger.error("Error streaming file from Supabase: %s", e.__class__.__name__)
        return False
