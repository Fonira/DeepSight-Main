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

VOICE_SYSTEM_PROMPT_CAP_BYTES = 12_000  # ElevenLabs system_prompt safe margin
CHAT_HISTORY_CAP_BYTES = 30_000  # Mistral-large 262K, room to spare
RECENT_VERBATIM_LIMIT = 30
PER_MESSAGE_MAX_CHARS = 600

# Section header constants (shared between renderer and truncator)
RECENT_HEADER_FR = "### Derniers échanges"
RECENT_HEADER_EN = "### Recent exchanges"
DIGESTS_HEADER_FR = "### Résumé sessions antérieures"
DIGESTS_HEADER_EN = "### Summary of previous sessions"


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


def _format_message_label(*, source: str, role: str, created_at: datetime, lang: str = "fr") -> str:
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


def _indent_body(text: str, indent: str = "  ") -> str:
    """Prefix every non-blank line of `text` with `indent` so multi-bullet
    digest bodies stay visually nested under their parent date-bullet.

    Without this, a digest_text like:
        - user demanded X
        - you answered Y
    would only get the first line indented after `f"...:\n  {digest_text}"`,
    leaving the second `- you answered Y` at top level — and after truncation
    drops the parent bullet, the orphan line looks like a separate digest entry.
    """
    return "\n".join(indent + ln if ln.strip() else "" for ln in text.split("\n"))


