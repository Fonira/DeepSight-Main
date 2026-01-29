"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🤿  DEEP SIGHT API v3.3 — FastAPI Backend + Logging + Sentry                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Backend API pour l'application Deep Sight                                         ║
║  🆕 v3.3: Logging structuré + Middlewares de monitoring                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import sys

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 LOGGING STRUCTURÉ — Initialisation en premier
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from core.logging import logger, set_request_context
    from core.middleware import LoggingMiddleware, PerformanceMiddleware
    LOGGING_AVAILABLE = True
    logger.info("Logging module initialized")
except ImportError as e:
    LOGGING_AVAILABLE = False
    print(f"⚠️ Logging module not available: {e}", flush=True)
    
    # Fallback logger
    class FallbackLogger:
        def info(self, msg, **kwargs): print(f"ℹ️ {msg}", flush=True)
        def warning(self, msg, **kwargs): print(f"⚠️ {msg}", flush=True)
        def error(self, msg, **kwargs): print(f"❌ {msg}", flush=True)
        def debug(self, msg, **kwargs): print(f"🔍 {msg}", flush=True)
        def exception(self, msg, **kwargs): print(f"💥 {msg}", flush=True)
    logger = FallbackLogger()

# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ SENTRY — Monitoring des erreurs (utilise notre module)
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from core.sentry import init_sentry, SENTRY_ENABLED
    sentry_initialized = init_sentry()
    if sentry_initialized:
        logger.info("Sentry error tracking enabled")
except ImportError:
    # Fallback sur l'ancienne méthode
    SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
    ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
    
    if SENTRY_DSN:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            from sentry_sdk.integrations.asyncio import AsyncioIntegration
            
            sentry_sdk.init(
                dsn=SENTRY_DSN,
                environment=ENVIRONMENT,
                traces_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
                profiles_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
                integrations=[
                    FastApiIntegration(transaction_style="endpoint"),
                    SqlalchemyIntegration(),
                    AsyncioIntegration(),
                ],
                send_default_pii=False,
                release=f"deepsight-api@3.3.0",
            )
            SENTRY_ENABLED = True
            logger.info("Sentry initialized (legacy mode)", environment=ENVIRONMENT)
        except ImportError:
            SENTRY_ENABLED = False
            logger.warning("Sentry SDK not installed")
    else:
        SENTRY_ENABLED = False
        logger.info("Sentry DSN not configured")

# Import des routers principaux
from auth.router import router as auth_router
from videos.router import router as videos_router
from chat.router import router as chat_router
from billing.router import router as billing_router
from admin.router import router as admin_router
from exports.router import router as exports_router
from playlists.router import router as playlists_router
from history.history_router import router as history_router
from db.database import init_db, close_db

# ✅ NOUVEAU: Import du Profile router (avec fallback si absent)
try:
    from profile.router import router as profile_router
    PROFILE_ROUTER_AVAILABLE = True
except ImportError as e:
    PROFILE_ROUTER_AVAILABLE = False
    print(f"⚠️ Profile router not available: {e}", flush=True)

# 🌻 NOUVEAU: Import du Tournesol proxy router
try:
    from tournesol.router import router as tournesol_router
    TOURNESOL_ROUTER_AVAILABLE = True
except ImportError as e:
    TOURNESOL_ROUTER_AVAILABLE = False
    print(f"⚠️ Tournesol router not available: {e}", flush=True)

# 🎙️ TTS router supprimé (fonctionnalité audio retirée)
TTS_ROUTER_AVAILABLE = False

# 📊 NOUVEAU: Import du Usage router (statistiques)
try:
    from usage.router import router as usage_router
    USAGE_ROUTER_AVAILABLE = True
except ImportError as e:
    USAGE_ROUTER_AVAILABLE = False

# 🔔 NOUVEAU: Import du Notifications router (SSE)
try:
    from notifications.router import router as notifications_router
    NOTIFICATIONS_ROUTER_AVAILABLE = True
except ImportError as e:
    NOTIFICATIONS_ROUTER_AVAILABLE = False
    print(f"⚠️ Notifications router not available: {e}", flush=True)
    print(f"⚠️ Usage router not available: {e}", flush=True)

# 🔑 NOUVEAU: Import du Public API router (Plan Expert)
try:
    from api_public.router import router as api_public_router
    API_PUBLIC_ROUTER_AVAILABLE = True
except ImportError as e:
    API_PUBLIC_ROUTER_AVAILABLE = False
    print(f"⚠️ Public API router not available: {e}", flush=True)

# 🧠 NOUVEAU: Import du Words router ("Le Saviez-Vous")
try:
    from words.router import router as words_router
    WORDS_ROUTER_AVAILABLE = True
except ImportError as e:
    WORDS_ROUTER_AVAILABLE = False
    print(f"⚠️ Words router not available: {e}", flush=True)

