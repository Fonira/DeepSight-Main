"""summary_is_public — opt-in toggle pour pages publiques /a/{slug} (Phase 3 GEO)

Revision ID: 025_summary_is_public
Revises: 024_summary_visual_analysis
Create Date: 2026-05-07

Phase 3 du sprint Export to AI + GEO. Les pages publiques `/a/{slug}` sont
opt-in par analyse — l'utilisateur doit explicitement activer le partage. Par
défaut, toutes les analyses restent privées (`is_public=false`).

Ajoute la colonne `summaries.is_public BOOLEAN NOT NULL DEFAULT FALSE`. Le slug
est dérivé déterministiquement depuis l'ID (`f"a{int(id):x}"` cf
`exports/markdown_builder.py::_slug_for_summary`), pas besoin de colonne slug
dédiée. Index partiel sur `(is_public)` pour accélérer le lookup public.

Décisions actées (réf spec § 6) :
  • Q1 : pas de page /discover en V1, juste lien partageable
  • Q5 : ignorer si vidéo source devient privée en V1

Idempotente : check si la colonne existe avant ALTER TABLE.
Spec : Vault/01-Projects/DeepSight/Specs/2026-05-07-deepsight-export-to-ai-geo-design.md
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "025_summary_is_public"
down_revision: Union[str, None] = "024_summary_visual_analysis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "is_public" not in columns:
        # NOT NULL DEFAULT FALSE — toutes les rows existantes deviennent
        # explicitement privées. Aucune fuite possible au déploiement.
        op.add_column(
            "summaries",
            sa.Column(
                "is_public",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    # Index sur (is_public) pour le SELECT public WHERE is_public=true.
    # Pas de WHERE clause (index partiel) car PostgreSQL le supporte mais
    # SQLite (dev/tests) ne le supporte pas en CREATE INDEX standard.
    indexes = {idx["name"] for idx in inspector.get_indexes("summaries")}
    if "idx_summaries_is_public" not in indexes:
        op.create_index(
            "idx_summaries_is_public",
            "summaries",
            ["is_public"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    indexes = {idx["name"] for idx in inspector.get_indexes("summaries")}
    if "idx_summaries_is_public" in indexes:
        op.drop_index("idx_summaries_is_public", table_name="summaries")

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "is_public" in columns:
        op.drop_column("summaries", "is_public")
