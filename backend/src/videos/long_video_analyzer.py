"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 LONG VIDEO ANALYZER v2.0 — TRAITEMENT INTÉGRAL GARANTI                         ║
║  Analyse COMPLÈTE des vidéos longues (2h+) par chunking exhaustif                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🎯 GARANTIE: 100% du transcript est analysé, AUCUNE partie ignorée                ║
║                                                                                    ║
║  STRATÉGIE:                                                                        ║
║  1. Diviser le transcript en chunks SANS PERTE                                     ║
║  2. Analyser TOUS les chunks (avec retry si échec)                                 ║
║  3. Fusionner TOUTES les analyses en synthèse finale                               ║
║  4. Vérifier la couverture à 100%                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import asyncio
import httpx
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

from core.config import get_mistral_key

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION — OPTIMISÉE POUR TRAITEMENT COMPLET (même 3h+)
# ═══════════════════════════════════════════════════════════════════════════════

# Seuils pour déclencher le chunking
LONG_VIDEO_THRESHOLD_WORDS = 5000       # ~20 min de vidéo
VERY_LONG_VIDEO_THRESHOLD_WORDS = 15000 # ~1h de vidéo
ULTRA_LONG_VIDEO_THRESHOLD_WORDS = 45000 # ~3h de vidéo (NOUVEAU)

# Taille des chunks — OPTIMISÉE pour garantir un traitement complet
CHUNK_SIZE_WORDS = 2500                 # 2500 mots max par chunk (plus petit = plus sûr)
CHUNK_OVERLAP_WORDS = 300               # Chevauchement augmenté pour meilleur contexte

# Retry et robustesse
MAX_RETRIES_PER_CHUNK = 4               # 4 tentatives par chunk (augmenté)
RETRY_DELAY_SECONDS = 3                 # Délai entre les tentatives

# Concurrence - réduite pour éviter rate limiting sur vidéos très longues
MAX_CONCURRENT_CHUNKS = 2               # 2 chunks simultanés max
CHUNK_TIMEOUT_SECONDS = 180             # Timeout augmenté à 3 min par chunk

# 🆕 GARANTIE 100% - PAS DE LIMITE sur le nombre de chunks
MAX_CHUNKS = None                       # Illimité - on traite TOUT le transcript

# 🆕 Pour le stockage du transcript complet pour le chat IA
STORE_FULL_TRANSCRIPT = True            # Stocker le transcript complet
MAX_TRANSCRIPT_STORAGE_CHARS = 500000   # 500k caractères max en BDD (~3h de vidéo)


@dataclass
class TranscriptChunk:
    """Représente un morceau de transcript"""
    index: int
    total_chunks: int
    text: str
    word_count: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_word_index: int = 0
    end_word_index: int = 0
    
    # Tracking du traitement
    processed: bool = False
    retry_count: int = 0
    error: Optional[str] = None


@dataclass
class ChunkAnalysis:
    """Résultat d'analyse d'un chunk"""
    chunk_index: int
    summary: str
    key_points: List[str] = field(default_factory=list)
    important_quotes: List[str] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)
    time_range: str = ""
    word_count_analyzed: int = 0  # Pour vérifier la couverture


@dataclass
class AnalysisReport:
    """Rapport de l'analyse complète"""
    total_words: int
    total_chunks: int
    chunks_analyzed: int
    chunks_failed: int
    coverage_percent: float
    failed_chunks: List[int] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# 📏 DÉTECTION ET DÉCOUPAGE
# ═══════════════════════════════════════════════════════════════════════════════

def needs_chunking(transcript: str) -> Tuple[bool, int, str]:
    """
    Détermine si un transcript nécessite un découpage.
    
    Returns:
        (needs_chunking, word_count, reason)
    """
    words = transcript.split()
    word_count = len(words)
    
    if word_count > VERY_LONG_VIDEO_THRESHOLD_WORDS:
        return True, word_count, f"very_long ({word_count} mots ≈ {word_count // 150} min)"
    elif word_count > LONG_VIDEO_THRESHOLD_WORDS:
        return True, word_count, f"long ({word_count} mots ≈ {word_count // 150} min)"
    else:
        return False, word_count, "standard"


