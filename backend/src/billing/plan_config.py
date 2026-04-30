"""
PLAN_CONFIG — Single Source of Truth pour les plans DeepSight.

Migration Avril 2026 (Pricing v2) : 3 plans (Free / Pro 8.99€ / Expert 19.99€).
- Pro     8,99 €/mo    ou 89,90 €/an  (-17 %)
- Expert  19,99 €/mo   ou 199,90 €/an (-17 %)

Chaque plan définit : limites, features, affichage, prix, plateformes.
Convention : -1 = illimité.

Mapping legacy v0/v1 → v2 :
  old "plus"  → new "pro"     (4.99 € → 8.99 € ; legacy users grandfathered)
  old "pro"   → new "expert"  (9.99 € → 19.99 € ; legacy users grandfathered)
"""

from enum import Enum
from typing import Any, Optional
import os
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# PLAN IDs & HIERARCHY — 3 plans v2 (Avril 2026)
# ═══════════════════════════════════════════════════════════════════════════════


class PlanId(str, Enum):
    FREE = "free"
    PRO = "pro"        # Tier intermédiaire v2 — anciennement "plus"
    EXPERT = "expert"  # Tier premium v2 — anciennement "pro"


PLAN_HIERARCHY: list[PlanId] = [
    PlanId.FREE,
    PlanId.PRO,
    PlanId.EXPERT,
]

