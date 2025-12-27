-- ============================================
-- FIX USER_CI_SETTINGS TABLE
-- Change user_id from UUID to TEXT to support localStorage-based IDs
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the existing table and recreate with TEXT type for user_id
DROP TABLE IF EXISTS user_ci_settings CASCADE;

-- Recreate with TEXT type
CREATE TABLE IF NOT EXISTS user_ci_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,  -- Changed to TEXT to support localStorage IDs
  
  -- Participation
  opted_in BOOLEAN DEFAULT FALSE,
  participation_mode TEXT DEFAULT 'private', -- 'private', 'contribute_receive', 'receive_only'
  
  -- Local stats (for blend calculation)
  local_data_points INTEGER DEFAULT 0,
  local_conversions INTEGER DEFAULT 0,
  
  -- Privacy settings
  share_category BOOLEAN DEFAULT TRUE,       -- Allow category context
  contributor_hash TEXT,                     -- Current anonymized hash
  hash_rotated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  opted_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_ci_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_ci_settings
DROP POLICY IF EXISTS "Public read ci_settings" ON user_ci_settings;
DROP POLICY IF EXISTS "Public insert ci_settings" ON user_ci_settings;
DROP POLICY IF EXISTS "Public update ci_settings" ON user_ci_settings;

CREATE POLICY "Public read ci_settings" ON user_ci_settings FOR SELECT USING (true);
CREATE POLICY "Public insert ci_settings" ON user_ci_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ci_settings" ON user_ci_settings FOR UPDATE USING (true);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_user_ci_settings_user ON user_ci_settings(user_id);
