"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🗄️ DATABASE — SQLite/PostgreSQL avec SQLAlchemy Async                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import hashlib
from datetime import datetime
from typing import Optional, AsyncGenerator
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Date,
    ForeignKey, Index, create_engine, event, UniqueConstraint, text
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

from core.config import DATA_DIR, IS_RAILWAY, ADMIN_CONFIG

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

# Support PostgreSQL (Railway) ou SQLite (local)
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Flag pour activer SSL (pour proxy public Railway)
_use_ssl = False

if DATABASE_URL:
    # PostgreSQL sur Railway
    # Nettoyer les paramètres SSL de l'URL (asyncpg les gère différemment)
    if "?" in DATABASE_URL:
        base_url, params = DATABASE_URL.split("?", 1)
        # Vérifier si SSL est demandé
        if "sslmode=require" in params or "ssl=require" in params or "sslmode=prefer" in params:
            _use_ssl = True
        # Retirer les paramètres SSL de l'URL
        param_list = [p for p in params.split("&") if not p.startswith("sslmode=") and not p.startswith("ssl=")]
        DATABASE_URL = base_url + ("?" + "&".join(param_list) if param_list else "")

    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Railway public proxy REQUIERT SSL
    if ".proxy.rlwy.net" in DATABASE_URL:
        _use_ssl = True

    print(f"🐘 Using PostgreSQL database (SSL: {_use_ssl})", flush=True)
else:
    # SQLite local avec aiosqlite
    DB_FILE = os.path.join(DATA_DIR, "deepsight_users.db")
    DATABASE_URL = f"sqlite+aiosqlite:///{DB_FILE}"
    print(f"📁 Using SQLite database: {DB_FILE}", flush=True)

# Créer le moteur async avec pool résilient
_engine_kwargs = {
    "echo": os.environ.get("SQL_ECHO", "false").lower() == "true",
    "pool_pre_ping": True,
}

