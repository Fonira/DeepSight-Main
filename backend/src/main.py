"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🤿  DEEP SIGHT API v3.3 — FastAPI Backend + Logging + Sentry                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Backend API pour l'application Deep Sight                                         ║
║  🆕 v3.3: Logging structuré + Middlewares de monitoring                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
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
    logger.warning(f"⚠️ Logging module not available: {e}")
    
    # Fallback logger
    class FallbackLogger:
        def info(self, msg, **kwargs): logger.info(f"ℹ️ {msg}")
        def warning(self, msg, **kwargs): logger.warning(f"⚠️ {msg}")
        def error(self, msg, **kwargs): logger.error(f"❌ {msg}")
        def debug(self, msg, **kwargs): logger.info(f"🔍 {msg}")
        def exception(self, msg, **kwargs): logger.error(f"💥 {msg}")
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
from admin.finetuning_router import router as finetuning_router
from exports.router import router as exports_router
from playlists.router import router as playlists_router
from history.history_router import router as history_router
from demo.router import router as demo_router

# 🎯 GEO (Generative Engine Optimization)
try:
    from geo.router import router as geo_router
    GEO_ROUTER_AVAILABLE = True
except ImportError as e:
    GEO_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ GEO router not available: {e}")
from db.database import init_db, close_db
from core.http_client import init_http_client, close_http_client

# 🔒 Security Headers
try:
    from middleware.security_headers import SecurityHeadersMiddleware
    SECURITY_HEADERS_AVAILABLE = True
except ImportError as e:
    SECURITY_HEADERS_AVAILABLE = False
    logger.warning(f"⚠️ Security headers middleware not available: {e}")

# 🚦 Rate Limiting & Cache
try:
    from middleware.rate_limiter import RateLimitMiddleware, init_rate_limiter
    from core.config import RATE_LIMIT_ENABLED
    RATE_LIMITER_AVAILABLE = RATE_LIMIT_ENABLED
    if not RATE_LIMIT_ENABLED:
        logger.info("ℹ️ Rate limiter disabled via RATE_LIMIT_ENABLED=false")
except ImportError as e:
    RATE_LIMITER_AVAILABLE = False
    logger.warning(f"⚠️ Rate limiter not available: {e}")

try:
    from core.cache import init_cache, cache_service
    CACHE_AVAILABLE = True
except ImportError as e:
    CACHE_AVAILABLE = False
    logger.warning(f"⚠️ Cache service not available: {e}")

# ✅ NOUVEAU: Import du Profile router (avec fallback si absent)
try:
    from profile.router import router as profile_router
    PROFILE_ROUTER_AVAILABLE = True
except ImportError as e:
    PROFILE_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Profile router not available: {e}")

# 🌻 NOUVEAU: Import du Tournesol proxy router
try:
    from tournesol.router import router as tournesol_router
    TOURNESOL_ROUTER_AVAILABLE = True
except ImportError as e:
    TOURNESOL_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Tournesol router not available: {e}")

# 🎙️ TTS router (Text-to-Speech for summaries)
try:
    from tts.router import router as tts_router
    TTS_ROUTER_AVAILABLE = True
except ImportError as e:
    TTS_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ TTS router not available: {e}")

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
    logger.warning(f"⚠️ Notifications router not available: {e}")

# 🔑 NOUVEAU: Import du Public API router (Plan Expert)
try:
    from api_public.router import router as api_public_router
    API_PUBLIC_ROUTER_AVAILABLE = True
except ImportError as e:
    API_PUBLIC_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Public API router not available: {e}")

# 🧠 NOUVEAU: Import du Words router ("Le Saviez-Vous")
try:
    from words.router import router as words_router
    WORDS_ROUTER_AVAILABLE = True
except ImportError as e:
    WORDS_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Words router not available: {e}")

# 📚 NOUVEAU: Study router (mobile-compatible study tools)
try:
    from study.router import router as study_router
    STUDY_ROUTER_AVAILABLE = True
except ImportError as e:
    STUDY_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Study router not available: {e}")

# 📦 NOUVEAU: Batch router (analyses en lot - API v2)
try:
    from batch.router import router as batch_router
    BATCH_ROUTER_AVAILABLE = True
except ImportError as e:
    BATCH_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Batch router not available: {e}")

