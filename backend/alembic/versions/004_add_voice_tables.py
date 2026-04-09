"""Add voice_sessions, voice_quotas tables and users.voice_bonus_seconds column

Revision ID: 004_add_voice_tables
Revises: 003_add_transcript_cache
Create Date: 2026-03-23

Voice conversation feature: ElevenLabs agent sessions, per-user monthly quotas,
and bonus seconds tracking.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '004_add_voice_tables'
down_revision: Union[str, None] = '003_add_transcript_cache'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- voice_sessions ---
    op.create_table(
        'voice_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('summary_id', sa.Integer, sa.ForeignKey('summaries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('elevenlabs_agent_id', sa.String(100), nullable=True),
        sa.Column('elevenlabs_conversation_id', sa.String(100), nullable=True),
        sa.Column('started_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime, nullable=True),
        sa.Column('duration_seconds', sa.Integer, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('conversation_transcript', sa.Text, nullable=True),
        sa.Column('language', sa.String(5), server_default='fr'),
        sa.Column('platform', sa.String(20), server_default='web'),
    )

    op.create_index('ix_voice_sessions_user_id', 'voice_sessions', ['user_id'])
    op.create_index('ix_voice_sessions_summary_id', 'voice_sessions', ['summary_id'])
    op.create_index('ix_voice_sessions_status', 'voice_sessions', ['status'])
    op.create_index('ix_voice_sessions_elevenlabs_conversation_id', 'voice_sessions', ['elevenlabs_conversation_id'])
    op.create_index('ix_voice_sessions_user_started', 'voice_sessions', ['user_id', 'started_at'])

    # --- voice_quotas ---
    op.create_table(
        'voice_quotas',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('year', sa.Integer, nullable=False),
        sa.Column('month', sa.Integer, nullable=False),
        sa.Column('seconds_used', sa.Integer, nullable=False, server_default='0'),
        sa.Column('seconds_limit', sa.Integer, nullable=False),
        sa.Column('sessions_count', sa.Integer, nullable=False, server_default='0'),
        sa.UniqueConstraint('user_id', 'year', 'month', name='uq_voice_quotas_user_year_month'),
    )

    # --- users.voice_bonus_seconds ---
    op.add_column('users', sa.Column('voice_bonus_seconds', sa.Integer, server_default='0'))


def downgrade() -> None:
    op.drop_column('users', 'voice_bonus_seconds')
    op.drop_table('voice_quotas')
    # Indexes are dropped automatically with the table
    op.drop_table('voice_sessions')
