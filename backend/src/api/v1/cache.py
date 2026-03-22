"""
Endpoints cache vidéo — vérification du contenu caché et statistiques.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import get_current_admin

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])

# Instance du cache (injectée au démarrage via app.state)
_cache_service = None


def set_cache_service(service) -> None:
    """Configure le service de cache (appelé au startup)."""
    global _cache_service
    _cache_service = service


@router.get("/video/{platform}/{video_id}")
async def check_video_cache(platform: str, video_id: str):
    """Vérifie ce qui est en cache pour une vidéo donnée. Endpoint public."""
    if _cache_service is None:
        return {"status": "success", "data": {"cached": False}}

    try:
        data = await _cache_service.has_video(platform, video_id)
        return {"status": "success", "data": data}
    except Exception:
        return {"status": "success", "data": {"cached": False}}


@router.get("/stats")
async def get_cache_stats(admin=Depends(get_current_admin)):
    """Statistiques du cache (admin only)."""
    if _cache_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "cache_unavailable", "message": "Cache service not initialized"},
        )

    data = await _cache_service.get_cache_stats_summary()
    return {"status": "success", "data": data}
