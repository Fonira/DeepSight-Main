"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📜 HISTORY ROUTER v5.0 — ENDPOINTS HISTORIQUE COMPLET                             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  ENDPOINTS:                                                                        ║
║  • GET  /history/videos          — Historique des vidéos simples                   ║
║  • GET  /history/playlists       — Historique des playlists/corpus                 ║
║  • GET  /history/playlists/{id}  — Détail d'une playlist avec ses vidéos           ║
║  • GET  /history/search          — Recherche simple                                ║
║  • GET  /history/search/semantic — Recherche sémantique                            ║
║  • GET  /history/stats           — Statistiques de l'historique                    ║
║  • DELETE /history/videos/{id}   — Supprimer une vidéo                             ║
║  • DELETE /history/playlists/{id}— Supprimer une playlist                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import math
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User
from auth.dependencies import get_current_user
from .history_service import (
    get_user_history,
    get_user_playlists,
    get_playlist_with_videos,
    get_playlist_video,
    search_history_simple,
    search_history_semantic,
    get_history_stats,
    delete_summary,
    delete_playlist,
    delete_all_history,
    get_summary_by_id
)

router = APIRouter(tags=["history"])


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class VideoSummaryItem(BaseModel):
    id: int
    video_id: str
    video_title: Optional[str]
    video_channel: Optional[str]
    video_duration: int = 0
    thumbnail_url: Optional[str]
    category: Optional[str]
    mode: Optional[str]
    lang: Optional[str]
    word_count: int = 0
    reliability_score: Optional[float]
    is_favorite: bool = False
    has_transcript: bool = False  # Pour savoir si le chat est disponible
    created_at: Optional[str]
    
    class Config:
        from_attributes = True


class PlaylistSummaryItem(BaseModel):
    playlist_id: str
    playlist_title: Optional[str]
    playlist_url: Optional[str]
    num_videos: int = 0
    num_processed: int = 0
    total_duration: int = 0
    total_words: int = 0
    status: str = "pending"
    has_meta_analysis: bool = False
    created_at: Optional[str]
    completed_at: Optional[str]
    
    class Config:
        from_attributes = True


class VideoHistoryResponse(BaseModel):
    items: List[VideoSummaryItem]
    total: int
    page: int
    per_page: int
    pages: int


class PlaylistHistoryResponse(BaseModel):
    items: List[PlaylistSummaryItem]
    total: int
    page: int
    per_page: int
    pages: int


class PlaylistDetailResponse(BaseModel):
    playlist_id: str
    playlist_title: Optional[str]
    playlist_url: Optional[str]
    num_videos: int
    num_processed: int
    total_duration: int
    total_words: int
    status: str
    meta_analysis: Optional[str]
    videos: List[VideoSummaryItem]
    created_at: Optional[str]
    completed_at: Optional[str]


class SearchResultItem(BaseModel):
    id: int
    type: str  # "video" ou "playlist"
    title: Optional[str]
    thumbnail_url: Optional[str]
    score: float = 0.0
    created_at: Optional[str]


class SearchResponse(BaseModel):
    query: str
    videos: List[VideoSummaryItem]
    playlists: List[PlaylistSummaryItem]
    total_videos: int
    total_playlists: int


class SemanticSearchResponse(BaseModel):
    query: str
    query_keywords: List[str]
    results: List[SearchResultItem]
    total_results: int


class HistoryStatsResponse(BaseModel):
    total_videos: int
    total_playlists: int
    total_words: int
    total_duration_seconds: int
    total_duration_formatted: str
    categories: dict


