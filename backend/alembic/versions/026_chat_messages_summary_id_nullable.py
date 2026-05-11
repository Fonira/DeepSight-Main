"""chat_messages.summary_id nullable — fix knowledge_tutor + companion crash

Revision ID: 026_chatmsg_summary_null
Revises: 025_summary_is_public
Create Date: 2026-05-11

Bug Sentry PYTHON-FASTAPI-27 (28 occurrences depuis 2026-04-29) :
`chat_messages.summary_id` est `NOT NULL` en prod alors que le model Python
(`db/database.py:ChatMessage`) déclare `nullable=True` depuis le merge du
spec voice unified timeline (migration 007). La migration 007 n'avait pas
propagé le drop NOT NULL → tout INSERT sans `summary_id` crash en
`NotNullViolationError`.

Cas qui passent sans `summary_id` (et donc crashent jusqu'à ce fix) :
  • Agent voice COMPANION (sans vidéo)
  • Agent voice KNOWLEDGE_TUTOR (PR #439, deployed prod 2026-05-11) —
    introspection globale de l'historique, pas de vidéo en cours
  • Tout futur agent voice `requires_summary=False`

Cascade observée : rollback async dans un context corrompu ré-émet
`MissingGreenlet` côté SQLAlchemy, pollue le pool DB, fait timeout les
endpoints concurrents (notamment `/api/history/videos` → "Erreur réseau"
côté frontend).

Migration idempotente : check is_nullable avant ALTER. Aucune data n'est
modifiée, seulement la contrainte de colonne. Down-migration restaure
NOT NULL si jamais besoin (mais data avec NULL existant après ce fix
empêcherait le downgrade — ce qui est volontaire, NOT NULL était un
bug).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "026_chatmsg_summary_null"
down_revision: Union[str, None] = "025_summary_is_public"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop NOT NULL on chat_messages.summary_id."""
    bind = op.get_bind()

    # Idempotence : check si la colonne est déjà nullable.
    result = bind.execute(
        sa.text(
            """
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'chat_messages'
              AND column_name = 'summary_id'
            """
        )
    ).scalar()

    if result == "YES":
        # Déjà nullable — rien à faire.
        return

    op.alter_column(
        "chat_messages",
        "summary_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    """Restore NOT NULL on chat_messages.summary_id.

    ⚠️ ATTENTION : ce downgrade échoue si des rows ont déjà
    `summary_id IS NULL` (cas attendu après upgrade + utilisation
    knowledge_tutor / companion). Pour rollback effectif, il faudrait
    soit DELETE les rows orphelines, soit set un summary_id placeholder
    — décision produit, donc on laisse le downgrade strict.
    """
    op.alter_column(
        "chat_messages",
        "summary_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
