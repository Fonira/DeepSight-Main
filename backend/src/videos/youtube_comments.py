"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 YOUTUBE COMMENTS SERVICE — Analyse des commentaires YouTube                    ║
║  🆕 v2.1: Service d'extraction et d'analyse des commentaires                       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import json
from typing import List, Dict, Any, Tuple

from core.config import get_mistral_key
from core.http_client import shared_http_client

from .schemas import (
    YouTubeComment, CommentsAnalysis, SentimentType, CommentCategory
)

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

YOUTUBE_API_KEY = None  # Optionnel, on utilise yt-dlp par défaut

# Mots-clés pour la détection de sentiment
POSITIVE_KEYWORDS = {
    "fr": ["merci", "bravo", "excellent", "génial", "super", "incroyable", "top", "parfait", 
           "j'adore", "magnifique", "formidable", "impressionnant", "utile", "clair"],
    "en": ["thanks", "thank you", "great", "awesome", "amazing", "excellent", "perfect",
           "love", "incredible", "fantastic", "helpful", "brilliant", "wonderful"]
}

NEGATIVE_KEYWORDS = {
    "fr": ["nul", "mauvais", "faux", "erreur", "mensonge", "arnaque", "déçu", "ennuyeux",
           "incompréhensible", "inutile", "perte de temps", "bof", "navrant"],
    "en": ["bad", "wrong", "false", "lie", "scam", "disappointed", "boring", "useless",
           "waste of time", "terrible", "awful", "horrible", "stupid"]
}

CONSTRUCTIVE_PATTERNS = {
    "fr": [r"pourquoi", r"comment", r"je pense que", r"il serait", r"suggestion",
           r"d'après moi", r"j'aurais aimé", r"il manque", r"vous devriez"],
    "en": [r"why", r"how", r"i think", r"it would be", r"suggestion",
           r"in my opinion", r"i would have liked", r"missing", r"you should"]
}

