"""Add voice credit packs catalog + purchases history + purchased_minutes column.

Revision ID: 011_add_voice_credit_packs
Revises: 010_add_conversation_digests
Create Date: 2026-04-29

Adds the ElevenLabs voice top-up packs system (Quick Win audit Kimi P0):
  * NEW table ``voice_credit_packs`` : catalog of buyable packs (slug, minutes,
    price_cents, Stripe product/price IDs).
  * NEW table ``voice_credit_purchases`` : history (1 row per Stripe checkout
    completion), used as idempotency key store.
  * NEW column ``voice_quota.purchased_minutes`` : non-expiring balance,
    consumed AFTER allowance plan in ``consume_voice_minutes``.

Backward compat:
  * All new tables independent → no impact on existing rows.
  * ``voice_quota.purchased_minutes`` defaults to 0 server-side → existing
    rows safe.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_add_voice_credit_packs"
down_revision: Union[str, None] = "010_add_conversation_digests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── voice_credit_packs (catalog) ─────────────────────────────────────
    op.create_table(
        "voice_credit_packs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stripe_product_id", sa.String(100), nullable=True),
        sa.Column("stripe_price_id", sa.String(100), nullable=True, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # ── voice_credit_purchases (history + idempotency) ───────────────────
    op.create_table(
        "voice_credit_purchases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "pack_id",
            sa.Integer(),
            sa.ForeignKey("voice_credit_packs.id"),
            nullable=False,
        ),
        sa.Column("minutes_purchased", sa.Integer(), nullable=False),
        sa.Column("price_paid_cents", sa.Integer(), nullable=False),
        sa.Column("stripe_session_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True, unique=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_voice_credit_purchases_user_status",
        "voice_credit_purchases",
        ["user_id", "status"],
    )

    # ── voice_quota.purchased_minutes (non-expiring balance) ─────────────
    op.add_column(
        "voice_quota",
        sa.Column(
            "purchased_minutes",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("voice_quota", "purchased_minutes")
    op.drop_index(
        "ix_voice_credit_purchases_user_status",
        table_name="voice_credit_purchases",
    )
    op.drop_table("voice_credit_purchases")
    op.drop_table("voice_credit_packs")
