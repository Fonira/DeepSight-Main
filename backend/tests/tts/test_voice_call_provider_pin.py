"""
Phase 7 — Voice-call hard-pin to ElevenLabs.

These tests guard the policy documented in
``backend/docs/architecture/tts-policy.md``: Quick Voice Call (and the other
``/api/voice/*`` session creators) MUST go through ElevenLabs Conversational
AI — never through the multi-provider chain in ``tts/providers.py``.

The pin is enforced in three places, each verified here:

1. ``voice.elevenlabs`` exposes ``VOICE_CALL_PROVIDER`` and a whitelist of
   allowed model_ids.
2. ``voice.elevenlabs.ElevenLabsClient.create_conversation_agent`` raises
   ``ValueError`` when called with a non-ElevenLabs model_id (defence in
   depth — even if the Pydantic schema is bypassed).
3. The voice session route is annotated to emit the
   ``X-TTS-Provider: elevenlabs`` response header (observability).
"""

from __future__ import annotations

import os
import sys

import pytest

# Make ``backend/src`` importable like the other test files in this folder.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


# ─────────────────────────────────────────────────────────────────────────────
# 1. Constants exist and reflect the policy
# ─────────────────────────────────────────────────────────────────────────────


class TestVoiceCallProviderConstants:
    def test_voice_call_provider_is_elevenlabs(self):
        from voice.elevenlabs import VOICE_CALL_PROVIDER

        assert VOICE_CALL_PROVIDER == "elevenlabs"

    def test_allowed_models_only_elevenlabs(self):
        from voice.elevenlabs import ALLOWED_VOICE_CALL_MODELS

        # All accepted ids are ElevenLabs models — the prefix is the
        # marker. No openai/voxtral/etc. should ever sneak in.
        assert ALLOWED_VOICE_CALL_MODELS, "Whitelist must not be empty"
        for model_id in ALLOWED_VOICE_CALL_MODELS:
            assert model_id.startswith("eleven_"), (
                f"Non-ElevenLabs model_id {model_id!r} leaked into the "
                f"voice-call whitelist — see tts-policy.md"
            )

    def test_flash_v2_5_is_allowed(self):
        """The recommended low-latency model must remain whitelisted."""
        from voice.elevenlabs import ALLOWED_VOICE_CALL_MODELS

        assert "eleven_flash_v2_5" in ALLOWED_VOICE_CALL_MODELS


# ─────────────────────────────────────────────────────────────────────────────
# 2. ``create_conversation_agent`` rejects non-ElevenLabs models
# ─────────────────────────────────────────────────────────────────────────────


class TestCreateConversationAgentHardPin:
    @pytest.mark.asyncio
    async def test_rejects_openai_model(self):
        from voice.elevenlabs import ElevenLabsClient

        client = ElevenLabsClient(api_key="dummy")
        try:
            with pytest.raises(ValueError, match="hard-pinned to ElevenLabs"):
                await client.create_conversation_agent(
                    system_prompt="You are a test agent.",
                    tools=[],
                    voice_id="voice-test",
                    model_id="tts-1",  # OpenAI model — must be rejected
                )
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_rejects_voxtral_model(self):
        from voice.elevenlabs import ElevenLabsClient

        client = ElevenLabsClient(api_key="dummy")
        try:
            with pytest.raises(ValueError, match="hard-pinned to ElevenLabs"):
                await client.create_conversation_agent(
                    system_prompt="You are a test agent.",
                    tools=[],
                    voice_id="voice-test",
                    model_id="voxtral-mini-tts-2603",  # Mistral model — rejected
                )
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_rejects_arbitrary_string(self):
        from voice.elevenlabs import ElevenLabsClient

        client = ElevenLabsClient(api_key="dummy")
        try:
            with pytest.raises(ValueError, match="hard-pinned to ElevenLabs"):
                await client.create_conversation_agent(
                    system_prompt="You are a test agent.",
                    tools=[],
                    voice_id="voice-test",
                    model_id="anthropic-claude",
                )
        finally:
            await client.close()


# ─────────────────────────────────────────────────────────────────────────────
# 3. Route emits the X-TTS-Provider observability header
# ─────────────────────────────────────────────────────────────────────────────


class TestVoiceSessionRouteEmitsHeader:
    """Static guard — ensure the route source actually sets the header.

    A full integration test of ``POST /api/voice/session`` requires DB +
    Redis + ElevenLabs + JWT plumbing; the conftest in this folder is
    minimal. The header instruction is mechanically grep-able, so a
    string-level test gives a low-friction regression guard that
    triggers immediately if a future refactor removes the line.
    """

    def test_route_sets_x_tts_provider_header(self):
        # Locate router.py relative to the test file (works regardless of cwd)
        router_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "src",
            "voice",
            "router.py",
        )
        with open(router_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert 'response.headers["X-TTS-Provider"] = VOICE_CALL_PROVIDER' in content, (
            "Voice session route must emit X-TTS-Provider observability "
            "header — see backend/docs/architecture/tts-policy.md (Phase 7)."
        )

    def test_router_imports_hard_pin_constants(self):
        router_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "src",
            "voice",
            "router.py",
        )
        with open(router_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "VOICE_CALL_PROVIDER" in content, (
            "voice/router.py must import VOICE_CALL_PROVIDER (hard-pin)"
        )
        assert "ALLOWED_VOICE_CALL_MODELS" in content, (
            "voice/router.py must import ALLOWED_VOICE_CALL_MODELS (hard-pin)"
        )
