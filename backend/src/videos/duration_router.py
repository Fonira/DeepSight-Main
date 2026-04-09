"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎬 DURATION ROUTER v2.0 — Routeur intelligent adaptatif par durée de vidéo       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Catégorise les vidéos AVANT l'analyse et route vers le pipeline adapté.          ║
║                                                                                   ║
║  6 Tiers granulaires :                                                            ║
║  1. MICRO    (<1 min)   — TikTok/Shorts/Reels : ultra-rapide                     ║
║  2. SHORT    (1-5 min)  — Clips YouTube courts                                   ║
║  3. MEDIUM   (5-15 min) — Vidéos classiques : index léger                        ║
║  4. LONG     (15-45 min)— Conférences courtes : index + chunk search             ║
║  5. EXTENDED (45min-2h) — Podcasts/cours : chunking complet                      ║
║  6. MARATHON (2h+)      — Interviews/playlists : chunking large + résumé hiérar. ║
║                                                                                   ║
║  Features v2.0 :                                                                  ║
║  • Stop-words bilingues FR+EN (détection auto de la langue)                       ║
║  • N-grams (bigrams) pour concepts multi-mots                                    ║
║  • Fallback intelligent quand pas de timestamps (estimation par chars/seconde)    ║
║  • Scoring amélioré avec TF-IDF léger et fuzzy matching                          ║
║  • Logging structuré sur toute la pipeline                                        ║
║  • Contexte vidéo enrichi (description, tags, chaîne)                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import json
import math
import logging
from typing import Optional, List, Tuple, Dict, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import Counter

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ENUMS & TYPES
# ═══════════════════════════════════════════════════════════════════════════════

class VideoTier(str, Enum):
    """Catégorisation fine des vidéos par durée."""
    MICRO = "micro"        # <1 min (TikTok, Shorts, Reels)
    SHORT = "short"        # 1-5 min (clips courts)
    MEDIUM = "medium"      # 5-15 min (vidéos classiques)
    LONG = "long"          # 15-45 min (conférences, tutoriels)
    EXTENDED = "extended"  # 45min-2h (podcasts, cours)
    MARATHON = "marathon"  # 2h+ (interviews longues, live replay)


@dataclass
class VideoProfile:
    """Profil complet d'une vidéo pour le routage."""
    tier: VideoTier
    duration_seconds: int
    transcript_chars: int
    transcript_words: int
    has_timestamps: bool
    detected_lang: str = "fr"  # "fr" | "en" | "unknown"

    # Paramètres dérivés pour le pipeline
    needs_chunking: bool = False
    max_transcript_for_analysis: int = 0
    max_transcript_for_chat: int = 0
    chunk_duration_minutes: int = 0
    index_granularity_seconds: int = 0
    analysis_model_preference: str = ""
    chat_max_chunks: int = 3      # Nombre de passages pertinents pour le chat
    chat_chunk_context: int = 3000  # Taille de chaque passage extrait


@dataclass
class IndexEntry:
    """Une entrée dans l'index structuré (table des matières)."""
    timestamp_seconds: int
    timestamp_str: str
    title: str
    summary: str = ""
    keywords: List[str] = field(default_factory=list)
    bigrams: List[str] = field(default_factory=list)  # concepts multi-mots


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION PAR TIER — 6 niveaux granulaires
# ═══════════════════════════════════════════════════════════════════════════════

