"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 INTELLIGENT VIDEO DISCOVERY v3.0 — MISTRAL AI + YT-DLP                         ║
║  Système de recherche intelligent avec reprompting IA et scoring multi-critères    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FEATURES:                                                                         ║
║  • 🧠 Reprompting Mistral AI (reformulation intelligente des requêtes)             ║
║  • 📺 Recherche YouTube via yt-dlp (très fiable, pas d'API key)                    ║
║  • 📊 Scoring multi-critères: Tournesol, académique, engagement, fraîcheur         ║
║  • 🚫 Pénalité anti-clickbait                                                      ║
║  • 🌍 Recherche multilingue (FR, EN, ES, DE, IT, PT)                               ║
║  • 🎯 Diversification par chaîne                                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import os
import json
import math
import asyncio
import subprocess
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import Counter
import logging

import httpx

try:
    from core.config import MISTRAL_INTERNAL_MODEL
except ImportError:
    MISTRAL_INTERNAL_MODEL = "ministral-8b-2512"

from core.http_client import shared_http_client

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = MISTRAL_INTERNAL_MODEL

# Patterns clickbait à pénaliser
CLICKBAIT_PATTERNS = [
    r"^[A-Z\s!?]{10,}$",
    r"🚨|⚠️|❌|✅|💥|🔥{2,}|😱|🤯",
    r"(?i)\b(shocking|insane|unbelievable|mind.?blow|crazy|epic fail|you won\'t believe)\b",
    r"(?i)\b(choquant|incroyable|fou|dingue|hallucinant)\b",
    r"\$\d{4,}",
    r"#\d+\s+(will|va)\s+",
    r"(?i)^\[?BREAKING\]?",
]

# Indicateurs académiques
ACADEMIC_INDICATORS = [
    r"(?i)\b(source|étude|study|research|recherche|expert|professor|professeur|phd|dr\.)\b",
    r"(?i)\b(peer.?reviewed|académique|academic|university|université|journal|paper)\b",
    r"(?i)\b(data|données|statistics|statistiques|analysis|analyse|evidence|preuve)\b",
    r"(?i)\b(interview|entretien|conférence|conference|lecture|cours|leçon)\b",
    r"(?i)\b(documentaire|documentary|investigation|enquête)\b",
]

OPTIMAL_DURATIONS = {
    "short": (180, 600),
    "medium": (600, 1800),
    "long": (1800, 5400),
    "default": (300, 3600),
}

# Poids du scoring - RELEVANCE est le plus important !
# 2026-05-20 : rebalance pour rapprocher des résultats YouTube standards.
# Tournesol passe de 0.20 → 0.05 (bonus discret), engagement bumpé.
SCORING_WEIGHTS = {
    "relevance": 0.45,  # ⭐ Priorité aux termes de recherche exacts
    "tournesol": 0.05,  # Bonus discret pour vidéos Tournesol-scorées
    "academic": 0.10,
    "engagement": 0.20,  # YouTube-like : vues/likes pèsent davantage
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
    channel_id: str = ""  # 🔧 Optionnel avec valeur par défaut
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    published_at: datetime = field(default_factory=datetime.now)

    # Scores calculés
    relevance_score: float = 0.0  # ⭐ Score de pertinence (termes exacts)
    tournesol_score: float = 0.0
    academic_score: float = 0.0
    engagement_score: float = 0.0
    freshness_score: float = 0.0
    duration_score: float = 0.0
    clickbait_penalty: float = 0.0
    final_score: float = 0.0

    # Flags spéciaux
    is_tournesol_pick: bool = False  # 🌻 Vidéo recommandée par Tournesol

    def to_dict(self) -> Dict:
        # Convertir le score normalisé en score brut pour l'affichage (-100 à +100)
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
            "tournesol_score": raw_tournesol,  # 🌻 Score brut à la racine pour le frontend
            "quality_score": round(self.final_score),  # Score de qualité global
            "scores": {
                "relevance": round(self.relevance_score, 2),
                "tournesol": round(self.tournesol_score, 2),
                "academic": round(self.academic_score, 2),
                "engagement": round(self.engagement_score, 2),
                "freshness": round(self.freshness_score, 2),
                "duration": round(self.duration_score, 2),
                "clickbait_penalty": round(self.clickbait_penalty, 2),
                "final": round(self.final_score, 2),
            },
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
class DiscoveryResult:
    """Résultat complet d'une recherche"""

    query: str
    reformulated_queries: List[str]
    candidates: List[VideoCandidate]
    total_found: int
    search_time_ms: int
    languages_searched: List[str]

    def to_dict(self) -> Dict:
        return {
            "query": self.query,
            "reformulated_queries": self.reformulated_queries,
            "videos": [c.to_dict() for c in self.candidates],
            "total_found": self.total_found,
            "search_time_ms": self.search_time_ms,
            "languages_searched": self.languages_searched,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 MISTRAL AI REPROMPTING
# ═══════════════════════════════════════════════════════════════════════════════


class MistralReprompt:
    """
    Utilise Mistral AI pour reformuler intelligemment les requêtes de recherche.
    Génère des variantes académiques, multilingues et contextuelles.
    """

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
    async def reformulate(cls, query: str | None, language: str = "fr") -> List[str]:
        """
        Reformule la requête via Mistral AI.
        Retourne la requête originale + variantes générées.
        """
        if not query:
            return []

        queries = [query]  # Toujours inclure l'originale

        if not MISTRAL_API_KEY:
            logger.warning("⚠️ MISTRAL_API_KEY not set, using fallback reformulation")
            return cls._fallback_reformulation(query, language)

        try:
            async with shared_http_client() as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": MISTRAL_MODEL,
                        "messages": [
                            {"role": "system", "content": cls.SYSTEM_PROMPT},
                            {"role": "user", "content": f"Requête utilisateur ({language}): {query}"},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 200,
                        "response_format": {"type": "json_object"},
                    },
                    timeout=8.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)

                    if "queries" in parsed and isinstance(parsed["queries"], list):
                        queries.extend(parsed["queries"][:4])  # Max 4 variantes
                        logger.info(f"🧠 Mistral reformulated '{query}' → {len(queries)} queries")
                else:
                    logger.warning(f"Mistral API error: {response.status_code}")
                    queries = cls._fallback_reformulation(query, language)

        except Exception as e:
            logger.warning(f"Mistral reformulation error (using fallback): {e}")
            queries = cls._fallback_reformulation(query, language)

        return queries[:5]  # Max 5 requêtes totales

    @classmethod
    def _fallback_reformulation(cls, query: str | None, language: str) -> List[str]:
        """Reformulation sans IA (fallback)"""
        if not query:
            return []

        queries = [query]

        # Variantes académiques
        academic_suffixes = {
            "fr": ["analyse", "documentaire", "conférence", "expert"],
            "en": ["analysis", "documentary", "lecture", "expert interview"],
        }

        lang_suffixes = academic_suffixes.get(language, academic_suffixes["en"])

        for suffix in lang_suffixes[:2]:
            queries.append(f"{query} {suffix}")

        # Variante anglaise si français
        if language == "fr":
            queries.append(f"{query} english")

        return queries

    @classmethod
    async def translate_query(cls, query: str | None, from_lang: str, to_lang: str) -> str:
        """
        🌍 Traduit une requête de recherche vers une autre langue.
        Utilise Mistral AI pour une traduction contextuellement appropriée.
        """
        # Guard contre None
        if not query:
            return ""

        if from_lang == to_lang:
            return query

        # Traductions communes sans API
        SIMPLE_TRANSLATIONS = {
            ("fr", "en"): {
                "coronavirus": "coronavirus",
                "covid": "covid",
                "intelligence artificielle": "artificial intelligence",
                "changement climatique": "climate change",
                "réchauffement climatique": "global warming",
                "économie": "economy",
                "politique": "politics",
                "science": "science",
                "santé": "health",
                "éducation": "education",
                "technologie": "technology",
            },
            ("en", "fr"): {
                "coronavirus": "coronavirus",
                "covid": "covid",
                "artificial intelligence": "intelligence artificielle",
                "climate change": "changement climatique",
                "global warming": "réchauffement climatique",
                "economy": "économie",
                "politics": "politique",
                "science": "science",
                "health": "santé",
                "education": "éducation",
                "technology": "technologie",
            },
        }

        # Essayer les traductions simples
        simple_key = (from_lang, to_lang)
        if simple_key in SIMPLE_TRANSLATIONS:
            query_lower = query.lower()
            for src, dst in SIMPLE_TRANSLATIONS[simple_key].items():
                if src in query_lower:
                    return query.lower().replace(src, dst)

        # Utiliser Mistral AI pour les cas complexes
        if not MISTRAL_API_KEY:
            # Fallback: garder la requête originale (YouTube comprend souvent)
            return query

        try:
            lang_names = {"fr": "français", "en": "anglais", "de": "allemand", "es": "espagnol"}

            async with shared_http_client() as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": MISTRAL_MODEL,
                        "messages": [
                            {
                                "role": "system",
                                "content": "Tu es un traducteur. Traduis UNIQUEMENT la requête de recherche, sans ajouter d'explication. Réponds avec la traduction seule.",
                            },
                            {"role": "user", "content": f"Traduis en {lang_names.get(to_lang, to_lang)}: {query}"},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 50,
                    },
                    timeout=5.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    translated = data["choices"][0]["message"]["content"].strip()
                    logger.info(f"🌍 Translated '{query}' ({from_lang}) → '{translated}' ({to_lang})")
                    return translated

        except Exception as e:
            logger.debug(f"Translation error: {e}")

        return query  # Fallback: garder l'original


# ═══════════════════════════════════════════════════════════════════════════════
# 📺 YOUTUBE SEARCH VIA YT-DLP
# ═══════════════════════════════════════════════════════════════════════════════


class YouTubeSearcher:
    """
    Recherche YouTube via yt-dlp (scraping fiable, pas d'API key).
    Beaucoup plus stable que les instances Invidious ou autres librairies.
    """

    @classmethod
    async def search(cls, query: str, max_results: int = 10, language: str = "fr") -> List[Dict]:
        """
        Recherche YouTube via yt-dlp.

        Args:
            query: Requête de recherche
            max_results: Nombre max de résultats (1-20)
            language: Code langue pour le tri régional

        Returns:
            Liste de résultats bruts (dictionnaires)
        """
        results = []

        # 🔒 PUBLIC_DATA_ONLY : la recherche yt-dlp est du scraping → désactivée.
        # La découverte repose alors uniquement sur Tournesol (API publique).
        from core.config import is_public_data_only

        if is_public_data_only():
            logger.info("🔒 PUBLIC_DATA_ONLY: yt-dlp search désactivée (scraping)")
            return results

        max_results = min(max_results, 30)  # yt-dlp limite augmentée

        try:
            # Construire la commande yt-dlp
            search_query = f"ytsearch{max_results}:{query}"

            # 🔌 2026-05-21 : skip le proxy résidentiel Decodo pour `ytsearchN:`.
            # Empiriquement (test depuis container repo-backend-1) :
            #   avec --proxy gate.decodo.com  →  25.5s, 0 résultats
            #   sans --proxy depuis IP Hetzner →   1.5s, 20 résultats
            # Le bot-challenge ne touche que les DOWNLOADS de vidéos (où le
            # proxy reste indispensable dans audio_utils), pas la metadata
            # de recherche `--flat-playlist`.
            from transcripts.audio_utils import _yt_dlp_extra_args

            cmd = [
                "yt-dlp",
                *_yt_dlp_extra_args(include_proxy=False),
                "--dump-json",
                "--flat-playlist",
                "--no-warnings",
                "--geo-bypass",
                search_query,
            ]

            logger.info(f"🔍 yt-dlp search: '{query}' (max={max_results})")

            # Exécuter de façon asynchrone
            loop = asyncio.get_event_loop()

            def run_ytdlp():
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
                    return result.stdout, result.stderr
                except subprocess.TimeoutExpired:
                    logger.warning("yt-dlp timeout after 12s")
                    return "", "timeout"
                except Exception as e:
                    logger.error(f"yt-dlp subprocess error: {e}")
                    return "", str(e)

            stdout, stderr = await loop.run_in_executor(None, run_ytdlp)

            if stderr and "timeout" not in stderr.lower():
                logger.debug(f"yt-dlp stderr: {stderr[:200]}")

            # Parser les résultats JSON (un par ligne)
            if stdout:
                for line in stdout.strip().split("\n"):
                    if line:
                        try:
                            video_data = json.loads(line)
                            if video_data.get("id"):
                                results.append(video_data)
                        except json.JSONDecodeError:
                            continue

            logger.info(f"✅ yt-dlp found {len(results)} videos")

        except Exception as e:
            logger.error(f"YouTube search error: {e}")

        return results

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
                except ValueError:
                    published_at = datetime.now()
            else:
                published_at = datetime.now()

            # Thumbnail
            thumbnails = raw.get("thumbnails", [])
            thumbnail_url = ""
            if thumbnails:
                # Prendre la meilleure qualité
                for t in reversed(thumbnails):
                    if t.get("url"):
                        thumbnail_url = t["url"]
                        break
            if not thumbnail_url:
                thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

            # 🔧 S'assurer que channel_id n'est jamais None
            channel_id = raw.get("channel_id") or raw.get("uploader_id") or raw.get("channel", "") or ""

            return VideoCandidate(
                video_id=video_id,
                title=raw.get("title", "") or "",
                channel=raw.get("channel") or raw.get("uploader") or "Unknown",
                channel_id=channel_id,
                description=(raw.get("description", "") or "")[:1000],
                thumbnail_url=thumbnail_url,
                duration=int(raw.get("duration", 0) or 0),
                view_count=int(raw.get("view_count", 0) or 0),
                like_count=int(raw.get("like_count", 0) or 0),
                published_at=published_at,
            )

        except Exception as e:
            logger.error(f"Error parsing yt-dlp result: {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎵 TIKTOK SEARCH VIA TIKWM
# ═══════════════════════════════════════════════════════════════════════════════


class TikTokSearcher:
    """Recherche TikTok via l'API publique tikwm.com (no API key, no auth).

    Empiriquement (2026-05-21) : depuis l'IP Hetzner sans proxy, le call
    /api/feed/search retourne ~20 vidéos en 1.6s. Le proxy résidentiel
    Decodo bloque cet endpoint — on appelle direct.
    """

    SEARCH_URL = "https://www.tikwm.com/api/feed/search"
    SEARCH_TIMEOUT = 10.0

    @classmethod
    async def search(cls, query: str, max_results: int = 20):
        if not query or not query.strip():
            return []
        try:
            async with shared_http_client() as client:
                response = await client.get(
                    cls.SEARCH_URL,
                    params={
                        "keywords": query,
                        "count": min(max_results, 30),
                        "cursor": 0,
                        "HD": 0,
                    },
                    timeout=cls.SEARCH_TIMEOUT,
                )
            if response.status_code != 200:
                logger.warning(f"tikwm search HTTP {response.status_code}")
                return []
            payload = response.json()
            if payload.get("code") != 0:
                logger.warning(f"tikwm search error: {payload.get('msg')}")
                return []
            raw_videos = payload.get("data", {}).get("videos", []) or []
            logger.info(f"🎵 tikwm found {len(raw_videos)} TikTok videos for '{query}'")
            return [c for c in (cls._parse_video(v) for v in raw_videos) if c is not None]
        except Exception as e:
            logger.error(f"TikTok search error: {e}")
            return []

    @staticmethod
    def _parse_video(raw):
        try:
            video_id = raw.get("video_id") or raw.get("aweme_id") or raw.get("id")
            if not video_id:
                return None
            author = raw.get("author") or {}
            create_time = raw.get("create_time", 0) or 0
            try:
                published_at = datetime.fromtimestamp(int(create_time)) if create_time else datetime.now()
            except (ValueError, OSError, OverflowError):
                published_at = datetime.now()
            title_text = (raw.get("title") or "").strip()
            return VideoCandidate(
                video_id=str(video_id),
                title=title_text[:200] or "TikTok video",
                channel=(author.get("nickname") or author.get("unique_id") or "TikTok").strip(),
                channel_id=str(author.get("unique_id") or ""),
                description=title_text[:500],
                thumbnail_url=raw.get("cover") or raw.get("origin_cover") or "",
                duration=int(raw.get("duration") or 0),
                view_count=int(raw.get("play_count") or 0),
                like_count=int(raw.get("digg_count") or 0),
                comment_count=int(raw.get("comment_count") or 0),
                share_count=int(raw.get("share_count") or 0),
                published_at=published_at,
            )
        except Exception as e:
            logger.error(f"Error parsing tikwm result: {e}")
            return None


def tiktok_engagement_score(c: VideoCandidate, now: Optional[datetime] = None) -> float:
    """Score [0..1] mimicking TikTok's relevance ranking.

    Pondération : vues (log normalisé) + ratios likes/comments/shares + fraîcheur.
    Les ratios pénalisent les vidéos virales en vues mais sans interaction réelle,
    et favorisent les vidéos avec un engagement profond (comments, shares).
    """
    now = now or datetime.now()
    views = max(c.view_count, 0)
    if views == 0:
        return 0.0

    # Vues normalisées en log10 (cap à 1M vues = 1.0)
    view_score = min(math.log10(views + 1) / 6.0, 1.0)

    # Ratios d'engagement (cap à 1.0)
    like_ratio = min((c.like_count / views) * 10, 1.0) if c.like_count else 0.0
    comment_ratio = min((c.comment_count / views) * 100, 1.0) if c.comment_count else 0.0
    share_ratio = min((c.share_count / views) * 50, 1.0) if c.share_count else 0.0

    # Fraîcheur : 1.0 si <7j, decay linéaire jusqu'à 0 à 90j
    age_days = max((now - c.published_at).days, 0) if c.published_at else 90
    if age_days <= 7:
        freshness = 1.0
    elif age_days >= 90:
        freshness = 0.0
    else:
        freshness = 1.0 - (age_days - 7) / 83.0

    return view_score * 0.30 + like_ratio * 0.25 + comment_ratio * 0.20 + share_ratio * 0.15 + freshness * 0.10


# ═══════════════════════════════════════════════════════════════════════════════
# 👽 REDDIT SEARCH VIA OAUTH
# ═══════════════════════════════════════════════════════════════════════════════


REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT = "DeepSight/1.0 (by /u/deepsight)"


class RedditSearcher:
    """Recherche Reddit via OAuth client_credentials (app-only).

    Reddit a fermé l'accès public en 2023. Toute requête doit passer par OAuth.
    Le grant `client_credentials` (alias "installed app") nous donne 60 req/min.

    Setup : créer une app `script` sur reddit.com/prefs/apps, puis exposer
    REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET côté backend.
    """

    OAUTH_URL = "https://www.reddit.com/api/v1/access_token"
    SEARCH_URL = "https://oauth.reddit.com/search"
    SEARCH_TIMEOUT = 10.0

    _token: Optional[str] = None
    _token_expires_at: float = 0.0

    @classmethod
    async def _get_token(cls) -> Optional[str]:
        """Récupère / refresh le bearer token (cache en mémoire, TTL ~50min)."""
        import time as _time

        if cls._token and _time.time() < cls._token_expires_at:
            return cls._token
        if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
            logger.warning("Reddit: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set")
            return None
        try:
            async with shared_http_client() as client:
                resp = await client.post(
                    cls.OAUTH_URL,
                    auth=(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET),
                    data={"grant_type": "client_credentials"},
                    headers={"User-Agent": REDDIT_USER_AGENT},
                    timeout=cls.SEARCH_TIMEOUT,
                )
            if resp.status_code != 200:
                logger.error(f"Reddit token HTTP {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            cls._token = data.get("access_token")
            # TTL 3600s, on cache 3000s pour safety
            cls._token_expires_at = _time.time() + min(int(data.get("expires_in", 3600)) - 600, 3000)
            return cls._token
        except Exception as e:
            logger.error(f"Reddit token error: {e}")
            return None

    @classmethod
    async def search(cls, query: str, max_results: int = 20) -> List[VideoCandidate]:
        if not query or not query.strip():
            return []
        token = await cls._get_token()
        if not token:
            return []
        try:
            async with shared_http_client() as client:
                resp = await client.get(
                    cls.SEARCH_URL,
                    params={
                        "q": query,
                        "type": "link",
                        "limit": min(max_results, 25),
                        "sort": "relevance",
                        "restrict_sr": "false",
                    },
                    headers={
                        "Authorization": f"Bearer {token}",
                        "User-Agent": REDDIT_USER_AGENT,
                    },
                    timeout=cls.SEARCH_TIMEOUT,
                )
            if resp.status_code != 200:
                logger.warning(f"Reddit search HTTP {resp.status_code}")
                return []
            payload = resp.json()
            children = payload.get("data", {}).get("children", []) or []
            logger.info(f"👽 Reddit found {len(children)} posts for '{query}'")
            candidates = [c for c in (cls._parse_post(ch.get("data") or {}) for ch in children) if c is not None]
            return candidates
        except Exception as e:
            logger.error(f"Reddit search error: {e}")
            return []

    @staticmethod
    def _parse_post(raw):
        """Parse un post Reddit en VideoCandidate. Skip si ni image ni vidéo."""
        try:
            post_id = raw.get("id")
            if not post_id:
                return None
            # Skip self-posts (text-only)
            if raw.get("is_self"):
                return None
            thumbnail = raw.get("thumbnail") or ""
            if not thumbnail or thumbnail in ("self", "default", "nsfw", "spoiler", ""):
                # Try preview image
                preview = (raw.get("preview") or {}).get("images") or []
                if preview:
                    src = (preview[0].get("source") or {}).get("url") or ""
                    thumbnail = src.replace("&amp;", "&")
            if not thumbnail:
                return None  # No visual content → skip
            created_utc = raw.get("created_utc", 0) or 0
            try:
                published_at = datetime.fromtimestamp(int(created_utc)) if created_utc else datetime.now()
            except (ValueError, OSError, OverflowError):
                published_at = datetime.now()
            # Duration for Reddit videos
            duration = 0
            media = raw.get("secure_media") or raw.get("media") or {}
            if media:
                reddit_video = media.get("reddit_video") or {}
                duration = int(reddit_video.get("duration") or 0)
            return VideoCandidate(
                video_id=str(post_id),
                title=(raw.get("title") or "")[:200] or "Reddit post",
                channel=f"r/{raw.get('subreddit') or 'reddit'}",
                channel_id=str(raw.get("subreddit") or ""),
                description=(raw.get("selftext") or "")[:500],
                thumbnail_url=thumbnail,
                duration=duration,
                view_count=int(raw.get("score") or 0),  # Reddit n'a pas de view_count → score
                like_count=int(raw.get("ups") or 0),
                published_at=published_at,
            )
        except Exception as e:
            logger.error(f"Error parsing Reddit post: {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUALITY SCORER
# ═══════════════════════════════════════════════════════════════════════════════


class QualityScorer:
    """Calcule les scores de qualité multi-critères"""

    @classmethod
    async def score_candidate(
        cls, candidate: VideoCandidate, query: str, duration_type: str = "default"
    ) -> VideoCandidate:
        """Calcule tous les scores pour un candidat"""

        # ⭐ Score de pertinence (PRIORITAIRE)
        candidate.relevance_score = cls._calculate_relevance_score(candidate, query)

        candidate.academic_score = cls._calculate_academic_score(candidate)
        candidate.engagement_score = cls._calculate_engagement_score(candidate)
        candidate.freshness_score = cls._calculate_freshness_score(candidate)
        candidate.duration_score = cls._calculate_duration_score(candidate, duration_type)
        candidate.clickbait_penalty = cls._calculate_clickbait_penalty(candidate)

        # Score Tournesol (async)
        candidate.tournesol_score = await cls._get_tournesol_score(candidate.video_id)

        # 🌻 AUTO-MARK: Vidéo avec score Tournesol positif = is_tournesol_pick
        # Score normalisé > 0.55 signifie score brut > 10 (clairement positif)
        if candidate.tournesol_score > 0.55:
            candidate.is_tournesol_pick = True
            print(
                f"🌻 [AUTO-PICK] {candidate.video_id} marked as Tournesol pick (score={candidate.tournesol_score:.2f})",
                flush=True,
            )

        # Score final pondéré - RELEVANCE est le plus important !
        candidate.final_score = (
            candidate.relevance_score * SCORING_WEIGHTS["relevance"]
            + candidate.tournesol_score * SCORING_WEIGHTS["tournesol"]
            + candidate.academic_score * SCORING_WEIGHTS["academic"]
            + candidate.engagement_score * SCORING_WEIGHTS["engagement"]
            + candidate.freshness_score * SCORING_WEIGHTS["freshness"]
            + candidate.duration_score * SCORING_WEIGHTS["duration"]
            - candidate.clickbait_penalty * SCORING_WEIGHTS["clickbait_penalty"]
        ) * 100

        return candidate

    @classmethod
    def _calculate_relevance_score(cls, candidate: VideoCandidate, query: str | None) -> float:
        """
        ⭐ Score de pertinence basé sur les termes exacts de la recherche.
        C'est LE critère le plus important pour le classement.
        """
        if not query:
            return 0.5  # Score neutre si pas de query

        query_lower = query.lower()
        title_lower = candidate.title.lower()
        desc_lower = (candidate.description or "").lower()[:500]
        channel_lower = candidate.channel.lower()

        # Extraire les termes de recherche (mots de 2+ caractères)
        query_terms = [t.strip() for t in re.split(r"\s+", query_lower) if len(t.strip()) >= 2]

        if not query_terms:
            return 0.5

        score = 0.0
        total_weight = 0.0

        for term in query_terms:
            term_weight = len(term) / 10  # Poids proportionnel à la longueur du terme
            total_weight += term_weight

            # Chercher le terme et ses synonymes
            terms_to_check = [term] + TERM_SYNONYMS.get(term, [])

            for check_term in terms_to_check:
                # Score par emplacement (titre > description > chaîne)
                if check_term in title_lower:
                    score += term_weight * 1.0  # 100% si dans le titre
                    break
                elif check_term in desc_lower:
                    score += term_weight * 0.5  # 50% si dans la description
                    break
                elif check_term in channel_lower:
                    score += term_weight * 0.3  # 30% si dans le nom de chaîne
                    break

            # Bonus si c'est un nombre (année, date) trouvé exactement
            if term.isdigit() and term in title_lower:
                score += term_weight * 0.5  # Bonus année dans le titre

        if total_weight == 0:
            return 0.5

        # Normaliser entre 0 et 1
        normalized = score / total_weight

        # Bonus si TOUS les termes sont présents dans le titre
        all_in_title = all(any(t in title_lower for t in [term] + TERM_SYNONYMS.get(term, [])) for term in query_terms)
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
        """Score basé sur l'engagement (vues, likes)"""
        if candidate.view_count == 0:
            return 0.0

        # Normaliser les vues (log scale)
        view_score = min(math.log10(candidate.view_count + 1) / 7, 1.0)

        # Ratio likes/vues si disponible
        if candidate.like_count > 0 and candidate.view_count > 0:
            like_ratio = candidate.like_count / candidate.view_count
            like_score = min(like_ratio * 20, 1.0)
            return (view_score + like_score) / 2

        return view_score

    @classmethod
    def _calculate_freshness_score(cls, candidate: VideoCandidate) -> float:
        """Score basé sur la fraîcheur du contenu"""
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
            return duration / optimal_range[0]
        else:
            return max(0, 1 - (duration - optimal_range[1]) / optimal_range[1])

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
    async def _get_tournesol_score(cls, video_id: str) -> float:
        """
        🌻 Récupère le score Tournesol si disponible.
        Retourne un score normalisé entre 0 et 1.
        Score > 0.5 = positif, < 0.5 = négatif
        """
        try:
            async with shared_http_client() as client:
                # Essayer d'abord l'API v2 (plus complète)
                response = await client.get(
                    f"https://api.tournesol.app/polls/videos/entities/yt:{video_id}",
                    headers={"User-Agent": "DeepSight/3.0 (tournesol-integration)"},
                )

                if response.status_code == 200:
                    data = response.json()
                    # Le score Tournesol brut va généralement de -100 à +100
                    raw_score = data.get("tournesol_score", 0)

                    if raw_score is not None and raw_score != 0:
                        # Normaliser: -100 -> 0, 0 -> 0.5, +100 -> 1
                        normalized = (raw_score + 100) / 200
                        print(f"🌻 [TOURNESOL] {video_id}: raw={raw_score}, normalized={normalized:.2f}", flush=True)
                        return max(0.0, min(1.0, normalized))

                # Fallback: essayer l'ancienne API
                response2 = await client.get(f"https://api.tournesol.app/video/{video_id}/")
                if response2.status_code == 200:
                    data2 = response2.json()
                    raw_score = data2.get("tournesol_score", 0)
                    if raw_score is not None and raw_score != 0:
                        normalized = (raw_score + 100) / 200
                        print(
                            f"🌻 [TOURNESOL] {video_id}: raw={raw_score}, normalized={normalized:.2f} (fallback)",
                            flush=True,
                        )
                        return max(0.0, min(1.0, normalized))

        except Exception:
            # Silencieux - beaucoup de vidéos n'ont pas de score Tournesol
            pass

        return 0.5  # Score neutre par défaut (pas de données)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌻 TOURNESOL PROMOTION — Vidéo sponsorisée de qualité
# ═══════════════════════════════════════════════════════════════════════════════


class TournesolPromotion:
    """
    Récupère une vidéo Tournesol en rapport avec le sujet recherché.
    Cette vidéo sera mise en avant pour promouvoir le partenariat Tournesol.
    """

    # Mapping des sujets vers les tags Tournesol
    TOPIC_MAPPING = {
        # Science générale
        "science": ["science"],
        "scientifique": ["science"],
        "scientific": ["science"],
        "découverte": ["science"],
        "discovery": ["science"],
        "recherche": ["science"],
        "research": ["science"],
        "physique": ["science"],
        "physics": ["science"],
        "chimie": ["science"],
        "chemistry": ["science"],
        "biologie": ["science"],
        "biology": ["science"],
        "espace": ["science"],
        "space": ["science"],
        "astronomie": ["science"],
        "astronomy": ["science"],
        "mathématiques": ["science"],
        "mathematics": ["science"],
        # Santé
        "covid": ["health", "science"],
        "coronavirus": ["health", "science"],
        "pandémie": ["health", "science"],
        "pandemic": ["health", "science"],
        "santé": ["health"],
        "health": ["health"],
        "médecine": ["health", "science"],
        "vaccine": ["health", "science"],
        "vaccin": ["health", "science"],
        # Climat & Environnement
        "climat": ["environment", "science"],
        "climate": ["environment", "science"],
        "réchauffement": ["environment"],
        "environnement": ["environment"],
        "écologie": ["environment"],
        "énergie": ["environment", "science"],
        "energy": ["environment", "science"],
        # Technologie
        "ia": ["technology", "science"],
        "ai": ["technology", "science"],
        "intelligence artificielle": ["technology", "science"],
        "technologie": ["technology"],
        "technology": ["technology"],
        "numérique": ["technology"],
        # Politique & Société
        "politique": ["politics", "society"],
        "politics": ["politics", "society"],
        "économie": ["economics", "politics"],
        "economy": ["economics", "politics"],
        "société": ["society"],
        "society": ["society"],
        "démocratie": ["politics", "society"],
        "democracy": ["politics", "society"],
        # Actualité
        "ukraine": ["politics", "news"],
        "guerre": ["politics", "news"],
        "war": ["politics", "news"],
        "gaza": ["politics", "news"],
        "israel": ["politics", "news"],
        "élection": ["politics"],
        "election": ["politics"],
        # Education
        "éducation": ["education"],
        "education": ["education"],
        "histoire": ["education", "society"],
        "history": ["education", "society"],
        "philosophie": ["education", "society"],
        "philosophy": ["education", "society"],
        # Années (toujours science par défaut)
        "2024": ["science", "society"],
        "2025": ["science", "society"],
        "2026": ["science", "society"],
    }

    @classmethod
    async def get_tournesol_pick(cls, query: str, exclude_ids: List[str] = None) -> Optional[VideoCandidate]:
        """
        Récupère LA meilleure vidéo Tournesol en rapport avec la recherche.

        Args:
            query: Requête de recherche
            exclude_ids: IDs de vidéos à exclure (déjà dans les résultats)

        Returns:
            VideoCandidate marqué comme Tournesol pick, ou None
        """
        exclude_ids = exclude_ids or []

        try:
            # Déterminer les tags Tournesol pertinents
            tags = cls._get_relevant_tags(query)
            logger.info(f"🌻 Tournesol tags for '{query}': {tags}")

            async with shared_http_client() as client:
                # Essayer d'abord avec les tags spécifiques
                for search_term in tags[:3]:  # Max 3 search terms
                    video = await cls._search_tournesol(client, search_term, exclude_ids)
                    if video:
                        logger.info(f"🌻 Tournesol pick found for '{search_term}': {video.title[:50]}")
                        return video

                # Fallback: récupérer une vidéo populaire de Tournesol
                logger.info("🌻 Trying Tournesol top recommendations fallback...")
                video = await cls._get_top_tournesol(client, exclude_ids)
                if video:
                    logger.info(f"🌻 Tournesol top pick: {video.title[:50]}")
                    return video

                logger.warning("🌻 No Tournesol video found via API")

        except Exception as e:
            logger.error(f"Tournesol promotion error: {e}")

        return None

    @classmethod
    def _get_relevant_tags(cls, query: str | None) -> List[str]:
        """Détermine les termes de recherche Tournesol pertinents pour la requête"""
        if not query:
            return []

        query_lower = query.lower()
        search_terms = []

        # D'abord, utiliser la requête originale
        search_terms.append(query)

        # Ensuite, extraire les mots-clés principaux
        for keyword, keyword_tags in cls.TOPIC_MAPPING.items():
            if keyword in query_lower:
                # Ajouter le mot-clé lui-même comme terme de recherche
                search_terms.append(keyword)
                # Ajouter aussi les tags associés
                search_terms.extend(keyword_tags)

        # Dédupliquer et limiter
        seen = set()
        unique_terms = []
        for term in search_terms:
            if term.lower() not in seen:
                seen.add(term.lower())
                unique_terms.append(term)

        # Si aucun tag trouvé, utiliser des termes génériques
        if len(unique_terms) <= 1:
            unique_terms.extend(["science", "education"])

        return unique_terms[:5]  # Max 5 termes

    @classmethod
    async def _search_tournesol(
        cls, client: httpx.AsyncClient, search_term: str, exclude_ids: List[str]
    ) -> Optional[VideoCandidate]:
        """
        🌻 Recherche sémantique Tournesol améliorée.
        Utilise le paramètre search de l'API pour un matching sémantique.
        """
        try:
            # ════════════════════════════════════════════════════════════════════
            # 🔍 RECHERCHE SÉMANTIQUE: Utiliser le paramètre search de l'API
            # ════════════════════════════════════════════════════════════════════
            url = "https://api.tournesol.app/polls/videos/recommendations/"
            params = {
                "limit": 50,
                "unsafe": "false",
                "search": search_term,  # 🆕 Recherche sémantique directe
            }

            logger.info(f"🌻 Tournesol semantic search: '{search_term}'")

            response = await client.get(url, params=params)

            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])

                logger.info(f"🌻 Tournesol returned {len(results)} videos for '{search_term}'")

                if not results:
                    # Fallback sans search si aucun résultat
                    logger.info("🌻 No semantic results, trying without search param...")
                    return await cls._search_tournesol_fallback(client, search_term, exclude_ids)

                # ════════════════════════════════════════════════════════════════
                # 🎯 SCORING SÉMANTIQUE: Trouver la meilleure correspondance
                # ════════════════════════════════════════════════════════════════
                search_words = set(search_term.lower().split())
                best_candidate = None
                best_score = -1

                for item in results:
                    video_id = item.get("entity", {}).get("uid", "").replace("yt:", "")

                    if not video_id or video_id in exclude_ids:
                        continue

                    metadata = item.get("entity", {}).get("metadata", {})
                    title = (metadata.get("name", "") or "").lower()
                    description = (metadata.get("description", "") or "").lower()
                    tags = [t.lower() for t in (metadata.get("tags", []) or [])]
                    uploader = (metadata.get("uploader", "") or "").lower()

                    # Calcul du score sémantique
                    semantic_score = 0

                    # Score basé sur le titre (poids le plus élevé)
                    title_words = set(title.split())
                    title_match = len(search_words & title_words)
                    semantic_score += title_match * 10

                    # Bonus si la requête exacte est dans le titre
                    if search_term.lower() in title:
                        semantic_score += 50

                    # Score basé sur la description
                    desc_words = set(description.split())
                    desc_match = len(search_words & desc_words)
                    semantic_score += desc_match * 2

                    # Score basé sur les tags
                    for tag in tags:
                        if any(word in tag for word in search_words):
                            semantic_score += 5

                    # Bonus pour les chaînes de vulgarisation connues
                    quality_channels = [
                        "science4all",
                        "scienceétonnante",
                        "veritasium",
                        "kurzgesagt",
                        "heu?reka",
                        "dirty biology",
                        "le réveilleur",
                        "defakator",
                        "philoxime",
                        "monsieur phi",
                        "astronogeek",
                        "e-penser",
                    ]
                    if any(ch in uploader for ch in quality_channels):
                        semantic_score += 15

                    # Score Tournesol de la vidéo (bonus)
                    tournesol_score = item.get("tournesol_score", 0) or 0
                    if tournesol_score > 50:
                        semantic_score += 10
                    elif tournesol_score > 30:
                        semantic_score += 5

                    logger.debug(f"🌻 '{title[:40]}' → score={semantic_score}")

                    if semantic_score > best_score:
                        best_score = semantic_score
                        best_candidate = (video_id, metadata, item, semantic_score)

                # ════════════════════════════════════════════════════════════════
                # ✅ Retourner le meilleur candidat
                # ════════════════════════════════════════════════════════════════
                if best_candidate:
                    video_id, metadata, item, score = best_candidate

                    logger.info(f"🌻 Best semantic match: '{metadata.get('name', '')[:50]}' (score={score})")

                    return VideoCandidate(
                        video_id=video_id,
                        title=metadata.get("name", "Recommandé par Tournesol"),
                        channel=metadata.get("uploader", "Tournesol"),
                        channel_id="tournesol",
                        description=metadata.get("description", "Vidéo de qualité recommandée par Tournesol")[:500]
                        if metadata.get("description")
                        else "Vidéo de qualité recommandée par Tournesol",
                        thumbnail_url=f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                        duration=metadata.get("duration", 0) or 600,
                        view_count=metadata.get("views", 0) or 10000,
                        like_count=0,
                        published_at=datetime.now(),
                        tournesol_score=1.0,
                        is_tournesol_pick=True,
                    )
            else:
                logger.warning(f"🌻 Tournesol API error: {response.status_code}")

        except Exception as e:
            logger.error(f"🌻 Tournesol search error: {e}")

        return None

    @classmethod
    async def _search_tournesol_fallback(
        cls, client: httpx.AsyncClient, search_term: str, exclude_ids: List[str]
    ) -> Optional[VideoCandidate]:
        """Fallback: recherche sans paramètre search, avec matching manuel"""
        try:
            response = await client.get(
                "https://api.tournesol.app/polls/videos/recommendations/", params={"limit": 100, "unsafe": "false"}
            )

            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])

                search_words = set(search_term.lower().split())

                for item in results:
                    video_id = item.get("entity", {}).get("uid", "").replace("yt:", "")
                    if not video_id or video_id in exclude_ids:
                        continue

                    metadata = item.get("entity", {}).get("metadata", {})
                    title = (metadata.get("name", "") or "").lower()
                    (metadata.get("description", "") or "").lower()

                    # Chercher un match avec au moins 2 mots
                    title_words = set(title.split())
                    if len(search_words & title_words) >= 2 or search_term.lower() in title:
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
                        )

        except Exception as e:
            logger.error(f"🌻 Tournesol fallback error: {e}")

        return None

    @classmethod
    async def _get_top_tournesol(cls, client: httpx.AsyncClient, exclude_ids: List[str]) -> Optional[VideoCandidate]:
        """Récupère une vidéo top de Tournesol (fallback)"""
        try:
            response = await client.get(
                "https://api.tournesol.app/polls/videos/recommendations/",
                params={
                    "limit": 30,
                    "unsafe": "false",
                },
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
                        channel=metadata.get("uploader", ""),
                        channel_id="",
                        description=metadata.get("description", "")[:500] if metadata.get("description") else "",
                        thumbnail_url=f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                        duration=metadata.get("duration", 0) or 0,
                        view_count=metadata.get("views", 0) or 0,
                        like_count=0,
                        published_at=datetime.now(),
                        tournesol_score=1.0,
                        is_tournesol_pick=True,
                    )

        except Exception as e:
            logger.debug(f"Tournesol top fetch error: {e}")

        return None

    @classmethod
    def get_hardcoded_fallback(cls, exclude_ids: List[str] = None) -> Optional[VideoCandidate]:
        """
        🌻 FALLBACK HARDCODÉ - Vidéos Tournesol populaires garanties.
        Utilisé quand l'API est en rate limit ou indisponible.
        """
        exclude_ids = exclude_ids or []

        # Liste de vidéos Tournesol populaires et de qualité
        FALLBACK_VIDEOS = [
            {
                "video_id": "cCKONDOJN8I",  # "Les réseaux de neurones" - Science4All
                "title": "Les réseaux de neurones - Science4All",
                "channel": "Science4All",
                "duration": 1200,
                "view_count": 500000,
            },
            {
                "video_id": "KT4FqX1aQIk",  # "La démocratie est-elle compatible avec l'écologie ?"
                "title": "La démocratie est-elle compatible avec l'écologie ?",
                "channel": "Le Réveilleur",
                "duration": 2400,
                "view_count": 300000,
            },
            {
                "video_id": "Vjkq8V5rVy0",  # "L'IA va-t-elle nous remplacer ?"
                "title": "L'intelligence artificielle va-t-elle nous dépasser ?",
                "channel": "Monsieur Phi",
                "duration": 1800,
                "view_count": 400000,
            },
            {
                "video_id": "0NCbZdU0-i0",  # "Le paradoxe de Fermi"
                "title": "Le paradoxe de Fermi - Où sont les extraterrestres ?",
                "channel": "ScienceEtonnante",
                "duration": 1500,
                "view_count": 2000000,
            },
            {
                "video_id": "JKHUaNAxsTg",  # "Le réchauffement climatique"
                "title": "Comprendre le réchauffement climatique en 4 minutes",
                "channel": "Le Monde",
                "duration": 240,
                "view_count": 1500000,
            },
            {
                "video_id": "MiLmJ5jwS4I",  # "Les biais cognitifs"
                "title": "Les biais cognitifs - Comment notre cerveau nous trompe",
                "channel": "Fouloscopie",
                "duration": 900,
                "view_count": 600000,
            },
        ]

        # Trouver une vidéo non exclue
        for video_data in FALLBACK_VIDEOS:
            if video_data["video_id"] not in exclude_ids:
                print(f"🌻 [FALLBACK] Using hardcoded: {video_data['title'][:40]}", flush=True)
                return VideoCandidate(
                    video_id=video_data["video_id"],
                    title=f"🌻 {video_data['title']}",
                    channel=video_data["channel"],
                    channel_id="tournesol_fallback",
                    description="Vidéo de qualité recommandée par Tournesol - plateforme collaborative d'évaluation de vidéos",
                    thumbnail_url=f"https://i.ytimg.com/vi/{video_data['video_id']}/hqdefault.jpg",
                    duration=video_data["duration"],
                    view_count=video_data["view_count"],
                    like_count=0,
                    published_at=datetime.now(),
                    tournesol_score=1.0,
                    is_tournesol_pick=True,
                )

        # Si toutes sont exclues, prendre la première quand même
        video_data = FALLBACK_VIDEOS[0]
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
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 DISCOVERY ENGINE
# ═══════════════════════════════════════════════════════════════════════════════


