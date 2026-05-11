"""proxy_usage_daily — bandwidth & request telemetry per UTC day

Revision ID: 027_proxy_usage_daily
Revises: 026_chatmsg_summary_null
Create Date: 2026-05-11

Sprint E observability. Crée la table `proxy_usage_daily` (1 row par jour UTC)
pour mesurer la consommation du proxy Decodo (Pay-As-You-Go $4/GB) ET alerter
avant que le wallet ne sature. Voir backend/src/middleware/proxy_telemetry.py
et endpoint admin `GET /api/admin/proxy/usage`.

Idempotent : check_existing_tables() évite le crash si la table existe déjà
(défense en profondeur pour rejouer la migration).

Downgrade strict (DROP TABLE) — toute donnée de télémétrie est perdue, ce qui
est acceptable car c'est de la métrique opérationnelle, pas du contenu user.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
# ⚠️ Convention DeepSight : revision ID ≤ 32 chars (cf. reference_alembic-deepsight-conventions).
revision: str = "027_proxy_usage_daily"
down_revision: Union[str, None] = "026_chatmsg_summary_null"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create proxy_usage_daily table (idempotent)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "proxy_usage_daily" in inspector.get_table_names():
        # Déjà créée — rien à faire.
        return

    op.create_table(
        "proxy_usage_daily",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "bytes_in",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "bytes_out",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "requests_total",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "requests_by_provider",
            sa.JSON(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("date"),
    )


def downgrade() -> None:
    """Drop proxy_usage_daily table.

    ⚠️ Les données de télémétrie sont perdues. C'est volontaire — la table ne
    contient que des compteurs agrégés, pas du contenu utilisateur.
    """
    op.drop_table("proxy_usage_daily")