# 📚 NOUVEAU: Study router (mobile-compatible study tools)
try:
    from study.router import router as study_router
    STUDY_ROUTER_AVAILABLE = True
except ImportError as e:
    STUDY_ROUTER_AVAILABLE = False
    print(f"⚠️ Study router not available: {e}", flush=True)

# 📦 NOUVEAU: Batch router (analyses en lot - API v2)
try:
    from batch.router import router as batch_router
    BATCH_ROUTER_AVAILABLE = True
except ImportError as e:
    BATCH_ROUTER_AVAILABLE = False
    print(f"⚠️ Batch router not available: {e}", flush=True)

# 📚 NOUVEAU: Import du Academic router (Sources Académiques)
try:
    from academic.router import router as academic_router
    ACADEMIC_ROUTER_AVAILABLE = True
except ImportError as e:
    ACADEMIC_ROUTER_AVAILABLE = False
    print(f"⚠️ Academic router not available: {e}", flush=True)

VERSION = "3.8.0"  # Phase 4: CSV/Excel export, Batch API, Health detailed
APP_NAME = "Deep Sight API"
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

# Configuration CORS depuis environnement
# 🔧 Inclure les URLs de production par défaut pour éviter les erreurs CORS
DEFAULT_ORIGINS = [
    # Production
    "https://www.deepsightsynthesis.com",
    "https://deepsightsynthesis.com",
    # Développement
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8081",
]

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",")
# Nettoyer les espaces éventuels
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://www.deepsightsynthesis.com")

# Ajouter le frontend URL aux origines autorisées
if FRONTEND_URL not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# Ajouter les origines de développement mobile (Expo)
# Expo peut utiliser différents ports selon la configuration
MOBILE_DEV_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:8082",
    "http://localhost:19000",
    "http://localhost:19001",
    "http://localhost:19002",
    "http://localhost:19006",  # Expo web
    "http://127.0.0.1:19000",
    "http://127.0.0.1:19006",
    "exp://localhost:8081",
    "exp://127.0.0.1:8081",
]
for origin in MOBILE_DEV_ORIGINS:
    if origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(origin)


