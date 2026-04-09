"""
Voice Preferences Service — User-configurable ElevenLabs parameters
v1.0 — voice_id, speed, stability, similarity, style, speaker_boost, model

Stores preferences as JSON in User.voice_preferences column.
All TTS/Voice endpoints read from this to apply user-selected settings.
"""

import json
import logging
from typing import Optional
from dataclasses import dataclass, field, asdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from db.database import User

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Voice Preferences Model
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VoicePreferences:
    """User voice preferences — maps to ElevenLabs TTS parameters."""

    # ── Voice selection ───────────────────────────────────────────────────
    voice_id: Optional[str] = None          # ElevenLabs voice ID (None = default)
    voice_name: Optional[str] = None        # Display name for UI

    # ── Speed (PROMINENTLY FEATURED) ──────────────────────────────────────
    # ElevenLabs supports 0.25 → 4.0
    speed: float = 1.0

    # ── Voice quality parameters ──────────────────────────────────────────
    stability: float = 0.5                  # 0.0 (variable) → 1.0 (stable)
    similarity_boost: float = 0.75          # 0.0 (diverse) → 1.0 (similar)
    style: float = 0.3                      # 0.0 (none) → 1.0 (exaggerated)
    use_speaker_boost: bool = True          # High-quality speaker boost

    # ── Model selection ───────────────────────────────────────────────────
    # eleven_multilingual_v2 (default, highest quality)
    # eleven_turbo_v2_5 (fastest, ~300ms latency)
    # eleven_flash_v2_5 (balanced)
    tts_model: str = "eleven_multilingual_v2"
    voice_chat_model: str = "eleven_flash_v2_5"

    # ── Language / Gender defaults ────────────────────────────────────────
    language: str = "fr"
    gender: str = "female"

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)

    @classmethod
    def from_json(cls, raw: Optional[str]) -> "VoicePreferences":
        if not raw:
            return cls()
        try:
            data = json.loads(raw)
            # Filter only known fields
            known = {f.name for f in cls.__dataclass_fields__.values()}
            filtered = {k: v for k, v in data.items() if k in known}
            return cls(**filtered)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("Invalid voice_preferences JSON: %s", e)
            return cls()

    def to_voice_settings(self) -> dict:
        """Return ElevenLabs voice_settings dict for TTS API calls."""
        return {
            "stability": self.stability,
            "similarity_boost": self.similarity_boost,
            "style": self.style,
            "use_speaker_boost": self.use_speaker_boost,
            "speed": self.speed,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Speed Presets — Prominently featured in UI
# ═══════════════════════════════════════════════════════════════════════════════

SPEED_PRESETS = [
    {"id": "very_slow", "label_fr": "Très lent", "label_en": "Very Slow", "value": 0.5, "icon": "🐢"},
    {"id": "slow", "label_fr": "Lent", "label_en": "Slow", "value": 0.75, "icon": "🚶"},
    {"id": "normal", "label_fr": "Normal", "label_en": "Normal", "value": 1.0, "icon": "▶️"},
    {"id": "fast", "label_fr": "Rapide", "label_en": "Fast", "value": 1.25, "icon": "🏃"},
    {"id": "very_fast", "label_fr": "Très rapide", "label_en": "Very Fast", "value": 1.5, "icon": "⚡"},
    {"id": "turbo", "label_fr": "Turbo", "label_en": "Turbo", "value": 2.0, "icon": "🚀"},
    {"id": "ultra", "label_fr": "Ultra", "label_en": "Ultra", "value": 3.0, "icon": "💨"},
    {"id": "max", "label_fr": "Maximum", "label_en": "Maximum", "value": 4.0, "icon": "⚡⚡"},
]


# ═══════════════════════════════════════════════════════════════════════════════
# Voice Catalog — Curated voices for DeepSight
# ═══════════════════════════════════════════════════════════════════════════════

VOICE_CATALOG = [
    # ── French native ──
    {
        "voice_id": "5jCmrHdxbpU36l1wb3Ke",
        "name": "Sébas",
        "description_fr": "Narrateur français — ton décontracté et engageant",
        "description_en": "French storyteller — casual and engaging",
        "gender": "male",
        "accent": "french",
        "language": "fr",
        "use_case": "narrative",
        "recommended": True,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/database/workspace/c8653145f827440481dc7d6ec79b65aa/voices/5jCmrHdxbpU36l1wb3Ke/51f292e0-b817-49dc-822e-70a3c1de7219.mp3",
    },
    # ── Multilingual female voices ──
    {
        "voice_id": "pFZP5JQG7iQjIQuC4Bku",
        "name": "Lily",
        "description_fr": "Actrice — voix veloutée et confiante",
        "description_en": "Actress — velvety and confident voice",
        "gender": "female",
        "accent": "british",
        "language": "multilingual",
        "use_case": "educational",
        "recommended": True,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3",
    },
    {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "name": "Sarah",
        "description_fr": "Mature et rassurante — ton professionnel",
        "description_en": "Mature and reassuring — professional tone",
        "gender": "female",
        "accent": "american",
        "language": "multilingual",
        "use_case": "conversational",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3",
    },
    {
        "voice_id": "Xb7hH8MSUJpSbSDYk0k2",
        "name": "Alice",
        "description_fr": "Éducatrice — claire et engageante",
        "description_en": "Educator — clear and engaging",
        "gender": "female",
        "accent": "british",
        "language": "multilingual",
        "use_case": "educational",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3",
    },
    {
        "voice_id": "cgSgspJ2msm6clMCkdW9",
        "name": "Jessica",
        "description_fr": "Lumineuse et chaleureuse — ton convivial",
        "description_en": "Bright and warm — friendly tone",
        "gender": "female",
        "accent": "american",
        "language": "multilingual",
        "use_case": "conversational",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3",
    },
    # ── Multilingual male voices ──
    {
        "voice_id": "TX3LPaxmHKxFdv7VOQHJ",
        "name": "Liam",
        "description_fr": "Créateur dynamique — ton confiant et énergique",
        "description_en": "Dynamic creator — confident and energetic tone",
        "gender": "male",
        "accent": "american",
        "language": "multilingual",
        "use_case": "social_media",
        "recommended": True,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3",
    },
    {
        "voice_id": "JBFqnCBsd6RMkjVDRZzb",
        "name": "George",
        "description_fr": "Conteur chaleureux — voix mature et captivante",
        "description_en": "Warm storyteller — mature and captivating voice",
        "gender": "male",
        "accent": "british",
        "language": "multilingual",
        "use_case": "narrative",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3",
    },
    {
        "voice_id": "onwK4e9ZLuTAKqWW03F9",
        "name": "Daniel",
        "description_fr": "Présentateur — ton posé et formel",
        "description_en": "Broadcaster — steady and formal tone",
        "gender": "male",
        "accent": "british",
        "language": "multilingual",
        "use_case": "educational",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3",
    },
    {
        "voice_id": "cjVigY5qzO86Huf0OWal",
        "name": "Eric",
        "description_fr": "Doux et fiable — ton classe",
        "description_en": "Smooth and trustworthy — classy tone",
        "gender": "male",
        "accent": "american",
        "language": "multilingual",
        "use_case": "conversational",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3",
    },
    # ── Neutral / Non-binary ──
    {
        "voice_id": "SAz9YHcvj6GT2YYXdXww",
        "name": "River",
        "description_fr": "Neutre et calme — ton informatif et relaxant",
        "description_en": "Neutral and calm — informative and relaxing",
        "gender": "neutral",
        "accent": "american",
        "language": "multilingual",
        "use_case": "conversational",
        "recommended": False,
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3",
    },
]

# Set of valid voice IDs from catalog
CATALOG_VOICE_IDS = {v["voice_id"] for v in VOICE_CATALOG}


# ═══════════════════════════════════════════════════════════════════════════════
# Database Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_voice_preferences(user_id: int, db: AsyncSession) -> VoicePreferences:
    """Load user voice preferences from DB."""
    result = await db.execute(
        select(User.voice_preferences).where(User.id == user_id)
    )
    raw = result.scalar_one_or_none()
    return VoicePreferences.from_json(raw)


async def save_user_voice_preferences(
    user_id: int, prefs: VoicePreferences, db: AsyncSession
) -> None:
    """Save user voice preferences to DB."""
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(voice_preferences=prefs.to_json())
    )
    await db.commit()
    logger.info("Voice preferences saved", extra={"user_id": user_id})