def _render_block(
    *,
    lang: str,
    voice_digests: Iterable[Any],  # tuple (session_id, started_at, duration_s, digest_text)
    chat_digests: Iterable[Any],  # ChatTextDigest-like (created_at, msg_count, digest_text)
    recent: Iterable[Any],  # ChatMessage-like (role, source, content, created_at, voice_session_id)
    exclude_voice_session_id: Optional[str],
) -> str:
    voice_list = list(voice_digests)
    chat_list = list(chat_digests)
    recent_list = [
        m
        for m in recent
        if not (exclude_voice_session_id and getattr(m, "voice_session_id", None) == exclude_voice_session_id)
    ]

    if not voice_list and not chat_list and not recent_list:
        return ""

    if lang == "en":
        title = "## Previous conversation context"
        digests_header = DIGESTS_HEADER_EN
        recent_header = f"{RECENT_HEADER_EN} ({len(recent_list)})"
        footer = "Continue this conversation in the same vein."
    else:
        title = "## Contexte conversation précédente"
        digests_header = DIGESTS_HEADER_FR
        recent_header = f"{RECENT_HEADER_FR} ({len(recent_list)})"
        footer = "Continue dans la lignée de cette conversation."

    lines: list[str] = [title, ""]

    # Digests section (chronological merge of voice + chat digests)
    digest_rows: list[tuple[datetime, str]] = []
    for vd in voice_list:
        session_id, started_at, duration_s, digest_text = vd
        date_str = started_at.strftime("%Y-%m-%d")
        duration_min = max(1, int(duration_s or 0) // 60)
        kind = f"(voice {duration_min} min)" if lang == "fr" else f"(voice {duration_min} min)"
        digest_rows.append((started_at, f"- {date_str} {kind} :\n{_indent_body(digest_text)}"))
    for cd in chat_list:
        date_str = cd.created_at.strftime("%Y-%m-%d")
        kind = f"(chat texte {cd.msg_count} msgs)" if lang == "fr" else f"(text chat {cd.msg_count} msgs)"
        digest_rows.append((cd.created_at, f"- {date_str} {kind} :\n{_indent_body(cd.digest_text)}"))

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


# ── Cap enforcement ──────────────────────────────────────────────────────────


def _truncate_to_cap(block: str, cap: int, *, lang: str) -> str:
    """Truncate the rendered block to fit within `cap` bytes.

    Strategy:
      1. Try block as-is. If under cap → return.
      2. Otherwise, drop digest section bullets one by one (oldest first)
         until under cap.
      3. If still over cap, drop oldest verbatim rows one by one.
      4. Append a footer marker '[contexte tronqué]' (or '[context truncated]').
    """
    if len(block.encode("utf-8")) <= cap:
        return block

    marker = "\n\n[contexte tronqué]" if lang == "fr" else "\n\n[context truncated]"
    marker_bytes = len(marker.encode("utf-8"))
    effective_cap = cap - marker_bytes

    lines = block.split("\n")

    def join_size(items: list[str]) -> int:
        return len("\n".join(items).encode("utf-8"))

    # Identify the recent section start so we never drop from there first
    recent_idx = next(
        (i for i, line in enumerate(lines) if line.startswith(RECENT_HEADER_FR) or line.startswith(RECENT_HEADER_EN)),
        None,
    )

    # 1. Drop oldest digest bullets (lines starting with "- " before recent section)
    digest_bullet_indices = [
        i for i, line in enumerate(lines) if line.startswith("- ") and (recent_idx is None or i < recent_idx)
    ]
    while join_size(lines) > effective_cap and digest_bullet_indices:
        idx = digest_bullet_indices.pop(0)
        lines[idx] = ""
        # Drop ALL consecutive indented continuation lines (digest body can span multiple lines)
        j = idx + 1
        while j < len(lines) and lines[j].startswith("  "):
            lines[j] = ""
            j += 1

    # 2. Drop oldest verbatim rows (start at recent_idx + 2 to skip header + blank line)
    if join_size(lines) > effective_cap and recent_idx is not None:
        verbatim_start = recent_idx + 1
        while join_size(lines) > effective_cap and verbatim_start < len(lines):
            if lines[verbatim_start].startswith("["):
                lines[verbatim_start] = ""
                verbatim_start += 1
            else:
                verbatim_start += 1

    # Re-join, collapse multiple blank lines, append marker
    truncated = "\n".join(line for line in lines if line is not None)
    parts = truncated.split("\n")
    truncated = "\n".join(ln for i, ln in enumerate(parts) if not (ln == "" and i > 0 and parts[i - 1] == ""))
    return truncated.rstrip() + marker


# ── Public async builder ─────────────────────────────────────────────────────


async def build_unified_context_block(
    db,  # AsyncSession (typed weakly to avoid circular import in test fixtures)
    *,
    summary_id: int,
    user_id: int,
    lang: str = "fr",
    target: Literal["voice", "chat"],
    exclude_voice_session_id: Optional[str] = None,
) -> str:
    """Build the unified context block for a chat or voice agent.

    Args:
        db: AsyncSession
        summary_id: video summary id (per-video memory boundary)
        user_id: owner of the conversation
        lang: 'fr' or 'en'
        target: 'voice' (12 KB hard cap) or 'chat' (30 KB soft cap)
        exclude_voice_session_id: when called from a *new* voice session,
            pass its own id so its already-active rows are not re-injected

    Returns "" when nothing to inject.
    """
    from sqlalchemy import select

    from db.database import ChatMessage, ChatTextDigest, VoiceSession

    cap = VOICE_SYSTEM_PROMPT_CAP_BYTES if target == "voice" else CHAT_HISTORY_CAP_BYTES

    # 1. Voice digests (sessions previously ended on this video)
    #    Note: VoiceSession uses started_at (not created_at) — see db/database.py:827
    vd_q = (
        select(
            VoiceSession.id,
            VoiceSession.started_at,
            VoiceSession.duration_seconds,
            VoiceSession.digest_text,
        )
        .where(
            VoiceSession.summary_id == summary_id,
            VoiceSession.user_id == user_id,
            VoiceSession.digest_text.isnot(None),
        )
        .order_by(VoiceSession.started_at.asc())
    )
    if exclude_voice_session_id:
        vd_q = vd_q.where(VoiceSession.id != exclude_voice_session_id)
    voice_digests = (await db.execute(vd_q)).all()

    # 2. Chat text digests
    cd_q = (
        select(ChatTextDigest)
        .where(
            ChatTextDigest.summary_id == summary_id,
            ChatTextDigest.user_id == user_id,
        )
        .order_by(ChatTextDigest.created_at.asc())
    )
    chat_digests = (await db.execute(cd_q)).scalars().all()

    # 3. Last RECENT_VERBATIM_LIMIT chat_messages (all sources, ASC chronological)
    rec_q = (
        select(ChatMessage)
        .where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(RECENT_VERBATIM_LIMIT)
    )
    recent = list(reversed((await db.execute(rec_q)).scalars().all()))

    # 4. Render
    block = _render_block(
        lang=lang,
        voice_digests=voice_digests,
        chat_digests=chat_digests,
        recent=recent,
        exclude_voice_session_id=exclude_voice_session_id,
    )

    # 5. Cap enforcement
    if block and len(block.encode("utf-8")) > cap:
        block = _truncate_to_cap(block, cap, lang=lang)

    return block
