/**
 * Multi-Agent Architecture Types
 * 
 * Type definitions for the multi-agent system including:
 * - Controller Agent (orchestration)
 * - Specialist Agents (data validation, analysis, causal, risk, explanation, priority)
 * - Tool contracts and schemas
 */

// ============================================
// AGENT TYPES
// ============================================

export type AgentType =
    | 'controller'           // Orchestrates other agents
    | 'data_validator'       // Checks data quality
    | 'performance_analyst'  // Trend/anomaly detection
    | 'causal_reasoner'      // Why analysis, counterfactuals
    | 'risk_guard'           // Guardrails and risk assessment
    | 'explainer'            // Generates explanations
    | 'prioritizer';         // Ranks recommendations

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'completed' | 'failed';

export type ReasoningDepth = 'heuristic' | 'standard' | 'deep';

// ============================================
// TOOL CONTRACTS
// ============================================

export interface ToolInput {
    tool_name: string;
    parameters: Record<string, unknown>;
}

export interface ToolOutput {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    confidence?: number;
    evidence?: string[];
    warnings?: string[];
}

// Data Validator Tools
export interface DataValidatorTools {
    check_data_freshness: {
        input: { entity_type: string; entity_id: string };
        output: { fresh: boolean; hours_old: number; threshold: number };
    };
    check_data_completeness: {
        input: { entity_type: string; entity_id: string; required_fields?: string[] };
        output: { complete: boolean; missing_fields: string[]; completeness_pct: number };
    };
    check_sample_size: {
        input: { metric: string; entity_id: string; days: number; min_required?: number };
        output: { adequate: boolean; sample_size: number; min_required: number };
    };
    validate_schema: {
        input: { entity_type: string; data: Record<string, unknown> };
        output: { valid: boolean; errors: string[] };
    };
}

// Performance Analyst Tools
export interface PerformanceAnalystTools {
    detect_trends: {
        input: { entity_id: string; metric: string; days: number };
        output: {
            trend: 'up' | 'down' | 'stable';
            slope: number;
            r_squared: number;
            projected_7d: number;
        };
    };
    find_anomalies: {
        input: { entity_id: string; days: number; sensitivity?: number };
        output: {
            anomalies: Array<{
                date: string;
                metric: string;
                value: number;
                expected: number;
                zscore: number;
                severity: 'low' | 'medium' | 'high';
            }>;
        };
    };
    compare_to_benchmark: {
        input: { entity_id: string; metric: string; benchmark_type?: string };
        output: {
            percentile: number;
            benchmark_value: number;
            delta: number;
            delta_pct: number;
        };
    };
    calculate_performance_score: {
        input: { entity_id: string; metrics?: string[] };
        output: {
            score: number;
            breakdown: Record<string, number>;
            trend: 'improving' | 'stable' | 'declining';
        };
    };
}

// Causal Reasoner Tools
export interface CausalReasonerTools {
    explain_metric_change: {
        input: { entity_id: string; metric: string; period: string };
        output: {
            causes: Array<{
                factor: string;
                contribution: number;
                confidence: number;
                direction: 'positive' | 'negative';
            }>;
            summary: string;
        };
    };
    estimate_counterfactual: {
        input: {
            entity_id: string;
            intervention: string;
            intervention_value: number;
            metric: string;
        };
        output: {
            baseline: number;
            counterfactual: number;
            delta: number;
            confidence_interval: [number, number];
            assumptions: string[];
        };
    };
    trace_dependencies: {
        input: { entity_id: string; target_metric: string };
        output: {
            dependencies: Array<{
                metric: string;
                relationship: 'causes' | 'correlates' | 'confounds';
                strength: number;
            }>;
        };
    };
}

// Risk & Guardrails Tools
export interface RiskGuardTools {
    check_learning_phase: {
        input: { entity_id: string; entity_type?: string };
        output: {
            in_learning: boolean;
            phase_started_at?: string;
            exits_at?: string;
            safe_to_modify: boolean;
            risk_if_modified: string;
        };
    };
    check_stop_loss: {
        input: { entity_id: string; proposed_action: string; proposed_value?: number };
        output: {
            allowed: boolean;
            reason?: string;
            max_allowed?: number;
            risk_level: 'low' | 'medium' | 'high' | 'critical';
        };
    };
    validate_action_safety: {
        input: {
            action_type: string;
            parameters: Record<string, unknown>;
            entity_id: string;
        };
        output: {
            safe: boolean;
            risks: string[];
            mitigations: string[];
            requires_approval: boolean;
        };
    };
    check_guardrails: {
        input: { entity_id: string; action: string };
        output: {
            passed: boolean;
            violations: Array<{
                rule: string;
                severity: 'warning' | 'block';
                message: string;
            }>;
        };
    };
}

// Explainer Tools
export interface ExplainerTools {
    generate_evidence: {
        input: {
            recommendation_type: string;
            entity_id: string;
            context: Record<string, unknown>;
        };
        output: {
            data_points: Array<{ metric: string; value: number; benchmark: number; comparison: string }>;
            patterns: Array<{ description: string; confidence: number }>;
            similar_cases: Array<{ entity_id: string; similarity: number; outcome: string }>;
        };
    };
    generate_assumptions: {
        input: { recommendation_type: string; context: Record<string, unknown> };
        output: { assumptions: string[] };
    };
    generate_invalidation_conditions: {
        input: { recommendation_type: string; expected_impact: number };
        output: { conditions: string[] };
    };
    format_explanation: {
        input: {
            evidence: Record<string, unknown>;
            assumptions: string[];
            confidence: number;
        };
        output: {
            summary: string;
            detailed_reasoning: string;
            key_points: string[];
        };
    };
}

