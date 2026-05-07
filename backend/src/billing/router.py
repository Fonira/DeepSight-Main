"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💳 BILLING ROUTER — Gestion des paiements et abonnements Stripe                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
import stripe
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime, timezone
from collections import OrderedDict

from db.database import (
    get_session,
    User,
    CreditTransaction,
    Summary,
    ChatMessage,
    AdminLog,
    VoiceQuotaStreaming,
    VoiceCreditPack,
    VoiceCreditPurchase,
)
from auth.dependencies import get_current_user, get_current_user_optional
from core.config import STRIPE_CONFIG, FRONTEND_URL, get_stripe_key, STRIPE_AUTOMATIC_TAX_ENABLED
from services.audit_log import log_audit
from .plan_config import (
    PLANS,
    PLAN_HIERARCHY,
    get_plan as get_plan_config,
    get_limits,
    get_platform_features,
    get_plan_index,
    is_upgrade as plan_is_upgrade,
    get_plan_by_price_id as plan_by_price_id,
)

logger = logging.getLogger(__name__)

# Enable automatic Stripe network retries (up to 2 retries on transient errors)
stripe.max_network_retries = 2

router = APIRouter()

# ---------------------------------------------------------------------------
# Idempotency — track processed webhook event IDs to prevent double-processing
# ---------------------------------------------------------------------------
_MAX_PROCESSED_EVENTS = 10_000


class _EventIdCache:
    """Bounded LRU set of processed Stripe event IDs."""

    def __init__(self, maxsize: int = _MAX_PROCESSED_EVENTS) -> None:
        self._store: OrderedDict[str, None] = OrderedDict()
        self._maxsize = maxsize

    def seen(self, event_id: str) -> bool:
        return event_id in self._store

    def mark(self, event_id: str) -> None:
        self._store[event_id] = None
        if len(self._store) > self._maxsize:
            self._store.popitem(last=False)


_processed_events = _EventIdCache()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class CreateCheckoutRequest(BaseModel):
    """Requête pour créer une session de paiement v2."""

    plan: str  # "pro" | "expert"
    cycle: str = "monthly"  # "monthly" | "yearly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PlanInfoResponse(BaseModel):
    """Informations sur un plan"""

    name: str
    price: int
    credits: int
    features: list


class BillingInfoResponse(BaseModel):
    """Informations de facturation de l'utilisateur"""

    plan: str
    credits: int
    stripe_customer_id: Optional[str]
    subscription_active: bool
    next_renewal: Optional[datetime]


class UpgradeRequest(BaseModel):
    """Requête pour upgrade (deprecated - use /change-plan instead)"""

    target_plan: str = "plus"


class DowngradeRequest(BaseModel):
    """Requête pour downgrade Pro → Free (deprecated - use /cancel instead)"""

    target_plan: str = "free"


class CancelRequest(BaseModel):
    """Requête pour annuler un abonnement"""

    immediate: bool = False  # True = annulation immédiate, False = fin de période


class RefundRequest(BaseModel):
    """Requête pour un remboursement (14 jours max)"""

    reason: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def init_stripe():
    """Initialise Stripe avec la bonne clé"""
    key = get_stripe_key()
    if key:
        stripe.api_key = key
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# 🎯 Acquisition channel — vocabulaire SSOT aligné avec PostHog signup_source
# ─────────────────────────────────────────────────────────────────────────────
ALLOWED_ACQUISITION_CHANNELS: frozenset[str] = frozenset({
    "product_hunt",
    "twitter",
    "reddit",
    "linkedin",
    "indiehackers",
    "hackernews",
    "karim_inmail",
    "mobile_deeplink",
    "test",
    "direct",
})

_ACQUISITION_CHANNEL_ALIASES: dict[str, str] = {
    "ph": "product_hunt",
    "producthunt": "product_hunt",
    "x": "twitter",
    "ih": "indiehackers",
    "indie": "indiehackers",
    "hn": "hackernews",
    "y_combinator": "hackernews",
    "ycombinator": "hackernews",
    "li": "linkedin",
    "linked_in": "linkedin",
}


def normalize_acquisition_channel(raw: Optional[str]) -> str:
    """Normalise et valide une valeur acquisition_channel.

    Returns "direct" si la valeur est invalide ou absente. Ne raise jamais
    pour ne pas bloquer un checkout sur un mauvais tracking côté client.
    """
    if not raw or not isinstance(raw, str):
        return "direct"
    norm = raw.strip().lower().replace("-", "_").replace(" ", "_")
    if not norm:
        return "direct"
    norm = _ACQUISITION_CHANNEL_ALIASES.get(norm, norm)
    if norm not in ALLOWED_ACQUISITION_CHANNELS:
        logger.warning(
            "Unknown acquisition_channel '%s' (normalized '%s'), defaulting to direct",
            raw, norm,
        )
        return "direct"
    return norm


async def get_or_create_stripe_customer(
    user: User,
    session: AsyncSession,
    force_recreate: bool = False,
    acquisition_channel: Optional[str] = None,
) -> str:
    """
    🔧 Récupère ou crée un client Stripe.
    Gère le cas où le client existe en mode test mais pas en mode live.

    Args:
        user: L'utilisateur
        session: Session DB
        force_recreate: Force la recréation du client
        acquisition_channel: Canal d'acquisition (premier-touch immutable —
            si le Customer existe déjà avec une metadata acquisition_channel,
            la valeur EXISTANTE est préservée. Backfill défensif uniquement
            si le champ est absent).

    Returns:
        L'ID du client Stripe
    """
    channel = normalize_acquisition_channel(acquisition_channel)
    base_metadata = {
        "user_id": str(user.id),
        "acquisition_channel": channel,
        "first_checkout_at": datetime.now(timezone.utc).isoformat(),
    }

    # Si pas d'ID existant ou force_recreate, créer directement
    if not user.stripe_customer_id or force_recreate:
        logger.info(
            "Creating new Stripe customer for user %s (channel=%s)",
            user.id, channel,
        )
        customer = stripe.Customer.create(
            email=user.email,
            name=user.username or user.email,
            metadata=base_metadata,
        )
        user.stripe_customer_id = customer.id
        await session.commit()
        logger.info(f"Created Stripe customer: {customer.id}")
        return customer.id

    # Vérifier si le client existe
    try:
        customer = stripe.Customer.retrieve(user.stripe_customer_id)
        if customer.get("deleted"):
            raise stripe.error.InvalidRequestError("Customer deleted", None)
        # 🎯 Backfill défensif : Customer existant créé avant ce sprint
        # n'a pas acquisition_channel. On ajoute SANS écraser autre metadata.
        # Premier-touch wins : si déjà présent, on ne touche RIEN.
        existing_meta = customer.get("metadata") or {}
        if "acquisition_channel" not in existing_meta:
            try:
                merged = {**existing_meta, **base_metadata}
                stripe.Customer.modify(
                    user.stripe_customer_id,
                    metadata=merged,
                )
                logger.info(
                    "Backfilled acquisition_channel=%s on existing customer %s",
                    channel, user.stripe_customer_id,
                )
            except stripe.error.StripeError as e:
                logger.warning("Backfill metadata failed: %s", e)
        logger.info(f"Found existing Stripe customer: {user.stripe_customer_id}")
        return user.stripe_customer_id
    except stripe.error.InvalidRequestError as e:
        # Client n'existe pas (probablement créé en mode test)
        logger.warning(f"Stripe customer {user.stripe_customer_id} not found: {e}")
        logger.info(f"Recreating customer for user {user.id}...")

        customer = stripe.Customer.create(
            email=user.email,
            name=user.username or user.email,
            metadata=base_metadata,
        )
        user.stripe_customer_id = customer.id
        await session.commit()
        logger.info(f"Recreated Stripe customer: {customer.id}")
        return customer.id


def get_price_id(plan: str, cycle: str = "monthly") -> Optional[str]:
    """Retourne le price_id Stripe pour un plan v2 (cycle-aware).

    Args:
        plan: "free" | "pro" | "expert" (ou alias legacy "plus" -> "pro").
        cycle: "monthly" | "yearly" (default monthly pour rétro-compat).

    Returns:
        price_id Stripe ou None si plan/cycle invalide ou env var non set.
    """
    # Normaliser via plan_config (résout alias legacy plus->pro, etc.)
    from .plan_config import normalize_plan_id, get_price_id as plan_get_price_id

    normalized = normalize_plan_id(plan)
    if normalized == "free":
        return None

    test_mode = STRIPE_CONFIG.get("TEST_MODE", True)

    # 1) Priorité v2 : env vars cycle-aware via plan_config.get_price_id
    v2_price = plan_get_price_id(normalized, cycle, test_mode=test_mode)
    if v2_price:
        return v2_price

    # 2) Fallback legacy v0 : essayer le mapping legacy si env vars v2 non set
    #    (utile pour grandfathering sub Stripe legacy actifs)
    prices = STRIPE_CONFIG.get("PRICES", {})
    plan_config = prices.get(plan) or prices.get(normalized)
    if not plan_config:
        logger.warning(f"Plan '{plan}' not found in PRICES config")
        return None

    # Si la structure cycle-aware existe (pro/expert v2), accéder via cycle
    cycle_block = plan_config.get(cycle) if isinstance(plan_config.get(cycle), dict) else None
    if cycle_block:
        legacy_id = cycle_block.get("test" if test_mode else "live")
        if legacy_id:
            return legacy_id

    # Sinon ancienne structure flat (legacy "plus" v0 + fields legacy ajoutés sur "pro" v2)
    legacy_id = plan_config.get("test" if test_mode else "live")
    return legacy_id or None


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 ENDPOINTS BILLING
# ═══════════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════════
# 🆓 TRIAL ELIGIBILITY — Essai gratuit Pro
# ═══════════════════════════════════════════════════════════════════════════════


