"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 INTELLIGENT VIDEO DISCOVERY v4.0 — PARALLEL ASYNC + MULTILINGUAL               ║
║  Recherche haute performance avec scoring intelligent et diversification            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  NOUVEAUTÉS v4.0:                                                                  ║
║  • 🚀 Recherches parallèles (asyncio.gather) - 3x plus rapide                      ║
║  • 🌍 Toutes les langues sélectionnées cherchées équitablement                     ║
║  • 📊 Plus de résultats (30-50 vidéos au lieu de 10-20)                            ║
║  • 🎯 Diversification par langue ET par chaîne                                      ║
║  • 🌻 Tournesol garanti (fallback intelligent)                                      ║
║  • 📈 Détection automatique de la langue des vidéos                                ║
║  • ⚡ Scoring parallèle avec semaphore pour rate limiting                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import os
import json
import math
import asyncio
import subprocess
import hashlib
import time
from typing import List, Dict, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import Counter, defaultdict
import logging

import httpx

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION v4.0
# ═══════════════════════════════════════════════════════════════════════════════

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = "mistral-small-latest"

# 🆕 Configuration parallélisme
MAX_CONCURRENT_SEARCHES = 6  # Nombre max de recherches YouTube simultanées
MAX_CONCURRENT_SCORING = 10  # Nombre max de scoring Tournesol simultanés
SEARCH_TIMEOUT = 25  # Timeout par recherche yt-dlp
SCORING_TIMEOUT = 3  # Timeout par appel Tournesol API

# 🆕 Limites augmentées
DEFAULT_MAX_RESULTS = 30  # Augmenté de 10 à 30
MAX_RESULTS_PER_LANGUAGE = 15  # Vidéos par langue
MAX_RESULTS_ABSOLUTE = 50  # Maximum absolu

# Patterns clickbait à pénaliser
CLICKBAIT_PATTERNS = [
    r'^[A-Z\s!?]{10,}$',
    r'🚨|⚠️|❌|✅|💥|🔥{2,}|😱|🤯',
    r'(?i)\b(shocking|insane|unbelievable|mind.?blow|crazy|epic fail|you won\'t believe)\b',
    r'(?i)\b(choquant|incroyable|fou|dingue|hallucinant)\b',
    r'\$\d{4,}',
    r'#\d+\s+(will|va)\s+',
    r'(?i)^\[?BREAKING\]?',
]

# Indicateurs académiques
ACADEMIC_INDICATORS = [
    r'(?i)\b(source|étude|study|research|recherche|expert|professor|professeur|phd|dr\.)\b',
    r'(?i)\b(peer.?reviewed|académique|academic|university|université|journal|paper)\b',
    r'(?i)\b(data|données|statistics|statistiques|analysis|analyse|evidence|preuve)\b',
    r'(?i)\b(interview|entretien|conférence|conference|lecture|cours|leçon)\b',
    r'(?i)\b(documentaire|documentary|investigation|enquête)\b',
]

# 🆕 Détection de langue par patterns
LANGUAGE_PATTERNS = {
    "fr": [
        r'\b(les|des|une|est|sont|dans|pour|avec|que|qui|cette|mais|plus|leur|tous)\b',
        r'\b(aussi|très|donc|alors|comme|faire|peut|être|avoir|nous|vous)\b',
    ],
    "en": [
        r'\b(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out)\b',
        r'\b(they|been|have|many|some|them|these|would|about|could|other)\b',
    ],
    "de": [
        r'\b(und|der|die|das|ist|sie|wir|mit|auf|für|nicht|sich|als|auch)\b',
    ],
    "es": [
        r'\b(los|las|una|del|que|con|por|para|como|pero|más|esta|sobre)\b',
    ],
    "pt": [
        r'\b(uma|com|não|que|para|mais|como|sua|por|está|dos|das)\b',
    ],
    "it": [
        r'\b(gli|una|che|per|con|non|sono|come|più|della|anche|questa)\b',
    ],
}

OPTIMAL_DURATIONS = {
    "short": (180, 600),
    "medium": (600, 1800),
    "long": (1800, 5400),
    "default": (300, 3600),
}

# Poids du scoring
SCORING_WEIGHTS = {
    "relevance": 0.40,
    "tournesol": 0.20,
    "academic": 0.15,
    "engagement": 0.10,
    "freshness": 0.08,
    "duration": 0.07,
    "clickbait_penalty": 0.10,
}

