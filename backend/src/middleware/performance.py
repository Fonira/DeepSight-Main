"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  ⚡ PERFORMANCE MIDDLEWARE v2.0 — Timing, Compression & Observability              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • ⏱️ Request timing avec headers X-Process-Time                                   ║
║  • 🗜️ Compression Gzip/Brotli automatique                                         ║
║  • 📊 Métriques Prometheus                                                         ║
║  • 📝 Structured logging JSON                                                      ║
║  • 🚦 Rate limiting par IP/User                                                    ║
║  • 🔒 Security headers                                                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import time
import json
import gzip
from datetime import datetime
from typing import Callable, Dict, Any, Optional
from io import BytesIO

from fastapi import Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 METRICS (Prometheus-compatible)
# ═══════════════════════════════════════════════════════════════════════════════

class MetricsCollector:
    """Collecteur de métriques simple (compatible Prometheus)"""
    
    def __init__(self):
        self.request_count = 0
        self.request_latency_sum = 0.0
        self.request_latency_count = 0
        self.error_count = 0
        self.status_codes: Dict[int, int] = {}
        self.endpoints: Dict[str, Dict[str, Any]] = {}
    
    def record_request(
        self, 
        method: str, 
        path: str, 
        status_code: int, 
        latency: float
    ):
        """Enregistre une requête"""
        self.request_count += 1
        self.request_latency_sum += latency
        self.request_latency_count += 1
        
        # Status code distribution
        self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1
        
        if status_code >= 400:
            self.error_count += 1
        
        # Per-endpoint metrics
        endpoint_key = f"{method}:{path}"
        if endpoint_key not in self.endpoints:
            self.endpoints[endpoint_key] = {
                "count": 0,
                "latency_sum": 0.0,
                "errors": 0,
            }
        
        self.endpoints[endpoint_key]["count"] += 1
        self.endpoints[endpoint_key]["latency_sum"] += latency
        if status_code >= 400:
            self.endpoints[endpoint_key]["errors"] += 1
    
    @property
    def avg_latency(self) -> float:
        if self.request_latency_count == 0:
            return 0.0
        return self.request_latency_sum / self.request_latency_count
    
    def to_prometheus(self) -> str:
        """Export au format Prometheus"""
        lines = [
            "# HELP http_requests_total Total HTTP requests",
            "# TYPE http_requests_total counter",
            f"http_requests_total {self.request_count}",
            "",
            "# HELP http_request_duration_seconds HTTP request latency",
            "# TYPE http_request_duration_seconds summary",
            f"http_request_duration_seconds_sum {self.request_latency_sum:.6f}",
            f"http_request_duration_seconds_count {self.request_latency_count}",
            "",
            "# HELP http_errors_total Total HTTP errors",
            "# TYPE http_errors_total counter",
            f"http_errors_total {self.error_count}",
        ]
        
        # Status code breakdown
        lines.extend([
            "",
            "# HELP http_response_status_total HTTP response status codes",
            "# TYPE http_response_status_total counter",
        ])
        for status, count in sorted(self.status_codes.items()):
            lines.append(f'http_response_status_total{{status="{status}"}} {count}')
        
        return "\n".join(lines)
    
    def to_dict(self) -> Dict[str, Any]:
        """Export as dict"""
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "avg_latency_ms": round(self.avg_latency * 1000, 2),
            "status_codes": self.status_codes,
            "top_endpoints": sorted(
                [
                    {
                        "endpoint": k,
                        "count": v["count"],
                        "avg_latency_ms": round((v["latency_sum"] / v["count"]) * 1000, 2) if v["count"] > 0 else 0,
                        "error_rate": round((v["errors"] / v["count"]) * 100, 2) if v["count"] > 0 else 0,
                    }
                    for k, v in self.endpoints.items()
                ],
                key=lambda x: x["count"],
                reverse=True,
            )[:20],
        }


# Singleton
metrics = MetricsCollector()

# ═══════════════════════════════════════════════════════════════════════════════
# ⏱️ TIMING MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class TimingMiddleware(BaseHTTPMiddleware):
    """
    Middleware pour mesurer et logger le temps de traitement des requêtes.
    Ajoute le header X-Process-Time à toutes les réponses.
    """
    
    async def dispatch(
        self, 
        request: Request, 
        call_next: RequestResponseEndpoint
    ) -> Response:
        start_time = time.perf_counter()
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.perf_counter() - start_time
        
        # Add timing header
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        response.headers["X-Request-ID"] = request.headers.get(
            "X-Request-ID", 
            str(int(time.time() * 1000000))
        )
        
        # Record metrics
        metrics.record_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency=process_time,
        )
        
        # Log slow requests (> 1 second)
        if process_time > 1.0:
            print(
                f"⚠️ [SLOW] {request.method} {request.url.path} "
                f"took {process_time:.2f}s",
                flush=True
            )
        
        return response


