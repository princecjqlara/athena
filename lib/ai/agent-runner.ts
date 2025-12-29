/**
 * Athena Multi-Step Agent Runner
 * Executes agent workflows with structured reasoning
 */

import { executeTool, getToolDefinitions } from './agent-tools';

export interface AgentStep {
    step: number;
    tool: string;
    input: Record<string, unknown>;
    output: unknown;
    duration_ms: number;
    status: 'success' | 'error';
}

export interface AgentRunResult {
    id: string;
    status: 'completed' | 'failed' | 'blocked';
    steps: AgentStep[];
    recommendations: unknown[];
    total_duration_ms: number;
    error_message?: string;
    blocked_reason?: string;
}

export interface AgentInput {
    query: string;
    orgId: string;
    userId: string;
    entityIds?: string[];
    context?: Record<string, unknown>;
}

/**
 * Confidence calculation based on evidence
 */
function calculateConfidence(evidence: {
    dataPoints: number;
    variance: 'low' | 'medium' | 'high';
    completeness: number;
    healthScore: number;
    historicalSuccessRate?: number;
}): number {
    const varianceScore = evidence.variance === 'low' ? 1.0 :
        evidence.variance === 'medium' ? 0.7 : 0.4;

    const conf = (
        0.3 * Math.min(evidence.dataPoints / 100, 1.0) +
        0.2 * varianceScore +
        0.2 * evidence.completeness +
        0.2 * (evidence.healthScore / 100) +
        0.1 * (evidence.historicalSuccessRate || 0.5)
    );

    return Math.round(conf * 100) / 100;
}

/**
 * Run the multi-step agent workflow
 */