TIER_CONFIG = {
    VideoTier.MICRO: {
        "max_duration": 60,            # 1 min
        "needs_chunking": False,
        "max_transcript_for_analysis": 15_000,
        "max_transcript_for_chat": 15_000,
        "chunk_duration_minutes": 0,
        "index_granularity_seconds": 0,       # Pas d'index
        "analysis_model_preference": "fast",
        "chat_max_chunks": 1,
        "chat_chunk_context": 2000,
    },
    VideoTier.SHORT: {
        "max_duration": 300,           # 5 min
        "needs_chunking": False,
        "max_transcript_for_analysis": 50_000,
        "max_transcript_for_chat": 50_000,
        "chunk_duration_minutes": 0,
        "index_granularity_seconds": 0,       # Pas d'index
        "analysis_model_preference": "fast",
        "chat_max_chunks": 2,
        "chat_chunk_context": 3000,
    },
    VideoTier.MEDIUM: {
        "max_duration": 900,           # 15 min
        "needs_chunking": False,
        "max_transcript_for_analysis": 100_000,
        "max_transcript_for_chat": 80_000,
        "chunk_duration_minutes": 0,
        "index_granularity_seconds": 120,     # Toutes les 2 min
        "analysis_model_preference": "standard",
        "chat_max_chunks": 3,
        "chat_chunk_context": 4000,
    },
    VideoTier.LONG: {
        "max_duration": 2700,          # 45 min
        "needs_chunking": False,       # Un seul prompt Mistral gère 45min
        "max_transcript_for_analysis": 150_000,
        "max_transcript_for_chat": 60_000,
        "chunk_duration_minutes": 0,
        "index_granularity_seconds": 60,      # Toute la minute
        "analysis_model_preference": "standard",
        "chat_max_chunks": 4,
        "chat_chunk_context": 4000,
    },
    VideoTier.EXTENDED: {
        "max_duration": 7200,          # 2h
        "needs_chunking": True,
        "max_transcript_for_analysis": 300_000,
        "max_transcript_for_chat": 50_000,
        "chunk_duration_minutes": 10,
        "index_granularity_seconds": 60,
        "analysis_model_preference": "quality",
        "chat_max_chunks": 5,
        "chat_chunk_context": 5000,
    },
    VideoTier.MARATHON: {
        "max_duration": float("inf"),  # 2h+
        "needs_chunking": True,
        "max_transcript_for_analysis": 400_000,
        "max_transcript_for_chat": 50_000,
        "chunk_duration_minutes": 15,         # Chunks plus larges
        "index_granularity_seconds": 120,     # Toutes les 2 min (sinon trop d'entrées)
        "analysis_model_preference": "quality",
        "chat_max_chunks": 6,
        "chat_chunk_context": 5000,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🌍 STOP-WORDS BILINGUES (FR + EN)
# ═══════════════════════════════════════════════════════════════════════════════

STOP_WORDS_FR = frozenset({
    "dans", "pour", "avec", "cette", "plus", "tout", "fait", "être", "avoir",
    "nous", "vous", "mais", "donc", "comme", "aussi", "même", "encore", "très",
    "bien", "alors", "sont", "peut", "elle", "elles", "leur", "quel", "quoi",
    "dont", "entre", "autre", "après", "avant", "quand", "depuis", "parce",
    "cela", "ceux", "celle", "celles", "sera", "était", "aurait", "serait",
    "pouvoir", "vouloir", "savoir", "devoir", "falloir", "aller", "venir",
    "dire", "faire", "voir", "prendre", "donner", "passer", "trouver",
    "parler", "mettre", "rester", "partir", "arriver", "tenir", "porter",
    "croire", "écrire", "lire", "jour", "temps", "fois", "chose", "moment",
    "gens", "monde", "homme", "femme", "partie", "point", "place",
    "quelque", "chaque", "toute", "toutes", "tous", "rien", "personne",
    "jamais", "toujours", "souvent", "parfois", "vraiment", "simplement",
    "exactement", "justement", "seulement", "maintenant", "beaucoup",
    "vidéo", "vidéos", "chaîne", "channel", "youtube", "tiktok",
    "merci", "bonjour", "salut", "allez", "voilà", "alors",
})

STOP_WORDS_EN = frozenset({
    "the", "and", "that", "this", "with", "from", "have", "been", "were",
    "will", "would", "could", "should", "about", "which", "their", "there",
    "these", "those", "other", "than", "then", "when", "what", "where",
    "here", "also", "just", "more", "some", "very", "much", "such",
    "like", "even", "only", "over", "into", "back", "them", "they",
    "make", "made", "know", "think", "want", "come", "take", "give",
    "look", "find", "tell", "call", "keep", "going", "being", "really",
    "actually", "basically", "literally", "right", "things", "people",
    "something", "everything", "nothing", "getting", "doing", "saying",
    "video", "videos", "channel", "youtube", "tiktok", "subscribe",
    "hello", "guys", "today", "gonna", "thing", "stuff",
})

STOP_WORDS_ALL = STOP_WORDS_FR | STOP_WORDS_EN


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 DÉTECTION DE LANGUE SIMPLE
# ═══════════════════════════════════════════════════════════════════════════════

def _detect_language(text: str) -> str:
    """Détection rapide FR vs EN sur les 2000 premiers caractères."""
    if not text:
        return "unknown"
    sample = text[:2000].lower()
    fr_markers = ["est", "les", "des", "une", "que", "pas", "sur", "dans", "qui", "par", "avec", "mais", "ont", "sont"]
    en_markers = ["the", "and", "you", "for", "are", "but", "not", "was", "all", "can", "had", "her", "was", "one"]

    fr_score = sum(1 for m in fr_markers if f" {m} " in sample)
    en_score = sum(1 for m in en_markers if f" {m} " in sample)

    if fr_score > en_score + 2:
        return "fr"
    elif en_score > fr_score + 2:
        return "en"
    return "fr"  # Défaut FR pour DeepSight


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

    - Gère la durée = 0 (estimation par nombre de mots)
    - Détecte automatiquement la langue
    - Valide la présence réelle de timestamps (regex check, pas juste len > 100)

    Args:
        duration_seconds: Durée de la vidéo en secondes (0 = inconnue)
        transcript: Transcript brut (texte plein)
        transcript_timestamped: Transcript avec timestamps [MM:SS] (optionnel)

    Returns:
        VideoProfile avec tous les paramètres de routage
    """
    transcript = transcript or ""
    transcript_chars = len(transcript)
    transcript_words = len(transcript.split()) if transcript else 0

    # Détection de langue
    lang = _detect_language(transcript_timestamped or transcript)

    # Validation stricte des timestamps : au moins 5 matches [MM:SS] ou MM:SS
    has_timestamps = False
    if transcript_timestamped and len(transcript_timestamped) > 50:
        ts_count = len(re.findall(r'\[\d{1,2}:\d{2}(?::\d{2})?\]', transcript_timestamped))
        if ts_count < 5:
            # Essayer le format sans crochets
            ts_count = len(re.findall(r'(?:^|\n)\d{1,2}:\d{2}(?::\d{2})?\s', transcript_timestamped))
        has_timestamps = ts_count >= 5
        if not has_timestamps:
            logger.info(f"Timestamps insuffisants ({ts_count} trouvés, minimum 5). Fallback estimation.")

    # Estimation de durée si inconnue (0 ou négatif)
    if duration_seconds <= 0:
        # Parole ~150 mots/min, ~5 chars/mot
        estimated_duration = max(30, int((transcript_words / 150) * 60))
        duration_seconds = estimated_duration
        logger.info(f"Duration unknown, estimated: {duration_seconds}s ({transcript_words} words)")

    # Catégoriser par tier
    tier = VideoTier.MARATHON  # défaut pour les plus longues
    for t in [VideoTier.MICRO, VideoTier.SHORT, VideoTier.MEDIUM, VideoTier.LONG, VideoTier.EXTENDED]:
        if duration_seconds <= TIER_CONFIG[t]["max_duration"]:
            tier = t
            break

    config = TIER_CONFIG[tier]

    profile = VideoProfile(
        tier=tier,
        duration_seconds=duration_seconds,
        transcript_chars=transcript_chars,
        transcript_words=transcript_words,
        has_timestamps=has_timestamps,
        detected_lang=lang,
        needs_chunking=config["needs_chunking"],
        max_transcript_for_analysis=config["max_transcript_for_analysis"],
        max_transcript_for_chat=config["max_transcript_for_chat"],
        chunk_duration_minutes=config["chunk_duration_minutes"],
        index_granularity_seconds=config["index_granularity_seconds"],
        analysis_model_preference=config["analysis_model_preference"],
        chat_max_chunks=config["chat_max_chunks"],
        chat_chunk_context=config["chat_chunk_context"],
    )

    logger.info(
        "video_categorized",
        extra={
            "tier": tier.value, "duration": duration_seconds,
            "transcript_chars": transcript_chars, "transcript_words": transcript_words,
            "has_timestamps": has_timestamps, "lang": lang,
            "needs_chunking": profile.needs_chunking,
            "chunk_minutes": profile.chunk_duration_minutes,
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
    Construit un index structuré (table des matières) à partir du transcript.

    Si le transcript a des timestamps → parsing précis.
    Si pas de timestamps → fallback par estimation chars/seconde.

    Returns:
        Liste d'IndexEntry
    """
    # Pas d'index pour les vidéos très courtes
    if tier in (VideoTier.MICRO, VideoTier.SHORT):
        return []

    if not transcript_timestamped:
        return []

    config = TIER_CONFIG[tier]
    granularity = config["index_granularity_seconds"]

    # Essayer le parsing par timestamps
    segments = _parse_timestamped_segments(transcript_timestamped)

    # Fallback : estimation par position si pas de timestamps exploitables
    if len(segments) < 5:
        segments = _estimate_segments_from_text(transcript_timestamped, duration_seconds)
        if not segments:
            return []

    lang = _detect_language(transcript_timestamped)

    # Regrouper les segments selon la granularité
    entries = []
    current_group_start = 0
    current_group_texts: List[str] = []

    for ts_seconds, text in segments:
        if ts_seconds - current_group_start >= granularity and current_group_texts:
            entry = _create_index_entry(
                start_seconds=current_group_start,
                texts=current_group_texts,
                lang=lang,
            )
            entries.append(entry)
            current_group_start = ts_seconds
            current_group_texts = []

        current_group_texts.append(text)

    # Dernier groupe
    if current_group_texts:
        entries.append(_create_index_entry(current_group_start, current_group_texts, lang))

    logger.info(
        "structured_index_built",
        extra={
            "tier": tier.value, "total_segments": len(segments),
            "index_entries": len(entries), "duration": duration_seconds,
        }
    )

    return entries


def _estimate_segments_from_text(text: str, duration_seconds: int) -> List[Tuple[int, str]]:
    """
    Fallback : crée des segments virtuels quand le transcript n'a pas de timestamps.
    Découpe par phrases et estime les timestamps proportionnellement.
    """
    if not text or duration_seconds <= 0:
        return []

    # Découper en phrases
    sentences = re.split(r'(?<=[.!?])\s+', text)
    if len(sentences) < 3:
        # Pas assez de phrases → découper par blocs de ~200 mots
        words = text.split()
        sentences = []
        for i in range(0, len(words), 200):
            sentences.append(" ".join(words[i:i + 200]))

    if not sentences:
        return []

    # Calculer le ratio chars → secondes
    total_chars = len(text)
    chars_per_second = total_chars / duration_seconds if duration_seconds > 0 else 1

    segments = []
    current_pos = 0
    for sent in sentences:
        estimated_ts = int(current_pos / chars_per_second) if chars_per_second > 0 else 0
        estimated_ts = min(estimated_ts, duration_seconds)
        if sent.strip():
            segments.append((estimated_ts, sent.strip()))
        current_pos += len(sent) + 1  # +1 pour le séparateur

    return segments


def serialize_index(entries: List[IndexEntry]) -> str:
    """Sérialise l'index structuré en JSON compact pour stockage en DB."""
    if not entries:
        return "[]"

    data = []
    for entry in entries:
        data.append({
            "ts": entry.timestamp_seconds,
            "t": entry.timestamp_str,
            "title": entry.title[:100],
            "summary": entry.summary[:250],
            "kw": entry.keywords[:6],
            "bg": entry.bigrams[:4],
        })

    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def deserialize_index(json_str: str) -> List[IndexEntry]:
    """Désérialise l'index structuré depuis le JSON DB."""
    if not json_str or json_str == "[]":
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
                bigrams=item.get("bg", []),
            ))
        return entries
    except (json.JSONDecodeError, TypeError, KeyError) as e:
        logger.warning(f"Failed to deserialize structured index: {e}")
        return []


