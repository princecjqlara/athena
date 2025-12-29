-- ================================================
-- Phase 4: Enterprise Features Schema
-- ================================================
-- RBAC, Prompt Versioning, Approvals, Benchmarks,
-- and Timeline tables
-- ================================================

-- ================================================
-- 1. ENHANCED RBAC & PERMISSIONS
-- ================================================

-- role_permissions - Fine-grained permission assignments
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  role TEXT NOT NULL,                  -- 'organizer', 'admin', 'marketer', 'client'
  resource TEXT NOT NULL,              -- 'recommendations', 'automations', 'governance', etc.
  action TEXT NOT NULL,                -- 'create', 'read', 'update', 'delete', 'approve', 'execute'
  
  -- Scope limitations
  scope TEXT DEFAULT 'own',            -- 'own', 'team', 'org', 'all'
  conditions JSONB,                    -- Additional conditions (e.g., {max_budget: 1000})
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(role, resource, action)
);

-- Seed default permissions
INSERT INTO role_permissions (role, resource, action, scope) VALUES
  -- Client (read-only)
  ('client', 'recommendations', 'read', 'own'),
  ('client', 'forecasts', 'read', 'own'),
  ('client', 'patterns', 'read', 'org'),
  
  -- Marketer
  ('marketer', 'recommendations', 'read', 'own'),
  ('marketer', 'recommendations', 'create', 'own'),
  ('marketer', 'recommendations', 'approve', 'own'),
  ('marketer', 'automations', 'read', 'own'),
  ('marketer', 'automations', 'create', 'own'),
  ('marketer', 'automations', 'update', 'own'),
  ('marketer', 'agents', 'execute', 'own'),
  ('marketer', 'agents', 'read', 'own'),
  ('marketer', 'forecasts', 'read', 'own'),
  ('marketer', 'simulations', 'create', 'own'),
  ('marketer', 'governance', 'read', 'org'),
  
  -- Admin
  ('admin', 'recommendations', 'read', 'org'),
  ('admin', 'recommendations', 'create', 'org'),
  ('admin', 'recommendations', 'approve', 'org'),
  ('admin', 'recommendations', 'execute', 'org'),
  ('admin', 'automations', 'read', 'org'),
  ('admin', 'automations', 'create', 'org'),
  ('admin', 'automations', 'update', 'org'),
  ('admin', 'agents', 'execute', 'org'),
  ('admin', 'agents', 'read', 'org'),
  ('admin', 'governance', 'read', 'org'),
  ('admin', 'governance', 'update', 'org'),
  ('admin', 'audit_logs', 'read', 'org'),
  ('admin', 'patterns', 'update', 'org'),
  
  -- Organizer (all permissions)
  ('organizer', '*', '*', 'all')
ON CONFLICT (role, resource, action) DO NOTHING;

-- RLS for role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view permissions" ON role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

-- ================================================
-- 2. PROMPT VERSIONING
-- ================================================

-- prompt_versions - Track prompt templates
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  variables TEXT[],                    -- Extracted {{variable}} names
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'draft',         -- 'draft', 'active', 'deprecated', 'archived'
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  -- Performance tracking (aggregated)
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4) DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  avg_tokens INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_prompt_versions_name_version ON prompt_versions(name, version);

-- RLS for prompt_versions
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prompts" ON prompt_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage prompts" ON prompt_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

-- prompt_executions - Log each prompt run
CREATE TABLE IF NOT EXISTS prompt_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_version_id UUID REFERENCES prompt_versions(id),
  model_config_id UUID,                -- Reference to model config if tracked
  
  -- Input
  variables JSONB,
  rendered_prompt TEXT,
  
  -- Output
  response TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  
  -- Evaluation
  success BOOLEAN DEFAULT true,
  quality_score DECIMAL(5,4),
  user_feedback TEXT,                  -- 'positive', 'negative', 'neutral'
  error_type TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_executions_version ON prompt_executions(prompt_version_id, created_at);

-- RLS for prompt_executions
ALTER TABLE prompt_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view executions" ON prompt_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

-- regression_alerts - Model/prompt performance issues
CREATE TABLE IF NOT EXISTS regression_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_version_id UUID REFERENCES prompt_versions(id),
  model_config_id UUID,
  
  alert_type TEXT NOT NULL,            -- 'success_rate_drop', 'latency_increase', 'quality_drop', 'error_spike'
  severity TEXT NOT NULL,              -- 'low', 'medium', 'high', 'critical'
  
  -- Values
  baseline_value DECIMAL(12,4),
  current_value DECIMAL(12,4),
  change_percent DECIMAL(8,4),
  
  -- Window
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  sample_size INTEGER,
  
  -- Status
  status TEXT DEFAULT 'active',        -- 'active', 'acknowledged', 'resolved', 'false_positive'
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regression_alerts_status ON regression_alerts(status, created_at);

