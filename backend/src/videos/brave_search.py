"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🦁 BRAVE SEARCH SERVICE v1.0 — Fact-Checking Complémentaire                      ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE:                                                                             ║
║  • Recherche web via Brave Search API                                              ║
║  • Complémente Perplexity avec des résultats factuels bruts                       ║
║  • Extraction de snippets pertinents pour le fact-checking                        ║
║  • Fonctionne en parallèle avec Perplexity (non-bloquant)                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import hashlib
import logging
import re
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass

from core.cache import cache_service
from core.config import get_brave_key
from core.http_client import shared_http_client

logger = logging.getLogger(__name__)

# ── Cache TTLs (cost optimisation) ───────────────────────────────────────────
# Fact-check : 72h — sujets d'actualité, on évite de servir trop ancien.
# Deep research : 30j — recherche externe peu volatile, gros gain de cache.
_FACTCHECK_CACHE_TTL = 72 * 3600
_DEEP_RESEARCH_CACHE_TTL = 30 * 86400
_CACHE_VERSION = "v1"  # Bump pour invalider tout le cache d'un coup si besoin


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class BraveSearchResult:
    """Résultat d'une recherche Brave"""

    success: bool
    snippets: str  # Texte consolidé des résultats
    sources: List[Dict[str, str]]  # [{title, url, snippet}]
    query: str
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 CACHE HELPERS (cost optimisation)
# ═══════════════════════════════════════════════════════════════════════════════


def _content_digest(video_title: str, video_channel: str, transcript: str) -> str:
    """Hash stable du contenu vidéo (fallback si video_id absent)."""
    payload = f"{video_title}|{video_channel}|{transcript[:1500]}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def _factcheck_cache_key(
    video_id: Optional[str], video_title: str, video_channel: str, transcript: str, lang: str
) -> str:
    identity = f"id:{video_id}" if video_id else f"h:{_content_digest(video_title, video_channel, transcript)}"
    return f"brave:factcheck:{_CACHE_VERSION}:{lang}:{identity}"


def _deep_research_cache_key(
    video_id: Optional[str], video_title: str, video_channel: str, transcript: str, lang: str
) -> str:
    identity = f"id:{video_id}" if video_id else f"h:{_content_digest(video_title, video_channel, transcript)}"
    return f"brave:deepresearch:{_CACHE_VERSION}:{lang}:{identity}"


async def _increment_brave_request_counter() -> None:
    """Compteur quotidien d'appels HTTP réels à Brave Search (best-effort, jamais bloquant).

    Permet de mesurer l'impact des optimisations cache sur la facture Brave
    sans avoir à attendre la facture mensuelle. Lecture via admin/stats.
    """
    try:
        from datetime import datetime, timezone

        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key = f"brave:requests:daily:{date}"
        current = await cache_service.get(key)
        if not isinstance(current, int):
            current = 0
        # 35j de rétention pour avoir un mois glissant + marge
        await cache_service.set(key, current + 1, ttl=35 * 86400)
    except Exception as exc:
        logger.debug("brave counter increment skipped: %s", exc)


def _serialize_factcheck_payload(context_text: Optional[str], sources: List[Dict[str, str]]) -> Dict[str, object]:
    return {"context_text": context_text, "sources": sources}


def _deserialize_factcheck_payload(
    payload: Dict[str, object],
) -> Tuple[Optional[str], List[Dict[str, str]]]:
    context_text = payload.get("context_text") if isinstance(payload, dict) else None
    sources = payload.get("sources") if isinstance(payload, dict) else None
    if not isinstance(sources, list):
        sources = []
    if context_text is not None and not isinstance(context_text, str):
        context_text = None
    return context_text, sources


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 GÉNÉRATION DE REQUÊTES INTELLIGENTES
# ═══════════════════════════════════════════════════════════════════════════════


