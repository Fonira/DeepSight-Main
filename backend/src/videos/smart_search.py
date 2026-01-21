"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 SMART TRANSCRIPT SEARCH v1.0                                                   ║
║  Recherche intelligente dans les transcripts longs pour le Chat IA                 ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  PROBLÈME: Les vidéos de 2h+ ont des transcripts trop longs pour le contexte LLM   ║
║  SOLUTION: Rechercher les passages pertinents AVANT d'envoyer au LLM               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import math
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from collections import Counter

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Seuil pour activer la recherche intelligente (au lieu de tronquer)
SMART_SEARCH_THRESHOLD_WORDS = 10000

# Nombre de passages à retourner
MAX_RELEVANT_PASSAGES = 8

# Taille d'un passage (en mots)
PASSAGE_SIZE_WORDS = 500
PASSAGE_OVERLAP_WORDS = 100

# Mots vides à ignorer (stopwords FR + EN)
STOPWORDS_FR = {
    "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux",
    "et", "ou", "mais", "donc", "car", "ni", "que", "qui", "quoi",
    "ce", "cette", "ces", "mon", "ton", "son", "notre", "votre", "leur",
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "on",
    "être", "avoir", "faire", "dire", "aller", "voir", "savoir", "pouvoir",
    "est", "sont", "a", "ont", "fait", "dit", "va", "vont",
    "dans", "sur", "sous", "avec", "sans", "pour", "par", "en", "à",
    "plus", "moins", "très", "bien", "mal", "peu", "beaucoup", "trop",
    "ne", "pas", "jamais", "rien", "tout", "tous", "toute", "toutes",
    "si", "quand", "comme", "comment", "pourquoi", "où", "dont",
    "cela", "ça", "celui", "celle", "ceux", "celles",
    "aussi", "encore", "déjà", "toujours", "souvent", "parfois",
    "alors", "ensuite", "puis", "enfin", "maintenant", "après", "avant"
}

STOPWORDS_EN = {
    "the", "a", "an", "and", "or", "but", "if", "then", "else",
    "when", "where", "why", "how", "what", "which", "who", "whom",
    "this", "that", "these", "those", "am", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "must", "shall",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
    "my", "your", "his", "its", "our", "their", "mine", "yours",
    "in", "on", "at", "by", "for", "with", "about", "against", "between",
    "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "out", "off", "over", "under",
    "again", "further", "once", "here", "there", "all", "each", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "just", "can"
}

STOPWORDS = STOPWORDS_FR | STOPWORDS_EN


@dataclass
class TranscriptPassage:
    """Un passage du transcript avec ses métadonnées"""
    text: str
    start_word_index: int
    end_word_index: int
    estimated_timecode: str
    relevance_score: float = 0.0
    matched_terms: List[str] = None
    
    def __post_init__(self):
        if self.matched_terms is None:
            self.matched_terms = []


# ═══════════════════════════════════════════════════════════════════════════════
# 🔤 TOKENISATION ET NORMALISATION
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_text(text: str) -> str:
    """Normalise le texte pour la recherche"""
    # Minuscules
    text = text.lower()
    # Supprimer les accents (simplifié)
    replacements = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'à': 'a', 'â': 'a', 'ä': 'a',
        'î': 'i', 'ï': 'i',
        'ô': 'o', 'ö': 'o',
        'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c', 'ñ': 'n'
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def extract_keywords(text: str, max_keywords: int = 20) -> List[str]:
    """
    Extrait les mots-clés pertinents d'un texte.
    Filtre les stopwords et garde les termes significatifs.
    """
    # Normaliser
    text = normalize_text(text)
    
    # Extraire les mots (alphanum uniquement)
    words = re.findall(r'\b[a-z0-9]{3,}\b', text)
    
    # Filtrer les stopwords
    keywords = [w for w in words if w not in STOPWORDS]
    
    # Compter les occurrences
    word_counts = Counter(keywords)
    
    # Retourner les plus fréquents (sans doublons)
    return [word for word, _ in word_counts.most_common(max_keywords)]


def extract_question_keywords(question: str) -> List[str]:
    """
    Extrait les mots-clés d'une question utilisateur.
    Priorise les noms, verbes d'action, et termes techniques.
    """
    # Mots interrogatifs à ignorer
    question_words = {
        "est-ce", "qu'est", "comment", "pourquoi", "quand", "combien",
        "what", "how", "why", "when", "where", "which", "does", "can"
    }
    
    keywords = extract_keywords(question, max_keywords=10)
    
    # Filtrer les mots interrogatifs
    keywords = [k for k in keywords if k not in question_words]
    
    return keywords


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 INDEXATION DU TRANSCRIPT
# ═══════════════════════════════════════════════════════════════════════════════

