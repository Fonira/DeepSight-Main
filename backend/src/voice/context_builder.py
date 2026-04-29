"""Unified context block builder for voice + chat agents.

Consolidates voice session digests + chat text digests + recent verbatim
messages into a single block injectable into either an ElevenLabs voice
agent system_prompt or a Mistral chat conversation history.

Replaces:
  - voice/router.py:_build_chat_history_block_for_voice (Spec #1, Task 6)
  - chat/service.py:build_chat_prompt history_text logic
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Literal, Optional

VOICE_SYSTEM_PROMPT_CAP_BYTES = 12_000   # ElevenLabs system_prompt safe margin
CHAT_HISTORY_CAP_BYTES = 30_000          # Mistral-large 262K, room to spare
RECENT_VERBATIM_LIMIT = 30
PER_MESSAGE_MAX_CHARS = 600


# ── Time humanizer ───────────────────────────────────────────────────────────


def _humanize_relative_time(when: datetime, *, lang: str = "fr") -> str:
    """Return 'à l'instant' / 'il y a 5 min' / 'il y a 2h' / 'il y a 3j' (FR)
    or 'just now' / '5min ago' / '2h ago' / '3d ago' (EN).
    """
    now = datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    delta = now - when
    seconds = int(delta.total_seconds())

    if seconds < 60:
        return "à l'instant" if lang == "fr" else "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"il y a {minutes} min" if lang == "fr" else f"{minutes}min ago"
    hours = minutes // 60
    if hours < 24:
        return f"il y a {hours}h" if lang == "fr" else f"{hours}h ago"
    days = hours // 24
    return f"il y a {days}j" if lang == "fr" else f"{days}d ago"


# ── Message label formatter ──────────────────────────────────────────────────


def _format_message_label(
    *, source: str, role: str, created_at: datetime, lang: str = "fr"
) -> str:
    """Format the prefix label like '[VOCAL • il y a 2j • user]'.

    source : 'voice' | 'text'
    role   : 'user'  | 'assistant'
    """
    if source == "voice":
        src_label = "VOCAL" if lang == "fr" else "VOICE"
    else:
        src_label = "TEXTE" if lang == "fr" else "TEXT"

    if role == "user":
        speaker = "user"
    else:
        speaker = "toi" if lang == "fr" else "you"

    when = _humanize_relative_time(created_at, lang=lang)
    return f"[{src_label} • {when} • {speaker}]"


# ── Block renderer ───────────────────────────────────────────────────────────


def _render_block(
    *,
    lang: str,
    voice_digests: Iterable[Any],   # tuple (session_id, created_at, duration_s, digest_text)
    chat_digests: Iterable[Any],    # ChatTextDigest-like (created_at, msg_count, digest_text)
    recent: Iterable[Any],          # ChatMessage-like (role, source, content, created_at, voice_session_id)
    exclude_voice_session_id: Optional[str],
) -> str:
    voice_list = list(voice_digests)
    chat_list = list(chat_digests)
    recent_list = [
        m for m in recent
        if not (exclude_voice_session_id and getattr(m, "voice_session_id", None) == exclude_voice_session_id)
    ]

    if not voice_list and not chat_list and not recent_list:
        return ""

    if lang == "en":
        title = "## Previous conversation context"
        digests_header = "### Summary of previous sessions"
        recent_header = f"### Recent exchanges ({len(recent_list)})"
        footer = "Continue this conversation in the same vein."
    else:
        title = "## Contexte conversation précédente"
        digests_header = "### Résumé sessions antérieures"
        recent_header = f"### Derniers échanges ({len(recent_list)})"
        footer = "Continue dans la lignée de cette conversation."

    lines: list[str] = [title, ""]

    # Digests section (chronological merge of voice + chat digests)
    digest_rows: list[tuple[datetime, str]] = []
    for vd in voice_list:
        session_id, created_at, duration_s, digest_text = vd
        date_str = created_at.strftime("%Y-%m-%d")
        duration_min = max(1, int(duration_s or 0) // 60)
        kind = f"(voice {duration_min} min)" if lang == "fr" else f"(voice {duration_min} min)"
        digest_rows.append((created_at, f"- {date_str} {kind} :\n  {digest_text}"))
    for cd in chat_list:
        date_str = cd.created_at.strftime("%Y-%m-%d")
        kind = (
            f"(chat texte {cd.msg_count} msgs)" if lang == "fr"
            else f"(text chat {cd.msg_count} msgs)"
        )
        digest_rows.append((cd.created_at, f"- {date_str} {kind} :\n  {cd.digest_text}"))

    if digest_rows:
        digest_rows.sort(key=lambda r: r[0])
        lines.append(digests_header)
        for _, body in digest_rows:
            lines.append(body)
        lines.append("")

    # Recent verbatim section
    if recent_list:
        lines.append(recent_header)
        for m in recent_list:
            content = (getattr(m, "content", "") or "").strip()
            if not content:
                continue
            if len(content) > PER_MESSAGE_MAX_CHARS:
                content = content[: PER_MESSAGE_MAX_CHARS - 1] + "…"
            label = _format_message_label(
                source=getattr(m, "source", "text") or "text",
                role=getattr(m, "role", "user"),
                created_at=getattr(m, "created_at"),
                lang=lang,
            )
            lines.append(f"{label} {content}")
        lines.append("")

    lines.append(footer)
    return "\n".join(lines)
