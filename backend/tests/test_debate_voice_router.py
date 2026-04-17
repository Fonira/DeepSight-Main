"""Integration tests for debate voice endpoints — schema validation first.

Full end-to-end tests are added in Task 11.
"""
import pytest
from pydantic import ValidationError

from voice.schemas import VoiceSessionRequest


def test_voice_session_request_rejects_both_ids():
    with pytest.raises(ValidationError) as exc_info:
        VoiceSessionRequest(summary_id=1, debate_id=2, agent_type="debate_moderator")
    assert "summary_id OU debate_id" in str(exc_info.value)


def test_voice_session_request_accepts_debate_id_only():
    req = VoiceSessionRequest(debate_id=42, agent_type="debate_moderator")
    assert req.debate_id == 42
    assert req.summary_id is None


def test_voice_session_request_accepts_summary_id_only():
    req = VoiceSessionRequest(summary_id=99, agent_type="explorer")
    assert req.summary_id == 99
    assert req.debate_id is None


def test_voice_session_request_accepts_neither_for_onboarding():
    req = VoiceSessionRequest(agent_type="onboarding")
    assert req.summary_id is None
    assert req.debate_id is None