# PostgreSQL-specific pool settings — optimisé pour Railway 512MB
# Chaque connexion asyncpg consomme ~5-10MB RAM
# pool_size=5 + max_overflow=3 = 8 max = ~60MB (vs 30 × 7MB = 210MB avant)
if DATABASE_URL.startswith("postgresql"):
    _engine_kwargs.update({
        "pool_size": int(os.environ.get("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "3")),
        "pool_timeout": 30,
        "pool_recycle": 1800,  # Recycler toutes les 30min (vs 1h) pour libérer les connexions idle
    })

    # Configurer SSL pour asyncpg via connect_args
    if _use_ssl:
        # ssl=True crée un contexte SSL par défaut pour asyncpg
        _engine_kwargs["connect_args"] = {"ssl": True}

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

# Session factory avec autoflush désactivé pour meilleures performances
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Base pour les modèles
Base = declarative_base()

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 MODÈLES (Tables)
# ═══════════════════════════════════════════════════════════════════════════════

class User(Base):
    """Table des utilisateurs"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Vérification email
    email_verified = Column(Boolean, default=False)
    verification_code = Column(String(10))
    verification_expires = Column(DateTime)
    
    # Reset password
    reset_code = Column(String(100))
    reset_expires = Column(DateTime)
    
    # Plan et crédits
    plan = Column(String(20), default="free")
    credits = Column(Integer, default=10)
    
    # Admin
    is_admin = Column(Boolean, default=False)
    
    # Stripe
    stripe_customer_id = Column(String(100))
    stripe_subscription_id = Column(String(100))
    
    # Google OAuth
    google_id = Column(String(100))

    # Clés API utilisateur (optionnel)
    mistral_key = Column(String(255))
    supadata_key = Column(String(255))
    
    # Préférences
    default_lang = Column(String(5), default="fr")
    default_mode = Column(String(20), default="standard")
    default_model = Column(String(50), default="mistral-small-2603")
    avatar_url = Column(Text) 
    
    # Stats
    total_videos = Column(Integer, default=0)
    total_words = Column(Integer, default=0)
    total_playlists = Column(Integer, default=0)
    
    # Sessions
    session_token = Column(String(255))
    last_login = Column(DateTime)
    
    # 🔑 API Keys (Plan Expert)
    api_key_hash = Column(String(64), unique=True, index=True)  # SHA256 hash
    api_key_created_at = Column(DateTime)
    api_key_last_used = Column(DateTime)
    
    # Voice
    voice_bonus_seconds = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    summaries = relationship("Summary", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    api_usage = relationship("ApiUsage", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.username}>"


class Summary(Base):
    """Table des résumés/analyses de vidéos"""
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Vidéo
    video_id = Column(String(20), nullable=False)
    video_title = Column(String(500))
    video_channel = Column(String(255))
    video_duration = Column(Integer)
    video_url = Column(String(500))
    thumbnail_url = Column(Text)  # Changed to Text for base64 images
    video_upload_date = Column(String(50))

    # Analyse
    category = Column(String(50))
    category_confidence = Column(Float)
    lang = Column(String(5))
    mode = Column(String(20))
    model_used = Column(String(50))

    # Contenu
    summary_content = Column(Text)
    transcript_context = Column(Text)  # Transcription pour le chat
    word_count = Column(Integer)

    # Fact-checking et entités
    fact_check_result = Column(Text)
    entities_extracted = Column(Text)  # JSON
    reliability_score = Column(Float)
    tags = Column(Text)

    # Plateforme source (youtube, tiktok)
    platform = Column(String(20), default="youtube", server_default="youtube")

    # Playlist
    playlist_id = Column(String(100), index=True)
    playlist_position = Column(Integer)

    # Favoris et notes
    is_favorite = Column(Boolean, default=False)
    notes = Column(Text)

    # Timestamp
    created_at = Column(DateTime, default=func.now())

    # 🔬 Deep Research (Mar 2026)
    deep_research = Column(Boolean, default=False, server_default="false")
    enrichment_sources = Column(Text, nullable=True)   # JSON: [{title, url, snippet}]
    enrichment_data = Column(Text, nullable=True)       # JSON: {level, sources, enriched_at}

    # Hierarchical Digest Pipeline (Feb 2026)
    full_digest = Column(Text, nullable=True)  # Assembled full digest from chunk digests (~6-10K chars)

    # Relations
    user = relationship("User", back_populates="summaries")
    chat_messages = relationship("ChatMessage", back_populates="summary", cascade="all, delete-orphan")
    chunks = relationship("VideoChunk", back_populates="summary", cascade="all, delete-orphan", order_by="VideoChunk.chunk_index")

    __table_args__ = (
        Index('idx_summaries_user', 'user_id'),
        Index('idx_summaries_playlist', 'playlist_id'),
        # 🆕 Indexes optimisés pour les requêtes fréquentes
        Index('idx_summaries_user_created', 'user_id', 'created_at'),  # Pour history pagination
        Index('idx_summaries_user_video', 'user_id', 'video_id'),      # Pour duplicate check
        Index('idx_summaries_user_favorite', 'user_id', 'is_favorite'), # Pour filtrage favoris
        Index('idx_summaries_user_category', 'user_id', 'category'),   # Pour filtrage catégorie
    )


class DailyQuota(Base):
    """Table des quotas journaliers"""
    __tablename__ = "daily_quotas"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    videos_used = Column(Integer, default=0)
    
    __table_args__ = (
        Index('idx_daily_quota_user_date', 'user_id', 'quota_date', unique=True),
    )


class CreditTransaction(Base):
    """Table des transactions de crédits"""
    __tablename__ = "credit_transactions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    transaction_type = Column(String(50))  # usage, purchase, bonus, refund
    type = Column(String(50))  # Alias pour compatibilité
    stripe_payment_id = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime, default=func.now())


class VideoChunk(Base):
    """Table des chunks de transcription pour le Hierarchical Digest Pipeline.

    Chaque vidéo est découpée en chunks temporels, résumés individuellement,
    puis assemblés en un full_digest complet stocké dans Summary.full_digest.
    """
    __tablename__ = "video_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)  # Ordre du chunk dans la vidéo
    start_seconds = Column(Integer, nullable=False, default=0)
    end_seconds = Column(Integer, nullable=False, default=0)
    chunk_text = Column(Text, nullable=False)  # Transcript brut du chunk (~10-15K chars)
    chunk_digest = Column(Text, nullable=True)  # Mini-résumé du chunk (~500-800 chars)
    created_at = Column(DateTime, default=func.now())

    # Relation
    summary = relationship("Summary", back_populates="chunks")


class VideoComparison(Base):
    """Table des comparaisons entre deux vidéos (VS Mode)"""
    __tablename__ = "video_comparisons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_a_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False)
    summary_b_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False)
    comparison_json = Column(Text, nullable=False)
    lang = Column(String(5), default="fr")
    model_used = Column(String(50))
    credits_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index('idx_comparisons_user', 'user_id'),
    )


class PlaylistAnalysis(Base):
    """Table des analyses de playlists"""
    __tablename__ = "playlist_analyses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    playlist_id = Column(String(100), nullable=False)
    playlist_url = Column(String(500))
    playlist_title = Column(String(500))
    
    # Stats
    num_videos = Column(Integer)
    num_processed = Column(Integer, default=0)
    total_duration = Column(Integer)
    total_words = Column(Integer)
    
    # Résultats
    meta_analysis = Column(Text)
    all_summaries = Column(Text)  # JSON
    
    # Status
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text)
    
    # Timestamps
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())


class ChatMessage(Base):
    """Table des messages de chat - v5.0 avec fact-checking"""
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    summary_id = Column(Integer, ForeignKey("summaries.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())
    
    # 🆕 v5.0: Métadonnées pour fact-checking et sources
    web_search_used = Column(Boolean, default=False)
    fact_checked = Column(Boolean, default=False)
    sources_json = Column(Text, nullable=True)  # JSON des sources web
    enrichment_level = Column(String(20), nullable=True)  # none, light, full, deep
    
    # Relations
    user = relationship("User", back_populates="chat_messages")
    summary = relationship("Summary", back_populates="chat_messages")
    
    __table_args__ = (
        Index('idx_chat_messages_summary', 'summary_id'),
    )


class ChatQuota(Base):
    """Table des quotas de chat journaliers"""
    __tablename__ = "chat_quotas"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date = Column(String(10), nullable=False)
    daily_count = Column(Integer, default=0)
    
    __table_args__ = (
        Index('idx_chat_quotas_user_date', 'user_id', 'quota_date', unique=True),
    )


class PlaylistChatMessage(Base):
    """Table des messages de chat pour playlists"""
    __tablename__ = "playlist_chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    playlist_id = Column(String(100), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())


class WebSearchUsage(Base):
    """Table d'usage de la recherche web"""
    __tablename__ = "web_search_usage"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month_year = Column(String(7), nullable=False)  # YYYY-MM
    search_count = Column(Integer, default=0)
    last_search_at = Column(DateTime)
    
    __table_args__ = (
        Index('idx_web_search_usage', 'user_id', 'month_year', unique=True),
    )


class AdminLog(Base):
    """Table des logs admin"""
    __tablename__ = "admin_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(100), nullable=False)
    target_user_id = Column(Integer)
    details = Column(Text)
    created_at = Column(DateTime, default=func.now())


class ApiStatus(Base):
    """Table du status des APIs externes"""
    __tablename__ = "api_status"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_name = Column(String(50), unique=True, nullable=False)
    status = Column(String(20), default="ok")
    last_error = Column(Text)
    last_error_at = Column(DateTime)
    last_success_at = Column(DateTime)
    error_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class TaskStatus(Base):
    """Table pour le tracking des tâches de fond (analyses longues)"""
    __tablename__ = "task_status"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_type = Column(String(50), nullable=False)  # video_analysis, playlist_analysis
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    progress = Column(Integer, default=0)  # 0-100
    result = Column(Text)  # JSON result
    error_message = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ApiUsage(Base):
    """
    📊 Tracking de l'utilisation de l'API REST publique (Expert Plan)
    Permet de suivre les quotas journaliers et les crédits consommés
    """
    __tablename__ = "api_usage"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)  # Date du jour (pour quotas journaliers)
    request_count = Column(Integer, default=0)       # Nombre de requêtes ce jour
    credits_used = Column(Integer, default=0)        # Crédits consommés via API
    error_count = Column(Integer, default=0)         # Nombre d'erreurs (pour monitoring)
    
    # Relation avec User
    user = relationship("User", back_populates="api_usage")
    
    # Contrainte unique: un seul enregistrement par user/jour
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uix_api_usage_user_date'),
    )


