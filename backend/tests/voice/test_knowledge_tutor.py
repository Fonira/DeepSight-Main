"""Tests for the KNOWLEDGE_TUTOR voice agent (Phase 3 of tuteur-refactor).

Coverage:
    - get_agent_config("knowledge_tutor") returns the expected config
    - Agent appears in list_agent_types() and exposes the right metadata
    - build_knowledge_tutor_tools_config() emits 4 valid ConvAI webhook tools
    - get_user_history() returns the right shape on a fixture user
    - get_concept_keys() extracts [[concepts]] + tags fallback
    - get_summary_detail() returns full detail or {error: ...} on missing
    - search_history() forwards to search.global_search and returns slim items
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, User
from voice.agent_types import get_agent_config, list_agent_types
from voice.elevenlabs import build_knowledge_tutor_tools_config
from voice.knowledge_tutor_tools import (
    _extract_key_points,
    _summary_concept_keys,
    get_concept_keys,
    get_summary_detail,
    get_user_history,
    search_history,
)


# ─────────────────────────────────────────────────────────────────────
# Agent registry contract
# ─────────────────────────────────────────────────────────────────────


def test_knowledge_tutor_agent_registered():
    cfg = get_agent_config("knowledge_tutor")
    assert cfg.agent_type == "knowledge_tutor"
    assert cfg.requires_summary is False
    assert cfg.requires_debate is False
    assert cfg.plan_minimum == "pro"
    assert cfg.max_session_minutes == 15
    assert cfg.voice_style == "warm"


def test_knowledge_tutor_tools_listed():
    cfg = get_agent_config("knowledge_tutor")
    tool_names = set(cfg.tools)
    assert {
        "get_tutor_memory_snapshot",
        "get_user_history",
        "get_concept_keys",
        "search_history",
        "get_summary_detail",
        "web_search",
    }.issubset(tool_names)


def test_knowledge_tutor_memory_snapshot_is_first_tool():
    """The adaptive snapshot must be the agent's primary orientation tool —
    the prompt instructs the model to call it FIRST at session start."""
    cfg = get_agent_config("knowledge_tutor")
    assert cfg.tools[0] == "get_tutor_memory_snapshot"


def test_knowledge_tutor_in_list_agent_types():
    types = list_agent_types()
    knowledge = next((t for t in types if t["type"] == "knowledge_tutor"), None)
    assert knowledge is not None
    assert knowledge["plan_minimum"] == "pro"
    assert knowledge["requires_summary"] is False


def test_knowledge_tutor_prompts_socratic():
    """System prompts must mention the four-step socratic flow + the mandatory
    startup tool (get_tutor_memory_snapshot) + the legacy fallback tools."""
    cfg = get_agent_config("knowledge_tutor")
    # FR
    assert "get_tutor_memory_snapshot" in cfg.system_prompt_fr
    assert "get_concept_keys" in cfg.system_prompt_fr
    assert "get_user_history" in cfg.system_prompt_fr
    assert "search_history" in cfg.system_prompt_fr
    assert "get_summary_detail" in cfg.system_prompt_fr
    assert "Socratique" in cfg.system_prompt_fr or "socratique" in cfg.system_prompt_fr
    # EN
    assert "get_tutor_memory_snapshot" in cfg.system_prompt_en
    assert "get_concept_keys" in cfg.system_prompt_en
    assert "get_user_history" in cfg.system_prompt_en
    assert "Socratic" in cfg.system_prompt_en or "socratic" in cfg.system_prompt_en


# ─────────────────────────────────────────────────────────────────────
# ConvAI tools schema contract
# ─────────────────────────────────────────────────────────────────────


def test_build_knowledge_tutor_tools_config_shape():
    tools = build_knowledge_tutor_tools_config(
        webhook_base_url="https://api.example.com",
        voice_session_id="vs_abc",
    )
    names = [t["name"] for t in tools]
    assert names == [
        "get_tutor_memory_snapshot",
        "get_user_history",
        "get_concept_keys",
        "search_history",
        "get_summary_detail",
    ]
    for tool in tools:
        assert tool["type"] == "webhook"
        schema = tool["api_schema"]
        assert schema["method"] == "POST"
        assert schema["url"].startswith("https://api.example.com/api/voice/tools/knowledge-tutor-")
        assert schema["request_headers"]["Authorization"] == "Bearer vs_abc"
        body = schema["request_body_schema"]
        assert body["type"] == "object"
        assert "voice_session_id" in body["properties"]
        assert "voice_session_id" in body["required"]


def test_memory_snapshot_tool_has_no_extra_required_fields():
    """The snapshot tool should only require voice_session_id (no params)."""
    tools = build_knowledge_tutor_tools_config(
        webhook_base_url="https://api.example.com",
        voice_session_id="vs_abc",
    )
    snap = next(t for t in tools if t["name"] == "get_tutor_memory_snapshot")
    body = snap["api_schema"]["request_body_schema"]
    assert body["required"] == ["voice_session_id"]
    assert snap["api_schema"]["url"].endswith("/knowledge-tutor-memory")


def test_search_history_tool_requires_query():
    tools = build_knowledge_tutor_tools_config(
        webhook_base_url="https://api.example.com",
        voice_session_id="vs_abc",
    )
    search_tool = next(t for t in tools if t["name"] == "search_history")
    assert "query" in search_tool["api_schema"]["request_body_schema"]["required"]


def test_get_summary_detail_tool_requires_id():
    tools = build_knowledge_tutor_tools_config(
        webhook_base_url="https://api.example.com",
        voice_session_id="vs_abc",
    )
    detail_tool = next(t for t in tools if t["name"] == "get_summary_detail")
    assert "summary_id" in detail_tool["api_schema"]["request_body_schema"]["required"]


# ─────────────────────────────────────────────────────────────────────
# Tool: get_user_history
# ─────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def kt_user(async_db_session: AsyncSession) -> User:
    user = User(
        username="kt_tester",
        email="kt@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def kt_summaries(async_db_session: AsyncSession, kt_user: User) -> list[Summary]:
    """Three summaries with varied content used by the tool tests below."""
    rows = []
    rows.append(
        Summary(
            user_id=kt_user.id,
            video_id="vid_001",
            video_title="L'éthique de l'IA générative",
            video_channel="Sciences et IA",
            platform="youtube",
            lang="fr",
            category="ai",
            summary_content=(
                "## Résumé\n"
                "Une discussion approfondie sur les enjeux éthiques.\n\n"
                "## Points clés\n"
                "- L'[[alignment]] est central pour la sécurité.\n"
                "- Les [[modèles fondationnels]] structurent l'industrie.\n"
                "- Le risque [[biais algorithmique]] est sous-estimé.\n"
            ),
            tags="éthique, IA, alignment",
        )
    )
    rows.append(
        Summary(
            user_id=kt_user.id,
            video_id="vid_002",
            video_title="Machine Learning expliqué simplement",
            video_channel="DataLab",
            platform="youtube",
            lang="fr",
            category="ai",
            summary_content=(
                "## Résumé\nVue d'ensemble du ML.\n\n"
                "Les concepts comme [[gradient descent]] et [[overfitting]] sont expliqués.\n"
            ),
            tags="ML, basics",
        )
    )
    rows.append(
        Summary(
            user_id=kt_user.id,
            video_id="vid_003",
            video_title="Introduction aux LLM",
            video_channel="LLM Lab",
            platform="tiktok",
            lang="fr",
            category="ai",
            summary_content="Pas de concepts taggés ici.",
            tags="LLM, transformer, attention",
        )
    )
    for row in rows:
        async_db_session.add(row)
    await async_db_session.commit()
    for row in rows:
        await async_db_session.refresh(row)
    return rows


@pytest.mark.asyncio
async def test_get_user_history_returns_recent_summaries(
    async_db_session: AsyncSession, kt_user: User, kt_summaries: list[Summary]
):
    items = await get_user_history(user=kt_user, db=async_db_session, limit=10)
    assert len(items) == 3
    for item in items:
        assert {
            "id",
            "title",
            "video_id",
            "platform",
            "channel",
            "category",
            "created_at",
            "key_topics",
            "key_concepts",
        }.issubset(item.keys())
    titles = {item["title"] for item in items}
    assert "L'éthique de l'IA générative" in titles
    assert "Introduction aux LLM" in titles
    # First summary has Obsidian-style concepts → should appear in key_concepts.
    eth = next(item for item in items if item["video_id"] == "vid_001")
    assert "alignment" in eth["key_concepts"]
    # And its markdown headings should surface as key_topics.
    topics_lower = [t.lower() for t in eth["key_topics"]]
    assert "résumé" in topics_lower or "resume" in topics_lower
    assert any("points clés" in t or "points cles" in t for t in topics_lower)


@pytest.mark.asyncio
async def test_get_user_history_respects_limit(
    async_db_session: AsyncSession, kt_user: User, kt_summaries: list[Summary]
):
    items = await get_user_history(user=kt_user, db=async_db_session, limit=2)
    assert len(items) == 2


@pytest.mark.asyncio
async def test_get_user_history_filters_by_user(
    async_db_session: AsyncSession, kt_summaries: list[Summary]
):
    # Other user with no analyses
    other = User(
        username="other_user",
        email="other@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
    )
    async_db_session.add(other)
    await async_db_session.commit()
    await async_db_session.refresh(other)

    items = await get_user_history(user=other, db=async_db_session, limit=10)
    assert items == []


# ─────────────────────────────────────────────────────────────────────
# Tool: get_concept_keys
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_concept_keys_extracts_concepts_first(
    async_db_session: AsyncSession, kt_user: User, kt_summaries: list[Summary]
):
    keys = await get_concept_keys(user=kt_user, db=async_db_session, limit=20)
    terms = [k["term"].lower() for k in keys]
    # [[concept]] markers should win first
    assert "alignment" in terms
    assert "modèles fondationnels" in terms or "modeles fondationnels" in terms
    assert "biais algorithmique" in terms
    # Tags fallback should follow
    assert any(t in terms for t in ["llm", "transformer", "attention", "ml", "basics"])


@pytest.mark.asyncio
async def test_get_concept_keys_dedups(async_db_session: AsyncSession, kt_user: User):
    """Same concept appearing twice returns only one entry."""
    s1 = Summary(
        user_id=kt_user.id,
        video_id="dup_a",
        video_title="A",
        platform="youtube",
        summary_content="[[neuroscience]] et [[neuroscience]] répétés.",
        tags="neuroscience",
    )
    s2 = Summary(
        user_id=kt_user.id,
        video_id="dup_b",
        video_title="B",
        platform="youtube",
        summary_content="[[neuroscience]] encore.",
    )
    async_db_session.add_all([s1, s2])
    await async_db_session.commit()

    keys = await get_concept_keys(user=kt_user, db=async_db_session, limit=20)
    terms_lower = [k["term"].lower() for k in keys]
    assert terms_lower.count("neuroscience") == 1


# ─────────────────────────────────────────────────────────────────────
# Tool: get_summary_detail
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_summary_detail_returns_full_payload(
    async_db_session: AsyncSession, kt_user: User, kt_summaries: list[Summary]
):
    target = kt_summaries[0]  # "L'éthique de l'IA générative"
    detail = await get_summary_detail(user=kt_user, db=async_db_session, summary_id=target.id)
    assert detail["title"] == "L'éthique de l'IA générative"
    assert detail["video_id"] == "vid_001"
    assert detail["platform"] == "youtube"
    assert "alignment" in detail["key_concepts"]
    # Key points parsed from "## Points clés"
    assert any("alignment" in p.lower() for p in detail["key_points"])


@pytest.mark.asyncio
async def test_get_summary_detail_unknown_returns_error(
    async_db_session: AsyncSession, kt_user: User
):
    detail = await get_summary_detail(user=kt_user, db=async_db_session, summary_id=999_999)
    assert detail == {"error": "not_found"}


@pytest.mark.asyncio
async def test_get_summary_detail_invalid_id(async_db_session: AsyncSession, kt_user: User):
    detail = await get_summary_detail(user=kt_user, db=async_db_session, summary_id="abc")  # type: ignore[arg-type]
    assert detail == {"error": "invalid_summary_id"}


@pytest.mark.asyncio
async def test_get_summary_detail_isolated_per_user(
    async_db_session: AsyncSession, kt_user: User, kt_summaries: list[Summary]
):
    """Cannot read another user's summary_id."""
    other = User(
        username="other_kt",
        email="other_kt@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
    )
    async_db_session.add(other)
    await async_db_session.commit()
    await async_db_session.refresh(other)

    detail = await get_summary_detail(user=other, db=async_db_session, summary_id=kt_summaries[0].id)
    assert detail == {"error": "not_found"}


