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

import httpx
import json
import re
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass

from core.config import get_brave_key


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
# 🔍 GÉNÉRATION DE REQUÊTES INTELLIGENTES
# ═══════════════════════════════════════════════════════════════════════════════

def generate_factcheck_queries(
    video_title: str,
    video_channel: str,
    transcript_excerpt: str,
    lang: str = "fr"
) -> List[str]:
    """
    Génère 2-3 requêtes de fact-checking intelligentes à partir du contenu vidéo.
    Cible les affirmations vérifiables, pas le résumé général.
    """
    queries = []
    
    # Query 1: Titre + contexte actuel
    clean_title = re.sub(r'[#\[\](){}|]', '', video_title).strip()
    if clean_title:
        queries.append(f"{clean_title} latest facts 2025 2026")
    
    # Query 2: Extraire les entités nommées/techniques du transcript
    # Recherche de noms de produits, modèles AI, entreprises, personnes
    tech_patterns = [
        r'\b(GPT[-\s]?\d[\w.]*)',
        r'\b(Claude\s+\d[\w.]*)',
        r'\b(Opus\s+\d[\w.]*)',
        r'\b(Sonnet\s+\d[\w.]*)',
        r'\b(Gemini[\s\w.]*)',
        r'\b(Mistral[\s\w.-]*)',
        r'\b(Llama[\s\w.-]*)',
        r'\b(ChatGPT[\s\w.-]*)',
        r'\b(OpenAI)',
        r'\b(Anthropic)',
        r'\b(Google\s+(?:AI|DeepMind))',
        r'\b(Meta\s+AI)',
        r'\b(Apple\s+Intelligence)',
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
            success=False, snippets="", sources=[], query=query,
            error="BRAVE_SEARCH_API_KEY not configured"
        )
    
    try:
        async with httpx.AsyncClient() as client:
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
                    success=False, snippets="", sources=[], query=query,
                    error=f"Brave API {response.status_code}: {response.text[:200]}"
                )
            
            data = response.json()
            web_results = data.get("web", {}).get("results", [])
            
            if not web_results:
                return BraveSearchResult(
                    success=False, snippets="", sources=[], query=query,
                    error="No results"
                )
            
            # Extraire snippets et sources
            sources = []
            snippet_parts = []
            
            for r in web_results[:count]:
                title = r.get("title", "")
                url = r.get("url", "")
                desc = r.get("description", "")
                age = r.get("age", "")
                
                sources.append({
                    "title": title,
                    "url": url,
                    "snippet": desc,
                    "age": age,
                })
                
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
        return BraveSearchResult(
            success=False, snippets="", sources=[], query=query,
            error=str(e)
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE: FACT-CHECK VIA BRAVE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_brave_factcheck_context(
    video_title: str,
    video_channel: str,
    transcript: str,
    lang: str = "fr"
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
        
        context_parts.append(f"🔎 Recherche: \"{r.query}\"\n{r.snippets}")
        
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
    
    return context_text, all_sources
