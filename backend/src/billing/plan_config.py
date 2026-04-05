"""
PLAN_CONFIG — Single Source of Truth pour les plans DeepSight.

Chaque plan définit : limites, features, affichage, prix, plateformes.
Convention : -1 = illimité.
"""

from enum import Enum
from typing import Any, Optional
import os
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# PLAN IDs & HIERARCHY
# ═══════════════════════════════════════════════════════════════════════════════

class PlanId(str, Enum):
    FREE = "free"
    PRO = "pro"
    EXPERT = "expert"


PLAN_HIERARCHY: list[PlanId] = [
    PlanId.FREE,
    PlanId.PRO,
    PlanId.EXPERT,
]

# Aliases rétrocompatibilité — anciens plan IDs → plan valide actuel
PLAN_ALIASES: dict[str, str] = {
    "etudiant": "pro",
    "starter": "pro",
    "student": "pro",
    "equipe": "expert",
    "team": "expert",
    "unlimited": "expert",
}


def normalize_plan_id(plan_id: str) -> str:
    """Normalise un plan_id (gère les anciens noms et aliases)."""
    if not plan_id:
        return PlanId.FREE.value
    lowered = plan_id.lower().strip()
    if lowered in PLAN_ALIASES:
        return PLAN_ALIASES[lowered]
    # Vérifier si c'est un PlanId valide
    try:
        return PlanId(lowered).value
    except ValueError:
        return PlanId.FREE.value


# ═══════════════════════════════════════════════════════════════════════════════
# PLAN DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

