"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 PLAYLIST ROUTER v4.1 — DEEP SIGHT OPTIMIZED EDITION                            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  🧮 Scoring sémantique dynamique pour sélection contextuelle                       ║
║  💾 Cache intelligent LRU avec TTL                                                 ║
║  🔀 Fusion multi-sources Mistral + Perplexity                                      ║
║  🎯 Allocation dynamique de tokens selon pertinence                                ║
║  ⏱️ Extraction et validation automatique des timecodes                             ║
║  🧠 Raisonnement critique adaptatif par mode                                       ║
║  📊 Métriques de confiance et sourçage enrichi                                     ║
║  📹 FIX v4.1: Endpoint video individuel ajouté                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import httpx
import re
import hashlib
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from collections import Counter, OrderedDict
from functools import lru_cache
from dataclasses import dataclass, field
from enum import Enum
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from db.database import (
    get_session, User, Summary, PlaylistAnalysis, PlaylistChatMessage, VideoChunk
)
from auth.dependencies import get_current_user
from core.config import PLAN_LIMITS, get_mistral_key, get_perplexity_key
from videos.analysis import generate_summary, detect_category
from transcripts import (
    extract_video_id, extract_playlist_id,
    get_video_info, get_transcript_with_timestamps,
    get_playlist_videos, get_playlist_info
)

import logging
logger = logging.getLogger("deepsight.playlists")

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class AnalyzePlaylistRequest(BaseModel):
    url: str
    max_videos: int = Field(default=10, ge=1, le=100)
    mode: str = Field(default="standard", description="accessible | standard | expert")
    lang: str = "fr"
    model: Optional[str] = None

class AnalyzeCorpusRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1, max_length=100)
    name: str = Field(default="Mon Corpus")
    mode: str = Field(default="standard", description="accessible | standard | expert")
    lang: str = "fr"
    model: Optional[str] = None

class PlaylistTaskStatus(BaseModel):
    task_id: str
    status: str
    progress: int = 0
    message: str = ""
    current_video: int = 0
    total_videos: int = 0
    result: Optional[Dict[str, Any]] = None

class ChatCorpusRequest(BaseModel):
    message: str
    web_search: bool = False
    mode: str = Field(default="standard", description="accessible | standard | expert")
    lang: str = Field(default="fr", description="Response language: fr | en")

