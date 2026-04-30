"""Idempotent Stripe Products + Prices seeder for Pricing v2.

Usage :
    cd backend && STRIPE_TEST_MODE=true  python scripts/seed_stripe_prices_v2.py
    cd backend && STRIPE_TEST_MODE=false python scripts/seed_stripe_prices_v2.py

Crée (si absents via lookup_key) :
  - 2 Products :  prod_deepsight_pro / prod_deepsight_expert
  - 4 Prices  :  pro_monthly / pro_yearly / expert_monthly / expert_yearly

Output : copie/colle les 4 Price IDs à mettre dans .env.production
(STRIPE_PRICE_{PRO,EXPERT}_{MONTHLY,YEARLY}_{TEST,LIVE}).

Idempotent : re-exécutable à volonté, ne duplique jamais.
"""
from __future__ import annotations

import os
import sys

import stripe

# Ajouter src/ au path pour importer les helpers config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from core.config import get_stripe_key  # noqa: E402


SEED_SPEC = [
    # (product_lookup_key, product_name, price_lookup_key, amount_cents, interval)
    ("prod_deepsight_pro",    "DeepSight Pro",    "pro_monthly",       899,   "month"),
    ("prod_deepsight_pro",    "DeepSight Pro",    "pro_yearly",        8990,  "year"),
    ("prod_deepsight_expert", "DeepSight Expert", "expert_monthly",    1999,  "month"),
    ("prod_deepsight_expert", "DeepSight Expert", "expert_yearly",     19990, "year"),
]


def get_or_create_product(lookup_key: str, name: str) -> "stripe.Product":
    """Retrieve product by metadata.lookup_key or create it."""
    products = stripe.Product.search(query=f"metadata['lookup_key']:'{lookup_key}'")
    if products.data:
        print(f"  [exists] Product: {lookup_key} ({products.data[0].id})")
        return products.data[0]
    p = stripe.Product.create(
        name=name,
        metadata={"lookup_key": lookup_key, "managed_by": "seed_stripe_prices_v2"},
    )
    print(f"  [created] Product: {lookup_key} ({p.id})")
    return p


def get_or_create_price(
    product_id: str,
    lookup_key: str,
    amount_cents: int,
    interval: str,
) -> "stripe.Price":
    """Retrieve price by lookup_key or create it.

    Stripe natively supports ``lookup_key`` on Price → idempotence facile.
    """
    existing = stripe.Price.list(lookup_keys=[lookup_key], limit=1)
    if existing.data:
        print(f"  [exists] Price: {lookup_key} ({existing.data[0].id})")
        return existing.data[0]
    price = stripe.Price.create(
        product=product_id,
        unit_amount=amount_cents,
        currency="eur",
        recurring={"interval": interval},
        lookup_key=lookup_key,
        metadata={"managed_by": "seed_stripe_prices_v2"},
    )
    print(
        f"  [created] Price: {lookup_key} ({price.id}) "
        f"-- {amount_cents/100:.2f} EUR / {interval}"
    )
    return price


def main() -> int:
    api_key = get_stripe_key()
    if not api_key:
        print(
            "ERROR: no Stripe key configured (check STRIPE_SECRET_KEY_TEST/LIVE)",
            file=sys.stderr,
        )
        return 1
    stripe.api_key = api_key
    test_mode = os.environ.get("STRIPE_TEST_MODE", "true").lower() == "true"
    print(f"Stripe seed v2 -- mode={'TEST' if test_mode else 'LIVE'}")

    out: dict[str, str] = {}
    for product_lookup, product_name, price_lookup, amount, interval in SEED_SPEC:
        product = get_or_create_product(product_lookup, product_name)
        price = get_or_create_price(product.id, price_lookup, amount, interval)
        out[price_lookup] = price.id

    suffix = "TEST" if test_mode else "LIVE"
    print("\n" + "=" * 70)
    print(f"# Add to .env.production ({suffix} keys):")
    print("=" * 70)
    print(f"STRIPE_PRICE_PRO_MONTHLY_{suffix}={out['pro_monthly']}")
    print(f"STRIPE_PRICE_PRO_YEARLY_{suffix}={out['pro_yearly']}")
    print(f"STRIPE_PRICE_EXPERT_MONTHLY_{suffix}={out['expert_monthly']}")
    print(f"STRIPE_PRICE_EXPERT_YEARLY_{suffix}={out['expert_yearly']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