PLANS: dict[str, dict[str, Any]] = {
    # ─── FREE ─────────────────────────────────────────────────────────────
    PlanId.FREE: {
        "name": "Gratuit",
        "name_en": "Free",
        "description": "Découvrez DeepSight gratuitement",
        "description_en": "Discover DeepSight for free",
        "price_monthly_cents": 0,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#6B7280",
        "icon": "⚡",
        "badge": None,
        "popular": False,
        "limits": {
            "monthly_credits": 250,
            "monthly_analyses": 5,
            "max_video_length_min": 15,
            "concurrent_analyses": 1,
            "priority_queue": False,
            "chat_questions_per_video": 5,
            "chat_daily_limit": 10,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": False,
            "factcheck_enabled": False,
            "deep_research_enabled": False,
            "web_search_enabled": False,
            "web_search_monthly": 0,
            "playlists_enabled": False,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "export_formats": ["txt"],
            "export_markdown": False,
            "export_pdf": False,
            "history_retention_days": 60,
            "allowed_models": ["mistral-small-2603"],
            "default_model": "mistral-small-2603",
            "voice_chat_enabled": False,
            "voice_monthly_minutes": 0,
            "academic_papers_per_analysis": 0,
            "bibliography_export": False,
            "academic_full_text": False,
        },
        "features_display": [
            {"text": "5 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 15 min", "icon": "⏱️"},
            {"text": "Chat IA (5 questions/vidéo)", "icon": "💬"},
            {"text": "Flashcards & Quiz", "icon": "🧠"},
            {"text": "Export texte", "icon": "📄"},
            {"text": "Historique 60 jours", "icon": "🗂️"},
        ],
        "features_locked": [
            {"text": "Cartes mentales & Fact-check", "unlock_plan": "pro"},
            {"text": "Recherche web IA", "unlock_plan": "pro"},
            {"text": "Playlists", "unlock_plan": "pro"},
            {"text": "Export PDF & Markdown", "unlock_plan": "pro"},
            {"text": "Chat vocal", "unlock_plan": "pro"},
        ],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "tts": False, "flashcards": True,
                "quiz": True, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": False,
                "history": True, "voice_chat": False,
            },
            "mobile": {
                "analyse": True, "chat": True, "tts": False, "flashcards": True,
                "quiz": True, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": False,
                "history": True, "voice_chat": False,
            },
            "extension": {
                "analyse": True, "chat": True, "tts": False, "flashcards": False,
                "quiz": False, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": False,
                "history": True, "voice_chat": False,
            },
        },
    },

    # ─── PRO (5.99€/mois) ──────────────────────────────────────────────
    PlanId.PRO: {
        "name": "Pro",
        "name_en": "Pro",
        "description": "Pour les étudiants et utilisateurs réguliers",
        "description_en": "For students and regular users",
        "price_monthly_cents": 599,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#3B82F6",
        "icon": "⭐",
        "badge": {"text": "Le plus populaire", "color": "#EF4444"},
        "popular": True,
        "limits": {
            "monthly_credits": 3000,
            "monthly_analyses": 30,
            "max_video_length_min": 120,
            "concurrent_analyses": 1,
            "priority_queue": False,
            "chat_questions_per_video": 25,
            "chat_daily_limit": -1,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": True,
            "factcheck_enabled": True,
            "deep_research_enabled": False,
            "web_search_enabled": True,
            "web_search_monthly": 20,
            "playlists_enabled": True,
            "max_playlists": 3,
            "max_playlist_videos": 5,
            "export_formats": ["txt", "md", "pdf"],
            "export_markdown": True,
            "export_pdf": True,
            "history_retention_days": -1,
            "allowed_models": ["mistral-small-2603", "mistral-medium-2508"],
            "default_model": "mistral-medium-2508",
            "voice_chat_enabled": True,
            "voice_monthly_minutes": 10,
            "academic_papers_per_analysis": 15,
            "bibliography_export": True,
            "academic_full_text": False,
        },
        "features_display": [
            {"text": "30 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 2h", "icon": "⏱️"},
            {"text": "Chat IA (25/vidéo, illimité/jour)", "icon": "💬"},
            {"text": "Flashcards, Quiz, Mindmap, Fact-check", "icon": "🧠", "highlight": True},
            {"text": "Recherche web IA (20/mois)", "icon": "🔍", "highlight": True},
            {"text": "Playlists (3 max, 5 vidéos)", "icon": "📋", "highlight": True},
            {"text": "Chat vocal (10 min/mois)", "icon": "🎙️", "highlight": True},
            {"text": "Export PDF + Markdown", "icon": "📄"},
            {"text": "Papers académiques (15/analyse)", "icon": "📚"},
            {"text": "Modèle Mistral Medium", "icon": "🤖"},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [
            {"text": "Deep Research", "unlock_plan": "expert"},
            {"text": "Chat IA illimité", "unlock_plan": "expert"},
            {"text": "2 analyses simultanées", "unlock_plan": "expert"},
            {"text": "Modèle Mistral Large", "unlock_plan": "expert"},
        ],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "tts": True, "flashcards": True,
                "quiz": True, "mindmap": True, "web_search": True,
                "export_md": True, "export_pdf": True, "playlists": True,
                "history": True, "voice_chat": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "tts": True, "flashcards": True,
                "quiz": True, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": True,
                "history": True, "voice_chat": True,
            },
            "extension": {
                "analyse": True, "chat": True, "tts": True, "flashcards": False,
                "quiz": False, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": False,
                "history": True, "voice_chat": False,
            },
        },
    },

    # ─── EXPERT (14.99€/mois) ─────────────────────────────────────────
    PlanId.EXPERT: {
        "name": "Expert",
        "name_en": "Expert",
        "description": "Pour les professionnels et créateurs de contenu",
        "description_en": "For professionals and content creators",
        "price_monthly_cents": 1499,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#F59E0B",
        "icon": "🚀",
        "badge": None,
        "popular": False,
        "limits": {
            "monthly_credits": 10000,
            "monthly_analyses": 100,
            "max_video_length_min": 240,
            "concurrent_analyses": 2,
            "priority_queue": True,
            "chat_questions_per_video": -1,
            "chat_daily_limit": -1,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": True,
            "factcheck_enabled": True,
            "deep_research_enabled": True,
            "web_search_enabled": True,
            "web_search_monthly": 60,
            "playlists_enabled": True,
            "max_playlists": 10,
            "max_playlist_videos": 20,
            "export_formats": ["txt", "md", "pdf"],
            "export_markdown": True,
            "export_pdf": True,
            "history_retention_days": -1,
            "allowed_models": ["mistral-small-2603", "mistral-medium-2508", "mistral-large-2512"],
            "default_model": "mistral-large-2512",
            "voice_chat_enabled": True,
            "voice_monthly_minutes": 20,
            "academic_papers_per_analysis": 50,
            "bibliography_export": True,
            "academic_full_text": True,
        },
        "features_display": [
            {"text": "100 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 4h", "icon": "⏱️"},
            {"text": "Chat IA illimité", "icon": "💬", "highlight": True},
            {"text": "2 analyses simultanées", "icon": "⚡", "highlight": True},
            {"text": "File prioritaire", "icon": "🏃"},
            {"text": "Deep Research", "icon": "🔬", "highlight": True},
            {"text": "Playlists (10 max, 20 vidéos)", "icon": "📋"},
            {"text": "Recherche web IA (60/mois)", "icon": "🔍"},
            {"text": "Chat vocal (20 min/mois)", "icon": "🎙️"},
            {"text": "Export PDF + Markdown", "icon": "📄"},
            {"text": "Papers académiques (50/analyse, full text)", "icon": "📚"},
            {"text": "Modèle Mistral Large", "icon": "🤖"},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "tts": True, "flashcards": True,
                "quiz": True, "mindmap": True, "web_search": True,
                "export_md": True, "export_pdf": True, "playlists": True,
                "history": True, "voice_chat": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "tts": True, "flashcards": True,
                "quiz": True, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": True,
                "history": True, "voice_chat": True,
            },
            "extension": {
                "analyse": True, "chat": True, "tts": True, "flashcards": False,
                "quiz": False, "mindmap": False, "web_search": False,
                "export_md": False, "export_pdf": False, "playlists": False,
                "history": True, "voice_chat": False,
            },
        },
    },

}


