"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🛡️ SENTRY MODULE v1.0 — Error Tracking pour Deep Sight Backend                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Capture automatique des exceptions                                              ║
║  • Contexte utilisateur (user_id, email, plan)                                    ║
║  • Traces de performance                                                           ║
║  • Intégration FastAPI                                                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
from typing import Optional, Dict, Any
from functools import wraps

# Configuration
SENTRY_DSN = os.getenv("SENTRY_DSN")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
VERSION = os.getenv("VERSION", "1.0.0")
SENTRY_ENABLED = False

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 INITIALISATION
# ═══════════════════════════════════════════════════════════════════════════════


def init_sentry():
    """
    Initialise Sentry si le DSN est configuré.

    Variables d'environnement requises:
    - SENTRY_DSN: Le DSN de votre projet Sentry
    - ENVIRONMENT: "development", "staging", ou "production"
    - VERSION: Version de l'application

    Appeler au démarrage de l'application:
        from core.sentry import init_sentry
        init_sentry()
    """
    global SENTRY_ENABLED

    if not SENTRY_DSN:
        print("ℹ️ [SENTRY] DSN not configured, error tracking disabled", flush=True)
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.httpx import HttpxIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            release=f"deepsight-api@{VERSION}",
            # Performance monitoring
            traces_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
            profiles_sample_rate=0.1 if ENVIRONMENT == "production" else 0.5,
            # Intégrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                HttpxIntegration(),
                LoggingIntegration(
                    level=40,  # ERROR et au-dessus
                    event_level=50,  # CRITICAL uniquement comme events
                ),
            ],
            # Options
            send_default_pii=False,  # GDPR: pas de données personnelles par défaut
            attach_stacktrace=True,
            max_breadcrumbs=50,
            # Filtrage
            before_send=_before_send,
            before_send_transaction=_before_send_transaction,
        )

        SENTRY_ENABLED = True
        print(f"✅ [SENTRY] Initialized for {ENVIRONMENT}", flush=True)
        return True

    except ImportError:
        print("⚠️ [SENTRY] sentry-sdk not installed, error tracking disabled", flush=True)
        return False
    except Exception as e:
        print(f"❌ [SENTRY] Failed to initialize: {e}", flush=True)
        return False


def _before_send(event: Dict, hint: Dict) -> Optional[Dict]:
    """
    Filtre les events avant envoi à Sentry.
    Permet de:
    - Filtrer certaines erreurs
    - Nettoyer les données sensibles
    - Enrichir le contexte
    """
    # Ne pas envoyer les erreurs attendues (ex: auth failed)
    if "exc_info" in hint:
        exc_type, exc_value, tb = hint["exc_info"]

        # Ignorer les erreurs HTTP 4xx (erreurs client)
        if hasattr(exc_value, "status_code"):
            if 400 <= exc_value.status_code < 500:
                return None

        # Ignorer les erreurs de validation
        ignored_errors = [
            "ValidationError",
            "RequestValidationError",
            "HTTPException",
        ]
        if exc_type.__name__ in ignored_errors:
            return None

    # Nettoyer les données sensibles des headers
    if "request" in event:
        headers = event["request"].get("headers", {})
        if "authorization" in headers:
            headers["authorization"] = "[FILTERED]"
        if "cookie" in headers:
            headers["cookie"] = "[FILTERED]"

    return event


def _before_send_transaction(event: Dict, hint: Dict) -> Optional[Dict]:
    """Filtre les transactions de performance."""
    # Ignorer les health checks
    if event.get("transaction", "").startswith("/health"):
        return None
    return event


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 CONTEXTE UTILISATEUR
# ═══════════════════════════════════════════════════════════════════════════════


def set_user_context(user_id: int, email: str = None, plan: str = None, username: str = None):
    """
    Définit le contexte utilisateur pour Sentry.

    Usage:
        set_user_context(
            user_id=42,
            email="user@example.com",
            plan="pro"
        )
    """
    if not SENTRY_ENABLED:
        return

    try:
        import sentry_sdk

        sentry_sdk.set_user(
            {
                "id": str(user_id),
                "email": email,
                "username": username,
                "subscription": plan,  # Tag custom
            }
        )
    except Exception:
        pass


def clear_user_context():
    """Efface le contexte utilisateur."""
    if not SENTRY_ENABLED:
        return

    try:
        import sentry_sdk

        sentry_sdk.set_user(None)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# 🏷️ TAGS & CONTEXTE
# ═══════════════════════════════════════════════════════════════════════════════


