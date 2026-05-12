"""Email DLQ persistence helper.

Sprint scalabilité — chantier B.

Centralizes the logic to persist a failed email into the ``email_dlq`` table
and to log a structured metric event (consumable by PostHog server-side or any
future log aggregator like Axiom).

Used by ``services.email_queue.EmailQueue`` when an email definitively fails
(429 retries exhausted, 4xx non-recoverable, or 5xx exhausted).

Replay path: ``backend/src/admin/email_dlq_router.py``.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError

# Note: ``async_session_factory`` is imported lazily inside ``persist_failed_email``
# so tests can monkey-patch it on the ``db.database`` module before the service
# is invoked (without re-importing this module).
from db.database import EmailDLQ

logger = logging.getLogger("deepsight.email_dlq")


async def persist_failed_email(
    *,
    email_to: str,
    subject: str,
    html: str,
    text: str = "",
    user_id: Optional[int] = None,
    template_name: Optional[str] = None,
    priority: bool = False,
    error_message: str,
    error_status_code: Optional[int] = None,
    attempts: int = 1,
) -> Optional[int]:
    """Insert a failed email into the ``email_dlq`` table.

    Opens its own DB session (independent of any HTTP request) so it can be
    called from background workers like ``EmailQueue._worker_loop``.

    Returns the new DLQ row id on success, or None on DB failure (logged).
    """
    try:
        # Lazy import so tests can monkeypatch db.database.async_session_factory
        from db import database as _db

        async with _db.async_session_factory() as session:
            row = EmailDLQ(
                user_id=user_id,
                email_to=email_to,
                subject=subject[:500] if subject else "",
                body_html=html or "",
                body_text=text or None,
                template_name=template_name,
                priority=priority,
                error_message=error_message,
                error_status_code=error_status_code,
                attempts=attempts,
                replay_status="pending",
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            new_id = row.id

        logger.error(
            "email.dlq",
            extra={
                "metric": "email.dlq",
                "dlq_id": new_id,
                "email_to": email_to,
                "subject": subject[:80] if subject else "",
                "status_code": error_status_code,
                "attempts": attempts,
                "template_name": template_name,
            },
        )
        return new_id
    except SQLAlchemyError as e:
        logger.error("Failed to persist email to DLQ: %s — to=%s", e, email_to)
        return None
    except Exception as e:  # noqa: BLE001 — defense in depth
        logger.error("Unexpected error persisting email to DLQ: %s — to=%s", e, email_to)
        return None
