"""video_cache_* tables + merge des têtes 033

Revision ID: 034_video_cache_tables
Revises: 033_decodo_scraping_usage, 033_user_sessions
Create Date: 2026-11-27

Pourquoi
--------
`services/video_content_cache.py` (cache L2 partagé entre utilisateurs :
transcripts, analyses, studio, fact-checks) écrit dans cinq tables
`video_cache_*` qu'aucune migration ni aucun modèle ne créait. Sur la base du
VPS (construite par `create_all`), chaque lecture/écriture L2 échouait avec
« relation video_cache_transcripts does not exist » : le cache ne vivait que
dans Redis (TTL court, éviction LRU), d'où des appels Supadata/Mistral répétés.

Cette migration :
- fusionne les deux têtes `033_decodo_scraping_usage` et `033_user_sessions` ;
- crée les cinq tables `video_cache_*` (clés primaires = cibles des
  `ON CONFLICT` du service) ;
- rejoue les créations idempotentes de 027 (`proxy_usage_daily`) et 033
  (`decodo_scraping_usage`), tables absentes d'une base construite par
  `create_all` puis alignée par `alembic stamp` (cf. alembic/baseline.py).

Idempotente : chaque table n'est créée que si elle manque.
Revision ID = 22 caractères (< 32).
"""

import importlib.util
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "034_video_cache_tables"
down_revision: Union[str, Sequence[str], None] = (
    "033_decodo_scraping_usage",
    "033_user_sessions",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_VERSIONS_DIR = Path(__file__).resolve().parent

# (nom de la table, colonnes de clé en plus de platform + video_id)
_CACHE_TABLES = (
    ("video_cache_transcripts", ()),
    ("video_cache_analyses", ("mode", "language")),
    ("video_cache_studio", ("content_type", "language")),
    ("video_cache_factchecks", ("language",)),
)

_KEY_COLUMN_TYPES = {
    "mode": sa.String(32),
    "content_type": sa.String(32),
    "language": sa.String(10),
}


def _run_sibling_upgrade(filename: str) -> None:
    """Exécute l'upgrade() idempotent d'une migration antérieure."""
    spec = importlib.util.spec_from_file_location(f"_ds_mig_{filename[:-3]}", _VERSIONS_DIR / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Migration introuvable : {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.upgrade()


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())

    for table_name, extra_keys in _CACHE_TABLES:
        if table_name in existing:
            continue
        columns = [
            sa.Column("platform", sa.String(20), nullable=False),
            sa.Column("video_id", sa.String(100), nullable=False),
        ]
        columns += [sa.Column(key, _KEY_COLUMN_TYPES[key], nullable=False) for key in extra_keys]
        columns += [
            sa.Column("data", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("last_accessed", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("access_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
        ]
        op.create_table(
            table_name,
            *columns,
            sa.PrimaryKeyConstraint("platform", "video_id", *extra_keys, name=f"pk_{table_name}"),
        )
        op.create_index(f"ix_{table_name}_last_accessed", table_name, ["last_accessed"])

    if "video_cache_stats" not in existing:
        op.create_table(
            "video_cache_stats",
            sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
            sa.Column("content_type", sa.String(32), nullable=False),
            sa.Column("hit_level", sa.String(8), nullable=False),
            sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_video_cache_stats_recorded_at", "video_cache_stats", ["recorded_at"])

    # Tables qui n'existent que dans des migrations (absentes après create_all + stamp)
    _run_sibling_upgrade("027_proxy_usage_daily.py")
    _run_sibling_upgrade("033_decodo_scraping_usage.py")


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    if "video_cache_stats" in existing:
        op.drop_index("ix_video_cache_stats_recorded_at", table_name="video_cache_stats")
        op.drop_table("video_cache_stats")
    for table_name, _ in reversed(_CACHE_TABLES):
        if table_name in existing:
            op.drop_index(f"ix_{table_name}_last_accessed", table_name=table_name)
            op.drop_table(table_name)
    # proxy_usage_daily / decodo_scraping_usage restent gérées par 027 / 033.
