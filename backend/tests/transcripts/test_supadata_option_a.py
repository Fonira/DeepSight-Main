"""
Tests for Option A pattern in `get_transcript_supadata`.

CONTEXT (2026-05-12)
====================
Bug originel : les endpoints unified (`/v1/transcript`) et async (`/v1/transcript/{job_id}`)
de Supadata ne retournent qu'un champ `content` (plain text, sans timestamps).
Les anciennes lignes ~913/~940 de `transcripts/youtube.py` retournaient
`(content.strip(), content.strip(), detected_lang)` — dupliquant le texte plain
dans le canal `transcript_timestamped`. Conséquence : la regex `_parse_timestamps`
(chunker.py) matchait zéro anchor `[MM:SS]`, et visual analysis perdait
silencieusement ses timestamps réels (bug observé prod 2026-05-11).

Fix Option A : retourner `(content, None, lang)` pour signaler au caller
(`if simple and timestamped` dans `_get_transcript_with_timestamps_inner`) que
ce résultat n'a pas d'anchors exploitables → fallback vers Phase 1 (ytapi,
Invidious, Piped) qui fournissent de vrais timestamps.

Le contrat vérifié ici :
1. Endpoint unifié (200 OK) avec `content` = string → return (text, None, lang)
2. Endpoint async (202 → polling 200) avec `content` = string → return (text, None, lang)
3. Segments horodatés (`content` = liste de `{text, offset(ms), duration}`, format
   actuel de l'API, y compris sur l'endpoint YT-specific) → vrais timestamps
   `[MM:SS]` (mise à jour 2026-11-27 : auparavant le YT-specific ignorait `content`
   et l'unifié aplatissait la liste en texte brut).
4. Caller `_get_transcript_with_timestamps_inner` rejette correctement
   (`if simple and timestamped` est falsy) pour forcer le fallback Phase 1,
   mais garde le texte Supadata en réserve si Phase 1 ne trouve rien.
"""

from __future__ import annotations

import inspect
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ajouter src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


def _get_youtube_module():
    from transcripts import youtube as yt
    return yt


# ═══════════════════════════════════════════════════════════════════════════════
# Source-level lock — Option A pattern visible in the code
# ═══════════════════════════════════════════════════════════════════════════════


