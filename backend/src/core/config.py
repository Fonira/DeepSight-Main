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
    STRIPE_PRICE_STARTER_TEST: str = ""
    STRIPE_PRICE_STARTER_LIVE: str = ""
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

    # -- Rate Limiting --
    RATE_LIMIT_ENABLED: str = "true"

    # -- Cache & Queues --
    REDIS_URL: str = ""
    CACHE_MAX_SIZE: int = 10000
    CACHE_TTL_TRANSCRIPT: int = 86400   # 24h
    CACHE_TTL_ANALYSIS: int = 3600      # 1h
    CACHE_TTL_FACTCHECK: int = 1800     # 30min

    # -- TTS --
    TTS_PROVIDER: str = "openai"
    ELEVENLABS_API_KEY: str = ""

    # -- Legal --
    LEGAL_OWNER_NAME: str = "LEPARC Maxime Bertrand"
    LEGAL_SIRET: str = "XXX XXX XXX XXXXX"
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

    # -- Transcript --
    YTDLP_COOKIES_PATH: str = ""

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
        "starter": {
            "test": _settings.STRIPE_PRICE_STARTER_TEST,
            "live": _settings.STRIPE_PRICE_STARTER_LIVE,
            "amount": 499, "credits": 50, "name": "Starter"
        },
        "pro": {
            "test": _settings.STRIPE_PRICE_PRO_TEST,
            "live": _settings.STRIPE_PRICE_PRO_LIVE,
            "amount": 999, "credits": 200, "name": "Pro"
        },
        "expert": {
            "test": _settings.STRIPE_PRICE_EXPERT_TEST,
            "live": _settings.STRIPE_PRICE_EXPERT_LIVE,
            "amount": 1499, "credits": 500, "name": "Expert"
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
    "ACCESS_TOKEN_EXPIRE_MINUTES": 15,
    "REFRESH_TOKEN_EXPIRE_DAYS": 7,
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
    "HOST_NAME": "Railway Corporation",
    "HOST_ADDRESS": "548 Market Street, San Francisco, CA 94104, USA",
    "HOST_WEBSITE": "https://railway.app",
    "SITE_NAME": "Deep Sight",
    "SITE_URL": APP_URL,
}

# =============================================================================
# PLAN_LIMITS — ALIGNE avec UpgradePage v3.1
# =============================================================================

