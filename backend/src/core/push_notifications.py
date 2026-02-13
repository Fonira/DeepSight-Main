"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📲 PUSH NOTIFICATIONS — Expo Push Service                                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Envoi de push notifications via Expo Push API                                  ║
║  • Gestion des tokens invalides                                                   ║
║  • Rate limiting: max 600 notifs/seconde                                         ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import PushToken, async_session_maker

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(
    user_id: int,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """
    Send a push notification to all active devices of a user.

    Args:
        user_id: Target user ID
        title: Notification title
        body: Notification body text
        data: Optional JSON data (deep link info, etc.)

    Returns:
        dict with sent count and any errors
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(PushToken).where(
                PushToken.user_id == user_id,
                PushToken.is_active == True,
            )
        )
        tokens = result.scalars().all()

    if not tokens:
        return {"sent": 0, "errors": [], "message": "No active push tokens"}

    messages = []
    for token_record in tokens:
        message = {
            "to": token_record.token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
        }
        if data:
            message["data"] = data
        messages.append(message)

    errors = []
    sent = 0
    invalid_tokens = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )

            if response.status_code == 200:
                resp_data = response.json()
                tickets = resp_data.get("data", [])

                for i, ticket in enumerate(tickets):
                    if ticket.get("status") == "ok":
                        sent += 1
                    elif ticket.get("status") == "error":
                        error_detail = ticket.get("details", {})
                        error_type = error_detail.get("error", "")
                        errors.append({
                            "token": tokens[i].token[:20] + "...",
                            "error": ticket.get("message", "Unknown error"),
                        })
                        # Mark invalid tokens for cleanup
                        if error_type in ("DeviceNotRegistered", "InvalidCredentials"):
                            invalid_tokens.append(tokens[i].token)
            else:
                errors.append({
                    "error": f"Expo API returned {response.status_code}",
                    "body": response.text[:200],
                })

    except httpx.TimeoutException:
        errors.append({"error": "Expo Push API timeout"})
    except Exception as e:
        errors.append({"error": str(e)[:200]})

    # Cleanup invalid tokens
    if invalid_tokens:
        try:
            async with async_session_maker() as session:
                await session.execute(
                    delete(PushToken).where(PushToken.token.in_(invalid_tokens))
                )
                await session.commit()
                print(f"🗑️ Removed {len(invalid_tokens)} invalid push tokens", flush=True)
        except Exception as e:
            print(f"⚠️ Failed to cleanup invalid tokens: {e}", flush=True)

    return {"sent": sent, "errors": errors}


async def send_analysis_complete_push(
    user_id: int,
    video_title: str,
    summary_id: int,
    video_id: str,
) -> dict:
    """Push notification when analysis is complete."""
    short_title = video_title[:60] + "..." if len(video_title) > 60 else video_title
    return await send_push(
        user_id=user_id,
        title="Analysis Complete",
        body=f'"{short_title}" is ready to view',
        data={
            "type": "analysis_complete",
            "summaryId": str(summary_id),
            "videoId": video_id,
            "screen": "Analysis",
        },
    )


async def send_factcheck_complete_push(
    user_id: int,
    video_title: str,
    summary_id: int,
    reliability_score: Optional[float] = None,
) -> dict:
    """Push notification when fact-check is complete."""
    short_title = video_title[:60] + "..." if len(video_title) > 60 else video_title
    body = f'Fact-check for "{short_title}" is ready'
    if reliability_score is not None:
        score_pct = int(reliability_score * 100)
        body += f" — Reliability: {score_pct}%"
    return await send_push(
        user_id=user_id,
        title="Fact-Check Complete",
        body=body,
        data={
            "type": "factcheck_complete",
            "summaryId": str(summary_id),
            "screen": "Analysis",
        },
    )
