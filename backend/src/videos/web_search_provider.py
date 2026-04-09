"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 WEB SEARCH PROVIDER v1.0 — Brave Search + Mistral Synthesis                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE:                                                                             ║
║  • Remplace Perplexity par Brave Search (recherche web) + Mistral (synthèse)      ║
║  • Exécute des recherches Brave en parallèle                                       ║
║  • Synthétise les résultats avec Mistral selon le purpose                         ║
║  • Formats supportés: enrichment, fact_check, chat, debate, deep_research         ║
║  • Gestion d'erreurs robuste avec fallbacks                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
import asyncio
import json
from typing import Optional, List, Dict, Literal, Any
from dataclasses import dataclass, field
import logging

from core.config import get_mistral_key, get_brave_key
from core.llm_provider import llm_complete
from videos.brave_search import _call_brave_api, BraveSearchResult

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class WebSearchResult:
    """Résultat d'une synthèse web search + Mistral"""
    success: bool
    content: str                                          # Texte synthétisé par Mistral
    sources: List[Dict[str, str]] = field(default_factory=list)  # [{title, url, snippet}]
    tokens_used: int = 0
    error: Optional[str] = None
    raw_brave_results: Optional[str] = None              # Debug: résultats bruts Brave


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

def is_web_search_available() -> bool:
    """Vérifie que Brave + Mistral sont configurés"""
    return bool(get_brave_key()) and bool(get_mistral_key())


ENRICHMENT_AVAILABLE = is_web_search_available()

# ═══════════════════════════════════════════════════════════════════════════════
# 📝 CONSTRUCTION DES PROMPTS MISTRAL PAR PURPOSE
# ═══════════════════════════════════════════════════════════════════════════════

