"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📜 HISTORY SERVICE v5.0 — HISTORIQUE COMPLET AVEC RECHERCHE SÉMANTIQUE            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 📹 Historique des vidéos simples                                                ║
║  • 📚 Historique des playlists/corpus avec vidéos individuelles                    ║
║  • 🔍 Recherche simple (titre, chaîne)                                             ║
║  • 🧠 Recherche sémantique (mots-clés dans le contenu)                             ║
║  • 💬 Accès au Chat IA depuis l'historique (transcriptions sauvegardées)           ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import time
from collections import Counter
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, func, or_, and_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from db.database import Summary, PlaylistAnalysis, User


# Colonnes légères pour la liste d'historique (exclut summary_content, transcript_context, etc.)
HISTORY_LIST_COLUMNS = [
    Summary.id,
    Summary.video_id,
    Summary.video_title,
    Summary.video_channel,
    Summary.video_duration,
    Summary.thumbnail_url,
    Summary.category,
    Summary.mode,
    Summary.lang,
    Summary.word_count,
    Summary.reliability_score,
    Summary.is_favorite,
    Summary.playlist_id,
    Summary.platform,       # 🎵 youtube | tiktok
    Summary.video_url,      # 🔗 URL originale (fallback détection plateforme)
    Summary.created_at,
    # has_transcript calculé en SQL au lieu de charger tout le transcript_context
    case(
        (Summary.transcript_context != None, True),
        else_=False
    ).label("has_transcript"),
]


# ═══════════════════════════════════════════════════════════════════════════════
# 📹 HISTORIQUE VIDÉOS SIMPLES
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_history(
    session: AsyncSession,
    user_id: int,
    page: int = 1,
    per_page: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    exclude_playlists: bool = True,
    cursor: Optional[int] = None
) -> Dict[str, Any]:
    """
    Récupère l'historique des vidéos de l'utilisateur.

    Optimisé:
    - Projection: seulement les colonnes légères (pas summary_content/transcript_context)
    - Cursor-based pagination (optionnel, en plus de offset)
    - has_transcript calculé en SQL via CASE
    - Query timing logué

    Args:
        cursor: ID du dernier item vu (cursor-based pagination). Si fourni,
                retourne les items avec id < cursor. Prioritaire sur page/offset.

    Returns:
        Dict avec keys: items (list of Row), total (int), next_cursor (int|None)
    """
    start = time.perf_counter()

    # ── Conditions de filtrage communes ──
    filters = [Summary.user_id == user_id]

    if exclude_playlists:
        filters.append(or_(Summary.playlist_id == None, Summary.playlist_id == ""))

    if category and category != "all":
        filters.append(Summary.category == category)

    if favorites_only:
        filters.append(Summary.is_favorite == True)

    if search:
        # SECURITY: Échapper les caractères spéciaux SQL LIKE
        safe_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_pattern = f"%{safe_search}%"
        filters.append(or_(
            Summary.video_title.ilike(search_pattern),
            Summary.video_channel.ilike(search_pattern)
        ))

    # ── Count query (séparée pour fiabilité avec cursor) ──
    count_query = select(func.count(Summary.id)).where(*filters)
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # ── Data query avec projection légère ──
    data_query = select(*HISTORY_LIST_COLUMNS).where(*filters)

    if cursor is not None:
        # Cursor-based: items plus anciens que le cursor
        data_query = data_query.where(Summary.id < cursor)
        data_query = data_query.order_by(desc(Summary.id)).limit(per_page)
    else:
        # Offset-based (rétro-compatible)
        offset = (page - 1) * per_page
        data_query = data_query.order_by(desc(Summary.created_at)).offset(offset).limit(per_page)

    result = await session.execute(data_query)
    items = result.all()

    # ── Next cursor ──
    next_cursor = items[-1].id if items else None

    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "history_query",
        user_id=user_id,
        total=total,
        returned=len(items),
        cursor=cursor,
        page=page,
        elapsed_ms=round(elapsed_ms, 1),
    )

    return {"items": items, "total": total, "next_cursor": next_cursor}


