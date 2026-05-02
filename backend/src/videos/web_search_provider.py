"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 WEB SEARCH PROVIDER v2.0 — Mistral Agent (primary) + Brave fallback          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE:                                                                             ║
║  • PRIMARY: Mistral Agent avec web_search natif (1 appel API)                     ║
║  • FALLBACK: Brave Search API + Mistral synthesis (pipeline v1.0)                 ║
║  • Interface WebSearchResult inchangée — aucun impact sur les appelants           ║
║  • Formats supportés: enrichment, fact_check, chat, debate, deep_research         ║
║  • Gestion d'erreurs robuste avec fallback automatique                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import json
from typing import Optional, List, Dict, Literal
from dataclasses import dataclass, field
import logging

from core.config import get_mistral_key, get_brave_key, is_mistral_agent_available
from core.config import MISTRAL_AGENT_PRIMARY
from core.llm_provider import llm_complete
from videos.brave_search import _call_brave_api
from videos.perplexity_provider import perplexity_search, is_perplexity_provider_available

# Optional analytics — track which provider served the result so we can monitor
# the Perplexity fallback rate when MISTRAL_AGENT_PRIMARY is flipped on.
try:
    from core.analytics import track_event  # type: ignore
except Exception:  # pragma: no cover — analytics is best-effort
    def track_event(event_name: str, properties: Optional[Dict] = None) -> None:  # type: ignore
        return None

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class WebSearchResult:
    """Résultat d'une synthèse web search + Mistral"""

    success: bool
    content: str  # Texte synthétisé
    sources: List[Dict[str, str]] = field(default_factory=list)  # [{title, url, snippet}]
    tokens_used: int = 0
    error: Optional[str] = None
    raw_brave_results: Optional[str] = None  # Debug: résultats bruts Brave
    provider: str = "brave"  # "agent" or "brave" — which pipeline served the result


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════


def is_web_search_available() -> bool:
    """Vérifie que au moins un pipeline web search est disponible."""
    # Agent Mistral OU Perplexity OU Brave+Mistral
    return (
        is_mistral_agent_available()
        or is_perplexity_provider_available()
        or (bool(get_brave_key()) and bool(get_mistral_key()))
    )


ENRICHMENT_AVAILABLE = is_web_search_available()


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 PRIMARY: MISTRAL AGENT WEB SEARCH
# ═══════════════════════════════════════════════════════════════════════════════