export async function runAgent(input: AgentInput): Promise<AgentRunResult> {
    const startTime = Date.now();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const steps: AgentStep[] = [];
    const recommendations: unknown[] = [];

    try {
        // STEP 1: Fetch Metrics
        const metricsResult = await executeTool('fetch_metrics', {
            entity_type: 'ad',
            entity_ids: input.entityIds || [],
            date_range: 'last_7d',
            metrics: ['spend', 'impressions', 'clicks', 'conversions', 'cpa', 'roas']
        });

        steps.push({
            step: 1,
            tool: 'fetch_metrics',
            input: { entity_ids: input.entityIds },
            output: metricsResult.data,
            duration_ms: metricsResult.duration_ms,
            status: metricsResult.success ? 'success' : 'error'
        });

        if (!metricsResult.success) {
            return {
                id: runId,
                status: 'failed',
                steps,
                recommendations: [],
                total_duration_ms: Date.now() - startTime,
                error_message: metricsResult.error
            };
        }

        // STEP 2: Validate Data Health
        const healthResult = await executeTool('validate_data_health', {
            entity_ids: input.entityIds || [],
            org_id: input.orgId
        });

        steps.push({
            step: 2,
            tool: 'validate_data_health',
            input: { entity_ids: input.entityIds },
            output: healthResult.data,
            duration_ms: healthResult.duration_ms,
            status: healthResult.success ? 'success' : 'error'
        });

        const healthData = healthResult.data as { health_score: number; can_recommend: boolean } | undefined;

        if (healthData && !healthData.can_recommend) {
            return {
                id: runId,
                status: 'blocked',
                steps,
                recommendations: [],
                total_duration_ms: Date.now() - startTime,
                blocked_reason: `Data health too low (${healthData.health_score}/100). Fix data issues before recommendations.`
            };
        }

        // STEP 3: Get Historical Benchmarks
        const benchmarkResult = await executeTool('get_historical_benchmarks', {
            metric: 'cpa',
            entity_type: 'ad',
            lookback_days: 30
        });

        steps.push({
            step: 3,
            tool: 'get_historical_benchmarks',
            input: { metric: 'cpa' },
            output: benchmarkResult.data,
            duration_ms: benchmarkResult.duration_ms,
            status: benchmarkResult.success ? 'success' : 'error'
        });

        // STEP 4: Analyze and generate hypotheses
        const metricsData = metricsResult.data as Array<{
            id: string;
            found: boolean;
            spend?: number;
            conversions?: number;
            cpa?: number;
            roas?: number;
            impressions?: number;
        }>;
        const benchmarkData = benchmarkResult.data as { benchmark: number; sample_size: number } | undefined;

        for (const entity of metricsData || []) {
            if (!entity.found) continue;

            // Determine recommendation type based on metrics
            let recType: string | null = null;
            let title = '';
            let action: Record<string, unknown> = {};

            const entityMetrics = {
                conversions: entity.conversions || 0,
                impressions: entity.impressions || 0,
                spend: entity.spend || 0,
                cpa: entity.cpa || 0,
                roas: entity.roas || 0
            };

            // High ROAS → Scale
            if ((entity.roas || 0) > 2 && (entity.spend || 0) > 10) {
                recType = 'scale';
                title = 'Scale high-performing ad';
                action = {
                    type: 'budget_increase',
                    current_value: entity.spend,
                    proposed_value: (entity.spend || 0) * 1.2,
                    change_pct: 20,
                    expected_impact: {
                        metric: 'conversions',
                        direction: 'increase',
                        magnitude: '+15-25%'
                    }
                };
            }
            // High CPA → Pause or Optimize
            else if ((entity.cpa || Infinity) > (benchmarkData?.benchmark || 50) * 1.5) {
                recType = 'pause';
                title = 'Pause underperforming ad';
                action = {
                    type: 'pause',
                    reason: 'CPA 50%+ above benchmark',
                    expected_impact: {
                        metric: 'overall_cpa',
                        direction: 'decrease',
                        magnitude: '-10-15%'
                    }
                };
            }

            if (recType) {
                // STEP 5: Check Guardrails
                const guardrailResult = await executeTool('check_guardrails', {
                    action_type: recType,
                    entity_id: entity.id,
                    entity_type: 'ad',
                    proposed_change: action,
                    metrics: entityMetrics,
                    org_context: {
                        orgId: input.orgId,
                        neverPauseEntities: [],
                        neverRecommendActions: []
                    }
                });

                steps.push({
                    step: steps.length + 1,
                    tool: 'check_guardrails',
                    input: { action_type: recType, entity_id: entity.id },
                    output: guardrailResult.data,
                    duration_ms: guardrailResult.duration_ms,
                    status: guardrailResult.success ? 'success' : 'error'
                });

                const guardrailData = guardrailResult.data as { safe: boolean; violations: unknown[]; warnings: unknown[] } | undefined;

                if (guardrailData?.safe) {
                    // Calculate confidence
                    const confidence = calculateConfidence({
                        dataPoints: (metricsData || []).length * 7, // ~7 days
                        variance: 'medium',
                        completeness: 0.85,
                        healthScore: healthData?.health_score || 80
                    });

                    // STEP 6: Generate Recommendation
                    const recResult = await executeTool('generate_recommendation', {
                        type: recType,
                        entity_id: entity.id,
                        entity_type: 'ad',
                        title,
                        action,
                        evidence: {
                            data_points: (metricsData || []).length * 7,
                            variance: 'medium',
                            completeness: 0.85,
                            sources: ['metrics_api', 'historical']
                        },
                        confidence,
                        reasoning: `Based on ${(metricsData || []).length} entities over 7 days. Health score: ${healthData?.health_score || 'N/A'}. All guardrails passed.`
                    });

                    steps.push({
                        step: steps.length + 1,
                        tool: 'generate_recommendation',
                        input: { type: recType, entity_id: entity.id },
                        output: recResult.data,
                        duration_ms: recResult.duration_ms,
                        status: recResult.success ? 'success' : 'error'
                    });

                    if (recResult.success) {
                        recommendations.push(recResult.data);
                    }
                }
            }
        }

        return {
            id: runId,
            status: 'completed',
            steps,
            recommendations,
            total_duration_ms: Date.now() - startTime
        };

    } catch (error) {
        return {
            id: runId,
            status: 'failed',
            steps,
            recommendations: [],
            total_duration_ms: Date.now() - startTime,
            error_message: String(error)
        };
    }
}

/**
 * Log agent run to database
 */
export async function logAgentRun(result: AgentRunResult, input: AgentInput): Promise<void> {
    try {
        await fetch('/api/ai/agent/runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                runId: result.id,
                orgId: input.orgId,
                userId: input.userId,
                triggerType: 'user_query',
                inputQuery: input.query,
                steps: result.steps,
                toolsUsed: [...new Set(result.steps.map(s => s.tool))],
                totalDurationMs: result.total_duration_ms,
                recommendationsGenerated: result.recommendations.length,
                finalOutput: result.recommendations,
                status: result.status,
                errorMessage: result.error_message
            })
        });
    } catch (error) {
        console.error('Failed to log agent run:', error);
    }
}

export default {
    runAgent,
    logAgentRun,
    calculateConfidence
};
