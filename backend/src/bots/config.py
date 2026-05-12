"""Configuration des bots prospection — lue depuis l'environnement.

Pattern aligné sur `core/config.py` (pydantic_settings.BaseSettings).
"""

from __future__ import annotations

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class BotSettings(BaseSettings):
    """Settings dédiés aux bots de prospection B2B."""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # ── Kill switches ──
    BOTS_ENABLED: bool = False
    TELEGRAM_ENABLED: bool = False
    LUFFA_ENABLED: bool = False

    # ── Telegram bot prospection ──
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = "testagentiagudbot"
    TELEGRAM_WEBHOOK_SECRET: str = ""

    # ── Luffa ──
    LUFFA_ROBOT_SECRET: str = ""
    LUFFA_POLL_INTERVAL: float = 1.0
    LUFFA_CONCURRENCY: int = 5

    # ── Handoff via @Bobbykimifonibot ──
    HANDOFF_TELEGRAM_BOT_TOKEN: str = ""
    HANDOFF_TELEGRAM_CHAT_ID: str = ""

    # ── LLM ──
    BOTS_MISTRAL_MODEL: str = "mistral-large-2512"
    BOTS_MAX_HISTORY_MESSAGES: int = 20
    BOTS_LLM_TIMEOUT_SECONDS: float = 30.0
    BOTS_LLM_MAX_TOKENS: int = 800

    # ── Démo URLs (placeholders — remplacer avant prod) ──
    DEMO_YOUTUBE_SLUG: str = "EXEMPLE_YOUTUBE_SLUG"
    DEMO_TIKTOK_SLUG: str = "EXEMPLE_TIKTOK_SLUG"
    PUBLIC_BASE_URL: str = "https://www.deepsightsynthesis.com"

    # ── Anti-spam ──
    PROSPECT_RATE_LIMIT_PER_HOUR: int = 30
    PROSPECT_RATE_WARNING_COOLDOWN_HOURS: int = 6

    # ── Handoff threshold ──
    WARM_LEAD_SCORE_THRESHOLD: int = 60

    @property
    def telegram_active(self) -> bool:
        return self.BOTS_ENABLED and self.TELEGRAM_ENABLED and bool(self.TELEGRAM_BOT_TOKEN)

    @property
    def luffa_active(self) -> bool:
        return self.BOTS_ENABLED and self.LUFFA_ENABLED and bool(self.LUFFA_ROBOT_SECRET)

    @property
    def handoff_active(self) -> bool:
        return bool(self.HANDOFF_TELEGRAM_BOT_TOKEN and self.HANDOFF_TELEGRAM_CHAT_ID)

    def demo_youtube_url(self) -> str:
        return f"{self.PUBLIC_BASE_URL.rstrip('/')}/a/{self.DEMO_YOUTUBE_SLUG}"

    def demo_tiktok_url(self) -> str:
        return f"{self.PUBLIC_BASE_URL.rstrip('/')}/a/{self.DEMO_TIKTOK_SLUG}"


bot_settings = BotSettings()