async def _try_agent_search(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    timeout: float = 30.0,
) -> Optional[WebSearchResult]:
    """
    Try web search via Mistral Agent (single API call).
    Returns WebSearchResult on success, None on failure (caller should fall back).
    """
    if not is_mistral_agent_available():
        return None

    try:
        from core.mistral_agent import agent_web_search

        result = await agent_web_search(
            query=query,
            context=context,
            purpose=purpose,
            lang=lang,
            timeout=timeout,
        )

        if result and result.success and result.content:
            logger.info(
                f"[WEB_SEARCH] Agent OK: {len(result.content)} chars, "
                f"{len(result.sources)} sources, {result.tokens_used} tokens, "
                f"{result.latency_ms}ms"
            )
            return WebSearchResult(
                success=True,
                content=result.content,
                sources=result.sources,
                tokens_used=result.tokens_used,
                provider="agent",
            )

        # Agent returned but with empty/failed result
        logger.warning(f"[WEB_SEARCH] Agent returned no result: {result.error if result else 'None'}")
        return None

    except Exception as e:
        logger.warning(f"[WEB_SEARCH] Agent exception (will fallback): {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 FALLBACK: CONSTRUCTION DES PROMPTS MISTRAL PAR PURPOSE
# ═══════════════════════════════════════════════════════════════════════════════


def _build_synthesis_prompt(
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    query: str,
    context: str,
    brave_results: List[Dict[str, str]],
    lang: str = "fr",
) -> str:
    """
    Génère un prompt système-adapté pour Mistral selon le purpose.
    Utilisé uniquement par le fallback Brave+Mistral.
    """

    # Formater les résultats Brave en texte lisible
    results_text = ""
    for i, r in enumerate(brave_results, 1):
        title = r.get("title", "")
        url = r.get("url", "")
        snippet = r.get("snippet", "")
        results_text += f"\n[Source {i}] {title}\nURL: {url}\n{snippet}\n"

    if not results_text:
        results_text = "\n(Aucun résultat Brave disponible)"

    lang.lower().startswith("fr")

    if purpose == "enrichment":
        system_prompt = (
            "Tu es un expert en synthèse d'informations web pour enrichir des analyses vidéo. "
            "Synthétise les résultats web ci-dessous pour compléter l'analyse vidéo avec des faits récents, "
            "des contextes actuels, et des perspectives externes.\n\n"
            "IMPORTANT: Cite toujours tes sources avec [Source 1], [Source 2], etc. "
            "Format: '...selon [Source 1]...' ou '[Source 2] rapporte que...'"
        )
        user_prompt = (
            f"Sujet vidéo: {context}\n\n"
            f"Requête enrichissement: {query}\n\n"
            f"Résultats web:\n{results_text}\n\n"
            f"Synthétise ces résultats en 150-250 mots pour enrichir l'analyse vidéo. "
            f"Cite les sources avec [Source 1], [Source 2], etc."
        )

    elif purpose == "fact_check":
        system_prompt = (
            "Tu es un fact-checker expert. Vérifie les affirmations contre les sources web ci-dessous. "
            "Détermine si les affirmations sont: VRAIES, PARTIELLEMENT VRAIES, FAUSSES, ou NON VÉRIFIABLES.\n\n"
            "IMPORTANT: Cite TOUJOURS tes sources avec [Source 1], [Source 2], etc. "
            "Soit précis et nuancé."
        )
        user_prompt = (
            f"Affirmations à vérifier:\n{context}\n\n"
            f"Résultats web:\n{results_text}\n\n"
            f"Analyse chaque affirmation. Format:\n"
            f"1. [AFFIRMATION]: [VERDICT (VRAIE/PARTIELLE/FAUSSE/NON-VÉRIFIABLE)]\n"
            f"   [Justification avec [Source X] citations]\n\n"
            f"Sois concis et cité toutes sources."
        )

    elif purpose == "chat":
        system_prompt = (
            "Tu es un assistant conversationnel avec accès à des résultats web récents. "
            "Réponds à la question de manière claire, nuancée, et bien sourcée.\n\n"
            "IMPORTANT: Cite TOUJOURS tes sources avec [Source 1], [Source 2], etc. "
            "Si une information vient du web, cite la source."
        )
        user_prompt = (
            f"Question: {query}\n\n"
            f"Contexte supplémentaire: {context}\n\n"
            f"Résultats web récents:\n{results_text}\n\n"
            f"Réponds à la question. Cite tes sources web avec [Source 1], [Source 2], etc."
        )

    elif purpose == "debate":
        system_prompt = (
            "Tu es un expert en analyse de débats. Compare les arguments présentés contre les faits web. "
            "Identifie ce qui est sourcé/non-sourcé, ce qui est exact/inexact.\n\n"
            "IMPORTANT: Cite TOUJOURS tes sources avec [Source 1], [Source 2], etc. "
            "Sois équitable envers tous les arguments."
        )
        user_prompt = (
            f"Arguments du débat:\n{context}\n\n"
            f"Résultats web (fact-checking):\n{results_text}\n\n"
            f"Analyse chaque argument. Cite les sources [Source 1], etc. "
            f"Souligne quels arguments sont sourcés par la web et lesquels ne le sont pas."
        )

    elif purpose == "deep_research":
        system_prompt = (
            "Tu es un chercheur académique expert. Analyse les multiples sources web ci-dessous "
            "pour dresser un panorama complet du sujet.\n\n"
            "IMPORTANT: Cite TOUJOURS tes sources avec [Source 1], [Source 2], etc. "
            "Identifie les consensus, désaccords, et perspectives minoritaires."
        )
        user_prompt = (
            f"Sujet de recherche: {query}\n\n"
            f"Contexte: {context}\n\n"
            f"Multiples résultats web:\n{results_text}\n\n"
            f"Synthétise les sources en un panorama complet (200-400 mots). "
            f"Cite toujours [Source 1], [Source 2], etc. "
            f"Identifie consensus et désaccords."
        )

    else:
        system_prompt = "Tu es un assistant utile."
        user_prompt = f"Query: {query}\n\nResults:\n{results_text}"

    return json.dumps({"system": system_prompt, "user": user_prompt}, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# 🦁 FALLBACK: BRAVE SEARCH + MISTRAL SYNTHESIS
# ═══════════════════════════════════════════════════════════════════════════════


async def _call_mistral_api(
    prompt_json: str, model: str = "mistral-small-2603", max_tokens: int = 1500, timeout: float = 30.0
) -> tuple[str, int]:
    """
    Appelle l'API Mistral (via llm_provider avec fallback) pour synthétiser les résultats web.
    Utilisé uniquement par le pipeline Brave fallback.
    """
    try:
        prompt_data = json.loads(prompt_json)
        system_msg = prompt_data.get("system", "")
        user_msg = prompt_data.get("user", "")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid prompt JSON: {e}")

    logger.info(f"[BRAVE-FALLBACK] Calling Mistral {model} (max_tokens={max_tokens})")

    result = await llm_complete(
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        model=model,
        max_tokens=max_tokens,
        temperature=0.3,
        timeout=timeout,
    )

    if result:
        fallback_info = f" [fallback: {result.provider}:{result.model_used}]" if result.fallback_used else ""
        logger.info(
            f"[BRAVE-FALLBACK] Mistral OK: {len(result.content)} chars, {result.tokens_total} tokens{fallback_info}"
        )
        return result.content, result.tokens_total

    raise Exception("All LLM providers exhausted (Mistral + DeepSeek)")


async def _brave_fallback_search(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    max_sources: int = 5,
    max_tokens: int = 1500,
    mistral_model: Optional[str] = None,
    timeout: float = 30.0,
) -> WebSearchResult:
    """
    Original v1.0 pipeline: Brave Search → Mistral synthesis.
    Used as fallback when the Mistral Agent is unavailable.
    """
    logger.info(f"[BRAVE-FALLBACK] Starting: query='{query[:80]}', purpose={purpose}")

    if not (get_brave_key() and get_mistral_key()):
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error="Brave fallback not configured (missing API keys)",
            provider="brave",
        )

    model = mistral_model or "mistral-small-2603"

    # Shorten long queries for Brave
    brave_query = query
    if len(query) > 300:
        lines = query.strip().split("\n")
        short_parts = []
        for line in lines:
            line = line.strip()
            if (
                not line
                or line.startswith("{")
                or line.startswith("⚠")
                or line.startswith("📚")
                or line.startswith("IMPORTANT")
            ):
                continue
            if "JSON" in line or "format exact" in line or "Réponds" in line or "Reply" in line:
                continue
            if line.startswith("- ") and len(line) < 80:
                short_parts.append(line.lstrip("- ").strip())
            elif len(line) > 10 and len(short_parts) == 0:
                short_parts.append(line[:150])
                break
        brave_query = " ".join(short_parts[:10]) if short_parts else query[:300]
        brave_query = brave_query[:400]
        logger.info(f"[BRAVE-FALLBACK] Long query → short Brave query: '{brave_query[:80]}...'")

    try:
        # Step 1: Brave Search
        brave_result = await asyncio.wait_for(_call_brave_api(brave_query, count=max_sources), timeout=timeout * 0.4)

        if not brave_result.success or not brave_result.sources:
            error = brave_result.error if not brave_result.success else "No results"
            logger.warning(f"[BRAVE-FALLBACK] Brave failed: {error}")
            return WebSearchResult(
                success=False,
                content="",
                sources=[],
                error=f"Brave search failed: {error}",
                provider="brave",
            )

        logger.info(f"[BRAVE-FALLBACK] Brave found {len(brave_result.sources)} sources")

        # Step 2: Mistral synthesis
        prompt_json = _build_synthesis_prompt(
            purpose=purpose,
            query=query,
            context=context,
            brave_results=brave_result.sources,
            lang=lang,
        )

        synthesis_content, tokens_used = await asyncio.wait_for(
            _call_mistral_api(prompt_json=prompt_json, model=model, max_tokens=max_tokens, timeout=timeout * 0.4),
            timeout=timeout * 0.4,
        )

        logger.info(f"[BRAVE-FALLBACK] Success: {len(synthesis_content)} chars, {len(brave_result.sources)} sources")

        return WebSearchResult(
            success=True,
            content=synthesis_content,
            sources=brave_result.sources,
            tokens_used=tokens_used,
            raw_brave_results=brave_result.snippets,
            provider="brave",
        )

    except asyncio.TimeoutError:
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error=f"Brave fallback timeout after {timeout}s",
            provider="brave",
        )
    except Exception as e:
        logger.error(f"[BRAVE-FALLBACK] Exception: {e}")
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error=str(e),
            provider="brave",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 FONCTION PRINCIPALE: WEB SEARCH + SYNTHESIS (Agent → Brave fallback)