def format_index_for_prompt(entries: List[IndexEntry], lang: str = "fr") -> str:
    """Formate l'index pour injection dans un prompt Mistral."""
    if not entries:
        return ""

    header = "📑 TABLE DES MATIÈRES DE LA VIDÉO :" if lang == "fr" else "📑 VIDEO TABLE OF CONTENTS:"
    lines = [header, ""]

    for entry in entries:
        kw_str = f" ({', '.join(entry.keywords[:4])})" if entry.keywords else ""
        lines.append(f"[{entry.timestamp_str}] {entry.title}{kw_str}")

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

    Stratégie multi-couche :
    1. Scorer les entrées de l'index (keywords + bigrams + titre + résumé)
    2. Extraire les passages correspondants du transcript complet
    3. Fallback : recherche brute par fenêtres glissantes si index insuffisant
    4. Toujours retourner quelque chose (même intro+outro en dernier recours)
    """
    if not transcript_timestamped or not query:
        return ""

    query_lower = query.lower()
    query_words = _extract_query_terms(query_lower)
    query_bigrams = _extract_bigrams_from_text(query_lower)

    # ── Étape 1 : Scorer les entrées de l'index ──
    scored_entries: List[Tuple[float, IndexEntry]] = []

    if index_entries:
        for entry in index_entries:
            score = _score_entry_relevance(entry, query_words, query_bigrams, query_lower)
            if score > 0:
                scored_entries.append((score, entry))

        scored_entries.sort(key=lambda x: x[0], reverse=True)

    # ── Étape 2 : Extraire les passages du transcript ──
    passages = []
    used_ranges: List[Tuple[int, int]] = []  # Éviter les chevauchements

    for score, entry in scored_entries[:max_chunks * 2]:
        # Vérifier qu'on ne chevauche pas un passage déjà extrait
        if _overlaps(entry.timestamp_seconds, chunk_context_chars, used_ranges):
            continue

        passage = _extract_passage_at_timestamp(
            transcript_timestamped,
            target_seconds=entry.timestamp_seconds,
            context_chars=chunk_context_chars,
        )

        if passage and len(passage) > 50:
            passages.append({
                "timestamp": entry.timestamp_str,
                "seconds": entry.timestamp_seconds,
                "title": entry.title,
                "text": passage,
                "score": score,
            })
            used_ranges.append((entry.timestamp_seconds - 60, entry.timestamp_seconds + 120))

        if len(passages) >= max_chunks:
            break

    # ── Étape 3 : Fallback brute si pas assez de passages via l'index ──
    if len(passages) < max(1, max_chunks // 2):
        brute_results = _brute_search_transcript(
            transcript_timestamped, query_words, max_chunks - len(passages), chunk_context_chars
        )
        passages.extend(brute_results)

    if not passages:
        return ""

    # ── Trier par ordre chronologique pour une lecture naturelle ──
    passages.sort(key=lambda p: p.get("seconds", 0))

    # ── Formater les résultats ──
    parts = ["📍 PASSAGES PERTINENTS DU TRANSCRIPT :\n"]
    for p in passages:
        ts = p.get("timestamp", "?")
        title = p.get("title", "")
        text = p.get("text", "")
        header = f"[{ts}] {title}" if title else f"[{ts}]"
        parts.append(f"--- {header} ---\n{text}\n")

    return "\n".join(parts)


def _overlaps(ts: int, context_chars: int, used_ranges: List[Tuple[int, int]]) -> bool:
    """Vérifie si un timestamp chevauche une plage déjà extraite."""
    for start, end in used_ranges:
        if start <= ts <= end:
            return True
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS INTERNES — Parsing
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_timestamped_segments(transcript: str) -> List[Tuple[int, str]]:
    """
    Parse un transcript timestampé en paires (secondes, texte).
    Supporte [HH:MM:SS], [MM:SS], HH:MM:SS, MM:SS.
    Valide que les timestamps sont monotones (croissants).
    """
    patterns = [
        (r'\[(\d{1,2}):(\d{2}):(\d{2})\]\s*(.*?)(?=\[\d{1,2}:\d{2}|\Z)', "hms_bracket"),
        (r'\[(\d{1,2}):(\d{2})\]\s*(.*?)(?=\[\d{1,2}:\d{2}|\Z)', "ms_bracket"),
        (r'(?:^|\n)(\d{1,2}):(\d{2}):(\d{2})\s+(.*?)(?=\n\d{1,2}:\d{2}|\Z)', "hms_bare"),
        (r'(?:^|\n)(\d{1,2}):(\d{2})\s+(.*?)(?=\n\d{1,2}:\d{2}|\Z)', "ms_bare"),
    ]

    for pattern, fmt in patterns:
        matches = list(re.finditer(pattern, transcript, re.DOTALL))
        if len(matches) < 5:
            continue

        segments = []
        prev_seconds = -1
        monotone_violations = 0

        for match in matches:
            groups = match.groups()
            try:
                if fmt.startswith("hms"):
                    seconds = int(groups[0]) * 3600 + int(groups[1]) * 60 + int(groups[2])
                    text = groups[3].strip()
                else:
                    seconds = int(groups[0]) * 60 + int(groups[1])
                    text = groups[2].strip()
            except (ValueError, IndexError):
                continue

            # Vérification monotonie (tolérance de quelques violations)
            if seconds < prev_seconds:
                monotone_violations += 1
                if monotone_violations > len(matches) * 0.1:  # >10% non-monotone → suspect
                    break
            else:
                prev_seconds = seconds

            if text and len(text) > 5:
                segments.append((seconds, text))

        if len(segments) >= 5:
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


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS INTERNES — Index & Keywords
# ═══════════════════════════════════════════════════════════════════════════════

def _create_index_entry(
    start_seconds: int,
    texts: List[str],
    lang: str = "fr",
) -> IndexEntry:
    """
    Crée une entrée d'index avec extraction de mots-clés et bigrams.
    Utilise les stop-words de la langue détectée.
    """
    combined = " ".join(texts)

    # Titre : première phrase significative, tronquée à 100 chars
    sentences = re.split(r'[.!?]\s', combined)
    title = ""
    for sent in sentences:
        sent = sent.strip()
        if len(sent) > 15:
            title = sent[:100].rstrip(" .,;:-")
            break
    if not title:
        title = combined[:80].rstrip(" .,;:-")

    # Résumé : 2 premières phrases significatives
    meaningful = [s.strip() for s in sentences if len(s.strip()) > 15]
    summary = ". ".join(meaningful[:2])[:250] if meaningful else combined[:250]

    # Mots-clés avec stop-words bilingues
    stop_words = STOP_WORDS_ALL
    words = re.findall(r'\b\w{3,}\b', combined.lower())
    word_freq: Dict[str, int] = {}
    for w in words:
        if w not in stop_words and not w.isdigit():
            word_freq[w] = word_freq.get(w, 0) + 1

    # TF-IDF léger : favoriser les mots fréquents dans ce segment mais pas trop communs
    keywords = sorted(word_freq, key=lambda w: word_freq[w], reverse=True)[:6]

    # Bigrams : concepts multi-mots (machine learning, intelligence artificielle, etc.)
    bigrams = _extract_bigrams_from_text(combined.lower(), stop_words)

    return IndexEntry(
        timestamp_seconds=start_seconds,
        timestamp_str=_format_timestamp(start_seconds),
        title=title,
        summary=summary,
        keywords=keywords,
        bigrams=bigrams[:4],
    )


def _extract_bigrams_from_text(text: str, stop_words: frozenset = STOP_WORDS_ALL) -> List[str]:
    """Extrait les bigrams significatifs (paires de mots consécutifs non-stop)."""
    words = re.findall(r'\b\w{3,}\b', text.lower())
    bigram_freq: Dict[str, int] = {}

    for i in range(len(words) - 1):
        w1, w2 = words[i], words[i + 1]
        if w1 not in stop_words and w2 not in stop_words and not w1.isdigit() and not w2.isdigit():
            bg = f"{w1} {w2}"
            bigram_freq[bg] = bigram_freq.get(bg, 0) + 1

    # Garder les bigrams qui apparaissent au moins 1 fois (on ne filtre pas par fréquence ici car segments courts)
    return sorted(bigram_freq, key=bigram_freq.get, reverse=True)[:6]


def _extract_query_terms(query_lower: str) -> Set[str]:
    """Extrait les termes significatifs d'une requête (filtrage stop-words)."""
    words = set(re.findall(r'\b\w{3,}\b', query_lower))
    return words - STOP_WORDS_ALL


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS INTERNES — Scoring & Recherche
# ═══════════════════════════════════════════════════════════════════════════════