# 📚 NOUVEAU: Import du Academic router (Sources Académiques)
try:
    from academic.router import router as academic_router
    ACADEMIC_ROUTER_AVAILABLE = True
except ImportError as e:
    ACADEMIC_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Academic router not available: {e}")

# 🩺 Monitoring router (health checks, status page)
try:
    from monitoring.router import router as monitoring_router, set_startup_time
    from monitoring.scheduler import monitoring_job
    MONITORING_AVAILABLE = True
except ImportError as e:
    MONITORING_AVAILABLE = False
    logger.warning(f"⚠️ Monitoring module not available: {e}")

# 📬 Contact router (contact form)
try:
    from contact.router import router as contact_router
    CONTACT_AVAILABLE = True
except ImportError as e:
    CONTACT_AVAILABLE = False
    logger.warning(f"⚠️ Contact router not available: {e}")

# 🔗 Share router (public analysis sharing)
try:
    from share.router import router as share_router
    SHARE_ROUTER_AVAILABLE = True
except ImportError as e:
    SHARE_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Share router not available: {e}")

# 📊 Analytics router (event tracking)
try:
    from analytics.router import router as analytics_router
    ANALYTICS_ROUTER_AVAILABLE = True
except ImportError as e:
    ANALYTICS_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Analytics router not available: {e}")

# 🔥 Trending router (most-analyzed videos)
try:
    from trending.router import router as trending_router
    TRENDING_ROUTER_AVAILABLE = True
except ImportError as e:
    TRENDING_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Trending router not available: {e}")

# 🔍 Search router (semantic search)
try:
    from search.router import router as search_router
    SEARCH_ROUTER_AVAILABLE = True
except ImportError as e:
    SEARCH_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Search router not available: {e}")

# 🎭 Debate router (AI Debate — confrontation de perspectives)
try:
    from debate.router import router as debate_router
    DEBATE_ROUTER_AVAILABLE = True
except ImportError as e:
    DEBATE_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Debate router not available: {e}")

# 🆚 Comparison router (Video VS Mode)
try:
    from comparison.router import router as comparison_router
    COMPARISON_ROUTER_AVAILABLE = True
except ImportError as e:
    COMPARISON_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Comparison router not available: {e}")

# 🎨 Keyword Images router (IA illustrations for "Le Saviez-Vous")
try:
    from images.router import router as images_router
    IMAGES_ROUTER_AVAILABLE = True
except Exception as e:
    IMAGES_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Images router not available: {e}")

# 🩺 Health check v2 router (deep health checks)
try:
    from health.router import router as health_v1_router
    HEALTH_V1_ROUTER_AVAILABLE = True
except ImportError as e:
    HEALTH_V1_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Health v1 router not available: {e}")

# 💾 Video Content Cache (L1 Redis + L2 PostgreSQL VPS)
try:
    from services.video_content_cache import VideoContentCacheService
    from api.v1.cache import router as cache_router, set_cache_service
    VIDEO_CACHE_AVAILABLE = True
except ImportError as e:
    VIDEO_CACHE_AVAILABLE = False
    logger.warning(f"⚠️ Video content cache not available: {e}")

# 🎙️ Voice chat router (ElevenLabs Conversational AI)
try:
    from voice.router import router as voice_router
    VOICE_ROUTER_AVAILABLE = True
except ImportError as e:
    VOICE_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Voice router not available: {e}")

# 🎮 Gamification router (XP, badges, streaks, heat-map)
try:
    from gamification.router import router as gamification_router
    GAMIFICATION_ROUTER_AVAILABLE = True
except ImportError as e:
    GAMIFICATION_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Gamification router not available: {e}")

# 📖 Study Review router (FSRS spaced-repetition)
try:
    from study.review_router import router as study_review_router
    STUDY_REVIEW_ROUTER_AVAILABLE = True
except ImportError as e:
    STUDY_REVIEW_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Study review router not available: {e}")

# 📄 Documents router (Mistral OCR — PDF/Image analysis)
try:
    from documents.router import router as documents_router
    DOCUMENTS_ROUTER_AVAILABLE = True
except ImportError as e:
    DOCUMENTS_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Documents router not available: {e}")

# Global video cache instance
_video_cache: "VideoContentCacheService | None" = None


