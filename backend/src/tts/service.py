"""
TTS SERVICE — ElevenLabs Text-to-Speech utilities
v3.0 — FR voices, text cleanup, speed control
"""

import re
import time
import logging
from core.config import get_elevenlabs_key

logger = logging.getLogger(__name__)


def is_tts_available() -> bool:
    """Check if TTS is available."""
    return bool(get_elevenlabs_key())


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ VOICE CONFIG — FR métropolitain natif + EN
# ═══════════════════════════════════════════════════════════════════════════════

VOICES = {
    "fr": {
        "male": "TX3LPaxmHKxFdv7VOQHJ",      # Liam — multilingual, bon accent FR
        "female": "pFZP5JQG7iQjIQuC4Bku",     # Lily — multilingual, bon accent FR
    },
    "en": {
        "male": "TX3LPaxmHKxFdv7VOQHJ",      # Liam — multilingual
        "female": "pFZP5JQG7iQjIQuC4Bku",     # Lily — multilingual
    }
}

DEFAULT_MODEL_ID = "eleven_multilingual_v2"

# Set of all known voice IDs (for validation) — includes catalog voices
def _build_known_voice_ids() -> set[str]:
    """Build the set of all valid voice IDs (base + catalog)."""
    base = {vid for lang_voices in VOICES.values() for vid in lang_voices.values()}
    try:
        from voice.preferences import CATALOG_VOICE_IDS
        return base | CATALOG_VOICE_IDS
    except ImportError:
        return base

KNOWN_VOICE_IDS = _build_known_voice_ids()


def get_voice_id(language: str = "fr", gender: str = "female") -> str:
    """Get voice ID for given language and gender."""
    lang_voices = VOICES.get(language, VOICES["fr"])
    return lang_voices.get(gender, lang_voices["female"])


# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 TEXT CLEANUP — Remove questions, emojis, markdown before TTS
# ═══════════════════════════════════════════════════════════════════════════════

# Patterns that signal "end of useful content" — everything after is stripped
_STRIP_PATTERNS = re.compile(
    r"(pour aller plus loin|questions? pour approfondir|voici (des|quelques) questions?"
    r"|you might also|further questions?|here are some questions?"
    r"|want to explore|points? à explorer|pistes? de réflexion"
    r"|to go further|reflection questions|🔮)",
    re.IGNORECASE,
)

# Emoji range
_EMOJI_RE = re.compile(
    r"[\U00010000-\U0010ffff]"       # Supplementary planes (most emojis)
    r"|[\u2600-\u27bf]"              # Misc symbols
    r"|[\ufe00-\ufe0f]"             # Variation selectors
    r"|[\u200d]"                     # ZWJ
    r"|[\u20e3]",                    # Combining enclosing keycap
)

# Markdown patterns
_MARKDOWN_RE = re.compile(
    r"\*\*(.+?)\*\*"        # **bold**
    r"|__(.+?)__"           # __bold__
    r"|\*(.+?)\*"           # *italic*
    r"|_(.+?)_"             # _italic_
    r"|`{1,3}[^`]*`{1,3}"  # `code` or ```code```
    r"|#{1,6}\s+"           # ## headers
    r"|\[ask:([^\]]+)\]"    # [ask:question] interactive
    r"|\[\[([^\]]+)\]\]"    # [[concept]] interactive
)


def clean_text_for_tts(text: str, strip_questions: bool = True) -> str:
    """
    Clean text for TTS readability:
    - Strip trailing question/exploration sections
    - Remove emojis
    - Remove markdown formatting (keep text content)
    - Replace double newlines with pause
    - Truncate to 5000 chars
    """
    if not text:
        return ""

    cleaned = text

    # 1) Strip everything after "pour aller plus loin" patterns
    if strip_questions:
        match = _STRIP_PATTERNS.search(cleaned)
        if match:
            cleaned = cleaned[:match.start()].rstrip()

    # 2) Remove [ask:...] and [[...]] interactive tags (keep inner text for concepts)
    cleaned = re.sub(r"\[ask:[^\]]+\]", "", cleaned)
    cleaned = re.sub(r"\[\[([^\]]+)\]\]", r"\1", cleaned)

    # 3) Remove markdown formatting (keep inner text for bold/italic)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.+?)__", r"\1", cleaned)
    cleaned = re.sub(r"\*(.+?)\*", r"\1", cleaned)
    cleaned = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"\1", cleaned)
    cleaned = re.sub(r"`{1,3}[^`]*`{1,3}", "", cleaned)
    cleaned = re.sub(r"#{1,6}\s+", "", cleaned)
    cleaned = re.sub(r"---+", "", cleaned)

    # 4) Remove emojis
    cleaned = _EMOJI_RE.sub("", cleaned)

    # 5) Replace double newlines with sentence pause
    cleaned = re.sub(r"\n{2,}", ". ", cleaned)
    cleaned = re.sub(r"\n", " ", cleaned)

    # 6) Clean up whitespace
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\.\s*\.", ".", cleaned)  # Remove double dots
    cleaned = cleaned.strip()

    # 7) Truncate to 5000 chars
    if len(cleaned) > 5000:
        # Try to cut at a sentence boundary
        cut_point = cleaned.rfind(". ", 4500, 5000)
        if cut_point > 4500:
            cleaned = cleaned[:cut_point + 1]
        else:
            cleaned = cleaned[:5000]

    return cleaned


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 CIRCUIT BREAKER — Protection contre ElevenLabs down
# ═══════════════════════════════════════════════════════════════════════════════

class CircuitBreaker:
    """
    Simple circuit breaker for ElevenLabs API.

    - CLOSED: requests pass through normally
    - OPEN: after failure_threshold errors in failure_window → immediate error for recovery_timeout
    - HALF-OPEN: after recovery_timeout → allow 1 test request
    """

    def __init__(self, failure_threshold: int = 3, recovery_timeout: int = 60, failure_window: int = 300):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_window = failure_window
        self._state = "closed"
        self._failures: list[float] = []
        self._opened_at = 0.0

    @property
    def state(self) -> str:
        if self._state == "open":
            if time.time() - self._opened_at >= self.recovery_timeout:
                self._state = "half-open"
        return self._state

    def record_success(self):
        if self._state in ("half-open", "open"):
            logger.info("ElevenLabs circuit breaker CLOSED — service recovered")
        self._failures.clear()
        self._state = "closed"

    def record_failure(self):
        now = time.time()
        self._failures = [t for t in self._failures if now - t < self.failure_window]
        self._failures.append(now)

        if len(self._failures) >= self.failure_threshold:
            self._state = "open"
            self._opened_at = now
            logger.warning(
                "ElevenLabs circuit breaker OPEN — %d failures in %ds, blocking for %ds",
                len(self._failures), self.failure_window, self.recovery_timeout,
            )

    def can_execute(self) -> bool:
        state = self.state
        return state in ("closed", "half-open")


# Singleton circuit breaker for ElevenLabs
elevenlabs_circuit = CircuitBreaker(failure_threshold=3, recovery_timeout=60, failure_window=300)