class TrialEligibilityResponse(BaseModel):
    """Réponse d'éligibilité à l'essai gratuit v2 (Pro ou Expert)."""

    eligible: bool
    reason: Optional[str] = None
    trial_days: int = 7
    trial_plan: str = "pro"  # v2 default — anciennement "plus"


@router.get("/trial-eligibility", response_model=TrialEligibilityResponse)
async def check_trial_eligibility(
    plan: str = Query("pro", description="Plan cible du trial : pro ou expert"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🆓 Vérifie l'éligibilité à un essai 7 j sans CB pour Pro ou Expert (v2 H5).

    Conditions :
      - plan ∈ {pro, expert}
      - user.plan == "free"
      - Aucun stripe_subscription_id existant
      - Aucune transaction passée de type purchase / trial / upgrade
    """
    if plan not in ("pro", "expert"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_plan",
                "message": "plan must be 'pro' or 'expert'",
            },
        )

    if current_user.plan != "free":
        return TrialEligibilityResponse(
            eligible=False,
            reason="Vous avez déjà un abonnement actif",
            trial_days=0,
            trial_plan=plan,
        )

    if current_user.stripe_subscription_id:
        return TrialEligibilityResponse(
            eligible=False,
            reason="Vous avez déjà bénéficié d'un abonnement",
            trial_days=0,
            trial_plan=plan,
        )

    result = await session.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .where(CreditTransaction.transaction_type.in_(["purchase", "trial", "upgrade"]))
        .limit(1)
    )
    if result.scalar_one_or_none() is not None:
        return TrialEligibilityResponse(
            eligible=False,
            reason="Vous avez déjà bénéficié d'un essai ou d'un abonnement",
            trial_days=0,
            trial_plan=plan,
        )

    return TrialEligibilityResponse(eligible=True, trial_days=7, trial_plan=plan)


@router.post("/start-trial")
async def start_trial(
    plan: str = Query("pro", description="Plan cible : pro ou expert"),
    cycle: str = Query("monthly", description="monthly | yearly"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🆓 Démarre un essai gratuit 7 j sans CB sur Pro ou Expert (Pricing v2 H5).

    Crée une session Stripe Checkout avec :
      - trial_period_days = 7
      - payment_method_collection = "if_required"  -> pas de CB demandée pendant le trial
    """
    if plan not in ("pro", "expert"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_plan",
                "message": "plan must be 'pro' or 'expert'",
            },
        )
    if cycle not in ("monthly", "yearly"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_cycle",
                "message": "cycle must be 'monthly' or 'yearly'",
            },
        )

    eligibility = await check_trial_eligibility(plan, current_user, session)
    if not eligibility.eligible:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "not_eligible",
                "message": eligibility.reason or "Non éligible à l'essai gratuit",
            },
        )

    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")

    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    price_id = get_price_id(plan, cycle)
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"Plan {plan} ({cycle}) not configured",
        )

    try:
        customer_id = await get_or_create_stripe_customer(current_user, session)
    except stripe.error.StripeError as e:
        logger.error(f"Error creating Stripe customer: {e}")
        raise HTTPException(
            status_code=500, detail="Erreur lors de la création du client Stripe"
        )

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            payment_method_collection="if_required",  # H5 : pas de CB pour le trial
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            # Stripe Tax (TVA EU / VAT MOSS) — flip via STRIPE_AUTOMATIC_TAX_ENABLED.
            # Requires Stripe Tax enabled in Dashboard (else Stripe rejects).
            automatic_tax={"enabled": STRIPE_AUTOMATIC_TAX_ENABLED},
            subscription_data={
                "trial_period_days": 7,
                "metadata": {
                    "user_id": str(current_user.id),
                    "is_trial": "true",
                    "trial_plan": plan,
                    "cycle": cycle,
                },
            },
            success_url=(
                f"{FRONTEND_URL}/payment/success"
                f"?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}"
                f"&cycle={cycle}&trial=true"
            ),
            cancel_url=f"{FRONTEND_URL}/upgrade",
            allow_promotion_codes=False,
            metadata={
                "user_id": str(current_user.id),
                "plan": plan,
                "cycle": cycle,
                "is_trial": "true",
            },
        )

        logger.info(
            f"Trial v2 checkout: user={current_user.id} plan={plan} cycle={cycle}"
        )

        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id,
            "trial_days": 7,
            "plan": plan,
            "cycle": cycle,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/start-pro-trial", deprecated=True)
