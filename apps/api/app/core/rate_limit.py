"""Per-IP rate limiting (slowapi, in-memory).

Single-instance MVP: in-memory storage is fine. If you scale to multiple
API replicas, switch to a Redis-backed storage or terminate rate limits
at the reverse proxy / WAF instead.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
)
