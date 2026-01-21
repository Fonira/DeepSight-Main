"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🚦 RATE LIMITER MIDDLEWARE v2.0 — Protection contre les abus                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 📊 Sliding window rate limiting (précis)                                       ║
║  • 🎯 Limites par endpoint, user, IP                                              ║
║  • 🔑 Limites différenciées par plan utilisateur                                  ║
║  • 📈 Headers de quota standards (X-RateLimit-*)                                  ║
║  • 💾 Backend Redis avec fallback in-memory                                       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import time
import asyncio
from datetime import datetime
from typing import Optional, Callable, Dict, Any, Tuple
from dataclasses import dataclass
from functools import wraps

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Limites par défaut (requests/window_seconds)
DEFAULT_LIMITS = {
    "global": (1000, 60),      # 1000 req/min global
    "auth": (5, 60),           # 5 tentatives de login/min
    "analysis": (10, 60),      # 10 analyses/min
    "chat": (30, 60),          # 30 messages chat/min
    "api": (100, 60),          # 100 appels API/min
    "export": (20, 60),        # 20 exports/min
    "tts": (10, 60),           # 10 TTS/min
}

# Limites par plan utilisateur (multiplicateur)
PLAN_MULTIPLIERS = {
    "free": 1.0,
    "starter": 2.0,
    "pro": 5.0,
    "expert": 10.0,
    "unlimited": 100.0,  # Effectivement illimité
}

# Endpoints et leurs catégories de rate limit
ENDPOINT_CATEGORIES = {
    "/api/auth/login": "auth",
    "/api/auth/register": "auth",
    "/api/videos/analyze": "analysis",
    "/api/videos/stream": "analysis",
    "/api/chat": "chat",
    "/api/chat/message": "chat",
    "/api/export": "export",
    "/api/tts": "tts",
}

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RateLimitResult:
    """Résultat d'une vérification de rate limit"""
    allowed: bool
    limit: int
    remaining: int
    reset_at: int  # Unix timestamp
    retry_after: Optional[int] = None  # Seconds until reset


@dataclass
class RateLimitConfig:
    """Configuration d'un rate limiter"""
    requests: int
    window_seconds: int
    key_prefix: str = ""
    

# ═══════════════════════════════════════════════════════════════════════════════
# 💾 RATE LIMITER BACKEND
# ═══════════════════════════════════════════════════════════════════════════════