async def start_pro_trial_legacy(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🔄 LEGACY — Ancien endpoint v0 qui démarrait un trial Plus 4.99 €.

    Désormais redirige vers le nouveau /start-trial?plan=pro&cycle=monthly v2.
    Conservé pour compatibilité clients mobiles non encore mis à jour.
    """
    return await start_trial(
        plan="pro",
        cycle="monthly",
        current_user=current_user,
        session=session,
    )


@router.get("/plans")
async def get_plans(
    platform: str = Query("web", pattern="^(web|mobile|extension)$"),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """🆕 Pricing v2 — Grille publique (Free / Pro 8.99 € / Expert 19.99 €).

    Enrichi par plateforme + (si user connecté) is_current / is_upgrade / is_downgrade.
    Inclut prices monthly + yearly + voice_minutes + yearly_discount_pct.
    """
    from .plan_config import PLAN_PRICES_V2, PLAN_VOICE_MINUTES_V2

    user_plan = (current_user.plan if current_user else "free") or "free"
    user_index = get_plan_index(user_plan)

    result: list[dict[str, Any]] = []
    for plan_id in PLAN_HIERARCHY:
        plan = PLANS[plan_id]
        plan_index = get_plan_index(plan_id.value)
        plan_limits = plan["limits"]

        # Filtrage des limites par plateforme
        platform_features = get_platform_features(plan_id.value, platform)

        # v2 : prices cycle-aware
        prices = PLAN_PRICES_V2.get(plan_id.value, {})
        result.append(
            {
                "id": plan_id.value,
                "name": plan["name"],
                "name_en": plan["name_en"],
                "description": plan["description"],
                "description_en": plan["description_en"],
                "price_monthly_cents": plan.get("price_monthly_cents", 0),
                "price_yearly_cents": plan.get("price_yearly_cents", prices.get("yearly", 0)),
                "voice_minutes": PLAN_VOICE_MINUTES_V2.get(plan_id.value, 0),
                "color": plan["color"],
                "icon": plan["icon"],
                "badge": plan["badge"],
                "popular": plan["popular"],
                "limits": plan_limits,
                "platform_features": platform_features,
                "features_display": plan["features_display"],
                "features_locked": plan["features_locked"],
                "is_current": plan_id.value == user_plan,
                "is_upgrade": plan_index > user_index,
                "is_downgrade": plan_index < user_index and plan_index >= 0,
            }
        )

    return {
        "plans": result,
        "currency": "EUR",
        "yearly_discount_pct": 17,
    }


@router.get("/my-plan")
async def get_my_plan(
    platform: str = Query("web", pattern="^(web|mobile|extension)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Retourne le plan courant, ses limites, et l'usage du mois/jour.

    Requiert auth.
    """
    user_plan = current_user.plan or "free"
    plan = get_plan_config(user_plan)
    plan_limits = plan["limits"]
    platform_features = get_platform_features(user_plan, platform)

    # ── Calcul de l'usage ──
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Analyses ce mois
    analyses_q = await session.execute(
        select(sa_func.count(Summary.id))
        .where(Summary.user_id == current_user.id)
        .where(Summary.created_at >= month_start)
    )
    analyses_this_month: int = analyses_q.scalar() or 0

    # Chat messages aujourd'hui (role = 'user' seulement)
    chat_q = await session.execute(
        select(sa_func.count(ChatMessage.id))
        .where(ChatMessage.user_id == current_user.id)
        .where(ChatMessage.role == "user")
        .where(ChatMessage.created_at >= day_start)
    )
    chat_today: int = chat_q.scalar() or 0

    # Web searches ce mois (chat messages avec web_search_used = True)
    ws_q = await session.execute(
        select(sa_func.count(ChatMessage.id))
        .where(ChatMessage.user_id == current_user.id)
        .where(ChatMessage.web_search_used)
        .where(ChatMessage.created_at >= month_start)
    )
    web_searches_this_month: int = ws_q.scalar() or 0

    # ── Voice quota A+D (Quick Voice Call I4) ──
    # Expose lifetime_trial_used (Free) + monthly_minutes_used (Expert) pour
    # que l'extension puisse afficher des badges honnêtes ("Essai utilisé"
    # vs "X min restantes") sans appeler un endpoint séparé. Backend reste
    # SoT au moment du POST /voice/session pour le quota check strict.
    voice_quota_q = await session.execute(
        select(VoiceQuotaStreaming).where(VoiceQuotaStreaming.user_id == current_user.id)
    )
    voice_quota_row = voice_quota_q.scalar_one_or_none()
    voice_quota_payload: dict[str, Any] = {
        "trial_used": False,
        "monthly_minutes_used": 0.0,
    }
    if voice_quota_row is not None:
        voice_quota_payload["trial_used"] = bool(voice_quota_row.lifetime_trial_used)
        voice_quota_payload["monthly_minutes_used"] = float(voice_quota_row.monthly_minutes_used or 0.0)

    # ── Subscription status ──
    subscription_info: dict[str, Any] = {
        "status": "none",
        "current_period_end": None,
    }
    if current_user.stripe_subscription_id and init_stripe():
        try:
            sub = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
            subscription_info["status"] = sub.status
            subscription_info["current_period_end"] = datetime.fromtimestamp(
                sub.current_period_end, tz=timezone.utc
            ).isoformat()
        except Exception as e:
            logger.warning("Failed to fetch subscription: %s", e)

    return {
        "plan": user_plan,
        "plan_name": plan["name"],
        "plan_icon": plan["icon"],
        "plan_color": plan["color"],
        "limits": plan_limits,
        "platform_features": platform_features,
        "usage": {
            "analyses_this_month": analyses_this_month,
            "chat_today": chat_today,
            "web_searches_this_month": web_searches_this_month,
        },
        "subscription": subscription_info,
        "voice_quota": voice_quota_payload,
    }


@router.get("/info", response_model=BillingInfoResponse)
async def get_billing_info(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Retourne les informations de facturation de l'utilisateur"""
    subscription_active = False
    next_renewal = None

    if current_user.stripe_subscription_id and init_stripe():
        try:
            subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
            subscription_active = subscription.status == "active"
            if subscription_active:
                next_renewal = datetime.fromtimestamp(subscription.current_period_end)
        except Exception as e:
            logger.warning(f"Failed to retrieve Stripe subscription info: {e}")

    return BillingInfoResponse(
        plan=current_user.plan or "free",
        credits=current_user.credits or 0,
        stripe_customer_id=current_user.stripe_customer_id,
        subscription_active=subscription_active,
        next_renewal=next_renewal,
    )


@router.post("/checkout")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Crée une session de paiement Stripe Checkout pour Pro.
    Ajoute trial_period_days=7 pour les nouveaux abonnés (jamais eu de trial).
    """
    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")

    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Valider le plan (doit être un plan payant dans la hiérarchie)
    paid_plans = [p for p in PLAN_HIERARCHY if p != "free"]
    if request.plan not in paid_plans:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid plan: {request.plan}. Must be one of: {', '.join(paid_plans)}.",
        )

    price_id = get_price_id(request.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {request.plan}")

    # Créer ou récupérer le client Stripe
    try:
        customer_id = await get_or_create_stripe_customer(current_user, session)
    except stripe.error.StripeError as e:
        logger.error(f"Error creating Stripe customer: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création du client Stripe")

    # Vérifier l'éligibilité au trial 7j (jamais eu de trial/achat)
    trial_eligible = False
    if current_user.plan == "free" and not current_user.stripe_subscription_id:
        result = await session.execute(
            select(CreditTransaction)
            .where(CreditTransaction.user_id == current_user.id)
            .where(CreditTransaction.transaction_type.in_(["purchase", "trial", "upgrade"]))
            .limit(1)
        )
        trial_eligible = result.scalar_one_or_none() is None

    # URLs de retour (avec plan pour affichage immédiat)
    success_url = (
        request.success_url or f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&plan={request.plan}"
    )
    cancel_url = request.cancel_url or f"{FRONTEND_URL}/payment/cancel"

    try:
        checkout_params = {
            "customer": customer_id,
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            # Stripe Tax (TVA EU / VAT MOSS) — env-driven, see RUNBOOK §9.
            "automatic_tax": {"enabled": STRIPE_AUTOMATIC_TAX_ENABLED},
            "success_url": success_url,
            "cancel_url": cancel_url,
            "allow_promotion_codes": True,
            "metadata": {
                "user_id": str(current_user.id),
                "plan": request.plan,
            },
        }

        # Ajouter le trial 7j pour les nouveaux abonnés éligibles
        if trial_eligible:
            checkout_params["subscription_data"] = {
                "trial_period_days": 7,
                "metadata": {
                    "user_id": str(current_user.id),
                    "is_trial": "true",
                },
            }
            checkout_params["metadata"]["is_trial"] = "true"
            logger.info(f"Trial 7j enabled for user {current_user.id} on plan {request.plan}")

        checkout_session = stripe.checkout.Session.create(**checkout_params)

        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id,
            "trial_applied": trial_eligible,
        }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 🆕 Pricing v2 — endpoint /create-checkout accepte {plan, cycle}
# Compat rétro : aussi accepte {plan_id} pour clients legacy non updatés.
class CreateCheckoutByPlanId(BaseModel):
    """Requête v2 avec plan + cycle (compat rétro avec plan_id)."""

    plan: Optional[str] = None    # "pro" | "expert"
    cycle: str = "monthly"         # "monthly" | "yearly"
    plan_id: Optional[str] = None  # legacy alias of plan
    # 🎯 Attribution launch J0 — premier-touch immutable.
    # Vocabulaire SSOT (cf. ALLOWED_ACQUISITION_CHANNELS).
    # Valeur invalide ou absente → "direct" (jamais 4xx).
    acquisition_channel: Optional[str] = None


@router.post("/create-checkout")
async def create_checkout_by_plan_id(
    request: CreateCheckoutByPlanId,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🆕 Pricing v2 — Crée une session Stripe Checkout pour Pro / Expert + cycle.

    Body : {"plan": "pro"|"expert", "cycle": "monthly"|"yearly"}
    Compat rétro : accepte aussi {"plan_id": "..."} (legacy frontend).
    """
    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")

    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Resolve plan : prefer 'plan', fallback to legacy 'plan_id'
    plan = request.plan or request.plan_id
    if not plan:
        raise HTTPException(
            status_code=400,
            detail={"code": "missing_plan", "message": "plan is required"},
        )

    if plan not in ("pro", "expert"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_plan",
                "message": "plan must be 'pro' or 'expert'",
            },
        )
    if request.cycle not in ("monthly", "yearly"):
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_cycle", "message": "cycle must be 'monthly' or 'yearly'"},
        )

    price_id = get_price_id(plan, request.cycle)
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"Plan {plan} ({request.cycle}) price not configured",
        )

    # 🎯 Acquisition channel — normalisé en amont, partagé entre Customer
    # metadata (premier-touch immutable côté Stripe) et Session metadata
    # (lu par le webhook handler sans round-trip Stripe).
    acquisition_channel = normalize_acquisition_channel(request.acquisition_channel)

    # Créer ou récupérer le client Stripe via helper centralisé
    # (gère premier-touch immutable + backfill défensif).
    customer_id = await get_or_create_stripe_customer(
        current_user,
        session,
        acquisition_channel=request.acquisition_channel,
    )

    # URLs de retour (avec plan + cycle pour affichage immédiat)
    success_url = (
        request.plan_id  # noqa: SIM222 — preserved for legacy compat
        and f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}"
    ) or (
        f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}&cycle={request.cycle}"
    )
    cancel_url = f"{FRONTEND_URL}/payment/cancel"

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            # Stripe Tax (TVA EU / VAT MOSS) — env-driven, see RUNBOOK §9.
            automatic_tax={"enabled": STRIPE_AUTOMATIC_TAX_ENABLED},
            success_url=success_url,
            cancel_url=cancel_url,
            allow_promotion_codes=True,
            billing_address_collection="auto",
            metadata={
                "user_id": str(current_user.id),
                "plan": plan,
                "cycle": request.cycle,
                # 🎯 Propagé pour webhook (évite round-trip Customer.retrieve)
                "acquisition_channel": acquisition_channel,
            },
        )

        logger.info(
            f"Checkout v2 session: user={current_user.id} plan={plan} cycle={request.cycle}"
        )

        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/portal")
async def create_portal_session(current_user: User = Depends(get_current_user)):
    """
    Crée une session du portail client Stripe.
    Permet à l'utilisateur de gérer son abonnement.
    """
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/billing",
        )
        return {"portal_url": portal_session.url}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 CHANGEMENT DE PLAN (UPGRADE / DOWNGRADE)
# ═══════════════════════════════════════════════════════════════════════════════


class ChangePlanRequest(BaseModel):
    """Requête pour changer de plan"""

    new_plan: str  # pro


class ChangePlanResponse(BaseModel):
    """Réponse au changement de plan"""

    success: bool
    message: str
    action: str  # "upgraded", "downgraded", "checkout_required"
    checkout_url: Optional[str] = None
    new_plan: Optional[str] = None
    effective_date: Optional[str] = None


