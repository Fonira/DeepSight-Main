"""
CONFIGURATION CENTRALE — Deep Sight API
v4.0 — Pydantic Settings + Production Guards

DOIT RESTER SYNCHRONISE AVEC:
- Frontend: src/config/planPrivileges.ts
- Frontend: src/pages/UpgradePage.tsx
"""

import os
import sys
from typing import Dict, Any, Optional

from pydantic_settings import BaseSettings
from pydantic import Field, model_validator


# =============================================================================
# PYDANTIC SETTINGS — Validated env vars
# =============================================================================

class _DeepSightSettings(BaseSettings):
    """Validated environment configuration. Refuses to start with insecure
    defaults in production."""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # -- Environment --
    ENV: str = "development"
    RAILWAY_ENVIRONMENT: Optional[str] = None
    DATABASE_PATH: str = ""
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    CUSTOM_DOMAIN: str = ""
    PORT: int = 8000

    # -- Admin --
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = ""
    ADMIN_SECRET_KEY: str = ""

    # -- JWT --
    JWT_SECRET_KEY: str = ""

    # -- API Keys --
    MISTRAL_API_KEY: str = ""
    SUPADATA_API_KEY: str = ""
    PERPLEXITY_API_KEY: str = ""
    BRAVE_SEARCH_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""
    ASSEMBLYAI_API_KEY: str = ""
    SEMANTIC_SCHOLAR_API_KEY: str = ""

    # -- YouTube Proxy (pour contourner le blocage IP YouTube sur VPS) --
    YOUTUBE_PROXY: str = ""  # ex: socks5://user:pass@host:port ou http://user:pass@host:port

    # -- Email --
    EMAIL_ENABLED: str = "true"
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@deepsightsynthesis.com"
    FROM_NAME: str = "DeepSight"

    # -- Stripe --
    STRIPE_ENABLED: str = "true"
    STRIPE_TEST_MODE: str = "false"
    STRIPE_SECRET_KEY_TEST: str = ""
    STRIPE_SECRET_KEY_LIVE: str = ""
    STRIPE_PUBLISHABLE_KEY_TEST: str = ""
    STRIPE_PUBLISHABLE_KEY_LIVE: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO_TEST: str = ""
    STRIPE_PRICE_PRO_LIVE: str = ""
    STRIPE_PRICE_EXPERT_TEST: str = ""
    STRIPE_PRICE_EXPERT_LIVE: str = ""

    # -- Google OAuth --
    GOOGLE_OAUTH_ENABLED: str = "false"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # -- CRON --
    CRON_SECRET: str = ""

    # -- Monitoring --
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    VERBOSE_LOGGING: str = "false"
    HEALTH_CHECK_SECRET: str = ""

    # -- Rate Limiting --
    RATE_LIMIT_ENABLED: str = "true"

    # -- Cache & Queues --
    REDIS_URL: str = ""
    VPS_DATABASE_URL: str = ""  # PostgreSQL VPS pour cache L2 (video content cache)
    CACHE_MAX_SIZE: int = 10000
    CACHE_TTL_TRANSCRIPT: int = 86400   # 24h
    CACHE_TTL_ANALYSIS: int = 3600      # 1h
    CACHE_TTL_FACTCHECK: int = 1800     # 30min

    # -- TTS --
    TTS_PROVIDER: str = "openai"
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_AGENT_TEMPLATE_ID: str = ""
    ELEVENLABS_WEBHOOK_SECRET: str = ""
    ELEVENLABS_VOICE_ID: str = ""
    ELEVENLABS_MODEL_ID: str = "eleven_flash_v2_5"

    # -- Legal --
    LEGAL_OWNER_NAME: str = "LEPARC Maxime Bertrand"
    LEGAL_SIRET: str = "994 558 898 00015"
    LEGAL_RCS: str = "994 558 898 R.C.S. Lyon"
    LEGAL_CITY: str = "La Mulatiere, France"
    LEGAL_ADDRESS: str = "15 Chemin Clement Mulat, 69350 La Mulatiere"
    LEGAL_EMAIL: str = "contact@deepsight.fr"

    # -- Backup / S3 --
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-west-3"
    BACKUP_S3_BUCKET: str = "deepsight-backups"
    BACKUP_S3_PREFIX: str = "db-backups/"
    BACKUP_CRON_HOUR: int = 3
    BACKUP_CRON_MINUTE: int = 0
    BACKUP_RETENTION_DAYS: int = 30

    # -- R2 Thumbnail Storage --
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "deepsight-thumbnails"
    R2_PUBLIC_DOMAIN: str = ""
    R2_ENABLED: bool = False

    # -- Transcript --
    YTDLP_COOKIES_PATH: str = ""
    MAX_DURATION_FOR_STT: int = Field(default=1200)

    @property
    def is_production(self) -> bool:
        return self.ENV == "production" or self.RAILWAY_ENVIRONMENT is not None

    @model_validator(mode="after")
    def _validate_production(self):
        """Refuse to start with insecure or test config in production."""
        if not self.is_production:
            return self

        errors = []

        # Secrets must be set
        if not self.ADMIN_PASSWORD:
            errors.append("ADMIN_PASSWORD must be set in production")
        if not self.ADMIN_SECRET_KEY:
            errors.append("ADMIN_SECRET_KEY must be set in production")
        jwt_key = self.JWT_SECRET_KEY or self.ADMIN_SECRET_KEY
        if len(jwt_key) < 32:
            errors.append(
                f"JWT_SECRET_KEY (or ADMIN_SECRET_KEY) must be >= 32 chars in production (got {len(jwt_key)})"
            )

        # Reject known insecure defaults
        insecure_passwords = {"DeepSight2024!", "password", "admin", "changeme", ""}
        if self.ADMIN_PASSWORD in insecure_passwords:
            errors.append("ADMIN_PASSWORD is insecure — set a strong password")
        insecure_keys = {"deepsight_secret_key_2024", "secret", "changeme", ""}
        if self.ADMIN_SECRET_KEY in insecure_keys:
            errors.append("ADMIN_SECRET_KEY is insecure — set a random 32+ char string")

        # Reject Stripe test keys in production
        if self.STRIPE_ENABLED.lower() == "true" and self.STRIPE_TEST_MODE.lower() == "true":
            errors.append("STRIPE_TEST_MODE=true is forbidden in production")
        if self.STRIPE_SECRET_KEY_LIVE.startswith("sk_test_"):
            errors.append("STRIPE_SECRET_KEY_LIVE contains a test key (sk_test_)")
        if self.STRIPE_SECRET_KEY_TEST.startswith("sk_live_"):
            errors.append("STRIPE_SECRET_KEY_TEST contains a live key (sk_live_)")

        if errors:
            msg = "\n  PRODUCTION CONFIG ERRORS:\n  - " + "\n  - ".join(errors)
            print(f"\n{'='*60}\n{msg}\n{'='*60}\n", file=sys.stderr, flush=True)
            raise SystemExit(1)

        return self