class PushToken(Base):
    """Push notification tokens (Expo Push Service)"""
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), nullable=False)
    platform = Column(String(10), nullable=False)  # ios, android
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_push_tokens_user', 'user_id'),
        Index('idx_push_tokens_token', 'token', unique=True),
    )


class AnalyticsEvent(Base):
    """📊 Analytics events from mobile/web/extension clients"""
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(String(100), nullable=False)
    platform = Column(String(20), default="mobile")  # mobile, web, extension
    properties = Column(Text, nullable=True)  # JSON string
    client_ip = Column(String(45), nullable=True)
    event_timestamp = Column(DateTime, nullable=False, default=func.now())
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index('idx_analytics_event_name', 'event_name'),
        Index('idx_analytics_user_id', 'user_id'),
        Index('idx_analytics_timestamp', 'event_timestamp'),
        Index('idx_analytics_platform', 'platform'),
    )


class AcademicPaper(Base):
    """
    📚 Academic papers linked to video analyses
    Caches papers from Semantic Scholar, OpenAlex, and arXiv
    """
    __tablename__ = "academic_papers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False, index=True)

    # Paper identification
    external_id = Column(String(100), nullable=False)  # ID from source (ss_xxx, oa_xxx, arxiv_xxx)
    doi = Column(String(255), index=True)

    # Paper metadata
    title = Column(Text, nullable=False)
    authors_json = Column(Text)  # JSON array of authors
    year = Column(Integer)
    venue = Column(String(500))
    abstract = Column(Text)
    citation_count = Column(Integer, default=0)

    # URLs
    url = Column(Text)
    pdf_url = Column(Text)

    # Source and scoring
    source = Column(String(50), nullable=False)  # semantic_scholar, openalex, arxiv
    relevance_score = Column(Float, default=0.0)
    is_open_access = Column(Boolean, default=False)
    keywords_json = Column(Text)  # JSON array of keywords

    # Timestamps
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index('idx_academic_papers_summary', 'summary_id'),
        Index('idx_academic_papers_doi', 'doi'),
    )


