"""
API Dependencies — Injection de dépendances pour les endpoints API.
"""



async def get_cache():
    """Dependency FastAPI pour injecter le VideoContentCacheService."""
    from main import get_video_cache
    return get_video_cache()
