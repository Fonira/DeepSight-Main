"""Add User.preferences JSON column (Ambient Lighting v3 foundation).

Revision ID: 008_add_user_preferences_json
Revises: 007_unify_chat_voice_messages
Create Date: 2026-04-27

Adds a flexible JSON column ``preferences`` on ``users``. This is intentionally
a generic key/value bag rather than discrete columns, so that future UI prefs
(theme variant, ambient lighting toggle, list density, etc.) don't require a
schema migration each time.

The first key seeded by application logic is ``ambient_lighting_enabled``
(default true if absent — see core/preferences.py reader).

Backward compatibility:
  - Default ``{}`` for existing rows (server_default).
  - Reader code (auth/service.py update_user_preferences) tolerates None.
  - Cross-DB: ``sa.JSON()`` becomes JSONB on PostgreSQL and TEXT on SQLite,
    so the server_default ``'{}'`` works in both dialects.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "008_add_user_preferences_json"
down_revision: Union[str, None] = "007_unify_chat_voice_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "preferences",
            sa.JSON(),
            nullable=True,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "preferences")