# ═══════════════════════════════════════════════════════════════════════════════
# 🗜️ COMPRESSION MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Middleware pour compresser les réponses avec Gzip.
    S'applique aux réponses > 1KB avec Accept-Encoding: gzip.
    """
    
    MIN_SIZE = 1024  # 1KB minimum pour compression
    COMPRESSIBLE_TYPES = {
        "application/json",
        "text/html",
        "text/plain",
        "text/css",
        "text/javascript",
        "application/javascript",
        "application/xml",
        "text/xml",
    }
    
    async def dispatch(
        self, 
        request: Request, 
        call_next: RequestResponseEndpoint
    ) -> Response:
        # Check if client accepts gzip
        accept_encoding = request.headers.get("Accept-Encoding", "")
        accepts_gzip = "gzip" in accept_encoding.lower()
        
        if not accepts_gzip:
            return await call_next(request)
        
        # Get response
        response = await call_next(request)
        
        # Skip streaming responses and small responses
        if isinstance(response, StreamingResponse):
            return response
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        base_type = content_type.split(";")[0].strip()
        
        if base_type not in self.COMPRESSIBLE_TYPES:
            return response
        
        # Get body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        
        # Skip if too small
        if len(body) < self.MIN_SIZE:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
        
        # Compress
        compressed = gzip.compress(body, compresslevel=6)
        
        # Only use compression if it actually helps
        if len(compressed) >= len(body):
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
        
        # Return compressed response
        headers = dict(response.headers)
        headers["Content-Encoding"] = "gzip"
        headers["Content-Length"] = str(len(compressed))
        headers["Vary"] = "Accept-Encoding"
        
        return Response(
            content=compressed,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 SECURITY HEADERS MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Ajoute les headers de sécurité à toutes les réponses.
    """
    
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    }
    
    async def dispatch(
        self, 
        request: Request, 
        call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        
        for header, value in self.SECURITY_HEADERS.items():
            if header not in response.headers:
                response.headers[header] = value
        
        return response


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 STRUCTURED LOGGING MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware pour le logging structuré JSON des requêtes.
    """
    
    SKIP_PATHS = {"/health", "/metrics", "/favicon.ico"}
    
    async def dispatch(
        self, 
        request: Request, 
        call_next: RequestResponseEndpoint
    ) -> Response:
        # Skip certain paths
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)
        
        start_time = time.perf_counter()
        
        # Extract request info
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("User-Agent", "")[:100]
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.perf_counter() - start_time
        
        # Build log entry
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": "request",
            "method": request.method,
            "path": request.url.path,
            "query": str(request.query_params) if request.query_params else None,
            "status": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "client_ip": client_ip,
            "user_agent": user_agent,
        }
        
        # Add user ID if available
        if hasattr(request.state, "user_id"):
            log_entry["user_id"] = request.state.user_id
        
        # Log as JSON (one line)
        print(json.dumps(log_entry, ensure_ascii=False), flush=True)
        
        return response


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 RATE LIMITING MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware de rate limiting simple basé sur IP.
    Pour un rate limiting plus robuste, utiliser le cache Redis.
    """
    
    def __init__(
        self, 
        app: ASGIApp, 
        requests_per_minute: int = 60,
        burst: int = 10,
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst = burst
        self.requests: Dict[str, list] = {}
    
    async def dispatch(
        self, 
        request: Request, 
        call_next: RequestResponseEndpoint
    ) -> Response:
        # Get client identifier
        client_ip = request.client.host if request.client else "unknown"
        
        # Skip rate limiting for health checks
        if request.url.path in {"/health", "/metrics"}:
            return await call_next(request)
        
        # Clean old requests
        now = time.time()
        window_start = now - 60  # 1 minute window
        
        if client_ip in self.requests:
            self.requests[client_ip] = [
                t for t in self.requests[client_ip] if t > window_start
            ]
        else:
            self.requests[client_ip] = []
        
        # Check rate limit
        request_count = len(self.requests[client_ip])
        
        if request_count >= self.requests_per_minute:
            return Response(
                content=json.dumps({
                    "detail": "Rate limit exceeded",
                    "retry_after": 60,
                }),
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(window_start + 60)),
                },
            )
        
        # Record request
        self.requests[client_ip].append(now)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = self.requests_per_minute - len(self.requests[client_ip])
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(window_start + 60))
        
        return response


# ═══════════════════════════════════════════════════════════════════════════════
# 🏥 HEALTH CHECK ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

async def health_check() -> Dict[str, Any]:
    """Endpoint de health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
    }


async def metrics_endpoint() -> str:
    """Endpoint Prometheus metrics"""
    return metrics.to_prometheus()


async def metrics_json() -> Dict[str, Any]:
    """Endpoint metrics JSON"""
    return metrics.to_dict()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 SETUP FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def setup_performance_middlewares(app):
    """
    Configure tous les middlewares de performance sur une app FastAPI.
    
    Usage:
        from middleware.performance import setup_performance_middlewares
        
        app = FastAPI()
        setup_performance_middlewares(app)
    """
    # Order matters! Last added = first executed
    
    # 1. Rate limiting (first line of defense)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
    
    # 2. Security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # 3. Compression
    app.add_middleware(CompressionMiddleware)
    
    # 4. Timing (innermost, for accurate measurement)
    app.add_middleware(TimingMiddleware)
    
    # 5. Structured logging
    app.add_middleware(StructuredLoggingMiddleware)
    
    # Add health/metrics endpoints
    from fastapi import APIRouter
    
    router = APIRouter(tags=["monitoring"])
    router.get("/health")(health_check)
    router.get("/metrics", response_class=Response)(
        lambda: Response(content=metrics.to_prometheus(), media_type="text/plain")
    )
    router.get("/metrics/json")(metrics_json)
    
    app.include_router(router)
    
    print("✅ [MIDDLEWARE] Performance middlewares configured", flush=True)