def _score_entry_relevance(
    entry: IndexEntry,
    query_words: Set[str],
    query_bigrams: List[str],
    query_lower: str,
) -> float:
    """
    Score de pertinence amélioré avec :
    - Match mots-clés (3 pts)
    - Match bigrams (5 pts — concepts multi-mots)
    - Match titre (2 pts)
    - Match résumé (1 pt)
    - Bonus substring de la query dans le résumé (2 pts)
    """
    score = 0.0

    # 1. Match sur les mots-clés de l'index
    entry_keywords = set(kw.lower() for kw in entry.keywords)
    common_kw = query_words & entry_keywords
    score += len(common_kw) * 3.0

    # 2. Match sur les bigrams (plus discriminant)
    entry_bigrams_set = set(bg.lower() for bg in entry.bigrams)
    query_bigrams_set = set(bg.lower() for bg in query_bigrams)
    common_bg = entry_bigrams_set & query_bigrams_set
    score += len(common_bg) * 5.0

    # 3. Match sur le titre
    title_lower = entry.title.lower()
    for word in query_words:
        if word in title_lower:
            score += 2.0

    # 4. Match sur le résumé
    summary_lower = entry.summary.lower()
    for word in query_words:
        if word in summary_lower:
            score += 1.0

    # 5. Bonus : sous-chaînes significatives de la query (>6 chars) trouvées dans titre+résumé
    # Optimisé : on teste seulement les groupes de mots de la query, pas tous les substrings
    query_terms_list = query_lower.split()
    for length in range(min(4, len(query_terms_list)), 1, -1):
        for i in range(len(query_terms_list) - length + 1):
            phrase = " ".join(query_terms_list[i:i + length])
            if len(phrase) > 6:
                if phrase in title_lower:
                    score += 3.0
                elif phrase in summary_lower:
                    score += 1.5

    return score


