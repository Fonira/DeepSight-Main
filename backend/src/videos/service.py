"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📹 VIDEO SERVICE v5.0 — Gestion des vidéos et analyses                            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🆕 v5.0: DÉTECTION INTELLIGENTE pour Chat IA                                      ║
║  • Recherche web automatique si question post-cutoff 2024                          ║
║  • Détection des données dynamiques (prix, positions, stats)                       ║
║  • Vérification de faits en temps réel                                             ║
║  • Uniquement pour Pro et Expert                                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import httpx
from uuid import uuid4
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple, AsyncGenerator
from sqlalchemy import select, func, desc, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import (
    ChatMessage, ChatQuota, Summary, User, WebSearchUsage,
    PlaylistAnalysis, TaskStatus, CreditTransaction
)
from core.config import get_mistral_key, get_perplexity_key, PLAN_LIMITS


# ═══════════════════════════════════════════════════════════════════════════════
# 🎫 GESTION DES CRÉDITS ET QUOTAS (via module centralisé)
# ═══════════════════════════════════════════════════════════════════════════════

from core.credits import (
    calculate_analysis_cost,
    calculate_chat_cost,
    check_credits,
    deduct_credits,
    MODEL_COSTS
)


async def check_can_analyze(
    session: AsyncSession,
    user_id: int,
    model: str = "mistral-small-latest",
    duration_minutes: int = 15,
    with_web_search: bool = False
) -> Tuple[bool, str, int, int]:
    """
    Vérifie si l'utilisateur peut analyser une vidéo.
    Retourne: (can_analyze, reason, credits_remaining, cost)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, "user_not_found", 0, 0
    
    credits = user.credits or 0
    
    # Calculer le coût estimé
    cost_info = calculate_analysis_cost(
        model=model,
        duration_minutes=duration_minutes,
        with_web_search=with_web_search
    )
    required_credits = cost_info["total"]
    
    if credits < required_credits:
        return False, f"insufficient_credits:{required_credits - credits}", credits, required_credits
    
    return True, "ok", credits, required_credits


async def deduct_credit(
    session: AsyncSession,
    user_id: int,
    amount: int = 1,
    description: str = "Video analysis",
    action_type: str = "analysis"
) -> bool:
    """Déduit des crédits à l'utilisateur"""
    success, _ = await deduct_credits(
        session=session,
        user_id=user_id,
        amount=amount,
        action_type=action_type,
        description=description
    )
    return success


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 GESTION DES RÉSUMÉS
# ═══════════════════════════════════════════════════════════════════════════════

