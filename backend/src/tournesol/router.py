"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🌻 TOURNESOL PROXY ROUTER                                                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Proxy pour l'API Tournesol (contourne les restrictions CORS)                       ║
║  API: https://api.tournesol.app/polls/videos/entities/yt:{video_id}                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx
import asyncio

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
    
    print(f"🌻 Tournesol proxy: Fetching {url}", flush=True)
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "DeepSight/1.0 (tournesol-integration)"
                }
            )
            
            print(f"🌻 Tournesol proxy: Response {response.status_code}", flush=True)
            
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
            # 🔍 DEBUG: Log COMPLET de la réponse Tournesol brute
            import json
            print(f"🌻 Tournesol proxy: RAW RESPONSE for {clean_id}:", flush=True)
            print(f"🌻 {json.dumps(data, indent=2, default=str)[:2000]}", flush=True)
            
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
            
            print(f"🌻 Tournesol proxy: PARSED VALUES:", flush=True)
            print(f"🌻   tournesol_score = {tournesol_score}", flush=True)
            print(f"🌻   n_comparisons = {n_comparisons}", flush=True)
            print(f"🌻   n_contributors = {n_contributors}", flush=True)
            print(f"🌻   criteria_scores = {criteria_scores}", flush=True)
            
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
        print(f"🌻 Tournesol proxy: Timeout for {clean_id}", flush=True)
        return TournesolResponse(
            found=False,
            error="Timeout"
        )
    except Exception as e:
        print(f"🌻 Tournesol proxy: Error {e}", flush=True)
        return TournesolResponse(
            found=False,
            error=str(e)
        )


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

    print(f"🔍 Tournesol search: '{request.query}' (limit={limit})", flush=True)

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
                print(f"🔍 Tournesol search failed: {response.status_code}", flush=True)
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

            print(f"🔍 Tournesol search: {len(results)} results", flush=True)

            return SearchResponse(
                results=results[:limit],
                total=len(results),
                query=request.query
            )

    except httpx.TimeoutException:
        print(f"🔍 Tournesol search timeout", flush=True)
        return SearchResponse(results=[], total=0, query=request.query)
    except Exception as e:
        print(f"🔍 Tournesol search error: {e}", flush=True)
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

    print(f"🌻 Tournesol recommendations: limit={limit}, language={language}", flush=True)

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
                print(f"🌻 Tournesol recommendations failed: {response.status_code}", flush=True)
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

            print(f"🌻 Tournesol recommendations: {len(results)} results", flush=True)

            return SearchResponse(
                results=results,
                total=len(results),
                query="recommendations"
            )

    except httpx.TimeoutException:
        print(f"🌻 Tournesol recommendations timeout", flush=True)
        return SearchResponse(results=[], total=0, query="recommendations")
    except Exception as e:
        print(f"🌻 Tournesol recommendations error: {e}", flush=True)
        return SearchResponse(results=[], total=0, query="recommendations")


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