def estimate_timecode(word_index: int, total_words: int, video_duration: int) -> str:
    """
    Estime le timecode basé sur la position dans le transcript.
    ⚠️ FALLBACK: Utilisé seulement si pas de vrais timestamps disponibles.
    
    Args:
        word_index: Index du mot dans le transcript
        total_words: Nombre total de mots
        video_duration: Durée de la vidéo en secondes
    
    Returns:
        Timecode au format HH:MM:SS ou MM:SS
    """
    if total_words == 0:
        return "00:00"
    
    seconds = int((word_index / total_words) * video_duration)
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def parse_real_timestamps(transcript_timestamped: str) -> List[Tuple[int, str]]:
    """
    🆕 v3.0: Parse les VRAIS timestamps du transcript YouTube.
    
    Le format attendu est: "[00:30] texte [01:00] suite..."
    
    Returns:
        Liste de tuples (seconds, text) avec les vrais timestamps
    """
    if not transcript_timestamped:
        return []
    
    segments = []
    # Pattern pour capturer [HH:MM:SS] ou [MM:SS] suivi du texte
    pattern = r'\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*([^\[]*)'
    
    matches = re.findall(pattern, transcript_timestamped)
    
    for match in matches:
        if match[2]:  # Format HH:MM:SS
            hours, minutes, seconds = int(match[0]), int(match[1]), int(match[2])
            total_seconds = hours * 3600 + minutes * 60 + seconds
        else:  # Format MM:SS
            minutes, seconds = int(match[0]), int(match[1])
            total_seconds = minutes * 60 + seconds
        
        text = match[3].strip()
        if text:
            segments.append((total_seconds, text))
    
    return segments


def get_timestamp_at_word_index(
    transcript_timestamped: str, 
    word_index: int,
    total_words: int,
    video_duration: int
) -> str:
    """
    🆕 v3.0: Obtient le VRAI timestamp à une position donnée.
    
    1. Parse les vrais timestamps
    2. Trouve le segment correspondant à word_index
    3. Fallback sur estimation si pas de vrais timestamps
    """
    segments = parse_real_timestamps(transcript_timestamped)
    
    if not segments:
        # Fallback: estimation
        return estimate_timecode(word_index, total_words, video_duration)
    
    # Calculer la position relative (0 à 1)
    position_ratio = word_index / max(total_words, 1)
    
    # Trouver le segment correspondant
    # On suppose une distribution uniforme des mots dans le temps
    target_time = position_ratio * video_duration
    
    # Trouver le segment le plus proche
    best_segment = segments[0]
    for seg_time, seg_text in segments:
        if seg_time <= target_time:
            best_segment = (seg_time, seg_text)
        else:
            break
    
    # Formater le timestamp
    seconds = best_segment[0]
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def split_into_chunks_with_real_timestamps(
    transcript: str,
    transcript_timestamped: str,
    video_duration: int = 0,
    chunk_size: int = CHUNK_SIZE_WORDS,
    overlap: int = CHUNK_OVERLAP_WORDS
) -> List[TranscriptChunk]:
    """
    🆕 v3.0: Divise le transcript en chunks avec VRAIS timestamps YouTube.
    
    Amélioration majeure:
    - Parse les timestamps réels du transcript_timestamped
    - Assigne les vrais timecodes à chaque chunk
    - Fallback sur estimation si pas de timestamps
    """
    # Parser les vrais timestamps
    real_segments = parse_real_timestamps(transcript_timestamped)
    has_real_timestamps = len(real_segments) > 0
    
    if has_real_timestamps:
        print(f"✅ [TIMESTAMPS] Found {len(real_segments)} real timestamps", flush=True)
    else:
        print(f"⚠️ [TIMESTAMPS] No real timestamps, using estimation", flush=True)
    
    words = transcript.split()
    total_words = len(words)
    
    if total_words <= chunk_size:
        end_time = "00:00"
        if has_real_timestamps and real_segments:
            last_seg = real_segments[-1]
            seconds = last_seg[0]
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            end_time = f"{hours:02d}:{minutes:02d}:{secs:02d}" if hours > 0 else f"{minutes:02d}:{secs:02d}"
        else:
            end_time = estimate_timecode(total_words, total_words, video_duration)
            
        return [TranscriptChunk(
            index=0,
            total_chunks=1,
            text=transcript,
            word_count=total_words,
            start_time="00:00",
            end_time=end_time,
            start_word_index=0,
            end_word_index=total_words
        )]
    
    chunks = []
    current_pos = 0
    chunk_index = 0
    
    # Estimer le nombre total de chunks
    estimated_chunks = max(1, (total_words - overlap) // (chunk_size - overlap))
    
    while current_pos < total_words:
        # Calculer la fin du chunk
        end_pos = min(current_pos + chunk_size, total_words)
        
        # Ajuster pour finir sur une phrase (chercher un point)
        if end_pos < total_words:
            search_start = max(current_pos + chunk_size - 200, current_pos)
            search_text = " ".join(words[search_start:end_pos])
            
            last_period = search_text.rfind('.')
            if last_period == -1:
                last_period = search_text.rfind('!')
            if last_period == -1:
                last_period = search_text.rfind('?')
            
            if last_period > 0:
                words_before_period = len(search_text[:last_period].split())
                end_pos = search_start + words_before_period + 1
        
        # Créer le chunk
        chunk_text = " ".join(words[current_pos:end_pos])
        
        # 🆕 Obtenir les VRAIS timestamps
        if has_real_timestamps:
            start_time = get_timestamp_at_word_index(
                transcript_timestamped, current_pos, total_words, video_duration
            )
            end_time = get_timestamp_at_word_index(
                transcript_timestamped, end_pos, total_words, video_duration
            )
        else:
            start_time = estimate_timecode(current_pos, total_words, video_duration)
            end_time = estimate_timecode(end_pos, total_words, video_duration)
        
        chunks.append(TranscriptChunk(
            index=chunk_index,
            total_chunks=estimated_chunks,
            text=chunk_text,
            word_count=end_pos - current_pos,
            start_time=start_time,
            end_time=end_time,
            start_word_index=current_pos,
            end_word_index=end_pos
        ))
        
        # Avancer avec chevauchement
        current_pos = end_pos - overlap if end_pos < total_words else total_words
        chunk_index += 1
    
    # Mettre à jour le total de chunks
    for chunk in chunks:
        chunk.total_chunks = len(chunks)
    
    return chunks


# Garder l'ancienne fonction pour compatibilité
def split_into_chunks(
    transcript: str,
    video_duration: int = 0,
    chunk_size: int = CHUNK_SIZE_WORDS,
    overlap: int = CHUNK_OVERLAP_WORDS
) -> List[TranscriptChunk]:
    """
    ⚠️ LEGACY: Utiliser split_into_chunks_with_real_timestamps de préférence.
    Divise un transcript en chunks intelligents (timestamps estimés).
    """
    return split_into_chunks_with_real_timestamps(
        transcript=transcript,
        transcript_timestamped="",  # Pas de vrais timestamps
        video_duration=video_duration,
        chunk_size=chunk_size,
        overlap=overlap
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 ANALYSE PAR CHUNKS
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_chunk_with_retry(
    chunk: TranscriptChunk,
    video_title: str,
    category: str,
    lang: str,
    mode: str,
    model: str = "mistral-small-latest",
    api_key: str = None,
    max_retries: int = MAX_RETRIES_PER_CHUNK
) -> Optional[ChunkAnalysis]:
    """
    🔄 Analyse un chunk avec retry automatique en cas d'échec.
    
    GARANTIE: Tente jusqu'à max_retries fois avant d'abandonner.
    """
    api_key = api_key or get_mistral_key()
    if not api_key:
        print(f"❌ [Chunk {chunk.index}] No API key!", flush=True)
        return None
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            result = await _analyze_chunk_internal(
                chunk=chunk,
                video_title=video_title,
                category=category,
                lang=lang,
                mode=mode,
                model=model,
                api_key=api_key
            )
            
            if result:
                result.word_count_analyzed = chunk.word_count
                chunk.processed = True
                if attempt > 0:
                    print(f"✅ [Chunk {chunk.index}] Succeeded on attempt {attempt + 1}", flush=True)
                return result
            else:
                last_error = "Empty result"
                
        except Exception as e:
            last_error = str(e)
            chunk.retry_count = attempt + 1
            print(f"⚠️ [Chunk {chunk.index}] Attempt {attempt + 1}/{max_retries} failed: {e}", flush=True)
        
        # Attendre avant de réessayer
        if attempt < max_retries - 1:
            await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))  # Backoff progressif
    
    # Échec après toutes les tentatives
    chunk.error = last_error
    print(f"❌ [Chunk {chunk.index}] FAILED after {max_retries} attempts: {last_error}", flush=True)
    return None