# Instantiate settings (reads .env + env vars)
_settings = _DeepSightSettings()

# =============================================================================
# BACKWARD-COMPATIBLE MODULE EXPORTS
# =============================================================================

VERSION = "4.0.0"
APP_NAME = "Deep Sight"
IS_RAILWAY = _settings.RAILWAY_ENVIRONMENT is not None
ENV = _settings.ENV

# Data directory
DATA_DIR = _settings.DATABASE_PATH or ("/app/data" if IS_RAILWAY else "./data")
os.makedirs(DATA_DIR, exist_ok=True)

# URLs
APP_URL = _settings.APP_URL
FRONTEND_URL = _settings.FRONTEND_URL
CUSTOM_DOMAIN = _settings.CUSTOM_DOMAIN

# =============================================================================
# ADMIN
# =============================================================================

ADMIN_CONFIG = {
    "ADMIN_USERNAME": _settings.ADMIN_USERNAME,
    "ADMIN_EMAIL": _settings.ADMIN_EMAIL,
    "ADMIN_PASSWORD": _settings.ADMIN_PASSWORD,
    "ADMIN_SECRET_KEY": _settings.ADMIN_SECRET_KEY,
}

# =============================================================================
# API KEYS
# =============================================================================

MISTRAL_API_KEY = _settings.MISTRAL_API_KEY
SUPADATA_API_KEY = _settings.SUPADATA_API_KEY
PERPLEXITY_API_KEY = _settings.PERPLEXITY_API_KEY
BRAVE_SEARCH_API_KEY = _settings.BRAVE_SEARCH_API_KEY
OPENAI_API_KEY = _settings.OPENAI_API_KEY
YOUTUBE_PROXY = _settings.YOUTUBE_PROXY

