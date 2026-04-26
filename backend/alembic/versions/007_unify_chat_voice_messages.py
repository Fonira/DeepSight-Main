"""Unify chat + voice messages timeline (Spec #1 ElevenLabs ecosystem)

Revision ID: 007_unify_chat_voice_messages
Revises: 006_add_shared_analyses_is_active
Create Date: 2026-04-25

Foundation for cross-surface chat history (text + voice unified). Adds:
  - source           ('text' | 'voice') — DEFAULT 'text' for backward compat.
  - voice_session_id (FK voice_sessions.id ON DELETE SET NULL) — nullable.
  - voice_speaker    ('user' | 'agent') — only set for source='voice'.
  - time_in_call_secs (Float) — offset within the voice call (for ordering).

Plus 2 indexes for the unified timeline reads:
  - ix_chat_messages_summary_created  (summary_id, created_at)
  - ix_chat_messages_voice_session    (voice_session_id) WHERE NOT NULL

Plus a check constraint guaranteeing a 'voice' row always carries a session id:
  - ck_voice_requires_session: (source != 'voice') OR (voice_session_id IS NOT NULL)

Backward compatibility:
  Existing rows are filled with source='text' via server_default. The chat
  service has try/except fallback paths to handle old DBs missing the new
  columns (cf. chat/service.py save_chat_message / get_chat_history).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007_unify_chat_voice_messages"
down_revision: Union[str, None] = "006_add_shared_analyses_is_active"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    # ── New columns on chat_messages ──────────────────────────────────────
    op.add_column(
        "chat_messages",
        sa.Column(
            "source",
            sa.String(10),
            server_default="text",
            nullable=False,
        ),
    )
    if _is_postgres():
        # PostgreSQL: emit the FK inline with ADD COLUMN (atomic + cheap).
        op.add_column(
            "chat_messages",
            sa.Column(
                "voice_session_id",
                sa.String(36),
                sa.ForeignKey(
                    "voice_sessions.id",
                    name="fk_chat_messages_voice_session",
                    ondelete="SET NULL",
                ),
                nullable=True,
            ),
        )
    else:
        # SQLite cannot ALTER ADD CONSTRAINT — add the column without an FK.
        # This is fine in dev/test; PG in prod has the FK.
        op.add_column(
            "chat_messages",
            sa.Column("voice_session_id", sa.String(36), nullable=True),
        )
    op.add_column(
        "chat_messages",
        sa.Column("voice_speaker", sa.String(10), nullable=True),
    )
    op.add_column(
        "chat_messages",
        sa.Column("time_in_call_secs", sa.Float, nullable=True),
    )

    # ── Indexes ───────────────────────────────────────────────────────────
    op.create_index(
        "ix_chat_messages_summary_created",
        "chat_messages",
        ["summary_id", "created_at"],
    )

    # Partial index on voice_session_id (PG only — SQLite ignores predicate).
    if _is_postgres():
        op.create_index(
            "ix_chat_messages_voice_session",
            "chat_messages",
            ["voice_session_id"],
            postgresql_where=sa.text("voice_session_id IS NOT NULL"),
        )
    else:
        op.create_index(
            "ix_chat_messages_voice_session",
            "chat_messages",
            ["voice_session_id"],
        )

    # ── Check constraint ──────────────────────────────────────────────────
    # SQLite cannot ADD CONSTRAINT on an existing table either; skip when
    # not on Postgres — same logical contract is enforced at the app layer
    # (router.py: voice rows only inserted with a voice_session_id).
    if _is_postgres():
        op.create_check_constraint(
            "ck_voice_requires_session",
            "chat_messages",
            "(source != 'voice') OR (voice_session_id IS NOT NULL)",
        )


def downgrade() -> None:
    if _is_postgres():
        op.drop_constraint(
            "ck_voice_requires_session",
            "chat_messages",
            type_="check",
        )
    op.drop_index("ix_chat_messages_voice_session", table_name="chat_messages")
    op.drop_index("ix_chat_messages_summary_created", table_name="chat_messages")

    # Foreign key on voice_session_id must be dropped before the column on PG.
    if _is_postgres():
        op.drop_constraint(
            "fk_chat_messages_voice_session",
            "chat_messages",
            type_="foreignkey",
        )

    op.drop_column("chat_messages", "time_in_call_secs")
    op.drop_column("chat_messages", "voice_speaker")
    op.drop_column("chat_messages", "voice_session_id")
    op.drop_column("chat_messages", "source")
