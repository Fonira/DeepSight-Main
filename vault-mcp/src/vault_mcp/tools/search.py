"""Search across vault markdown files."""

from pathlib import Path
from typing import TypedDict

from vault_mcp.config import Settings
from vault_mcp.security import FORBIDDEN_DIRS


class SearchResult(TypedDict):
    path: str
    title: str
    snippet: str


def _extract_title(content: str, fallback: str) -> str:
    """Extract title from frontmatter or first heading, fallback to filename."""
    lines = content.splitlines()
    in_fm = False
    for line in lines[:30]:
        stripped = line.strip()
        if stripped == "---":
            in_fm = not in_fm
            continue
        if in_fm and stripped.startswith("title:"):
            return stripped.split(":", 1)[1].strip().strip('"').strip("'")
        if not in_fm and stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def _make_snippet(content: str, query_lower: str, ctx: int = 80) -> str:
    """Return up to `ctx` chars before and after the first match, single line."""
    idx = content.lower().find(query_lower)
    if idx == -1:
        return ""
    start = max(0, idx - ctx)
    end = min(len(content), idx + len(query_lower) + ctx)
    snippet = content[start:end].replace("\n", " ").strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(content):
        snippet = snippet + "…"
    return snippet


def search_vault(settings: Settings, query: str, limit: int = 10) -> list[SearchResult]:
    """Case-insensitive substring search across all .md files in the vault."""
    if not query.strip():
        return []
    limit = max(1, min(limit, settings.max_search_results))
    query_lower = query.lower()

    results: list[SearchResult] = []
    vault = settings.vault_path.resolve()

    for md_path in vault.rglob("*.md"):
        rel_parts = md_path.relative_to(vault).parts
        if any(part in FORBIDDEN_DIRS for part in rel_parts):
            continue
        try:
            content = md_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if query_lower not in content.lower():
            continue
        rel_path = md_path.relative_to(vault).as_posix()
        title = _extract_title(content, fallback=md_path.stem)
        snippet = _make_snippet(content, query_lower)
        results.append(SearchResult(path=rel_path, title=title, snippet=snippet))
        if len(results) >= limit:
            break

    return results