class TranscriptCache(Base):
    """
    💾 Cache persistant de transcripts (cross-user, L2 après Redis)
    Un seul transcript par video_id, partagé entre tous les utilisateurs.
    Le contenu est stocké dans TranscriptCacheChunk (1+ chunks).
    """
    __tablename__ = "transcript_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String(100), unique=True, nullable=False, index=True)
    platform = Column(String(20), nullable=False, default="youtube")
    lang = Column(String(10))
    char_count = Column(Integer, default=0)
    extraction_method = Column(String(50))
    chunk_count = Column(Integer, default=1)
    # Video metadata (enrichment for trending & discovery)
    video_title = Column(String(500))
    video_channel = Column(String(255))
    thumbnail_url = Column(Text)
    video_duration = Column(Integer)  # seconds
    category = Column(String(50))
    # Extended metadata (enriched via yt-dlp post-cache)
    view_count = Column(Integer)
    like_count = Column(Integer)
    comment_count = Column(Integer)
    upload_date = Column(String(20))          # YYYYMMDD
    description = Column(Text)                # truncated 2000 chars
    tags_json = Column(Text)                  # JSON array
    language = Column(String(10))             # video language (≠ transcript lang)
    channel_id = Column(String(100))
    channel_url = Column(Text)
    channel_follower_count = Column(Integer)  # subscribers
    metadata_json = Column(Text)              # raw yt-dlp dump (sans formats/thumbnails)
    metadata_enriched_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relation vers les chunks
    chunks = relationship(
        "TranscriptCacheChunk",
        back_populates="cache_entry",
        cascade="all, delete-orphan",
        order_by="TranscriptCacheChunk.chunk_index",
    )

    __table_args__ = (
        Index('idx_transcript_cache_video', 'video_id'),
        Index('idx_transcript_cache_platform', 'platform'),
    )


