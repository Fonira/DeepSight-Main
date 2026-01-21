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
