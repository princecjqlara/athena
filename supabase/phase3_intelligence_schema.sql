-- ================================================
-- Phase 3: Advanced Intelligence Schema
-- ================================================
-- Tables for creative performance, forecasting, 
-- pattern mining, and benchmark data
-- ================================================

-- ================================================
-- 1. CREATIVE PERFORMANCE TRACKING
-- ================================================

-- creative_performance_curves - Track performance over time
CREATE TABLE IF NOT EXISTS creative_performance_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creative_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  
  -- Daily performance
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  frequency DECIMAL(6,4),
  ctr DECIMAL(8,6),
  cvr DECIMAL(8,6),
  cpa DECIMAL(12,4),
  
  -- Fatigue indicators
  ctr_decay_rate DECIMAL(10,6),       -- Day-over-day CTR change
  cumulative_exposure INTEGER,         -- Total impressions to date
  saturation_index DECIMAL(5,4),       -- 0-1, how saturated the audience is
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(creative_id, date)
);

-- RLS for creative_performance_curves
ALTER TABLE creative_performance_curves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own creative curves" ON creative_performance_curves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own creative curves" ON creative_performance_curves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- creative_fatigue_alerts - Automated fatigue detection
CREATE TABLE IF NOT EXISTS creative_fatigue_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creative_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  
  -- Alert details
  alert_type TEXT NOT NULL,           -- 'decay_detected', 'saturation_warning', 'refresh_recommended'
  severity TEXT NOT NULL,              -- 'low', 'medium', 'high', 'critical'
  
  -- Metrics at time of alert
  current_ctr DECIMAL(8,6),
  peak_ctr DECIMAL(8,6),
  decline_percent DECIMAL(5,2),
  days_since_peak INTEGER,
  saturation_index DECIMAL(5,4),
  
  -- Recommendations
  recommendation TEXT,
  estimated_recovery_days INTEGER,
  
  -- Status
  status TEXT DEFAULT 'active',        -- 'active', 'acknowledged', 'resolved'
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for creative_fatigue_alerts
ALTER TABLE creative_fatigue_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fatigue alerts" ON creative_fatigue_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fatigue alerts" ON creative_fatigue_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fatigue alerts" ON creative_fatigue_alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- ================================================
-- 2. FORECASTING & SIMULATIONS
-- ================================================

-- forecasts - Stored forecasts for entities
CREATE TABLE IF NOT EXISTS forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,           -- 'ad', 'adset', 'campaign', 'account'
  entity_id TEXT NOT NULL,
  
  -- Forecast parameters
  metric TEXT NOT NULL,                -- 'spend', 'conversions', 'roas', etc.
  horizon_days INTEGER NOT NULL,
  model_type TEXT NOT NULL,            -- 'linear', 'exponential', 'moving_average', 'arima'
  
  -- Predictions
  predictions JSONB NOT NULL,          -- Array of {date, value, lower_bound, upper_bound}
  
  -- Quality metrics
  mape DECIMAL(8,6),                   -- Mean Absolute Percentage Error
  rmse DECIMAL(12,4),                  -- Root Mean Square Error
  confidence DECIMAL(5,4),
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forecasts_entity ON forecasts(entity_type, entity_id);
CREATE INDEX idx_forecasts_expires ON forecasts(expires_at);

-- RLS for forecasts
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own forecasts" ON forecasts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own forecasts" ON forecasts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- what_if_simulations - Stored simulation results
CREATE TABLE IF NOT EXISTS what_if_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Simulation parameters
  name TEXT,
  description TEXT,
  
  -- Interventions
  interventions JSONB NOT NULL,        -- Array of {variable, change_type, value}
  
  -- Results
  baseline_metrics JSONB NOT NULL,
  simulated_metrics JSONB NOT NULL,
  confidence_intervals JSONB,
  assumptions TEXT[],
  limitations TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for what_if_simulations