class TestSourceLevelOptionAPattern:
    """Source inspection to lock the Option A return pattern at L932/L959.

    These tests catch regressions where someone reverts to
    `return content.strip(), content.strip(), detected_lang`
    (the buggy pre-2026-05-12 pattern).
    """

    def setup_method(self):
        yt = _get_youtube_module()
        self.src = inspect.getsource(yt)

    def test_no_duplicated_content_return_pattern(self):
        """The buggy pattern `content.strip(), content.strip()` MUST NOT
        reappear in the file. This was the L913/L940 bug fixed 2026-05-12.
        """
        # Both lines used the exact same pattern: identical "content.strip()" duplicated
        assert "content.strip(), content.strip()" not in self.src, (
            "Buggy Supadata return pattern detected: "
            "`content.strip(), content.strip(), ...` returns plain text in the "
            "timestamped channel. This breaks visual analysis (regex matches "
            "zero `[MM:SS]` anchors). Use `return content.strip(), None, lang` "
            "instead (Option A pattern, fixed 2026-05-12)."
        )

    def test_unified_endpoint_returns_none_for_timestamped(self):
        """L932 — Unified endpoint return must use `None` for timestamped."""
        # Locate the unified success log marker and verify the return below it
        marker = "[SUPADATA] Unified success"
        assert marker in self.src, (
            f"Marker {marker!r} not found — unified endpoint success path removed?"
        )
        pos = self.src.find(marker)
        # Look forward for the return statement (within ~300 chars)
        window = self.src[pos : pos + 500]
        # Must have `content.strip(), None, detected_lang` (or similar with None)
        assert "content.strip(), None, detected_lang" in window, (
            "Unified endpoint should return (content, None, lang). "
            "Found window:\n" + window
        )

    def test_async_endpoint_returns_none_for_timestamped(self):
        """L959 — Async polling endpoint return must use `None` for timestamped."""
        marker = "[SUPADATA] Async success"
        assert marker in self.src, (
            f"Marker {marker!r} not found — async polling success path removed?"
        )
        pos = self.src.find(marker)
        window = self.src[pos : pos + 500]
        assert "content.strip(), None, detected_lang" in window, (
            "Async polling endpoint should return (content, None, lang). "
            "Found window:\n" + window
        )

    def test_yt_specific_endpoint_returns_none_for_timestamped(self):
        """L869 — YT-specific endpoint, when `segments` arrives as a plain string
        (instead of a list of `{text, start, dur}` dicts), must use `None` for
        the timestamped channel. Same Option A pattern as L932/L959, applied to
        the third success path flagged out-of-scope by PR #481 review.
        """
        # The buggy pattern would be `return segments, segments, ...`
        assert "return segments, segments" not in self.src, (
            "Buggy Supadata YT-specific return pattern detected: "
            "`return segments, segments, ...` duplicates plain text in the "
            "timestamped channel. Use `return segments, None, lang or 'fr'` "
            "instead (Option A pattern, fixed follow-up to PR #481)."
        )
        # And the new corrected log marker + return below it must exist
        marker = "[SUPADATA] YT-specific success"
        assert marker in self.src, (
            f"Marker {marker!r} not found — YT-specific success path removed?"
        )
        # Locate the FIRST occurrence (segments-as-string branch). The second
        # occurrence (segments-as-list branch L893) returns a real timestamped
        # string built from anchors and is the legitimate happy path.
        pos = self.src.find(marker)
        window = self.src[pos : pos + 500]
        assert "segments, None, lang" in window, (
            "YT-specific endpoint (string branch) should return "
            "(segments, None, lang or 'fr'). Found window:\n" + window
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Behavioral tests — mocked HTTP responses
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_supadata_unified_endpoint_returns_none_for_timestamped():
    """When Supadata unified endpoint returns plain-text `content`, the helper
    must return `(content, None, lang)` — NOT `(content, content, lang)`.

    The downstream caller `_get_transcript_with_timestamps_inner` checks
    `if simple and timestamped`. With `None`, this evaluates falsy → fallback
    to Phase 1 (ytapi/Invidious/Piped) which may give real timestamps.
    """
    yt = _get_youtube_module()

    # Mock response for unified endpoint: plain text content, no segments
    fake_response_200 = MagicMock()
    fake_response_200.status_code = 200
    fake_response_200.json = MagicMock(
        return_value={
            "content": "This is a plain text transcript without any timestamps at all here.",
            "lang": "en",
        }
    )

    # Mock response for YT-specific endpoint: 404 (so we fall through to unified)
    fake_response_404 = MagicMock()
    fake_response_404.status_code = 404

    # Fake client: yt-specific returns 404 for every lang, unified returns the 200
    call_log = []

    async def fake_get(url, params=None, headers=None, timeout=None):
        call_log.append(url)
        # YT-specific endpoint → 404 for all langs
        if "youtube/transcript" in url:
            return fake_response_404
        # Unified endpoint
        if url.endswith("/v1/transcript"):
            return fake_response_200
        return fake_response_404

    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=fake_get)

    # Async context manager
    fake_ctx = MagicMock()
    fake_ctx.__aenter__ = AsyncMock(return_value=fake_client)
    fake_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch.object(yt, "shared_http_client", return_value=fake_ctx):
        simple, timestamped, lang = await yt.get_transcript_supadata(
            video_id="testvideo01", api_key="fake_key"
        )

    # Option A contract
    assert simple is not None and len(simple) > 0, (
        "Plain text content from unified endpoint should populate `simple`"
    )
    assert timestamped is None, (
        "Option A — unified endpoint has no timestamps, must return None "
        f"(got: {timestamped!r})"
    )
    assert lang == "en"


@pytest.mark.asyncio
async def test_supadata_async_polling_returns_none_for_timestamped():
    """When Supadata returns 202 (async job) and polling eventually returns
    plain-text `content`, the helper must return `(content, None, lang)`.
    """
    yt = _get_youtube_module()

    # Mocks
    fake_response_404 = MagicMock()
    fake_response_404.status_code = 404

    fake_response_202 = MagicMock()
    fake_response_202.status_code = 202
    fake_response_202.json = MagicMock(return_value={"jobId": "job_xyz"})

    fake_poll_200 = MagicMock()
    fake_poll_200.status_code = 200
    fake_poll_200.json = MagicMock(
        return_value={
            "content": "Async polling result with plain text only and no timestamps.",
            "lang": "fr",
        }
    )

    async def fake_get(url, params=None, headers=None, timeout=None):
        if "youtube/transcript" in url:
            return fake_response_404
        if url.endswith("/v1/transcript"):
            # First call returns 202 (async job)
            return fake_response_202
        if "/v1/transcript/job_xyz" in url:
            # Poll returns 200 with plain text
            return fake_poll_200
        return fake_response_404

    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=fake_get)

    fake_ctx = MagicMock()
    fake_ctx.__aenter__ = AsyncMock(return_value=fake_client)
    fake_ctx.__aexit__ = AsyncMock(return_value=None)

    # Patch asyncio.sleep to avoid real 5s waits in test
    with patch.object(yt, "shared_http_client", return_value=fake_ctx), \
         patch("asyncio.sleep", new=AsyncMock(return_value=None)):
        simple, timestamped, lang = await yt.get_transcript_supadata(
            video_id="testvideo02", api_key="fake_key"
        )

    assert simple is not None and "Async polling result" in simple
    assert timestamped is None, (
        "Option A — async polling has no timestamps, must return None "
        f"(got: {timestamped!r})"
    )
    assert lang == "fr"


