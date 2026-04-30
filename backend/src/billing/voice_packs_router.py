"""REST endpoints pour les packs voice top-up.

Routes:
  - GET  /api/billing/voice-packs/list             : public, catalogue actif
  - GET  /api/billing/voice-packs/my-credits       : auth, snapshot user
  - POST /api/billing/voice-packs/checkout/{slug}  : auth, crée Stripe Checkout

VC-2 (audit Kimi) : Free users get HTTP 402 Payment Required on checkout.
"""

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from core.config import FRONTEND_URL, STRIPE_CONFIG, get_stripe_key
from db.database import User, get_session
from billing.voice_packs_service import (
    list_active_packs,
    get_pack_by_slug,
    get_user_credit_status,
)
from billing.voice_quota import TOP_TIER_PLANS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing/voice-packs", tags=["voice-packs"])


# ─── Schemas ─────────────────────────────────────────────────────────────


class PackOut(BaseModel):
    slug: str
    name: str
    minutes: int
    price_cents: int
    description: str | None = None
    display_order: int


class CreditStatusOut(BaseModel):
    plan: str
    allowance_total: float
    allowance_used: float
    allowance_remaining: float
    purchased_minutes: float
    total_minutes_available: float
    is_trial: bool


class CheckoutOut(BaseModel):
    checkout_url: str
    session_id: str


# ─── Routes ──────────────────────────────────────────────────────────────


@router.get("/list", response_model=list[PackOut])
async def list_packs(db: AsyncSession = Depends(get_session)):
    """Catalogue public des packs actifs."""
    packs = await list_active_packs(db)
    return [
        PackOut(
            slug=p.slug,
            name=p.name,
            minutes=p.minutes,
            price_cents=p.price_cents,
            description=p.description,
            display_order=p.display_order,
        )
        for p in packs
    ]


@router.get("/my-credits", response_model=CreditStatusOut)
async def my_credits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Snapshot crédits voice de l'utilisateur courant."""
    status_data = await get_user_credit_status(current_user, db)
    return CreditStatusOut(plan=current_user.plan or "free", **status_data)


@router.post("/checkout/{slug}", response_model=CheckoutOut)
async def create_checkout(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Crée une Stripe Checkout Session one-shot pour le pack ``slug``.

    VC-2 : Free users (and any non-top-tier plan) reçoivent HTTP 402.
    """
    plan = (current_user.plan or "free").lower()
    if plan not in TOP_TIER_PLANS:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "upgrade_required",
                "message": "Voice packs are only available on Pro/Expert plans",
                "cta": "upgrade_pro",
            },
        )

    pack = await get_pack_by_slug(slug, db)
    if not pack or not pack.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "pack_not_found", "message": f"Unknown pack slug: {slug}"},
        )

    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "stripe_disabled", "message": "Stripe not enabled"},
        )

    stripe_key = get_stripe_key()
    if not stripe_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "stripe_not_configured", "message": "Stripe not configured"},
        )
    stripe.api_key = stripe_key

    # Reuse customer or create
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
        await db.commit()

    # Build line item — use stripe_price_id if seeded, else price_data fallback
    if pack.stripe_price_id:
        line_items = [{"price": pack.stripe_price_id, "quantity": 1}]
    else:
        line_items = [
            {
                "price_data": {
                    "currency": "eur",
                    "unit_amount": pack.price_cents,
                    "product_data": {
                        "name": f"DeepSight Voice — {pack.name}",
                        "description": pack.description
                        or f"{pack.minutes} minutes ElevenLabs",
                    },
                },
                "quantity": 1,
            }
        ]

    success_url = (
        f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
        f"&type=voice_pack&slug={slug}"
    )
    cancel_url = f"{FRONTEND_URL}/account#voice-packs"

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="payment",
            payment_method_types=["card"],
            line_items=line_items,
            automatic_tax={"enabled": True},
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "kind": "voice_pack",
                "pack_slug": slug,
                "pack_id": str(pack.id),
                "user_id": str(current_user.id),
                "minutes": str(pack.minutes),
            },
        )
    except stripe.error.StripeError as e:
        logger.error("Stripe checkout creation failed for pack=%s: %s", slug, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "stripe_error", "message": str(e)},
        )

    logger.info(
        "Voice pack checkout created — user=%d slug=%s session=%s",
        current_user.id,
        slug,
        checkout_session.id,
    )
    return CheckoutOut(
        checkout_url=checkout_session.url,
        session_id=checkout_session.id,
    )