# =============================================================================
# CRON
# =============================================================================

CRON_SECRET = _settings.CRON_SECRET or "deepsight-cron-secret"

# =============================================================================
# EMAIL (Resend)
# =============================================================================

EMAIL_CONFIG = {
    "ENABLED": _settings.EMAIL_ENABLED.lower() == "true",
    "RESEND_API_KEY": _settings.RESEND_API_KEY,
    "FROM_EMAIL": _settings.FROM_EMAIL,
    "FROM_NAME": _settings.FROM_NAME,
}

# =============================================================================
# STRIPE
# =============================================================================

STRIPE_CONFIG = {
    "ENABLED": _settings.STRIPE_ENABLED.lower() == "true",
    "TEST_MODE": _settings.STRIPE_TEST_MODE.lower() == "true",
    "SECRET_KEY_TEST": _settings.STRIPE_SECRET_KEY_TEST,
    "SECRET_KEY_LIVE": _settings.STRIPE_SECRET_KEY_LIVE,
    "PUBLISHABLE_KEY_TEST": _settings.STRIPE_PUBLISHABLE_KEY_TEST,
    "PUBLISHABLE_KEY_LIVE": _settings.STRIPE_PUBLISHABLE_KEY_LIVE,
    "WEBHOOK_SECRET": _settings.STRIPE_WEBHOOK_SECRET,
    "PRICES": {
        "pro": {
            "test": _settings.STRIPE_PRICE_PRO_TEST,
            "live": _settings.STRIPE_PRICE_PRO_LIVE,
            "amount": 599, "credits": 30, "name": "Pro"
        },
        "expert": {
            "test": _settings.STRIPE_PRICE_EXPERT_TEST,
            "live": _settings.STRIPE_PRICE_EXPERT_LIVE,
            "amount": 1499, "credits": 100, "name": "Expert"
        }
    },
}

# =============================================================================
# GOOGLE OAUTH
# =============================================================================

GOOGLE_OAUTH_CONFIG = {
    "ENABLED": _settings.GOOGLE_OAUTH_ENABLED.lower() == "true",
    "CLIENT_ID": _settings.GOOGLE_CLIENT_ID,
    "CLIENT_SECRET": _settings.GOOGLE_CLIENT_SECRET,
    "REDIRECT_URI": _settings.GOOGLE_REDIRECT_URI or f"{APP_URL}/api/auth/google/callback",
}

# =============================================================================
# JWT
# =============================================================================

JWT_CONFIG = {
    "SECRET_KEY": _settings.JWT_SECRET_KEY or _settings.ADMIN_SECRET_KEY,
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
    "REFRESH_TOKEN_EXPIRE_DAYS": 30,
}

# =============================================================================
# LEGAL
# =============================================================================

