"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔪 PLAYLIST CHUNKER v5.0 — Découpage intelligent pour vidéos longues (1h30-4h+)  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🎯 Réutilise le moteur de long_video_analyzer pour le pipeline playlist          ║
║  📐 Chunking adaptatif : taille variable selon durée de la vidéo                  ║
║  🔗 Overlap contextuel pour cohérence inter-chunks                                ║
║  📊 Estimation de la charge Mistral avant envoi                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
from typing import List, Optional, Tuple
from dataclasses import dataclass, field

import logging
logger = logging.getLogger("deepsight.playlists.chunker")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION CHUNKING PLAYLIST
# ═══════════════════════════════════════════════════════════════════════════════

# Seuils de durée vidéo (en secondes)
SHORT_VIDEO_MAX = 20 * 60       # 20 min — pas de chunking
MEDIUM_VIDEO_MAX = 45 * 60      # 45 min — chunks larges
LONG_VIDEO_MAX = 90 * 60        # 1h30 — chunks standards
VERY_LONG_VIDEO_MAX = 180 * 60  # 3h — chunks compacts

# Tailles de chunks en mots (adaptatives)
CHUNK_CONFIGS = {
    "short":     {"chunk_words": 0,    "overlap": 0,   "max_summary_tokens": 2000},
    "medium":    {"chunk_words": 3000, "overlap": 400, "max_summary_tokens": 1500},
    "long":      {"chunk_words": 2500, "overlap": 350, "max_summary_tokens": 1200},
    "very_long": {"chunk_words": 2000, "overlap": 300, "max_summary_tokens": 1000},
    "ultra":     {"chunk_words": 1800, "overlap": 250, "max_summary_tokens": 800},
}

# Limites Mistral — importées depuis core/config (source of truth unique)
from core.config import MISTRAL_CONTEXT_WINDOWS as MISTRAL_CONTEXT_LIMITS

# Estimation chars → tokens
CHARS_PER_TOKEN = 4


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 DATACLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PlaylistChunk:
    """Un chunk de transcript pour analyse dans le pipeline playlist."""
    index: int
    total_chunks: int
    text: str
    word_count: int
    start_time: str = "00:00"
    end_time: str = "00:00"
    start_seconds: int = 0
    end_seconds: int = 0
    # Résultat
    digest: Optional[str] = None
    processed: bool = False
    error: Optional[str] = None
    retry_count: int = 0


@dataclass
class ChunkingPlan:
    """Plan de découpage pour une vidéo."""
    video_id: str
    video_title: str
    duration_seconds: int
    total_words: int
    tier: str                          # short | medium | long | very_long | ultra
    needs_chunking: bool
    num_chunks: int
    chunk_size_words: int
    overlap_words: int
    max_summary_tokens: int
    estimated_api_calls: int
    estimated_cost_tokens: int         # Tokens Mistral estimés
    chunks: List[PlaylistChunk] = field(default_factory=list)


@dataclass
class PlaylistChunkingReport:
    """Rapport global de chunking pour toute la playlist."""
    total_videos: int
    videos_needing_chunking: int
    total_chunks: int
    total_words: int
    total_api_calls: int
    estimated_total_tokens: int
    estimated_time_seconds: int
    plans: List[ChunkingPlan] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# 📏 DÉTECTION DU TIER DE VIDÉO
# ═══════════════════════════════════════════════════════════════════════════════

def get_video_tier(duration_seconds: int, word_count: int) -> str:
    """
    Détermine le tier de chunking basé sur la durée ET le nombre de mots.
    Double critère pour robustesse (une vidéo peut avoir un débit de parole variable).
    """
    if duration_seconds <= SHORT_VIDEO_MAX and word_count <= 4000:
        return "short"
    elif duration_seconds <= MEDIUM_VIDEO_MAX and word_count <= 8000:
        return "medium"
    elif duration_seconds <= LONG_VIDEO_MAX and word_count <= 20000:
        return "long"
    elif duration_seconds <= VERY_LONG_VIDEO_MAX and word_count <= 50000:
        return "very_long"
    else:
        return "ultra"


def estimate_tokens(text: str) -> int:
    """Estime le nombre de tokens Mistral pour un texte donné."""
    return len(text) // CHARS_PER_TOKEN


