"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎬 DURATION ROUTER v1.0 — Routeur intelligent par durée de vidéo                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Catégorise les vidéos AVANT l'analyse et route vers le pipeline adapté.           ║
║                                                                                    ║
║  Tiers :                                                                           ║
║  1. SHORT  (<5 min)  — TikTok/Shorts/clips : transcript complet, pas de chunking  ║
║  2. MEDIUM (5-30 min) — Vidéos classiques : transcript complet, index léger       ║
║  3. LONG   (>30 min)  — Conférences/podcasts : chunking + index structuré         ║
║                                                                                    ║
║  Produit un structured_index (table des matières temporelle) stocké en DB           ║
║  pour le chat IA et l'analyse enrichie.                                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import json
import logging
from typing import Optional, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ENUMS & TYPES
# ═══════════════════════════════════════════════════════════════════════════════

class VideoTier(str, Enum):
    """Catégorisation des vidéos par durée."""
    SHORT = "short"      # <5 min (TikTok, Shorts, clips)
    MEDIUM = "medium"    # 5-30 min (vidéos classiques)
    LONG = "long"        # >30 min (conférences, podcasts, cours)


@dataclass
class VideoProfile:
    """Profil complet d'une vidéo pour le routage."""
    tier: VideoTier
    duration_seconds: int
    transcript_chars: int
    transcript_words: int
    has_timestamps: bool

    # Paramètres dérivés pour le pipeline
    needs_chunking: bool = False
    max_transcript_for_analysis: int = 0
    max_transcript_for_chat: int = 0
    chunk_duration_minutes: int = 0
    analysis_model_preference: str = ""  # Suggestion de modèle

    # Index structuré
    structured_index: Optional[str] = None  # JSON table des matières