class TranscriptCacheChunk(Base):
    """
    📦 Chunk de transcript pour le cache persistant.
    YouTube long (3h30+) → plusieurs chunks de ~500K chars.
    TikTok (max 15min) → toujours 1 seul chunk.
    """
    __tablename__ = "transcript_cache_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cache_id = Column(Integer, ForeignKey("transcript_cache.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False, default=0)
    transcript_simple = Column(Text)
    transcript_timestamped = Column(Text)

    cache_entry = relationship("TranscriptCache", back_populates="chunks")

    __table_args__ = (
        UniqueConstraint('cache_id', 'chunk_index', name='uix_cache_chunk_index'),
        Index('idx_transcript_cache_chunks_cache', 'cache_id'),
    )


class TranscriptEmbedding(Base):
    """
    🔍 Vector embeddings for semantic search.
    Stored as JSON text (no pgvector) for Railway compatibility.
    """
    __tablename__ = "transcript_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String(100), ForeignKey("transcript_cache.video_id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    embedding_json = Column(Text, nullable=False)  # JSON array of 1024 floats
    text_preview = Column(String(500))
    token_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint('video_id', 'chunk_index', name='uix_embedding_video_chunk'),
        Index('idx_transcript_embeddings_video', 'video_id'),
    )


class DebateAnalysis(Base):
    """Table des débats IA — confrontation de perspectives vidéo"""
    __tablename__ = "debate_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Vidéo A (source)
    video_a_id = Column(String(100), nullable=False)
    video_a_title = Column(String(500))
    video_a_channel = Column(String(255))
    video_a_thumbnail = Column(Text)

    # Vidéo B (opposée, peut être trouvée automatiquement)
    video_b_id = Column(String(100))
    video_b_title = Column(String(500))
    video_b_channel = Column(String(255))
    video_b_thumbnail = Column(Text)

    # Analyse
    detected_topic = Column(String(500))
    thesis_a = Column(Text)
    thesis_b = Column(Text)
    arguments_a = Column(Text)  # JSON list
    arguments_b = Column(Text)  # JSON list
    convergence_points = Column(Text)  # JSON list
    divergence_points = Column(Text)  # JSON list
    fact_check_results = Column(Text)  # JSON dict
    debate_summary = Column(Text)

    # Métadonnées
    status = Column(String(20), default="pending")  # pending/searching/analyzing_b/comparing/fact_checking/completed/failed
    mode = Column(String(10), default="auto")  # auto / manual
    platform = Column(String(20), default="web")
    model_used = Column(String(50))
    credits_used = Column(Integer, default=0)
    lang = Column(String(5), default="fr")

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    chat_messages = relationship("DebateChatMessage", back_populates="debate", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_debate_analyses_user', 'user_id'),
        Index('idx_debate_analyses_user_created', 'user_id', 'created_at'),
    )


class DebateChatMessage(Base):
    """Messages de chat dans le contexte d'un débat"""
    __tablename__ = "debate_chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    debate_id = Column(Integer, ForeignKey("debate_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

    # Relations
    debate = relationship("DebateAnalysis", back_populates="chat_messages")

    __table_args__ = (
        Index('idx_debate_chat_messages_debate', 'debate_id'),
    )


class SharedAnalysis(Base):
    """Table des analyses partagées (liens publics)"""
    __tablename__ = "shared_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    share_token = Column(String(12), unique=True, nullable=False, index=True)
    video_id = Column(String(20), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_snapshot = Column(Text, nullable=False)  # JSON snapshot of analysis
    video_title = Column(Text)
    video_thumbnail = Column(Text)
    verdict = Column(Text)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index('idx_shared_analyses_token', 'share_token'),
        Index('idx_shared_analyses_user_video', 'user_id', 'video_id'),
    )


class VoiceSession(Base):
    """🎙️ Sessions de conversation vocale avec l'IA (ElevenLabs)"""
    __tablename__ = "voice_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(__import__('uuid').uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False, index=True)

    # ElevenLabs
    elevenlabs_agent_id = Column(String(100), nullable=True)
    elevenlabs_conversation_id = Column(String(100), nullable=True, index=True)

    # Timing
    started_at = Column(DateTime, default=func.now(), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)

    # Status: pending, active, completed, failed, timeout
    status = Column(String(20), default="pending", nullable=False, index=True)

    # Contenu
    conversation_transcript = Column(Text, nullable=True)
    language = Column(String(5), default="fr")
    platform = Column(String(20), default="web")

    # Relations
    user = relationship("User")
    summary = relationship("Summary")