# ═══════════════════════════════════════════════════════════════════════════════
# 🔪 DÉCOUPAGE INTELLIGENT
# ═══════════════════════════════════════════════════════════════════════════════

def create_chunking_plan(
    video_id: str,
    video_title: str,
    transcript: str,
    transcript_timestamped: Optional[str],
    duration_seconds: int,
    model: str = "mistral-small-2603"
) -> ChunkingPlan:
    """
    Crée un plan de découpage adaptatif pour une vidéo.

    Le plan tient compte de :
    - La durée de la vidéo
    - Le nombre de mots du transcript
    - Les limites du modèle Mistral
    - Les timestamps réels si disponibles
    """
    words = transcript.split()
    word_count = len(words)
    tier = get_video_tier(duration_seconds, word_count)
    config = CHUNK_CONFIGS[tier]

    # Vidéo courte → pas de chunking
    if tier == "short" or word_count <= 3500:
        return ChunkingPlan(
            video_id=video_id,
            video_title=video_title,
            duration_seconds=duration_seconds,
            total_words=word_count,
            tier=tier,
            needs_chunking=False,
            num_chunks=1,
            chunk_size_words=word_count,
            overlap_words=0,
            max_summary_tokens=config["max_summary_tokens"],
            estimated_api_calls=1,
            estimated_cost_tokens=estimate_tokens(transcript) + 2000,
            chunks=[PlaylistChunk(
                index=0,
                total_chunks=1,
                text=transcript,
                word_count=word_count,
                start_time="00:00",
                end_time=_format_seconds(duration_seconds),
                start_seconds=0,
                end_seconds=duration_seconds,
            )]
        )

    # Vidéo longue → chunking adaptatif
    chunk_size = config["chunk_words"]
    overlap = config["overlap"]

    chunks = _split_transcript(
        transcript=transcript,
        transcript_timestamped=transcript_timestamped,
        duration_seconds=duration_seconds,
        chunk_size=chunk_size,
        overlap=overlap
    )

    num_chunks = len(chunks)
    # API calls = chunks (résumé) + 1 (merge final)
    api_calls = num_chunks + 1
    # Tokens estimés = somme des chunks + prompt overhead
    est_tokens = sum(estimate_tokens(c.text) + 1500 for c in chunks) + 3000

    logger.info(
        f"chunking_plan: video={video_id} tier={tier} "
        f"words={word_count} chunks={num_chunks} "
        f"est_tokens={est_tokens:,} est_calls={api_calls}"
    )

    return ChunkingPlan(
        video_id=video_id,
        video_title=video_title,
        duration_seconds=duration_seconds,
        total_words=word_count,
        tier=tier,
        needs_chunking=True,
        num_chunks=num_chunks,
        chunk_size_words=chunk_size,
        overlap_words=overlap,
        max_summary_tokens=config["max_summary_tokens"],
        estimated_api_calls=api_calls,
        estimated_cost_tokens=est_tokens,
        chunks=chunks
    )


