"""Voice quota A+D strict + streaming session columns (Quick Voice Call V1)

Revision ID: 008_voice_quota_a_d_strict
Revises: 007_unify_chat_voice_messages
Create Date: 2026-04-26

Adds the Quick Voice Call (V1) backend foundation:

  * NEW table ``voice_quota`` (singular — distinct from the legacy plural
    ``voice_quotas`` per-month seconds counter): A+D strict accounting with
    lifetime trial flag (Free 3-min one-shot) and rolling monthly minutes
    (Expert 30 min/mois).
  * NEW columns on ``voice_sessions``:
      - ``is_streaming_session`` (Boolean, default False) — marks Quick Voice
        Call sessions launched with progressive context streaming.
      - ``context_completion_pct`` (Float, nullable) — final % of transcript
        chunks delivered to the agent before session end.

The legacy ``voice_quotas`` plural table is kept untouched; the classic voice
chat quota (per-month seconds counter) continues to use it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008_voice_quota_a_d_strict"
down_revision: Union[str, None] = "007_unify_chat_voice_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New table: voice_quota (singular) ────────────────────────────────
    op.create_table(
        "voice_quota",
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column(
            "monthly_minutes_used",
            sa.Float,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "monthly_period_start",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "lifetime_trial_used",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "lifetime_trial_used_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ── New columns on voice_sessions ────────────────────────────────────
    op.add_column(
        "voice_sessions",
        sa.Column(
            "is_streaming_session",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "voice_sessions",
        sa.Column(
            "context_completion_pct",
            sa.Float,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("voice_sessions", "context_completion_pct")
    op.drop_column("voice_sessions", "is_streaming_session")
    op.drop_table("voice_quota")
