"""Extraction top 3 thèmes user pour COMPANION agent."""
import logging
from collections import Counter
from typing import Optional, Protocol

logger = logging.getLogger(__name__)

THEMES_PROMPT_TEMPLATE = """Voici les {count} derniers titres de vidéos analysées par cet utilisateur :

{titles}

Identifie ses 3 centres d'intérêt principaux. Réponds UNIQUEMENT en JSON valide :
{{"themes": ["theme1", "theme2", "theme3"]}}

Les thèmes doivent être courts (1-3 mots), en français, sans articles."""


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
    titles = "\n".join(f"- {s.title}" for s in summaries[:30])
    prompt = THEMES_PROMPT_TEMPLATE.format(count=len(summaries), titles=titles)
    try:
        result = await llm_client.complete_json(prompt=prompt, model="mistral-small-2603")
        themes = result.get("themes", [])
        return themes[:3] if isinstance(themes, list) else []
    except (ValueError, KeyError, Exception) as exc:
        logger.warning("companion_themes LLM failed: %s", exc)
        return []
