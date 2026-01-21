-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 MIGRATION: Index de Performance pour Deep Sight
-- Date: 2025-01-19
-- Version: 7.0.0
-- 
-- IMPORTANT: Exécuter ces commandes sur votre base Railway
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 TABLE SUMMARIES - Index principaux
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 💬 TABLE CHAT_MESSAGES - Index pour le chat
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour récupérer les messages d'un résumé
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_summary_created 
ON chat_messages(summary_id, created_at);

-- Index pour les messages par utilisateur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user_id 
ON chat_messages(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 👤 TABLE USERS - Index pour les utilisateurs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour Stripe
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_stripe_customer 
ON users(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Index pour le plan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_plan 
ON users(plan);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📋 TABLE PLAYLISTS - Index pour les playlists
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index pour les playlists par utilisateur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playlists_user_id 
ON playlists(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 ANALYSE DES TABLES (optimise les plans de requête)
-- ═══════════════════════════════════════════════════════════════════════════════

ANALYZE users;
ANALYZE summaries;
ANALYZE chat_messages;
ANALYZE playlists;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ VÉRIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lister les index créés
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
