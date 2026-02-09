"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔒 SECURITY HEADERS MIDDLEWARE v1.0 — Protection HTTP Headers                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  HEADERS AJOUTÉS:                                                                  ║
║  • X-Content-Type-Options: nosniff (anti-MIME sniffing)                           ║
║  • X-Frame-Options: DENY (anti-clickjacking)                                      ║
║  • X-XSS-Protection: 1; mode=block (legacy XSS filter)                           ║
║  • Strict-Transport-Security: HSTS (force HTTPS)                                 ║
║  • Referrer-Policy: strict-origin-when-cross-origin                               ║
║  • Content-Security-Policy: restrictive CSP                                       ║
║  • Permissions-Policy: restrict browser APIs                                      ║
║  • X-Request-ID: trace requests across services                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# Domaines autorisés pour CSP
ALLOWED_CSP_DOMAINS = [
    "'self'",
    "https://www.deepsightsynthesis.com",
    "https://deepsightsynthesis.com",
    "https://accounts.google.com",        # Google OAuth
    "https://www.googleapis.com",          # Google APIs
    "https://api.stripe.com",             # Stripe
    "https://js.stripe.com",             # Stripe JS
    "https://*.sentry.io",               # Sentry
    "https://i.ytimg.com",               # YouTube thumbnails
    "https://img.youtube.com",           # YouTube images
]

# Paths exclus des headers de sécurité (documentation, health)
EXCLUDED_PATHS = ["/docs", "/redoc", "/openapi.json"]


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Ajoute des headers HTTP de sécurité à toutes les réponses.
    
    Compatible avec:
    - Frontend React (SPA)
    - Mobile Expo (React Native)  
    - Extension Chrome
    
    En développement, les restrictions CSP sont assouplies.
    """

    def __init__(self, app, exclude_paths: list[str] | None = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or EXCLUDED_PATHS
        self._security_headers = self._build_headers()

    def _build_headers(self) -> dict[str, str]:
        """Construit les headers de sécurité selon l'environnement."""
        
        headers = {
            # ── Anti-MIME Sniffing ────────────────────────────────────
            # Empêche le navigateur de deviner le type MIME
            "X-Content-Type-Options": "nosniff",
            
            # ── Anti-Clickjacking ─────────────────────────────────────
            # Interdit l'embedding dans des iframes tierces
            "X-Frame-Options": "DENY",
            
            # ── Legacy XSS Filter ─────────────────────────────────────
            # Active le filtre XSS intégré aux vieux navigateurs
            "X-XSS-Protection": "1; mode=block",
            
            # ── Referrer Policy ───────────────────────────────────────
            # Limite les infos envoyées dans le header Referer
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # ── Permissions Policy ────────────────────────────────────
            # Restreint l'accès aux APIs sensibles du navigateur
            "Permissions-Policy": (
                "camera=(), "
                "microphone=(), "
                "geolocation=(), "
                "interest-cohort=()"  # Bloque FLoC/Topics API
            ),
            
            # ── Cache Control pour les réponses API ───────────────────
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
        }

        # ── HSTS (production uniquement) ──────────────────────────────
        if IS_PRODUCTION:
            headers["Strict-Transport-Security"] = (
                "max-age=31536000; "  # 1 an
                "includeSubDomains; "
                "preload"
            )

        # ── Content-Security-Policy ───────────────────────────────────
        # API backend : on n'a besoin que de restreindre les scripts/frames
        if IS_PRODUCTION:
            csp_directives = [
                "default-src 'self'",
                f"script-src 'self'",
                "style-src 'self' 'unsafe-inline'",  # Swagger UI
                f"img-src 'self' https://i.ytimg.com https://img.youtube.com data:",
                f"connect-src 'self' {' '.join(ALLOWED_CSP_DOMAINS)}",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
            ]
            headers["Content-Security-Policy"] = "; ".join(csp_directives)
        else:
            # Dev : CSP permissif pour le debugging
            headers["Content-Security-Policy"] = (
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' *; "
                "frame-ancestors 'self'"
            )

        return headers

    async def dispatch(self, request: Request, call_next) -> Response:
        """Ajoute les headers de sécurité à chaque réponse."""
        
        # Skip pour docs Swagger / healthcheck
        path = request.url.path
        if any(path.startswith(excluded) for excluded in self.exclude_paths):
            return await call_next(request)

        # Générer un request ID unique pour le tracing
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])

        # Traiter la requête
        response = await call_next(request)

        # Ajouter tous les headers de sécurité
        for header_name, header_value in self._security_headers.items():
            response.headers[header_name] = header_value

        # Request ID pour le tracing cross-service
        response.headers["X-Request-ID"] = request_id

        return response