# ═══════════════════════════════════════════════════════════════════════════════
# 🎵 PLATFORM-SPECIFIC LIMITS (YouTube vs TikTok)
# ═══════════════════════════════════════════════════════════════════════════════

PLATFORM_LIMITS: dict[str, dict[str, Any]] = {
    "youtube": {
        "max_video_length_min": None,  # Utilise la limite du plan
        "credit_multiplier": 1.0,      # Coût standard
        "supported": True,
    },
    "tiktok": {
        "max_video_length_min": 10,    # TikTok max 10 min (au-delà c'est très rare)
        "credit_multiplier": 0.5,      # Vidéos courtes = 50% du coût
        "supported": True,
    },
}


def get_platform_limits(platform: str) -> dict[str, Any]:
    """Retourne les limites spécifiques à une plateforme."""
    return PLATFORM_LIMITS.get(platform, PLATFORM_LIMITS["youtube"])


def get_credit_multiplier(platform: str) -> float:
    """Retourne le multiplicateur de crédits pour une plateforme (TikTok = 0.5x)."""
    return get_platform_limits(platform).get("credit_multiplier", 1.0)


def get_max_duration_for_platform(plan_id: str, platform: str) -> int:
    """
    Retourne la durée max en minutes pour un plan + plateforme.
    TikTok a une limite propre (10 min) qui prime si elle est plus basse.
    """
    plan_limit = get_limits(plan_id).get("max_video_length_min", 15)
    platform_limit = get_platform_limits(platform).get("max_video_length_min")

    if platform_limit is None:
        return plan_limit
    return min(plan_limit, platform_limit)


# ═══════════════════════════════════════════════════════════════════════════════
# STRIPE PRICE INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

def init_stripe_prices() -> None:
    """Charge les stripe_price_id depuis les variables d'environnement.

    Env vars attendues :
      STRIPE_PRICE_PRO_TEST    / STRIPE_PRICE_PRO_LIVE
      STRIPE_PRICE_EXPERT_TEST / STRIPE_PRICE_EXPERT_LIVE
    """
    mapping = {
        PlanId.PRO: "PRO",
        PlanId.EXPERT: "EXPERT",
    }
    for plan_id, env_key in mapping.items():
        test_id = os.environ.get(f"STRIPE_PRICE_{env_key}_TEST", "")
        live_id = os.environ.get(f"STRIPE_PRICE_{env_key}_LIVE", "")
        PLANS[plan_id]["stripe_price_id_test"] = test_id or None
        PLANS[plan_id]["stripe_price_id_live"] = live_id or None
        if test_id or live_id:
            logger.info("Stripe price loaded for %s: test=%s live=%s", plan_id, bool(test_id), bool(live_id))


# ═══════════════════════════════════════════════════════════════════════════════
# ACCESSOR FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_plan(plan_id: str) -> dict[str, Any]:
    """Retourne la config complète d'un plan. Normalise les aliases, fallback vers FREE."""
    normalized = normalize_plan_id(plan_id)
    return PLANS.get(normalized, PLANS[PlanId.FREE])


