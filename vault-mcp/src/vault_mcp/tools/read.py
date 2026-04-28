"""Read tools for the vault."""

from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.security import resolve_safe_path


class NoteNotFoundError(FileNotFoundError):
    pass


class NoteTooLargeError(ValueError):
    pass


def read_note_content(settings: Settings, vault_relative_path: str) -> str:
    """Read a note from the vault, with safety checks."""
    safe_path = resolve_safe_path(settings.vault_path, vault_relative_path)

    if not safe_path.exists():
        raise NoteNotFoundError(f"Note not found: {vault_relative_path}")
    if not safe_path.is_file():
        raise NoteNotFoundError(f"Not a file: {vault_relative_path}")
    if safe_path.suffix.lower() != ".md":
        raise NoteNotFoundError(f"Not a markdown file: {vault_relative_path}")

    size = safe_path.stat().st_size
    if size > settings.max_note_size_bytes:
        raise NoteTooLargeError(
            f"Note too large ({size} bytes): {vault_relative_path}"
        )

    return safe_path.read_text(encoding="utf-8")


def get_global_context_content(settings: Settings) -> str:
    """Return the content of 02-Meta/Claude/global.md."""
    return read_note_content(settings, "02-Meta/Claude/global.md")


def get_memory_content(settings: Settings, name: str) -> str:
    """
    Return the content of a memory file.

    name: filename like "feedback_opus-4-7-preference.md" or short prefix like "feedback_opus".
    """
    if not name.endswith(".md"):
        memory_dir = settings.vault_path / "02-Meta" / "Claude" / "Memory"
        candidates = sorted(p for p in memory_dir.glob(f"{name}*.md") if p.is_file())
        if not candidates:
            raise NoteNotFoundError(f"No memory file matching prefix: {name!r}")
        if len(candidates) > 1:
            names = [p.name for p in candidates]
            raise NoteNotFoundError(
                f"Ambiguous prefix {name!r}, matches: {names}"
            )
        return candidates[0].read_text(encoding="utf-8")

    return read_note_content(settings, f"02-Meta/Claude/Memory/{name}")