def get_video_cache():
    """Getter pour le service de cache vidéo global."""
    return _video_cache

VERSION = "3.8.1"  # Phase 4.1: Analytics, Store Review, Push i18n
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
                logger.info(f"  ✅ Migration OK: {table}.{column}")
            except Exception as e:
                # Ignorer si la colonne existe déjà ou autre erreur non bloquante
                await session.rollback()
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    logger.info(f"  ℹ️ Already exists: {table}.{column}")
                else:
                    logger.warning(f"  ⚠️ Migration warning for {table}.{column}: {e}")
        
        # Migrations ALTER COLUMN (changement de type)
        for table, column, sql in alter_column_migrations:
            try:
                await session.execute(text(sql))
                await session.commit()
                logger.info(f"  ✅ Column type changed: {table}.{column} -> TEXT")
            except Exception as e:
                await session.rollback()
                # Ignorer si déjà le bon type
                logger.info(f"  ℹ️ Column type migration: {table}.{column} - {str(e)[:50]}")


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

        # Étape 4b: 🔴 Initialiser TaskStore + GuestLimiter + arXiv rate limiter (Redis)
        try:
            redis_url = os.environ.get("REDIS_URL")
            if redis_url and CACHE_AVAILABLE and cache_service.is_redis:
                redis_client = cache_service.backend.redis
                from core.task_store import task_store, guest_limiter
                await task_store.init_redis(redis_client)
                await guest_limiter.init_redis(redis_client)
                try:
                    from academic.arxiv_client import init_arxiv_redis
                    await init_arxiv_redis(redis_client)
                except ImportError:
                    pass
                logger.info("TaskStore + GuestLimiter + arXiv Redis initialized")
            else:
                logger.info("TaskStore + GuestLimiter using in-memory fallback (no Redis)")
        except Exception as ts_err:
            logger.warning(f"TaskStore Redis init failed (non-blocking): {ts_err}")

        # Étape 5: Démarrer la queue email (throttled Resend)
        try:
            from services.email_queue import email_queue
            email_queue.start()
            logger.info("Email queue started")
        except Exception as eq_err:
            logger.warning(f"Email queue init failed (non-blocking): {eq_err}")

        # Étape 6: Initialiser le Video Content Cache (L1 Redis + L2 PostgreSQL VPS)
        global _video_cache
        if VIDEO_CACHE_AVAILABLE:
            try:
                from core.config import CACHE_CONFIG
                redis_url = CACHE_CONFIG.get("REDIS_URL", "")
                vps_db_url = CACHE_CONFIG.get("VPS_DATABASE_URL", "")
                if redis_url and vps_db_url:
                    _video_cache = VideoContentCacheService(
                        redis_url=redis_url,
                        vps_database_url=vps_db_url,
                    )
                    await _video_cache.initialize()
                    set_cache_service(_video_cache)
                    logger.info("Video content cache initialized (L1=Redis, L2=PostgreSQL VPS)")
                else:
                    logger.info("Video content cache disabled (missing REDIS_URL or VPS_DATABASE_URL)")
            except Exception as vc_err:
                logger.warning(f"Video content cache init failed (non-blocking): {vc_err}")
                _video_cache = None

        # Étape 7: Seed gamification badges
        try:
            from gamification.badges import seed_badges
            from db.database import async_session_maker
            async with async_session_maker() as badge_session:
                await seed_badges(badge_session)
            logger.info("Gamification badges seeded")
        except Exception as badge_err:
            logger.warning(f"Badge seeding failed (non-blocking): {badge_err}")

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

    # 🌐 Initialiser le client HTTP partagé (connection pooling)
    await init_http_client()
    logger.info("Shared HTTP client initialized (connection pooling enabled)")

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
            """Onboarding emails — Redis lock pour éviter multi-worker execution."""
            try:
                # Redis distributed lock (SETNX): un seul worker exécute le job
                lock_acquired = False
                try:
                    from core.cache import cache_service
                    if hasattr(cache_service, 'backend') and hasattr(cache_service.backend, 'redis'):
                        redis = cache_service.backend.redis
                        # SET NX EX = set-if-not-exists avec TTL 5min
                        lock_acquired = await redis.set(
                            "deepsight:lock:onboarding_emails", "1", nx=True, ex=300
                        )
                    else:
                        lock_acquired = True  # Pas de Redis → fallback (idempotent)
                except Exception:
                    lock_acquired = True  # Redis down → on laisse passer (idempotent)

                if not lock_acquired:
                    return  # Un autre worker a déjà le lock

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

        # 🖼️ Keyword image generation (every hour)
        async def _scheduled_image_gen():
            """Generate 1 keyword image per hour."""
            try:
                from images.keyword_images import generate_hourly_image
                await generate_hourly_image()
            except Exception as e:
                logger.error(f"Hourly image generation failed: {e}")

        scheduler.add_job(
            _scheduled_image_gen,
            _IT(hours=1),
            id="hourly_keyword_image",
            name="Hourly keyword image generation",
            replace_existing=True,
        )
        logger.info("Keyword image scheduler registered (every 1 hour)")

        # 🖼️ Thumbnail R2 persistence retry (every 2 hours)
        async def _scheduled_thumbnail_retry():
            """Retry thumbnails that failed or are missing from R2."""
            try:
                # Redis distributed lock
                lock_acquired = False
                try:
                    from core.cache import cache_service
                    if hasattr(cache_service, 'backend') and hasattr(cache_service.backend, 'redis'):
                        redis = cache_service.backend.redis
                        lock_acquired = await redis.set(
                            "deepsight:lock:thumbnail_retry", "1", nx=True, ex=600
                        )
                    else:
                        lock_acquired = True
                except Exception:
                    lock_acquired = True

                if not lock_acquired:
                    return

                from db.database import get_session as _get_sess
                from sqlalchemy import text
                async for db in _get_sess():
                    rows = (await db.execute(text(
                        "SELECT id, video_id, title, thumbnail_url, category, platform "
                        "FROM summaries "
                        "WHERE thumbnail_url IS NULL "
                        "OR thumbnail_url LIKE 'data:image/svg%' "
                        "OR thumbnail_url = '' "
                        "ORDER BY id DESC LIMIT 10"
                    ))).fetchall()

                    if not rows:
                        break

                    from storage.thumbnail_generator import ensure_thumbnail
                    import asyncio as _aio_sched
                    for row in rows:
                        try:
                            await ensure_thumbnail(
                                summary_id=row.id,
                                video_id=row.video_id or "",
                                title=row.title or "",
                                category=row.category,
                                platform=row.platform or "youtube",
                                original_url=row.thumbnail_url if row.thumbnail_url and not row.thumbnail_url.startswith("data:") else None,
                                video_url=None,
                            )
                            await _aio_sched.sleep(5)
                        except Exception as e:
                            logger.warning(f"Thumbnail retry failed for summary {row.id}: {e}")
                    break
            except Exception as e:
                logger.error(f"Thumbnail retry job failed: {e}")

        scheduler.add_job(
            _scheduled_thumbnail_retry,
            _IT(hours=2),
            id="thumbnail_r2_retry",
            name="Thumbnail R2 persistence retry",
            replace_existing=True,
        )
        logger.info("Thumbnail R2 retry scheduler registered (every 2 hours)")

        # 🌻 Trending pre-cache job (every hour)
        async def _scheduled_trending_refresh():
            """Pre-cache Tournesol trending recommendations."""
            try:
                from tournesol.trending_cache import refresh_trending_cache
                await refresh_trending_cache()
            except Exception as e:
                logger.error(f"Trending cache refresh failed: {e}")

        scheduler.add_job(
            _scheduled_trending_refresh,
            _IT(hours=1),
            id="trending_precache",
            name="Tournesol trending pre-cache",
            replace_existing=True,
        )
        logger.info("Trending pre-cache scheduler registered (every 1 hour)")

        # Warm the cache immediately on startup
        asyncio.create_task(_scheduled_trending_refresh())

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
    # Stop email queue worker
    try:
        from services.email_queue import email_queue
        email_queue.stop()
        logger.info("Email queue stopped")
    except Exception:
        pass
    # Close video content cache
    if _video_cache is not None:
        try:
            await _video_cache.close()
            logger.info("Video content cache closed")
        except Exception:
            pass
    # Close shared HTTP client
    await close_http_client()
    logger.info("Shared HTTP client closed")
    await close_db()
    logger.info("Application shutdown")

