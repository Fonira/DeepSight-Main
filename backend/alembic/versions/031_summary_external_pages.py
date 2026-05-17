"""summary_external_pages — colonne JSONB pour pages externes citées (V1)

Revision ID: 031_summary_ext_pages
Revises: 030_academic_scholar
Create Date: 2026-05-17

Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §6

Ajoute la colonne `summaries.external_pages JSON / JSONB NULL`. Stocke le payload
sérialisé construit par `videos/external_pages/orchestrator.extract_external_pages`
(schéma {extracted_at, schema_version, stats, pages}).

Convention DeepSight Alembic :
- Revision ID ≤ 32 chars : "031_summary_ext_pages" = 21 chars ✓
- Migration idempotente : add only if not exists, drop only if exists.
- Compatible PostgreSQL (JSONB) ET SQLite (JSON fallback) via with_variant.

Entrypoint Docker exécute `alembic upgrade heads` (plural) à chaque container
start, donc on doit rester safe sur re-run.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "031_summary_ext_pages"
down_revision: Union[str, None] = "030_academic_scholar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        # Table inexistante (early bootstrap) → no-op.
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "external_pages" in columns:
        # Idempotent : déjà appliquée
        return

    op.add_column(
        "summaries",
        sa.Column(
            "external_pages",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "external_pages" not in columns:
        return

    op.drop_column("summaries", "external_pages")
