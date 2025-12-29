/**
 * Athena AI Agent Tools
 * Structured tool definitions for multi-step reasoning
 */

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, { type: string; description: string; required?: boolean }>;
    execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

// Tool implementations
const AGENT_TOOLS: Record<string, ToolDefinition> = {
    fetch_metrics: {
        name: 'fetch_metrics',
        description: 'Fetch performance metrics for campaigns, adsets, or ads',
        parameters: {
            entity_type: { type: 'string', description: 'Type: campaign, adset, or ad', required: true },
            entity_ids: { type: 'array', description: 'Array of entity IDs', required: true },
            date_range: { type: 'string', description: 'Date range: last_7d, last_14d, last_30d', required: false },
            metrics: { type: 'array', description: 'Metrics to fetch', required: true }
        },
        execute: async (params) => {
            try {
                // In production, fetch from user_ads table or Meta API
                const entityIds = params.entity_ids as string[];
                const ads = JSON.parse(localStorage?.getItem('ads') || '[]');

                const metricsData = entityIds.map(id => {
                    const ad = ads.find((a: Record<string, unknown>) => a.id === id);
                    if (!ad) return { id, found: false };

                    return {
                        id,
                        found: true,
                        spend: ad.spend || 0,
                        impressions: ad.impressions || 0,
                        clicks: ad.clicks || 0,
                        conversions: ad.conversions || 0,
                        ctr: ad.ctr || 0,
                        cpc: ad.cpc || 0,
                        cpa: ad.cpa || 0,
                        roas: ad.roas || 0
                    };
                });

                return { success: true, data: metricsData };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        }
    },

    validate_data_health: {
        name: 'validate_data_health',
        description: 'Check data quality for given entities',
        parameters: {
            entity_ids: { type: 'array', description: 'Entity IDs to check', required: true },
            org_id: { type: 'string', description: 'Organization ID', required: true }
        },
        execute: async (params) => {
            try {
                const response = await fetch(`/api/ai/health?orgId=${params.org_id}`);
                const data = await response.json();

                if (!data.success) {
                    return { success: false, error: data.error };
                }

                const entityIds = params.entity_ids as string[];
                const relevantScores = data.scores.filter((s: { entity_id: string }) =>
                    entityIds.includes(s.entity_id)
                );

                const avgScore = relevantScores.length > 0
                    ? relevantScores.reduce((sum: number, s: { overall_score: number }) => sum + s.overall_score, 0) / relevantScores.length
                    : 100; // Assume healthy if no data

                return {
                    success: true,
                    data: {
                        health_score: avgScore,
                        can_recommend: avgScore >= 70,
                        issues: relevantScores.flatMap((s: { issues_json: unknown[] }) => s.issues_json || []),
                        scores: relevantScores
                    }
                };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        }
    },

    check_guardrails: {
        name: 'check_guardrails',
        description: 'Verify action safety against guardrails',
        parameters: {
            action_type: { type: 'string', description: 'Type of action', required: true },
            entity_id: { type: 'string', description: 'Entity ID', required: true },
            entity_type: { type: 'string', description: 'Entity type', required: true },
            proposed_change: { type: 'object', description: 'Proposed change details', required: false },
            metrics: { type: 'object', description: 'Current entity metrics', required: false },
            org_context: { type: 'object', description: 'Organization context', required: true }
        },
        execute: async (params) => {
            try {
                const { checkAllGuardrails } = await import('./guardrails');

                const context = {
                    entity: {
                        id: params.entity_id as string,
                        type: params.entity_type as 'ad' | 'adset' | 'campaign',
                        metrics: params.metrics as Record<string, number>
                    },
                    actionType: params.action_type as string,
                    proposedChange: params.proposed_change as Record<string, unknown>,
                    orgContext: params.org_context as {
                        orgId: string;
                        pixelId?: string;
                        neverPauseEntities?: string[];
                        neverRecommendActions?: string[];
                    }
                };

                const result = await checkAllGuardrails(context);

                return {
                    success: true,
                    data: result
                };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        }
    },

    get_historical_benchmarks: {
        name: 'get_historical_benchmarks',
        description: 'Get historical performance benchmarks for comparison',
        parameters: {
            metric: { type: 'string', description: 'Metric to benchmark', required: true },
            entity_type: { type: 'string', description: 'Entity type', required: true },
            lookback_days: { type: 'number', description: 'Days to look back', required: false }
        },
        execute: async (params) => {
            try {
                // In production, query aggregated historical data
                const ads = JSON.parse(localStorage?.getItem('ads') || '[]');
                const metric = params.metric as string;

                const values = ads
                    .map((ad: Record<string, unknown>) => ad[metric] as number)
                    .filter((v: number) => typeof v === 'number' && !isNaN(v));

                if (values.length === 0) {
                    return {
                        success: true,
                        data: { benchmark: null, sample_size: 0, message: 'Insufficient data' }
                    };
                }

                const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
                const sorted = [...values].sort((a, b) => a - b);
                const p25 = sorted[Math.floor(values.length * 0.25)];
                const p50 = sorted[Math.floor(values.length * 0.5)];
                const p75 = sorted[Math.floor(values.length * 0.75)];

                return {
                    success: true,
                    data: {
                        metric,
                        sample_size: values.length,
                        average: avg,
                        percentiles: { p25, p50, p75 },
                        benchmark: p50 // Median as benchmark
                    }
                };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        }
    },

    generate_recommendation: {
        name: 'generate_recommendation',
        description: 'Create a structured recommendation for the user',
        parameters: {
            type: { type: 'string', description: 'Recommendation type', required: true },
            entity_id: { type: 'string', description: 'Entity ID', required: true },
            entity_type: { type: 'string', description: 'Entity type', required: true },
            title: { type: 'string', description: 'Recommendation title', required: true },
            action: { type: 'object', description: 'Action details', required: true },
            evidence: { type: 'object', description: 'Evidence supporting recommendation', required: true },
            confidence: { type: 'number', description: 'Confidence score 0-1', required: true },
            reasoning: { type: 'string', description: 'Reasoning explanation', required: false }
        },
        execute: async (params) => {
            try {
                const recommendation = {
                    recommendation_type: params.type,
                    entity_type: params.entity_type,
                    entity_id: params.entity_id,
                    title: params.title,
                    action_json: params.action,
                    evidence_json: params.evidence,
                    confidence_score: params.confidence,
                    reasoning_steps: params.reasoning ? [params.reasoning] : [],
                    status: 'pending',
                    created_at: new Date().toISOString()
                };

                return {
                    success: true,
                    data: recommendation
                };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        }
    }
};

/**
 * Execute a tool by name
 */
export async function executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult & { tool: string; duration_ms: number }> {
    const start = Date.now();
    const tool = AGENT_TOOLS[name];

    if (!tool) {
        return {
            tool: name,
            success: false,
            error: `Unknown tool: ${name}`,
            duration_ms: Date.now() - start
        };
    }

    const result = await tool.execute(params);
    return {
        tool: name,
        ...result,
        duration_ms: Date.now() - start
    };
}

/**
 * Get tool definitions for AI prompt
 */
export function getToolDefinitions(): Record<string, { name: string; description: string; parameters: Record<string, unknown> }> {
    return Object.fromEntries(
        Object.entries(AGENT_TOOLS).map(([key, tool]) => [
            key,
            {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        ])
    );
}

export default {
    executeTool,
    getToolDefinitions,
    AGENT_TOOLS
};
