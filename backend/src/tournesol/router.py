"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🌻 TOURNESOL PROXY ROUTER                                                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Proxy pour l'API Tournesol (contourne les restrictions CORS)                       ║
║  API: https://api.tournesol.app/polls/videos/entities/yt:{video_id}                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import httpx
import asyncio
import logging

logger = logging.getLogger("deepsight.tournesol")

router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class CriteriaScore(BaseModel):
    criteria: str
    score: Optional[float] = None

class TournesolEntity(BaseModel):
    uid: str
    tournesol_score: Optional[float] = None
    n_comparisons: int = 0
    n_contributors: int = 0
    criteria_scores: Optional[List[CriteriaScore]] = None

class TournesolResponse(BaseModel):
    found: bool
    data: Optional[TournesolEntity] = None
    error: Optional[str] = None

# ═══════════════════════════════════════════════════════════════════════════════
# 🌻 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/video/{video_id}", response_model=TournesolResponse)
async def get_tournesol_data(video_id: str):
    """
    Récupère les données Tournesol pour une vidéo YouTube.
    
    Args:
        video_id: ID de la vidéo YouTube (ex: dQw4w9WgXcQ)
    
    Returns:
        TournesolResponse avec les données ou une indication que la vidéo n'est pas sur Tournesol
    """
    # Nettoyer le video_id
    clean_id = video_id.strip().replace("yt:", "")
    
    if not clean_id or len(clean_id) != 11:
        return TournesolResponse(
            found=False,
            error="Invalid video ID format"
        )
    
    url = f"https://api.tournesol.app/polls/videos/entities/yt:{clean_id}"
    
    logger.info(f"Fetching Tournesol data for {clean_id}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "DeepSight/1.0 (tournesol-integration)"
                }
            )
            
            logger.debug(f"Tournesol API response: {response.status_code} for {clean_id}")
            
            if response.status_code == 404:
                return TournesolResponse(
                    found=False,
                    error=None
                )
            
            if response.status_code != 200:
                return TournesolResponse(
                    found=False,
                    error=f"API returned {response.status_code}"
                )
            
            data = response.json()
            
            # L'API Tournesol peut retourner les données de différentes façons
            # Essayer plusieurs chemins possibles
            tournesol_score = data.get("tournesol_score")
            n_comparisons = data.get("n_comparisons", 0)
            n_contributors = data.get("n_contributors", 0)
            criteria_scores = data.get("criteria_scores")
            
            # Si les données sont dans un sous-objet "entity"
            if "entity" in data:
                entity_data = data["entity"]
                tournesol_score = tournesol_score or entity_data.get("tournesol_score")
                n_comparisons = n_comparisons or entity_data.get("n_comparisons", 0)
                n_contributors = n_contributors or entity_data.get("n_contributors", 0)
                criteria_scores = criteria_scores or entity_data.get("criteria_scores")
            
            # Si les données sont dans "collective_rating"
            if "collective_rating" in data:
                cr = data["collective_rating"]
                tournesol_score = tournesol_score or cr.get("tournesol_score")
                n_comparisons = n_comparisons or cr.get("n_comparisons", 0)
                n_contributors = n_contributors or cr.get("n_contributors", 0)
                criteria_scores = criteria_scores or cr.get("criteria_scores")
            
            logger.info(f"Tournesol data for {clean_id}: score={tournesol_score}, comparisons={n_comparisons}, contributors={n_contributors}")
            
            # Construire la réponse
            entity = TournesolEntity(
                uid=data.get("uid", f"yt:{clean_id}"),
                tournesol_score=tournesol_score,
                n_comparisons=n_comparisons or 0,
                n_contributors=n_contributors or 0,
                criteria_scores=[
                    CriteriaScore(criteria=c.get("criteria", ""), score=c.get("score"))
                    for c in (criteria_scores or [])
                ] if criteria_scores else None
            )
            
            return TournesolResponse(
                found=True,
                data=entity
            )
            
    except httpx.TimeoutException:
        logger.warning(f"Tournesol API timeout for {clean_id}")
        return TournesolResponse(found=False, error="Timeout")
    except Exception as e:
        logger.error(f"Tournesol API error for {clean_id}: {e}")
        return TournesolResponse(found=False, error=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 SEARCH & RECOMMENDATIONS — Recherche dans Tournesol
# ═══════════════════════════════════════════════════════════════════════════════

class SearchRequest(BaseModel):
    """Requête de recherche Tournesol"""
    query: str
    limit: int = 10
    language: Optional[str] = None
    min_score: Optional[float] = None


class TournesolVideoResult(BaseModel):
    """Résultat de recherche Tournesol"""
    video_id: str
    title: Optional[str] = None
    channel: Optional[str] = None
    tournesol_score: Optional[float] = None
    n_comparisons: int = 0
    n_contributors: int = 0
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None


class SearchResponse(BaseModel):
    """Réponse de recherche Tournesol"""
    results: List[TournesolVideoResult]
    total: int
    query: str


@router.post("/search", response_model=SearchResponse)
async def search_tournesol(request: SearchRequest):
    """
    🔍 Recherche des vidéos recommandées par Tournesol.

    Utilise l'API Tournesol pour trouver des vidéos de qualité sur un sujet donné.
    Les résultats sont classés par score Tournesol (qualité collaborative).

    Args:
        query: Termes de recherche
        limit: Nombre max de résultats (défaut: 10, max: 50)
        language: Filtrer par langue (fr, en, etc.)
        min_score: Score Tournesol minimum
    """
    if not request.query or len(request.query.strip()) < 2:
        return SearchResponse(results=[], total=0, query=request.query)

    limit = min(request.limit, 50)

    # Construire les paramètres de recherche
    params = {
        "search": request.query,
        "limit": limit,
        "unsafe": "false"
    }

    if request.language:
        params["language"] = request.language

    logger.info(f"Tournesol search: query='{request.query}', limit={limit}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.tournesol.app/polls/videos/recommendations/",
                params=params,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "DeepSight/1.0 (tournesol-integration)"
                }
            )

            if response.status_code != 200:
                logger.warning(f"Tournesol search failed: {response.status_code}")
                return SearchResponse(results=[], total=0, query=request.query)

            data = response.json()
            results_data = data.get("results", [])

            results = []
            for item in results_data:
                entity = item.get("entity", item)
                video_id = entity.get("uid", "").replace("yt:", "")

                if not video_id:
                    continue

                score = item.get("tournesol_score") or entity.get("tournesol_score")

                # Filtrer par score minimum si spécifié
                if request.min_score and score and score < request.min_score:
                    continue

                metadata = entity.get("metadata", {})

                results.append(TournesolVideoResult(
                    video_id=video_id,
                    title=metadata.get("name") or entity.get("name"),
                    channel=metadata.get("uploader") or entity.get("uploader"),
                    tournesol_score=score,
                    n_comparisons=item.get("n_comparisons", 0) or entity.get("n_comparisons", 0),
                    n_contributors=item.get("n_contributors", 0) or entity.get("n_contributors", 0),
                    thumbnail_url=f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
                    duration=metadata.get("duration")
                ))

            logger.info(f"Tournesol search: {len(results)} results")

            return SearchResponse(
                results=results[:limit],
                total=len(results),
                query=request.query
            )

    except httpx.TimeoutException:
        logger.warning("Tournesol search timeout")
        return SearchResponse(results=[], total=0, query=request.query)
    except Exception as e:
        logger.error(f"Tournesol search error: {e}")
        return SearchResponse(results=[], total=0, query=request.query)