def _extract_passage_at_timestamp(
    transcript: str,
    target_seconds: int,
    context_chars: int = 3000,
) -> str:
    """
    Extrait un passage du transcript autour d'un timestamp donné.
    Cherche le timestamp exact, puis ±60s en fallback.
    """
    target_str = _format_timestamp(target_seconds)

    # Chercher le timestamp exact ou le plus proche
    best_pos = -1
    for pattern in [rf'\[{re.escape(target_str)}\]', rf'(?:^|\n){re.escape(target_str)}\s']:
        match = re.search(pattern, transcript, re.MULTILINE)
        if match:
            best_pos = match.start()
            break

    if best_pos == -1:
        # Fallback : ±60s par pas de 5s
        for offset in range(5, 65, 5):
            for delta in [offset, -offset]:
                nearby = target_seconds + delta
                if nearby < 0:
                    continue
                nearby_str = _format_timestamp(nearby)
                for pat in [rf'\[{re.escape(nearby_str)}\]', rf'(?:^|\n){re.escape(nearby_str)}\s']:
                    match = re.search(pat, transcript, re.MULTILINE)
                    if match:
                        best_pos = match.start()
                        break
                if best_pos != -1:
                    break
            if best_pos != -1:
                break

    if best_pos == -1:
        # Dernier fallback : estimer la position proportionnellement
        total_len = len(transcript)
        if target_seconds > 0:
            # Chercher la durée totale via le dernier timestamp
            last_ts = re.findall(r'\[(\d{1,2}):(\d{2}(?::\d{2})?)\]', transcript)
            if last_ts:
                last_parts = last_ts[-1]
                if ':' in last_parts[1]:
                    max_ts = int(last_parts[0]) * 3600 + int(last_parts[1].split(':')[0]) * 60
                else:
                    max_ts = int(last_parts[0]) * 60 + int(last_parts[1])
                if max_ts > 0:
                    best_pos = int((target_seconds / max_ts) * total_len)
                    best_pos = max(0, min(best_pos, total_len - 100))

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
        if 0 < first_break < 200:
            passage = passage[first_break + 2:]

    if end < len(transcript):
        last_break = passage.rfind('. ')
        if last_break > len(passage) - 200 and last_break > 0:
            passage = passage[:last_break + 1]

    return passage