@pytest.mark.asyncio
async def test_supadata_yt_specific_string_segments_returns_none_for_timestamped():
    """When Supadata YT-specific endpoint returns `segments` as a plain string
    (instead of the expected list of `{text, start, dur}` dicts), the helper
    must return `(segments, None, lang)` — NOT `(segments, segments, lang)`.

    Follow-up to PR #481 — same Option A pattern, third success path (L869).
    Without `None`, downstream visual analysis silently loses timestamps because
    `_parse_timestamps` (chunker.py) matches zero `[MM:SS]` anchors in plain text.
    """
    yt = _get_youtube_module()

    # Mock YT-specific endpoint returning `segments` as a plain string
    # (no list of dicts → no timestamps)
    fake_yt_specific_200 = MagicMock()
    fake_yt_specific_200.status_code = 200
    fake_yt_specific_200.json = MagicMock(
        return_value={
            "segments": "Plain text transcript returned as a string by the YT-specific endpoint here.",
            "lang": "en",
        }
    )

    async def fake_get(url, params=None, headers=None, timeout=None):
        # YT-specific endpoint hits first (and succeeds with string segments)
        if "youtube/transcript" in url:
            return fake_yt_specific_200
        # Should never reach the unified endpoint in this scenario
        fallback = MagicMock()
        fallback.status_code = 404
        return fallback

    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=fake_get)

    fake_ctx = MagicMock()
    fake_ctx.__aenter__ = AsyncMock(return_value=fake_client)
    fake_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch.object(yt, "shared_http_client", return_value=fake_ctx):
        simple, timestamped, lang = await yt.get_transcript_supadata(
            video_id="testvideo03", api_key="fake_key"
        )

    # Option A contract — same as L946/L980
    assert simple is not None and len(simple) > 0, (
        "Plain string `segments` from YT-specific endpoint should populate `simple`"
    )
    assert timestamped is None, (
        "Option A — YT-specific endpoint with string `segments` has no timestamps, "
        f"must return None (got: {timestamped!r})"
    )
    # First lang tried is "fr" in the for-loop → request matched on lang=fr
    assert lang == "fr"


@pytest.mark.asyncio
async def test_supadata_caller_rejects_plain_text_only_result():
    """Integration : downstream caller `_get_transcript_with_timestamps_inner`
    must reject `(content, None, lang)` via the `if simple and timestamped`
    guard, forcing fallback to Phase 1.

    We can't easily exercise the full inner function in unit test (heavy deps),
    but we can lock the source pattern that ensures `None` triggers rejection.
    """
    yt = _get_youtube_module()
    src = inspect.getsource(yt)

    # The Supadata caller in Phase 0 must check `if simple and timestamped` so
    # that `timestamped=None` rejects the result and falls through.
    # Locate the Phase 0 supadata call and verify the guard exists.
    phase0_marker = "🥇 PHASE 0: Supadata API (PRIORITY)"
    assert phase0_marker in src, "Phase 0 Supadata block removed?"
    pos = src.find(phase0_marker)
    window = src[pos : pos + 2000]

    assert "if simple and timestamped" in window, (
        "Phase 0 Supadata caller must guard with `if simple and timestamped` "
        "so that `(content, None, lang)` triggers Phase 1 fallback. "
        "Without this guard, plain-text-only Supadata results would be cached "
        "and downstream visual analysis would lose timestamps."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 2026-11-27 — format actuel de l'API : `content` = segments avec offset en ms
# ═══════════════════════════════════════════════════════════════════════════════

_CONTENT_SEGMENTS = [
    {"lang": "fr", "text": "depuis le début de la crise", "offset": 7440, "duration": 2990},
    {"lang": "fr", "text": "et en fait", "offset": 9050, "duration": 2200},
    {"lang": "fr", "text": "une minute plus tard on parle d'autre chose", "offset": 65000, "duration": 3000},
]


def _fake_ctx_for(fake_get):
    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=fake_get)
    fake_ctx = MagicMock()
    fake_ctx.__aenter__ = AsyncMock(return_value=fake_client)
    fake_ctx.__aexit__ = AsyncMock(return_value=None)
    return fake_ctx, fake_client


