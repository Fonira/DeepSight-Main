"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🗄️ DATABASE — SQLite/PostgreSQL avec SQLAlchemy Async                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import hashlib
from typing import AsyncGenerator
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Float,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Index,
    UniqueConstraint,
    CheckConstraint,
    text,
    JSON,
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

from core.config import DATA_DIR, ADMIN_CONFIG

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
    _engine_kwargs.update(
        {
            "pool_size": int(os.environ.get("DB_POOL_SIZE", "5")),
            "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "3")),
            "pool_timeout": 30,
            "pool_recycle": 1800,  # Recycler toutes les 30min (vs 1h) pour libérer les connexions idle
        }
    )

    # Configurer SSL pour asyncpg via connect_args
    if _use_ssl:
        # ssl=True crée un contexte SSL par défaut pour asyncpg
        _engine_kwargs["connect_args"] = {"ssl": True}

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

# Session factory avec autoflush désactivé pour meilleures performances
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)
# 🆕 Alias publié pour les hooks background (chat bucket digest, voice digest…)
# qui ouvrent leur propre session indépendante de la requête HTTP.
async_session_factory = async_session_maker

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
    # Pricing v2 — grandfathering: True = sub cree sous prix legacy (Plus 4.99 / Pro 9.99)
    is_legacy_pricing = Column(Boolean, default=False, nullable=False, server_default="false")

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
    voice_preferences = Column(Text, default=None)  # JSON blob: voice_id, speed, stability, etc.

    # Ambient Lighting v3 + futures préférences UI utilisateur (clé/valeur souple)
    # Cross-DB: SQLAlchemy JSON type → JSONB sur PG, TEXT sérialisé sur SQLite.
    preferences = Column(JSON, nullable=True, default=dict, server_default="{}")

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    summaries = relationship("Summary", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    api_usage = relationship("ApiUsage", back_populates="user", cascade="all, delete-orphan")
    flashcard_reviews = relationship("FlashcardReview", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
    study_stats = relationship("UserStudyStats", back_populates="user", uselist=False, cascade="all, delete-orphan")
    user_badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")

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
    enrichment_sources = Column(Text, nullable=True)  # JSON: [{title, url, snippet}]
    enrichment_data = Column(Text, nullable=True)  # JSON: {level, sources, enriched_at}

    # Hierarchical Digest Pipeline (Feb 2026)
    full_digest = Column(Text, nullable=True)  # Assembled full digest from chunk digests (~6-10K chars)

    # 🆕 Duration Router v1.0 (Mar 2026) — Index structuré (table des matières temporelle)
    structured_index = Column(Text, nullable=True)  # JSON: [{ts, t, title, summary, kw}]

    # 📊 Engagement metadata (Mar 2026)
    view_count = Column(Integer, nullable=True)
    like_count = Column(Integer, nullable=True)
    comment_count = Column(Integer, nullable=True)
    share_count = Column(Integer, nullable=True)
    channel_follower_count = Column(Integer, nullable=True)
    content_type = Column(String(50), nullable=True)
    video_description = Column(Text, nullable=True)
    channel_id = Column(String(100), nullable=True)
    music_title = Column(String(500), nullable=True)
    music_author = Column(String(255), nullable=True)
    source_tags = Column(Text, nullable=True)  # JSON list
    carousel_images = Column(Text, nullable=True)  # JSON list

    # Relations
    user = relationship("User", back_populates="summaries")
    chat_messages = relationship("ChatMessage", back_populates="summary", cascade="all, delete-orphan")
    chunks = relationship(
        "VideoChunk", back_populates="summary", cascade="all, delete-orphan", order_by="VideoChunk.chunk_index"
    )

    __table_args__ = (
        Index("idx_summaries_user", "user_id"),
        Index("idx_summaries_playlist", "playlist_id"),
        # 🆕 Indexes optimisés pour les requêtes fréquentes
        Index("idx_summaries_user_created", "user_id", "created_at"),  # Pour history pagination
        Index("idx_summaries_user_video", "user_id", "video_id"),  # Pour duplicate check
        Index("idx_summaries_user_favorite", "user_id", "is_favorite"),  # Pour filtrage favoris
        Index("idx_summaries_user_category", "user_id", "category"),  # Pour filtrage catégorie
    )


class DailyQuota(Base):
    """Table des quotas journaliers"""

    __tablename__ = "daily_quotas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    videos_used = Column(Integer, default=0)

    __table_args__ = (Index("idx_daily_quota_user_date", "user_id", "quota_date", unique=True),)


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

    __table_args__ = (Index("idx_comparisons_user", "user_id"),)


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
    """Table des messages de chat - v6.0 unified text+voice timeline (Spec #1)"""

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    summary_id = Column(Integer, ForeignKey("summaries.id"), nullable=True, index=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

    # 🆕 v5.0: Métadonnées pour fact-checking et sources
    web_search_used = Column(Boolean, default=False)
    fact_checked = Column(Boolean, default=False)
    sources_json = Column(Text, nullable=True)  # JSON des sources web
    enrichment_level = Column(String(20), nullable=True)  # none, light, full, deep

    # 🆕 v6.0 (Spec #1): Unified text+voice timeline.
    #   source            : 'text' (default) or 'voice'.
    #   voice_session_id  : FK voice_sessions.id when source='voice'.
    #   voice_speaker     : 'user' | 'agent' (only set for source='voice').
    #   time_in_call_secs : offset within the call (for ordering).
    source = Column(String(10), nullable=False, server_default="text", default="text")
    voice_session_id = Column(
        String(36),
        ForeignKey("voice_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    voice_speaker = Column(String(10), nullable=True)
    time_in_call_secs = Column(Float, nullable=True)

    # Relations
    user = relationship("User", back_populates="chat_messages")
    summary = relationship("Summary", back_populates="chat_messages")

    __table_args__ = (
        Index("idx_chat_messages_summary", "summary_id"),
        Index("ix_chat_messages_summary_created", "summary_id", "created_at"),
        Index("ix_chat_messages_voice_session", "voice_session_id"),
    )


class ChatQuota(Base):
    """Table des quotas de chat journaliers"""

    __tablename__ = "chat_quotas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date = Column(String(10), nullable=False)
    daily_count = Column(Integer, default=0)

    __table_args__ = (Index("idx_chat_quotas_user_date", "user_id", "quota_date", unique=True),)


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

    __table_args__ = (Index("idx_web_search_usage", "user_id", "month_year", unique=True),)


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
    request_count = Column(Integer, default=0)  # Nombre de requêtes ce jour
    credits_used = Column(Integer, default=0)  # Crédits consommés via API
    error_count = Column(Integer, default=0)  # Nombre d'erreurs (pour monitoring)

    # Relation avec User
    user = relationship("User", back_populates="api_usage")

    # Contrainte unique: un seul enregistrement par user/jour
    __table_args__ = (UniqueConstraint("user_id", "date", name="uix_api_usage_user_date"),)


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
        Index("idx_push_tokens_user", "user_id"),
        Index("idx_push_tokens_token", "token", unique=True),
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
        Index("idx_analytics_event_name", "event_name"),
        Index("idx_analytics_user_id", "user_id"),
        Index("idx_analytics_timestamp", "event_timestamp"),
        Index("idx_analytics_platform", "platform"),
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
        Index("idx_academic_papers_summary", "summary_id"),
        Index("idx_academic_papers_doi", "doi"),
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
    upload_date = Column(String(20))  # YYYYMMDD
    description = Column(Text)  # truncated 2000 chars
    tags_json = Column(Text)  # JSON array
    language = Column(String(10))  # video language (≠ transcript lang)
    channel_id = Column(String(100))
    channel_url = Column(Text)
    channel_follower_count = Column(Integer)  # subscribers
    metadata_json = Column(Text)  # raw yt-dlp dump (sans formats/thumbnails)
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
        Index("idx_transcript_cache_video", "video_id"),
        Index("idx_transcript_cache_platform", "platform"),
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
        UniqueConstraint("cache_id", "chunk_index", name="uix_cache_chunk_index"),
        Index("idx_transcript_cache_chunks_cache", "cache_id"),
    )


class TranscriptEmbedding(Base):
    """
    🔍 Vector embeddings for semantic search.
    Stored as JSON text (no pgvector) for Railway compatibility.
    """

    __tablename__ = "transcript_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(
        String(100), ForeignKey("transcript_cache.video_id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index = Column(Integer, nullable=False, default=0)
    embedding_json = Column(Text, nullable=False)  # JSON array of 1024 floats (mistral-embed dim)
    text_preview = Column(String(500))
    token_count = Column(Integer, default=0)
    # Mistral-First Phase 6 — track which embedding model produced this row,
    # so a future bump (e.g. mistral-embed-2602) can be applied progressively
    # via scripts/reembed_progressive.py without downtime.
    model_version = Column(String(50), nullable=False, default="mistral-embed", server_default="mistral-embed")
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("video_id", "chunk_index", name="uix_embedding_video_chunk"),
        Index("idx_transcript_embeddings_video", "video_id"),
        Index("idx_transcript_embeddings_model_version", "model_version"),
    )


# ════════════════════════════════════════════════════════════════════════════════
# 🔍 SEARCH INDEX V1 — Semantic Search étendu (Summary + Flashcard + Quiz + Chat)
# ════════════════════════════════════════════════════════════════════════════════


class Flashcard(Base):
    """Flashcards persistées (matérialisation pour permettre l'indexation sémantique).
    Avant V1 elles étaient générées à la volée par study/router.py sans persistance."""

    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    position = Column(Integer, nullable=False, default=0)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "position", name="uix_flashcards_summary_position"),
        Index("ix_flashcards_summary", "summary_id"),
        Index("ix_flashcards_user", "user_id"),
    )


class QuizQuestion(Base):
    """Quiz questions persistées (matérialisation pour permettre l'indexation)."""

    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    position = Column(Integer, nullable=False, default=0)
    question = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)  # JSON list[str]
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(String(20), nullable=False, default="standard", server_default="standard")
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "position", name="uix_quiz_summary_position"),
        Index("ix_quiz_summary", "summary_id"),
        Index("ix_quiz_user", "user_id"),
    )