def generate_factcheck_queries(
    video_title: str, video_channel: str, transcript_excerpt: str, lang: str = "fr"
) -> List[str]:
    """
    Génère 2-3 requêtes de fact-checking intelligentes à partir du contenu vidéo.
    Cible les affirmations vérifiables, pas le résumé général.
    """
    queries = []

    # Query 1: Titre + contexte actuel
    clean_title = re.sub(r"[#\[\](){}|]", "", video_title).strip()
    if clean_title:
        queries.append(f"{clean_title} latest facts 2025 2026")

    # Query 2: Extraire les entités nommées/techniques du transcript
    # Recherche de noms de produits, modèles AI, entreprises, personnes
    tech_patterns = [
        r"\b(GPT[-\s]?\d[\w.]*)",
        r"\b(Claude\s+\d[\w.]*)",
        r"\b(Opus\s+\d[\w.]*)",
        r"\b(Sonnet\s+\d[\w.]*)",
        r"\b(Gemini[\s\w.]*)",
        r"\b(Mistral[\s\w.-]*)",
        r"\b(Llama[\s\w.-]*)",
        r"\b(ChatGPT[\s\w.-]*)",
        r"\b(OpenAI)",
        r"\b(Anthropic)",
        r"\b(Google\s+(?:AI|DeepMind))",
        r"\b(Meta\s+AI)",
        r"\b(Apple\s+Intelligence)",
    ]

    found_entities = set()
    excerpt_lower = transcript_excerpt[:2000]
    for pattern in tech_patterns:
        matches = re.findall(pattern, excerpt_lower, re.IGNORECASE)
        found_entities.update(m.strip() for m in matches if len(m.strip()) > 2)

    if found_entities:
        # Prendre les 3 entités les plus pertinentes
        entities_str = " ".join(list(found_entities)[:3])
        queries.append(f"{entities_str} latest news update 2025 2026")

    # Query 3: Channel + sujet (pour contexte créateur)
    if video_channel and len(queries) < 3:
        queries.append(f'"{video_channel}" {clean_title[:50]}')

    return queries[:3]  # Max 3 queries


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 APPEL API BRAVE SEARCH
# ═══════════════════════════════════════════════════════════════════════════════