def split_into_passages(
    transcript: str,
    video_duration: int = 0,
    passage_size: int = PASSAGE_SIZE_WORDS,
    overlap: int = PASSAGE_OVERLAP_WORDS
) -> List[TranscriptPassage]:
    """
    Divise le transcript en passages indexables.
    """
    words = transcript.split()
    total_words = len(words)
    
    if total_words <= passage_size:
        return [TranscriptPassage(
            text=transcript,
            start_word_index=0,
            end_word_index=total_words,
            estimated_timecode="00:00"
        )]
    
    passages = []
    current_pos = 0
    
    while current_pos < total_words:
        end_pos = min(current_pos + passage_size, total_words)
        
        # Essayer de couper à une phrase
        if end_pos < total_words:
            search_text = " ".join(words[max(0, end_pos - 50):end_pos])
            for punct in ['. ', '! ', '? ', '.\n']:
                last_punct = search_text.rfind(punct)
                if last_punct > 0:
                    adjust = len(search_text) - last_punct - len(punct)
                    end_pos = max(current_pos + 100, end_pos - adjust)
                    break
        
        passage_text = " ".join(words[current_pos:end_pos])
        
        # Estimer le timecode
        if video_duration > 0 and total_words > 0:
            seconds = int((current_pos / total_words) * video_duration)
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            if hours > 0:
                timecode = f"{hours:02d}:{minutes:02d}:{secs:02d}"
            else:
                timecode = f"{minutes:02d}:{secs:02d}"
        else:
            timecode = "??:??"
        
        passages.append(TranscriptPassage(
            text=passage_text,
            start_word_index=current_pos,
            end_word_index=end_pos,
            estimated_timecode=timecode
        ))
        
        # Avancer avec chevauchement
        current_pos = end_pos - overlap if end_pos < total_words else total_words
    
    return passages


def build_passage_index(passages: List[TranscriptPassage]) -> Dict[str, List[int]]:
    """
    Construit un index inversé: mot -> [indices des passages]
    """
    index = {}
    
    for i, passage in enumerate(passages):
        keywords = extract_keywords(passage.text, max_keywords=50)
        for keyword in keywords:
            if keyword not in index:
                index[keyword] = []
            if i not in index[keyword]:
                index[keyword].append(i)
    
    return index


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 RECHERCHE DE PASSAGES PERTINENTS
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_bm25_score(
    query_terms: List[str],
    passage: TranscriptPassage,
    all_passages: List[TranscriptPassage],
    k1: float = 1.5,
    b: float = 0.75
) -> Tuple[float, List[str]]:
    """
    Calcule le score BM25 d'un passage pour une requête.
    BM25 est un algorithme de ranking standard en recherche d'information.
    
    Returns:
        (score, matched_terms)
    """
    passage_text = normalize_text(passage.text)
    passage_words = passage_text.split()
    passage_len = len(passage_words)
    
    # Longueur moyenne des passages
    avg_len = sum(len(p.text.split()) for p in all_passages) / len(all_passages)
    
    score = 0.0
    matched_terms = []
    
    for term in query_terms:
        # Fréquence du terme dans le passage
        tf = passage_text.count(term)
        if tf == 0:
            continue
        
        matched_terms.append(term)
        
        # Nombre de passages contenant le terme (pour IDF)
        df = sum(1 for p in all_passages if term in normalize_text(p.text))
        
        # IDF (Inverse Document Frequency)
        n = len(all_passages)
        idf = math.log((n - df + 0.5) / (df + 0.5) + 1)
        
        # Score BM25 pour ce terme
        numerator = tf * (k1 + 1)
        denominator = tf + k1 * (1 - b + b * (passage_len / avg_len))
        
        score += idf * (numerator / denominator)
    
    return score, matched_terms


