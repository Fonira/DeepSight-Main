"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🚀 PLAYLIST PIPELINE v5.0 — Traitement parallèle avec chunking adaptatif        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🔀 Parallélisme contrôlé : 3 vidéos simultanées, 2 chunks par vidéo             ║
║  🔪 Chunking adaptatif : vidéos de 10min à 4h+ gérées uniformément               ║
║  💾 Cache-first : réutilise les analyses existantes (0 crédit)                    ║
║  📊 Progress granulaire : étape par étape, intra-vidéo                            ║
║  🔗 Chain of Synthesis : chunks → merge → summary final par vidéo                 ║
║  🧠 Méta-analyse multi-pass : thèmes → connexions → synthèse globale             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import httpx
from uuid import uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List, Callable, Awaitable
from dataclasses import dataclass, field


from db.database import (
    User, Summary, PlaylistAnalysis, VideoChunk
)
from core.config import get_mistral_key
from videos.analysis import generate_summary, detect_category
from transcripts import (
    extract_video_id, get_video_info, get_transcript_with_timestamps
)

from .chunker import (
    create_chunking_plan, PlaylistChunk
)

import logging
logger = logging.getLogger("deepsight.playlists.pipeline")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

MAX_CONCURRENT_VIDEOS = 3       # Vidéos traitées en parallèle
MAX_CONCURRENT_CHUNKS = 2       # Chunks par vidéo en parallèle
CHUNK_SUMMARY_TIMEOUT = 120     # Timeout par chunk (secondes)
MERGE_SUMMARY_TIMEOUT = 180     # Timeout pour le merge final
MAX_RETRIES = 3                 # Retries par chunk
RETRY_DELAY = 2                 # Délai entre retries (secondes)

# Modèles par plan
PLAN_MODELS = {
    "free": "mistral-small-2603",
    "starter": "mistral-small-2603",
    "pro": "mistral-medium-2508",
    "expert": "mistral-large-2512",
    "unlimited": "mistral-large-2512",
}


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 DATACLASSES RÉSULTAT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VideoResult:
    """Résultat du traitement d'une seule vidéo."""
    video_id: str
    video_title: str
    video_channel: str
    duration: int
    category: str
    category_confidence: float
    summary_content: str
    full_digest: str                    # Digest complet (chunks concaténés)
    transcript_context: str             # Pour le chat
    word_count: int
    thumbnail_url: str
    position: int
    tier: str                           # Tier de chunking
    num_chunks: int
    was_cached: bool = False            # Réutilisé depuis le cache
    error: Optional[str] = None


@dataclass
class PipelineProgress:
    """État du pipeline pour le polling frontend."""
    total_videos: int
    completed_videos: int
    current_video_title: str = ""
    current_step: str = "init"          # init | transcript | chunking | summary | merge | meta
    current_chunk: int = 0
    total_chunks: int = 0
    percent: int = 0
    message: str = ""
    skipped_videos: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class PipelineResult:
    """Résultat final du pipeline complet."""
    corpus_id: str
    corpus_name: str
    videos: List[VideoResult]
    meta_analysis: str
    total_duration: int
    total_words: int
    num_processed: int
    num_skipped: int
    skipped_reasons: List[Dict[str, str]]
    processing_time_seconds: float


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 PROGRESS CALLBACK TYPE
# ═══════════════════════════════════════════════════════════════════════════════

ProgressCallback = Callable[[PipelineProgress], Awaitable[None]]


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PIPELINE PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