@router.post("/change-plan", response_model=ChangePlanResponse)
async def change_subscription_plan(
    request: ChangePlanRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🔄 Change le plan d'abonnement de l'utilisateur (upgrade ou downgrade).

    - Si l'utilisateur n'a pas d'abonnement actif → redirige vers checkout
    - Si upgrade → proration immédiate (facturé la différence)
    - Si downgrade → effectif à la fin de la période actuelle
    """
    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")

    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    new_plan = request.new_plan.lower()
    current_plan = current_user.plan or "free"

    # Validation du nouveau plan (tous les plans payants)
    valid_plans = [p for p in PLAN_HIERARCHY if p != "free"]
    if new_plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {new_plan}")

    # Audit log RGPD — log l'intention. Effectif tracé via Stripe webhook
    # (subscription.updated → users.plan). Multi-branch endpoint, log avant
    # toute mutation Stripe.
    await log_audit(
        session,
        action="plan.changed",
        user_id=current_user.id,
        details={"from": current_plan, "to": new_plan},
    )
    await session.commit()

    # Si même plan, rien à faire
    if new_plan == current_plan:
        return ChangePlanResponse(
            success=True,
            message="Vous êtes déjà sur ce plan",
            action="no_change",
            new_plan=current_plan,
        )

    # Si plan gratuit ou pas d'abonnement actif → checkout
    if current_plan == "free" or not current_user.stripe_subscription_id:
        logger.info(f"User {current_user.id} needs checkout (no active subscription)")

        # Créer une session checkout
        price_id = get_price_id(new_plan)
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {new_plan}")

        # 🔧 Utiliser la fonction helper qui gère le cas test/live
        try:
            customer_id = await get_or_create_stripe_customer(current_user, session)
        except stripe.error.StripeError as e:
            logger.error(f"Error creating Stripe customer: {e}")
            raise HTTPException(status_code=500, detail="Erreur lors de la création du client Stripe")

        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            # Stripe Tax (TVA EU / VAT MOSS) — env-driven, see RUNBOOK §9.
            automatic_tax={"enabled": STRIPE_AUTOMATIC_TAX_ENABLED},
            success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&plan={new_plan}",
            cancel_url=f"{FRONTEND_URL}/upgrade",
            allow_promotion_codes=True,
            metadata={"user_id": str(current_user.id), "plan": new_plan},
        )

        return ChangePlanResponse(
            success=True,
            message="Redirection vers le paiement...",
            action="checkout_required",
            checkout_url=checkout_session.url,
            new_plan=new_plan,
        )

    # Récupérer l'abonnement actuel
    try:
        subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
    except stripe.error.StripeError as e:
        logger.error(f"Error retrieving subscription: {e}")
        raise HTTPException(status_code=400, detail="Subscription not found")

    if subscription.status not in ["active", "trialing"]:
        raise HTTPException(status_code=400, detail="Subscription is not active")

    # Obtenir le nouveau price_id
    new_price_id = get_price_id(new_plan)
    if not new_price_id:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {new_plan}")

    # Déterminer si c'est un upgrade ou downgrade
    is_upgrade = get_plan_index(new_plan) > get_plan_index(current_plan)

    try:
        # Récupérer l'item d'abonnement actuel
        subscription_item_id = subscription["items"]["data"][0]["id"]

        if is_upgrade:
            # UPGRADE: Proration immédiate
            logger.info(f"Upgrading user {current_user.id} from {current_plan} to {new_plan}")

            stripe.Subscription.modify(
                current_user.stripe_subscription_id,
                items=[
                    {
                        "id": subscription_item_id,
                        "price": new_price_id,
                    }
                ],
                proration_behavior="create_prorations",  # Facture la différence immédiatement
                payment_behavior="error_if_incomplete",
            )

            # Mise à jour immédiate du plan (crédits depuis plan_config — source de vérité)
            new_plan_limits = get_limits(new_plan)
            old_plan_limits = get_limits(current_plan)
            credits_bonus = new_plan_limits.get("monthly_credits", 0) - old_plan_limits.get("monthly_credits", 0)

            current_user.plan = new_plan
            if credits_bonus > 0:
                current_user.credits = (current_user.credits or 0) + credits_bonus

                # Transaction
                transaction = CreditTransaction(
                    user_id=current_user.id,
                    amount=credits_bonus,
                    balance_after=current_user.credits,
                    transaction_type="upgrade",
                    type="upgrade",
                    description=f"Upgrade: {current_plan} → {new_plan}",
                )
                session.add(transaction)

            await session.commit()

            return ChangePlanResponse(
                success=True,
                message=f"Upgrade réussi ! Vous êtes maintenant sur le plan {new_plan.capitalize()}.",
                action="upgraded",
                new_plan=new_plan,
                effective_date="immediate",
            )

        else:
            # DOWNGRADE: Effectif à la fin de la période
            logger.info(f"Downgrading user {current_user.id} from {current_plan} to {new_plan}")

            # Programmer le changement pour la fin de la période
            stripe.Subscription.modify(
                current_user.stripe_subscription_id,
                items=[
                    {
                        "id": subscription_item_id,
                        "price": new_price_id,
                    }
                ],
                proration_behavior="none",  # Pas de proration pour downgrade
                billing_cycle_anchor="unchanged",
            )

            # La date de fin de période actuelle
            end_date = datetime.fromtimestamp(subscription.current_period_end)

            return ChangePlanResponse(
                success=True,
                message=f"Votre plan passera à {new_plan.capitalize()} le {end_date.strftime('%d/%m/%Y')}. Vous gardez vos avantages actuels jusqu'à cette date.",
                action="downgraded",
                new_plan=new_plan,
                effective_date=end_date.isoformat(),
            )

    except stripe.error.CardError as e:
        logger.error(f"Card error: {e}")
        raise HTTPException(status_code=400, detail="Erreur de paiement. Veuillez vérifier votre carte.")
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# ⬆️ UPGRADE — Free → Pro (proration immédiate) [DEPRECATED - use /change-plan]
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/upgrade")
async def upgrade_subscription(
    request: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    ⬆️ Upgrade de plan (Free → Pro). DEPRECATED - utilisez /change-plan.
    Utilise stripe.Subscription.modify() avec proration immédiate.
    """
    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    current_plan = current_user.plan or "free"
    target = request.target_plan.lower()

    # Valider que c'est bien un plan payant valide
    paid_plans = [p for p in PLAN_HIERARCHY if p != "free"]
    if target not in paid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid target plan: {target}")

    if not plan_is_upgrade(current_plan, target):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot upgrade from {current_plan} to {target}. This is not an upgrade.",
        )

    if not current_user.stripe_subscription_id:
        raise HTTPException(
            status_code=400,
            detail="No active subscription. Use /checkout to subscribe first.",
        )

    # Récupérer l'abonnement actuel
    try:
        subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
    except stripe.error.StripeError as e:
        logger.error(f"Error retrieving subscription: {e}")
        raise HTTPException(status_code=400, detail="Subscription not found")

    if subscription.status not in ("active", "trialing"):
        raise HTTPException(status_code=400, detail="Subscription is not active")

    new_price_id = get_price_id(target)
    if not new_price_id:
        raise HTTPException(status_code=400, detail=f"Price not configured for plan: {target}")

    try:
        subscription_item_id = subscription["items"]["data"][0]["id"]

        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            items=[
                {
                    "id": subscription_item_id,
                    "price": new_price_id,
                }
            ],
            proration_behavior="create_prorations",
            payment_behavior="error_if_incomplete",
        )

        # Mise à jour immédiate du plan et crédits
        new_plan_limits = get_limits(target)
        old_plan_limits = get_limits(current_plan)
        credits_bonus = new_plan_limits.get("monthly_credits", 0) - old_plan_limits.get("monthly_credits", 0)

        current_user.plan = target
        if credits_bonus > 0:
            current_user.credits = (current_user.credits or 0) + credits_bonus
            transaction = CreditTransaction(
                user_id=current_user.id,
                amount=credits_bonus,
                balance_after=current_user.credits,
                transaction_type="upgrade",
                type="upgrade",
                description=f"Upgrade: {current_plan} → {target}",
            )
            session.add(transaction)

        await session.commit()

        logger.info(f"User {current_user.id} upgraded from {current_plan} to {target}")

        return {
            "success": True,
            "message": f"Upgrade réussi ! Vous êtes maintenant sur le plan {target.capitalize()}.",
            "action": "upgraded",
            "old_plan": current_plan,
            "new_plan": target,
            "credits_bonus": max(credits_bonus, 0),
            "effective_date": "immediate",
        }

    except stripe.error.CardError as e:
        logger.error(f"Card error during upgrade: {e}")
        raise HTTPException(status_code=400, detail="Erreur de paiement. Veuillez vérifier votre carte.")
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error during upgrade: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# ⬇️ DOWNGRADE — Pro → Free (fin de période) [DEPRECATED - use /cancel]
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/downgrade")
async def downgrade_subscription(
    request: DowngradeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    ⬇️ Downgrade de plan (Pro → Free). DEPRECATED - utilisez /cancel.
    Le changement est programmé à la fin de la période de facturation (pas de prorata inverse).
    """
    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    current_plan = current_user.plan or "free"
    target = request.target_plan.lower()

    if target != "free":
        raise HTTPException(status_code=400, detail=f"Invalid target plan: {target}")

    # Valider que c'est bien un downgrade
    if plan_is_upgrade(current_plan, target) or current_plan == target:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot downgrade from {current_plan} to {target}. This is not a downgrade.",
        )

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    # Si downgrade vers free → utiliser /cancel
    if target == "free":
        raise HTTPException(
            status_code=400,
            detail="To cancel your subscription, use POST /api/billing/cancel instead.",
        )

    try:
        subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
    except stripe.error.StripeError as e:
        logger.error(f"Error retrieving subscription: {e}")
        raise HTTPException(status_code=400, detail="Subscription not found")

    if subscription.status not in ("active", "trialing"):
        raise HTTPException(status_code=400, detail="Subscription is not active")

    new_price_id = get_price_id(target)
    if not new_price_id:
        raise HTTPException(status_code=400, detail=f"Price not configured for plan: {target}")

    try:
        subscription_item_id = subscription["items"]["data"][0]["id"]

        # Downgrade programmé à la fin de la période (pas de prorata)
        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            items=[
                {
                    "id": subscription_item_id,
                    "price": new_price_id,
                }
            ],
            proration_behavior="none",
            billing_cycle_anchor="unchanged",
        )

        end_date = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)

        logger.info(f"User {current_user.id} downgrade scheduled: {current_plan} → {target} at {end_date}")

        return {
            "success": True,
            "message": f"Votre plan passera à {target.capitalize()} le {end_date.strftime('%d/%m/%Y')}. Vous gardez vos avantages actuels jusqu'à cette date.",
            "action": "downgrade_scheduled",
            "old_plan": current_plan,
            "new_plan": target,
            "effective_date": end_date.isoformat(),
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error during downgrade: {e}")
        raise HTTPException(status_code=400, detail=str(e))


class ConfirmCheckoutRequest(BaseModel):
    """Requête pour confirmer un checkout"""

    session_id: str


@router.post("/confirm-checkout")
async def confirm_checkout(
    request: ConfirmCheckoutRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    ✅ Confirme un checkout Stripe et met à jour le plan de l'utilisateur.

    Utilisé comme fallback quand les webhooks ne fonctionnent pas.
    Vérifie la session Stripe et met à jour le plan si le paiement est complet.
    """
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        # Récupérer la session Stripe
        checkout_session = stripe.checkout.Session.retrieve(request.session_id, expand=["subscription", "customer"])

        logger.info(f"🔍 Confirming checkout session: {request.session_id}")
        logger.info(f"Session status: {checkout_session.status}")
        logger.info(f"Payment status: {checkout_session.payment_status}")

        # Vérifier que le paiement est complet
        if checkout_session.payment_status != "paid":
            logger.warning(f"Payment not completed: {checkout_session.payment_status}")
            return {
                "success": False,
                "message": "Paiement non complété",
                "status": checkout_session.payment_status,
            }

        # Récupérer les métadonnées
        metadata = checkout_session.metadata or {}
        plan = metadata.get("plan")
        user_id_from_session = metadata.get("user_id")

        # Vérifier que c'est bien le bon utilisateur
        if user_id_from_session and int(user_id_from_session) != current_user.id:
            logger.warning(f"User mismatch: session={user_id_from_session}, current={current_user.id}")
            raise HTTPException(status_code=403, detail="Session does not belong to current user")

        # Récupérer les infos d'abonnement
        customer_id = checkout_session.customer
        if isinstance(customer_id, dict):
            customer_id = customer_id.get("id")

        subscription_id = checkout_session.subscription
        if isinstance(subscription_id, dict):
            subscription_id = subscription_id.get("id")

        logger.info(f"Plan: {plan}, Customer: {customer_id}, Subscription: {subscription_id}")

        # Vérifier si déjà mis à jour
        if current_user.plan == plan and current_user.stripe_subscription_id == subscription_id:
            logger.info(f"User already on plan {plan}")
            return {
                "success": True,
                "message": f"Vous êtes déjà sur le plan {plan}",
                "plan": plan,
                "already_updated": True,
            }

        # Mettre à jour l'utilisateur (crédits depuis plan_config — source de vérité)
        credits_to_add = get_limits(plan).get("monthly_credits", 0)

        old_plan = current_user.plan
        current_user.plan = plan
        current_user.credits = (current_user.credits or 0) + credits_to_add
        current_user.stripe_customer_id = customer_id
        current_user.stripe_subscription_id = subscription_id

        # Enregistrer la transaction
        transaction = CreditTransaction(
            user_id=current_user.id,
            amount=credits_to_add,
            balance_after=current_user.credits,
            transaction_type="purchase",
            type="purchase",
            stripe_payment_id=checkout_session.payment_intent,
            description=f"Subscription upgrade: {old_plan} → {plan}",
        )
        session.add(transaction)

        await session.commit()

        logger.info(f"User {current_user.id} upgraded from {old_plan} to {plan}, +{credits_to_add} credits")

        return {
            "success": True,
            "message": f"Félicitations ! Vous êtes maintenant sur le plan {plan.capitalize()}.",
            "plan": plan,
            "credits_added": credits_to_add,
            "new_credits": current_user.credits,
        }

    except stripe.error.InvalidRequestError as e:
        logger.error(f"Invalid session: {e}")
        raise HTTPException(status_code=400, detail="Session invalide ou expirée")
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel_subscription(
    request: CancelRequest = CancelRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🗑️ Annule l'abonnement de l'utilisateur.

    - immediate=False (défaut) : l'accès reste jusqu'à la fin de la période payée
    - immediate=True : annulation immédiate, accès coupé tout de suite
    """
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    try:
        if request.immediate:
            # Annulation immédiate — supprime l'abonnement tout de suite
            subscription = stripe.Subscription.cancel(
                current_user.stripe_subscription_id,
            )

            old_plan = current_user.plan
            current_user.plan = "free"
            current_user.stripe_subscription_id = None
            await session.commit()

            logger.info(f"Subscription immediately canceled for user {current_user.id} (was {old_plan})")

            return {
                "success": True,
                "message": "Votre abonnement a été annulé immédiatement.",
                "immediate": True,
                "old_plan": old_plan,
            }
        else:
            # Annuler à la fin de la période (pas immédiatement)
            subscription = stripe.Subscription.modify(current_user.stripe_subscription_id, cancel_at_period_end=True)

            end_date = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)

            logger.info(f"Subscription canceled for user {current_user.id}, effective {end_date}")

            return {
                "success": True,
                "message": f"Votre abonnement sera annulé le {end_date.strftime('%d/%m/%Y')}. Vous gardez vos avantages jusqu'à cette date.",
                "immediate": False,
                "end_date": end_date.isoformat(),
            }

    except stripe.error.StripeError as e:
        logger.error(f"Error canceling subscription: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reactivate")
async def reactivate_subscription(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🔄 Réactive un abonnement annulé (avant la fin de période).
    """
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No subscription found")

    try:
        stripe.Subscription.modify(current_user.stripe_subscription_id, cancel_at_period_end=False)

        logger.info(f"Subscription reactivated for user {current_user.id}")

        return {
            "success": True,
            "message": "Votre abonnement a été réactivé avec succès !",
        }

    except stripe.error.StripeError as e:
        logger.error(f"Error reactivating subscription: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# 💸 REFUND — Remboursement dans les 14 premiers jours
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/refund")
async def request_refund(
    request: RefundRequest = RefundRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    💸 Demander un remboursement dans les 14 premiers jours de l'abonnement.

    Vérifie que l'abonnement a moins de 14 jours (subscription.created).
    Crée un Stripe Refund complet + annule l'abonnement + log admin.
    """
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    # Récupérer l'abonnement Stripe
    try:
        subscription = stripe.Subscription.retrieve(
            current_user.stripe_subscription_id,
            expand=["latest_invoice"],
        )
    except stripe.error.StripeError as e:
        logger.error(f"Error retrieving subscription for refund: {e}")
        raise HTTPException(status_code=400, detail="Subscription not found")

    # Vérifier que l'abonnement a moins de 14 jours
    sub_created = datetime.fromtimestamp(subscription.created, tz=timezone.utc)
    now = datetime.now(tz=timezone.utc)
    days_since_creation = (now - sub_created).days

    if days_since_creation > 14:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "refund_period_expired",
                "message": f"La période de remboursement de 14 jours est expirée. Abonnement créé il y a {days_since_creation} jours.",
                "days_since_creation": days_since_creation,
            },
        )

    # Trouver le payment_intent de la dernière facture pour rembourser
    latest_invoice = subscription.get("latest_invoice")
    payment_intent_id = None

    if isinstance(latest_invoice, dict):
        payment_intent_id = latest_invoice.get("payment_intent")
    elif isinstance(latest_invoice, str):
        # Si c'est un ID, récupérer la facture
        try:
            invoice = stripe.Invoice.retrieve(latest_invoice)
            payment_intent_id = invoice.get("payment_intent")
        except stripe.error.StripeError:
            pass

    if not payment_intent_id:
        raise HTTPException(
            status_code=400,
            detail="Aucun paiement trouvé à rembourser (période d'essai en cours ?)",
        )

    try:
        # Créer le remboursement Stripe
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            reason="requested_by_customer",
        )

        # Annuler l'abonnement immédiatement
        stripe.Subscription.cancel(current_user.stripe_subscription_id)

        old_plan = current_user.plan
        current_user.plan = "free"
        current_user.stripe_subscription_id = None

        # Enregistrer la transaction
        transaction = CreditTransaction(
            user_id=current_user.id,
            amount=0,
            balance_after=current_user.credits or 0,
            transaction_type="refund",
            type="refund",
            stripe_payment_id=payment_intent_id,
            description=f"Refund: {old_plan} (day {days_since_creation}/14). Reason: {request.reason or 'N/A'}",
        )
        session.add(transaction)

        # Log admin pour traçabilité
        admin_log = AdminLog(
            admin_id=current_user.id,
            action="refund_requested",
            target_user_id=current_user.id,
            details=(
                f"Self-service refund: {old_plan} plan, "
                f"day {days_since_creation}/14, "
                f"refund_id={refund.id}, "
                f"payment_intent={payment_intent_id}, "
                f"reason={request.reason or 'N/A'}"
            ),
        )
        session.add(admin_log)

        await session.commit()

        logger.info(
            f"Refund processed for user {current_user.id}: "
            f"plan={old_plan}, refund_id={refund.id}, day={days_since_creation}"
        )

        return {
            "success": True,
            "message": "Remboursement effectué avec succès. Votre abonnement a été annulé.",
            "refund_id": refund.id,
            "old_plan": old_plan,
            "amount_refunded": refund.amount,
            "currency": refund.currency,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe refund error for user {current_user.id}: {e}")
        raise HTTPException(status_code=400, detail=f"Erreur lors du remboursement: {str(e)}")


@router.get("/subscription-status")
async def get_subscription_status(current_user: User = Depends(get_current_user)):
    """
    📊 Retourne le statut détaillé de l'abonnement.
    """
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    result = {
        "plan": current_user.plan or "free",
        "has_subscription": bool(current_user.stripe_subscription_id),
        "status": "none",
        "cancel_at_period_end": False,
        "current_period_end": None,
        "next_plan": None,
    }

    if current_user.stripe_subscription_id:
        try:
            subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
            result["status"] = subscription.status
            result["cancel_at_period_end"] = subscription.cancel_at_period_end
            result["current_period_end"] = datetime.fromtimestamp(subscription.current_period_end).isoformat()

            # Vérifier si un changement de plan est programmé
            if subscription.get("schedule"):
                schedule = stripe.SubscriptionSchedule.retrieve(subscription.schedule)
                phases = schedule.get("phases", [])
                if len(phases) > 1:
                    next_phase = phases[1]
                    next_price_id = next_phase["items"][0]["price"]
                    # Trouver le plan correspondant
                    for plan_name, plan_config in STRIPE_CONFIG["PRICES"].items():
                        if plan_config.get("live") == next_price_id or plan_config.get("test") == next_price_id:
                            result["next_plan"] = plan_name
                            break

        except stripe.error.StripeError as e:
            logger.warning(f"Error fetching subscription: {e}")

    return result


@router.get("/transactions")
async def get_transactions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Retourne l'historique des transactions de l'utilisateur"""
    result = await session.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(50)
    )
    transactions = result.scalars().all()

    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "balance_after": t.balance_after,
                "type": t.transaction_type or t.type,
                "description": t.description,
                "created_at": t.created_at,
            }
            for t in transactions
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔔 WEBHOOK STRIPE
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    """
    Webhook Stripe pour gérer les événements de paiement.
    IMPORTANT: Le body doit être lu en RAW pour la vérification de signature.
    """
    logger.info("Webhook endpoint hit!")

    if not init_stripe():
        logger.error("Stripe not initialized")
        raise HTTPException(status_code=500, detail="Stripe not configured")

    webhook_secret = STRIPE_CONFIG.get("WEBHOOK_SECRET")
    if not webhook_secret:
        logger.error("Webhook secret not configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    # Lire le header de signature (plusieurs méthodes car FastAPI est capricieux)
    stripe_signature = request.headers.get("stripe-signature") or request.headers.get("Stripe-Signature")
    if not stripe_signature:
        logger.error("No stripe-signature header found")
        logger.info(f"Available headers: {dict(request.headers)}")
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    logger.info(f"Signature received: {stripe_signature[:50]}...")

    # Lire le body RAW (obligatoire pour la signature)
    payload = await request.body()
    logger.info(f"Payload size: {len(payload)} bytes")

    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=stripe_signature, secret=webhook_secret)
        logger.info("Signature verified successfully")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Signature verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    event_id = event.get("id", "")
    event_type = event["type"]
    data = event["data"]["object"]

    # Idempotency: skip already-processed events
    if _processed_events.seen(event_id):
        logger.info(f"Webhook {event_id} already processed — skipping")
        return {"received": True, "duplicate": True}

    logger.info(f"Stripe webhook: {event_type} (id={event_id})")

    # Dispatch by event type
    if event_type == "checkout.session.completed":
        await handle_checkout_completed(session, data)

    elif event_type == "customer.subscription.created":
        await handle_subscription_created(session, data)

    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(session, data)

    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(session, data)

    elif event_type == "customer.subscription.trial_will_end":
        await handle_trial_will_end(session, data)

    elif event_type in ("invoice.paid", "invoice.payment_succeeded"):
        await handle_invoice_paid(session, data)

    elif event_type == "invoice.payment_failed":
        await handle_payment_failed(session, data)

    else:
        logger.info(f"Unhandled webhook event type: {event_type}")

    _processed_events.mark(event_id)
    return {"received": True}


# Route de test pour vérifier que l'endpoint est accessible
@router.get("/webhook-test")
async def webhook_test():
    """Test endpoint to verify webhook route is accessible"""
    webhook_secret = STRIPE_CONFIG.get("WEBHOOK_SECRET")
    return {
        "status": "ok",
        "webhook_secret_configured": bool(webhook_secret),
        "stripe_configured": bool(get_stripe_key()),
    }


@router.get("/health")
async def stripe_health():
    """Verify Stripe API connection is working."""
    if not init_stripe():
        return {
            "status": "error",
            "detail": "Stripe not configured",
            "connected": False,
        }
    try:
        account = stripe.Account.retrieve()
        return {
            "status": "ok",
            "connected": True,
            "account_id": account.get("id", ""),
            "livemode": account.get("charges_enabled", False),
            "test_mode": STRIPE_CONFIG.get("TEST_MODE", False),
            "webhook_configured": bool(STRIPE_CONFIG.get("WEBHOOK_SECRET")),
        }
    except stripe.error.AuthenticationError:
        return {
            "status": "error",
            "detail": "Invalid Stripe API key",
            "connected": False,
        }
    except stripe.error.StripeError as e:
        return {"status": "error", "detail": str(e), "connected": False}


async def handle_checkout_completed(session: AsyncSession, data: dict):
    """Gère la complétion d'un checkout"""
    metadata = data.get("metadata", {})

    # 🎯 Attribution channel — log AVANT le routing voice/credit/subscription
    # pour avoir un signal cohérent peu importe le type de paiement.
    # Source : Session.metadata propagé depuis create_checkout_by_plan_id.
    # Pour les voice packs / credit packs, le helper get_or_create_stripe_customer
    # n'est pas appelé avec un canal côté inline (legacy) → "direct" par défaut.
    acquisition_channel = metadata.get("acquisition_channel", "direct")
    customer_id = data.get("customer")
    logger.info(
        "ATTRIBUTION checkout.completed channel=%s customer=%s session=%s kind=%s",
        acquisition_channel,
        customer_id,
        data.get("id"),
        metadata.get("kind") or metadata.get("type") or "subscription",
    )

    # ── Voice pack top-up (NEW system, migration 011) ─────────────────
    # Prioritized BEFORE legacy voice_addon so the new flow always wins
    # if both flags are present (defensive: should never happen in practice).
    if metadata.get("kind") == "voice_pack":
        await _handle_voice_pack_checkout(session, data, metadata)
        return

    # ── Voice addon (LEGACY one-time payment, voice_bonus_seconds) ────
    if metadata.get("type") == "voice_addon":
        await _handle_voice_addon_checkout(session, data, metadata)
        return

    # ── Credit pack (one-time payment) ────────────────────────────────
    if metadata.get("type") == "credit_pack":
        await _handle_credit_pack_checkout(session, data, metadata)
        return

    user_id = metadata.get("user_id")
    plan = metadata.get("plan")
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")

    # Fallback: résoudre le plan via price_id si absent des metadata
    if not plan and subscription_id:
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            items = sub.get("items", {}).get("data", [])
            if items:
                price_id = items[0].get("price", {}).get("id")
                plan = plan_by_price_id(price_id)
                logger.info("Resolved plan from price_id: %s -> %s", price_id, plan)
        except Exception as e:
            logger.warning("Could not resolve plan from subscription: %s", e)

    logger.info("Checkout data: user_id=%s plan=%s customer=%s", user_id, plan, customer_id)

    if not user_id or not plan:
        logger.warning("Checkout without user_id or plan")
        return

    result = await session.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("User %s not found", user_id)
        return

    # DB-level idempotency: check if this payment was already processed
    payment_id = data.get("payment_intent") or data.get("id")
    if payment_id:
        existing = await session.execute(
            select(CreditTransaction).where(CreditTransaction.stripe_payment_id == payment_id)
        )
        if existing.scalar_one_or_none():
            logger.info("Checkout %s already processed — skipping", payment_id)
            return

    # Crédits depuis plan_config — source de vérité unique
    credits_to_add = get_limits(plan).get("monthly_credits", 0)

    user.plan = plan
    user.credits = (user.credits or 0) + credits_to_add
    user.stripe_customer_id = customer_id
    user.stripe_subscription_id = subscription_id

    transaction = CreditTransaction(
        user_id=user.id,
        amount=credits_to_add,
        balance_after=user.credits,
        transaction_type="purchase",
        type="purchase",
        stripe_payment_id=payment_id,
        description=f"Subscription: {plan}",
    )
    session.add(transaction)

    await session.commit()
    logger.info("User %s upgraded to %s, +%d credits", user_id, plan, credits_to_add)

    # 🎯 Audit log RGPD — channel d'acquisition pour cohorte launch
    try:
        await log_audit(
            session,
            action="payment.completed",
            user_id=user.id,
            details={
                "plan": plan,
                "channel": acquisition_channel,
                "stripe_session_id": data.get("id"),
                "subscription_id": subscription_id,
                "amount_cents": data.get("amount_total") or 0,
                "currency": data.get("currency", "eur"),
            },
        )
        await session.commit()
    except Exception as e:
        logger.info("audit_log payment.completed failed: %s", e)

    # 🎯 PostHog event server-side (best-effort, non-bloquant).
    # Le service est créé par le sub-agent P PostHog dans une PR concurrente.
    # try/except ImportError → no-op si pas encore mergé.
    try:
        from services.posthog_service import capture_event  # type: ignore
        await capture_event(
            distinct_id=str(user.id),
            event="payment_completed",
            properties={
                "plan": plan,
                "acquisition_channel": acquisition_channel,
                "stripe_customer_id": customer_id,
                "amount_cents": data.get("amount_total") or 0,
                "currency": data.get("currency", "eur"),
            },
        )
    except ImportError:
        # posthog_service pas encore mergé (sub-agent P PR). Silencieux.
        pass
    except Exception as e:
        logger.info("PostHog payment_completed capture failed: %s", e)

    # 📧 Send payment success email
    try:
        from services.email_service import email_service

        await email_service.send_payment_success(
            to=user.email,
            username=user.username,
            plan=plan,
            credits=credits_to_add,
        )
    except Exception as e:
        logger.info(f"📧 Payment success email error: {e}")


async def _handle_voice_addon_checkout(session: AsyncSession, data: dict, metadata: dict):
    """Handle a completed voice add-on one-time payment."""
    minutes = int(metadata.get("minutes", 0))
    user_id_str = metadata.get("user_id", "0")
    pack_id = metadata.get("pack_id", "unknown")

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        logger.warning("Voice addon: invalid user_id in metadata: %s", user_id_str)
        return

    if minutes <= 0 or user_id <= 0:
        logger.warning("Voice addon: invalid minutes=%s or user_id=%s", minutes, user_id)
        return

    # DB-level idempotency: check if this payment was already processed
    payment_id = data.get("payment_intent") or data.get("id")
    if payment_id:
        existing = await session.execute(
            select(CreditTransaction).where(CreditTransaction.stripe_payment_id == payment_id)
        )
        if existing.scalar_one_or_none():
            logger.info("Voice addon checkout %s already processed — skipping", payment_id)
            return

    user = await session.get(User, user_id)
    if not user:
        logger.warning("Voice addon: user %s not found", user_id)
        return

    # Add bonus voice seconds
    user.voice_bonus_seconds = (user.voice_bonus_seconds or 0) + (minutes * 60)

    # Record transaction for idempotency + audit trail
    transaction = CreditTransaction(
        user_id=user.id,
        amount=0,
        balance_after=user.credits or 0,
        transaction_type="voice_addon",
        type="voice_addon",
        stripe_payment_id=payment_id,
        description=f"Voice pack: {pack_id} (+{minutes}min)",
    )
    session.add(transaction)

    await session.commit()
    logger.info(
        "Voice addon: +%dmin for user %s (pack=%s, total_bonus=%ds)",
        minutes,
        user_id,
        pack_id,
        user.voice_bonus_seconds,
    )


async def _handle_voice_pack_checkout(session: AsyncSession, data: dict, metadata: dict):
    """Handle a completed voice pack one-shot payment (NEW system, migration 011).

    Idempotent : checks ``voice_credit_purchases.stripe_session_id`` before
    crediting. Wraps the credit + purchase row insert in a single transaction
    so a crash mid-handler can never leave purchased_minutes credited without
    a corresponding history row (and vice versa).
    """
    from billing.voice_packs_service import add_purchased_minutes

    session_id = data.get("id")
    payment_intent = data.get("payment_intent")
    user_id_str = metadata.get("user_id", "0")
    pack_id_str = metadata.get("pack_id", "0")
    minutes_str = metadata.get("minutes", "0")
    pack_slug = metadata.get("pack_slug", "unknown")

    try:
        user_id = int(user_id_str)
        pack_id = int(pack_id_str)
        minutes = int(minutes_str)
    except (ValueError, TypeError):
        logger.warning(
            "Voice pack: invalid metadata user_id=%s pack_id=%s minutes=%s",
            user_id_str, pack_id_str, minutes_str,
        )
        return

    if user_id <= 0 or pack_id <= 0 or minutes <= 0:
        logger.warning(
            "Voice pack: invalid values user_id=%s pack_id=%s minutes=%s",
            user_id, pack_id, minutes,
        )
        return

    # Idempotency: skip if this session_id already recorded
    if session_id:
        existing = await session.execute(
            select(VoiceCreditPurchase).where(
                VoiceCreditPurchase.stripe_session_id == session_id
            )
        )
        if existing.scalar_one_or_none():
            logger.info("Voice pack checkout %s already processed — skipping", session_id)
            return

    user = await session.get(User, user_id)
    if not user:
        logger.warning("Voice pack: user %s not found", user_id)
        return

    pack = await session.get(VoiceCreditPack, pack_id)
    if not pack:
        logger.warning("Voice pack: pack %s not found", pack_id)
        return

    # Credit + record in single transaction
    await add_purchased_minutes(user_id, float(minutes), session)

    purchase = VoiceCreditPurchase(
        user_id=user_id,
        pack_id=pack_id,
        minutes_purchased=minutes,
        price_paid_cents=int(data.get("amount_total") or pack.price_cents),
        stripe_session_id=session_id,
        stripe_payment_intent_id=payment_intent,
        status="completed",
        completed_at=datetime.now(timezone.utc),
    )
    session.add(purchase)

    await session.commit()
    logger.info(
        "Voice pack credited: +%dmin user=%d slug=%s session=%s",
        minutes, user_id, pack_slug, session_id,
    )


async def handle_subscription_created(session: AsyncSession, data: dict):
    """Gère la création d'un abonnement"""
    customer_id = data.get("customer")
    subscription_id = data.get("id")

    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()

    if user:
        user.stripe_subscription_id = subscription_id
        await session.commit()


async def handle_subscription_updated(session: AsyncSession, data: dict):
    """Gère la mise à jour d'un abonnement (upgrade/downgrade)"""
    customer_id = data.get("customer")
    status = data.get("status")
    cancel_at_period_end = data.get("cancel_at_period_end", False)

    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"User not found for customer {customer_id}")
        return

    # Récupérer le nouveau price_id
    items = data.get("items", {}).get("data", [])
    if items:
        new_price_id = items[0].get("price", {}).get("id")

        # Trouver le plan correspondant — SSOT plan_config d'abord, ancien fallback ensuite
        new_plan = plan_by_price_id(new_price_id) if new_price_id else None
        if not new_plan:
            for plan_name, plan_config in STRIPE_CONFIG.get("PRICES", {}).items():
                if plan_config.get("live") == new_price_id or plan_config.get("test") == new_price_id:
                    new_plan = plan_name
                    break

        if new_plan and new_plan != user.plan:
            old_plan = user.plan
            user.plan = new_plan

            # Calculer la différence de crédits (plan_config — source de vérité)
            old_credits = get_limits(old_plan).get("monthly_credits", 0)
            new_credits = get_limits(new_plan).get("monthly_credits", 0)

            if new_credits > old_credits:
                # Upgrade: ajouter la différence de crédits
                credits_bonus = new_credits - old_credits
                user.credits = (user.credits or 0) + credits_bonus

                transaction = CreditTransaction(
                    user_id=user.id,
                    amount=credits_bonus,
                    balance_after=user.credits,
                    transaction_type="upgrade",
                    type="upgrade",
                    description=f"Upgrade: {old_plan} → {new_plan}",
                )
                session.add(transaction)
                logger.info(f"User {user.id} upgraded from {old_plan} to {new_plan}, +{credits_bonus} credits")
            else:
                logger.info(f"User {user.id} downgraded from {old_plan} to {new_plan}")

            await session.commit()

    if status == "canceled" or cancel_at_period_end:
        logger.warning(f"Subscription will be canceled for user {user.id}")


async def handle_subscription_deleted(session: AsyncSession, data: dict):
    """Gère la suppression d'un abonnement"""
    customer_id = data.get("customer")

    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()

    if user:
        old_plan = user.plan
        user.plan = "free"
        user.stripe_subscription_id = None
        await session.commit()
        logger.info(f"User {user.id} subscription deleted, reverted to free (was {old_plan})")

        try:
            from services.email_service import email_service

            await email_service.send_payment_failed(
                to=user.email,
                username=user.username,
                plan=old_plan or "free",
            )
        except Exception as e:
            logger.info(f"Subscription deleted email error: {e}")


async def handle_invoice_paid(session: AsyncSession, data: dict):
    """Gère le paiement réussi d'une facture (renouvellement)"""
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")

    if not subscription_id:
        return

    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()

    if user and user.plan != "free":
        # DB-level idempotency
        payment_id = data.get("payment_intent") or data.get("id")
        if payment_id:
            existing = await session.execute(
                select(CreditTransaction).where(CreditTransaction.stripe_payment_id == payment_id)
            )
            if existing.scalar_one_or_none():
                logger.info(f"Invoice {payment_id} already processed — skipping")
                return

        # Crédits depuis plan_config — source de vérité unique
        credits_to_add = get_limits(user.plan).get("monthly_credits", 0)

        user.credits = (user.credits or 0) + credits_to_add

        transaction = CreditTransaction(
            user_id=user.id,
            amount=credits_to_add,
            balance_after=user.credits,
            transaction_type="renewal",
            type="renewal",
            stripe_payment_id=payment_id,
            description=f"Monthly renewal: {user.plan}",
        )
        session.add(transaction)

        await session.commit()
        logger.info(f"User {user.id} renewed, +{credits_to_add} credits")

        # 📧 Send renewal success email
        try:
            from services.email_service import email_service

            await email_service.send_payment_success(
                to=user.email,
                username=user.username,
                plan=user.plan,
                credits=credits_to_add,
            )
        except Exception as e:
            logger.info(f"📧 Renewal email error: {e}")


async def handle_payment_failed(session: AsyncSession, data: dict):
    """Gère l'échec d'un paiement"""
    customer_id = data.get("customer")

    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()

    if user:
        logger.warning(f"Payment failed for user {user.id}")

        # 📧 Send payment failure email
        try:
            from services.email_service import email_service

            await email_service.send_payment_failed(
                to=user.email,
                username=user.username,
                plan=user.plan or "free",
            )
        except Exception as e:
            logger.info(f"📧 Payment failed email error: {e}")


async def handle_trial_will_end(session: AsyncSession, data: dict):
    """
    Gère l'événement trial_will_end (3 jours avant la fin de l'essai).
    Envoie un email de rappel à l'utilisateur.
    """
    customer_id = data.get("customer")
    trial_end = data.get("trial_end")

    if not customer_id:
        logger.warning("trial_will_end: no customer_id")
        return

    result = await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"trial_will_end: user not found for customer {customer_id}")
        return

    trial_end_date = datetime.fromtimestamp(trial_end, tz=timezone.utc) if trial_end else None
    formatted_date = trial_end_date.strftime("%d/%m/%Y") if trial_end_date else "bientôt"

    logger.info(f"Trial ending for user {user.id} ({user.email}) on {formatted_date}")

    try:
        from services.email_service import email_service

        await email_service.send_trial_ending_reminder(
            to=user.email,
            username=user.username,
            trial_end_date=formatted_date,
            plan=user.plan or "plus",
        )
        logger.info(f"Trial ending reminder sent to {user.email}")
    except Exception as e:
        # L'email est optionnel — ne pas bloquer le webhook
        logger.info(f"Trial ending email error (non-blocking): {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 💳 CREDIT PACKS — Achats a la carte (one-time Stripe payments)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/credits/packs")