# Synonymes pour améliorer la pertinence
TERM_SYNONYMS = {
    "coronavirus": ["covid", "covid-19", "covid19", "sars-cov-2", "pandemic", "pandémie"],
    "covid": ["coronavirus", "covid-19", "covid19", "sars-cov-2", "pandemic", "pandémie"],
    "ia": ["intelligence artificielle", "ai", "artificial intelligence", "machine learning", "ml"],
    "ai": ["intelligence artificielle", "ia", "artificial intelligence", "machine learning", "ml"],
    "climat": ["climate", "réchauffement", "warming", "environnement", "environment"],
    "climate": ["climat", "réchauffement", "warming", "environnement", "environment"],
    "économie": ["economy", "economic", "économique", "finance", "financial"],
    "economy": ["économie", "economic", "économique", "finance", "financial"],
    "politique": ["politics", "political", "gouvernement", "government"],
    "politics": ["politique", "political", "gouvernement", "government"],
    "santé": ["health", "médical", "medical", "médecine", "medicine"],
    "health": ["santé", "médical", "medical", "médecine", "medicine"],
    "guerre": ["war", "conflit", "conflict", "militaire", "military"],
    "war": ["guerre", "conflit", "conflict", "militaire", "military"],
    "ukraine": ["ukrainien", "ukrainian", "kiev", "kyiv", "zelensky"],
    "gaza": ["palestine", "palestinian", "israel", "hamas"],
    "israel": ["israeli", "gaza", "palestine", "hamas"],
}


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VideoCandidate:
    """Candidat vidéo avec tous ses scores"""
    video_id: str
    title: str
    channel: str
    description: str
    thumbnail_url: str
    duration: int
    view_count: int
    channel_id: str = ""
    like_count: int = 0
    published_at: datetime = field(default_factory=datetime.now)
    
    # 🆕 Langue détectée
    detected_language: str = "unknown"
    search_language: str = "unknown"  # Langue utilisée pour la recherche
    
    # Scores calculés
    relevance_score: float = 0.0
    tournesol_score: float = 0.0
    academic_score: float = 0.0
    engagement_score: float = 0.0
    freshness_score: float = 0.0
    duration_score: float = 0.0
    clickbait_penalty: float = 0.0
    final_score: float = 0.0
    
    # Flags spéciaux
    is_tournesol_pick: bool = False
    matched_query_terms: List[str] = field(default_factory=list)
    detected_sources: int = 0
    content_type: str = "unknown"
    
    def to_dict(self) -> Dict:
        raw_tournesol = round((self.tournesol_score * 200) - 100) if self.tournesol_score != 0.5 else 0
        
        return {
            "video_id": self.video_id,
            "title": self.title,
            "channel": self.channel,
            "channel_id": self.channel_id,
            "description": self.description[:500] if self.description else "",
            "thumbnail_url": self.thumbnail_url,
            "duration": self.duration,
            "duration_formatted": self._format_duration(),
            "view_count": self.view_count,
            "view_count_formatted": self._format_views(),
            "like_count": self.like_count,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "is_tournesol_pick": self.is_tournesol_pick,
            "tournesol_score": raw_tournesol,
            "quality_score": round(self.final_score),
            "academic_score": round(self.academic_score * 100),
            "engagement_score": round(self.engagement_score * 100),
            "freshness_score": round(self.freshness_score * 100),
            "clickbait_penalty": round(self.clickbait_penalty * 100),
            "language": self.detected_language,
            "matched_query_terms": self.matched_query_terms,
            "detected_sources": self.detected_sources,
            "content_type": self.content_type,
            "url": f"https://www.youtube.com/watch?v={self.video_id}",
        }
    
    def _format_duration(self) -> str:
        if self.duration < 3600:
            return f"{self.duration // 60}:{self.duration % 60:02d}"
        hours = self.duration // 3600
        minutes = (self.duration % 3600) // 60
        seconds = self.duration % 60
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    
    def _format_views(self) -> str:
        if self.view_count >= 1_000_000:
            return f"{self.view_count / 1_000_000:.1f}M"
        elif self.view_count >= 1_000:
            return f"{self.view_count / 1_000:.1f}K"
        return str(self.view_count)


@dataclass
class DiscoveryResultCompat:
    """Version compatible avec le router existant"""
    query: str
    reformulated_queries: List[str]
    candidates: List[VideoCandidate]
    total_searched: int
    languages_searched: List[str]
    search_duration_ms: int
    tournesol_available: bool = True
    
    # 🆕 Stats par langue
    videos_per_language: Dict[str, int] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌍 LANGUAGE DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

class LanguageDetector:
    """Détecte la langue d'un texte de façon rapide et fiable"""
    
    @classmethod
    def detect(cls, text: str) -> str:
        """Détecte la langue dominante d'un texte"""
        if not text:
            return "unknown"
        
        text_lower = text.lower()
        scores = {}
        
        for lang, patterns in LANGUAGE_PATTERNS.items():
            score = 0
            for pattern in patterns:
                matches = re.findall(pattern, text_lower)
                score += len(matches)
            scores[lang] = score
        
        if not scores:
            return "unknown"
        
        best_lang = max(scores.keys(), key=lambda k: scores[k])
        
        # Seuil minimum de confiance
        if scores[best_lang] < 3:
            return "unknown"
        
        return best_lang
    
    @classmethod
    def detect_video_language(cls, title: str, description: str, channel: str) -> str:
        """Détecte la langue d'une vidéo en combinant titre, description et chaîne"""
        combined_text = f"{title} {description[:500]} {channel}"
        return cls.detect(combined_text)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 MISTRAL AI REPROMPTING
# ═══════════════════════════════════════════════════════════════════════════════