async def save_summary(
    session: AsyncSession,
    user_id: int,
    video_id: str,
    video_title: str,
    video_channel: str,
    video_duration: int,
    video_url: str,
    thumbnail_url: str,
    category: str,
    category_confidence: float,
    lang: str,
    mode: str,
    model_used: str,
    summary_content: str,
    transcript_context: Optional[str] = None,
    video_upload_date: Optional[str] = None,
    entities_extracted: Optional[Dict] = None,
    reliability_score: Optional[float] = None,
    fact_check_result: Optional[str] = None,
    enrichment_data: Optional[Dict] = None
) -> int:
    """Sauvegarde un nouveau résumé et retourne son ID"""
    print(f"💾 [save_summary v2] Saving video_id={video_id}, user_id={user_id}", flush=True)
    
    # 🏷️ Extraire automatiquement les concepts [[marqués]] du résumé
    extracted_tags = []
    if summary_content:
        import re
        pattern = r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]'
        matches = re.findall(pattern, summary_content)
        seen = set()
        for match in matches:
            term = match.strip()
            if term and term.lower() not in seen:
                extracted_tags.append(term)
                seen.add(term.lower())
        if extracted_tags:
            print(f"🏷️ [save_summary] Extracted {len(extracted_tags)} concepts: {extracted_tags[:5]}...")

    # 🔄 FALLBACK: Si pas de [[concepts]], extraire des mots-clés automatiquement
    if not extracted_tags and summary_content:
        print("⚠️ [save_summary] No [[concepts]] found, using fallback extraction...")

        # 1. Utiliser les entités extraites si disponibles
        if entities_extracted:
            for entity in entities_extracted[:10]:
                if isinstance(entity, dict):
                    name = entity.get('name', entity.get('term', ''))
                elif isinstance(entity, str):
                    name = entity
                else:
                    continue
                if name and len(name) > 2 and name.lower() not in seen:
                    extracted_tags.append(name)
                    seen.add(name.lower())

        # 2. Extraire les noms propres (mots avec majuscule au milieu du texte)
        if len(extracted_tags) < 5:
            # Pattern pour noms propres: mots capitalisés qui ne sont pas en début de phrase
            proper_nouns = re.findall(r'(?<=[.!?]\s|:\s|,\s|\n)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)', summary_content)
            # Aussi chercher les groupes de mots capitalisés
            proper_nouns += re.findall(r'\b([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)\b', summary_content)

            # Mots à ignorer
            stopwords = {'Le', 'La', 'Les', 'Un', 'Une', 'Des', 'Ce', 'Cette', 'Ces', 'Il', 'Elle',
                        'Ils', 'Elles', 'On', 'Nous', 'Vous', 'The', 'This', 'That', 'These', 'Those',
                        'Dans', 'Pour', 'Avec', 'Sans', 'Sur', 'Sous', 'Par', 'En', 'De', 'Du',
                        'Mais', 'Ou', 'Et', 'Donc', 'Or', 'Ni', 'Car', 'Cela', 'Ceci', 'Ainsi'}

            for noun in proper_nouns:
                noun = noun.strip()
                if (noun and len(noun) > 2
                    and noun not in stopwords
                    and noun.lower() not in seen
                    and not noun.isdigit()):
                    extracted_tags.append(noun)
                    seen.add(noun.lower())
                    if len(extracted_tags) >= 8:
                        break

        if extracted_tags:
            print(f"🏷️ [save_summary] Fallback extracted {len(extracted_tags)} keywords: {extracted_tags[:5]}...")
    
    summary = Summary(
        user_id=user_id,
        video_id=video_id,
        video_title=video_title,
        video_channel=video_channel,
        video_duration=video_duration,
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        video_upload_date=video_upload_date,
        category=category,
        category_confidence=category_confidence,
        lang=lang,
        mode=mode,
        model_used=model_used,
        summary_content=summary_content,
        transcript_context=transcript_context,
        word_count=len(summary_content.split()) if summary_content else 0,
        fact_check_result=fact_check_result,
        entities_extracted=json.dumps(entities_extracted) if entities_extracted else None,
        reliability_score=reliability_score,
        tags=','.join(extracted_tags) if extracted_tags else None,  # 🏷️ Stocker les concepts
        is_favorite=False
    )
    
    # Ajouter enrichment_data si le modèle le supporte
    if enrichment_data and hasattr(summary, 'enrichment_data'):
        summary.enrichment_data = json.dumps(enrichment_data)
    
    session.add(summary)
    
    # Mettre à jour les stats utilisateur
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.total_videos = (user.total_videos or 0) + 1
        user.total_words = (user.total_words or 0) + summary.word_count
    
    await session.commit()
    await session.refresh(summary)
    return summary.id


async def get_summary_by_id(
    session: AsyncSession,
    summary_id: int,
    user_id: int
) -> Optional[Summary]:
    """Récupère un résumé par ID"""
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
    """
    Récupère le résumé le plus récent pour une vidéo (pour le cache).
    
    IMPORTANT: Un utilisateur peut avoir PLUSIEURS résumés pour la même vidéo
    (différents modes, re-analyses). On retourne le plus récent avec limit(1).
    
    BUG FIX: scalar_one_or_none() échoue si plusieurs lignes existent.
    Solution: limit(1) + scalars().first()
    """
    result = await session.execute(
        select(Summary).where(
            Summary.video_id == video_id,
            Summary.user_id == user_id
        ).order_by(desc(Summary.created_at)).limit(1)
    )
    return result.scalars().first()


async def get_user_history(
    session: AsyncSession,
    user_id: int,
    page: int = 1,
    per_page: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False
) -> Tuple[List[Summary], int]:
    """
    Récupère l'historique des résumés d'un utilisateur.

    SECURITY: Le paramètre search est échappé pour éviter les injections SQL LIKE.
    PERFORMANCE: Utilise une seule requête optimisée avec COUNT OVER().
    """
    query = select(Summary).where(Summary.user_id == user_id)

    if category:
        query = query.where(Summary.category == category)

    if search:
        # SECURITY: Échapper les caractères spéciaux SQL LIKE (%, _, \)
        safe_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_pattern = f"%{safe_search}%"
        query = query.where(
            Summary.video_title.ilike(search_pattern) |
            Summary.video_channel.ilike(search_pattern)
        )

    if favorites_only:
        query = query.where(Summary.is_favorite == True)

    # Compter le total
    count_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Pagination
    query = query.order_by(desc(Summary.created_at))
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await session.execute(query)
    summaries = result.scalars().all()

    return list(summaries), total


