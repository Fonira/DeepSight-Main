"""
Contact router — POST /contact endpoint.

Rate-limited to 3 requests per hour per IP.
Sends the message via EmailService to the admin.
"""

import time
import asyncio
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(tags=["Contact"])

# ───────────────────────────────────────────────────────────────────────────
# Rate limiting — 3 per hour per IP (in-memory)
# ───────────────────────────────────────────────────────────────────────────

_rate_lock = asyncio.Lock()
_requests: Dict[str, List[float]] = {}
RATE_LIMIT = 3
RATE_WINDOW = 3600  # 1 hour in seconds


async def _check_rate_limit(ip: str) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.time()
    async with _rate_lock:
        timestamps = _requests.get(ip, [])
        # Remove expired entries
        timestamps = [t for t in timestamps if now - t < RATE_WINDOW]
        if len(timestamps) >= RATE_LIMIT:
            _requests[ip] = timestamps
            return False
        timestamps.append(now)
        _requests[ip] = timestamps
        return True


# ───────────────────────────────────────────────────────────────────────────
# Schema
# ───────────────────────────────────────────────────────────────────────────

class ContactRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    subject: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=10, max_length=5000)


# ───────────────────────────────────────────────────────────────────────────
# Email template
# ───────────────────────────────────────────────────────────────────────────

def _build_contact_html(data: ContactRequest) -> str:
    return f"""\
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;
            background:#0a0a0f;color:#f5f5f7;padding:32px;border-radius:12px;
            border:1px solid #1e1e2a;">
  <h2 style="margin:0 0 24px;color:#3b82f6;">
    Nouveau message — Formulaire de contact
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;width:100px;vertical-align:top;">Nom</td>
      <td style="padding:10px 0;font-weight:600;">{data.name}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Email</td>
      <td style="padding:10px 0;">
        <a href="mailto:{data.email}" style="color:#3b82f6;text-decoration:none;">{data.email}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Sujet</td>
      <td style="padding:10px 0;font-weight:600;">{data.subject}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Message</td>
      <td style="padding:10px 0;white-space:pre-wrap;">{data.message}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Date</td>
      <td style="padding:10px 0;">{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</td>
    </tr>
  </table>
  <p style="font-size:13px;color:#6b6b80;margin:0;">
    Envoyé depuis le formulaire de contact DeepSight.
  </p>
</div>"""


# ───────────────────────────────────────────────────────────────────────────
# POST /contact
# ───────────────────────────────────────────────────────────────────────────

CONTACT_RECIPIENT = "maxime@deepsightsynthesis.com"


@router.post("/contact")
async def submit_contact(data: ContactRequest, request: Request):
    """Submit a contact form message. Rate-limited to 3/hour per IP."""
    client_ip = request.client.host if request.client else "unknown"

    if not await _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Trop de messages envoyés. Veuillez réessayer dans une heure.",
        )

    try:
        from services.email_service import EmailService

        svc = EmailService()
        success = await svc.send_email(
            to=CONTACT_RECIPIENT,
            subject=f"[DeepSight Contact] {data.subject}",
            html_content=_build_contact_html(data),
            text_content=f"De: {data.name} ({data.email})\nSujet: {data.subject}\n\n{data.message}",
        )

        if not success:
            raise HTTPException(
                status_code=503,
                detail="Le service email est temporairement indisponible.",
            )

    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Le service email n'est pas configuré.",
        )

    return {"status": "sent", "message": "Votre message a bien été envoyé."}
