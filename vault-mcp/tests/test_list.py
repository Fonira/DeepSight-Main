"""Tests for list tools."""

import pytest
from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.tools.list import list_projects, list_memory


@pytest.fixture
def settings(fake_vault: Path) -> Settings:
    return Settings(vault_path=fake_vault, mcp_token="test-token")


def test_list_projects_basic(settings: Settings):
    projects = list_projects(settings)
    names = {p["name"] for p in projects}
    assert "DeepSight" in names
    assert "Grassmotion" in names


def test_list_projects_counts(settings: Settings):
    projects = list_projects(settings)
    deepsight = next(p for p in projects if p["name"] == "DeepSight")
    assert deepsight["has_index"] is True
    assert deepsight["specs_count"] == 1
    assert deepsight["decisions_count"] == 0


def test_list_projects_no_index(settings: Settings, fake_vault: Path):
    (fake_vault / "01-Projects" / "Grassmotion" / "_index.md").unlink(missing_ok=True)
    projects = list_projects(settings)
    grass = next(p for p in projects if p["name"] == "Grassmotion")
    assert grass["has_index"] is False


def test_list_memory(settings: Settings):
    mems = list_memory(settings)
    names = {m["name"] for m in mems}
    assert "feedback_test.md" in names


def test_list_memory_skips_readme(settings: Settings, fake_vault: Path):
    (fake_vault / "02-Meta" / "Claude" / "Memory" / "_README.md").write_text("# README")
    (fake_vault / "02-Meta" / "Claude" / "Memory" / "MEMORY.md").write_text("# Index")
    mems = list_memory(settings)
    names = {m["name"] for m in mems}
    assert "_README.md" not in names
    assert "MEMORY.md" not in names


def test_list_memory_extracts_description(settings: Settings):
    mems = list_memory(settings)
    test_mem = next(m for m in mems if m["name"] == "feedback_test.md")
    assert test_mem["description"] == "just a test"