async def update_summary(
    session: AsyncSession,
    summary_id: int,
    user_id: int,
    updates: Dict[str, Any]
) -> Optional[Summary]:
    """Met à jour un résumé"""
    summary = await get_summary_by_id(session, summary_id, user_id)
    if not summary:
        return None
    
    for key, value in updates.items():
        if hasattr(summary, key):
            setattr(summary, key, value)
    
    await session.commit()
    await session.refresh(summary)
    return summary


async def delete_summary(
    session: AsyncSession,
    summary_id: int,
    user_id: int
) -> bool:
    """Supprime un résumé"""
    summary = await get_summary_by_id(session, summary_id, user_id)
    if not summary:
        return False
    
    await session.delete(summary)
    await session.commit()
    return True


async def delete_all_history(
    session: AsyncSession,
    user_id: int
) -> int:
    """Supprime tout l'historique d'un utilisateur"""
    result = await session.execute(
        sql_delete(Summary).where(Summary.user_id == user_id)
    )
    await session.commit()
    return result.rowcount


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 GESTION DES PLAYLISTS
# ═══════════════════════════════════════════════════════════════════════════════

async def create_playlist_analysis(
    session: AsyncSession,
    user_id: int,
    playlist_id: str,
    playlist_url: str,
    playlist_title: str,
    num_videos: int
) -> PlaylistAnalysis:
    """Crée une nouvelle analyse de playlist"""
    analysis = PlaylistAnalysis(
        user_id=user_id,
        playlist_id=playlist_id,
        playlist_url=playlist_url,
        playlist_title=playlist_title,
        num_videos=num_videos,
        status="pending"
    )
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)
    return analysis


async def get_user_playlists(
    session: AsyncSession,
    user_id: int,
    limit: int = 20,
    offset: int = 0
) -> Tuple[List[PlaylistAnalysis], int]:
    """Récupère les playlists d'un utilisateur"""
    count_result = await session.execute(
        select(func.count()).where(PlaylistAnalysis.user_id == user_id)
    )
    total = count_result.scalar() or 0
    
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.user_id == user_id)
        .order_by(desc(PlaylistAnalysis.created_at))
        .offset(offset)
        .limit(limit)
    )
    playlists = result.scalars().all()
    
    return list(playlists), total


