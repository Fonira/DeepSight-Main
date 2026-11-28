"""Webhook post-appel ElevenLabs : signature, format réel et décompte des minutes.

Le format testé est celui que documente ElevenLabs (post-call webhooks) :
en-tête ``ElevenLabs-Signature: t=<ts>,v0=<hmac>`` signant ``"<ts>.<corps>"``,
corps ``{"type": "post_call_transcription", "event_timestamp": …, "data": {…}}``
avec la durée dans ``data.metadata.call_duration_secs``.
"""

import hashlib
import hmac
import json
import os
import sys
import time
from datetime import datetime
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from httpx import ASGITransport, AsyncClient  # noqa: E402

SECRET = "wsec_test_secret"
AGENT_ID = "agent_7f3a"
CONVERSATION_ID = "conv_91b2"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _sign(raw_body: bytes, secret: str = SECRET, timestamp: Optional[int] = None) -> str:
    ts = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(secret.encode(), f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return f"t={ts},v0={digest}"


def _transcription_event(
    *,
    duration: float = 124.2,
    status: str = "done",
    agent_id: str = AGENT_ID,
    conversation_id: str = CONVERSATION_ID,
) -> dict[str, Any]:
    return {
        "type": "post_call_transcription",
        "event_timestamp": 1739537297,
        "data": {
            "agent_id": agent_id,
            "conversation_id": conversation_id,
            "status": status,
            "user_id": None,
            "transcript": [
                {"role": "agent", "message": "Bonjour, de quoi parle-t-on ?", "time_in_call_secs": 0},
                {"role": "user", "message": "Résume la vidéo\nen deux phrases.", "time_in_call_secs": 4},
                {"role": "agent", "message": None, "tool_calls": [{"tool_name": "sources"}], "time_in_call_secs": 6},
            ],
            "metadata": {"start_time_unix_secs": 1739537000, "call_duration_secs": duration, "cost": 296},
            "analysis": {"call_successful": "success", "transcript_summary": "…"},
            "conversation_initiation_client_data": {"dynamic_variables": {"system__agent_id": agent_id}},
        },
    }


def _result(obj: Any) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.first.return_value = obj
    return result


def _voice_session(*, streaming: bool, ended: bool = False):
    from db.database import VoiceSession

    session = VoiceSession(
        id="sess-1",
        user_id=7,
        summary_id=42,
        elevenlabs_agent_id=AGENT_ID,
        is_streaming_session=streaming,
        status="active",
        started_at=datetime(2026, 11, 28, 10, 0, 0),
    )
    if ended:
        session.ended_at = datetime(2026, 11, 28, 10, 3, 0)
    return session


def _elevenlabs_client_mock() -> MagicMock:
    client = MagicMock()
    client.delete_agent = AsyncMock(return_value=True)
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=client)
    context.__aexit__ = AsyncMock(return_value=False)
    factory = MagicMock(return_value=context)
    factory.client = client
    return factory


# ─────────────────────────────────────────────────────────────────────────────
# Signature
# ─────────────────────────────────────────────────────────────────────────────


class TestVerifyElevenLabsSignature:
    body = b'{"type":"post_call_transcription","data":{}}'

    def test_accepts_valid_signature(self):
        from voice.webhook import verify_elevenlabs_signature

        verify_elevenlabs_signature(self.body, _sign(self.body), SECRET)

    def test_accepts_any_matching_v0_during_secret_rotation(self):
        from voice.webhook import verify_elevenlabs_signature

        ts = int(time.time())
        good = _sign(self.body, timestamp=ts).split("v0=")[1]
        verify_elevenlabs_signature(self.body, f"t={ts},v0={'0' * 64},v0={good}", SECRET)

    @pytest.mark.parametrize(
        ("header", "code"),
        [
            (None, "missing_signature"),
            ("", "missing_signature"),
            ("v0=abc", "malformed_signature"),
            ("t=1739537297", "malformed_signature"),
            ("t=soon,v0=abc", "malformed_signature"),
        ],
    )
    def test_rejects_missing_or_malformed_header(self, header, code):
        from voice.webhook import WebhookSignatureError, verify_elevenlabs_signature

        with pytest.raises(WebhookSignatureError) as exc:
            verify_elevenlabs_signature(self.body, header, SECRET)
        assert exc.value.code == code

    @pytest.mark.parametrize("offset", [-31 * 60, 31 * 60])
    def test_rejects_timestamp_outside_30_minutes(self, offset):
        from voice.webhook import WebhookSignatureError, verify_elevenlabs_signature

        header = _sign(self.body, timestamp=int(time.time()) + offset)
        with pytest.raises(WebhookSignatureError) as exc:
            verify_elevenlabs_signature(self.body, header, SECRET)
        assert exc.value.code == "stale_signature"

    def test_rejects_tampered_body_and_wrong_secret(self):
        from voice.webhook import WebhookSignatureError, verify_elevenlabs_signature

        with pytest.raises(WebhookSignatureError) as tampered:
            verify_elevenlabs_signature(self.body + b" ", _sign(self.body), SECRET)
        with pytest.raises(WebhookSignatureError) as wrong_secret:
            verify_elevenlabs_signature(self.body, _sign(self.body, secret="other"), SECRET)
        assert tampered.value.code == wrong_secret.value.code == "invalid_signature"

    def test_legacy_plain_hmac_header_is_refused(self):
        """L'ancien format (HMAC du corps seul, sans t=) n'est pas celui d'ElevenLabs."""
        from voice.webhook import WebhookSignatureError, verify_elevenlabs_signature

        legacy = hmac.new(SECRET.encode(), self.body, hashlib.sha256).hexdigest()
        with pytest.raises(WebhookSignatureError):
            verify_elevenlabs_signature(self.body, legacy, SECRET)