-- RLS for regression_alerts
ALTER TABLE regression_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alerts" ON regression_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

-- ================================================
-- 3. ENHANCED APPROVALS
-- ================================================

-- approval_chains - Configurable approval workflows
CREATE TABLE IF NOT EXISTS approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  action_type TEXT NOT NULL,           -- 'budget_increase', 'automation_enable', etc.
  
  -- Thresholds
  risk_threshold INTEGER DEFAULT 50,   -- Actions with risk >= this need approval
  
  -- Workflow
  approver_roles TEXT[] NOT NULL,      -- ['admin', 'organizer']
  required_approvals INTEGER DEFAULT 1,
  escalation_path TEXT[],              -- Roles to escalate to if not approved
  timeout_hours INTEGER DEFAULT 24,
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, action_type)
);

-- RLS for approval_chains
ALTER TABLE approval_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view chains" ON approval_chains
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = approval_chains.org_id
    )
  );

CREATE POLICY "Admins can manage chains" ON approval_chains
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = approval_chains.org_id
      AND user_profiles.role IN ('admin', 'organizer')
    )
  );

-- ================================================
-- 4. UNIFIED TIMELINE
-- ================================================

-- timeline_events - Aggregated view of all AI actions
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Event type
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,              -- 'recommendation', 'automation', 'agent', 'guardrail', etc.
  
  -- Entity context
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  
  -- Actor
  actor_type TEXT NOT NULL,            -- 'ai', 'user', 'system', 'automation'
  actor_id TEXT,
  actor_name TEXT,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  details JSONB,
  
  -- Status
  status TEXT,
  outcome TEXT,
  
  -- UI
  severity TEXT DEFAULT 'info',
  icon TEXT,
  
  -- Relationships
  parent_event_id UUID REFERENCES timeline_events(id),
  
  -- Duration (for events with start/end)
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_events_org ON timeline_events(org_id, created_at DESC);
CREATE INDEX idx_timeline_events_entity ON timeline_events(entity_type, entity_id);
CREATE INDEX idx_timeline_events_category ON timeline_events(category, created_at DESC);

-- RLS for timeline_events
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view timeline" ON timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.organization_id = timeline_events.org_id
    )
  );

CREATE POLICY "System can insert timeline events" ON timeline_events
  FOR INSERT WITH CHECK (true);

-- ================================================
-- 5. BENCHMARK CONTRIBUTIONS (Enhanced)
-- ================================================

-- benchmark_contributions - Anonymized org contributions
CREATE TABLE IF NOT EXISTS benchmark_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  org_hash TEXT NOT NULL,              -- Anonymized org identifier
  
  -- Dimensions
  period TEXT NOT NULL,                -- '2024-Q4', '2024-12', etc.
  industry TEXT,
  region TEXT,
  company_size TEXT,
  campaign_type TEXT,
  
  -- Anonymized metrics
  metrics JSONB NOT NULL,
  
  contributed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_benchmark_contributions_period ON benchmark_contributions(period);
CREATE INDEX idx_benchmark_contributions_industry ON benchmark_contributions(industry);

-- Public insert (anyone can contribute)
ALTER TABLE benchmark_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can contribute" ON benchmark_contributions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  user_id_param UUID,
  resource_param TEXT,
  action_param TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_perm BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role 
  FROM user_profiles 
  WHERE id = user_id_param;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Organizers have all permissions
  IF user_role = 'organizer' THEN
    RETURN TRUE;
  END IF;
  
  -- Check specific permission
  SELECT EXISTS(
    SELECT 1 FROM role_permissions
    WHERE role = user_role
    AND (resource = resource_param OR resource = '*')
    AND (action = action_param OR action = '*')
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log timeline event
CREATE OR REPLACE FUNCTION log_timeline_event(
  org_id_param UUID,
  event_type_param TEXT,
  category_param TEXT,
  title_param TEXT,
  description_param TEXT DEFAULT NULL,
  entity_type_param TEXT DEFAULT NULL,
  entity_id_param TEXT DEFAULT NULL,
  actor_type_param TEXT DEFAULT 'system',
  details_param JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO timeline_events (
    org_id, event_type, category, title, description,
    entity_type, entity_id, actor_type, details
  ) VALUES (
    org_id_param, event_type_param, category_param, title_param, description_param,
    entity_type_param, entity_id_param, actor_type_param, details_param
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get active prompt version
CREATE OR REPLACE FUNCTION get_active_prompt(
  prompt_name TEXT
) RETURNS prompt_versions AS $$
DECLARE
  active_prompt prompt_versions;
BEGIN
  SELECT * INTO active_prompt
  FROM prompt_versions
  WHERE name = prompt_name
  AND status = 'active'
  ORDER BY version DESC
  LIMIT 1;
  
  RETURN active_prompt;
END;
$$ LANGUAGE plpgsql;
