"""Configuration loaded from environment variables."""

import os
from pathlib import Path
from pydantic import BaseModel, Field


class Settings(BaseModel):
    vault_path: Path = Field(
        default_factory=lambda: Path(os.environ.get("VAULT_PATH", "/opt/vault")),
        description="Absolute path to the Obsidian vault root on disk.",
    )
    mcp_token: str = Field(
        default_factory=lambda: os.environ.get("VAULT_MCP_TOKEN", "missing-token"),
        description="Bearer token clients must send in Authorization header.",
    )
    rate_limit_per_minute: int = Field(default=60)
    max_search_results: int = Field(default=50)
    max_note_size_bytes: int = Field(default=1_000_000)


def load_settings() -> Settings:
    return Settings()
