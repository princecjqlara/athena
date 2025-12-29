-- ============================================
-- ATHENA INTELLIGENCE PLATFORM - PHASE 2 SCHEMA
-- Multi-Agent Architecture, Memory Layers, Knowledge Graph
-- ============================================

-- ============================================
-- 1. AGENT EXECUTIONS
-- Track each agent invocation for observability
-- ============================================

CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to parent agent run
  agent_run_id UUID,           -- References agent_runs if exists
  
  -- Agent identification
  agent_type TEXT NOT NULL,    -- 'controller', 'data_validator', 'performance_analyst', etc.
  
  -- Input/Output
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,
  
  -- Performance metrics
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_run ON agent_executions(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_type ON agent_executions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);


-- ============================================
-- 2. SESSION MEMORY (Short-term)
-- Current session context and working memory
-- ============================================

CREATE TABLE IF NOT EXISTS session_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  session_id TEXT NOT NULL,
  user_id UUID,
  
  -- Memory type
  memory_type TEXT NOT NULL,   -- 'context', 'working', 'scratch', 'conversation'
  
  -- Content
  key TEXT,                    -- Optional key for structured access
  content JSONB NOT NULL,
  
  -- Lifecycle
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_memory_session ON session_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_session_memory_type ON session_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_session_memory_expires ON session_memory(expires_at);


-- ============================================
-- 3. ORGANIZATION MEMORY (Long-term)
-- Persistent org preferences, constraints, and KPIs
-- ============================================

CREATE TABLE IF NOT EXISTS organization_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,                 -- References organizations(id) if exists
  user_id UUID,                -- Fallback to user if no org
  
  -- Category
  memory_category TEXT NOT NULL,  -- 'preferences', 'constraints', 'kpis', 'brand', 'targets'
  
  -- Content
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  
  -- Source and confidence
  source TEXT DEFAULT 'user_defined',  -- 'user_defined', 'ai_learned', 'imported', 'inferred'
  confidence DECIMAL(5,4) DEFAULT 1.0,
  
  -- Version control for learned memories
  version INTEGER DEFAULT 1,
  previous_value JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(COALESCE(org_id, user_id), memory_category, key)
);

CREATE INDEX IF NOT EXISTS idx_org_memory_org ON organization_memory(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memory_user ON organization_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memory_category ON organization_memory(memory_category);


-- ============================================
-- 4. STRATEGIC MEMORY
-- What historically worked or failed
-- ============================================

CREATE TABLE IF NOT EXISTS strategic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  user_id UUID,
  
  -- Pattern identification
  pattern_type TEXT NOT NULL,     -- 'success_pattern', 'failure_pattern', 'insight', 'lesson'
  pattern_hash TEXT NOT NULL,     -- Unique identifier for deduplication
  
  -- Pattern details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  context JSONB NOT NULL,         -- Conditions when pattern applies
  outcome TEXT NOT NULL,          -- 'positive', 'negative', 'mixed'
  
  -- Evidence
  supporting_examples INTEGER DEFAULT 1,
  contradicting_examples INTEGER DEFAULT 0,
  confidence DECIMAL(5,4),
  
  -- Related entities
  related_campaigns TEXT[],
  related_creatives TEXT[],
  related_audiences TEXT[],
  
  -- Tags for retrieval
  tags TEXT[],
  
  -- Learning timestamps
  first_observed_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
  times_applied INTEGER DEFAULT 0,
  
  UNIQUE(COALESCE(org_id, user_id), pattern_hash)
);

CREATE INDEX IF NOT EXISTS idx_strategic_memory_org ON strategic_memory(org_id);
CREATE INDEX IF NOT EXISTS idx_strategic_memory_type ON strategic_memory(pattern_type);
CREATE INDEX IF NOT EXISTS idx_strategic_memory_outcome ON strategic_memory(outcome);
CREATE INDEX IF NOT EXISTS idx_strategic_memory_tags ON strategic_memory USING GIN(tags);