class SummaryEmbedding(Base):
    """Embeddings par section du structured_index d'un Summary."""

    __tablename__ = "summary_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    section_index = Column(Integer, nullable=False)
    section_ref = Column(String(100), nullable=True)  # ts ou anchor
    embedding_json = Column(Text, nullable=False)  # JSON 1024 floats
    text_preview = Column(String(500))
    token_count = Column(Integer, default=0)
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    source_metadata = Column(Text, nullable=True)  # JSON {tab, start_ts?, end_ts?, anchor?}
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "section_index", name="uix_summary_emb_section"),
        Index("ix_summary_emb_user", "user_id"),
        Index("ix_summary_emb_summary", "summary_id"),
        Index("ix_summary_emb_model", "model_version"),
    )


class FlashcardEmbedding(Base):
    """1 embedding par flashcard (Q+A concaténés)."""

    __tablename__ = "flashcard_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flashcard_id = Column(
        Integer,
        ForeignKey("flashcards.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    embedding_json = Column(Text, nullable=False)
    text_preview = Column(String(500))
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_flashcard_emb_user", "user_id"),
        Index("ix_flashcard_emb_summary", "summary_id"),
    )


class QuizEmbedding(Base):
    """1 embedding par question quiz (question + bonne réponse)."""

    __tablename__ = "quiz_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quiz_question_id = Column(
        Integer,
        ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    embedding_json = Column(Text, nullable=False)
    text_preview = Column(String(500))
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_quiz_emb_user", "user_id"),
        Index("ix_quiz_emb_summary", "summary_id"),
    )


