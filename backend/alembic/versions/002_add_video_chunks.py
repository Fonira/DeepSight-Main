"""Add video_chunks table and full_digest column to summaries

Revision ID: 002_add_video_chunks
Revises: 001_initial_schema
Create Date: 2026-02-14

Hierarchical Digest Pipeline:
- video_chunks: stores transcript chunks with timing and mini-summaries
- summaries.full_digest: assembled comprehensive digest from all chunks
"""
from alembic import op
import sqlalchemy as sa

revision = '002_add_video_chunks'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add full_digest column to summaries
    op.add_column('summaries', sa.Column('full_digest', sa.Text(), nullable=True))

    # Create video_chunks table
    op.create_table(
        'video_chunks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('summary_id', sa.Integer(), sa.ForeignKey('summaries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('start_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('end_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('chunk_digest', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_video_chunks_summary_id', 'video_chunks', ['summary_id'])
    op.create_index('ix_video_chunks_summary_chunk', 'video_chunks', ['summary_id', 'chunk_index'])


def downgrade() -> None:
    op.drop_index('ix_video_chunks_summary_chunk', 'video_chunks')
    op.drop_index('ix_video_chunks_summary_id', 'video_chunks')
    op.drop_table('video_chunks')
    op.drop_column('summaries', 'full_digest')
