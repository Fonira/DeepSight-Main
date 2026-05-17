"""summary_community_analysis — verdict communauté (scrape + Mistral analyse)

Revision ID: 029_summary_community
Revises: 028_bot_prospection
Create Date: 2026-05-17

Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md

Ajoute la colonne `summaries.community_analysis JSONB NULL`. Stocke le payload
sérialisé de `CommunityTake` (cf backend/src/comments/schemas.py).

Convention : revision_id ≤ 32 chars (respecté ici : "029_summary_community" = 21 chars).
Migration idempotente : add only if not exists, drop only if exists.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "029_summary_community"
down_revision: Union[str, None] = "028_bot_prospection"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        # Table inexistante (early bootstrap) → no-op.
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "community_analysis" not in columns:
        op.add_column(
            "summaries",
            sa.Column("community_analysis", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "community_analysis" in columns:
        op.drop_column("summaries", "community_analysis")