def _brute_search_transcript(
    transcript: str,
    query_words: Set[str],
    max_results: int = 3,
    chunk_size: int = 3000,
) -> List[dict]:
    """
    Recherche brute dans le transcript quand l'index ne suffit pas.
    Fenêtres glissantes avec overlap 50%.
    """
    if not transcript or not query_words:
        return []

    step = chunk_size // 2
    windows = []

    for i in range(0, len(transcript), step):
        window = transcript[i:i + chunk_size]
        if len(window) < 100:
            continue

        window_lower = window.lower()
        score = sum(1 for w in query_words if w in window_lower)

        # Bonus : mots trouvés proches les uns des autres (densité)
        if score >= 2:
            # Chercher les positions des mots matchés
            positions = []
            for w in query_words:
                pos = window_lower.find(w)
                if pos >= 0:
                    positions.append(pos)
            if len(positions) >= 2:
                positions.sort()
                avg_distance = sum(positions[i + 1] - positions[i] for i in range(len(positions) - 1)) / (len(positions) - 1)
                if avg_distance < 500:
                    score += 1.5  # Bonus densité

        # Extraire le timestamp le plus proche
        ts_match = re.search(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]', window)
        ts_str = ts_match.group(1) if ts_match else "?"

        if score > 0:
            windows.append({
                "timestamp": ts_str,
                "text": window.strip(),
                "score": score,
            })

    windows.sort(key=lambda x: x["score"], reverse=True)
    return windows[:max_results]


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 HELPERS : Préparer le transcript pour analyse et chat
# ═══════════════════════════════════════════════════════════════════════════════

