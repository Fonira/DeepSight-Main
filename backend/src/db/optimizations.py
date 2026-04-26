"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🗄️ DATABASE OPTIMIZATIONS v2.0 — Index, Migrations & Query Optimization           ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  OPTIMISATIONS:                                                                    ║
║  • 🔍 Index optimisés pour les requêtes fréquentes                                ║
║  • 📊 Vues matérialisées pour les agrégations                                     ║
║  • 🔄 Migrations Alembic                                                           ║
║  • 📈 Query optimization patterns                                                  ║
║  • 💾 Connection pooling avancé                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Usage:
    # Appliquer les optimisations
    python -m db.optimizations apply

    # Vérifier les index manquants
    python -m db.optimizations check

    # Analyser les requêtes lentes
    python -m db.optimizations analyze
"""

import os
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from sqlalchemy import text, event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 DATABASE ENGINE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def create_optimized_engine(
    url: str = DATABASE_URL,
    pool_size: int = 20,
    max_overflow: int = 10,
    pool_pre_ping: bool = True,
    pool_recycle: int = 3600,
    echo: bool = False,
):
    """
    Crée un engine SQLAlchemy optimisé avec connection pooling avancé.

    Args:
        url: URL de la base de données
        pool_size: Nombre de connexions dans le pool
        max_overflow: Connexions supplémentaires autorisées
        pool_pre_ping: Vérifie les connexions avant utilisation
        pool_recycle: Recycle les connexions après N secondes
        echo: Log les requêtes SQL
    """
    engine = create_async_engine(
        url,
        # Pool configuration
        poolclass=QueuePool,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_pre_ping=pool_pre_ping,
        pool_recycle=pool_recycle,
        # Performance
        echo=echo,
        future=True,
        # Connection args pour PostgreSQL
        connect_args={
            "server_settings": {
                "jit": "off",  # Désactiver JIT pour les requêtes courtes
                "statement_timeout": "30000",  # 30s timeout
            }
        },
    )

    # Event listeners pour le monitoring
    @event.listens_for(engine.sync_engine, "connect")
    def set_search_path(dbapi_connection, connection_record):
        """Configure le search_path à la connexion"""
        cursor = dbapi_connection.cursor()
        cursor.execute("SET search_path TO public")
        cursor.close()

    return engine


# Session factory
engine = create_optimized_engine()
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@asynccontextmanager
async def get_session():
    """Context manager pour les sessions DB"""
    session = async_session_maker()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 INDEX DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

RECOMMENDED_INDEXES = """
-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 SUMMARIES TABLE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour la recherche par utilisateur (très fréquent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_id 
ON summaries(user_id);

-- Index pour le tri par date (historique)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_created 
ON summaries(user_id, created_at DESC);

-- Index pour la recherche par video_id (éviter les doublons)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_video_id 
ON summaries(video_id);

-- Index composite pour les filtres fréquents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_category_created 
ON summaries(user_id, category, created_at DESC);

-- Index pour les favoris
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_favorite 
ON summaries(user_id, is_favorite) 
WHERE is_favorite = true;

-- Index full-text pour la recherche dans les résumés
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_content_gin 
ON summaries USING gin(to_tsvector('french', video_title || ' ' || COALESCE(summary_content, '')));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 💬 CHAT MESSAGES TABLE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour récupérer les messages d'un résumé
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_summary_created 
ON chat_messages(summary_id, created_at);

-- Index pour les messages par utilisateur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user_id 
ON chat_messages(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 👤 USERS TABLE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index unique pour l'email (déjà en contrainte, mais s'assurer qu'il existe)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);

-- Index pour Stripe
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_stripe_customer 
ON users(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Index pour le plan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_plan 
ON users(plan);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📋 PLAYLISTS TABLE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour les playlists par utilisateur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playlists_user_id 
ON playlists(user_id);

-- Index pour les items de playlist
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playlist_items_playlist_position 
ON playlist_items(playlist_id, position);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 TASK STATUS TABLE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour les tâches en cours par utilisateur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_status_user_status 
ON task_status(user_id, status) 
WHERE status IN ('pending', 'processing');

-- Index pour le nettoyage des vieilles tâches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_status_created 
ON task_status(created_at);
"""

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 MATERIALIZED VIEWS
# ═══════════════════════════════════════════════════════════════════════════════

MATERIALIZED_VIEWS = """
-- ═══════════════════════════════════════════════════════════════════════════════
-- 📈 VUE: Statistiques utilisateur (refresh toutes les heures)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.plan,
    COUNT(DISTINCT s.id) as total_summaries,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '30 days') as summaries_30d,
    COUNT(DISTINCT cm.id) as total_chat_messages,
    COALESCE(SUM(s.word_count), 0) as total_words,
    MIN(s.created_at) as first_summary_at,
    MAX(s.created_at) as last_summary_at,
    NOW() as refreshed_at
FROM users u
LEFT JOIN summaries s ON s.user_id = u.id
LEFT JOIN chat_messages cm ON cm.user_id = u.id
GROUP BY u.id, u.email, u.plan;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_stats_user_id 
ON mv_user_stats(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 VUE: Catégories populaires par utilisateur
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_categories AS
SELECT 
    user_id,
    category,
    COUNT(*) as count,
    MAX(created_at) as last_used
FROM summaries
WHERE category IS NOT NULL
GROUP BY user_id, category;

CREATE INDEX IF NOT EXISTS idx_mv_user_categories_user 
ON mv_user_categories(user_id, count DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📈 VUE: Métriques globales (pour admin)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_global_metrics AS
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.plan != 'free') as paid_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.created_at > NOW() - INTERVAL '7 days') as new_users_7d,
    COUNT(DISTINCT s.id) as total_summaries,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '24 hours') as summaries_24h,
    COUNT(DISTINCT cm.id) as total_chat_messages,
    COALESCE(SUM(s.word_count), 0) as total_words_generated,
    NOW() as refreshed_at
FROM users u
LEFT JOIN summaries s ON s.user_id = u.id
LEFT JOIN chat_messages cm ON cm.user_id = u.id;
"""

REFRESH_MATERIALIZED_VIEWS = """
-- Rafraîchir les vues matérialisées (à exécuter périodiquement)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_categories;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_metrics;
"""

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 QUERY OPTIMIZATION HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


class QueryOptimizer:
    """Helpers pour optimiser les requêtes fréquentes"""

    @staticmethod
    async def get_user_history_optimized(
        session: AsyncSession,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        category: Optional[str] = None,
        favorites_only: bool = False,
        search_query: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Récupère l'historique utilisateur de manière optimisée.
        Utilise les index et évite les N+1 queries.
        """
        # Construire la requête de base
        base_query = """
            SELECT 
                s.id,
                s.video_id,
                s.video_title,
                s.video_channel,
                s.category,
                s.word_count,
                s.is_favorite,
                s.created_at,
                s.mode,
                s.lang,
                (SELECT COUNT(*) FROM chat_messages cm WHERE cm.summary_id = s.id) as chat_count
            FROM summaries s
            WHERE s.user_id = :user_id
        """

        params = {"user_id": user_id, "limit": limit, "offset": offset}

        # Filtres conditionnels
        if category:
            base_query += " AND s.category = :category"
            params["category"] = category

        if favorites_only:
            base_query += " AND s.is_favorite = true"

        if search_query:
            base_query += """
                AND to_tsvector('french', s.video_title || ' ' || COALESCE(s.summary_content, '')) 
                @@ plainto_tsquery('french', :search_query)
            """
            params["search_query"] = search_query

        # Tri et pagination
        base_query += " ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset"

        result = await session.execute(text(base_query), params)
        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "video_id": row.video_id,
                "video_title": row.video_title,
                "video_channel": row.video_channel,
                "category": row.category,
                "word_count": row.word_count,
                "is_favorite": row.is_favorite,
                "created_at": row.created_at.isoformat(),
                "mode": row.mode,
                "lang": row.lang,
                "chat_count": row.chat_count,
            }
            for row in rows
        ]

    @staticmethod
    async def get_user_stats_fast(
        session: AsyncSession,
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Récupère les stats utilisateur depuis la vue matérialisée.
        Fallback sur une requête normale si la vue n'existe pas.
        """
        try:
            result = await session.execute(
                text("SELECT * FROM mv_user_stats WHERE user_id = :user_id"), {"user_id": user_id}
            )
            row = result.fetchone()

            if row:
                return {
                    "total_summaries": row.total_summaries,
                    "summaries_30d": row.summaries_30d,
                    "total_chat_messages": row.total_chat_messages,
                    "total_words": row.total_words,
                    "first_summary_at": row.first_summary_at.isoformat() if row.first_summary_at else None,
                    "last_summary_at": row.last_summary_at.isoformat() if row.last_summary_at else None,
                }
        except Exception:
            pass

        # Fallback
        result = await session.execute(
            text("""
                SELECT 
                    COUNT(*) as total_summaries,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as summaries_30d,
                    COALESCE(SUM(word_count), 0) as total_words
                FROM summaries
                WHERE user_id = :user_id
            """),
            {"user_id": user_id},
        )
        row = result.fetchone()

        return {
            "total_summaries": row.total_summaries,
            "summaries_30d": row.summaries_30d,
            "total_words": row.total_words,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ MAINTENANCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════


async def apply_indexes():
    """Applique tous les index recommandés"""
    async with engine.begin() as conn:
        for statement in RECOMMENDED_INDEXES.strip().split(";"):
            statement = statement.strip()
            if statement and not statement.startswith("--"):
                try:
                    await conn.execute(text(statement))
                    print(f"✅ Applied: {statement[:60]}...")
                except Exception as e:
                    print(f"⚠️ Skipped (may already exist): {e}")


async def create_materialized_views():
    """Crée les vues matérialisées"""
    async with engine.begin() as conn:
        for statement in MATERIALIZED_VIEWS.strip().split(";"):
            statement = statement.strip()
            if statement and not statement.startswith("--"):
                try:
                    await conn.execute(text(statement))
                    print(f"✅ Created view: {statement[:60]}...")
                except Exception as e:
                    print(f"⚠️ Skipped: {e}")


async def refresh_materialized_views():
    """Rafraîchit les vues matérialisées"""
    async with engine.begin() as conn:
        for statement in REFRESH_MATERIALIZED_VIEWS.strip().split(";"):
            statement = statement.strip()
            if statement and not statement.startswith("--"):
                try:
                    await conn.execute(text(statement))
                    print(f"✅ Refreshed: {statement[:60]}...")
                except Exception as e:
                    print(f"⚠️ Error refreshing: {e}")


async def analyze_tables():
    """Analyse les tables pour optimiser les plans de requête"""
    tables = ["users", "summaries", "chat_messages", "playlists", "playlist_items", "task_status"]

    async with engine.begin() as conn:
        for table in tables:
            await conn.execute(text(f"ANALYZE {table}"))
            print(f"✅ Analyzed: {table}")


async def check_missing_indexes():
    """Vérifie les index manquants (requêtes lentes)"""
    query = """
        SELECT 
            schemaname || '.' || relname as table,
            seq_scan,
            seq_tup_read,
            idx_scan,
            idx_tup_fetch,
            CASE WHEN seq_scan > 0 
                THEN round(seq_tup_read::numeric / seq_scan, 2) 
                ELSE 0 
            END as avg_rows_per_seq_scan
        FROM pg_stat_user_tables
        WHERE seq_scan > 100
        ORDER BY seq_tup_read DESC
        LIMIT 20;
    """

    async with engine.begin() as conn:
        result = await conn.execute(text(query))
        rows = result.fetchall()

        print("\n📊 Tables avec beaucoup de sequential scans:")
        print("-" * 80)
        for row in rows:
            print(f"  {row.table}: {row.seq_scan} seq scans, {row.avg_rows_per_seq_scan} avg rows/scan")


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 CLI
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    import asyncio

    async def main():
        command = sys.argv[1] if len(sys.argv) > 1 else "help"

        if command == "apply":
            print("🔧 Applying database optimizations...")
            await apply_indexes()
            await create_materialized_views()
            await analyze_tables()
            print("\n✅ Done!")

        elif command == "refresh":
            print("🔄 Refreshing materialized views...")
            await refresh_materialized_views()
            print("\n✅ Done!")

        elif command == "check":
            print("🔍 Checking for missing indexes...")
            await check_missing_indexes()

        elif command == "analyze":
            print("📊 Analyzing tables...")
            await analyze_tables()
            print("\n✅ Done!")

        else:
            print("""
Usage: python -m db.optimizations <command>

Commands:
    apply     - Apply all indexes and create materialized views
    refresh   - Refresh materialized views
    check     - Check for missing indexes
    analyze   - Analyze tables for query optimization
            """)

    asyncio.run(main())
