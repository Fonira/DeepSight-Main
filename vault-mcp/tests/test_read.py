"""Tests for read tools."""

import pytest
from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.tools.read import (
    read_note_content,
    get_global_context_content,
    get_memory_content,
    NoteNotFoundError,
)


@pytest.fixture
def settings(fake_vault: Path) -> Settings:
    return Settings(vault_path=fake_vault, mcp_token="test-token")


def test_read_note_basic(settings: Settings):
    content = read_note_content(settings, "00-Inbox/test-note.md")
    assert "# Test" in content
    assert "Mistral" in content


def test_read_note_missing(settings: Settings):
    with pytest.raises(NoteNotFoundError):
        read_note_content(settings, "00-Inbox/does-not-exist.md")


def test_read_note_not_md(settings: Settings, fake_vault: Path):
    (fake_vault / "00-Inbox" / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    with pytest.raises(NoteNotFoundError):
        read_note_content(settings, "00-Inbox/image.png")


def test_get_global_context(settings: Settings):
    content = get_global_context_content(settings)
    assert "Maxime is the founder" in content


def test_get_memory_full_name(settings: Settings):
    content = get_memory_content(settings, "feedback_test.md")
    assert "Test feedback" in content


def test_get_memory_prefix(settings: Settings):
    content = get_memory_content(settings, "feedback_test")
    assert "Test feedback" in content


def test_get_memory_unknown(settings: Settings):
    with pytest.raises(NoteNotFoundError):
        get_memory_content(settings, "feedback_zzzz")
