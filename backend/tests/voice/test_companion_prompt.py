import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from voice.companion_prompt import render_companion_prompt
from voice.schemas import CompanionContextResponse, ProfileBlock, RecoItem


def test_render_companion_prompt_substitutes_all_fields():
    ctx = CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Maxime", plan="pro", langue="fr", total_analyses=42,
            recent_titles=["IA et conscience", "Géopolitique 2026"],
            themes=["IA", "philo", "géopolitique"],
            streak_days=12, flashcards_due_today=8,
        ),
        initial_recos=[
            RecoItem(video_id="r1", title="Reco 1", channel="C1",
                     duration_seconds=600, source="history_similarity",
                     why="Similaire à ton analyse"),
            RecoItem(video_id="r2", title="Reco 2", channel="C2",
                     duration_seconds=400, source="trending",
                     why="Cartonne en ce moment"),
        ],
        cache_hit=False,
    )
    prompt = render_companion_prompt(ctx)
    assert "Maxime" in prompt
    assert "IA et conscience" in prompt
    assert "Reco 1" in prompt
    assert "Reco 2" in prompt
    assert "12" in prompt  # streak
    assert "get_more_recos" in prompt
    assert "start_analysis" in prompt


def test_render_companion_prompt_handles_empty_recos():
    ctx = CompanionContextResponse(
        profile=ProfileBlock(prenom="X", plan="pro", langue="fr",
                              total_analyses=0, recent_titles=[],
                              themes=[], streak_days=0, flashcards_due_today=0),
        initial_recos=[],
    )
    prompt = render_companion_prompt(ctx)
    assert "X" in prompt
    assert "Aucune reco pré-préparée" in prompt or "aucune reco" in prompt.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# Task 14 — Integration: enriched companion prompt is injected at /voice/session
# ═══════════════════════════════════════════════════════════════════════════════


def _make_voice_prefs() -> MagicMock:
    """Return a VoicePreferences-shaped mock the router can consume."""
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


def _make_mock_voice_user() -> MagicMock:
    """User mock allowed on the pro plan (companion requires pro)."""
    user = MagicMock()
    user.id = 1
    user.email = "voice@test.fr"
    user.plan = "pro"
    user.is_admin = False
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = "cus_test123"
    user.username = "voice_tester"
    user.first_name = "Maxime"
    user.prenom = "Maxime"
    user.language = "fr"
    return user


@pytest.mark.asyncio
async def test_voice_session_companion_injects_enriched_prompt(mock_db_session):
    """When agent_type=companion, the system_prompt sent to ElevenLabs is the
    enriched render produced by render_companion_prompt(build_companion_context(...)).

    Integration-style: we patch build_companion_context to return a deterministic
    payload, mock the ElevenLabs client and check that create_conversation_agent
    receives a system_prompt containing the COMPANION_TEMPLATE markers
    ("DeepSight Companion", the user's prénom, etc.). No regression on the
    static companion prompt fallback because the patch always succeeds.
    """
    from voice.router import create_voice_session
    from voice.schemas import VoiceSessionRequest

    mock_user = _make_mock_voice_user()
    request = VoiceSessionRequest(agent_type="companion", language="fr")

    fake_ctx = CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Maxime",
            plan="pro",
            langue="fr",
            total_analyses=42,
            recent_titles=["IA et conscience", "Géopolitique 2026"],
            themes=["IA", "philo"],
            streak_days=12,
            flashcards_due_today=8,
        ),
        initial_recos=[
            RecoItem(
                video_id="r1",
                title="Reco Companion 1",
                channel="C1",
                duration_seconds=600,
                source="history_similarity",
                why="Aligné avec ta dernière analyse",
            ),
        ],
    )

    # Companion has no summary/debate → no DB fetch needed for ownership check.
    # The session creation still calls db.add / commit / refresh.
    def _fake_add(obj):
        if getattr(obj, "id", None) is None:
            import uuid as _uuid

            obj.id = str(_uuid.uuid4())

    mock_db_session.add = MagicMock(side_effect=_fake_add)
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # ── ElevenLabs client mock — capture create_conversation_agent kwargs ──
    captured: dict = {}

    async def fake_create_agent(**kwargs):
        captured["agent_kwargs"] = kwargs
        return "agent_companion_test"

    eleven_client = AsyncMock()
    eleven_client.create_conversation_agent = fake_create_agent
    eleven_client.get_signed_url = AsyncMock(
        return_value=("wss://signed.example.test", "2026-04-25T11:00:00Z")
    )
    eleven_client.get_conversation_token = AsyncMock(
        return_value=("livekit_token_xyz", "2026-04-25T11:00:00Z")
    )
    eleven_cm = AsyncMock()
    eleven_cm.__aenter__ = AsyncMock(return_value=eleven_client)
    eleven_cm.__aexit__ = AsyncMock(return_value=False)

    with (
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
            "voice.router.build_companion_context",
            new=AsyncMock(return_value=fake_ctx),
        ) as mock_build,
    ):
        await create_voice_session(
            request,
            current_user=mock_user,
            db=mock_db_session,
        )

    # build_companion_context must have been called (companion branch hit)
    assert mock_build.await_count == 1
    kwargs = mock_build.call_args.kwargs
    assert kwargs["user"] is mock_user
    assert kwargs["db"] is mock_db_session

    # The enriched render (and not the static agent_config prompt) was forwarded.
    sent_prompt = captured["agent_kwargs"].get("system_prompt", "")
    assert "DeepSight Companion" in sent_prompt
    assert "Maxime" in sent_prompt
    assert "Reco Companion 1" in sent_prompt
    assert "IA et conscience" in sent_prompt
    # The static companion system_prompt header must NOT be present —
    # confirms we replaced rather than concatenated.
    assert "compagnon de réflexion vocal DeepSight" not in sent_prompt