async def run_auto_migrations():
    """
    🔧 Exécute les migrations automatiques au démarrage.
    Ajoute les colonnes manquantes sans casser l'existant.
    """
    from sqlalchemy import text
    from db.database import async_session_maker
    
    migrations = [
        # Migration v5.0: Métadonnées chat pour fact-checking
        ("chat_messages", "web_search_used", "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS web_search_used BOOLEAN DEFAULT FALSE"),
        ("chat_messages", "fact_checked", "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS fact_checked BOOLEAN DEFAULT FALSE"),
        ("chat_messages", "sources_json", "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sources_json TEXT"),
        ("chat_messages", "enrichment_level", "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS enrichment_level VARCHAR(20)"),
    ]
    
    # Migration spéciale: thumbnail_url VARCHAR(500) -> TEXT pour images base64
    alter_column_migrations = [
        ("summaries", "thumbnail_url", "ALTER TABLE summaries ALTER COLUMN thumbnail_url TYPE TEXT"),
    ]
    
    async with async_session_maker() as session:
        for table, column, sql in migrations:
            try:
                await session.execute(text(sql))
                await session.commit()
                print(f"  ✅ Migration OK: {table}.{column}", flush=True)
            except Exception as e:
                # Ignorer si la colonne existe déjà ou autre erreur non bloquante
                await session.rollback()
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"  ℹ️ Already exists: {table}.{column}", flush=True)
                else:
                    print(f"  ⚠️ Migration warning for {table}.{column}: {e}", flush=True)
        
        # Migrations ALTER COLUMN (changement de type)
        for table, column, sql in alter_column_migrations:
            try:
                await session.execute(text(sql))
                await session.commit()
                print(f"  ✅ Column type changed: {table}.{column} -> TEXT", flush=True)
            except Exception as e:
                await session.rollback()
                # Ignorer si déjà le bon type
                print(f"  ℹ️ Column type migration: {table}.{column} - {str(e)[:50]}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie de l'application"""
    # Startup
    logger.info("Application starting", app_name=APP_NAME, version=VERSION)
    logger.info("CORS configuration", origins=ALLOWED_ORIGINS)
    logger.info("Sentry status", enabled=SENTRY_ENABLED)
    
    await init_db()
    logger.info("Database initialized")
    
    # 🆕 Exécuter les migrations automatiques
    logger.info("Running auto-migrations")
    await run_auto_migrations()
    logger.info("Migrations completed")
    
    yield
    # Shutdown
    await close_db()
    logger.info("Application shutdown")

app = FastAPI(
    title=APP_NAME,
    version=VERSION,
    description="API Backend pour Deep Sight - Analyse YouTube avec IA",
    redirect_slashes=False,  # Évite les redirections 307 qui perdent les headers
    lifespan=lifespan
)

# Configuration CORS - CRITIQUE pour éviter les erreurs 502
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# 📊 Middlewares de logging (après CORS)
if LOGGING_AVAILABLE:
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(PerformanceMiddleware)
    logger.info("Logging middlewares enabled")

# ═══════════════════════════════════════════════════════════════════════════════
# INCLUSION DES ROUTERS
# ═══════════════════════════════════════════════════════════════════════════════

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(videos_router, prefix="/api/videos", tags=["Videos"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])
print("💳 Billing router loaded with create-checkout endpoint", flush=True)
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(exports_router, prefix="/api/exports", tags=["Exports"])
app.include_router(playlists_router, prefix="/api/playlists", tags=["Playlists"])
app.include_router(history_router, prefix="/api/history", tags=["History"])

# ✅ NOUVEAU: Profile router pour avatar et préférences
if PROFILE_ROUTER_AVAILABLE:
    app.include_router(profile_router, prefix="/api/profile", tags=["Profile"])
    print("✅ Profile router loaded", flush=True)

# 🌻 NOUVEAU: Tournesol proxy router
if TOURNESOL_ROUTER_AVAILABLE:
    app.include_router(tournesol_router, prefix="/api/tournesol", tags=["Tournesol"])
    print("🌻 Tournesol router loaded", flush=True)

# 🎙️ NOUVEAU: TTS (Text-to-Speech) router
if TTS_ROUTER_AVAILABLE:
    app.include_router(tts_router, prefix="/api/tts", tags=["Text-to-Speech"])
    print("🎙️ TTS router loaded", flush=True)

# 📊 NOUVEAU: Usage router (statistiques d'utilisation)
if USAGE_ROUTER_AVAILABLE:
    app.include_router(usage_router, prefix="/api/usage", tags=["Usage"])
    print("📊 Usage router loaded", flush=True)

# 🔔 NOUVEAU: Notifications router (SSE temps réel)
if NOTIFICATIONS_ROUTER_AVAILABLE:
    app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
    print("🔔 Notifications router loaded (SSE)", flush=True)

# 🔑 NOUVEAU: Public API router (Plan Expert)
if API_PUBLIC_ROUTER_AVAILABLE:
    app.include_router(api_public_router, tags=["Public API v1"])
    print("🔑 Public API router loaded (Expert plan)", flush=True)

# 🧠 NOUVEAU: Words router ("Le Saviez-Vous")
if WORDS_ROUTER_AVAILABLE:
    app.include_router(words_router, prefix="/api/words", tags=["Words"])
    print("🧠 Words router loaded (Le Saviez-Vous)", flush=True)

# 📚 NOUVEAU: Study router (mobile-compatible study tools)
if STUDY_ROUTER_AVAILABLE:
    app.include_router(study_router, prefix="/api/study", tags=["Study"])
    print("📚 Study router loaded (quiz, mindmap, flashcards)", flush=True)

# 📦 NOUVEAU: Batch router (analyses en lot - API v2)
if BATCH_ROUTER_AVAILABLE:
    app.include_router(batch_router, prefix="/api/batch", tags=["Batch"])
    print("📦 Batch router loaded (batch video analysis)", flush=True)

# 📚 NOUVEAU: Academic router (Sources Académiques)
if ACADEMIC_ROUTER_AVAILABLE:
    app.include_router(academic_router, tags=["Academic"])
    print("📚 Academic router loaded (Semantic Scholar, OpenAlex, arXiv)", flush=True)

# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS DE BASE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    """Page d'accueil de l'API"""
    return {
        "name": APP_NAME,
        "version": VERSION,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/api/auth",
            "videos": "/api/videos",
            "chat": "/api/chat",
            "billing": "/api/billing",
            "admin": "/api/admin",
            "exports": "/api/exports",
            "playlists": "/api/playlists",
            "batch": "/api/batch" if BATCH_ROUTER_AVAILABLE else "not available",
            "profile": "/api/profile" if PROFILE_ROUTER_AVAILABLE else "not available",
            "tts": "/api/tts" if TTS_ROUTER_AVAILABLE else "not available",
            "usage": "/api/usage" if USAGE_ROUTER_AVAILABLE else "not available",
            "api_v1": "/api/v1" if API_PUBLIC_ROUTER_AVAILABLE else "not available (Expert plan)",
            "words": "/api/words" if WORDS_ROUTER_AVAILABLE else "not available"
        }
    }

@app.get("/health")
async def health_check():
    """
    Endpoint de healthcheck pour Railway.
    DOIT retourner 200 avec un JSON simple.
    """
    return {"status": "healthy", "version": VERSION}