PLAN_LIMITS: Dict[str, Dict[str, Any]] = {
    "free": {
        "monthly_credits": 500,
        "daily_analyses": 5,
        "can_use_playlists": False,
        "max_playlist_videos": 0,
        "history_days": 7,
        "models": ["mistral-small-latest"],
        "default_model": "mistral-small-latest",
        "name": {"fr": "GRATUIT", "en": "FREE"},
        "color": "#888888",
        "price": 0,
        "price_display": {"fr": "0\u20ac", "en": "Free"},
        "chat_daily_limit": 20,
        "chat_per_video_limit": 5,
        "chat_playlist_enabled": False,
        "chat_corpus_daily": 0,
        "web_search_monthly": 0,
        "web_search_per_video": 0,
        "web_search_enabled": False,
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        "academic_papers_per_analysis": 3,
        "bibliography_export": False,
        "academic_full_text": False,
        "blocked_features": ["playlists", "export_csv", "export_excel", "batch_api", "tts", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez \u00e0 Starter pour d\u00e9bloquer plus d'analyses et de fonctionnalit\u00e9s !",
            "en": "Upgrade to Starter to unlock more analyses and features!"
        }
    },
    "starter": {
        "monthly_credits": 5000,
        "daily_analyses": 20,
        "can_use_playlists": False,
        "max_playlist_videos": 0,
        "history_days": 60,
        "models": ["mistral-small-latest", "mistral-medium-latest"],
        "default_model": "mistral-small-latest",
        "name": {"fr": "STARTER", "en": "STARTER"},
        "color": "#00D4AA",
        "price": 499,
        "price_display": {"fr": "4.99\u20ac/mois", "en": "\u20ac4.99/mo"},
        "chat_daily_limit": 100,
        "chat_per_video_limit": 20,
        "chat_playlist_enabled": False,
        "chat_corpus_daily": 0,
        "web_search_monthly": 20,
        "web_search_per_video": 3,
        "web_search_enabled": True,
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        "academic_papers_per_analysis": 15,
        "bibliography_export": True,
        "academic_full_text": False,
        "blocked_features": ["playlists", "batch_api", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez \u00e0 Pro pour les playlists et le chat illimit\u00e9 !",
            "en": "Upgrade to Pro for playlists and unlimited chat!"
        }
    },
    "pro": {
        "monthly_credits": 25000,
        "daily_analyses": 50,
        "can_use_playlists": True,
        "max_playlist_videos": 10,
        "history_days": 180,
        "models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
        "default_model": "mistral-medium-latest",
        "name": {"fr": "PRO", "en": "PRO"},
        "color": "#D4A574",
        "price": 999,
        "price_display": {"fr": "9.99\u20ac/mois", "en": "\u20ac9.99/mo"},
        "playlist_credits_per_3_videos": 1,
        "chat_daily_limit": -1,
        "chat_per_video_limit": -1,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        "web_search_monthly": 100,
        "web_search_per_video": 10,
        "web_search_enabled": True,
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        "academic_papers_per_analysis": 30,
        "bibliography_export": True,
        "academic_full_text": True,
        "blocked_features": ["batch_api", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez \u00e0 Expert pour la recherche approfondie et l'API !",
            "en": "Upgrade to Expert for deep research and API access!"
        }
    },
    "expert": {
        "monthly_credits": 100000,
        "daily_analyses": 200,
        "can_use_playlists": True,
        "max_playlist_videos": 50,
        "history_days": -1,
        "models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
        "default_model": "mistral-large-latest",
        "name": {"fr": "EXPERT", "en": "EXPERT"},
        "color": "#F4D03F",
        "price": 1499,
        "price_display": {"fr": "14.99\u20ac/mois", "en": "\u20ac14.99/mo"},
        "playlist_credits_per_3_videos": 1,
        "chat_daily_limit": -1,
        "chat_per_video_limit": -1,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        "web_search_monthly": 500,
        "web_search_per_video": 20,
        "web_search_enabled": True,
        "deep_research_enabled": True,
        "deep_research_credits_cost": 50,
        "academic_papers_per_analysis": 50,
        "bibliography_export": True,
        "academic_full_text": True,
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
        "models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
        "default_model": "mistral-large-latest",
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
# MISTRAL MODELS
# =============================================================================

MISTRAL_MODELS = {
    "mistral-small-latest": {
        "name": "Mistral Small",
        "context": 32000,
        "speed": "fast",
        "quality": "good",
        "cost_per_1k_tokens": 0.0002,
        "plans": ["free", "starter", "pro", "expert", "unlimited"],
        "description": {
            "fr": "Rapide et \u00e9conomique, id\u00e9al pour les analyses simples",
            "en": "Fast and economical, ideal for simple analyses"
        }
    },
    "mistral-medium-latest": {
        "name": "Mistral Medium",
        "context": 32000,
        "speed": "medium",
        "quality": "very_good",
        "cost_per_1k_tokens": 0.0027,
        "plans": ["starter", "pro", "expert", "unlimited"],
        "description": {
            "fr": "\u00c9quilibr\u00e9 entre vitesse et qualit\u00e9",
            "en": "Balanced between speed and quality"
        }
    },
    "mistral-large-latest": {
        "name": "Mistral Large",
        "context": 128000,
        "speed": "slow",
        "quality": "excellent",
        "cost_per_1k_tokens": 0.008,
        "plans": ["pro", "expert", "unlimited"],
        "description": {
            "fr": "Haute qualit\u00e9, analyses d\u00e9taill\u00e9es et nuanc\u00e9es",
            "en": "High quality, detailed and nuanced analyses"
        }
    }
}

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
    return bool(PERPLEXITY_API_KEY)


def get_plan_limits(plan: str) -> Dict[str, Any]:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def get_groq_key() -> Optional[str]:
    return _settings.GROQ_API_KEY or None


def get_deepgram_key() -> Optional[str]:
    return _settings.DEEPGRAM_API_KEY or None


def get_assemblyai_key() -> Optional[str]:
    return _settings.ASSEMBLYAI_API_KEY or None


# =============================================================================
# TRANSCRIPT CONFIG
# =============================================================================

# =============================================================================
# CACHE CONFIG
# =============================================================================

CACHE_CONFIG = {
    "REDIS_URL": _settings.REDIS_URL,
    "MAX_SIZE": _settings.CACHE_MAX_SIZE,
    "TTL_TRANSCRIPT": _settings.CACHE_TTL_TRANSCRIPT,
    "TTL_ANALYSIS": _settings.CACHE_TTL_ANALYSIS,
    "TTL_FACTCHECK": _settings.CACHE_TTL_FACTCHECK,
}

# =============================================================================
# RATE LIMITING
# =============================================================================

RATE_LIMIT_ENABLED = _settings.RATE_LIMIT_ENABLED.lower() == "true"

# =============================================================================
# TRANSCRIPT CONFIG
# =============================================================================

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
    print(f"  Perplexity: {'yes' if PERPLEXITY_API_KEY else 'no'}", flush=True)
    print(f"  Brave Search: {'yes' if BRAVE_SEARCH_API_KEY else 'no'}", flush=True)
    print(f"  Supadata: {'yes' if SUPADATA_API_KEY else 'no'}", flush=True)
    print(f"  Audio: Groq={'yes' if get_groq_key() else 'no'}"
          f" OpenAI={'yes' if get_openai_key() else 'no'}"
          f" Deepgram={'yes' if get_deepgram_key() else 'no'}"
          f" AssemblyAI={'yes' if get_assemblyai_key() else 'no'}", flush=True)
    print(f"  Rate Limit: {RATE_LIMIT_ENABLED}", flush=True)
    print(f"  Cache: Redis={'yes' if _settings.REDIS_URL else 'no (memory fallback)'}"
          f" max_size={_settings.CACHE_MAX_SIZE}", flush=True)
    print(f"  Backup S3: {'yes' if _settings.AWS_ACCESS_KEY_ID else 'local-only'}"
          f" (cron={_settings.BACKUP_CRON_HOUR:02d}:{_settings.BACKUP_CRON_MINUTE:02d} UTC,"
          f" retention={_settings.BACKUP_RETENTION_DAYS}d)", flush=True)