LEGAL_CONFIG = {
    "OWNER_NAME": _settings.LEGAL_OWNER_NAME,
    "SIRET": _settings.LEGAL_SIRET,
    "RCS": _settings.LEGAL_RCS,
    "CITY": _settings.LEGAL_CITY,
    "ADDRESS": _settings.LEGAL_ADDRESS,
    "EMAIL": _settings.LEGAL_EMAIL,
    "HOST_NAME": "Hetzner Online GmbH",
    "HOST_ADDRESS": "Industriestr. 25, 91710 Gunzenhausen, Germany",
    "HOST_WEBSITE": "https://www.hetzner.com",
    "AI_PROVIDER": "Mistral AI SAS",
    "AI_PROVIDER_ADDRESS": "15 rue des Halles, 75001 Paris, France",
    "AI_PROVIDER_WEBSITE": "https://mistral.ai",
    "AI_DATA_LOCATION": "Union Européenne",
    "AI_DPA_URL": "https://legal.mistral.ai/terms/data-processing-addendum",
    "GDPR_COMPLIANT": True,
    "EU_AI_ACT_COMPLIANT": True,
    "CLOUD_ACT_EXEMPT": True,
    "SITE_NAME": "Deep Sight",
    "SITE_URL": APP_URL,
}

# =============================================================================
# ⚠️ DEPRECATED — PLAN_LIMITS est OBSOLÈTE.
# La source de vérité unique est : billing/plan_config.py → PLANS[plan]["limits"]
# Utiliser get_limits(plan_id) de billing/plan_config pour tout nouveau code.
# Ce dict reste pour rétrocompatibilité avec les modules non encore migrés.
# NE PAS MODIFIER ICI — modifier billing/plan_config.py à la place.
# =============================================================================

