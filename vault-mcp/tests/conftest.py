"""Shared pytest fixtures."""

import pytest
from pathlib import Path


@pytest.fixture
def fake_vault(tmp_path: Path) -> Path:
    """Create a tiny fake vault for tests."""
    vault = tmp_path / "Vault"
    (vault / "00-Inbox").mkdir(parents=True)
    (vault / "01-Projects" / "DeepSight" / "Specs").mkdir(parents=True)
    (vault / "01-Projects" / "Grassmotion").mkdir(parents=True)
    (vault / "02-Meta" / "Claude" / "Memory").mkdir(parents=True)
    (vault / ".git").mkdir()
    (vault / ".obsidian").mkdir()

    (vault / "00-Inbox" / "test-note.md").write_text(
        "---\ntitle: Test\ntype: inbox\n---\n\n# Test\n\nContent with Mistral keyword.\n"
    )
    (vault / "01-Projects" / "DeepSight" / "_index.md").write_text(
        "---\ntitle: DeepSight\ntype: project-index\n---\n\n# DeepSight\n\nUses Mistral AI.\n"
    )
    (vault / "01-Projects" / "DeepSight" / "Specs" / "spec-a.md").write_text(
        "# Spec A\n\nSome content.\n"
    )
    (vault / "02-Meta" / "Claude" / "global.md").write_text(
        "# Global\n\nMaxime is the founder of DeepSight.\n"
    )
    (vault / "02-Meta" / "Claude" / "Memory" / "feedback_test.md").write_text(
        "---\ntitle: Test feedback\nname: feedback_test\ndescription: just a test\n---\n\n# Test\n"
    )
    (vault / ".git" / "secret").write_text("should never be returned")

    return vault
