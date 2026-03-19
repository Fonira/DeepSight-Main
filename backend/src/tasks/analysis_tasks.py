"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 ANALYSIS TASKS v2.0 — Tâches d'Analyse Asynchrones                             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  TÂCHES:                                                                           ║
║  • analyze_video_task: Analyse complète d'une vidéo YouTube                       ║
║  • analyze_playlist_task: Analyse batch d'une playlist                            ║
║  • generate_tts_task: Génération audio TTS                                        ║
║  • enrich_analysis_task: Enrichissement web post-analyse                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from celery import shared_task, chain, group
from celery.exceptions import SoftTimeLimitExceeded

from tasks.celery_app import celery_app, BaseTask, TaskPriority

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 ASYNC HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def run_async(coro):
    """Execute async function in sync context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 VIDEO ANALYSIS TASK
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.analyze_video_task',
    max_retries=3,
    soft_time_limit=300,  # 5 minutes
    time_limit=600,       # 10 minutes hard limit
)
def analyze_video_task(
    self,
    video_id: str,
    user_id: int,
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    category: str = "auto",
    web_enrich: bool = False,
) -> Dict[str, Any]:
    """
    Tâche d'analyse complète d'une vidéo YouTube.
    
    Args:
        video_id: ID de la vidéo YouTube
        user_id: ID de l'utilisateur
        mode: Mode d'analyse (accessible, standard, expert)
        lang: Langue de sortie (fr, en)
        model: Modèle Mistral à utiliser
        category: Catégorie ou "auto" pour détection
        web_enrich: Activer l'enrichissement Perplexity
    
    Returns:
        Dict avec summary_id et métadonnées
    """
    print(f"🎬 [TASK] Starting video analysis: {video_id} for user {user_id}", flush=True)
    
    try:
        return run_async(_analyze_video_async(
            self, video_id, user_id, mode, lang, model, category, web_enrich
        ))
    except SoftTimeLimitExceeded:
        print(f"⚠️ [TASK] Soft time limit exceeded for {video_id}", flush=True)
        raise
    except Exception as e:
        print(f"❌ [TASK] Analysis failed for {video_id}: {e}", flush=True)
        raise


async def _analyze_video_async(
    task: BaseTask,
    video_id: str,
    user_id: int,
    mode: str,
    lang: str,
    model: str,
    category: str,
    web_enrich: bool,
) -> Dict[str, Any]:
    """Implémentation async de l'analyse vidéo"""
    
    # Import des dépendances (lazy pour éviter les imports circulaires)
    from db.database import async_session_maker, Summary, User
    from sqlalchemy import select
    from core.cache import cache
    from transcripts.youtube import get_transcript_with_timestamps
    from videos.analysis import generate_summary, detect_category, extract_entities
    
    async with async_session_maker() as db:
        # ═══════════════════════════════════════════════════════════════════════
        # 📊 STEP 1: Vérifier le cache
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(0, 100, "Vérification du cache...")
        
        cached = await cache.get_analysis(video_id, user_id)
        if cached:
            print(f"✅ [TASK] Cache hit for {video_id}", flush=True)
            return cached
        
        # ═══════════════════════════════════════════════════════════════════════
        # 📝 STEP 2: Récupérer la transcription
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(10, 100, "Récupération de la transcription...")
        
        # Check transcript cache
        transcript = await cache.get_transcript(video_id)
        
        if not transcript:
            transcript_result = await get_transcript_with_timestamps(video_id, lang)
            if not transcript_result or not transcript_result.get("text"):
                raise ValueError(f"Could not retrieve transcript for video {video_id}")
            
            transcript = transcript_result["text"]
            await cache.cache_transcript(video_id, transcript)
        
        task.update_progress(30, 100, "Transcription récupérée")
        
        # ═══════════════════════════════════════════════════════════════════════
        # 🎯 STEP 3: Détecter la catégorie
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(35, 100, "Détection de la catégorie...")
        
        if category == "auto":
            detected = detect_category(title="", transcript=transcript[:5000])
            category = detected[0] if detected else "general"
        
        # ═══════════════════════════════════════════════════════════════════════
        # 🌐 STEP 4: Enrichissement web (optionnel)
        # ═══════════════════════════════════════════════════════════════════════
        web_context = None
        if web_enrich:
            task.update_progress(40, 100, "Recherche de contexte web...")
            try:
                from videos.web_enrichment import get_web_context_for_analysis
                web_context = await get_web_context_for_analysis(
                    transcript[:3000],
                    lang=lang
                )
            except Exception as e:
                print(f"⚠️ [TASK] Web enrichment failed: {e}", flush=True)
        
        # ═══════════════════════════════════════════════════════════════════════
        # 🧠 STEP 5: Générer l'analyse
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(50, 100, "Analyse IA en cours...")
        
        summary_content = await generate_summary(
            title="",  # Will be fetched from metadata
            transcript=transcript,
            category=category,
            lang=lang,
            mode=mode,
            model=model,
            web_context=web_context,
        )
        
        if not summary_content:
            raise ValueError("Failed to generate summary")
        
        task.update_progress(80, 100, "Analyse générée")
        
        # ═══════════════════════════════════════════════════════════════════════
        # 🏷️ STEP 6: Extraire les entités
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(85, 100, "Extraction des entités...")
        
        entities = await extract_entities(summary_content, lang=lang)
        
        # ═══════════════════════════════════════════════════════════════════════
        # 💾 STEP 7: Sauvegarder en base
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(90, 100, "Sauvegarde...")
        
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Create summary
        summary = Summary(
            user_id=user_id,
            video_id=video_id,
            summary_content=summary_content,
            transcript_context=transcript[:5000],
            category=category,
            lang=lang,
            mode=mode,
            model_used=model,
            word_count=len(summary_content.split()),
            entities_extracted=json.dumps(entities) if entities else None,
        )
        
        db.add(summary)
        
        # Update user stats
        user.total_videos += 1
        user.total_words += len(summary_content.split())
        if user.credits > 0:
            user.credits -= 1
        
        await db.commit()
        await db.refresh(summary)
        
        # ═══════════════════════════════════════════════════════════════════════
        # 📦 STEP 8: Cache et retour
        # ═══════════════════════════════════════════════════════════════════════
        task.update_progress(100, 100, "Terminé!")
        
        result = {
            "summary_id": summary.id,
            "video_id": video_id,
            "word_count": summary.word_count,
            "category": category,
            "entities": entities,
            "created_at": summary.created_at.isoformat() if summary.created_at else None,
        }
        
        # Cache the result
        await cache.cache_analysis(video_id, user_id, result)
        
        # Invalidate user history cache
        await cache.delete_pattern(f"history:{user_id}:*")
        
        print(f"✅ [TASK] Analysis complete: {video_id} -> summary {summary.id}", flush=True)
        
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 PLAYLIST ANALYSIS TASK
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.analyze_playlist_task',
    max_retries=2,
    soft_time_limit=1800,  # 30 minutes
    time_limit=3600,       # 1 hour hard limit
)
def analyze_playlist_task(
    self,
    playlist_id: str,
    user_id: int,
    video_ids: List[str],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
) -> Dict[str, Any]:
    """
    Tâche d'analyse batch d'une playlist.
    
    Analyse chaque vidéo séquentiellement avec gestion de la progression.
    """
    print(f"📋 [TASK] Starting playlist analysis: {playlist_id} ({len(video_ids)} videos)", flush=True)
    
    results = []
    errors = []
    
    for i, video_id in enumerate(video_ids):
        try:
            self.update_progress(i, len(video_ids), f"Analyse de la vidéo {i+1}/{len(video_ids)}")
            
            # Call video analysis task synchronously
            result = analyze_video_task.apply(
                args=(video_id, user_id),
                kwargs={'mode': mode, 'lang': lang, 'model': model},
            ).get(timeout=300)  # 5 min max per video
            
            results.append(result)
            
        except Exception as e:
            print(f"⚠️ [TASK] Video {video_id} failed: {e}", flush=True)
            errors.append({"video_id": video_id, "error": str(e)})
    
    self.update_progress(len(video_ids), len(video_ids), "Playlist analysée!")
    
    return {
        "playlist_id": playlist_id,
        "total_videos": len(video_ids),
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TTS GENERATION TASK
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.generate_tts_task',
    max_retries=3,
    soft_time_limit=60,   # 1 minute
    time_limit=120,       # 2 minutes
)
def generate_tts_task(
    self,
    summary_id: int,
    user_id: int,
    voice: str = "alloy",
    provider: str = "openai",
) -> Dict[str, Any]:
    """
    Génère l'audio TTS pour un résumé.
    """
    print(f"🎙️ [TASK] Generating TTS for summary {summary_id}", flush=True)
    
    return run_async(_generate_tts_async(self, summary_id, user_id, voice, provider))