PLAN_LIMITS: Dict[str, Dict[str, Any]] = {
    "free": {
        "monthly_credits": 250,
        "daily_analyses": 5,
        "can_use_playlists": False,
        "max_playlist_videos": 0,
        "history_days": 60,
        "models": ["mistral-small-2603"],
        "default_model": "mistral-small-2603",
        "name": {"fr": "GRATUIT", "en": "FREE"},
        "color": "#6B7280",
        "price": 0,
        "price_display": {"fr": "0\u20ac", "en": "Free"},
        "chat_daily_limit": 10,
        "chat_per_video_limit": 5,
        "chat_playlist_enabled": False,
        "chat_corpus_daily": 0,
        "web_search_monthly": 0,
        "web_search_per_video": 0,
        "web_search_enabled": False,
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        "academic_papers_per_analysis": 0,
        "bibliography_export": False,
        "academic_full_text": False,
        "voice_chat_enabled": False,
        "voice_monthly_minutes": 0,
        "blocked_features": ["playlists", "export_csv", "export_excel", "batch_api", "tts", "deep_research", "voice_chat", "mindmap"],
        "upgrade_prompt": {
            "fr": "Passez \u00e0 Pro pour d\u00e9bloquer plus d'analyses et de fonctionnalit\u00e9s !",
            "en": "Upgrade to Pro to unlock more analyses and features!"
        }
    },
    "pro": {
        "monthly_credits": 3000,
        "daily_analyses": 30,
        "can_use_playlists": True,
        "max_playlist_videos": 5,
        "history_days": -1,
        "models": ["mistral-small-2603", "mistral-medium-2508"],
        "default_model": "mistral-medium-2508",
        "name": {"fr": "PRO", "en": "PRO"},
        "color": "#3B82F6",
        "price": 599,
        "price_display": {"fr": "5.99\u20ac/mois", "en": "\u20ac5.99/mo"},
        "playlist_credits_per_3_videos": 1,
        "chat_daily_limit": -1,
        "chat_per_video_limit": 25,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        "web_search_monthly": 20,
        "web_search_per_video": 5,
        "web_search_enabled": True,
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        "academic_papers_per_analysis": 15,
        "bibliography_export": True,
        "academic_full_text": False,
        "voice_chat_enabled": True,
        "voice_monthly_minutes": 10,
        "blocked_features": ["batch_api", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez \u00e0 Expert pour la recherche approfondie et le chat illimit\u00e9 !",
            "en": "Upgrade to Expert for deep research and unlimited chat!"
        }
    },
    "expert": {
        "monthly_credits": 10000,
        "daily_analyses": 100,
        "can_use_playlists": True,
        "max_playlist_videos": 20,
        "history_days": -1,
        "models": ["mistral-small-2603", "mistral-medium-2508", "mistral-large-2512"],
        "default_model": "mistral-large-2512",
        "name": {"fr": "EXPERT", "en": "EXPERT"},
        "color": "#F59E0B",
        "price": 1499,
        "price_display": {"fr": "14.99\u20ac/mois", "en": "\u20ac14.99/mo"},
        "playlist_credits_per_3_videos": 1,
        "chat_daily_limit": -1,
        "chat_per_video_limit": -1,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        "web_search_monthly": 60,
        "web_search_per_video": 10,
        "web_search_enabled": True,
        "deep_research_enabled": True,
        "deep_research_credits_cost": 50,
        "academic_papers_per_analysis": 50,
        "bibliography_export": True,
        "academic_full_text": True,
        "voice_chat_enabled": True,
        "voice_monthly_minutes": 20,
        "blocked_features": [],
        "upgrade_prompt": {
            "fr": "Vous avez le plan Expert, toutes les fonctionnalit\u00e9s sont d\u00e9bloqu\u00e9es !",
            "en": "You have the Expert plan, all features are unlocked!"
        }
    },
    "unlimited": {
        "monthly_credits": 999999,
        "daily_analyses": -1,
        "can_use_playlists": True,
        "max_playlist_videos": 100,
        "history_days": -1,
        "models": ["ministral-8b-2512", "mistral-small-2603", "mistral-medium-2508", "mistral-large-2512"],
        "default_model": "mistral-large-2512",
        "name": {"fr": "ADMIN", "en": "ADMIN"},
        "color": "#ffd700",
        "price": 0,
        "price_display": {"fr": "Illimit\u00e9", "en": "Unlimited"},
        "chat_daily_limit": -1,
        "chat_per_video_limit": -1,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        "web_search_monthly": -1,
        "web_search_per_video": -1,
        "web_search_enabled": True,
        "deep_research_enabled": True,
        "deep_research_credits_cost": 0,
        "academic_papers_per_analysis": 100,
        "bibliography_export": True,
        "academic_full_text": True,
        "voice_chat_enabled": True,
        "voice_monthly_minutes": -1,
        "blocked_features": [],
        "upgrade_prompt": {
            "fr": "Compte administrateur - acc\u00e8s illimit\u00e9",
            "en": "Admin account - unlimited access"
        }
    }
}

# =============================================================================
# BACKUP / S3
# =============================================================================

BACKUP_CONFIG = {
    "AWS_ACCESS_KEY_ID": _settings.AWS_ACCESS_KEY_ID,
    "AWS_SECRET_ACCESS_KEY": _settings.AWS_SECRET_ACCESS_KEY,
    "AWS_REGION": _settings.AWS_REGION,
    "S3_BUCKET": _settings.BACKUP_S3_BUCKET,
    "S3_PREFIX": _settings.BACKUP_S3_PREFIX,
    "CRON_HOUR": _settings.BACKUP_CRON_HOUR,
    "CRON_MINUTE": _settings.BACKUP_CRON_MINUTE,
    "RETENTION_DAYS": _settings.BACKUP_RETENTION_DAYS,
}

# =============================================================================
# R2 THUMBNAIL STORAGE
# =============================================================================

R2_CONFIG = {
    "ACCOUNT_ID": _settings.R2_ACCOUNT_ID,
    "ACCESS_KEY_ID": _settings.R2_ACCESS_KEY_ID,
    "SECRET_ACCESS_KEY": _settings.R2_SECRET_ACCESS_KEY,
    "BUCKET": _settings.R2_BUCKET_NAME,
    "PUBLIC_DOMAIN": _settings.R2_PUBLIC_DOMAIN,
    "ENABLED": _settings.R2_ENABLED,
}

