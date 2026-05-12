"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📨 ADMIN — EMAIL DLQ ROUTER                                                       ║
║                                                                                    ║
║  Sprint scalabilité — chantier B (fix bug Resend 429 errors).                      ║
║                                                                                    ║
║  Endpoints admin pour visualiser et rejouer les emails dans la Dead Letter         ║
║  Queue (table ``email_dlq``).                                                      ║
║                                                                                    ║
║  GET  /api/admin/email-dlq                  → liste paginée (filtres status/email) ║
║  GET  /api/admin/email-dlq/stats            → compteurs par status                 ║
║  POST /api/admin/email-dlq/{id}/replay      → re-tente l'envoi via la queue        ║
║  POST /api/admin/email-dlq/{id}/abandon     → marque comme abandonné (manuel)      ║
║                                                                                    ║
║  Voir docs/RUNBOOK.md §19 "Email DLQ et replay" pour le runbook humain.            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_admin
from db.database import EmailDLQ, User, get_session

logger = logging.getLogger("deepsight.admin.email_dlq")

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class EmailDLQItem(BaseModel):
    id: int
    user_id: Optional[int]
    email_to: str
    subject: str
    template_name: Optional[str]
    priority: bool
    failed_at: datetime
    error_message: Optional[str]
    error_status_code: Optional[int]
    attempts: int
    replay_status: str
    replayed_at: Optional[datetime]
    replayed_by_admin_id: Optional[int]


class EmailDLQListResponse(BaseModel):
    items: List[EmailDLQItem]
    total: int
    limit: int
    offset: int


class EmailDLQStatsResponse(BaseModel):
    total: int
    pending: int
    replayed: int
    failed_again: int
    abandoned: int
    last_24h: int