async def run_playlist_pipeline(
    urls: List[str],
    corpus_name: str,
    mode: str,
    lang: str,
    model: str,
    user_id: int,
    user_plan: str,
    on_progress: Optional[ProgressCallback] = None,
    playlist_id: Optional[str] = None,
) -> PipelineResult:
    """
    Pipeline principal d'analyse de playlist v5.0.

    Architecture :
    1. Phase PREP     — Extraction vidéo IDs + déduplication cache
    2. Phase PARALLEL — Traitement parallèle (3 vidéos, 2 chunks chacune)
    3. Phase META     — Méta-analyse multi-pass
    4. Phase PERSIST  — Sauvegarde BDD

    Args:
        urls: Liste d'URLs YouTube/TikTok
        corpus_name: Nom du corpus
        mode: accessible | standard | expert
        lang: fr | en
        model: Modèle Mistral
        user_id: ID utilisateur
        user_plan: Plan de l'utilisateur
        on_progress: Callback async pour mise à jour du progress
    """
    start_time = datetime.utcnow()
    corpus_id = playlist_id or f"corpus_{uuid4().hex[:12]}"

    progress = PipelineProgress(
        total_videos=len(urls),
        completed_videos=0,
        current_step="init",
        message="Préparation du pipeline..." if lang == "fr" else "Preparing pipeline..."
    )

    async def _notify(p: PipelineProgress):
        if on_progress:
            try:
                await on_progress(p)
            except Exception:
                pass

    await _notify(progress)

    # ─── PHASE 1 : PRÉPARATION + DÉDUPLICATION ───
    logger.info(f"pipeline_start: corpus={corpus_id} videos={len(urls)} model={model}")

    video_ids = []
    valid_urls = []
    for url in urls:
        vid = extract_video_id(url)
        if vid:
            video_ids.append(vid)
            valid_urls.append(url)
        else:
            progress.skipped_videos.append({"url": url, "reason": "URL invalide"})

    if not video_ids:
        raise ValueError("Aucune URL valide fournie")

    progress.total_videos = len(video_ids)
    progress.message = f"Analyse de {len(video_ids)} vidéos..." if lang == "fr" else f"Analyzing {len(video_ids)} videos..."
    progress.percent = 5
    await _notify(progress)

    # ─── PHASE 2 : TRAITEMENT PARALLÈLE DES VIDÉOS ───
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VIDEOS)
    results: List[Optional[VideoResult]] = [None] * len(video_ids)

    async def process_one_video(idx: int, video_id: str):
        async with semaphore:
            try:
                result = await _process_single_video(
                    video_id=video_id,
                    position=idx + 1,
                    mode=mode,
                    lang=lang,
                    model=model,
                    user_id=user_id,
                    progress=progress,
                    notify=_notify,
                )
                results[idx] = result
            except Exception as e:
                logger.error(f"pipeline_video_error: video={video_id} error={e}")
                progress.skipped_videos.append({
                    "video_id": video_id,
                    "reason": str(e)[:200]
                })
            finally:
                progress.completed_videos += 1
                progress.percent = 5 + int((progress.completed_videos / progress.total_videos) * 75)
                await _notify(progress)

    # Lancer toutes les vidéos en parallèle (contrôlé par semaphore)
    tasks = [
        asyncio.create_task(process_one_video(idx, vid))
        for idx, vid in enumerate(video_ids)
    ]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Filtrer les résultats valides
    valid_results = [r for r in results if r is not None]

    if not valid_results:
        raise ValueError(
            "Aucune vidéo n'a pu être analysée. "
            f"Raisons : {progress.skipped_videos}"
        )

    # ─── PHASE 3 : MÉTA-ANALYSE MULTI-PASS ───
    progress.current_step = "meta"
    progress.percent = 82
    progress.message = "Méta-analyse en cours..." if lang == "fr" else "Meta-analysis in progress..."
    await _notify(progress)

    meta_analysis = await _generate_meta_analysis_multipass(
        videos=valid_results,
        corpus_name=corpus_name,
        lang=lang,
        model=model,
    )

    progress.percent = 95
    progress.message = "Sauvegarde..." if lang == "fr" else "Saving..."
    await _notify(progress)

    # ─── PHASE 4 : PERSISTANCE BDD ───
    await _persist_results(
        corpus_id=corpus_id,
        corpus_name=corpus_name,
        videos=valid_results,
        meta_analysis=meta_analysis,
        user_id=user_id,
        lang=lang,
        mode=mode,
        model=model,
        original_url=urls[0] if len(urls) == 1 else "",
    )

    elapsed = (datetime.utcnow() - start_time).total_seconds()
    total_duration = sum(v.duration for v in valid_results)
    total_words = sum(v.word_count for v in valid_results)

    progress.percent = 100
    progress.current_step = "done"
    progress.message = "Terminé!" if lang == "fr" else "Done!"
    await _notify(progress)

    logger.info(
        f"pipeline_complete: corpus={corpus_id} "
        f"videos={len(valid_results)}/{len(video_ids)} "
        f"duration={total_duration}s words={total_words:,} "
        f"elapsed={elapsed:.1f}s"
    )

    return PipelineResult(
        corpus_id=corpus_id,
        corpus_name=corpus_name,
        videos=valid_results,
        meta_analysis=meta_analysis,
        total_duration=total_duration,
        total_words=total_words,
        num_processed=len(valid_results),
        num_skipped=len(progress.skipped_videos),
        skipped_reasons=progress.skipped_videos,
        processing_time_seconds=elapsed,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📹 TRAITEMENT D'UNE VIDÉO (avec chunking si nécessaire)
# ═══════════════════════════════════════════════════════════════════════════════

async def _process_single_video(
    video_id: str,
    position: int,
    mode: str,
    lang: str,
    model: str,
    user_id: int,
    progress: PipelineProgress,
    notify: Callable,
) -> VideoResult:
    """
    Traite une vidéo individuelle :
    1. Récupère les métadonnées
    2. Extrait le transcript
    3. Crée un plan de chunking
    4. Si chunking nécessaire : résume chaque chunk puis merge
    5. Sinon : résumé direct
    """
    # ── Étape 1 : Métadonnées ──
    progress.current_video_title = video_id
    progress.current_step = "transcript"

    video_info = await get_video_info(video_id)
    if not video_info:
        raise ValueError(f"Impossible de récupérer les infos de {video_id}")

    title = video_info.get("title", "Vidéo sans titre")
    channel = video_info.get("channel", "")
    duration = int(video_info.get("duration", 0) or 0)
    thumbnail = video_info.get("thumbnail_url", video_info.get("thumbnail", ""))

    progress.current_video_title = title[:60]
    await notify(progress)

    logger.info(f"processing_video: id={video_id} title={title[:50]} duration={duration}s")

    # ── Étape 2 : Transcript ──
    transcript_result = await get_transcript_with_timestamps(video_id, lang, duration=duration)

    transcript_simple: str = ""
    transcript_timestamped: Optional[str] = None

    if transcript_result is None:
        raise ValueError(f"Transcript indisponible pour {title}")
    elif isinstance(transcript_result, tuple):
        transcript_simple = transcript_result[0] if len(transcript_result) >= 1 else ""
        transcript_timestamped = transcript_result[1] if len(transcript_result) >= 2 else transcript_result[0]
    elif isinstance(transcript_result, str):
        transcript_simple = transcript_result
        transcript_timestamped = transcript_result
    else:
        transcript_simple = str(transcript_result)
        transcript_timestamped = transcript_simple

    if not transcript_simple or not transcript_simple.strip():
        raise ValueError(f"Transcript vide pour {title}")

    # ── Étape 3 : Catégorie ──
    category_result = detect_category(
        title=title,
        description=video_info.get("description", ""),
        transcript=transcript_simple[:2000],
        channel=channel,
    )
    category = category_result[0] if isinstance(category_result, tuple) else category_result
    cat_confidence = category_result[1] if isinstance(category_result, tuple) else 0.5

    # ── Étape 4 : Plan de chunking ──
    plan = create_chunking_plan(
        video_id=video_id,
        video_title=title,
        transcript=transcript_simple,
        transcript_timestamped=transcript_timestamped if isinstance(transcript_timestamped, str) else None,
        duration_seconds=duration,
        model=model,
    )

    progress.current_step = "summary" if not plan.needs_chunking else "chunking"
    progress.total_chunks = plan.num_chunks
    progress.current_chunk = 0
    await notify(progress)

    # ── Étape 5a : Vidéo courte → résumé direct ──
    if not plan.needs_chunking:
        summary_content = await generate_summary(
            title=title,
            transcript=transcript_simple,
            category=category,
            lang=lang,
            mode=mode,
            model=model,
            duration=duration,
            channel=channel,
            description=video_info.get("description", ""),
        )

        if not summary_content:
            raise ValueError(f"Échec de la génération du résumé pour {title}")

        # Transcript context : stocker autant que possible
        max_ctx = min(len(transcript_simple), 150000)
        transcript_ctx = transcript_timestamped[:max_ctx] if isinstance(transcript_timestamped, str) else transcript_simple[:max_ctx]

        return VideoResult(
            video_id=video_id,
            video_title=title,
            video_channel=channel,
            duration=duration,
            category=category,
            category_confidence=cat_confidence,
            summary_content=summary_content,
            full_digest=summary_content,
            transcript_context=transcript_ctx,
            word_count=len(summary_content.split()),
            thumbnail_url=thumbnail,
            position=position,
            tier=plan.tier,
            num_chunks=1,
        )

    # ── Étape 5b : Vidéo longue → chunked pipeline ──
    logger.info(
        f"chunked_analysis: video={video_id} chunks={plan.num_chunks} "
        f"tier={plan.tier} words={plan.total_words:,}"
    )

    chunk_digests = await _process_chunks_parallel(
        chunks=plan.chunks,
        title=title,
        channel=channel,
        category=category,
        lang=lang,
        mode=mode,
        model=model,
        progress=progress,
        notify=notify,
    )

    # ── Étape 6 : Merge des chunk digests ──
    progress.current_step = "merge"
    progress.message = f"Fusion des {plan.num_chunks} segments..." if lang == "fr" else f"Merging {plan.num_chunks} segments..."
    await notify(progress)

    merged_summary = await _merge_chunk_summaries(
        chunk_digests=chunk_digests,
        title=title,
        channel=channel,
        category=category,
        duration=duration,
        lang=lang,
        mode=mode,
        model=model,
    )

    # Full digest = tous les chunk digests concaténés (pour la méta-analyse)
    full_digest = "\n\n---\n\n".join([
        f"[{c['time_range']}] {c['digest']}"
        for c in chunk_digests
        if c.get('digest')
    ])

    # Transcript context élargi pour vidéos longues
    max_ctx = min(len(transcript_simple), 200000)
    transcript_ctx = transcript_timestamped[:max_ctx] if isinstance(transcript_timestamped, str) else transcript_simple[:max_ctx]

    return VideoResult(
        video_id=video_id,
        video_title=title,
        video_channel=channel,
        duration=duration,
        category=category,
        category_confidence=cat_confidence,
        summary_content=merged_summary,
        full_digest=full_digest,
        transcript_context=transcript_ctx,
        word_count=len(merged_summary.split()),
        thumbnail_url=thumbnail,
        position=position,
        tier=plan.tier,
        num_chunks=plan.num_chunks,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔪 TRAITEMENT PARALLÈLE DES CHUNKS
# ═══════════════════════════════════════════════════════════════════════════════

async def _process_chunks_parallel(
    chunks: List[PlaylistChunk],
    title: str,
    channel: str,
    category: str,
    lang: str,
    mode: str,
    model: str,
    progress: PipelineProgress,
    notify: Callable,
) -> List[Dict[str, Any]]:
    """
    Traite les chunks d'une vidéo en parallèle (semaphore = MAX_CONCURRENT_CHUNKS).
    Retourne une liste ordonnée de digests.
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_CHUNKS)
    results: List[Optional[Dict[str, Any]]] = [None] * len(chunks)

    async def process_chunk(chunk: PlaylistChunk, idx: int):
        async with semaphore:
            for attempt in range(MAX_RETRIES):
                try:
                    digest = await _summarize_chunk(
                        chunk=chunk,
                        title=title,
                        channel=channel,
                        category=category,
                        lang=lang,
                        mode=mode,
                        model=model,
                    )
                    results[idx] = {
                        "index": chunk.index,
                        "digest": digest,
                        "time_range": f"{chunk.start_time} → {chunk.end_time}",
                        "word_count": chunk.word_count,
                        "start_seconds": chunk.start_seconds,
                        "end_seconds": chunk.end_seconds,
                    }
                    progress.current_chunk += 1
                    await notify(progress)
                    return
                except Exception as e:
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                    else:
                        logger.warning(
                            f"chunk_failed: video={title[:30]} chunk={idx} "
                            f"error={e} after {MAX_RETRIES} retries"
                        )
                        results[idx] = {
                            "index": chunk.index,
                            "digest": f"[Segment {chunk.start_time}-{chunk.end_time}: analyse échouée]",
                            "time_range": f"{chunk.start_time} → {chunk.end_time}",
                            "word_count": chunk.word_count,
                            "start_seconds": chunk.start_seconds,
                            "end_seconds": chunk.end_seconds,
                        }

    tasks = [
        asyncio.create_task(process_chunk(chunk, idx))
        for idx, chunk in enumerate(chunks)
    ]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Retourner dans l'ordre
    return [r for r in results if r is not None]


async def _summarize_chunk(
    chunk: PlaylistChunk,
    title: str,
    channel: str,
    category: str,
    lang: str,
    mode: str,
    model: str,
) -> str:
    """
    Génère un résumé dense pour un chunk de transcript.
    Optimisé pour être concis mais complet — chaque chunk produit un digest
    qui sera ensuite fusionné avec les autres.
    """
    api_key = get_mistral_key()
    if not api_key:
        raise ValueError("Clé Mistral non configurée")

    time_range = f"{chunk.start_time} → {chunk.end_time}"

    if lang == "fr":
        prompt = f"""Tu es un analyste expert. Résume ce segment de la vidéo "{title}" (chaîne: {channel}, catégorie: {category}).

SEGMENT [{time_range}] (partie {chunk.index + 1}/{chunk.total_chunks}):
{chunk.text}

Produis un résumé DENSE et STRUCTURÉ de ce segment :
- **Points clés** : Les idées principales (2-4 points)
- **Détails importants** : Chiffres, exemples concrets, citations notables
- **Concepts** : Termes ou concepts techniques mentionnés

⚠️ Ce résumé sera fusionné avec d'autres segments. Sois factuel et précis.
Ne dis pas "dans ce segment" — écris comme si c'était un article autonome.
Longueur : 150-300 mots.
🌐 RÉPONDS EN FRANÇAIS."""
    else:
        prompt = f"""You are an expert analyst. Summarize this segment from the video "{title}" (channel: {channel}, category: {category}).

SEGMENT [{time_range}] (part {chunk.index + 1}/{chunk.total_chunks}):
{chunk.text}

Produce a DENSE and STRUCTURED summary of this segment:
- **Key Points**: Main ideas (2-4 points)
- **Important Details**: Numbers, concrete examples, notable quotes
- **Concepts**: Technical terms or concepts mentioned

⚠️ This summary will be merged with other segments. Be factual and precise.
Don't say "in this segment" — write as if it were a standalone article.
Length: 150-300 words.
🌐 RESPOND IN ENGLISH."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1200,
                "temperature": 0.25,
            },
            timeout=CHUNK_SUMMARY_TIMEOUT,
        )
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"]
        elif response.status_code == 429:
            raise Exception("Rate limited — retry")
        else:
            raise Exception(f"Mistral error {response.status_code}: {response.text[:200]}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔗 MERGE DES CHUNK SUMMARIES → RÉSUMÉ UNIFIÉ
# ═══════════════════════════════════════════════════════════════════════════════

async def _merge_chunk_summaries(
    chunk_digests: List[Dict[str, Any]],
    title: str,
    channel: str,
    category: str,
    duration: int,
    lang: str,
    mode: str,
    model: str,
) -> str:
    """
    Fusionne les résumés de chunks en un résumé unifié et cohérent.
    C'est le "Chain of Synthesis" : chunk summaries → merged summary.
    """
    api_key = get_mistral_key()
    if not api_key:
        return "\n\n".join(d["digest"] for d in chunk_digests)

    # Construire le contexte des chunks
    chunks_text = ""
    for d in chunk_digests:
        chunks_text += f"\n### [{d['time_range']}]\n{d['digest']}\n"

    duration_str = f"{duration // 3600}h{(duration % 3600) // 60:02d}" if duration >= 3600 else f"{duration // 60}min"
    num_chunks = len(chunk_digests)

    # Adapter la longueur du résumé au nombre de chunks
    target_words = min(800 + (num_chunks * 100), 2500)
    max_tokens = min(3000 + (num_chunks * 200), 6000)

    if lang == "fr":
        prompt = f"""Tu es un rédacteur expert. Voici {num_chunks} résumés de segments consécutifs de la vidéo "{title}" ({channel}, {duration_str}, catégorie: {category}).

{chunks_text}

MISSION : Fusionne ces résumés en UNE SYNTHÈSE UNIFIÉE et cohérente.

Règles :
1. **Pas de répétition** — Si le même point apparaît dans plusieurs segments, le mentionner UNE fois
2. **Structure logique** — Réorganise par thème, pas par chronologie brute
3. **Préserve les détails** — Chiffres, citations, exemples concrets doivent être gardés
4. **Cohérence narrative** — Le résultat doit se lire comme un article unique, pas une compilation
5. **Longueur cible** : {target_words} mots

Format :
## 🎯 Synthèse
[Résumé global en 2-3 phrases]

## 📌 Points Clés
[Points principaux structurés]

## 💡 Détails & Insights
[Chiffres, exemples, citations notables]

## 🔍 Analyse Critique
[Limites, biais potentiels, points de vue manquants]

🌐 RÉPONDS UNIQUEMENT EN FRANÇAIS."""
    else:
        prompt = f"""You are an expert writer. Here are {num_chunks} summaries of consecutive segments from the video "{title}" ({channel}, {duration_str}, category: {category}).

{chunks_text}

MISSION: Merge these summaries into ONE UNIFIED and coherent synthesis.

Rules:
1. **No repetition** — If the same point appears in multiple segments, mention it ONCE
2. **Logical structure** — Reorganize by theme, not raw chronology
3. **Preserve details** — Numbers, quotes, concrete examples must be kept
4. **Narrative coherence** — The result should read as a single article, not a compilation
5. **Target length**: {target_words} words

Format:
## 🎯 Summary
[Global summary in 2-3 sentences]

## 📌 Key Points
[Main structured points]

## 💡 Details & Insights
[Numbers, examples, notable quotes]

## 🔍 Critical Analysis
[Limits, potential biases, missing perspectives]

🌐 RESPOND ONLY IN ENGLISH."""

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
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
                timeout=MERGE_SUMMARY_TIMEOUT,
            )
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                logger.info(f"merge_complete: title={title[:40]} chunks={num_chunks} result={len(content)} chars")
                return content
    except Exception as e:
        logger.error(f"merge_failed: title={title[:40]} error={e}")

    # Fallback : concaténation simple
    return "\n\n".join(d["digest"] for d in chunk_digests)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 MÉTA-ANALYSE MULTI-PASS v5.0
