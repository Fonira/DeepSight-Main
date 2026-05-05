"""debate v2 — video_b_candidates cache table (cache only, perspectives table is in 017)

Revision ID: 016_debate_v2_video_b_candidates_cache
Revises: 015_add_search_index_tables
Create Date: 2026-05-04

Sub-agent A scope (Wave 2 / Débat IA v2):

  Crée UNIQUEMENT la table de cache `debate_video_b_candidates` (TTL 7 jours).
  Cette table sert au pipeline `_search_perspective_video` du module
  `debate.matching` pour cacher le top-5 des candidats trouvés par
  (topic, relation_type, lang, duration_bucket).

  La table `debate_perspectives` ainsi que les nouvelles colonnes sur
  `debate_analyses` (`relation_type_dominant`, `miro_board_url`,
  `miro_board_id`) sont déléguées à la migration 017 (Sub-agent B / PR
  adaptative). Voir spec docs/superpowers/specs/2026-05-04-debate-ia-v2.md §4.

Idempotence : on garde des CREATE INDEX/TABLE non guardés volontairement —
si la table existe déjà alembic remontera l'erreur, ce qui est le comportement
souhaité (signal d'incohérence d'historique).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "016_debate_v2_video_b_candidates_cache"
down_revision: Union[str, None] = "015_add_search_index_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create debate_video_b_candidates cache table + indexes."""
    op.create_table(
        "debate_video_b_candidates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cache_key", sa.String(64), nullable=False),  # sha256 hex
        sa.Column("topic_normalized", sa.String(255), nullable=True),
        sa.Column("relation_type", sa.String(20), nullable=False),
        sa.Column("lang", sa.String(5), nullable=False),
        sa.Column("duration_bucket", sa.String(10), nullable=False),
        sa.Column("candidates_json", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("cache_key", name="uq_debate_video_b_candidates_key"),
    )
    op.create_index(
        "idx_debate_video_b_candidates_key",
        "debate_video_b_candidates",
        ["cache_key"],
    )
    op.create_index(
        "idx_debate_video_b_candidates_expires",
        "debate_video_b_candidates",
        ["expires_at"],
    )


def downgrade() -> None:
    """Drop indexes + table."""
    op.drop_index(
        "idx_debate_video_b_candidates_expires",
        table_name="debate_video_b_candidates",
    )
    op.drop_index(
        "idx_debate_video_b_candidates_key",
        table_name="debate_video_b_candidates",
    )
    op.drop_table("debate_video_b_candidates")
