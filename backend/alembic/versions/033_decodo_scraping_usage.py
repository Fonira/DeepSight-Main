"""decodo_scraping_usage — telemetry table pour Decodo Web Scraping API

Revision ID: 033_decodo_scraping_usage
Revises: 032_users_apple_sub
Create Date: 2026-05-21

Sprint Decodo Web Scraping Phase 0 (wrapper + telemetry).

DISTINCT de `proxy_usage_daily` (Decodo Residential proxy via env `YOUTUBE_PROXY`,
PR #466). Le produit Web Scraping API (`scraper-api.decodo.com/v2/scrape`) est un
service séparé sur tier $49/mois avec ses propres quotas (Premium+JS 39 200/mois,
Standard+JS 75K/mois, etc.) — d'où une table de telemetry isolée pour ne pas
mélanger les budgets.

Spec source de vérité : `01-Projects/DeepSight/Ideas/2026-05-21-decodo-scraping-phase1-quick-wins.md`
+ `01-Projects/DeepSight/Ideas/2026-05-21-decodo-scraping-phase3-new-features.md`.

La table grain = 1 row par appel (vs proxy_usage_daily qui aggrège par jour) :
- permet d'analyser la latence par call
- permet d'identifier les URLs problématiques (mauvais status_code, error texte)
- volume estimé < 2000 req/jour en pic → ~60k rows/mois, parfaitement tenable
  (index sur created_at DESC pour les retention queries).

Convention DeepSight Alembic :
- Revision ID ≤ 32 chars : "033_decodo_scraping_usage" = 25 chars ✓
- Migration idempotente : create only if not exists, drop only if exists.
- Compatible PostgreSQL ET SQLite (tests locaux).

Entrypoint Docker exécute `alembic upgrade heads` (plural) à chaque container
start, donc on doit rester safe sur re-run.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "033_decodo_scraping_usage"
down_revision: Union[str, None] = "032_users_apple_sub"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "decodo_scraping_usage" in existing_tables:
        return

    op.create_table(
        "decodo_scraping_usage",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("url", sa.Text(), nullable=False),
        # standard | premium
        sa.Column("proxy_pool", sa.String(16), nullable=False),
        sa.Column("headless", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # raw_html | markdown
        sa.Column("output_format", sa.String(16), nullable=False),
        # Status code retourné par le site cible (200, 404, etc.) — NULL si l'appel
        # Decodo a échoué avant d'atteindre la cible.
        sa.Column("target_status_code", sa.Integer(), nullable=True),
        # Status code retourné par Decodo lui-même (200 = scrape OK, 4xx/5xx = erreur Decodo).
        sa.Column("decodo_http_status", sa.Integer(), nullable=True),
        # Cost estimate en USD pour cet appel (matrix proxy_pool × headless).
        # NUMERIC(10,6) → précision 6 décimales, suffit pour $0.000625 par exemple.
        sa.Column(
            "cost_estimate_usd",
            sa.Numeric(precision=10, scale=6),
            nullable=False,
            server_default=sa.text("0"),
        ),
        # Durée totale du call Decodo en secondes (NUMERIC(10,3) → 0.001s précision).
        sa.Column(
            "duration_s",
            sa.Numeric(precision=10, scale=3),
            nullable=False,
            server_default=sa.text("0"),
        ),
        # Texte d'erreur si l'appel a échoué (timeout, exception, etc.). NULL en cas de succès.
        sa.Column("error", sa.Text(), nullable=True),
    )

    # Index sur created_at DESC — toutes les queries dashboard scannent par date récente.
    op.create_index(
        "ix_decodo_scraping_usage_created_at",
        "decodo_scraping_usage",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "decodo_scraping_usage" in existing_tables:
        op.drop_index(
            "ix_decodo_scraping_usage_created_at",
            table_name="decodo_scraping_usage",
        )
        op.drop_table("decodo_scraping_usage")
