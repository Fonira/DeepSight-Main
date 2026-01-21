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
    ForeignKey, Index, create_engine, event, UniqueConstraint
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

if DATABASE_URL:
    # PostgreSQL sur Railway
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    print(f"🐘 Using PostgreSQL database", flush=True)
else:
    # SQLite local avec aiosqlite
    DB_FILE = os.path.join(DATA_DIR, "deepsight_users.db")
    DATABASE_URL = f"sqlite+aiosqlite:///{DB_FILE}"
    print(f"📁 Using SQLite database: {DB_FILE}", flush=True)

# Créer le moteur async
engine = create_async_engine(
    DATABASE_URL,
    echo=os.environ.get("SQL_ECHO", "false").lower() == "true",
    pool_pre_ping=True,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
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
    default_model = Column(String(50), default="mistral-small-latest")
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
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
    
    # Playlist
    playlist_id = Column(String(100), index=True)
    playlist_position = Column(Integer)
    
    # Favoris et notes
    is_favorite = Column(Boolean, default=False)
    notes = Column(Text)
    
    # Timestamp
    created_at = Column(DateTime, default=func.now())
    
    # Relations
    user = relationship("User", back_populates="summaries")
    chat_messages = relationship("ChatMessage", back_populates="summary", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_summaries_user', 'user_id'),
        Index('idx_summaries_playlist', 'playlist_id'),
    )


class DailyQuota(Base):
    """Table des quotas journaliers"""
    __tablename__ = "daily_quotas"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quota_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    videos_used = Column(Integer, default=0)
    
    __table_args__ = (
        Index('idx_daily_quota_user_date', 'user_id', 'quota_date', unique=True),
    )


class CreditTransaction(Base):
    """Table des transactions de crédits"""
    __tablename__ = "credit_transactions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    transaction_type = Column(String(50))  # usage, purchase, bonus, refund
    type = Column(String(50))  # Alias pour compatibilité
    stripe_payment_id = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime, default=func.now())


class PlaylistAnalysis(Base):
    """Table des analyses de playlists"""
    __tablename__ = "playlist_analyses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quota_date = Column(String(10), nullable=False)
    daily_count = Column(Integer, default=0)
    
    __table_args__ = (
        Index('idx_chat_quotas_user_date', 'user_id', 'quota_date', unique=True),
    )


class PlaylistChatMessage(Base):
    """Table des messages de chat pour playlists"""
    __tablename__ = "playlist_chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    playlist_id = Column(String(100), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())


class WebSearchUsage(Base):
    """Table d'usage de la recherche web"""
    __tablename__ = "web_search_usage"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency pour obtenir une session DB"""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialise la base de données et crée les tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Créer l'admin par défaut
    await create_admin_if_not_exists()
    print("✅ Database initialized", flush=True)


async def close_db():
    """Ferme les connexions à la base de données"""
    await engine.dispose()


def hash_password(password: str) -> str:
    """Hash un mot de passe avec le salt Deep Sight"""
    return hashlib.sha256(
        (f"deepsight_v1_ocean_salt_{password}").encode()
    ).hexdigest()


async def create_admin_if_not_exists():
    """Crée l'utilisateur admin s'il n'existe pas"""
    from sqlalchemy import select
    
    async with async_session_maker() as session:
        # Vérifier si l'admin existe
        result = await session.execute(
            select(User).where(
                (User.username == ADMIN_CONFIG["ADMIN_USERNAME"]) | 
                (User.email == ADMIN_CONFIG["ADMIN_EMAIL"])
            )
        )
        existing = result.scalar_one_or_none()
        
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