app = FastAPI(
    title=APP_NAME,
    version=VERSION,
    description="API Backend pour Deep Sight - Analyse YouTube avec IA",
    redirect_slashes=False,  # Évite les redirections 307 qui perdent les headers
    lifespan=lifespan,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if ENVIRONMENT != "production" else None,
)


@app.get("/health")
async def health_check():
    """Healthcheck liveness pour Hetzner/Docker."""
    from fastapi.responses import JSONResponse
    if not _app_state.get("ready", False):
        error = _app_state.get("error")
        return JSONResponse(
            status_code=503,
            content={
                "status": "starting",
                "db_initialized": _app_state.get("db_initialized", False),
                "migrations_completed": _app_state.get("migrations_completed", False),
                "error": error,
            }
        )
    return {"status": "ok", "db": "ready"}


@app.get("/health/ready")
async def health_ready():
    """
    Readiness check enrichi — vérifie DB, Redis, et HTTP client.
    Retourne le statut détaillé de chaque composant.
    Utilisé par le monitoring et les alertes.
    """
    from fastapi.responses import JSONResponse
    import time as _t

    checks = {}
    overall_ok = True

    # 1. App state
    if not _app_state.get("ready", False):
        return JSONResponse(status_code=503, content={
            "status": "starting",
            "checks": {"app": {"status": "starting"}}
        })

    # 2. Database check (SELECT 1)
    try:
        _db_start = _t.time()
        from db.database import get_session
        from sqlalchemy import text
        async for session in get_session():
            await session.execute(text("SELECT 1"))
            break
        _db_ms = round((_t.time() - _db_start) * 1000, 1)
        checks["database"] = {"status": "ok", "latency_ms": _db_ms}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)[:200]}
        overall_ok = False

    # 3. Redis check (PING)
    try:
        _redis_start = _t.time()
        from core.cache import cache_service
        if hasattr(cache_service, 'backend') and hasattr(cache_service.backend, 'redis'):
            pong = await cache_service.backend.redis.ping()
            _redis_ms = round((_t.time() - _redis_start) * 1000, 1)
            checks["redis"] = {"status": "ok" if pong else "error", "latency_ms": _redis_ms}
        else:
            checks["redis"] = {"status": "not_configured"}
    except Exception as e:
        checks["redis"] = {"status": "error", "error": str(e)[:200]}
        overall_ok = False

    # 4. HTTP client pool
    try:
        from core.http_client import get_http_client_optional
        client = get_http_client_optional()
        if client is not None:
            checks["http_pool"] = {"status": "ok"}
        else:
            checks["http_pool"] = {"status": "not_initialized"}
    except Exception as e:
        checks["http_pool"] = {"status": "error", "error": str(e)[:200]}

    status_code = 200 if overall_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if overall_ok else "degraded",
            "checks": checks,
        }
    )