-- ============================================
-- 5. KNOWLEDGE GRAPH - ENTITIES
-- All entities in the knowledge graph
-- ============================================

CREATE TABLE IF NOT EXISTS kg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  
  -- Entity identification
  entity_type TEXT NOT NULL,      -- 'account', 'campaign', 'adset', 'ad', 'creative',
                                  -- 'metric', 'anomaly', 'recommendation', 'edit', 'event'
  entity_id TEXT NOT NULL,        -- External or internal ID
  entity_name TEXT,
  
  -- Properties (flexible JSONB)
  properties JSONB DEFAULT '{}',
  
  -- External references
  facebook_id TEXT,
  internal_ref UUID,              -- Reference to other internal tables
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_user ON kg_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_facebook ON kg_entities(facebook_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_props ON kg_entities USING GIN(properties);


-- ============================================
-- 6. KNOWLEDGE GRAPH - EDGES
-- Relationships between entities
-- ============================================

CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Nodes
  from_entity_id UUID REFERENCES kg_entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES kg_entities(id) ON DELETE CASCADE,
  
  -- Relationship
  relationship_type TEXT NOT NULL,  -- 'contains', 'uses', 'triggered', 'caused',
                                    -- 'improved', 'degraded', 'correlates_with', 'depends_on'
  
  -- Weight and confidence
  weight DECIMAL(5,4) DEFAULT 1.0,
  confidence DECIMAL(5,4),
  
  -- Properties
  properties JSONB DEFAULT '{}',
  
  -- Temporal validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,           -- NULL = still valid
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(from_entity_id, to_entity_id, relationship_type, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_to ON kg_edges(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON kg_edges(relationship_type);
CREATE INDEX IF NOT EXISTS idx_kg_edges_valid ON kg_edges(valid_from, valid_to);


-- ============================================
-- 7. CAUSAL GRAPH - NODES
-- Variables in the causal model
-- ============================================

CREATE TABLE IF NOT EXISTS causal_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  node_name TEXT NOT NULL UNIQUE,
  node_type TEXT NOT NULL,        -- 'intervention', 'mediator', 'outcome', 'confounder'
  
  description TEXT,
  unit TEXT,                      -- 'dollars', 'percentage', 'count', 'ratio'
  
  -- Typical ranges
  typical_min DECIMAL(12,4),
  typical_max DECIMAL(12,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 8. CAUSAL GRAPH - EDGES
-- Causal relationships between nodes
-- ============================================

CREATE TABLE IF NOT EXISTS causal_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  from_node TEXT REFERENCES causal_graph_nodes(node_name) ON DELETE CASCADE,
  to_node TEXT REFERENCES causal_graph_nodes(node_name) ON DELETE CASCADE,
  
  -- Relationship type
  relationship TEXT NOT NULL,     -- 'causes', 'correlates', 'confounds'
  direction TEXT,                 -- 'positive', 'negative', 'nonlinear'
  
  -- Effect size (learned from data)
  avg_effect_size DECIMAL(10,4),
  effect_variance DECIMAL(10,4),
  sample_size INTEGER,
  
  -- Confidence
  confidence DECIMAL(5,4),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(from_node, to_node)
);


-- ============================================
-- PRE-POPULATE CAUSAL GRAPH
-- ============================================

INSERT INTO causal_graph_nodes (node_name, node_type, unit) VALUES
  ('budget', 'intervention', 'dollars'),
  ('bid', 'intervention', 'dollars'),
  ('audience_size', 'intervention', 'count'),
  ('creative_quality_score', 'intervention', 'score'),
  ('impressions', 'mediator', 'count'),
  ('reach', 'mediator', 'count'),
  ('frequency', 'mediator', 'ratio'),
  ('cpm', 'mediator', 'dollars'),
  ('ctr', 'mediator', 'percentage'),
  ('cvr', 'mediator', 'percentage'),
  ('learning_phase', 'confounder', 'boolean'),
  ('seasonality', 'confounder', 'index'),
  ('competition_index', 'confounder', 'index'),
  ('conversions', 'outcome', 'count'),
  ('revenue', 'outcome', 'dollars'),
  ('roas', 'outcome', 'ratio'),
  ('cpa', 'outcome', 'dollars')
ON CONFLICT (node_name) DO NOTHING;

INSERT INTO causal_graph_edges (from_node, to_node, relationship, direction) VALUES
  ('budget', 'impressions', 'causes', 'positive'),
  ('budget', 'reach', 'causes', 'positive'),
  ('bid', 'cpm', 'causes', 'positive'),
  ('bid', 'impressions', 'causes', 'positive'),
  ('audience_size', 'reach', 'causes', 'positive'),
  ('audience_size', 'cpm', 'causes', 'negative'),
  ('creative_quality_score', 'ctr', 'causes', 'positive'),
  ('creative_quality_score', 'cvr', 'causes', 'positive'),
  ('impressions', 'reach', 'causes', 'positive'),
  ('impressions', 'frequency', 'causes', 'positive'),
  ('reach', 'conversions', 'causes', 'positive'),
  ('ctr', 'conversions', 'causes', 'positive'),
  ('cvr', 'conversions', 'causes', 'positive'),
  ('conversions', 'revenue', 'causes', 'positive'),
  ('revenue', 'roas', 'causes', 'positive'),
  ('budget', 'roas', 'causes', 'negative'),
  ('conversions', 'cpa', 'causes', 'negative'),
  ('learning_phase', 'cpm', 'confounds', 'positive'),
  ('learning_phase', 'cvr', 'confounds', 'negative'),
  ('seasonality', 'conversions', 'confounds', 'positive'),
  ('competition_index', 'cpm', 'confounds', 'positive')
ON CONFLICT (from_node, to_node) DO NOTHING;


-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_graph_edges ENABLE ROW LEVEL SECURITY;


-- ============================================
-- RLS POLICIES
-- ============================================

-- Agent executions: system access
CREATE POLICY "System access agent executions" ON agent_executions FOR ALL USING (true);

-- Session memory: session owner only
CREATE POLICY "Users access own session memory" ON session_memory 
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Organization memory: org members
CREATE POLICY "Users access org memory" ON organization_memory 
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Strategic memory: org members read, AI write
CREATE POLICY "Users read strategic memory" ON strategic_memory 
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "System write strategic memory" ON strategic_memory 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System update strategic memory" ON strategic_memory 
  FOR UPDATE USING (true);

-- Knowledge graph: user-scoped
CREATE POLICY "Users access own kg entities" ON kg_entities 
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users access own kg edges" ON kg_edges 
  FOR ALL USING (
    from_entity_id IN (SELECT id FROM kg_entities WHERE user_id = auth.uid() OR user_id IS NULL)
  );

-- Causal graph: read-only for all, admin write
CREATE POLICY "Public read causal nodes" ON causal_graph_nodes FOR SELECT USING (true);
CREATE POLICY "Public read causal edges" ON causal_graph_edges FOR SELECT USING (true);


-- ============================================
-- CLEANUP FUNCTION
-- Remove expired session memory
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_session_memory()
RETURNS void AS $$
BEGIN
  DELETE FROM session_memory WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SUMMARY
-- ============================================
-- Tables created:
-- 1. agent_executions - Track each agent invocation
-- 2. session_memory - Short-term session context
-- 3. organization_memory - Long-term org preferences
-- 4. strategic_memory - Historical success/failure patterns
-- 5. kg_entities - Knowledge graph entities
-- 6. kg_edges - Knowledge graph relationships
-- 7. causal_graph_nodes - Causal model variables
-- 8. causal_graph_edges - Causal relationships (pre-populated)
