"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔔 NOTIFICATIONS SERVICE v1.0 — Notifications en temps réel via SSE               ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Server-Sent Events (SSE) pour les notifications en temps réel                   ║
║  • Notification navigateur quand analyse terminée                                  ║
║  • Support multi-onglets                                                           ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, Set, Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User, PushToken
from auth.dependencies import get_current_user

router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 STORE DES CONNEXIONS SSE (en mémoire)
# ═══════════════════════════════════════════════════════════════════════════════

# user_id -> Set[queue] (un user peut avoir plusieurs onglets)
_user_connections: Dict[int, Set[asyncio.Queue]] = defaultdict(set)

# Notifications en attente pour les utilisateurs déconnectés
_pending_notifications: Dict[int, list] = defaultdict(list)

# Limite de notifications en attente par utilisateur
MAX_PENDING_NOTIFICATIONS = 50


async def send_notification_to_user(
    user_id: int, notification_type: str, title: str, message: str, data: Optional[dict] = None
):
    """
    Envoie une notification à un utilisateur via SSE.

    Args:
        user_id: ID de l'utilisateur
        notification_type: Type de notification (analysis_complete, error, info)
        title: Titre de la notification
        message: Message de la notification
        data: Données additionnelles (summary_id, video_title, etc.)
    """
    notification = {
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "timestamp": datetime.now().isoformat(),
    }

    user_queues = _user_connections.get(user_id, set())

    if user_queues:
        # Envoyer à toutes les connexions de l'utilisateur
        print(f"🔔 [NOTIFY] Sending to {len(user_queues)} connections for user {user_id}", flush=True)
        for queue in user_queues:
            try:
                await queue.put(notification)
            except Exception as e:
                print(f"⚠️ [NOTIFY] Failed to send to queue: {e}", flush=True)
    else:
        # Stocker pour plus tard si l'utilisateur n'est pas connecté
        print(f"📥 [NOTIFY] User {user_id} offline, storing notification", flush=True)
        _pending_notifications[user_id].append(notification)
        # Limiter le nombre de notifications en attente
        if len(_pending_notifications[user_id]) > MAX_PENDING_NOTIFICATIONS:
            _pending_notifications[user_id] = _pending_notifications[user_id][-MAX_PENDING_NOTIFICATIONS:]


async def notify_analysis_complete(
    user_id: int, summary_id: int, video_title: str, video_id: str, cached: bool = False
):
    """Notification spécifique pour une analyse terminée (SSE + Push)."""
    # SSE notification (web)
    await send_notification_to_user(
        user_id=user_id,
        notification_type="analysis_complete",
        title="✅ Analyse terminée" if not cached else "📦 Analyse retrouvée",
        message=f'L\'analyse de "{video_title[:50]}..." est prête !',
        data={
            "summary_id": summary_id,
            "video_id": video_id,
            "video_title": video_title,
            "cached": cached,
            "action_url": f"/dashboard?id={summary_id}",
        },
    )
    # Push notification (mobile)
    try:
        from core.push_notifications import send_analysis_complete_push

        await send_analysis_complete_push(
            user_id=user_id,
            video_title=video_title,
            summary_id=summary_id,
            video_id=video_id,
        )
    except Exception as e:
        print(f"⚠️ [PUSH] Failed to send analysis push: {e}", flush=True)


async def notify_analysis_failed(user_id: int, video_title: str, error: str):
    """Notification pour une analyse échouée (SSE + Push)."""
    await send_notification_to_user(
        user_id=user_id,
        notification_type="analysis_error",
        title="❌ Analyse échouée",
        message=f'L\'analyse de "{video_title[:50]}..." a échoué: {error[:100]}',
        data={"video_title": video_title, "error": error},
    )
    # Push notification (mobile)
    try:
        from core.push_notifications import send_push

        await send_push(
            user_id=user_id,
            title="❌ Analyse échouée",
            body=f'Impossible d\'analyser "{video_title[:50]}..."',
            data={"type": "analysis_failed", "screen": "Dashboard"},
        )
    except Exception as e:
        print(f"⚠️ [PUSH] Failed to send failure push: {e}", flush=True)