@router.get("/recommendations", response_model=SearchResponse)
async def get_recommendations(
    limit: int = 20,
    language: Optional[str] = None,
    date_gte: Optional[str] = None
):
    """
    🌻 Récupère les meilleures recommandations Tournesol.

    Retourne les vidéos les mieux notées par la communauté Tournesol,
    sans nécessiter de recherche spécifique.

    Args:
        limit: Nombre de résultats (défaut: 20, max: 50)
        language: Filtrer par langue (fr, en, etc.)
        date_gte: Date minimum (format YYYY-MM-DD)
    """
    limit = min(limit, 50)

    params = {
        "limit": limit,
        "unsafe": "false"
    }

    if language:
        params["language"] = language

    if date_gte:
        params["date_gte"] = date_gte

    logger.info(f"Tournesol recommendations: limit={limit}, language={language}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.tournesol.app/polls/videos/recommendations/",
                params=params,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "DeepSight/1.0 (tournesol-integration)"
                }
            )

            if response.status_code != 200:
                logger.warning(f"Tournesol recommendations failed: {response.status_code}")
                return SearchResponse(results=[], total=0, query="recommendations")

            data = response.json()
            results_data = data.get("results", [])

            results = []
            for item in results_data:
                entity = item.get("entity", item)
                video_id = entity.get("uid", "").replace("yt:", "")

                if not video_id:
                    continue

                metadata = entity.get("metadata", {})

                results.append(TournesolVideoResult(
                    video_id=video_id,
                    title=metadata.get("name") or entity.get("name"),
                    channel=metadata.get("uploader") or entity.get("uploader"),
                    tournesol_score=item.get("tournesol_score") or entity.get("tournesol_score"),
                    n_comparisons=item.get("n_comparisons", 0) or entity.get("n_comparisons", 0),
                    n_contributors=item.get("n_contributors", 0) or entity.get("n_contributors", 0),
                    thumbnail_url=f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
                    duration=metadata.get("duration")
                ))

            logger.info(f"Tournesol recommendations: {len(results)} results")

            return SearchResponse(
                results=results,
                total=len(results),
                query="recommendations"
            )

    except httpx.TimeoutException:
        logger.warning("Tournesol recommendations timeout")
        return SearchResponse(results=[], total=0, query="recommendations")
    except Exception as e:
        logger.error(f"Tournesol recommendations error: {e}")
        return SearchResponse(results=[], total=0, query="recommendations")


