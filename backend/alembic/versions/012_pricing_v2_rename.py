"""Pricing v2 — atomic plan rename (plus->pro, pro->expert) + grandfathering flag.

Revision ID: 012_pricing_v2_rename
Revises: 011_add_voice_credit_packs
Create Date: 2026-04-29

Migrations:
  1. Add ``users.is_legacy_pricing`` BOOLEAN NOT NULL DEFAULT FALSE.
  2. ATOMIC rename via CASE SQL :
       plus  -> pro
       pro   -> expert
     (sans CASE, un UPDATE sequentiel ferait passer les anciens Plus en Expert)
  3. Backfill grandfathering : tout user avec stripe_subscription_id non null
     conserve son prix Stripe legacy -> is_legacy_pricing = TRUE.

Downgrade : reverse rename (pro->plus, expert->pro) + drop colonne.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012_pricing_v2_rename"
down_revision: Union[str, None] = "011_add_voice_credit_packs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Colonne grandfathering
    op.add_column(
        "users",
        sa.Column(
            "is_legacy_pricing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # 2. Rename atomique CASE
    op.execute(
        "UPDATE users SET plan = CASE "
        "WHEN plan = 'pro' THEN 'expert' "
        "WHEN plan = 'plus' THEN 'pro' "
        "ELSE plan END "
        "WHERE plan IN ('plus', 'pro')"
    )

    # 3. Backfill grandfathering : subs actifs au moment de la migration
    op.execute(
        "UPDATE users SET is_legacy_pricing = TRUE "
        "WHERE stripe_subscription_id IS NOT NULL"
    )


def downgrade() -> None:
    # Reverse rename (expert -> pro, pro -> plus)
    op.execute(
        "UPDATE users SET plan = CASE "
        "WHEN plan = 'expert' THEN 'pro' "
        "WHEN plan = 'pro' THEN 'plus' "
        "ELSE plan END "
        "WHERE plan IN ('pro', 'expert')"
    )
    op.drop_column("users", "is_legacy_pricing")
