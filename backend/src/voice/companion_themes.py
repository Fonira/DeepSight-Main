"""Extraction top 3 thèmes user pour COMPANION agent."""
from collections import Counter
from typing import Optional, Protocol


class _DBProto(Protocol):
    async def fetch_recent_summaries(self, user_id: int, limit: int): ...


async def extract_top3_themes(
    user_id: int,
    db: _DBProto,
    llm_client: Optional[object] = None,
) -> list[str]:
    """Top 3 centres d'intérêt user via Summary.category fallback ou Mistral small."""
    summaries = await db.fetch_recent_summaries(user_id=user_id, limit=30)
    if not summaries:
        return []

    cats = [s.category for s in summaries if s.category]
    coverage = len(cats) / len(summaries)

    # Fallback no-LLM si couverture catégories >= 70%
    if coverage >= 0.7:
        top = Counter(cats).most_common(3)
        return [c for c, _ in top]

    # LLM path implémenté Task 3
    if llm_client is None:
        return []
    return await _extract_via_llm(summaries, llm_client)


async def _extract_via_llm(summaries, llm_client) -> list[str]:
    raise NotImplementedError("Implemented in Task 3")
