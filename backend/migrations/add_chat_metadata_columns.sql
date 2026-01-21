-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔧 MIGRATION: Ajouter les colonnes de métadonnées chat v5.0
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Exécuter ce script dans la base PostgreSQL pour ajouter les nouvelles colonnes
-- nécessaires au fact-checking et à la recherche web.
--
-- Comment exécuter :
-- 1. Aller dans Railway → PostgreSQL → Data → Query
-- 2. Copier/coller ce script
-- 3. Exécuter
--
-- OU via psql :
-- psql $DATABASE_URL -f add_chat_metadata_columns.sql
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ajouter web_search_used (si n'existe pas)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'web_search_used'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN web_search_used BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column web_search_used added';
    ELSE
        RAISE NOTICE 'Column web_search_used already exists';
    END IF;
END $$;

-- Ajouter fact_checked (si n'existe pas)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'fact_checked'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN fact_checked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column fact_checked added';
    ELSE
        RAISE NOTICE 'Column fact_checked already exists';
    END IF;
END $$;

-- Ajouter sources_json (si n'existe pas)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'sources_json'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN sources_json TEXT;
        RAISE NOTICE 'Column sources_json added';
    ELSE
        RAISE NOTICE 'Column sources_json already exists';
    END IF;
END $$;

-- Ajouter enrichment_level (si n'existe pas)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'enrichment_level'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN enrichment_level VARCHAR(20);
        RAISE NOTICE 'Column enrichment_level added';
    ELSE
        RAISE NOTICE 'Column enrichment_level already exists';
    END IF;
END $$;

-- Vérifier le résultat
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;
