-- ================================================
-- ATHENA INTELLIGENCE PLATFORM - TABLES ONLY
-- ================================================
-- This version creates tables WITHOUT RLS policies
-- Add RLS policies manually later if needed
-- ================================================

-- Phase 1: Foundation (7 tables)

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hypothesis TEXT,
  expected_impact JSONB,
  version INTEGER DEFAULT 1,
  parent_id UUID,
  prompt_version_id UUID,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT,
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  applied_detected_at TIMESTAMPTZ,
  detection_method TEXT,
  pre_apply_snapshot JSONB,
  post_apply_snapshot JSONB,
  evaluation_status TEXT DEFAULT 'not_started',
  evaluation_window_days INTEGER DEFAULT 7,
  evaluation_started_at TIMESTAMPTZ,
  evaluation_completed_at TIMESTAMPTZ,
  actual_impact JSONB,
  confidence_score DECIMAL(5,4),
  confidence_factors JSONB,
  evidence JSONB,
  assumptions TEXT[],
  invalidation_conditions TEXT[],
  thresholds_used JSONB,
  priority_score DECIMAL(10,4),
  expected_impact_score DECIMAL(5,4),
  urgency_score DECIMAL(5,4),
  risk_score DECIMAL(5,4),
  source TEXT DEFAULT 'ai',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS recommendation_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID,
  baseline_start DATE,
  baseline_end DATE,
  comparison_start DATE,
  comparison_end DATE,
  baseline_metrics JSONB,
  comparison_metrics JSONB,
  metric_deltas JSONB,
  statistical_significance JSONB,
  sample_size_adequate BOOLEAN,
  hypothesis_validated BOOLEAN,
  outcome_classification TEXT,
  confidence_in_outcome DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,
  completeness_score DECIMAL(5,4),
  freshness_hours INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  recommendation_type TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  predicted_delta DECIMAL(12,4),
  actual_delta DECIMAL(12,4),
  accuracy_score DECIMAL(5,4),
  context_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  freshness_score INTEGER,
  completeness_score INTEGER,
  lag_score INTEGER,
  attribution_score INTEGER,
  api_stability_score INTEGER,
  consistency_score INTEGER,
  overall_health_score INTEGER,
  health_status TEXT,
  issues JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_stability_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action_details JSONB,
  state_before JSONB,
  state_after JSONB,
  prompt_version_id UUID,
  model_version TEXT,
  reasoning TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 2: Intelligence (8 tables)

CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  parent_run_id UUID,
  agent_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB,
  tool_output JSONB,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID,
  memory_type TEXT NOT NULL,
  content JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  memory_category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  description TEXT,
  source TEXT,
  confidence DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  pattern_type TEXT NOT NULL,
  pattern_hash TEXT NOT NULL,
  description TEXT NOT NULL,
  context JSONB,
  outcome TEXT NOT NULL,
  supporting_examples INTEGER DEFAULT 1,
  contradicting_examples INTEGER DEFAULT 0,
  confidence DECIMAL(5,4),
  first_observed_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
  times_applied INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  facebook_id TEXT,
  internal_ref UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID,
  to_entity_id UUID,
  relationship_type TEXT NOT NULL,
  weight DECIMAL(5,4) DEFAULT 1.0,
  confidence DECIMAL(5,4),
  properties JSONB DEFAULT '{}',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS causal_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name TEXT UNIQUE NOT NULL,
  node_type TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO causal_graph_nodes (node_name, node_type, description) VALUES
  ('budget', 'intervention', 'Campaign/adset budget'),
  ('bid', 'intervention', 'Bid amount'),
  ('audience_size', 'intervention', 'Target audience size'),
  ('creative_quality', 'intervention', 'Creative quality score'),
  ('impressions', 'mediator', 'Number of impressions'),
  ('reach', 'mediator', 'Unique users reached'),
  ('frequency', 'mediator', 'Avg impressions per user'),
  ('cpm', 'mediator', 'Cost per mille'),
  ('ctr', 'mediator', 'Click-through rate'),
  ('learning_phase', 'confounder', 'In learning phase'),
  ('seasonality', 'confounder', 'Seasonal effects'),
  ('competition', 'confounder', 'Auction competition'),
  ('conversions', 'outcome', 'Number of conversions'),
  ('roas', 'outcome', 'Return on ad spend'),
  ('cpa', 'outcome', 'Cost per acquisition')
