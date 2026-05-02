"""Add transcript_embeddings.model_version for future bumps tracking.

Revision ID: 013_add_embedding_model_version
Revises: 012_pricing_v2_rename
Create Date: 2026-05-02

Mistral-First migration — Phase 6 (embeddings).

Context:
  The embedding service uses ``mistral-embed`` (Mistral 23.12, output dim 1024).
  At time of writing, this is still the only generic text embedding model
  exposed by Mistral (no ``mistral-embed-2510``/``2602`` variant published).
  Codestral-embed (25.05) is code-only and out of scope.

  However, when Mistral does ship a newer revision (likely with a different
  vector dimension), we need a way to:
    1. Track per-row which model produced each embedding.
    2. Re-embed progressively (cf. ``backend/scripts/reembed_progressive.py``)
       without taking down the search feature.

This migration adds ``model_version: VARCHAR(50)`` to ``transcript_embeddings``
with default ``'mistral-embed'`` (the legacy alias) on existing rows. New rows
written by ``embedding_service.py`` will populate the column explicitly.

Backward compatibility:
  - Column nullable=False with server_default → existing rows backfilled.
  - Reader (``search_similar``) is dimension-agnostic per pure-Python cosine.
  - No DDL on the embedding_json column itself — dimension stays 1024.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "013_add_embedding_model_version"
down_revision: Union[str, None] = "012_pricing_v2_rename"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transcript_embeddings",
        sa.Column(
            "model_version",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'mistral-embed'"),
        ),
    )
    op.create_index(
        "idx_transcript_embeddings_model_version",
        "transcript_embeddings",
        ["model_version"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_transcript_embeddings_model_version",
        table_name="transcript_embeddings",
    )
    op.drop_column("transcript_embeddings", "model_version")