def test_segments_helper_converts_offset_milliseconds_to_seconds():
    yt = _get_youtube_module()
    simple, timestamped = yt._supadata_segments_to_texts(_CONTENT_SEGMENTS)

    assert simple.startswith("depuis le début de la crise et en fait")
    # offset 7440 ms → [00:07], 65000 ms → [01:05] (et non 2 h 04 si lu en secondes)
    assert "[00:07] depuis le début de la crise" in timestamped
    assert "[01:05] une minute plus tard" in timestamped
    assert "[2:04" not in timestamped


def test_segments_helper_keeps_legacy_start_in_seconds():
    yt = _get_youtube_module()
    _, timestamped = yt._supadata_segments_to_texts([{"text": "legacy", "start": 95, "dur": 2}])
    assert "[01:35] legacy" in timestamped


def test_segments_helper_plain_strings_have_no_timestamps():
    yt = _get_youtube_module()
    simple, timestamped = yt._supadata_segments_to_texts(["un", "deux"])
    assert simple == "un deux"
    assert timestamped is None


@pytest.mark.asyncio
async def test_yt_specific_endpoint_reads_content_key_with_timestamps():
    """Le YT-specific renvoie désormais `content` (et non `segments`) : il doit être
    lu au premier appel, avec de vrais timestamps — avant le correctif, chaque langue
    était retentée (1 crédit par appel) puis l'unifié perdait les timestamps."""
    yt = _get_youtube_module()

    ok = MagicMock()
    ok.status_code = 200
    ok.json = MagicMock(return_value={"lang": "fr", "availableLangs": ["fr"], "content": _CONTENT_SEGMENTS})

    async def fake_get(url, params=None, headers=None, timeout=None):
        return ok

    fake_ctx, fake_client = _fake_ctx_for(fake_get)
    with patch.object(yt, "shared_http_client", return_value=fake_ctx):
        simple, timestamped, lang = await yt.get_transcript_supadata(video_id="testvideo04", api_key="fake_key")

    assert fake_client.get.await_count == 1, "un seul appel Supadata (un seul crédit)"
    assert simple and "depuis le début de la crise" in simple
    assert timestamped and "[00:07]" in timestamped and "[01:05]" in timestamped
    assert lang == "fr"


@pytest.mark.asyncio
async def test_unified_endpoint_with_timed_segments_returns_timestamps():
    yt = _get_youtube_module()

    not_found = MagicMock()
    not_found.status_code = 404
    unified = MagicMock()
    unified.status_code = 200
    unified.json = MagicMock(return_value={"lang": "fr", "content": _CONTENT_SEGMENTS})

    async def fake_get(url, params=None, headers=None, timeout=None):
        if "youtube/transcript" in url:
            return not_found
        return unified

    fake_ctx, _ = _fake_ctx_for(fake_get)
    with patch.object(yt, "shared_http_client", return_value=fake_ctx):
        simple, timestamped, lang = await yt.get_transcript_supadata(video_id="testvideo05", api_key="fake_key")

    assert simple and "une minute plus tard" in simple
    assert timestamped and "[01:05]" in timestamped
    assert lang == "fr"


def test_phase0_keeps_plain_supadata_text_as_fallback_after_phase1():
    """Le texte Supadata sans timestamps ne doit plus être jeté : il est gardé en
    réserve et utilisé si Phase 1 ne trouve pas de timestamps, avant yt-dlp/STT."""
    yt = _get_youtube_module()
    src = inspect.getsource(yt)

    phase0 = src.find("🥇 PHASE 0: Supadata API (PRIORITY)")
    phase15 = src.find("# PHASE 1.5: VOXTRAL SHORT-CIRCUIT")
    assert 0 < phase0 < phase15
    block = src[phase0:phase15]
    assert "supadata_plain = (simple, lang or \"fr\")" in block
    assert "if supadata_plain is not None:" in block
    # La réserve est utilisée APRÈS la course Phase 1 et AVANT Phase 1.5 / 2 / 3.
    assert block.find("PHASE 1: Text methods") < block.rfind("if supadata_plain is not None:")
