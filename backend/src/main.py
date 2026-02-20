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

# 🔒 Security Headers
try:
    from middleware.security_headers import SecurityHeadersMiddleware
    SECURITY_HEADERS_AVAILABLE = True
except ImportError as e:
    SECURITY_HEADERS_AVAILABLE = False
    print(f"⚠️ Security headers middleware not available: {e}", flush=True)

# 🚦 Rate Limiting & Cache
try:
    from middleware.rate_limiter import RateLimitMiddleware, init_rate_limiter
    from core.config import RATE_LIMIT_ENABLED
    RATE_LIMITER_AVAILABLE = RATE_LIMIT_ENABLED
    if not RATE_LIMIT_ENABLED:
        print("ℹ️ Rate limiter disabled via RATE_LIMIT_ENABLED=false", flush=True)
except ImportError as e:
    RATE_LIMITER_AVAILABLE = False
    print(f"⚠️ Rate limiter not available: {e}", flush=True)

try:
    from core.cache import init_cache, cache_service
    CACHE_AVAILABLE = True
except ImportError as e:
    CACHE_AVAILABLE = False
    print(f"⚠️ Cache service not available: {e}", flush=True)

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

# 🎙️ TTS router (Text-to-Speech for summaries)
try:
    from tts.router import router as tts_router
    TTS_ROUTER_AVAILABLE = True
except ImportError as e:
    TTS_ROUTER_AVAILABLE = False
    print(f"⚠️ TTS router not available: {e}", flush=True)

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

# 🩺 Monitoring router (health checks, status page)
try:
    from monitoring.router import router as monitoring_router, set_startup_time
    from monitoring.scheduler import monitoring_job
    MONITORING_AVAILABLE = True
except ImportError as e:
    MONITORING_AVAILABLE = False
    print(f"⚠️ Monitoring module not available: {e}", flush=True)

# 📬 Contact router (contact form)
try:
    from contact.router import router as contact_router
    CONTACT_AVAILABLE = True
except ImportError as e:
    CONTACT_AVAILABLE = False
    print(f"⚠️ Contact router not available: {e}", flush=True)

# 🔗 Share router (public analysis sharing)
try:
    from share.router import router as share_router
    SHARE_ROUTER_AVAILABLE = True
except ImportError as e:
    SHARE_ROUTER_AVAILABLE = False
    print(f"⚠️ Share router not available: {e}", flush=True)

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


import asyncio

# État de l'application pour healthcheck
_app_state = {
    "ready": False,
    "db_initialized": False,
    "migrations_completed": False,
    "error": None
}


