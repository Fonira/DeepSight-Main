"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 ENRICHED DEFINITIONS SERVICE v2.0 — Définitions IA enrichies                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Combine Mistral (catégorisation rapide) + Perplexity (définitions web enrichies)  ║
║  Pour chaque mot-clé: définition contextuelle + sources + catégorie                ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
import json
import re
import asyncio
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime
import os

from core.config import get_perplexity_key, get_mistral_key
from core.config import MISTRAL_INTERNAL_MODEL


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class EnrichedDefinition:
    """Définition enrichie d'un concept"""
    term: str
    definition: str
    category: str  # 'person', 'company', 'technology', 'concept', 'event', 'place', 'other'
    context_relevance: str  # Pourquoi ce terme est pertinent dans le contexte
    sources: List[str]  # URLs des sources (si disponibles)
    confidence: float  # 0.0-1.0
    provider: str  # 'mistral', 'perplexity', 'combined'
    wiki_url: str = None  # URL Wikipedia ou source alternative

    def to_dict(self):
        return asdict(self)


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 CATÉGORIES
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORIES = {
    'person': {
        'fr': 'Personnes',
        'en': 'People',
        'icon': '👤',
        'keywords': ['ceo', 'fondateur', 'président', 'ministre', 'auteur', 'scientifique']
    },
    'company': {
        'fr': 'Entreprises',
        'en': 'Companies', 
        'icon': '🏢',
        'keywords': ['entreprise', 'société', 'startup', 'groupe', 'organisation']
    },
    'technology': {
        'fr': 'Technologies',
        'en': 'Technologies',
        'icon': '⚡',
        'keywords': ['ia', 'ai', 'logiciel', 'algorithme', 'framework', 'api', 'machine learning']
    },
    'concept': {
        'fr': 'Concepts',
        'en': 'Concepts',
        'icon': '💡',
        'keywords': ['théorie', 'méthode', 'principe', 'stratégie', 'approche']
    },
    'event': {
        'fr': 'Événements',
        'en': 'Events',
        'icon': '📅',
        'keywords': ['guerre', 'élection', 'crise', 'sommet', 'accord']
    },
    'place': {
        'fr': 'Lieux',
        'en': 'Places',
        'icon': '📍',
        'keywords': ['pays', 'ville', 'région', 'continent']
    },
    'other': {
        'fr': 'Autres',
        'en': 'Others',
        'icon': '📌',
        'keywords': []
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 MISTRAL - Catégorisation rapide
# ═══════════════════════════════════════════════════════════════════════════════

async def categorize_with_mistral(
    terms: List[str],
    context: str = "",
    language: str = "fr"
) -> Dict[str, Dict[str, Any]]:
    """
    Utilise Mistral pour catégoriser rapidement les termes.
    Retourne catégorie + définition courte pour chaque terme.
    """
    api_key = get_mistral_key()
    if not api_key or not terms:
        return {}
    
    terms = terms[:30]  # Augmenté de 20 → 30 (Ministral 8B quasi gratuit)
    
    prompt = f"""Tu es un assistant expert en analyse de contenu. Catégorise chaque terme et donne une définition TRÈS COURTE (max 30 mots) UNIQUEMENT si tu es CERTAIN.

⚠️ RÈGLES ANTI-HALLUCINATION:
- Si tu ne connais pas un terme avec certitude, mets "definition": null
- N'invente JAMAIS de faits ou d'attributions
- Préfère l'incertitude à l'erreur

📚 SOURCE WIKIPEDIA:
- Fournis l'URL Wikipedia française si l'article existe probablement
- Format: "https://fr.wikipedia.org/wiki/Nom_Article"
- Si incertain: "wiki_url": null

Contexte: {context if context else "Analyse de vidéo YouTube"}

Termes à analyser:
{chr(10).join(f"- {t}" for t in terms)}

Réponds UNIQUEMENT en JSON valide:
{{
  "results": [
    {{
      "term": "Nom exact du terme",
      "category": "person|company|technology|concept|event|place|other",
      "definition": "Définition courte en 1 phrase OU null si incertain.",
      "relevance": "Pourquoi ce terme est important ici (1 phrase)",
      "wiki_url": "https://fr.wikipedia.org/wiki/Article OU null"
    }}
  ]
}}

Catégories:
- person: Personne (politique, entrepreneur, scientifique, artiste)
- company: Entreprise, organisation, institution
- technology: Technologie, outil, framework, IA
- concept: Concept abstrait, théorie, doctrine, méthode
- event: Événement historique ou actuel
- place: Lieu géographique
- other: Autre

IMPORTANT: JSON uniquement, pas de texte avant/après. Préférer null à l'incertitude."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MISTRAL_INTERNAL_MODEL,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 3000,
                    "temperature": 0.1
                }
            )
            
            if response.status_code != 200:
                print(f"❌ [Mistral] Error: {response.status_code}")
                return {}
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Nettoyer le JSON
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r'^```\w*\n?', '', content)
                content = re.sub(r'\n?```$', '', content)
            
            parsed = json.loads(content)
            results = parsed.get("results", [])
            
            # Construire le dictionnaire
            output = {}
            for item in results:
                term = item.get("term", "")
                if term:
                    output[term.lower()] = {
                        "term": term,
                        "category": item.get("category", "other"),
                        "definition": item.get("definition", ""),
                        "relevance": item.get("relevance", ""),
                        "wiki_url": item.get("wiki_url"),
                        "source": "mistral"
                    }
            
            print(f"✅ [Mistral] Categorized {len(output)} terms")
            return output
            
    except Exception as e:
        print(f"❌ [Mistral] Error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 PERPLEXITY - Définitions web enrichies
# ═══════════════════════════════════════════════════════════════════════════════

async def enrich_with_perplexity(
    terms: List[str],
    context: str = "",
    language: str = "fr"
) -> Dict[str, Dict[str, Any]]:
    """
    Utilise Perplexity pour enrichir les définitions avec des sources web.
    """
    api_key = get_perplexity_key()
    if not api_key or not terms:
        return {}
    
    terms = terms[:20]  # Augmenté de 15 → 20 (Perplexity reste limité pour le coût)
    
    prompt = f"""Tu es un assistant de recherche. Pour chaque terme, donne UNIQUEMENT des informations VÉRIFIABLES:
1. Une définition FACTUELLE et PRÉCISE (2-3 phrases max)
2. Le contexte de pourquoi c'est pertinent
3. La catégorie appropriée
4. L'URL Wikipedia ou une source fiable

⚠️ RÈGLES ANTI-HALLUCINATION:
- Ne fournis que des informations que tu peux sourcer
- Si un terme est inconnu ou ambigu, mets "definition": null
- N'invente JAMAIS de faits, dates ou attributions
- Préfère avouer l'incertitude plutôt que de deviner

📚 SOURCE (OBLIGATOIRE):
- Fournis l'URL Wikipedia française si elle existe
- Sinon, fournis une source web fiable (site officiel, Britannica, etc.)
- Si aucune source: "wiki_url": null

Contexte de la vidéo: {context if context else "Analyse de vidéo YouTube"}

Termes à définir:
{chr(10).join(f"- {t}" for t in terms)}

Réponds en JSON valide:
{{
  "definitions": [
    {{
      "term": "Nom du terme",
      "definition": "Définition factuelle précise OU null si incertain.",
      "category": "person|company|technology|concept|event|place|other",
      "context_relevance": "Pourquoi c'est pertinent dans ce contexte",
      "wiki_url": "https://fr.wikipedia.org/wiki/Article OU URL alternative OU null"
    }}
  ]
}}

IMPORTANT:
- Sois factuel et précis - JAMAIS d'invention
- Vérifie mentalement que les URLs Wikipedia sont plausibles
- JSON uniquement"""

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar",
                    "messages": [
                        {
                            "role": "system",
                            "content": "Tu fournis des définitions précises, factuelles et VÉRIFIABLES. N'invente jamais de faits. Fournis toujours une source Wikipedia ou fiable quand elle existe. Réponds uniquement en JSON valide."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 3500,
                    "temperature": 0.1
                }
            )
            
            if response.status_code != 200:
                print(f"❌ [Perplexity] Error: {response.status_code}")
                return {}
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Extraire les citations si disponibles (Perplexity peut retourner une liste ou un dict)
            raw_citations = data.get("citations", [])
            citations = list(raw_citations.values()) if isinstance(raw_citations, dict) else raw_citations if isinstance(raw_citations, list) else []
            
            # Nettoyer le JSON
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r'^```\w*\n?', '', content)
                content = re.sub(r'\n?```$', '', content)
            
            parsed = json.loads(content)
            definitions = parsed.get("definitions", [])
            
            output = {}
            for i, item in enumerate(definitions):
                term = item.get("term", "")
                if term:
                    # Associer des sources si disponibles
                    term_sources = citations[i:i+2] if citations and i < len(citations) else []

                    output[term.lower()] = {
                        "term": term,
                        "category": item.get("category", "other"),
                        "definition": item.get("definition", ""),
                        "context_relevance": item.get("context_relevance", ""),
                        "sources": term_sources,
                        "wiki_url": item.get("wiki_url"),
                        "source": "perplexity"
                    }
            
            print(f"✅ [Perplexity] Enriched {len(output)} definitions")
            return output
            
    except json.JSONDecodeError as e:
        print(f"❌ [Perplexity] JSON error: {e}")
        return {}
    except Exception as e:
        print(f"❌ [Perplexity] Error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE - Définitions enrichies combinées
# ═══════════════════════════════════════════════════════════════════════════════

async def get_enriched_definitions(
    terms: List[str],
    context: str = "",
    language: str = "fr",
    use_perplexity: bool = True
) -> List[EnrichedDefinition]:
    """
    Obtient des définitions enrichies en combinant Mistral et Perplexity.
    
    Flow:
    1. Mistral catégorise rapidement tous les termes
    2. Perplexity enrichit les définitions avec sources web (si activé)
    3. Fusion des résultats avec priorité à Perplexity
    
    Args:
        terms: Liste des termes à définir
        context: Contexte (titre vidéo, sujet)
        language: 'fr' ou 'en'
        use_perplexity: Si True, utilise aussi Perplexity (plus lent mais plus riche)
    
    Returns:
        Liste d'EnrichedDefinition
    """
    if not terms:
        return []
    
    # Dédupliquer les termes
    seen = set()
    unique_terms = []
    for t in terms:
        t_lower = t.lower().strip()
        if t_lower and t_lower not in seen:
            unique_terms.append(t.strip())
            seen.add(t_lower)
    
    terms = unique_terms[:40]  # Augmenté de 25 → 40 (Ministral 8B couvre le surplus)
    
    print(f"📚 [Definitions] Processing {len(terms)} terms...")
    
    # Lancer les deux en parallèle si Perplexity activé
    if use_perplexity:
        mistral_task = categorize_with_mistral(terms, context, language)
        perplexity_task = enrich_with_perplexity(terms, context, language)
        
        mistral_results, perplexity_results = await asyncio.gather(
            mistral_task, 
            perplexity_task,
            return_exceptions=True
        )
        
        # Gérer les exceptions
        if isinstance(mistral_results, Exception):
            print(f"⚠️ [Mistral] Exception: {mistral_results}")
            mistral_results = {}
        if isinstance(perplexity_results, Exception):
            print(f"⚠️ [Perplexity] Exception: {perplexity_results}")
            perplexity_results = {}
    else:
        mistral_results = await categorize_with_mistral(terms, context, language)
        perplexity_results = {}
    
    # Fusionner les résultats
    definitions = []
    
    for term in terms:
        term_lower = term.lower()
        
        # Priorité: Perplexity > Mistral > Fallback
        perplexity_data = perplexity_results.get(term_lower, {})
        mistral_data = mistral_results.get(term_lower, {})
        
        if perplexity_data:
            definitions.append(EnrichedDefinition(
                term=perplexity_data.get("term", term),
                definition=perplexity_data.get("definition", mistral_data.get("definition", "")),
                category=perplexity_data.get("category", mistral_data.get("category", "other")),
                context_relevance=perplexity_data.get("context_relevance", mistral_data.get("relevance", "")),
                sources=perplexity_data.get("sources", []),
                confidence=0.9,
                provider="perplexity",
                wiki_url=perplexity_data.get("wiki_url") or mistral_data.get("wiki_url")
            ))
        elif mistral_data:
            definitions.append(EnrichedDefinition(
                term=mistral_data.get("term", term),
                definition=mistral_data.get("definition", ""),
                category=mistral_data.get("category", "other"),
                context_relevance=mistral_data.get("relevance", ""),
                sources=[],
                confidence=0.7,
                provider="mistral",
                wiki_url=mistral_data.get("wiki_url")
            ))
        else:
            # Fallback - terme sans définition
            definitions.append(EnrichedDefinition(
                term=term,
                definition="",
                category="other",
                context_relevance="",
                sources=[],
                confidence=0.0,
                provider="none"
            ))
    
    print(f"✅ [Definitions] Generated {len(definitions)} enriched definitions")
    return definitions


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

def extract_terms_from_text(text: str) -> List[str]:
    """
    Extrait les termes [[marqués]] d'un texte.
    Supporte: [[terme]] et [[terme|affichage]]
    """
    if not text:
        return []
    
    pattern = r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]'
    matches = re.findall(pattern, text)
    
    seen = set()
    terms = []
    for match in matches:
        term = match.strip()
        term_lower = term.lower()
        if term and term_lower not in seen:
            terms.append(term)
            seen.add(term_lower)
    
    return terms


def get_category_info(category: str, language: str = "fr") -> Dict[str, str]:
    """Retourne les infos d'une catégorie."""
    cat_data = CATEGORIES.get(category, CATEGORIES["other"])
    return {
        "id": category,
        "label": cat_data.get(language, cat_data.get("fr", "Autre")),
        "icon": cat_data.get("icon", "📌")
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TEST
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    test_terms = [
        "Emmanuel Macron",
        "GAFAM",
        "Intelligence Artificielle",
        "Rassemblement National",
        "ChatGPT"
    ]
    
    async def test():
        results = await get_enriched_definitions(
            test_terms,
            context="Analyse politique française",
            language="fr"
        )
        
        print(f"\n📚 {len(results)} définitions enrichies:")
        for d in results:
            print(f"\n  {CATEGORIES.get(d.category, {}).get('icon', '📌')} {d.term}")
            print(f"     Catégorie: {d.category}")
            print(f"     Définition: {d.definition[:100]}...")
            if d.context_relevance:
                print(f"     Pertinence: {d.context_relevance[:80]}...")
            print(f"     Provider: {d.provider} (conf: {d.confidence})")
    
    asyncio.run(test())