async def get_summary_by_id(
    session: AsyncSession, 
    summary_id: int, 
    user_id: int
) -> Optional[Summary]:
    """Récupère un résumé par son ID"""
    result = await session.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_summary_by_video_id(
    session: AsyncSession,
    video_id: str,
    user_id: int
) -> Optional[Summary]:
    """Récupère un résumé par l'ID de la vidéo YouTube"""
    result = await session.execute(
        select(Summary).where(
            Summary.video_id == video_id,
            Summary.user_id == user_id
        ).order_by(desc(Summary.created_at))
    )
    return result.scalars().first()


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 HISTORIQUE PLAYLISTS/CORPUS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_playlists(
    session: AsyncSession,
    user_id: int,
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None
) -> Tuple[List[PlaylistAnalysis], int]:
    """
    Récupère l'historique des playlists/corpus de l'utilisateur.
    """
    query = select(PlaylistAnalysis).where(PlaylistAnalysis.user_id == user_id)
    count_query = select(func.count(PlaylistAnalysis.id)).where(PlaylistAnalysis.user_id == user_id)
    
    # Filtrer par statut
    if status:
        query = query.where(PlaylistAnalysis.status == status)
        count_query = count_query.where(PlaylistAnalysis.status == status)
    
    # Recherche par titre
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.where(func.lower(PlaylistAnalysis.playlist_title).like(search_pattern))
        count_query = count_query.where(func.lower(PlaylistAnalysis.playlist_title).like(search_pattern))
    
    # Compter
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination et tri
    offset = (page - 1) * per_page
    query = query.order_by(desc(PlaylistAnalysis.created_at)).offset(offset).limit(per_page)
    
    result = await session.execute(query)
    items = result.scalars().all()
    
    return list(items), total


async def get_playlist_with_videos(
    session: AsyncSession,
    playlist_id: str,
    user_id: int
) -> Tuple[Optional[PlaylistAnalysis], List[Summary]]:
    """
    Récupère une playlist avec toutes ses vidéos individuelles.
    Retourne: (playlist_analysis, list_of_summaries)
    """
    # Récupérer la playlist
    playlist_result = await session.execute(
        select(PlaylistAnalysis).where(
            PlaylistAnalysis.playlist_id == playlist_id,
            PlaylistAnalysis.user_id == user_id
        )
    )
    playlist = playlist_result.scalar_one_or_none()
    
    # Récupérer les vidéos de la playlist
    videos_result = await session.execute(
        select(Summary).where(
            Summary.playlist_id == playlist_id,
            Summary.user_id == user_id
        ).order_by(Summary.playlist_position)
    )
    videos = list(videos_result.scalars().all())
    
    return playlist, videos


