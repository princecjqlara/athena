-- =====================================================
-- ATHENA AI UPGRADE SCHEMA
-- Accuracy, Trust & Reliability Enhancement
-- =====================================================

-- =====================================================
-- 1. RECOMMENDATIONS TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS athena_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Recommendation details
    recommendation_type TEXT NOT NULL, -- 'budget', 'creative', 'audience', 'pause', 'scale'
    entity_type TEXT NOT NULL,         -- 'ad', 'adset', 'campaign'
    entity_id TEXT NOT NULL,
    
    -- Content
    title TEXT NOT NULL,
    description TEXT,
    action_json JSONB NOT NULL,        -- {type, params, expected_impact}
    
    -- Confidence & Evidence
    confidence_score DECIMAL(3,2),     -- 0.00 to 1.00
    evidence_json JSONB,               -- {data_points, variance, completeness, sources}
    reasoning_steps JSONB,             -- Agent reasoning chain
    
    -- Status
    status TEXT DEFAULT 'pending',     -- pending, accepted, rejected, applied, expired
    user_feedback TEXT,
    applied_at TIMESTAMPTZ,
    
    -- Impact tracking
    baseline_metrics JSONB,
    evaluation_window_start TIMESTAMPTZ,
    evaluation_window_end TIMESTAMPTZ,
    
    -- Metadata
    agent_run_id UUID,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_org ON athena_recommendations(org_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON athena_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_entity ON athena_recommendations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON athena_recommendations(created_at DESC);

-- =====================================================
-- 2. RECOMMENDATION EVENTS (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS recommendation_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recommendation_id UUID REFERENCES athena_recommendations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- 'created', 'viewed', 'accepted', 'rejected', 'applied', 'evaluated'
    event_data JSONB,
    user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_events_rec_id ON recommendation_events(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_events_type ON recommendation_events(event_type);

-- =====================================================
-- 3. EVALUATION RUNS (Before/After Impact)
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluation_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recommendation_id UUID REFERENCES athena_recommendations(id) ON DELETE CASCADE,
    
    -- Window definition
    before_start TIMESTAMPTZ,
    before_end TIMESTAMPTZ,
    after_start TIMESTAMPTZ,
    after_end TIMESTAMPTZ,
    
    -- Metrics
    before_metrics JSONB,  -- {spend, cpa, roas, ctr, cvr, conversions}
    after_metrics JSONB,
    
    -- Statistical analysis
    lift_pct DECIMAL(10,2),
    p_value DECIMAL(5,4),
    is_significant BOOLEAN,
    sample_size_before INT,
    sample_size_after INT,
    
    -- Result
    outcome TEXT,          -- 'positive', 'negative', 'neutral', 'insufficient_data'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_rec ON evaluation_runs(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_outcome ON evaluation_runs(outcome);

-- =====================================================
-- 4. DATA HEALTH SCORES
-- =====================================================

CREATE TABLE IF NOT EXISTS data_health_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,  -- 'ad_account', 'campaign', 'pixel', 'capi'
    entity_id TEXT NOT NULL,
    
    -- Health metrics (0-100)
    overall_score INT,
    completeness_score INT,     -- Missing required fields
    freshness_score INT,        -- Data recency / API lag
    attribution_score INT,      -- Pixel vs CAPI match rate
    schema_score INT,           -- Expected vs actual schema
    
    -- Issues
    issues_json JSONB,          -- [{type, severity, description, affected_fields}]
    
    -- Trends
    score_7d_ago INT,
    score_30d_ago INT,
    
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_health_org ON data_health_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_health_low_scores ON data_health_scores(overall_score) WHERE overall_score < 70;

-- =====================================================
-- 5. ANOMALIES & ALERTS
-- =====================================================

CREATE TABLE IF NOT EXISTS anomalies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id TEXT NOT NULL,
    
    -- What
    anomaly_type TEXT NOT NULL,  -- 'spend_spike', 'cpa_spike', 'roas_drop', 'tracking_break', 'creative_fatigue'
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    
    -- Details
    metric_name TEXT NOT NULL,
    expected_value DECIMAL(15,4),
    actual_value DECIMAL(15,4),
    deviation_pct DECIMAL(10,2),
    severity TEXT,               -- 'low', 'medium', 'high', 'critical'
    
    -- Context
    baseline_json JSONB,         -- Seasonality-adjusted baseline
    context_json JSONB,          -- Related metrics, recent changes
    
    -- Status
    status TEXT DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'false_positive'
    acknowledged_by TEXT,
    resolved_at TIMESTAMPTZ,
    
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_org ON anomalies(org_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON anomalies(detected_at DESC);

-- =====================================================
-- 6. AGENT RUNS (Multi-Step Reasoning)
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Trigger
    trigger_type TEXT,           -- 'user_query', 'scheduled', 'anomaly', 'threshold'
    input_query TEXT,
    
    -- Execution
    steps_json JSONB,            -- [{step, tool, input, output, duration_ms}]
    tools_used TEXT[],
    total_duration_ms INT,
    
    -- Output
    recommendations_generated INT DEFAULT 0,
    final_output JSONB,
    
    -- Status
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'timeout'
    error_message TEXT,
    
    -- Versioning
    prompt_version TEXT,
    model_version TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org ON agent_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at DESC);

-- =====================================================
-- 7. PROMPT VERSIONS (A/B Testing)
-- =====================================================

CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_name TEXT NOT NULL,       -- 'recommendation_generator', 'anomaly_analyzer'
    version TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    tool_definitions JSONB,
    
    -- Performance
    total_runs INT DEFAULT 0,
    avg_confidence DECIMAL(3,2),
    avg_accept_rate DECIMAL(3,2),
    avg_positive_outcome_rate DECIMAL(3,2),
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(prompt_name, version)
);

CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompt_versions(prompt_name);
CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompt_versions(is_active) WHERE is_active = true;

-- =====================================================
-- 8. USER PREFERENCES (KPI Settings)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_ai_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL,
    
    -- KPI Preferences
    primary_kpi TEXT DEFAULT 'roas',           -- 'roas', 'cpa', 'ctr', 'cvr'
    secondary_kpis TEXT[],
    kpi_targets JSONB,                         -- {roas: 3.0, cpa: 25.00}
    
    -- Constraints
    min_budget DECIMAL(10,2),
    max_budget DECIMAL(10,2),
    never_pause_entities TEXT[],               -- Entity IDs to never pause
    never_recommend_actions TEXT[],            -- Action types to never suggest
    
    -- Alert Preferences
    alert_thresholds JSONB,                    -- Override default thresholds
    notification_channels TEXT[],              -- ['email', 'in_app', 'slack']
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_prefs_org ON user_ai_preferences(org_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE athena_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_preferences ENABLE ROW LEVEL SECURITY;

-- Open policies (API uses service role key for authorization)
CREATE POLICY "service_all" ON athena_recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON recommendation_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON evaluation_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON data_health_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON anomalies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON agent_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON prompt_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON user_ai_preferences FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_ai_preferences_timestamp ON user_ai_preferences;
CREATE TRIGGER update_user_ai_preferences_timestamp
    BEFORE UPDATE ON user_ai_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
