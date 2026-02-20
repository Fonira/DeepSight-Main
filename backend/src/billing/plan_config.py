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
    ETUDIANT = "etudiant"
    STARTER = "starter"
    PRO = "pro"
    EQUIPE = "equipe"


PLAN_HIERARCHY: list[PlanId] = [
    PlanId.FREE,
    PlanId.ETUDIANT,
    PlanId.STARTER,
    PlanId.PRO,
    PlanId.EQUIPE,
]


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
            "monthly_analyses": 3,
            "max_video_length_min": 15,
            "concurrent_analyses": 1,
            "priority_queue": False,
            "chat_questions_per_video": 5,
            "chat_daily_limit": 10,
            "flashcards_enabled": False,
            "mindmap_enabled": False,
            "web_search_enabled": False,
            "web_search_monthly": 0,
            "playlists_enabled": False,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "export_formats": ["txt"],
            "export_markdown": False,
            "export_pdf": False,
            "history_retention_days": 60,
            "allowed_models": ["mistral-small-latest"],
            "default_model": "mistral-small-latest",
        },
        "features_display": [
            {"text": "3 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 15 min", "icon": "⏱️"},
            {"text": "Chat IA (5 questions/vidéo)", "icon": "💬"},
            {"text": "Export texte", "icon": "📄"},
            {"text": "Historique 60 jours", "icon": "🗂️"},
        ],
        "features_locked": [
            {"text": "Flashcards & cartes mentales", "unlock_plan": "etudiant"},
            {"text": "Recherche web IA", "unlock_plan": "starter"},
            {"text": "Playlists", "unlock_plan": "pro"},
            {"text": "Export PDF", "unlock_plan": "pro"},
        ],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
            "extension": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
        },
    },

    # ─── ÉTUDIANT ─────────────────────────────────────────────────────────
    PlanId.ETUDIANT: {
        "name": "Étudiant",
        "name_en": "Student",
        "description": "Idéal pour les étudiants et l'apprentissage",
        "description_en": "Perfect for students and learning",
        "price_monthly_cents": 299,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#10B981",
        "icon": "🎓",
        "badge": {"text": "Étudiants", "color": "#10B981"},
        "popular": False,
        "limits": {
            "monthly_analyses": 20,
            "max_video_length_min": 45,
            "concurrent_analyses": 1,
            "priority_queue": False,
            "chat_questions_per_video": 15,
            "chat_daily_limit": 40,
            "flashcards_enabled": True,
            "mindmap_enabled": True,
            "web_search_enabled": False,
            "web_search_monthly": 0,
            "playlists_enabled": False,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "export_formats": ["txt", "md"],
            "export_markdown": True,
            "export_pdf": False,
            "history_retention_days": -1,
            "allowed_models": ["mistral-small-latest"],
            "default_model": "mistral-small-latest",
        },
        "features_display": [
            {"text": "20 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 45 min", "icon": "⏱️"},
            {"text": "Chat IA (15 questions/vidéo)", "icon": "💬"},
            {"text": "Flashcards & cartes mentales", "icon": "🧠", "highlight": True},
            {"text": "Export Markdown", "icon": "📝"},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [
            {"text": "Recherche web IA", "unlock_plan": "starter"},
            {"text": "Playlists", "unlock_plan": "pro"},
            {"text": "Export PDF", "unlock_plan": "pro"},
            {"text": "Chat illimité", "unlock_plan": "pro"},
        ],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": True, "web_search": False, "export_md": True,
                "export_pdf": False, "playlists": False, "history": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
            "extension": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
        },
    },

    # ─── STARTER ──────────────────────────────────────────────────────────
    PlanId.STARTER: {
        "name": "Starter",
        "name_en": "Starter",
        "description": "Pour les utilisateurs réguliers",
        "description_en": "For regular users",
        "price_monthly_cents": 599,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#8B5CF6",
        "icon": "⭐",
        "badge": None,
        "popular": False,
        "limits": {
            "monthly_analyses": 50,
            "max_video_length_min": 120,
            "concurrent_analyses": 1,
            "priority_queue": False,
            "chat_questions_per_video": 25,
            "chat_daily_limit": 80,
            "flashcards_enabled": True,
            "mindmap_enabled": True,
            "web_search_enabled": True,
            "web_search_monthly": 20,
            "playlists_enabled": False,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "export_formats": ["txt", "md"],
            "export_markdown": True,
            "export_pdf": False,
            "history_retention_days": -1,
            "allowed_models": ["mistral-small-latest", "mistral-medium-latest"],
            "default_model": "mistral-medium-latest",
        },
        "features_display": [
            {"text": "50 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 2h", "icon": "⏱️"},
            {"text": "Chat IA (25 questions/vidéo)", "icon": "💬"},
            {"text": "Flashcards & cartes mentales", "icon": "🧠"},
            {"text": "Recherche web IA (20/mois)", "icon": "🔍", "highlight": True},
            {"text": "Modèle Mistral Medium", "icon": "🤖", "highlight": True},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [
            {"text": "Playlists", "unlock_plan": "pro"},
            {"text": "Export PDF", "unlock_plan": "pro"},
            {"text": "Chat illimité", "unlock_plan": "pro"},
            {"text": "File prioritaire", "unlock_plan": "pro"},
        ],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": True, "web_search": True, "export_md": True,
                "export_pdf": False, "playlists": False, "history": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
            "extension": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
        },
    },

    # ─── PRO ──────────────────────────────────────────────────────────────
    PlanId.PRO: {
        "name": "Pro",
        "name_en": "Pro",
        "description": "Pour les professionnels et créateurs de contenu",
        "description_en": "For professionals and content creators",
        "price_monthly_cents": 1299,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#F59E0B",
        "icon": "🚀",
        "badge": {"text": "Populaire", "color": "#EF4444"},
        "popular": True,
        "limits": {
            "monthly_analyses": 200,
            "max_video_length_min": 240,
            "concurrent_analyses": 3,
            "priority_queue": True,
            "chat_questions_per_video": -1,
            "chat_daily_limit": -1,
            "flashcards_enabled": True,
            "mindmap_enabled": True,
            "web_search_enabled": True,
            "web_search_monthly": 100,
            "playlists_enabled": True,
            "max_playlists": 10,
            "max_playlist_videos": 20,
            "export_formats": ["txt", "md", "pdf"],
            "export_markdown": True,
            "export_pdf": True,
            "history_retention_days": -1,
            "allowed_models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
            "default_model": "mistral-large-latest",
        },
        "features_display": [
            {"text": "200 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 4h", "icon": "⏱️"},
            {"text": "Chat IA illimité", "icon": "💬", "highlight": True},
            {"text": "3 analyses simultanées", "icon": "⚡", "highlight": True},
            {"text": "File prioritaire", "icon": "🏃"},
            {"text": "Playlists (10 max, 20 vidéos)", "icon": "📋", "highlight": True},
            {"text": "Recherche web IA (100/mois)", "icon": "🔍"},
            {"text": "Export PDF + Markdown", "icon": "📄"},
            {"text": "Modèle Mistral Large", "icon": "🤖"},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [
            {"text": "Playlists illimitées", "unlock_plan": "equipe"},
            {"text": "5 analyses simultanées", "unlock_plan": "equipe"},
            {"text": "Recherche web illimitée", "unlock_plan": "equipe"},
        ],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": True, "web_search": True, "export_md": True,
                "export_pdf": True, "playlists": True, "history": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": True, "history": True,
            },
            "extension": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
        },
    },

    # ─── ÉQUIPE ───────────────────────────────────────────────────────────
    PlanId.EQUIPE: {
        "name": "Équipe",
        "name_en": "Team",
        "description": "Pour les équipes et entreprises",
        "description_en": "For teams and businesses",
        "price_monthly_cents": 2999,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#EF4444",
        "icon": "👑",
        "badge": {"text": "Entreprises", "color": "#F97316"},
        "popular": False,
        "limits": {
            "monthly_analyses": 1000,
            "max_video_length_min": -1,
            "concurrent_analyses": 5,
            "priority_queue": True,
            "chat_questions_per_video": -1,
            "chat_daily_limit": -1,
            "flashcards_enabled": True,
            "mindmap_enabled": True,
            "web_search_enabled": True,
            "web_search_monthly": -1,
            "playlists_enabled": True,
            "max_playlists": -1,
            "max_playlist_videos": 100,
            "export_formats": ["txt", "md", "pdf"],
            "export_markdown": True,
            "export_pdf": True,
            "history_retention_days": -1,
            "allowed_models": ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
            "default_model": "mistral-large-latest",
        },
        "features_display": [
            {"text": "1000 analyses / mois", "icon": "📊"},
            {"text": "Vidéos sans limite de durée", "icon": "⏱️", "highlight": True},
            {"text": "Chat IA illimité", "icon": "💬"},
            {"text": "5 analyses simultanées", "icon": "⚡", "highlight": True},
            {"text": "File prioritaire", "icon": "🏃"},
            {"text": "Playlists illimitées (100 vidéos)", "icon": "📋", "highlight": True},
            {"text": "Recherche web illimitée", "icon": "🔍", "highlight": True},
            {"text": "Export PDF + Markdown", "icon": "📄"},
            {"text": "Modèle Mistral Large", "icon": "🤖"},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [],
        "platforms": {
            "web": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": True, "web_search": True, "export_md": True,
                "export_pdf": True, "playlists": True, "history": True,
            },
            "mobile": {
                "analyse": True, "chat": True, "flashcards": True,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": True, "history": True,
            },
            "extension": {
                "analyse": True, "chat": True, "flashcards": False,
                "mindmap": False, "web_search": False, "export_md": False,
                "export_pdf": False, "playlists": False, "history": True,
            },
        },
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# STRIPE PRICE INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

def init_stripe_prices() -> None:
    """Charge les stripe_price_id depuis les variables d'environnement.

    Env vars attendues :
      STRIPE_PRICE_ETUDIANT_TEST / STRIPE_PRICE_ETUDIANT_LIVE
      STRIPE_PRICE_STARTER_TEST  / STRIPE_PRICE_STARTER_LIVE
      STRIPE_PRICE_PRO_TEST      / STRIPE_PRICE_PRO_LIVE
      STRIPE_PRICE_EQUIPE_TEST   / STRIPE_PRICE_EQUIPE_LIVE
    """
    mapping = {
        PlanId.ETUDIANT: "ETUDIANT",
        PlanId.STARTER: "STARTER",
        PlanId.PRO: "PRO",
        PlanId.EQUIPE: "EQUIPE",
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
    """Retourne la config complète d'un plan. Fallback vers FREE si invalide."""
    return PLANS.get(plan_id, PLANS[PlanId.FREE])


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
        return PLAN_HIERARCHY.index(PlanId(plan_id))
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
    return PlanId.EQUIPE.value


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
# MODULE INIT — Charge les prix Stripe au chargement
# ═══════════════════════════════════════════════════════════════════════════════

init_stripe_prices()
