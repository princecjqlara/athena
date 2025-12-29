-- =====================================================
-- CHECK MISSING TABLES MIGRATION SCRIPT
-- Run this in Supabase SQL Editor to identify missing tables
-- Generated: 2025-12-29
-- =====================================================

-- This script checks which tables from your schema files exist in the database
-- and reports missing tables along with their schema file source

DO $$
DECLARE
    missing_tables TEXT := '';
    existing_tables TEXT := '';
    total_expected INTEGER := 53;
    total_existing INTEGER := 0;
    total_missing INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'DATABASE TABLE MIGRATION CHECK';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
    
    -- ==========================================
    -- FROM schema.sql (Core Tables)
    -- ==========================================
    RAISE NOTICE '📁 Checking schema.sql tables...';
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ads') THEN
        missing_tables := missing_tables || '❌ ads (schema.sql - Core ad storage)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ ads' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ad_insights') THEN
        missing_tables := missing_tables || '❌ ad_insights (schema.sql - Facebook metrics)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ ad_insights' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ad_breakdowns') THEN
        missing_tables := missing_tables || '❌ ad_breakdowns (schema.sql - Demographics/Device data)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ ad_breakdowns' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
        missing_tables := missing_tables || '❌ contacts (schema.sql - Leads from ads)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ contacts' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
        missing_tables := missing_tables || '❌ messages (schema.sql - Conversation history)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ messages' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ad_pipeline_links') THEN
        missing_tables := missing_tables || '❌ ad_pipeline_links (schema.sql - Ad to pipeline connections)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ ad_pipeline_links' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'collective_priors') THEN
        missing_tables := missing_tables || '❌ collective_priors (schema.sql - Aggregated feature weights)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ collective_priors' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_contributions') THEN
        missing_tables := missing_tables || '❌ user_contributions (schema.sql - Anonymized contributions)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_contributions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ci_settings') THEN
        missing_tables := missing_tables || '❌ user_ci_settings (schema.sql - CI opt-in settings)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_ci_settings' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
        missing_tables := missing_tables || '❌ organizations (schema.sql - RBAC organizations)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ organizations' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        missing_tables := missing_tables || '❌ user_profiles (schema.sql - User profiles with roles)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_profiles' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_requests') THEN
        missing_tables := missing_tables || '❌ access_requests (schema.sql - Org access requests)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ access_requests' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        missing_tables := missing_tables || '❌ audit_logs (schema.sql - Sensitive action tracking)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ audit_logs' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_assignments') THEN
        missing_tables := missing_tables || '❌ pipeline_assignments (schema.sql - Pipeline to client assignments)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ pipeline_assignments' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invite_codes') THEN
        missing_tables := missing_tables || '❌ invite_codes (schema.sql - Invite code system)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ invite_codes' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- ==========================================
    -- FROM user_data_schema.sql
    -- ==========================================
    RAISE NOTICE '📁 Checking user_data_schema.sql tables...';

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ads') THEN
        missing_tables := missing_tables || '❌ user_ads (user_data_schema.sql - User imported ads)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_ads' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_pipelines') THEN
        missing_tables := missing_tables || '❌ user_pipelines (user_data_schema.sql - Pipeline configs)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_pipelines' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_leads') THEN
        missing_tables := missing_tables || '❌ user_leads (user_data_schema.sql - Leads in pipelines)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_leads' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_contacts') THEN
        missing_tables := missing_tables || '❌ user_contacts (user_data_schema.sql - User contacts)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_contacts' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings') THEN
        missing_tables := missing_tables || '❌ user_settings (user_data_schema.sql - User preferences/tokens)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_settings' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- ==========================================
    -- FROM data_pools_schema.sql
    -- ==========================================
    RAISE NOTICE '📁 Checking data_pools_schema.sql tables...';

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_pools') THEN
        missing_tables := missing_tables || '❌ data_pools (data_pools_schema.sql - Data marketplace)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ data_pools' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_access_requests') THEN
        missing_tables := missing_tables || '❌ data_access_requests (data_pools_schema.sql - Pool access requests)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ data_access_requests' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pool_contributions') THEN
        missing_tables := missing_tables || '❌ pool_contributions (data_pools_schema.sql - User pool shares)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ pool_contributions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- ==========================================
    -- FROM public_traits_schema.sql
    -- ==========================================
    RAISE NOTICE '📁 Checking public_traits_schema.sql tables...';

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_traits') THEN
        missing_tables := missing_tables || '❌ public_traits (public_traits_schema.sql - AI/user traits)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ public_traits' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- ==========================================
    -- FROM learned_traits_schema.sql
    -- ==========================================
    RAISE NOTICE '📁 Checking learned_traits_schema.sql tables...';

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learned_traits') THEN
        missing_tables := missing_tables || '❌ learned_traits (learned_traits_schema.sql - Custom traits)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ learned_traits' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- ==========================================
    -- FROM athena_upgrade_schema.sql
    -- ==========================================
    RAISE NOTICE '📁 Checking athena_upgrade_schema.sql tables...';

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'athena_recommendations') THEN
        missing_tables := missing_tables || '❌ athena_recommendations (athena_upgrade_schema.sql - AI recommendations)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ athena_recommendations' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recommendation_events') THEN
        missing_tables := missing_tables || '❌ recommendation_events (athena_upgrade_schema.sql - Audit trail)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ recommendation_events' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_runs') THEN
        missing_tables := missing_tables || '❌ evaluation_runs (athena_upgrade_schema.sql - Before/after impact)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ evaluation_runs' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'anomalies') THEN
        missing_tables := missing_tables || '❌ anomalies (athena_upgrade_schema.sql - Anomaly alerts)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ anomalies' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_runs') THEN
        missing_tables := missing_tables || '❌ agent_runs (athena_upgrade_schema.sql - Multi-step reasoning)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ agent_runs' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ai_preferences') THEN
        missing_tables := missing_tables || '❌ user_ai_preferences (athena_upgrade_schema.sql - KPI settings)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ user_ai_preferences' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- ==========================================
    -- FROM combined_intelligence_schema.sql (Phase 1-4)
    -- ==========================================
    RAISE NOTICE '📁 Checking combined_intelligence_schema.sql tables...';

    -- Phase 1: Foundation
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_recommendations') THEN
        missing_tables := missing_tables || '❌ ai_recommendations (Phase 1 - AI recommendations v2)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ ai_recommendations' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recommendation_evaluations') THEN
        missing_tables := missing_tables || '❌ recommendation_evaluations (Phase 1 - Evaluation results)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ recommendation_evaluations' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'metric_snapshots') THEN
        missing_tables := missing_tables || '❌ metric_snapshots (Phase 1 - Historical metrics)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ metric_snapshots' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recommendation_accuracy_log') THEN
        missing_tables := missing_tables || '❌ recommendation_accuracy_log (Phase 1 - Accuracy tracking)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ recommendation_accuracy_log' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_stability_log') THEN
        missing_tables := missing_tables || '❌ api_stability_log (Phase 1 - API health)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ api_stability_log' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_audit_logs') THEN
        missing_tables := missing_tables || '❌ ai_audit_logs (Phase 1 - AI action audit)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ ai_audit_logs' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- Phase 2: Intelligence
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_executions') THEN
        missing_tables := missing_tables || '❌ agent_executions (Phase 2 - Agent tool executions)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ agent_executions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_memory') THEN
        missing_tables := missing_tables || '❌ session_memory (Phase 2 - Chat session context)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ session_memory' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_memory') THEN
        missing_tables := missing_tables || '❌ organization_memory (Phase 2 - Org-level memory)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ organization_memory' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'strategic_memory') THEN
        missing_tables := missing_tables || '❌ strategic_memory (Phase 2 - Pattern learning)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ strategic_memory' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kg_entities') THEN
        missing_tables := missing_tables || '❌ kg_entities (Phase 2 - Knowledge graph entities)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ kg_entities' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kg_edges') THEN
        missing_tables := missing_tables || '❌ kg_edges (Phase 2 - Knowledge graph relationships)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ kg_edges' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'causal_graph_nodes') THEN
        missing_tables := missing_tables || '❌ causal_graph_nodes (Phase 2 - Causal model nodes)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ causal_graph_nodes' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'causal_graph_edges') THEN
        missing_tables := missing_tables || '❌ causal_graph_edges (Phase 2 - Causal relationships)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ causal_graph_edges' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- Phase 3: Advanced
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'creative_performance_curves') THEN
        missing_tables := missing_tables || '❌ creative_performance_curves (Phase 3 - Creative fatigue tracking)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ creative_performance_curves' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'creative_fatigue_alerts') THEN
        missing_tables := missing_tables || '❌ creative_fatigue_alerts (Phase 3 - Fatigue notifications)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ creative_fatigue_alerts' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forecasts') THEN
        missing_tables := missing_tables || '❌ forecasts (Phase 3 - Metric predictions)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ forecasts' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'what_if_simulations') THEN
        missing_tables := missing_tables || '❌ what_if_simulations (Phase 3 - Scenario planning)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ what_if_simulations' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mined_patterns') THEN
        missing_tables := missing_tables || '❌ mined_patterns (Phase 3 - Discovered patterns)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ mined_patterns' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seasonal_patterns') THEN
        missing_tables := missing_tables || '❌ seasonal_patterns (Phase 3 - Seasonality data)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ seasonal_patterns' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'governance_config') THEN
        missing_tables := missing_tables || '❌ governance_config (Phase 3 - Change guardrails)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ governance_config' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_requests') THEN
        missing_tables := missing_tables || '❌ change_requests (Phase 3 - Approval workflow)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ change_requests' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nl_query_logs') THEN
        missing_tables := missing_tables || '❌ nl_query_logs (Phase 3 - Natural language queries)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ nl_query_logs' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'benchmark_data') THEN
        missing_tables := missing_tables || '❌ benchmark_data (Phase 3 - Industry benchmarks)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ benchmark_data' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- Phase 4: Enterprise
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
        missing_tables := missing_tables || '❌ role_permissions (Phase 4 - RBAC permissions)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ role_permissions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_versions') THEN
        missing_tables := missing_tables || '❌ prompt_versions (Phase 4 - Prompt A/B testing)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ prompt_versions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prompt_executions') THEN
        missing_tables := missing_tables || '❌ prompt_executions (Phase 4 - Prompt run logs)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ prompt_executions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regression_alerts') THEN
        missing_tables := missing_tables || '❌ regression_alerts (Phase 4 - Performance regression)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ regression_alerts' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_chains') THEN
        missing_tables := missing_tables || '❌ approval_chains (Phase 4 - Approval workflows)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ approval_chains' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timeline_events') THEN
        missing_tables := missing_tables || '❌ timeline_events (Phase 4 - Unified activity feed)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ timeline_events' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'benchmark_contributions') THEN
        missing_tables := missing_tables || '❌ benchmark_contributions (Phase 4 - User benchmark data)' || E'\n';
        total_missing := total_missing + 1;
    ELSE
        existing_tables := existing_tables || '✅ benchmark_contributions' || E'\n';
        total_existing := total_existing + 1;
    END IF;

    -- NOTE: data_health_scores exists in both athena_upgrade_schema.sql and combined_intelligence_schema.sql
    -- Already checked above

    -- ==========================================
    -- RESULTS
    -- ==========================================
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'RESULTS SUMMARY';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Total expected tables: %', total_expected;
    RAISE NOTICE 'Tables found: %', total_existing;
    RAISE NOTICE 'Tables missing: %', total_missing;
    RAISE NOTICE '==========================================';
    
    IF total_missing > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🔴 MISSING TABLES:';
        RAISE NOTICE '==========================================';
        RAISE NOTICE '%', missing_tables;
        RAISE NOTICE '';
        RAISE NOTICE '💡 To fix: Run the corresponding schema file in Supabase SQL Editor';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✅ All tables exist! Database is fully migrated.';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'EXISTING TABLES:';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '%', existing_tables;
    
