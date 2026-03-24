"""Add engagement metadata columns to summaries table

Revision ID: 005_add_engagement_metadata
Revises: 004_add_voice_tables
Create Date: 2026-03-24

Stores engagement metrics (views, likes, comments, shares, subscribers),
content type (video/carousel/short), source tags, description, channel ID,
TikTok music info, and carousel image URLs.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '005_add_engagement_metadata'
down_revision: Union[str, None] = '004_add_voice_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Engagement metrics
    op.add_column('summaries', sa.Column('view_count', sa.Integer, nullable=True))
    op.add_column('summaries', sa.Column('like_count', sa.Integer, nullable=True))
    op.add_column('summaries', sa.Column('comment_count', sa.Integer, nullable=True))
    op.add_column('summaries', sa.Column('share_count', sa.Integer, nullable=True))
    op.add_column('summaries', sa.Column('channel_follower_count', sa.Integer, nullable=True))

    # Content type (video, carousel, short, live)
    op.add_column('summaries', sa.Column('content_type', sa.String(20), server_default='video', nullable=True))

    # Source metadata (distinct from AI-extracted Summary.tags)
    op.add_column('summaries', sa.Column('source_tags_json', sa.Text, nullable=True))
    op.add_column('summaries', sa.Column('video_description', sa.Text, nullable=True))
    op.add_column('summaries', sa.Column('channel_id', sa.String(100), nullable=True))

    # TikTok music info
    op.add_column('summaries', sa.Column('music_title', sa.String(255), nullable=True))
    op.add_column('summaries', sa.Column('music_author', sa.String(255), nullable=True))

    # Carousel images (JSON array of URLs)
    op.add_column('summaries', sa.Column('carousel_images_json', sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column('summaries', 'carousel_images_json')
    op.drop_column('summaries', 'music_author')
    op.drop_column('summaries', 'music_title')
    op.drop_column('summaries', 'channel_id')
    op.drop_column('summaries', 'video_description')
    op.drop_column('summaries', 'source_tags_json')
    op.drop_column('summaries', 'content_type')
    op.drop_column('summaries', 'channel_follower_count')
    op.drop_column('summaries', 'share_count')
    op.drop_column('summaries', 'comment_count')
    op.drop_column('summaries', 'like_count')
    op.drop_column('summaries', 'view_count')
