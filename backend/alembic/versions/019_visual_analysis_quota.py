"""visual_analysis_quota — Phase 2 Visual Analysis quota table

Revision ID: 019_visual_analysis_quota
Revises: 018_hub_workspace
Create Date: 2026-05-06

Sprint Visual Analysis Phase 2 — Backend integration de l'enrichissement
visuel multimodal (frames + Mistral Vision) dans le flow /api/videos/analyze.

Crée la table `visual_analysis_quota` qui tracke la consommation mensuelle
par user. Quota :
- Free  : 0 (CTA upsell)
- Pro   : 30 / mois calendaire
- Expert: illimité (track quand même pour analytics)

Spec : 01-Projects/DeepSight/Sessions/2026-05-06-visual-analysis-phase-2-spec.md
Trigger user-side : flag include_visual_analysis dans AnalyzeVideoRequest.

Pas de backfill : nouvelle table.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_visual_analysis_quota"
down_revision: Union[str, None] = "018_hub_workspace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "visual_analysis_quota" not in existing_tables:
        op.create_table(
            "visual_analysis_quota",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            # Mois calendaire au format YYYY-MM (ex: "2026-05")
            sa.Column("period", sa.String(length=7), nullable=False, index=True),
            # Compteur d'analyses visual_analysis pour le mois
            sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "last_used_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            # Un seul compteur par (user, mois)
            sa.UniqueConstraint("user_id", "period", name="uq_visual_quota_user_period"),
        )

        # Index composé pour les check de quota rapides (le lookup principal)
        op.create_index(
            "ix_visual_quota_user_period",
            "visual_analysis_quota",
            ["user_id", "period"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_visual_quota_user_period", table_name="visual_analysis_quota")
    op.drop_table("visual_analysis_quota")