async def initialize_database_background():
    """
    🚀 Initialisation DB en arrière-plan (non-bloquant).
    Permet au healthcheck de répondre immédiatement.
    """
    global _app_state
    try:
        logger.info("Starting background database initialization...")

        # Étape 1: Initialiser la connexion DB
        await init_db()
        _app_state["db_initialized"] = True
        logger.info("Database connection established")

        # Étape 2: Exécuter les migrations
        logger.info("Running auto-migrations in background...")
        await run_auto_migrations()
        _app_state["migrations_completed"] = True
        logger.info("Migrations completed successfully")

        # Étape 3: Initialiser le cache (Redis si disponible, sinon in-memory)
        if CACHE_AVAILABLE:
            redis_url = os.environ.get("REDIS_URL")
            await init_cache(redis_url)
            logger.info("Cache service initialized", 
                       backend="redis" if cache_service.is_redis else "memory")
        
        # Étape 4: Initialiser le rate limiter avec Redis si disponible
        if RATE_LIMITER_AVAILABLE:
            redis_url = os.environ.get("REDIS_URL")
            await init_rate_limiter(redis_url)
            logger.info("Rate limiter initialized")

        # Marquer l'app comme prête
        _app_state["ready"] = True
        logger.info("🟢 Application fully ready to serve requests")

    except Exception as e:
        _app_state["error"] = str(e)
        logger.error(f"Database initialization failed: {e}")
        # Ne pas crasher l'app, mais marquer l'erreur
        # Les endpoints qui nécessitent la DB renverront une erreur appropriée


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestion du cycle de vie de l'application.
    ⚡ OPTIMISÉ: L'initialisation DB se fait en arrière-plan
    pour que le healthcheck réponde immédiatement.
    """
    # Startup
    import time as _time
    _startup_ts = _time.time()
    if MONITORING_AVAILABLE:
        set_startup_time(_startup_ts)

    logger.info("Application starting", app_name=APP_NAME, version=VERSION)
    logger.info("CORS configuration", origins=ALLOWED_ORIGINS)
    logger.info("Sentry status", enabled=SENTRY_ENABLED)

    # 🚀 Lancer l'initialisation DB en arrière-plan (NON-BLOQUANT)
    # Cela permet au healthcheck de répondre immédiatement
    asyncio.create_task(initialize_database_background())
    logger.info("Database initialization started in background")

    # 💾 APScheduler — daily backup cron
    scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from core.config import BACKUP_CONFIG

        async def _scheduled_backup():
            try:
                from scripts.backup_db import run_backup
                logger.info("Scheduled backup starting")
                result = await run_backup(upload=True)
                logger.info("Scheduled backup completed", status=result.get("status"))
            except Exception as e:
                logger.error(f"Scheduled backup failed: {e}")

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            _scheduled_backup,
            CronTrigger(
                hour=BACKUP_CONFIG["CRON_HOUR"],
                minute=BACKUP_CONFIG["CRON_MINUTE"],
            ),
            id="daily_backup",
            name="Daily database backup",
            replace_existing=True,
        )
        # 🩺 Health monitoring job (every 5 minutes)
        if MONITORING_AVAILABLE:
            from apscheduler.triggers.interval import IntervalTrigger
            scheduler.add_job(
                monitoring_job,
                IntervalTrigger(minutes=5),
                id="health_monitoring",
                name="Health monitoring checks",
                replace_existing=True,
            )
            logger.info("Health monitoring scheduler registered (every 5 min)")

        # 📧 Onboarding emails job (every hour)
        from apscheduler.triggers.interval import IntervalTrigger as _IT

        async def _scheduled_onboarding():
            try:
                from db.database import get_session as _get_sess
                async for db in _get_sess():
                    from services.onboarding_emails import process_onboarding_emails
                    stats = await process_onboarding_emails(db)
                    logger.info("Onboarding emails processed", extra=stats)
                    break
            except Exception as e:
                logger.error(f"Onboarding email job failed: {e}")

        scheduler.add_job(
            _scheduled_onboarding,
            _IT(hours=1),
            id="onboarding_emails",
            name="Onboarding email sequence",
            replace_existing=True,
        )
        logger.info("Onboarding email scheduler registered (every 1 hour)")

        scheduler.start()
        logger.info(
            f"Backup scheduler started (daily at {BACKUP_CONFIG['CRON_HOUR']:02d}:{BACKUP_CONFIG['CRON_MINUTE']:02d} UTC)"
        )
    except ImportError:
        logger.warning("APScheduler not installed — automatic backups disabled")
    except Exception as e:
        logger.warning(f"Backup scheduler failed to start: {e}")

    yield

    # Shutdown
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        logger.info("Backup scheduler stopped")
    await close_db()
    logger.info("Application shutdown")

app = FastAPI(
    title=APP_NAME,
    version=VERSION,
    description="API Backend pour Deep Sight - Analyse YouTube avec IA",
    redirect_slashes=False,  # Évite les redirections 307 qui perdent les headers
    lifespan=lifespan
)


@app.get("/health")
async def health_check():
    """Healthcheck pour Railway."""
    return {"status": "ok"}


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

# 🔒 Security Headers Middleware (après CORS, avant logging)
if SECURITY_HEADERS_AVAILABLE:
    app.add_middleware(SecurityHeadersMiddleware)
    logger.info("Security headers middleware enabled")

# 📊 Middlewares de logging (après CORS)
if LOGGING_AVAILABLE:
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(PerformanceMiddleware)
    logger.info("Logging middlewares enabled")

# 🚦 Rate Limiting Middleware
if RATE_LIMITER_AVAILABLE:
    app.add_middleware(
        RateLimitMiddleware,
        exclude_paths=[
            "/health",
            "/health/ready",
            "/api/health",
            "/api/health/ping",
            "/api/health/status",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/",
        ]
    )
    logger.info("Rate limiting middleware enabled")

# ═══════════════════════════════════════════════════════════════════════════════
# INCLUSION DES ROUTERS
# ═══════════════════════════════════════════════════════════════════════════════

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(videos_router, prefix="/api/videos", tags=["Videos"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])
app.include_router(billing_router, prefix="/api/stripe", tags=["Stripe"], include_in_schema=False)
print("Billing router loaded (available at /api/billing and /api/stripe)", flush=True)
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

# 🩺 Monitoring router (health checks, status)
if MONITORING_AVAILABLE:
    app.include_router(monitoring_router, prefix="/api/health", tags=["Monitoring"])
    print("🩺 Monitoring router loaded (/api/health/ping, /api/health/status)", flush=True)

# 📬 Contact router
if CONTACT_AVAILABLE:
    app.include_router(contact_router, prefix="/api", tags=["Contact"])
    print("📬 Contact router loaded (POST /api/contact)", flush=True)

# 🔗 Share router (public analysis sharing)
if SHARE_ROUTER_AVAILABLE:
    app.include_router(share_router, prefix="/api/share", tags=["Share"])
    print("🔗 Share router loaded (POST /api/share, GET /api/share/{token})", flush=True)

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


@app.get("/health/ready")
async def health_ready():
    """
    Endpoint de readiness - Vérifie que l'app est PLEINEMENT opérationnelle.
    Utiliser pour les vérifications après le déploiement initial.
    """
    if not _app_state.get("ready", False):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "version": VERSION,
                "db_initialized": _app_state.get("db_initialized", False),
                "migrations_completed": _app_state.get("migrations_completed", False),
                "error": _app_state.get("error"),
            }
        )
    return {
        "status": "ready",
        "version": VERSION,
        "db_initialized": True,
        "migrations_completed": True,
    }


# Note: /api/health is now handled by monitoring_router (prefix="/api/health")
# Legacy endpoint kept at /api/health/legacy for backward compat
@app.get("/api/health/legacy")
async def api_health():
    """Healthcheck alternatif (legacy)"""
    return {
        "status": "ok",
        "service": "deepsight-api",
        "version": VERSION,
        "ready": _app_state.get("ready", False),
    }


@app.get("/health/detailed")
async def health_detailed():
    """
    Endpoint de healthcheck détaillé avec métriques.

    Retourne:
    - Status de la base de données
    - Status du cache (Redis/mémoire)
    - Statistiques d'utilisation
    - Informations système
    - Métriques de rate limiting
    - Stats des analyses actives
    """
    import time
    import psutil
    from datetime import datetime

    start_time = time.time()
    health_data = {
        "status": "healthy",
        "version": VERSION,
        "environment": ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {},
        "metrics": {}
    }

    # Check database — une seule requête combinée (vs 4 avant)
    try:
        from db.database import async_session_maker
        from sqlalchemy import text
        async with async_session_maker() as session:
            db_start = time.time()
            # Une seule requête pour tout : ping + stats approximatives
            # pg_class.reltuples est une estimation rapide (pas de COUNT(*) coûteux)
            result = await session.execute(text("""
                SELECT
                    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'users') as user_count,
                    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'summaries') as summary_count,
                    (SELECT count(*) FROM task_status WHERE status IN ('pending', 'processing')) as active_tasks
            """))
            row = result.one()
            db_latency = (time.time() - db_start) * 1000

            health_data["checks"]["database"] = {
                "status": "healthy",
                "latency_ms": round(db_latency, 2),
                "connection_pool": "active"
            }
            health_data["metrics"]["database"] = {
                "total_users": max(row.user_count or 0, 0),
                "total_summaries": max(row.summary_count or 0, 0),
                "active_tasks": row.active_tasks or 0
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

    # Check rate limiting metrics
    try:
        from core.security import _rate_limits, _ip_rate_limits, cleanup_expired_ip_limits
        expired_cleaned = cleanup_expired_ip_limits()
        health_data["metrics"]["rate_limiting"] = {
            "active_user_sessions": len(_rate_limits),
            "active_ip_sessions": len(_ip_rate_limits),
            "expired_cleaned": expired_cleaned
        }
    except Exception as e:
        health_data["metrics"]["rate_limiting"] = {
            "error": str(e)[:50]
        }

    # System metrics — sans interval blocking (cpu_percent(interval=0) = non-bloquant)
    try:
        process = psutil.Process()
        mem_info = process.memory_info()
        health_data["metrics"]["system"] = {
            "cpu_percent": psutil.cpu_percent(interval=0),  # Non-bloquant (estimation)
            "memory_percent": psutil.virtual_memory().percent,
            "process_memory_mb": round(mem_info.rss / 1024 / 1024, 2),
            "process_threads": process.num_threads(),
        }
    except Exception as e:
        health_data["metrics"]["system"] = {
            "error": str(e)[:50]
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
        "academic_router": ACADEMIC_ROUTER_AVAILABLE,
        "batch_router": BATCH_ROUTER_AVAILABLE
    }

    # External API status — requête légère (pas de JOIN, table petite)
    try:
        from db.database import ApiStatus, async_session_maker as _sm
        from sqlalchemy import select
        async with _sm() as session:
            api_statuses = await session.execute(select(ApiStatus))
            apis = api_statuses.scalars().all()
            health_data["checks"]["external_apis"] = {
                api.api_name: {
                    "status": api.status,
                    "error_count": api.error_count,
                    "last_success": api.last_success_at.isoformat() if api.last_success_at else None
                }
                for api in apis
            }
    except Exception:
        health_data["checks"]["external_apis"] = {}

    # Response time
    health_data["response_time_ms"] = round((time.time() - start_time) * 1000, 2)

    # Determine overall status
    if health_data["checks"].get("database", {}).get("status") == "unhealthy":
        health_data["status"] = "unhealthy"
    elif any(
        check.get("status") == "unavailable"
        for check in health_data["checks"].values()
        if isinstance(check, dict) and "status" in check
    ):
        health_data["status"] = "degraded"

    return health_data


@app.get("/health/ready")
async def health_ready():
    """
    Readiness probe — Indique si le service est prêt à recevoir du trafic.
    Utilisé par les load balancers pour les rolling deployments.
    """
    try:
        from db.database import async_session_maker
        from sqlalchemy import text
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        return {"ready": True, "version": VERSION}
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"ready": False, "error": str(e)[:100]}
        )


@app.get("/health/live")
async def health_live():
    """
    Liveness probe — Indique si le service est vivant.
    Si ce check échoue, le conteneur sera redémarré.
    """
    return {"alive": True, "version": VERSION}

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
    logger.error(f"[{error_id}] Unhandled error on {request.method} {request.url.path}: {error_msg}")

    # Envoyer à Sentry si activé
    if SENTRY_ENABLED:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("error_id", error_id)
            scope.set_extra("path", str(request.url.path))
            scope.set_extra("method", request.method)
            scope.set_extra("client_host", request.client.host if request.client else "unknown")

    # Classify error for safe client response (never leak internal details)
    safe_error = "An unexpected error occurred"
    error_lower = error_msg.lower()
    if "password authentication" in error_lower or "could not connect" in error_lower or "connection refused" in error_lower or "connection reset" in error_lower:
        safe_error = "Database connection error. Please try again later."
    elif "timeout" in error_lower:
        safe_error = "Request timed out. Please try again."
    elif "rate limit" in error_lower:
        safe_error = "Too many requests. Please slow down."

    # SÉCURITÉ: En production, ne pas exposer les détails d'erreur
    if ENVIRONMENT == "production":
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error": safe_error,
                "error_id": error_id,
                "support": "Contact support with this error_id"
            }
        )
    else:
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
            },
            "rate_limiter": RATE_LIMITER_AVAILABLE,
            "cache": CACHE_AVAILABLE,
        }

    @app.get("/debug/cache")
    async def debug_cache():
        """Statistiques du cache — Uniquement en développement."""
        if not CACHE_AVAILABLE:
            return {"error": "Cache not available"}
        return {"status": "ok", "stats": cache_service.get_stats()}
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
