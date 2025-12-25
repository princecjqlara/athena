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
 
-- ============================================
-- CONTACTS TABLE - Leads/contacts from ads
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Contact info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Source tracking
  source_ad_id TEXT,          -- Facebook Ad ID that generated this contact
  source_ad_name TEXT,        -- Ad name for display
  facebook_lead_id TEXT,      -- Lead ID from Facebook webhook
  facebook_psid TEXT,         -- Page-Scoped User ID for Messenger
  
  -- Pipeline tracking
  pipeline_id TEXT,
  stage_id TEXT,
  
  -- AI Analysis (stored as JSON)
  ai_analysis JSONB,
  
  -- Timestamps
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGES TABLE - Conversation history
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_id TEXT,            -- Facebook message ID
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AD PIPELINE LINKS - Connect ads to pipeline stages
-- ============================================
CREATE TABLE IF NOT EXISTS ad_pipeline_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  pipeline_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(ad_id)  -- An ad can only be linked to one pipeline/stage
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_pipeline_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for now)
CREATE POLICY "Public read contacts" ON contacts FOR SELECT USING (true);
CREATE POLICY "Public insert contacts" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update contacts" ON contacts FOR UPDATE USING (true);
CREATE POLICY "Public delete contacts" ON contacts FOR DELETE USING (true);

CREATE POLICY "Public read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Public insert messages" ON messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read ad_pipeline_links" ON ad_pipeline_links FOR SELECT USING (true);
CREATE POLICY "Public insert ad_pipeline_links" ON ad_pipeline_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ad_pipeline_links" ON ad_pipeline_links FOR UPDATE USING (true);
CREATE POLICY "Public delete ad_pipeline_links" ON ad_pipeline_links FOR DELETE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline_id ON contacts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_source_ad_id ON contacts(source_ad_id);
CREATE INDEX IF NOT EXISTS idx_contacts_facebook_lead_id ON contacts(facebook_lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_facebook_psid ON contacts(facebook_psid);
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_ad_pipeline_links_pipeline_id ON ad_pipeline_links(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_ad_pipeline_links_ad_id ON ad_pipeline_links(ad_id);

-- ============================================
-- COLLECTIVE INTELLIGENCE TABLES
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
  CONSTRAINT valid_weight CHECK (weight_delta BETWEEN -1 AND 1)
);

-- USER CI SETTINGS - Opt-in/opt-out preferences
CREATE TABLE IF NOT EXISTS user_ci_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,  -- This links to local storage user ID
  
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

-- RLS Policies for collective_priors (read-only for all)
CREATE POLICY "Anyone can read collective priors" ON collective_priors FOR SELECT USING (true);

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
-- RBAC (Role-Based Access Control) TABLES
-- ============================================

-- ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER PROFILES TABLE - Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Organization membership
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Role and status
  role TEXT NOT NULL DEFAULT 'marketer' CHECK (role IN ('marketer', 'client', 'admin', 'organizer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended', 'inactive')),
  
  -- Profile info
  full_name TEXT,
  avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ACCESS REQUESTS TABLE - For users requesting org access
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is requesting
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What they're requesting
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL DEFAULT 'marketer' CHECK (requested_role IN ('marketer', 'client')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  denial_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, org_id)
);

-- AUDIT LOGS TABLE - For tracking sensitive actions (especially impersonation)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role TEXT NOT NULL,
  
  -- Impersonation context (if applicable)
  impersonating_user_id UUID REFERENCES auth.users(id),
  
  -- What happened
  action TEXT NOT NULL,  -- 'impersonate_start', 'impersonate_end', 'user_suspend', 'access_approve', etc.
  resource_type TEXT,    -- 'user', 'organization', 'pipeline', etc.
  resource_id TEXT,
  
  -- Additional context
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PIPELINE ASSIGNMENTS TABLE - For assigning pipeline items to clients
CREATE TABLE IF NOT EXISTS pipeline_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is assigned
  pipeline_id TEXT NOT NULL,
  lead_id TEXT,  -- Optional: specific lead within pipeline
  
  -- Who owns and who is assigned
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  
  -- Assignment details
  permissions TEXT[] DEFAULT ARRAY['view', 'advance', 'pause'],
  
  -- Timestamps
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(pipeline_id, assigned_to)
);

-- Enable RLS for RBAC tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization" ON organizations 
  FOR SELECT USING (
    id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'organizer')
  );

CREATE POLICY "Admins can update their organization" ON organizations 
  FOR UPDATE USING (
    id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view profiles in their org" ON user_profiles 
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    OR id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'organizer')
  );

CREATE POLICY "Users can update their own profile" ON user_profiles 
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can update org profiles" ON user_profiles 
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

CREATE POLICY "Allow profile creation" ON user_profiles 
  FOR INSERT WITH CHECK (id = auth.uid());

-- RLS Policies for access_requests
CREATE POLICY "Users can view their own requests" ON access_requests 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view org requests" ON access_requests 
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

CREATE POLICY "Users can create requests" ON access_requests 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update requests" ON access_requests 
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

-- RLS Policies for audit_logs (read-only for admins/organizers)
CREATE POLICY "Admins can view org audit logs" ON audit_logs 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

CREATE POLICY "System can insert audit logs" ON audit_logs 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for pipeline_assignments
CREATE POLICY "Users can view their assignments" ON pipeline_assignments 
  FOR SELECT USING (
    assigned_to = auth.uid() 
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

CREATE POLICY "Owners can manage assignments" ON pipeline_assignments 
  FOR ALL USING (owner_id = auth.uid());

-- Indexes for RBAC tables
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_org ON access_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_assignments_assigned ON pipeline_assignments(assigned_to);

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'marketer',
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INVITE CODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Code details
  code TEXT UNIQUE NOT NULL,
  code_type TEXT NOT NULL CHECK (code_type IN ('client', 'marketer', 'admin')),
  
  -- Who created it
  created_by UUID NOT NULL REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  
  -- Usage tracking
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  
  -- Expiration (10 minutes default)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  is_used BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own codes" ON invite_codes 
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create codes" ON invite_codes 
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Organizers can view all codes" ON invite_codes 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'organizer')
  );

-- Index for code lookup
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_type ON invite_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON invite_codes(created_by);

-- Function to generate a random invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