# =============================================================================
# VOICE CHAT LIMITS
# =============================================================================

VOICE_LIMITS: Dict[str, Dict[str, Any]] = {
    "free":      {"enabled": False, "monthly_minutes": 0,   "max_session_minutes": 0},
    "pro":       {"enabled": True,  "monthly_minutes": 10,  "max_session_minutes": 10},
    "expert":    {"enabled": True,  "monthly_minutes": 20,  "max_session_minutes": 15},
    "unlimited": {"enabled": True,  "monthly_minutes": 999, "max_session_minutes": 30},
}

VOICE_CHAT_CONFIG: Dict[str, Any] = {
    "max_session_duration_seconds": 600,
    "min_billable_seconds": 5,
    "silence_timeout_seconds": 30,
    "quota_warning_thresholds": [50, 80, 95, 100],
    "grace_period_seconds": 15,
    "max_sessions_per_day": 50,
}

# =============================================================================
# MISTRAL MODELS — Gamme 2026 (Migration Mars 2026)
# =============================================================================
# 🇫🇷 100% Mistral AI — IA Française, données hébergées en UE
# DPA: https://legal.mistral.ai/terms/data-processing-addendum
# Zero Data Retention activé sur le compte API DeepSight
# =============================================================================

MISTRAL_MODELS = {
    # ── Tier 0 : Micro-tâches internes (entités, classification, flashcards) ──
    "ministral-8b-2512": {
        "name": "Ministral 8B",
        "context": 128000,
        "speed": "very_fast",
        "quality": "adequate",
        "cost_input_per_1m": 0.10,
        "cost_output_per_1m": 0.10,
        "plans": ["free", "pro", "expert", "unlimited"],
        "internal_only": True,
        "use_cases": ["entity_extraction", "flashcards", "classification", "study_tools"],
        "description": {
            "fr": "Ultra-rapide pour les tâches automatiques (extraction, flashcards)",
            "en": "Ultra-fast for automated tasks (extraction, flashcards)"
        }
    },

    # ── Tier 1 : Standard (Free + Étudiant + Starter) ──
    "mistral-small-2603": {
        "name": "Mistral Small 3.1",
        "context": 128000,
        "speed": "fast",
        "quality": "good",
        "cost_input_per_1m": 0.10,
        "cost_output_per_1m": 0.30,
        "plans": ["free", "pro", "expert", "unlimited"],
        "description": {
            "fr": "Rapide et intelligent, idéal pour les analyses courantes",
            "en": "Fast and smart, ideal for standard analyses"
        }
    },

    # ── Tier 2 : Avancé (Pro + Expert) ──
    "mistral-medium-2508": {
        "name": "Mistral Medium 3.1",
        "context": 131000,
        "speed": "medium",
        "quality": "very_good",
        "cost_input_per_1m": 0.40,
        "cost_output_per_1m": 2.00,
        "plans": ["pro", "expert", "unlimited"],
        "description": {
            "fr": "Analyses approfondies, raisonnement de niveau GPT-4",
            "en": "Deep analyses, GPT-4 level reasoning"
        }
    },

    # ── Tier 3 : Expert ──
    "mistral-large-2512": {
        "name": "Mistral Large 3",
        "context": 262000,
        "speed": "medium",
        "quality": "excellent",
        "cost_input_per_1m": 0.50,
        "cost_output_per_1m": 1.50,
        "plans": ["expert", "unlimited"],
        "description": {
            "fr": "Maximum de qualité, contexte 262K pour vidéos longues",
            "en": "Maximum quality, 262K context for long videos"
        }
    },
}

# Mapping ancien → nouveau (rétrocompatibilité API + DB)
MISTRAL_MODEL_ALIASES: Dict[str, str] = {
    "mistral-small-latest": "mistral-small-2603",
    "mistral-medium-latest": "mistral-medium-2508",
    "mistral-large-latest": "mistral-large-2512",
}

