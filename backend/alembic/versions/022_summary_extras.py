"""summary_extras — enrichissement post-processing pour synthèses détaillées

Revision ID: 022_summary_extras
Revises: 021_hub_workspace_canvas_data
Create Date: 2026-05-06

Spike "synthèses détaillées enrichies" 2026-05-06 — applique la technique du
canvas Hub (Mistral json_mode + validation stricte + retry + champs optionnels)
au Summary classique, sans toucher à `summary_content` (prose existante).

Ajoute la colonne `summary_extras JSON NULL` qui stockera :
    {
      "key_quotes": [{"quote": str, "context": str | null}, ...],
      "key_takeaways": [str, ...],
      "chapter_themes": [{"theme": str, "summary": str | null}, ...]
    }

NULL = enrichissement pas encore généré (génération à la demande via endpoint
POST /api/videos/summary/{id}/enrich).

Idempotente : check si la colonne existe avant ALTER TABLE.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "022_summary_extras"
down_revision: Union[str, None] = "021_hub_workspace_canvas_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "summary_extras" not in columns:
        op.add_column(
            "summaries",
            sa.Column("summary_extras", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "summary_extras" in columns:
        op.drop_column("summaries", "summary_extras")
