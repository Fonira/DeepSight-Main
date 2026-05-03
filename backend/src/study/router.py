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
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from db.database import get_session, User
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
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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

    # 💾 Check global video content cache
    _s_platform = getattr(summary, "platform", "youtube") or "youtube"
    _s_vid = getattr(summary, "video_id", None)
    _s_lang = summary.lang or "fr"
    try:
        from main import get_video_cache

        _vcache = get_video_cache()
        if _vcache is not None and _s_vid:
            _cached = await _vcache.get_studio_content(_s_platform, _s_vid, "quiz", _s_lang)
            if _cached and _cached.get("quiz"):
                print(f"💾 [STUDIO CACHE HIT] quiz for {_s_platform}/{_s_vid}", flush=True)
                return QuizResponse(
                    success=True,
                    summary_id=summary_id,
                    quiz=[QuizQuestion(**q) for q in _cached["quiz"]],
                    title=_cached.get("title", summary.video_title or "Quiz"),
                    difficulty=_cached.get("difficulty", "standard"),
                )
    except Exception:
        pass

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
            model="mistral-small-2603",
        )

        # Extraire les questions QCM de la fiche
        quiz_questions = []
        if study_card and "quiz" in study_card:
            raw_quiz = study_card.get("quiz", [])
            for q in raw_quiz:
                if isinstance(q, dict):
                    quiz_questions.append(
                        QuizQuestion(
                            question=q.get("question", ""),
                            options=q.get("options", q.get("choices", [])),
                            correct_index=q.get("correct_index", q.get("answer", 0)),
                            explanation=q.get("explanation", ""),
                        )
                    )
        elif study_card and "questions" in study_card:
            # Alternative format
            for q in study_card.get("questions", []):
                if isinstance(q, dict) and "options" in q:
                    quiz_questions.append(
                        QuizQuestion(
                            question=q.get("question", ""),
                            options=q.get("options", []),
                            correct_index=q.get("correct_index", 0),
                            explanation=q.get("explanation", ""),
                        )
                    )

        # 💾 Cache the generated quiz
        if quiz_questions and _s_vid:
            try:
                if _vcache is not None:
                    await _vcache.set_studio_content(
                        _s_platform,
                        _s_vid,
                        "quiz",
                        _s_lang,
                        {
                            "quiz": [q.model_dump() for q in quiz_questions],
                            "title": summary.video_title or "Quiz",
                            "difficulty": "standard",
                        },
                    )
            except Exception:
                pass

        # ─── V1 Semantic Search : matérialisation des quiz questions ────────────
        import json as _json
        from db.database import QuizQuestion as DBQuizQuestion
        from sqlalchemy import delete as sa_delete

        await session.execute(
            sa_delete(DBQuizQuestion).where(DBQuizQuestion.summary_id == summary_id)
        )

        for idx, q in enumerate(quiz_questions):
            # `q` peut être un Pydantic QuizQuestion (avec champs question/options/
            # correct_index/explanation) ou un dict (avec en plus éventuellement
            # `difficulty`). On gère les deux proprement via isinstance.
            if isinstance(q, dict):
                _question = q["question"]
                _options = q["options"]
                _correct = q["correct_index"]
                _expl = q.get("explanation")
                _diff = q.get("difficulty", "standard")
            else:
                _question = q.question
                _options = q.options
                _correct = q.correct_index
                _expl = getattr(q, "explanation", None)
                # Le Pydantic local QuizQuestion n'a pas de champ `difficulty`
                _diff = getattr(q, "difficulty", "standard")
            db_q = DBQuizQuestion(
                summary_id=summary_id,
                user_id=current_user.id,
                position=idx,
                question=_question,
                options_json=_json.dumps(_options),
                correct_index=_correct,
                explanation=_expl,
                difficulty=_diff,
            )
            session.add(db_q)

        await session.commit()

        # Le trigger embed_quiz sera ajouté en Task 17, pas dans cette task
        # ─── End V1 Semantic Search materialization ─────────────────────────────

        return QuizResponse(
            success=True,
            summary_id=summary_id,
            quiz=quiz_questions,
            title=summary.video_title or "Quiz",
            difficulty="standard",
        )

    except Exception as e:
        print(f"❌ [QUIZ] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 MINDMAP ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/mindmap/{summary_id}", response_model=MindmapResponse)
async def generate_mindmap(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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

    # 💾 Check global video content cache
    _s_platform = getattr(summary, "platform", "youtube") or "youtube"
    _s_vid = getattr(summary, "video_id", None)
    _s_lang = summary.lang or "fr"
    _vcache = None
    try:
        from main import get_video_cache

        _vcache = get_video_cache()
        if _vcache is not None and _s_vid:
            _cached = await _vcache.get_studio_content(_s_platform, _s_vid, "mindmap", _s_lang)
            if _cached and _cached.get("mermaid_code"):
                print(f"💾 [STUDIO CACHE HIT] mindmap for {_s_platform}/{_s_vid}", flush=True)
                return MindmapResponse(
                    success=True,
                    summary_id=summary_id,
                    mermaid_code=_cached["mermaid_code"],
                    concepts=_cached.get("concepts", []),
                    title=_cached.get("title", summary.video_title or "Mindmap"),
                )
    except Exception:
        pass

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
            model="mistral-small-2603",
        )

        mermaid_code = ""
        concepts = []

        if concept_map:
            mermaid_code = concept_map.get("mermaid", concept_map.get("code", ""))
            concepts = concept_map.get("concepts", [])

        # 💾 Cache the generated mindmap
        if mermaid_code and _s_vid:
            try:
                if _vcache is not None:
                    await _vcache.set_studio_content(
                        _s_platform,
                        _s_vid,
                        "mindmap",
                        _s_lang,
                        {
                            "mermaid_code": mermaid_code,
                            "concepts": concepts,
                            "title": summary.video_title or "Mindmap",
                        },
                    )
            except Exception:
                pass

        return MindmapResponse(
            success=True,
            summary_id=summary_id,
            mermaid_code=mermaid_code,
            concepts=concepts,
            title=summary.video_title or "Mindmap",
        )

    except Exception as e:
        print(f"❌ [MINDMAP] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 📇 FLASHCARDS ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/flashcards/{summary_id}", response_model=FlashcardsResponse)