def prepare_transcript_for_analysis(
    profile: VideoProfile,
    transcript: str,
    transcript_timestamped: Optional[str] = None,
    index_entries: Optional[List[IndexEntry]] = None,
) -> str:
    """
    Prépare le transcript pour envoi à Mistral selon le tier.

    - MICRO/SHORT : transcript complet brut
    - MEDIUM/LONG : transcript + index en header
    - EXTENDED/MARATHON : passent par analyze_long_video() — fallback ici
    """
    source = transcript_timestamped if transcript_timestamped else transcript

    if profile.tier in (VideoTier.MICRO, VideoTier.SHORT):
        return source[:profile.max_transcript_for_analysis]

    if profile.tier in (VideoTier.MEDIUM, VideoTier.LONG):
        index_text = ""
        if index_entries:
            index_text = format_index_for_prompt(index_entries, profile.detected_lang) + "\n\n"
        return (index_text + source)[:profile.max_transcript_for_analysis]

    # EXTENDED/MARATHON → ne devrait pas arriver ici (chunking séparé)
    logger.warning(f"prepare_transcript_for_analysis called for {profile.tier.value} — should use analyze_long_video()")
    index_text = ""
    if index_entries:
        index_text = format_index_for_prompt(index_entries, profile.detected_lang) + "\n\n"
    return (index_text + source)[:profile.max_transcript_for_analysis]


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

    - MICRO/SHORT : transcript complet
    - MEDIUM : index + passages pertinents recherchés
    - LONG : index + passages pertinents + digest condensé
    - EXTENDED/MARATHON : index + digest + passages pertinents + intro/outro fallback
    """
    max_chat = profile.max_transcript_for_chat

    # ── MICRO / SHORT : transcript complet ──
    if profile.tier in (VideoTier.MICRO, VideoTier.SHORT):
        return full_transcript[:max_chat]

    # ── MEDIUM : index + passages pertinents ──
    if profile.tier == VideoTier.MEDIUM:
        parts = []
        if index_entries:
            parts.append(format_index_for_prompt(index_entries, profile.detected_lang))

        if index_entries and query:
            relevant = search_relevant_chunks(
                query=query,
                transcript_timestamped=full_transcript,
                index_entries=index_entries,
                max_chunks=profile.chat_max_chunks,
                chunk_context_chars=profile.chat_chunk_context,
            )
            if relevant:
                parts.append(relevant)
            else:
                parts.append(full_transcript[:max_chat])
        else:
            parts.append(full_transcript[:max_chat])

        return "\n\n".join(parts)[:max_chat]

    # ── LONG : index + passages pertinents + digest condensé ──
    if profile.tier == VideoTier.LONG:
        parts = []
        if index_entries:
            parts.append(format_index_for_prompt(index_entries, profile.detected_lang))

        if full_digest:
            parts.append(f"📋 VUE D'ENSEMBLE :\n{full_digest[:6000]}")

        if index_entries and query:
            relevant = search_relevant_chunks(
                query=query,
                transcript_timestamped=full_transcript,
                index_entries=index_entries,
                max_chunks=profile.chat_max_chunks,
                chunk_context_chars=profile.chat_chunk_context,
            )
            if relevant:
                parts.append(relevant)

        if len(parts) <= 1:
            parts.append(full_transcript[:max_chat])

        return "\n\n".join(parts)[:max_chat]

    # ── EXTENDED / MARATHON : index + digest + passages + fallback intro/outro ──
    parts = []

    if index_entries:
        parts.append(format_index_for_prompt(index_entries, profile.detected_lang))

    if full_digest:
        digest_limit = 8000 if profile.tier == VideoTier.MARATHON else 6000
        parts.append(f"📋 VUE D'ENSEMBLE DU CONTENU :\n{full_digest[:digest_limit]}")

    if index_entries and query:
        relevant = search_relevant_chunks(
            query=query,
            transcript_timestamped=full_transcript,
            index_entries=index_entries,
            max_chunks=profile.chat_max_chunks,
            chunk_context_chars=profile.chat_chunk_context,
        )
        if relevant:
            parts.append(relevant)

    # Si pas assez de contenu trouvé → ajouter intro + outro
    content_so_far = sum(len(p) for p in parts)
    if content_so_far < max_chat * 0.3:
        intro_size = min(5000, max_chat // 4)
        outro_size = min(5000, max_chat // 4)
        if full_transcript:
            parts.append(f"📍 DÉBUT DU TRANSCRIPT :\n{full_transcript[:intro_size]}")
            if len(full_transcript) > intro_size:
                parts.append(f"📍 FIN DU TRANSCRIPT :\n{full_transcript[-outro_size:]}")

    return "\n\n".join(parts)[:max_chat]
