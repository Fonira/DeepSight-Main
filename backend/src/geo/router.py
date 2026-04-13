"""Endpoints API pour le module GEO (Generative Engine Optimization)."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.database import User, get_session
from .schemas import (
    GeoScoreRequest,
    GeoScoreResponse,
    GeoReportResponse,
    GeoBenchmarkResponse,
)
from .service import get_geo_score, get_geo_report, get_geo_benchmark, get_geo_visibility

log = logging.getLogger("geo")

router = APIRouter()


# ─── Phase 1: Score GEO (gratuit, données existantes) ────────────────────────


@router.post("/score", response_model=GeoScoreResponse)
async def score_geo(
    req: GeoScoreRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Calcule le score GEO d'une vidéo déjà analysée.

    Le score est basé sur 5 dimensions : citabilité, structure,
    autorité, couverture thématique et fraîcheur. Aucun crédit consommé
    car le calcul utilise les données d'analyse existantes.
    """
    try:
        result = await get_geo_score(req.summary_id, user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    log.info(
        f"GEO score user={user.id} summary={req.summary_id} "
        f"score={result.overall_score} grade={result.grade}"
    )
    return result


# ─── Phase 2: Rapport GEO (appel Mistral, consomme crédits) ──────────────────


@router.post("/report", response_model=GeoReportResponse)
async def report_geo(
    req: GeoScoreRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Génère un rapport GEO détaillé avec recommandations via Mistral.

    Consomme 30 crédits. Produit un plan d'action concret,
    une description YouTube optimisée, et les requêtes IA cibles.
    """
    try:
        result = await get_geo_report(req.summary_id, user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if result is None:
        raise HTTPException(status_code=500, detail="Échec de génération du rapport GEO")

    log.info(f"GEO report user={user.id} summary={req.summary_id}")
    return result


@router.post("/benchmark", response_model=GeoBenchmarkResponse)
async def benchmark_geo_endpoint(
    req: GeoScoreRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Compare le score GEO d'une vidéo avec les autres analyses de l'utilisateur.

    Retourne le rang, le percentile, et les scores des vidéos comparées.
    Gratuit (utilise les données existantes).
    """
    try:
        result = await get_geo_benchmark(req.summary_id, user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    log.info(
        f"GEO benchmark user={user.id} summary={req.summary_id} "
        f"rank={result['rank']}/{result['total']}"
    )
    return result


# ─── Phase 3: Monitoring visibilité IA ───────────────────────────────────────


@router.post("/visibility")
async def visibility_geo(
    req: GeoScoreRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Vérifie la visibilité d'une vidéo dans les moteurs de recherche.

    Utilise Brave Search pour détecter si la vidéo ou la chaîne
    apparaît dans les résultats pour des requêtes pertinentes.
    """
    try:
        result = await get_geo_visibility(req.summary_id, user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    log.info(
        f"GEO visibility user={user.id} summary={req.summary_id} "
        f"score={result.get('visibility_score', 'N/A')}"
    )
    return result
