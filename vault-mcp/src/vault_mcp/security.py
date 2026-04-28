"""Security helpers — path traversal protection, sensitive path filtering."""

from pathlib import Path

FORBIDDEN_DIRS = {".git", ".obsidian", ".trash", "__pycache__"}


class PathTraversalError(ValueError):
    """Raised when a requested path escapes the vault root."""


def resolve_safe_path(vault_root: Path, relative_path: str) -> Path:
    """
    Resolve a vault-relative path to an absolute path, ensuring it stays inside vault_root
    and does not point inside any forbidden directory.

    Raises PathTraversalError on any violation.
    """
    if relative_path.startswith("/") or "\\" in relative_path:
        raise PathTraversalError(
            f"Path must be relative with forward slashes: {relative_path!r}"
        )

    candidate = (vault_root / relative_path).resolve()
    vault_resolved = vault_root.resolve()

    try:
        candidate.relative_to(vault_resolved)
    except ValueError as e:
        raise PathTraversalError(f"Path escapes vault: {relative_path!r}") from e

    parts = candidate.relative_to(vault_resolved).parts
    if any(part in FORBIDDEN_DIRS for part in parts):
        raise PathTraversalError(
            f"Path inside forbidden directory: {relative_path!r}"
        )

    return candidate
