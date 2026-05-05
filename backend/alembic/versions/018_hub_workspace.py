"""hub_workspaces — Hub Miro Workspace MVP table

Revision ID: 018_hub_workspace
Revises: 017_debate_v2_perspectives
Create Date: 2026-05-05

Sprint Hub Miro Workspace MVP — VAGUE 1 BACKEND.

Crée la table `hub_workspaces` qui stocke les workspaces Miro générés par
l'utilisateur depuis 2-20 analyses Summary sélectionnées dans le Hub.

Spec : docs/superpowers/specs/2026-05-05-hub-miro-workspace-mvp.md
Gating : Expert only (vérifié dans backend/src/hub/service.py).
Cap : 5 workspaces actifs / user / 30 jours.

Pas de backfill : nouvelle table.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018_hub_workspace"
down_revision: Union[str, None] = "017_debate_v2_perspectives"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "hub_workspaces" not in existing_tables:
        op.create_table(
            "hub_workspaces",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("summary_ids", sa.JSON(), nullable=False),
            sa.Column("miro_board_id", sa.String(length=100), nullable=True),
            sa.Column("miro_board_url", sa.String(length=500), nullable=True),
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default="pending",
            ),  # pending | creating | ready | failed
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index(
            "idx_hub_workspaces_user_created",
            "hub_workspaces",
            ["user_id", sa.text("created_at DESC")],
        )
        op.create_index(
            "idx_hub_workspaces_user_status",
            "hub_workspaces",
            ["user_id", "status"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "hub_workspaces" in existing_tables:
        # Drop indexes d'abord
        try:
            op.drop_index(
                "idx_hub_workspaces_user_status", table_name="hub_workspaces"
            )
        except Exception:
            pass
        try:
            op.drop_index(
                "idx_hub_workspaces_user_created", table_name="hub_workspaces"
            )
        except Exception:
            pass
        op.drop_table("hub_workspaces")