# ═══════════════════════════════════════════════════════════════════════════════


async def _try_perplexity_search(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    max_tokens: int = 1500,
    timeout: float = 30.0,
) -> Optional[WebSearchResult]:
    """
    Try Perplexity sonar-pro. Returns WebSearchResult on success, None otherwise.

    Wrapper around `perplexity_search` that swallows exceptions so the chain in
    `web_search_and_synthesize` can fall through cleanly.
    """
    if not is_perplexity_provider_available():
        return None

    try:
        result = await perplexity_search(
            query=query,
            context=context,
            purpose=purpose,
            lang=lang,
            max_tokens=max_tokens,
            timeout=min(timeout * 0.5, 15.0),
        )
        if result and result.success:
            return result
        return None
    except Exception as e:
        logger.warning(f"[WEB_SEARCH] Perplexity exception (will fallback): {e}")
        return None


async def web_search_and_synthesize(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    max_sources: int = 5,
    max_tokens: int = 1500,
    mistral_model: Optional[str] = None,
    timeout: float = 30.0,
    plan: Optional[str] = None,
) -> WebSearchResult:
    """
    Exécute une recherche web + synthèse IA.

    Pipeline (chaîne de fallback) — l'ordre des deux premiers providers est
    contrôlé par le flag `MISTRAL_AGENT_PRIMARY` (Phase 5 Mistral-First) :

      flag=False (défaut) → [perplexity, mistral_agent, brave]
      flag=True           → [mistral_agent, perplexity, brave]

    Brave Search reste TOUJOURS en last-resort. L'interface est inchangée —
    les appelants n'ont pas à modifier leur code. Le champ `provider` indique
    quel pipeline a servi le résultat ("agent", "perplexity" ou "brave").

    Args:
        plan: Optionnel. Plan utilisateur (free/pro/expert) pour la métrique
            PostHog `web_search_provider_used`. Non bloquant.
    """

    logger.info(
        f"[WEB_SEARCH] Starting: query='{query[:80]}', purpose={purpose}, lang={lang}, "
        f"flag(MISTRAL_AGENT_PRIMARY)={MISTRAL_AGENT_PRIMARY}"
    )

    # ─── Build provider chain based on the feature flag ─────────────────────
    # Each entry is (label, callable returning Optional[WebSearchResult]).
    async def _agent_call() -> Optional[WebSearchResult]:
        return await _try_agent_search(
            query=query, context=context, purpose=purpose, lang=lang, timeout=timeout
        )

    async def _perplexity_call() -> Optional[WebSearchResult]:
        return await _try_perplexity_search(
            query=query,
            context=context,
            purpose=purpose,
            lang=lang,
            max_tokens=max_tokens,
            timeout=timeout,
        )

    if MISTRAL_AGENT_PRIMARY:
        primary_chain = [("agent", _agent_call), ("perplexity", _perplexity_call)]
    else:
        primary_chain = [("perplexity", _perplexity_call), ("agent", _agent_call)]

    # ─── Try the primary chain ──────────────────────────────────────────────
    for label, runner in primary_chain:
        result = await runner()
        if result and result.success:
            _emit_provider_metric(result.provider or label, plan, purpose)
            return result
        logger.info(f"[WEB_SEARCH] Provider '{label}' unavailable/failed, trying next")

    # ─── Last resort: Brave + Mistral ───────────────────────────────────────
    logger.info("[WEB_SEARCH] Falling back to Brave + Mistral pipeline")

    brave_result = await _brave_fallback_search(
        query=query,
        context=context,
        purpose=purpose,
        lang=lang,
        max_sources=max_sources,
        max_tokens=max_tokens,
        mistral_model=mistral_model,
        timeout=timeout,
    )
    if brave_result and brave_result.success:
        _emit_provider_metric(brave_result.provider or "brave", plan, purpose)
    return brave_result