async def _call_brave_api(query: str, count: int = 5) -> BraveSearchResult:
    """
    Appelle l'API Brave Search et retourne les résultats structurés.
    """
    api_key = get_brave_key()
    if not api_key:
        return BraveSearchResult(
            success=False, snippets="", sources=[], query=query, error="BRAVE_SEARCH_API_KEY not configured"
        )

    # Brave Search limite la query à ~400 caractères
    if len(query) > 400:
        query = query[:397] + "..."

    # Compteur quotidien — mesure l'impact des optimisations cache
    await _increment_brave_request_counter()

    try:
        async with shared_http_client() as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={
                    "q": query,
                    "count": count,
                    "freshness": "py",  # Past year — résultats récents
                    "text_decorations": False,
                    "safesearch": "off",
                },
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": api_key,
                },
                timeout=15,
            )

            if response.status_code != 200:
                return BraveSearchResult(
                    success=False,
                    snippets="",
                    sources=[],
                    query=query,
                    error=f"Brave API {response.status_code}: {response.text[:200]}",
                )

            data = response.json()
            web_results = data.get("web", {}).get("results", [])

            if not web_results:
                return BraveSearchResult(success=False, snippets="", sources=[], query=query, error="No results")

            # Extraire snippets et sources
            sources = []
            snippet_parts = []

            for r in web_results[:count]:
                title = r.get("title", "")
                url = r.get("url", "")
                desc = r.get("description", "")
                age = r.get("age", "")

                sources.append(
                    {
                        "title": title,
                        "url": url,
                        "snippet": desc,
                        "age": age,
                    }
                )

                age_str = f" ({age})" if age else ""
                snippet_parts.append(f"• [{title}]{age_str}: {desc}")

            snippets_text = "\n".join(snippet_parts)

            return BraveSearchResult(
                success=True,
                snippets=snippets_text,
                sources=sources,
                query=query,
            )

    except Exception as e:
        return BraveSearchResult(success=False, snippets="", sources=[], query=query, error=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE: FACT-CHECK VIA BRAVE
# ═══════════════════════════════════════════════════════════════════════════════


async def get_brave_factcheck_context(
    video_title: str,
    video_channel: str,
    transcript: str,
    lang: str = "fr",
    video_id: Optional[str] = None,
) -> Tuple[Optional[str], List[Dict[str, str]]]:
    """
    Exécute 2-3 recherches Brave pour fact-checker le contenu vidéo.

    Returns:
        Tuple[context_text, all_sources]
        - context_text: Texte formaté des résultats Brave (ou None)
        - all_sources: Liste consolidée des sources [{title, url, snippet}]
    """
    api_key = get_brave_key()
    if not api_key:
        print("⏭️ [BRAVE] Skipped — no API key", flush=True)
        return None, []

    # ── Cache lookup (TTL 72h) ───────────────────────────────────────────────
    cache_key = _factcheck_cache_key(video_id, video_title, video_channel, transcript, lang)
    try:
        cached = await cache_service.get(cache_key)
    except Exception as exc:
        logger.warning("brave factcheck cache GET error: %s", exc)
        cached = None
    if cached is not None:
        ctx, src = _deserialize_factcheck_payload(cached)
        if ctx is not None:
            print(f"💾 [BRAVE] Fact-check cache HIT ({len(src)} sources) — saved 2-3 API calls", flush=True)
            return ctx, src

    # Générer les requêtes intelligentes
    queries = generate_factcheck_queries(
        video_title=video_title,
        video_channel=video_channel,
        transcript_excerpt=transcript[:2000],
        lang=lang,
    )

    if not queries:
        return None, []

    print(f"🦁 [BRAVE] Running {len(queries)} fact-check queries...", flush=True)

    # Exécuter les recherches en parallèle (asyncio.gather)
    import asyncio

    results: List[BraveSearchResult] = await asyncio.gather(
        *[_call_brave_api(q, count=5) for q in queries],
        return_exceptions=True,
    )

    # Consolider les résultats
    all_sources = []
    context_parts = []
    seen_urls = set()

    for r in results:
        if isinstance(r, Exception):
            print(f"⚠️ [BRAVE] Query error: {r}", flush=True)
            continue
        if not r.success:
            print(f"⚠️ [BRAVE] Query '{r.query[:50]}' failed: {r.error}", flush=True)
            continue

        context_parts.append(f'🔎 Recherche: "{r.query}"\n{r.snippets}')

        for src in r.sources:
            if src["url"] not in seen_urls:
                seen_urls.add(src["url"])
                all_sources.append(src)

    if not context_parts:
        print("⚠️ [BRAVE] No usable results from any query", flush=True)
        return None, []

    # Formater le contexte final
    context_text = (
        "═══ 🦁 BRAVE SEARCH FACT-CHECK ═══\n"
        "Les résultats ci-dessous proviennent de recherches web indépendantes.\n"
        "Utilise-les pour VÉRIFIER et CORRIGER les affirmations de la vidéo.\n"
        "Si un fait de la vidéo contredit ces sources, SIGNALE-LE clairement.\n\n"
        + "\n\n".join(context_parts)
        + f"\n\n📚 {len(all_sources)} sources indépendantes consultées."
    )

    success_count = sum(1 for r in results if isinstance(r, BraveSearchResult) and r.success)
    print(f"✅ [BRAVE] {success_count}/{len(queries)} queries OK — {len(all_sources)} unique sources", flush=True)

    # ── Cache store (TTL 72h, succès uniquement) ─────────────────────────────
    if success_count > 0:
        try:
            await cache_service.set(
                cache_key,
                _serialize_factcheck_payload(context_text, all_sources),
                ttl=_FACTCHECK_CACHE_TTL,
            )
        except Exception as exc:
            logger.warning("brave factcheck cache SET error: %s", exc)

    return context_text, all_sources


# ═══════════════════════════════════════════════════════════════════════════════
# 🔬 DEEP RESEARCH: Recherche massive (5 queries × 8 résultats)
# ═══════════════════════════════════════════════════════════════════════════════


def generate_deep_research_queries(
    video_title: str, video_channel: str, transcript_excerpt: str, lang: str = "fr"
) -> "List[str]":
    queries = []
    clean_title = re.sub(r"[#\[\](){}|]", "", video_title).strip()

    # 1. Faits et vérification
    queries.append(f"{clean_title} fact check verification 2025 2026")

    # 2. Entités nommées
    tech_patterns = [
        r"\b(GPT[-\s]?\d[\w.]*)",
        r"\b(Claude\s+\d[\w.]*)",
        r"\b(Gemini[\s\w.]*)",
        r"\b(Mistral[\s\w.-]*)",
        r"\b(OpenAI)",
        r"\b(Anthropic)",
        r"\b(Google\s+(?:AI|DeepMind))",
        r"\b(Meta\s+AI)",
        r"\b(Tesla)",
        r"\b(SpaceX)",
    ]
    found_entities = set()
    for pattern in tech_patterns:
        matches = re.findall(pattern, transcript_excerpt[:3000], re.IGNORECASE)
        found_entities.update(m.strip() for m in matches if len(m.strip()) > 2)
    if found_entities:
        entities_str = " ".join(list(found_entities)[:4])
        queries.append(f"{entities_str} latest news 2025 2026")
    else:
        queries.append(f'"{video_channel}" {clean_title[:40]} analysis')

    # 3. Critiques et contre-arguments
    queries.append(f"{clean_title} criticism debate controversy")

    # 4. Contexte historique
    queries.append(f"{clean_title} background context explained")

    # 5. Actualités récentes
    queries.append(f"{clean_title} latest update news today")

    return queries[:5]


async def get_brave_deep_research_context(
    video_title: str,
    video_channel: str,
    transcript: str,
    lang: str = "fr",
    video_id: Optional[str] = None,
) -> "Tuple[Optional[str], List[Dict[str, str]]]":
    """🔬 Deep Research: 5 requêtes × 8 résultats = ~40 sources."""
    api_key = get_brave_key()
    if not api_key:
        print("⏭️ [BRAVE DEEP] Skipped — no API key", flush=True)
        return None, []

    # ── Cache lookup (TTL 30j) ───────────────────────────────────────────────
    cache_key = _deep_research_cache_key(video_id, video_title, video_channel, transcript, lang)
    try:
        cached = await cache_service.get(cache_key)
    except Exception as exc:
        logger.warning("brave deep research cache GET error: %s", exc)
        cached = None
    if cached is not None:
        ctx, src = _deserialize_factcheck_payload(cached)
        if ctx is not None:
            print(f"💾 [BRAVE DEEP] Cache HIT ({len(src)} sources) — saved ~40 API calls", flush=True)
            return ctx, src

    queries = generate_deep_research_queries(
        video_title=video_title,
        video_channel=video_channel,
        transcript_excerpt=transcript[:3000],
        lang=lang,
    )

    if not queries:
        return None, []

    print(f"🦁🔬 [BRAVE DEEP] Running {len(queries)} deep research queries (8 results each)...", flush=True)

    import asyncio

    results: "List[BraveSearchResult]" = await asyncio.gather(
        *[_call_brave_api(q, count=8) for q in queries],
        return_exceptions=True,
    )

    all_sources = []
    context_parts = []
    seen_urls = set()
    categories = ["🔍 Vérification", "👤 Entités", "⚖️ Critiques", "📖 Contexte", "📰 Actualités"]

    for i, r in enumerate(results):
        cat = categories[i] if i < len(categories) else f"🔎 Recherche {i + 1}"
        if isinstance(r, Exception):
            print(f"⚠️ [BRAVE DEEP] Query {i + 1} error: {r}", flush=True)
            continue
        if not r.success:
            print(f"⚠️ [BRAVE DEEP] Query failed: {r.error}", flush=True)
            continue

        context_parts.append(f'{cat}: "{r.query}"\n{r.snippets}')

        for src in r.sources:
            if src["url"] not in seen_urls:
                seen_urls.add(src["url"])
                src["category"] = cat
                all_sources.append(src)

    if not context_parts:
        print("⚠️ [BRAVE DEEP] No usable results", flush=True)
        return None, []

    context_text = (
        "═══ 🦁🔬 BRAVE DEEP RESEARCH ═══\n"
        + f"{len(all_sources)} sources collectées via {len(queries)} requêtes.\n\n"
        + "\n\n".join(context_parts)
    )

    success_count = sum(1 for r in results if isinstance(r, BraveSearchResult) and r.success)
    print(f"✅ [BRAVE DEEP] {success_count}/{len(queries)} queries OK — {len(all_sources)} unique sources", flush=True)

    # ── Cache store (TTL 30j, succès uniquement) ─────────────────────────────
    if success_count > 0:
        try:
            await cache_service.set(
                cache_key,
                _serialize_factcheck_payload(context_text, all_sources),
                ttl=_DEEP_RESEARCH_CACHE_TTL,
            )
        except Exception as exc:
            logger.warning("brave deep research cache SET error: %s", exc)

    return context_text, all_sources
