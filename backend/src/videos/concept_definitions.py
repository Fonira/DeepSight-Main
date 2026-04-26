"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 CONCEPT DEFINITIONS SERVICE v1.0 — Extraction et définitions via Perplexity    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Nouvelle approche: Au lieu de liens inline, on extrait les concepts et on         ║
║  récupère leurs définitions via Perplexity pour les afficher dans un glossaire.    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import re
import asyncio
import logging
from typing import Dict, Any, List
from dataclasses import dataclass

logger = logging.getLogger("deepsight.concepts")

from core.config import get_mistral_key
from core.config import MISTRAL_INTERNAL_MODEL
from core.http_client import shared_http_client


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 TYPES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ConceptDefinition:
    """Définition d'un concept"""
    term: str
    definition: str
    category: str  # 'person', 'technology', 'company', 'concept', 'other'
    source: str = "perplexity"
    wiki_url: str = None  # URL Wikipedia ou source alternative


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 EXTRACTION DES CONCEPTS
# ═══════════════════════════════════════════════════════════════════════════════

def extract_concepts(text: str) -> List[str]:
    """
    Extrait tous les [[concepts]] d'un texte.
    Supporte: [[terme]] et [[terme|affichage]]
    
    Returns:
        Liste de termes uniques (sans doublons)
    """
    if not text:
        return []
    
    # Regex pour [[concept]] ou [[concept|display]]
    pattern = r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]'
    
    matches = re.findall(pattern, text)
    
    # Nettoyer et dédupliquer
    concepts = []
    seen = set()
    
    for match in matches:
        term = match.strip()
        term_lower = term.lower()
        
        if term and term_lower not in seen:
            concepts.append(term)
            seen.add(term_lower)
    
    return concepts


