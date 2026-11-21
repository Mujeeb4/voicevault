"""The client IP as set by our own proxy (Traefik), never a value the client can supply."""


def client_ip(request) -> str:
    """
    Traefik replaces X-Forwarded-For with the connecting IP, so the last entry is the one our
    proxy wrote. Earlier entries (if a proxy ever appends) could come from the client.
    Matches REST_FRAMEWORK['NUM_PROXIES'] = 1 used for rate limiting.
    """
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[-1].strip()
    return request.META.get('REMOTE_ADDR', '')