@router.get("/recommendations/raw")
async def get_recommendations_raw(request: Request):
    """
    🌻 Proxy passthrough vers l'API Tournesol (format brut).
    Utilisé par le frontend TournesolTrendingSection qui a besoin du format original
    avec entity.metadata, collective_rating, etc.
    Contourne le problème CORS (api.tournesol.app ne renvoie pas Access-Control-Allow-Origin).

    Sert d'abord depuis le pre-cache Redis (rafraîchi toutes les heures),
    fallback sur appel live Tournesol si cache miss.
    """
    from tournesol.trending_cache import get_cached_trending

    params = dict(request.query_params)
    # Sécurité : limiter le nombre de résultats
    if "limit" in params:
        params["limit"] = str(min(int(params["limit"]), 50))

    # ── Try pre-cache first ──
    language = params.get("language", "")
    limit = int(params.get("limit", "20"))
    offset = int(params.get("offset", "0"))

    cached = await get_cached_trending(language=language, limit=limit, offset=offset)
    if cached:
        logger.info(
            "Tournesol raw (CACHED, age=%ds): %d results",
            cached.get("_cache_age", 0),
            len(cached.get("results", [])),
        )
        return cached

    # ── Fallback: live API call ──
    logger.info(f"Tournesol raw proxy (LIVE): params={params}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.tournesol.app/polls/videos/recommendations/",
                params=params,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "DeepSight/1.0 (tournesol-integration)",
                },
            )

            if response.status_code != 200:
                logger.warning(f"Tournesol raw proxy failed: {response.status_code}")
                return {"count": 0, "next": None, "previous": None, "results": []}

            data = response.json()
            logger.info(f"Tournesol raw proxy: {len(data.get('results', []))} results")
            return data

    except httpx.TimeoutException:
        logger.warning("Tournesol raw proxy timeout")
        return {"count": 0, "next": None, "previous": None, "results": []}
    except Exception as e:
        logger.error(f"Tournesol raw proxy error: {e}")
        return {"count": 0, "next": None, "previous": None, "results": []}


@router.get("/trending/stats")
async def get_trending_cache_stats():
    """📊 Stats du pre-cache trending (admin debug)."""
    from tournesol.trending_cache import get_cache_stats
    return await get_cache_stats()


@router.get("/trending/refresh")
async def trigger_trending_refresh():
    """🔄 Force un refresh du pre-cache trending (admin debug)."""
    from tournesol.trending_cache import refresh_trending_cache
    stats = await refresh_trending_cache()
    return {"status": "refreshed", **stats}


@router.get("/batch")
async def get_tournesol_batch(video_ids: str):
    """
    Récupère les données Tournesol pour plusieurs vidéos.
    
    Args:
        video_ids: Liste d'IDs séparés par des virgules (ex: id1,id2,id3)
    
    Returns:
        Dict avec video_id -> TournesolResponse
    """
    ids = [v.strip() for v in video_ids.split(",") if v.strip()]
    
    if not ids:
        return {"results": {}}
    
    if len(ids) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 videos per batch")
    
    # Fetch en parallèle
    async def fetch_one(vid: str):
        return vid, await get_tournesol_data(vid)
    
    tasks = [fetch_one(vid) for vid in ids]
    results = await asyncio.gather(*tasks)
    
    return {
        "results": {vid: resp.dict() for vid, resp in results}
    }
