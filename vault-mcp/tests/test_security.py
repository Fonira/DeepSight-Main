"""Tests for path traversal protection."""

import pytest
from pathlib import Path

from vault_mcp.security import resolve_safe_path, PathTraversalError


def test_simple_relative_path_ok(fake_vault: Path):
    result = resolve_safe_path(fake_vault, "00-Inbox/test-note.md")
    assert result == (fake_vault / "00-Inbox" / "test-note.md").resolve()


def test_nested_relative_path_ok(fake_vault: Path):
    result = resolve_safe_path(fake_vault, "01-Projects/DeepSight/_index.md")
    assert result.exists()


def test_path_traversal_blocked(fake_vault: Path):
    with pytest.raises(PathTraversalError):
        resolve_safe_path(fake_vault, "../etc/passwd")


def test_absolute_path_blocked(fake_vault: Path):
    with pytest.raises(PathTraversalError):
        resolve_safe_path(fake_vault, "/etc/passwd")


def test_backslash_blocked(fake_vault: Path):
    with pytest.raises(PathTraversalError):
        resolve_safe_path(fake_vault, "00-Inbox\\note.md")


def test_git_dir_blocked(fake_vault: Path):
    with pytest.raises(PathTraversalError):
        resolve_safe_path(fake_vault, ".git/secret")


def test_obsidian_dir_blocked(fake_vault: Path):
    with pytest.raises(PathTraversalError):
        resolve_safe_path(fake_vault, ".obsidian/workspace.json")


def test_double_dot_in_middle_blocked(fake_vault: Path):
    with pytest.raises(PathTraversalError):
        resolve_safe_path(fake_vault, "01-Projects/../../etc/passwd")
