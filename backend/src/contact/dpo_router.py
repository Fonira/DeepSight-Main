"""
DPO contact router — POST /api/contact/dpo

Public endpoint exposing a GDPR data subject request form. Forwards the
message to dpo@deepsightsynthesis.com (Cloudflare Routing -> Gmail), with:
  - honeypot anti-spam (silent 200 if `website` filled)
  - rate limit 3/10min/IP (in-memory, sliding window)
  - audit log (`dpo.contact_request`, email hashed)
  - structured logging
  - Pydantic v2 validation (Subject enum, message <= 5000)

Returns 202 Accepted on success.
"""

from __future__ import annotations

import asyncio
import hashlib
import html
import logging
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from services.audit_log import log_audit
from services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["DPO Contact"])


_rate_lock = asyncio.Lock()
_requests: Dict[str, List[float]] = {}
RATE_LIMIT = 3
RATE_WINDOW = 600  # 10 min


async def _check_rate_limit(ip: str) -> bool:
    """Sliding window. Returns True if allowed."""
    now = time.time()
    async with _rate_lock:
        timestamps = [t for t in _requests.get(ip, []) if now - t < RATE_WINDOW]
        if len(timestamps) >= RATE_LIMIT:
            _requests[ip] = timestamps
            return False
        timestamps.append(now)
        _requests[ip] = timestamps
        return True


def _client_ip(request: Request) -> str:
    """Extract IP, respecting X-Forwarded-For (Caddy)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class DPOSubject(str, Enum):
    """RGPD article enum — must match frontend RGPD_SUBJECTS."""

    ART_15_ACCESS = "art_15_access"
    ART_16_RECTIFICATION = "art_16_rectification"
    ART_17_ERASURE = "art_17_erasure"
    ART_18_RESTRICTION = "art_18_restriction"
    ART_20_PORTABILITY = "art_20_portability"
    ART_21_OBJECTION = "art_21_objection"
    OTHER = "other"


SUBJECT_LABELS: Dict[DPOSubject, str] = {
    DPOSubject.ART_15_ACCESS: "Art. 15 — Droit d'accès",
    DPOSubject.ART_16_RECTIFICATION: "Art. 16 — Droit de rectification",
    DPOSubject.ART_17_ERASURE: "Art. 17 — Droit à l'effacement",
    DPOSubject.ART_18_RESTRICTION: "Art. 18 — Limitation du traitement",
    DPOSubject.ART_20_PORTABILITY: "Art. 20 — Portabilité des données",
    DPOSubject.ART_21_OBJECTION: "Art. 21 — Droit d'opposition",
    DPOSubject.OTHER: "Autre demande compliance / DPO",
}


class DPOContactRequest(BaseModel):
    """Public DPO contact form payload."""

    email: EmailStr
    subject: DPOSubject
    message: str = Field(..., min_length=10, max_length=5000)
    website: str = Field(default="", max_length=200)


class DPOContactResponse(BaseModel):
    success: bool
    message: str


DPO_RECIPIENT = "dpo@deepsightsynthesis.com"


def _build_dpo_html(payload: DPOContactRequest, ip: str) -> str:
    """Render dark-themed DPO request email (escaped)."""
    safe_email = html.escape(payload.email)
    safe_message = html.escape(payload.message)
    label = html.escape(SUBJECT_LABELS[payload.subject])
    safe_ip = html.escape(ip)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return f"""\
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;
            background:#0a0a0f;color:#f5f5f7;padding:32px;border-radius:12px;
            border:1px solid #1e1e2a;">
  <div style="display:inline-block;padding:4px 10px;background:#f59e0b22;
              color:#fbbf24;border-radius:6px;font-size:11px;font-weight:600;
              text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
    Demande RGPD
  </div>
  <h2 style="margin:0 0 24px;color:#6366f1;">
    Nouvelle demande DPO — {label}
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;width:120px;vertical-align:top;">
        Email demandeur
      </td>
      <td style="padding:10px 0;">
        <a href="mailto:{safe_email}" style="color:#3b82f6;text-decoration:none;">
          {safe_email}
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Article RGPD</td>
      <td style="padding:10px 0;font-weight:600;">{label}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Message</td>
      <td style="padding:10px 0;white-space:pre-wrap;">{safe_message}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">Reçu le</td>
      <td style="padding:10px 0;">{timestamp}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a1a1b5;vertical-align:top;">IP</td>
      <td style="padding:10px 0;font-family:monospace;font-size:12px;">{safe_ip}</td>
    </tr>
  </table>
  <div style="background:#1e1e2a;padding:14px;border-radius:8px;
              border-left:3px solid #f59e0b;font-size:13px;color:#d4d4d8;">
    <strong style="color:#fbbf24;">SLA RGPD Art. 12.3</strong><br/>
    Réponse obligatoire sous 30 jours (extensible 60j si demande complexe,
    avec notification au demandeur).
  </div>
  <p style="font-size:13px;color:#6b6b80;margin:16px 0 0;">
    Envoyé depuis le formulaire /trust de DeepSight.
  </p>
</div>"""


@router.post(
    "/contact/dpo",
    response_model=DPOContactResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a GDPR data subject request to the DPO",
)
async def submit_dpo_contact(
    payload: DPOContactRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> DPOContactResponse:
    """Public endpoint — no auth. Rate limited 3/10min/IP."""
    ip = _client_ip(request)

    if payload.website.strip():
        logger.info(
            "dpo_contact: honeypot triggered ip=%s honeypot_len=%d",
            ip,
            len(payload.website),
        )
        return DPOContactResponse(
            success=True,
            message="Demande reçue. Réponse sous 30 jours max (RGPD Art. 12.3).",
        )

    if not await _check_rate_limit(ip):
        logger.warning("dpo_contact: rate limit hit ip=%s", ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de demandes. Réessayez dans 10 minutes.",
        )

    try:
        text_fallback = (
            f"Demande DPO — {SUBJECT_LABELS[payload.subject]}\n"
            f"De : {payload.email}\n"
            f"Reçu : {datetime.now(timezone.utc).isoformat()}\n"
            f"IP : {ip}\n\n"
            f"{payload.message}\n"
        )
        sent = await email_service.send_email(
            to=DPO_RECIPIENT,
            subject=f"[DPO Request] {SUBJECT_LABELS[payload.subject]}",
            html_content=_build_dpo_html(payload, ip),
            text_content=text_fallback,
            priority=True,
            template_name="dpo_contact_inline",
        )
        if not sent:
            logger.error("dpo_contact: email queue rejected ip=%s", ip)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service email temporairement indisponible.",
            )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("dpo_contact: send failed ip=%s err=%s", ip, e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service email temporairement indisponible.",
        )

    email_hash = hashlib.sha256(payload.email.lower().strip().encode()).hexdigest()[:16]
    await log_audit(
        db,
        action="dpo.contact_request",
        details={
            "subject": payload.subject.value,
            "email_hash": email_hash,
            "message_len": len(payload.message),
        },
        request=request,
    )
    await db.commit()

    logger.info(
        "dpo_contact: request accepted ip=%s subject=%s email_hash=%s",
        ip,
        payload.subject.value,
        email_hash,
    )

    return DPOContactResponse(
        success=True,
        message="Demande reçue. Réponse sous 30 jours max (RGPD Art. 12.3).",
    )