async def _generate_tts_async(
    task: BaseTask,
    summary_id: int,
    user_id: int,
    voice: str,
    provider: str,
) -> Dict[str, Any]:
    """Implémentation async de la génération TTS"""
    
    from db.database import async_session_maker, Summary
    from sqlalchemy import select
    from tts.service import generate_audio
    from core.cache import cache
    
    async with async_session_maker() as db:
        # Get summary
        result = await db.execute(
            select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id)
        )
        summary = result.scalar_one_or_none()
        
        if not summary:
            raise ValueError(f"Summary {summary_id} not found")
        
        task.update_progress(20, 100, "Génération audio...")
        
        # Generate audio
        audio_data = await generate_audio(
            text=summary.summary_content[:4000],  # Limit text length
            voice=voice,
            provider=provider,
        )
        
        if not audio_data:
            raise ValueError("Failed to generate audio")
        
        task.update_progress(80, 100, "Sauvegarde audio...")
        
        # Store audio (base64 or file path depending on implementation)
        # This is a placeholder - actual implementation would save to S3/storage
        
        task.update_progress(100, 100, "Audio généré!")
        
        return {
            "summary_id": summary_id,
            "audio_size": len(audio_data) if audio_data else 0,
            "voice": voice,
            "provider": provider,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 WEB ENRICHMENT TASK
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.enrich_analysis_task',
    max_retries=2,
    soft_time_limit=60,
    time_limit=120,
)
def enrich_analysis_task(
    self,
    summary_id: int,
    user_id: int,
) -> Dict[str, Any]:
    """
    Enrichit une analyse existante avec du contexte web.
    Utilisé pour les utilisateurs premium qui veulent mettre à jour une analyse.
    """
    print(f"🌐 [TASK] Enriching analysis {summary_id}", flush=True)
    
    return run_async(_enrich_analysis_async(self, summary_id, user_id))


