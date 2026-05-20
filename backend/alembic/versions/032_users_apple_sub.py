"""users_apple_sub — colonne unique pour le Sign in with Apple

Revision ID: 032_users_apple_sub
Revises: 031_summary_ext_pages
Create Date: 2026-05-20

Spec : Apple Sign In tri-plateforme (mirror Google OAuth).

Ajoute `users.apple_sub VARCHAR(255) UNIQUE NULL` (Apple "sub" claim — identifiant
stable et opaque par utilisateur, équivalent de `google_id`). Indexé pour les
lookups par OAuth, nullable pour ne pas casser les comptes email-only / Google-only.

Convention DeepSight Alembic :
- Revision ID ≤ 32 chars : "032_users_apple_sub" = 19 chars ✓
- Migration idempotente : add only if not exists, drop only if exists.
- Compatible PostgreSQL ET SQLite.

Entrypoint Docker exécute `alembic upgrade heads` (plural) à chaque container
start, donc on doit rester safe sur re-run.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "032_users_apple_sub"
down_revision: Union[str, None] = "031_summary_ext_pages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "apple_sub" in columns:
        return

    op.add_column(
        "users",
        sa.Column("apple_sub", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_users_apple_sub",
        "users",
        ["apple_sub"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "users" not in inspector.get_table_names():
        return

    indexes = {ix["name"] for ix in inspector.get_indexes("users")}
    if "ix_users_apple_sub" in indexes:
        op.drop_index("ix_users_apple_sub", table_name="users")

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "apple_sub" in columns:
        op.drop_column("users", "apple_sub")