# Modèle dédié aux micro-tâches internes (entités, flashcards, classification)
MISTRAL_INTERNAL_MODEL = "ministral-8b-2512"

# Modèle de modération contenu
MISTRAL_MODERATION_MODEL = "mistral-moderation-latest"


def resolve_mistral_model(model_id: str) -> str:
    """Résout un alias de modèle legacy vers le nouveau modèle."""
    return MISTRAL_MODEL_ALIASES.get(model_id, model_id)

# =============================================================================
# CATEGORIES
# =============================================================================

CATEGORIES = {
    "interview": {"fr": "Interview", "en": "Interview", "icon": "mic"},
    "podcast": {"fr": "Podcast", "en": "Podcast", "icon": "headphones"},
    "documentary": {"fr": "Documentaire", "en": "Documentary", "icon": "film"},
    "tutorial": {"fr": "Tutoriel", "en": "Tutorial", "icon": "book-open"},
    "news": {"fr": "Actualit\u00e9s", "en": "News", "icon": "newspaper"},
    "conference": {"fr": "Conf\u00e9rence", "en": "Conference", "icon": "graduation-cap"},
    "debate": {"fr": "D\u00e9bat", "en": "Debate", "icon": "scale"},
    "science": {"fr": "Science", "en": "Science", "icon": "flask"},
    "tech": {"fr": "Tech", "en": "Tech", "icon": "laptop"},
    "finance": {"fr": "Finance", "en": "Finance", "icon": "coins"},
    "health": {"fr": "Sant\u00e9", "en": "Health", "icon": "heart-pulse"},
    "general": {"fr": "G\u00e9n\u00e9ral", "en": "General", "icon": "clipboard"},
}

# =============================================================================
# UTILITY FUNCTIONS (backward compatible)
# =============================================================================

def get_stripe_key() -> str:
    if STRIPE_CONFIG["TEST_MODE"]:
        return STRIPE_CONFIG["SECRET_KEY_TEST"] or STRIPE_CONFIG["SECRET_KEY_LIVE"]
    return STRIPE_CONFIG["SECRET_KEY_LIVE"]


def get_stripe_publishable_key() -> str:
    if STRIPE_CONFIG["TEST_MODE"]:
        return STRIPE_CONFIG["PUBLISHABLE_KEY_TEST"] or STRIPE_CONFIG["PUBLISHABLE_KEY_LIVE"]
    return STRIPE_CONFIG["PUBLISHABLE_KEY_LIVE"]


def get_mistral_key() -> str:
    return MISTRAL_API_KEY


def get_supadata_key() -> str:
    return SUPADATA_API_KEY


def get_youtube_proxy() -> str:
    return YOUTUBE_PROXY


def get_perplexity_key() -> str:
    return PERPLEXITY_API_KEY


def get_brave_key() -> str:
    return BRAVE_SEARCH_API_KEY


def get_openai_key() -> Optional[str]:
    return OPENAI_API_KEY or None


def is_openai_available() -> bool:
    return bool(OPENAI_API_KEY)


def is_api_configured() -> bool:
    return bool(MISTRAL_API_KEY)


def is_perplexity_available() -> bool:
    """DEPRECATED: Use is_web_search_available() instead."""
    return bool(PERPLEXITY_API_KEY)


def is_web_search_available() -> bool:
    """Check if Web Search (Brave + Mistral) is available."""
    return bool(BRAVE_SEARCH_API_KEY and MISTRAL_API_KEY)


def get_plan_limits(plan: str) -> Dict[str, Any]:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def get_groq_key() -> Optional[str]:
    return _settings.GROQ_API_KEY or None


def get_deepgram_key() -> Optional[str]:
    return _settings.DEEPGRAM_API_KEY or None


def get_assemblyai_key() -> Optional[str]:
    return _settings.ASSEMBLYAI_API_KEY or None


def get_elevenlabs_key() -> Optional[str]:
    return _settings.ELEVENLABS_API_KEY or None


