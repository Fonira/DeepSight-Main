"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🆚 COMPARISON ROUTER — Video VS Mode endpoints                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User
from auth.dependencies import get_current_user
from comparison.schemas import ComparisonRequest
from comparison.service import (
    generate_comparison,
    get_comparison,
    get_comparison_history,
    get_comparison_cost,
)

router = APIRouter()


@router.post("/compare")
async def compare_videos(
    request: ComparisonRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    🆚 Comparer deux vidéos analysées.
    Retourne similarités, différences, contradictions, fiabilité et verdict.
    """
    if request.summary_a_id == request.summary_b_id:
        raise HTTPException(status_code=400, detail="Impossible de comparer une vidéo avec elle-même")

    try:
        result = await generate_comparison(
            session=session,
            user_id=user.id,
            summary_a_id=request.summary_a_id,
            summary_b_id=request.summary_b_id,
            lang=request.lang,
            model=request.model,
        )
        return result
    except ValueError as e:
        error_msg = str(e)
        if "introuvable" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        if "insuffisants" in error_msg:
            raise HTTPException(status_code=402, detail=error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la comparaison: {str(e)[:200]}")


@router.get("/cost")
async def comparison_cost(
    model: str = "mistral-small-2603",
    user: User = Depends(get_current_user),
):
    """Retourne le coût en crédits d'une comparaison."""
    cost = get_comparison_cost(model)
    return {
        "cost": cost,
        "model": model,
        "user_credits": user.credits or 0,
        "can_afford": (user.credits or 0) >= cost,
    }


@router.get("/history")
async def comparison_history(
    page: int = 1,
    per_page: int = 20,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Historique paginé des comparaisons de l'utilisateur."""
    return await get_comparison_history(session, user.id, page, per_page)


@router.get("/{comparison_id}")
async def get_comparison_by_id(
    comparison_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Récupérer une comparaison existante."""
    result = await get_comparison(session, user.id, comparison_id)
    if not result:
        raise HTTPException(status_code=404, detail="Comparaison introuvable")
    return result
