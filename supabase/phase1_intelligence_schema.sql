-- ============================================
-- ATHENA INTELLIGENCE PLATFORM - PHASE 1 SCHEMA
-- Foundation: Closed-Loop Learning, Confidence, 
-- Data Health, Explainability, Audit Logs
-- ============================================

-- ============================================
-- 1. AI RECOMMENDATIONS (Extended)
-- Closed-loop outcome learning with hypothesis tracking
-- ============================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Recommendation content
  recommendation_type TEXT NOT NULL,          -- 'creative', 'budget', 'audience', 'bid', 'schedule'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hypothesis TEXT NOT NULL,                   -- "Increasing budget by 20% will improve ROAS by 15%"
  expected_impact JSONB,                      -- {metric: 'roas', delta: 15, confidence: 0.72}
  
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES ai_recommendations(id),
  prompt_version_id UUID,                     -- Will reference ai_prompt_versions in Phase 4
  
  -- Target
  target_type TEXT NOT NULL,                  -- 'ad', 'adset', 'campaign', 'creative', 'account'
  target_id TEXT NOT NULL,
  target_name TEXT,
  
  -- User response tracking
  status TEXT DEFAULT 'pending',              -- 'pending', 'accepted', 'rejected', 'auto_applied', 'expired', 'superseded'
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Application detection
  applied_detected_at TIMESTAMPTZ,
  detection_method TEXT,                      -- 'api_diff', 'user_confirm', 'inferred'
  pre_apply_snapshot JSONB,                   -- Metrics snapshot before application
  post_apply_snapshot JSONB,                  -- Metrics snapshot after application
  
  -- Evaluation tracking
  evaluation_status TEXT DEFAULT 'not_started', -- 'not_started', 'pending', 'in_progress', 'completed', 'insufficient_data'
  evaluation_window_days INTEGER DEFAULT 7,
  evaluation_started_at TIMESTAMPTZ,
  evaluation_completed_at TIMESTAMPTZ,
  actual_impact JSONB,                        -- {metric: 'roas', delta: 12, p_value: 0.03, significant: true}
  
  -- Confidence scoring (Capability 2)
  confidence_score DECIMAL(5,4),              -- 0.0000 to 1.0000
  confidence_factors JSONB,                   -- {dataVolume: 0.8, variance: 0.6, freshness: 0.9, ...}
  
  -- Explainability (Capability 10)
  evidence JSONB,                             -- Supporting data points
  assumptions TEXT[],                         -- What we're assuming to be true
  invalidation_conditions TEXT[],             -- When this becomes invalid
  thresholds_used JSONB,                      -- Decision boundaries used
  
  -- Priority scoring (Capability 17)
  priority_score DECIMAL(10,4),               -- Combined priority score
  expected_impact_score DECIMAL(5,4),         -- 0-1
  urgency_score DECIMAL(5,4),                 -- 0-1
  risk_score DECIMAL(5,4),                    -- 0-1 (lower = less risky)
  
  -- Metadata
  source TEXT DEFAULT 'ai',                   -- 'ai', 'rule', 'user_request'
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for recommendations
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_target ON ai_recommendations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type ON ai_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_eval ON ai_recommendations(evaluation_status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_priority ON ai_recommendations(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created ON ai_recommendations(created_at DESC);


-- ============================================
-- 2. RECOMMENDATION EVALUATIONS
-- Pre/post performance comparison with statistical analysis
-- ============================================

CREATE TABLE IF NOT EXISTS recommendation_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES ai_recommendations(id) ON DELETE CASCADE,
  
  -- Performance windows
  baseline_start DATE NOT NULL,
  baseline_end DATE NOT NULL,
  comparison_start DATE NOT NULL,
  comparison_end DATE NOT NULL,
  
  -- Raw metrics
  baseline_metrics JSONB NOT NULL,            -- {impressions: 10000, spend: 500, roas: 2.1, ctr: 0.025}
  comparison_metrics JSONB NOT NULL,
  
  -- Statistical analysis
  metric_deltas JSONB,                        -- {roas: {absolute: 0.5, pct_change: 23.8}}
  statistical_significance JSONB,             -- {roas: {p_value: 0.02, significant: true, test: 't-test'}}
  sample_size_adequate BOOLEAN,
  min_sample_required INTEGER,
  actual_sample_size INTEGER,
  
  -- Outcome classification
  hypothesis_validated BOOLEAN,
  outcome_classification TEXT,                -- 'success', 'failure', 'inconclusive', 'mixed', 'neutral'
  confidence_in_outcome DECIMAL(5,4),
  
  -- Notes
  notes TEXT,
  external_factors TEXT[],                    -- Known events that may have affected results
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_evaluations_rec ON recommendation_evaluations(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_evaluations_outcome ON recommendation_evaluations(outcome_classification);


-- ============================================
-- 3. METRIC SNAPSHOTS
-- Rolling window performance tracking for baseline comparison
-- ============================================

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  entity_type TEXT NOT NULL,                  -- 'ad', 'adset', 'campaign', 'account'
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  snapshot_date DATE NOT NULL,
  
  -- Core metrics stored as JSONB for flexibility
  metrics JSONB NOT NULL,                     -- All metrics for this day
  
  -- Breakdowns (optional)
  demographics JSONB,                         -- Age/gender breakdown
  placements JSONB,                           -- Platform/position breakdown
  devices JSONB,                              -- Device breakdown
  
  -- Data quality indicators
  completeness_score DECIMAL(5,4),            -- 0-1, percentage of expected fields present
  freshness_hours INTEGER,                    -- Hours since this data was last updated by platform
  is_partial BOOLEAN DEFAULT FALSE,           -- True if data may be incomplete
  
  -- Source tracking
  source TEXT DEFAULT 'facebook',             -- 'facebook', 'manual', 'inferred'
  api_response_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, entity_type, entity_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_entity ON metric_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_date ON metric_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_user ON metric_snapshots(user_id);


-- ============================================
-- 4. RECOMMENDATION ACCURACY LOG
-- Track prediction accuracy for confidence calibration
-- ============================================

CREATE TABLE IF NOT EXISTS recommendation_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recommendation context
  recommendation_id UUID REFERENCES ai_recommendations(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  
  -- Prediction vs Reality
  predicted_delta DECIMAL(12,4),
  predicted_direction TEXT,                   -- 'increase', 'decrease', 'maintain'
  actual_delta DECIMAL(12,4),
  actual_direction TEXT,
  
  -- Accuracy calculation
  accuracy_score DECIMAL(5,4),                -- 1 - |predicted - actual| / |predicted|
  direction_correct BOOLEAN,                  -- Did we get the direction right?
  magnitude_error_pct DECIMAL(10,4),          -- How far off was the magnitude?
  
  -- Context for similarity matching
  context_hash TEXT,                          -- Hash of key context features
  context_features JSONB,                     -- {budget_tier: 'medium', objective: 'conversions', ...}
  
  -- Timing
  prediction_made_at TIMESTAMPTZ,
  outcome_measured_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accuracy_log_type ON recommendation_accuracy_log(recommendation_type, target_metric);
CREATE INDEX IF NOT EXISTS idx_accuracy_log_context ON recommendation_accuracy_log(context_hash);
CREATE INDEX IF NOT EXISTS idx_accuracy_log_created ON recommendation_accuracy_log(created_at DESC);


-- ============================================
-- 5. DATA HEALTH SCORES
-- Per-entity health tracking for data quality subsystem
-- ============================================

CREATE TABLE IF NOT EXISTS data_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  
  -- Individual scores (0-100)
  freshness_score INTEGER,                    -- Based on hours since last sync
  completeness_score INTEGER,                 -- Percentage of fields with valid data
  lag_score INTEGER,                          -- Reporting delay health
  attribution_score INTEGER,                  -- Conversion attribution window health
  api_stability_score INTEGER,                -- Based on recent API success rate
  consistency_score INTEGER,                  -- Data consistency over time
  
  -- Aggregate health
  overall_health_score INTEGER,
  health_status TEXT,                         -- 'healthy' (80+), 'degraded' (50-79), 'unhealthy' (<50)
  
  -- Detected issues
  issues JSONB,                               -- [{type: 'stale_data', severity: 'warning', message: '...'}]
  
  -- Impact on AI
  recommendation_confidence_modifier DECIMAL(5,4), -- Multiplier for confidence when health is low
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  data_as_of TIMESTAMPTZ,                     -- When the underlying data was last updated
  
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_health_scores_user ON data_health_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_entity ON data_health_scores(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_status ON data_health_scores(health_status);


-- ============================================
-- 6. API STABILITY LOG
-- Track API call success/failure for stability scoring
-- ============================================

CREATE TABLE IF NOT EXISTS api_stability_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request info
  endpoint TEXT NOT NULL,                     -- '/api/facebook/ads', '/api/facebook/insights', etc.
  method TEXT NOT NULL,                       -- 'GET', 'POST'
  
  -- Response info
  status_code INTEGER,
  success BOOLEAN,
  error_type TEXT,                            -- 'rate_limit', 'auth_error', 'timeout', 'server_error'
  error_message TEXT,
  
  -- Performance
  response_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Context
  user_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_stability_endpoint ON api_stability_log(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_stability_success ON api_stability_log(success, created_at DESC);

-- Auto-cleanup old logs (keep 30 days)
-- Run via cron: DELETE FROM api_stability_log WHERE created_at < NOW() - INTERVAL '30 days';


-- ============================================
-- 7. AI AUDIT LOGS (Immutable)
-- Every AI decision, recommendation, and action logged
-- ============================================

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  user_id UUID,
  session_id TEXT,
  
  -- Action classification
  action_type TEXT NOT NULL,                  -- See action types below
  action_category TEXT NOT NULL,              -- 'recommendation', 'automation', 'guardrail', 'override', 'system'
  
  -- Entity context
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  
  -- Action details (immutable snapshot)
  action_details JSONB NOT NULL,
  state_before JSONB,
  state_after JSONB,
  
  -- AI context
  prompt_version_id UUID,
  model_version TEXT,
  reasoning TEXT,
  confidence DECIMAL(5,4),
  
  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action types:
-- recommendation: created, accepted, rejected, expired, superseded, auto_applied
-- automation: action_executed, action_failed, action_rolled_back
-- guardrail: rule_triggered, rule_blocked, rule_overridden
-- override: user_override, admin_override, emergency_stop
-- system: sync_started, sync_completed, evaluation_started, evaluation_completed

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON ai_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON ai_audit_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON ai_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON ai_audit_logs(created_at DESC);


-- ============================================
-- ENABLE RLS FOR ALL PHASE 1 TABLES
-- ============================================

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_accuracy_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_stability_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;


-- ============================================
-- RLS POLICIES
-- ============================================

-- AI Recommendations: Users see own; admins see org
DROP POLICY IF EXISTS "Users view own recommendations" ON ai_recommendations;
CREATE POLICY "Users view own recommendations" ON ai_recommendations
  FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

DROP POLICY IF EXISTS "Users insert own recommendations" ON ai_recommendations;
CREATE POLICY "Users insert own recommendations" ON ai_recommendations
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users update own recommendations" ON ai_recommendations;
CREATE POLICY "Users update own recommendations" ON ai_recommendations
  FOR UPDATE USING (user_id = auth.uid());


-- Recommendation Evaluations: Linked to recommendations access
DROP POLICY IF EXISTS "Users view own evaluations" ON recommendation_evaluations;
CREATE POLICY "Users view own evaluations" ON recommendation_evaluations
  FOR SELECT USING (
    recommendation_id IN (SELECT id FROM ai_recommendations WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

DROP POLICY IF EXISTS "System insert evaluations" ON recommendation_evaluations;
CREATE POLICY "System insert evaluations" ON recommendation_evaluations
  FOR INSERT WITH CHECK (true);


-- Metric Snapshots: Users see own
DROP POLICY IF EXISTS "Users view own snapshots" ON metric_snapshots;
CREATE POLICY "Users view own snapshots" ON metric_snapshots
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "System insert snapshots" ON metric_snapshots;
CREATE POLICY "System insert snapshots" ON metric_snapshots
  FOR INSERT WITH CHECK (true);


-- Accuracy Log: Read by system; admins can view
DROP POLICY IF EXISTS "Admins view accuracy log" ON recommendation_accuracy_log;
CREATE POLICY "Admins view accuracy log" ON recommendation_accuracy_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );

DROP POLICY IF EXISTS "System insert accuracy" ON recommendation_accuracy_log;
CREATE POLICY "System insert accuracy" ON recommendation_accuracy_log
  FOR INSERT WITH CHECK (true);


-- Data Health Scores: Users see own
DROP POLICY IF EXISTS "Users view own health" ON data_health_scores;
CREATE POLICY "Users view own health" ON data_health_scores
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "System manage health" ON data_health_scores;
CREATE POLICY "System manage health" ON data_health_scores
  FOR ALL USING (true);


-- API Stability Log: Insert only; admins read
DROP POLICY IF EXISTS "System insert stability" ON api_stability_log;
CREATE POLICY "System insert stability" ON api_stability_log
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view stability" ON api_stability_log;
CREATE POLICY "Admins view stability" ON api_stability_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
  );


-- AI Audit Logs: Append only (immutable); admins read
DROP POLICY IF EXISTS "Audit append only" ON ai_audit_logs;
CREATE POLICY "Audit append only" ON ai_audit_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view audit" ON ai_audit_logs;
CREATE POLICY "Admins view audit" ON ai_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer'))
    OR user_id = auth.uid()
  );

-- No UPDATE or DELETE policies on ai_audit_logs = truly immutable


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate overall health score
CREATE OR REPLACE FUNCTION calculate_health_score(
  freshness INTEGER,
  completeness INTEGER,
  lag INTEGER,
  attribution INTEGER,
  api_stability INTEGER,
  consistency INTEGER
) RETURNS INTEGER AS $$
DECLARE
  weights RECORD;
  score DECIMAL;
BEGIN
  -- Weighted average
  SELECT 
    0.20 AS freshness_w,
    0.25 AS completeness_w,
    0.15 AS lag_w,
    0.15 AS attribution_w,
    0.15 AS api_stability_w,
    0.10 AS consistency_w
  INTO weights;
  
  score := (
    COALESCE(freshness, 0) * weights.freshness_w +
    COALESCE(completeness, 0) * weights.completeness_w +
    COALESCE(lag, 0) * weights.lag_w +
    COALESCE(attribution, 0) * weights.attribution_w +
    COALESCE(api_stability, 0) * weights.api_stability_w +
    COALESCE(consistency, 0) * weights.consistency_w
  );
  
  RETURN ROUND(score)::INTEGER;
END;
$$ LANGUAGE plpgsql;


-- Function to determine health status from score
CREATE OR REPLACE FUNCTION get_health_status(score INTEGER) 
RETURNS TEXT AS $$
BEGIN
  IF score >= 80 THEN RETURN 'healthy';
  ELSIF score >= 50 THEN RETURN 'degraded';
  ELSE RETURN 'unhealthy';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Function to log AI audit event
CREATE OR REPLACE FUNCTION log_ai_action(
  p_user_id UUID,
  p_action_type TEXT,
  p_action_category TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_details JSONB,
  p_state_before JSONB DEFAULT NULL,
  p_state_after JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO ai_audit_logs (
    user_id, action_type, action_category,
    entity_type, entity_id, action_details,
    state_before, state_after
  ) VALUES (
    p_user_id, p_action_type, p_action_category,
    p_entity_type, p_entity_id, p_details,
    p_state_before, p_state_after
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SUMMARY
-- ============================================
-- Tables created:
-- 1. ai_recommendations - Extended recommendations with hypothesis tracking
-- 2. recommendation_evaluations - Pre/post statistical comparison
-- 3. metric_snapshots - Daily metrics for baseline comparison
-- 4. recommendation_accuracy_log - Confidence calibration data
-- 5. data_health_scores - Per-entity health tracking
-- 6. api_stability_log - API reliability tracking
-- 7. ai_audit_logs - Immutable action log
--
-- Functions created:
-- - calculate_health_score()
-- - get_health_status()
-- - log_ai_action()