# ═══════════════════════════════════════════════════════════════════════════════
# 📹 HISTORIQUE VIDÉOS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/videos", response_model=VideoHistoryResponse)
async def get_videos_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère l'historique des vidéos simples (hors playlists).
    """
    items, total = await get_user_history(
        session=session,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        category=category,
        search=search,
        favorites_only=favorites_only,
        exclude_playlists=True
    )
    
    return VideoHistoryResponse(
        items=[
            VideoSummaryItem(
                id=item.id,
                video_id=item.video_id,
                video_title=item.video_title,
                video_channel=item.video_channel or "Unknown",
                video_duration=item.video_duration or 0,
                thumbnail_url=item.thumbnail_url or f"https://img.youtube.com/vi/{item.video_id}/mqdefault.jpg",
                category=item.category,
                mode=item.mode,
                lang=item.lang,
                word_count=item.word_count or 0,
                reliability_score=item.reliability_score,
                is_favorite=item.is_favorite or False,
                has_transcript=bool(item.transcript_context),
                created_at=item.created_at.isoformat() if item.created_at else None
            )
            for item in items
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page > 0 else 0
    )


@router.get("/videos/{summary_id}")
async def get_video_detail(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère le détail complet d'une vidéo pour réouvrir le chat.
    """
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return {
        "id": summary.id,
        "video_id": summary.video_id,
        "video_title": summary.video_title,
        "video_channel": summary.video_channel,
        "video_duration": summary.video_duration or 0,
        "video_url": summary.video_url,
        "thumbnail_url": summary.thumbnail_url or f"https://img.youtube.com/vi/{summary.video_id}/mqdefault.jpg",
        "category": summary.category,
        "mode": summary.mode,
        "lang": summary.lang,
        "summary_content": summary.summary_content,
        "transcript_context": summary.transcript_context,  # Pour le chat
        "word_count": summary.word_count or 0,
        "reliability_score": summary.reliability_score,
        "is_favorite": summary.is_favorite or False,
        "notes": summary.notes,
        "tags": summary.tags,
        "has_transcript": bool(summary.transcript_context),
        "created_at": summary.created_at.isoformat() if summary.created_at else None
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 HISTORIQUE PLAYLISTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/playlists", response_model=PlaylistHistoryResponse)
async def get_playlists_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère l'historique des playlists/corpus.
    """
    items, total = await get_user_playlists(
        session=session,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        search=search,
        status=status
    )
    
    return PlaylistHistoryResponse(
        items=[
            PlaylistSummaryItem(
                playlist_id=item.playlist_id,
                playlist_title=item.playlist_title,
                playlist_url=item.playlist_url,
                num_videos=item.num_videos or 0,
                num_processed=item.num_processed or 0,
                total_duration=item.total_duration or 0,
                total_words=item.total_words or 0,
                status=item.status or "pending",
                has_meta_analysis=bool(item.meta_analysis),
                created_at=item.created_at.isoformat() if item.created_at else None,
                completed_at=item.completed_at.isoformat() if item.completed_at else None
            )
            for item in items
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page > 0 else 0
    )


@router.get("/playlists/{playlist_id}", response_model=PlaylistDetailResponse)
async def get_playlist_detail(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère le détail d'une playlist avec toutes ses vidéos individuelles.
    """
    playlist, videos = await get_playlist_with_videos(session, playlist_id, current_user.id)
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return PlaylistDetailResponse(
        playlist_id=playlist.playlist_id,
        playlist_title=playlist.playlist_title,
        playlist_url=playlist.playlist_url,
        num_videos=playlist.num_videos or 0,
        num_processed=playlist.num_processed or 0,
        total_duration=playlist.total_duration or 0,
        total_words=playlist.total_words or 0,
        status=playlist.status or "pending",
        meta_analysis=playlist.meta_analysis,
        videos=[
            VideoSummaryItem(
                id=v.id,
                video_id=v.video_id,
                video_title=v.video_title,
                video_channel=v.video_channel or "Unknown",
                video_duration=v.video_duration or 0,
                thumbnail_url=v.thumbnail_url or f"https://img.youtube.com/vi/{v.video_id}/mqdefault.jpg",
                category=v.category,
                mode=v.mode,
                lang=v.lang,
                word_count=v.word_count or 0,
                reliability_score=v.reliability_score,
                is_favorite=v.is_favorite or False,
                has_transcript=bool(v.transcript_context),
                created_at=v.created_at.isoformat() if v.created_at else None
            )
            for v in videos
        ],
        created_at=playlist.created_at.isoformat() if playlist.created_at else None,
        completed_at=playlist.completed_at.isoformat() if playlist.completed_at else None
    )


@router.get("/playlists/{playlist_id}/videos/{video_id}")
async def get_playlist_video_detail(
    playlist_id: str,
    video_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère le détail d'une vidéo spécifique d'une playlist.
    """
    video = await get_playlist_video(session, playlist_id, video_id, current_user.id)
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found in playlist")
    
    return {
        "id": video.id,
        "video_id": video.video_id,
        "video_title": video.video_title,
        "video_channel": video.video_channel,
        "video_duration": video.video_duration or 0,
        "thumbnail_url": video.thumbnail_url or f"https://img.youtube.com/vi/{video.video_id}/mqdefault.jpg",
        "category": video.category,
        "mode": video.mode,
        "lang": video.lang,
        "summary_content": video.summary_content,
        "transcript_context": video.transcript_context,
        "word_count": video.word_count or 0,
        "reliability_score": video.reliability_score,
        "playlist_position": video.playlist_position,
        "has_transcript": bool(video.transcript_context),
        "created_at": video.created_at.isoformat() if video.created_at else None
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 RECHERCHE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/search", response_model=SearchResponse)
async def search_history(
    q: str = Query(..., min_length=1, description="Terme de recherche"),
    include_videos: bool = True,
    include_playlists: bool = True,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Recherche simple dans l'historique (titre, chaîne).
    """
    results = await search_history_simple(
        session=session,
        user_id=current_user.id,
        query=q,
        include_videos=include_videos,
        include_playlists=include_playlists,
        limit=limit
    )
    
    return SearchResponse(
        query=q,
        videos=[
            VideoSummaryItem(
                id=v.id,
                video_id=v.video_id,
                video_title=v.video_title,
                video_channel=v.video_channel or "Unknown",
                video_duration=v.video_duration or 0,
                thumbnail_url=v.thumbnail_url or f"https://img.youtube.com/vi/{v.video_id}/mqdefault.jpg",
                category=v.category,
                mode=v.mode,
                lang=v.lang,
                word_count=v.word_count or 0,
                reliability_score=v.reliability_score,
                is_favorite=v.is_favorite or False,
                has_transcript=bool(v.transcript_context),
                created_at=v.created_at.isoformat() if v.created_at else None
            )
            for v in results["videos"]
        ],
        playlists=[
            PlaylistSummaryItem(
                playlist_id=p.playlist_id,
                playlist_title=p.playlist_title,
                playlist_url=p.playlist_url,
                num_videos=p.num_videos or 0,
                num_processed=p.num_processed or 0,
                total_duration=p.total_duration or 0,
                total_words=p.total_words or 0,
                status=p.status or "pending",
                has_meta_analysis=bool(p.meta_analysis),
                created_at=p.created_at.isoformat() if p.created_at else None,
                completed_at=p.completed_at.isoformat() if p.completed_at else None
            )
            for p in results["playlists"]
        ],
        total_videos=results["total_videos"],
        total_playlists=results["total_playlists"]
    )


@router.get("/search/semantic", response_model=SemanticSearchResponse)
async def search_history_by_content(
    q: str = Query(..., min_length=2, description="Mots-clés à rechercher dans le contenu"),
    include_videos: bool = True,
    include_playlists: bool = True,
    min_score: float = Query(0.1, ge=0, le=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Recherche sémantique dans le contenu des résumés et méta-analyses.
    """
    results = await search_history_semantic(
        session=session,
        user_id=current_user.id,
        query=q,
        include_videos=include_videos,
        include_playlists=include_playlists,
        min_score=min_score,
        limit=limit
    )
    
    # Fusionner et trier les résultats par score
    all_results = []
    
    for v_result in results["videos"]:
        v = v_result["item"]
        all_results.append(SearchResultItem(
            id=v.id,
            type="video",
            title=v.video_title,
            thumbnail_url=v.thumbnail_url or f"https://img.youtube.com/vi/{v.video_id}/mqdefault.jpg",
            score=v_result["score"],
            created_at=v.created_at.isoformat() if v.created_at else None
        ))
    
    for p_result in results["playlists"]:
        p = p_result["item"]
        all_results.append(SearchResultItem(
            id=0,  # Utiliser playlist_id à la place
            type="playlist",
            title=p.playlist_title,
            thumbnail_url=None,
            score=p_result["score"],
            created_at=p.created_at.isoformat() if p.created_at else None
        ))
    
    # Trier par score décroissant
    all_results.sort(key=lambda x: x.score, reverse=True)
    
    return SemanticSearchResponse(
        query=q,
        query_keywords=results["query_keywords"],
        results=all_results[:limit],
        total_results=results["total_results"]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATISTIQUES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", response_model=HistoryStatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère les statistiques de l'historique.
    """
    stats = await get_history_stats(session, current_user.id)
    
    # Formater la durée
    seconds = stats["total_duration_seconds"]
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    duration_formatted = f"{hours}h {minutes}min" if hours > 0 else f"{minutes}min"
    
    return HistoryStatsResponse(
        total_videos=stats["total_videos"],
        total_playlists=stats["total_playlists"],
        total_words=stats["total_words"],
        total_duration_seconds=seconds,
        total_duration_formatted=duration_formatted,
        categories=stats["categories"]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️ SUPPRESSION
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/videos/{summary_id}")
async def delete_video(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Supprime une vidéo de l'historique.
    """
    deleted = await delete_summary(session, summary_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return {"success": True, "message": "Video deleted"}


@router.delete("/playlists/{playlist_id}")
async def delete_playlist_endpoint(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Supprime une playlist et toutes ses vidéos.
    """
    count = await delete_playlist(session, playlist_id, current_user.id)
    if count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return {"success": True, "message": f"Playlist deleted ({count} items removed)"}


@router.delete("/clear")
async def clear_history_by_type(
    type: str = Query("all", description="Type to clear: all, videos, playlists"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🗑️ Supprime l'historique par type.
    
    - type=all: Supprime vidéos ET playlists
    - type=videos: Supprime uniquement les vidéos
    - type=playlists: Supprime uniquement les playlists
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🗑️ Clear history request: type={type}, user_id={current_user.id}")
    
    if type not in ["all", "videos", "playlists"]:
        raise HTTPException(status_code=400, detail="Invalid type. Use: all, videos, playlists")
    
    include_playlists = type in ["all", "playlists"]
    include_videos = type in ["all", "videos"]
    
    try:
        count = await delete_all_history(
            session, 
            current_user.id, 
            include_playlists=include_playlists,
            include_videos=include_videos
        )
        
        logger.info(f"✅ History cleared: {count} items removed")
        
        return {
            "success": True, 
            "type": type,
            "count": count,
            "message": f"History cleared: {count} items removed"
        }
    except Exception as e:
        logger.error(f"❌ Error clearing history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/all")
async def clear_all_history(
    include_playlists: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Supprime tout l'historique (legacy endpoint).
    """
    count = await delete_all_history(session, current_user.id, include_playlists)
    return {"success": True, "message": f"History cleared ({count} items removed)"}


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 KEYWORDS (Widget "Le Saviez-Vous") - Avec définitions IA
# ═══════════════════════════════════════════════════════════════════════════════

# Cache simple en mémoire pour les définitions générées
_definitions_cache: Dict[str, dict] = {}

class KeywordItem(BaseModel):
    """Mot-clé extrait d'une analyse avec définition"""
    term: str
    summary_id: int
    video_title: Optional[str]
    video_id: Optional[str]
    category: Optional[str]
    created_at: Optional[str]
    # NOUVEAU: Définition générée par IA
    definition: Optional[str] = None
    short_definition: Optional[str] = None


class KeywordsResponse(BaseModel):
    """Réponse avec tous les mots-clés de l'historique"""
    keywords: List[KeywordItem]
    total: int
    has_history: bool


async def _generate_definitions_batch(terms: List[str]) -> Dict[str, dict]:
    """
    Génère des définitions pour un lot de termes via Mistral.
    Utilise le cache pour éviter les appels répétés.
    """
    from videos.enriched_definitions import categorize_with_mistral

    # Filtrer les termes déjà en cache
    terms_to_fetch = [t for t in terms if t.lower() not in _definitions_cache]

    if terms_to_fetch:
        try:
            # Générer les définitions via Mistral
            definitions = await categorize_with_mistral(
                terms=terms_to_fetch[:20],  # Limiter à 20 termes par appel
                context="Mots-clés extraits d'analyses vidéo YouTube",
                language="fr"
            )

            # Mettre en cache
            for term_lower, data in definitions.items():
                _definitions_cache[term_lower] = data

        except Exception as e:
            print(f"⚠️ [Keywords] Could not generate definitions: {e}")

    return _definitions_cache


@router.get("/keywords", response_model=KeywordsResponse)
async def get_all_keywords(
    limit: int = Query(100, ge=1, le=500),
    with_definitions: bool = Query(True, description="Inclure les définitions IA"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🧠 Récupère tous les mots-clés extraits des analyses de l'utilisateur.

    Utilisé pour le widget "Le Saviez-Vous" qui affiche un mot aléatoire
    et permet de naviguer vers l'analyse source.

    Params:
    - limit: Nombre max de mots-clés (défaut: 100)
    - with_definitions: Si True, génère des définitions via Mistral (défaut: True)

    Retourne:
    - keywords: Liste de mots-clés avec définitions et source
    - total: Nombre total de mots-clés
    - has_history: True si l'utilisateur a des analyses
    """
    from sqlalchemy import select
    from db.database import Summary

    # Récupérer toutes les analyses avec des tags
    stmt = (
        select(Summary)
        .where(Summary.user_id == current_user.id)
        .where(Summary.tags.isnot(None))
        .where(Summary.tags != "")
        .order_by(Summary.created_at.desc())
    )

    result = await session.execute(stmt)
    summaries = result.scalars().all()

    # Extraire tous les mots-clés avec leur source
    keywords_raw = []
    seen_terms = set()  # Pour éviter les doublons

    for summary in summaries:
        if not summary.tags:
            continue

        # Parser les tags (comma-separated)
        tags = [t.strip() for t in summary.tags.split(",") if t.strip()]

        for tag in tags:
            # Éviter les doublons tout en gardant trace de la première occurrence
            tag_lower = tag.lower()
            if tag_lower in seen_terms:
                continue
            seen_terms.add(tag_lower)

            keywords_raw.append({
                "term": tag,
                "summary_id": summary.id,
                "video_title": summary.video_title,
                "video_id": summary.video_id,
                "category": summary.category,
                "created_at": summary.created_at.isoformat() if summary.created_at else None
            })

            # Limiter le nombre total
            if len(keywords_raw) >= limit:
                break

        if len(keywords_raw) >= limit:
            break

    # Générer les définitions si demandé
    if with_definitions and keywords_raw:
        terms = [k["term"] for k in keywords_raw]
        definitions = await _generate_definitions_batch(terms)

        # Ajouter les définitions aux keywords
        for kw in keywords_raw:
            term_lower = kw["term"].lower()
            if term_lower in definitions:
                def_data = definitions[term_lower]
                kw["definition"] = def_data.get("definition", "")
                # Créer une version courte (première phrase ou 100 caractères)
                full_def = def_data.get("definition", "")
                if full_def:
                    # Prendre la première phrase ou tronquer
                    first_sentence = full_def.split('.')[0] + '.' if '.' in full_def else full_def
                    kw["short_definition"] = first_sentence[:100] + ('...' if len(first_sentence) > 100 else '')
                else:
                    kw["short_definition"] = None
                # Utiliser la catégorie de Mistral si disponible
                if def_data.get("category"):
                    kw["category"] = def_data["category"]

    # Construire la réponse
    keywords = [KeywordItem(**kw) for kw in keywords_raw]

    return KeywordsResponse(
        keywords=keywords,
        total=len(keywords),
        has_history=len(summaries) > 0
    )