async def list_credit_packs_endpoint():
    """Liste les packs de credits disponibles a l'achat."""
    from billing.plan_config import list_credit_packs

    return {"packs": list_credit_packs()}


class CreditPackRequest(BaseModel):
    pack_id: str


@router.post("/credits/checkout")
async def create_credit_pack_checkout(
    request: CreditPackRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cree une session Stripe pour acheter un pack de credits."""
    from billing.plan_config import get_credit_pack

    pack = get_credit_pack(request.pack_id)
    if not pack:
        raise HTTPException(400, "Pack de credits invalide")

    stripe_key = get_stripe_key()
    if not stripe_key:
        raise HTTPException(503, "Stripe not configured")

    stripe.api_key = stripe_key

    # Create or reuse Stripe customer (revalidate if stale)
    customer_id = current_user.stripe_customer_id
    if customer_id:
        try:
            stripe.Customer.retrieve(customer_id)
        except stripe.error.InvalidRequestError:
            customer_id = None
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        await session.commit()

    checkout_session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="payment",
        payment_method_types=["card"],
        # Stripe Tax (TVA EU / VAT MOSS) — env-driven, see RUNBOOK §9.
        automatic_tax={"enabled": STRIPE_AUTOMATIC_TAX_ENABLED},
        line_items=[
            {
                "price_data": {
                    "currency": "eur",
                    "unit_amount": pack["price_cents"],
                    "product_data": {
                        "name": f"{pack['name']} — {pack['credits']} credits",
                        "description": pack["description"],
                    },
                },
                "quantity": 1,
            }
        ],
        metadata={
            "type": "credit_pack",
            "user_id": str(current_user.id),
            "pack_id": request.pack_id,
            "credits": str(pack["credits"]),
        },
        success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&type=credits&pack={request.pack_id}",
        cancel_url=f"{FRONTEND_URL}/upgrade",
    )

    return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}


async def _handle_credit_pack_checkout(session: AsyncSession, data: dict, metadata: dict):
    """Handle a completed credit pack one-time payment."""
    credits = int(metadata.get("credits", 0))
    user_id_str = metadata.get("user_id", "0")
    pack_id = metadata.get("pack_id", "unknown")

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        logger.warning("Credit pack: invalid user_id in metadata: %s", user_id_str)
        return

    if credits <= 0 or user_id <= 0:
        logger.warning("Credit pack: invalid credits=%s or user_id=%s", credits, user_id)
        return

    # DB-level idempotency
    payment_id = data.get("payment_intent") or data.get("id")
    if payment_id:
        existing = await session.execute(
            select(CreditTransaction).where(CreditTransaction.stripe_payment_id == payment_id)
        )
        if existing.scalar_one_or_none():
            logger.info("Credit pack checkout %s already processed — skipping", payment_id)
            return

    user = await session.get(User, user_id)
    if not user:
        logger.warning("Credit pack: user %s not found", user_id)
        return

    # Add credits
    user.credits = (user.credits or 0) + credits

    # Record transaction
    transaction = CreditTransaction(
        user_id=user.id,
        amount=credits,
        balance_after=user.credits,
        transaction_type="credit_pack",
        type="credit_pack",
        stripe_payment_id=payment_id,
        description=f"Credit pack: {pack_id} (+{credits} credits)",
    )
    session.add(transaction)

    await session.commit()
    logger.info(
        "Credit pack: +%d credits for user %s (pack=%s, balance=%d)",
        credits,
        user_id,
        pack_id,
        user.credits,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 API KEY MANAGEMENT — Endpoints pour le plan Expert
# ═══════════════════════════════════════════════════════════════════════════════

import secrets
import hashlib


def generate_api_key() -> str:
    """Génère une nouvelle API key sécurisée"""
    random_part = secrets.token_hex(24)
    return f"ds_live_{random_part}"


def hash_api_key(api_key: str) -> str:
    """Hash une API key pour stockage sécurisé"""
    return hashlib.sha256(api_key.encode()).hexdigest()


class ApiKeyResponse(BaseModel):
    """Réponse avec la clé API"""

    api_key: str
    created_at: datetime
    message: str


class ApiKeyStatusResponse(BaseModel):
    """Status de la clé API"""

    has_api_key: bool
    created_at: Optional[datetime]
    last_used: Optional[datetime]
    plan_eligible: bool
    current_plan: str


@router.get("/api-key/status", response_model=ApiKeyStatusResponse)
async def get_api_key_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🔑 Vérifier le status de la clé API de l'utilisateur.
    Disponible uniquement pour le plan Pro.
    """
    # API keys are Pro-only
    plan_eligible = current_user.plan == "pro"

    return ApiKeyStatusResponse(
        has_api_key=bool(current_user.api_key_hash),
        created_at=current_user.api_key_created_at,
        last_used=current_user.api_key_last_used,
        plan_eligible=plan_eligible,
        current_plan=current_user.plan or "free",
    )


@router.post("/api-key/generate", response_model=ApiKeyResponse)
async def generate_user_api_key(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🔑 Générer une nouvelle clé API pour l'utilisateur.

    ⚠️ IMPORTANT: La clé complète n'est affichée QU'UNE SEULE FOIS.
    Sauvegardez-la immédiatement car elle ne pourra plus être récupérée.

    Disponible pour les plans Pro et Expert (admin bypass).
    """
    # Pro ET Expert ont accès à l'API publique. Admin bypass.
    if not (current_user.is_admin or current_user.plan in ("pro", "expert")):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "plan_required",
                "message": "API access requires Pro or Expert plan. Upgrade at /upgrade",
                "current_plan": current_user.plan,
                "required_plans": ["pro", "expert"],
            },
        )

    # Vérifier si une clé existe déjà
    if current_user.api_key_hash:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "api_key_exists",
                "message": "An API key already exists. Use /api-key/regenerate to create a new one.",
            },
        )

    # Générer la nouvelle clé
    new_api_key = generate_api_key()
    key_hash = hash_api_key(new_api_key)
    now = datetime.utcnow()

    # Sauvegarder le hash (pas la clé en clair!)
    current_user.api_key_hash = key_hash
    current_user.api_key_created_at = now
    await session.commit()

    logger.info(f"API key generated for user {current_user.id}")

    return ApiKeyResponse(
        api_key=new_api_key,
        created_at=now,
        message="⚠️ IMPORTANT: Save this key now! It will NOT be shown again.",
    )


@router.post("/api-key/regenerate", response_model=ApiKeyResponse)
async def regenerate_user_api_key(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🔄 Régénérer la clé API (révoque l'ancienne).

    ⚠️ ATTENTION: L'ancienne clé sera immédiatement invalidée.
    Toutes les applications utilisant l'ancienne clé cesseront de fonctionner.

    Disponible pour les plans Pro et Expert (admin bypass).
    """
    # Pro ET Expert ont accès à l'API publique. Admin bypass.
    if not (current_user.is_admin or current_user.plan in ("pro", "expert")):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "plan_required",
                "message": "API access requires Pro or Expert plan.",
                "current_plan": current_user.plan,
                "required_plans": ["pro", "expert"],
            },
        )

    # Générer la nouvelle clé
    new_api_key = generate_api_key()
    key_hash = hash_api_key(new_api_key)
    now = datetime.utcnow()

    # Remplacer l'ancienne clé
    old_existed = bool(current_user.api_key_hash)
    current_user.api_key_hash = key_hash
    current_user.api_key_created_at = now
    current_user.api_key_last_used = None  # Reset last used
    await session.commit()

    action = "regenerated" if old_existed else "generated"
    logger.info(f"API key {action} for user {current_user.id}")

    return ApiKeyResponse(
        api_key=new_api_key,
        created_at=now,
        message="⚠️ Old key revoked. Save this new key now! It will NOT be shown again.",
    )


@router.delete("/api-key")
async def revoke_api_key(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🗑️ Révoquer définitivement la clé API.

    La clé sera immédiatement invalidée et ne pourra plus être utilisée.
    """
    if not current_user.api_key_hash:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "no_api_key",
                "message": "No API key exists for this account.",
            },
        )

    # Supprimer la clé
    current_user.api_key_hash = None
    current_user.api_key_created_at = None
    current_user.api_key_last_used = None
    await session.commit()

    logger.info(f"API key revoked for user {current_user.id}")

    return {"success": True, "message": "API key has been revoked successfully."}
