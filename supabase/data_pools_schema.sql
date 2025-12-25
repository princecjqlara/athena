    -- ============================================
    -- DATA POOLS & ACCESS REQUEST SCHEMA
    -- Public Data Marketplace with Admin Approval
    -- Run this in Supabase SQL Editor
    -- ============================================

    -- DATA_POOLS TABLE - Catalog of available data collections
    CREATE TABLE IF NOT EXISTS data_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pool identification
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- Categorization (for filtering/browsing)
    industry TEXT,           -- 'ecommerce', 'saas', 'finance', 'health', 'local_services'
    target_audience TEXT,    -- 'gen_z', 'millennials', 'b2b', 'parents', 'high_income'
    platform TEXT,           -- 'tiktok', 'facebook', 'instagram', 'youtube', 'multi'
    creative_format TEXT,    -- 'ugc', 'testimonial', 'product_demo', 'meme', 'founder_led'
    
    -- Stats (updated periodically by aggregation)
    data_points INTEGER DEFAULT 0,
    contributors INTEGER DEFAULT 0,
    avg_success_rate DECIMAL(5,2),
    avg_ctr DECIMAL(5,4),
    avg_roas DECIMAL(6,2),
    
    -- Access control
    is_public BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    access_tier TEXT DEFAULT 'standard' CHECK (access_tier IN ('standard', 'premium')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- DATA_ACCESS_REQUESTS TABLE - User requests for pool access
    CREATE TABLE IF NOT EXISTS data_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who is requesting
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,  -- Stored for admin display convenience
    
    -- What they're requesting
    pool_id UUID NOT NULL REFERENCES data_pools(id) ON DELETE CASCADE,
    
    -- Request details
    reason TEXT,                -- Optional: why they need access
    intended_use TEXT CHECK (intended_use IN ('learning', 'business', 'research', 'agency', 'other')),
    
    -- Status workflow
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'denied', 'revoked', 'expired')),
    
    -- Admin review
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    denial_reason TEXT,
    admin_notes TEXT,  -- Internal notes not shown to user
    
    -- Access period
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,     -- NULL = permanent access
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, pool_id)
    );

    -- Enable RLS
    ALTER TABLE data_pools ENABLE ROW LEVEL SECURITY;
    ALTER TABLE data_access_requests ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- RLS POLICIES FOR DATA_POOLS
    -- ============================================

    -- Anyone can view public pools (no auth required)
    CREATE POLICY "Anyone can view public data pools" ON data_pools 
    FOR SELECT USING (is_public = TRUE);

    -- Anyone can insert data pools (for now - can restrict later)
    CREATE POLICY "Anyone can create data pools" ON data_pools 
    FOR INSERT WITH CHECK (true);

    -- Anyone can update data pools (for now - can restrict later)
    CREATE POLICY "Anyone can update data pools" ON data_pools 
    FOR UPDATE USING (true);

    -- ============================================
    -- RLS POLICIES FOR DATA_ACCESS_REQUESTS
    -- ============================================

    -- Anyone can view all requests (for admin functionality)
    CREATE POLICY "Anyone can view access requests" ON data_access_requests 
    FOR SELECT USING (true);

    -- Anyone can create requests
    CREATE POLICY "Anyone can create access requests" ON data_access_requests 
    FOR INSERT WITH CHECK (true);

    -- Anyone can update requests (for admin approve/deny)
    CREATE POLICY "Anyone can update access requests" ON data_access_requests 
    FOR UPDATE USING (true);

    -- ============================================
    -- INDEXES
    -- ============================================

    CREATE INDEX IF NOT EXISTS idx_data_pools_industry ON data_pools(industry);
    CREATE INDEX IF NOT EXISTS idx_data_pools_platform ON data_pools(platform);
    CREATE INDEX IF NOT EXISTS idx_data_pools_audience ON data_pools(target_audience);
    CREATE INDEX IF NOT EXISTS idx_data_pools_format ON data_pools(creative_format);
    CREATE INDEX IF NOT EXISTS idx_data_pools_slug ON data_pools(slug);

    CREATE INDEX IF NOT EXISTS idx_data_access_requests_user ON data_access_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_data_access_requests_pool ON data_access_requests(pool_id);
    CREATE INDEX IF NOT EXISTS idx_data_access_requests_status ON data_access_requests(status);
    CREATE INDEX IF NOT EXISTS idx_data_access_requests_created ON data_access_requests(created_at DESC);

    -- ============================================
    -- HELPER FUNCTIONS
    -- ============================================

    -- Function to check if a user has access to a data pool
    CREATE OR REPLACE FUNCTION user_has_pool_access(p_user_id UUID, p_pool_id UUID)
    RETURNS BOOLEAN AS $$
    BEGIN
    RETURN EXISTS (
        SELECT 1 FROM data_access_requests
        WHERE user_id = p_user_id
        AND pool_id = p_pool_id
        AND status = 'approved'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Note: No sample data - pools are created by users/admins

-- ============================================
-- POOL CONTRIBUTIONS TABLE
-- Tracks user data shares to pools
-- ============================================

CREATE TABLE IF NOT EXISTS pool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is sharing
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What pool they're sharing to
  pool_id UUID NOT NULL REFERENCES data_pools(id) ON DELETE CASCADE,
  
  -- What ad they're sharing
  ad_id UUID NOT NULL,
  
  -- Shared metrics (anonymized aggregated data)
  success_score INTEGER,
  ctr DECIMAL(10,4),
  roas DECIMAL(10,2),
  impressions INTEGER,
  spend DECIMAL(12,2),
  conversions INTEGER,
  
  -- Shared traits for pattern analysis
  traits JSONB,         -- Array of traits like ['ugc', 'curiosity_hook', 'tiktok']
  industry TEXT,
  platform TEXT,
  creative_format TEXT,
  
  -- Timestamps
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, pool_id, ad_id)  -- User can only share each ad to a pool once
);

-- Enable RLS
ALTER TABLE pool_contributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pool_contributions
CREATE POLICY "Users can view their own contributions" ON pool_contributions 
  FOR SELECT USING (true);

CREATE POLICY "Users can create contributions" ON pool_contributions 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own contributions" ON pool_contributions 
  FOR DELETE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pool_contributions_user ON pool_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_contributions_pool ON pool_contributions(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_contributions_ad ON pool_contributions(ad_id);

-- ============================================
-- RECALCULATE POOL STATS FUNCTION
-- Updates pool averages when contributions change
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_pool_stats(p_pool_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE data_pools SET
    data_points = (SELECT COUNT(*) FROM pool_contributions WHERE pool_id = p_pool_id),
    contributors = (SELECT COUNT(DISTINCT user_id) FROM pool_contributions WHERE pool_id = p_pool_id),
    avg_success_rate = (SELECT AVG(success_score) FROM pool_contributions WHERE pool_id = p_pool_id),
    avg_ctr = (SELECT AVG(ctr) FROM pool_contributions WHERE pool_id = p_pool_id),
    avg_roas = (SELECT AVG(roas) FROM pool_contributions WHERE pool_id = p_pool_id),
    updated_at = NOW()
  WHERE id = p_pool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

