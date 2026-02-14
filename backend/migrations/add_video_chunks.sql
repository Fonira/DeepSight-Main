-- Migration: Add video_chunks table and full_digest column
-- Date: 2026-02-14
-- Purpose: Hierarchical Digest Pipeline for long video/playlist analysis
-- Run on: Railway PostgreSQL (production)

-- Step 1: Add full_digest column to summaries
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS full_digest TEXT;

-- Step 2: Create video_chunks table
CREATE TABLE IF NOT EXISTS video_chunks (
    id SERIAL PRIMARY KEY,
    summary_id INTEGER NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    start_seconds INTEGER NOT NULL DEFAULT 0,
    end_seconds INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    chunk_digest TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS ix_video_chunks_summary_id ON video_chunks(summary_id);
CREATE INDEX IF NOT EXISTS ix_video_chunks_summary_chunk ON video_chunks(summary_id, chunk_index);

-- Verification
SELECT 'video_chunks table created' AS status;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'video_chunks' ORDER BY ordinal_position;