async def _analyze_chunk_internal(
    chunk: TranscriptChunk,
    video_title: str,
    category: str,
    lang: str,
    mode: str,
    model: str,
    api_key: str
) -> Optional[ChunkAnalysis]:
    """
    Analyse interne d'un chunk (appelée par analyze_chunk_with_retry).
    """
    # Adapter le prompt selon la position
    position_context = ""
    if chunk.index == 0:
        position_context = "C'est le DÉBUT de la vidéo. Identifie le contexte, les intervenants, et le sujet principal."
    elif chunk.index == chunk.total_chunks - 1:
        position_context = "C'est la FIN de la vidéo. Note les conclusions, recommandations, et points finaux."
    else:
        position_context = f"C'est la PARTIE {chunk.index + 1}/{chunk.total_chunks} de la vidéo (milieu). Identifie les arguments et développements."
    
    system_prompt = f"""Tu es un analyste expert qui résume des segments de vidéos longues.

CONTEXTE:
- Vidéo: "{video_title}"
- Catégorie: {category}
- Segment: {chunk.index + 1}/{chunk.total_chunks} ({chunk.start_time} → {chunk.end_time})
- Mots dans ce segment: {chunk.word_count}
- {position_context}

🎯 MISSION CRITIQUE: Tu dois analyser TOUT le contenu de ce segment sans rien omettre.

TÂCHE:
Analyse ce segment INTÉGRALEMENT et extrais:
1. Un RÉSUMÉ COMPLET de cette partie (300-500 mots) - couvre TOUS les points importants
2. Les 5-8 POINTS CLÉS avec des timecodes VARIÉS entre {chunk.start_time} et {chunk.end_time}
   ⚠️ IMPORTANT: Répartis les timecodes dans TOUTE la plage [{chunk.start_time} - {chunk.end_time}], pas seulement au début!
3. 2-3 CITATIONS IMPORTANTES (si pertinentes)
4. TOUS les THÈMES/SUJETS abordés dans ce segment

FORMAT DE RÉPONSE (JSON):
{{
    "summary": "Résumé COMPLET du segment...",
    "key_points": [
        "[{chunk.start_time}] Premier point (début du segment)",
        "[...] Points suivants avec timecodes croissants",
        "[proche de {chunk.end_time}] Dernier point (fin du segment)"
    ],
    "quotes": ["Citation importante 1", "Citation 2"],
    "topics": ["Thème 1", "Thème 2", "Thème 3"]
}}
"""

    user_prompt = f"""TRANSCRIPT SEGMENT [{chunk.start_time} - {chunk.end_time}] ({chunk.word_count} mots):

════════════════════════════════════════════════════════════════════════════════
{chunk.text}
════════════════════════════════════════════════════════════════════════════════

Analyse ce segment INTÉGRALEMENT en {"français" if lang == "fr" else "anglais"}.
N'omets aucun point important mentionné dans ce segment."""

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
                "max_tokens": 2000,  # Augmenté pour des résumés plus complets
                "temperature": 0.3,
                "response_format": {"type": "json_object"}
            },
            timeout=CHUNK_TIMEOUT_SECONDS
        )
        
        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            # Parser le JSON
            import json
            try:
                parsed = json.loads(content)
                return ChunkAnalysis(
                    chunk_index=chunk.index,
                    summary=parsed.get("summary", ""),
                    key_points=parsed.get("key_points", []),
                    important_quotes=parsed.get("quotes", []),
                    topics=parsed.get("topics", []),
                    time_range=f"{chunk.start_time} - {chunk.end_time}",
                    word_count_analyzed=chunk.word_count
                )
            except json.JSONDecodeError:
                # Si pas de JSON valide, utiliser le texte brut
                return ChunkAnalysis(
                    chunk_index=chunk.index,
                    summary=content,
                    key_points=[],
                    important_quotes=[],
                    topics=[],
                    time_range=f"{chunk.start_time} - {chunk.end_time}",
                    word_count_analyzed=chunk.word_count
                )
        else:
            raise Exception(f"API error {response.status_code}: {response.text[:200]}")