async def notify_factcheck_complete(
    user_id: int,
    summary_id: int,
    video_title: str,
    reliability_score: Optional[float] = None,
):
    """Notification when fact-check is complete (SSE + Push)."""
    await send_notification_to_user(
        user_id=user_id,
        notification_type="factcheck_complete",
        title="✅ Fact-check terminé",
        message=f'Le fact-check de "{video_title[:50]}..." est prêt',
        data={
            "summary_id": summary_id,
            "video_title": video_title,
            "reliability_score": reliability_score,
        },
    )
    try:
        from core.push_notifications import send_factcheck_complete_push

        await send_factcheck_complete_push(
            user_id=user_id,
            video_title=video_title,
            summary_id=summary_id,
            reliability_score=reliability_score,
        )
    except Exception as e:
        print(f"⚠️ [PUSH] Failed to send factcheck push: {e}", flush=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 📲 PUSH TOKEN REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════════


class PushTokenRequest(BaseModel):
    push_token: str
    platform: str = "ios"

    @field_validator("push_token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        if not v.startswith("ExponentPushToken["):
            raise ValueError("Invalid Expo push token format")
        return v

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        if v not in ("ios", "android"):
            raise ValueError("Platform must be 'ios' or 'android'")
        return v


@router.post("/push-token")
async def register_push_token(
    payload: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    📲 Register or update an Expo push token for the current user.
    One active token per device (unique token constraint).
    """
    # Check if this token already exists
    existing = await session.execute(select(PushToken).where(PushToken.token == payload.push_token))
    existing_token = existing.scalar_one_or_none()

    if existing_token:
        # Update ownership if token was reassigned to a different user
        existing_token.user_id = current_user.id
        existing_token.platform = payload.platform
        existing_token.is_active = True
    else:
        new_token = PushToken(
            user_id=current_user.id,
            token=payload.push_token,
            platform=payload.platform,
            is_active=True,
        )
        session.add(new_token)

    await session.commit()
    print(f"📲 [PUSH] Token registered for user {current_user.id} ({payload.platform})", flush=True)

    return {"status": "ok", "message": "Push token registered"}


@router.delete("/push-token")
async def unregister_push_token(
    payload: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a push token (e.g. on logout)."""
    await session.execute(
        delete(PushToken).where(
            PushToken.token == payload.push_token,
            PushToken.user_id == current_user.id,
        )
    )
    await session.commit()
    return {"status": "ok", "message": "Push token removed"}


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 ENDPOINTS SSE
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/stream")
async def notification_stream(current_user: User = Depends(get_current_user)):
    """
    🔔 Stream SSE de notifications en temps réel.

    Le frontend se connecte à cet endpoint et reçoit les notifications
    en temps réel (analyse terminée, erreurs, etc.)

    Usage frontend:
    ```javascript
    const eventSource = new EventSource('/api/notifications/stream', {
        headers: { 'Authorization': 'Bearer ...' }
    });
    eventSource.onmessage = (e) => {
        const notification = JSON.parse(e.data);
        // Afficher notification navigateur
    };
    ```
    """
    user_id = current_user.id
    queue = asyncio.Queue()

    # Enregistrer la connexion
    _user_connections[user_id].add(queue)
    print(f"🔌 [SSE] User {user_id} connected (total: {len(_user_connections[user_id])} connections)", flush=True)

    async def event_generator():
        try:
            # Envoyer les notifications en attente
            pending = _pending_notifications.pop(user_id, [])
            if pending:
                for notification in pending:
                    yield f"data: {json.dumps(notification)}\n\n"

            # Envoyer un heartbeat initial
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Connected to notifications'})}\n\n"

            while True:
                try:
                    # Attendre une notification (avec timeout pour heartbeat)
                    notification = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(notification)}\n\n"
                except asyncio.TimeoutError:
                    # Envoyer un heartbeat pour garder la connexion ouverte
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now().isoformat()})}\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            # Nettoyer la connexion
            _user_connections[user_id].discard(queue)
            if not _user_connections[user_id]:
                del _user_connections[user_id]
            print(f"🔌 [SSE] User {user_id} disconnected", flush=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/pending")
async def get_pending_notifications(current_user: User = Depends(get_current_user)):
    """
    Récupère les notifications en attente (pour les utilisateurs
    qui n'utilisent pas SSE).
    """
    pending = _pending_notifications.pop(current_user.id, [])
    return {"notifications": pending, "count": len(pending)}


@router.post("/test")
async def send_test_notification(current_user: User = Depends(get_current_user)):
    """
    🧪 Envoie une notification de test (pour debug).
    """
    await send_notification_to_user(
        user_id=current_user.id,
        notification_type="test",
        title="🧪 Test Notification",
        message="This is a test notification from Deep Sight!",
        data={"test": True},
    )

    return {"status": "sent", "user_id": current_user.id}


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATS (pour admin/debug)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/stats")
async def get_notification_stats(current_user: User = Depends(get_current_user)):
    """Stats des connexions SSE (admin only)."""
    if current_user.plan != "unlimited":
        raise HTTPException(status_code=403, detail="Admin only")

    return {
        "active_users": len(_user_connections),
        "total_connections": sum(len(q) for q in _user_connections.values()),
        "pending_notifications": sum(len(n) for n in _pending_notifications.values()),
    }