# Configuration CORS - CRITIQUE pour éviter les erreurs 502
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Platform", "X-Requested-With"],
    expose_headers=["Content-Disposition", "X-Session-Invalid"],
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
            "/api/health/deep",
            "/api/v1/health",
            "/api/v1/health/deep",
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
app.include_router(demo_router, prefix="/api/demo", tags=["Demo"])
app.include_router(videos_router, prefix="/api/videos", tags=["Videos"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])
app.include_router(billing_router, prefix="/api/stripe", tags=["Stripe"], include_in_schema=False)
logger.info("Billing router loaded (available at /api/billing and /api/stripe)")
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(finetuning_router, prefix="/api/admin/finetune", tags=["Fine-tuning"])
app.include_router(exports_router, prefix="/api/exports", tags=["Exports"])
app.include_router(playlists_router, prefix="/api/playlists", tags=["Playlists"])
app.include_router(history_router, prefix="/api/history", tags=["History"])

# ✅ NOUVEAU: Profile router pour avatar et préférences
if PROFILE_ROUTER_AVAILABLE:
    app.include_router(profile_router, prefix="/api/profile", tags=["Profile"])
    logger.info("✅ Profile router loaded")

# 🌻 NOUVEAU: Tournesol proxy router
if TOURNESOL_ROUTER_AVAILABLE:
    app.include_router(tournesol_router, prefix="/api/tournesol", tags=["Tournesol"])
    logger.info("🌻 Tournesol router loaded")

