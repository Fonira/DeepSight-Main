"""
TTS SERVICE — ElevenLabs Text-to-Speech utilities
v3.0 — FR voices, text cleanup, speed control
"""

import re
from core.config import get_elevenlabs_key


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