def search_relevant_passages(
    question: str,
    transcript: str,
    video_duration: int = 0,
    max_passages: int = MAX_RELEVANT_PASSAGES,
    min_score: float = 0.5
) -> List[TranscriptPassage]:
    """
    🔍 Recherche les passages les plus pertinents pour une question.
    
    Args:
        question: Question de l'utilisateur
        transcript: Transcript complet
        video_duration: Durée de la vidéo (pour les timecodes)
        max_passages: Nombre max de passages à retourner
        min_score: Score minimum pour inclure un passage
    
    Returns:
        Liste des passages pertinents, triés par relevance
    """
    # Vérifier si la recherche intelligente est nécessaire
    word_count = len(transcript.split())
    if word_count <= SMART_SEARCH_THRESHOLD_WORDS:
        # Transcript assez court, retourner tout
        return [TranscriptPassage(
            text=transcript,
            start_word_index=0,
            end_word_index=word_count,
            estimated_timecode="00:00",
            relevance_score=1.0
        )]
    
    # Extraire les mots-clés de la question
    query_terms = extract_question_keywords(question)
    
    if not query_terms:
        # Pas de mots-clés, retourner le début et la fin
        words = transcript.split()
        return [
            TranscriptPassage(
                text=" ".join(words[:PASSAGE_SIZE_WORDS]),
                start_word_index=0,
                end_word_index=PASSAGE_SIZE_WORDS,
                estimated_timecode="00:00",
                relevance_score=0.5
            ),
            TranscriptPassage(
                text=" ".join(words[-PASSAGE_SIZE_WORDS:]),
                start_word_index=word_count - PASSAGE_SIZE_WORDS,
                end_word_index=word_count,
                estimated_timecode=_estimate_timecode(word_count - PASSAGE_SIZE_WORDS, word_count, video_duration),
                relevance_score=0.5
            )
        ]
    
    # Diviser en passages
    passages = split_into_passages(transcript, video_duration)
    
    # Calculer les scores pour chaque passage
    scored_passages = []
    for passage in passages:
        score, matched = calculate_bm25_score(query_terms, passage, passages)
        if score >= min_score or len(matched) > 0:
            passage.relevance_score = score
            passage.matched_terms = matched
            scored_passages.append(passage)
    
    # Trier par score décroissant
    scored_passages.sort(key=lambda p: p.relevance_score, reverse=True)
    
    # Retourner les meilleurs passages
    top_passages = scored_passages[:max_passages]
    
    # Retrier par ordre chronologique pour la cohérence
    top_passages.sort(key=lambda p: p.start_word_index)
    
    return top_passages


def _estimate_timecode(word_index: int, total_words: int, video_duration: int) -> str:
    """Helper pour estimer un timecode"""
    if total_words == 0 or video_duration == 0:
        return "??:??"
    
    seconds = int((word_index / total_words) * video_duration)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 FORMATAGE POUR LE CHAT
# ═══════════════════════════════════════════════════════════════════════════════

def format_passages_for_chat(
    passages: List[TranscriptPassage],
    max_total_words: int = 8000
) -> str:
    """
    Formate les passages pertinents pour le contexte du chat.
    """
    if not passages:
        return ""
    
    formatted_parts = []
    total_words = 0
    
    for i, passage in enumerate(passages):
        passage_words = len(passage.text.split())
        
        if total_words + passage_words > max_total_words:
            # Tronquer si on dépasse
            remaining = max_total_words - total_words
            if remaining > 100:
                truncated = " ".join(passage.text.split()[:remaining])
                formatted_parts.append(
                    f"[{passage.estimated_timecode}] {truncated}..."
                )
            break
        
        # Ajouter avec le timecode
        if passage.matched_terms:
            terms_str = ", ".join(passage.matched_terms[:3])
            formatted_parts.append(
                f"[{passage.estimated_timecode}] (mots-clés: {terms_str})\n{passage.text}"
            )
        else:
            formatted_parts.append(
                f"[{passage.estimated_timecode}]\n{passage.text}"
            )
        
        total_words += passage_words
    
    return "\n\n---\n\n".join(formatted_parts)


def get_smart_transcript_context(
    question: str,
    transcript: str,
    video_duration: int = 0,
    max_context_words: int = 8000
) -> Tuple[str, bool, int]:
    """
    🎯 Fonction principale: obtient le contexte transcript optimal pour une question.
    
    Args:
        question: Question de l'utilisateur
        transcript: Transcript complet
        video_duration: Durée vidéo en secondes
        max_context_words: Limite de mots pour le contexte
    
    Returns:
        (contexte_formaté, smart_search_utilisée, nombre_passages)
    """
    word_count = len(transcript.split())
    
    if word_count <= max_context_words:
        # Transcript assez court, utiliser tel quel
        return transcript, False, 1
    
    # Rechercher les passages pertinents
    passages = search_relevant_passages(
        question=question,
        transcript=transcript,
        video_duration=video_duration,
        max_passages=MAX_RELEVANT_PASSAGES
    )
    
    if not passages:
        # Fallback: premiers N mots
        return " ".join(transcript.split()[:max_context_words]), False, 1
    
    # Formater pour le chat
    formatted = format_passages_for_chat(passages, max_context_words)
    
    # Ajouter un header explicatif
    header = f"""
═══════════════════════════════════════════════════════════════════════════════
📚 VIDÉO LONGUE ({word_count} mots) — {len(passages)} passages pertinents extraits
═══════════════════════════════════════════════════════════════════════════════

"""
    
    return header + formatted, True, len(passages)
