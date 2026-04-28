"""Write tools for the vault — create_note + delete_note (zone-restricted)."""

from datetime import datetime, timezone
from pathlib import Path

from vault_mcp.config import Settings
from vault_mcp.security import resolve_safe_path, PathTraversalError


# Allowed write zones (vault-relative path patterns)
ALLOWED_WRITE_FOLDERS = (
    "00-Inbox/",
    "03-Archive/",
)
ALLOWED_PROJECT_SUBFOLDERS = ("Sessions", "Ideas", "Bugs")


class WriteForbiddenError(ValueError):
    """Raised when a write target path is outside allowed zones."""


class NoteAlreadyExistsError(FileExistsError):
    """Raised when create_note targets an existing file (no overwrite)."""


class NoteNotFoundForDeleteError(FileNotFoundError):
    """Raised when delete_note targets a non-existent file."""


def _is_allowed_write_path(rel_path: str) -> bool:
    """Check if the path is in an allowed write zone."""
    if any(rel_path.startswith(prefix) for prefix in ALLOWED_WRITE_FOLDERS):
        return True
    parts = rel_path.split("/")
    if (
        len(parts) >= 4
        and parts[0] == "01-Projects"
        and parts[2] in ALLOWED_PROJECT_SUBFOLDERS
    ):
        return True
    return False


def _audit_log(settings: Settings, action: str, rel_path: str, size: int) -> None:
    """Append a single line to the MCP audit log."""
    audit_dir = settings.vault_path / "02-Meta" / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)
    log_file = audit_dir / "mcp-writes.log"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"{timestamp}\t{action}\t{rel_path}\t{size}\n"
    with log_file.open("a", encoding="utf-8") as f:
        f.write(line)


def create_note(settings: Settings, rel_path: str, content: str) -> Path:
    """
    Create a new markdown note in the vault.

    Constraints:
        - rel_path must end with .md
        - rel_path must be in an allowed write zone (Inbox, Archive, or Project Sessions/Ideas/Bugs)
        - File must not already exist (no overwrite)
        - Content size limited via settings.max_note_size_bytes

    Raises:
        PathTraversalError: rel_path escapes vault or hits forbidden dir
        WriteForbiddenError: rel_path is outside allowed write zones
        NoteAlreadyExistsError: file already exists at rel_path
        ValueError: content too large
    """
    if not rel_path.endswith(".md"):
        raise WriteForbiddenError(f"Path must end with .md: {rel_path!r}")

    safe_path = resolve_safe_path(settings.vault_path, rel_path)
    rel_resolved = safe_path.relative_to(settings.vault_path.resolve()).as_posix()

    if not _is_allowed_write_path(rel_resolved):
        raise WriteForbiddenError(
            f"Path not in allowed write zones (00-Inbox/, 03-Archive/, "
            f"01-Projects/<project>/Sessions|Ideas|Bugs/): resolved to {rel_resolved!r}"
        )

    if safe_path.exists():
        raise NoteAlreadyExistsError(f"File already exists: {rel_path}")

    content_bytes = content.encode("utf-8")
    if len(content_bytes) > settings.max_note_size_bytes:
        raise ValueError(
            f"Content too large ({len(content_bytes)} bytes, "
            f"max {settings.max_note_size_bytes})"
        )

    safe_path.parent.mkdir(parents=True, exist_ok=True)
    safe_path.write_text(content, encoding="utf-8")

    _audit_log(settings, "create_note", rel_path, len(content_bytes))

    return safe_path


def delete_note(settings: Settings, rel_path: str) -> Path:
    """
    Delete a markdown note from the vault.

    Constraints:
        - rel_path must end with .md
        - rel_path must be in an allowed write zone (same as create_note)
        - File must exist and be a regular file

    Raises:
        PathTraversalError: rel_path escapes vault or hits forbidden dir
        WriteForbiddenError: rel_path is outside allowed write zones, or not a regular file
        NoteNotFoundForDeleteError: file does not exist at rel_path
    """
    if not rel_path.endswith(".md"):
        raise WriteForbiddenError(f"Path must end with .md: {rel_path!r}")

    safe_path = resolve_safe_path(settings.vault_path, rel_path)
    rel_resolved = safe_path.relative_to(settings.vault_path.resolve()).as_posix()

    if not _is_allowed_write_path(rel_resolved):
        raise WriteForbiddenError(
            f"Path not in allowed delete zones (00-Inbox/, 03-Archive/, "
            f"01-Projects/<project>/Sessions|Ideas|Bugs/): resolved to {rel_resolved!r}"
        )

    if not safe_path.exists():
        raise NoteNotFoundForDeleteError(f"File does not exist: {rel_path}")

    if not safe_path.is_file():
        raise WriteForbiddenError(f"Path is not a regular file: {rel_path}")

    size = safe_path.stat().st_size
    safe_path.unlink()

    _audit_log(settings, "delete_note", rel_path, size)

    return safe_path
