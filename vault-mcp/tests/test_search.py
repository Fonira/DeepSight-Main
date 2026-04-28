"""Tests for search tool."""

import pytest
from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.tools.search import search_vault


@pytest.fixture
def settings(fake_vault: Path) -> Settings:
    return Settings(vault_path=fake_vault, mcp_token="test-token")


def test_search_basic(settings: Settings):
    results = search_vault(settings, "Mistral")
    assert len(results) >= 2
    paths = {r["path"] for r in results}
    assert "00-Inbox/test-note.md" in paths
    assert "01-Projects/DeepSight/_index.md" in paths


def test_search_case_insensitive(settings: Settings):
    upper = search_vault(settings, "MISTRAL")
    lower = search_vault(settings, "mistral")
    assert {r["path"] for r in upper} == {r["path"] for r in lower}


def test_search_empty_query(settings: Settings):
    assert search_vault(settings, "") == []
    assert search_vault(settings, "   ") == []


def test_search_no_match(settings: Settings):
    assert search_vault(settings, "zzzznopematch") == []


def test_search_excludes_git(settings: Settings, fake_vault: Path):
    results = search_vault(settings, "should never be returned")
    assert results == []


def test_search_limit(settings: Settings, fake_vault: Path):
    for i in range(15):
        (fake_vault / "00-Inbox" / f"foo-{i}.md").write_text(
            f"# foo {i}\nfoobar content {i}\n"
        )
    results = search_vault(settings, "foobar", limit=5)
    assert len(results) == 5


def test_search_extracts_title_from_frontmatter(settings: Settings):
    results = search_vault(settings, "Mistral")
    titles = {r["title"] for r in results}
    assert "Test" in titles or "DeepSight" in titles


def test_search_snippet_contains_match(settings: Settings):
    results = search_vault(settings, "Mistral")
    for r in results:
        assert "Mistral" in r["snippet"] or "mistral" in r["snippet"].lower()