class RateLimiterBackend:
    """Backend abstrait pour le rate limiting"""
    
    async def check_and_increment(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> RateLimitResult:
        raise NotImplementedError


class InMemoryBackend(RateLimiterBackend):
    """Backend in-memory avec sliding window simplifié"""
    
    def __init__(self):
        self.requests: Dict[str, list] = {}
        self._lock = asyncio.Lock()
    
    async def check_and_increment(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> RateLimitResult:
        async with self._lock:
            now = time.time()
            window_start = now - window_seconds
            
            # Initialize or clean old requests
            if key not in self.requests:
                self.requests[key] = []
            
            # Remove expired timestamps
            self.requests[key] = [ts for ts in self.requests[key] if ts > window_start]
            
            current_count = len(self.requests[key])
            reset_at = int(now + window_seconds)
            
            if current_count >= limit:
                # Rate limited
                oldest = min(self.requests[key]) if self.requests[key] else now
                retry_after = int(oldest + window_seconds - now) + 1
                
                return RateLimitResult(
                    allowed=False,
                    limit=limit,
                    remaining=0,
                    reset_at=reset_at,
                    retry_after=retry_after,
                )
            
            # Add current request
            self.requests[key].append(now)
            
            return RateLimitResult(
                allowed=True,
                limit=limit,
                remaining=limit - current_count - 1,
                reset_at=reset_at,
            )


class RedisBackend(RateLimiterBackend):
    """Backend Redis avec sliding window précis"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def check_and_increment(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> RateLimitResult:
        now = time.time()
        window_start = now - window_seconds
        
        # Use Redis sorted set for sliding window
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current entries
        pipe.zcount(key, window_start, now)
        
        # Add current request
        pipe.zadd(key, {str(now): now})
        
        # Set expiry
        pipe.expire(key, window_seconds + 1)
        
        results = await pipe.execute()
        current_count = results[1]
        
        reset_at = int(now + window_seconds)
        
        if current_count >= limit:
            # Rate limited - remove the request we just added
            await self.redis.zrem(key, str(now))
            
            # Find retry_after
            oldest = await self.redis.zrange(key, 0, 0, withscores=True)
            retry_after = int(oldest[0][1] + window_seconds - now) + 1 if oldest else window_seconds
            
            return RateLimitResult(
                allowed=False,
                limit=limit,
                remaining=0,
                reset_at=reset_at,
                retry_after=retry_after,
            )
        
        return RateLimitResult(
            allowed=True,
            limit=limit,
            remaining=limit - current_count - 1,
            reset_at=reset_at,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 RATE LIMITER SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class RateLimiter:
    """
    Service de rate limiting avec support multi-backend.
    """
    
    _instance: Optional["RateLimiter"] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self.backend: RateLimiterBackend = InMemoryBackend()
        self._redis_available = False
    
    async def init_redis(self, redis_url: str):
        """Initialize Redis backend"""
        try:
            import redis.asyncio as redis
            client = redis.from_url(redis_url, decode_responses=True)
            await client.ping()
            self.backend = RedisBackend(client)
            self._redis_available = True
            print("✅ [RATE_LIMITER] Redis backend initialized", flush=True)
        except Exception as e:
            print(f"⚠️ [RATE_LIMITER] Redis unavailable, using in-memory: {e}", flush=True)
    
    def _get_limit_for_category(
        self, 
        category: str, 
        user_plan: str = "free"
    ) -> Tuple[int, int]:
        """Get rate limit (requests, window) for a category and plan"""
        base_limit, window = DEFAULT_LIMITS.get(category, DEFAULT_LIMITS["global"])
        multiplier = PLAN_MULTIPLIERS.get(user_plan, 1.0)
        return int(base_limit * multiplier), window
    
    async def check(
        self,
        key: str,
        category: str = "global",
        user_plan: str = "free",
    ) -> RateLimitResult:
        """
        Check if request is allowed and increment counter.
        
        Args:
            key: Unique identifier (e.g., user_id, IP)
            category: Rate limit category
            user_plan: User's subscription plan
        """
        limit, window = self._get_limit_for_category(category, user_plan)
        full_key = f"ratelimit:{category}:{key}"
        
        return await self.backend.check_and_increment(full_key, limit, window)
    
    async def check_request(
        self,
        request: Request,
        category: Optional[str] = None,
    ) -> RateLimitResult:
        """
        Check rate limit for a FastAPI request.
        
        Automatically extracts user info and IP.
        """
        # Get category from endpoint if not provided
        if category is None:
            path = request.url.path
            category = ENDPOINT_CATEGORIES.get(path, "global")
        
        # Get user info
        user = getattr(request.state, "user", None)
        user_id = user.id if user else None
        user_plan = user.plan if user else "free"
        
        # Build key: prefer user_id, fallback to IP
        if user_id:
            key = f"user:{user_id}"
        else:
            client_ip = request.client.host if request.client else "unknown"
            # Handle proxied requests
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
            key = f"ip:{client_ip}"
        
        return await self.check(key, category, user_plan)


# Singleton instance
rate_limiter = RateLimiter()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FASTAPI MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware FastAPI pour le rate limiting automatique.
    """
    
    def __init__(self, app, exclude_paths: list = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/health",
            "/docs",
            "/openapi.json",
            "/static",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip excluded paths
        path = request.url.path
        if any(path.startswith(excluded) for excluded in self.exclude_paths):
            return await call_next(request)
        
        # Check rate limit
        result = await rate_limiter.check_request(request)
        
        if not result.allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": result.retry_after,
                },
                headers={
                    "X-RateLimit-Limit": str(result.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(result.reset_at),
                    "Retry-After": str(result.retry_after),
                },
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(result.limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        response.headers["X-RateLimit-Reset"] = str(result.reset_at)
        
        return response


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 DECORATOR FOR ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

def rate_limit(
    category: str = "global",
    requests: Optional[int] = None,
    window_seconds: Optional[int] = None,
):
    """
    Decorator for rate limiting specific routes.
    
    Usage:
        @router.post("/analyze")
        @rate_limit(category="analysis")
        async def analyze(request: Request):
            ...
        
        # Or with custom limits:
        @rate_limit(requests=5, window_seconds=60)
        async def limited_endpoint():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find request in args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")
            
            if not request:
                # No request found, skip rate limiting
                return await func(*args, **kwargs)
            
            # Check rate limit
            result = await rate_limiter.check_request(request, category)
            
            if not result.allowed:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "message": "Rate limit exceeded",
                        "retry_after": result.retry_after,
                    },
                    headers={
                        "Retry-After": str(result.retry_after),
                    },
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 FASTAPI INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

async def init_rate_limiter(redis_url: Optional[str] = None):
    """Initialize rate limiter with Redis if available"""
    if redis_url:
        await rate_limiter.init_redis(redis_url)


def add_rate_limiting(app, exclude_paths: list = None):
    """Add rate limiting middleware to FastAPI app"""
    app.add_middleware(RateLimitMiddleware, exclude_paths=exclude_paths)


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 DEPENDENCY FOR ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

async def check_rate_limit(
    request: Request,
    category: str = "global",
) -> RateLimitResult:
    """
    FastAPI dependency for checking rate limits.
    
    Usage:
        @router.post("/analyze")
        async def analyze(
            request: Request,
            rate_check: RateLimitResult = Depends(lambda r: check_rate_limit(r, "analysis"))
        ):
            ...
    """
    result = await rate_limiter.check_request(request, category)
    
    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(result.retry_after)},
        )
    
    return result