def _split_transcript(
    transcript: str,
    transcript_timestamped: Optional[str],
    duration_seconds: int,
    chunk_size: int,
    overlap: int
) -> List[PlaylistChunk]:
    """
    Découpe un transcript en chunks avec :
    - Coupure sur les phrases (pas au milieu d'un mot)
    - Overlap contextuel entre chunks consécutifs
    - Timestamps réels si disponibles
    - Garantie : 100% du transcript est couvert
    """
    words = transcript.split()
    total_words = len(words)

    # Parser les timestamps réels
    real_timestamps = _parse_timestamps(transcript_timestamped) if transcript_timestamped else []
    has_real_ts = len(real_timestamps) > 0

    chunks = []
    current_pos = 0
    chunk_index = 0

    while current_pos < total_words:
        # Fin du chunk
        end_pos = min(current_pos + chunk_size, total_words)

        # Ajuster pour finir sur une phrase
        if end_pos < total_words:
            end_pos = _find_sentence_boundary(words, current_pos, end_pos, min_advance=chunk_size // 2)

        chunk_text = " ".join(words[current_pos:end_pos])
        chunk_word_count = end_pos - current_pos

        # Timestamps
        if has_real_ts:
            start_sec = _get_timestamp_at_position(real_timestamps, current_pos, total_words, duration_seconds)
            end_sec = _get_timestamp_at_position(real_timestamps, end_pos, total_words, duration_seconds)
        else:
            start_sec = int((current_pos / total_words) * duration_seconds) if total_words > 0 else 0
            end_sec = int((end_pos / total_words) * duration_seconds) if total_words > 0 else 0

        chunks.append(PlaylistChunk(
            index=chunk_index,
            total_chunks=0,  # Sera mis à jour après
            text=chunk_text,
            word_count=chunk_word_count,
            start_time=_format_seconds(start_sec),
            end_time=_format_seconds(end_sec),
            start_seconds=start_sec,
            end_seconds=end_sec,
        ))

        chunk_index += 1
        # Avancer avec overlap
        current_pos = end_pos - overlap if end_pos < total_words else total_words

    # Mettre à jour total_chunks
    for c in chunks:
        c.total_chunks = len(chunks)

    return chunks


def _find_sentence_boundary(
    words: List[str],
    start_pos: int,
    target_end: int,
    min_advance: int
) -> int:
    """
    Cherche la fin de phrase la plus proche de target_end.
    Ne recule pas en-dessous de min_advance mots depuis start_pos.
    """
    min_end = start_pos + min_advance
    best_end = target_end

    # Chercher un point/!/? dans les 300 derniers mots du chunk
    search_start = max(target_end - 300, min_end)

    for i in range(target_end - 1, search_start - 1, -1):
        if i >= len(words):
            continue
        word = words[i]
        if word.endswith(('.', '!', '?', '."', '."')):
            best_end = i + 1
            break

    return best_end


def _parse_timestamps(transcript_timestamped: str) -> List[Tuple[int, int]]:
    """
    Parse les timestamps réels du transcript.
    Returns: Liste de (seconds, word_offset_estimate)
    """
    if not transcript_timestamped:
        return []

    segments = []
    pattern = r'\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*([^\[]*)'
    matches = re.findall(pattern, transcript_timestamped)

    word_offset = 0
    for match in matches:
        if match[2]:
            total_seconds = int(match[0]) * 3600 + int(match[1]) * 60 + int(match[2])
        else:
            total_seconds = int(match[0]) * 60 + int(match[1])

        text = match[3].strip()
        text_word_count = len(text.split()) if text else 0

        segments.append((total_seconds, word_offset))
        word_offset += text_word_count

    return segments


def _get_timestamp_at_position(
    timestamps: List[Tuple[int, int]],
    word_pos: int,
    total_words: int,
    duration: int
) -> int:
    """Retourne le timestamp (en secondes) correspondant à une position de mot."""
    if not timestamps:
        return int((word_pos / max(total_words, 1)) * duration)

    # Trouver le segment le plus proche
    best_seconds = 0
    for seconds, offset in timestamps:
        if offset <= word_pos:
            best_seconds = seconds
        else:
            break

    return best_seconds


def _format_seconds(seconds: int) -> str:
    """Formate des secondes en HH:MM:SS ou MM:SS."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 RAPPORT DE CHUNKING GLOBAL
# ═══════════════════════════════════════════════════════════════════════════════

def create_playlist_chunking_report(plans: List[ChunkingPlan]) -> PlaylistChunkingReport:
    """
    Génère un rapport global de chunking pour toute la playlist.
    Utile pour estimer le temps et le coût avant de lancer l'analyse.
    """
    total_chunks = sum(p.num_chunks for p in plans)
    total_words = sum(p.total_words for p in plans)
    total_api_calls = sum(p.estimated_api_calls for p in plans)
    total_tokens = sum(p.estimated_cost_tokens for p in plans)
    videos_chunked = sum(1 for p in plans if p.needs_chunking)

    # Estimation temps :
    # - 3s par appel API (avg)
    # - Parallélisme de 3 vidéos
    # - 2 chunks simultanés par vidéo
    time_per_call = 3
    parallel_factor = min(3, len(plans))
    estimated_time = int((total_api_calls * time_per_call) / max(parallel_factor, 1))
    # Ajouter 30% de marge pour network/retry
    estimated_time = int(estimated_time * 1.3)

    return PlaylistChunkingReport(
        total_videos=len(plans),
        videos_needing_chunking=videos_chunked,
        total_chunks=total_chunks,
        total_words=total_words,
        total_api_calls=total_api_calls,
        estimated_total_tokens=total_tokens,
        estimated_time_seconds=estimated_time,
        plans=plans
    )