# 🎙️ NOUVEAU: TTS (Text-to-Speech) router
if TTS_ROUTER_AVAILABLE:
    app.include_router(tts_router, prefix="/api/tts", tags=["Text-to-Speech"])
    logger.info("🎙️ TTS router loaded")

# 📊 NOUVEAU: Usage router (statistiques d'utilisation)
if USAGE_ROUTER_AVAILABLE:
    app.include_router(usage_router, prefix="/api/usage", tags=["Usage"])
    logger.info("📊 Usage router loaded")

# 🔔 NOUVEAU: Notifications router (SSE temps réel)
if NOTIFICATIONS_ROUTER_AVAILABLE:
    app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
    logger.info("🔔 Notifications router loaded (SSE)")

# 🔑 NOUVEAU: Public API router (Plan Expert)
if API_PUBLIC_ROUTER_AVAILABLE:
    app.include_router(api_public_router, tags=["Public API v1"])
    logger.info("🔑 Public API router loaded (Expert plan)")

# 🧠 NOUVEAU: Words router ("Le Saviez-Vous")
if WORDS_ROUTER_AVAILABLE:
    app.include_router(words_router, prefix="/api/words", tags=["Words"])
    logger.info("🧠 Words router loaded (Le Saviez-Vous)")

# 📚 NOUVEAU: Study router (mobile-compatible study tools)
if STUDY_ROUTER_AVAILABLE:
    app.include_router(study_router, prefix="/api/study", tags=["Study"])
    logger.info("📚 Study router loaded (quiz, mindmap, flashcards)")

# 📦 NOUVEAU: Batch router (analyses en lot - API v2)
if BATCH_ROUTER_AVAILABLE:
    app.include_router(batch_router, prefix="/api/batch", tags=["Batch"])
    logger.info("📦 Batch router loaded (batch video analysis)")

# 📚 NOUVEAU: Academic router (Sources Académiques)
if ACADEMIC_ROUTER_AVAILABLE:
    app.include_router(academic_router, tags=["Academic"])
    logger.info("📚 Academic router loaded (Semantic Scholar, OpenAlex, arXiv)")

# 🎯 NOUVEAU: GEO router (Generative Engine Optimization)
if GEO_ROUTER_AVAILABLE:
    app.include_router(geo_router, prefix="/api/geo", tags=["GEO"])
    logger.info("🎯 GEO router loaded (score, quotes)")

# 🩺 Monitoring router (health checks, status)
if MONITORING_AVAILABLE:
    app.include_router(monitoring_router, prefix="/api/health", tags=["Monitoring"])
    logger.info("🩺 Monitoring router loaded (/api/health/ping, /api/health/status)")

# 📬 Contact router
if CONTACT_AVAILABLE:
    app.include_router(contact_router, prefix="/api", tags=["Contact"])
    logger.info("📬 Contact router loaded (POST /api/contact)")

# 🔗 Share router (public analysis sharing)
if SHARE_ROUTER_AVAILABLE:
    app.include_router(share_router, prefix="/api/share", tags=["Share"])
    logger.info("🔗 Share router loaded (POST /api/share, GET /api/share/{token})")

# 📊 Analytics router
if ANALYTICS_ROUTER_AVAILABLE:
    app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
    logger.info("📊 Analytics router loaded (POST /api/analytics/events, GET /api/analytics/summary)")

# 🔥 Trending router (most-analyzed videos, public)
if TRENDING_ROUTER_AVAILABLE:
    app.include_router(trending_router, prefix="/api/trending", tags=["Trending"])
    logger.info("🔥 Trending router loaded (GET /api/trending)")

# 🔍 Search router (semantic search via Mistral embeddings)
if SEARCH_ROUTER_AVAILABLE:
    app.include_router(search_router, prefix="/api/search", tags=["Search"])
    logger.info("🔍 Search router loaded (POST /api/search/semantic)")

# 🎭 Debate router (AI Debate — confrontation de perspectives)
if DEBATE_ROUTER_AVAILABLE:
    app.include_router(debate_router, prefix="/api/debate", tags=["Debate"])
    logger.info("🎭 Debate router loaded (POST /api/debate/create)")

