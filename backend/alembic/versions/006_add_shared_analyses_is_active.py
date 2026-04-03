"""Add is_active column to shared_analyses table

Revision ID: 006_add_shared_analyses_is_active
Revises: 005_add_engagement_metadata
Create Date: 2026-04-03

Adds an is_active boolean flag for soft-delete of share links.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '006_add_shared_analyses_is_active'
down_revision: Union[str, None] = '005_add_engagement_metadata'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'shared_analyses',
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true')
    )


def downgrade() -> None:
    op.drop_column('shared_analyses', 'is_active')
