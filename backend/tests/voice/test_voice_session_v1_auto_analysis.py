"""Tests for the V1 (extension) auto-analysis branch in POST /api/voice/session.

Verifies the cache-miss + plan-aware behaviour added to the V1 path:

  1. cache miss + plan != "free" → ``_run_main_analysis_for_video`` is
     scheduled as a background task and the orchestrator wired with the
     V3-style polling fetchers (``run_for_video`` / ``final_digest_for_video``).
  2. cache miss + plan == "free"  → no auto-analysis; the production
     orchestrator (cached-Summary fetcher) is used as before.
  3. cache hit  + plan != "free"  → no auto-analysis; production orchestrator.

Each test exercises the route ``create_voice_session`` directly with mocked
ElevenLabs / oEmbed / quota dependencies, mirroring the pattern used in
``test_voice_session_streaming.py`` and ``test_voice_session_video_url.py``.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import BackgroundTasks


def _make_voice_prefs() -> MagicMock:
    prefs = MagicMock()
    prefs.voice_id = None
    prefs.input_mode = "ptt"
    prefs.ptt_key = " "
    prefs.turn_timeout = 15
    prefs.turn_eagerness = "normal"
    prefs.voice_chat_model = "eleven_turbo_v2_5"
    prefs.voice_chat_speed_preset = "1x"
    prefs.to_voice_settings = MagicMock(return_value={"speed": 1.0})
    return prefs


def _build_eleven_cm():
    client = AsyncMock()
    client.create_conversation_agent = AsyncMock(return_value="agent_v1_auto_001")
    client.get_signed_url = AsyncMock(
        return_value=("wss://signed.example.test", "2026-04-29T12:00:00Z")
    )
    client.get_conversation_token = AsyncMock(
        return_value=("livekit_token_v1", "2026-04-29T12:00:00Z")
    )
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm, client


class _FakeOembedClient:
    """Async-context-manager that returns a benign oEmbed response."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        resp = MagicMock()
        resp.status_code = 200
        resp.json = MagicMock(return_value={"title": "Test video", "author_name": "Test channel"})
        return resp


def _configure_db_for_cache(mock_db_session, *, cache_hit: bool):
    """Configure mock_db_session.execute to return cache-hit/miss Summary lookups.

    The V1 path performs ONE Summary cache lookup (full_digest is_not None).
    No request.summary_id is provided in these tests, so no other db.execute
    calls precede the cache lookup.
    """
    fake_summary = MagicMock()
    fake_summary.id = 42
    fake_summary.full_digest = '{"summary": "cached"}' if cache_hit else None

    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none = MagicMock(
        return_value=(fake_summary if cache_hit else None)
    )
    mock_db_session.execute = AsyncMock(return_value=scalar_result)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    async def _refresh(obj):
        if getattr(obj, "id", None) is None:
            import uuid as _uuid
            obj.id = str(_uuid.uuid4())

    mock_db_session.refresh = AsyncMock(side_effect=_refresh)


def _make_v1_user(plan: str, user_id: int = 50):
    user = MagicMock()
    user.id = user_id
    user.email = f"v1user_{plan}@deepsight.test"
    user.plan = plan
    user.is_admin = True  # bypass quota gating for focus on auto-analysis logic
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = None
    user.username = f"v1_{plan}"
    return user


def _make_v1_request():
    from voice.schemas import VoiceSessionRequest

    return VoiceSessionRequest(
        agent_type="explorer_streaming",
        video_id="dQw4w9WgXcQ",
        is_streaming=True,
        language="fr",
    )


def _patch_common(monkeypatch=None):
    """Yield the common patches used by every test in this module."""
    eleven_cm, _ = _build_eleven_cm()
    return [
        patch(
            "voice.router.check_voice_quota",
            new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600}),
        ),
        patch(
            "voice.router.get_elevenlabs_client",
            return_value=eleven_cm,
        ),
        patch(
            "voice.preferences.get_user_voice_preferences",
            new=AsyncMock(return_value=_make_voice_prefs()),
        ),
        patch(
            "voice.router.httpx.AsyncClient",
            return_value=_FakeOembedClient(),
        ),
        # Prevent the orchestrator's run() from actually firing — we only
        # care that it was scheduled.
        patch(
            "voice.router.create_production_orchestrator",
            return_value=MagicMock(run=AsyncMock()),
        ),
    ]


