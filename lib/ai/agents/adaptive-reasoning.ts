/**
 * Adaptive Reasoning Depth Module
 * 
 * Determines whether to use shallow heuristics or deep multi-agent reasoning
 * based on query complexity, data quality, risk level, and time constraints.
 */

import { ReasoningDepth, AgentType } from './types';

export interface ReasoningContext {
    // Data quality (from health scores)
    dataQuality: number;           // 0-1

    // Query/task characteristics
    ambiguityLevel: number;        // 0-1 (higher = more ambiguous)
    queryComplexity: number;       // 0-1 (higher = more complex)

    // Risk factors
    riskLevel: number;             // 0-1 (higher = more risk)
    budgetAtRisk?: number;         // Dollar amount potentially affected

    // User context
    userExpertise?: 'novice' | 'intermediate' | 'expert';

    // Time constraints
    timeConstraint: boolean;       // Is user waiting for immediate response?

    // Historical patterns
    similarQueryAccuracy?: number; // How accurate were similar past queries?
}

export interface ReasoningPlan {
    depth: ReasoningDepth;
    agents: AgentType[];
    estimatedDuration: 'fast' | 'medium' | 'slow';
    reasoning: string;
    maxAgentCalls: number;
}

/**
 * Determine the appropriate reasoning depth based on context
 */
export function determineReasoningDepth(ctx: ReasoningContext): ReasoningDepth {
    // Calculate complexity score
    const complexityScore = (
        ctx.ambiguityLevel * 0.3 +
        ctx.queryComplexity * 0.3 +
        ctx.riskLevel * 0.25 +
        (1 - ctx.dataQuality) * 0.15
    );

    // High risk always triggers deep reasoning
    if (ctx.riskLevel > 0.8) return 'deep';

    // Large budget at risk triggers deep reasoning
    if (ctx.budgetAtRisk && ctx.budgetAtRisk > 5000) return 'deep';

    // Time constraint with low complexity = heuristic
    if (ctx.timeConstraint && complexityScore < 0.3) return 'heuristic';

    // High data quality + low complexity = heuristic
    if (ctx.dataQuality > 0.8 && complexityScore < 0.3) return 'heuristic';

    // High complexity or medium risk = deep
    if (complexityScore > 0.7 || ctx.riskLevel > 0.6) return 'deep';

    // Default to standard
    return 'standard';
}

/**
 * Get agents to invoke for each reasoning depth
 */
function getAgentsForDepth(depth: ReasoningDepth): AgentType[] {
    switch (depth) {
        case 'heuristic':
            // Fast path: only data validation and basic analysis
            return ['data_validator', 'performance_analyst'];

        case 'standard':
            // Normal path: add risk check and explanation
            return ['data_validator', 'performance_analyst', 'risk_guard', 'explainer', 'prioritizer'];

        case 'deep':
            // Full path: all agents including causal reasoning
            return ['data_validator', 'performance_analyst', 'causal_reasoner', 'risk_guard', 'explainer', 'prioritizer'];
    }
}

/**
 * Estimate duration based on depth and agents
 */
function estimateDuration(depth: ReasoningDepth): 'fast' | 'medium' | 'slow' {
    switch (depth) {
        case 'heuristic': return 'fast';
        case 'standard': return 'medium';
        case 'deep': return 'slow';
    }
}

/**
 * Create a full reasoning plan based on context
 */
export function createReasoningPlan(ctx: ReasoningContext): ReasoningPlan {
    const depth = determineReasoningDepth(ctx);
    const agents = getAgentsForDepth(depth);
    const estimatedDuration = estimateDuration(depth);

    // Determine max agent calls based on depth
    const maxAgentCalls = depth === 'heuristic' ? 4 : depth === 'standard' ? 10 : 20;

    // Generate reasoning explanation
    let reasoning = '';
    if (depth === 'heuristic') {
        reasoning = 'Using fast heuristic analysis: ';
        if (ctx.timeConstraint) reasoning += 'time-sensitive query, ';
        if (ctx.dataQuality > 0.8) reasoning += 'high data quality, ';
        if (ctx.riskLevel < 0.3) reasoning += 'low risk action.';
    } else if (depth === 'standard') {
        reasoning = 'Using standard multi-agent analysis: balanced complexity and risk.';
    } else {
        reasoning = 'Using deep multi-agent analysis: ';
        if (ctx.riskLevel > 0.6) reasoning += 'elevated risk, ';
        if (ctx.ambiguityLevel > 0.6) reasoning += 'ambiguous query, ';
        if (ctx.budgetAtRisk && ctx.budgetAtRisk > 1000) reasoning += `$${ctx.budgetAtRisk} at risk, `;
        reasoning += 'full causal reasoning engaged.';
    }

    return {
        depth,
        agents,
        estimatedDuration,
        reasoning,
        maxAgentCalls
    };
}

/**
 * Determine if we should escalate reasoning depth mid-execution
 */
export function shouldEscalateDepth(
    currentDepth: ReasoningDepth,
    findings: {
        anomaliesFound?: number;
        dataQualityIssues?: number;
        riskViolations?: number;
        unexpectedResults?: boolean;
    }
): { escalate: boolean; newDepth?: ReasoningDepth; reason?: string } {
    // Already at deepest level
    if (currentDepth === 'deep') {
        return { escalate: false };
    }

    // Escalate if significant anomalies found
    if (findings.anomaliesFound && findings.anomaliesFound >= 3) {
        return {
            escalate: true,
            newDepth: 'deep',
            reason: `${findings.anomaliesFound} anomalies detected, escalating to deep analysis`
        };
    }

    // Escalate if risk violations
    if (findings.riskViolations && findings.riskViolations > 0) {
        return {
            escalate: true,
            newDepth: 'deep',
            reason: 'Risk guardrail triggered, escalating for safety review'
        };
    }

    // Escalate if unexpected results (heuristic → standard)
    if (findings.unexpectedResults && currentDepth === 'heuristic') {
        return {
            escalate: true,
            newDepth: 'standard',
            reason: 'Unexpected results from heuristic, adding more analysis'
        };
    }

    return { escalate: false };
}

/**
 * Calculate ambiguity level from query characteristics
 */
export function calculateAmbiguityLevel(params: {
    hasExplicitMetric: boolean;
    hasExplicitEntity: boolean;
    hasTimeframe: boolean;
    hasThreshold: boolean;
    queryLength: number;
    questionType: 'what' | 'why' | 'how' | 'compare' | 'predict' | 'other';
}): number {
    let ambiguity = 0.5; // Base ambiguity

    // Clear specifications reduce ambiguity
    if (params.hasExplicitMetric) ambiguity -= 0.1;
    if (params.hasExplicitEntity) ambiguity -= 0.15;
    if (params.hasTimeframe) ambiguity -= 0.1;
    if (params.hasThreshold) ambiguity -= 0.05;

    // Question type affects ambiguity
    const typeAmbiguity: Record<string, number> = {
        'what': -0.1,       // Simple lookup
        'compare': 0,       // Medium complexity
        'how': 0.1,         // Needs explanation
        'why': 0.2,         // Needs causal analysis
        'predict': 0.15,    // Uncertainty inherent
        'other': 0.1
    };
    ambiguity += typeAmbiguity[params.questionType] || 0;

    // Very short or very long queries tend to be more ambiguous
    if (params.queryLength < 20) ambiguity += 0.1;
    if (params.queryLength > 200) ambiguity += 0.1;

    return Math.max(0, Math.min(1, ambiguity));
}
