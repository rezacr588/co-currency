-- Migration: Add LinkedIn and Google OAuth support, remove GitHub
-- This migration renames github_id to linkedin_id and adds google_id

-- Rename github_id column to linkedin_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'github_id') THEN
        ALTER TABLE users RENAME COLUMN github_id TO linkedin_id;
    END IF;
END $$;

-- Add linkedin_id if it doesn't exist (for fresh installs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(255) UNIQUE;

-- Add google_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Drop old index if it exists and create new ones
DROP INDEX IF EXISTS idx_users_github_id;
CREATE INDEX IF NOT EXISTS idx_users_linkedin_id ON users(linkedin_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