async def get_playlist_summaries(
    session: AsyncSession,
    playlist_id: str,
    user_id: int
) -> List[Summary]:
    """Récupère les résumés d'une playlist"""
    result = await session.execute(
        select(Summary)
        .where(
            Summary.playlist_id == playlist_id,
            Summary.user_id == user_id
        )
        .order_by(Summary.playlist_position)
    )
    return list(result.scalars().all())


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 STATISTIQUES
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_stats(
    session: AsyncSession,
    user_id: int
) -> Dict[str, Any]:
    """Récupère les statistiques d'un utilisateur"""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return {}
    
    # Compter les résumés
    summary_count = await session.execute(
        select(func.count()).where(Summary.user_id == user_id)
    )
    
    # Compter les playlists
    playlist_count = await session.execute(
        select(func.count()).where(PlaylistAnalysis.user_id == user_id)
    )
    
    return {
        "total_videos": summary_count.scalar() or 0,
        "total_words": user.total_words or 0,
        "total_playlists": playlist_count.scalar() or 0,
        "credits": user.credits,
        "plan": user.plan
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 GESTION DES TÂCHES ASYNCHRONES
# ═══════════════════════════════════════════════════════════════════════════════

async def create_task(
    session: AsyncSession,
    task_id: str,
    user_id: int,
    task_type: str
) -> str:
    """Crée une nouvelle tâche et retourne son ID"""
    task = TaskStatus(
        task_id=task_id,
        user_id=user_id,
        task_type=task_type,
        status="pending",
        progress=0
    )
    session.add(task)
    await session.commit()
    
    return task_id


async def update_task_status(
    session: AsyncSession,
    task_id: str,
    status: str,
    progress: int = 0,
    result: Optional[Dict] = None,
    error: Optional[str] = None
):
    """Met à jour le statut d'une tâche"""
    query_result = await session.execute(
        select(TaskStatus).where(TaskStatus.task_id == task_id)
    )
    task = query_result.scalar_one_or_none()
    
    if task:
        task.status = status
        task.progress = progress
        if result:
            task.result = json.dumps(result)
        if error:
            task.error_message = error
        task.updated_at = datetime.now()
        await session.commit()


async def get_task(
    session: AsyncSession,
    task_id: str
) -> Optional[TaskStatus]:
    """Récupère le statut d'une tâche (ORM object)"""
    result = await session.execute(
        select(TaskStatus).where(TaskStatus.task_id == task_id)
    )
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 IMPORT DU SERVICE D'ENRICHISSEMENT v3.0
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from videos.web_enrichment import (
        enrich_chat_if_needed, needs_web_search_for_chat,
        get_enrichment_level, get_enrichment_badge,
        EnrichmentLevel, get_enrichment_config
    )
    ENRICHMENT_AVAILABLE = True
except ImportError:
    ENRICHMENT_AVAILABLE = False
    print("⚠️ [CHAT] Web enrichment not available", flush=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUOTAS CHAT
# ═══════════════════════════════════════════════════════════════════════════════

async def check_chat_quota(
    session: AsyncSession,
    user_id: int,
    summary_id: int
) -> Tuple[bool, str, Dict[str, int]]:
    """
    Vérifie si l'utilisateur peut poser une question.
    Retourne: (can_ask, reason, quota_info)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, "user_not_found", {}
    
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    
    daily_limit = limits.get("chat_daily_limit", 10)
    per_video_limit = limits.get("chat_per_video_limit", 5)
    
    # -1 = illimité
    if daily_limit == -1 and per_video_limit == -1:
        return True, "unlimited", {"daily_limit": -1, "per_video_limit": -1}
    
    today = date.today().isoformat()
    
    # Vérifier le quota journalier
    if daily_limit != -1:
        daily_result = await session.execute(
            select(ChatQuota).where(
                ChatQuota.user_id == user_id,
                ChatQuota.quota_date == today
            )
        )
        daily_quota = daily_result.scalar_one_or_none()
        daily_used = daily_quota.daily_count if daily_quota else 0
        
        if daily_used >= daily_limit:
            return False, "daily_limit_reached", {
                "daily_limit": daily_limit,
                "daily_used": daily_used,
                "per_video_limit": per_video_limit
            }
    else:
        daily_used = 0
    
    # Vérifier le quota par vidéo
    if per_video_limit != -1:
        video_result = await session.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.user_id == user_id,
                ChatMessage.summary_id == summary_id,
                ChatMessage.role == "user"
            )
        )
        video_used = video_result.scalar() or 0
        
        if video_used >= per_video_limit:
            return False, "video_limit_reached", {
                "daily_limit": daily_limit,
                "daily_used": daily_used,
                "per_video_limit": per_video_limit,
                "video_used": video_used
            }
    else:
        video_used = 0
    
    return True, "ok", {
        "daily_limit": daily_limit,
        "daily_used": daily_used,
        "per_video_limit": per_video_limit,
        "video_used": video_used
    }


async def increment_chat_quota(session: AsyncSession, user_id: int):
    """Incrémente le quota de chat journalier"""
    today = date.today().isoformat()
    
    result = await session.execute(
        select(ChatQuota).where(
            ChatQuota.user_id == user_id,
            ChatQuota.quota_date == today
        )
    )
    quota = result.scalar_one_or_none()
    
    if quota:
        quota.daily_count += 1
    else:
        quota = ChatQuota(
            user_id=user_id,
            quota_date=today,
            daily_count=1
        )
        session.add(quota)
    
    await session.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# 💬 MESSAGES CHAT
# ═══════════════════════════════════════════════════════════════════════════════

async def save_chat_message(
    session: AsyncSession,
    user_id: int,
    summary_id: int,
    role: str,
    content: str
) -> int:
    """Sauvegarde un message de chat"""
    message = ChatMessage(
        user_id=user_id,
        summary_id=summary_id,
        role=role,
        content=content
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message.id


async def get_chat_history(
    session: AsyncSession,
    summary_id: int,
    user_id: int,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Récupère l'historique de chat pour une vidéo"""
    result = await session.execute(
        select(ChatMessage)
        .where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    messages = result.scalars().all()
    
    return [
        {"role": m.role, "content": m.content, "created_at": m.created_at}
        for m in reversed(messages)
    ]


async def clear_chat_history(
    session: AsyncSession,
    summary_id: int,
    user_id: int
) -> int:
    """Efface l'historique de chat pour une vidéo"""
    from sqlalchemy import delete
    
    result = await session.execute(
        delete(ChatMessage).where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id
        )
    )
    await session.commit()
    return result.rowcount


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 GÉNÉRATION RÉPONSE CHAT v4.0
# ═══════════════════════════════════════════════════════════════════════════════

# Import du système de recherche intelligente
try:
    from .smart_search import get_smart_transcript_context
    SMART_SEARCH_AVAILABLE = True
except ImportError:
    SMART_SEARCH_AVAILABLE = False
    print("⚠️ Smart search not available", flush=True)


def build_chat_prompt(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    mode: str,
    lang: str,
    video_duration: int = 0  # 🆕 Ajout durée pour les timecodes
) -> Tuple[str, str]:
    """
    Construit le prompt pour le chat.
    🆕 v4.1: Utilise la recherche intelligente pour les vidéos longues.
    Retourne: (system_prompt, user_prompt)
    """
    MODE_CONFIG = {
        "accessible": {
            "max_context": 12000,  # 🆕 v3.1: Augmenté pour meilleur contexte
            "style_fr": "Réponds de façon concise (2-4 phrases). Langage simple, accessible.",
            "style_en": "Answer concisely (2-4 sentences). Simple, accessible language."
        },
        "standard": {
            "max_context": 25000,  # 🆕 v3.1: Augmenté pour vidéos longues
            "style_fr": "Réponds de façon complète (4-8 phrases). Équilibre clarté et détail.",
            "style_en": "Answer completely (4-8 sentences). Balance clarity and detail."
        },
        "expert": {
            "max_context": 40000,  # 🆕 v3.1: Augmenté pour analyses exhaustives
            "style_fr": "Réponds de façon exhaustive et rigoureuse. Analyse critique.",
            "style_en": "Answer exhaustively and rigorously. Critical analysis."
        }
    }
    
    config = MODE_CONFIG.get(mode, MODE_CONFIG["standard"])
    style = config["style_fr"] if lang == "fr" else config["style_en"]
    max_context = config["max_context"]
    
    # Construire l'historique
    history_text = ""
    if chat_history:
        for msg in chat_history[-6:]:
            role = "Utilisateur" if msg["role"] == "user" else "Assistant"
            history_text += f"\n{role}: {msg['content']}"
    
    # 🆕 v4.1: Recherche intelligente pour les vidéos longues
    smart_search_used = False
    num_passages = 1
    
    if SMART_SEARCH_AVAILABLE and transcript:
        transcript_context, smart_search_used, num_passages = get_smart_transcript_context(
            question=question,
            transcript=transcript,
            video_duration=video_duration,
            max_context_words=max_context
        )
        if smart_search_used:
            print(f"🔍 [SMART SEARCH] Extracted {num_passages} relevant passages for: {question[:50]}...", flush=True)
    else:
        # Fallback: troncature simple
        transcript_context = transcript[:max_context] if transcript else ""
    
    # Note pour le LLM sur la recherche intelligente
    smart_search_note = ""
    if smart_search_used:
        if lang == "fr":
            smart_search_note = f"""
⚠️ NOTE: Cette vidéo est LONGUE. Seuls les {num_passages} passages les plus pertinents pour ta question ont été extraits.
Si tu ne trouves pas l'information, suggère à l'utilisateur de reformuler sa question avec d'autres mots-clés.
"""
        else:
            smart_search_note = f"""
⚠️ NOTE: This is a LONG video. Only the {num_passages} most relevant passages for your question were extracted.
If you can't find the information, suggest the user rephrase their question with different keywords.
"""
    
    if lang == "fr":
        system_prompt = f"""Tu es Deep Sight, assistant IA expert pour répondre aux questions sur les vidéos YouTube.

📺 VIDÉO: {video_title}

{style}
{smart_search_note}

═══════════════════════════════════════════════════════════════════════════════
⏱️ TIMECODES CLIQUABLES OBLIGATOIRES
═══════════════════════════════════════════════════════════════════════════════

IMPORTANT: Quand tu réponds, INCLUS des timecodes [MM:SS] avec CROCHETS pour que l'utilisateur puisse cliquer dessus et accéder directement au passage.

Format STRICT: "À [5:23], l'auteur explique que..."

✅ EXEMPLES CORRECTS:
- "Ce concept est introduit à [2:15] puis développé à [7:30]"
- "L'intervenant mentionne à [12:45] que..."
- "Voir les explications détaillées entre [3:00] et [5:30]"

❌ INTERDIT: Format (MM:SS) avec parenthèses - utilise [MM:SS] avec crochets!

RÈGLES:
1. Base tes réponses UNIQUEMENT sur le contenu de la vidéo
2. Si l'info n'est pas dans la vidéo, dis-le clairement
3. Cite les passages pertinents avec timecodes
4. Distingue ce qui vient de la vidéo de ton analyse
"""
        
        user_prompt = f"""📋 RÉSUMÉ DE LA VIDÉO:
{summary[:3000] if summary else "Non disponible"}

📝 TRANSCRIPTION:
{transcript_context}

HISTORIQUE DE LA CONVERSATION:{history_text}

QUESTION: {question}

Réponds en français avec des timecodes:"""

    else:
        system_prompt = f"""You are Deep Sight, AI assistant expert for answering questions about YouTube videos.

📺 VIDEO: {video_title}

{style}
{smart_search_note}

MANDATORY CLICKABLE TIMECODES: Include timecodes [MM:SS] with BRACKETS in your answers.
Format: "At [5:23], the author explains..."
DO NOT use (MM:SS) format - use [MM:SS] with square brackets!

RULES:
1. Base answers ONLY on video content
2. If info isn't in the video, say so clearly
3. Cite relevant passages with timecodes
4. Distinguish video content from your analysis
"""
        
        user_prompt = f"""📋 VIDEO SUMMARY:
{summary[:3000] if summary else "Not available"}

📝 TRANSCRIPT:
{transcript_context}

CONVERSATION HISTORY:{history_text}

QUESTION: {question}

Answer in English with timecodes:"""

    return system_prompt, user_prompt


async def generate_chat_response(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-latest",
    api_key: str = None,
    video_duration: int = 0  # 🆕 Pour la recherche intelligente
) -> Optional[str]:
    """Génère une réponse de chat avec Mistral"""
    api_key = api_key or get_mistral_key()
    if not api_key:
        return None
    
    system_prompt, user_prompt = build_chat_prompt(
        question, video_title, transcript, summary, chat_history, mode, lang,
        video_duration=video_duration  # 🆕
    )
    
    max_tokens = {
        "accessible": 800,
        "standard": 1500,
        "expert": 3000
    }.get(mode, 1500)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3
                },
                timeout=60
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"].strip()
            else:
                print(f"❌ Chat API error: {response.status_code}", flush=True)
                return None
                
    except Exception as e:
        print(f"❌ Chat generation error: {e}", flush=True)
        return None


async def generate_chat_response_stream(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-latest",
    api_key: str = None,
    video_duration: int = 0  # 🆕 Pour la recherche intelligente
) -> AsyncGenerator[str, None]:
    """Génère une réponse de chat en streaming"""
    api_key = api_key or get_mistral_key()
    if not api_key:
        yield "Error: API key not configured"
        return
    
    system_prompt, user_prompt = build_chat_prompt(
        question, video_title, transcript, summary, chat_history, mode, lang,
        video_duration=video_duration  # 🆕
    )
    
    max_tokens = {"accessible": 800, "standard": 1500, "expert": 3000}.get(mode, 1500)
    
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                    "stream": True
                },
                timeout=120
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk["choices"][0]["delta"].get("content", "")
                            if content:
                                yield content
                        except:
                            continue
    except Exception as e:
        yield f"Error: {e}"