def get_limits(plan_id: str) -> dict[str, Any]:
    """Retourne uniquement les limites d'un plan."""
    return get_plan(plan_id)["limits"]


def get_platform_features(plan_id: str, platform: str) -> dict[str, bool]:
    """Retourne les features disponibles pour un plan sur une plateforme donnée."""
    plan = get_plan(plan_id)
    return plan["platforms"].get(platform, plan["platforms"]["web"])


def is_feature_available(plan_id: str, feature: str, platform: str = "web") -> bool:
    """Vérifie si une feature est disponible pour un plan sur une plateforme."""
    platform_features = get_platform_features(plan_id, platform)
    return platform_features.get(feature, False)


def get_plan_index(plan_id: str) -> int:
    """Retourne l'index du plan dans la hiérarchie (0 = free)."""
    try:
        normalized = normalize_plan_id(plan_id)
        return PLAN_HIERARCHY.index(PlanId(normalized))
    except (ValueError, KeyError):
        return 0


def is_upgrade(current: str, target: str) -> bool:
    """True si target est un plan supérieur à current."""
    return get_plan_index(target) > get_plan_index(current)


def get_minimum_plan_for(feature: str) -> str:
    """Retourne le plan minimum requis pour accéder à une feature (plateforme web)."""
    for plan_id in PLAN_HIERARCHY:
        limits = PLANS[plan_id]["limits"]
        # Boolean features
        if feature in limits and isinstance(limits[feature], bool) and limits[feature]:
            return plan_id.value
        # Numeric features > 0 or == -1 (unlimited)
        if feature in limits and isinstance(limits[feature], (int, float)):
            val = limits[feature]
            if val == -1 or val > 0:
                return plan_id.value
        # Platform feature check
        web = PLANS[plan_id]["platforms"]["web"]
        if feature in web and web[feature]:
            return plan_id.value
    return PlanId.EXPERT.value


def get_price_id(plan_id: str, test_mode: bool = True) -> Optional[str]:
    """Retourne le stripe_price_id pour un plan."""
    plan = PLANS.get(plan_id)
    if not plan:
        return None
    key = "stripe_price_id_test" if test_mode else "stripe_price_id_live"
    return plan.get(key)


def get_plan_by_price_id(price_id: str) -> Optional[str]:
    """Retourne le plan_id correspondant à un stripe_price_id (test ou live)."""
    if not price_id:
        return None
    for plan_id, plan in PLANS.items():
        if plan.get("stripe_price_id_test") == price_id:
            return plan_id if isinstance(plan_id, str) else plan_id.value
        if plan.get("stripe_price_id_live") == price_id:
            return plan_id if isinstance(plan_id, str) else plan_id.value
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# CREDIT PACKS — Achats a la carte (one-time Stripe payments)
# ═══════════════════════════════════════════════════════════════════════════════

CREDIT_PACKS: dict[str, dict[str, Any]] = {
    "discovery": {
        "id": "discovery",
        "name": "Pack Decouverte",
        "credits": 500,
        "price_cents": 199,   # 1.99 EUR
        "price_display": "1,99",
        "description": "~4 analyses supplementaires",
    },
    "standard": {
        "id": "standard",
        "name": "Pack Standard",
        "credits": 2000,
        "price_cents": 599,   # 5.99 EUR
        "price_display": "5,99",
        "description": "~16 analyses supplementaires",
    },
    "intensive": {
        "id": "intensive",
        "name": "Pack Intensif",
        "credits": 5000,
        "price_cents": 1199,  # 11.99 EUR
        "price_display": "11,99",
        "description": "~40 analyses supplementaires",
    },
}


def get_credit_pack(pack_id: str) -> Optional[dict[str, Any]]:
    """Retourne un credit pack par son ID, ou None si inexistant."""
    return CREDIT_PACKS.get(pack_id)


def list_credit_packs() -> list[dict[str, Any]]:
    """Retourne tous les credit packs disponibles."""
    return list(CREDIT_PACKS.values())


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE INIT — Charge les prix Stripe au chargement
# ═══════════════════════════════════════════════════════════════════════════════

init_stripe_prices()
