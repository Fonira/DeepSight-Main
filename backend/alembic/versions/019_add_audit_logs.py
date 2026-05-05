"""audit_logs — RGPD-compliant audit trail for sensitive user actions.

Revision ID: 019_add_audit_logs
Revises: 018_hub_workspace
Create Date: 2026-05-05

EU compliance sprint — chantier C2.

Records sensitive actions a user (or admin acting on behalf of a user)
takes on an account: deletion, plan change, password change/reset, data
export. Distinct from `admin_logs` (which only covers admin-initiated
actions) — this table is the canonical Article 30 GDPR processing record.

No backfill — historical actions are not retroactively recorded.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_add_audit_logs"
down_revision: Union[str, None] = "018_hub_workspace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "audit_logs" not in existing_tables:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            # The user the action is ABOUT (target). NULL only if the user
            # was deleted and we want to preserve the audit trail.
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            # The user who PERFORMED the action. Same as user_id for self-
            # actions, different when an admin acts on behalf of a user.
            # NULL for system-initiated actions (cron, webhook, scheduler).
            sa.Column(
                "actor_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            # Action identifier in dot notation. e.g.:
            #   account.deleted, plan.changed, password.changed,
            #   password.reset, data.exported, account.created, login.failed
            sa.Column("action", sa.String(length=80), nullable=False, index=True),
            # Free-form JSON context: {"from_plan": "free", "to_plan": "pro"}
            sa.Column("details", sa.JSON(), nullable=True),
            sa.Column("ip_address", sa.String(length=45), nullable=True),  # IPv6 max
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
                index=True,
            ),
        )
        op.create_index(
            "idx_audit_logs_user_created",
            "audit_logs",
            ["user_id", sa.text("created_at DESC")],
        )
        op.create_index(
            "idx_audit_logs_action_created",
            "audit_logs",
            ["action", sa.text("created_at DESC")],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "audit_logs" in existing_tables:
        try:
            op.drop_index("idx_audit_logs_action_created", table_name="audit_logs")
        except Exception:
            pass
        try:
            op.drop_index("idx_audit_logs_user_created", table_name="audit_logs")
        except Exception:
            pass
        op.drop_table("audit_logs")