class IntelligentDiscovery:
    """
    Moteur de découverte intelligent de vidéos YouTube.
    Combine Mistral AI (reprompting) + yt-dlp (recherche) + scoring multi-critères.
    """

    @classmethod
    async def discover(
        cls,
        query: str,
        max_results: int = 10,
        languages: List[str] = None,
        duration_type: str = "default",
        min_score: float = 0.0,
    ) -> DiscoveryResult:
        """
        Découvre des vidéos pertinentes pour une requête.

        Args:
            query: Requête de recherche utilisateur
            max_results: Nombre max de résultats finaux
            languages: Langues à rechercher (défaut: ["fr", "en"])
            duration_type: Type de durée préféré (short, medium, long, default)
            min_score: Score minimum pour inclure une vidéo

        Returns:
            DiscoveryResult avec les vidéos triées par score
        """
        import time

        start_time = time.time()

        languages = languages or ["fr", "en"]
        primary_lang = languages[0] if languages else "fr"

        logger.info(f"🔍 [DISCOVER] Starting search: '{query}' (langs={languages})")

        # 1. Reformulation via Mistral AI
        reformulated = await MistralReprompt.reformulate(query, primary_lang)
        logger.info(f"🧠 Reformulated queries: {reformulated}")

        # 2. Recherche YouTube pour chaque requête
        all_candidates: Dict[str, VideoCandidate] = {}

        for search_query in reformulated[:3]:  # Max 3 requêtes pour la vitesse
            results = await YouTubeSearcher.search(search_query, max_results=max_results, language=primary_lang)

            for raw in results:
                candidate = YouTubeSearcher.parse_video_result(raw)
                if candidate and candidate.video_id not in all_candidates:
                    all_candidates[candidate.video_id] = candidate

        logger.info(f"📊 Found {len(all_candidates)} unique candidates")

        # 3. Scoring des candidats
        scored_candidates = []

        for candidate in all_candidates.values():
            try:
                scored = await QualityScorer.score_candidate(candidate, query, duration_type)
                if scored.final_score >= min_score:
                    scored_candidates.append(scored)
            except Exception as e:
                logger.error(f"Scoring error for {candidate.video_id}: {e}")

        # 4. Tri par score final et diversification
        scored_candidates.sort(key=lambda x: x.final_score, reverse=True)

        # Diversification: max 2 vidéos par chaîne
        final_candidates = []
        channel_counts: Counter = Counter()

        for candidate in scored_candidates:
            if channel_counts[candidate.channel_id] < 2:
                final_candidates.append(candidate)
                channel_counts[candidate.channel_id] += 1

                if len(final_candidates) >= max_results:
                    break

        # 5. 🌻 Promotion Tournesol discrète : 1 seule vidéo, uniquement si aucune
        # Tournesol n'est déjà présente naturellement. Pas de fallback hardcodé.
        # Le ranking YouTube domine ; Tournesol reste un bonus.
        has_tournesol_naturally = any(c.is_tournesol_pick or c.tournesol_score > 0.55 for c in final_candidates[:10])

        if not has_tournesol_naturally and len(final_candidates) >= 3:
            existing_ids = [c.video_id for c in final_candidates]
            tournesol_pick = await TournesolPromotion.get_tournesol_pick(query, existing_ids)
            if tournesol_pick:
                tournesol_pick.relevance_score = QualityScorer._calculate_relevance_score(tournesol_pick, query)
                tournesol_pick.final_score = 50.0  # Score modeste, pas de promotion artificielle
                tournesol_pick.is_tournesol_pick = True
                insert_position = min(4, len(final_candidates))
                final_candidates.insert(insert_position, tournesol_pick)
                if len(final_candidates) > max_results:
                    final_candidates.pop()
                logger.info(f"🌻 Discreet Tournesol pick added at position {insert_position + 1}")

        elapsed_ms = int((time.time() - start_time) * 1000)

        logger.info(f"✅ [DISCOVER] Found {len(final_candidates)} candidates in {elapsed_ms}ms")

        return DiscoveryResult(
            query=query,
            reformulated_queries=reformulated,
            candidates=final_candidates,
            total_found=len(all_candidates),
            search_time_ms=elapsed_ms,
            languages_searched=languages,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════


async def discover_videos(
    query: str,
    max_results: int = 10,
    languages: List[str] = None,
    duration_type: str = "default",
    min_score: float = 0.0,
) -> Dict:
    """
    Point d'entrée principal pour la découverte de vidéos.

    Usage:
        result = await discover_videos("intelligence artificielle", max_results=10)
        videos = result["videos"]
    """
    result = await IntelligentDiscovery.discover(
        query=query,
        max_results=max_results,
        languages=languages,
        duration_type=duration_type,
        min_score=min_score,
    )
    return result.to_dict()


# Alias pour compatibilité
intelligent_discovery = discover_videos


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 ROUTER COMPATIBILITY LAYER
# ═══════════════════════════════════════════════════════════════════════════════


# DiscoveryResult compatible avec le router existant
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


class IntelligentDiscoveryService:
    """
    Service principal compatible avec le router existant.
    Utilise Mistral AI pour le reprompting + yt-dlp pour la recherche.
    """

    @classmethod
    async def discover(
        cls,
        query: str | None,
        languages: List[str] = None,
        max_results: int = 10,
        min_quality: float = 30.0,
        target_duration: str = "default",
    ) -> DiscoveryResultCompat:
        """
        Découvre les meilleures vidéos pour une requête.
        Compatible avec l'interface existante du router.
        """
        import time

        start_time = time.time()

        # Validation de la requête
        if not query or not query.strip():
            return DiscoveryResultCompat(
                query=query or "",
                reformulated_queries=[],
                candidates=[],
                total_searched=0,
                languages_searched=[],
                search_duration_ms=0,
                tournesol_available=True,
            )

        query = query.strip()

        if languages is None:
            languages = ["fr", "en"]

        primary_lang = languages[0] if languages else "fr"

        logger.info(f"🔍 [DISCOVER] Starting search: '{query}' (langs={languages})")

        # 1. Reformulation via Mistral AI (multilingue) — timeout-protected
        try:
            reformulated = await asyncio.wait_for(
                MistralReprompt.reformulate(query, primary_lang),
                timeout=10.0,
            )
        except asyncio.TimeoutError:
            logger.warning("⏱️ Mistral reformulate timeout — using fallback")
            reformulated = MistralReprompt._fallback_reformulation(query, primary_lang)
        logger.info(f"🧠 Reformulated queries: {reformulated}")

        # 2. 🚀 Préparer les traductions et les recherches en PARALLÈLE
        # Avant: 3 yt-dlp + 2 (translate + yt-dlp) en séquentiel → 5×8s = 40s worst case
        # Après: tout en gather() → ~8s worst case
        other_languages = [l for l in ["en", "fr", "de", "es"] if l not in languages[:1]][:2]

        async def translate_and_search(lang: str) -> List[Dict]:
            """Translate query + run yt-dlp search for a secondary language."""
            try:
                translated = await asyncio.wait_for(
                    MistralReprompt.translate_query(query, primary_lang, lang),
                    timeout=6.0,
                )
            except asyncio.TimeoutError:
                translated = query
            return await YouTubeSearcher.search(translated, max_results=max_results // 2, language=lang)

        # Tâches parallèles : primary lang searches + secondary lang translate+search
        primary_tasks = [
            YouTubeSearcher.search(sq, max_results=max_results, language=primary_lang) for sq in reformulated[:3]
        ]
        secondary_tasks = [translate_and_search(lang) for lang in other_languages]

        all_search_results = await asyncio.gather(*primary_tasks, *secondary_tasks, return_exceptions=True)

        # 3. Aggregate candidates from all parallel searches
        all_candidates: Dict[str, VideoCandidate] = {}
        for results in all_search_results:
            if isinstance(results, Exception):
                logger.warning(f"Search task error (skipped): {results}")
                continue
            for raw in results:
                candidate = YouTubeSearcher.parse_video_result(raw)
                if candidate and candidate.video_id not in all_candidates:
                    all_candidates[candidate.video_id] = candidate

        logger.info(f"📊 Found {len(all_candidates)} unique candidates (multilingual)")

        # 3. Scoring des candidats — parallèle avec semaphore (cap 20 concurrent)
        # Avant : boucle séquentielle 60×~0.3s Tournesol API = ~18s (le bottleneck)
        # Après : asyncio.gather → ~1-2s. Tournesol API tient bien 20 concurrent.
        SCORING_SEM = asyncio.Semaphore(20)

        async def _score_with_sem(cand: VideoCandidate):
            async with SCORING_SEM:
                try:
                    return await QualityScorer.score_candidate(cand, query, target_duration)
                except Exception as e:
                    logger.error(f"Scoring error for {cand.video_id}: {e}")
                    return None

        scoring_results = await asyncio.gather(*(_score_with_sem(c) for c in all_candidates.values()))
        scored_candidates = [s for s in scoring_results if s is not None and s.final_score >= min_quality]

        # 4. Tri par score final et diversification
        scored_candidates.sort(key=lambda x: x.final_score, reverse=True)

        # Diversification: max 2 vidéos par chaîne
        final_candidates = []
        channel_counts: Counter = Counter()

        for candidate in scored_candidates:
            if channel_counts[candidate.channel_id] < 2:
                final_candidates.append(candidate)
                channel_counts[candidate.channel_id] += 1

                if len(final_candidates) >= max_results:
                    break

        # 5. 🌻 Promotion Tournesol discrète : 1 seule vidéo ajoutée UNIQUEMENT si
        # aucune vidéo Tournesol n'est déjà présente naturellement dans les résultats
        # YouTube. Pas de fallback hardcodé — on respecte le ranking YouTube.
        has_tournesol_naturally = any(c.is_tournesol_pick or c.tournesol_score > 0.55 for c in final_candidates[:10])

        if not has_tournesol_naturally and len(final_candidates) >= 3:
            existing_ids = [c.video_id for c in final_candidates]
            logger.info(f"🌻 No Tournesol naturally — fetching 1 discreet pick for: '{query}'")
            tournesol_pick = await TournesolPromotion.get_tournesol_pick(query, existing_ids)

            if tournesol_pick:
                tournesol_pick.relevance_score = QualityScorer._calculate_relevance_score(tournesol_pick, query)
                # Score modeste : pas de 100.0 artificiel, juste mid-pack pour ne pas
                # truster le sommet de la liste
                tournesol_pick.final_score = 50.0

                # Insérer en position 5 (plus discret qu'avant), seulement si on a la place
                insert_position = min(4, len(final_candidates))
                final_candidates.insert(insert_position, tournesol_pick)
                # Cap à max_results : retirer le dernier si on dépasse
                if len(final_candidates) > max_results:
                    final_candidates.pop()
                logger.info(f"🌻 Tournesol pick added at position {insert_position + 1}: {tournesol_pick.title[:50]}")

        duration_ms = int((time.time() - start_time) * 1000)

        logger.info(f"✅ [DISCOVER] Found {len(final_candidates)} candidates in {duration_ms}ms")

        return DiscoveryResultCompat(
            query=query,
            reformulated_queries=reformulated,
            candidates=final_candidates,
            total_searched=len(all_candidates),
            languages_searched=languages,
            search_duration_ms=duration_ms,
            tournesol_available=True,
        )

    @classmethod
    async def discover_single_best(
        cls,
        query: str,
        languages: List[str] = None,
    ) -> Optional[VideoCandidate]:
        """Trouve LA meilleure vidéo pour une requête."""
        result = await cls.discover(
            query=query,
            languages=languages,
            max_results=1,
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
        """Découvre plusieurs vidéos pour créer une playlist."""
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

import hashlib


def generate_text_video_id(text: str) -> str:
    """Génère un ID unique pour une analyse de texte brut"""
    hash_digest = hashlib.md5(text.encode()).hexdigest()
    return f"txt_{hash_digest[:11]}"


def validate_raw_text(text: str) -> Tuple[bool, Optional[str]]:
    """
    Valide le texte brut pour l'analyse.

    Returns:
        (is_valid, error_message)
    """
    if not text or not text.strip():
        return False, "Le texte ne peut pas être vide"

    char_count = len(text)

    if char_count < 100:
        return False, f"Le texte est trop court ({char_count} caractères, minimum 100)"

    if char_count > 500000:
        return False, f"Le texte est trop long ({char_count} caractères, maximum 500,000)"

    # Vérifier que c'est du vrai texte
    word_count = len(text.split())
    if word_count < 20:
        return False, f"Le texte contient trop peu de mots ({word_count}, minimum 20)"

    return True, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎁 EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    "VideoCandidate",
    "DiscoveryResult",
    "DiscoveryResultCompat",
    "MistralReprompt",
    "YouTubeSearcher",
    "QualityScorer",
    "IntelligentDiscovery",
    "IntelligentDiscoveryService",
    "discover_videos",
    "generate_text_video_id",
    "validate_raw_text",
]
