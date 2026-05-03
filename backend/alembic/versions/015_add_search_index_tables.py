"""Add search index tables for Semantic Search V1.

Revision ID: 015_add_search_index_tables
Revises: 014_add_channel_contexts
Create Date: 2026-05-03

Tables ajoutées (Semantic Search V1, cf. docs/superpowers/specs/2026-05-03-semantic-search-design.md):

  Persistance flashcards/quiz (matérialisation pour permettre l'indexation) :
    1. flashcards            — flashcards persistées par génération
    2. quiz_questions        — questions quiz persistées par génération

  Embeddings par source (1 table par type pour clarté + indexes ciblés) :
    3. summary_embeddings    — 1 embedding par section structured_index
    4. flashcard_embeddings  — 1 embedding par flashcard (Q+A concaténés)
    5. quiz_embeddings       — 1 embedding par question (Q + bonne réponse)
    6. chat_embeddings       — 1 embedding par turn user+assistant

  Cache tooltip IA :
    7. explain_passage_cache — cache 7j sha256(query+passage+summary_id)

Tous les embeddings :
  - JSON 1024-dim Text (pas de pgvector — cf. ADR brainstorm 2026-05-03)
  - model_version VARCHAR(50) default 'mistral-embed' (versionnable)
  - user_id dénormalisé pour filtre SQL rapide (pas besoin de JOIN summaries)
  - ON DELETE CASCADE depuis user/summary

Backward compat : aucune. Les tables sont nouvelles. Le `transcript_embeddings`
existant est inchangé.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015_add_search_index_tables"
down_revision: Union[str, None] = "014_add_channel_contexts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── 1. flashcards ──────────────────────────────────────────────────────
    op.create_table(
        "flashcards",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer, nullable=False, default=0),
        sa.Column("front", sa.Text, nullable=False),
        sa.Column("back", sa.Text, nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "position", name="uix_flashcards_summary_position"),
    )
    op.create_index("ix_flashcards_summary", "flashcards", ["summary_id"])
    op.create_index("ix_flashcards_user", "flashcards", ["user_id"])

    # ─── 2. quiz_questions ──────────────────────────────────────────────────
    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer, nullable=False, default=0),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("options_json", sa.Text, nullable=False),  # JSON list[str]
        sa.Column("correct_index", sa.Integer, nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="standard"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "position", name="uix_quiz_summary_position"),
    )
    op.create_index("ix_quiz_summary", "quiz_questions", ["summary_id"])
    op.create_index("ix_quiz_user", "quiz_questions", ["user_id"])

    # ─── 3. summary_embeddings ──────────────────────────────────────────────
    op.create_table(
        "summary_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section_index", sa.Integer, nullable=False),
        sa.Column("section_ref", sa.String(100), nullable=True),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column("token_count", sa.Integer, default=0),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("source_metadata", sa.Text, nullable=True),  # JSON
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "section_index", name="uix_summary_emb_section"),
    )
    op.create_index("ix_summary_emb_user", "summary_embeddings", ["user_id"])
    op.create_index("ix_summary_emb_summary", "summary_embeddings", ["summary_id"])
    op.create_index("ix_summary_emb_model", "summary_embeddings", ["model_version"])

    # ─── 4. flashcard_embeddings ────────────────────────────────────────────
    op.create_table(
        "flashcard_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "flashcard_id",
            sa.Integer,
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_flashcard_emb_user", "flashcard_embeddings", ["user_id"])
    op.create_index("ix_flashcard_emb_summary", "flashcard_embeddings", ["summary_id"])

    # ─── 5. quiz_embeddings ─────────────────────────────────────────────────
    op.create_table(
        "quiz_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "quiz_question_id",
            sa.Integer,
            sa.ForeignKey("quiz_questions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_quiz_emb_user", "quiz_embeddings", ["user_id"])
    op.create_index("ix_quiz_emb_summary", "quiz_embeddings", ["summary_id"])

    # ─── 6. chat_embeddings ─────────────────────────────────────────────────
    op.create_table(
        "chat_embeddings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "summary_id",
            sa.Integer,
            sa.ForeignKey("summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("turn_index", sa.Integer, nullable=False),
        sa.Column(
            "user_message_id",
            sa.Integer,
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "agent_message_id",
            sa.Integer,
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("embedding_json", sa.Text, nullable=False),
        sa.Column("text_preview", sa.String(500)),
        sa.Column("token_count", sa.Integer, default=0),
        sa.Column(
            "model_version",
            sa.String(50),
            nullable=False,
            server_default="mistral-embed",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("summary_id", "turn_index", name="uix_chat_emb_turn"),
    )
    op.create_index("ix_chat_emb_user", "chat_embeddings", ["user_id"])
    op.create_index("ix_chat_emb_summary_turn", "chat_embeddings", ["summary_id", "turn_index"])

    # ─── 7. explain_passage_cache ───────────────────────────────────────────
    op.create_table(
        "explain_passage_cache",
        sa.Column("cache_key", sa.String(64), primary_key=True),
        sa.Column("explanation", sa.Text, nullable=False),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_explain_cache_expires", "explain_passage_cache", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_explain_cache_expires", "explain_passage_cache")
    op.drop_table("explain_passage_cache")

    op.drop_index("ix_chat_emb_summary_turn", "chat_embeddings")
    op.drop_index("ix_chat_emb_user", "chat_embeddings")
    op.drop_table("chat_embeddings")

    op.drop_index("ix_quiz_emb_summary", "quiz_embeddings")
    op.drop_index("ix_quiz_emb_user", "quiz_embeddings")
    op.drop_table("quiz_embeddings")

    op.drop_index("ix_flashcard_emb_summary", "flashcard_embeddings")
    op.drop_index("ix_flashcard_emb_user", "flashcard_embeddings")
    op.drop_table("flashcard_embeddings")

    op.drop_index("ix_summary_emb_model", "summary_embeddings")
    op.drop_index("ix_summary_emb_summary", "summary_embeddings")
    op.drop_index("ix_summary_emb_user", "summary_embeddings")
    op.drop_table("summary_embeddings")

    op.drop_index("ix_quiz_user", "quiz_questions")
    op.drop_index("ix_quiz_summary", "quiz_questions")
    op.drop_table("quiz_questions")

    op.drop_index("ix_flashcards_user", "flashcards")
    op.drop_index("ix_flashcards_summary", "flashcards")
    op.drop_table("flashcards")