# 🆚 Comparison router (Video VS Mode)
if COMPARISON_ROUTER_AVAILABLE:
    app.include_router(comparison_router, prefix="/api/comparison", tags=["Comparison"])
    logger.info("🆚 Comparison router loaded (POST /api/comparison/compare)")

# 🎨 Keyword Images router (IA illustrations for "Le Saviez-Vous")
if IMAGES_ROUTER_AVAILABLE:
    app.include_router(images_router, prefix="/api/images", tags=["Keyword Images"])
    logger.info("🎨 Images router loaded (GET /api/images/keyword/{term})")

# 🩺 Health check v1 router (deep health checks)
if HEALTH_V1_ROUTER_AVAILABLE:
    app.include_router(health_v1_router, prefix="/api/v1/health", tags=["Health Check"])
    logger.info("🩺 Health v1 router loaded (GET /api/v1/health, GET /api/v1/health/deep)")

# 💾 Video Content Cache router (cache status & stats)
if VIDEO_CACHE_AVAILABLE:
    app.include_router(cache_router, tags=["Video Cache"])
    logger.info("💾 Video cache router loaded (GET /api/v1/cache/video/{platform}/{video_id}, GET /api/v1/cache/stats)")

# 🎙️ Voice chat router
if VOICE_ROUTER_AVAILABLE:
    app.include_router(voice_router, prefix="/api/voice", tags=["Voice"])
    logger.info("🎙️ Voice router loaded (GET /api/voice/quota, POST /api/voice/session, POST /api/voice/webhook)")

# 🎮 Gamification router (XP, badges, streaks)
if GAMIFICATION_ROUTER_AVAILABLE:
    app.include_router(gamification_router, prefix="/api/gamification", tags=["Gamification"])
    logger.info("🎮 Gamification router loaded (GET /api/gamification/stats, badges, heat-map)")

# 📖 Study Review router (FSRS spaced-repetition)
if STUDY_REVIEW_ROUTER_AVAILABLE:
    app.include_router(study_review_router, prefix="/api/study/review", tags=["Study Review"])
    logger.info("📖 Study review router loaded (POST /api/study/review/submit, GET /due)")

# 📄 Documents router (Mistral OCR — PDF/Image analysis)
if DOCUMENTS_ROUTER_AVAILABLE:
    app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
    logger.info("📄 Documents router loaded (POST /api/documents/analyze-url, /analyze-upload, /ocr-only)")

# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS DE BASE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    """Page d'accueil de l'API"""
    if ENVIRONMENT == "production":
        return {"status": "ok"}
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
# GESTION GLOBALE DES ERREURS (avec traduction i18n)
# ═══════════════════════════════════════════════════════════════════════════════

from core.error_messages import get_lang, translate_error, translate_detail, translate_http_status


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handler pour les HTTPException (400, 401, 403, 404, etc.).
    Traduit le detail si Accept-Language contient 'fr'.
    """
    lang = get_lang(request)
    detail = translate_detail(exc.detail, lang)

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handler pour les erreurs de validation Pydantic.
    Traduit les messages de validation si Accept-Language contient 'fr'.
    """
    lang = get_lang(request)
    errors = translate_detail(exc.errors(), lang)

    status_msg = translate_http_status(422, lang)
    return JSONResponse(
        status_code=422,
        content={
            "detail": errors,
            **({"message": status_msg} if status_msg else {}),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Capture toutes les exceptions non gérées.

    SÉCURITÉ: Ne jamais exposer les détails d'erreur en production.
    """
    import uuid
    error_id = str(uuid.uuid4())[:8]
    error_msg = str(exc)
    lang = get_lang(request)
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

    # Traduire si français
    safe_error = translate_error(safe_error, lang)
    detail_msg = translate_error("Internal server error", lang)
    support_msg = translate_error("Contact support with this error_id", lang)

    # SÉCURITÉ: En production, ne pas exposer les détails d'erreur
    if ENVIRONMENT == "production":
        return JSONResponse(
            status_code=500,
            content={
                "detail": detail_msg,
                "error": safe_error,
                "error_id": error_id,
                "support": support_msg
            }
        )
    else:
        return JSONResponse(
            status_code=500,
            content={"detail": detail_msg, "error": error_msg, "error_id": error_id}
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