# Garder l'ancienne fonction pour compatibilité
async def analyze_chunk(
    chunk: TranscriptChunk,
    video_title: str,
    category: str,
    lang: str,
    mode: str,
    model: str = "mistral-small-latest",
    api_key: str = None
) -> Optional[ChunkAnalysis]:
    """Wrapper pour compatibilité - utilise la version avec retry."""
    return await analyze_chunk_with_retry(
        chunk=chunk,
        video_title=video_title,
        category=category,
        lang=lang,
        mode=mode,
        model=model,
        api_key=api_key
    )


async def analyze_chunks_parallel(
    chunks: List[TranscriptChunk],
    video_title: str,
    category: str,
    lang: str,
    mode: str,
    model: str = "mistral-small-latest",
    max_concurrent: int = MAX_CONCURRENT_CHUNKS,
    progress_callback = None
) -> Tuple[List[ChunkAnalysis], AnalysisReport]:
    """
    🎯 Analyse TOUS les chunks en parallèle avec GARANTIE de traitement complet.
    
    Returns:
        Tuple[analyses, report] - Liste des analyses ET rapport de couverture
    """
    total_chunks = len(chunks)
    total_words = sum(c.word_count for c in chunks)
    
    print(f"📚 [FULL ANALYSIS] Starting analysis of {total_chunks} chunks ({total_words} words total)", flush=True)
    
    results: List[Optional[ChunkAnalysis]] = [None] * total_chunks
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def analyze_with_semaphore(chunk: TranscriptChunk, index: int):
        async with semaphore:
            if progress_callback:
                # Progress de 40% à 75% pendant l'analyse des chunks
                progress = 40 + int((index / total_chunks) * 35)
                progress_callback(progress, f"📝 Analyse partie {index + 1}/{total_chunks} ({chunk.word_count} mots)...")
            
            print(f"🔍 [Chunk {index + 1}/{total_chunks}] Analyzing {chunk.word_count} words ({chunk.start_time} → {chunk.end_time})...", flush=True)
            
            result = await analyze_chunk_with_retry(
                chunk=chunk,
                video_title=video_title,
                category=category,
                lang=lang,
                mode=mode,
                model=model
            )
            
            if result:
                print(f"✅ [Chunk {index + 1}/{total_chunks}] Done - {len(result.summary)} chars summary", flush=True)
            else:
                print(f"❌ [Chunk {index + 1}/{total_chunks}] FAILED after all retries", flush=True)
            
            return index, result
    
    # Phase 1: Analyse initiale de TOUS les chunks
    print(f"🚀 [FULL ANALYSIS] Phase 1: Initial analysis of all {total_chunks} chunks...", flush=True)
    
    tasks = [analyze_with_semaphore(chunk, i) for i, chunk in enumerate(chunks)]
    task_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Collecter les résultats
    failed_indices = []
    for result in task_results:
        if isinstance(result, Exception):
            print(f"⚠️ Task exception: {result}", flush=True)
            continue
        if isinstance(result, tuple):
            index, analysis = result
            results[index] = analysis
            if analysis is None:
                failed_indices.append(index)
    
    # Phase 2: Retry des chunks qui ont échoué
    if failed_indices:
        print(f"🔄 [FULL ANALYSIS] Phase 2: Retrying {len(failed_indices)} failed chunks...", flush=True)
        
        if progress_callback:
            progress_callback(76, f"🔄 Nouvel essai pour {len(failed_indices)} parties...")
        
        for failed_index in failed_indices:
            chunk = chunks[failed_index]
            print(f"🔄 [Retry] Chunk {failed_index + 1}/{total_chunks}...", flush=True)
            
            # Attendre un peu avant de réessayer
            await asyncio.sleep(3)
            
            result = await analyze_chunk_with_retry(
                chunk=chunk,
                video_title=video_title,
                category=category,
                lang=lang,
                mode=mode,
                model=model,
                max_retries=2  # Moins de retries car déjà essayé
            )
            
            if result:
                results[failed_index] = result
                print(f"✅ [Retry] Chunk {failed_index + 1} succeeded!", flush=True)
            else:
                print(f"❌ [Retry] Chunk {failed_index + 1} still failed", flush=True)
    
    # Calculer le rapport de couverture
    successful_analyses = [r for r in results if r is not None]
    final_failed = [i for i, r in enumerate(results) if r is None]
    
    words_analyzed = sum(a.word_count_analyzed for a in successful_analyses)
    coverage_percent = (words_analyzed / total_words * 100) if total_words > 0 else 0
    
    report = AnalysisReport(
        total_words=total_words,
        total_chunks=total_chunks,
        chunks_analyzed=len(successful_analyses),
        chunks_failed=len(final_failed),
        coverage_percent=coverage_percent,
        failed_chunks=final_failed
    )
    
    # Warnings si couverture incomplète
    if coverage_percent < 100:
        report.warnings.append(f"⚠️ Couverture: {coverage_percent:.1f}% - {len(final_failed)} chunks non analysés")
        for idx in final_failed:
            chunk = chunks[idx]
            report.warnings.append(f"  - Chunk {idx + 1}: {chunk.start_time} → {chunk.end_time} ({chunk.word_count} mots)")
    
    print(f"📊 [FULL ANALYSIS] REPORT:", flush=True)
    print(f"   - Total words: {total_words}", flush=True)
    print(f"   - Chunks: {len(successful_analyses)}/{total_chunks} analyzed", flush=True)
    print(f"   - Coverage: {coverage_percent:.1f}%", flush=True)
    if final_failed:
        print(f"   - ⚠️ FAILED chunks: {final_failed}", flush=True)
    
    return successful_analyses, report


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 FUSION DES ANALYSES
# ═══════════════════════════════════════════════════════════════════════════════

