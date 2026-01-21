"""
🎙️ TTS Module — Text-to-Speech Service
"""

from tts.service import generate_speech, clean_text_for_tts, estimate_duration, estimate_cost
from tts.router import router as tts_router

__all__ = [
    "generate_speech",
    "clean_text_for_tts", 
    "estimate_duration",
    "estimate_cost",
    "tts_router"
]
