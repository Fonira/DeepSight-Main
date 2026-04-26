"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔄 MIDDLEWARE v1.0 — Middlewares FastAPI pour Deep Sight                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Logging automatique des requêtes/réponses                                       ║
║  • Contexte de requête (request_id, user_id)                                       ║
║  • Métriques de performance                                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from core.logging import logger, set_request_context, clear_request_context, generate_request_id


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware qui log automatiquement toutes les requêtes HTTP.

    Logs:
    - Début de requête (méthode, path, user_id)
    - Fin de requête (status, durée)
    - Erreurs avec traceback
    """

    # Paths à ne pas logger (health checks, etc.)
    SKIP_PATHS = {"/health", "/healthz", "/ready", "/favicon.ico", "/robots.txt"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip certains paths
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # Générer un request_id unique
        request_id = request.headers.get("X-Request-ID") or generate_request_id()

        # Extraire user_id si disponible (sera mis à jour après auth)
        user_id = getattr(request.state, "user_id", None)
        user_email = getattr(request.state, "user_email", None)

        # Définir le contexte de logging
        set_request_context(request_id=request_id, user_id=user_id, user_email=user_email)

        # Stocker le request_id dans la request pour les handlers
        request.state.request_id = request_id

        # Timer
        start_time = time.perf_counter()

        # Log début de requête
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query=str(request.query_params) if request.query_params else None,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "")[:100],
        )

        # Traiter la requête
        try:
            response = await call_next(request)

            # Calculer la durée
            duration = time.perf_counter() - start_time

            # Log fin de requête
            log_level = "info" if response.status_code < 400 else "warning" if response.status_code < 500 else "error"
            getattr(logger, log_level)(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2),
                response_size=response.headers.get("content-length"),
            )

            # Ajouter le request_id dans les headers de réponse
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{round(duration * 1000, 2)}ms"

            return response

        except Exception as e:
            duration = time.perf_counter() - start_time

            logger.exception(
                "Request failed with exception",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration * 1000, 2),
                error_type=type(e).__name__,
                error_message=str(e),
            )
            raise

        finally:
            # Nettoyer le contexte
            clear_request_context()


class PerformanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware pour tracker les performances et alerter sur les requêtes lentes.
    """

    SLOW_REQUEST_THRESHOLD_MS = 5000  # 5 secondes

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000

        if duration_ms > self.SLOW_REQUEST_THRESHOLD_MS:
            logger.warning(
                "Slow request detected",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
                threshold_ms=self.SLOW_REQUEST_THRESHOLD_MS,
            )

        return response


class UserContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware pour extraire le contexte utilisateur après authentification.
    À placer APRÈS le middleware d'auth.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Mettre à jour le contexte si user disponible
        if hasattr(request.state, "user"):
            user = request.state.user
            set_request_context(user_id=getattr(user, "id", None), user_email=getattr(user, "email", None))

        return await call_next(request)
