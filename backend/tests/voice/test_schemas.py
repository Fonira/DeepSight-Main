"""Tests pour voice/schemas.py - VoiceSessionRequest avec video_url (Quick Voice Call mobile V3)."""
import pytest
from voice.schemas import VoiceSessionRequest


class TestVoiceSessionRequestVideoURL:
    def test_accepts_video_url_with_explorer_streaming(self):
        req = VoiceSessionRequest(
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            agent_type="explorer_streaming",
            language="fr",
        )
        assert req.video_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert req.agent_type == "explorer_streaming"

    def test_rejects_video_url_with_summary_id(self):
        with pytest.raises(ValueError, match="un seul"):
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                summary_id=42,
                agent_type="explorer_streaming",
            )

    def test_rejects_video_url_with_debate_id(self):
        with pytest.raises(ValueError, match="un seul"):
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                debate_id=7,
                agent_type="explorer_streaming",
            )

    def test_rejects_video_url_with_wrong_agent_type(self):
        with pytest.raises(ValueError, match="explorer_streaming"):
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                agent_type="explorer",  # mauvais
            )

    def test_existing_summary_id_flow_still_works(self):
        req = VoiceSessionRequest(summary_id=42, agent_type="explorer")
        assert req.summary_id == 42
        assert req.video_url is None
