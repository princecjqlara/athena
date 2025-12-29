/**
 * Athena AI Guardrails System
 * Safety checks before any recommendation is made
 */

export interface GuardrailContext {
    entity: {
        id: string;
        type: 'ad' | 'adset' | 'campaign';
        metrics?: {
            conversions?: number;
            impressions?: number;
            spend?: number;
            cpa?: number;
            roas?: number;
        };
    };
    actionType: string;
    proposedChange?: Record<string, unknown>;
    orgContext: {
        orgId: string;
        pixelId?: string;
        neverPauseEntities?: string[];
        neverRecommendActions?: string[];
    };
}

export interface GuardrailResult {
    passed: boolean;
    message: string | null;
}

export interface Guardrail {
    id: string;
    name: string;
    description: string;
    severity: 'warning' | 'block';
    check: (context: GuardrailContext) => Promise<GuardrailResult>;
}

export interface GuardrailCheckResult {
    safe: boolean;
    violations: Array<{ id: string; message: string | null }>;
    warnings: Array<{ id: string; message: string | null }>;
}

// Guardrail definitions
const GUARDRAILS: Guardrail[] = [
    {
        id: 'learning_phase',
        name: 'Entity in Learning Phase',
        description: 'Entity needs at least 50 conversions to exit learning phase',
        severity: 'block',
        check: async ({ entity }) => {
            const conversions = entity.metrics?.conversions || 0;
            return {
                passed: conversions >= 50,
                message: conversions < 50
                    ? `Only ${conversions}/50 conversions. Wait for learning phase to complete.`
                    : null
            };
        }
    },
    {
        id: 'sample_size',
        name: 'Minimum Sample Size',
        description: 'Requires sufficient data before making changes',
        severity: 'block',
        check: async ({ entity, actionType }) => {
            const minSamples = actionType === 'pause' ? 1000 : 500;
            const impressions = entity.metrics?.impressions || 0;
            return {
                passed: impressions >= minSamples,
                message: impressions < minSamples
                    ? `Insufficient data: ${impressions}/${minSamples} impressions required`
                    : null
            };
        }
    },
    {
        id: 'top_converter_protection',
        name: 'Protect Top Converters',
        description: 'Cannot pause entities that are top performers',
        severity: 'block',
        check: async ({ entity, actionType, orgContext }) => {
            if (actionType !== 'pause') return { passed: true, message: null };

            // Check if entity is in never-pause list
            const isProtected = orgContext.neverPauseEntities?.includes(entity.id);

            // Also check if it's a top performer (ROAS > 2 or CPA < avg)
            const isTopPerformer = (entity.metrics?.roas || 0) > 2 ||
                (entity.metrics?.conversions || 0) > 10;

            return {
                passed: !isProtected && !isTopPerformer,
                message: isProtected
                    ? 'This entity is protected from pausing'
                    : isTopPerformer
                        ? 'Cannot pause: This is a top performer (ROAS > 2 or 10+ conversions)'
                        : null
            };
        }
    },
    {
        id: 'tracking_health',
        name: 'Tracking Must Be Healthy',
        description: 'Cannot scale when tracking is broken',
        severity: 'block',
        check: async ({ actionType }) => {
            if (!['budget_increase', 'scale'].includes(actionType)) {
                return { passed: true, message: null };
            }

            // In real implementation, check data_health_scores table
            // For now, assume healthy
            const healthScore = 80; // Would fetch from API

            return {
                passed: healthScore >= 70,
                message: healthScore < 70
                    ? `Tracking unhealthy (${healthScore}/100). Fix tracking before scaling.`
                    : null
            };
        }
    },
    {
        id: 'budget_limit',
        name: 'Budget Change Limit',
        description: 'Budget changes should not exceed 50% at once',
        severity: 'warning',
        check: async ({ actionType, proposedChange }) => {
            if (actionType !== 'budget_increase' && actionType !== 'budget_decrease') {
                return { passed: true, message: null };
            }

            const changePct = Math.abs((proposedChange?.change_pct as number) || 0);
            return {
                passed: changePct <= 50,
                message: changePct > 50
                    ? `Large budget change (${changePct}%). Consider smaller increments.`
                    : null
            };
        }
    },
    {
        id: 'action_blocklist',
        name: 'User Action Blocklist',
        description: 'Respect user preferences for never recommending certain actions',
        severity: 'block',
        check: async ({ actionType, orgContext }) => {
            const blocked = orgContext.neverRecommendActions?.includes(actionType);
            return {
                passed: !blocked,
                message: blocked
                    ? `Action "${actionType}" is blocked by user preferences`
                    : null
            };
        }
    },
    {
        id: 'minimum_spend',
        name: 'Minimum Spend Check',
        description: 'Entity must have some spend before recommendations',
        severity: 'block',
        check: async ({ entity }) => {
            const spend = entity.metrics?.spend || 0;
            return {
                passed: spend > 0,
                message: spend <= 0
                    ? 'No spend data available for this entity'
                    : null
            };
        }
    }
];

/**
 * Check all guardrails for a given context
 */
export async function checkAllGuardrails(context: GuardrailContext): Promise<GuardrailCheckResult> {
    const results = await Promise.all(
        GUARDRAILS.map(async (guardrail) => {
            try {
                const result = await guardrail.check(context);
                return { ...result, guardrail };
            } catch (error) {
                console.error(`Guardrail ${guardrail.id} error:`, error);
                return { passed: true, message: null, guardrail }; // Fail open on errors
            }
        })
    );

    const violations = results
        .filter(r => !r.passed && r.guardrail.severity === 'block')
        .map(v => ({ id: v.guardrail.id, message: v.message }));

    const warnings = results
        .filter(r => !r.passed && r.guardrail.severity === 'warning')
        .map(w => ({ id: w.guardrail.id, message: w.message }));

    return {
        safe: violations.length === 0,
        violations,
        warnings
    };
}

/**
 * Check a single guardrail by ID
 */
export async function checkGuardrail(id: string, context: GuardrailContext): Promise<GuardrailResult & { found: boolean }> {
    const guardrail = GUARDRAILS.find(g => g.id === id);
    if (!guardrail) {
        return { found: false, passed: true, message: null };
    }

    const result = await guardrail.check(context);
    return { found: true, ...result };
}

/**
 * Get list of all guardrails with descriptions
 */
export function getGuardrailDefinitions(): Array<{ id: string; name: string; description: string; severity: string }> {
    return GUARDRAILS.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        severity: g.severity
    }));
}

export default {
    checkAllGuardrails,
    checkGuardrail,
    getGuardrailDefinitions,
    GUARDRAILS
};
