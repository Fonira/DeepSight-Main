"""academic scholar — scholar_id on academic_papers + scholar_queries on daily_quotas

Revision ID: 030_academic_scholar
Revises: 029_summary_community
Create Date: 2026-05-17

Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md § 7

Idempotent : skips column add if it already exists. Downgrade drops the
added columns. Naming convention follows DeepSight Alembic guidelines
(<= 32 chars, prefixed with sequence number).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "030_academic_scholar"
down_revision: Union[str, None] = "029_summary_community"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "academic_papers" in tables:
        cols = {c["name"] for c in inspector.get_columns("academic_papers")}
        if "scholar_id" not in cols:
            op.add_column(
                "academic_papers",
                sa.Column("scholar_id", sa.String(length=64), nullable=True),
            )

    if "daily_quotas" in tables:
        cols = {c["name"] for c in inspector.get_columns("daily_quotas")}
        if "scholar_queries" not in cols:
            op.add_column(
                "daily_quotas",
                sa.Column(
                    "scholar_queries",
                    sa.Integer(),
                    nullable=False,
                    server_default="0",
                ),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "daily_quotas" in tables:
        cols = {c["name"] for c in inspector.get_columns("daily_quotas")}
        if "scholar_queries" in cols:
            op.drop_column("daily_quotas", "scholar_queries")

    if "academic_papers" in tables:
        cols = {c["name"] for c in inspector.get_columns("academic_papers")}
        if "scholar_id" in cols:
            op.drop_column("academic_papers", "scholar_id")