ON CONFLICT (node_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS causal_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node TEXT,
  to_node TEXT,
  relationship TEXT NOT NULL,
  direction TEXT,
  avg_effect_size DECIMAL(10,4),
  effect_variance DECIMAL(10,4),
  sample_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3: Advanced (10 tables)

CREATE TABLE IF NOT EXISTS creative_performance_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  creative_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  frequency DECIMAL(6,4),
  ctr DECIMAL(8,6),
  cvr DECIMAL(8,6),
  cpa DECIMAL(12,4),
  ctr_decay_rate DECIMAL(10,6),
  cumulative_exposure INTEGER,
  saturation_index DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creative_fatigue_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  creative_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  current_ctr DECIMAL(8,6),
  peak_ctr DECIMAL(8,6),
  decline_percent DECIMAL(5,2),
  days_since_peak INTEGER,
  saturation_index DECIMAL(5,4),
  recommendation TEXT,
  estimated_recovery_days INTEGER,
  status TEXT DEFAULT 'active',
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  model_type TEXT NOT NULL,
  predictions JSONB,
  mape DECIMAL(8,6),
  rmse DECIMAL(12,4),
  confidence DECIMAL(5,4),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS what_if_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT,
  description TEXT,
  interventions JSONB,
  baseline_metrics JSONB,
  simulated_metrics JSONB,
  confidence_intervals JSONB,
  assumptions TEXT[],
  limitations TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mined_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  pattern_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB,
  effect_metric TEXT NOT NULL,
  effect_direction TEXT NOT NULL,
  effect_magnitude DECIMAL(10,4),
  effect_confidence DECIMAL(5,4),
  occurrences INTEGER DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  applicability JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasonal_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  peaks JSONB,
  troughs JSONB,
  sample_size INTEGER,
  confidence DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  max_daily_budget_change_pct INTEGER DEFAULT 30,
  max_weekly_budget_change_pct INTEGER DEFAULT 100,
  budget_approval_threshold_pct INTEGER DEFAULT 50,
  max_bid_increase_pct INTEGER DEFAULT 25,
  max_bid_decrease_pct INTEGER DEFAULT 50,
  max_changes_per_day INTEGER DEFAULT 20,
  max_changes_per_week INTEGER DEFAULT 50,
  change_cooldown_minutes INTEGER DEFAULT 5,
  risk_approval_threshold INTEGER DEFAULT 70,
  min_sample_size INTEGER DEFAULT 500,
  audit_retention_days INTEGER DEFAULT 365,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  requester_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  change_type TEXT NOT NULL,
  current_value JSONB,
  proposed_value JSONB,
  change_percent DECIMAL(10,4),
  risk_score INTEGER,
  risk_factors JSONB,
  status TEXT DEFAULT 'pending',
  requires_approval BOOLEAN DEFAULT true,
  approvers JSONB DEFAULT '[]',
  required_approvals INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS nl_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  original_query TEXT NOT NULL,
  parsed_intent TEXT,
  parsed_entities JSONB,
  parsed_metrics TEXT[],
  parse_confidence DECIMAL(5,4),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  response_time_ms INTEGER,
  result_count INTEGER,
  was_helpful BOOLEAN,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benchmark_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL,
  region TEXT,
  company_size TEXT,
  date_period TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  percentile_10 DECIMAL(12,4),
  percentile_25 DECIMAL(12,4),
  percentile_50 DECIMAL(12,4),
  percentile_75 DECIMAL(12,4),
  percentile_90 DECIMAL(12,4),
  sample_size INTEGER,
  min_contribution_threshold INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 4: Enterprise (7 tables)

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT DEFAULT 'own',
  conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO role_permissions (role, resource, action, scope) VALUES
  ('client', 'recommendations', 'read', 'own'),
  ('client', 'forecasts', 'read', 'own'),
  ('marketer', 'recommendations', 'read', 'own'),
  ('marketer', 'recommendations', 'create', 'own'),
  ('marketer', 'agents', 'execute', 'own'),
  ('admin', 'recommendations', 'read', 'org'),
  ('admin', 'governance', 'update', 'org'),
  ('organizer', '*', '*', 'all')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  variables TEXT[],
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'draft',
  created_by UUID,
  notes TEXT,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4) DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  avg_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS prompt_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id UUID,
  model_config_id UUID,
  variables JSONB,
  rendered_prompt TEXT,
  response TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  quality_score DECIMAL(5,4),
  user_feedback TEXT,
  error_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regression_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id UUID,
  model_config_id UUID,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  baseline_value DECIMAL(12,4),
  current_value DECIMAL(12,4),
  change_percent DECIMAL(8,4),
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  sample_size INTEGER,
  status TEXT DEFAULT 'active',
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  risk_threshold INTEGER DEFAULT 50,
  approver_roles TEXT[],
  required_approvals INTEGER DEFAULT 1,
  escalation_path TEXT[],
  timeout_hours INTEGER DEFAULT 24,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  user_id UUID,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  details JSONB,
  status TEXT,
  outcome TEXT,
  severity TEXT DEFAULT 'info',
  icon TEXT,
  parent_event_id UUID,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benchmark_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_hash TEXT NOT NULL,
  period TEXT NOT NULL,
  industry TEXT,
  region TEXT,
  company_size TEXT,
  campaign_type TEXT,
  metrics JSONB,
  contributed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- DONE! 32 tables created (no RLS policies)
-- ================================================
-- Tables created successfully!
-- You can add RLS policies later if needed
-- ================================================
