"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔧 CONFIGURATION CENTRALE — Deep Sight API                                        ║
║  v3.1 — ALIGNÉ avec UpgradePage et planPrivileges.ts                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝

⚠️ DOIT RESTER SYNCHRONISÉ AVEC:
- Frontend: src/config/planPrivileges.ts
- Frontend: src/pages/UpgradePage.tsx
"""

import os
from typing import Dict, Any, Optional

# ═══════════════════════════════════════════════════════════════════════════════
# 🌍 ENVIRONNEMENT
# ═══════════════════════════════════════════════════════════════════════════════

VERSION = "3.1.0"
APP_NAME = "Deep Sight"
IS_RAILWAY = os.environ.get("RAILWAY_ENVIRONMENT") is not None
ENV = os.environ.get("ENV", "development")

# Répertoire de données
DATA_DIR = os.environ.get("DATABASE_PATH", "/app/data" if IS_RAILWAY else "./data")
os.makedirs(DATA_DIR, exist_ok=True)

# URL de l'application
APP_URL = os.environ.get("APP_URL", "http://localhost:8000")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
CUSTOM_DOMAIN = os.environ.get("CUSTOM_DOMAIN", "")

# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 CONFIGURATION ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

ADMIN_CONFIG = {
    "ADMIN_USERNAME": os.environ.get("ADMIN_USERNAME", "admin"),
    "ADMIN_EMAIL": os.environ.get("ADMIN_EMAIL", "admin@example.com"),
    "ADMIN_PASSWORD": os.environ.get("ADMIN_PASSWORD", "DeepSight2024!"),
    "ADMIN_SECRET_KEY": os.environ.get("ADMIN_SECRET_KEY", "deepsight_secret_key_2024")
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 CLÉS API
# ═══════════════════════════════════════════════════════════════════════════════

# Mistral AI
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")

# Supadata (transcriptions)
SUPADATA_API_KEY = os.environ.get("SUPADATA_API_KEY", "")

# Perplexity (recherche web)
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "")

# OpenAI (GPT-4 pour questions complexes - Pro/Expert)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ═══════════════════════════════════════════════════════════════════════════════
# 📧 CONFIGURATION EMAIL (Resend)
# ═══════════════════════════════════════════════════════════════════════════════

EMAIL_CONFIG = {
    "ENABLED": os.environ.get("EMAIL_ENABLED", "true").lower() == "true",
    "RESEND_API_KEY": os.environ.get("RESEND_API_KEY", ""),
    "FROM_EMAIL": os.environ.get("FROM_EMAIL", "noreply@deepsight.fr"),
    "FROM_NAME": os.environ.get("FROM_NAME", "Deep Sight"),
}

# ═══════════════════════════════════════════════════════════════════════════════
# 💳 CONFIGURATION STRIPE
# ═══════════════════════════════════════════════════════════════════════════════

STRIPE_CONFIG = {
    "ENABLED": os.environ.get("STRIPE_ENABLED", "true").lower() == "true",
    "TEST_MODE": os.environ.get("STRIPE_TEST_MODE", "false").lower() == "true",
    "SECRET_KEY_TEST": os.environ.get("STRIPE_SECRET_KEY_TEST", ""),
    "SECRET_KEY_LIVE": os.environ.get("STRIPE_SECRET_KEY_LIVE", ""),
    "PUBLISHABLE_KEY_TEST": os.environ.get("STRIPE_PUBLISHABLE_KEY_TEST", ""),
    "PUBLISHABLE_KEY_LIVE": os.environ.get("STRIPE_PUBLISHABLE_KEY_LIVE", ""),
    "WEBHOOK_SECRET": os.environ.get("STRIPE_WEBHOOK_SECRET", ""),
    "PRICES": {
        "starter": {
            "test": os.environ.get("STRIPE_PRICE_STARTER_TEST", ""),
            "live": os.environ.get("STRIPE_PRICE_STARTER_LIVE", "price_1SiJDdIJpzAeYwGH9KX7orWc"),
            "amount": 499, "credits": 50, "name": "Starter"
        },
        "pro": {
            "test": os.environ.get("STRIPE_PRICE_PRO_TEST", ""),
            "live": os.environ.get("STRIPE_PRICE_PRO_LIVE", "price_1SiJDxIJpzAeYwGHYO6J6UdM"),
            "amount": 999, "credits": 200, "name": "Pro"
        },
        "expert": {
            "test": os.environ.get("STRIPE_PRICE_EXPERT_TEST", ""),
            "live": os.environ.get("STRIPE_PRICE_EXPERT_LIVE", "price_1SiJEcIJpzAeYwGHfVDigfmo"),
            "amount": 1499, "credits": 500, "name": "Expert"
        }
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 GOOGLE OAUTH
# ═══════════════════════════════════════════════════════════════════════════════

GOOGLE_OAUTH_CONFIG = {
    "ENABLED": os.environ.get("GOOGLE_OAUTH_ENABLED", "false").lower() == "true",
    "CLIENT_ID": os.environ.get("GOOGLE_CLIENT_ID", ""),
    "CLIENT_SECRET": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
    "REDIRECT_URI": os.environ.get("GOOGLE_REDIRECT_URI", f"{APP_URL}/api/auth/google/callback"),
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 JWT CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

JWT_CONFIG = {
    "SECRET_KEY": os.environ.get("JWT_SECRET_KEY", ADMIN_CONFIG["ADMIN_SECRET_KEY"]),
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 60,  # 1 heure
    "REFRESH_TOKEN_EXPIRE_DAYS": 30,
}

# ═══════════════════════════════════════════════════════════════════════════════
# ⚖️ MENTIONS LÉGALES
# ═══════════════════════════════════════════════════════════════════════════════

LEGAL_CONFIG = {
    "OWNER_NAME": os.environ.get("LEGAL_OWNER_NAME", "LEPARC Maxime Bertrand"),
    "SIRET": os.environ.get("LEGAL_SIRET", "XXX XXX XXX XXXXX"),
    "RCS": os.environ.get("LEGAL_RCS", "994 558 898 R.C.S. Lyon"),
    "CITY": os.environ.get("LEGAL_CITY", "La Mulatière, France"),
    "ADDRESS": os.environ.get("LEGAL_ADDRESS", "15 Chemin Clément Mulat, 69350 La Mulatière"),
    "EMAIL": os.environ.get("LEGAL_EMAIL", "contact@deepsight.fr"),
    "HOST_NAME": "Railway Corporation",
    "HOST_ADDRESS": "548 Market Street, San Francisco, CA 94104, USA",
    "HOST_WEBSITE": "https://railway.app",
    "SITE_NAME": "Deep Sight",
    "SITE_URL": APP_URL,
}

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 PLAN_LIMITS — ALIGNÉ avec UpgradePage v3.1
# ═══════════════════════════════════════════════════════════════════════════════

PLAN_LIMITS: Dict[str, Dict[str, Any]] = {
    "free": {
        "monthly_credits": 500,  # ~10 analyses basiques
        "daily_analyses": 5,  # 🆕 5 analyses/jour max
        "can_use_playlists": False,
        "max_playlist_videos": 0,
        "history_days": 7,
        # 🤖 Modèles disponibles
        "models": ["mistral-small-latest"],
        "default_model": "mistral-small-latest",
        "name": {"fr": "🆓 GRATUIT", "en": "🆓 FREE"},
        "color": "#888888",
        "price": 0,
        "price_display": {"fr": "0€", "en": "Free"},
        # 💬 Limites Chat IA
        "chat_daily_limit": 20,
        "chat_per_video_limit": 5,  # ✅ Aligné: 5 questions/vidéo
        "chat_playlist_enabled": False,
        "chat_corpus_daily": 0,
        # 🌐 Limites Recherche Web
        "web_search_monthly": 0,
        "web_search_per_video": 0,
        "web_search_enabled": False,
        # 🔬 Recherche approfondie
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        # 📚 Sources académiques
        "academic_papers_per_analysis": 3,
        "bibliography_export": False,
        "academic_full_text": False,
        # 🚫 Features bloquées
        "blocked_features": ["playlists", "export_csv", "export_excel", "batch_api", "tts", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez à Starter pour débloquer plus d'analyses et de fonctionnalités !",
            "en": "Upgrade to Starter to unlock more analyses and features!"
        }
    },
    "starter": {
        "monthly_credits": 5000,  # ~100 analyses basiques
        "daily_analyses": 20,  # 🆕 20 analyses/jour
        "can_use_playlists": False,
        "max_playlist_videos": 0,
        "history_days": 60,
        # 🤖 Modèles disponibles: Small + Medium
        "models": ["mistral-small-latest", "mistral-medium-latest"],
        "default_model": "mistral-small-latest",
        "name": {"fr": "⚡ STARTER", "en": "⚡ STARTER"},
        "color": "#00D4AA",
        "price": 499,  # 4.99€
        "price_display": {"fr": "4.99€/mois", "en": "€4.99/mo"},
        # 💬 Limites Chat IA
        "chat_daily_limit": 100,
        "chat_per_video_limit": 20,  # ✅ Aligné: 20 questions/vidéo
        "chat_playlist_enabled": False,
        "chat_corpus_daily": 0,
        # 🌐 Limites Recherche Web - ✅ Starter a accès (20/mois)
        "web_search_monthly": 20,
        "web_search_per_video": 3,
        "web_search_enabled": True,
        # 🔬 Recherche approfondie
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        # 📚 Sources académiques
        "academic_papers_per_analysis": 15,
        "bibliography_export": True,
        "academic_full_text": False,
        # 🚫 Features bloquées
        "blocked_features": ["playlists", "batch_api", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez à Pro pour les playlists et le chat illimité !",
            "en": "Upgrade to Pro for playlists and unlimited chat!"
        }
    },
    "pro": {
        "monthly_credits": 25000,  # ~500 analyses ou usage intensif
        "daily_analyses": 50,  # 🆕 50 analyses/jour
        "can_use_playlists": True,
        "max_playlist_videos": 10,  # ✅ CORRIGÉ: 10 vidéos (était 20)
        "history_days": 180,        # ✅ CORRIGÉ: 180 jours (était -1)
        # 🤖 Modèles disponibles: Tous
        "models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
        "default_model": "mistral-medium-latest",
        "name": {"fr": "⭐ PRO", "en": "⭐ PRO"},
        "color": "#D4A574",
        "price": 999,  # 9.99€
        "price_display": {"fr": "9.99€/mois", "en": "€9.99/mo"},
        "playlist_credits_per_3_videos": 1,
        # 💬 Limites Chat IA - ✅ CORRIGÉ: Vraiment illimité
        "chat_daily_limit": -1,      # ✅ Illimité
        "chat_per_video_limit": -1,  # ✅ CORRIGÉ: Illimité (était 100)
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,     # Illimité
        # 🌐 Limites Recherche Web
        "web_search_monthly": 100,
        "web_search_per_video": 10,
        "web_search_enabled": True,
        # 🔬 Recherche approfondie - NON disponible en Pro
        "deep_research_enabled": False,
        "deep_research_credits_cost": 0,
        # 📚 Sources académiques
        "academic_papers_per_analysis": 30,
        "bibliography_export": True,
        "academic_full_text": True,
        # 🚫 Features bloquées
        "blocked_features": ["batch_api", "deep_research"],
        "upgrade_prompt": {
            "fr": "Passez à Expert pour la recherche approfondie et l'API !",
            "en": "Upgrade to Expert for deep research and API access!"
        }
    },
    "expert": {
        "monthly_credits": 100000,  # Usage très intensif
        "daily_analyses": 200,  # 🆕 200 analyses/jour
        "can_use_playlists": True,
        "max_playlist_videos": 50,  # ✅ CORRIGÉ: 50 vidéos (était 60)
        "history_days": -1,  # Illimité
        # 🤖 Modèles disponibles: Tous
        "models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
        "default_model": "mistral-large-latest",
        "name": {"fr": "👑 EXPERT", "en": "👑 EXPERT"},
        "color": "#F4D03F",
        "price": 1499,  # 14.99€
        "price_display": {"fr": "14.99€/mois", "en": "€14.99/mo"},
        "playlist_credits_per_3_videos": 1,
        # 💬 Limites Chat IA - ILLIMITÉ
        "chat_daily_limit": -1,
        "chat_per_video_limit": -1,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        # 🌐 Limites Recherche Web
        "web_search_monthly": 500,
        "web_search_per_video": 20,
        "web_search_enabled": True,
        # 🔬 Recherche approfondie disponible
        "deep_research_enabled": True,
        "deep_research_credits_cost": 50,
        # 📚 Sources académiques
        "academic_papers_per_analysis": 50,
        "bibliography_export": True,
        "academic_full_text": True,
        # 🚫 Features bloquées
        "blocked_features": [],
        "upgrade_prompt": {
            "fr": "Vous avez le plan Expert, toutes les fonctionnalités sont débloquées !",
            "en": "You have the Expert plan, all features are unlocked!"
        }
    },
    "unlimited": {
        "monthly_credits": 999999,
        "daily_analyses": -1,  # 🆕 Illimité
        "can_use_playlists": True,
        "max_playlist_videos": 100,  # 100 vidéos max par playlist
        "history_days": -1,
        # 🤖 Modèles disponibles: Tous
        "models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
        "default_model": "mistral-large-latest",
        "name": {"fr": "👑 ADMIN", "en": "👑 ADMIN"},
        "color": "#ffd700",
        "price": 0,
        "price_display": {"fr": "Illimité", "en": "Unlimited"},
        "chat_daily_limit": -1,
        "chat_per_video_limit": -1,
        "chat_playlist_enabled": True,
        "chat_corpus_daily": -1,
        "web_search_monthly": -1,
        "web_search_per_video": -1,
        "web_search_enabled": True,
        # 🔬 Recherche approfondie - Illimité
        "deep_research_enabled": True,
        "deep_research_credits_cost": 0,  # Gratuit pour admin
        # 📚 Sources académiques - Illimité
        "academic_papers_per_analysis": 100,
        "bibliography_export": True,
        "academic_full_text": True,
        # 🚫 Features bloquées
        "blocked_features": [],
        "upgrade_prompt": {
            "fr": "Compte administrateur - accès illimité",
            "en": "Admin account - unlimited access"
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 MODÈLES MISTRAL — Configuration complète avec Medium
# ═══════════════════════════════════════════════════════════════════════════════

MISTRAL_MODELS = {
    "mistral-small-latest": {
        "name": "Mistral Small",
        "context": 32000,
        "speed": "fast",
        "quality": "good",
        "cost_per_1k_tokens": 0.0002,
        "plans": ["free", "starter", "pro", "expert", "unlimited"],
        "description": {
            "fr": "Rapide et économique, idéal pour les analyses simples",
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
            "fr": "Équilibré entre vitesse et qualité",
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
            "fr": "Haute qualité, analyses détaillées et nuancées",
            "en": "High quality, detailed and nuanced analyses"
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 📂 CATÉGORIES D'ANALYSE
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORIES = {
    "interview": {"fr": "🎤 Interview", "en": "🎤 Interview", "icon": "🎤"},
    "podcast": {"fr": "🎧 Podcast", "en": "🎧 Podcast", "icon": "🎧"},
    "documentary": {"fr": "📽️ Documentaire", "en": "📽️ Documentary", "icon": "📽️"},
    "tutorial": {"fr": "📚 Tutoriel", "en": "📚 Tutorial", "icon": "📚"},
    "news": {"fr": "📰 Actualités", "en": "📰 News", "icon": "📰"},
    "conference": {"fr": "🎓 Conférence", "en": "🎓 Conference", "icon": "🎓"},
    "debate": {"fr": "⚖️ Débat", "en": "⚖️ Debate", "icon": "⚖️"},
    "science": {"fr": "🔬 Science", "en": "🔬 Science", "icon": "🔬"},
    "tech": {"fr": "💻 Tech", "en": "💻 Tech", "icon": "💻"},
    "finance": {"fr": "💰 Finance", "en": "💰 Finance", "icon": "💰"},
    "health": {"fr": "🏥 Santé", "en": "🏥 Health", "icon": "🏥"},
    "general": {"fr": "📋 Général", "en": "📋 General", "icon": "📋"},
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

def get_stripe_key() -> str:
    """Retourne la clé secrète Stripe appropriée (avec fallback)"""
    if STRIPE_CONFIG.get("TEST_MODE", True):
        # En mode TEST, essayer la clé TEST puis fallback sur LIVE
        key = STRIPE_CONFIG.get("SECRET_KEY_TEST", "") or STRIPE_CONFIG.get("SECRET_KEY_LIVE", "")
    else:
        key = STRIPE_CONFIG.get("SECRET_KEY_LIVE", "")
    return key

def get_stripe_publishable_key() -> str:
    """Retourne la clé publique Stripe appropriée (avec fallback)"""
    if STRIPE_CONFIG.get("TEST_MODE", True):
        key = STRIPE_CONFIG.get("PUBLISHABLE_KEY_TEST", "") or STRIPE_CONFIG.get("PUBLISHABLE_KEY_LIVE", "")
    else:
        key = STRIPE_CONFIG.get("PUBLISHABLE_KEY_LIVE", "")
    return key

def get_mistral_key() -> str:
    """Retourne la clé API Mistral"""
    return MISTRAL_API_KEY

def get_supadata_key() -> str:
    """Retourne la clé API Supadata"""
    return SUPADATA_API_KEY

def get_perplexity_key() -> str:
    """Retourne la clé API Perplexity"""
    return PERPLEXITY_API_KEY

def get_openai_key() -> str:
    """Retourne la clé API OpenAI (pour GPT-4)"""
    return OPENAI_API_KEY

def is_openai_available() -> bool:
    """Vérifie si OpenAI est configuré"""
    return bool(OPENAI_API_KEY)

def is_api_configured() -> bool:
    """Vérifie si les APIs sont configurées"""
    return bool(MISTRAL_API_KEY)

def is_perplexity_available() -> bool:
    """Vérifie si Perplexity est configuré"""
    return bool(PERPLEXITY_API_KEY)

def get_plan_limits(plan: str) -> Dict[str, Any]:
    """Retourne les limites d'un plan"""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

