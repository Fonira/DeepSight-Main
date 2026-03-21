"""
TTS SERVICE — ElevenLabs Text-to-Speech utilities
v2.0 — Simplified, streaming-first approach
"""

from core.config import get_elevenlabs_key


def is_tts_available() -> bool:
    """Check if TTS is available."""
    return bool(get_elevenlabs_key())