// Prioritizer Tools
export interface PrioritizerTools {
    calculate_impact: {
        input: {
            metric: string;
            current_value: number;
            expected_value: number;
            metric_importance?: number;
        };
        output: { impact_score: number; reasoning: string };
    };
    calculate_urgency: {
        input: {
            entity_id: string;
            context: Record<string, unknown>;
        };
        output: {
            urgency_score: number;
            factors: string[];
            time_sensitive: boolean;
        };
    };
    calculate_risk: {
        input: {
            action_type: string;
            change_magnitude: number;
            entity_context: Record<string, unknown>;
        };
        output: {
            risk_score: number;
            risk_factors: string[];
            mitigations: string[];
        };
    };
    rank_recommendations: {
        input: {
            recommendations: Array<{
                id: string;
                impact: number;
                confidence: number;
                urgency: number;
                risk: number;
            }>;
        };
        output: {
            ranked: Array<{ id: string; priority_score: number; rank: number }>;
        };
    };
}

// ============================================
// AGENT EXECUTION CONTEXT
// ============================================

export interface AgentContext {
    userId?: string;
    orgId?: string;
    sessionId: string;
    requestId: string;
    reasoningDepth: ReasoningDepth;
    maxTokens?: number;
    timeout?: number;
}

export interface AgentExecutionStep {
    id: string;
    agentType: AgentType;
    toolName: string;
    toolInput: Record<string, unknown>;
    toolOutput?: ToolOutput;
    status: AgentStatus;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
    tokensUsed?: number;
    error?: string;
}

export interface AgentRun {
    id: string;
    context: AgentContext;
    trigger: 'user_query' | 'scheduled' | 'event' | 'api';
    triggerData?: Record<string, unknown>;
    steps: AgentExecutionStep[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: Record<string, unknown>;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
    totalTokens: number;
}

// ============================================
// CONTROLLER AGENT TYPES
// ============================================

export interface ControllerDecision {
    nextAgents: AgentType[];
    reasoning: string;
    shouldContinue: boolean;
    depth: ReasoningDepth;
}

export interface ControllerState {
    run: AgentRun;
    currentStep: number;
    gatheredData: Record<string, unknown>;
    decisions: ControllerDecision[];
}

// ============================================
// AGENT CONFIGURATION
// ============================================

export interface AgentConfig {
    type: AgentType;
    name: string;
    description: string;
    tools: string[];
    maxConcurrentCalls: number;
    timeoutMs: number;
    retries: number;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
    controller: {
        type: 'controller',
        name: 'Controller Agent',
        description: 'Orchestrates multi-agent reasoning and synthesizes results',
        tools: ['route_to_agent', 'synthesize_results', 'determine_depth'],
        maxConcurrentCalls: 1,
        timeoutMs: 30000,
        retries: 2
    },
    data_validator: {
        type: 'data_validator',
        name: 'Data Validator',
        description: 'Validates data quality, completeness, and freshness',
        tools: ['check_data_freshness', 'check_data_completeness', 'check_sample_size', 'validate_schema'],
        maxConcurrentCalls: 5,
        timeoutMs: 10000,
        retries: 3
    },
    performance_analyst: {
        type: 'performance_analyst',
        name: 'Performance Analyst',
        description: 'Analyzes trends, detects anomalies, and benchmarks performance',
        tools: ['detect_trends', 'find_anomalies', 'compare_to_benchmark', 'calculate_performance_score'],
        maxConcurrentCalls: 3,
        timeoutMs: 15000,
        retries: 2
    },
    causal_reasoner: {
        type: 'causal_reasoner',
        name: 'Causal Reasoner',
        description: 'Explains metric changes and estimates counterfactuals',
        tools: ['explain_metric_change', 'estimate_counterfactual', 'trace_dependencies'],
        maxConcurrentCalls: 2,
        timeoutMs: 20000,
        retries: 2
    },
    risk_guard: {
        type: 'risk_guard',
        name: 'Risk & Guardrails',
        description: 'Validates action safety and enforces guardrails',
        tools: ['check_learning_phase', 'check_stop_loss', 'validate_action_safety', 'check_guardrails'],
        maxConcurrentCalls: 3,
        timeoutMs: 10000,
        retries: 3
    },
    explainer: {
        type: 'explainer',
        name: 'Explainer',
        description: 'Generates evidence, assumptions, and explanations',
        tools: ['generate_evidence', 'generate_assumptions', 'generate_invalidation_conditions', 'format_explanation'],
        maxConcurrentCalls: 2,
        timeoutMs: 15000,
        retries: 2
    },
    prioritizer: {
        type: 'prioritizer',
        name: 'Prioritizer',
        description: 'Calculates priority scores and ranks recommendations',
        tools: ['calculate_impact', 'calculate_urgency', 'calculate_risk', 'rank_recommendations'],
        maxConcurrentCalls: 3,
        timeoutMs: 10000,
        retries: 2
    }
};
