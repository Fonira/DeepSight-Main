"""proxy_usage_daily — telemetry table pour proxy Decodo (Pay As You Go)

Revision ID: 027_proxy_usage_daily
Revises: 026_chatmsg_summary_null
Create Date: 2026-05-11

Sprint Proxy Observability.

Crée la table `proxy_usage_daily` (DATE PK) qui agrège par jour les bytes_in /
bytes_out transitant via le proxy Decodo + le nombre de requêtes total et un
breakdown par provider (yt-dlp, youtube_transcript_api, httpx, etc.) stocké en
JSONB.

Spec : voir `docs/runbooks/proxy-telemetry-monitoring.md`.

Migration idempotente : create only if not exists. Pas de backfill (nouvelle
table, on commence à compter à partir du déploiement).

Convention : revision_id ≤ 32 chars pour ne pas dépasser la colonne
`alembic_version.version_num` standard (workaround prod ALTER VARCHAR(255)
appliqué mais respecté ici par sécurité).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "027_proxy_usage_daily"
down_revision: Union[str, None] = "026_chatmsg_summary_null"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "proxy_usage_daily" in existing_tables:
        return

    dialect = bind.dialect.name

    # JSONB côté PostgreSQL, JSON générique côté SQLite (tests locaux).
    if dialect == "postgresql":
        rbp_type = postgresql.JSONB(astext_type=sa.Text())
        rbp_default = sa.text("'{}'::jsonb")
    else:
        rbp_type = sa.JSON()
        rbp_default = sa.text("'{}'")

    op.create_table(
        "proxy_usage_daily",
        sa.Column("date", sa.Date(), primary_key=True),
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
            rbp_type,
            nullable=False,
            server_default=rbp_default,
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "proxy_usage_daily" in existing_tables:
        op.drop_table("proxy_usage_daily")
