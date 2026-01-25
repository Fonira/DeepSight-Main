"""
🧠 WORDS ROUTER — Endpoints pour le widget "Le Saviez-Vous"
GET /api/words/random - Mot aléatoire (historique utilisateur ou liste par défaut)
GET /api/words/defaults - Liste complète des mots par défaut
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
import random

from auth.dependencies import get_current_user_optional
from db.database import async_session_maker
from db.models import User, Summary

from .data import DEFAULT_WORDS, get_random_word, get_words_by_category, get_all_categories

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 MODÈLES
# ═══════════════════════════════════════════════════════════════════════════════

class WordResponse(BaseModel):
    term: str
    definition: str
    short_definition: str
    category: str
    source: str  # "history" | "curated"
    wiki_url: Optional[str] = None


class DefaultWordsResponse(BaseModel):
    words: List[dict]
    total: int
    categories: List[str]


# ═══════════════════════════════════════════════════════════════════════════════
# 🎲 EXTRACTION MOTS-CLÉS HISTORIQUE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_keywords_from_history(user_id: int, lang: str = "fr") -> List[dict]:
    """
    Extrait les mots-clés intéressants des analyses précédentes de l'utilisateur.
    Retourne une liste de mots avec leurs définitions contextuelles.
    """
    async with async_session_maker() as session:
        from sqlalchemy import select, desc

        # Récupérer les 20 dernières analyses
        result = await session.execute(
            select(Summary)
            .where(Summary.user_id == user_id)
            .order_by(desc(Summary.created_at))
            .limit(20)
        )
        summaries = result.scalars().all()

        if not summaries:
            return []

        # Extraire les mots-clés des analyses
        keywords = []
        seen_terms = set()

        for summary in summaries:
            if not summary.summary_content:
                continue

            content = summary.summary_content.lower()

            # Chercher si des termes de notre liste sont mentionnés dans les analyses
            for word in DEFAULT_WORDS:
                term_to_check = word["term"].lower() if lang == "fr" else word["term_en"].lower()

                if term_to_check in content and term_to_check not in seen_terms:
                    seen_terms.add(term_to_check)
                    keywords.append({
                        "term": word["term"] if lang == "fr" else word["term_en"],
                        "definition": word["definition_fr"] if lang == "fr" else word["definition_en"],
                        "short_definition": word["short_fr"] if lang == "fr" else word["short_en"],
                        "category": word["category"],
                        "wiki_url": word.get("wiki_url"),
                        "source": "history",
                        "video_title": summary.video_title  # Contexte
                    })

                    if len(keywords) >= 10:
                        return keywords

        return keywords


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/random", response_model=WordResponse)
async def get_random_word_endpoint(
    lang: str = Query(default="fr", description="Language: fr | en"),
    exclude: Optional[str] = Query(default=None, description="Comma-separated terms to exclude"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    🎲 Retourne un mot aléatoire.

    Priorité:
    1. Mots-clés trouvés dans l'historique de l'utilisateur (si connecté)
    2. Mot aléatoire de la liste par défaut

    Params:
    - lang: "fr" ou "en"
    - exclude: termes à exclure (séparés par virgule)
    - category: filtrer par catégorie (cognitive_bias, science, philosophy, culture, misc)
    """
    exclude_list = exclude.split(",") if exclude else []

    # Si utilisateur connecté, essayer d'abord l'historique
    if current_user:
        history_words = await get_keywords_from_history(current_user.id, lang)

        # Filtrer les mots exclus
        available_history = [w for w in history_words if w["term"] not in exclude_list]

        # Filtrer par catégorie si spécifié
        if category and available_history:
            available_history = [w for w in available_history if w["category"] == category]

        if available_history:
            word = random.choice(available_history)
            return WordResponse(
                term=word["term"],
                definition=word["definition"],
                short_definition=word["short_definition"],
                category=word["category"],
                source="history",
                wiki_url=word.get("wiki_url")
            )

    # Fallback: mot aléatoire de la liste par défaut
    available_words = DEFAULT_WORDS.copy()

    # Filtrer les mots exclus
    if exclude_list:
        available_words = [w for w in available_words
                         if w["term"] not in exclude_list
                         and w["term_en"] not in exclude_list]

    # Filtrer par catégorie si spécifié
    if category:
        available_words = [w for w in available_words if w["category"] == category]

    if not available_words:
        available_words = DEFAULT_WORDS  # Reset si tout filtré

    word = random.choice(available_words)

    return WordResponse(
        term=word["term"] if lang == "fr" else word["term_en"],
        definition=word["definition_fr"] if lang == "fr" else word["definition_en"],
        short_definition=word["short_fr"] if lang == "fr" else word["short_en"],
        category=word["category"],
        source="curated",
        wiki_url=word.get("wiki_url")
    )


@router.get("/defaults", response_model=DefaultWordsResponse)
async def get_default_words(
    lang: str = Query(default="fr", description="Language: fr | en"),
    category: Optional[str] = Query(default=None, description="Filter by category")
):
    """
    📚 Retourne la liste complète des mots par défaut.

    Params:
    - lang: "fr" ou "en"
    - category: filtrer par catégorie
    """
    words = DEFAULT_WORDS

    if category:
        words = get_words_by_category(category)

    # Formater selon la langue
    formatted_words = []
    for w in words:
        formatted_words.append({
            "term": w["term"] if lang == "fr" else w["term_en"],
            "definition": w["definition_fr"] if lang == "fr" else w["definition_en"],
            "short_definition": w["short_fr"] if lang == "fr" else w["short_en"],
            "category": w["category"],
            "wiki_url": w.get("wiki_url")
        })

    return DefaultWordsResponse(
        words=formatted_words,
        total=len(formatted_words),
        categories=get_all_categories()
    )


@router.get("/categories")
async def get_categories():
    """
    📁 Retourne la liste des catégories disponibles.
    """
    categories = get_all_categories()
    counts = {cat: len(get_words_by_category(cat)) for cat in categories}

    return {
        "categories": categories,
        "counts": counts,
        "total": len(DEFAULT_WORDS)
    }