END $$;

-- =====================================================
-- ALTERNATIVE: Simple Query to List All Missing Tables
-- =====================================================

-- You can also run this simpler query to see all expected tables and their status:

SELECT 
    table_name,
    schema_source,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = expected_tables.table_name
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END AS status
FROM (
    VALUES 
        -- schema.sql
        ('ads', 'schema.sql'),
        ('ad_insights', 'schema.sql'),
        ('ad_breakdowns', 'schema.sql'),
        ('contacts', 'schema.sql'),
        ('messages', 'schema.sql'),
        ('ad_pipeline_links', 'schema.sql'),
        ('collective_priors', 'schema.sql'),
        ('user_contributions', 'schema.sql'),
        ('user_ci_settings', 'schema.sql'),
        ('organizations', 'schema.sql'),
        ('user_profiles', 'schema.sql'),
        ('access_requests', 'schema.sql'),
        ('audit_logs', 'schema.sql'),
        ('pipeline_assignments', 'schema.sql'),
        ('invite_codes', 'schema.sql'),
        -- user_data_schema.sql
        ('user_ads', 'user_data_schema.sql'),
        ('user_pipelines', 'user_data_schema.sql'),
        ('user_leads', 'user_data_schema.sql'),
        ('user_contacts', 'user_data_schema.sql'),
        ('user_settings', 'user_data_schema.sql'),
        -- data_pools_schema.sql
        ('data_pools', 'data_pools_schema.sql'),
        ('data_access_requests', 'data_pools_schema.sql'),
        ('pool_contributions', 'data_pools_schema.sql'),
        -- public_traits_schema.sql
        ('public_traits', 'public_traits_schema.sql'),
        -- learned_traits_schema.sql
        ('learned_traits', 'learned_traits_schema.sql'),
        -- athena_upgrade_schema.sql
        ('athena_recommendations', 'athena_upgrade_schema.sql'),
        ('recommendation_events', 'athena_upgrade_schema.sql'),
        ('evaluation_runs', 'athena_upgrade_schema.sql'),
        ('data_health_scores', 'athena_upgrade_schema.sql'),
        ('anomalies', 'athena_upgrade_schema.sql'),
        ('agent_runs', 'athena_upgrade_schema.sql'),
        ('user_ai_preferences', 'athena_upgrade_schema.sql'),
        -- combined_intelligence_schema.sql - Phase 1
        ('ai_recommendations', 'combined_intelligence_schema.sql (Phase 1)'),
        ('recommendation_evaluations', 'combined_intelligence_schema.sql (Phase 1)'),
        ('metric_snapshots', 'combined_intelligence_schema.sql (Phase 1)'),
        ('recommendation_accuracy_log', 'combined_intelligence_schema.sql (Phase 1)'),
        ('api_stability_log', 'combined_intelligence_schema.sql (Phase 1)'),
        ('ai_audit_logs', 'combined_intelligence_schema.sql (Phase 1)'),
        -- combined_intelligence_schema.sql - Phase 2
        ('agent_executions', 'combined_intelligence_schema.sql (Phase 2)'),
        ('session_memory', 'combined_intelligence_schema.sql (Phase 2)'),
        ('organization_memory', 'combined_intelligence_schema.sql (Phase 2)'),
        ('strategic_memory', 'combined_intelligence_schema.sql (Phase 2)'),
        ('kg_entities', 'combined_intelligence_schema.sql (Phase 2)'),
        ('kg_edges', 'combined_intelligence_schema.sql (Phase 2)'),
        ('causal_graph_nodes', 'combined_intelligence_schema.sql (Phase 2)'),
        ('causal_graph_edges', 'combined_intelligence_schema.sql (Phase 2)'),
        -- combined_intelligence_schema.sql - Phase 3
        ('creative_performance_curves', 'combined_intelligence_schema.sql (Phase 3)'),
        ('creative_fatigue_alerts', 'combined_intelligence_schema.sql (Phase 3)'),
        ('forecasts', 'combined_intelligence_schema.sql (Phase 3)'),
        ('what_if_simulations', 'combined_intelligence_schema.sql (Phase 3)'),
        ('mined_patterns', 'combined_intelligence_schema.sql (Phase 3)'),
        ('seasonal_patterns', 'combined_intelligence_schema.sql (Phase 3)'),
        ('governance_config', 'combined_intelligence_schema.sql (Phase 3)'),
        ('change_requests', 'combined_intelligence_schema.sql (Phase 3)'),
        ('nl_query_logs', 'combined_intelligence_schema.sql (Phase 3)'),
        ('benchmark_data', 'combined_intelligence_schema.sql (Phase 3)'),
        -- combined_intelligence_schema.sql - Phase 4
        ('role_permissions', 'combined_intelligence_schema.sql (Phase 4)'),
        ('prompt_versions', 'combined_intelligence_schema.sql (Phase 4)'),
        ('prompt_executions', 'combined_intelligence_schema.sql (Phase 4)'),
        ('regression_alerts', 'combined_intelligence_schema.sql (Phase 4)'),
        ('approval_chains', 'combined_intelligence_schema.sql (Phase 4)'),
        ('timeline_events', 'combined_intelligence_schema.sql (Phase 4)'),
        ('benchmark_contributions', 'combined_intelligence_schema.sql (Phase 4)')
) AS expected_tables(table_name, schema_source)
ORDER BY 
    CASE status WHEN '❌ MISSING' THEN 0 ELSE 1 END,
    schema_source,
    table_name;