TOXIC_PATTERNS = [
    r"\b(idiot|débile|con|connard|crétin|abruti|mongol|retard|stupid|moron|dumb)\b",
    r"(?:va\s+te\s+faire|fuck\s+off|shut\s+up|ferme\s+ta\s+gueule)",
    r"(?:🖕|💩)"
]


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 EXTRACTION DES COMMENTAIRES
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_youtube_comments(
    video_id: str,
    limit: int = 100,
    sort_by: str = "top"  # "top" ou "newest"
) -> List[Dict[str, Any]]:
    """
    Récupère les commentaires d'une vidéo YouTube.
    
    Utilise yt-dlp pour extraire les commentaires sans clé API.
    
    Args:
        video_id: ID de la vidéo YouTube
        limit: Nombre max de commentaires à récupérer
        sort_by: Tri ("top" pour les plus likés, "newest" pour les récents)
    
    Returns:
        Liste des commentaires bruts
    """
    import subprocess
    import tempfile
    import os
    
    print(f"💬 [COMMENTS] Fetching up to {limit} comments for video {video_id}...", flush=True)
    
    try:
        # Créer un fichier temporaire pour la sortie
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        # Commande yt-dlp pour extraire les commentaires
        cmd = [
            "yt-dlp",
            "--skip-download",
            "--write-comments",
            "--no-write-info-json",
            "--extractor-args", f"youtube:comment_sort={sort_by};max_comments={limit}",
            "-o", temp_path.replace('.json', ''),
            f"https://www.youtube.com/watch?v={video_id}"
        ]
        
        # Exécuter yt-dlp
        subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        comments_file = temp_path.replace('.json', '.info.json')
        
        if os.path.exists(comments_file):
            with open(comments_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            raw_comments = data.get('comments', [])
            os.unlink(comments_file)
            
            print(f"✅ [COMMENTS] Fetched {len(raw_comments)} comments", flush=True)
            return raw_comments[:limit]
        
        # Nettoyage
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        
        print("⚠️ [COMMENTS] No comments found or extraction failed", flush=True)
        return []
        
    except subprocess.TimeoutExpired:
        print("⚠️ [COMMENTS] Timeout while fetching comments", flush=True)
        return []
    except Exception as e:
        print(f"❌ [COMMENTS] Error fetching comments: {e}", flush=True)
        return []


async def fetch_comments_via_api(
    video_id: str,
    api_key: str,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Récupère les commentaires via l'API YouTube officielle.
    
    Nécessite une clé API YouTube Data v3.
    """
    comments = []
    next_page_token = None

    async with shared_http_client() as client:
        while len(comments) < limit:
            params = {
                "part": "snippet",
                "videoId": video_id,
                "key": api_key,
                "maxResults": min(100, limit - len(comments)),
                "order": "relevance"
            }
            if next_page_token:
                params["pageToken"] = next_page_token
            
            try:
                response = await client.get(
                    "https://www.googleapis.com/youtube/v3/commentThreads",
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                for item in data.get("items", []):
                    snippet = item["snippet"]["topLevelComment"]["snippet"]
                    comments.append({
                        "id": item["id"],
                        "author": snippet["authorDisplayName"],
                        "author_id": snippet.get("authorChannelId", {}).get("value"),
                        "text": snippet["textDisplay"],
                        "like_count": snippet.get("likeCount", 0),
                        "reply_count": item["snippet"].get("totalReplyCount", 0),
                        "published_at": snippet["publishedAt"]
                    })
                
                next_page_token = data.get("nextPageToken")
                if not next_page_token:
                    break
                    
            except Exception as e:
                print(f"❌ [COMMENTS API] Error: {e}", flush=True)
                break
    
    return comments


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 ANALYSE DES SENTIMENTS
# ═══════════════════════════════════════════════════════════════════════════════

def detect_language(text: str) -> str:
    """Détecte la langue d'un texte (simple heuristique)."""
    french_words = ["je", "tu", "il", "nous", "vous", "et", "est", "dans", "pour", "que", "les"]
    english_words = ["i", "you", "he", "we", "they", "and", "is", "in", "for", "that", "the"]
    
    text_lower = text.lower()
    fr_count = sum(1 for w in french_words if f" {w} " in f" {text_lower} ")
    en_count = sum(1 for w in english_words if f" {w} " in f" {text_lower} ")
    
    return "fr" if fr_count >= en_count else "en"


def analyze_comment_sentiment(text: str, lang: str = "auto") -> Tuple[SentimentType, float]:
    """
    Analyse le sentiment d'un commentaire.
    
    Args:
        text: Texte du commentaire
        lang: Langue ("fr", "en", ou "auto")
    
    Returns:
        (type de sentiment, score -1.0 à 1.0)
    """
    if lang == "auto":
        lang = detect_language(text)
    
    text_lower = text.lower()
    
    # Compter les mots positifs/négatifs
    positive_words = POSITIVE_KEYWORDS.get(lang, POSITIVE_KEYWORDS["en"])
    negative_words = NEGATIVE_KEYWORDS.get(lang, NEGATIVE_KEYWORDS["en"])
    
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    # Calculer le score
    total = pos_count + neg_count
    if total == 0:
        return SentimentType.NEUTRAL, 0.0
    
    score = (pos_count - neg_count) / total
    
    # Déterminer le type
    if score > 0.3:
        return SentimentType.POSITIVE, score
    elif score < -0.3:
        return SentimentType.NEGATIVE, score
    elif abs(pos_count - neg_count) <= 1 and total > 0:
        return SentimentType.MIXED, score
    else:
        return SentimentType.NEUTRAL, score


def is_constructive_comment(text: str, lang: str = "auto") -> Tuple[bool, List[str]]:
    """
    Détermine si un commentaire est constructif.
    
    Un commentaire constructif contient:
    - Des questions pertinentes
    - Des suggestions
    - Des arguments structurés
    
    Returns:
        (is_constructive, list of detected patterns)
    """
    if lang == "auto":
        lang = detect_language(text)
    
    text_lower = text.lower()
    patterns = CONSTRUCTIVE_PATTERNS.get(lang, CONSTRUCTIVE_PATTERNS["en"])
    
    detected = []
    for pattern in patterns:
        if re.search(pattern, text_lower):
            detected.append(pattern)
    
    # Un commentaire est constructif s'il a au moins 2 indicateurs
    # OU s'il fait plus de 100 caractères avec au moins 1 indicateur
    is_constructive = len(detected) >= 2 or (len(detected) >= 1 and len(text) > 100)
    
    return is_constructive, detected


def is_toxic_comment(text: str) -> Tuple[bool, float]:
    """
    Détecte si un commentaire est toxique.
    
    Returns:
        (is_toxic, confidence 0.0-1.0)
    """
    text_lower = text.lower()
    matches = 0
    
    for pattern in TOXIC_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            matches += 1
    
    confidence = min(1.0, matches * 0.4)
    return matches > 0, confidence


def categorize_comment(
    text: str,
    sentiment: SentimentType,
    is_constructive: bool,
    is_toxic: bool
) -> CommentCategory:
    """
    Catégorise un commentaire.
    """
    text_lower = text.lower()
    
    # Vérifier toxicité d'abord
    if is_toxic:
        return CommentCategory.TOXIC
    
    # Questions
    if "?" in text and len(text) > 20:
        return CommentCategory.QUESTION
    
    # Spam (très court, liens, emojis répétés)
    if len(text) < 10 or re.search(r"https?://", text) or re.search(r"(.)\1{4,}", text):
        if sentiment != SentimentType.POSITIVE:
            return CommentCategory.SPAM
    
    # Constructif
    if is_constructive:
        return CommentCategory.CONSTRUCTIVE
    
    # Selon le sentiment
    if sentiment == SentimentType.POSITIVE:
        return CommentCategory.PRAISE
    elif sentiment == SentimentType.NEGATIVE:
        return CommentCategory.CRITICISM
    
    # Vérifier si informatif (contient des faits, sources)
    informative_patterns = [r"source", r"selon", r"d'après", r"étude", r"research", r"fact"]
    if any(re.search(p, text_lower) for p in informative_patterns):
        return CommentCategory.INFORMATIVE
    
    return CommentCategory.OFF_TOPIC


def extract_questions(text: str) -> List[str]:
    """Extrait les questions d'un commentaire."""
    sentences = re.split(r'[.!?]', text)
    questions = [s.strip() + "?" for s in sentences if "?" in s or re.search(r"^(pourquoi|comment|quand|où|qui|what|why|how|when|where|who)", s.strip().lower())]
    return questions[:3]  # Max 3 questions


def extract_key_points(text: str) -> List[str]:
    """Extrait les points clés d'un commentaire."""
    points = []
    
    # Chercher les listes
    list_items = re.findall(r'[-•*]\s*(.+)', text)
    points.extend(list_items[:3])
    
    # Chercher les phrases avec "je pense", "selon moi", etc.
    opinion_patterns = [
        r"(?:je pense que|i think)\s+(.+?)(?:\.|$)",
        r"(?:selon moi|in my opinion)\s*[,:]?\s*(.+?)(?:\.|$)"
    ]
    for pattern in opinion_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        points.extend(matches[:2])
    
    return points[:5]


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 ANALYSE IA DES COMMENTAIRES
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_comments_with_ai(
    comments: List[Dict[str, Any]],
    video_title: str,
    lang: str = "fr",
    model: str = "mistral-small-2603"
) -> Dict[str, Any]:
    """
    Utilise Mistral pour une analyse approfondie des commentaires.
    
    Génère un résumé des tendances et insights.
    """
    api_key = get_mistral_key()
    if not api_key:
        print("⚠️ [COMMENTS AI] No Mistral API key available", flush=True)
        return {}
    
    # Préparer les commentaires pour l'analyse
    top_comments = sorted(comments, key=lambda x: x.get("like_count", 0), reverse=True)[:30]
    comments_text = "\n".join([
        f"[{c.get('like_count', 0)}👍] {c.get('text', '')[:300]}"
        for c in top_comments
    ])
    
    prompt = f"""Analyse les commentaires YouTube suivants pour la vidéo "{video_title}".

COMMENTAIRES (triés par popularité):
{comments_text}

TÂCHE: Génère une analyse structurée en JSON avec:
{{
    "summary": "Résumé de 2-3 phrases sur la réception de la vidéo",
    "main_sentiment": "positive/negative/mixed/neutral",
    "top_questions": ["Liste des questions récurrentes (max 5)"],
    "key_criticisms": ["Principales critiques (max 5)"],
    "key_praises": ["Principaux points positifs (max 5)"],
    "insights": ["Insights intéressants des commentateurs (max 3)"],
    "controversy_level": 0.0-1.0,
    "engagement_quality": 0.0-1.0
}}

Réponds UNIQUEMENT avec le JSON, sans markdown."""

    try:
        async with shared_http_client() as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 1000
                },
                timeout=30.0
            )
            response.raise_for_status()
            
            content = response.json()["choices"][0]["message"]["content"]
            
            # Parser le JSON
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r"```json?\n?", "", content)
                content = content.replace("```", "")
            
            return json.loads(content)
            
    except Exception as e:
        print(f"❌ [COMMENTS AI] Error: {e}", flush=True)
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ANALYSE COMPLÈTE
# ═══════════════════════════════════════════════════════════════════════════════