# =============================================================================
# TRANSCRIPT CONFIG
# =============================================================================

# =============================================================================
# CACHE CONFIG
# =============================================================================

CACHE_CONFIG = {
    "REDIS_URL": _settings.REDIS_URL,
    "VPS_DATABASE_URL": _settings.VPS_DATABASE_URL,
    "MAX_SIZE": _settings.CACHE_MAX_SIZE,
    "TTL_TRANSCRIPT": _settings.CACHE_TTL_TRANSCRIPT,
    "TTL_ANALYSIS": _settings.CACHE_TTL_ANALYSIS,
    "TTL_FACTCHECK": _settings.CACHE_TTL_FACTCHECK,
}

# =============================================================================
# RATE LIMITING
# =============================================================================

RATE_LIMIT_ENABLED = _settings.RATE_LIMIT_ENABLED.lower() == "true"

# Health Check
HEALTH_CHECK_SECRET = _settings.HEALTH_CHECK_SECRET

# =============================================================================
# TRANSCRIPT CONFIG
# =============================================================================

MAX_DURATION_FOR_STT = _settings.MAX_DURATION_FOR_STT

TRANSCRIPT_CONFIG = {
    "circuit_breaker_failure_threshold": 5,
    "circuit_breaker_recovery_timeout": 300,
    "backoff_base": 1.0,
    "backoff_max": 30.0,
    "health_check_interval": 600,
    "instance_timeout_threshold": 3,
    "ytdlp_cookies_path": _settings.YTDLP_COOKIES_PATH,
}

# =============================================================================
# STARTUP BANNER
# =============================================================================

if __name__ != "__main__":
    _env_label = "PRODUCTION" if _settings.is_production else "DEVELOPMENT"
    print(f"Deep Sight API v{VERSION} [{_env_label}]", flush=True)
    print(f"  Railway: {IS_RAILWAY}", flush=True)
    print(f"  Stripe: {STRIPE_CONFIG['ENABLED']} (test_mode={STRIPE_CONFIG['TEST_MODE']})", flush=True)
    print(f"  Google OAuth: {GOOGLE_OAUTH_CONFIG['ENABLED']}", flush=True)
    print(f"  Email: {EMAIL_CONFIG['ENABLED']}", flush=True)
    print(f"  Mistral: {'yes' if MISTRAL_API_KEY else 'no'}", flush=True)
    print(f"  Web Search (Brave+Mistral): {'yes' if is_web_search_available() else 'no'}", flush=True)
    print(f"  Supadata: {'yes' if SUPADATA_API_KEY else 'no'}", flush=True)
    print(f"  YouTube Proxy: {'yes' if YOUTUBE_PROXY else 'no (direct)'}", flush=True)
    print(f"  Audio: Groq={'yes' if get_groq_key() else 'no'}"
          f" OpenAI={'yes' if get_openai_key() else 'no'}"
          f" Deepgram={'yes' if get_deepgram_key() else 'no'}"
          f" AssemblyAI={'yes' if get_assemblyai_key() else 'no'}"
          f" ElevenLabs={'yes' if get_elevenlabs_key() else 'no'}", flush=True)
    print(f"  Rate Limit: {RATE_LIMIT_ENABLED}", flush=True)
    print(f"  Cache: Redis={'yes' if _settings.REDIS_URL else 'no (memory fallback)'}"
          f" max_size={_settings.CACHE_MAX_SIZE}", flush=True)
    print(f"  Video Cache L2: {'yes' if _settings.VPS_DATABASE_URL else 'no (VPS_DATABASE_URL not set)'}", flush=True)
    print(f"  Backup S3: {'yes' if _settings.AWS_ACCESS_KEY_ID else 'local-only'}"
          f" (cron={_settings.BACKUP_CRON_HOUR:02d}:{_settings.BACKUP_CRON_MINUTE:02d} UTC,"
          f" retention={_settings.BACKUP_RETENTION_DAYS}d)", flush=True)