class ChatEmbedding(Base):
    """1 embedding par turn user+assistant fusionné dans une conversation."""

    __tablename__ = "chat_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(
        Integer,
        ForeignKey("summaries.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    turn_index = Column(Integer, nullable=False)
    user_message_id = Column(
        Integer,
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=True,
    )
    agent_message_id = Column(
        Integer,
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=True,
    )
    embedding_json = Column(Text, nullable=False)
    text_preview = Column(String(500))
    token_count = Column(Integer, default=0)
    model_version = Column(
        String(50), nullable=False, default="mistral-embed", server_default="mistral-embed"
    )
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("summary_id", "turn_index", name="uix_chat_emb_turn"),
        Index("ix_chat_emb_user", "user_id"),
        Index("ix_chat_emb_summary_turn", "summary_id", "turn_index"),
    )


class ExplainPassageCache(Base):
    """Cache tooltip IA — 7 jours par sha256(query+passage_text+summary_id)."""

    __tablename__ = "explain_passage_cache"

    cache_key = Column(String(64), primary_key=True)
    explanation = Column(Text, nullable=False)
    model_used = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (Index("ix_explain_cache_expires", "expires_at"),)


class ChannelContext(Base):
    """
    📺 Cache du contexte de chaîne (YouTube/TikTok), cross-user.

    Stocke jusqu'à ~50 vidéos récentes (titres + descriptions + tags +
    métadonnées chaîne) pour permettre à Mistral de calibrer son analyse
    (chaîne poubelle / dangereuse / divertissement / éducative).

    Clé primaire composite (channel_id, platform) — refresh par upsert
    (ON CONFLICT). TTL géré côté application via ``expires_at`` + purge.
    Cf. migration 014_add_channel_contexts.
    """

    __tablename__ = "channel_contexts"

    channel_id = Column(String(128), primary_key=True, nullable=False)
    platform = Column(String(16), primary_key=True, nullable=False)
    name = Column(Text)
    description = Column(Text)
    subscriber_count = Column(BigInteger)
    video_count = Column(Integer)
    # JSON cross-DB : JSONB sur PostgreSQL, TEXT sérialisé sur SQLite.
    tags = Column(JSON, nullable=True, default=list, server_default="[]")
    categories = Column(JSON, nullable=True, default=list, server_default="[]")
    # last_videos : liste d'objets {title, description, tags, view_count, upload_date}
    last_videos = Column(JSON, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "platform IN ('youtube', 'tiktok')",
            name="ck_channel_contexts_platform",
        ),
        Index("idx_channel_contexts_expires_at", "expires_at"),
    )


