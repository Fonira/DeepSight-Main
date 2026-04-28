"""Tests for create_note write tool."""

import pytest
from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.tools.write import (
    create_note,
    WriteForbiddenError,
    NoteAlreadyExistsError,
)
from vault_mcp.security import PathTraversalError


@pytest.fixture
def settings(fake_vault: Path) -> Settings:
    return Settings(vault_path=fake_vault, mcp_token="test-token")


def test_create_note_inbox_ok(settings: Settings, fake_vault: Path):
    path = create_note(settings, "00-Inbox/new-idea.md", "# New idea\n\nBody.")
    assert path.exists()
    assert path.read_text(encoding="utf-8") == "# New idea\n\nBody."


def test_create_note_archive_ok(settings: Settings, fake_vault: Path):
    path = create_note(
        settings, "03-Archive/old-thoughts.md", "# Archived\n"
    )
    assert path.exists()


def test_create_note_session_ok(settings: Settings, fake_vault: Path):
    path = create_note(
        settings,
        "01-Projects/DeepSight/Sessions/2026-04-28-test.md",
        "# Session\n",
    )
    assert path.exists()


def test_create_note_idea_ok(settings: Settings, fake_vault: Path):
    (fake_vault / "01-Projects" / "DeepSight" / "Ideas").mkdir(parents=True, exist_ok=True)
    path = create_note(
        settings,
        "01-Projects/DeepSight/Ideas/feature-x.md",
        "# Feature X\n",
    )
    assert path.exists()


def test_create_note_bug_ok(settings: Settings, fake_vault: Path):
    (fake_vault / "01-Projects" / "DeepSight" / "Bugs").mkdir(parents=True, exist_ok=True)
    path = create_note(
        settings,
        "01-Projects/DeepSight/Bugs/2026-04-28-something.md",
        "# Bug\n",
    )
    assert path.exists()


def test_create_note_specs_forbidden(settings: Settings, fake_vault: Path):
    with pytest.raises(WriteForbiddenError):
        create_note(
            settings,
            "01-Projects/DeepSight/Specs/spec-z.md",
            "# Spec\n",
        )


def test_create_note_decisions_forbidden(settings: Settings, fake_vault: Path):
    with pytest.raises(WriteForbiddenError):
        create_note(
            settings,
            "01-Projects/DeepSight/Decisions/ADR-001-z.md",
            "# ADR\n",
        )


def test_create_note_meta_forbidden(settings: Settings, fake_vault: Path):
    with pytest.raises(WriteForbiddenError):
        create_note(settings, "02-Meta/Claude/test.md", "# Test\n")


def test_create_note_root_forbidden(settings: Settings, fake_vault: Path):
    with pytest.raises(WriteForbiddenError):
        create_note(settings, "test-at-root.md", "# Test\n")


def test_create_note_must_end_md(settings: Settings, fake_vault: Path):
    with pytest.raises(WriteForbiddenError):
        create_note(settings, "00-Inbox/note.txt", "Test")


def test_create_note_no_overwrite(settings: Settings, fake_vault: Path):
    create_note(settings, "00-Inbox/once.md", "First\n")
    with pytest.raises(NoteAlreadyExistsError):
        create_note(settings, "00-Inbox/once.md", "Second\n")


def test_create_note_path_traversal_blocked(settings: Settings, fake_vault: Path):
    with pytest.raises((PathTraversalError, WriteForbiddenError)):
        create_note(settings, "00-Inbox/../etc/passwd.md", "evil")


def test_create_note_content_too_large(settings: Settings, fake_vault: Path):
    settings.max_note_size_bytes = 100
    with pytest.raises(ValueError):
        create_note(settings, "00-Inbox/big.md", "a" * 200)


def test_create_note_audit_log_appended(settings: Settings, fake_vault: Path):
    create_note(settings, "00-Inbox/audit-test.md", "content")
    log = fake_vault / "02-Meta" / "audit" / "mcp-writes.log"
    assert log.exists()
    line = log.read_text(encoding="utf-8")
    assert "create_note" in line
    assert "00-Inbox/audit-test.md" in line


def test_create_note_creates_parent_dir(settings: Settings, fake_vault: Path):
    path = create_note(
        settings,
        "01-Projects/Grassmotion/Ideas/new.md",
        "# Idea\n",
    )
    assert path.exists()