ALTER TABLE what_if_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own simulations" ON what_if_simulations
  FOR ALL USING (auth.uid() = user_id);

-- ================================================
-- 3. PATTERN MINING
-- ================================================

-- mined_patterns - Discovered patterns from data
CREATE TABLE IF NOT EXISTS mined_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Pattern identification
  pattern_type TEXT NOT NULL,          -- 'success', 'failure', 'seasonal', 'cross_campaign'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Pattern conditions
  conditions JSONB NOT NULL,           -- Array of {variable, operator, value}
  
  -- Effect
  effect_metric TEXT NOT NULL,
  effect_direction TEXT NOT NULL,      -- 'increase', 'decrease'
  effect_magnitude DECIMAL(10,4),      -- Percentage
  effect_confidence DECIMAL(5,4),
  
  -- Evidence
  occurrences INTEGER DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Applicability
  applicability JSONB,                 -- {industries, budget_ranges, campaign_types}
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mined_patterns_org ON mined_patterns(org_id);
CREATE INDEX idx_mined_patterns_type ON mined_patterns(pattern_type);

-- RLS for mined_patterns
ALTER TABLE mined_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view patterns" ON mined_patterns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = mined_patterns.org_id
    )
  );

CREATE POLICY "Org admins can manage patterns" ON mined_patterns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = mined_patterns.org_id
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

-- seasonal_patterns - Detected seasonality
CREATE TABLE IF NOT EXISTS seasonal_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Pattern details
  period TEXT NOT NULL,                -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  metric TEXT NOT NULL,
  
  -- Peaks and troughs
  peaks JSONB,                         -- Array of {label, multiplier, confidence}
  troughs JSONB,
  
  -- Quality
  sample_size INTEGER,
  confidence DECIMAL(5,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, period, metric)
);

-- RLS for seasonal_patterns
ALTER TABLE seasonal_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view seasonal patterns" ON seasonal_patterns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = seasonal_patterns.org_id
    )
  );

-- ================================================
-- 4. GOVERNANCE & APPROVALS
-- ================================================

-- governance_config - Organization-level governance settings
CREATE TABLE IF NOT EXISTS governance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  
  -- Budget guardrails
  max_daily_budget_change_pct INTEGER DEFAULT 30,
  max_weekly_budget_change_pct INTEGER DEFAULT 100,
  budget_approval_threshold_pct INTEGER DEFAULT 50,
  
  -- Bid guardrails
  max_bid_increase_pct INTEGER DEFAULT 25,
  max_bid_decrease_pct INTEGER DEFAULT 50,
  
  -- Rate limits
  max_changes_per_day INTEGER DEFAULT 20,
  max_changes_per_week INTEGER DEFAULT 50,
  change_cooldown_minutes INTEGER DEFAULT 5,
  
  -- Risk thresholds
  risk_approval_threshold INTEGER DEFAULT 70,
  min_sample_size INTEGER DEFAULT 500,
  
  -- Audit settings
  audit_retention_days INTEGER DEFAULT 365,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for governance_config
ALTER TABLE governance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage governance" ON governance_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = governance_config.org_id
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

CREATE POLICY "Org members can view governance" ON governance_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = governance_config.org_id
    )
  );

-- change_requests - Pending approval requests
CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Target
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  
  -- Change details
  change_type TEXT NOT NULL,           -- 'budget', 'bid', 'status', 'targeting', 'creative'
  current_value JSONB,
  proposed_value JSONB,
  change_percent DECIMAL(10,4),
  
  -- Risk assessment
  risk_score INTEGER,
  risk_factors JSONB,                  -- Array of {factor, score, description}
  
  -- Approval workflow
  status TEXT DEFAULT 'pending',       -- 'pending', 'approved', 'rejected', 'auto_approved', 'auto_rejected'
  requires_approval BOOLEAN DEFAULT true,
  approvers JSONB DEFAULT '[]',        -- Array of {user_id, name, decision, comment, decided_at}
  required_approvals INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_change_requests_org ON change_requests(org_id, status);
