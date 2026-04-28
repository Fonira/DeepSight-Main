"""Tests for create_note + delete_note write tools."""

import pytest
from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.tools.write import (
    create_note,
    delete_note,
    WriteForbiddenError,
    NoteAlreadyExistsError,
    NoteNotFoundForDeleteError,
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


def test_delete_note_inbox_ok(settings: Settings, fake_vault: Path):
    create_note(settings, "00-Inbox/to-delete.md", "# Bye\n")
    target = fake_vault / "00-Inbox" / "to-delete.md"
    assert target.exists()
    delete_note(settings, "00-Inbox/to-delete.md")
    assert not target.exists()


def test_delete_note_archive_ok(settings: Settings, fake_vault: Path):
    create_note(settings, "03-Archive/old.md", "# Old\n")
    delete_note(settings, "03-Archive/old.md")
    assert not (fake_vault / "03-Archive" / "old.md").exists()


def test_delete_note_session_ok(settings: Settings, fake_vault: Path):
    create_note(
        settings,
        "01-Projects/DeepSight/Sessions/2026-04-28-bye.md",
        "# Session\n",
    )
    delete_note(settings, "01-Projects/DeepSight/Sessions/2026-04-28-bye.md")
    assert not (
        fake_vault / "01-Projects" / "DeepSight" / "Sessions" / "2026-04-28-bye.md"
    ).exists()


def test_delete_note_specs_forbidden(settings: Settings, fake_vault: Path):
    spec = fake_vault / "01-Projects" / "DeepSight" / "Specs" / "spec.md"
    spec.parent.mkdir(parents=True, exist_ok=True)
    spec.write_text("# Spec\n")
    with pytest.raises(WriteForbiddenError):
        delete_note(settings, "01-Projects/DeepSight/Specs/spec.md")
    assert spec.exists()


def test_delete_note_decisions_forbidden(settings: Settings, fake_vault: Path):
    adr = fake_vault / "01-Projects" / "DeepSight" / "Decisions" / "ADR-001.md"
    adr.parent.mkdir(parents=True, exist_ok=True)
    adr.write_text("# ADR\n")
    with pytest.raises(WriteForbiddenError):
        delete_note(settings, "01-Projects/DeepSight/Decisions/ADR-001.md")
    assert adr.exists()


def test_delete_note_meta_forbidden(settings: Settings, fake_vault: Path):
    meta = fake_vault / "02-Meta" / "Claude" / "global.md"
    meta.parent.mkdir(parents=True, exist_ok=True)
    meta.write_text("# Global\n")
    with pytest.raises(WriteForbiddenError):
        delete_note(settings, "02-Meta/Claude/global.md")
    assert meta.exists()


def test_delete_note_root_forbidden(settings: Settings, fake_vault: Path):
    f = fake_vault / "root-file.md"
    f.write_text("x")
    with pytest.raises(WriteForbiddenError):
        delete_note(settings, "root-file.md")
    assert f.exists()


def test_delete_note_must_end_md(settings: Settings, fake_vault: Path):
    with pytest.raises(WriteForbiddenError):
        delete_note(settings, "00-Inbox/note.txt")


def test_delete_note_missing_file(settings: Settings, fake_vault: Path):
    with pytest.raises(NoteNotFoundForDeleteError):
        delete_note(settings, "00-Inbox/never-existed.md")


def test_delete_note_path_traversal_blocked(settings: Settings, fake_vault: Path):
    with pytest.raises((PathTraversalError, WriteForbiddenError)):
        delete_note(settings, "00-Inbox/../etc/passwd.md")


def test_delete_note_audit_log_appended(settings: Settings, fake_vault: Path):
    create_note(settings, "00-Inbox/audit-del.md", "content")
    delete_note(settings, "00-Inbox/audit-del.md")
    log = fake_vault / "02-Meta" / "audit" / "mcp-writes.log"
    text = log.read_text(encoding="utf-8")
    assert "delete_note" in text
    assert "00-Inbox/audit-del.md" in text


def test_delete_note_directory_rejected(settings: Settings, fake_vault: Path):
    d = fake_vault / "00-Inbox" / "fake-dir.md"
    d.mkdir(parents=True, exist_ok=True)
    with pytest.raises(WriteForbiddenError):
        delete_note(settings, "00-Inbox/fake-dir.md")
    assert d.exists()
