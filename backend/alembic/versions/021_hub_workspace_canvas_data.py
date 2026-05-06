"""hub_workspace_canvas_data — pivot Hub vers rendu natif (DebateConvergenceDivergence-inspired)

Revision ID: 021_hub_workspace_canvas_data
Revises: 020_add_email_dlq
Create Date: 2026-05-06

Pivot Hub Workspace MVP : on abandonne l'embed Miro iframe (limitation plan
Personal Starter $8/mo : pas d'embed iframe externe) pour un rendu HTML/React
natif inspiré du composant DebateConvergenceDivergence (style apprécié par
l'utilisateur sur la feature Débat IA).

Ajoute la colonne `canvas_data JSON NULL` à `hub_workspaces`. Stocke un dict
issu de Mistral :
    {
      "shared_concepts": [str, ...],
      "themes": [
        {"theme": str, "perspectives": [{"summary_id": int, "excerpt": str}, ...]},
        ...
      ]
    }

NULL = workspace pré-pivot ou Mistral fail → fallback sur MiroBoardEmbed côté
frontend (rétro-compat workspaces existants).

Idempotente : check si la colonne existe avant ALTER TABLE.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "021_hub_workspace_canvas_data"
down_revision: Union[str, None] = "020_add_email_dlq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "hub_workspaces" not in inspector.get_table_names():
        # Pas de table → migration 018 pas appliquée ; nothing to do.
        return

    columns = {col["name"] for col in inspector.get_columns("hub_workspaces")}
    if "canvas_data" not in columns:
        op.add_column(
            "hub_workspaces",
            sa.Column("canvas_data", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "hub_workspaces" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("hub_workspaces")}
    if "canvas_data" in columns:
        op.drop_column("hub_workspaces", "canvas_data")
