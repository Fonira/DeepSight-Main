-- Migration: Add CASCADE DELETE to all user foreign keys
-- Date: 2026-01-26
-- Purpose: Allow user deletion without foreign key constraint violations

-- Note: This migration modifies existing foreign key constraints
-- to add ON DELETE CASCADE behavior

-- 1. summaries.user_id
ALTER TABLE summaries DROP CONSTRAINT IF EXISTS summaries_user_id_fkey;
ALTER TABLE summaries ADD CONSTRAINT summaries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 2. daily_quotas.user_id
ALTER TABLE daily_quotas DROP CONSTRAINT IF EXISTS daily_quotas_user_id_fkey;
ALTER TABLE daily_quotas ADD CONSTRAINT daily_quotas_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3. credit_transactions.user_id
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. playlist_analyses.user_id
ALTER TABLE playlist_analyses DROP CONSTRAINT IF EXISTS playlist_analyses_user_id_fkey;
ALTER TABLE playlist_analyses ADD CONSTRAINT playlist_analyses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 5. chat_messages.user_id
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 6. chat_quotas.user_id
ALTER TABLE chat_quotas DROP CONSTRAINT IF EXISTS chat_quotas_user_id_fkey;
ALTER TABLE chat_quotas ADD CONSTRAINT chat_quotas_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 7. playlist_chat_messages.user_id
ALTER TABLE playlist_chat_messages DROP CONSTRAINT IF EXISTS playlist_chat_messages_user_id_fkey;
ALTER TABLE playlist_chat_messages ADD CONSTRAINT playlist_chat_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 8. web_search_usage.user_id
ALTER TABLE web_search_usage DROP CONSTRAINT IF EXISTS web_search_usage_user_id_fkey;
ALTER TABLE web_search_usage ADD CONSTRAINT web_search_usage_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 9. admin_logs.admin_id
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;
ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE;

-- 10. task_status.user_id
ALTER TABLE task_status DROP CONSTRAINT IF EXISTS task_status_user_id_fkey;
ALTER TABLE task_status ADD CONSTRAINT task_status_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 11. api_usage.user_id
ALTER TABLE api_usage DROP CONSTRAINT IF EXISTS api_usage_user_id_fkey;
ALTER TABLE api_usage ADD CONSTRAINT api_usage_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
