"""Add transcript_cache and transcript_cache_chunks tables

Revision ID: 003_add_transcript_cache
Revises: 002_add_video_chunks
Create Date: 2026-03-08

Persistent L2 cache for transcripts (cross-user).
YouTube long videos (3h30+) are stored in multiple chunks.
TikTok videos always use a single chunk.
"""
from alembic import op
import sqlalchemy as sa

revision = '003_add_transcript_cache'
down_revision = '002_add_video_chunks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # transcript_cache: one row per unique video
    op.create_table(
        'transcript_cache',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('video_id', sa.String(100), unique=True, nullable=False),
        sa.Column('platform', sa.String(20), nullable=False, server_default='youtube'),
        sa.Column('lang', sa.String(10), nullable=True),
        sa.Column('char_count', sa.Integer(), server_default='0'),
        sa.Column('extraction_method', sa.String(50), nullable=True),
        sa.Column('chunk_count', sa.Integer(), server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('idx_transcript_cache_video', 'transcript_cache', ['video_id'])
    op.create_index('idx_transcript_cache_platform', 'transcript_cache', ['platform'])

    # transcript_cache_chunks: transcript content split into chunks
    op.create_table(
        'transcript_cache_chunks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('cache_id', sa.Integer(), sa.ForeignKey('transcript_cache.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('transcript_simple', sa.Text(), nullable=True),
        sa.Column('transcript_timestamped', sa.Text(), nullable=True),
    )
    op.create_index('idx_transcript_cache_chunks_cache', 'transcript_cache_chunks', ['cache_id'])
    op.create_unique_constraint('uix_cache_chunk_index', 'transcript_cache_chunks', ['cache_id', 'chunk_index'])


def downgrade() -> None:
    op.drop_constraint('uix_cache_chunk_index', 'transcript_cache_chunks', type_='unique')
    op.drop_index('idx_transcript_cache_chunks_cache', 'transcript_cache_chunks')
    op.drop_table('transcript_cache_chunks')
    op.drop_index('idx_transcript_cache_platform', 'transcript_cache')
    op.drop_index('idx_transcript_cache_video', 'transcript_cache')
    op.drop_table('transcript_cache')