# ─────────────────────────────────────────────────────────────────────────────
# Payload & transcript
# ─────────────────────────────────────────────────────────────────────────────


class TestPostCallPayload:
    def test_parses_documented_transcription_event(self):
        from voice.schemas import ElevenLabsPostCallData, VoiceWebhookPayload

        payload = VoiceWebhookPayload.model_validate(_transcription_event())
        data = ElevenLabsPostCallData.model_validate(payload.data)

        assert payload.type == "post_call_transcription"
        assert data.agent_id == AGENT_ID
        assert data.conversation_id == CONVERSATION_ID
        assert data.duration_seconds == 125  # 124.2 s facturées 125 s
        assert [turn.role for turn in data.transcript] == ["agent", "user", "agent"]

    def test_null_transcript_and_metadata_fall_back_to_defaults(self):
        from voice.schemas import ElevenLabsPostCallData

        data = ElevenLabsPostCallData.model_validate({"agent_id": AGENT_ID, "transcript": None, "metadata": None})
        assert data.transcript == []
        assert data.duration_seconds == 0

    def test_transcript_to_text_skips_tool_turns_and_flattens_lines(self):
        from voice.schemas import ElevenLabsPostCallData
        from voice.webhook import transcript_to_text

        data = ElevenLabsPostCallData.model_validate(_transcription_event()["data"])
        assert transcript_to_text(data.transcript) == (
            "AI: Bonjour, de quoi parle-t-on ?\nUser: Résume la vidéo en deux phrases."
        )

    def test_text_transcript_is_understood_by_the_reconciler(self):
        from voice.router import parse_transcript_canonical
        from voice.schemas import ElevenLabsPostCallData
        from voice.webhook import transcript_to_text

        data = ElevenLabsPostCallData.model_validate(_transcription_event()["data"])
        turns = parse_transcript_canonical(transcript_to_text(data.transcript))
        assert [turn["speaker"] for turn in turns] == ["agent", "user"]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint POST /api/voice/webhook
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.get = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def webhook_secret(monkeypatch):
    import core.config as core_config

    monkeypatch.setattr(core_config._settings, "ELEVENLABS_WEBHOOK_SECRET", SECRET)
    return SECRET


@pytest.fixture
def patched_side_effects():
    """Décompte, réconciliation, digest et nettoyage d'agent observés sans réseau ni DB."""
    elevenlabs = _elevenlabs_client_mock()
    with (
        patch("voice.router.deduct_voice_usage", new=AsyncMock(return_value=2.0)) as deduct,
        patch("voice.router.consume_voice_minutes", new=AsyncMock()) as consume,
        patch(
            "voice.router.reconcile_voice_transcript",
            new=AsyncMock(return_value={"inserted": 0, "updated": 0}),
        ) as reconcile,
        patch("voice.router._schedule_voice_session_digest") as digest,
        patch("voice.router.get_elevenlabs_client", new=elevenlabs),
    ):
        yield {
            "deduct": deduct,
            "consume": consume,
            "reconcile": reconcile,
            "digest": digest,
            "elevenlabs": elevenlabs.client,
        }


@pytest.fixture
async def client(mock_session):
    from main import app
    from db.database import get_session

    async def override_session():
        return mock_session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _post(client: AsyncClient, event: dict[str, Any], *, header: Optional[str] = "sign"):
    raw = json.dumps(event).encode()
    headers = {"Content-Type": "application/json"}
    if header == "sign":
        headers["ElevenLabs-Signature"] = _sign(raw)
    elif header is not None:
        headers["ElevenLabs-Signature"] = header
    return await client.post("/api/voice/webhook", content=raw, headers=headers)