@pytest.mark.asyncio
async def test_v1_cache_miss_plan_pro_schedules_auto_analysis(mock_db_session):
    """V1 + plan pro + no cached analysis → main analysis pipeline is scheduled."""
    from voice.router import create_voice_session

    _configure_db_for_cache(mock_db_session, cache_hit=False)

    user = _make_v1_user("pro")
    request = _make_v1_request()
    bg_tasks = BackgroundTasks()

    patches = _patch_common()
    for p in patches:
        p.start()
    try:
        with patch(
            "voice.router._run_main_analysis_for_video",
            new=AsyncMock(),
        ) as mock_main_analysis:
            response = await create_voice_session(
                request,
                background_tasks=bg_tasks,
                current_user=user,
                db=mock_db_session,
                redis=AsyncMock(),
            )
    finally:
        for p in patches:
            p.stop()

    assert response is not None
    assert response.is_streaming is True

    # Two background tasks scheduled: orchestrator.run + _run_main_analysis_for_video.
    assert len(bg_tasks.tasks) == 2

    # Verify _run_main_analysis_for_video was one of them, with the YouTube URL
    # rebuilt from video_id.
    main_analysis_task = next(
        (t for t in bg_tasks.tasks if t.func is mock_main_analysis), None
    )
    assert main_analysis_task is not None, (
        "Expected _run_main_analysis_for_video to be scheduled for V1 cache miss + plan pro"
    )
    assert main_analysis_task.kwargs["url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert main_analysis_task.kwargs["video_id"] == "dQw4w9WgXcQ"
    assert main_analysis_task.kwargs["user_id"] == user.id
    assert main_analysis_task.kwargs["user_plan"] == "pro"


@pytest.mark.asyncio
async def test_v1_cache_miss_plan_free_does_not_schedule_auto_analysis(mock_db_session):
    """V1 + plan free + no cached analysis → no auto-analysis (fallback to production orchestrator)."""
    from voice.router import create_voice_session

    _configure_db_for_cache(mock_db_session, cache_hit=False)

    user = _make_v1_user("free")
    request = _make_v1_request()
    bg_tasks = BackgroundTasks()

    patches = _patch_common()
    for p in patches:
        p.start()
    try:
        with patch(
            "voice.router._run_main_analysis_for_video",
            new=AsyncMock(),
        ) as mock_main_analysis:
            response = await create_voice_session(
                request,
                background_tasks=bg_tasks,
                current_user=user,
                db=mock_db_session,
                redis=AsyncMock(),
            )
    finally:
        for p in patches:
            p.stop()

    assert response is not None

    # Free plan must not pay for an auto-generated Mistral analysis.
    main_analysis_tasks = [t for t in bg_tasks.tasks if t.func is mock_main_analysis]
    assert main_analysis_tasks == [], (
        "Free plan must not schedule _run_main_analysis_for_video on cache miss"
    )

    # The orchestrator IS still scheduled (transcript-only fallback).
    assert len(bg_tasks.tasks) == 1


@pytest.mark.asyncio
async def test_v1_cache_hit_plan_pro_does_not_schedule_auto_analysis(mock_db_session):
    """V1 + plan pro + cached Summary with full_digest → no auto-analysis."""
    from voice.router import create_voice_session

    _configure_db_for_cache(mock_db_session, cache_hit=True)

    user = _make_v1_user("pro")
    request = _make_v1_request()
    bg_tasks = BackgroundTasks()

    patches = _patch_common()
    for p in patches:
        p.start()
    try:
        with patch(
            "voice.router._run_main_analysis_for_video",
            new=AsyncMock(),
        ) as mock_main_analysis:
            response = await create_voice_session(
                request,
                background_tasks=bg_tasks,
                current_user=user,
                db=mock_db_session,
                redis=AsyncMock(),
            )
    finally:
        for p in patches:
            p.stop()

    assert response is not None

    main_analysis_tasks = [t for t in bg_tasks.tasks if t.func is mock_main_analysis]
    assert main_analysis_tasks == [], (
        "Cache hit must not re-trigger Mistral analysis"
    )

    # Production orchestrator scheduled (cache fetcher will read the summary).
    assert len(bg_tasks.tasks) == 1