async def generate_chat_response_v4(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    user_plan: str,
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-latest",
    web_search_requested: bool = False,
    video_duration: int = 0  # 🆕 Pour la recherche intelligente
) -> Tuple[str, List[Dict[str, str]], bool]:
    """
    🆕 v5.0: Génère une réponse chat avec détection INTELLIGENTE des infos post-cutoff.
    
    La recherche web est déclenchée automatiquement si:
    - La question concerne des événements post-2024 (cutoff Mistral)
    - La question demande des données qui changent (prix, positions, stats)
    - La question est une vérification de faits actuels
    - L'utilisateur a demandé explicitement une recherche web
    
    UNIQUEMENT pour Pro et Expert.
    
    Args:
        question: Question de l'utilisateur
        video_title: Titre de la vidéo
        transcript: Transcription
        summary: Résumé de la vidéo
        chat_history: Historique du chat
        user_plan: Plan de l'utilisateur
        mode: Mode d'analyse
        lang: Langue
        model: Modèle Mistral
        web_search_requested: Si l'utilisateur a demandé explicitement une recherche web
    
    Returns:
        Tuple[response, sources, web_search_used]
    """
    print(f"💬 [CHAT v5.0] Generating response for plan: {user_plan}", flush=True)
    
    # Variables pour l'enrichissement web
    web_context = None
    sources = []
    web_search_used = False
    
    # 1. Vérifier si on doit faire une recherche web AVANT Mistral
    if ENRICHMENT_AVAILABLE:
        enrichment_level = get_enrichment_level(user_plan)
        
        # Seuls Pro et Expert ont l'enrichissement
        if enrichment_level != EnrichmentLevel.NONE:
            should_search = False
            search_reason = ""
            
            if web_search_requested:
                # L'utilisateur a demandé explicitement une recherche web
                should_search = True
                search_reason = "user_requested"
                print(f"🌐 [CHAT v5.0] Web search explicitly requested by user", flush=True)
            else:
                # Détection INTELLIGENTE: la question nécessite-t-elle des infos récentes?
                should_search, search_reason = needs_web_search_for_chat(question, video_title)
                if should_search:
                    print(f"🔍 [CHAT v5.0] Intelligent detection triggered: {search_reason}", flush=True)
            
            if should_search:
                try:
                    video_context = f"Vidéo: {video_title}\n\nRésumé: {summary[:1500]}"
                    
                    web_context, sources, was_enriched = await enrich_chat_if_needed(
                        question=question,
                        video_title=video_title,
                        video_context=video_context,
                        plan=user_plan,
                        lang=lang
                    )
                    
                    if was_enriched and web_context:
                        web_search_used = True
                        print(f"✅ [CHAT v5.0] Got web context: {len(web_context)} chars, {len(sources)} sources", flush=True)
                    else:
                        print(f"⚠️ [CHAT v5.0] Web search returned no useful context", flush=True)
                        
                except Exception as e:
                    print(f"⚠️ [CHAT v5.0] Web enrichment failed: {e}", flush=True)
    
    # 2. Générer la réponse avec Mistral (avec contexte web si disponible)
    base_response = await generate_chat_response(
        question=question,
        video_title=video_title,
        transcript=transcript,
        summary=summary,
        chat_history=chat_history,
        mode=mode,
        lang=lang,
        model=model,
        video_duration=video_duration  # 🆕 Pour la recherche intelligente
    )
    
    if not base_response:
        return "Désolé, je n'ai pas pu générer de réponse.", [], False
    
    print(f"✅ [CHAT v5.0] Base response: {len(base_response)} chars", flush=True)
    
    # 3. Si on a du contexte web, l'ajouter à la réponse
    if web_search_used and web_context:
        # Ajouter le contexte web à la fin de la réponse
        web_section_header = "📡 **Informations web actuelles:**" if lang == "fr" else "📡 **Current web information:**"
        
        base_response = f"""{base_response}

---

{web_section_header}

{web_context}"""
        
        print(f"✅ [CHAT v5.0] Added web context to response", flush=True)
    
    return base_response, sources, web_search_used