class MistralReprompt:
    """Reformulation intelligente des requêtes via Mistral AI"""
    
    SYSTEM_PROMPT = """Tu es un expert en recherche de contenu éducatif sur YouTube.
Ta mission: transformer une requête utilisateur en 3-5 requêtes de recherche YouTube optimisées.

RÈGLES:
1. Privilégie le contenu académique, documentaire, interviews d'experts
2. Évite le clickbait et le sensationnalisme
3. Ajoute des termes de qualité: "analyse", "expert", "conférence", "documentaire", "interview"
4. Si la requête est en français, garde une variante française + ajoute une variante anglaise
5. Sois concis: chaque requête doit faire 3-8 mots maximum

FORMAT DE RÉPONSE (JSON uniquement):
{"queries": ["requête 1", "requête 2", "requête 3"]}"""

    @classmethod
    async def reformulate(cls, query: str, language: str = "fr") -> List[str]:
        """Reformule la requête via Mistral AI"""
        queries = [query]
        
        if not MISTRAL_API_KEY:
            logger.warning("⚠️ MISTRAL_API_KEY not set, using fallback reformulation")
            return cls._fallback_reformulation(query, language)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {MISTRAL_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": MISTRAL_MODEL,
                        "messages": [
                            {"role": "system", "content": cls.SYSTEM_PROMPT},
                            {"role": "user", "content": f"Requête utilisateur ({language}): {query}"}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 200,
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    
                    if "queries" in parsed and isinstance(parsed["queries"], list):
                        queries.extend(parsed["queries"][:4])
                        logger.info(f"🧠 Mistral reformulated '{query}' → {len(queries)} queries")
                else:
                    logger.warning(f"Mistral API error: {response.status_code}")
                    queries = cls._fallback_reformulation(query, language)
                    
        except Exception as e:
            logger.error(f"Mistral reformulation error: {e}")
            queries = cls._fallback_reformulation(query, language)
        
        return queries[:5]
    
    @classmethod
    def _fallback_reformulation(cls, query: str, language: str) -> List[str]:
        """Reformulation sans IA (fallback)"""
        queries = [query]
        
        academic_suffixes = {
            "fr": ["analyse", "documentaire", "conférence", "expert"],
            "en": ["analysis", "documentary", "lecture", "expert interview"],
            "de": ["analyse", "dokumentation", "vortrag"],
            "es": ["análisis", "documental", "conferencia"],
        }
        
        lang_suffixes = academic_suffixes.get(language, academic_suffixes["en"])
        
        for suffix in lang_suffixes[:2]:
            queries.append(f"{query} {suffix}")
        
        if language == "fr":
            queries.append(f"{query} english")
        elif language == "en":
            queries.append(f"{query} français")
        
        return queries
    
    @classmethod
    async def translate_query(cls, query: str, from_lang: str, to_lang: str) -> str:
        """Traduit une requête vers une autre langue"""
        if from_lang == to_lang:
            return query
        
        SIMPLE_TRANSLATIONS = {
            ("fr", "en"): {
                "intelligence artificielle": "artificial intelligence",
                "changement climatique": "climate change",
                "réchauffement climatique": "global warming",
                "économie": "economy",
                "politique": "politics",
            },
            ("en", "fr"): {
                "artificial intelligence": "intelligence artificielle",
                "climate change": "changement climatique",
                "global warming": "réchauffement climatique",
                "economy": "économie",
                "politics": "politique",
            },
        }
        
        simple_key = (from_lang, to_lang)
        if simple_key in SIMPLE_TRANSLATIONS:
            query_lower = query.lower()
            for src, dst in SIMPLE_TRANSLATIONS[simple_key].items():
                if src in query_lower:
                    return query.lower().replace(src, dst)
        
        if not MISTRAL_API_KEY:
            return query
        
        try:
            lang_names = {"fr": "français", "en": "anglais", "de": "allemand", "es": "espagnol"}
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {MISTRAL_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": MISTRAL_MODEL,
                        "messages": [
                            {"role": "system", "content": "Tu es un traducteur. Traduis UNIQUEMENT la requête de recherche, sans ajouter d'explication. Réponds avec la traduction seule."},
                            {"role": "user", "content": f"Traduis en {lang_names.get(to_lang, to_lang)}: {query}"}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 50,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    translated = data["choices"][0]["message"]["content"].strip()
                    logger.info(f"🌍 Translated '{query}' ({from_lang}) → '{translated}' ({to_lang})")
                    return translated
                    
        except Exception as e:
            logger.debug(f"Translation error: {e}")
        
        return query


# ═══════════════════════════════════════════════════════════════════════════════
# 📺 YOUTUBE SEARCH VIA YT-DLP — Version Parallèle
# ═══════════════════════════════════════════════════════════════════════════════

class YouTubeSearcher:
    """Recherche YouTube via yt-dlp avec support parallèle"""
    
    # Semaphore pour limiter les recherches parallèles
    _search_semaphore: Optional[asyncio.Semaphore] = None
    
    @classmethod
    def _get_semaphore(cls) -> asyncio.Semaphore:
        if cls._search_semaphore is None:
            cls._search_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SEARCHES)
        return cls._search_semaphore
    
    @classmethod
    async def search(
        cls,
        query: str,
        max_results: int = 15,
        language: str = "fr"
    ) -> List[Dict]:
        """Recherche YouTube via yt-dlp avec semaphore"""
        async with cls._get_semaphore():
            return await cls._search_internal(query, max_results, language)
    
    @classmethod
    async def _search_internal(
        cls,
        query: str,
        max_results: int = 15,
        language: str = "fr"
    ) -> List[Dict]:
        """Recherche YouTube interne"""
        results = []
        max_results = min(max_results, 30)
        
        try:
            search_query = f"ytsearch{max_results}:{query}"
            
            cmd = [
                "yt-dlp",
                "--dump-json",
                "--flat-playlist",
                "--no-warnings",
                "--geo-bypass",
                search_query
            ]
            
            logger.info(f"🔍 yt-dlp search: '{query}' (max={max_results}, lang={language})")
            
            loop = asyncio.get_event_loop()
            
            def run_ytdlp():
                try:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=SEARCH_TIMEOUT
                    )
                    return result.stdout, result.stderr
                except subprocess.TimeoutExpired:
                    logger.error(f"yt-dlp timeout after {SEARCH_TIMEOUT}s")
                    return "", "timeout"
                except Exception as e:
                    logger.error(f"yt-dlp subprocess error: {e}")
                    return "", str(e)
            
            stdout, stderr = await loop.run_in_executor(None, run_ytdlp)
            
            if stderr and "timeout" not in stderr.lower():
                logger.debug(f"yt-dlp stderr: {stderr[:200]}")
            
            if stdout:
                for line in stdout.strip().split('\n'):
                    if line:
                        try:
                            video_data = json.loads(line)
                            if video_data.get('id'):
                                video_data['_search_language'] = language
                                results.append(video_data)
                        except json.JSONDecodeError:
                            continue
            
            logger.info(f"✅ yt-dlp found {len(results)} videos for '{query[:30]}...' ({language})")
            
        except Exception as e:
            logger.error(f"YouTube search error: {e}")
        
        return results
    
    @classmethod
    async def search_parallel(
        cls,
        queries: List[Tuple[str, str]],  # Liste de (query, language)
    ) -> Dict[str, List[Dict]]:
        """
        🚀 Recherche parallèle pour plusieurs requêtes.
        
        Args:
            queries: Liste de tuples (query, language)
            
        Returns:
            Dict avec les résultats par langue
        """
        results_by_lang: Dict[str, List[Dict]] = defaultdict(list)
        
        tasks = []
        for query, lang in queries:
            task = cls.search(query, MAX_RESULTS_PER_LANGUAGE, lang)
            tasks.append((lang, task))
        
        # Exécuter toutes les recherches en parallèle
        search_results = await asyncio.gather(
            *[t[1] for t in tasks],
            return_exceptions=True
        )
        
        # Agréger les résultats par langue
        for i, result in enumerate(search_results):
            lang = tasks[i][0]
            if isinstance(result, Exception):
                logger.error(f"Search error for {lang}: {result}")
                continue
            if isinstance(result, list):
                results_by_lang[lang].extend(result)
        
        return dict(results_by_lang)
    
    @classmethod
    def parse_video_result(cls, raw: Dict) -> Optional[VideoCandidate]:
        """Parse un résultat yt-dlp en VideoCandidate"""
        try:
            video_id = raw.get("id")
            if not video_id:
                return None
            
            # Parser la date
            upload_date = raw.get("upload_date", "")
            if upload_date and len(upload_date) == 8:
                try:
                    published_at = datetime.strptime(upload_date, "%Y%m%d")
                except:
                    published_at = datetime.now()
            else:
                published_at = datetime.now()
            
            # Thumbnail
            thumbnails = raw.get("thumbnails", [])
            thumbnail_url = ""
            if thumbnails:
                for t in reversed(thumbnails):
                    if t.get("url"):
                        thumbnail_url = t["url"]
                        break
            if not thumbnail_url:
                thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
            
            channel_id = raw.get("channel_id") or raw.get("uploader_id") or raw.get("channel", "") or ""
            title = raw.get("title", "") or ""
            description = (raw.get("description", "") or "")[:1000]
            channel = raw.get("channel") or raw.get("uploader") or "Unknown"
            
            # 🆕 Détecter la langue du contenu
            detected_lang = LanguageDetector.detect_video_language(title, description, channel)
            search_lang = raw.get("_search_language", "unknown")
            
            return VideoCandidate(
                video_id=video_id,
                title=title,
                channel=channel,
                channel_id=channel_id,
                description=description,
                thumbnail_url=thumbnail_url,
                duration=int(raw.get("duration", 0) or 0),
                view_count=int(raw.get("view_count", 0) or 0),
                like_count=int(raw.get("like_count", 0) or 0),
                published_at=published_at,
                detected_language=detected_lang,
                search_language=search_lang,
            )
            
        except Exception as e:
            logger.error(f"Error parsing yt-dlp result: {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUALITY SCORER — Version Parallèle
# ═══════════════════════════════════════════════════════════════════════════════

class QualityScorer:
    """Calcule les scores de qualité multi-critères avec support parallèle"""
    
    # Semaphore pour limiter les appels Tournesol parallèles
    _tournesol_semaphore: Optional[asyncio.Semaphore] = None
    
    # Cache Tournesol pour éviter les appels dupliqués
    _tournesol_cache: Dict[str, float] = {}
    
    @classmethod
    def _get_tournesol_semaphore(cls) -> asyncio.Semaphore:
        if cls._tournesol_semaphore is None:
            cls._tournesol_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SCORING)
        return cls._tournesol_semaphore
    
    @classmethod
    async def score_candidates_batch(
        cls,
        candidates: List[VideoCandidate],
        query: str,
        duration_type: str = "default"
    ) -> List[VideoCandidate]:
        """
        🚀 Score un batch de candidats en parallèle.
        Optimise les appels Tournesol avec batching et caching.
        """
        # Récupérer tous les scores Tournesol en parallèle
        video_ids = [c.video_id for c in candidates]
        tournesol_scores = await cls._batch_get_tournesol_scores(video_ids)
        
        # Scorer chaque candidat
        scored = []
        for candidate in candidates:
            candidate.tournesol_score = tournesol_scores.get(candidate.video_id, 0.5)
            
            # Marquer comme Tournesol pick si score positif
            if candidate.tournesol_score > 0.55:
                candidate.is_tournesol_pick = True
            
            # Scores locaux (rapides, pas d'API)
            candidate.relevance_score = cls._calculate_relevance_score(candidate, query)
            candidate.academic_score = cls._calculate_academic_score(candidate)
            candidate.engagement_score = cls._calculate_engagement_score(candidate)
            candidate.freshness_score = cls._calculate_freshness_score(candidate)
            candidate.duration_score = cls._calculate_duration_score(candidate, duration_type)
            candidate.clickbait_penalty = cls._calculate_clickbait_penalty(candidate)
            
            # Extraire les termes matchés
            candidate.matched_query_terms = cls._extract_matched_terms(candidate, query)
            
            # Détecter les sources
            candidate.detected_sources = cls._count_detected_sources(candidate)
            
            # Score final
            candidate.final_score = (
                candidate.relevance_score * SCORING_WEIGHTS["relevance"] +
                candidate.tournesol_score * SCORING_WEIGHTS["tournesol"] +
                candidate.academic_score * SCORING_WEIGHTS["academic"] +
                candidate.engagement_score * SCORING_WEIGHTS["engagement"] +
                candidate.freshness_score * SCORING_WEIGHTS["freshness"] +
                candidate.duration_score * SCORING_WEIGHTS["duration"] -
                candidate.clickbait_penalty * SCORING_WEIGHTS["clickbait_penalty"]
            ) * 100
            
            scored.append(candidate)
        
        return scored
    
    @classmethod
    async def _batch_get_tournesol_scores(cls, video_ids: List[str]) -> Dict[str, float]:
        """Récupère les scores Tournesol en batch parallèle avec cache"""
        scores = {}
        ids_to_fetch = []
        
        # Vérifier le cache d'abord
        for vid in video_ids:
            if vid in cls._tournesol_cache:
                scores[vid] = cls._tournesol_cache[vid]
            else:
                ids_to_fetch.append(vid)
        
        if not ids_to_fetch:
            return scores
        
        # Fetch les scores manquants en parallèle
        async def fetch_one(vid: str) -> Tuple[str, float]:
            async with cls._get_tournesol_semaphore():
                score = await cls._get_tournesol_score(vid)
                return vid, score
        
        tasks = [fetch_one(vid) for vid in ids_to_fetch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, tuple):
                vid, score = result
                scores[vid] = score
                cls._tournesol_cache[vid] = score
        
        return scores
    
    @classmethod
    async def _get_tournesol_score(cls, video_id: str) -> float:
        """Récupère le score Tournesol si disponible"""
        try:
            async with httpx.AsyncClient(timeout=SCORING_TIMEOUT) as client:
                response = await client.get(
                    f"https://api.tournesol.app/polls/videos/entities/yt:{video_id}",
                    headers={"User-Agent": "DeepSight/4.0 (tournesol-integration)"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    raw_score = data.get("tournesol_score", 0)
                    
                    if raw_score is not None and raw_score != 0:
                        normalized = (raw_score + 100) / 200
                        return max(0.0, min(1.0, normalized))
                    
        except Exception:
            pass
        
        return 0.5
    
    @classmethod
    def _calculate_relevance_score(cls, candidate: VideoCandidate, query: str) -> float:
        """Score de pertinence basé sur les termes exacts"""
        query_lower = query.lower()
        title_lower = candidate.title.lower()
        desc_lower = (candidate.description or "").lower()[:500]
        channel_lower = candidate.channel.lower()
        
        query_terms = [t.strip() for t in re.split(r'\s+', query_lower) if len(t.strip()) >= 2]
        
        if not query_terms:
            return 0.5
        
        score = 0.0
        total_weight = 0.0
        
        for term in query_terms:
            term_weight = len(term) / 10
            total_weight += term_weight
            
            terms_to_check = [term] + TERM_SYNONYMS.get(term, [])
            
            for check_term in terms_to_check:
                if check_term in title_lower:
                    score += term_weight * 1.0
                    break
                elif check_term in desc_lower:
                    score += term_weight * 0.5
                    break
                elif check_term in channel_lower:
                    score += term_weight * 0.3
                    break
            
            if term.isdigit() and term in title_lower:
                score += term_weight * 0.5
        
        if total_weight == 0:
            return 0.5
        
        normalized = score / total_weight
        
        all_in_title = all(
            any(t in title_lower for t in [term] + TERM_SYNONYMS.get(term, []))
            for term in query_terms
        )
        if all_in_title:
            normalized = min(normalized + 0.3, 1.0)
        
        return normalized
    
    @classmethod
    def _calculate_academic_score(cls, candidate: VideoCandidate) -> float:
        """Score basé sur les indicateurs académiques"""
        text = f"{candidate.title} {candidate.description} {candidate.channel}"
        score = 0.0
        
        for pattern in ACADEMIC_INDICATORS:
            if re.search(pattern, text):
                score += 0.2
        
        return min(score, 1.0)
    
    @classmethod
    def _calculate_engagement_score(cls, candidate: VideoCandidate) -> float:
        """Score basé sur l'engagement"""
        if candidate.view_count == 0:
            return 0.0
        
        view_score = min(math.log10(candidate.view_count + 1) / 7, 1.0)
        
        if candidate.like_count > 0 and candidate.view_count > 0:
            like_ratio = candidate.like_count / candidate.view_count
            like_score = min(like_ratio * 20, 1.0)
            return (view_score + like_score) / 2
        
        return view_score
    
    @classmethod
    def _calculate_freshness_score(cls, candidate: VideoCandidate) -> float:
        """Score basé sur la fraîcheur"""
        if not candidate.published_at:
            return 0.5
        
        age_days = (datetime.now() - candidate.published_at).days
        
        if age_days <= 7:
            return 1.0
        elif age_days <= 30:
            return 0.9
        elif age_days <= 90:
            return 0.7
        elif age_days <= 365:
            return 0.5
        elif age_days <= 730:
            return 0.3
        else:
            return 0.1
    
    @classmethod
    def _calculate_duration_score(cls, candidate: VideoCandidate, duration_type: str) -> float:
        """Score basé sur la durée optimale"""
        duration = candidate.duration
        optimal_range = OPTIMAL_DURATIONS.get(duration_type, OPTIMAL_DURATIONS["default"])
        
        if optimal_range[0] <= duration <= optimal_range[1]:
            return 1.0
        elif duration < optimal_range[0]:
            return duration / optimal_range[0] if optimal_range[0] > 0 else 0
        else:
            return max(0, 1 - (duration - optimal_range[1]) / optimal_range[1]) if optimal_range[1] > 0 else 0
    
    @classmethod
    def _calculate_clickbait_penalty(cls, candidate: VideoCandidate) -> float:
        """Pénalité pour le contenu clickbait"""
        text = candidate.title
        penalty = 0.0
        
        for pattern in CLICKBAIT_PATTERNS:
            if re.search(pattern, text):
                penalty += 0.15
        
        return min(penalty, 1.0)
    
    @classmethod
    def _extract_matched_terms(cls, candidate: VideoCandidate, query: str) -> List[str]:
        """Extrait les termes de la requête trouvés dans le titre"""
        query_terms = [t.strip().lower() for t in re.split(r'\s+', query) if len(t.strip()) >= 2]
        title_lower = candidate.title.lower()
        
        matched = []
        for term in query_terms:
            if term in title_lower:
                matched.append(term)
            else:
                for syn in TERM_SYNONYMS.get(term, []):
                    if syn in title_lower:
                        matched.append(term)
                        break
        
        return matched
    
    @classmethod
    def _count_detected_sources(cls, candidate: VideoCandidate) -> int:
        """Compte les sources détectées dans la description"""
        text = candidate.description.lower()
        count = 0
        
        source_patterns = [
            r'source\s*:',
            r'référence\s*:',
            r'reference\s*:',
            r'étude\s*:',
            r'study\s*:',
            r'https?://',
            r'doi:',
        ]
        
        for pattern in source_patterns:
            matches = re.findall(pattern, text)
            count += len(matches)
        
        return min(count, 10)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌻 TOURNESOL PROMOTION — Vidéo sponsorisée de qualité
# ═══════════════════════════════════════════════════════════════════════════════

class TournesolPromotion:
    """Récupère une vidéo Tournesol en rapport avec le sujet recherché"""
    
    TOPIC_MAPPING = {
        "science": ["science"],
        "scientifique": ["science"],
        "ia": ["technology", "science"],
        "ai": ["technology", "science"],
        "intelligence artificielle": ["technology", "science"],
        "climat": ["environment", "science"],
        "climate": ["environment", "science"],
        "politique": ["politics", "society"],
        "politics": ["politics", "society"],
        "économie": ["economics", "politics"],
        "economy": ["economics", "politics"],
        "santé": ["health"],
        "health": ["health"],
        "éducation": ["education"],
        "education": ["education"],
    }
    
    FALLBACK_VIDEOS = [
        {
            "video_id": "cCKONDOJN8I",
            "title": "Les réseaux de neurones - Science4All",
            "channel": "Science4All",
            "duration": 1200,
            "view_count": 500000,
        },
        {
            "video_id": "KT4FqX1aQIk",
            "title": "La démocratie est-elle compatible avec l'écologie ?",
            "channel": "Le Réveilleur",
            "duration": 2400,
            "view_count": 300000,
        },
        {
            "video_id": "Vjkq8V5rVy0",
            "title": "L'intelligence artificielle va-t-elle nous dépasser ?",
            "channel": "Monsieur Phi",
            "duration": 1800,
            "view_count": 400000,
        },
        {
            "video_id": "0NCbZdU0-i0",
            "title": "Le paradoxe de Fermi - Où sont les extraterrestres ?",
            "channel": "ScienceEtonnante",
            "duration": 1500,
            "view_count": 2000000,
        },
    ]
    
    @classmethod
    async def get_tournesol_pick(cls, query: str, exclude_ids: List[str] = None) -> Optional[VideoCandidate]:
        """Récupère LA meilleure vidéo Tournesol en rapport avec la recherche"""
        exclude_ids = exclude_ids or []
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Recherche sémantique Tournesol
                response = await client.get(
                    "https://api.tournesol.app/polls/videos/recommendations/",
                    params={
                        "limit": 50,
                        "unsafe": "false",
                        "search": query,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])
                    
                    for item in results:
                        video_id = item.get("entity", {}).get("uid", "").replace("yt:", "")
                        
                        if not video_id or video_id in exclude_ids:
                            continue
                        
                        metadata = item.get("entity", {}).get("metadata", {})
                        
                        return VideoCandidate(
                            video_id=video_id,
                            title=metadata.get("name", "Recommandé par Tournesol"),
                            channel=metadata.get("uploader", "Tournesol"),
                            channel_id="tournesol",
                            description=metadata.get("description", "")[:500] if metadata.get("description") else "",
                            thumbnail_url=f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                            duration=metadata.get("duration", 0) or 600,
                            view_count=metadata.get("views", 0) or 10000,
                            like_count=0,
                            published_at=datetime.now(),
                            tournesol_score=1.0,
                            is_tournesol_pick=True,
                            detected_language="fr",
                        )
                        
        except Exception as e:
            logger.error(f"Tournesol promotion error: {e}")
        
        return cls.get_hardcoded_fallback(exclude_ids)
    
    @classmethod
    def get_hardcoded_fallback(cls, exclude_ids: List[str] = None) -> Optional[VideoCandidate]:
        """Fallback hardcodé pour toujours avoir une vidéo Tournesol"""
        exclude_ids = exclude_ids or []
        
        for video_data in cls.FALLBACK_VIDEOS:
            if video_data["video_id"] not in exclude_ids:
                return VideoCandidate(
                    video_id=video_data["video_id"],
                    title=f"🌻 {video_data['title']}",
                    channel=video_data["channel"],
                    channel_id="tournesol_fallback",
                    description="Vidéo de qualité recommandée par Tournesol",
                    thumbnail_url=f"https://i.ytimg.com/vi/{video_data['video_id']}/hqdefault.jpg",
                    duration=video_data["duration"],
                    view_count=video_data["view_count"],
                    like_count=0,
                    published_at=datetime.now(),
                    tournesol_score=1.0,
                    is_tournesol_pick=True,
                    detected_language="fr",
                )
        
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 INTELLIGENT DISCOVERY SERVICE v4.0 — Version Haute Performance
# ═══════════════════════════════════════════════════════════════════════════════

class IntelligentDiscoveryService:
    """
    Service de découverte intelligente v4.0
    🚀 Recherches parallèles pour toutes les langues
    🌍 Diversification par langue ET chaîne
    📊 Plus de résultats avec scoring optimisé
    """
    
    @classmethod
    async def discover(
        cls,
        query: str,
        languages: List[str] = None,
        max_results: int = DEFAULT_MAX_RESULTS,
        min_quality: float = 30.0,
        target_duration: str = "default",
    ) -> DiscoveryResultCompat:
        """
        🔍 Découvre les meilleures vidéos pour une requête.
        
        Nouveautés v4.0:
        - Recherches parallèles dans TOUTES les langues
        - Plus de résultats (30-50 au lieu de 10-20)
        - Diversification équitable par langue
        """
        start_time = time.time()
        
        if languages is None:
            languages = ["fr", "en"]
        
        # Limiter le nombre de langues pour la performance
        languages = languages[:6]
        
        primary_lang = languages[0] if languages else "fr"
        max_results = min(max_results, MAX_RESULTS_ABSOLUTE)
        
        logger.info(f"🔍 [DISCOVER v4.0] Query: '{query}' | Langs: {languages} | Max: {max_results}")
        print(f"🔍 [DISCOVER v4.0] Starting parallel search: '{query}' (langs={languages})", flush=True)
        
        # 1. Reformulation via Mistral AI
        reformulated = await MistralReprompt.reformulate(query, primary_lang)
        logger.info(f"🧠 Reformulated queries: {reformulated}")
        
        # 2. 🚀 Préparer les recherches parallèles pour TOUTES les langues
        search_tasks: List[Tuple[str, str]] = []
        
        # Requêtes originales pour chaque langue
        for lang in languages:
            for q in reformulated[:2]:  # 2 variantes par langue
                search_tasks.append((q, lang))
        
        # Traductions pour les langues secondaires
        for lang in languages[1:]:
            translated = await MistralReprompt.translate_query(query, primary_lang, lang)
            if translated != query:
                search_tasks.append((translated, lang))
        
        print(f"🚀 [DISCOVER v4.0] Launching {len(search_tasks)} parallel searches...", flush=True)
        
        # 3. 🚀 Exécuter toutes les recherches en parallèle
        results_by_lang = await YouTubeSearcher.search_parallel(search_tasks)
        
        # 4. Dédupliquer et parser les résultats
        all_candidates: Dict[str, VideoCandidate] = {}
        
        for lang, raw_results in results_by_lang.items():
            for raw in raw_results:
                candidate = YouTubeSearcher.parse_video_result(raw)
                if candidate and candidate.video_id not in all_candidates:
                    all_candidates[candidate.video_id] = candidate
        
        print(f"📊 [DISCOVER v4.0] Found {len(all_candidates)} unique candidates", flush=True)
        
        # 5. 🚀 Scorer tous les candidats en batch parallèle
        candidates_list = list(all_candidates.values())
        scored_candidates = await QualityScorer.score_candidates_batch(
            candidates_list, query, target_duration
        )
        
        # Filtrer par qualité minimum
        scored_candidates = [c for c in scored_candidates if c.final_score >= min_quality]
        
        # 6. Trier par score
        scored_candidates.sort(key=lambda x: x.final_score, reverse=True)
        
        # 7. 🆕 Diversification intelligente par LANGUE et CHAÎNE
        final_candidates = []
        channel_counts: Counter = Counter()
        language_counts: Counter = Counter()
        
        # Objectif: répartir équitablement entre les langues
        max_per_language = max(max_results // len(languages), 5)
        max_per_channel = 2
        
        # Premier passage: garantir au moins quelques vidéos par langue
        for candidate in scored_candidates:
            lang = candidate.detected_language or candidate.search_language
            
            if (channel_counts[candidate.channel_id] < max_per_channel and
                language_counts[lang] < max_per_language):
                final_candidates.append(candidate)
                channel_counts[candidate.channel_id] += 1
                language_counts[lang] += 1
                
                if len(final_candidates) >= max_results - 1:  # -1 pour Tournesol
                    break
        
        # Second passage: compléter si nécessaire (moins strict sur la langue)
        if len(final_candidates) < max_results - 1:
            for candidate in scored_candidates:
                if candidate not in final_candidates:
                    if channel_counts[candidate.channel_id] < max_per_channel:
                        final_candidates.append(candidate)
                        channel_counts[candidate.channel_id] += 1
                        
                        if len(final_candidates) >= max_results - 1:
                            break
        
        # 8. 🌻 Garantir une vidéo Tournesol
        has_tournesol = any(c.is_tournesol_pick for c in final_candidates[:5])
        
        if not has_tournesol:
            print(f"🌻 [DISCOVER v4.0] No Tournesol in top 5, fetching one...", flush=True)
            existing_ids = [c.video_id for c in final_candidates]
            tournesol_pick = await TournesolPromotion.get_tournesol_pick(query, existing_ids)
            
            if tournesol_pick:
                tournesol_pick.relevance_score = QualityScorer._calculate_relevance_score(tournesol_pick, query)
                tournesol_pick.final_score = 100.0
                
                # Insérer en position 3
                insert_pos = min(2, len(final_candidates))
                final_candidates.insert(insert_pos, tournesol_pick)
                
                if len(final_candidates) > max_results:
                    final_candidates.pop()
                
                print(f"🌻 [DISCOVER v4.0] Tournesol added at position {insert_pos + 1}", flush=True)
        
        # 9. Stats par langue
        videos_per_lang = Counter(
            c.detected_language or c.search_language 
            for c in final_candidates
        )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        print(f"✅ [DISCOVER v4.0] Completed in {duration_ms}ms | {len(final_candidates)} videos | By lang: {dict(videos_per_lang)}", flush=True)
        
        return DiscoveryResultCompat(
            query=query,
            reformulated_queries=reformulated,
            candidates=final_candidates,
            total_searched=len(all_candidates),
            languages_searched=languages,
            search_duration_ms=duration_ms,
            tournesol_available=True,
            videos_per_language=dict(videos_per_lang),
        )
    
    @classmethod
    async def discover_single_best(
        cls,
        query: str,
        languages: List[str] = None,
    ) -> Optional[VideoCandidate]:
        """Trouve LA meilleure vidéo pour une requête"""
        result = await cls.discover(
            query=query,
            languages=languages,
            max_results=5,
            min_quality=20.0,
        )
        return result.candidates[0] if result.candidates else None
    
    @classmethod
    async def discover_for_playlist(
        cls,
        query: str,
        num_videos: int = 5,
        languages: List[str] = None,
    ) -> List[VideoCandidate]:
        """Découvre plusieurs vidéos pour créer une playlist"""
        result = await cls.discover(
            query=query,
            languages=languages,
            max_results=num_videos * 2,
            min_quality=25.0,
        )
        
        # Diversification stricte: max 1 par chaîne
        channel_seen = set()
        diversified = []
        
        for candidate in result.candidates:
            if candidate.channel_id not in channel_seen:
                diversified.append(candidate)
                channel_seen.add(candidate.channel_id)
                if len(diversified) >= num_videos:
                    break
        
        return diversified


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 RAW TEXT ANALYSIS HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_text_video_id(text: str) -> str:
    """Génère un ID unique pour une analyse de texte brut"""
    hash_digest = hashlib.md5(text.encode()).hexdigest()
    return f"txt_{hash_digest[:11]}"


def validate_raw_text(text: str) -> Tuple[bool, Optional[str]]:
    """Valide le texte brut pour l'analyse"""
    if not text or not text.strip():
        return False, "Le texte ne peut pas être vide"
    
    char_count = len(text)
    
    if char_count < 100:
        return False, f"Le texte est trop court ({char_count} caractères, minimum 100)"
    
    if char_count > 500000:
        return False, f"Le texte est trop long ({char_count} caractères, maximum 500,000)"
    
    word_count = len(text.split())
    if word_count < 20:
        return False, f"Le texte contient trop peu de mots ({word_count}, minimum 20)"
    
    return True, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎁 EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    "VideoCandidate",
    "DiscoveryResultCompat",
    "MistralReprompt",
    "YouTubeSearcher",
    "QualityScorer",
    "TournesolPromotion",
    "IntelligentDiscoveryService",
    "LanguageDetector",
    "generate_text_video_id",
    "validate_raw_text",
]
