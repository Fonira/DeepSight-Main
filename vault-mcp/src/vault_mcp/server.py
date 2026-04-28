"""FastMCP server entrypoint with bearer auth and rate limiting."""

import logging
import time
from collections import deque

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send

from vault_mcp.config import Settings, load_settings
from vault_mcp.logging_setup import setup_logging
from vault_mcp.tools.read import (
    read_note_content,
    get_global_context_content,
    get_memory_content,
    NoteNotFoundError,
    NoteTooLargeError,
)
from vault_mcp.tools.search import search_vault as _search_vault_impl, SearchResult
from vault_mcp.tools.list import (
    list_projects as _list_projects_impl,
    list_memory as _list_memory_impl,
    ProjectInfo,
    MemoryInfo,
)
from vault_mcp.security import PathTraversalError
from vault_mcp.tools.write import (
    create_note as _create_note_impl,
    delete_note as _delete_note_impl,
    WriteForbiddenError,
    NoteAlreadyExistsError,
    NoteNotFoundForDeleteError,
)


setup_logging()
log = logging.getLogger("vault_mcp")
SETTINGS: Settings = load_settings()

mcp = FastMCP(
    "vault-mcp",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    ),
)


@mcp.tool()
async def read_note(path: str) -> str:
    """Read a markdown note from the vault. Path is vault-relative (e.g., '01-Projects/DeepSight/_index.md')."""
    try:
        return read_note_content(SETTINGS, path)
    except (PathTraversalError, NoteNotFoundError, NoteTooLargeError) as e:
        return f"ERROR: {e}"


@mcp.tool()
async def search_vault(query: str, limit: int = 10) -> list[SearchResult]:
    """Full-text case-insensitive search across all markdown files in the vault."""
    return _search_vault_impl(SETTINGS, query, limit)


@mcp.tool()
async def list_projects() -> list[ProjectInfo]:
    """List all projects in 01-Projects/ with their _index/specs/decisions/bugs counts."""
    return _list_projects_impl(SETTINGS)


@mcp.tool()
async def get_global_context() -> str:
    """Get the global Claude context (02-Meta/Claude/global.md)."""
    try:
        return get_global_context_content(SETTINGS)
    except (PathTraversalError, NoteNotFoundError) as e:
        return f"ERROR: {e}"


@mcp.tool()
async def get_memory(name: str) -> str:
    """Get a memory file by full name (e.g., 'feedback_opus-4-7-preference.md') or unique prefix."""
    try:
        return get_memory_content(SETTINGS, name)
    except (PathTraversalError, NoteNotFoundError) as e:
        return f"ERROR: {e}"


@mcp.tool()
async def list_memory() -> list[MemoryInfo]:
    """List all memory files with their type and description from frontmatter."""
    return _list_memory_impl(SETTINGS)


@mcp.tool()
async def create_note(path: str, content: str) -> str:
    """
    Create a new markdown note in the vault.

    Allowed write zones (path prefix):
    - 00-Inbox/                          → quick captures, ideas
    - 03-Archive/                        → archived content
    - 01-Projects/<project>/Sessions/    → session notes
    - 01-Projects/<project>/Ideas/       → project-scoped ideas
    - 01-Projects/<project>/Bugs/        → bug reports

    Constraints:
    - path must end with .md
    - file must not already exist (no overwrite — use a different filename)
    - Specs/ and Decisions/ are NOT writable (use slash commands /new-spec, /new-decision in Claude Code instead)

    Args:
        path: vault-relative path (e.g., '01-Projects/DeepSight/Sessions/2026-04-28-test.md')
        content: full markdown content (frontmatter + body)

    Returns:
        Success message with the created path, or "ERROR: ..." string.
    """
    try:
        result = _create_note_impl(SETTINGS, path, content)
        rel = result.relative_to(SETTINGS.vault_path.resolve()).as_posix()
        log.info("create_note: %s (%d bytes)", rel, len(content.encode("utf-8")))
        return f"OK: created {rel}"
    except (
        PathTraversalError,
        WriteForbiddenError,
        NoteAlreadyExistsError,
        ValueError,
    ) as e:
        return f"ERROR: {e}"


@mcp.tool()
async def delete_note(path: str) -> str:
    """
    Delete a markdown note from the vault.

    Allowed delete zones (same as create_note):
    - 00-Inbox/
    - 03-Archive/
    - 01-Projects/<project>/Sessions/
    - 01-Projects/<project>/Ideas/
    - 01-Projects/<project>/Bugs/

    Constraints:
    - path must end with .md
    - file must exist
    - Specs/ and Decisions/ are NOT deletable via MCP

    Args:
        path: vault-relative path (e.g., '00-Inbox/test.md')

    Returns:
        Success message with the deleted path, or "ERROR: ..." string.
    """
    try:
        result = _delete_note_impl(SETTINGS, path)
        rel = result.relative_to(SETTINGS.vault_path.resolve()).as_posix()
        log.info("delete_note: %s", rel)
        return f"OK: deleted {rel}"
    except (
        PathTraversalError,
        WriteForbiddenError,
        NoteNotFoundForDeleteError,
    ) as e:
        return f"ERROR: {e}"


class _RateLimiter:
    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self.calls: deque[float] = deque()

    def check(self) -> bool:
        now = time.monotonic()
        cutoff = now - 60
        while self.calls and self.calls[0] < cutoff:
            self.calls.popleft()
        if len(self.calls) >= self.per_minute:
            return False
        self.calls.append(now)
        return True


_rate_limiter = _RateLimiter(per_minute=SETTINGS.rate_limit_per_minute)


class AuthMiddleware:
    """Pure ASGI middleware — compatible with SSE streaming responses."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path == "/health":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="replace")

        if not auth_header.startswith("Bearer "):
            await _send_json(send, 401, {"error": "Unauthorized"})
            return

        token = auth_header.removeprefix("Bearer ").strip()
        if token != SETTINGS.mcp_token:
            await _send_json(send, 401, {"error": "Unauthorized"})
            return

        if not _rate_limiter.check():
            await _send_json(send, 429, {"error": "Rate limit exceeded"})
            return

        await self.app(scope, receive, send)


async def _send_json(send: Send, status: int, payload: dict) -> None:
    import json

    body = json.dumps(payload).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


async def health(request: Request) -> JSONResponse:
    return JSONResponse(
        {"status": "ok", "vault_exists": SETTINGS.vault_path.exists()}
    )


app = mcp.streamable_http_app()
app.routes.insert(0, Route("/health", health, methods=["GET"]))
app.add_middleware(AuthMiddleware)


def main():
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8081)


if __name__ == "__main__":
    main()
