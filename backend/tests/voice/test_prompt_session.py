"""Tests for ``voice.prompt_session.build_session_block``.

Validates the unified ``# SESSION`` / ``# UTILISATEUR`` / ``# ANALYSES
RÉCENTES`` block injected between the brand identity and the video
context in every voice agent system_prompt.

The function is best-effort: any DB error must be logged and the
section silently omitted — the caller never sees an exception. The
block is also capped at 1500 chars; oversized inputs are truncated by
dropping recent analyses first, then the themes line.

All tests use ``AsyncMock`` for the SQLAlchemy session so we don't need
a real Postgres / SQLite engine.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from voice.prompt_session import MAX_BLOCK_CHARS, build_session_block


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _user(**overrides):
    """Return a MagicMock user with sensible voice-test defaults."""
    user = MagicMock()
    user.id = overrides.get("id", 42)
    user.first_name = overrides.get("first_name", "Maxime")
    user.prenom = overrides.get("prenom", None)
    user.plan = overrides.get("plan", "expert")
    user.language = overrides.get("language", "fr")
    return user


def _patch_db_helpers(
    *,
    total: int | None = 0,
    recents=None,
    flashcards: int | None = None,
    themes=None,
):
    """Context-manager-like helper: returns a list of patch contexts to enter.

    Patches the four DB-touching helpers in ``voice.prompt_session`` so the
    test never needs a real session.
    """
    return [
        patch(
            "voice.prompt_session._fetch_total_analyses",
            new=AsyncMock(return_value=total),
        ),
        patch(
            "voice.prompt_session._fetch_recent_summaries",
            new=AsyncMock(return_value=recents or []),
        ),
        patch(
            "voice.prompt_session._fetch_flashcards_due_today",
            new=AsyncMock(return_value=flashcards),
        ),
        patch(
            "voice.prompt_session._fetch_themes",
            new=AsyncMock(return_value=themes or []),
        ),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Full FR happy path
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_session_block_fr_with_full_user():
    """A complete FR user on extension produces a fully populated FR block."""
    user = _user(first_name="Maxime", plan="expert")
    db = AsyncMock()

    patches = _patch_db_helpers(total=12, recents=[], flashcards=None, themes=[])
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="extension",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=15.0,
        )
    finally:
        for p in patches:
            p.stop()

    assert "Maxime" in block
    assert "Expert" in block
    assert "français" in block
    assert "extension Chrome" in block
    assert "# SESSION" in block
    assert "# UTILISATEUR" in block


# ─────────────────────────────────────────────────────────────────────────────
# Minimal EN path
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_session_block_en_basic():
    """Minimal EN user produces all three section headers in English."""
    user = _user(first_name="Sam", plan="free", language="en")
    db = AsyncMock()

    fake_summary = MagicMock()
    fake_summary.video_title = "Some video"
    fake_summary.video_channel = "Some Channel"
    fake_summary.created_at = None  # avoids relative-date branch

    patches = _patch_db_helpers(
        total=1, recents=[fake_summary], flashcards=None, themes=[]
    )
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="en",
            voice_quota_remaining_min=None,
        )
    finally:
        for p in patches:
            p.stop()

    assert "# SESSION" in block
    assert "# USER" in block
    assert "# RECENT ANALYSES" in block


# ─────────────────────────────────────────────────────────────────────────────
# Missing first name
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_session_block_no_first_name():
    """When neither ``first_name`` nor ``prenom`` is set, a hint is emitted."""
    user = _user(first_name=None, prenom=None)
    db = AsyncMock()

    patches = _patch_db_helpers()
    for p in patches:
        p.start()
    try:
        block_fr = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=10,
        )
        block_en = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="en",
            voice_quota_remaining_min=10,
        )
    finally:
        for p in patches:
            p.stop()

    assert "Prénom inconnu" in block_fr
    assert "First name unknown" in block_en


# ─────────────────────────────────────────────────────────────────────────────
# Plan + quota matrix
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_session_block_free_plan_unused_trial():
    """Free + quota=None → 'essai gratuit lifetime non utilisé'."""
    user = _user(plan="free", first_name="A")
    db = AsyncMock()

    patches = _patch_db_helpers()
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=None,
        )
    finally:
        for p in patches:
            p.stop()
    assert "essai gratuit lifetime non utilisé" in block


@pytest.mark.asyncio
async def test_build_session_block_free_plan_trial_used():
    """Free + quota=0 → 'essai utilisé'."""
    user = _user(plan="free", first_name="A")
    db = AsyncMock()

    patches = _patch_db_helpers()
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=0,
        )
    finally:
        for p in patches:
            p.stop()
    assert "essai utilisé" in block


@pytest.mark.asyncio
async def test_build_session_block_pro_plan():
    """Pro plan → 'voice désactivé sur ce plan — Expert requis'."""
    user = _user(plan="pro", first_name="B")
    db = AsyncMock()

    patches = _patch_db_helpers()
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=None,
        )
    finally:
        for p in patches:
            p.stop()
    assert "voice désactivé sur ce plan — Expert requis" in block


@pytest.mark.asyncio
async def test_build_session_block_expert_with_quota():
    """Expert + quota → '<min> min restantes'."""
    user = _user(plan="expert", first_name="C")
    db = AsyncMock()

    patches = _patch_db_helpers()
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=15.5,
        )
    finally:
        for p in patches:
            p.stop()
    # 15.5 rounds to 15.5 with one decimal — substring "15" must be present.
    assert "15" in block
    assert "min restantes" in block


# ─────────────────────────────────────────────────────────────────────────────
# Resilience to DB errors
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_session_block_db_error_returns_partial():
    """A failing Summary query must NOT crash the block — fallback minimal."""
    user = _user(first_name="D", plan="free")
    db = AsyncMock()

    # Each helper is wrapped in a try/except inside the module; we patch the
    # outer helpers so the catch happens internally and the section is omitted.
    with patch(
        "voice.prompt_session._fetch_total_analyses",
        new=AsyncMock(side_effect=RuntimeError("db down")),
    ), patch(
        "voice.prompt_session._fetch_recent_summaries",
        new=AsyncMock(side_effect=RuntimeError("db down")),
    ), patch(
        "voice.prompt_session._fetch_flashcards_due_today",
        new=AsyncMock(return_value=None),
    ), patch(
        "voice.prompt_session._fetch_themes", new=AsyncMock(return_value=[])
    ):
        # The helpers themselves swallow exceptions; if a future refactor lets
        # one escape, build_session_block should still finish gracefully — at
        # the very least the SESSION + UTILISATEUR sections must remain.
        try:
            block = await build_session_block(
                user=user,
                db=db,
                platform="web",
                agent_type="explorer",
                surface="voice_call",
                language="fr",
                voice_quota_remaining_min=None,
            )
        except Exception as exc:  # pragma: no cover — fail explicit
            pytest.fail(f"build_session_block must not raise on DB error: {exc!r}")

    assert "# SESSION" in block
    assert "# UTILISATEUR" in block


# ─────────────────────────────────────────────────────────────────────────────
# Cap 1500 chars
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_session_block_under_1500_chars():
    """Pathological input (50 analyses + 30 themes) → cap is enforced."""
    user = _user(first_name="X", plan="expert")
    db = AsyncMock()

    big_summaries = []
    for i in range(50):
        s = MagicMock()
        s.video_title = f"Une analyse vidéo très longue numéro {i} avec un titre verbeux"
        s.video_channel = f"Channel{i}"
        s.created_at = None
        big_summaries.append(s)

    big_themes = [f"theme_extremely_long_label_{i}" for i in range(30)]

    patches = _patch_db_helpers(
        total=50, recents=big_summaries, flashcards=99, themes=big_themes
    )
    for p in patches:
        p.start()
    try:
        block = await build_session_block(
            user=user,
            db=db,
            platform="web",
            agent_type="explorer",
            surface="voice_call",
            language="fr",
            voice_quota_remaining_min=120.0,
        )
    finally:
        for p in patches:
            p.stop()

    assert len(block) <= MAX_BLOCK_CHARS, (
        f"block is {len(block)} chars — must be <= {MAX_BLOCK_CHARS}"
    )