def set_tag(key: str, value: str):
    """Ajoute un tag à l'event Sentry."""
    if not SENTRY_ENABLED:
        return

    try:
        import sentry_sdk

        sentry_sdk.set_tag(key, value)
    except Exception:
        pass


def set_context(name: str, data: Dict[str, Any]):
    """
    Ajoute un contexte structuré à l'event Sentry.

    Usage:
        set_context("video", {
            "video_id": "xyz",
            "duration": 3600,
            "category": "science"
        })
    """
    if not SENTRY_ENABLED:
        return

    try:
        import sentry_sdk

        sentry_sdk.set_context(name, data)
    except Exception:
        pass


def add_breadcrumb(message: str, category: str = "custom", level: str = "info", data: Dict[str, Any] = None):
    """
    Ajoute un breadcrumb (fil d'Ariane) pour tracer les actions.

    Usage:
        add_breadcrumb("Video analysis started", category="analysis", data={"video_id": "xyz"})
    """
    if not SENTRY_ENABLED:
        return

    try:
        import sentry_sdk

        sentry_sdk.add_breadcrumb(message=message, category=category, level=level, data=data)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# 🚨 CAPTURE D'ERREURS
# ═══════════════════════════════════════════════════════════════════════════════


def capture_exception(error: Exception = None, **extra):
    """
    Capture une exception et l'envoie à Sentry.

    Usage:
        try:
            risky_operation()
        except Exception as e:
            capture_exception(e, video_id="xyz", user_id=42)
    """
    if not SENTRY_ENABLED:
        return None

    try:
        import sentry_sdk

        # Ajouter le contexte extra
        if extra:
            set_context("extra", extra)

        return sentry_sdk.capture_exception(error)
    except Exception:
        return None


def capture_message(message: str, level: str = "info", **extra):
    """
    Capture un message et l'envoie à Sentry.

    Usage:
        capture_message("Rate limit exceeded", level="warning", user_id=42)
    """
    if not SENTRY_ENABLED:
        return None

    try:
        import sentry_sdk

        # Ajouter le contexte extra
        if extra:
            set_context("extra", extra)

        return sentry_sdk.capture_message(message, level=level)
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# ⏱️ PERFORMANCE MONITORING
# ═══════════════════════════════════════════════════════════════════════════════


def start_transaction(name: str, op: str = "task"):
    """
    Démarre une transaction de performance.

    Usage:
        with start_transaction("analyze_video", op="analysis") as transaction:
            # ... code ...
            transaction.set_tag("video_id", "xyz")
    """
    if not SENTRY_ENABLED:
        # Retourner un context manager no-op
        from contextlib import nullcontext

        return nullcontext()

    try:
        import sentry_sdk

        return sentry_sdk.start_transaction(name=name, op=op)
    except Exception:
        from contextlib import nullcontext

        return nullcontext()


def start_span(description: str, op: str = "task"):
    """
    Démarre un span (sous-opération) dans une transaction.

    Usage:
        with start_span("fetch_transcript", op="http"):
            transcript = await get_transcript(video_id)
    """
    if not SENTRY_ENABLED:
        from contextlib import nullcontext

        return nullcontext()

    try:
        import sentry_sdk

        return sentry_sdk.start_span(description=description, op=op)
    except Exception:
        from contextlib import nullcontext

        return nullcontext()


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 DÉCORATEURS
# ═══════════════════════════════════════════════════════════════════════════════


def trace(op: str = "function"):
    """
    Décorateur pour tracer automatiquement une fonction.

    Usage:
        @trace(op="analysis")
        async def analyze_video(video_id: str):
            ...
    """

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not SENTRY_ENABLED:
                return await func(*args, **kwargs)

            try:
                import sentry_sdk

                with sentry_sdk.start_span(description=func.__name__, op=op):
                    return await func(*args, **kwargs)
            except ImportError:
                return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not SENTRY_ENABLED:
                return func(*args, **kwargs)

            try:
                import sentry_sdk

                with sentry_sdk.start_span(description=func.__name__, op=op):
                    return func(*args, **kwargs)
            except ImportError:
                return func(*args, **kwargs)

        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TEST
# ═══════════════════════════════════════════════════════════════════════════════


def test_sentry():
    """Envoie un event de test à Sentry."""
    if not SENTRY_ENABLED:
        print("⚠️ [SENTRY] Not enabled, cannot send test event", flush=True)
        return False

    try:
        import sentry_sdk

        sentry_sdk.capture_message("Test message from Deep Sight API", level="info")
        print("✅ [SENTRY] Test event sent", flush=True)
        return True
    except Exception as e:
        print(f"❌ [SENTRY] Test failed: {e}", flush=True)
        return False