def _emit_provider_metric(
    provider: str, plan: Optional[str], purpose: str
) -> None:
    """Best-effort PostHog tracking of the provider that served a query."""
    try:
        track_event(
            "web_search_provider_used",
            {
                "provider": provider,
                "plan": plan or "unknown",
                "purpose": purpose,
                "flag_mistral_agent_primary": bool(MISTRAL_AGENT_PRIMARY),
            },
        )
    except Exception as e:  # pragma: no cover — metric must never block
        logger.debug(f"[WEB_SEARCH] track_event failed silently: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 RECHERCHES MULTIPLES (BATCH) — Agent pour chaque query, Brave fallback
# ═══════════════════════════════════════════════════════════════════════════════


async def web_search_batch(
    queries: List[str],
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    max_sources_per_query: int = 3,
    mistral_model: Optional[str] = None,
) -> WebSearchResult:
    """
    Exécute N requêtes en parallèle, puis consolide en un seul résultat.
    Utilisé pour la recherche approfondie (deep_research).

    Essaie d'abord l'Agent Mistral pour chaque query individuellement.
    En cas d'échec, tombe sur le pipeline Brave batch.
    """

    logger.info(f"[WEB_SEARCH_BATCH] Starting: {len(queries)} queries, purpose={purpose}")

    if not ENRICHMENT_AVAILABLE:
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error="Web search not configured",
        )

    # --- Try Agent for each query in parallel ---
    if is_mistral_agent_available():
        try:
            from core.mistral_agent import agent_web_search

            agent_tasks = [
                agent_web_search(query=q, context=context, purpose=purpose, lang=lang, timeout=30.0) for q in queries
            ]
            agent_results = await asyncio.gather(*agent_tasks, return_exceptions=True)

            all_content = []
            all_sources = []
            total_tokens = 0
            seen_urls = set()
            agent_successes = 0

            for i, (q, result) in enumerate(zip(queries, agent_results)):
                if isinstance(result, Exception):
                    logger.warning(f"[WEB_SEARCH_BATCH] Agent query {i + 1} exception: {result}")
                    continue
                if not result or not result.success:
                    continue

                agent_successes += 1
                all_content.append(f"### {q}\n{result.content}")
                total_tokens += result.tokens_used

                for src in result.sources:
                    url = src.get("url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        all_sources.append(src)

            # If we got at least half the queries, return Agent results
            if agent_successes >= len(queries) / 2:
                combined = "\n\n".join(all_content)
                logger.info(
                    f"[WEB_SEARCH_BATCH] Agent batch OK: {agent_successes}/{len(queries)} queries, "
                    f"{len(all_sources)} sources"
                )
                return WebSearchResult(
                    success=True,
                    content=combined,
                    sources=all_sources,
                    tokens_used=total_tokens,
                    provider="agent",
                )

            logger.warning(
                f"[WEB_SEARCH_BATCH] Agent only got {agent_successes}/{len(queries)}, falling back to Brave batch"
            )

        except Exception as e:
            logger.warning(f"[WEB_SEARCH_BATCH] Agent batch failed: {e}")

    # --- Fallback: Brave batch pipeline (original v1.0) ---
    logger.info("[WEB_SEARCH_BATCH] Using Brave batch fallback")

    if not (get_brave_key() and get_mistral_key()):
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error="Brave batch fallback not configured",
        )

    model = mistral_model or "mistral-small-2603"

    try:
        brave_results = await asyncio.gather(
            *[_call_brave_api(q, count=max_sources_per_query) for q in queries], return_exceptions=True
        )

        all_sources = []
        consolidated_results_text = ""
        seen_urls = set()

        for i, (query, result) in enumerate(zip(queries, brave_results), 1):
            if isinstance(result, Exception):
                logger.warning(f"[WEB_SEARCH_BATCH] Brave query {i} error: {result}")
                continue
            if not result.success:
                logger.warning(f"[WEB_SEARCH_BATCH] Brave query {i} failed: {result.error}")
                continue

            consolidated_results_text += f'\n🔎 Search {i}: "{query}"\n{result.snippets}\n'
            for src in result.sources:
                if src["url"] not in seen_urls:
                    seen_urls.add(src["url"])
                    src["search_query"] = query
                    all_sources.append(src)

        if not all_sources:
            return WebSearchResult(
                success=False,
                content="",
                sources=[],
                error="All Brave searches failed or returned no results",
                provider="brave",
            )

        logger.info(
            f"[WEB_SEARCH_BATCH] Brave consolidated {len(all_sources)} unique sources from {len(queries)} queries"
        )

        prompt_json = _build_synthesis_prompt(
            purpose=purpose,
            query=" + ".join(queries),
            context=context,
            brave_results=all_sources,
            lang=lang,
        )

        synthesis_content, tokens_used = await _call_mistral_api(
            prompt_json=prompt_json,
            model=model,
            max_tokens=2000,
            timeout=60.0,
        )

        return WebSearchResult(
            success=True,
            content=synthesis_content,
            sources=all_sources,
            tokens_used=tokens_used,
            raw_brave_results=consolidated_results_text,
            provider="brave",
        )

    except Exception as e:
        logger.error(f"[WEB_SEARCH_BATCH] Exception: {e}")
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error=str(e),
            provider="brave",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 EXPORTS PUBLICS
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    "WebSearchResult",
    "web_search_and_synthesize",
    "web_search_batch",
    "is_web_search_available",
    "ENRICHMENT_AVAILABLE",
]
