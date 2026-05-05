"""GDPR Article 20 — Right to data portability.

Builds an in-memory ZIP archive of a user's personal data, served via the
GET /api/auth/me/export endpoint.

The archive contains JSON files for each major personal-data table:
- user.json (profile, no password)
- analyses.json (video analyses)
- chats.json (chat messages)
- transactions.json (billing history)
- audit_logs.json (sensitive action history)
- README.md (human-readable explanation)

Defensive: uses getattr() for optional columns so schema drifts don't crash
the export. The export is best-effort — partial data is better than no
data when the user is exercising their portability right.
"""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import (
    User,
    Summary,
    ChatMessage,
    CreditTransaction,
    AuditLog,
)


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _serialize_user(user: User) -> dict[str, Any]:
    """User profile WITHOUT password_hash or sensitive auth tokens."""
    return {
        "id": user.id,
        "email": user.email,
        "plan": user.plan,
        "credits_remaining": getattr(user, "credits_remaining", None),
        "auth_method": "google" if getattr(user, "google_id", None) else "email",
        "google_id": getattr(user, "google_id", None),
        "stripe_customer_id": getattr(user, "stripe_customer_id", None),
        "preferences": getattr(user, "preferences", None),
        "is_legacy_pricing": getattr(user, "is_legacy_pricing", False),
        "email_verified": getattr(user, "email_verified", False),
        "created_at": _iso(getattr(user, "created_at", None)),
        "updated_at": _iso(getattr(user, "updated_at", None)),
    }


def _serialize_summary(s: Summary) -> dict[str, Any]:
    return {
        "id": s.id,
        "video_id": getattr(s, "video_id", None),
        "platform": getattr(s, "platform", None),
        "title": getattr(s, "title", None),
        "url": getattr(s, "url", None),
        "content": getattr(s, "content", None),
        "duration": getattr(s, "duration", None),
        "language": getattr(s, "language", None),
        "created_at": _iso(getattr(s, "created_at", None)),
    }


def _serialize_chat(c: ChatMessage) -> dict[str, Any]:
    return {
        "id": c.id,
        "summary_id": getattr(c, "summary_id", None),
        "role": getattr(c, "role", None),
        "content": getattr(c, "content", None),
        "web_search_used": getattr(c, "web_search_used", False),
        "created_at": _iso(getattr(c, "created_at", None)),
    }


def _serialize_transaction(t: CreditTransaction) -> dict[str, Any]:
    return {
        "id": t.id,
        "transaction_type": getattr(t, "transaction_type", None),
        "amount": getattr(t, "amount", None),
        "credits_delta": getattr(t, "credits_delta", None),
        "stripe_session_id": getattr(t, "stripe_session_id", None),
        "created_at": _iso(getattr(t, "created_at", None)),
    }


def _serialize_audit(a: AuditLog) -> dict[str, Any]:
    return {
        "id": a.id,
        "action": a.action,
        "details": a.details,
        "ip_address": a.ip_address,
        "user_agent": a.user_agent,
        "created_at": _iso(a.created_at),
    }


async def build_user_export_zip(session: AsyncSession, user: User) -> bytes:
    """Build a ZIP of all the user's personal data (Article 20 GDPR).

    Returns the raw bytes of the ZIP. The caller is responsible for
    serving it as an HTTP attachment with Content-Disposition.
    """
    summaries = (
        (await session.execute(select(Summary).where(Summary.user_id == user.id)))
        .scalars()
        .all()
    )

    summary_ids = [s.id for s in summaries]
    chats: list[ChatMessage] = []
    if summary_ids:
        chats = (
            (
                await session.execute(
                    select(ChatMessage).where(ChatMessage.summary_id.in_(summary_ids))
                )
            )
            .scalars()
            .all()
        )

    transactions = (
        (
            await session.execute(
                select(CreditTransaction).where(CreditTransaction.user_id == user.id)
            )
        )
        .scalars()
        .all()
    )

    audit_logs = (
        (await session.execute(select(AuditLog).where(AuditLog.user_id == user.id)))
        .scalars()
        .all()
    )

    buf = io.BytesIO()
    now_iso = datetime.now(timezone.utc).isoformat()

    readme = (
        f"# DeepSight — Export de vos données personnelles\n\n"
        f"Généré : {now_iso}\n"
        f"Compte : {user.email} (id={user.id})\n\n"
        f"Cette archive contient un export JSON de vos données personnelles,\n"
        f"conformément à l'article 20 du RGPD (droit à la portabilité).\n\n"
        f"## Fichiers\n"
        f"- `user.json` : profil (sans mot de passe)\n"
        f"- `analyses.json` : analyses vidéo ({len(summaries)} entrées)\n"
        f"- `chats.json` : messages de chat ({len(chats)} entrées)\n"
        f"- `transactions.json` : historique de facturation ({len(transactions)} entrées)\n"
        f"- `audit_logs.json` : historique des actions sensibles ({len(audit_logs)} entrées)\n\n"
        f"## Format\n\n"
        f"Tous les fichiers sont en JSON UTF-8, avec horodatages ISO 8601 UTC.\n"
        f"Le format est documenté à : https://www.deepsightsynthesis.com/legal/privacy\n\n"
        f"## Questions\n\n"
        f"Pour toute question relative à vos données, contactez :\n"
        f"  legal@deepsightsynthesis.com\n"
    )

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.md", readme)
        zf.writestr(
            "user.json",
            json.dumps(_serialize_user(user), indent=2, ensure_ascii=False),
        )
        zf.writestr(
            "analyses.json",
            json.dumps(
                [_serialize_summary(s) for s in summaries],
                indent=2,
                ensure_ascii=False,
            ),
        )
        zf.writestr(
            "chats.json",
            json.dumps(
                [_serialize_chat(c) for c in chats],
                indent=2,
                ensure_ascii=False,
            ),
        )
        zf.writestr(
            "transactions.json",
            json.dumps(
                [_serialize_transaction(t) for t in transactions],
                indent=2,
                ensure_ascii=False,
            ),
        )
        zf.writestr(
            "audit_logs.json",
            json.dumps(
                [_serialize_audit(a) for a in audit_logs],
                indent=2,
                ensure_ascii=False,
            ),
        )

    return buf.getvalue()
