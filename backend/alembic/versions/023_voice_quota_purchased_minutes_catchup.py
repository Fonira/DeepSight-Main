"""voice_quota.purchased_minutes catch-up + alembic heads merge.

Revision ID: 023_voice_quota_purchased_minutes_catchup
Revises: 022_summary_extras, 019_visual_analysis_quota
Create Date: 2026-05-06

Hot-fix prod : `GET /api/billing/my-plan` retournait HTTP 500 systématiquement
parce que la table `voice_quota` n'a PAS la colonne `purchased_minutes` que le
modèle SQLAlchemy `VoiceQuotaStreaming` (db.database) déclare.

Root cause :
  * Migration 011 (`011_add_voice_credit_packs`) a été partiellement appliquée
    en prod : les 2 nouvelles tables (`voice_credit_packs`,
    `voice_credit_purchases`) ont bien été créées, MAIS le `add_column
    voice_quota.purchased_minutes` qui suit DANS LE MÊME `upgrade()` est
    introuvable côté schéma prod (vérifié `\d voice_quota` 2026-05-06 :
    6 colonnes seulement, pas la 7e attendue).
  * Cette migration republie l'ALTER TABLE de manière idempotente (pattern
    inspector + check colonne existante) pour garantir que prod et dev
    convergent vers le même schéma.

Bonus : fusionne les deux `head` alembic actuelles (`022_summary_extras` côté
chaîne principale et `019_visual_analysis_quota` côté branche fork de
`018_hub_workspace`) en une seule head `023_voice_quota_purchased_minutes_catchup`
pour stabiliser le graphe.

Idempotente : safe à rejouer sur n'importe quel environnement.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "023_voice_quota_purchased_minutes_catchup"
# Merge les 2 heads existantes via tuple (alembic merge migration).
down_revision: Union[str, Sequence[str], None] = (
    "022_summary_extras",
    "019_visual_analysis_quota",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "voice_quota" not in inspector.get_table_names():
        # Aucune table à patcher (env dev tout neuf) — laisser 011 la créer.
        return

    columns = {col["name"] for col in inspector.get_columns("voice_quota")}
    if "purchased_minutes" not in columns:
        op.add_column(
            "voice_quota",
            sa.Column(
                "purchased_minutes",
                sa.Float(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )


def downgrade() -> None:
    # Pas de downgrade actif : on ne veut pas DROP la colonne sur prod si on
    # rollback (ferait à nouveau planter /my-plan). 011 reste responsable du
    # downgrade officiel de cette colonne.
    pass