class DebateAnalysis(Base):
    """Table des débats IA — confrontation de perspectives vidéo"""

    __tablename__ = "debate_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Vidéo A (source)
    video_a_id = Column(String(100), nullable=False)
    platform_a = Column(String(20), default="youtube")  # youtube / tiktok
    video_a_title = Column(String(500))
    video_a_channel = Column(String(255))
    video_a_thumbnail = Column(Text)

    # Vidéo B (opposée, peut être trouvée automatiquement)
    video_b_id = Column(String(100))
    platform_b = Column(String(20))  # youtube / tiktok
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
    status = Column(
        String(20), default="pending"
    )  # pending/searching/analyzing_b/comparing/fact_checking/completed/failed
    mode = Column(String(10), default="auto")  # auto / manual
    platform = Column(String(20), default="web")
    model_used = Column(String(50))
    credits_used = Column(Integer, default=0)
    lang = Column(String(5), default="fr")

    # 🎯 Débat IA v2 — colonnes ajoutées par migration 017
    miro_board_url = Column(String(500))  # NULL si pas généré
    miro_board_id = Column(String(100))  # ID Miro API
    relation_type_dominant = Column(
        String(20), default="opposite", nullable=False, server_default="opposite"
    )  # opposite | complement | nuance — calculé après chaque add-perspective

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    chat_messages = relationship("DebateChatMessage", back_populates="debate", cascade="all, delete-orphan")
    perspectives = relationship(
        "DebatePerspective",
        back_populates="debate",
        cascade="all, delete-orphan",
        order_by="DebatePerspective.position",
    )

    __table_args__ = (
        Index("idx_debate_analyses_user", "user_id"),
        Index("idx_debate_analyses_user_created", "user_id", "created_at"),
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

    __table_args__ = (Index("idx_debate_chat_messages_debate", "debate_id"),)


class DebatePerspective(Base):
    """Perspective ajoutée à un débat v2 (B initiale + ajouts complément/nuance).

    Migration 017 — Débat IA v2 mode adaptatif 1-N (max 3 perspectives par débat).
    Position 0 = perspective B initiale (héritée de DebateAnalysis pré-v2 par backfill).
    Position 1-2 = perspectives ajoutées par l'utilisateur (complément ou nuance).
    """

    __tablename__ = "debate_perspectives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    debate_id = Column(
        Integer,
        ForeignKey("debate_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)
    # 0 = perspective B initiale (auto-search ou manuelle), 1-2 = ajouts user

    video_id = Column(String(100), nullable=False)
    platform = Column(String(20), default="youtube", nullable=False)
    video_title = Column(String(500))
    video_channel = Column(String(255))
    video_thumbnail = Column(Text)

    thesis = Column(Text)
    arguments = Column(Text)  # JSON list (même schema que arguments_a/b)

    relation_type = Column(
        String(20), nullable=False, default="opposite", server_default="opposite"
    )  # opposite | complement | nuance
    # Stocké comme String pour souplesse (v2.1 pourra ajouter 'historical', 'critical_reading'...)

    channel_quality_score = Column(Float, default=0.5, server_default="0.5")
    audience_level = Column(
        String(20), default="unknown", server_default="unknown"
    )  # vulgarisation | expert | unknown

    fact_check_results = Column(Text)  # JSON list

    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relations
    debate = relationship("DebateAnalysis", back_populates="perspectives")

    __table_args__ = (
        Index("idx_debate_perspectives_debate", "debate_id"),
        Index("idx_debate_perspectives_debate_position", "debate_id", "position"),
        UniqueConstraint("debate_id", "position", name="uq_debate_perspective_position"),
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
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    created_at = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("idx_shared_analyses_token", "share_token"),
        Index("idx_shared_analyses_user_video", "user_id", "video_id"),
    )


class VoiceSession(Base):
    """🎙️ Sessions de conversation vocale avec l'IA (ElevenLabs)"""

    __tablename__ = "voice_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Exactement UN des deux doit être non-null (XOR validé côté application)
    summary_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=True, index=True)
    debate_id = Column(Integer, ForeignKey("debate_analyses.id", ondelete="CASCADE"), nullable=True, index=True)

    # ElevenLabs
    elevenlabs_agent_id = Column(String(100), nullable=True)
    elevenlabs_conversation_id = Column(String(100), nullable=True, index=True)

    # Timing
    started_at = Column(DateTime, default=func.now(), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)

    # Status: pending, active, completed, failed, timeout
    status = Column(String(20), default="pending", nullable=False, index=True)

    # Agent type (explorer | tutor | debate_moderator | quiz_coach | onboarding)
    agent_type = Column(String(40), default="explorer", nullable=False, index=True)

    # Contenu
    conversation_transcript = Column(Text, nullable=True)
    language = Column(String(5), default="fr")
    platform = Column(String(20), default="web")

    # Quick Voice Call (V1) — Streaming session flags (migration 008)
    # Marks sessions launched via Quick Voice Call (asynchronous progressive
    # context injection). Plain (non-streaming) voice sessions keep this False.
    is_streaming_session = Column(Boolean, default=False, nullable=False, server_default="false")
    # Final % of transcript chunks delivered to the agent before the call ended.
    # NULL while session is still active, [0.0, 100.0] once orchestrator settles.
    context_completion_pct = Column(Float, nullable=True)

    # 🆕 v6.1 (Spec merge voice ↔ chat 2026-04-29): digest end-of-session
    digest_text = Column(Text, nullable=True)
    digest_generated_at = Column(DateTime(timezone=True), nullable=True)

    # Relations
    user = relationship("User")
    summary = relationship("Summary")
    debate = relationship("DebateAnalysis")


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


class VoiceQuotaStreaming(Base):
    """🎙️ Quick Voice Call A+D quota + purchased balance (migrations 008 + 011).

    Tracks quota for the streaming Quick Voice Call feature using the strict
    A+D model:
      * Free  : ``lifetime_trial_used`` boolean, single 3-min lifetime trial
      * Pro   : ``monthly_minutes_used`` rolling 30-day window, capped at 30
      * Expert: ``monthly_minutes_used`` rolling 30-day window, capped at 120

    The ``purchased_minutes`` column (migration 011) holds a non-expiring
    balance from voice top-up pack purchases, consumed AFTER the plan
    allowance is drained.

    Note: this is intentionally distinct from the legacy ``VoiceQuota`` model
    (table ``voice_quotas``, plural) which tracks per-month seconds for the
    classic voice chat. The new table is named ``voice_quota`` (singular) per
    the Quick Voice Call spec § a "Migration Alembic 008".
    """

    __tablename__ = "voice_quota"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    plan = Column(String(20), nullable=False)
    monthly_minutes_used = Column(Float, nullable=False, default=0.0, server_default="0")
    monthly_period_start = Column(DateTime(timezone=True), nullable=False)
    lifetime_trial_used = Column(Boolean, nullable=False, default=False, server_default="false")
    lifetime_trial_used_at = Column(DateTime(timezone=True), nullable=True)
    # Non-expiring balance (top-up packs, migration 011)
    purchased_minutes = Column(Float, nullable=False, default=0.0, server_default="0")


class VoiceCreditPack(Base):
    """🎙️ Catalog d'un pack de minutes vocales achetable (migration 011)."""

    __tablename__ = "voice_credit_packs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    minutes = Column(Integer, nullable=False)
    price_cents = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    stripe_product_id = Column(String(100), nullable=True)
    stripe_price_id = Column(String(100), nullable=True, unique=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    display_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VoiceCreditPurchase(Base):
    """🎙️ Historique achat pack — 1 row par Stripe checkout completion (migration 011)."""

    __tablename__ = "voice_credit_purchases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pack_id = Column(
        Integer,
        ForeignKey("voice_credit_packs.id"),
        nullable=False,
    )
    minutes_purchased = Column(Integer, nullable=False)
    price_paid_cents = Column(Integer, nullable=False)
    stripe_session_id = Column(String(255), unique=True, nullable=True)
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="'pending'")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_voice_credit_purchases_user_status", "user_id", "status"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 GAMIFICATION & SPACED REPETITION (Mar 2026)
# ═══════════════════════════════════════════════════════════════════════════════


