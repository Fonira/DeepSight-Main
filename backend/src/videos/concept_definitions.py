"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 CONCEPT DEFINITIONS SERVICE v1.0 — Extraction et définitions via Perplexity    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Nouvelle approche: Au lieu de liens inline, on extrait les concepts et on         ║
║  récupère leurs définitions via Perplexity pour les afficher dans un glossaire.    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
import json
import re
import asyncio
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime

from core.config import get_perplexity_key


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
    api_key = get_perplexity_key()
    if not api_key or not concepts:
        return {}
    
    # Limiter à 15 concepts max pour éviter les requêtes trop longues
    concepts = concepts[:15]
    
    # Construire le prompt
    if language == "fr":
        prompt = f"""Donne une définition COURTE (1-2 phrases max, moins de 50 mots) pour chaque terme ci-dessous.

Contexte: {context if context else "Analyse de vidéo YouTube"}

Termes à définir:
{chr(10).join(f"- {c}" for c in concepts)}

Réponds UNIQUEMENT en JSON valide avec ce format exact:
{{
  "definitions": [
    {{"term": "Nom du terme", "definition": "Définition courte.", "category": "person|technology|company|concept|other"}}
  ]
}}

Catégories:
- person: Personne (entrepreneur, scientifique, etc.)
- technology: Technologie, framework, outil
- company: Entreprise, organisation
- concept: Concept abstrait, théorie, méthode
- other: Autre

IMPORTANT: Réponse JSON uniquement, pas de texte avant ou après."""
    else:
        prompt = f"""Give a SHORT definition (1-2 sentences max, under 50 words) for each term below.

Context: {context if context else "YouTube video analysis"}

Terms to define:
{chr(10).join(f"- {c}" for c in concepts)}

Reply ONLY with valid JSON in this exact format:
{{
  "definitions": [
    {{"term": "Term name", "definition": "Short definition.", "category": "person|technology|company|concept|other"}}
  ]
}}

Categories:
- person: Person (entrepreneur, scientist, etc.)
- technology: Technology, framework, tool
- company: Company, organization
- concept: Abstract concept, theory, method
- other: Other

IMPORTANT: JSON response only, no text before or after."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
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
                            "content": "Tu es un assistant qui fournit des définitions courtes et précises. Réponds uniquement en JSON valide."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.1
                }
            )
            
            if response.status_code != 200:
                print(f"❌ [Concepts] Perplexity error: {response.status_code}")
                return {}
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parser le JSON
            # Nettoyer le contenu (enlever les ```json si présent)
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r'^```\w*\n?', '', content)
                content = re.sub(r'\n?```$', '', content)
            
            parsed = json.loads(content)
            definitions = parsed.get("definitions", [])
            
            # Convertir en dictionnaire de ConceptDefinition
            result = {}
            for item in definitions:
                term = item.get("term", "")
                if term:
                    result[term.lower()] = ConceptDefinition(
                        term=term,
                        definition=item.get("definition", ""),
                        category=item.get("category", "other"),
                        source="perplexity"
                    )
            
            print(f"✅ [Concepts] Got {len(result)} definitions from Perplexity")
            return result
            
    except json.JSONDecodeError as e:
        print(f"❌ [Concepts] JSON parse error: {e}")
        return {}
    except Exception as e:
        print(f"❌ [Concepts] Error: {e}")
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
    
    # Récupérer les définitions
    definitions = await get_definitions_from_perplexity(concepts, context, language)
    
    # Construire la liste finale
    concepts_list = []
    for concept in concepts:
        concept_lower = concept.lower()
        if concept_lower in definitions:
            defn = definitions[concept_lower]
            concepts_list.append({
                "term": defn.term,
                "definition": defn.definition,
                "category": defn.category
            })
        else:
            # Pas de définition trouvée, ajouter quand même
            concepts_list.append({
                "term": concept,
                "definition": "",
                "category": "other"
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