async def analyze_comments(
    video_id: str,
    limit: int = 100,
    use_ai: bool = True,
    video_title: str = "",
    lang: str = "fr",
    model: str = "mistral-small-2603"
) -> CommentsAnalysis:
    """
    Analyse complète des commentaires d'une vidéo YouTube.
    
    Args:
        video_id: ID de la vidéo
        limit: Nombre max de commentaires à analyser
        use_ai: Utiliser l'IA pour une analyse approfondie
        video_title: Titre de la vidéo (pour contexte)
        lang: Langue de l'analyse
        model: Modèle Mistral à utiliser
    
    Returns:
        CommentsAnalysis avec toutes les métriques
    """
    print(f"💬 [COMMENTS] Starting full analysis for {video_id}...", flush=True)
    
    # 1. Récupérer les commentaires
    raw_comments = await fetch_youtube_comments(video_id, limit)
    
    if not raw_comments:
        print(f"⚠️ [COMMENTS] No comments found for {video_id}", flush=True)
        return CommentsAnalysis(
            video_id=video_id,
            total_comments=0,
            analyzed_count=0
        )
    
    # 2. Analyser chaque commentaire
    analyzed_comments: List[YouTubeComment] = []
    sentiment_dist = {"positive": 0, "negative": 0, "neutral": 0, "mixed": 0}
    category_dist: Dict[str, int] = {}
    constructive_count = 0
    total_sentiment_score = 0.0
    
    for raw in raw_comments:
        text = raw.get("text", "") or raw.get("_raw_text", "")
        if not text or len(text) < 3:
            continue
        
        # Analyser le sentiment
        sentiment, sentiment_score = analyze_comment_sentiment(text, lang)
        sentiment_dist[sentiment.value] += 1
        total_sentiment_score += sentiment_score
        
        # Vérifier si constructif
        is_constructive, _ = is_constructive_comment(text, lang)
        if is_constructive:
            constructive_count += 1
        
        # Vérifier toxicité
        is_toxic, _ = is_toxic_comment(text)
        
        # Catégoriser
        category = categorize_comment(text, sentiment, is_constructive, is_toxic)
        category_dist[category.value] = category_dist.get(category.value, 0) + 1
        
        # Extraire le contenu
        questions = extract_questions(text) if "?" in text else []
        key_points = extract_key_points(text) if len(text) > 50 else []
        
        # Créer l'objet commentaire
        comment = YouTubeComment(
            comment_id=raw.get("id", str(len(analyzed_comments))),
            author=raw.get("author", "Unknown"),
            author_channel_id=raw.get("author_id"),
            text=text,
            like_count=raw.get("like_count", 0),
            reply_count=raw.get("reply_count", 0),
            published_at=None,  # Parser si disponible
            is_reply=raw.get("parent", "") != "",
            parent_id=raw.get("parent"),
            sentiment=sentiment,
            sentiment_score=sentiment_score,
            category=category,
            is_constructive=is_constructive,
            relevance_score=min(1.0, raw.get("like_count", 0) / 100),
            questions_asked=questions,
            key_points=key_points
        )
        analyzed_comments.append(comment)
    
    n_analyzed = len(analyzed_comments)
    avg_sentiment = total_sentiment_score / n_analyzed if n_analyzed > 0 else 0.0
    constructive_ratio = constructive_count / n_analyzed if n_analyzed > 0 else 0.0
    
    # Calculer le score de controverse
    pos = sentiment_dist["positive"]
    neg = sentiment_dist["negative"]
    controversy = min(pos, neg) / max(pos + neg, 1) if pos + neg > 0 else 0.0
    
    # 3. Trier les commentaires
    top_constructive = sorted(
        [c for c in analyzed_comments if c.is_constructive],
        key=lambda x: x.like_count,
        reverse=True
    )[:5]
    
    top_critical = sorted(
        [c for c in analyzed_comments if c.sentiment == SentimentType.NEGATIVE],
        key=lambda x: x.like_count,
        reverse=True
    )[:5]
    
    # Collecter les questions et critiques
    all_questions = []
    all_criticisms = []
    all_praises = []
    
    for c in analyzed_comments:
        all_questions.extend(c.questions_asked)
        if c.category == CommentCategory.CRITICISM:
            all_criticisms.append(c.text[:150])
        elif c.category == CommentCategory.PRAISE:
            all_praises.append(c.text[:150])
    
    # 4. Analyse IA (optionnelle)
    ai_analysis = {}
    summary = None
    key_insights = []
    
    if use_ai and n_analyzed >= 10:
        ai_analysis = await analyze_comments_with_ai(
            [{"text": c.text, "like_count": c.like_count} for c in analyzed_comments],
            video_title,
            lang,
            model
        )
        
        if ai_analysis:
            summary = ai_analysis.get("summary")
            key_insights = ai_analysis.get("insights", [])
            
            # Enrichir avec les données IA
            if ai_analysis.get("top_questions"):
                all_questions = ai_analysis["top_questions"]
            if ai_analysis.get("key_criticisms"):
                all_criticisms = ai_analysis["key_criticisms"]
            if ai_analysis.get("key_praises"):
                all_praises = ai_analysis["key_praises"]
    
    # 5. Construire la réponse
    analysis = CommentsAnalysis(
        video_id=video_id,
        total_comments=len(raw_comments),
        analyzed_count=n_analyzed,
        sentiment_distribution=sentiment_dist,
        average_sentiment=avg_sentiment,
        category_distribution=category_dist,
        constructive_ratio=constructive_ratio,
        engagement_score=ai_analysis.get("engagement_quality", constructive_ratio),
        controversy_score=ai_analysis.get("controversy_level", controversy),
        top_questions=all_questions[:5],
        top_criticisms=all_criticisms[:5],
        top_praises=all_praises[:5],
        key_insights=key_insights[:3],
        top_constructive=top_constructive,
        top_critical=top_critical,
        summary=summary
    )
    
    print(f"✅ [COMMENTS] Analysis complete: {n_analyzed} comments, "
          f"sentiment={avg_sentiment:.2f}, constructive={constructive_ratio:.1%}", flush=True)
    
    return analysis