class FlashcardReview(Base):
    """Stocke chaque review FSRS d'une flashcard par un utilisateur"""

    __tablename__ = "flashcard_reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False, index=True)
    card_index = Column(Integer, nullable=False)  # Index de la flashcard dans le set
    card_front = Column(Text, nullable=False)  # Front de la carte (pour identification)

    # FSRS parameters
    stability = Column(Float, default=0.0)  # Stabilité mémoire (jours)
    difficulty = Column(Float, default=0.3)  # Difficulté 0-1
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=0)
    reps = Column(Integer, default=0)  # Nombre de répétitions
    lapses = Column(Integer, default=0)  # Nombre d'oublis
    state = Column(Integer, default=0)  # 0=New, 1=Learning, 2=Review, 3=Relearning
    last_rating = Column(Integer, nullable=True)  # 1=Again, 2=Hard, 3=Good, 4=Easy
    due_date = Column(DateTime, nullable=True)  # Prochaine date de révision
    last_review = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="flashcard_reviews")

    __table_args__ = (
        Index("idx_review_user_summary", "user_id", "summary_id"),
        Index("idx_review_due", "user_id", "due_date"),
    )


class StudySession(Base):
    """Historique des sessions de révision"""

    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summary_id = Column(Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=True)
    session_type = Column(String(20), default="flashcards")  # flashcards, quiz, mixed
    cards_reviewed = Column(Integer, default=0)
    cards_correct = Column(Integer, default=0)
    xp_earned = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="study_sessions")

    __table_args__ = (Index("idx_session_user_date", "user_id", "started_at"),)