CREATE INDEX idx_change_requests_status ON change_requests(status);

-- RLS for change_requests
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view change requests" ON change_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = change_requests.org_id
    )
  );

CREATE POLICY "Users can create change requests" ON change_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = change_requests.org_id
    )
  );

CREATE POLICY "Approvers can update change requests" ON change_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = change_requests.org_id
      AND user_profiles.role IN ('admin', 'organizer', 'marketer')
    )
  );

-- ================================================
-- 5. NL QUERY LOGS
-- ================================================

-- nl_query_logs - Track natural language queries
CREATE TABLE IF NOT EXISTS nl_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  
  -- Query
  original_query TEXT NOT NULL,
  parsed_intent TEXT,
  parsed_entities JSONB,
  parsed_metrics TEXT[],
  parse_confidence DECIMAL(5,4),
  
  -- Execution
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  response_time_ms INTEGER,
  result_count INTEGER,
  
  -- Feedback
  was_helpful BOOLEAN,
  feedback TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nl_query_logs_user ON nl_query_logs(user_id, created_at);

-- RLS for nl_query_logs
ALTER TABLE nl_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own query logs" ON nl_query_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ================================================
-- 6. BENCHMARKS (Privacy-Safe)
-- ================================================

-- benchmark_data - Anonymized industry benchmarks
CREATE TABLE IF NOT EXISTS benchmark_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimensions
  industry TEXT NOT NULL,
  region TEXT,
  company_size TEXT,                   -- 'small', 'medium', 'large'
  date_period TEXT NOT NULL,           -- '2024-Q1', '2024-01', etc.
  
  -- Metrics (aggregated, anonymized)
  metric_name TEXT NOT NULL,
  percentile_10 DECIMAL(12,4),
  percentile_25 DECIMAL(12,4),
  percentile_50 DECIMAL(12,4),
  percentile_75 DECIMAL(12,4),
  percentile_90 DECIMAL(12,4),
  
  -- Sample info
  sample_size INTEGER,
  min_contribution_threshold INTEGER DEFAULT 5, -- Min orgs to include
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(industry, region, company_size, date_period, metric_name)
);

-- Public read access for benchmarks
ALTER TABLE benchmark_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benchmarks are publicly readable" ON benchmark_data
  FOR SELECT USING (sample_size >= min_contribution_threshold);

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Function to calculate decay rate
CREATE OR REPLACE FUNCTION calculate_ctr_decay(
  creative_id_param TEXT,
  lookback_days INTEGER DEFAULT 7
) RETURNS DECIMAL AS $$
DECLARE
  slope DECIMAL;
BEGIN
  WITH daily_data AS (
    SELECT 
      date,
      ctr,
      ROW_NUMBER() OVER (ORDER BY date) as day_num
    FROM creative_performance_curves
    WHERE creative_id = creative_id_param
    AND date > CURRENT_DATE - lookback_days
  ),
  regression AS (
    SELECT
      REGR_SLOPE(ctr, day_num) as slope
    FROM daily_data
  )
  SELECT COALESCE(regression.slope, 0) INTO slope FROM regression;
  
  RETURN slope;
END;
$$ LANGUAGE plpgsql;

-- Function to get active change requests for approval
CREATE OR REPLACE FUNCTION get_pending_approvals(
  org_id_param UUID
) RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_name TEXT,
  change_type TEXT,
  risk_score INTEGER,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.entity_type,
    cr.entity_name,
    cr.change_type,
    cr.risk_score,
    cr.created_at,
    cr.expires_at
  FROM change_requests cr
  WHERE cr.org_id = org_id_param
  AND cr.status = 'pending'
  AND cr.expires_at > NOW()
  ORDER BY cr.risk_score DESC, cr.created_at ASC;
END;
$$ LANGUAGE plpgsql;
