-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔑 MIGRATION: API Keys pour Plan Expert
-- Version: 3.7.0
-- Date: 2026-01-09
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ajouter les colonnes API key à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_last_used TIMESTAMP;

-- Créer un index sur api_key_hash pour les lookups rapides
CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash);

-- Créer la table api_usage pour tracker l'utilisation de l'API
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date VARCHAR(10) NOT NULL,  -- YYYY-MM-DD
    request_count INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (si besoin)
-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS api_usage;
-- ALTER TABLE users DROP COLUMN IF EXISTS api_key_hash;
-- ALTER TABLE users DROP COLUMN IF EXISTS api_key_created_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS api_key_last_used;
-- DROP INDEX IF EXISTS idx_users_api_key_hash;
