"""Add channel_contexts table — cache des contextes de chaîne YouTube/TikTok.

Revision ID: 014_add_channel_contexts
Revises: 013_add_embedding_model_version
Create Date: 2026-05-03

Channel Context — feature qui injecte le contexte de la chaîne (jusqu'à
50 vidéos : titres + descriptions + tags + métadonnées chaîne) dans les
analyses Mistral, pour permettre au modèle de calibrer son analyse
(chaîne poubelle / dangereuse / divertissement / éducative).

Schema:
  - PRIMARY KEY composite (channel_id, platform) — un seul contexte par
    couple chaîne/plateforme, refresh par upsert (ON CONFLICT).
  - JSON columns (tags, categories, last_videos) → JSONB sur PostgreSQL,
    TEXT sérialisé sur SQLite (cf. patterns migrations 009/010).
  - last_videos NOT NULL : la liste des dernières vidéos est la donnée
    centrale du contexte ; un contexte sans vidéos n'a pas de sens.
  - expires_at NOT NULL + index dédié pour la purge périodique
    (TTL côté application, pas de TRIGGER PG).
  - CHECK platform IN ('youtube', 'tiktok') — cohérent avec les autres
    tables platform-aware (transcript_cache, debate_analyses).

Backward compatibility :
  - Nouvelle table, aucune donnée existante → pas de backfill.
  - Downgrade simple : drop_table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "014_add_channel_contexts"
down_revision: Union[str, None] = "013_add_embedding_model_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "channel_contexts",
        sa.Column("channel_id", sa.String(length=128), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("subscriber_count", sa.BigInteger(), nullable=True),
        sa.Column("video_count", sa.Integer(), nullable=True),
        sa.Column(
            "tags",
            sa.JSON(),
            nullable=True,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "categories",
            sa.JSON(),
            nullable=True,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("last_videos", sa.JSON(), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint(
            "channel_id", "platform", name="pk_channel_contexts"
        ),
        sa.CheckConstraint(
            "platform IN ('youtube', 'tiktok')",
            name="ck_channel_contexts_platform",
        ),
    )
    op.create_index(
        "idx_channel_contexts_expires_at",
        "channel_contexts",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_channel_contexts_expires_at",
        table_name="channel_contexts",
    )
    op.drop_table("channel_contexts")
