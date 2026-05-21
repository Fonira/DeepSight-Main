"""user_sessions — table de sessions multi-device pour Auth V2 (Wave 1 Step 1)

Revision ID: 033_user_sessions
Revises: 032_users_apple_sub
Create Date: 2026-05-21

Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4

Crée la table `user_sessions` qui pose les fondations de l'Auth V2 :
- 1 ligne = 1 session refresh actif sur 1 device (multi-device natif)
- `refresh_token_hash` SHA-256 unique → support rotation single-use
- `device_label` parsé du user-agent server-side (« Chrome on macOS »)
- `ip_hash` SHA-256(ip + IP_HASH_SALT) anonymisé (compliance RGPD V2)
- TTLs séparés : `sliding_expires_at` (30j sliding) + `absolute_expires_at` (90j cap)
- `stay_signed_in` toggle bool piloté par le client au login
- `revoked_at` soft-delete pour audit (jamais hard-delete une session)

Convention DeepSight Alembic :
- Revision ID ≤ 32 chars : "033_user_sessions" = 17 chars ✓
- Migration idempotente : create only if not exists.
- Cross-DB : `String(36)` UUID textuel (cf VoiceSession) — pas de
  PostgreSQL UUID(as_uuid=True) qui casserait SQLite local.
- Entrypoint Docker exécute `alembic upgrade heads` (plural) à chaque
  container start, donc on doit rester safe sur re-run.

Indexes :
- ix_user_sessions_user_id : lookup sessions par user (page « Appareils actifs »)
- ix_user_sessions_user_id_revoked_at : filtrage sessions actives d'un user
- ix_user_sessions_sliding_expires_at : background sweeper sessions expirées
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "033_user_sessions"
down_revision: Union[str, None] = "032_users_apple_sub"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "user_sessions" in existing_tables:
        # Idempotent : déjà appliquée
        return

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("refresh_token_hash", sa.String(64), nullable=False),
        sa.Column("device_label", sa.String(255), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column(
            "stay_signed_in",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "issued_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("sliding_expires_at", sa.DateTime, nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint(
            "refresh_token_hash",
            name="uq_user_sessions_refresh_token_hash",
        ),
    )

    op.create_index(
        "ix_user_sessions_user_id",
        "user_sessions",
        ["user_id"],
    )
    op.create_index(
        "ix_user_sessions_user_id_revoked_at",
        "user_sessions",
        ["user_id", "revoked_at"],
    )
    op.create_index(
        "ix_user_sessions_sliding_expires_at",
        "user_sessions",
        ["sliding_expires_at"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "user_sessions" not in existing_tables:
        return

    op.drop_index(
        "ix_user_sessions_sliding_expires_at",
        table_name="user_sessions",
    )
    op.drop_index(
        "ix_user_sessions_user_id_revoked_at",
        table_name="user_sessions",
    )
    op.drop_index(
        "ix_user_sessions_user_id",
        table_name="user_sessions",
    )
    op.drop_table("user_sessions")