# ═══════════════════════════════════════════════════════════════════════════════

async def _generate_meta_analysis_multipass(
    videos: List[VideoResult],
    corpus_name: str,
    lang: str,
    model: str,
) -> str:
    """
    Méta-analyse en 2 passes pour qualité optimale :

    Pass 1 : Extraction thématique + connexions (sur les full_digests)
    Pass 2 : Synthèse finale structurée (sur Pass 1 + summaries)

    Avantages par rapport à v4 :
    - Utilise les full_digests (pas truncated à 2000 chars)
    - 2 passes = meilleure profondeur d'analyse
    - Token budget adaptatif
    """
    api_key = get_mistral_key()
    if not api_key:
        return _fallback_meta(videos, corpus_name, lang)

    num_videos = len(videos)
    total_duration = sum(v.duration for v in videos)
    total_words = sum(v.word_count for v in videos)
    categories = list(set(v.category for v in videos if v.category))

    duration_str = (
        f"{total_duration // 3600}h {(total_duration % 3600) // 60}min"
        if total_duration > 3600
        else f"{total_duration // 60} min"
    )

    # ── PASS 1 : Extraction thématique ──
    # Construire le contexte avec full_digest (pas truncated)
    videos_context = ""
    max_per_video = 120000 // max(num_videos, 1)  # Budget par vidéo

    for v in videos:
        digest = v.full_digest or v.summary_content
        truncated_digest = digest[:max_per_video]
        tier_info = f" [{v.tier}, {v.num_chunks} segments]" if v.num_chunks > 1 else ""

        videos_context += (
            f"\n### Vidéo {v.position}: {v.video_title}\n"
            f"**Chaîne:** {v.video_channel} | **Catégorie:** {v.category} | "
            f"**Durée:** {v.duration // 60}min{tier_info}\n"
            f"{truncated_digest}\n"
        )

    if lang == "fr":
        pass1_prompt = f"""Analyse ce corpus de {num_videos} vidéos intitulé "{corpus_name}" :

{videos_context}

ÉTAPE 1 — EXTRACTION THÉMATIQUE :

1. **Thèmes majeurs** : Identifie les 5-8 thèmes qui traversent le corpus. Pour chaque thème, cite les vidéos concernées.
2. **Connexions** : Comment les vidéos se complètent ou se contredisent ?
3. **Progression** : Y a-t-il une progression logique ou narrative dans le corpus ?
4. **Concepts clés** : Les 10 concepts/termes les plus importants du corpus.
5. **Points de tension** : Contradictions, nuances, opinions divergentes.

Sois analytique et précis. Cite les vidéos par numéro.
🌐 RÉPONDS EN FRANÇAIS."""
    else:
        pass1_prompt = f"""Analyze this corpus of {num_videos} videos titled "{corpus_name}":

{videos_context}

STEP 1 — THEMATIC EXTRACTION:

1. **Major Themes**: Identify the 5-8 themes across the corpus. For each theme, cite relevant videos.
2. **Connections**: How do the videos complement or contradict each other?
3. **Progression**: Is there a logical or narrative progression in the corpus?
4. **Key Concepts**: The 10 most important concepts/terms in the corpus.
5. **Points of Tension**: Contradictions, nuances, divergent opinions.

Be analytical and precise. Cite videos by number.
🌐 RESPOND IN ENGLISH."""

    try:
        async with httpx.AsyncClient() as client:
            # Pass 1
            response1 = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": pass1_prompt}],
                    "max_tokens": 4000,
                    "temperature": 0.3,
                },
                timeout=180,
            )

            if response1.status_code != 200:
                logger.error(f"meta_pass1_failed: status={response1.status_code}")
                return _fallback_meta(videos, corpus_name, lang)

            pass1_result = response1.json()["choices"][0]["message"]["content"]
            logger.info(f"meta_pass1_complete: {len(pass1_result)} chars")

            # ── PASS 2 : Synthèse finale structurée ──
            if lang == "fr":
                pass2_prompt = f"""Voici l'analyse thématique d'un corpus de {num_videos} vidéos intitulé "{corpus_name}" :

{pass1_result}

Maintenant, génère la MÉTA-ANALYSE FINALE en français avec cette structure :

## 🎯 Vision d'Ensemble
Synthèse globale du corpus en 3-4 phrases. Quel est le fil conducteur principal ?

## 📊 Thèmes Principaux
Les 4-6 thèmes majeurs avec leur fréquence/importance. Pour chaque thème, réfère aux vidéos spécifiques.

## 🔗 Connexions & Complémentarités
Comment les vidéos se complètent. Quels liens conceptuels entre elles ?

## ⚔️ Points de Tension
Contradictions, nuances ou opinions divergentes entre vidéos.

## 💡 Insights Clés
Les 5-7 apprentissages les plus importants, avec références aux vidéos.

## 📈 Statistiques
- **Vidéos analysées :** {num_videos}
- **Durée totale :** {duration_str}
- **Catégories :** {', '.join(categories) if categories else 'Variées'}
- **Mots analysés :** {total_words:,}

## 🎬 Parcours Suggéré
Par quelle vidéo commencer ? Quel ordre de visionnage recommandes-tu et pourquoi ?

Sois exhaustif et analytique. La qualité de cette méta-analyse est critique.
🌐 RÉPONDS UNIQUEMENT EN FRANÇAIS."""
            else:
                pass2_prompt = f"""Here is the thematic analysis of a corpus of {num_videos} videos titled "{corpus_name}":

{pass1_result}

Now, generate the FINAL META-ANALYSIS in English with this structure:

## 🎯 Overview
Global synthesis of the corpus in 3-4 sentences. What is the main thread?

## 📊 Main Themes
The 4-6 major themes with frequency/importance. For each theme, reference specific videos.

## 🔗 Connections & Complementarities
How the videos complement each other. What conceptual links?

## ⚔️ Points of Tension
Contradictions, nuances, or divergent opinions between videos.

## 💡 Key Insights
The 5-7 most important learnings, with video references.

## 📈 Statistics
- **Videos analyzed:** {num_videos}
- **Total duration:** {duration_str}
- **Categories:** {', '.join(categories) if categories else 'Various'}
- **Words analyzed:** {total_words:,}

## 🎬 Suggested Path
Which video to start with? What viewing order and why?

Be exhaustive and analytical. The quality of this meta-analysis is critical.
🌐 RESPOND ONLY IN ENGLISH."""

            # Pass 2
            max_tokens_pass2 = min(6000, 2000 + num_videos * 500)
            response2 = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": pass2_prompt}],
                    "max_tokens": max_tokens_pass2,
                    "temperature": 0.35,
                },
                timeout=180,
            )

            if response2.status_code == 200:
                content = response2.json()["choices"][0]["message"]["content"]
                logger.info(f"meta_pass2_complete: {len(content)} chars")
                return content
            else:
                logger.warning(f"meta_pass2_failed: status={response2.status_code}, using pass1")
                return pass1_result

    except Exception as e:
        logger.error(f"meta_analysis_error: {e}")
        return _fallback_meta(videos, corpus_name, lang)