async def generate_flashcards(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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

    # 💾 Check global video content cache
    _s_platform = getattr(summary, "platform", "youtube") or "youtube"
    _s_vid = getattr(summary, "video_id", None)
    _s_lang = summary.lang or "fr"
    _vcache = None
    try:
        from main import get_video_cache

        _vcache = get_video_cache()
        if _vcache is not None and _s_vid:
            _cached = await _vcache.get_studio_content(_s_platform, _s_vid, "flashcards", _s_lang)
            if _cached and _cached.get("flashcards"):
                print(f"💾 [STUDIO CACHE HIT] flashcards for {_s_platform}/{_s_vid}", flush=True)
                return FlashcardsResponse(
                    success=True,
                    summary_id=summary_id,
                    flashcards=[FlashcardItem(**fc) for fc in _cached["flashcards"]],
                    title=_cached.get("title", summary.video_title or "Flashcards"),
                )
    except Exception:
        pass

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
            model="mistral-small-2603",
        )

        flashcards = []

        if study_card:
            # Priorité 1: Flashcards directes (nouveau format Q&A)
            raw_flashcards = study_card.get("flashcards", [])
            for fc in raw_flashcards:
                if isinstance(fc, dict) and fc.get("front"):
                    flashcards.append(
                        FlashcardItem(
                            front=fc.get("front", ""), back=fc.get("back", ""), category=fc.get("category", "Général")
                        )
                    )

            # Fallback: Q&A pairs
            if not flashcards:
                qa_pairs = study_card.get("questions_answers", study_card.get("qa", []))
                for qa in qa_pairs:
                    if isinstance(qa, dict):
                        flashcards.append(
                            FlashcardItem(
                                front=qa.get("question", qa.get("q", "")),
                                back=qa.get("answer", qa.get("a", "")),
                                category="Questions",
                            )
                        )

            # Fallback: Definitions (transformées en questions)
            if not flashcards:
                definitions = study_card.get("definitions", study_card.get("terms", []))
                for defn in definitions:
                    if isinstance(defn, dict):
                        term = defn.get("term", defn.get("front", ""))
                        definition = defn.get("definition", defn.get("back", ""))
                        flashcards.append(
                            FlashcardItem(front=f"Qu'est-ce que {term} ?", back=definition, category="Définitions")
                        )

        # 💾 Cache the generated flashcards
        if flashcards and _s_vid:
            try:
                if _vcache is not None:
                    await _vcache.set_studio_content(
                        _s_platform,
                        _s_vid,
                        "flashcards",
                        _s_lang,
                        {
                            "flashcards": [fc.model_dump() for fc in flashcards],
                            "title": summary.video_title or "Flashcards",
                        },
                    )
            except Exception:
                pass

        # ─── V1 Semantic Search : matérialisation des flashcards ────────────────
        from db.database import Flashcard as DBFlashcard
        from sqlalchemy import delete as sa_delete

        # 1. Delete existantes pour ce summary
        await session.execute(sa_delete(DBFlashcard).where(DBFlashcard.summary_id == summary_id))

        # 2. Insert nouvelles
        for idx, card in enumerate(flashcards):
            db_card = DBFlashcard(
                summary_id=summary_id,
                user_id=current_user.id,
                position=idx,
                front=card.front if hasattr(card, "front") else card["front"],
                back=card.back if hasattr(card, "back") else card["back"],
                category=getattr(card, "category", None) if hasattr(card, "category") else card.get("category"),
            )
            session.add(db_card)

        await session.commit()

        # 3. Le trigger embed_flashcards sera ajouté en Task 17, pas dans cette task
        #    (le helper n'existe pas encore à ce stade du plan)
        # ─── End V1 Semantic Search materialization ─────────────────────────────

        return FlashcardsResponse(
            success=True, summary_id=summary_id, flashcards=flashcards, title=summary.video_title or "Flashcards"
        )

    except Exception as e:
        print(f"❌ [FLASHCARDS] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 ALL MATERIALS ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/all/{summary_id}")
async def generate_all_materials(
    summary_id: int, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
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
            model="mistral-small-2603",
            include_card=True,
            include_map=True,
        )

        return {"success": True, "summary_id": summary_id, "materials": materials}

    except Exception as e:
        print(f"❌ [STUDY_ALL] Erreur: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Erreur génération: {str(e)}")