def _should_auto_enrich_chat(question: str, video_title: str) -> bool:
    """
    Détermine si une question devrait automatiquement déclencher 
    un enrichissement Perplexity (pour Pro/Expert).
    """
    question_lower = question.lower()
    
    # Mots-clés qui déclenchent l'enrichissement
    TRIGGER_KEYWORDS = [
        # Vérification
        "vrai", "faux", "vérifier", "confirmer", "exact", "correct",
        "true", "false", "verify", "confirm", "accurate",
        # Actualité
        "actuel", "récent", "aujourd'hui", "maintenant", "dernière",
        "current", "recent", "today", "now", "latest",
        # Sources
        "source", "preuve", "étude", "recherche", "données",
        "evidence", "study", "research", "data",
        # Comparaison
        "comparer", "différence", "alternative", "autre",
        "compare", "difference", "alternative", "other",
        # Questions factuelles
        "combien", "quand", "où", "qui a", "statistique",
        "how many", "when", "where", "who", "statistic"
    ]
    
    # Vérifier si la question contient des mots-clés déclencheurs
    for keyword in TRIGGER_KEYWORDS:
        if keyword in question_lower:
            return True
    
    # Questions longues et complexes méritent souvent un enrichissement
    if len(question.split()) > 15:
        return True
    
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 PERPLEXITY (Recherche Web) - LEGACY + v4.0
# ═══════════════════════════════════════════════════════════════════════════════