class UserStudyStats(Base):
    """Stats agrégées de gamification par utilisateur (singleton par user)"""

    __tablename__ = "user_study_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_study_date = Column(Date, nullable=True)
    streak_freeze_available = Column(Integer, default=1)  # Freeze gratuits restants
    total_cards_reviewed = Column(Integer, default=0)
    total_cards_mastered = Column(Integer, default=0)  # mastery >= 90%
    total_sessions = Column(Integer, default=0)
    total_time_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="study_stats")


class Badge(Base):
    """Définitions des badges (statique, remplie au démarrage)"""

    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # "first_flip", "streak_7"
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    icon = Column(String(10), nullable=False)  # Emoji
    rarity = Column(String(20), default="common")  # common, rare, epic, legendary
    category = Column(String(30), default="general")  # general, streak, mastery, speed, quiz
    condition_type = Column(String(30), nullable=False)  # threshold, event, compound
    condition_value = Column(Integer, default=1)  # Ex: 7 pour streak_7
    created_at = Column(DateTime, default=func.now())


class UserBadge(Base):
    """Badges débloqués par un utilisateur"""

    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(Integer, ForeignKey("badges.id", ondelete="CASCADE"), nullable=False, index=True)
    earned_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="user_badges")
    badge = relationship("Badge")

    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)