# ─────────────────────────────────────────────────────────────────────
# Tool: search_history (semantic V1 wrapper)
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_history_short_query_returns_empty(kt_user: User):
    items = await search_history(user=kt_user, query="a", top_k=5)
    assert items == []


@pytest.mark.asyncio
async def test_search_history_forwards_to_search_global(kt_user: User):
    """search_history must forward to search.global_search.search_global with
    the right user_id and return a slim shape."""

    class _StubResult:
        def __init__(self, sid: int, score: float, preview: str, video_id: str):
            self.source_type = "summary"
            self.source_id = sid
            self.summary_id = sid
            self.score = score
            self.text_preview = preview
            self.source_metadata = {
                "summary_title": f"Video {sid}",
                "video_id": video_id,
                "channel": "Test Channel",
            }

    async def _fake_search_global(*, user_id: int, query: str, filters):
        assert user_id == kt_user.id
        assert query == "alignment"
        return [
            _StubResult(1, 0.92, "Alignment is central for safety.", "vid_001"),
            _StubResult(2, 0.81, "Some preview.", "vid_002"),
        ]

    with patch("search.global_search.search_global", new=_fake_search_global):
        items = await search_history(user=kt_user, query="alignment", top_k=5)

    assert len(items) == 2
    assert items[0]["summary_id"] == 1
    assert items[0]["video_id"] == "vid_001"
    assert items[0]["score"] == 0.92
    assert "summary_id" in items[0]
    assert "video_title" in items[0]


