"""Integration tests for POST /api/voice/session with `is_streaming=True`
(Quick Voice Call Task 6).

Following the existing voice tests pattern (see test_voice_session_companion.py),
the function is invoked directly with mocks. We verify the new branch:
  * Free first-use → 200 + is_trial + max_minutes=3
  * Pro → 402 with cta=upgrade_expert
  * Expert with quota remaining → 200 + max_minutes>0
  * Free after trial used → 402 with cta=upgrade_expert + reason=trial_used
  * Streaming session triggers the orchestrator background task
  * `video_id=None` with `is_streaming=True` → 400 (video_id_required)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import BackgroundTasks, HTTPException


def _make_voice_prefs() -> MagicMock:
    """VoicePreferences-shaped mock the router can consume (mirrors
    test_voice_session_companion.py)."""
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


def _make_user(plan: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.email = f"u{user_id}@test.fr"
    user.plan = plan
    user.is_admin = False
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = "cus_test"
    user.username = f"u{user_id}"
    return user


def _patch_eleven_client():
    eleven_client = AsyncMock()
    eleven_client.create_conversation_agent = AsyncMock(return_value="agent_streaming_123")
    eleven_client.get_signed_url = AsyncMock(
        return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z")
    )
    eleven_client.get_conversation_token = AsyncMock(
        return_value=("livekit_token_xyz", "2026-04-25T11:00:00Z")
    )
    eleven_cm = AsyncMock()
    eleven_cm.__aenter__ = AsyncMock(return_value=eleven_client)
    eleven_cm.__aexit__ = AsyncMock(return_value=False)
    return eleven_cm


def _build_db_session():
    db = AsyncMock()

    captured = []

    def _fake_add(obj):
        captured.append(obj)
        if getattr(obj, "id", None) is None:
            import uuid as _uuid

            obj.id = str(_uuid.uuid4())

    db.add = MagicMock(side_effect=_fake_add)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()
    return db, captured


@pytest.mark.asyncio
async def test_streaming_session_requires_video_id():
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    request = VoiceSessionRequest(
        agent_type="explorer_streaming", is_streaming=True, language="fr"
    )
    db, _ = _build_db_session()
    user = _make_user("free")

    with pytest.raises(HTTPException) as exc:
        await create_voice_session(
            request,
            background_tasks=BackgroundTasks(),
            current_user=user,
            db=db,
            redis=AsyncMock(),
        )
    assert exc.value.status_code == 400
    assert "video_id_required" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_streaming_pro_user_gets_402_with_cta_upgrade_expert():
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest
    from billing.voice_quota import QuotaCheck

    request = VoiceSessionRequest(
        video_id="vid123",
        agent_type="explorer_streaming",
        is_streaming=True,
        language="fr",
    )
    db, _ = _build_db_session()
    user = _make_user("pro")

    blocked = QuotaCheck(allowed=False, reason="pro_no_voice", cta="upgrade_expert")

    with patch(
        "voice.router.check_voice_quota_streaming",
        new=AsyncMock(return_value=blocked),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_voice_session(
                request,
                background_tasks=BackgroundTasks(),
                current_user=user,
                db=db,
                redis=AsyncMock(),
            )
    assert exc.value.status_code == 402
    detail = exc.value.detail
    assert detail["cta"] == "upgrade_expert"
    assert detail["reason"] == "pro_no_voice"


@pytest.mark.asyncio
async def test_streaming_free_first_use_creates_streaming_session():
    """Free user with no prior trial → 200 + is_trial=True + max_minutes=3."""
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest
    from billing.voice_quota import QuotaCheck

    request = VoiceSessionRequest(
        video_id="vid123",
        agent_type="explorer_streaming",
        is_streaming=True,
        language="fr",
    )
    db, captured = _build_db_session()
    user = _make_user("free")

    quota = QuotaCheck(allowed=True, max_minutes=3.0, is_trial=True)
    bg = BackgroundTasks()
    redis_mock = AsyncMock()

    with patch(
        "voice.router.check_voice_quota_streaming",
        new=AsyncMock(return_value=quota),
    ), patch(
        "voice.router.get_elevenlabs_client",
        return_value=_patch_eleven_client(),
    ), patch(
        "voice.preferences.get_user_voice_preferences",
        new=AsyncMock(return_value=_make_voice_prefs()),
    ):
        response = await create_voice_session(
            request,
            background_tasks=bg,
            current_user=user,
            db=db,
            redis=redis_mock,
        )

    assert response.is_streaming is True
    assert response.is_trial is True
    assert response.max_minutes == 3.0
    assert response.signed_url == "wss://signed.example.test"
    # VoiceSession was persisted with is_streaming_session=True
    assert len(captured) == 1
    assert captured[0].is_streaming_session is True


@pytest.mark.asyncio
async def test_streaming_expert_with_quota_remaining_succeeds():
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest
    from billing.voice_quota import QuotaCheck

    request = VoiceSessionRequest(
        video_id="vid123",
        agent_type="explorer_streaming",
        is_streaming=True,
        language="fr",
    )
    db, _ = _build_db_session()
    user = _make_user("expert")

    quota = QuotaCheck(allowed=True, max_minutes=20.0)

    with patch(
        "voice.router.check_voice_quota_streaming",
        new=AsyncMock(return_value=quota),
    ), patch(
        "voice.router.get_elevenlabs_client",
        return_value=_patch_eleven_client(),
    ), patch(
        "voice.preferences.get_user_voice_preferences",
        new=AsyncMock(return_value=_make_voice_prefs()),
    ):
        response = await create_voice_session(
            request,
            background_tasks=BackgroundTasks(),
            current_user=user,
            db=db,
            redis=AsyncMock(),
        )

    assert response.is_streaming is True
    assert response.is_trial is False
    assert response.max_minutes == 20.0


@pytest.mark.asyncio
async def test_streaming_free_after_trial_used_returns_402_trial_used():
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest
    from billing.voice_quota import QuotaCheck

    request = VoiceSessionRequest(
        video_id="vid123",
        agent_type="explorer_streaming",
        is_streaming=True,
        language="fr",
    )
    db, _ = _build_db_session()
    user = _make_user("free")

    blocked = QuotaCheck(allowed=False, reason="trial_used", cta="upgrade_expert")

    with patch(
        "voice.router.check_voice_quota_streaming",
        new=AsyncMock(return_value=blocked),
    ):
        with pytest.raises(HTTPException) as exc:
            await create_voice_session(
                request,
                background_tasks=BackgroundTasks(),
                current_user=user,
                db=db,
                redis=AsyncMock(),
            )
    assert exc.value.status_code == 402
    assert exc.value.detail["cta"] == "upgrade_expert"
    assert exc.value.detail["reason"] == "trial_used"


@pytest.mark.asyncio
async def test_streaming_session_schedules_orchestrator_background_task():
    """Verify the streaming orchestrator is added to BackgroundTasks."""
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest
    from billing.voice_quota import QuotaCheck

    request = VoiceSessionRequest(
        video_id="vid_orchestrator",
        agent_type="explorer_streaming",
        is_streaming=True,
        language="fr",
    )
    db, _ = _build_db_session()
    user = _make_user("free")
    quota = QuotaCheck(allowed=True, max_minutes=3.0, is_trial=True)
    bg = BackgroundTasks()

    with patch(
        "voice.router.check_voice_quota_streaming",
        new=AsyncMock(return_value=quota),
    ), patch(
        "voice.router.get_elevenlabs_client",
        return_value=_patch_eleven_client(),
    ), patch(
        "voice.preferences.get_user_voice_preferences",
        new=AsyncMock(return_value=_make_voice_prefs()),
    ):
        await create_voice_session(
            request,
            background_tasks=bg,
            current_user=user,
            db=db,
            redis=AsyncMock(),
        )
    # Exactly one orchestrator task scheduled
    assert len(bg.tasks) == 1
    task = bg.tasks[0]
    # Either kwargs OR positional args carry the video_id
    found_video_id = False
    if hasattr(task, "kwargs") and task.kwargs:
        found_video_id = task.kwargs.get("video_id") == "vid_orchestrator"
    if not found_video_id and hasattr(task, "args"):
        found_video_id = "vid_orchestrator" in task.args
    assert found_video_id, "Orchestrator task should carry video_id=vid_orchestrator"


@pytest.mark.asyncio
async def test_non_streaming_request_path_unchanged():
    """Sanity: a non-streaming session for companion still works (smoke).

    We don't reproduce the full companion flow here — that's covered by
    test_voice_session_companion.py — but we assert the new branch did not
    break the legacy code path by calling check_voice_quota_streaming which
    must NOT be invoked when is_streaming=False.
    """
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    request = VoiceSessionRequest(agent_type="companion", is_streaming=False, language="fr")
    db, _ = _build_db_session()
    user = _make_user("pro", user_id=2)
    user.voice_bonus_seconds = 300

    streaming_check = AsyncMock()  # Should NEVER be called

    with patch(
        "voice.router.check_voice_quota_streaming",
        new=streaming_check,
    ), patch(
        "voice.router.check_voice_quota",
        new=AsyncMock(return_value={"can_use": True, "seconds_remaining": 600, "seconds_used": 0, "seconds_limit": 900, "bonus_seconds": 0, "warning_level": None}),
    ), patch(
        "voice.router.get_elevenlabs_client",
        return_value=_patch_eleven_client(),
    ), patch(
        "voice.preferences.get_user_voice_preferences",
        new=AsyncMock(return_value=_make_voice_prefs()),
    ):
        response = await create_voice_session(
            request,
            background_tasks=BackgroundTasks(),
            current_user=user,
            db=db,
            redis=None,  # No streaming — Redis not needed
        )

    assert response.is_streaming is False
    assert response.is_trial is False
    streaming_check.assert_not_called()