def get_groq_key() -> Optional[str]:
    """Clé API Groq pour Whisper (fallback)"""
    return os.environ.get("GROQ_API_KEY")

def get_deepgram_key() -> Optional[str]:
    """Clé API Deepgram Nova-2 (transcription ultra-rapide)"""
    return os.environ.get("DEEPGRAM_API_KEY")

def get_openai_key() -> Optional[str]:
    """Clé API OpenAI pour Whisper (fallback si Groq échoue)"""
    return os.environ.get("OPENAI_API_KEY")

def get_assemblyai_key() -> Optional[str]:
    """Clé API AssemblyAI (transcription premium très fiable)"""
    return os.environ.get("ASSEMBLYAI_API_KEY")

# ═══════════════════════════════════════════════════════════════════════════════
# 📺 CONFIGURATION TRANSCRIPT EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

TRANSCRIPT_CONFIG = {
    # Circuit Breaker
    "circuit_breaker_failure_threshold": 5,  # Échecs avant d'ouvrir le circuit
    "circuit_breaker_recovery_timeout": 300,  # 5 minutes avant de réessayer

    # Exponential Backoff
    "backoff_base": 1.0,  # Délai de base en secondes
    "backoff_max": 30.0,  # Délai max en secondes

    # Instance Health
    "health_check_interval": 600,  # 10 minutes entre les health checks
    "instance_timeout_threshold": 3,  # Échecs avant de marquer une instance comme down

    # yt-dlp cookies (optionnel, pour vidéos restreintes)
    "ytdlp_cookies_path": os.environ.get("YTDLP_COOKIES_PATH", ""),
}