def _fallback_meta(videos: List[VideoResult], corpus_name: str, lang: str) -> str:
    """Méta-analyse de fallback si Mistral échoue."""
    categories = list(set(v.category for v in videos if v.category))
    if lang == "fr":
        return (
            f"## Méta-analyse — {corpus_name}\n\n"
            f"**{len(videos)} vidéos analysées.**\n"
            f"Catégories : {', '.join(categories) if categories else 'Variées'}.\n\n"
            + "\n".join(f"- **{v.video_title}** ({v.video_channel}) — {v.word_count} mots" for v in videos)
        )
    return (
        f"## Meta-analysis — {corpus_name}\n\n"
        f"**{len(videos)} videos analyzed.**\n"
        f"Categories: {', '.join(categories) if categories else 'Various'}.\n\n"
        + "\n".join(f"- **{v.video_title}** ({v.video_channel}) — {v.word_count} words" for v in videos)
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 PERSISTANCE BDD
# ═══════════════════════════════════════════════════════════════════════════════

async def _persist_results(
    corpus_id: str,
    corpus_name: str,
    videos: List[VideoResult],
    meta_analysis: str,
    user_id: int,
    lang: str,
    mode: str,
    model: str,
    original_url: str = "",
) -> None:
    """
    Persiste tous les résultats en BDD :
    - PlaylistAnalysis (méta)
    - Summary par vidéo (avec full_digest + transcript_context étendu)
    - VideoChunk par chunk (si chunked)
    - Mise à jour User (crédits, stats)
    """
    from db.database import async_session_maker

    async with async_session_maker() as session:
        try:
            # 1. Créer le PlaylistAnalysis
            total_duration = sum(v.duration for v in videos)
            total_words = sum(v.word_count for v in videos)

            playlist_analysis = PlaylistAnalysis(
                user_id=user_id,
                playlist_id=corpus_id,
                playlist_url=original_url,
                playlist_title=corpus_name,
                num_videos=len(videos),
                num_processed=len(videos),
                total_duration=total_duration,
                total_words=total_words,
                meta_analysis=meta_analysis,
                status="completed",
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
            )
            session.add(playlist_analysis)

            # 2. Créer les Summaries
            for v in videos:
                summary = Summary(
                    user_id=user_id,
                    video_id=v.video_id,
                    video_title=v.video_title,
                    video_channel=v.video_channel,
                    video_duration=v.duration,
                    video_url=f"https://www.youtube.com/watch?v={v.video_id}",
                    thumbnail_url=v.thumbnail_url,
                    category=v.category,
                    category_confidence=v.category_confidence,
                    lang=lang,
                    mode=mode,
                    model_used=model,
                    summary_content=v.summary_content,
                    transcript_context=v.transcript_context,
                    word_count=v.word_count,
                    playlist_id=corpus_id,
                    playlist_position=v.position,
                )

                # Stocker le full_digest si différent du summary
                if hasattr(summary, 'full_digest') and v.full_digest != v.summary_content:
                    summary.full_digest = v.full_digest

                session.add(summary)
                await session.flush()  # Pour obtenir summary.id

                # 3. Créer les VideoChunks si la vidéo a été chunkée
                if v.num_chunks > 1 and v.full_digest:
                    # Reconstruire les chunks depuis le full_digest
                    digest_parts = v.full_digest.split("\n\n---\n\n")
                    for chunk_idx, part in enumerate(digest_parts):
                        # Extraire le time range si présent
                        start_sec = 0
                        end_sec = 0
                        digest_text = part
                        if part.startswith("[") and "]" in part:
                            time_part = part[1:part.index("]")]
                            digest_text = part[part.index("]") + 2:]
                            # Parser "00:00 → 15:30"
                            if "→" in time_part:
                                parts = time_part.split("→")
                                start_sec = _parse_time_str(parts[0].strip())
                                end_sec = _parse_time_str(parts[1].strip())

                        chunk = VideoChunk(
                            summary_id=summary.id,
                            chunk_index=chunk_idx,
                            start_seconds=start_sec,
                            end_seconds=end_sec,
                            chunk_digest=digest_text.strip(),
                        )
                        session.add(chunk)

            # 4. Mettre à jour les stats utilisateur
            user = await session.get(User, user_id)
            if user:
                credits_cost = len(videos)  # 1 crédit par vidéo
                if user.credits >= credits_cost:
                    user.credits -= credits_cost
                user.total_videos += len(videos)
                user.total_words += total_words
                user.total_playlists += 1

            await session.commit()
            logger.info(
                f"persist_complete: corpus={corpus_id} "
                f"videos={len(videos)} chunks_total={sum(v.num_chunks for v in videos)}"
            )

        except Exception as e:
            await session.rollback()
            logger.error(f"persist_failed: corpus={corpus_id} error={e}")
            raise


def _parse_time_str(time_str: str) -> int:
    """Parse '01:30:00' ou '15:30' en secondes."""
    parts = time_str.strip().split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        pass
    return 0
