"""initial_schema

Revision ID: 001
Revises: None
Create Date: 2026-02-12

Baseline migration — captures the existing DeepSight schema.
This migration uses `create_all` semantics: it only creates tables
that don't already exist, so it's safe to run on an existing database.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("email_verified", sa.Boolean, default=False),
        sa.Column("verification_code", sa.String(10)),
        sa.Column("verification_expires", sa.DateTime),
        sa.Column("reset_code", sa.String(100)),
        sa.Column("reset_expires", sa.DateTime),
        sa.Column("plan", sa.String(20), default="free"),
        sa.Column("credits", sa.Integer, default=10),
        sa.Column("is_admin", sa.Boolean, default=False),
        sa.Column("stripe_customer_id", sa.String(100)),
        sa.Column("stripe_subscription_id", sa.String(100)),
        sa.Column("google_id", sa.String(100)),
        sa.Column("mistral_key", sa.String(255)),
        sa.Column("supadata_key", sa.String(255)),
        sa.Column("default_lang", sa.String(5), default="fr"),
        sa.Column("default_mode", sa.String(20), default="standard"),
        sa.Column("default_model", sa.String(50), default="mistral-small-latest"),
        sa.Column("avatar_url", sa.Text),
        sa.Column("total_videos", sa.Integer, default=0),
        sa.Column("total_words", sa.Integer, default=0),
        sa.Column("total_playlists", sa.Integer, default=0),
        sa.Column("session_token", sa.String(255)),
        sa.Column("last_login", sa.DateTime),
        sa.Column("api_key_hash", sa.String(64), unique=True, index=True),
        sa.Column("api_key_created_at", sa.DateTime),
        sa.Column("api_key_last_used", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        if_not_exists=True,
    )

    # Summaries
    op.create_table(
        "summaries",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("video_id", sa.String(20), nullable=False),
        sa.Column("video_title", sa.String(500)),
        sa.Column("video_channel", sa.String(255)),
        sa.Column("video_duration", sa.Integer),
        sa.Column("video_url", sa.String(500)),
        sa.Column("thumbnail_url", sa.Text),
        sa.Column("video_upload_date", sa.String(50)),
        sa.Column("category", sa.String(50)),
        sa.Column("category_confidence", sa.Float),
        sa.Column("lang", sa.String(5)),
        sa.Column("mode", sa.String(20)),
        sa.Column("model_used", sa.String(50)),
        sa.Column("summary_content", sa.Text),
        sa.Column("transcript_context", sa.Text),
        sa.Column("word_count", sa.Integer),
        sa.Column("fact_check_result", sa.Text),
        sa.Column("entities_extracted", sa.Text),
        sa.Column("reliability_score", sa.Float),
        sa.Column("tags", sa.Text),
        sa.Column("playlist_id", sa.String(100), index=True),
        sa.Column("playlist_position", sa.Integer),
        sa.Column("is_favorite", sa.Boolean, default=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # Daily quotas
    op.create_table(
        "daily_quotas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quota_date", sa.String(10), nullable=False),
        sa.Column("videos_used", sa.Integer, default=0),
        if_not_exists=True,
    )

    # Credit transactions
    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("balance_after", sa.Integer, nullable=False),
        sa.Column("transaction_type", sa.String(50)),
        sa.Column("type", sa.String(50)),
        sa.Column("stripe_payment_id", sa.String(100)),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # Playlist analyses
    op.create_table(
        "playlist_analyses",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("playlist_id", sa.String(100), nullable=False),
        sa.Column("playlist_url", sa.String(500)),
        sa.Column("playlist_title", sa.String(500)),
        sa.Column("num_videos", sa.Integer),
        sa.Column("num_processed", sa.Integer, default=0),
        sa.Column("total_duration", sa.Integer),
        sa.Column("total_words", sa.Integer),
        sa.Column("meta_analysis", sa.Text),
        sa.Column("all_summaries", sa.Text),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("error_message", sa.Text),
        sa.Column("started_at", sa.DateTime),
        sa.Column("completed_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # Chat messages
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("summary_id", sa.Integer, sa.ForeignKey("summaries.id"), nullable=False, index=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("web_search_used", sa.Boolean, default=False),
        sa.Column("fact_checked", sa.Boolean, default=False),
        sa.Column("sources_json", sa.Text),
        sa.Column("enrichment_level", sa.String(20)),
        if_not_exists=True,
    )

    # Chat quotas
    op.create_table(
        "chat_quotas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quota_date", sa.String(10), nullable=False),
        sa.Column("daily_count", sa.Integer, default=0),
        if_not_exists=True,
    )

    # Playlist chat messages
    op.create_table(
        "playlist_chat_messages",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("playlist_id", sa.String(100), nullable=False, index=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # Web search usage
    op.create_table(
        "web_search_usage",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("month_year", sa.String(7), nullable=False),
        sa.Column("search_count", sa.Integer, default=0),
        sa.Column("last_search_at", sa.DateTime),
        if_not_exists=True,
    )

    # Admin logs
    op.create_table(
        "admin_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("admin_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_user_id", sa.Integer),
        sa.Column("details", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # API status
    op.create_table(
        "api_status",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("api_name", sa.String(50), unique=True, nullable=False),
        sa.Column("status", sa.String(20), default="ok"),
        sa.Column("last_error", sa.Text),
        sa.Column("last_error_at", sa.DateTime),
        sa.Column("last_success_at", sa.DateTime),
        sa.Column("error_count", sa.Integer, default=0),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # Task status
    op.create_table(
        "task_status",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("progress", sa.Integer, default=0),
        sa.Column("result", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )

    # API usage
    op.create_table(
        "api_usage",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("date", sa.Date, nullable=False, index=True),
        sa.Column("request_count", sa.Integer, default=0),
        sa.Column("credits_used", sa.Integer, default=0),
        sa.Column("error_count", sa.Integer, default=0),
        if_not_exists=True,
    )

    # Academic papers
    op.create_table(
        "academic_papers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("summary_id", sa.Integer, sa.ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("external_id", sa.String(100), nullable=False),
        sa.Column("doi", sa.String(255), index=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("authors_json", sa.Text),
        sa.Column("year", sa.Integer),
        sa.Column("venue", sa.String(500)),
        sa.Column("abstract", sa.Text),
        sa.Column("citation_count", sa.Integer, default=0),
        sa.Column("url", sa.Text),
        sa.Column("pdf_url", sa.Text),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("relevance_score", sa.Float, default=0.0),
        sa.Column("is_open_access", sa.Boolean, default=False),
        sa.Column("keywords_json", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_table("academic_papers")
    op.drop_table("api_usage")
    op.drop_table("task_status")
    op.drop_table("api_status")
    op.drop_table("admin_logs")
    op.drop_table("web_search_usage")
    op.drop_table("playlist_chat_messages")
    op.drop_table("chat_quotas")
    op.drop_table("chat_messages")
    op.drop_table("playlist_analyses")
    op.drop_table("credit_transactions")
    op.drop_table("daily_quotas")
    op.drop_table("summaries")
    op.drop_table("users")