class ChatCorpusResponse(BaseModel):
    response: str
    sources: Optional[List[Dict[str, str]]] = None
    citations: Optional[List[str]] = None
    model_used: str = ""
    tokens_used: int = 0
    relevance_scores: Optional[Dict[str, float]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

_playlist_task_store: Dict[str, Dict[str, Any]] = {}

PLAN_VIDEO_LIMITS = {
    "free": 10,
    "starter": 20,
    "pro": 50,
    "expert": 100,
    "unlimited": 100
}

PLAN_MODELS = {
    "free": "mistral-small-2603",
    "starter": "mistral-small-2603",
    "pro": "mistral-medium-2508",
    "expert": "mistral-large-2512",
    "unlimited": "mistral-large-2512"
}

CHAT_CONFIG = {
    "free": {
        "model": "mistral-small-2603",
        "max_corpus": 40000,
        "max_videos": 10,
        "daily_limit": 10,
        "web_search": False
    },
    "starter": {
        "model": "mistral-small-2603",
        "max_corpus": 60000,
        "max_videos": 15,
        "daily_limit": 40,
        "web_search": False
    },
    "pro": {
        "model": "mistral-large-2512",
        "max_corpus": 450000,   # ~150K tokens Mistral
        "max_videos": 50,
        "daily_limit": 100,
        "web_search": True
    },
    "expert": {
        "model": "mistral-large-2512",
        "max_corpus": 450000,   # ~150K tokens Mistral
        "max_videos": 50,
        "daily_limit": -1,
        "web_search": True
    },
    "unlimited": {
        "model": "mistral-large-2512",
        "max_corpus": 450000,   # ~150K tokens Mistral
        "max_videos": 50,
        "daily_limit": -1,
        "web_search": True
    }
}

MODE_CONFIG = {
    "accessible": {
        "max_tokens": 2000,
        "num_segments": 3,
        "timecode_min": 2,
        "style_fr": "Professeur passionné: concis (2-4 phrases), accessible, curieux mais critique",
        "style_en": "Passionate professor: concise (2-4 sentences), accessible, curious but critical"
    },
    "standard": {
        "max_tokens": 4000,
        "num_segments": 4,
        "timecode_min": 4,
        "style_fr": "Analyste équilibré: complet (5-8 phrases), évalue la crédibilité, distingue fait/opinion",
        "style_en": "Balanced analyst: complete (5-8 sentences), evaluates credibility, distinguishes fact/opinion"
    },
    "expert": {
        "max_tokens": 8000,
        "num_segments": 5,
        "timecode_min": 6,
        "style_fr": "Analyste critique exhaustif: analyse détaillée et sourcée, identifie sophismes et biais, impitoyablement rigoureux",
        "style_en": "Exhaustive critical analyst: detailed source-verified analysis, identifies fallacies and biases, ruthlessly rigorous"
    }
}

VOLATILE_TOPICS = {
    "sport": {
        "keywords": ["joueur", "effectif", "transfert", "équipe", "club", "entraîneur", "coach",
                    "mercato", "classement", "buteur", "titulaire", "blessé", "PSG", "OM", "OL",
                    "player", "roster", "transfer", "team", "manager", "standings", "injured"],
        "disclaimer_fr": "⚠️ **Attention** : Les effectifs sportifs changent fréquemment. Ces informations datent de la vidéo.",
        "disclaimer_en": "⚠️ **Warning**: Sports rosters change frequently. This information is from the video's date."
    },
    "business": {
        "keywords": ["PDG", "CEO", "directeur", "président", "démission", "nomination", "rachat",
                    "fusion", "acquisition", "valorisation", "licenciement",
                    "director", "president", "resignation", "appointment", "buyout", "merger"],
        "disclaimer_fr": "⚠️ **Attention** : Les positions de direction évoluent. Vérifiez les informations actuelles.",
        "disclaimer_en": "⚠️ **Warning**: Leadership positions change. Verify current information."
    },
    "tech": {
        "keywords": ["version", "mise à jour", "beta", "alpha", "sortie", "lancement", "prix",
                    "disponible", "annonce", "roadmap", "update", "release", "launch", "available"],
        "disclaimer_fr": "⚠️ **Attention** : Les informations technologiques évoluent rapidement.",
        "disclaimer_en": "⚠️ **Warning**: Technology information evolves rapidly."
    },
    "politique": {
        "keywords": ["ministre", "président", "gouvernement", "élection", "loi", "décret",
                    "réforme", "vote", "sondage", "candidat",
                    "minister", "government", "election", "law", "reform", "poll", "candidate"],
        "disclaimer_fr": "⚠️ **Attention** : La situation politique peut avoir évolué depuis cette vidéo.",
        "disclaimer_en": "⚠️ **Warning**: The political situation may have evolved since this video."
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 SEMANTIC SCORING ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class SemanticScorer:
    """Moteur de scoring sémantique sans embeddings externes."""
    
    STOPWORDS = frozenset([
        "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "mais",
        "donc", "car", "ni", "que", "qui", "quoi", "dont", "où", "ce", "cette",
        "ces", "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes", "ton",
        "ta", "tes", "notre", "nos", "votre", "vos", "je", "tu", "il", "elle",
        "nous", "vous", "ils", "elles", "on", "se", "ne", "pas", "plus", "très",
        "bien", "tout", "tous", "toute", "toutes", "même", "aussi", "avec",
        "pour", "par", "dans", "sur", "sous", "vers", "chez", "entre", "sans",
        "est", "sont", "été", "être", "avoir", "fait", "faire", "peut", "dit",
        "comme", "quand", "alors", "encore", "déjà", "toujours", "jamais",
        "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "must", "shall", "can",
        "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into",
        "about", "like", "through", "after", "over", "between", "out", "against",
        "during", "before", "under", "around", "among", "this", "that", "these",
        "those", "it", "its", "they", "them", "their", "what", "which", "who",
        "how", "when", "where", "why", "all", "each", "every", "both", "few",
        "more", "most", "other", "some", "such", "no", "not", "only", "own",
        "same", "so", "than", "too", "very", "just", "also", "now"
    ])
    
    CATEGORY_KEYWORDS = {
        "science": ["recherche", "étude", "découverte", "théorie", "expérience", "données", 
                   "analyse", "scientifique", "chercheur", "laboratoire", "hypothèse"],
        "technology": ["algorithme", "code", "système", "logiciel", "ia", "intelligence", 
                      "artificielle", "développement", "application", "programme", "tech"],
        "history": ["histoire", "époque", "siècle", "événement", "guerre", "civilisation", 
                   "passé", "historique", "roi", "empire", "révolution"],
        "philosophy": ["philosophie", "pensée", "concept", "éthique", "morale", "existence", 
                      "sens", "conscience", "liberté", "vérité"],
        "economy": ["économie", "marché", "finance", "investissement", "croissance", 
                   "entreprise", "commerce", "banque", "argent", "capital"],
        "health": ["santé", "médecine", "maladie", "traitement", "corps", "cerveau", 
                  "mental", "nutrition", "sport", "bien-être"],
        "society": ["société", "politique", "social", "culture", "population", 
                   "gouvernement", "citoyen", "communauté", "droit"]
    }
    
    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        if not text:
            return []
        text = text.lower()
        text = re.sub(r'[àâä]', 'a', text)
        text = re.sub(r'[éèêë]', 'e', text)
        text = re.sub(r'[îï]', 'i', text)
        text = re.sub(r'[ôö]', 'o', text)
        text = re.sub(r'[ùûü]', 'u', text)
        text = re.sub(r'[ç]', 'c', text)
        text = re.sub(r'[^\w\s]', ' ', text)
        tokens = text.split()
        return [t for t in tokens if t not in cls.STOPWORDS and len(t) > 2]
    
    @classmethod
    def compute_tf(cls, tokens: List[str]) -> Dict[str, float]:
        if not tokens:
            return {}
        freq = Counter(tokens)
        max_freq = max(freq.values())
        return {t: f / max_freq for t, f in freq.items()}
    
    @classmethod
    def jaccard_similarity(cls, set1: set, set2: set) -> float:
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
    
    @classmethod
    def get_category_boost(cls, query_tokens: set, category: str) -> float:
        if not category:
            return 1.0
        category_kw = cls.CATEGORY_KEYWORDS.get(category.lower(), [])
        if not category_kw:
            return 1.0
        matches = len(query_tokens & set(category_kw))
        return 1.0 + (matches * 0.12)
    
    @classmethod
    def extract_key_concepts(cls, text: str, top_n: int = 10) -> List[str]:
        tokens = cls.tokenize(text)
        if not tokens:
            return []
        freq = Counter(tokens)
        total = len(tokens)
        concepts = [
            word for word, count in freq.most_common(top_n * 2)
            if count / total < 0.5 and len(word) > 3
        ]
        return concepts[:top_n]
    
    @classmethod
    def score_video(cls, query: str, video: Dict) -> Tuple[float, List[str]]:
        query_tokens = set(cls.tokenize(query))
        if not query_tokens:
            return 0.0, []
        
        title = video.get("video_title", "") or video.get("title", "")
        summary = video.get("summary_content", "") or ""
        transcript = video.get("transcript_context", "") or ""
        category = video.get("category", "")
        
        title_tokens = set(cls.tokenize(title))
        summary_tokens = set(cls.tokenize(summary[:3000]))
        transcript_tokens = set(cls.tokenize(transcript[:2000]))
        
        title_score = cls.jaccard_similarity(query_tokens, title_tokens) * 2.5
        summary_score = cls.jaccard_similarity(query_tokens, summary_tokens) * 1.2
        transcript_score = cls.jaccard_similarity(query_tokens, transcript_tokens)
        
        all_video_tokens = list(title_tokens) + list(summary_tokens)
        video_tf = cls.compute_tf(all_video_tokens)
        query_tf = cls.compute_tf(list(query_tokens))
        tf_overlap = sum(query_tf.get(t, 0) * video_tf.get(t, 0) for t in query_tokens)
        
        cat_boost = cls.get_category_boost(query_tokens, category)
        
        raw_score = (
            title_score * 0.30 +
            summary_score * 0.35 +
            transcript_score * 0.15 +
            tf_overlap * 0.20
        )
        
        final_score = min(raw_score * cat_boost, 1.0)
        all_video_terms = title_tokens | summary_tokens
        matched = list(query_tokens & all_video_terms)
        
        return final_score, matched


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 CACHE INTELLIGENT — LRU avec TTL
# ═══════════════════════════════════════════════════════════════════════════════

class TTLCache:
    """Cache LRU avec expiration temporelle."""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, Tuple[Any, datetime]] = OrderedDict()
    
    def _make_key(self, *args, **kwargs) -> str:
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        return hashlib.md5(key_data.encode()).hexdigest()[:16]
    
    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        value, timestamp = self._cache[key]
        if datetime.now() - timestamp > timedelta(seconds=self.ttl_seconds):
            del self._cache[key]
            return None
        self._cache.move_to_end(key)
        return value
    
    def set(self, key: str, value: Any):
        if key in self._cache:
            del self._cache[key]
        elif len(self._cache) >= self.max_size:
            self._cache.popitem(last=False)
        self._cache[key] = (value, datetime.now())
    
    def clear(self):
        self._cache.clear()


_chat_cache = TTLCache(max_size=200, ttl_seconds=1800)
_perplexity_cache = TTLCache(max_size=50, ttl_seconds=3600)


# ═══════════════════════════════════════════════════════════════════════════════
# ⏱️ TIMECODE EXTRACTOR
# ═══════════════════════════════════════════════════════════════════════════════

class TimecodeExtractor:
    """Extrait et valide les timecodes des transcriptions."""
    
    PATTERN = re.compile(r'[\[\(]?(\d{1,2}):(\d{2})(?::(\d{2}))?[\]\)]?')
    
    @classmethod
    def extract_all(cls, text: str) -> List[Dict[str, Any]]:
        if not text:
            return []
        
        timecodes = []
        for match in cls.PATTERN.finditer(text):
            h, m, s = 0, int(match.group(1)), int(match.group(2))
            if match.group(3):
                h, m, s = int(match.group(1)), int(match.group(2)), int(match.group(3))
            
            total_seconds = h * 3600 + m * 60 + s
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            context = text[start:end].strip()
            
            if h > 0:
                tc_str = f"{h}:{m:02d}:{s:02d}"
            else:
                tc_str = f"{m}:{s:02d}"
            
            timecodes.append({
                "timecode": tc_str,
                "seconds": total_seconds,
                "context": context,
                "position": match.start()
            })
        
        return timecodes
    
    @classmethod
    def find_relevant_timecodes(cls, transcript: str, query: str, max_timecodes: int = 5) -> List[Dict[str, Any]]:
        all_timecodes = cls.extract_all(transcript)
        if not all_timecodes:
            return []
        
        query_tokens = set(SemanticScorer.tokenize(query))
        if not query_tokens:
            return all_timecodes[:max_timecodes]
        
        scored = []
        for tc in all_timecodes:
            context_tokens = set(SemanticScorer.tokenize(tc["context"]))
            score = SemanticScorer.jaccard_similarity(query_tokens, context_tokens)
            scored.append((score, tc))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        return [tc for score, tc in scored[:max_timecodes] if score > 0.05]
    
    @classmethod
    def format_for_response(cls, timecodes: List[Dict], video_id: str = "") -> str:
        if not timecodes:
            return ""
        
        lines = ["**⏱️ Passages pertinents:**"]
        for tc in timecodes[:5]:
            if video_id:
                url = f"https://youtube.com/watch?v={video_id}&t={tc['seconds']}"
                lines.append(f"- [{tc['timecode']}]({url})")
            else:
                lines.append(f"- {tc['timecode']}")
        
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 ENDPOINTS — Analyse playlist et corpus
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze", response_model=PlaylistTaskStatus)
async def analyze_playlist(
    request: AnalyzePlaylistRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Lance l'analyse d'une playlist YouTube."""
    print(f"\n{'='*60}", flush=True)
    print(f"📚 PLAYLIST ANALYSIS REQUEST", flush=True)
    print(f"   URL: {request.url}", flush=True)
    print(f"   Mode: {request.mode}", flush=True)
    print(f"   User: {current_user.email}", flush=True)
    
    playlist_id = extract_playlist_id(request.url)
    if not playlist_id:
        raise HTTPException(status_code=400, detail="URL de playlist invalide")
    
    plan = current_user.plan or "free"
    max_allowed = PLAN_VIDEO_LIMITS.get(plan, 10)
    max_videos = min(request.max_videos, max_allowed)
    
    if current_user.credits < max_videos:
        raise HTTPException(
            status_code=403,
            detail=f"Crédits insuffisants ({current_user.credits} disponibles, {max_videos} requis)"
        )
    
    task_id = str(uuid4())
    model = request.model or PLAN_MODELS.get(plan, "mistral-small-2603")
    
    _playlist_task_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Initialisation...",
        "current_video": 0,
        "total_videos": 0,
        "result": None
    }
    
    background_tasks.add_task(
        _analyze_playlist_background,
        task_id=task_id,
        playlist_id=playlist_id,
        url=request.url,
        max_videos=max_videos,
        mode=request.mode,
        lang=request.lang,
        model=model,
        user_id=current_user.id,
        user_plan=plan
    )
    
    return PlaylistTaskStatus(
        task_id=task_id,
        status="pending",
        message="Analyse lancée"
    )


@router.get("/task/{task_id}", response_model=PlaylistTaskStatus)
async def get_task_status(task_id: str):
    """Récupère le statut d'une tâche d'analyse."""
    task = _playlist_task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")
    
    return PlaylistTaskStatus(
        task_id=task_id,
        status=task["status"],
        progress=task.get("progress", 0),
        message=task.get("message", ""),
        current_video=task.get("current_video", 0),
        total_videos=task.get("total_videos", 0),
        result=task.get("result")
    )


@router.post("/corpus/analyze", response_model=PlaylistTaskStatus)
@router.post("/analyze-corpus", response_model=PlaylistTaskStatus, include_in_schema=False)
async def analyze_corpus(
    request: AnalyzeCorpusRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Analyse un corpus personnalisé de vidéos.

    Note: `/analyze-corpus` is an alias for mobile compatibility.
    Preferred path is `/corpus/analyze`.
    """
    print(f"\n{'='*60}", flush=True)
    print(f"📦 CORPUS ANALYSIS REQUEST", flush=True)
    print(f"   Name: {request.name}", flush=True)
    print(f"   Videos: {len(request.urls)}", flush=True)
    
    plan = current_user.plan or "free"
    max_allowed = PLAN_VIDEO_LIMITS.get(plan, 10)
    
    if len(request.urls) > max_allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Maximum {max_allowed} vidéos pour le plan {plan}"
        )
    
    if current_user.credits < len(request.urls):
        raise HTTPException(
            status_code=403,
            detail=f"Crédits insuffisants ({current_user.credits} disponibles)"
        )
    
    task_id = str(uuid4())
    model = request.model or PLAN_MODELS.get(plan, "mistral-small-2603")
    
    _playlist_task_store[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Initialisation du corpus...",
        "current_video": 0,
        "total_videos": len(request.urls),
        "result": None
    }
    
    background_tasks.add_task(
        _analyze_corpus_background,
        task_id=task_id,
        urls=request.urls,
        corpus_name=request.name,
        mode=request.mode,
        lang=request.lang,
        model=model,
        user_id=current_user.id,
        user_plan=plan
    )
    
    return PlaylistTaskStatus(
        task_id=task_id,
        status="pending",
        message="Analyse du corpus lancée"
    )


@router.get("", response_model=List[Dict])
async def list_playlists(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Liste les playlists de l'utilisateur avec thumbnail et meta-analysis."""
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
    )
    playlists = result.scalars().all()

    # Récupérer les thumbnails des vidéos associées à chaque playlist
    playlist_ids = [p.playlist_id for p in playlists]
    thumbnail_map: dict[str, str] = {}

    if playlist_ids:
        # Chercher le premier thumbnail et video_id pour chaque playlist_id
        thumb_result = await session.execute(
            select(Summary.playlist_id, Summary.thumbnail_url, Summary.video_id)
            .where(
                Summary.playlist_id.in_(playlist_ids),
            )
            .order_by(Summary.playlist_id, Summary.id)
        )
        rows = thumb_result.all()
        for pid, thumb_url, vid_id in rows:
            if pid and pid not in thumbnail_map:
                # Priorité 1: URL HTTP existante
                if thumb_url and thumb_url.startswith("http"):
                    thumbnail_map[pid] = thumb_url
                # Priorité 2: Générer depuis le video_id YouTube
                elif vid_id and len(vid_id) == 11:
                    thumbnail_map[pid] = f"https://img.youtube.com/vi/{vid_id}/mqdefault.jpg"

    return [
        {
            "id": p.id,
            "playlist_id": p.playlist_id,
            "playlist_title": p.playlist_title,
            "playlist_url": p.playlist_url,
            "num_videos": p.num_videos,
            "num_processed": p.num_processed,
            "total_duration": p.total_duration,
            "total_words": p.total_words,
            "status": p.status,
            "has_meta_analysis": bool(p.meta_analysis),
            "thumbnail_url": thumbnail_map.get(p.playlist_id),
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "completed_at": p.completed_at.isoformat() if p.completed_at else None
        }
        for p in playlists
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 CRUD PLAYLISTS — Créer et modifier des playlists manuellement
# ═══════════════════════════════════════════════════════════════════════════════

class CreatePlaylistRequest(BaseModel):
    """Requête pour créer une playlist manuellement"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    video_ids: Optional[List[int]] = None  # IDs de summaries existants à ajouter


class UpdatePlaylistRequest(BaseModel):
    """Requête pour mettre à jour une playlist"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    add_video_ids: Optional[List[int]] = None
    remove_video_ids: Optional[List[int]] = None


@router.post("", response_model=Dict)
async def create_playlist(
    request: CreatePlaylistRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 Crée une nouvelle playlist/corpus manuellement.

    Permet de regrouper des vidéos déjà analysées dans une collection personnalisée.
    """
    # Vérifier les permissions du plan
    plan = current_user.plan or "free"
    plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    if not plan_limits.get("can_use_playlists", False):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "plan_required",
                "message": "Les playlists nécessitent un plan Starter ou supérieur",
                "upgrade_url": "/upgrade"
            }
        )

    # Générer un ID unique pour la playlist
    playlist_id = f"custom_{uuid4().hex[:12]}"

    # Créer la playlist
    playlist = PlaylistAnalysis(
        user_id=current_user.id,
        playlist_id=playlist_id,
        playlist_title=request.name,
        playlist_url=None,  # Playlist manuelle, pas d'URL YouTube
        num_videos=0,
        status="created",
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow()
    )
    session.add(playlist)
    await session.flush()  # Pour obtenir l'ID

    # Ajouter des vidéos existantes si spécifiées
    videos_added = 0
    if request.video_ids:
        for position, summary_id in enumerate(request.video_ids, 1):
            # Vérifier que le summary appartient à l'utilisateur
            summary_result = await session.execute(
                select(Summary)
                .where(Summary.id == summary_id)
                .where(Summary.user_id == current_user.id)
            )
            summary = summary_result.scalar_one_or_none()

            if summary:
                # Mettre à jour le summary pour l'associer à cette playlist
                summary.playlist_id = playlist_id
                summary.playlist_position = position
                videos_added += 1

        playlist.num_videos = videos_added
        playlist.num_processed = videos_added

    await session.commit()

    print(f"📚 Created playlist '{request.name}' with {videos_added} videos for user {current_user.id}", flush=True)

    return {
        "id": playlist.id,
        "playlist_id": playlist_id,
        "playlist_title": request.name,
        "num_videos": videos_added,
        "status": "created",
        "created_at": playlist.started_at.isoformat()
    }


@router.put("/{playlist_id}")
async def update_playlist(
    playlist_id: str,
    request: UpdatePlaylistRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    🆕 Met à jour une playlist existante.

    Permet de:
    - Renommer la playlist
    - Ajouter des vidéos
    - Retirer des vidéos
    """
    # Récupérer la playlist
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
        .limit(1)
    )
    playlist = result.scalar_one_or_none()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist non trouvée")

    # Mettre à jour le nom si fourni
    if request.name is not None:
        playlist.playlist_title = request.name

    # Ajouter des vidéos
    if request.add_video_ids:
        # Récupérer la position max actuelle
        max_pos_result = await session.execute(
            select(func.max(Summary.playlist_position))
            .where(Summary.playlist_id == playlist_id)
        )
        max_pos = max_pos_result.scalar() or 0

        for summary_id in request.add_video_ids:
            summary_result = await session.execute(
                select(Summary)
                .where(Summary.id == summary_id)
                .where(Summary.user_id == current_user.id)
            )
            summary = summary_result.scalar_one_or_none()

            if summary and summary.playlist_id != playlist_id:
                max_pos += 1
                summary.playlist_id = playlist_id
                summary.playlist_position = max_pos

    # Retirer des vidéos
    if request.remove_video_ids:
        for summary_id in request.remove_video_ids:
            summary_result = await session.execute(
                select(Summary)
                .where(Summary.id == summary_id)
                .where(Summary.playlist_id == playlist_id)
            )
            summary = summary_result.scalar_one_or_none()

            if summary:
                summary.playlist_id = None
                summary.playlist_position = None

    # Recalculer le nombre de vidéos
    count_result = await session.execute(
        select(func.count(Summary.id))
        .where(Summary.playlist_id == playlist_id)
    )
    playlist.num_videos = count_result.scalar() or 0
    playlist.num_processed = playlist.num_videos

    await session.commit()

    print(f"📚 Updated playlist '{playlist.playlist_title}' (now {playlist.num_videos} videos)", flush=True)

    return {
        "id": playlist.id,
        "playlist_id": playlist_id,
        "playlist_title": playlist.playlist_title,
        "num_videos": playlist.num_videos,
        "status": playlist.status,
        "updated": True
    }


@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Récupère une playlist avec ses vidéos."""
    # FIX v4.1: Prendre la plus récente si plusieurs analyses existent
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
        .limit(1)
    )
    playlist = result.scalar_one_or_none()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist non trouvée")
    
    # Récupérer les vidéos
    videos_result = await session.execute(
        select(Summary)
        .where(Summary.playlist_id == playlist_id)
        .where(Summary.user_id == current_user.id)
        .order_by(Summary.playlist_position)
    )
    videos = videos_result.scalars().all()
    
    return {
        "id": playlist.id,
        "playlist_id": playlist.playlist_id,
        "playlist_title": playlist.playlist_title,
        "playlist_url": playlist.playlist_url,
        "num_videos": playlist.num_videos,
        "num_processed": playlist.num_processed,
        "total_duration": playlist.total_duration,
        "total_words": playlist.total_words,
        "meta_analysis": playlist.meta_analysis,
        "status": playlist.status,
        "created_at": playlist.created_at.isoformat() if playlist.created_at else None,
        "videos": [
            {
                "id": v.id,
                "video_id": v.video_id,
                "video_title": v.video_title,
                "video_channel": v.video_channel,
                "video_duration": v.video_duration,
                "video_url": v.video_url,
                "thumbnail_url": v.thumbnail_url,
                "category": v.category,
                "summary_content": v.summary_content,
                "transcript_context": v.transcript_context,
                "word_count": v.word_count,
                "position": v.playlist_position
            }
            for v in videos
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 PLAYLIST DETAILS — Statistiques détaillées (P1 mobile compatibility)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{playlist_id}/details")
async def get_playlist_details(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère les détails et statistiques d'une playlist.

    Mobile-compatible endpoint providing detailed analytics.
    """
    # Récupérer la playlist
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
        .limit(1)
    )
    playlist = result.scalar_one_or_none()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist non trouvée")

    # Récupérer les vidéos pour les statistiques
    videos_result = await session.execute(
        select(Summary)
        .where(Summary.playlist_id == playlist_id)
        .where(Summary.user_id == current_user.id)
        .order_by(Summary.playlist_position)
    )
    videos = videos_result.scalars().all()

    # Calculer les statistiques
    categories = {}
    channels = {}
    total_duration = 0
    total_words = 0

    for v in videos:
        # Catégories
        cat = v.category or "Autre"
        categories[cat] = categories.get(cat, 0) + 1

        # Chaînes
        ch = v.video_channel or "Inconnu"
        channels[ch] = channels.get(ch, 0) + 1

        # Totaux
        total_duration += v.video_duration or 0
        total_words += v.word_count or 0

    # Formater la durée
    hours = total_duration // 3600
    minutes = (total_duration % 3600) // 60
    duration_str = f"{hours}h {minutes}min" if hours > 0 else f"{minutes} min"

    return {
        "id": playlist.id,
        "playlist_id": playlist_id,
        "playlist_title": playlist.playlist_title,
        "playlist_url": playlist.playlist_url,
        "status": playlist.status,
        "created_at": playlist.created_at.isoformat() if playlist.created_at else None,
        "completed_at": playlist.completed_at.isoformat() if playlist.completed_at else None,
        "statistics": {
            "num_videos": len(videos),
            "num_processed": playlist.num_processed or len(videos),
            "total_duration": total_duration,
            "total_duration_formatted": duration_str,
            "total_words": total_words,
            "average_duration": total_duration // len(videos) if videos else 0,
            "average_words": total_words // len(videos) if videos else 0
        },
        "categories": categories,
        "channels": channels,
        "has_meta_analysis": bool(playlist.meta_analysis),
        "videos_summary": [
            {
                "id": v.id,
                "title": v.video_title,
                "channel": v.video_channel,
                "duration": v.video_duration,
                "category": v.category,
                "position": v.playlist_position
            }
            for v in videos
        ]
    }


@router.post("/{playlist_id}/corpus-summary")
async def generate_corpus_summary(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Génère ou régénère la méta-analyse (corpus summary) d'une playlist.

    Utile si la méta-analyse initiale a échoué ou pour la mettre à jour.
    """
    # Récupérer la playlist
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
        .limit(1)
    )
    playlist = result.scalar_one_or_none()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist non trouvée")

    # Vérifier les crédits (1 crédit pour régénérer)
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits insuffisants")

    # Récupérer les vidéos
    videos_result = await session.execute(
        select(Summary)
        .where(Summary.playlist_id == playlist_id)
        .where(Summary.user_id == current_user.id)
        .order_by(Summary.playlist_position)
    )
    videos = videos_result.scalars().all()

    if not videos:
        raise HTTPException(status_code=400, detail="Aucune vidéo dans cette playlist")

    # Préparer les données pour la méta-analyse
    summaries = []
    for v in videos:
        summaries.append({
            "position": v.playlist_position or 0,
            "title": v.video_title or "Sans titre",
            "channel": v.video_channel or "Inconnu",
            "summary": (v.summary_content or "")[:2000],
            "category": v.category or "Autre",
            "duration": v.video_duration or 0,
            "word_count": v.word_count or 0
        })

    # Générer la méta-analyse
    plan = current_user.plan or "free"
    model = PLAN_MODELS.get(plan, "mistral-small-2603")
    lang = videos[0].lang if videos else "fr"

    meta_analysis = await _generate_meta_analysis_v4(
        summaries=summaries,
        playlist_title=playlist.playlist_title or "Corpus",
        lang=lang,
        model=model
    )

    # Mettre à jour la playlist
    playlist.meta_analysis = meta_analysis

    # Déduire 1 crédit
    current_user.credits -= 1

    await session.commit()

    return {
        "success": True,
        "playlist_id": playlist_id,
        "meta_analysis": meta_analysis,
        "credits_remaining": current_user.credits
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📹 GET VIDEO SUMMARY — Récupère le résumé d'une vidéo du corpus (FIX v4.1)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{playlist_id}/video/{summary_id}")
async def get_video_summary(
    playlist_id: str,
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Récupère le résumé complet d'une vidéo spécifique dans une playlist.
    
    FIX v4.1: Cet endpoint était manquant et causait des erreurs 404
    quand l'utilisateur cliquait sur "Résumé Vidéo".
    """
    print(f"📹 GET VIDEO SUMMARY: playlist={playlist_id}, summary={summary_id}", flush=True)
    
    # Vérifier que la playlist appartient à l'utilisateur
    playlist_result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
        .limit(1)
    )
    playlist = playlist_result.scalar_one_or_none()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist non trouvée")
    
    # Récupérer le résumé de la vidéo
    video_result = await session.execute(
        select(Summary)
        .where(Summary.id == summary_id)
        .where(Summary.playlist_id == playlist_id)
        .where(Summary.user_id == current_user.id)
    )
    video = video_result.scalar_one_or_none()
    
    if not video:
        raise HTTPException(status_code=404, detail="Vidéo non trouvée dans ce corpus")
    
    print(f"   ✅ Found: {video.video_title[:50]}...", flush=True)
    
    return {
        "id": video.id,
        "video_id": video.video_id,
        "video_title": video.video_title,
        "video_channel": video.video_channel,
        "video_duration": video.video_duration,
        "video_url": video.video_url,
        "thumbnail_url": video.thumbnail_url,
        "category": video.category,
        "mode": video.mode,
        "lang": video.lang,
        "summary_content": video.summary_content,
        "transcript_context": video.transcript_context,
        "word_count": video.word_count,
        "reliability_score": video.reliability_score,
        "position": video.playlist_position,
        "created_at": video.created_at.isoformat() if video.created_at else None,
        "playlist_id": video.playlist_id,
        "playlist_title": playlist.playlist_title
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 CHAT CORPUS — Endpoint principal avec scoring sémantique
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{playlist_id}/chat", response_model=ChatCorpusResponse)
async def chat_with_corpus(
    playlist_id: str,
    request: ChatCorpusRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Chat IA avec le corpus complet.
    
    Features v4.0:
    - Scoring sémantique pour sélection contextuelle des vidéos
    - Allocation dynamique de tokens selon pertinence
    - Cache intelligent des réponses
    - Fusion Mistral + Perplexity
    """
    print(f"\n{'='*60}", flush=True)
    print(f"💬 CORPUS CHAT v4.0", flush=True)
    print(f"   Playlist: {playlist_id}", flush=True)
    print(f"   Question: {request.message[:80]}...", flush=True)
    print(f"   Mode: {request.mode} | Web: {request.web_search}", flush=True)

    try:
        return await _execute_corpus_chat(playlist_id, request, current_user, session)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"   ❌ CORPUS CHAT CRASH: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erreur interne du chat corpus: {type(e).__name__}: {str(e)[:200]}"
        )


async def _execute_corpus_chat(
    playlist_id: str,
    request: ChatCorpusRequest,
    current_user: User,
    session: AsyncSession
) -> ChatCorpusResponse:
    """Logique interne du chat corpus, encapsulée pour gestion d'erreur."""
    import time as _time
    _t0 = _time.time()
    print(f"   ⏱️ [STEP 0] Starting corpus chat...", flush=True)

    # FIX v4.1: Prendre la plus récente si plusieurs analyses existent
    result = await session.execute(
        select(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
        .order_by(PlaylistAnalysis.created_at.desc())
        .limit(1)
    )
    playlist = result.scalar_one_or_none()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist non trouvée")
    print(f"   ⏱️ [STEP 1] Playlist loaded ({_time.time()-_t0:.2f}s)", flush=True)

    plan = current_user.plan or "free"
    chat_config = CHAT_CONFIG.get(plan, CHAT_CONFIG["free"])
    mode_config = MODE_CONFIG.get(request.mode, MODE_CONFIG["standard"])
    
    web_search_enabled = request.web_search and chat_config["web_search"]
    
    videos_result = await session.execute(
        select(Summary)
        .where(Summary.playlist_id == playlist_id)
        .where(Summary.user_id == current_user.id)
        .order_by(Summary.playlist_position)
    )
    videos = videos_result.scalars().all()
    
    if not videos:
        raise HTTPException(status_code=404, detail="Aucune vidéo dans ce corpus")
    print(f"   ⏱️ [STEP 2] {len(videos)} videos loaded ({_time.time()-_t0:.2f}s)", flush=True)

    videos_data = [
        {
            "id": v.id,  # FIX: nécessaire pour _build_hierarchical_context
            "position": v.playlist_position,
            "video_id": v.video_id,
            "video_title": v.video_title,
            "video_channel": v.video_channel,
            "category": v.category,
            "summary_content": v.summary_content,
            "transcript_context": v.transcript_context,
            "video_duration": v.video_duration
        }
        for v in videos
    ]
    
    scored_videos = []
    for v in videos_data:
        score, matched_terms = SemanticScorer.score_video(request.message, v)
        scored_videos.append({
            **v,
            "relevance_score": score,
            "matched_terms": matched_terms
        })
    
    scored_videos.sort(key=lambda x: x["relevance_score"], reverse=True)
    print(f"   ⏱️ [STEP 3] Scoring done ({_time.time()-_t0:.2f}s)", flush=True)

    print(f"   📊 Relevance scores:", flush=True)
    for sv in scored_videos[:5]:
        print(f"      - {sv['video_title'][:40]}: {sv['relevance_score']:.3f}", flush=True)
    
    history_result = await session.execute(
        select(PlaylistChatMessage)
        .where(PlaylistChatMessage.playlist_id == playlist_id)
        .where(PlaylistChatMessage.user_id == current_user.id)
        .order_by(PlaylistChatMessage.created_at.desc())
        .limit(10)
    )
    chat_history = [
        {"role": m.role, "content": m.content}
        for m in reversed(history_result.scalars().all())
    ]
    
    categories = [v["category"] for v in videos_data if v.get("category")]
    dominant_category = Counter(categories).most_common(1)[0][0] if categories else None
    
    cache_key = _chat_cache._make_key(
        playlist_id, request.message, request.mode, web_search_enabled
    )
    cached_response = _chat_cache.get(cache_key)
    if cached_response:
        print(f"   ✅ Cache HIT!", flush=True)
        return ChatCorpusResponse(
            response=cached_response["response"],
            sources=cached_response.get("sources"),
            model_used=cached_response.get("model_used", "cache"),
            relevance_scores={
                sv["video_title"]: sv["relevance_score"] 
                for sv in scored_videos[:5]
            }
        )
    
    sources = []
    perplexity_context = ""
    web_search_actually_used = False
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 🧠 DÉTECTION INTELLIGENTE — Utiliser Perplexity seulement quand c'est utile
    # ═══════════════════════════════════════════════════════════════════════════════
    should_use_perplexity = False
    perplexity_reason = "none"
    
    if web_search_enabled:
        # Importer la détection intelligente
        try:
            from videos.web_enrichment import needs_web_search_for_chat
            should_search, trigger_reason = needs_web_search_for_chat(
                request.message, 
                playlist.playlist_title
            )
            if should_search:
                should_use_perplexity = True
                perplexity_reason = trigger_reason
                print(f"   🧠 Perplexity auto-triggered: {trigger_reason}", flush=True)
        except ImportError:
            # Fallback: utiliser si demandé explicitement
            should_use_perplexity = True
            perplexity_reason = "explicit_request"
        
        # Questions courtes et simples = pas besoin de Perplexity
        word_count = len(request.message.split())
        question_lower = request.message.lower()
        
        # Ne PAS utiliser Perplexity pour les questions de synthèse du corpus
        CORPUS_ONLY_PATTERNS = [
            "résume", "synthèse", "principaux points", "qu'est-ce qui est dit",
            "que disent les vidéos", "compare les vidéos", "consensus",
            "summarize", "main points", "what do the videos say"
        ]
        
        is_corpus_question = any(p in question_lower for p in CORPUS_ONLY_PATTERNS)
        
        if is_corpus_question:
            should_use_perplexity = False
            perplexity_reason = "corpus_only_question"
            print(f"   ⏭️ Perplexity skipped: corpus-only question", flush=True)
        elif word_count < 5 and not should_use_perplexity:
            should_use_perplexity = False
            perplexity_reason = "too_short"
            print(f"   ⏭️ Perplexity skipped: question too short", flush=True)
    
    # Exécuter Perplexity si décidé
    if should_use_perplexity:
        perplexity_result = await _perplexity_chat_corpus_v4(
            question=request.message,
            playlist_title=playlist.playlist_title,
            dominant_category=dominant_category
        )
        if perplexity_result:
            perplexity_context = perplexity_result.get("answer", "")
            sources = perplexity_result.get("sources", [])
            web_search_actually_used = True
            print(f"   🌐 Perplexity: {len(perplexity_context)} chars ({perplexity_reason})", flush=True)
    elif web_search_enabled:
        print(f"   💡 Perplexity available but not needed for this question", flush=True)
    
    print(f"   ⏱️ [STEP 5] Calling Mistral ({chat_config['model']}) — max_corpus={chat_config['max_corpus']:,} chars ({_time.time()-_t0:.2f}s)", flush=True)
    response_text = await _chat_with_mistral_corpus_v4(
        question=request.message,
        videos=scored_videos,
        playlist_title=playlist.playlist_title,
        meta_analysis=playlist.meta_analysis,
        chat_history=chat_history,
        chat_config=chat_config,
        mode_config=mode_config,
        mode=request.mode,
        dominant_category=dominant_category,
        perplexity_context=perplexity_context,
        lang=request.lang,
        session=session
    )
    print(f"   ⏱️ [STEP 6] Mistral response received ({_time.time()-_t0:.2f}s) — {len(response_text)} chars", flush=True)

    model_used = chat_config["model"]
    
    volatile_disclaimer = _detect_volatile_disclaimer(
        question=request.message,
        playlist_title=playlist.playlist_title,
        dominant_category=dominant_category,
        lang=request.lang
    )
    if volatile_disclaimer:
        response_text += f"\n\n---\n{volatile_disclaimer}"
        if not web_search_enabled and chat_config["web_search"]:
            if request.lang == "en":
                response_text += "\n\n💡 *Enable 🌐 Web Search to verify current information.*"
            else:
                response_text += "\n\n💡 *Activez 🌐 Recherche Web pour vérifier les informations actuelles.*"
    
    _chat_cache.set(cache_key, {
        "response": response_text,
        "sources": sources,
        "model_used": model_used
    })
    
    session.add(PlaylistChatMessage(
        user_id=current_user.id,
        playlist_id=playlist_id,
        role="user",
        content=request.message
    ))
    session.add(PlaylistChatMessage(
        user_id=current_user.id,
        playlist_id=playlist_id,
        role="assistant",
        content=response_text
    ))
    await session.commit()
    
    print(f"   ✅ Response: {len(response_text)} chars", flush=True)
    
    return ChatCorpusResponse(
        response=response_text,
        sources=sources,
        model_used=model_used,
        relevance_scores={
            sv["video_title"]: round(sv["relevance_score"], 3)
            for sv in scored_videos[:5]
        }
    )


@router.get("/{playlist_id}/chat/history")
async def get_chat_history(
    playlist_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Historique du chat."""
    result = await session.execute(
        select(PlaylistChatMessage)
        .where(PlaylistChatMessage.playlist_id == playlist_id)
        .where(PlaylistChatMessage.user_id == current_user.id)
        .order_by(PlaylistChatMessage.created_at.desc())
        .limit(limit)
    )
    messages = result.scalars().all()
    
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in reversed(messages)
        ]
    }


@router.delete("/{playlist_id}/chat")
async def clear_chat_history(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Efface le chat et invalide le cache."""
    await session.execute(
        delete(PlaylistChatMessage)
        .where(PlaylistChatMessage.playlist_id == playlist_id)
        .where(PlaylistChatMessage.user_id == current_user.id)
    )
    await session.commit()
    
    return {"success": True}


@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Supprime une playlist."""
    await session.execute(
        delete(PlaylistChatMessage)
        .where(PlaylistChatMessage.playlist_id == playlist_id)
        .where(PlaylistChatMessage.user_id == current_user.id)
    )
    await session.execute(
        delete(Summary)
        .where(Summary.playlist_id == playlist_id)
        .where(Summary.user_id == current_user.id)
    )
    await session.execute(
        delete(PlaylistAnalysis)
        .where(PlaylistAnalysis.playlist_id == playlist_id)
        .where(PlaylistAnalysis.user_id == current_user.id)
    )
    await session.commit()
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 CONTEXTE HIÉRARCHIQUE v4.3 — Construction intelligente multi-couches
# ═══════════════════════════════════════════════════════════════════════════════

async def _build_hierarchical_context(
    question: str,
    videos: List[Dict],
    playlist_meta_analysis: str,
    max_context: int = 120000,
    session: Optional[AsyncSession] = None,
    lang: str = "fr"
) -> str:
    """
    Construit un contexte hiérarchique multi-couches pour le chat corpus.

    Architecture de contexte (par ordre de priorité) :
    1. Méta-analyse complète (toujours incluse — vue d'ensemble du corpus)
    2. Synthèses complètes de TOUTES les vidéos (résumé + infos clés)
    3. Full digests des vidéos les plus pertinentes (détail approfondi)
    4. Chunk digests avec timecodes (granularité maximale si budget le permet)

    L'objectif est que l'IA ait en mémoire les informations les plus importantes
    de toutes les synthèses ET de la méta-analyse pour répondre avec le prisme
    des sujets abordés dans les différentes vidéos de la playlist.
    """
    context_parts = []
    remaining = max_context

    # ── COUCHE 1 : Méta-analyse complète (toujours incluse, priorité max) ──
    if playlist_meta_analysis:
        meta_cap = min(len(playlist_meta_analysis), int(max_context * 0.15), 20000)
        meta = playlist_meta_analysis[:meta_cap]
        meta_header = "## 📊 PLAYLIST META-ANALYSIS" if lang == "en" else "## 📊 MÉTA-ANALYSE DE LA PLAYLIST"
        context_parts.append(f"\n{meta_header}\n{meta}")
        remaining -= len(meta) + len(meta_header) + 2

    # ── COUCHE 2 : Synthèses condensées de TOUTES les vidéos ──
    # Chaque vidéo obtient un résumé court pour que l'IA connaisse l'ensemble du corpus
    all_summaries_header = "## 📋 SYNTHÈSES DU CORPUS" if lang == "fr" else "## 📋 CORPUS SUMMARIES"
    summaries_section = [f"\n{all_summaries_header}"]
    # Budget pour cette couche : 30% du budget restant
    layer2_budget = int(remaining * 0.30)
    per_video_budget = max(layer2_budget // max(len(videos), 1), 500)

    for v in videos:
        position = v.get("position", 0)
        title = v.get("video_title", "Vidéo sans titre")
        channel = v.get("video_channel", "")
        category = v.get("category", "")
        relevance = v.get("relevance_score", 0)
        summary = v.get("summary_content", "") or ""

        # Résumé condensé pour cette vidéo
        condensed = summary[:per_video_budget] if summary else "(pas de synthèse)"
        channel_info = f" | Chaîne: {channel}" if channel else ""
        cat_info = f" | Catégorie: {category}" if category else ""

        entry = f"\n**Vidéo {position}: {title}**{channel_info}{cat_info}\n{condensed}"
        if len(entry) > remaining:
            break
        summaries_section.append(entry)
        remaining -= len(entry)

    context_parts.append("\n".join(summaries_section))

    # ── COUCHE 3 : Full digests des vidéos les plus pertinentes ──
    # Les vidéos avec le meilleur score de pertinence obtiennent un contexte détaillé
    if remaining > 2000 and session:
        digest_header = "## 🔍 DÉTAILS APPROFONDIS" if lang == "fr" else "## 🔍 DETAILED ANALYSIS"
        digest_section = [f"\n{digest_header}"]
        remaining -= len(digest_header) + 2

        for video_data in videos:
            if remaining <= 1000:
                break

            position = video_data.get("position", 0)
            title = video_data.get("video_title", "")
            relevance = video_data.get("relevance_score", 0)

            # Récupérer le full_digest depuis la DB
            digest = None
            try:
                summary_id = video_data.get("id")
                if summary_id:
                    result = await session.execute(
                        select(Summary).where(Summary.id == summary_id)
                    )
                    db_summary = result.scalar_one_or_none()
                    if db_summary:
                        digest = db_summary.full_digest
            except Exception as e:
                logger.warning(f"Erreur récupération full_digest pour vidéo {position}: {e}")

            if not digest:
                continue

            # Allocation dynamique : vidéo très pertinente → plus de budget
            if relevance > 0.5:
                allocated = int(remaining * 0.35)
            elif relevance > 0.2:
                allocated = int(remaining * 0.20)
            else:
                allocated = int(remaining * 0.10)

            truncated = digest[:allocated]
            entry = f"\n### VIDEO {position}: {title}\n📊 Pertinence: {relevance:.2f}\n{truncated}"
            digest_section.append(entry)
            remaining -= len(entry)

        if len(digest_section) > 1:
            context_parts.append("\n".join(digest_section))

    # ── COUCHE 4 : Chunk digests avec timecodes (granularité fine) ──
    if remaining > 3000 and session:
        top_n = min(5, len(videos))
        for video_data in videos[:top_n]:
            if remaining <= 1000:
                break
            try:
                summary_id = video_data.get("id")
                if not summary_id:
                    continue
                title = video_data.get("video_title", "")
                result = await session.execute(
                    select(VideoChunk)
                    .where(VideoChunk.summary_id == summary_id)
                    .order_by(VideoChunk.chunk_index)
                )
                chunks = result.scalars().all()
                if not chunks:
                    continue

                chunk_parts = [f"\n⏱️ **Timecodes — {title}**"]
                for chunk in chunks:
                    if remaining <= 500:
                        break
                    if chunk.chunk_digest:
                        time_label = f"[{chunk.start_seconds // 60}:{chunk.start_seconds % 60:02d}]"
                        part = f"  {time_label} {chunk.chunk_digest}"
                        if len(part) > remaining:
                            break
                        chunk_parts.append(part)
                        remaining -= len(part)

                if len(chunk_parts) > 1:
                    context_parts.append("\n".join(chunk_parts))
            except Exception as e:
                logger.warning(f"Erreur récupération chunks pour vidéo {video_data.get('id')}: {e}")
                continue

    total_chars = sum(len(p) for p in context_parts)
    logger.info(
        f"hierarchical_context_built: {total_chars:,} chars, "
        f"{len(context_parts)} sections, {remaining:,} remaining budget"
    )

    return "\n\n".join(context_parts)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 CHAT MISTRAL v4.0 — Contexte optimisé avec allocation dynamique
# ═══════════════════════════════════════════════════════════════════════════════

async def _chat_with_mistral_corpus_v4(
    question: str,
    videos: List[Dict],
    playlist_title: str,
    meta_analysis: str,
    chat_history: List[Dict],
    chat_config: Dict,
    mode_config: Dict,
    mode: str,
    dominant_category: str,
    perplexity_context: str = "",
    lang: str = "fr",
    session: Optional[AsyncSession] = None
) -> str:
    """Chat Mistral v4.1 avec réponses INTELLIGENTES et ADAPTÉES."""
    api_key = get_mistral_key()
    if not api_key:
        return "❌ Clé API Mistral non configurée."
    
    if not videos:
        return "❌ Aucune vidéo dans ce corpus."
    
    model = chat_config["model"]
    max_corpus = chat_config["max_corpus"]
    max_videos_limit = chat_config["max_videos"]
    max_tokens = mode_config["max_tokens"]
    num_segments = mode_config["num_segments"]
    timecode_min = mode_config["timecode_min"]
    style_rule = mode_config["style_fr"] if lang == "fr" else mode_config["style_en"]
    
    print(f"[CHAT v4.1] 🤖 Model: {model} | Videos: {len(videos)} | Mode: {mode}", flush=True)
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 🧠 DÉTECTION INTELLIGENTE DU TYPE DE QUESTION
    # ═══════════════════════════════════════════════════════════════════════════════
    question_lower = question.lower().strip()
    
    FACTUAL_PATTERNS = [
        "c'est quoi", "qu'est-ce que", "qui est", "combien", "quand", "où",
        "what is", "who is", "how many", "when", "where", "define",
        "quelle est", "quel est", "donne-moi", "cite", "liste", "énumère"
    ]
    
    SUMMARY_PATTERNS = [
        "résume", "résumé", "synthèse", "en bref", "principaux points",
        "summarize", "summary", "main points", "key takeaways", "tldr",
        "bullet points", "grandes lignes", "idées principales", "essentiel"
    ]
    
    YES_NO_PATTERNS = [
        "est-ce que", "est-il", "peut-on", "y a-t-il", "faut-il",
        "is it", "does it", "can we", "should", "is there", "are there"
    ]
    
    COMPARISON_PATTERNS = [
        "compare", "différence", "similaire", "commun", "diverge", "oppose",
        "difference", "similar", "common", "vs", "versus", "par rapport"
    ]
    
    OPINION_PATTERNS = [
        "que penses", "ton avis", "conseille", "recommande", "meilleur",
        "what do you think", "your opinion", "recommend", "best", "should i"
    ]
    
    is_factual = any(p in question_lower for p in FACTUAL_PATTERNS)
    is_summary = any(p in question_lower for p in SUMMARY_PATTERNS)
    is_yes_no = any(p in question_lower for p in YES_NO_PATTERNS)
    is_comparison = any(p in question_lower for p in COMPARISON_PATTERNS)
    is_opinion = any(p in question_lower for p in OPINION_PATTERNS)
    word_count = len(question.split())
    is_short_question = word_count < 8
    
    # 🆕 v4.2: Instructions bilingues selon le type de question
    if lang == "fr":
        if is_yes_no:
            response_instruction = """🎯 QUESTION OUI/NON DÉTECTÉE
→ Commence IMMÉDIATEMENT par "Oui" ou "Non" ou "Partiellement"
→ Puis justifie en 1-2 phrases avec références vidéos
→ PAS de préambule, PAS de "c'est une bonne question" """
            adaptive_max_tokens = min(max_tokens, 600)
        elif is_factual and is_short_question:
            response_instruction = """🎯 QUESTION FACTUELLE SIMPLE DÉTECTÉE
→ Réponse DIRECTE en 1-3 phrases maximum
→ Cite la/les vidéo(s) source avec timecode
→ PAS de développement non demandé"""
            adaptive_max_tokens = min(max_tokens, 500)
        elif is_summary:
            response_instruction = """🎯 DEMANDE DE SYNTHÈSE DÉTECTÉE
→ Liste à puces concise (4-6 points max)
→ Chaque point = 1 phrase + référence vidéo
→ Structure claire, pas de prose"""
            adaptive_max_tokens = min(max_tokens, 1200)
        elif is_comparison:
            response_instruction = """🎯 QUESTION COMPARATIVE DÉTECTÉE
→ Structure: Points communs | Différences | Conclusion
→ Cite les vidéos qui soutiennent chaque point
→ Tableau mental: Vidéo X dit A, Vidéo Y dit B"""
            adaptive_max_tokens = max_tokens
        elif is_opinion:
            response_instruction = """🎯 DEMANDE D'AVIS DÉTECTÉE
→ Base-toi sur le CONSENSUS du corpus si présent
→ Mentionne les différents points de vue des vidéos
→ Conclus par une synthèse équilibrée"""
            adaptive_max_tokens = max_tokens
        else:
            response_instruction = """🎯 QUESTION STANDARD
→ Adapte la longueur à la complexité de la question
→ Question simple (< 10 mots) = réponse courte
→ Question complexe = réponse développée mais ciblée"""
            adaptive_max_tokens = max_tokens if word_count > 12 else min(max_tokens, 1000)
    else:  # English
        if is_yes_no:
            response_instruction = """🎯 YES/NO QUESTION DETECTED
→ Start IMMEDIATELY with "Yes" or "No" or "Partially"
→ Then justify in 1-2 sentences with video references
→ NO preamble, NO "that's a good question" """
            adaptive_max_tokens = min(max_tokens, 600)
        elif is_factual and is_short_question:
            response_instruction = """🎯 SIMPLE FACTUAL QUESTION DETECTED
→ DIRECT answer in 1-3 sentences maximum
→ Cite the source video(s) with timecode
→ NO unnecessary elaboration"""
            adaptive_max_tokens = min(max_tokens, 500)
        elif is_summary:
            response_instruction = """🎯 SUMMARY REQUEST DETECTED
→ Concise bullet list (4-6 points max)
→ Each point = 1 sentence + video reference
→ Clear structure, no prose"""
            adaptive_max_tokens = min(max_tokens, 1200)
        elif is_comparison:
            response_instruction = """🎯 COMPARISON QUESTION DETECTED
→ Structure: Common points | Differences | Conclusion
→ Cite videos supporting each point
→ Mental table: Video X says A, Video Y says B"""
            adaptive_max_tokens = max_tokens
        elif is_opinion:
            response_instruction = """🎯 OPINION REQUEST DETECTED
→ Base on corpus CONSENSUS if present
→ Mention different viewpoints from videos
→ Conclude with balanced synthesis"""
            adaptive_max_tokens = max_tokens
        else:
            response_instruction = """🎯 STANDARD QUESTION
→ Adapt length to question complexity
→ Simple question (< 10 words) = short answer
→ Complex question = developed but focused answer"""
            adaptive_max_tokens = max_tokens if word_count > 12 else min(max_tokens, 1000)
    
    history_text = ""
    if chat_history:
        for msg in chat_history[-4:]:
            role = "Utilisateur" if msg.get("role") == "user" else "Assistant"
            history_text += f"\n{role}: {msg.get('content', '')}"
    
    max_videos = min(len(videos), max_videos_limit)

    # 🆕 v4.3: Contexte hiérarchique (méta-analyse + full digests + chunks)
    corpus_text = await _build_hierarchical_context(
        question=question,
        videos=videos[:max_videos],
        playlist_meta_analysis=meta_analysis,
        max_context=max_corpus,
        session=session,
        lang=lang
    )

    # Ajouter le contexte web si disponible (couche optionnelle)
    if perplexity_context:
        web_header = "## 🌐 RECENT WEB INFORMATION" if lang == "en" else "## 🌐 INFORMATIONS WEB RÉCENTES"
        corpus_text = f"{corpus_text}\n\n{web_header}\n{perplexity_context[:2000]}"
    
    total_chars = len(corpus_text)
    print(f"[CHAT v4.2] 📊 Corpus: {max_videos} videos, {total_chars:,} chars | Adaptive tokens: {adaptive_max_tokens} | Lang: {lang}", flush=True)

    # 🆕 v4.4: System prompt enrichi avec vision multi-vidéo
    if lang == "fr":
        system_prompt = f"""Tu es l'assistant IA de DeepSight, expert en analyse de corpus vidéo. Tu as en mémoire l'intégralité des synthèses et de la méta-analyse de ce corpus. Tu réponds de manière naturelle et conversationnelle, comme un ami intelligent.

📚 Corpus : "{playlist_title}" ({len(videos)} vidéos analysées)

{response_instruction}

CAPACITÉS CONTEXTUELLES :
- Tu connais les thèmes, arguments et conclusions de CHAQUE vidéo du corpus
- Tu peux croiser les informations entre vidéos pour des réponses enrichies
- Tu sais identifier les consensus, divergences et complémentarités entre vidéos
- Tu disposes de la méta-analyse globale qui synthétise l'ensemble du corpus

RÈGLES :
- Sois concis et direct, pas de préambules ("Bien sûr", "Excellente question")
- Pas de formules de fin ("N'hésitez pas", "J'espère que ça aide")
- Adapte ta longueur : question courte = réponse courte
- Cite les vidéos par leur numéro et timecodes : "Vidéo 3 (5:23)" ou "Dans la vidéo 2..."
- Quand pertinent, croise les perspectives de plusieurs vidéos
- Si l'info n'est pas dans le corpus, dis-le simplement
- Utilise 1-2 émojis max pour garder le chat vivant
- Cite au moins {timecode_min} vidéos avec timecodes

ÉVALUATION (mode {mode}) : Distingue fait/opinion/hypothèse. Note consensus et divergences. ✅ Solide | ⚖️ Plausible | ❓ Incertain

🌐 Réponds uniquement en français.
"""
        final_instruction = "RÉPONDS DIRECTEMENT (première phrase = début de la réponse):"
    else:  # English
        system_prompt = f"""You are DeepSight's AI assistant, an expert in video corpus analysis. You have full access to all summaries and meta-analysis of this corpus. You respond naturally and conversationally, like a smart friend.

📚 Corpus: "{playlist_title}" ({len(videos)} analyzed videos)

{response_instruction}

CONTEXTUAL CAPABILITIES:
- You know the themes, arguments and conclusions of EACH video in the corpus
- You can cross-reference information between videos for enriched answers
- You can identify consensus, divergences and complementarities between videos
- You have the global meta-analysis summarizing the entire corpus

RULES:
- Be concise and direct, no preambles ("Sure", "Great question")
- No closing formulas ("Hope this helps", "Let me know")
- Match length to complexity: short question = short answer
- Cite videos by number and timecodes: "Video 3 (5:23)" or "In video 2..."
- When relevant, cross-reference perspectives from multiple videos
- If info isn't in the corpus, just say so
- Use 1-2 emojis max to keep the chat lively
- Cite at least {timecode_min} videos with timecodes

EVALUATION (mode {mode}): Distinguish fact/opinion/hypothesis. Note consensus and divergences. ✅ Solid | ⚖️ Plausible | ❓ Uncertain

🌐 Respond only in English.
"""
        final_instruction = "RESPOND DIRECTLY (first sentence = start of the answer):"

    full_prompt = f"""{system_prompt}

═══ CORPUS ({len(videos)} {"VIDÉOS" if lang == "fr" else "VIDEOS"}) ═══
{corpus_text}

{"HISTORIQUE" if lang == "fr" else "HISTORY"}:{history_text}

QUESTION: {question}

{final_instruction}"""
    
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
                    "messages": [{"role": "user", "content": full_prompt}],
                    "max_tokens": adaptive_max_tokens,
                    "temperature": 0.7  # Plus naturel et conversationnel
                },
                timeout=180  # 3 min pour gros contextes 150K tokens
            )
            print(f"[CHAT v4.2] 📡 Mistral HTTP {response.status_code} — prompt: {len(full_prompt):,} chars", flush=True)

            if response.status_code == 200:
                data = response.json()
                answer = data["choices"][0]["message"]["content"].strip()

                # Post-processing: supprimer les préambules résiduels
                preambles_to_remove = [
                    "Bien sûr!", "Bien sûr,", "Certainement!", "Certainement,",
                    "Excellente question!", "Bonne question!", "C'est une bonne question.",
                    "Je vais répondre à votre question.", "Permettez-moi de répondre.",
                    "Sure!", "Certainly!", "Great question!", "Good question!",
                    "Let me answer that.", "I'll explain.", "Of course!"
                ]
                for preamble in preambles_to_remove:
                    if answer.startswith(preamble):
                        answer = answer[len(preamble):].strip()

                print(f"[CHAT v4.2] ✅ Response: {len(answer)} chars", flush=True)
                return answer
            else:
                error_body = ""
                try:
                    error_body = response.text[:500]
                except:
                    pass
                print(f"[CHAT v4.2] ❌ API Error {response.status_code}: {error_body}", flush=True)
                if response.status_code == 429:
                    if lang == "fr":
                        return "⏳ Limite de requêtes atteinte. Réessayez dans quelques instants."
                    return "⏳ Rate limit reached. Please try again in a moment."
                if lang == "fr":
                    return f"❌ Erreur API: {response.status_code}"
                return f"❌ API Error: {response.status_code}"

    except Exception as e:
        print(f"[CHAT v4.2] ❌ Exception: {e}", flush=True)
        if lang == "fr":
            return f"❌ Erreur: {e}"
        return f"❌ Error: {e}"


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 PERPLEXITY v4.0 — Recherche contextuelle avec cache
# ═══════════════════════════════════════════════════════════════════════════════

async def _perplexity_chat_corpus_v4(
    question: str,
    playlist_title: str,
    dominant_category: str = None
) -> Optional[Dict]:
    """Recherche Perplexity optimisée avec contexte corpus."""
    api_key = get_perplexity_key()
    if not api_key:
        return None
    
    cache_key = _perplexity_cache._make_key(question, playlist_title)
    cached = _perplexity_cache.get(cache_key)
    if cached:
        print(f"[PERPLEXITY] 💾 Cache hit!", flush=True)
        return cached
    
    context_hint = f"corpus vidéo '{playlist_title}'"
    if dominant_category:
        context_hint += f" (thème: {dominant_category})"
    
    prompt = f"""Dans le contexte d'une analyse de {context_hint}, recherche des informations complémentaires RÉCENTES et VÉRIFIABLES sur:

{question}

Instructions:
1. Priorise les sources officielles et récentes (< 6 mois)
2. Indique clairement les dates des informations
3. Signale si l'information est sujette à changement rapide
4. Fournis des faits vérifiables, pas des opinions

Réponds de manière concise et factuelle."""
    
    try:
        print(f"[PERPLEXITY] 🔮 Query: {question[:50]}...", flush=True)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-sonar-small-128k-online",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1500,
                    "temperature": 0.2
                },
                timeout=45
            )
            
            if response.status_code == 200:
                data = response.json()
                answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                citations = data.get("citations", [])
                
                sources = []
                if citations:
                    answer += "\n\n**🔍 Sources:**\n"
                    for url in citations[:5]:
                        try:
                            domain = url.split("/")[2] if len(url.split("/")) > 2 else url[:40]
                            answer += f"- [{domain}]({url})\n"
                            sources.append({"url": url, "domain": domain})
                        except:
                            pass
                
                result = {"answer": answer, "sources": sources}
                _perplexity_cache.set(cache_key, result)
                
                print(f"[PERPLEXITY] ✅ {len(answer)} chars, {len(citations)} sources", flush=True)
                return result
            else:
                print(f"[PERPLEXITY] ❌ HTTP {response.status_code}", flush=True)
                return None
                
    except Exception as e:
        print(f"[PERPLEXITY] ❌ Exception: {e}", flush=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 DÉTECTION SUJETS VOLATILS
# ═══════════════════════════════════════════════════════════════════════════════

def _detect_volatile_disclaimer(
    question: str,
    playlist_title: str,
    dominant_category: str,
    lang: str = "fr"
) -> Optional[str]:
    """
    🆕 v4.2: Détecte si la question concerne un sujet volatil.
    Support bilingue FR/EN.
    """
    text_to_check = f"{question} {playlist_title}".lower()
    disclaimer_key = "disclaimer_en" if lang == "en" else "disclaimer_fr"

    for topic_key, topic_info in VOLATILE_TOPICS.items():
        keywords = topic_info.get("keywords", [])
        for keyword in keywords:
            if keyword.lower() in text_to_check:
                return topic_info.get(disclaimer_key)

    if dominant_category:
        category_lower = dominant_category.lower()
        for topic_key, topic_info in VOLATILE_TOPICS.items():
            if topic_key in category_lower or category_lower in topic_key:
                return topic_info.get(disclaimer_key)

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 BACKGROUND TASKS — Analyse en arrière-plan
# ═══════════════════════════════════════════════════════════════════════════════

async def _analyze_playlist_background(
    task_id: str,
    playlist_id: str,
    url: str,
    max_videos: int,
    mode: str,
    lang: str,
    model: str,
    user_id: int,
    user_plan: str
):
    """Analyse une playlist YouTube en arrière-plan."""
    from db.database import async_session_maker
    
    print(f"\n🔧 BACKGROUND PLAYLIST ANALYSIS", flush=True)
    print(f"   Task: {task_id}", flush=True)
    print(f"   Mode: {mode}, Model: {model}", flush=True)
    
    async with async_session_maker() as session:
        try:
            _playlist_task_store[task_id]["status"] = "processing"
            _playlist_task_store[task_id]["message"] = "Récupération de la playlist..."
            
            playlist_info = await get_playlist_info(playlist_id)
            if not playlist_info:
                raise Exception("Impossible de récupérer la playlist")
            
            print(f"📚 Playlist: {playlist_info.get('title', 'Unknown')}", flush=True)
            
            videos = await get_playlist_videos(playlist_id, max_videos)
            if not videos:
                raise Exception("Aucune vidéo trouvée")
            
            total_videos = len(videos)
            _playlist_task_store[task_id]["total_videos"] = total_videos
            _playlist_task_store[task_id]["message"] = f"{total_videos} vidéos trouvées"
            
            print(f"📺 {total_videos} videos found", flush=True)
            
            playlist_analysis = PlaylistAnalysis(
                user_id=user_id,
                playlist_id=playlist_id,
                playlist_url=url,
                playlist_title=playlist_info.get("title", "Playlist"),
                num_videos=total_videos,
                status="processing",
                started_at=datetime.utcnow()
            )
            session.add(playlist_analysis)
            await session.commit()
            
            summaries = []
            total_duration = 0
            total_words = 0
            
            for idx, video in enumerate(videos):
                position = idx + 1
                _playlist_task_store[task_id]["current_video"] = position
                _playlist_task_store[task_id]["progress"] = int((position / total_videos) * 80)
                
                video_id = video.get("video_id")
                if not video_id:
                    print(f"⚠️ Skip video {position}: no video_id", flush=True)
                    continue
                
                _playlist_task_store[task_id]["message"] = f"Analyse {position}/{total_videos}: {video.get('title', '')[:40]}..."
                
                print(f"\n📹 [{position}/{total_videos}] {video_id}", flush=True)
                
                try:
                    video_info = await get_video_info(video_id)
                    if not video_info:
                        print(f"   ❌ No video info", flush=True)
                        continue
                    
                    print(f"   Title: {video_info.get('title', '')[:50]}", flush=True)
                    
                    transcript_result = await get_transcript_with_timestamps(video_id, lang)
                    
                    if isinstance(transcript_result, tuple):
                        if len(transcript_result) >= 3:
                            transcript_simple, transcript_timestamped, detected_lang = transcript_result
                        else:
                            transcript_simple = transcript_result[0] if transcript_result else None
                            transcript_timestamped = transcript_simple
                    else:
                        transcript_simple = transcript_result
                        transcript_timestamped = transcript_result
                    
                    if not transcript_simple:
                        print(f"   ⚠️ No transcript", flush=True)
                        continue
                    
                    print(f"   ✅ Transcript: {len(transcript_simple)} chars", flush=True)
                    
                    category_result = detect_category(
                        title=video_info.get("title", ""),
                        description=video_info.get("description", ""),
                        transcript=transcript_simple[:2000]
                    )
                    category = category_result[0] if isinstance(category_result, tuple) else category_result
                    print(f"   📁 Category: {category}", flush=True)
                    
                    summary_content = await generate_summary(
                        title=video_info.get("title", ""),
                        transcript=transcript_simple,
                        category=category,
                        lang=lang,
                        mode=mode,
                        model=model,
                        duration=video_info.get("duration", 0),
                        channel=video_info.get("channel", ""),
                        description=video_info.get("description", "")
                    )
                    
                    if not summary_content:
                        print(f"   ⚠️ No summary generated", flush=True)
                        continue
                    
                    word_count = len(summary_content.split())
                    duration = video_info.get("duration", 0)
                    total_duration += duration
                    total_words += word_count
                    
                    print(f"   ✅ Summary: {word_count} words", flush=True)
                    
                    transcript_context = transcript_timestamped if isinstance(transcript_timestamped, str) else None
                    if transcript_context:
                        transcript_context = transcript_context[:40000]  # 🆕 v4.2: Augmenté pour vidéos longues
                    
                    summary = Summary(
                        user_id=user_id,
                        video_id=video_id,
                        video_title=video_info.get("title"),
                        video_channel=video_info.get("channel"),
                        video_duration=duration,
                        video_url=f"https://www.youtube.com/watch?v={video_id}",
                        thumbnail_url=video_info.get("thumbnail_url", video_info.get("thumbnail")),
                        category=category,
                        lang=lang,
                        mode=mode,
                        model_used=model,
                        summary_content=summary_content,
                        transcript_context=transcript_context,
                        word_count=word_count,
                        playlist_id=playlist_id,
                        playlist_position=position
                    )
                    session.add(summary)
                    
                    summaries.append({
                        "position": position,
                        "title": video_info.get("title"),
                        "channel": video_info.get("channel"),
                        "summary": summary_content[:2000],
                        "category": category,
                        "duration": duration,
                        "word_count": word_count
                    })
                    
                    user = await session.get(User, user_id)
                    if user and user.credits > 0:
                        user.credits -= 1
                        user.total_videos += 1
                        user.total_words += word_count
                    
                    await session.commit()
                    
                except Exception as e:
                    print(f"   ❌ Error: {e}", flush=True)
                    await session.rollback()
                    continue
            
            if not summaries:
                raise Exception("Aucune vidéo analysée")
            
            _playlist_task_store[task_id]["progress"] = 85
            _playlist_task_store[task_id]["message"] = "Génération de la méta-analyse..."
            
            meta_analysis = await _generate_meta_analysis_v4(
                summaries=summaries,
                playlist_title=playlist_info.get("title", "Playlist"),
                lang=lang,
                model=model
            )
            
            playlist_analysis.meta_analysis = meta_analysis
            playlist_analysis.total_duration = total_duration
            playlist_analysis.total_words = total_words
            playlist_analysis.num_processed = len(summaries)
            playlist_analysis.status = "completed"
            playlist_analysis.completed_at = datetime.utcnow()
            
            user = await session.get(User, user_id)
            if user:
                user.total_playlists += 1
            
            await session.commit()
            
            _playlist_task_store[task_id]["status"] = "completed"
            _playlist_task_store[task_id]["progress"] = 100
            _playlist_task_store[task_id]["message"] = "Analyse terminée!"
            _playlist_task_store[task_id]["result"] = {
                "playlist_id": playlist_id,
                "num_videos": len(summaries),
                "total_duration": total_duration,
                "total_words": total_words
            }
            
            print(f"\n✅ PLAYLIST COMPLETED: {len(summaries)} videos, {total_words} words", flush=True)
            
        except Exception as e:
            print(f"❌ PLAYLIST FAILED: {e}", flush=True)
            await session.rollback()
            _playlist_task_store[task_id]["status"] = "failed"
            _playlist_task_store[task_id]["message"] = str(e)


async def _analyze_corpus_background(
    task_id: str,
    urls: List[str],
    corpus_name: str,
    mode: str,
    lang: str,
    model: str,
    user_id: int,
    user_plan: str
):
    """Analyse un corpus personnalisé en arrière-plan."""
    from db.database import async_session_maker
    
    corpus_id = f"corpus_{uuid4().hex[:12]}"
    
    print(f"\n🔧 BACKGROUND CORPUS ANALYSIS", flush=True)
    print(f"   Task: {task_id}", flush=True)
    print(f"   Corpus: {corpus_name} ({len(urls)} URLs)", flush=True)
    
    async with async_session_maker() as session:
        try:
            _playlist_task_store[task_id]["status"] = "processing"
            
            total_videos = len(urls)
            _playlist_task_store[task_id]["total_videos"] = total_videos
            
            playlist_analysis = PlaylistAnalysis(
                user_id=user_id,
                playlist_id=corpus_id,
                playlist_url=",".join(urls[:5]),
                playlist_title=corpus_name,
                num_videos=total_videos,
                status="processing",
                started_at=datetime.utcnow()
            )
            session.add(playlist_analysis)
            await session.commit()
            
            summaries = []
            total_duration = 0
            total_words = 0
            
            for idx, url in enumerate(urls):
                position = idx + 1
                _playlist_task_store[task_id]["current_video"] = position
                _playlist_task_store[task_id]["progress"] = int((position / total_videos) * 80)
                
                video_id = extract_video_id(url)
                if not video_id:
                    print(f"⚠️ Invalid URL: {url}", flush=True)
                    continue
                
                _playlist_task_store[task_id]["message"] = f"Analyse {position}/{total_videos}..."
                
                print(f"\n📹 [{position}/{total_videos}] {video_id}", flush=True)
                
                try:
                    video_info = await get_video_info(video_id)
                    if not video_info:
                        continue
                    
                    transcript_result = await get_transcript_with_timestamps(video_id, lang)
                    
                    if isinstance(transcript_result, tuple):
                        transcript_simple, transcript_timestamped, _ = (
                            transcript_result if len(transcript_result) >= 3 
                            else (transcript_result[0], transcript_result[0], lang)
                        )
                    else:
                        transcript_simple = transcript_result
                        transcript_timestamped = transcript_result
                    
                    if not transcript_simple:
                        continue
                    
                    category_result = detect_category(
                        title=video_info.get("title", ""),
                        description=video_info.get("description", ""),
                        transcript=transcript_simple[:2000]
                    )
                    category = category_result[0] if isinstance(category_result, tuple) else category_result
                    
                    summary_content = await generate_summary(
                        title=video_info.get("title", ""),
                        transcript=transcript_simple,
                        category=category,
                        lang=lang,
                        mode=mode,
                        model=model,
                        duration=video_info.get("duration", 0),
                        channel=video_info.get("channel", ""),
                        description=video_info.get("description", "")
                    )
                    
                    if not summary_content:
                        continue
                    
                    word_count = len(summary_content.split())
                    duration = video_info.get("duration", 0)
                    total_duration += duration
                    total_words += word_count
                    
                    transcript_context = transcript_timestamped if isinstance(transcript_timestamped, str) else None
                    if transcript_context:
                        transcript_context = transcript_context[:40000]  # 🆕 v4.2: Augmenté pour vidéos longues
                    
                    summary = Summary(
                        user_id=user_id,
                        video_id=video_id,
                        video_title=video_info.get("title"),
                        video_channel=video_info.get("channel"),
                        video_duration=duration,
                        video_url=f"https://www.youtube.com/watch?v={video_id}",
                        thumbnail_url=video_info.get("thumbnail_url", video_info.get("thumbnail")),
                        category=category,
                        lang=lang,
                        mode=mode,
                        model_used=model,
                        summary_content=summary_content,
                        transcript_context=transcript_context,
                        word_count=word_count,
                        playlist_id=corpus_id,
                        playlist_position=position
                    )
                    session.add(summary)
                    
                    summaries.append({
                        "position": position,
                        "title": video_info.get("title"),
                        "channel": video_info.get("channel"),
                        "summary": summary_content[:2000],
                        "category": category,
                        "duration": duration,
                        "word_count": word_count
                    })
                    
                    user = await session.get(User, user_id)
                    if user and user.credits > 0:
                        user.credits -= 1
                        user.total_videos += 1
                        user.total_words += word_count
                    
                    await session.commit()
                    
                except Exception as e:
                    print(f"❌ Error {video_id}: {e}", flush=True)
                    await session.rollback()
                    continue
            
            if not summaries:
                raise Exception("Aucune vidéo analysée")
            
            _playlist_task_store[task_id]["progress"] = 85
            _playlist_task_store[task_id]["message"] = "Méta-analyse..."
            
            meta_analysis = await _generate_meta_analysis_v4(
                summaries=summaries,
                playlist_title=corpus_name,
                lang=lang,
                model=model
            )
            
            playlist_analysis.meta_analysis = meta_analysis
            playlist_analysis.total_duration = total_duration
            playlist_analysis.total_words = total_words
            playlist_analysis.num_processed = len(summaries)
            playlist_analysis.status = "completed"
            playlist_analysis.completed_at = datetime.utcnow()
            
            user = await session.get(User, user_id)
            if user:
                user.total_playlists += 1
            
            await session.commit()
            
            _playlist_task_store[task_id]["status"] = "completed"
            _playlist_task_store[task_id]["progress"] = 100
            _playlist_task_store[task_id]["message"] = "Terminé!"
            _playlist_task_store[task_id]["result"] = {
                "playlist_id": corpus_id,
                "num_videos": len(summaries),
                "total_duration": total_duration,
                "total_words": total_words
            }
            
        except Exception as e:
            print(f"❌ CORPUS FAILED: {e}", flush=True)
            await session.rollback()
            _playlist_task_store[task_id]["status"] = "failed"
            _playlist_task_store[task_id]["message"] = str(e)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 META-ANALYSE v4.0 — Avec extraction de concepts
# ═══════════════════════════════════════════════════════════════════════════════

async def _generate_meta_analysis_v4(
    summaries: List[Dict],
    playlist_title: str,
    lang: str,
    model: str
) -> str:
    """
    🆕 v4.2: Génère une méta-analyse enrichie avec extraction de concepts.
    Support complet FR/EN.
    """
    api_key = get_mistral_key()
    if not api_key:
        return "Meta-analysis unavailable" if lang == "en" else "Méta-analyse non disponible"

    summaries_text = ""
    categories = set()
    all_concepts = []
    total_duration = 0

    for s in summaries:
        summaries_text += f"\n### {s['position']}. {s['title']}\n"
        if lang == "fr":
            summaries_text += f"**Chaîne:** {s.get('channel', 'N/A')} | **Catégorie:** {s.get('category', 'N/A')}\n"
        else:
            summaries_text += f"**Channel:** {s.get('channel', 'N/A')} | **Category:** {s.get('category', 'N/A')}\n"

        # 🆕 Préférer full_digest si disponible, sinon utiliser summary_content
        digest = s.get('full_digest') or s.get('summary')
        summaries_text += f"{digest}\n"

        if s.get('category'):
            categories.add(s['category'])
        total_duration += s.get('duration', 0)

        concepts = SemanticScorer.extract_key_concepts(digest, top_n=5)
        all_concepts.extend(concepts)

    concept_counts = Counter(all_concepts)
    top_concepts = [c for c, _ in concept_counts.most_common(10)]

    duration_str = f"{total_duration // 3600}h {(total_duration % 3600) // 60}min" if total_duration > 3600 else f"{total_duration // 60} min"

    # 🆕 v4.3: Compression proportionnelle si contexte > 120K chars
    total_context_chars = len(summaries_text)
    if total_context_chars > 120000:
        logger.info(
            f"meta_analysis_context_compression: original={total_context_chars}, target_max=120000"
        )
        max_per_video = 120000 // len(summaries)
        compressed_text = ""
        for s in summaries:
            compressed_text += f"\n### {s['position']}. {s['title']}\n"
            if lang == "fr":
                compressed_text += f"**Chaîne:** {s.get('channel', 'N/A')} | **Catégorie:** {s.get('category', 'N/A')}\n"
            else:
                compressed_text += f"**Channel:** {s.get('channel', 'N/A')} | **Category:** {s.get('category', 'N/A')}\n"
            digest = s.get('full_digest') or s.get('summary')
            compressed_text += f"{digest[:max_per_video]}\n"
        summaries_text = compressed_text

    # 🆕 v4.2: Prompt bilingue complet
    if lang == "fr":
        prompt = f"""Analyse ce corpus de {len(summaries)} vidéos intitulé "{playlist_title}":

{summaries_text}

**Concepts clés détectés automatiquement:** {', '.join(top_concepts)}

Génère une méta-analyse COMPLÈTE en français avec:

## 🎯 Vision d'Ensemble
Synthèse globale du corpus en 3-4 phrases. Quel est le fil conducteur principal?

## 📊 Thèmes Principaux
Liste les 4-6 thèmes majeurs avec leur fréquence/importance dans le corpus.

## 🔗 Connexions & Complémentarités
Comment les vidéos se complètent-elles? Quels liens conceptuels entre elles?

## ⚔️ Points de Tension
Y a-t-il des contradictions, nuances ou opinions divergentes entre vidéos?

## 💡 Insights Clés
Les 5 apprentissages les plus importants du corpus, avec références aux vidéos.

## 📈 Statistiques
- **Vidéos analysées:** {len(summaries)}
- **Durée totale:** {duration_str}
- **Catégories:** {', '.join(categories) if categories else 'Variées'}
- **Mots générés:** {sum(s.get('word_count', 0) for s in summaries):,}

## 🎬 Parcours Suggéré
Par quelle vidéo commencer? Quel ordre de visionnage recommandes-tu et pourquoi?

🌐 RÉPONDS UNIQUEMENT EN FRANÇAIS.
"""
    else:  # English
        prompt = f"""Analyze this corpus of {len(summaries)} videos titled "{playlist_title}":

{summaries_text}

**Automatically detected key concepts:** {', '.join(top_concepts)}

Generate a COMPLETE meta-analysis in English with:

## 🎯 Overview
Global synthesis of the corpus in 3-4 sentences. What is the main thread?

## 📊 Main Themes
List the 4-6 major themes with their frequency/importance in the corpus.

## 🔗 Connections & Complementarities
How do the videos complement each other? What conceptual links between them?

## ⚔️ Points of Tension
Are there contradictions, nuances or divergent opinions between videos?

## 💡 Key Insights
The 5 most important learnings from the corpus, with video references.

## 📈 Statistics
- **Videos analyzed:** {len(summaries)}
- **Total duration:** {duration_str}
- **Categories:** {', '.join(categories) if categories else 'Various'}
- **Words generated:** {sum(s.get('word_count', 0) for s in summaries):,}

## 🎬 Suggested Path
Which video to start with? What viewing order do you recommend and why?

🌐 RESPOND ONLY IN ENGLISH.
"""
    
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
                    "max_tokens": 4500,
                    "temperature": 0.35
                },
                timeout=120
            )
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                print(f"✅ Meta-analysis v4: {len(content)} chars", flush=True)
                return content
    except Exception as e:
        print(f"❌ Meta-analysis error: {e}", flush=True)
    
    return f"Méta-analyse de {len(summaries)} vidéos. Catégories: {', '.join(categories)}. Concepts: {', '.join(top_concepts[:5])}"