async def check_web_search_quota(
    session: AsyncSession,
    user_id: int
) -> Tuple[bool, int, int]:
    """
    Vérifie le quota de recherche web.
    Retourne: (can_search, used, limit)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, 0, 0
    
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    
    if not limits.get("web_search_enabled", False):
        return False, 0, 0
    
    monthly_limit = limits.get("web_search_monthly", 0)
    if monthly_limit == -1:
        return True, 0, -1  # Illimité
    
    # Vérifier l'usage ce mois
    month = date.today().strftime("%Y-%m")
    usage_result = await session.execute(
        select(WebSearchUsage).where(
            WebSearchUsage.user_id == user_id,
            WebSearchUsage.month_year == month
        )
    )
    usage = usage_result.scalar_one_or_none()
    used = usage.search_count if usage else 0
    
    return used < monthly_limit, used, monthly_limit


async def increment_web_search_usage(session: AsyncSession, user_id: int):
    """Incrémente le compteur de recherche web"""
    month = date.today().strftime("%Y-%m")
    
    result = await session.execute(
        select(WebSearchUsage).where(
            WebSearchUsage.user_id == user_id,
            WebSearchUsage.month_year == month
        )
    )
    usage = result.scalar_one_or_none()
    
    if usage:
        usage.search_count += 1
        usage.last_search_at = datetime.now()
    else:
        usage = WebSearchUsage(
            user_id=user_id,
            month_year=month,
            search_count=1,
            last_search_at=datetime.now()
        )
        session.add(usage)
    
    await session.commit()


async def search_with_perplexity(
    question: str,
    context: str,
    lang: str = "fr"
) -> Optional[str]:
    """Fait une recherche web avec Perplexity (Legacy - utilisé pour le chat explicite)"""
    api_key = get_perplexity_key()
    if not api_key:
        return None
    
    prompt = f"""Recherche des informations actuelles sur cette question en lien avec le contexte suivant.