def clean_concept_markers(text: str) -> str:
    """
    Supprime les marqueurs [[]] du texte pour un affichage propre.
    [[Sam Altman]] → Sam Altman
    [[OpenAI|la société OpenAI]] → la société OpenAI
    """
    if not text:
        return ""
    
    # Pattern pour [[term]] ou [[term|display]]
    pattern = r'\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]'
    
    def replace_match(match):
        term = match.group(1)
        display = match.group(2)
        return display if display else term
    
    return re.sub(pattern, replace_match, text)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 PERPLEXITY API - DÉFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_definitions_from_perplexity(
    concepts: List[str],
    context: str = "",
    language: str = "fr"
) -> Dict[str, ConceptDefinition]:
    """
    Récupère les définitions de plusieurs concepts via Perplexity.
    
    Args:
        concepts: Liste des termes à définir
        context: Contexte optionnel (titre de la vidéo, sujet)
        language: 'fr' ou 'en'
    
    Returns:
        Dictionnaire {terme: ConceptDefinition}
    """
    if not concepts:
        return {}

    # Limiter à 20 concepts max (coût + longueur réponse)
    concepts = concepts[:20]

    # Construire le prompt
    if language == "fr":
        prompt = f"""Donne une définition COURTE et VÉRIFIABLE (1-2 phrases max, moins de 50 mots) pour chaque terme ci-dessous.

⚠️ RÈGLES ANTI-HALLUCINATION:
- Ne définis que des termes/personnes/entreprises CONNUS et VÉRIFIABLES
- Si un terme est inconnu ou ambigu, réponds avec "definition": null
- N'invente AUCUN fait - préfère avouer l'incertitude
- Pour les personnes: vérifie mentalement que les rôles/titres sont corrects

📚 SOURCE (OBLIGATOIRE):
- Fournis l'URL Wikipedia française (fr.wikipedia.org) si elle existe
- Sinon, fournis une source web fiable (site officiel, Britannica, etc.)
- Si aucune source fiable: "wiki_url": null

Contexte: {context if context else "Analyse de vidéo YouTube"}

Termes à définir:
{chr(10).join(f"- {c}" for c in concepts)}

Réponds UNIQUEMENT en JSON valide avec ce format exact:
{{
  "definitions": [
    {{"term": "Nom du terme", "definition": "Définition courte et factuelle OU null si incertain.", "category": "person|technology|company|concept|other", "wiki_url": "https://fr.wikipedia.org/wiki/Article OU URL alternative OU null"}}
  ]
}}

Catégories:
- person: Personne (entrepreneur, scientifique, etc.)
- technology: Technologie, framework, outil
- company: Entreprise, organisation
- concept: Concept abstrait, théorie, méthode
- other: Autre

IMPORTANT:
- JSON uniquement, pas de texte avant ou après
- Préférer null à une information incertaine
- Vérifier que les URLs Wikipedia sont plausibles (format correct)"""
    else:
        prompt = f"""Give a SHORT and VERIFIABLE definition (1-2 sentences max, under 50 words) for each term below.

⚠️ ANTI-HALLUCINATION RULES:
- Only define KNOWN and VERIFIABLE terms/people/companies
- If a term is unknown or ambiguous, respond with "definition": null
- NEVER invent facts - prefer admitting uncertainty
- For people: mentally verify that roles/titles are accurate

📚 SOURCE (REQUIRED):
- Provide the English Wikipedia URL (en.wikipedia.org) if it exists
- Otherwise, provide a reliable web source (official site, Britannica, etc.)
- If no reliable source exists: "wiki_url": null

Context: {context if context else "YouTube video analysis"}

Terms to define:
{chr(10).join(f"- {c}" for c in concepts)}

Reply ONLY with valid JSON in this exact format:
{{
  "definitions": [
    {{"term": "Term name", "definition": "Short factual definition OR null if uncertain.", "category": "person|technology|company|concept|other", "wiki_url": "https://en.wikipedia.org/wiki/Article OR alternative URL OR null"}}
  ]
}}

Categories:
- person: Person (entrepreneur, scientist, etc.)
- technology: Technology, framework, tool
- company: Company, organization
- concept: Abstract concept, theory, method
- other: Other

IMPORTANT:
- JSON response only, no text before or after
- Prefer null over uncertain information
- Verify Wikipedia URLs are plausible (correct format)"""

    try:
        from videos.web_search_provider import web_search_and_synthesize

        result = await web_search_and_synthesize(
            query=prompt,
            context=context if context else "YouTube video concept definitions",
            purpose="enrichment",
            lang=language,
            max_sources=5,
            max_tokens=2500,
        )

        if not result.success:
            logger.warning(f"[Concepts] Web search error: {result.error}")
            return {}

        content = result.content

        # Nettoyer le contenu (enlever les ```json si présent)
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```\w*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        parsed = json.loads(content)
        definitions = parsed.get("definitions", [])

        # Convertir en dictionnaire de ConceptDefinition
        result_dict = {}
        for item in definitions:
            term = item.get("term", "")
            if term:
                result_dict[term.lower()] = ConceptDefinition(
                    term=term,
                    definition=item.get("definition", ""),
                    category=item.get("category", "other"),
                    source="brave_search",
                    wiki_url=item.get("wiki_url")
                )

        logger.info(f"[Concepts] Got {len(result_dict)} definitions from Brave+Mistral")
        return result_dict

    except json.JSONDecodeError as e:
        logger.warning(f"[Concepts] JSON parse error: {e}")
        return {}
    except Exception as e:
        logger.warning(f"[Concepts] Error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 MISTRAL FALLBACK — DÉFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_definitions_from_mistral(
    concepts: List[str],
    context: str = "",
    language: str = "fr"
) -> Dict[str, ConceptDefinition]:
    """
    Fallback Mistral pour les définitions quand Perplexity échoue.
    Utilise mistral-small-2603 (rapide, économique).
    """
    api_key = get_mistral_key()
    if not api_key or not concepts:
        return {}

    # Augmenté de 15 → 30 pour couvrir plus de concepts (Ministral 8B = quasi gratuit)
    concepts = concepts[:30]

    if language == "fr":
        prompt = f"""Tu es un professeur encyclopédiste. Donne une définition COURTE et VÉRIFIABLE (2-3 phrases, max 60 mots) pour chaque terme ci-dessous.

⚠️ RÈGLES:
- Ne définis que des termes/personnes/entreprises CONNUS
- Si incertain: "definition": null
- N'invente AUCUN fait

📚 SOURCE: Fournis l'URL Wikipedia française si elle existe, sinon null.

Contexte: {context if context else "Analyse de vidéo YouTube"}

Termes:
{chr(10).join(f"- {c}" for c in concepts)}

Réponds UNIQUEMENT en JSON valide:
{{
  "definitions": [
    {{"term": "Nom", "definition": "Définition courte OU null", "category": "person|technology|company|concept|other", "wiki_url": "URL OU null"}}
  ]
}}"""
    else:
        prompt = f"""You are an encyclopedia professor. Give a SHORT, VERIFIABLE definition (2-3 sentences, max 60 words) for each term below.

⚠️ RULES:
- Only define KNOWN terms/people/companies
- If uncertain: "definition": null
- NEVER invent facts

📚 SOURCE: Provide English Wikipedia URL if it exists, otherwise null.

Context: {context if context else "YouTube video analysis"}

Terms:
{chr(10).join(f"- {c}" for c in concepts)}

Reply ONLY with valid JSON:
{{
  "definitions": [
    {{"term": "Name", "definition": "Short definition OR null", "category": "person|technology|company|concept|other", "wiki_url": "URL OR null"}}
  ]
}}"""

    try:
        async with shared_http_client() as client:
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
                    "max_tokens": 2500,
                    "temperature": 0.2
                }
            )

            if response.status_code != 200:
                print(f"❌ [Concepts] Mistral fallback error: {response.status_code}")
                return {}

            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r'^```\w*\n?', '', content)
                content = re.sub(r'\n?```$', '', content)

            parsed = json.loads(content)
            definitions = parsed.get("definitions", [])

            result = {}
            for item in definitions:
                term = item.get("term", "")
                defn = item.get("definition")
                if term and defn:  # Skip null definitions
                    result[term.lower()] = ConceptDefinition(
                        term=term,
                        definition=defn,
                        category=item.get("category", "other"),
                        source="mistral",
                        wiki_url=item.get("wiki_url")
                    )

            print(f"✅ [Concepts] Mistral fallback: {len(result)} definitions")
            return result

    except json.JSONDecodeError as e:
        print(f"❌ [Concepts] Mistral JSON parse error: {e}")
        return {}
    except Exception as e:
        print(f"❌ [Concepts] Mistral fallback error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_concepts_with_definitions(
    text: str,
    context: str = "",
    language: str = "fr"
) -> Dict[str, Any]:
    """
    Extrait les concepts d'un texte et récupère leurs définitions.
    
    Args:
        text: Texte contenant des [[concepts]]
        context: Contexte (titre vidéo, sujet)
        language: 'fr' ou 'en'
    
    Returns:
        {
            "concepts": [
                {
                    "term": "Sam Altman",
                    "definition": "CEO d'OpenAI...",
                    "category": "person"
                },
                ...
            ],
            "clean_text": "Texte sans les [[]]",
            "count": 5
        }
    """
    # Extraire les concepts
    concepts = extract_concepts(text)
    
    if not concepts:
        return {
            "concepts": [],
            "clean_text": text,
            "count": 0
        }
    
    # Récupérer les définitions — Perplexity en priorité, Mistral en fallback
    definitions = await get_definitions_from_perplexity(concepts, context, language)

    # Identifier les concepts sans définition pour le fallback Mistral
    missing_concepts = [c for c in concepts if c.lower() not in definitions]

    if missing_concepts:
        logger.info(f"[Concepts] {len(missing_concepts)} concepts sans définition Perplexity, fallback Mistral...")
        # Batch 1 : concepts 1-15 via Mistral Small (qualité)
        mistral_definitions = await get_definitions_from_mistral(missing_concepts[:15], context, language)
        definitions.update(mistral_definitions)

        # Batch 2 : concepts 16+ via Ministral 8B (rapide, quasi gratuit)
        still_missing = [c for c in concepts if c.lower() not in definitions]
        if still_missing:
            logger.info(f"[Concepts] {len(still_missing)} concepts restants, batch Ministral 8B...")
            overflow_definitions = await get_definitions_from_mistral(still_missing[:30], context, language)
            definitions.update(overflow_definitions)

    # Construire la liste finale
    concepts_list = []
    for concept in concepts:
        concept_lower = concept.lower()
        if concept_lower in definitions:
            defn = definitions[concept_lower]
            concepts_list.append({
                "term": defn.term,
                "definition": defn.definition or "",
                "category": defn.category,
                "wiki_url": defn.wiki_url,
                "source": defn.source
            })
        else:
            # Pas de définition trouvée même après fallback
            concepts_list.append({
                "term": concept,
                "definition": "",
                "category": "other",
                "wiki_url": None,
                "source": "none"
            })
    
    return {
        "concepts": concepts_list,
        "clean_text": clean_concept_markers(text),
        "count": len(concepts_list)
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TEST
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    test_text = """
    La vidéo de [[More Perfect Union]] examine les promesses de [[Sam Altman]], 
    cofondateur d'[[OpenAI]], concernant l'[[intelligence artificielle]]. 
    Elle mentionne aussi [[Loopt]] et [[Reddit]] comme exemples de ses précédents projets.
    Les outils comme [[Zod]] et [[React PDF]] sont utilisés pour la validation.
    """
    
    async def test():
        result = await get_concepts_with_definitions(test_text, "Test vidéo", "fr")
        print(f"\n📚 {result['count']} concepts trouvés:")
        for c in result["concepts"]:
            print(f"  • {c['term']} ({c['category']}): {c['definition'][:60]}...")
        print(f"\n📝 Texte nettoyé:\n{result['clean_text'][:200]}...")
    
    asyncio.run(test())
