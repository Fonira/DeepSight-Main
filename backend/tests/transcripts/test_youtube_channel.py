"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: youtube_channel — Channel context fetcher                               ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couverture :                                                                      ║
║  • get_channel_context : succès complet, troncature descriptions, échec, timeout  ║
║  • extract_channel_id_from_video_metadata : 3 chemins (direct/url/uploader_id)    ║
║                                                                                    ║
║  ⚠️ AUCUN appel réseau / aucun lancement réel de yt-dlp — tout est mocké via      ║
║     monkeypatch sur asyncio.create_subprocess_exec.                               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

# Aligne le sys.path comme les autres tests (src en priorité)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))

from transcripts import youtube_channel  # noqa: E402


# ═══════════════════════════════════════════════════════════════════════════════
# 🧰 HELPERS — fake subprocess pour mocker create_subprocess_exec
# ═══════════════════════════════════════════════════════════════════════════════


def _make_fake_process(
    *,
    returncode: int = 0,
    stdout_bytes: bytes = b"{}",
    stderr_bytes: bytes = b"",
    communicate_raises: Exception | None = None,
):
    """Construit un faux process retourné par create_subprocess_exec.

    Implémente strictement les méthodes utilisées par notre code :
    - communicate() awaitable
    - kill() / wait()
    - attribut returncode
    """
    proc = MagicMock()
    proc.returncode = returncode

    if communicate_raises is not None:

        async def _communicate():
            raise communicate_raises

        proc.communicate = _communicate
    else:
        proc.communicate = AsyncMock(return_value=(stdout_bytes, stderr_bytes))

    proc.kill = MagicMock()
    proc.wait = AsyncMock(return_value=returncode)
    return proc


