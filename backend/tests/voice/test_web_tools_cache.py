"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 VOICE WEB TOOLS CACHE — Tests for Spec #0 express fix                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Coverage:
  - cached_brave_search: cache hit, cache miss, key derivation
  - voice/router.py:tool_web_search: Brave cache used, tracking incremented,
    rate-limit triggered at 15th call per summary_id and at 60th per user_id
"""

import hashlib
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from videos.brave_search import BraveSearchResult


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _result(query: str = "ai 2026") -> BraveSearchResult:
    """Build a successful BraveSearchResult fixture."""
    return BraveSearchResult(
        success=True,
        snippets="• [Mistral AI](2025): Mistral lance un nouveau modèle.",
        sources=[
            {
                "title": "Mistral AI",
                "url": "https://mistral.ai/news",
                "snippet": "Mistral lance un nouveau modèle.",
                "age": "2025",
            }
        ],
        query=query,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 cached_brave_search — Redis-backed cache wrapper
# ═══════════════════════════════════════════════════════════════════════════════


class TestCachedBraveSearch:
    """Unit tests for voice.web_tools_cache.cached_brave_search."""

    def test_cache_key_uses_sha1_of_query_and_count(self):
        """Cache key must follow the spec: brave:search:{sha1(query|count)}."""
        from voice.web_tools_cache import _make_cache_key

        key = _make_cache_key("ai future", 5)
        expected_hash = hashlib.sha1(b"ai future|5").hexdigest()
        assert key == f"brave:search:{expected_hash}"

    @pytest.mark.asyncio
    async def test_cache_miss_calls_brave_and_stores_result(self):
        """On cache miss, _call_brave_api is invoked and the result is cached."""
        from voice import web_tools_cache

        result = _result("ai 2026")
        cache_storage: dict = {}

        async def fake_get(key):
            return cache_storage.get(key)

        async def fake_set(key, value, ttl=None):
            cache_storage[key] = value
            return True

        mock_cache = MagicMock()
        mock_cache.get = AsyncMock(side_effect=fake_get)
        mock_cache.set = AsyncMock(side_effect=fake_set)

        with patch.object(web_tools_cache, "cache_service", mock_cache), patch.object(
            web_tools_cache, "_call_brave_api", AsyncMock(return_value=result)
        ) as mock_brave:
            out = await web_tools_cache.cached_brave_search("ai 2026", count=5)

        assert out.success is True
        assert out.sources[0]["url"] == "https://mistral.ai/news"
        mock_brave.assert_awaited_once_with("ai 2026", count=5)
        # Stored in cache with 3600s TTL
        assert mock_cache.set.await_count == 1
        _, kwargs = mock_cache.set.call_args
        assert kwargs.get("ttl") == 3600 or mock_cache.set.call_args.args[2] == 3600

    @pytest.mark.asyncio
    async def test_cache_hit_skips_brave_api(self):
        """On cache hit, _call_brave_api must not be called."""
        from voice import web_tools_cache

        cached_payload = {
            "success": True,
            "snippets": "cached",
            "sources": [{"title": "C", "url": "https://c.example", "snippet": "c", "age": ""}],
            "query": "ai 2026",
            "error": None,
        }
        mock_cache = MagicMock()
        mock_cache.get = AsyncMock(return_value=cached_payload)
        mock_cache.set = AsyncMock(return_value=True)

        with patch.object(web_tools_cache, "cache_service", mock_cache), patch.object(
            web_tools_cache, "_call_brave_api", AsyncMock()
        ) as mock_brave:
            out = await web_tools_cache.cached_brave_search("ai 2026", count=5)

        assert out.success is True
        assert out.snippets == "cached"
        mock_brave.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_cache_skipped_on_failure(self):
        """A failed Brave call must not poison the cache."""
        from voice import web_tools_cache

        bad = BraveSearchResult(success=False, snippets="", sources=[], query="x", error="boom")
        mock_cache = MagicMock()
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock(return_value=True)

        with patch.object(web_tools_cache, "cache_service", mock_cache), patch.object(
            web_tools_cache, "_call_brave_api", AsyncMock(return_value=bad)
        ):
            out = await web_tools_cache.cached_brave_search("x", count=5)

        assert out.success is False
        mock_cache.set.assert_not_awaited()


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 voice.web_tools — wired through cached_brave_search
# ═══════════════════════════════════════════════════════════════════════════════


class TestWebToolsUseCache:
    """voice.web_tools.{web_search,deep_research,check_fact} use the cache wrapper."""

    @pytest.mark.asyncio
    async def test_web_search_uses_cached_brave(self):
        from voice import web_tools

        result = _result("aripiprazole")
        with patch.object(web_tools, "get_brave_key", return_value="key"), patch.object(
            web_tools, "cached_brave_search", AsyncMock(return_value=result)
        ) as mock_cached:
            db = AsyncMock()
            out = await web_tools.web_search(42, "aripiprazole", db)

        mock_cached.assert_awaited_once_with("aripiprazole", count=5)
        assert "Mistral lance un nouveau modèle" in out

    @pytest.mark.asyncio
    async def test_deep_research_uses_cached_brave(self):
        from voice import web_tools

        result = _result("aripiprazole")
        with patch.object(web_tools, "get_brave_key", return_value="key"), patch.object(
            web_tools, "cached_brave_search", AsyncMock(return_value=result)
        ) as mock_cached:
            db = AsyncMock()
            out = await web_tools.deep_research(42, "aripiprazole", db)

        # 3 sub-queries
        assert mock_cached.await_count == 3
        assert "Recherche approfondie" in out

    @pytest.mark.asyncio
    async def test_check_fact_uses_cached_brave(self):
        from voice import web_tools

        result = _result("aripiprazole")
        with patch.object(web_tools, "get_brave_key", return_value="key"), patch.object(
            web_tools, "cached_brave_search", AsyncMock(return_value=result)
        ) as mock_cached:
            db = AsyncMock()
            out = await web_tools.check_fact(42, "Aripiprazole soigne le TOC", db)

        mock_cached.assert_awaited_once()
        assert "Aripiprazole" in out


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Rate-limit & tracking on /tools/web-search
# ═══════════════════════════════════════════════════════════════════════════════


class TestWebSearchRateLimitAndTracking:
    """tool_web_search rate-limits to 15/h per summary_id, 60/h per user_id, and tracks usage."""

    @pytest.mark.asyncio
    async def test_summary_rate_limit_is_15(self):
        """The 16th call within an hour for the same summary_id must be blocked."""
        from voice import router as voice_router

        assert voice_router._WEB_SEARCH_MAX == 15

    @pytest.mark.asyncio
    async def test_user_rate_limit_is_60(self):
        """The 61st call within an hour for the same user_id must be blocked."""
        from voice import router as voice_router

        assert voice_router._WEB_SEARCH_USER_MAX == 60

    @pytest.mark.asyncio
    async def test_summary_counter_blocks_at_16th_call(self):
        """_increment_web_search_count(summary) returns count > 15 → blocked."""
        from voice import router as voice_router

        # In-memory fallback (Redis unavailable)
        voice_router._web_search_counts.clear()
        with patch("core.cache.cache_service") as mock_cache:
            mock_cache._redis_available = False
            counts = []
            for _ in range(16):
                c = await voice_router._increment_web_search_count("sumX")
                counts.append(c)

        assert counts[14] == 15  # 15th call OK
        assert counts[15] == 16  # 16th call exceeds threshold

    @pytest.mark.asyncio
    async def test_user_counter_blocks_at_61st_call(self):
        """_increment_user_web_search_count returns count > 60 → blocked."""
        from voice import router as voice_router

        voice_router._user_web_search_counts.clear()
        with patch("core.cache.cache_service") as mock_cache:
            mock_cache._redis_available = False
            for _ in range(60):
                await voice_router._increment_user_web_search_count(7)
            count = await voice_router._increment_user_web_search_count(7)

        assert count == 61

    @pytest.mark.asyncio
    async def test_tool_web_search_increments_tracking(self):
        """tool_web_search must call increment_web_search_usage(user_id, summary_id, source='voice', query=...)."""
        from fastapi import Request
        from voice import router as voice_router

        # Fake summary owned by user 7
        summary = MagicMock()
        summary.id = 99
        summary.user_id = 7
        body = {"summary_id": 99, "query": "aripiprazole"}

        request = MagicMock(spec=Request)
        db = AsyncMock()

        voice_router._web_search_counts.clear()
        voice_router._user_web_search_counts.clear()

        with patch.object(
            voice_router,
            "verify_tool_request",
            AsyncMock(return_value=(summary, body)),
        ), patch.object(
            voice_router,
            "web_search",
            AsyncMock(return_value="Résultats: ..."),
        ), patch.object(
            voice_router,
            "record_web_search_usage",
            AsyncMock(),
        ) as mock_record, patch("core.cache.cache_service") as mock_cache:
            mock_cache._redis_available = False
            await voice_router.tool_web_search(request, db)

        mock_record.assert_awaited_once()
        kwargs = mock_record.await_args.kwargs
        # Allow positional or keyword binding
        if kwargs:
            assert kwargs.get("source") == "voice"
            assert kwargs.get("query") == "aripiprazole"
            assert kwargs.get("user_id") == 7
            assert kwargs.get("summary_id") == 99
        else:
            args = mock_record.await_args.args
            # signature: (db, user_id, summary_id, source, query)
            assert "voice" in args
            assert "aripiprazole" in args

    @pytest.mark.asyncio
    async def test_tool_web_search_blocks_at_summary_limit(self):
        """When summary counter exceeds 15, the tool returns the limit message and skips brave call."""
        from fastapi import Request
        from voice import router as voice_router

        summary = MagicMock()
        summary.id = 99
        summary.user_id = 7
        body = {"summary_id": 99, "query": "aripiprazole"}

        request = MagicMock(spec=Request)
        db = AsyncMock()

        voice_router._web_search_counts.clear()
        voice_router._user_web_search_counts.clear()
        # Pre-fill the counter to its max
        voice_router._web_search_counts["99"] = 15

        with patch.object(
            voice_router,
            "verify_tool_request",
            AsyncMock(return_value=(summary, body)),
        ), patch.object(
            voice_router, "web_search", AsyncMock()
        ) as mock_ws, patch.object(
            voice_router,
            "record_web_search_usage",
            AsyncMock(),
        ) as mock_record, patch("core.cache.cache_service") as mock_cache:
            mock_cache._redis_available = False
            response = await voice_router.tool_web_search(request, db)

        assert "Limite" in response["result"]
        mock_ws.assert_not_awaited()
        mock_record.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_explorer_prompts_advertise_web_search_tools(self):
        """Spec #0 (a): explorer agent prompts must explicitly mention web_search,
        deep_research, check_fact, and instruct to announce the search."""
        from voice.agent_types import EXPLORER

        for prompt in (EXPLORER.system_prompt_fr, EXPLORER.system_prompt_en):
            assert "web_search" in prompt
            assert "deep_research" in prompt
            assert "check_fact" in prompt

        # FR — exact French announcement phrase from spec L84
        assert "Je vais chercher sur le web" in EXPLORER.system_prompt_fr
        # EN — equivalent phrasing
        assert "Let me search the web" in EXPLORER.system_prompt_en or \
               "I'll search the web" in EXPLORER.system_prompt_en

    @pytest.mark.asyncio
    async def test_tool_web_search_blocks_at_user_limit(self):
        """When user counter exceeds 60, the tool returns a user-level limit message."""
        from fastapi import Request
        from voice import router as voice_router

        summary = MagicMock()
        summary.id = 99
        summary.user_id = 7
        body = {"summary_id": 99, "query": "aripiprazole"}

        request = MagicMock(spec=Request)
        db = AsyncMock()

        voice_router._web_search_counts.clear()
        voice_router._user_web_search_counts.clear()
        voice_router._user_web_search_counts[7] = 60

        with patch.object(
            voice_router,
            "verify_tool_request",
            AsyncMock(return_value=(summary, body)),
        ), patch.object(
            voice_router, "web_search", AsyncMock()
        ) as mock_ws, patch.object(
            voice_router,
            "record_web_search_usage",
            AsyncMock(),
        ) as mock_record, patch("core.cache.cache_service") as mock_cache:
            mock_cache._redis_available = False
            response = await voice_router.tool_web_search(request, db)

        assert "Limite" in response["result"] or "limite" in response["result"].lower()
        mock_ws.assert_not_awaited()
        mock_record.assert_not_awaited()