def _build_synthesis_prompt(
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    query: str,
    context: str,
    brave_results: List[Dict[str, str]],
    lang: str = "fr"
) -> str:
    """
    Génère un prompt système-adapté pour Mistral selon le purpose.
    
    Args:
        purpose: enrichment | fact_check | chat | debate | deep_research
        query: La question utilisateur ou requête initiale
        context: Contexte additionnel (ex: titre vidéo, affirmations à vérifier)
        brave_results: Résultats Brave structurés [{title, url, snippet, ...}]
        lang: Langue (fr/en)
    
    Returns:
        String du prompt formaté
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
    
    is_fr = lang.lower().startswith("fr")
    
    if purpose == "enrichment":
        # Pour enrichir une analyse vidéo avec contexte web récent
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
        # Pour vérifier des affirmations spécifiques
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
        # Pour répondre à une question utilisateur avec sources web
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
        # Pour analyser les arguments d'un débat contre les sources
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
        # Pour une recherche approfondie multi-sources
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
        # Fallback (ne devrait pas arriver ici)
        system_prompt = "Tu es un assistant utile."
        user_prompt = f"Query: {query}\n\nResults:\n{results_text}"
    
    return json.dumps({
        "system": system_prompt,
        "user": user_prompt
    }, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 APPEL API MISTRAL
# ═══════════════════════════════════════════════════════════════════════════════

async def _call_mistral_api(
    prompt_json: str,
    model: str = "mistral-small-2603",
    max_tokens: int = 1500,
    timeout: float = 30.0
) -> tuple[str, int]:
    """
    Appelle l'API Mistral (via llm_provider avec fallback) pour synthétiser les résultats web.

    Args:
        prompt_json: Prompt préformaté en JSON avec clés "system" et "user"
        model: Modèle Mistral à utiliser
        max_tokens: Tokens max pour la réponse
        timeout: Timeout en secondes

    Returns:
        Tuple[content, tokens_used]

    Raises:
        Exception si l'API échoue
    """
    try:
        prompt_data = json.loads(prompt_json)
        system_msg = prompt_data.get("system", "")
        user_msg = prompt_data.get("user", "")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid prompt JSON: {e}")

    print(f"🤖 [MISTRAL] Calling {model} (max_tokens={max_tokens})...", flush=True)

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
        print(f"✅ [MISTRAL] Success: {len(result.content)} chars, {result.tokens_total} tokens{fallback_info}", flush=True)
        return result.content, result.tokens_total

    raise Exception("All LLM providers exhausted (Mistral + DeepSeek)")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 FONCTION PRINCIPALE: WEB SEARCH + SYNTHESIS
# ═══════════════════════════════════════════════════════════════════════════════

async def web_search_and_synthesize(
    query: str,
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    max_sources: int = 5,
    max_tokens: int = 1500,
    mistral_model: Optional[str] = None,
    timeout: float = 30.0
) -> WebSearchResult:
    """
    Exécute une recherche Brave + synthèse Mistral en une seule étape.
    
    Args:
        query: Requête de recherche (ex: "Claude Opus performance vs GPT-4")
        context: Contexte additionnel (ex: titre vidéo, affirmations)
        purpose: enrichment | fact_check | chat | debate | deep_research
        lang: Langue (fr/en)
        max_sources: Nombre max de résultats Brave à intégrer
        max_tokens: Tokens max pour la synthèse Mistral
        mistral_model: Modèle Mistral override (default: mistral-small-2603)
        timeout: Timeout global en secondes
    
    Returns:
        WebSearchResult avec content synthétisé + sources
    """
    
    print(f"\n🔍 [WEB_SEARCH] Starting: query='{query}', purpose={purpose}, lang={lang}", flush=True)
    
    # Vérifier la configuration
    if not ENRICHMENT_AVAILABLE:
        print("❌ [WEB_SEARCH] Not available: missing BRAVE_SEARCH_API_KEY or MISTRAL_API_KEY", flush=True)
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error="Web search not configured (missing API keys)"
        )
    
    model = mistral_model or "mistral-small-2603"

    # Si la query est très longue (prompt complet), extraire une query courte pour Brave
    # et garder le texte complet comme contexte pour Mistral
    brave_query = query
    full_prompt_for_mistral = query
    if len(query) > 300:
        # Extraire les termes-clés : première ligne ou premier segment avant les instructions
        lines = query.strip().split("\n")
        # Chercher une ligne significative (pas une instruction JSON/format)
        short_parts = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("{") or line.startswith("⚠") or line.startswith("📚") or line.startswith("IMPORTANT"):
                continue
            if "JSON" in line or "format exact" in line or "Réponds" in line or "Reply" in line:
                continue
            if line.startswith("- ") and len(line) < 80:
                # C'est un terme à définir
                short_parts.append(line.lstrip("- ").strip())
            elif len(line) > 10 and len(short_parts) == 0:
                short_parts.append(line[:150])
                break
        brave_query = " ".join(short_parts[:10]) if short_parts else query[:300]
        brave_query = brave_query[:400]
        print(f"📝 [WEB_SEARCH] Long query detected, using short Brave query: '{brave_query[:100]}...'", flush=True)

    try:
        # --- ÉTAPE 1: Recherche Brave ---
        print(f"🦁 [WEB_SEARCH] Step 1: Brave Search for '{brave_query[:100]}'", flush=True)

        brave_result = await asyncio.wait_for(
            _call_brave_api(brave_query, count=max_sources),
            timeout=timeout * 0.4
        )
        
        if not brave_result.success:
            print(f"⚠️ [WEB_SEARCH] Brave failed: {brave_result.error}", flush=True)
            return WebSearchResult(
                success=False,
                content="",
                sources=[],
                error=f"Brave search failed: {brave_result.error}"
            )
        
        if not brave_result.sources:
            print(f"⚠️ [WEB_SEARCH] Brave returned no sources", flush=True)
            return WebSearchResult(
                success=False,
                content="",
                sources=[],
                error="Brave search returned no results"
            )
        
        print(f"✅ [WEB_SEARCH] Brave found {len(brave_result.sources)} sources", flush=True)
        
        # --- ÉTAPE 2: Construire le prompt Mistral ---
        print(f"📝 [WEB_SEARCH] Step 2: Building Mistral prompt...", flush=True)
        
        prompt_json = _build_synthesis_prompt(
            purpose=purpose,
            query=query,
            context=context,
            brave_results=brave_result.sources,
            lang=lang
        )
        
        # --- ÉTAPE 3: Appel Mistral pour synthèse ---
        print(f"🤖 [WEB_SEARCH] Step 3: Mistral synthesis...", flush=True)
        
        synthesis_content, tokens_used = await asyncio.wait_for(
            _call_mistral_api(
                prompt_json=prompt_json,
                model=model,
                max_tokens=max_tokens,
                timeout=timeout * 0.4
            ),
            timeout=timeout * 0.4
        )
        
        # --- RÉSULTAT FINAL ---
        print(f"✅ [WEB_SEARCH] Success: {len(synthesis_content)} chars, {len(brave_result.sources)} sources cited", flush=True)
        
        return WebSearchResult(
            success=True,
            content=synthesis_content,
            sources=brave_result.sources,
            tokens_used=tokens_used,
            raw_brave_results=brave_result.snippets  # Debug
        )
    
    except asyncio.TimeoutError:
        error_msg = f"Web search timeout after {timeout}s"
        print(f"❌ [WEB_SEARCH] {error_msg}", flush=True)
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error=error_msg
        )
    
    except Exception as e:
        error_msg = str(e)
        print(f"❌ [WEB_SEARCH] Exception: {error_msg}", flush=True)
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error=error_msg
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 RECHERCHES MULTIPLES (BATCH)
# ═══════════════════════════════════════════════════════════════════════════════

async def web_search_batch(
    queries: List[str],
    context: str,
    purpose: Literal["enrichment", "fact_check", "chat", "debate", "deep_research"],
    lang: str = "fr",
    max_sources_per_query: int = 3,
    mistral_model: Optional[str] = None
) -> WebSearchResult:
    """
    Exécute N requêtes Brave en parallèle, puis synthèse unique Mistral.
    Utilisé pour la recherche approfondie (deep_research).
    
    Args:
        queries: Liste de requêtes de recherche
        context: Contexte global
        purpose: Généralement "deep_research"
        lang: Langue
        max_sources_per_query: Sources par requête Brave
        mistral_model: Modèle Mistral override
    
    Returns:
        WebSearchResult unique avec synthèse complète
    """
    
    print(f"\n🔍📦 [WEB_SEARCH_BATCH] Starting: {len(queries)} queries, purpose={purpose}", flush=True)
    
    if not ENRICHMENT_AVAILABLE:
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error="Web search not configured"
        )
    
    model = mistral_model or "mistral-small-2603"
    
    try:
        # --- Exécuter toutes les recherches Brave en parallèle ---
        print(f"🦁 [WEB_SEARCH_BATCH] Executing {len(queries)} Brave searches in parallel...", flush=True)
        
        brave_results = await asyncio.gather(
            *[_call_brave_api(q, count=max_sources_per_query) for q in queries],
            return_exceptions=True
        )
        
        # Consolider les résultats
        all_sources = []
        consolidated_results_text = ""
        seen_urls = set()
        
        for i, (query, result) in enumerate(zip(queries, brave_results), 1):
            if isinstance(result, Exception):
                print(f"⚠️ [WEB_SEARCH_BATCH] Query {i} error: {result}", flush=True)
                continue
            
            if not result.success:
                print(f"⚠️ [WEB_SEARCH_BATCH] Query {i} failed: {result.error}", flush=True)
                continue
            
            # Ajouter résultats unique au contexte
            consolidated_results_text += f"\n🔎 Search {i}: \"{query}\"\n{result.snippets}\n"
            
            # Consolider sources uniques
            for src in result.sources:
                if src["url"] not in seen_urls:
                    seen_urls.add(src["url"])
                    src["search_query"] = query
                    all_sources.append(src)
        
        if not all_sources:
            print(f"⚠️ [WEB_SEARCH_BATCH] No usable results from all queries", flush=True)
            return WebSearchResult(
                success=False,
                content="",
                sources=[],
                error="All Brave searches failed or returned no results"
            )
        
        print(f"✅ [WEB_SEARCH_BATCH] Consolidated {len(all_sources)} unique sources from {len(queries)} queries", flush=True)
        
        # --- Synthèse Mistral avec tous les résultats ---
        print(f"🤖 [WEB_SEARCH_BATCH] Mistral synthesis for deep research...", flush=True)
        
        prompt_json = _build_synthesis_prompt(
            purpose=purpose,
            query=" + ".join(queries),
            context=context,
            brave_results=all_sources,
            lang=lang
        )
        
        synthesis_content, tokens_used = await _call_mistral_api(
            prompt_json=prompt_json,
            model=model,
            max_tokens=2000,  # Plus de tokens pour deep research
            timeout=60.0
        )
        
        print(f"✅ [WEB_SEARCH_BATCH] Complete: {len(synthesis_content)} chars, {len(all_sources)} sources", flush=True)
        
        return WebSearchResult(
            success=True,
            content=synthesis_content,
            sources=all_sources,
            tokens_used=tokens_used,
            raw_brave_results=consolidated_results_text
        )
    
    except Exception as e:
        error_msg = str(e)
        print(f"❌ [WEB_SEARCH_BATCH] Exception: {error_msg}", flush=True)
        return WebSearchResult(
            success=False,
            content="",
            sources=[],
            error=error_msg
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