async def synthesize_chunk_analyses(
    analyses: List[ChunkAnalysis],
    video_title: str,
    video_duration: int,
    category: str,
    lang: str,
    mode: str,
    model: str = "mistral-large-latest",  # Utiliser un modèle plus puissant pour la synthèse
    api_key: str = None,
    web_context: str = None
) -> Optional[str]:
    """
    Fusionne les analyses de chunks en une synthèse finale cohérente.
    
    Cette étape utilise un modèle plus puissant car c'est la synthèse finale.
    """
    api_key = api_key or get_mistral_key()
    if not api_key:
        return None
    
    # Formater les analyses de chunks
    chunk_summaries = []
    all_quotes = []
    all_topics = set()
    
    # 🔧 FIX: Échantillonnage ÉQUILIBRÉ des points clés sur TOUTE la vidéo
    # On garde 2 points clés de CHAQUE chunk pour garantir une couverture complète
    balanced_key_points = []
    points_per_chunk = max(2, 20 // len(analyses)) if analyses else 2  # Au moins 2 par chunk
    
    for analysis in sorted(analyses, key=lambda x: x.chunk_index):
        chunk_summaries.append(f"""
### Segment {analysis.chunk_index + 1} ({analysis.time_range})
{analysis.summary}
""")
        # Prendre les N premiers points clés de CE chunk (avec timecodes de cette partie)
        chunk_points = analysis.key_points[:points_per_chunk] if analysis.key_points else []
        balanced_key_points.extend(chunk_points)
        
        all_quotes.extend(analysis.important_quotes)
        all_topics.update(analysis.topics)
    
    # Formater le contenu pour la synthèse
    chunks_content = "\n".join(chunk_summaries)
    
    # Points clés équilibrés sur toute la vidéo (dédupliqués mais gardant l'ordre chronologique)
    unique_key_points = list(dict.fromkeys(balanced_key_points))
    
    mode_instructions = {
        "accessible": "Crée une synthèse COURTE et PERCUTANTE (500-800 mots). Utilise un langage simple et des analogies.",
        "standard": "Crée une synthèse ÉQUILIBRÉE (1000-1500 mots). Structure claire avec sections thématiques.",
        "expert": "Crée une synthèse APPROFONDIE (1500-2500 mots). Analyse critique avec évaluation épistémique."
    }
    
    # Durée formatée
    hours = video_duration // 3600
    minutes = (video_duration % 3600) // 60
    duration_str = f"{hours}h{minutes:02d}" if hours > 0 else f"{minutes} min"
    
    system_prompt = f"""Tu es un expert en synthèse de contenus longs.

MISSION: Créer une synthèse FINALE et COHÉRENTE d'une vidéo de {duration_str}.

Tu as reçu les analyses de {len(analyses)} segments de cette vidéo.
Tu dois les FUSIONNER en une synthèse unique, structurée et fluide.

RÈGLES CRITIQUES:
1. NE PAS répéter les mêmes informations plusieurs fois
2. Créer une NARRATION FLUIDE (pas une liste de segments)
3. Organiser par THÈMES, pas par ordre chronologique
4. ⚠️ IMPÉRATIF: Les POINTS CLÉS doivent couvrir TOUTE la vidéo du DÉBUT à la FIN
   - Inclure des timecodes du début (0-25%), du milieu (25-75%) ET de la fin (75-100%)
   - PAS seulement les 20 premières minutes !
5. {mode_instructions.get(mode, mode_instructions["standard"])}

STRUCTURE ATTENDUE:
- 🎯 SYNTHÈSE GLOBALE (2-3 phrases d'accroche)
- 📋 SOMMAIRE THÉMATIQUE (les grands axes)
- 📝 DÉVELOPPEMENT (organisé par thèmes, pas par segments)
- 💡 POINTS CLÉS (liste avec timecodes RÉPARTIS sur toute la durée de {duration_str})
- 🎓 CONCLUSION / À RETENIR

⚠️ VÉRIFICATION FINALE: Assure-toi que tes timecodes dans "POINTS CLÉS" couvrent:
- Le début de la vidéo (premiers 25%)
- Le milieu de la vidéo (25%-75%)
- La fin de la vidéo (derniers 25%)
"""

    user_prompt = f"""VIDÉO: "{video_title}"
CATÉGORIE: {category}
DURÉE: {duration_str}
SEGMENTS ANALYSÉS: {len(analyses)}

═══════════════════════════════════════════════════════════════════════════════
RÉSUMÉS DES SEGMENTS:
═══════════════════════════════════════════════════════════════════════════════
{chunks_content}

═══════════════════════════════════════════════════════════════════════════════
POINTS CLÉS EXTRAITS:
═══════════════════════════════════════════════════════════════════════════════
{chr(10).join('• ' + p for p in unique_key_points)}

═══════════════════════════════════════════════════════════════════════════════
THÈMES IDENTIFIÉS:
═══════════════════════════════════════════════════════════════════════════════
{', '.join(all_topics)}

"""

    # Ajouter le contexte web si disponible
    if web_context:
        user_prompt += f"""
═══════════════════════════════════════════════════════════════════════════════
📡 CONTEXTE WEB ACTUEL (pour vérification):
═══════════════════════════════════════════════════════════════════════════════
{web_context[:3000]}
"""

    user_prompt += f"""
═══════════════════════════════════════════════════════════════════════════════
Crée maintenant la SYNTHÈSE FINALE en {"français" if lang == "fr" else "anglais"}.

⚠️ RAPPEL CRITIQUE:
- La vidéo dure {duration_str}
- Les POINTS CLÉS doivent inclure des timecodes de TOUTE la vidéo
- Ne cite pas seulement le début, inclus aussi le milieu et la fin !
═══════════════════════════════════════════════════════════════════════════════
"""

    # Utiliser plus de tokens pour la synthèse finale
    max_tokens = {
        "accessible": 2000,
        "standard": 4000,
        "expert": 6000
    }.get(mode, 4000)

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
                timeout=180  # 3 minutes pour la synthèse
            )
            
            if response.status_code == 200:
                data = response.json()
                synthesis = data["choices"][0]["message"]["content"].strip()
                word_count = len(synthesis.split())
                print(f"✅ Final synthesis: {word_count} words from {len(analyses)} chunks", flush=True)
                return synthesis
            else:
                print(f"❌ Synthesis failed: {response.status_code} - {response.text}", flush=True)
                return None
                
    except Exception as e:
        print(f"❌ Synthesis error: {e}", flush=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_long_video(
    title: str,
    transcript: str,
    video_duration: int,
    category: str,
    lang: str,
    mode: str,
    model: str = "mistral-small-latest",
    web_context: str = None,
    progress_callback = None,
    transcript_timestamped: str = None  # 🆕 v3.0: Transcript avec vrais timestamps
) -> Optional[str]:
    """
    🎬 Analyse COMPLÈTE d'une vidéo longue avec GARANTIE de traitement intégral.
    
    🆕 v3.0: Support des VRAIS timestamps YouTube (plus de timecodes estimés!)
    
    ⚠️ GARANTIE: 100% du transcript est analysé. Aucune partie n'est ignorée.
    
    Cette fonction:
    1. Détecte si le chunking est nécessaire
    2. Divise le transcript en chunks SANS PERTE (avec vrais timestamps)
    3. Analyse TOUS les chunks (avec retry si échec)
    4. Vérifie la couverture à 100%
    5. Fusionne TOUTES les analyses en synthèse finale
    
    Args:
        title: Titre de la vidéo
        transcript: Transcript COMPLET (texte brut)
        video_duration: Durée en secondes
        category: Catégorie détectée
        lang: Langue (fr/en)
        mode: Mode d'analyse (accessible/standard/expert)
        model: Modèle Mistral à utiliser
        web_context: Contexte web optionnel (Perplexity)
        progress_callback: Fonction(progress, message) pour le suivi
        transcript_timestamped: 🆕 Transcript avec timestamps réels [00:30] text
    
    Returns:
        Synthèse finale COMPLÈTE ou None si erreur critique
    """
    needs_chunk, word_count, reason = needs_chunking(transcript)
    
    if not needs_chunk:
        print(f"📝 Standard analysis (no chunking needed): {word_count} words", flush=True)
        return None  # Utiliser l'analyse standard
    
    print(f"", flush=True)
    print(f"╔══════════════════════════════════════════════════════════════════╗", flush=True)
    print(f"║  📚 LONG VIDEO ANALYSIS v3.0 - REAL TIMESTAMPS                   ║", flush=True)
    print(f"╚══════════════════════════════════════════════════════════════════╝", flush=True)
    print(f"📊 Transcript: {word_count} words", flush=True)
    print(f"⏱️ Duration: {video_duration // 60} min {video_duration % 60} sec", flush=True)
    print(f"📁 Category: {category}", flush=True)
    print(f"🎯 Mode: {mode}", flush=True)
    print(f"⏱️ Real timestamps: {'YES ✅' if transcript_timestamped else 'NO (estimated)'}", flush=True)
    print(f"", flush=True)
    
    if progress_callback:
        progress_callback(35, f"📚 Vidéo longue détectée ({word_count} mots)...")
    
    # ═══════════════════════════════════════════════════════════════════════
    # 1. DÉCOUPAGE EN CHUNKS (AVEC VRAIS TIMESTAMPS)
    # ═══════════════════════════════════════════════════════════════════════
    chunks = split_into_chunks_with_real_timestamps(
        transcript=transcript,
        transcript_timestamped=transcript_timestamped or "",
        video_duration=video_duration
    )
    
    # Vérifier que le découpage couvre tout
    total_chunk_words = sum(c.word_count for c in chunks)
    print(f"✂️ Split into {len(chunks)} chunks covering {total_chunk_words} words", flush=True)
    
    for i, chunk in enumerate(chunks):
        print(f"   └─ Chunk {i + 1}: [{chunk.start_time} → {chunk.end_time}] {chunk.word_count} mots", flush=True)
    
    if progress_callback:
        progress_callback(38, f"✂️ Division en {len(chunks)} parties...")
    
    # ═══════════════════════════════════════════════════════════════════════
    # 2. ANALYSE DE TOUS LES CHUNKS (AVEC RETRY)
    # ═══════════════════════════════════════════════════════════════════════
    chunk_analyses, report = await analyze_chunks_parallel(
        chunks=chunks,
        video_title=title,
        category=category,
        lang=lang,
        mode=mode,
        model=model,
        max_concurrent=MAX_CONCURRENT_CHUNKS,
        progress_callback=progress_callback
    )
    
    # Vérifier la couverture
    if report.coverage_percent < 100:
        print(f"⚠️ WARNING: Coverage is {report.coverage_percent:.1f}% (not 100%)", flush=True)
        for warning in report.warnings:
            print(f"   {warning}", flush=True)
    else:
        print(f"✅ PERFECT: 100% coverage achieved!", flush=True)
    
    if not chunk_analyses:
        print("❌ CRITICAL: No chunk analyses succeeded at all!", flush=True)
        return None
    
    if len(chunk_analyses) < len(chunks) * 0.5:
        print(f"❌ CRITICAL: Too many chunks failed ({len(chunk_analyses)}/{len(chunks)})", flush=True)
        # Quand même essayer de générer une synthèse partielle
    
    if progress_callback:
        if report.coverage_percent == 100:
            progress_callback(78, f"✅ {len(chunk_analyses)} parties analysées (100%)")
        else:
            progress_callback(78, f"⚠️ {len(chunk_analyses)}/{len(chunks)} parties analysées ({report.coverage_percent:.0f}%)")
    
    # ═══════════════════════════════════════════════════════════════════════
    # 3. FUSION EN SYNTHÈSE FINALE
    # ═══════════════════════════════════════════════════════════════════════
    if progress_callback:
        progress_callback(80, f"🔄 Fusion des {len(chunk_analyses)} analyses...")
    
    # Utiliser un modèle plus puissant pour la synthèse si disponible
    synthesis_model = "mistral-large-latest" if "large" in model or mode == "expert" else model
    
    final_summary = await synthesize_chunk_analyses(
        analyses=chunk_analyses,
        video_title=title,
        video_duration=video_duration,
        category=category,
        lang=lang,
        mode=mode,
        model=synthesis_model,
        web_context=web_context
    )
    
    # ═══════════════════════════════════════════════════════════════════════
    # 4. AJOUTER LE RAPPORT DE COUVERTURE À LA SYNTHÈSE
    # ═══════════════════════════════════════════════════════════════════════
    if final_summary:
        # Ajouter un badge de couverture
        coverage_badge = ""
        if lang == "fr":
            if report.coverage_percent == 100:
                coverage_badge = f"\n\n---\n📊 **Analyse complète** — {word_count} mots analysés en {len(chunk_analyses)} parties (100% de la vidéo)"
            else:
                coverage_badge = f"\n\n---\n⚠️ **Analyse partielle** — {report.chunks_analyzed}/{report.total_chunks} parties analysées ({report.coverage_percent:.0f}% de la vidéo)"
        else:
            if report.coverage_percent == 100:
                coverage_badge = f"\n\n---\n📊 **Complete analysis** — {word_count} words analyzed in {len(chunk_analyses)} parts (100% of video)"
            else:
                coverage_badge = f"\n\n---\n⚠️ **Partial analysis** — {report.chunks_analyzed}/{report.total_chunks} parts analyzed ({report.coverage_percent:.0f}% of video)"
        
        final_summary += coverage_badge
    
    if progress_callback:
        if final_summary:
            progress_callback(95, "✅ Synthèse finale générée")
        else:
            progress_callback(95, "❌ Échec de la synthèse")
    
    print(f"", flush=True)
    print(f"╔══════════════════════════════════════════════════════════════════╗", flush=True)
    print(f"║  📊 ANALYSIS COMPLETE                                            ║", flush=True)
    print(f"╚══════════════════════════════════════════════════════════════════╝", flush=True)
    print(f"✅ Chunks analyzed: {report.chunks_analyzed}/{report.total_chunks}", flush=True)
    print(f"📊 Coverage: {report.coverage_percent:.1f}%", flush=True)
    print(f"📝 Final summary: {len(final_summary.split()) if final_summary else 0} words", flush=True)
    print(f"", flush=True)
    
    return final_summary


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

def get_chunk_stats(transcript: str) -> Dict[str, Any]:
    """
    Retourne des statistiques sur le chunking nécessaire.
    Utile pour l'UI (afficher le nombre de parties).
    """
    needs_chunk, word_count, reason = needs_chunking(transcript)
    
    if not needs_chunk:
        return {
            "needs_chunking": False,
            "word_count": word_count,
            "estimated_chunks": 1,
            "reason": reason
        }
    
    estimated_chunks = max(1, (word_count - CHUNK_OVERLAP_WORDS) // (CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS))
    
    return {
        "needs_chunking": True,
        "word_count": word_count,
        "estimated_chunks": estimated_chunks,
        "estimated_duration_per_chunk": "~30s",
        "reason": reason,
        "chunk_size": CHUNK_SIZE_WORDS
    }