class VoiceQuota(Base):
    """🎙️ Quotas mensuels de conversation vocale"""
    __tablename__ = "voice_quotas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    seconds_used = Column(Integer, default=0)
    seconds_limit = Column(Integer, nullable=False)
    sessions_count = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_voice_quota_user_month"),
        Index("ix_voice_quota_user_period", "user_id", "year", "month"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency pour obtenir une session DB"""
    try:
        async with async_session_maker() as session:
            try:
                yield session
            finally:
                await session.close()
    except Exception as e:
        error_msg = str(e).lower()
        if "password authentication" in error_msg or "could not connect" in error_msg or "connection refused" in error_msg:
            print(f"❌ Database connection failed: {e}", flush=True)
            from fastapi import HTTPException
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable. Please try again later."
            )
        raise


async def run_cascade_migration():
    """
    Migration: Ajoute ON DELETE CASCADE aux foreign keys user_id
    Permet la suppression des comptes utilisateurs sans erreur de contrainte FK
    """
    migration_queries = [
        # summaries
        "ALTER TABLE summaries DROP CONSTRAINT IF EXISTS summaries_user_id_fkey",
        "ALTER TABLE summaries ADD CONSTRAINT summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # daily_quotas
        "ALTER TABLE daily_quotas DROP CONSTRAINT IF EXISTS daily_quotas_user_id_fkey",
        "ALTER TABLE daily_quotas ADD CONSTRAINT daily_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # credit_transactions
        "ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey",
        "ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # playlist_analyses
        "ALTER TABLE playlist_analyses DROP CONSTRAINT IF EXISTS playlist_analyses_user_id_fkey",
        "ALTER TABLE playlist_analyses ADD CONSTRAINT playlist_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # chat_messages
        "ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey",
        "ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # chat_quotas
        "ALTER TABLE chat_quotas DROP CONSTRAINT IF EXISTS chat_quotas_user_id_fkey",
        "ALTER TABLE chat_quotas ADD CONSTRAINT chat_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # playlist_chat_messages
        "ALTER TABLE playlist_chat_messages DROP CONSTRAINT IF EXISTS playlist_chat_messages_user_id_fkey",
        "ALTER TABLE playlist_chat_messages ADD CONSTRAINT playlist_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # web_search_usage
        "ALTER TABLE web_search_usage DROP CONSTRAINT IF EXISTS web_search_usage_user_id_fkey",
        "ALTER TABLE web_search_usage ADD CONSTRAINT web_search_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # admin_logs
        "ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey",
        "ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE",
        # task_status
        "ALTER TABLE task_status DROP CONSTRAINT IF EXISTS task_status_user_id_fkey",
        "ALTER TABLE task_status ADD CONSTRAINT task_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # api_usage
        "ALTER TABLE api_usage DROP CONSTRAINT IF EXISTS api_usage_user_id_fkey",
        "ALTER TABLE api_usage ADD CONSTRAINT api_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        # academic_papers
        "ALTER TABLE academic_papers DROP CONSTRAINT IF EXISTS academic_papers_summary_id_fkey",
        "ALTER TABLE academic_papers ADD CONSTRAINT academic_papers_summary_id_fkey FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE",
        # push_tokens
        "ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_fkey",
        "ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    ]

    async with engine.begin() as conn:
        for query in migration_queries:
            try:
                await conn.execute(text(query))
            except Exception as e:
                # Ignore errors (table might not exist yet)
                print(f"⚠️ Migration query skipped: {str(e)[:50]}", flush=True)

    print("✅ CASCADE delete migration completed", flush=True)


async def run_schema_migrations():
    """Migrations de schéma idempotentes (ALTER TABLE pour colonnes manquantes)"""
    migrations = [
        # Hierarchical Digest Pipeline (Feb 2026)
        "ALTER TABLE summaries ADD COLUMN IF NOT EXISTS full_digest TEXT",
        # 🎵 TikTok support (Mar 2026)
        "ALTER TABLE summaries ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'youtube'",
        # VideoChunks table (créée par create_all si absente, mais on sécurise)
        """
        CREATE TABLE IF NOT EXISTS video_chunks (
            id SERIAL PRIMARY KEY,
            summary_id INTEGER NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            start_seconds INTEGER NOT NULL DEFAULT 0,
            end_seconds INTEGER NOT NULL DEFAULT 0,
            chunk_text TEXT NOT NULL,
            chunk_digest TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_video_chunks_summary_id ON video_chunks(summary_id)",
        # 💾 TranscriptCache — persistent L2 cache (Mar 2026)
        """
        CREATE TABLE IF NOT EXISTS transcript_cache (
            id SERIAL PRIMARY KEY,
            video_id VARCHAR(100) UNIQUE NOT NULL,
            platform VARCHAR(20) NOT NULL DEFAULT 'youtube',
            lang VARCHAR(10),
            char_count INTEGER DEFAULT 0,
            extraction_method VARCHAR(50),
            chunk_count INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_transcript_cache_video ON transcript_cache(video_id)",
        "CREATE INDEX IF NOT EXISTS idx_transcript_cache_platform ON transcript_cache(platform)",
        """
        CREATE TABLE IF NOT EXISTS transcript_cache_chunks (
            id SERIAL PRIMARY KEY,
            cache_id INTEGER NOT NULL REFERENCES transcript_cache(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL DEFAULT 0,
            transcript_simple TEXT,
            transcript_timestamped TEXT,
            UNIQUE(cache_id, chunk_index)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_transcript_cache_chunks_cache ON transcript_cache_chunks(cache_id)",
        # 🔍 TranscriptCache metadata enrichment (Mar 2026)
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS video_title VARCHAR(500)",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS video_channel VARCHAR(255)",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS thumbnail_url TEXT",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS video_duration INTEGER",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS category VARCHAR(50)",
        # 🔍 TranscriptCache extended metadata enrichment (Mar 2026)
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS view_count INTEGER",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS like_count INTEGER",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS comment_count INTEGER",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS upload_date VARCHAR(20)",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS tags_json TEXT",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS language VARCHAR(10)",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100)",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS channel_url TEXT",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS channel_follower_count INTEGER",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS metadata_json TEXT",
        "ALTER TABLE transcript_cache ADD COLUMN IF NOT EXISTS metadata_enriched_at TIMESTAMP",
        # 🔍 TranscriptEmbedding for semantic search (Mar 2026)
        """
        CREATE TABLE IF NOT EXISTS transcript_embeddings (
            id SERIAL PRIMARY KEY,
            video_id VARCHAR(100) NOT NULL REFERENCES transcript_cache(video_id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL DEFAULT 0,
            embedding_json TEXT NOT NULL,
            text_preview VARCHAR(500),
            token_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(video_id, chunk_index)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_video ON transcript_embeddings(video_id)",
        # 🆚 VideoComparison table (Mar 2026)
        """
        CREATE TABLE IF NOT EXISTS video_comparisons (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            summary_a_id INTEGER NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
            summary_b_id INTEGER NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
            comparison_json TEXT NOT NULL,
            lang VARCHAR(5) DEFAULT 'fr',
            model_used VARCHAR(50),
            credits_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_comparisons_user ON video_comparisons(user_id)",
        # 🎭 DebateAnalysis table (Mar 2026)
        """
        CREATE TABLE IF NOT EXISTS debate_analyses (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            video_a_id VARCHAR(100) NOT NULL,
            video_a_title VARCHAR(500),
            video_a_channel VARCHAR(255),
            video_a_thumbnail TEXT,
            video_b_id VARCHAR(100),
            video_b_title VARCHAR(500),
            video_b_channel VARCHAR(255),
            video_b_thumbnail TEXT,
            detected_topic VARCHAR(500),
            thesis_a TEXT,
            thesis_b TEXT,
            arguments_a TEXT,
            arguments_b TEXT,
            convergence_points TEXT,
            divergence_points TEXT,
            fact_check_results TEXT,
            debate_summary TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            mode VARCHAR(10) DEFAULT 'auto',
            platform VARCHAR(20) DEFAULT 'web',
            model_used VARCHAR(50),
            credits_used INTEGER DEFAULT 0,
            lang VARCHAR(5) DEFAULT 'fr',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_debate_analyses_user ON debate_analyses(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_debate_analyses_user_created ON debate_analyses(user_id, created_at)",
        # 🎭 DebateChatMessage table (Mar 2026)
        """
        CREATE TABLE IF NOT EXISTS debate_chat_messages (
            id SERIAL PRIMARY KEY,
            debate_id INTEGER NOT NULL REFERENCES debate_analyses(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_debate_chat_messages_debate ON debate_chat_messages(debate_id)",
    ]
    async with engine.begin() as conn:
        for sql in migrations:
            try:
                await conn.execute(text(sql.strip()))
            except Exception as e:
                print(f"⚠️ Migration skipped (may already exist): {e}", flush=True)
    print("✅ Schema migrations completed", flush=True)


async def init_db():
    """Initialise la base de données et crée les tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Appliquer les migrations de schéma (ALTER TABLE pour colonnes manquantes)
    await run_schema_migrations()

    # Appliquer la migration CASCADE delete
    await run_cascade_migration()

    # Créer l'admin par défaut
    await create_admin_if_not_exists()
    print("✅ Database initialized", flush=True)


async def close_db():
    """Ferme les connexions à la base de données"""
    await engine.dispose()


def hash_password(password: str) -> str:
    """
    Hash un mot de passe de manière sécurisée.

    Utilise bcrypt pour les nouveaux hashs, mais reste compatible
    avec les anciens hashs SHA256 pour la migration.
    """
    try:
        import bcrypt
        # Utiliser bcrypt pour un hashing sécurisé
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    except ImportError:
        # Fallback SHA256 si bcrypt non disponible
        print("⚠️ bcrypt not available, using SHA256 fallback", flush=True)
        return hashlib.sha256(
            (f"deepsight_v1_ocean_salt_{password}").encode()
        ).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """
    Vérifie un mot de passe contre son hash.

    Compatible avec:
    - Nouveaux hashs bcrypt ($2b$...)
    - Anciens hashs SHA256 (64 caractères hex)
    """
    if not password_hash:
        return False

    # Détection du type de hash
    if password_hash.startswith('$2b$') or password_hash.startswith('$2a$'):
        # Hash bcrypt
        try:
            import bcrypt
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except ImportError:
            print("⚠️ bcrypt not available for verification", flush=True)
            return False
    else:
        # Ancien hash SHA256 - vérification et migration recommandée
        legacy_hash = hashlib.sha256(
            (f"deepsight_v1_ocean_salt_{password}").encode()
        ).hexdigest()
        return legacy_hash == password_hash


async def create_admin_if_not_exists():
    """Crée l'utilisateur admin s'il n'existe pas"""
    from sqlalchemy import select
    
    async with async_session_maker() as session:
        # Vérifier si l'admin existe
        # scalars().first() au lieu de scalar_one_or_none() pour éviter
        # "Multiple rows found" si username ET email matchent des users différents
        result = await session.execute(
            select(User).where(
                (User.username == ADMIN_CONFIG["ADMIN_USERNAME"]) |
                (User.email == ADMIN_CONFIG["ADMIN_EMAIL"])
            ).order_by(User.id)
        )
        existing = result.scalars().first()
        
        correct_hash = hash_password(ADMIN_CONFIG["ADMIN_PASSWORD"])
        
        if not existing:
            # Créer l'admin
            admin = User(
                username=ADMIN_CONFIG["ADMIN_USERNAME"],
                email=ADMIN_CONFIG["ADMIN_EMAIL"],
                password_hash=correct_hash,
                email_verified=True,
                plan="unlimited",
                is_admin=True,
                credits=999999
            )
            session.add(admin)
            await session.commit()
            print(f"✅ Admin user created: {ADMIN_CONFIG['ADMIN_EMAIL']}", flush=True)
        else:
            # Mettre à jour le hash si différent
            if existing.password_hash != correct_hash:
                existing.password_hash = correct_hash
                existing.is_admin = True
                existing.plan = "unlimited"
                await session.commit()
                print(f"✅ Admin user updated", flush=True)