@dataclass
class IndexEntry:
    """Une entrée dans l'index structuré (table des matières)."""
    timestamp_seconds: int
    timestamp_str: str
    title: str
    summary: str = ""
    keywords: List[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION PAR TIER
# ═══════════════════════════════════════════════════════════════════════════════

TIER_CONFIG = {
    VideoTier.SHORT: {
        "max_duration": 300,           # 5 min
        "needs_chunking": False,
        "max_transcript_for_analysis": 50_000,   # Tout le transcript
        "max_transcript_for_chat": 50_000,       # Tout le transcript
        "chunk_duration_minutes": 0,
        "index_granularity_seconds": 0,          # Pas d'index
        "analysis_model_preference": "fast",     # Modèle rapide suffit
    },
    VideoTier.MEDIUM: {
        "max_duration": 1800,          # 30 min
        "needs_chunking": False,       # Le transcript tient en un prompt
        "max_transcript_for_analysis": 120_000,  # ~30K mots
        "max_transcript_for_chat": 80_000,       # Quasi-complet
        "chunk_duration_minutes": 0,
        "index_granularity_seconds": 120,        # Index toutes les 2 min
        "analysis_model_preference": "standard",
    },
    VideoTier.LONG: {
        "max_duration": float("inf"),  # 30 min+
        "needs_chunking": True,
        "max_transcript_for_analysis": 300_000,  # Via chunking multi-pass
        "max_transcript_for_chat": 50_000,       # Index + chunks pertinents
        "chunk_duration_minutes": 10,            # 10 min par chunk
        "index_granularity_seconds": 60,         # Index toute la minute
        "analysis_model_preference": "quality",  # Modèle le plus puissant
    },
}

# Pour les vidéos très longues (>2h), augmenter la taille des chunks
VERY_LONG_THRESHOLD = 7200  # 2h
ULTRA_LONG_THRESHOLD = 10800  # 3h


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE : CATEGORISER UNE VIDEO
# ═══════════════════════════════════════════════════════════════════════════════

def categorize_video(
    duration_seconds: int,
    transcript: str,
    transcript_timestamped: Optional[str] = None,
) -> VideoProfile:
    """
    Catégorise une vidéo et retourne son profil complet pour le routage.

    Args:
        duration_seconds: Durée de la vidéo en secondes
        transcript: Transcript brut (texte plein)
        transcript_timestamped: Transcript avec timestamps [MM:SS] (optionnel)

    Returns:
        VideoProfile avec tous les paramètres de routage
    """
    transcript_chars = len(transcript) if transcript else 0
    transcript_words = len(transcript.split()) if transcript else 0
    has_timestamps = bool(transcript_timestamped and len(transcript_timestamped) > 100)

    # Déterminer le tier
    if duration_seconds <= 0:
        # Durée inconnue → estimer à partir du transcript
        # ~150 mots/min en parole, ~4 chars/mot
        estimated_duration = (transcript_words / 150) * 60
        duration_seconds = int(estimated_duration) if estimated_duration > 0 else 600
        logger.info(f"Duration unknown, estimated from transcript: {duration_seconds}s ({transcript_words} words)")

    if duration_seconds <= TIER_CONFIG[VideoTier.SHORT]["max_duration"]:
        tier = VideoTier.SHORT
    elif duration_seconds <= TIER_CONFIG[VideoTier.MEDIUM]["max_duration"]:
        tier = VideoTier.MEDIUM
    else:
        tier = VideoTier.LONG

    config = TIER_CONFIG[tier]

    # Ajuster les chunks pour les vidéos très longues
    chunk_minutes = config["chunk_duration_minutes"]
    if tier == VideoTier.LONG:
        if duration_seconds > ULTRA_LONG_THRESHOLD:
            chunk_minutes = 20  # 3h+ → chunks de 20 min
        elif duration_seconds > VERY_LONG_THRESHOLD:
            chunk_minutes = 15  # 2h+ → chunks de 15 min

    profile = VideoProfile(
        tier=tier,
        duration_seconds=duration_seconds,
        transcript_chars=transcript_chars,
        transcript_words=transcript_words,
        has_timestamps=has_timestamps,
        needs_chunking=config["needs_chunking"],
        max_transcript_for_analysis=config["max_transcript_for_analysis"],
        max_transcript_for_chat=config["max_transcript_for_chat"],
        chunk_duration_minutes=chunk_minutes,
        analysis_model_preference=config["analysis_model_preference"],
    )

    logger.info(
        "video_categorized",
        extra={
            "tier": tier.value,
            "duration": duration_seconds,
            "transcript_chars": transcript_chars,
            "transcript_words": transcript_words,
            "has_timestamps": has_timestamps,
            "needs_chunking": profile.needs_chunking,
            "chunk_minutes": chunk_minutes,
        }
    )

    return profile


# ═══════════════════════════════════════════════════════════════════════════════
# 📑 INDEX STRUCTURÉ — Table des matières temporelle
# ═══════════════════════════════════════════════════════════════════════════════

def build_structured_index(
    transcript_timestamped: str,
    duration_seconds: int,
    tier: VideoTier,
) -> List[IndexEntry]:
    """
    Construit un index structuré (table des matières) à partir du transcript timestampé.

    Pour les vidéos MEDIUM et LONG, produit une liste d'entrées avec :
    - Timestamp précis
    - Résumé du contenu à ce point
    - Mots-clés

    Args:
        transcript_timestamped: Transcript avec timestamps [MM:SS] ou [HH:MM:SS]
        duration_seconds: Durée totale en secondes
        tier: Tier de la vidéo

    Returns:
        Liste d'IndexEntry
    """
    if tier == VideoTier.SHORT:
        return []  # Pas d'index pour les vidéos courtes

    if not transcript_timestamped:
        return []

    # Parser les timestamps du transcript
    segments = _parse_timestamped_segments(transcript_timestamped)
    if not segments:
        return []

    config = TIER_CONFIG[tier]
    granularity = config["index_granularity_seconds"]

    # Regrouper les segments selon la granularité
    entries = []
    current_group_start = 0
    current_group_texts: List[str] = []
    last_timestamp = 0

    for ts_seconds, text in segments:
        # Nouveau groupe si on a dépassé la granularité
        if ts_seconds - current_group_start >= granularity and current_group_texts:
            entry = _create_index_entry(
                start_seconds=current_group_start,
                texts=current_group_texts,
            )
            entries.append(entry)
            current_group_start = ts_seconds
            current_group_texts = []

        current_group_texts.append(text)
        last_timestamp = ts_seconds

    # Dernier groupe
    if current_group_texts:
        entry = _create_index_entry(
            start_seconds=current_group_start,
            texts=current_group_texts,
        )
        entries.append(entry)

    logger.info(
        "structured_index_built",
        extra={
            "tier": tier.value,
            "total_segments": len(segments),
            "index_entries": len(entries),
            "duration": duration_seconds,
        }
    )

    return entries


def serialize_index(entries: List[IndexEntry]) -> str:
    """Sérialise l'index structuré en JSON pour stockage en DB."""
    if not entries:
        return "[]"

    data = []
    for entry in entries:
        data.append({
            "ts": entry.timestamp_seconds,
            "t": entry.timestamp_str,
            "title": entry.title,
            "summary": entry.summary,
            "kw": entry.keywords,
        })

    return json.dumps(data, ensure_ascii=False)


def deserialize_index(json_str: str) -> List[IndexEntry]:
    """Désérialise l'index structuré depuis le JSON DB."""
    if not json_str:
        return []

    try:
        data = json.loads(json_str)
        entries = []
        for item in data:
            entries.append(IndexEntry(
                timestamp_seconds=item.get("ts", 0),
                timestamp_str=item.get("t", "0:00"),
                title=item.get("title", ""),
                summary=item.get("summary", ""),
                keywords=item.get("kw", []),
            ))
        return entries
    except (json.JSONDecodeError, TypeError, KeyError) as e:
        logger.warning(f"Failed to deserialize structured index: {e}")
        return []


def format_index_for_prompt(entries: List[IndexEntry], lang: str = "fr") -> str:
    """
    Formate l'index structuré pour injection dans un prompt Mistral.

    Produit un texte compact type table des matières :
    [MM:SS] Titre — résumé court (mots-clés)
    """
    if not entries:
        return ""

    header = "📑 TABLE DES MATIÈRES DE LA VIDÉO :" if lang == "fr" else "📑 VIDEO TABLE OF CONTENTS:"
    lines = [header, ""]

    for entry in entries:
        kw_str = f" ({', '.join(entry.keywords[:3])})" if entry.keywords else ""
        summary_str = f" — {entry.summary}" if entry.summary else ""
        lines.append(f"[{entry.timestamp_str}] {entry.title}{summary_str}{kw_str}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 RECHERCHE DANS LES CHUNKS — Pour le chat IA
# ═══════════════════════════════════════════════════════════════════════════════

def search_relevant_chunks(
    query: str,
    transcript_timestamped: str,
    index_entries: List[IndexEntry],
    max_chunks: int = 3,
    chunk_context_chars: int = 3000,
) -> str:
    """
    Recherche les passages du transcript les plus pertinents pour une question.

    Stratégie :
    1. Chercher dans l'index structuré les entrées les plus pertinentes (mots-clés)
    2. Extraire les passages correspondants du transcript complet
    3. Retourner les N passages les plus pertinents avec leur contexte

    Args:
        query: Question de l'utilisateur
        transcript_timestamped: Transcript complet avec timestamps
        index_entries: Index structuré de la vidéo
        max_chunks: Nombre max de passages à retourner
        chunk_context_chars: Taille max de chaque passage

    Returns:
        Texte formaté des passages pertinents avec timestamps
    """
    if not transcript_timestamped or not query:
        return ""

    query_lower = query.lower()
    query_words = set(re.findall(r'\b\w{3,}\b', query_lower))

    # ── Étape 1 : Scorer les entrées de l'index ──
    scored_entries: List[Tuple[float, IndexEntry]] = []
    for entry in index_entries:
        score = _score_entry_relevance(entry, query_words, query_lower)
        if score > 0:
            scored_entries.append((score, entry))

    # Trier par score décroissant
    scored_entries.sort(key=lambda x: x[0], reverse=True)

    # ── Étape 2 : Extraire les passages du transcript ──
    passages = []
    used_timestamps = set()

    for score, entry in scored_entries[:max_chunks * 2]:
        if entry.timestamp_seconds in used_timestamps:
            continue

        passage = _extract_passage_at_timestamp(
            transcript_timestamped,
            target_seconds=entry.timestamp_seconds,
            context_chars=chunk_context_chars,
        )

        if passage:
            passages.append({
                "timestamp": entry.timestamp_str,
                "seconds": entry.timestamp_seconds,
                "title": entry.title,
                "text": passage,
                "score": score,
            })
            used_timestamps.add(entry.timestamp_seconds)

        if len(passages) >= max_chunks:
            break

    # ── Étape 3 : Fallback — recherche brute dans le transcript ──
    if not passages:
        passages = _brute_search_transcript(
            transcript_timestamped, query_words, max_chunks, chunk_context_chars
        )

    if not passages:
        return ""

    # ── Formater les résultats ──
    parts = ["📍 PASSAGES PERTINENTS DU TRANSCRIPT :\n"]
    for p in passages:
        ts = p.get("timestamp", "?")
        title = p.get("title", "")
        text = p.get("text", "")
        header = f"[{ts}] {title}" if title else f"[{ts}]"
        parts.append(f"--- {header} ---\n{text}\n")

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS INTERNES
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_timestamped_segments(transcript: str) -> List[Tuple[int, str]]:
    """
    Parse un transcript timestampé en paires (secondes, texte).

    Supporte :
    - [HH:MM:SS] texte
    - [MM:SS] texte
    - HH:MM:SS texte
    - MM:SS texte
    """
    patterns = [
        r'\[(\d{1,2}):(\d{2}):(\d{2})\]\s*(.*?)(?=\[\d|\Z)',
        r'\[(\d{1,2}):(\d{2})\]\s*(.*?)(?=\[\d|\Z)',
        r'(\d{1,2}):(\d{2}):(\d{2})\s+(.*?)(?=\d{1,2}:\d{2}|\Z)',
        r'(\d{1,2}):(\d{2})\s+(.*?)(?=\d{1,2}:\d{2}|\Z)',
    ]

    for pattern in patterns:
        matches = list(re.finditer(pattern, transcript, re.DOTALL))
        if len(matches) >= 3:
            segments = []
            for match in matches:
                groups = match.groups()
                if len(groups) == 4:  # HH:MM:SS + text
                    seconds = int(groups[0]) * 3600 + int(groups[1]) * 60 + int(groups[2])
                    text = groups[3].strip()
                elif len(groups) == 3:  # MM:SS + text
                    seconds = int(groups[0]) * 60 + int(groups[1])
                    text = groups[2].strip()
                else:
                    continue
                if text:
                    segments.append((seconds, text))
            return sorted(segments, key=lambda x: x[0])

    return []


def _format_timestamp(seconds: int) -> str:
    """Formate des secondes en HH:MM:SS ou MM:SS."""
    if seconds <= 0:
        return "0:00"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _create_index_entry(start_seconds: int, texts: List[str]) -> IndexEntry:
    """
    Crée une entrée d'index à partir d'un groupe de segments texte.
    Extrait un titre court et des mots-clés.
    """
    combined = " ".join(texts)

    # Titre : première phrase significative, tronquée à 80 chars
    sentences = re.split(r'[.!?]\s', combined)
    title = ""
    for sent in sentences:
        sent = sent.strip()
        if len(sent) > 15:  # Ignorer les fragments trop courts
            title = sent[:80].rstrip(" .,;:-")
            break
    if not title:
        title = combined[:60].rstrip(" .,;:-")

    # Résumé : les 2 premières phrases significatives
    meaningful = [s.strip() for s in sentences if len(s.strip()) > 15]
    summary = ". ".join(meaningful[:2])[:200] if meaningful else combined[:200]

    # Mots-clés : mots de 4+ lettres les plus fréquents (hors stop words)
    stop_words_fr = {
        "dans", "pour", "avec", "cette", "plus", "tout", "fait", "être",
        "avoir", "nous", "vous", "mais", "donc", "comme", "aussi", "même",
        "encore", "très", "bien", "alors", "sont", "peut", "elle", "elles",
        "leur", "quel", "quoi", "dont", "entre", "autre", "après",
    }
    words = re.findall(r'\b\w{4,}\b', combined.lower())
    word_freq = {}
    for w in words:
        if w not in stop_words_fr:
            word_freq[w] = word_freq.get(w, 0) + 1
    keywords = sorted(word_freq, key=word_freq.get, reverse=True)[:5]

    return IndexEntry(
        timestamp_seconds=start_seconds,
        timestamp_str=_format_timestamp(start_seconds),
        title=title,
        summary=summary,
        keywords=keywords,
    )


def _score_entry_relevance(
    entry: IndexEntry,
    query_words: set,
    query_lower: str,
) -> float:
    """Score de pertinence d'une entrée d'index par rapport à une requête."""
    score = 0.0

    # Match sur les mots-clés de l'index
    entry_keywords = set(kw.lower() for kw in entry.keywords)
    common = query_words & entry_keywords
    score += len(common) * 3.0

    # Match sur le titre
    title_lower = entry.title.lower()
    for word in query_words:
        if word in title_lower:
            score += 2.0

    # Match sur le résumé
    summary_lower = entry.summary.lower()
    for word in query_words:
        if word in summary_lower:
            score += 1.0

    # Bonus si sous-chaîne directe de la query dans le titre
    for phrase_len in range(3, len(query_lower) + 1):
        for i in range(len(query_lower) - phrase_len + 1):
            phrase = query_lower[i:i + phrase_len]
            if len(phrase) > 6 and phrase in title_lower:
                score += 1.5
                break

    return score


def _extract_passage_at_timestamp(
    transcript: str,
    target_seconds: int,
    context_chars: int = 3000,
) -> str:
    """
    Extrait un passage du transcript autour d'un timestamp donné.
    Cherche le timestamp le plus proche et prend du contexte autour.
    """
    # Trouver la position dans le transcript correspondant au timestamp
    target_str = _format_timestamp(target_seconds)

    # Chercher le timestamp exact ou le plus proche
    patterns = [
        rf'\[{re.escape(target_str)}\]',
        rf'{re.escape(target_str)}\s',
    ]

    best_pos = -1
    for pattern in patterns:
        match = re.search(pattern, transcript)
        if match:
            best_pos = match.start()
            break

    if best_pos == -1:
        # Fallback : chercher un timestamp proche (±30s)
        for offset in range(0, 60, 5):
            for delta in [offset, -offset]:
                nearby = target_seconds + delta
                if nearby < 0:
                    continue
                nearby_str = _format_timestamp(nearby)
                for pattern in [rf'\[{re.escape(nearby_str)}\]', rf'{re.escape(nearby_str)}\s']:
                    match = re.search(pattern, transcript)
                    if match:
                        best_pos = match.start()
                        break
                if best_pos != -1:
                    break
            if best_pos != -1:
                break

    if best_pos == -1:
        return ""

    # Extraire le contexte autour
    half = context_chars // 2
    start = max(0, best_pos - half)
    end = min(len(transcript), best_pos + half)

    passage = transcript[start:end].strip()

    # Nettoyer : commencer/finir sur des frontières de phrase
    if start > 0:
        first_break = passage.find('. ')
        if first_break > 0 and first_break < 200:
            passage = passage[first_break + 2:]

    if end < len(transcript):
        last_break = passage.rfind('. ')
        if last_break > len(passage) - 200 and last_break > 0:
            passage = passage[:last_break + 1]

    return passage


def _brute_search_transcript(
    transcript: str,
    query_words: set,
    max_results: int = 3,
    chunk_size: int = 3000,
) -> List[dict]:
    """
    Recherche brute dans le transcript quand l'index ne suffit pas.
    Découpe le transcript en fenêtres et score chaque fenêtre.
    """
    if not transcript or not query_words:
        return []

    # Découper en fenêtres avec overlap
    step = chunk_size // 2  # 50% overlap
    windows = []
    for i in range(0, len(transcript), step):
        window = transcript[i:i + chunk_size]
        if len(window) < 100:
            continue

        # Scorer
        window_lower = window.lower()
        score = sum(1 for w in query_words if w in window_lower)

        # Extraire le timestamp le plus proche
        ts_match = re.search(r'\[(\d{1,2}):(\d{2}(?::\d{2})?)\]', window)
        ts_str = ts_match.group(0).strip("[]") if ts_match else "?"

        if score > 0:
            windows.append({
                "timestamp": ts_str,
                "text": window.strip(),
                "score": score,
            })

    # Trier et retourner les meilleurs
    windows.sort(key=lambda x: x["score"], reverse=True)
    return windows[:max_results]


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 HELPER : Préparer le transcript pour l'analyse selon le tier
# ═══════════════════════════════════════════════════════════════════════════════

def prepare_transcript_for_analysis(
    profile: VideoProfile,
    transcript: str,
    transcript_timestamped: Optional[str] = None,
    index_entries: Optional[List[IndexEntry]] = None,
) -> str:
    """
    Prépare le transcript pour envoi à Mistral selon le tier.

    - SHORT : transcript complet, pas de modification
    - MEDIUM : transcript complet + index en header
    - LONG : NE PAS UTILISER — les vidéos longues passent par analyze_long_video()

    Returns:
        Transcript prêt pour le prompt, avec index si applicable
    """
    source = transcript_timestamped if transcript_timestamped else transcript

    if profile.tier == VideoTier.SHORT:
        # Tout le transcript, tronqué à la limite de sécurité
        return source[:profile.max_transcript_for_analysis]

    if profile.tier == VideoTier.MEDIUM:
        # Transcript complet + index en header pour guider l'analyse
        index_text = ""
        if index_entries:
            index_text = format_index_for_prompt(index_entries) + "\n\n"
        return (index_text + source)[:profile.max_transcript_for_analysis]

    # LONG → ne devrait pas arriver ici (chunking séparé)
    # Fallback de sécurité
    logger.warning("prepare_transcript_for_analysis called for LONG video — should use analyze_long_video()")
    return source[:profile.max_transcript_for_analysis]


def prepare_transcript_for_chat(
    profile: VideoProfile,
    full_transcript: str,
    query: str,
    index_entries: Optional[List[IndexEntry]] = None,
    full_digest: str = "",
    summary_content: str = "",
) -> str:
    """
    Prépare le contexte transcript pour le chat IA selon le tier.

    - SHORT : transcript complet
    - MEDIUM : index + segments clés extraits autour de la question
    - LONG : index + passages pertinents recherchés + digest

    Args:
        profile: VideoProfile de la vidéo
        full_transcript: Transcript complet
        query: Question de l'utilisateur
        index_entries: Index structuré
        full_digest: Digest complet (pour les vidéos longues)
        summary_content: Analyse markdown (pour contexte)

    Returns:
        Contexte transcript optimisé pour le chat
    """
    if profile.tier == VideoTier.SHORT:
        return full_transcript[:profile.max_transcript_for_chat]

    if profile.tier == VideoTier.MEDIUM:
        parts = []

        # Index pour la navigation
        if index_entries:
            parts.append(format_index_for_prompt(index_entries))
            parts.append("")

        # Rechercher les passages pertinents
        if index_entries and query:
            relevant = search_relevant_chunks(
                query=query,
                transcript_timestamped=full_transcript,
                index_entries=index_entries,
                max_chunks=3,
                chunk_context_chars=5000,
            )
            if relevant:
                parts.append(relevant)
            else:
                # Fallback : transcript complet si assez court
                parts.append(full_transcript[:profile.max_transcript_for_chat])
        else:
            parts.append(full_transcript[:profile.max_transcript_for_chat])

        return "\n\n".join(parts)[:profile.max_transcript_for_chat]

    # LONG — index + digest + passages pertinents
    parts = []

    # 1. Index structuré (compact)
    if index_entries:
        parts.append(format_index_for_prompt(index_entries))
        parts.append("")

    # 2. Digest complet (vue d'ensemble)
    if full_digest:
        parts.append(f"📋 RÉSUMÉ COMPLET DU CONTENU :\n{full_digest[:8000]}")
        parts.append("")

    # 3. Passages pertinents pour la question
    if index_entries and query:
        relevant = search_relevant_chunks(
            query=query,
            transcript_timestamped=full_transcript,
            index_entries=index_entries,
            max_chunks=4,
            chunk_context_chars=4000,
        )
        if relevant:
            parts.append(relevant)

    # 4. Si pas de passage trouvé, fallback sur intro + outro
    if len(parts) <= 2:  # Seulement index + digest
        intro = full_transcript[:5000] if full_transcript else ""
        outro = full_transcript[-5000:] if full_transcript and len(full_transcript) > 5000 else ""
        if intro:
            parts.append(f"📍 DÉBUT DU TRANSCRIPT :\n{intro}")
        if outro:
            parts.append(f"📍 FIN DU TRANSCRIPT :\n{outro}")

    return "\n\n".join(parts)[:profile.max_transcript_for_chat]