Contexte: {context[:2000]}

Question: {question}

Réponds en {"français" if lang == "fr" else "anglais"} avec des sources web récentes."""
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-sonar-small-128k-online",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1500,
                    "temperature": 0.2
                },
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            return None
    except Exception as e:
        print(f"❌ Perplexity error: {e}", flush=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE DE CHAT v4.0
# ═══════════════════════════════════════════════════════════════════════════════

async def process_chat_message_v4(
    session: AsyncSession,
    user_id: int,
    summary_id: int,
    question: str,
    web_search: bool = False,
    mode: str = "standard"
) -> Dict[str, Any]:
    """
    🆕 v4.0: Traite un message chat avec enrichissement progressif.
    
    Returns:
        {
            "response": str,
            "web_search_used": bool,
            "sources": List[Dict],
            "enrichment_level": str,
            "quota_info": Dict
        }
    """
    # 1. Vérifier les quotas
    can_ask, reason, quota_info = await check_chat_quota(session, user_id, summary_id)
    if not can_ask:
        return {
            "response": f"❌ Limite atteinte: {reason}",
            "web_search_used": False,
            "sources": [],
            "enrichment_level": "none",
            "quota_info": quota_info,
            "error": reason
        }
    
    # 2. Récupérer le résumé et le contexte
    result = await session.execute(select(Summary).where(Summary.id == summary_id))
    summary = result.scalar_one_or_none()
    
    if not summary:
        return {
            "response": "❌ Résumé non trouvé",
            "web_search_used": False,
            "sources": [],
            "enrichment_level": "none",
            "quota_info": quota_info,
            "error": "summary_not_found"
        }
    
    # 3. Récupérer l'utilisateur pour le plan
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    user_plan = user.plan if user else "free"
    
    # 4. Récupérer l'historique
    chat_history = await get_chat_history(session, summary_id, user_id, limit=10)
    
    # 5. Déterminer le modèle selon le plan
    plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
    model = plan_limits.get("default_model", "mistral-small-latest")
    
    # 6. Générer la réponse avec enrichissement v4.0
    response, sources, web_search_used = await generate_chat_response_v4(
        question=question,
        video_title=summary.video_title,
        transcript=summary.transcript_context or "",
        summary=summary.summary_content,
        chat_history=chat_history,
        user_plan=user_plan,
        mode=mode,
        lang=summary.lang or "fr",
        model=model,
        web_search_requested=web_search,
        video_duration=summary.video_duration or 0  # 🆕 Pour la recherche intelligente
    )
    
    # 7. Sauvegarder les messages
    await save_chat_message(session, user_id, summary_id, "user", question)
    await save_chat_message(session, user_id, summary_id, "assistant", response)
    
    # 8. Incrémenter les quotas
    await increment_chat_quota(session, user_id)
    if web_search_used:
        await increment_web_search_usage(session, user_id)
    
    # 9. Déterminer le niveau d'enrichissement
    enrichment_level = "none"
    if ENRICHMENT_AVAILABLE:
        level = get_enrichment_level(user_plan)
        enrichment_level = level.value
    
    return {
        "response": response,
        "web_search_used": web_search_used,
        "sources": sources,
        "enrichment_level": enrichment_level,
        "quota_info": quota_info
    }
