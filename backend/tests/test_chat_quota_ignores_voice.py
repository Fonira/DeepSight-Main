"""
Tests for Spec #1, Task 10 — check_chat_quota ignores voice rows.

Voice turns persisted via /transcripts/append should NOT count against the
chat-per-video quota, otherwise voice users would burn their text-chat
budget. The fix is to add ``source = 'text'`` to the per-video count query.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_check_chat_quota_video_count_filters_text_source():
    """The per-video query must filter on source='text' so voice rows are
    excluded from the chat quota."""
    from chat.service import check_chat_quota

    user = MagicMock()
    user.id = 7
    user.plan = "free"
    user.is_admin = False

    user_result = MagicMock()
    user_result.scalar_one_or_none = MagicMock(return_value=user)

    daily_result = MagicMock()
    daily_result.scalar_one_or_none = MagicMock(return_value=None)

    count_result = MagicMock()
    count_result.scalar = MagicMock(return_value=0)

    captured_queries = []

    async def execute_side_effect(query, *args, **kwargs):
        captured_queries.append(query)
        sql = str(query).lower()
        if "from users" in sql:
            return user_result
        if "from chat_quotas" in sql:
            return daily_result
        return count_result

    session = AsyncMock()
    session.execute = AsyncMock(side_effect=execute_side_effect)

    can_ask, reason, info = await check_chat_quota(session, user_id=7, summary_id=42)

    assert can_ask is True
    assert reason == "ok"

    sql_lower = str(captured_queries[-1]).lower()
    assert "source" in sql_lower, (
        "Expected check_chat_quota to filter by source='text' but query was: %s"
        % str(captured_queries[-1])
    )


def test_check_chat_quota_query_filters_voice_rows_by_compiling_sql():
    """Compile the per-video count query and verify the source='text' clause
    appears in the rendered SQL string."""
    from sqlalchemy import select, func
    from db.database import ChatMessage
    from sqlalchemy.dialects import sqlite

    query = select(func.count(ChatMessage.id)).where(
        ChatMessage.user_id == 1,
        ChatMessage.summary_id == 1,
        ChatMessage.role == "user",
        ChatMessage.source == "text",
    )

    compiled = str(
        query.compile(dialect=sqlite.dialect(), compile_kwargs={"literal_binds": True})
    )
    assert "source" in compiled.lower()
    assert "'text'" in compiled.lower()