@app.get("/api/health")
async def api_health():
    """Healthcheck alternatif sous /api"""
    return {"status": "ok", "service": "deepsight-api", "version": VERSION}


@app.get("/health/detailed")
async def health_detailed():
    """
    Endpoint de healthcheck détaillé avec métriques.

    Retourne:
    - Status de la base de données
    - Status du cache (Redis/mémoire)
    - Statistiques d'utilisation
    - Informations système
    """
    import time
    from datetime import datetime

    start_time = time.time()
    health_data = {
        "status": "healthy",
        "version": VERSION,
        "environment": ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }

    # Check database
    try:
        from db.database import async_session_maker
        from sqlalchemy import text
        async with async_session_maker() as session:
            db_start = time.time()
            await session.execute(text("SELECT 1"))
            db_latency = (time.time() - db_start) * 1000
            health_data["checks"]["database"] = {
                "status": "healthy",
                "latency_ms": round(db_latency, 2)
            }
    except Exception as e:
        health_data["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)[:100]
        }
        health_data["status"] = "degraded"

    # Check cache
    try:
        from core.cache import cache
        cache_health = await cache.health_check()
        cache_metrics = cache.get_metrics()
        health_data["checks"]["cache"] = {
            "status": cache_health.get("status", "unknown"),
            "redis": cache_health.get("redis", "unknown"),
            "memory_cache_size": cache_metrics.get("memory_cache_size", 0),
            "hit_rate": cache_metrics.get("hit_rate", "0%")
        }
    except Exception as e:
        health_data["checks"]["cache"] = {
            "status": "unavailable",
            "error": str(e)[:100]
        }

    # Check external services
    health_data["checks"]["services"] = {
        "sentry": SENTRY_ENABLED,
        "logging": LOGGING_AVAILABLE,
        "profile_router": PROFILE_ROUTER_AVAILABLE,
        "tournesol_router": TOURNESOL_ROUTER_AVAILABLE,
        "usage_router": USAGE_ROUTER_AVAILABLE,
        "notifications_router": NOTIFICATIONS_ROUTER_AVAILABLE,
        "api_public_router": API_PUBLIC_ROUTER_AVAILABLE,
        "study_router": STUDY_ROUTER_AVAILABLE,
        "academic_router": ACADEMIC_ROUTER_AVAILABLE
    }

    # Response time
    health_data["response_time_ms"] = round((time.time() - start_time) * 1000, 2)

    return health_data

# ═══════════════════════════════════════════════════════════════════════════════
# GESTION GLOBALE DES ERREURS
# ═══════════════════════════════════════════════════════════════════════════════

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Capture toutes les exceptions non gérées.

    SÉCURITÉ: Ne jamais exposer les détails d'erreur en production.
    """
    import uuid
    error_id = str(uuid.uuid4())[:8]
    error_msg = str(exc)

    # Log complet côté serveur
    print(f"❌ [{error_id}] Unhandled error: {error_msg}", file=sys.stderr, flush=True)

    # Envoyer à Sentry si activé
    if SENTRY_ENABLED:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("error_id", error_id)
            scope.set_extra("path", str(request.url.path))
            scope.set_extra("method", request.method)
            scope.set_extra("client_host", request.client.host if request.client else "unknown")

    # SÉCURITÉ: En production, ne pas exposer les détails d'erreur
    if ENVIRONMENT == "production":
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error_id": error_id,
                "support": "Contact support with this error_id"
            }
        )
    else:
        # En développement, inclure les détails
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": error_msg, "error_id": error_id}
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 DEBUG ENDPOINTS — DÉSACTIVÉS EN PRODUCTION
# ═══════════════════════════════════════════════════════════════════════════════

if ENVIRONMENT != "production":
    @app.get("/debug/sentry")
    async def debug_sentry():
        """
        🔍 Endpoint de test Sentry — Uniquement en développement.
        Déclenche une erreur volontaire pour tester Sentry.
        """
        if not SENTRY_ENABLED:
            return {"error": "Sentry not configured", "hint": "Set SENTRY_DSN environment variable"}

        raise Exception("🔍 Sentry test error - This is intentional!")

    @app.get("/debug/info")
    async def debug_info():
        """Informations de debug — Uniquement en développement."""
        return {
            "version": VERSION,
            "environment": ENVIRONMENT,
            "sentry_enabled": SENTRY_ENABLED,
            "python_version": sys.version,
            "routers": {
                "profile": PROFILE_ROUTER_AVAILABLE,
                "tournesol": TOURNESOL_ROUTER_AVAILABLE,
                "tts": TTS_ROUTER_AVAILABLE,
            }
        }
else:
    logger.info("Debug endpoints disabled in production")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.environ.get("ENV", "development") == "development"
    )