@pytest.mark.asyncio
async def test_search_history_handles_search_failure(kt_user: User):
    async def _boom(*, user_id: int, query: str, filters):  # noqa: ARG001
        raise RuntimeError("embedding service down")

    with patch("search.global_search.search_global", new=_boom):
        items = await search_history(user=kt_user, query="something", top_k=5)
    assert items == []


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────


def test_extract_key_points_from_markdown():
    content = (
        "## Résumé\nblah\n\n"
        "## Points clés\n"
        "- Premier point\n"
        "- Deuxième point\n"
        "- Troisième point\n\n"
        "## Conclusion\nfin\n"
    )
    points = _extract_key_points(content)
    assert points == ["Premier point", "Deuxième point", "Troisième point"]


def test_extract_key_points_empty_when_no_section():
    assert _extract_key_points("Pas de section ici") == []


def test_summary_concept_keys_priority():
    """[[concept]] markers in summary_content take priority over tags."""
    s = Summary(
        user_id=1,
        video_id="x",
        video_title="t",
        platform="youtube",
        summary_content="Hello [[reinforcement learning]] et [[transformer]].",
        tags="ml, optimization",
    )
    keys = _summary_concept_keys(s, limit=5)
    assert keys[0] == "reinforcement learning"
    assert "transformer" in keys
    # Tags only fill remaining slots
    assert "ml" in keys or "optimization" in keys


def test_summary_concept_keys_falls_back_to_tags():
    s = Summary(
        user_id=1,
        video_id="x",
        video_title="t",
        platform="youtube",
        summary_content="No concepts here.",
        tags="alpha, beta, gamma",
    )
    keys = _summary_concept_keys(s, limit=5)
    assert keys == ["alpha", "beta", "gamma"]