class TestVoiceWebhookEndpoint:
    async def test_refuses_everything_when_no_secret_is_configured(self, client, monkeypatch):
        import core.config as core_config

        monkeypatch.setattr(core_config._settings, "ELEVENLABS_WEBHOOK_SECRET", "")
        response = await _post(client, _transcription_event(), header=None)

        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "webhook_not_configured"

    @pytest.mark.parametrize(
        ("header", "code"),
        [(None, "missing_signature"), ("t=1,v0=deadbeef", "stale_signature")],
    )
    async def test_rejects_unsigned_or_stale_requests(
        self, client, webhook_secret, mock_session, patched_side_effects, header, code
    ):
        response = await _post(client, _transcription_event(), header=header)

        assert response.status_code == 401
        assert response.json()["detail"]["code"] == code
        mock_session.execute.assert_not_called()
        patched_side_effects["deduct"].assert_not_called()

    async def test_rejects_signed_body_that_is_not_an_event(self, client, webhook_secret, patched_side_effects):
        response = await _post(client, {"data": {}})

        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "invalid_payload"

    async def test_acknowledges_audio_events_without_touching_quotas(
        self, client, webhook_secret, mock_session, patched_side_effects
    ):
        event = {
            "type": "post_call_audio",
            "event_timestamp": 1739537297,
            "data": {"agent_id": AGENT_ID, "conversation_id": CONVERSATION_ID, "full_audio": "SUQz"},
        }
        response = await _post(client, event)

        assert response.status_code == 200
        assert response.json() == {"status": "ignored", "session_id": None, "minutes_deducted": 0.0}
        mock_session.execute.assert_not_called()

    async def test_acknowledges_agents_that_are_not_deepsight_sessions(
        self, client, webhook_secret, mock_session, patched_side_effects
    ):
        mock_session.execute.side_effect = [_result(None), _result(None)]
        response = await _post(client, _transcription_event(agent_id="agent_other"))

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
        patched_side_effects["deduct"].assert_not_called()
        patched_side_effects["consume"].assert_not_called()

    async def test_quick_voice_call_consumes_streaming_minutes(
        self, client, webhook_secret, mock_session, patched_side_effects
    ):
        voice_session = _voice_session(streaming=True)
        user = MagicMock(id=7, plan="expert")
        mock_session.execute.side_effect = [_result(None), _result(voice_session)]
        mock_session.get.return_value = user

        response = await _post(client, _transcription_event(duration=124.2))

        assert response.status_code == 200
        assert response.json() == {"status": "ok", "session_id": "sess-1", "minutes_deducted": 2.08}
        consume = patched_side_effects["consume"]
        consume.assert_awaited_once()
        assert consume.await_args.args[0] is user
        assert consume.await_args.args[1] == pytest.approx(125 / 60)
        patched_side_effects["deduct"].assert_not_called()

        assert voice_session.ended_at is not None
        assert voice_session.status == "completed"
        assert voice_session.duration_seconds == 125
        assert voice_session.elevenlabs_conversation_id == CONVERSATION_ID
        assert voice_session.conversation_transcript.startswith("AI: Bonjour")

        patched_side_effects["reconcile"].assert_awaited_once()
        patched_side_effects["digest"].assert_called_once_with("sess-1")
        patched_side_effects["elevenlabs"].delete_agent.assert_awaited_once_with(AGENT_ID)

    async def test_classic_voice_chat_deducts_the_monthly_seconds(
        self, client, webhook_secret, mock_session, patched_side_effects
    ):
        voice_session = _voice_session(streaming=False)
        mock_session.execute.side_effect = [_result(None), _result(voice_session)]

        response = await _post(client, _transcription_event(duration=120))

        assert response.status_code == 200
        assert response.json()["minutes_deducted"] == 2.0
        patched_side_effects["deduct"].assert_awaited_once_with(7, duration_seconds=120, db=mock_session)
        patched_side_effects["consume"].assert_not_called()

    async def test_redelivered_event_is_not_counted_twice(
        self, client, webhook_secret, mock_session, patched_side_effects
    ):
        voice_session = _voice_session(streaming=True, ended=True)
        mock_session.execute.side_effect = [_result(voice_session)]

        response = await _post(client, _transcription_event())

        assert response.status_code == 200
        assert response.json() == {"status": "duplicate", "session_id": "sess-1", "minutes_deducted": 0.0}
        patched_side_effects["consume"].assert_not_called()
        patched_side_effects["deduct"].assert_not_called()
        patched_side_effects["elevenlabs"].delete_agent.assert_not_called()

    async def test_zero_second_call_keeps_the_free_trial(
        self, client, webhook_secret, mock_session, patched_side_effects
    ):
        voice_session = _voice_session(streaming=True)
        mock_session.execute.side_effect = [_result(None), _result(voice_session)]
        mock_session.get.return_value = MagicMock(id=7, plan="free")

        response = await _post(client, _transcription_event(duration=0))

        assert response.status_code == 200
        assert response.json()["minutes_deducted"] == 0.0
        patched_side_effects["consume"].assert_not_called()
        mock_session.commit.assert_awaited()
        assert voice_session.ended_at is not None

    async def test_failed_call_is_still_billed(self, client, webhook_secret, mock_session, patched_side_effects):
        voice_session = _voice_session(streaming=True)
        mock_session.execute.side_effect = [_result(None), _result(voice_session)]
        mock_session.get.return_value = MagicMock(id=7, plan="pro")

        response = await _post(client, _transcription_event(duration=30, status="failed"))

        assert response.status_code == 200
        assert voice_session.status == "failed"
        patched_side_effects["consume"].assert_awaited_once()
