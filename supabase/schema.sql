-- ============================================
-- ADVISION AI DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ADS TABLE - Primary ad storage
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Identifiers
  facebook_ad_id TEXT,
  name TEXT,
  
  -- Media
  media_url TEXT,
  thumbnail_url TEXT,
  media_type TEXT, -- 'video', 'photo', 'carousel'
  
  -- Status
  status TEXT DEFAULT 'active',
  user_status TEXT,
  effective_status TEXT,
  imported_from_facebook BOOLEAN DEFAULT FALSE,
  has_results BOOLEAN DEFAULT FALSE,
  success_score INTEGER,
  
  -- Content (AI-extracted)
  extracted_content JSONB,
  
  -- User-selected traits
  categories TEXT[],
  traits TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ
);

-- AD INSIGHTS TABLE - All Facebook metrics
CREATE TABLE IF NOT EXISTS ad_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
  
  -- Core Performance
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency DECIMAL(10,4) DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  
  -- Clicks
  clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  ctr DECIMAL(10,4) DEFAULT 0,
  unique_ctr DECIMAL(10,4) DEFAULT 0,
  cpc DECIMAL(10,4) DEFAULT 0,
  cpm DECIMAL(10,4) DEFAULT 0,
  cpp DECIMAL(10,4) DEFAULT 0,
  
  -- Link & Landing
  link_clicks INTEGER DEFAULT 0,
  unique_link_clicks INTEGER DEFAULT 0,
  inline_link_clicks INTEGER DEFAULT 0,
  landing_page_views INTEGER DEFAULT 0,
  outbound_clicks INTEGER DEFAULT 0,
  cost_per_link_click DECIMAL(10,4) DEFAULT 0,
  cost_per_landing_page_view DECIMAL(10,4) DEFAULT 0,
  
  -- Engagement
  page_engagement INTEGER DEFAULT 0,
  post_engagement INTEGER DEFAULT 0,
  post_reactions INTEGER DEFAULT 0,
  post_comments INTEGER DEFAULT 0,
  post_shares INTEGER DEFAULT 0,
  post_saves INTEGER DEFAULT 0,
  page_likes INTEGER DEFAULT 0,
  
  -- Messaging
  messages INTEGER DEFAULT 0,
  messages_started INTEGER DEFAULT 0,
  cost_per_message DECIMAL(10,4) DEFAULT 0,
  
  -- Leads & Conversions
  leads INTEGER DEFAULT 0,
  cost_per_lead DECIMAL(10,4) DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  cost_per_purchase DECIMAL(10,4) DEFAULT 0,
  purchase_value DECIMAL(12,2) DEFAULT 0,
  purchase_roas DECIMAL(10,4) DEFAULT 0,
  add_to_cart INTEGER DEFAULT 0,
  initiate_checkout INTEGER DEFAULT 0,
  content_views INTEGER DEFAULT 0,
  complete_registration INTEGER DEFAULT 0,
  
  -- Video Metrics
  video_views INTEGER DEFAULT 0,
  video_plays INTEGER DEFAULT 0,
  video_thru_plays INTEGER DEFAULT 0,
  video_2_sec_views INTEGER DEFAULT 0,
  video_25_watched INTEGER DEFAULT 0,
  video_50_watched INTEGER DEFAULT 0,
  video_75_watched INTEGER DEFAULT 0,
  video_95_watched INTEGER DEFAULT 0,
  video_100_watched INTEGER DEFAULT 0,
  video_avg_watch_time DECIMAL(10,2) DEFAULT 0,
  cost_per_thru_play DECIMAL(10,4) DEFAULT 0,
  
  -- Quality Rankings
  quality_ranking TEXT,
  engagement_rate_ranking TEXT,
  conversion_rate_ranking TEXT,
  
  -- Ad Recall
  estimated_ad_recallers INTEGER DEFAULT 0,
  estimated_ad_recall_rate DECIMAL(10,4) DEFAULT 0,
  
  -- Result Summary
  result_type TEXT,
  results INTEGER DEFAULT 0,
  cost_per_result DECIMAL(10,4) DEFAULT 0,
  
  -- Timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- AD BREAKDOWNS TABLE - Demographics, Device, Platform, Region data
CREATE TABLE IF NOT EXISTS ad_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
  breakdown_type TEXT NOT NULL, -- 'device', 'platform', 'placement', 'demographic', 'country', 'region'
  
  -- Dimension values
  device TEXT,
  platform TEXT,
  position TEXT,
  age TEXT,
  gender TEXT,
  country TEXT,
  region TEXT,
  
  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_breakdowns ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own ads" ON ads;
DROP POLICY IF EXISTS "Users can insert own ads" ON ads;
DROP POLICY IF EXISTS "Users can update own ads" ON ads;
DROP POLICY IF EXISTS "Users can delete own ads" ON ads;
DROP POLICY IF EXISTS "Users can view own insights" ON ad_insights;
DROP POLICY IF EXISTS "Users can insert own insights" ON ad_insights;
DROP POLICY IF EXISTS "Users can update own insights" ON ad_insights;
DROP POLICY IF EXISTS "Users can view own breakdowns" ON ad_breakdowns;
DROP POLICY IF EXISTS "Users can insert own breakdowns" ON ad_breakdowns;
DROP POLICY IF EXISTS "Users can delete own breakdowns" ON ad_breakdowns;

-- Allow public access for now (no auth required)
-- Change these policies once auth is implemented
CREATE POLICY "Public read ads" ON ads FOR SELECT USING (true);
CREATE POLICY "Public insert ads" ON ads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ads" ON ads FOR UPDATE USING (true);
CREATE POLICY "Public delete ads" ON ads FOR DELETE USING (true);

CREATE POLICY "Public read insights" ON ad_insights FOR SELECT USING (true);
CREATE POLICY "Public insert insights" ON ad_insights FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update insights" ON ad_insights FOR UPDATE USING (true);

CREATE POLICY "Public read breakdowns" ON ad_breakdowns FOR SELECT USING (true);
CREATE POLICY "Public insert breakdowns" ON ad_breakdowns FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete breakdowns" ON ad_breakdowns FOR DELETE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ads_user_id ON ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_facebook_ad_id ON ads(facebook_ad_id);
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON ads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_insights_ad_id ON ad_insights(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_breakdowns_ad_id ON ad_breakdowns(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_breakdowns_type ON ad_breakdowns(breakdown_type);
