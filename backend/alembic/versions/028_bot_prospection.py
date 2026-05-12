"""bot_prospection — tables pour bots prospection B2B (Telegram + Luffa)

Revision ID: 028_bot_prospection
Revises: 027_proxy_usage_daily
Create Date: 2026-05-12

Crée 3 tables :
- bot_prospect : prospects B2B identifiés par (platform, platform_user_id)
- bot_message  : historique conversation
- bot_handoff  : notifications envoyées à Maxime quand lead chaud

Convention : revision_id ≤ 32 chars.
Migration idempotente : create only if not exists.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "028_bot_prospection"
down_revision: Union[str, None] = "027_proxy_usage_daily"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "bot_prospect" not in existing_tables:
        op.create_table(
            "bot_prospect",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("platform", sa.String(16), nullable=False),
            sa.Column("platform_user_id", sa.String(64), nullable=False),
            sa.Column("platform_username", sa.String(128), nullable=True),
            sa.Column("display_name", sa.String(128), nullable=True),
            sa.Column("language_code", sa.String(8), nullable=True),
            sa.Column("lead_status", sa.String(32), nullable=False, server_default="new"),
            sa.Column("qualification_score", sa.Integer, nullable=False, server_default="0"),
            sa.Column("business_name", sa.String(256), nullable=True),
            sa.Column("business_type", sa.String(64), nullable=True),
            sa.Column("audience_size", sa.String(32), nullable=True),
            sa.Column("current_pain", sa.Text, nullable=True),
            sa.Column("interest_signals", sa.JSON, nullable=True),
            sa.Column("state", sa.String(32), nullable=False, server_default="hello"),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("last_message_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("handoff_at", sa.DateTime, nullable=True),
            sa.UniqueConstraint("platform", "platform_user_id", name="uq_bot_prospect_platform_user"),
        )
        op.create_index("ix_bot_prospect_lead_status", "bot_prospect", ["lead_status"])
        op.create_index("ix_bot_prospect_last_message_at", "bot_prospect", ["last_message_at"])

    if "bot_message" not in existing_tables:
        op.create_table(
            "bot_message",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "prospect_id",
                sa.Integer,
                sa.ForeignKey("bot_prospect.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("role", sa.String(16), nullable=False),
            sa.Column("content", sa.Text, nullable=False),
            sa.Column("platform_msg_id", sa.String(64), nullable=True),
            sa.Column("intent_detected", sa.String(64), nullable=True),
            sa.Column("tokens_used", sa.Integer, nullable=True),
            sa.Column("model", sa.String(64), nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_bot_message_prospect_id", "bot_message", ["prospect_id"])
        op.create_index("ix_bot_message_created_at", "bot_message", ["created_at"])

    if "bot_handoff" not in existing_tables:
        op.create_table(
            "bot_handoff",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "prospect_id",
                sa.Integer,
                sa.ForeignKey("bot_prospect.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("channel", sa.String(32), nullable=False),
            sa.Column("sent_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("claimed_at", sa.DateTime, nullable=True),
            sa.Column("summary", sa.Text, nullable=False),
            sa.Column("deep_link", sa.String(256), nullable=True),
            sa.Column("notification_error", sa.Text, nullable=True),
        )
        op.create_index("ix_bot_handoff_prospect_id", "bot_handoff", ["prospect_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "bot_handoff" in existing_tables:
        op.drop_index("ix_bot_handoff_prospect_id", table_name="bot_handoff")
        op.drop_table("bot_handoff")

    if "bot_message" in existing_tables:
        op.drop_index("ix_bot_message_created_at", table_name="bot_message")
        op.drop_index("ix_bot_message_prospect_id", table_name="bot_message")
        op.drop_table("bot_message")

    if "bot_prospect" in existing_tables:
        op.drop_index("ix_bot_prospect_last_message_at", table_name="bot_prospect")
        op.drop_index("ix_bot_prospect_lead_status", table_name="bot_prospect")
        op.drop_table("bot_prospect")
