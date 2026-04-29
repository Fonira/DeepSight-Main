"""Add conversation digests (voice + chat text) for unified context recall.

Revision ID: 010_add_conversation_digests
Revises: 009_add_user_preferences_json
Create Date: 2026-04-29

Adds:
  - voice_sessions.digest_text (Text, nullable)        : 2-3 bullets résumé end-of-session
  - voice_sessions.digest_generated_at (DateTime)      : timestamp génération + idempotency guard
  - chat_text_digests (table, 1 row par bucket de 20 messages texte d'une vidéo)

Backward compat:
  - All new columns nullable / table independent → no impact on existing rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010_add_conversation_digests"
down_revision: Union[str, None] = "009_add_user_preferences_json"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "voice_sessions",
        sa.Column("digest_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "voice_sessions",
        sa.Column("digest_generated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "chat_text_digests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "summary_id",
            sa.Integer(),
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "first_message_id",
            sa.Integer(),
            sa.ForeignKey("chat_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "last_message_id",
            sa.Integer(),
            sa.ForeignKey("chat_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("digest_text", sa.Text(), nullable=False),
        sa.Column("msg_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_chat_text_digests_summary_user",
        "chat_text_digests",
        ["summary_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_text_digests_summary_user", table_name="chat_text_digests")
    op.drop_table("chat_text_digests")
    op.drop_column("voice_sessions", "digest_generated_at")
    op.drop_column("voice_sessions", "digest_text")
