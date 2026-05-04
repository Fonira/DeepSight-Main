"""
Deep Research dispatcher — Phase 2 cost optimisation.

Dispatch entre Mistral Agent (1 appel API natif avec web_search) et le pipeline
Brave Search historique (5 queries × 8 résultats = ~40 appels Brave par analyse).

Comportement :
- Si DEEP_RESEARCH_USE_MISTRAL_AGENT=true ET Agent disponible → Agent en premier
- Échec Agent (circuit breaker, timeout, erreur) → fallback Brave automatique
- Si flag off (défaut) → Brave direct, comportement historique inchangé

Garantit zéro régression : flag off par défaut, fallback Brave systématique.
"""

import logging
from typing import Dict, List, Optional, Tuple

from core.config import DEEP_RESEARCH_USE_MISTRAL_AGENT, MISTRAL_AGENT_MODEL
from core.mistral_agent import agent_web_search
from videos.brave_search import get_brave_deep_research_context

logger = logging.getLogger(__name__)


def _format_agent_result_as_context(
    content: str, sources: List[Dict[str, str]]
) -> str:
    """Formate la réponse Agent dans le même style que Brave Deep Research.

    Le prompt downstream attend un préfixe explicite et les sources listées,
    on conserve la même structure pour ne pas changer le comportement aval.
    """
    return (
        "═══ 🤖🔬 MISTRAL AGENT DEEP RESEARCH ═══\n"
        f"{len(sources)} sources collectées via recherche web Mistral.\n\n"
        + content
    )


async def dispatch_deep_research_context(
    video_title: str,
    video_channel: str,
    transcript: str,
    lang: str = "fr",
    video_id: Optional[str] = None,
) -> Tuple[Optional[str], List[Dict[str, str]]]:
    """Dispatcher deep research : Mistral Agent en primary (si flag), Brave en fallback.

    Args:
        video_title, video_channel, transcript, lang : contexte vidéo
        video_id : utilisé pour la clé de cache Brave (Phase 1)

    Returns:
        Tuple (context_text, sources). (None, []) si tout échoue.
    """
    # Path A : Mistral Agent en premier si flag activé
    if DEEP_RESEARCH_USE_MISTRAL_AGENT:
        try:
            query = f"Recherche approfondie sur : {video_title}"
            context = (
                f"Vidéo : « {video_title} » par {video_channel}.\n\n"
                f"Extrait du transcript (3000 premiers caractères) :\n{transcript[:3000]}\n\n"
                "Effectue une recherche web exhaustive : vérification des faits, entités "
                "mentionnées, critiques et controverses, contexte, actualités récentes. "
                "Cite tes sources."
            )
            agent_result = await agent_web_search(
                query=query,
                context=context,
                purpose="deep_research",
                lang=lang,
                model=MISTRAL_AGENT_MODEL,
                timeout=60.0,
            )
            if agent_result and agent_result.success and agent_result.content:
                logger.info(
                    "[DEEP RESEARCH] Mistral Agent OK: %d chars, %d sources, %dms",
                    len(agent_result.content),
                    len(agent_result.sources),
                    agent_result.latency_ms,
                )
                return (
                    _format_agent_result_as_context(agent_result.content, agent_result.sources),
                    agent_result.sources,
                )
            logger.warning("[DEEP RESEARCH] Mistral Agent unavailable, falling back to Brave")
        except Exception as exc:
            logger.warning("[DEEP RESEARCH] Mistral Agent error: %s — falling back to Brave", exc)

    # Path B : Brave Deep Research (default + fallback)
    return await get_brave_deep_research_context(
        video_title=video_title,
        video_channel=video_channel,
        transcript=transcript,
        lang=lang,
        video_id=video_id,
    )
