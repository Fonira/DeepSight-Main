"""RGPD audit log helper.

Records sensitive user actions in the `audit_logs` table for Article 30
GDPR compliance. Use the `log_audit()` helper from any endpoint that
mutates user-significant state.

Design:
- Caller controls transaction boundary (no commit inside).
- Failures are logged but never raised — audit logging must not break
  the parent flow (worst case: missing audit entry, surfaced via Sentry).
- IP and User-Agent extracted from FastAPI Request when provided.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from db.database import AuditLog


async def log_audit(
    session: AsyncSession,
    *,
    action: str,
    user_id: Optional[int] = None,
    actor_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Append an audit log entry.

    Args:
        session: Active SQLAlchemy AsyncSession (caller commits).
        action: Dot-notation action identifier (e.g. "plan.changed",
            "account.deleted", "password.reset", "data.exported").
        user_id: Target user (subject of the action). For self-actions
            this is the same as actor_id.
        actor_id: User who performed the action. Defaults to user_id
            for self-service flows. Pass an admin's id when an admin
            acts on behalf of a user.
        details: Free-form JSON context (e.g. {"from_plan": "free",
            "to_plan": "pro", "stripe_session_id": "cs_..."}).
        request: FastAPI Request — if provided, IP and User-Agent are
            captured for forensic purposes.

    Never raises. Failures are logged via Sentry-aware logger.
    """
    try:
        ip_address: Optional[str] = None
        user_agent: Optional[str] = None
        if request is not None:
            try:
                ip_address = request.client.host if request.client else None
                user_agent = (request.headers.get("user-agent") or "")[:500] or None
            except Exception:
                pass

        entry = AuditLog(
            user_id=user_id,
            actor_id=actor_id if actor_id is not None else user_id,
            action=action,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(entry)
        # Caller commits as part of the parent transaction.
    except Exception as e:
        # Never break the calling flow — audit failure is non-fatal.
        logger.error("audit_log: failed to record action=%s: %s", action, e)
