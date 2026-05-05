"""debate v2 — perspectives table + DebateAnalysis Miro/relation columns + backfill

Revision ID: 017_debate_v2_perspectives
Revises: 015_add_search_index_tables
Create Date: 2026-05-04

Sprint Débat IA v2 — Sub-agent B (Wave 2 B).

Changements:

  1. Nouvelles colonnes sur `debate_analyses`:
     - miro_board_url VARCHAR(500) NULL
     - miro_board_id  VARCHAR(100) NULL
     - relation_type_dominant VARCHAR(20) NOT NULL DEFAULT 'opposite'
       (calculé après chaque add-perspective, pilote le naming UI dynamique
        Débat IA / Perspectives IA)

  2. Nouvelle table `debate_perspectives` (1-N max 3 par débat):
     - position 0 = perspective B initiale (backfillée pour les debates pré-v2)
     - position 1-2 = perspectives ajoutées via POST /api/debate/{id}/add-perspective
     - relation_type: opposite | complement | nuance
     - UniqueConstraint(debate_id, position) — garantit l'idempotence du backfill

  3. Backfill v1→v2 IDEMPOTENT:
     Pour chaque DebateAnalysis avec status='completed' et video_b_id non null,
     INSERT une row DebatePerspective(position=0, relation_type='opposite').
     ON CONFLICT (debate_id, position) DO NOTHING — peut être rejoué sans risque.

⚠️  Dépendance Sub-agent A: Cette migration `down_revision = "015_..."` SOIT
    en parallèle de la 016 (matching) du Sub-agent A. À l'application en prod,
    appliquer la 016 d'abord (table debate_video_b_candidates), puis la 017.

⚠️  Hetzner: pas d'`entrypoint.sh`, donc après merge:
        docker exec repo-backend-1 alembic upgrade head
        docker restart repo-backend-1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "017_debate_v2_perspectives"
down_revision: Union[str, None] = "015_add_search_index_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── 1. Nouvelles colonnes sur debate_analyses ───────────────────────────
    # Utilise add_column simple — Postgres permet ADD COLUMN IF NOT EXISTS via
    # `if_not_exists=True` mais Alembic ne supporte pas cet arg sur tous backends.
    # On vérifie d'abord l'existence pour rester idempotent côté Postgres + SQLite.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("debate_analyses")}

    if "miro_board_url" not in existing_cols:
        op.add_column(
            "debate_analyses",
            sa.Column("miro_board_url", sa.String(length=500), nullable=True),
        )
    if "miro_board_id" not in existing_cols:
        op.add_column(
            "debate_analyses",
            sa.Column("miro_board_id", sa.String(length=100), nullable=True),
        )
    if "relation_type_dominant" not in existing_cols:
        op.add_column(
            "debate_analyses",
            sa.Column(
                "relation_type_dominant",
                sa.String(length=20),
                nullable=False,
                server_default="opposite",
            ),
        )

    # ─── 2. Table debate_perspectives ────────────────────────────────────────
    existing_tables = set(inspector.get_table_names())
    if "debate_perspectives" not in existing_tables:
        op.create_table(
            "debate_perspectives",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "debate_id",
                sa.Integer(),
                sa.ForeignKey("debate_analyses.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("video_id", sa.String(length=100), nullable=False),
            sa.Column(
                "platform",
                sa.String(length=20),
                nullable=False,
                server_default="youtube",
            ),
            sa.Column("video_title", sa.String(length=500), nullable=True),
            sa.Column("video_channel", sa.String(length=255), nullable=True),
            sa.Column("video_thumbnail", sa.Text(), nullable=True),
            sa.Column("thesis", sa.Text(), nullable=True),
            sa.Column("arguments", sa.Text(), nullable=True),
            sa.Column(
                "relation_type",
                sa.String(length=20),
                nullable=False,
                server_default="opposite",
            ),
            sa.Column(
                "channel_quality_score",
                sa.Float(),
                nullable=True,
                server_default="0.5",
            ),
            sa.Column(
                "audience_level",
                sa.String(length=20),
                nullable=True,
                server_default="unknown",
            ),
            sa.Column("fact_check_results", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "debate_id", "position", name="uq_debate_perspective_position"
            ),
        )
        op.create_index(
            "idx_debate_perspectives_debate",
            "debate_perspectives",
            ["debate_id"],
        )
        op.create_index(
            "idx_debate_perspectives_debate_position",
            "debate_perspectives",
            ["debate_id", "position"],
        )

    # ─── 3. Backfill v1→v2 (IDEMPOTENT via UNIQUE + ON CONFLICT) ─────────────
    # Pour chaque debate_analyses.completed avec video_b_id, créer
    # une DebatePerspective(position=0, relation_type='opposite') si absente.
    #
    # SQLite: ON CONFLICT clause supportée depuis 3.24+. Le syntax est compatible
    # Postgres ↔ SQLite tant qu'on cible une UNIQUE constraint nommée.
    dialect_name = bind.dialect.name

    if dialect_name == "postgresql":
        op.execute(
            """
            INSERT INTO debate_perspectives (
                debate_id, position, video_id, platform,
                video_title, video_channel, video_thumbnail,
                thesis, arguments, relation_type,
                channel_quality_score, audience_level, fact_check_results,
                created_at
            )
            SELECT
                id,
                0,
                video_b_id,
                COALESCE(platform_b, 'youtube'),
                video_b_title,
                video_b_channel,
                video_b_thumbnail,
                thesis_b,
                arguments_b,
                'opposite',
                0.5,
                'unknown',
                fact_check_results,
                COALESCE(created_at, NOW())
            FROM debate_analyses
            WHERE status = 'completed' AND video_b_id IS NOT NULL
            ON CONFLICT (debate_id, position) DO NOTHING
            """
        )
    elif dialect_name == "sqlite":
        # SQLite supporte INSERT OR IGNORE pour idempotence sur UNIQUE constraint
        op.execute(
            """
            INSERT OR IGNORE INTO debate_perspectives (
                debate_id, position, video_id, platform,
                video_title, video_channel, video_thumbnail,
                thesis, arguments, relation_type,
                channel_quality_score, audience_level, fact_check_results,
                created_at
            )
            SELECT
                id,
                0,
                video_b_id,
                COALESCE(platform_b, 'youtube'),
                video_b_title,
                video_b_channel,
                video_b_thumbnail,
                thesis_b,
                arguments_b,
                'opposite',
                0.5,
                'unknown',
                fact_check_results,
                COALESCE(created_at, CURRENT_TIMESTAMP)
            FROM debate_analyses
            WHERE status = 'completed' AND video_b_id IS NOT NULL
            """
        )
    else:
        # Fallback générique — pas d'idempotence garantie sur dialectes inconnus
        # Mais pas de production hors PG/SQLite donc c'est OK
        op.execute(
            """
            INSERT INTO debate_perspectives (
                debate_id, position, video_id, platform,
                video_title, video_channel, video_thumbnail,
                thesis, arguments, relation_type,
                channel_quality_score, audience_level, fact_check_results,
                created_at
            )
            SELECT
                id,
                0,
                video_b_id,
                COALESCE(platform_b, 'youtube'),
                video_b_title,
                video_b_channel,
                video_b_thumbnail,
                thesis_b,
                arguments_b,
                'opposite',
                0.5,
                'unknown',
                fact_check_results,
                created_at
            FROM debate_analyses
            WHERE status = 'completed' AND video_b_id IS NOT NULL
              AND id NOT IN (SELECT debate_id FROM debate_perspectives WHERE position = 0)
            """
        )


def downgrade() -> None:
    # Drop table → cascade les rows. Drop indexes d'abord pour éviter warnings.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "debate_perspectives" in existing_tables:
        op.drop_index(
            "idx_debate_perspectives_debate_position",
            table_name="debate_perspectives",
        )
        op.drop_index(
            "idx_debate_perspectives_debate",
            table_name="debate_perspectives",
        )
        op.drop_table("debate_perspectives")

    existing_cols = {c["name"] for c in inspector.get_columns("debate_analyses")}
    if "relation_type_dominant" in existing_cols:
        op.drop_column("debate_analyses", "relation_type_dominant")
    if "miro_board_id" in existing_cols:
        op.drop_column("debate_analyses", "miro_board_id")
    if "miro_board_url" in existing_cols:
        op.drop_column("debate_analyses", "miro_board_url")