# Affichage des infos au démarrage
if __name__ != "__main__":
    print(f"🤿 Deep Sight API v{VERSION}", flush=True)
    print(f"🚂 Railway: {IS_RAILWAY}", flush=True)
    print(f"💳 Stripe: {STRIPE_CONFIG.get('ENABLED', False)}", flush=True)
    print(f"🔐 Google OAuth: {GOOGLE_OAUTH_CONFIG.get('ENABLED', False)}", flush=True)
    print(f"📧 Email: {EMAIL_CONFIG.get('ENABLED', False)}", flush=True)
    print(f"🤖 Mistral: {'✓' if MISTRAL_API_KEY else '✗'}", flush=True)
    print(f"🔍 Perplexity: {'✓' if PERPLEXITY_API_KEY else '✗'}", flush=True)
    print(f"📝 Supadata: {'✓' if SUPADATA_API_KEY else '✗'}", flush=True)
    print(f"", flush=True)
    print(f"🎙️ Audio Transcription Services (v6.0):", flush=True)
    print(f"   • Groq Whisper: {'✓' if get_groq_key() else '✗'}", flush=True)
    print(f"   • OpenAI Whisper: {'✓' if get_openai_key() else '✗'}", flush=True)
    print(f"   • Deepgram Nova-2: {'✓' if get_deepgram_key() else '✗'}", flush=True)
    print(f"   • AssemblyAI: {'✓' if get_assemblyai_key() else '✗'}", flush=True)