async def get_playlist_video(
    session: AsyncSession,
    playlist_id: str,
    video_id: str,
    user_id: int
) -> Optional[Summary]:
    """
    Récupère une vidéo spécifique d'une playlist.
    """
    result = await session.execute(
        select(Summary).where(
            Summary.playlist_id == playlist_id,
            Summary.video_id == video_id,
            Summary.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 RECHERCHE SIMPLE
# ═══════════════════════════════════════════════════════════════════════════════

async def search_history_simple(
    session: AsyncSession,
    user_id: int,
    query: str,
    include_videos: bool = True,
    include_playlists: bool = True,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Recherche simple dans l'historique (titre, chaîne).
    """
    results = {
        "videos": [],
        "playlists": [],
        "total_videos": 0,
        "total_playlists": 0
    }
    
    search_pattern = f"%{query.lower()}%"
    
    if include_videos:
        video_query = select(Summary).where(
            Summary.user_id == user_id,
            or_(
                func.lower(Summary.video_title).like(search_pattern),
                func.lower(Summary.video_channel).like(search_pattern)
            )
        ).order_by(desc(Summary.created_at)).limit(limit)
        
        video_result = await session.execute(video_query)
        results["videos"] = list(video_result.scalars().all())
        results["total_videos"] = len(results["videos"])
    
    if include_playlists:
        playlist_query = select(PlaylistAnalysis).where(
            PlaylistAnalysis.user_id == user_id,
            func.lower(PlaylistAnalysis.playlist_title).like(search_pattern)
        ).order_by(desc(PlaylistAnalysis.created_at)).limit(limit)
        
        playlist_result = await session.execute(playlist_query)
        results["playlists"] = list(playlist_result.scalars().all())
        results["total_playlists"] = len(results["playlists"])
    
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 RECHERCHE SÉMANTIQUE (Mots-clés dans le contenu)
# ═══════════════════════════════════════════════════════════════════════════════

# Stopwords pour le scoring
STOPWORDS_FR = frozenset([
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "mais",
    "donc", "car", "ni", "que", "qui", "quoi", "dont", "où", "ce", "cette",
    "ces", "son", "sa", "ses", "notre", "votre", "leur", "dans", "sur",
    "pour", "par", "avec", "sans", "sous", "entre", "vers", "chez",
    "est", "sont", "être", "avoir", "fait", "faire", "peut", "tout",
    "plus", "moins", "très", "bien", "aussi", "comme", "quand", "si"
])

STOPWORDS_EN = frozenset([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "this",
    "that", "these", "those", "it", "its", "they", "them", "their"
])


def extract_keywords(text: str) -> List[str]:
    """Extrait les mots-clés significatifs d'un texte."""
    if not text:
        return []
    
    # Normaliser et tokenizer
    text = text.lower()
    words = re.findall(r'\b[a-zàâäéèêëïîôùûüç]{3,}\b', text)
    
    # Filtrer stopwords
    all_stopwords = STOPWORDS_FR | STOPWORDS_EN
    keywords = [w for w in words if w not in all_stopwords]
    
    return keywords


def calculate_relevance_score(content: str, search_keywords: List[str]) -> float:
    """
    Calcule un score de pertinence entre 0 et 1.
    """
    if not content or not search_keywords:
        return 0.0
    
    content_lower = content.lower()
    content_keywords = extract_keywords(content)
    
    # Score basé sur les correspondances exactes
    exact_matches = sum(1 for kw in search_keywords if kw in content_lower)
    
    # Score basé sur la fréquence des mots-clés
    keyword_counts = Counter(content_keywords)
    frequency_score = sum(keyword_counts.get(kw, 0) for kw in search_keywords)
    
    # Normaliser
    max_possible = len(search_keywords) * 10
    raw_score = (exact_matches * 5) + frequency_score
    
    return min(1.0, raw_score / max_possible) if max_possible > 0 else 0.0


async def search_history_semantic(
    session: AsyncSession,
    user_id: int,
    query: str,
    include_videos: bool = True,
    include_playlists: bool = True,
    min_score: float = 0.1,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Recherche sémantique dans l'historique.
    Cherche dans le contenu des résumés et méta-analyses.
    """
    results = {
        "videos": [],
        "playlists": [],
        "query_keywords": [],
        "total_results": 0
    }
    
    # Extraire les mots-clés de la recherche
    search_keywords = extract_keywords(query)
    results["query_keywords"] = search_keywords
    
    if not search_keywords:
        return results
    
    # Recherche dans les vidéos
    if include_videos:
        video_query = select(Summary).where(Summary.user_id == user_id)
        video_result = await session.execute(video_query)
        all_videos = video_result.scalars().all()
        
        scored_videos = []
        for video in all_videos:
            # Combiner titre + résumé + transcription pour le scoring
            content = f"{video.video_title or ''} {video.summary_content or ''} {video.transcript_context or ''}"
            score = calculate_relevance_score(content, search_keywords)
            
            if score >= min_score:
                scored_videos.append({
                    "item": video,
                    "score": score,
                    "type": "video"
                })
        
        # Trier par score et limiter
        scored_videos.sort(key=lambda x: x["score"], reverse=True)
        results["videos"] = scored_videos[:limit]
    
    # Recherche dans les playlists
    if include_playlists:
        playlist_query = select(PlaylistAnalysis).where(
            PlaylistAnalysis.user_id == user_id,
            PlaylistAnalysis.status == "completed"
        )
        playlist_result = await session.execute(playlist_query)
        all_playlists = playlist_result.scalars().all()
        
        scored_playlists = []
        for playlist in all_playlists:
            # Combiner titre + méta-analyse
            content = f"{playlist.playlist_title or ''} {playlist.meta_analysis or ''}"
            score = calculate_relevance_score(content, search_keywords)
            
            if score >= min_score:
                scored_playlists.append({
                    "item": playlist,
                    "score": score,
                    "type": "playlist"
                })
        
        scored_playlists.sort(key=lambda x: x["score"], reverse=True)
        results["playlists"] = scored_playlists[:limit]
    
    results["total_results"] = len(results["videos"]) + len(results["playlists"])
    
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATISTIQUES
# ═══════════════════════════════════════════════════════════════════════════════

async def get_history_stats(
    session: AsyncSession,
    user_id: int
) -> Dict[str, Any]:
    """
    Récupère les statistiques de l'historique.
    """
    # Vidéos simples (hors playlists)
    video_count = await session.execute(
        select(func.count(Summary.id)).where(
            Summary.user_id == user_id,
            or_(Summary.playlist_id == None, Summary.playlist_id == "")
        )
    )
    
    # Playlists complétées
    playlist_count = await session.execute(
        select(func.count(PlaylistAnalysis.id)).where(
            PlaylistAnalysis.user_id == user_id,
            PlaylistAnalysis.status == "completed"
        )
    )
    
    # Total mots générés
    total_words = await session.execute(
        select(func.sum(Summary.word_count)).where(Summary.user_id == user_id)
    )
    
    # Total durée vidéos
    total_duration = await session.execute(
        select(func.sum(Summary.video_duration)).where(Summary.user_id == user_id)
    )
    
    # Catégories
    categories = await session.execute(
        select(Summary.category, func.count(Summary.id)).where(
            Summary.user_id == user_id
        ).group_by(Summary.category)
    )
    
    return {
        "total_videos": video_count.scalar() or 0,
        "total_playlists": playlist_count.scalar() or 0,
        "total_words": total_words.scalar() or 0,
        "total_duration_seconds": total_duration.scalar() or 0,
        "categories": dict(categories.all())
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️ SUPPRESSION
# ═══════════════════════════════════════════════════════════════════════════════

async def delete_summary(
    session: AsyncSession,
    summary_id: int,
    user_id: int
) -> bool:
    """Supprime un résumé."""
    summary = await get_summary_by_id(session, summary_id, user_id)
    if summary:
        await session.delete(summary)
        await session.commit()
        return True
    return False


async def delete_playlist(
    session: AsyncSession,
    playlist_id: str,
    user_id: int
) -> int:
    """
    Supprime une playlist et toutes ses vidéos.
    Retourne le nombre d'éléments supprimés.
    """
    from sqlalchemy import delete
    
    # Supprimer les vidéos de la playlist
    videos_deleted = await session.execute(
        delete(Summary).where(
            Summary.playlist_id == playlist_id,
            Summary.user_id == user_id
        )
    )
    
    # Supprimer la playlist
    playlist_deleted = await session.execute(
        delete(PlaylistAnalysis).where(
            PlaylistAnalysis.playlist_id == playlist_id,
            PlaylistAnalysis.user_id == user_id
        )
    )
    
    await session.commit()
    
    return videos_deleted.rowcount + playlist_deleted.rowcount


async def delete_all_history(
    session: AsyncSession,
    user_id: int,
    include_playlists: bool = False,
    include_videos: bool = True
) -> int:
    """
    🗑️ Supprime l'historique de l'utilisateur par type.
    
    IMPORTANT: Supprime d'abord les chat_messages (FK) avant les summaries.
    
    Args:
        session: Session DB
        user_id: ID de l'utilisateur
        include_playlists: Supprimer les playlists
        include_videos: Supprimer les vidéos individuelles
    
    Returns:
        Nombre d'éléments supprimés
    """
    from sqlalchemy import delete, and_
    from db.database import ChatMessage, PlaylistChatMessage
    
    import logging
    logger = logging.getLogger(__name__)
    
    count = 0
    
    try:
        # ════════════════════════════════════════════════════════════════════════
        # 🔴 ÉTAPE 1: Supprimer les CHAT MESSAGES d'abord (contrainte FK)
        # ════════════════════════════════════════════════════════════════════════
        
        if include_playlists and include_videos:
            # Supprimer TOUS les chat_messages de l'utilisateur
            chat_result = await session.execute(
                delete(ChatMessage).where(ChatMessage.user_id == user_id)
            )
            logger.info(f"🗑️ Deleted {chat_result.rowcount} chat messages")
            
            # Supprimer TOUS les playlist_chat_messages
            playlist_chat_result = await session.execute(
                delete(PlaylistChatMessage).where(PlaylistChatMessage.user_id == user_id)
            )
            logger.info(f"🗑️ Deleted {playlist_chat_result.rowcount} playlist chat messages")
            
        elif include_playlists:
            # Récupérer les summary_ids des playlists
            playlist_summary_ids = await session.execute(
                select(Summary.id).where(
                    and_(
                        Summary.user_id == user_id,
                        Summary.playlist_id != None,
                        Summary.playlist_id != ""
                    )
                )
            )
            ids_to_delete = [row[0] for row in playlist_summary_ids.fetchall()]
            
            if ids_to_delete:
                await session.execute(
                    delete(ChatMessage).where(ChatMessage.summary_id.in_(ids_to_delete))
                )
            
            # Supprimer les playlist_chat_messages
            await session.execute(
                delete(PlaylistChatMessage).where(PlaylistChatMessage.user_id == user_id)
            )
            
        elif include_videos:
            # Récupérer les summary_ids des vidéos individuelles
            video_summary_ids = await session.execute(
                select(Summary.id).where(
                    and_(
                        Summary.user_id == user_id,
                        or_(Summary.playlist_id == None, Summary.playlist_id == "")
                    )
                )
            )
            ids_to_delete = [row[0] for row in video_summary_ids.fetchall()]
            
            if ids_to_delete:
                await session.execute(
                    delete(ChatMessage).where(ChatMessage.summary_id.in_(ids_to_delete))
                )
        
        # ════════════════════════════════════════════════════════════════════════
        # 🔴 ÉTAPE 2: Supprimer les SUMMARIES et PLAYLISTS
        # ════════════════════════════════════════════════════════════════════════
        
        if include_playlists and include_videos:
            # Supprimer les playlists
            playlist_result = await session.execute(
                delete(PlaylistAnalysis).where(PlaylistAnalysis.user_id == user_id)
            )
            count += playlist_result.rowcount
            logger.info(f"🗑️ Deleted {playlist_result.rowcount} playlists")
            
            # Supprimer TOUTES les vidéos
            video_result = await session.execute(
                delete(Summary).where(Summary.user_id == user_id)
            )
            count += video_result.rowcount
            logger.info(f"🗑️ Deleted {video_result.rowcount} summaries")
            
        elif include_playlists:
            # Supprimer les playlists
            playlist_result = await session.execute(
                delete(PlaylistAnalysis).where(PlaylistAnalysis.user_id == user_id)
            )
            count += playlist_result.rowcount
            
            # Supprimer les vidéos de playlists
            playlist_videos_result = await session.execute(
                delete(Summary).where(
                    and_(
                        Summary.user_id == user_id,
                        Summary.playlist_id != None,
                        Summary.playlist_id != ""
                    )
                )
            )
            count += playlist_videos_result.rowcount
            
        elif include_videos:
            # Supprimer seulement les vidéos individuelles
            video_result = await session.execute(
                delete(Summary).where(
                    and_(
                        Summary.user_id == user_id,
                        or_(Summary.playlist_id == None, Summary.playlist_id == "")
                    )
                )
            )
            count += video_result.rowcount
        
        await session.commit()
        logger.info(f"✅ Total deleted: {count} items")
        return count
        
    except Exception as e:
        logger.error(f"❌ Error in delete_all_history: {e}")
        await session.rollback()
        raise e


async def update_summary(
    session: AsyncSession,
    summary_id: int,
    user_id: int,
    **kwargs
) -> Optional[Summary]:
    """Met à jour un résumé."""
    summary = await get_summary_by_id(session, summary_id, user_id)
    if not summary:
        return None
    
    for key, value in kwargs.items():
        if hasattr(summary, key):
            setattr(summary, key, value)
    
    await session.commit()
    await session.refresh(summary)
    return summary
