"""email_dlq — Dead Letter Queue for failed Resend emails

Revision ID: 019_add_email_dlq
Revises: 018_hub_workspace
Create Date: 2026-05-05

Sprint scalabilité — chantier B (fix bug Resend 429 errors, ~56/24h en prod).

Crée la table `email_dlq` qui persiste les emails dont l'envoi a définitivement
échoué après N retries (429 Resend) ou sur erreurs 4xx non récupérables (422
template invalid, 403 forbidden, etc.). Permet le replay manuel via l'endpoint
admin `POST /api/admin/email-dlq/{id}/replay`.

Idempotente : `if not exists` partout.

Spec : voir prompt sprint scalabilité (chantier B) et docs/RUNBOOK.md §19.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_add_email_dlq"
down_revision: Union[str, None] = "018_hub_workspace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "email_dlq" not in existing_tables:
        op.create_table(
            "email_dlq",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            sa.Column("email_to", sa.String(length=320), nullable=False),
            sa.Column("subject", sa.String(length=500), nullable=False),
            sa.Column("body_html", sa.Text(), nullable=False),
            sa.Column("body_text", sa.Text(), nullable=True),
            sa.Column(
                "template_name",
                sa.String(length=100),
                nullable=True,
            ),
            sa.Column(
                "priority",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "failed_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
                index=True,
            ),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column(
                "error_status_code",
                sa.Integer(),
                nullable=True,
            ),
            sa.Column(
                "attempts",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            ),
            sa.Column(
                "replay_status",
                sa.String(length=20),
                nullable=False,
                server_default="pending",
            ),  # pending | replayed | abandoned | failed_again
            sa.Column(
                "replayed_at",
                sa.DateTime(),
                nullable=True,
            ),
            sa.Column(
                "replayed_by_admin_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        # Index pour les queries admin (status + recency)
        op.create_index(
            "idx_email_dlq_status_failed_at",
            "email_dlq",
            ["replay_status", sa.text("failed_at DESC")],
        )
        op.create_index(
            "idx_email_dlq_email_to",
            "email_dlq",
            ["email_to"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "email_dlq" in existing_tables:
        try:
            op.drop_index("idx_email_dlq_email_to", table_name="email_dlq")
        except Exception:
            pass
        try:
            op.drop_index(
                "idx_email_dlq_status_failed_at", table_name="email_dlq"
            )
        except Exception:
            pass
        op.drop_table("email_dlq")
