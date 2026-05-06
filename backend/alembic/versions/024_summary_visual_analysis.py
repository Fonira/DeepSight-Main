"""summary_visual_analysis — persist VisualAnalysis sur Summary (Phase 2 plumbing)

Revision ID: 024_summary_visual_analysis
Revises: 023_voice_quota_purchased_minutes_catchup
Create Date: 2026-05-06

Phase 2 visual analysis branchait `analyze_frames` sur le hook /api/videos/analyze
mais persistait UNIQUEMENT le résultat dans `web_context` du prompt LLM. Aucune
trace après la requête → tabs UI (web/mobile/extension) lisaient toujours `null`.

Ajoute la colonne `summaries.visual_analysis JSON NULL` qui stockera le dict
sérialisé d'une `VisualAnalysis` (cf `videos/visual_analyzer.py`) :
    {
      "visual_hook": str,
      "visual_structure": str,
      "key_moments": [{"timestamp_s": float, "description": str, "type": str}, ...],
      "visible_text": str,
      "visual_seo_indicators": {...},
      "summary_visual": str,
      "model_used": str,
      "frames_analyzed": int,
      "frames_downsampled": bool
    }

NULL = pas analysé visuellement (analyse legacy avant Phase 2 plumbing,
ou flag `include_visual_analysis=false`, ou quota dépassé, ou échec Mistral).

Idempotente : check si la colonne existe avant ALTER TABLE.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "024_summary_visual_analysis"
down_revision: Union[str, None] = "023_voice_quota_purchased_minutes_catchup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "visual_analysis" not in columns:
        op.add_column(
            "summaries",
            sa.Column("visual_analysis", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "summaries" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("summaries")}
    if "visual_analysis" in columns:
        op.drop_column("summaries", "visual_analysis")