def _build_fake_payload(num_entries: int = 50, long_description: bool = False) -> dict[str, Any]:
    """Construit un payload yt-dlp `--dump-single-json --flat-playlist` plausible."""
    entries = []
    base_desc = "x" * 500 if long_description else "Description courte de la vidéo"
    for i in range(num_entries):
        entries.append(
            {
                "_type": "url",
                "id": f"vid{i:03d}",
                "title": f"Video Title {i}",
                "description": base_desc,
                "tags": [f"tag{i}", "common"],
                "view_count": 1000 + i,
                "upload_date": f"2026010{i % 10}",
            }
        )

    return {
        "channel": "Test Channel Name",
        "uploader": "Test Channel Name",
        "description": "Description complète de la chaîne",
        "channel_follower_count": 123456,
        "playlist_count": 250,
        "tags": ["science", "education"],
        "categories": ["Education"],
        "entries": entries,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TESTS get_channel_context
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetChannelContext:
    async def test_get_channel_context_success(self, monkeypatch):
        """Mock subprocess retournant un JSON valide avec 50 entries -> parsing OK."""
        payload = _build_fake_payload(num_entries=50)
        fake_proc = _make_fake_process(
            returncode=0,
            stdout_bytes=json.dumps(payload).encode("utf-8"),
        )

        captured_args: dict[str, Any] = {}

        async def fake_create_subprocess_exec(*cmd, stdout=None, stderr=None, **kwargs):
            captured_args["cmd"] = cmd
            captured_args["stdout"] = stdout
            captured_args["stderr"] = stderr
            return fake_proc

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        result = await youtube_channel.get_channel_context("UCabcdefghijklmnopqrstuv", limit=50)

        # Shape complète
        assert result is not None
        assert result["channel_id"] == "UCabcdefghijklmnopqrstuv"
        assert result["platform"] == "youtube"
        assert result["name"] == "Test Channel Name"
        assert result["description"] == "Description complète de la chaîne"
        assert result["subscriber_count"] == 123456
        assert result["video_count"] == 250
        assert result["tags"] == ["science", "education"]
        assert result["categories"] == ["Education"]
        assert len(result["last_videos"]) == 50

        first_video = result["last_videos"][0]
        assert first_video["title"] == "Video Title 0"
        assert first_video["description"] == "Description courte de la vidéo"
        assert first_video["tags"] == ["tag0", "common"]
        assert first_video["view_count"] == 1000
        assert first_video["upload_date"] == "20260100"

        # Vérifie que la commande yt-dlp est correctement formée
        cmd = captured_args["cmd"]
        assert cmd[0] == "yt-dlp"
        assert "--flat-playlist" in cmd
        assert "--dump-single-json" in cmd
        assert "--playlistend" in cmd
        idx = cmd.index("--playlistend")
        assert cmd[idx + 1] == "50"
        assert "--no-warnings" in cmd
        assert "--skip-download" in cmd
        # URL canonique pour un UC...
        assert cmd[-1] == "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/videos"

    async def test_get_channel_context_truncates_descriptions(self, monkeypatch):
        """Descriptions > 200 chars -> tronquées à exactement 200 chars."""
        payload = _build_fake_payload(num_entries=3, long_description=True)
        fake_proc = _make_fake_process(
            returncode=0,
            stdout_bytes=json.dumps(payload).encode("utf-8"),
        )

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            return fake_proc

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        result = await youtube_channel.get_channel_context("UCabcdefghijklmnopqrstuv", limit=10)

        assert result is not None
        for video in result["last_videos"]:
            assert len(video["description"]) == 200
            assert video["description"] == "x" * 200

    async def test_get_channel_context_handles_failure(self, monkeypatch):
        """returncode != 0 -> log warning + return None."""
        fake_proc = _make_fake_process(
            returncode=1,
            stdout_bytes=b"",
            stderr_bytes=b"ERROR: channel does not exist",
        )

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            return fake_proc

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        result = await youtube_channel.get_channel_context("UCdoesnotexist1234567890", limit=50)
        assert result is None

    async def test_get_channel_context_handles_timeout(self, monkeypatch):
        """asyncio.TimeoutError pendant communicate() -> return None + kill du proc."""
        fake_proc = _make_fake_process(
            returncode=0,
            communicate_raises=asyncio.TimeoutError(),
        )

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            return fake_proc

        # Court-circuite asyncio.wait_for pour qu'il propage le TimeoutError
        # immédiatement (évite d'attendre 60s réelles).
        async def fake_wait_for(coro, timeout):
            # On attend la coroutine pour déclencher l'exception, puis on relève.
            try:
                return await coro
            finally:
                # Le test garantit que communicate raise déjà.
                pass

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )
        monkeypatch.setattr(youtube_channel.asyncio, "wait_for", fake_wait_for)

        result = await youtube_channel.get_channel_context("UCxxxxxxxxxxxxxxxxxxxxxx", limit=50)
        assert result is None
        # Vérifie qu'on a bien tenté de tuer le process
        fake_proc.kill.assert_called_once()

    async def test_get_channel_context_handles_invalid_json(self, monkeypatch):
        """Sortie non-JSON -> return None (json.JSONDecodeError catché)."""
        fake_proc = _make_fake_process(
            returncode=0,
            stdout_bytes=b"not a json {{{",
        )

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            return fake_proc

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        result = await youtube_channel.get_channel_context("UCxxxxxxxxxxxxxxxxxxxxxx", limit=50)
        assert result is None

    async def test_get_channel_context_handle_url(self, monkeypatch):
        """Un channel_id préfixé `@` -> URL `youtube.com/@xxx/videos`."""
        payload = _build_fake_payload(num_entries=2)
        fake_proc = _make_fake_process(
            returncode=0,
            stdout_bytes=json.dumps(payload).encode("utf-8"),
        )

        captured: dict[str, Any] = {}

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            captured["cmd"] = cmd
            return fake_proc

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        result = await youtube_channel.get_channel_context("@MrBeast", limit=5)
        assert result is not None
        assert captured["cmd"][-1] == "https://www.youtube.com/@MrBeast/videos"

    async def test_get_channel_context_executable_missing(self, monkeypatch):
        """yt-dlp absent du PATH (FileNotFoundError) -> return None proprement."""

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            raise FileNotFoundError("yt-dlp not found")

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        result = await youtube_channel.get_channel_context("UCxxxxxxxxxxxxxxxxxxxxxx", limit=50)
        assert result is None

    async def test_get_channel_context_empty_channel_id(self, monkeypatch):
        """channel_id vide -> return None sans même tenter le subprocess."""
        called = {"v": False}

        async def fake_create_subprocess_exec(*cmd, **kwargs):
            called["v"] = True
            return _make_fake_process()

        monkeypatch.setattr(
            youtube_channel.asyncio,
            "create_subprocess_exec",
            fake_create_subprocess_exec,
        )

        assert await youtube_channel.get_channel_context("", limit=50) is None
        assert called["v"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TESTS extract_channel_id_from_video_metadata
# ═══════════════════════════════════════════════════════════════════════════════


class TestExtractChannelIdFromMetadata:
    def test_direct_channel_id_field(self):
        """Si `channel_id` est présent, il est retourné en priorité."""
        metadata = {
            "channel_id": "UCabcdefghijklmnopqrstuv",
            "channel_url": "https://www.youtube.com/channel/UCotherIdShouldBeIgnored",
            "uploader_id": "@SomeHandle",
        }
        assert (
            youtube_channel.extract_channel_id_from_video_metadata(metadata)
            == "UCabcdefghijklmnopqrstuv"
        )

    def test_parse_from_channel_url(self):
        """Pas de `channel_id` -> parse depuis `channel_url`."""
        metadata = {
            "channel_url": "https://www.youtube.com/channel/UCfromUrlAaaaaaaaaaaaaa/videos",
            "uploader_id": "@SomeHandle",
        }
        assert (
            youtube_channel.extract_channel_id_from_video_metadata(metadata)
            == "UCfromUrlAaaaaaaaaaaaaa"
        )

    def test_parse_handle_from_channel_url(self):
        """`channel_url` au format `youtube.com/@handle` -> retourne `@handle`."""
        metadata = {
            "channel_url": "https://www.youtube.com/@MrBeast",
            "uploader_id": "fallback_should_not_be_used",
        }
        assert (
            youtube_channel.extract_channel_id_from_video_metadata(metadata) == "@MrBeast"
        )

    def test_fallback_uploader_id(self):
        """Pas de `channel_id` ni de `channel_url` parseable -> `uploader_id`."""
        metadata = {
            "channel_url": None,
            "uploader_id": "@FallbackHandle",
        }
        assert (
            youtube_channel.extract_channel_id_from_video_metadata(metadata)
            == "@FallbackHandle"
        )

    def test_returns_none_when_nothing(self):
        """Aucun champ exploitable -> None."""
        assert youtube_channel.extract_channel_id_from_video_metadata({}) is None
        assert youtube_channel.extract_channel_id_from_video_metadata({"unrelated": 1}) is None

    def test_returns_none_when_not_dict(self):
        """Entrée non-dict -> None (défense en profondeur)."""
        assert youtube_channel.extract_channel_id_from_video_metadata(None) is None  # type: ignore[arg-type]
        assert youtube_channel.extract_channel_id_from_video_metadata("UCxxx") is None  # type: ignore[arg-type]