async def _enrich_analysis_async(
    task: BaseTask,
    summary_id: int,
    user_id: int,
) -> Dict[str, Any]:
    """Implémentation async de l'enrichissement"""
    
    from db.database import async_session_maker, Summary
    from sqlalchemy import select
    from videos.web_enrichment import enrich_existing_analysis
    
    async with async_session_maker() as db:
        result = await db.execute(
            select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id)
        )
        summary = result.scalar_one_or_none()
        
        if not summary:
            raise ValueError(f"Summary {summary_id} not found")
        
        task.update_progress(30, 100, "Recherche d'informations actuelles...")
        
        enriched_content = await enrich_existing_analysis(
            original_content=summary.summary_content,
            video_title=summary.video_title or "",
            lang=summary.lang or "fr",
        )
        
        task.update_progress(80, 100, "Mise à jour de l'analyse...")
        
        if enriched_content:
            summary.summary_content = enriched_content
            summary.fact_check_result = json.dumps({"enriched_at": datetime.utcnow().isoformat()})
            await db.commit()
        
        task.update_progress(100, 100, "Enrichissement terminé!")
        
        return {
            "summary_id": summary_id,
            "enriched": bool(enriched_content),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 TASK CHAINS (Workflows)
# ═══════════════════════════════════════════════════════════════════════════════

def create_full_analysis_workflow(
    video_id: str,
    user_id: int,
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    generate_tts: bool = False,
    web_enrich: bool = False,
) -> chain:
    """
    Crée un workflow complet: analyse + TTS + enrichissement.
    
    Usage:
        workflow = create_full_analysis_workflow(
            video_id="abc123",
            user_id=1,
            generate_tts=True,
        )
        result = workflow.apply_async()
    """
    tasks = [
        analyze_video_task.s(video_id, user_id, mode, lang, model, "auto", web_enrich),
    ]
    
    # Add TTS if requested
    if generate_tts:
        # This will receive the result of the previous task
        tasks.append(generate_tts_task.s(user_id))
    
    return chain(*tasks)