class StudyDailyActivity(Base):
    """Pour le heat map (1 row par jour par user)"""

    __tablename__ = "study_daily_activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    cards_reviewed = Column(Integer, default=0)
    xp_earned = Column(Integer, default=0)
    sessions_count = Column(Integer, default=0)
    time_seconds = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_activity"),
        Index("idx_daily_user_date", "user_id", "date"),
    )


class ChatTextDigest(Base):
    """Digest 2-3 bullets d'un bucket de 20 messages chat texte sur une vidéo.

    Permet de réinjecter un résumé condensé des échanges anciens dans le contexte
    voice/chat sans dépasser les limites tokens (cf. Spec merge 2026-04-29).
    """

    __tablename__ = "chat_text_digests"

    id = Column(Integer, primary_key=True)
    summary_id = Column(
        Integer, ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    first_message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    last_message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    digest_text = Column(Text, nullable=False)
    msg_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_chat_text_digests_summary_user", "summary_id", "user_id"),
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
        if (
            "password authentication" in error_msg
            or "could not connect" in error_msg
            or "connection refused" in error_msg
        ):
            print(f"❌ Database connection failed: {e}", flush=True)
            from fastapi import HTTPException

            raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again later.")
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
        # 🆕 Duration Router v1.0 — structured_index (Mar 2026)
        "ALTER TABLE summaries ADD COLUMN IF NOT EXISTS structured_index TEXT",
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
        # model_version added 2026-05-02 (Mistral-First Phase 6) — alembic 013
        """
        CREATE TABLE IF NOT EXISTS transcript_embeddings (
            id SERIAL PRIMARY KEY,
            video_id VARCHAR(100) NOT NULL REFERENCES transcript_cache(video_id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL DEFAULT 0,
            embedding_json TEXT NOT NULL,
            text_preview VARCHAR(500),
            token_count INTEGER DEFAULT 0,
            model_version VARCHAR(50) NOT NULL DEFAULT 'mistral-embed',
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(video_id, chunk_index)
        )
        """,
        # Idempotent ALTER for already-bootstrapped DBs that pre-date model_version.
        "ALTER TABLE transcript_embeddings ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) NOT NULL DEFAULT 'mistral-embed'",
        "CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_video ON transcript_embeddings(video_id)",
        "CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_model_version ON transcript_embeddings(model_version)",
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
            platform_a VARCHAR(20) DEFAULT 'youtube',
            video_a_title VARCHAR(500),
            video_a_channel VARCHAR(255),
            video_a_thumbnail TEXT,
            video_b_id VARCHAR(100),
            platform_b VARCHAR(20),
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
        # 🎨 KeywordImages table (Apr 2026) — IA-generated illustrations for "Le Saviez-Vous"
        """
        CREATE TABLE IF NOT EXISTS keyword_images (
            id SERIAL PRIMARY KEY,
            term VARCHAR(200) NOT NULL,
            term_hash VARCHAR(64) NOT NULL UNIQUE,
            category VARCHAR(50),
            prompt_used TEXT,
            metaphor_data TEXT,
            image_url TEXT,
            r2_key VARCHAR(300),
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            model VARCHAR(100) DEFAULT 'dall-e-3',
            generation_time_ms INTEGER,
            fun_score FLOAT DEFAULT 0.5,
            retry_count INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_ki_hash ON keyword_images(term_hash)",
        "CREATE INDEX IF NOT EXISTS idx_ki_status ON keyword_images(status)",
        "CREATE INDEX IF NOT EXISTS idx_ki_fun ON keyword_images(fun_score DESC)",
        # 🎙️ Voice sessions — debate support migration (Apr 2026)
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='voice_sessions' AND column_name='debate_id'
    ) THEN
        ALTER TABLE voice_sessions ADD COLUMN debate_id INTEGER
            REFERENCES debate_analyses(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_voice_sessions_debate ON voice_sessions(debate_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='voice_sessions' AND column_name='agent_type'
    ) THEN
        ALTER TABLE voice_sessions ADD COLUMN agent_type VARCHAR(40)
            NOT NULL DEFAULT 'explorer';
        CREATE INDEX IF NOT EXISTS idx_voice_sessions_agent_type ON voice_sessions(agent_type);
    END IF;
    -- Rendre summary_id nullable (pour permettre les sessions debate et onboarding)
    BEGIN
        ALTER TABLE voice_sessions ALTER COLUMN summary_id DROP NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
END $$;
""",
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
    # Appliquer les migrations de schéma D'ABORD (CREATE TABLE IF NOT EXISTS)
    # pour éviter les conflits avec create_all sur les tables existantes
    await run_schema_migrations()

    # Puis create_all pour les nouvelles tables déclarées via modèles SQLAlchemy
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    except Exception as e:
        print(f"⚠️ create_all warning (tables may already exist): {e}", flush=True)

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
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    except ImportError:
        # Fallback SHA256 si bcrypt non disponible
        print("⚠️ bcrypt not available, using SHA256 fallback", flush=True)
        return hashlib.sha256((f"deepsight_v1_ocean_salt_{password}").encode()).hexdigest()


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
    if password_hash.startswith("$2b$") or password_hash.startswith("$2a$"):
        # Hash bcrypt
        try:
            import bcrypt

            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ImportError:
            print("⚠️ bcrypt not available for verification", flush=True)
            return False
    else:
        # Ancien hash SHA256 - vérification et migration recommandée
        legacy_hash = hashlib.sha256((f"deepsight_v1_ocean_salt_{password}").encode()).hexdigest()
        return legacy_hash == password_hash


async def create_admin_if_not_exists():
    """Crée l'utilisateur admin s'il n'existe pas"""
    from sqlalchemy import select

    async with async_session_maker() as session:
        # Vérifier si l'admin existe
        # scalars().first() au lieu de scalar_one_or_none() pour éviter
        # "Multiple rows found" si username ET email matchent des users différents
        result = await session.execute(
            select(User)
            .where((User.username == ADMIN_CONFIG["ADMIN_USERNAME"]) | (User.email == ADMIN_CONFIG["ADMIN_EMAIL"]))
            .order_by(User.id)
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
                credits=999999,
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
