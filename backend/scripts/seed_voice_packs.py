"""Seed idempotent des packs voice + Stripe Products/Prices.

Usage:
    cd backend && STRIPE_SECRET_KEY=sk_test_xxx python scripts/seed_voice_packs.py

Comportement:
  * Pour chaque pack du catalogue, si DB row absente : insère.
  * Si STRIPE_SECRET_KEY actif et pack n'a pas de stripe_price_id : crée
    Stripe Product + Price puis update la row DB.
  * Re-runs successifs : no-op (UPSERT par slug).

À lancer après chaque migration sur tous les environnements.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Ensure backend/src on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import stripe  # noqa: E402  (imports must follow sys.path adjust)
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from db.database import VoiceCreditPack, DATABASE_URL  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_voice_packs")


CATALOG = [
    {
        "slug": "voice-30",
        "name": "Pack 30 minutes",
        "minutes": 30,
        "price_cents": 299,
        "description": "30 minutes de chat vocal IA — n'expirent jamais",
        "display_order": 1,
    },
    {
        "slug": "voice-60",
        "name": "Pack 60 minutes",
        "minutes": 60,
        "price_cents": 499,
        "description": "60 minutes de chat vocal IA — meilleur rapport quantité",
        "display_order": 2,
    },
    {
        "slug": "voice-180",
        "name": "Pack 180 minutes",
        "minutes": 180,
        "price_cents": 1299,
        "description": "180 minutes de chat vocal IA — power users",
        "display_order": 3,
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL or "sqlite+aiosqlite:///./data/deepsight_users.db", future=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if stripe_key:
        stripe.api_key = stripe_key
        logger.info("Stripe API enabled — will create Products/Prices if missing")
    else:
        logger.warning("STRIPE_SECRET_KEY not set — DB-only seed (no Stripe sync)")

    async with Session() as db:
        for cat in CATALOG:
            existing = await db.execute(
                select(VoiceCreditPack).where(VoiceCreditPack.slug == cat["slug"])
            )
            pack = existing.scalar_one_or_none()

            if pack is None:
                pack = VoiceCreditPack(**cat)
                db.add(pack)
                await db.flush()
                logger.info(
                    "DB inserted: %s (%dmin / %d¢)",
                    pack.slug, pack.minutes, pack.price_cents,
                )
            else:
                logger.info("DB exists: %s — skipping insert", pack.slug)

            if stripe_key and not pack.stripe_price_id:
                product = stripe.Product.create(
                    name=f"DeepSight Voice — {pack.name}",
                    description=pack.description,
                    metadata={"slug": pack.slug, "minutes": str(pack.minutes)},
                )
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=pack.price_cents,
                    currency="eur",
                    metadata={"slug": pack.slug},
                )
                pack.stripe_product_id = product.id
                pack.stripe_price_id = price.id
                logger.info(
                    "Stripe synced: %s → product=%s price=%s",
                    pack.slug, product.id, price.id,
                )

        await db.commit()
        logger.info("Seed complete — %d packs in catalog", len(CATALOG))

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
