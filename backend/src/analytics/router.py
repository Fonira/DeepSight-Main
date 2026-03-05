"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 ANALYTICS SERVICE v1.0 — Événements mobile/web/extension                     ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Réception batch d'événements depuis les clients                               ║
║  • Stockage léger en DB (table analytics_events)                                 ║
║  • Dashboard admin basique                                                        ║
║  • Zéro dépendance externe (pas de PostHog/Mixpanel)                             ║
║  • Railway-friendly : < 1MB mémoire par batch                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User, AnalyticsEvent
from auth.dependencies import get_current_user

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class EventPayload(BaseModel):
    name: str
    properties: Optional[dict] = None
    timestamp: str
    session_id: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        allowed = {
            "app_opened", "app_backgrounded", "screen_viewed",
            "analysis_started", "analysis_completed", "analysis_failed",
            "chat_message_sent", "tab_switched",
            "share_intent_received", "upgrade_cta_viewed", "upgrade_cta_clicked",
            "search_performed", "flashcard_generated", "quiz_generated",
            "mindmap_generated", "factcheck_requested", "export_requested",
            "favorite_toggled", "video_deleted",
            "notification_received", "notification_tapped",
            "share_link_created", "login", "register", "logout",
            "study_content_generated", "upgrade_plan_selected",
            "upgrade_checkout_started", "analysis_deleted",
        }
        if v not in allowed:
            raise ValueError(f"Unknown event: {v}")
        return v


class EventBatch(BaseModel):
    events: list[EventPayload]
    platform: str = "mobile"

    @field_validator("events")
    @classmethod
    def limit_batch(cls, v: list) -> list:
        if len(v) > 100:
            raise ValueError("Max 100 events per batch")
        return v


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 INGESTION
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/events")
async def ingest_events(
    batch: EventBatch,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """
    📊 Reçoit un batch d'événements analytics.
    Pas d'auth requise (les événements pré-login sont aussi importants).
    Le user_id est extrait des properties si présent.
    """
    # Rate limit basique par IP
    client_ip = request.client.host if request.client else "unknown"

    inserted = 0
    for event in batch.events:
        try:
            user_id = None
            if event.properties and event.properties.get("user_id"):
                try:
                    user_id = int(event.properties["user_id"])
                except (ValueError, TypeError):
                    pass

            db_event = AnalyticsEvent(
                event_name=event.name,
                user_id=user_id,
                session_id=event.session_id,
                platform=batch.platform,
                properties=json.dumps(event.properties) if event.properties else None,
                client_ip=client_ip,
                event_timestamp=datetime.fromisoformat(event.timestamp.replace("Z", "+00:00")),
            )
            session.add(db_event)
            inserted += 1
        except Exception as e:
            print(f"⚠️ [Analytics] Skip event {event.name}: {e}", flush=True)

    await session.commit()
    return {"status": "ok", "inserted": inserted}


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 DASHBOARD (Admin)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/summary")
async def get_analytics_summary(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """📊 Résumé analytics pour les N derniers jours (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    since = datetime.utcnow() - timedelta(days=days)

    # Total events
    total = await session.execute(
        select(func.count(AnalyticsEvent.id)).where(
            AnalyticsEvent.event_timestamp >= since
        )
    )

    # Events par type
    by_type = await session.execute(
        select(
            AnalyticsEvent.event_name,
            func.count(AnalyticsEvent.id).label("count"),
        )
        .where(AnalyticsEvent.event_timestamp >= since)
        .group_by(AnalyticsEvent.event_name)
        .order_by(text("count DESC"))
    )

    # Unique sessions
    sessions_count = await session.execute(
        select(func.count(func.distinct(AnalyticsEvent.session_id))).where(
            AnalyticsEvent.event_timestamp >= since
        )
    )

    # Unique users
    users_count = await session.execute(
        select(func.count(func.distinct(AnalyticsEvent.user_id))).where(
            AnalyticsEvent.event_timestamp >= since,
            AnalyticsEvent.user_id.isnot(None),
        )
    )

    # Events par plateforme
    by_platform = await session.execute(
        select(
            AnalyticsEvent.platform,
            func.count(AnalyticsEvent.id).label("count"),
        )
        .where(AnalyticsEvent.event_timestamp >= since)
        .group_by(AnalyticsEvent.platform)
    )

    return {
        "period_days": days,
        "total_events": total.scalar() or 0,
        "unique_sessions": sessions_count.scalar() or 0,
        "unique_users": users_count.scalar() or 0,
        "events_by_type": [
            {"name": row.event_name, "count": row.count}
            for row in by_type.all()
        ],
        "events_by_platform": [
            {"platform": row.platform, "count": row.count}
            for row in by_platform.all()
        ],
    }