class EmailDLQReplayResponse(BaseModel):
    success: bool
    dlq_id: int
    new_status: str
    message: str


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 LIST + STATS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/email-dlq", response_model=EmailDLQListResponse)
async def list_email_dlq(
    status: Optional[str] = Query(
        None,
        description="Filter by replay_status: pending|replayed|failed_again|abandoned",
        pattern="^(pending|replayed|failed_again|abandoned)$",
    ),
    email_to: Optional[str] = Query(None, description="Filter by recipient email (exact match)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    """List failed emails in the DLQ. Most recent first."""
    where_clauses = []
    if status:
        where_clauses.append(EmailDLQ.replay_status == status)
    if email_to:
        where_clauses.append(EmailDLQ.email_to == email_to)

    base_stmt = select(EmailDLQ)
    count_stmt = select(func.count(EmailDLQ.id))
    for clause in where_clauses:
        base_stmt = base_stmt.where(clause)
        count_stmt = count_stmt.where(clause)

    total_result = await session.execute(count_stmt)
    total = int(total_result.scalar() or 0)

    list_stmt = base_stmt.order_by(desc(EmailDLQ.failed_at)).limit(limit).offset(offset)
    rows = (await session.execute(list_stmt)).scalars().all()

    items = [
        EmailDLQItem(
            id=row.id,
            user_id=row.user_id,
            email_to=row.email_to,
            subject=row.subject,
            template_name=row.template_name,
            priority=bool(row.priority),
            failed_at=row.failed_at,
            error_message=row.error_message,
            error_status_code=row.error_status_code,
            attempts=row.attempts,
            replay_status=row.replay_status,
            replayed_at=row.replayed_at,
            replayed_by_admin_id=row.replayed_by_admin_id,
        )
        for row in rows
    ]
    return EmailDLQListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/email-dlq/stats", response_model=EmailDLQStatsResponse)
async def email_dlq_stats(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    """Compteurs par status (pour dashboard ops)."""
    total_q = await session.execute(select(func.count(EmailDLQ.id)))
    total = int(total_q.scalar() or 0)

    counts: dict[str, int] = {}
    for status in ("pending", "replayed", "failed_again", "abandoned"):
        q = await session.execute(select(func.count(EmailDLQ.id)).where(EmailDLQ.replay_status == status))
        counts[status] = int(q.scalar() or 0)

    # Last 24h: portable PG/SQLite via Python-side timestamp.
    from datetime import timedelta as _td

    cutoff = datetime.utcnow() - _td(hours=24)
    last_24h_q = await session.execute(select(func.count(EmailDLQ.id)).where(EmailDLQ.failed_at >= cutoff))
    last_24h = int(last_24h_q.scalar() or 0)

    return EmailDLQStatsResponse(
        total=total,
        pending=counts.get("pending", 0),
        replayed=counts.get("replayed", 0),
        failed_again=counts.get("failed_again", 0),
        abandoned=counts.get("abandoned", 0),
        last_24h=last_24h,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 REPLAY + ABANDON
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/email-dlq/{dlq_id}/replay", response_model=EmailDLQReplayResponse)
async def replay_email_dlq(
    dlq_id: int,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    """Re-queue a DLQ'd email for sending.

    Marks the row as ``replayed`` if the queue accepts it. If the email fails
    again, the second send will create a NEW DLQ entry, and this row stays
    flagged ``replayed`` (audit trail).
    """
    row = (await session.execute(select(EmailDLQ).where(EmailDLQ.id == dlq_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=f"Email DLQ entry {dlq_id} not found")

    if row.replay_status not in ("pending", "failed_again"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot replay email DLQ {dlq_id}: status={row.replay_status} (must be pending or failed_again)",
        )

    # Re-enqueue via the throttled email queue (which goes through the global rate limiter).
    from services.email_queue import email_queue

    try:
        ok = await email_queue.enqueue(
            to=row.email_to,
            subject=row.subject,
            html=row.body_html,
            text=row.body_text or "",
            priority=bool(row.priority),
            user_id=row.user_id,
            template_name=row.template_name,
        )
    except Exception as e:
        logger.error(f"Replay enqueue raised for DLQ id={dlq_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Replay failed: {e}")

    if not ok:
        # Queue full or email disabled
        await session.execute(
            update(EmailDLQ)
            .where(EmailDLQ.id == dlq_id)
            .values(
                replay_status="failed_again",
                replayed_at=datetime.utcnow(),
                replayed_by_admin_id=admin.id,
            )
        )
        await session.commit()
        return EmailDLQReplayResponse(
            success=False,
            dlq_id=dlq_id,
            new_status="failed_again",
            message="Email queue refused enqueue (full or disabled). Marked failed_again.",
        )

    # Optimistic: enqueue accepted → mark replayed. The actual send still has to succeed
    # but if it doesn't, a NEW DLQ row will be created (audit trail preserved).
    await session.execute(
        update(EmailDLQ)
        .where(EmailDLQ.id == dlq_id)
        .values(
            replay_status="replayed",
            replayed_at=datetime.utcnow(),
            replayed_by_admin_id=admin.id,
        )
    )
    await session.commit()
    logger.info(
        "email.dlq.replay",
        extra={
            "metric": "email.dlq.replay",
            "dlq_id": dlq_id,
            "admin_id": admin.id,
            "email_to": row.email_to,
        },
    )
    return EmailDLQReplayResponse(
        success=True,
        dlq_id=dlq_id,
        new_status="replayed",
        message="Email re-enqueued successfully. If it fails again, a NEW DLQ entry will be created.",
    )


@router.post("/email-dlq/{dlq_id}/abandon", response_model=EmailDLQReplayResponse)
async def abandon_email_dlq(
    dlq_id: int,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    """Mark a DLQ entry as ``abandoned`` (e.g. broken template, deleted user)."""
    row = (await session.execute(select(EmailDLQ).where(EmailDLQ.id == dlq_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=f"Email DLQ entry {dlq_id} not found")

    await session.execute(
        update(EmailDLQ)
        .where(EmailDLQ.id == dlq_id)
        .values(
            replay_status="abandoned",
            replayed_at=datetime.utcnow(),
            replayed_by_admin_id=admin.id,
        )
    )
    await session.commit()
    logger.info(
        "email.dlq.abandon",
        extra={
            "metric": "email.dlq.abandon",
            "dlq_id": dlq_id,
            "admin_id": admin.id,
            "email_to": row.email_to,
        },
    )
    return EmailDLQReplayResponse(
        success=True,
        dlq_id=dlq_id,
        new_status="abandoned",
        message="Marked abandoned (no further replay attempts).",
    )