# Aliases rétrocompatibilité — anciens plan IDs v0/v1 → plan canonique v2
# v0 legacy "plus" → v2 "pro"
# Anciens marketing names mappés sur v2
PLAN_ALIASES: dict[str, str] = {
    # v0 legacy
    "plus": "pro",          # ancien Plus 4.99 € → nouveau Pro 8.99 €
    # Anciens marketing names mappés sur v2
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
            "academic_papers_per_analysis": 5,
            "bibliography_export": False,
            "academic_full_text": False,
            "debate_enabled": False,
            "debate_monthly": 0,
            "tts_enabled": False,
            "geo_enabled": False,
            "geo_monthly": 0,
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
            {"text": "Export PDF & Markdown", "unlock_plan": "pro"},
            {"text": "Recherche web IA", "unlock_plan": "pro"},
            {"text": "Playlists & Deep Research", "unlock_plan": "expert"},
            {"text": "Chat vocal étendu & TTS", "unlock_plan": "expert"},
        ],
        "platforms": {
            "web": {
                "analyse": True,
                "chat": True,
                "tts": False,
                "flashcards": True,
                "quiz": True,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": True,  # Quick Voice Call V1 — 1-shot lifetime trial
                "debate": False,
                "deep_research": False,
                "geo": False,
            },
            "mobile": {
                "analyse": True,
                "chat": True,
                "tts": False,
                "flashcards": True,
                "quiz": True,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": True,  # Quick Voice Call V1 — 1-shot lifetime trial
                "debate": False,
                "deep_research": False,
                "geo": False,
            },
            "extension": {
                "analyse": True,
                "chat": True,
                "tts": False,
                "flashcards": False,
                "quiz": False,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": True,  # Quick Voice Call V1 — 1-shot lifetime trial
                "debate": False,
                "deep_research": False,
                "geo": False,
            },
        },
    },
    # ─── PRO (8.99€/mois ou 89.90€/an) — Tier intermediaire v2, Avril 2026 ──
    # Anciennement "Plus" v0 — refonte tarif (4.99 → 8.99) + voice 30 min/mo
    # Experience enrichie : meilleur modele, exports, mind maps, web search, voice
    PlanId.PRO: {
        "name": "Pro",
        "name_en": "Pro",
        "description": "L'essentiel pour apprendre mieux, plus vite",
        "description_en": "Everything you need to learn better, faster",
        "price_monthly_cents": 899,
        "price_yearly_cents": 8990,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#3B82F6",
        "icon": "⭐",
        "badge": {"text": "Populaire", "color": "#3B82F6"},
        "popular": True,
        "limits": {
            "monthly_credits": 3000,
            "monthly_analyses": 25,
            "max_video_length_min": 60,
            "concurrent_analyses": 1,
            "priority_queue": False,
            "chat_questions_per_video": 25,
            "chat_daily_limit": 50,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": True,
            "factcheck_enabled": True,
            "deep_research_enabled": False,
            "web_search_enabled": True,
            "web_search_monthly": 20,
            "playlists_enabled": False,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "export_formats": ["txt", "md", "pdf"],
            "export_markdown": True,
            "export_pdf": True,
            "history_retention_days": -1,
            "allowed_models": [
                "mistral-small-2603",
                "mistral-medium-2508",
            ],
            "default_model": "mistral-medium-2508",
            "voice_chat_enabled": True,           # ⚠ v2 H4 : Pro a voice
            "voice_monthly_minutes": 30,           # ⚠ v2 H4 : 30 min/mo
            "academic_papers_per_analysis": 15,
            "bibliography_export": True,
            "academic_full_text": False,
            "debate_enabled": True,
            "debate_monthly": 3,
            "tts_enabled": False,
            "geo_enabled": True,
            "geo_monthly": 10,
        },
        "features_display": [
            {"text": "25 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 1h", "icon": "⏱️"},
            {"text": "Chat IA (25 q/vidéo, 50/jour)", "icon": "💬"},
            {"text": "Flashcards, Quiz, Mind Maps", "icon": "🧠", "highlight": True},
            {"text": "Fact-check automatique", "icon": "🔍", "highlight": True},
            {"text": "Recherche web IA (20/mois)", "icon": "🌐", "highlight": True},
            {"text": "Chat vocal ElevenLabs (30 min/mois)", "icon": "🎙️", "highlight": True},
            {"text": "Export PDF + Markdown", "icon": "📄"},
            {"text": "Papers académiques (15/analyse)", "icon": "📚"},
            {"text": "Débat IA (3/mois)", "icon": "⚔️"},
            {"text": "Modèle Mistral Medium", "icon": "🤖"},
            {"text": "Historique permanent", "icon": "♾️"},
        ],
        "features_locked": [
            {"text": "Playlists (jusqu'à 10)", "unlock_plan": "expert"},
            {"text": "Deep Research", "unlock_plan": "expert"},
            {"text": "Chat vocal ElevenLabs étendu (120 min/mois)", "unlock_plan": "expert"},
            {"text": "Lecture audio TTS", "unlock_plan": "expert"},
            {"text": "Modèle Mistral Large", "unlock_plan": "expert"},
            {"text": "File prioritaire", "unlock_plan": "expert"},
        ],
        "platforms": {
            "web": {
                "analyse": True,
                "chat": True,
                "tts": False,
                "flashcards": True,
                "quiz": True,
                "mindmap": True,
                "web_search": True,
                "export_md": True,
                "export_pdf": True,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": False,  # Quick Voice Call: CTA-only — upgrade to Pro
                "debate": True,
                "deep_research": False,
                "geo": True,
            },
            "mobile": {
                "analyse": True,
                "chat": True,
                "tts": False,
                "flashcards": True,
                "quiz": True,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": False,  # Quick Voice Call: CTA-only — upgrade to Pro
                "debate": False,
                "deep_research": False,
                "geo": True,
            },
            "extension": {
                "analyse": True,
                "chat": True,
                "tts": False,
                "flashcards": False,
                "quiz": False,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": False,  # Quick Voice Call: CTA-only — upgrade to Pro
                "debate": False,
                "deep_research": False,
                "geo": False,
            },
        },
    },
    # ─── EXPERT (19.99€/mois ou 199.90€/an) — Tier premium v2, Avril 2026 ──
    # Anciennement "Pro" v0 — refonte tarif (9.99 → 19.99) + voice 120 min/mo
    # Features lourdes et coûteuses : ElevenLabs étendu, Deep Research, playlists, Mistral Large
    PlanId.EXPERT: {
        "name": "Expert",
        "name_en": "Expert",
        "description": "Toute la puissance de DeepSight, sans limites",
        "description_en": "The full power of DeepSight, unlimited",
        "price_monthly_cents": 1999,
        "price_yearly_cents": 19990,
        "stripe_price_id_test": None,
        "stripe_price_id_live": None,
        "color": "#8B5CF6",
        "icon": "👑",
        "badge": {"text": "Le + puissant", "color": "#8B5CF6"},
        "popular": False,
        "limits": {
            "monthly_credits": 15000,
            "monthly_analyses": 100,
            "max_video_length_min": 240,
            "concurrent_analyses": 3,
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
            "allowed_models": [
                "mistral-small-2603",
                "mistral-medium-2508",
                "mistral-large-2512",
            ],
            "default_model": "mistral-large-2512",
            "voice_chat_enabled": True,
            "voice_monthly_minutes": 120,          # ⚠ v2 H4 : Expert 120 min/mo (etait 45 v0)
            "academic_papers_per_analysis": 50,
            "bibliography_export": True,
            "academic_full_text": True,
            "debate_enabled": True,
            "debate_monthly": 20,
            "tts_enabled": True,
            "geo_enabled": True,
            "geo_monthly": -1,
        },
        "features_display": [
            {"text": "100 analyses / mois", "icon": "📊"},
            {"text": "Vidéos jusqu'à 4h", "icon": "⏱️"},
            {"text": "Chat IA illimité", "icon": "💬", "highlight": True},
            {"text": "3 analyses simultanées", "icon": "⚡"},
            {"text": "Deep Research", "icon": "🔬", "highlight": True},
            {
                "text": "Flashcards, Quiz, Mind Maps, Fact-check",
                "icon": "🧠",
                "highlight": True,
            },
            {"text": "Recherche web IA (60/mois)", "icon": "🌐", "highlight": True},
            {"text": "Playlists (10 max, 20 vidéos)", "icon": "📋", "highlight": True},
            {"text": "Chat vocal ElevenLabs (120 min/mois)", "icon": "🎙️", "highlight": True},
            {"text": "Lecture audio TTS", "icon": "🔊", "highlight": True},
            {"text": "Débat IA (20/mois)", "icon": "⚔️"},
            {"text": "Export PDF + Markdown", "icon": "📄"},
            {"text": "Papers académiques (50/analyse + texte intégral)", "icon": "📚"},
            {"text": "Modèle Mistral Large", "icon": "🤖", "highlight": True},
            {"text": "Historique permanent", "icon": "♾️"},
            {"text": "File prioritaire", "icon": "🏃"},
        ],
        "features_locked": [],
        "platforms": {
            "web": {
                "analyse": True,
                "chat": True,
                "tts": True,
                "flashcards": True,
                "quiz": True,
                "mindmap": True,
                "web_search": True,
                "export_md": True,
                "export_pdf": True,
                "playlists": True,
                "history": True,
                "voice_chat": True,
                "voice_call_quick": True,  # Quick Voice Call V1 — 30 min/mois
                "debate": True,
                "deep_research": True,
                "geo": True,
            },
            "mobile": {
                "analyse": True,
                "chat": True,
                "tts": True,
                "flashcards": True,
                "quiz": True,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": True,
                "history": True,
                "voice_chat": True,
                "voice_call_quick": True,  # Quick Voice Call V1 — 30 min/mois
                "debate": False,
                "deep_research": False,
                "geo": True,
            },
            "extension": {
                "analyse": True,
                "chat": True,
                "tts": True,
                "flashcards": False,
                "quiz": False,
                "mindmap": False,
                "web_search": False,
                "export_md": False,
                "export_pdf": False,
                "playlists": False,
                "history": True,
                "voice_chat": False,
                "voice_call_quick": True,  # Quick Voice Call V1 — 30 min/mois
                "debate": False,
                "deep_research": False,
                "geo": False,
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
        "credit_multiplier": 1.0,  # Coût standard
        "supported": True,
    },
    "tiktok": {
        "max_video_length_min": 10,  # TikTok max 10 min (au-delà c'est très rare)
        "credit_multiplier": 0.5,  # Vidéos courtes = 50% du coût
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
    """Charge les stripe_price_id v2 depuis les variables d'environnement.

    Env vars v2 (nouvelles, 8 variables) :
      STRIPE_PRICE_PRO_MONTHLY_TEST / _LIVE
      STRIPE_PRICE_PRO_YEARLY_TEST  / _LIVE
      STRIPE_PRICE_EXPERT_MONTHLY_TEST / _LIVE
      STRIPE_PRICE_EXPERT_YEARLY_TEST  / _LIVE

    Env vars v0 LEGACY (conservees pour grandfathering — ne plus utiliser pour
    nouveaux checkouts mais les webhooks Stripe les voient encore) :
      STRIPE_PRICE_PLUS_TEST / _LIVE   -> ancien Plus 4.99 €
      STRIPE_PRICE_PRO_TEST  / _LIVE   -> ancien Pro 9.99 €
    """
    for plan in (PlanId.PRO, PlanId.EXPERT):
        for cycle in ("monthly", "yearly"):
            for mode in ("test", "live"):
                env_key = f"STRIPE_PRICE_{plan.value.upper()}_{cycle.upper()}_{mode.upper()}"
                val = os.environ.get(env_key, "")
                # Stocker dans le dict du plan pour debug / inspection
                price_field = f"stripe_price_id_{cycle}_{mode}"
                PLANS[plan][price_field] = val or None
                if val:
                    logger.info("Stripe v2 price loaded: %s=%s", env_key, bool(val))

    # Legacy v0 — conservees pour rétro-compat (webhooks Stripe + grandfathered subs)
    legacy_plus_test = os.environ.get("STRIPE_PRICE_PLUS_TEST", "")
    legacy_plus_live = os.environ.get("STRIPE_PRICE_PLUS_LIVE", "")
    legacy_pro_test = os.environ.get("STRIPE_PRICE_PRO_TEST", "")
    legacy_pro_live = os.environ.get("STRIPE_PRICE_PRO_LIVE", "")
    if legacy_plus_test or legacy_plus_live:
        logger.info(
            "Stripe legacy price loaded for PLUS (grandfathering): test=%s live=%s",
            bool(legacy_plus_test),
            bool(legacy_plus_live),
        )
    if legacy_pro_test or legacy_pro_live:
        logger.info(
            "Stripe legacy price loaded for PRO v0 (grandfathering): test=%s live=%s",
            bool(legacy_pro_test),
            bool(legacy_pro_live),
        )


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


# ─── Quick Voice Call (V1) — capability matrix v2 (Avril 2026) ───────────
#
# Pricing v2 mapping :
#   free   -> trial_only (3 min lifetime)
#   pro    -> monthly_minutes (30 min/mo rolling)  ⚠ v2 H4
#   expert -> monthly_minutes (120 min/mo rolling) ⚠ v2 H4
#
# Legacy aliases preserves backward compatibility :
#   plus     (v0 legacy)    -> pro v2     -> 30 min
#   etudiant/starter/student-> pro v2     -> 30 min
#   equipe/team/unlimited   -> expert v2  -> 120 min

VOICE_CALL_QUICK_CAPABILITY: dict[str, tuple[str, int | None]] = {
    "free": ("trial_only", 3),
    # v2 canoniques
    "pro": ("monthly_minutes", 30),
    "expert": ("monthly_minutes", 120),
    # Legacy v0 aliases — résolus vers v2
    "plus": ("monthly_minutes", 30),       # v0 plus -> v2 pro -> 30 min
    "etudiant": ("monthly_minutes", 30),
    "starter": ("monthly_minutes", 30),
    "student": ("monthly_minutes", 30),
    "equipe": ("monthly_minutes", 120),
    "team": ("monthly_minutes", 120),
    "unlimited": ("monthly_minutes", 120),
}


def get_voice_call_quick_capability(plan_id: str) -> tuple[str, int | None]:
    """Return the Quick Voice Call (V1) capability tuple for ``plan_id``.

    Returns one of :
      * ``("trial_only", 3)``        -> 1-shot 3-min lifetime trial (Free)
      * ``("monthly_minutes", 30)``  -> 30 min/mo rolling (Pro v2)
      * ``("monthly_minutes", 120)`` -> 120 min/mo rolling (Expert v2)

    Unknown plans default to the Free policy.
    """
    if not plan_id:
        return VOICE_CALL_QUICK_CAPABILITY["free"]
    return VOICE_CALL_QUICK_CAPABILITY.get(plan_id.lower(), VOICE_CALL_QUICK_CAPABILITY["free"])


def get_plan_index(plan_id: str) -> int:
    """Retourne l'index du plan dans la hiérarchie v2 (0=free, 1=pro, 2=expert)."""
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


def get_price_id(plan_id: str, cycle: str = "monthly", test_mode: bool = True) -> Optional[str]:
    """Retourne le stripe_price_id pour un (plan, cycle) v2.

    Args:
        plan_id: "free" | "pro" | "expert" (ou alias legacy)
        cycle: "monthly" | "yearly"
        test_mode: True = clés Stripe TEST, False = LIVE

    Returns:
        Price ID ou None si plan free / cycle invalide / env var non set.
    """
    if cycle not in ("monthly", "yearly"):
        return None
    normalized = normalize_plan_id(plan_id)
    if normalized == "free":
        return None
    suffix = "TEST" if test_mode else "LIVE"
    env_var = f"STRIPE_PRICE_{normalized.upper()}_{cycle.upper()}_{suffix}"
    return os.environ.get(env_var) or None


def get_plan_by_price_id(price_id: str) -> Optional[str]:
    """Retourne le plan_id v2 correspondant à un stripe_price_id (test/live, monthly/yearly)."""
    if not price_id:
        return None
    # Resolve via env vars (8 v2 + 4 legacy)
    env_to_plan = {
        # v2 actifs
        "STRIPE_PRICE_PRO_MONTHLY_TEST": "pro",
        "STRIPE_PRICE_PRO_MONTHLY_LIVE": "pro",
        "STRIPE_PRICE_PRO_YEARLY_TEST": "pro",
        "STRIPE_PRICE_PRO_YEARLY_LIVE": "pro",
        "STRIPE_PRICE_EXPERT_MONTHLY_TEST": "expert",
        "STRIPE_PRICE_EXPERT_MONTHLY_LIVE": "expert",
        "STRIPE_PRICE_EXPERT_YEARLY_TEST": "expert",
        "STRIPE_PRICE_EXPERT_YEARLY_LIVE": "expert",
        # Legacy v0 (grandfathered)
        "STRIPE_PRICE_PLUS_TEST": "pro",      # v0 plus -> v2 pro
        "STRIPE_PRICE_PLUS_LIVE": "pro",
        "STRIPE_PRICE_PRO_TEST": "expert",    # v0 pro -> v2 expert
        "STRIPE_PRICE_PRO_LIVE": "expert",
    }
    for env_key, plan_value in env_to_plan.items():
        if os.environ.get(env_key) == price_id:
            return plan_value
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# PLAN_PRICES_V2 — Pricing v2 (8.99 / 19.99) avec cycle mensuel + annuel −17 %
# ═══════════════════════════════════════════════════════════════════════════════

# Prix en centimes (€). Annuel = mensuel × 12 × 0.833 (≈ −17 %).
PLAN_PRICES_V2: dict[str, dict[str, int]] = {
    "pro": {
        "monthly": 899,    # 8.99 €
        "yearly": 8990,    # 89.90 € → ≈ 7.49 €/mo équivalent
    },
    "expert": {
        "monthly": 1999,   # 19.99 €
        "yearly": 19990,   # 199.90 € → ≈ 16.66 €/mo équivalent
    },
}

# Voice minutes par plan — Pricing v2 (H4)
PLAN_VOICE_MINUTES_V2: dict[str, int] = {
    "free": 0,
    "pro": 30,
    "expert": 120,
}


def get_voice_minutes(plan_id: str) -> int:
    """Retourne le nombre de minutes ElevenLabs/voice par mois pour un plan v2.

    Free=0, Pro=30, Expert=120. Aliases legacy résolus via normalize_plan_id.
    """
    normalized = normalize_plan_id(plan_id)
    return PLAN_VOICE_MINUTES_V2.get(normalized, 0)


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE INIT — Charge les prix Stripe au chargement
# ═══════════════════════════════════════════════════════════════════════════════

init_stripe_prices()
