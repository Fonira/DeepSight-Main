"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎭 DEBATE ROUTER — Confrontation IA de perspectives vidéo                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  POST   /api/debate/create              — Lancer un débat                         ║
║  GET    /api/debate/status/{debate_id}  — Poll status                             ║
║  GET    /api/debate/{debate_id}         — Résultat complet                        ║
║  GET    /api/debate/history             — Liste des débats (paginé)               ║
║  DELETE /api/debate/{debate_id}         — Supprimer un débat                      ║
║  POST   /api/debate/chat               — Chat avec contexte des 2 vidéos         ║
║  GET    /api/debate/chat/history/{id}   — Historique chat débat                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, require_credits
from db.database import get_session, User

from .schemas import (
    DebateCreateRequest,
    DebateCreateResponse,
    DebateChatRequest,
    DebateChatResponse,
    DebateListItem,
    DebateResultResponse,
    DebateStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# POST /create — Lancer un débat IA
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/create", response_model=DebateCreateResponse)
async def create_debate(
    request: DebateCreateRequest,
    current_user: User = Depends(require_credits(5)),
    db: AsyncSession = Depends(get_session),
):
    """
    Lance un débat IA entre deux perspectives vidéo.

    - Mode auto : fournir url_a seulement → l'IA recherche une vidéo opposée
    - Mode manual : fournir url_a + url_b → confrontation directe
    - Coût : 5 crédits
    """
    logger.info(
        "Debate creation requested",
        extra={"user_id": current_user.id, "mode": "manual" if request.url_b else "auto"},
    )

    # TODO: Extraire video_id depuis url_a (et url_b si fourni)
    # TODO: Vérifier que les vidéos existent et sont accessibles
    # TODO: Créer l'entrée DebateAnalysis en DB avec status="pending"
    # TODO: Lancer la tâche asynchrone (background task) pour :
    #   1. Récupérer transcripts des deux vidéos
    #   2. Détecter le sujet et extraire les thèses
    #   3. Identifier arguments, convergences, divergences
    #   4. Fact-check croisé
    #   5. Générer la synthèse du débat
    # TODO: Déduire les crédits

    # Placeholder response
    return DebateCreateResponse(
        debate_id=1,
        status="pending",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /status/{debate_id} — Poll status
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status/{debate_id}", response_model=DebateStatusResponse)
async def get_debate_status(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Récupère le statut d'un débat en cours.
    Statuts : pending → searching → analyzing_b → comparing → fact_checking → completed/failed
    """
    # TODO: Requêter DebateAnalysis par debate_id + vérifier user_id
    # TODO: Retourner le statut réel depuis la DB

    # Placeholder response
    return DebateStatusResponse(
        debate_id=debate_id,
        status="pending",
        progress_message="Analyse en attente...",
        video_a_title="Vidéo A — En cours de chargement",
        video_b_title=None,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /history — Liste des débats de l'utilisateur (paginé)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history", response_model=list[DebateListItem])
async def get_debate_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Liste paginée des débats de l'utilisateur, triés par date décroissante."""
    # TODO: SELECT * FROM debate_analyses WHERE user_id = current_user.id
    #       ORDER BY created_at DESC LIMIT limit OFFSET (page - 1) * limit

    # Placeholder response
    return []


# ═══════════════════════════════════════════════════════════════════════════════
# GET /{debate_id} — Résultat complet d'un débat
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{debate_id}", response_model=DebateResultResponse)
async def get_debate_result(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Récupère le résultat complet d'un débat terminé."""
    # TODO: Requêter DebateAnalysis par debate_id + vérifier user_id
    # TODO: Retourner 404 si introuvable, 403 si pas le bon user

    # Placeholder response
    return DebateResultResponse(
        id=debate_id,
        video_a_id="dQw4w9WgXcQ",
        video_b_id=None,
        video_a_title="Placeholder — Vidéo A",
        video_b_title=None,
        detected_topic="Sujet en cours d'analyse",
        thesis_a=None,
        thesis_b=None,
        arguments_a=[],
        arguments_b=[],
        convergence_points=[],
        divergence_points=[],
        fact_check_results={},
        debate_summary=None,
        status="pending",
        mode="auto",
        model_used=None,
        credits_used=0,
        lang="fr",
        created_at=datetime.now(timezone.utc),
        updated_at=None,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /{debate_id} — Supprimer un débat
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/{debate_id}")
async def delete_debate(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Supprime un débat et ses messages de chat associés."""
    # TODO: Vérifier ownership (user_id == current_user.id)
    # TODO: DELETE FROM debate_analyses WHERE id = debate_id AND user_id = current_user.id
    # TODO: Les DebateChatMessage seront supprimés en cascade

    # Placeholder response
    return {"status": "deleted", "debate_id": debate_id}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /chat — Chat avec contexte des 2 vidéos
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=DebateChatResponse)
async def debate_chat(
    request: DebateChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Chat contextuel dans le cadre d'un débat.
    Le contexte inclut les thèses, arguments et fact-check des 2 vidéos.
    """
    logger.info(
        "Debate chat message",
        extra={"user_id": current_user.id, "debate_id": request.debate_id},
    )

    # TODO: Récupérer le DebateAnalysis pour le contexte
    # TODO: Construire le prompt avec les 2 perspectives
    # TODO: Envoyer à Mistral avec le contexte du débat
    # TODO: Sauvegarder le message + réponse dans DebateChatMessage
    # TODO: Vérifier quotas chat

    # Placeholder response
    return DebateChatResponse(
        response="Le débat est en cours d'analyse. Cette fonctionnalité sera bientôt disponible.",
        sources=[],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /chat/history/{debate_id} — Historique chat débat
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/chat/history/{debate_id}")
async def get_debate_chat_history(
    debate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Récupère l'historique des messages de chat pour un débat."""
    # TODO: SELECT * FROM debate_chat_messages
    #       WHERE debate_id = debate_id AND user_id = current_user.id
    #       ORDER BY created_at ASC

    # Placeholder response
    return {"debate_id": debate_id, "messages": []}
