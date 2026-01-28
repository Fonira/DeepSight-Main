"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 STUDY ROUTER — Mobile-compatible study tools endpoints                         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Provides /api/study/* endpoints for mobile app compatibility.                     ║
║  Wraps the existing /api/videos/study/* functionality.                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from db.database import get_session, User, Summary
from auth.dependencies import get_current_user
from videos.service import get_summary_by_id, deduct_credit
from videos.study_tools import generate_study_card, generate_concept_map, generate_study_materials

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class QuizQuestion(BaseModel):
    """Question de quiz"""
    question: str
    options: List[str]
    correct_index: int
    explanation: Optional[str] = None


class QuizResponse(BaseModel):
    """Réponse quiz générée"""
    success: bool
    summary_id: int
    quiz: List[QuizQuestion]
    title: str
    difficulty: str = "standard"


class FlashcardItem(BaseModel):
    """Flashcard item"""
    front: str
    back: str
    category: Optional[str] = None


class FlashcardsResponse(BaseModel):
    """Réponse flashcards générées"""
    success: bool
    summary_id: int
    flashcards: List[FlashcardItem]
    title: str


class MindmapResponse(BaseModel):
    """Réponse mindmap générée"""
    success: bool
    summary_id: int
    mermaid_code: str
    concepts: List[Dict[str, Any]]
    title: str


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 QUIZ ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/quiz/{summary_id}", response_model=QuizResponse)
async def generate_quiz(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🎯 Génère un quiz de compréhension pour une vidéo analysée.

    Extrait les questions QCM depuis la fiche de révision générée.
    Mobile-compatible endpoint.
    """
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")

    # Vérifier les crédits
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")

    # Déduire 1 crédit
    await deduct_credit(session, current_user.id, 1, "quiz")

    try:
        # Générer la fiche complète puis extraire le quiz
        study_card = await generate_study_card(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            transcript=summary.transcript_context or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest"
        )

        # Extraire les questions QCM de la fiche
        quiz_questions = []
        if study_card and "quiz" in study_card:
            raw_quiz = study_card.get("quiz", [])
            for q in raw_quiz:
                if isinstance(q, dict):
                    quiz_questions.append(QuizQuestion(
                        question=q.get("question", ""),
                        options=q.get("options", q.get("choices", [])),
                        correct_index=q.get("correct_index", q.get("answer", 0)),
                        explanation=q.get("explanation", "")
                    ))
        elif study_card and "questions" in study_card:
            # Alternative format
            for q in study_card.get("questions", []):
                if isinstance(q, dict) and "options" in q:
                    quiz_questions.append(QuizQuestion(
                        question=q.get("question", ""),
                        options=q.get("options", []),
                        correct_index=q.get("correct_index", 0),
                        explanation=q.get("explanation", "")
                    ))

        return QuizResponse(
            success=True,
            summary_id=summary_id,
            quiz=quiz_questions,
            title=summary.video_title or "Quiz",
            difficulty="standard"
        )

    except Exception as e:
        print(f"❌ [QUIZ] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 MINDMAP ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/mindmap/{summary_id}", response_model=MindmapResponse)
async def generate_mindmap(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🌳 Génère un mindmap (carte conceptuelle) pour une vidéo analysée.

    Retourne le code Mermaid et la liste des concepts.
    Mobile-compatible endpoint.
    """
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")

    # Vérifier les crédits
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")

    # Déduire 1 crédit
    await deduct_credit(session, current_user.id, 1, "mindmap")

    try:
        concept_map = await generate_concept_map(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest"
        )

        mermaid_code = ""
        concepts = []

        if concept_map:
            mermaid_code = concept_map.get("mermaid", concept_map.get("code", ""))
            concepts = concept_map.get("concepts", [])

        return MindmapResponse(
            success=True,
            summary_id=summary_id,
            mermaid_code=mermaid_code,
            concepts=concepts,
            title=summary.video_title or "Mindmap"
        )

    except Exception as e:
        print(f"❌ [MINDMAP] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 📇 FLASHCARDS ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/flashcards/{summary_id}", response_model=FlashcardsResponse)
async def generate_flashcards(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📇 Génère des flashcards de révision pour une vidéo analysée.

    Extrait les définitions et concepts clés pour créer des cartes de révision.
    Mobile-compatible endpoint.
    """
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")

    # Vérifier les crédits
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")

    # Déduire 1 crédit
    await deduct_credit(session, current_user.id, 1, "flashcards")

    try:
        # Générer la fiche complète puis extraire les flashcards
        study_card = await generate_study_card(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            transcript=summary.transcript_context or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest"
        )

        flashcards = []

        if study_card:
            # Extraire les définitions comme flashcards
            definitions = study_card.get("definitions", study_card.get("terms", []))
            for defn in definitions:
                if isinstance(defn, dict):
                    flashcards.append(FlashcardItem(
                        front=defn.get("term", defn.get("front", "")),
                        back=defn.get("definition", defn.get("back", "")),
                        category="Définitions"
                    ))

            # Extraire les Q&A comme flashcards
            qa_pairs = study_card.get("qa", study_card.get("questions_answers", []))
            for qa in qa_pairs:
                if isinstance(qa, dict):
                    flashcards.append(FlashcardItem(
                        front=qa.get("question", qa.get("q", "")),
                        back=qa.get("answer", qa.get("a", "")),
                        category="Questions"
                    ))

            # Extraire les points clés comme flashcards
            key_points = study_card.get("key_points", study_card.get("points", []))
            for i, point in enumerate(key_points[:5]):  # Max 5 points clés
                if isinstance(point, str):
                    flashcards.append(FlashcardItem(
                        front=f"Point clé #{i+1}",
                        back=point,
                        category="Points clés"
                    ))
                elif isinstance(point, dict):
                    flashcards.append(FlashcardItem(
                        front=point.get("title", f"Point clé #{i+1}"),
                        back=point.get("content", point.get("description", "")),
                        category="Points clés"
                    ))

        return FlashcardsResponse(
            success=True,
            summary_id=summary_id,
            flashcards=flashcards,
            title=summary.video_title or "Flashcards"
        )

    except Exception as e:
        print(f"❌ [FLASHCARDS] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 ALL MATERIALS ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/all/{summary_id}")
async def generate_all_materials(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    📚 Génère tous les outils d'étude en une fois.

    Inclut: Quiz, Mindmap, Flashcards
    Coût: 2 crédits
    """
    # Récupérer le résumé
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Résumé non trouvé")

    # Vérifier les crédits (2 pour tout)
    if current_user.credits < 2:
        raise HTTPException(status_code=402, detail="Crédits insuffisants (2 requis)")

    # Déduire 2 crédits
    await deduct_credit(session, current_user.id, 2, "study_all")

    try:
        materials = await generate_study_materials(
            title=summary.video_title or "Vidéo",
            channel=summary.video_channel or "Chaîne inconnue",
            summary=summary.summary_content or "",
            transcript=summary.transcript_context or "",
            lang=summary.lang or "fr",
            model="mistral-small-latest",
            include_card=True,
            include_map=True
        )

        return {
            "success": True,
            "summary_id": summary_id,
            "materials": materials
        }

    except Exception as e:
        print(f"❌ [STUDY_ALL] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")
