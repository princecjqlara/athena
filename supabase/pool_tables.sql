-- ============================================
-- POOL TABLES FOR MARKETPLACE GALAXY
-- Run this in Supabase SQL Editor
-- ============================================

-- COLLECTIVE PRIORS - Aggregated feature weights from all contributors
CREATE TABLE IF NOT EXISTS collective_priors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Feature identification
  feature_name TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'general', -- 'general', 'ecommerce', 'leadgen', 'awareness'
  
  -- Aggregated weight data
  weight_sum DECIMAL(12,4) DEFAULT 0,       -- Sum of all contributed weights
  contribution_count INTEGER DEFAULT 0,      -- Number of contributions
  avg_weight DECIMAL(10,4) DEFAULT 0,        -- Calculated average weight
  confidence DECIMAL(5,4) DEFAULT 0,         -- Confidence score (0-1)
  
  -- Outcome data
  positive_outcomes INTEGER DEFAULT 0,
  negative_outcomes INTEGER DEFAULT 0,
  lift_percentage DECIMAL(10,4) DEFAULT 0,   -- Average lift when feature present
  
  -- Timestamps
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER CONTRIBUTIONS - Anonymized feature signals (no user identity stored)
CREATE TABLE IF NOT EXISTS user_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Anonymized identifier (hashed, rotates periodically)
  contributor_hash TEXT NOT NULL,
  
  -- Contribution data
  feature_name TEXT NOT NULL,
  weight_delta DECIMAL(10,4) NOT NULL,       -- Change in weight after conversion
  outcome_positive BOOLEAN NOT NULL,          -- Was this a positive outcome?
  confidence DECIMAL(5,4) DEFAULT 0.5,
  category TEXT DEFAULT 'general',
  
  -- Surprise signal (when prediction was significantly wrong)
  is_surprise BOOLEAN DEFAULT FALSE,
  surprise_magnitude DECIMAL(10,4),
  
  -- Timestamp (day-level only for privacy)
  contributed_at DATE DEFAULT CURRENT_DATE,
  
  -- No foreign keys to users - fully anonymized
  CONSTRAINT valid_weight CHECK (weight_delta BETWEEN -10 AND 10)
);

-- USER CI SETTINGS - Opt-in/opt-out preferences
CREATE TABLE IF NOT EXISTS user_ci_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,  -- This links to local storage user ID (TEXT to support generated IDs)
  
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

-- Enable RLS for collective tables
ALTER TABLE collective_priors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ci_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read collective priors" ON collective_priors;
DROP POLICY IF EXISTS "Anyone can contribute" ON user_contributions;
DROP POLICY IF EXISTS "Public read ci_settings" ON user_ci_settings;
DROP POLICY IF EXISTS "Public insert ci_settings" ON user_ci_settings;
DROP POLICY IF EXISTS "Public update ci_settings" ON user_ci_settings;
DROP POLICY IF EXISTS "Public insert collective_priors" ON collective_priors;
DROP POLICY IF EXISTS "Public update collective_priors" ON collective_priors;

-- RLS Policies for collective_priors (read and write for all)
CREATE POLICY "Anyone can read collective priors" ON collective_priors FOR SELECT USING (true);
CREATE POLICY "Public insert collective_priors" ON collective_priors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update collective_priors" ON collective_priors FOR UPDATE USING (true);

-- RLS Policies for user_contributions (insert only, no read of others)
CREATE POLICY "Anyone can contribute" ON user_contributions FOR INSERT WITH CHECK (true);

-- RLS Policies for user_ci_settings (users can only access their own)
CREATE POLICY "Public read ci_settings" ON user_ci_settings FOR SELECT USING (true);
CREATE POLICY "Public insert ci_settings" ON user_ci_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ci_settings" ON user_ci_settings FOR UPDATE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collective_priors_feature ON collective_priors(feature_name);
CREATE INDEX IF NOT EXISTS idx_collective_priors_category ON collective_priors(category);
CREATE INDEX IF NOT EXISTS idx_user_contributions_feature ON user_contributions(feature_name);
CREATE INDEX IF NOT EXISTS idx_user_contributions_date ON user_contributions(contributed_at);
CREATE INDEX IF NOT EXISTS idx_user_ci_settings_user ON user_ci_settings(user_id);

-- ============================================
-- SUCCESS! Tables created.
-- Now go to Strategy Tree, import some ads,
-- and click "Seed Pool" to populate data.
-- ============================================
