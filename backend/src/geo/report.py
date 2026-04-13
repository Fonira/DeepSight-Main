"""Génération de rapport GEO via Mistral AI.

Produit des recommandations contextuelles et actionnables
pour améliorer la citabilité d'une vidéo par les moteurs IA.
"""

import logging

from core.llm_provider import llm_complete

log = logging.getLogger("geo")

GEO_REPORT_PROMPT = """Tu es un expert en GEO (Generative Engine Optimization) — l'optimisation de contenu pour être cité par les moteurs IA (ChatGPT, Perplexity, Gemini, Google AI Overviews).

Analyse cette vidéo YouTube et produis un rapport GEO actionnable.

## Données de la vidéo
- **Titre** : {video_title}
- **Catégorie** : {category}
- **Score de fiabilité** : {reliability_score}/100
- **Score GEO actuel** : {geo_score}/100 (grade {geo_grade})
- **Nombre de claims SOLID** : {solid_claims}/{total_claims}
- **Top quotes citables** :
{quotes_text}

## Décomposition du score
- Citabilité : {citability}/100
- Structure : {structure}/100
- Autorité : {authority}/100
- Couverture : {coverage}/100
- Fraîcheur : {freshness}/100

## Extrait du contenu analysé (500 premiers mots)
{content_excerpt}

## Ta mission
Produis un rapport GEO structuré en JSON avec ce format exact :
{{
  "summary": "Résumé en 2-3 phrases du potentiel GEO de cette vidéo",
  "strengths": ["Point fort 1", "Point fort 2", ...],
  "weaknesses": ["Point faible 1", "Point faible 2", ...],
  "action_plan": [
    {{
      "action": "Description de l'action concrète",
      "impact": "high|medium|low",
      "effort": "easy|medium|hard",
      "expected_gain": 5
    }}
  ],
  "optimized_description": "Suggestion de description YouTube optimisée GEO (max 200 mots)",
  "suggested_chapters": ["00:00 Introduction", "02:30 ...", ...],
  "target_queries": ["Requêtes IA sur lesquelles cette vidéo pourrait être citée"]
}}

Sois concret et actionnable. Pas de généralités vagues. Chaque action doit être spécifique à CETTE vidéo.
Réponds UNIQUEMENT avec le JSON, sans texte autour.
"""


async def generate_geo_report(
    video_title: str,
    category: str | None,
    reliability_score: float | None,
    geo_score: float,
    geo_grade: str,
    solid_claims: int,
    total_claims: int,
    quotes_text: str,
    citability: float,
    structure: float,
    authority: float,
    coverage: float,
    freshness: float,
    content_excerpt: str,
    model: str = "mistral-small-2603",
) -> dict | None:
    """Génère un rapport GEO détaillé via Mistral."""

    prompt = GEO_REPORT_PROMPT.format(
        video_title=video_title,
        category=category or "Non catégorisée",
        reliability_score=reliability_score or "N/A",
        geo_score=geo_score,
        geo_grade=geo_grade,
        solid_claims=solid_claims,
        total_claims=total_claims,
        quotes_text=quotes_text or "Aucune quote citable trouvée",
        citability=citability,
        structure=structure,
        authority=authority,
        coverage=coverage,
        freshness=freshness,
        content_excerpt=content_excerpt[:2000],
    )

    result = await llm_complete(
        messages=[
            {"role": "system", "content": "Tu es un expert GEO. Réponds uniquement en JSON valide."},
            {"role": "user", "content": prompt},
        ],
        model=model,
        max_tokens=2000,
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    if not result:
        log.error("Échec de génération du rapport GEO via Mistral")
        return None

    import json
    try:
        return json.loads(result.content)
    except json.JSONDecodeError:
        log.error(f"Réponse Mistral non-JSON: {result.content[:200]}")
        return None
