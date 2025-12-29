/**
 * Auto-Apply Module
 * Automatically applies high-confidence recommendations
 */

import { calibrateConfidence } from './confidence-calibration';

export interface AutoApplyConfig {
    enabled: boolean;
    minConfidence: number;           // Minimum calibrated confidence (default 0.9)
    requireAllGuardrailsPass: boolean;
    maxDailyAutoApplies: number;     // Safety limit
    excludedActionTypes: string[];   // Never auto-apply these
    excludedEntityIds: string[];     // Never auto-apply to these
}

export interface AutoApplyResult {
    shouldAutoApply: boolean;
    reason: string;
    calibratedConfidence: number;
    checksPerformed: {
        confidenceCheck: boolean;
        guardrailsCheck: boolean;
        dailyLimitCheck: boolean;
        actionTypeCheck: boolean;
        entityCheck: boolean;
    };
}

const DEFAULT_CONFIG: AutoApplyConfig = {
    enabled: false,
    minConfidence: 0.9,
    requireAllGuardrailsPass: true,
    maxDailyAutoApplies: 5,
    excludedActionTypes: ['pause', 'delete'],
    excludedEntityIds: []
};

/**
 * Check if a recommendation should be auto-applied
 */
export async function shouldAutoApply(
    recommendation: {
        id: string;
        confidenceScore: number;
        recommendationType: string;
        entityId: string;
        guardrailsPassed: boolean;
    },
    userConfig: Partial<AutoApplyConfig>,
    dailyApplyCount: number
): Promise<AutoApplyResult> {
    const config = { ...DEFAULT_CONFIG, ...userConfig };

    const checks = {
        confidenceCheck: false,
        guardrailsCheck: false,
        dailyLimitCheck: false,
        actionTypeCheck: false,
        entityCheck: false
    };

    // If auto-apply is disabled, stop immediately
    if (!config.enabled) {
        return {
            shouldAutoApply: false,
            reason: 'Auto-apply is disabled',
            calibratedConfidence: recommendation.confidenceScore,
            checksPerformed: checks
        };
    }

    // Calibrate confidence
    const calibration = calibrateConfidence(recommendation.confidenceScore);
    const calibratedConfidence = calibration.calibratedConfidence;

    // Check 1: Confidence threshold
    checks.confidenceCheck = calibratedConfidence >= config.minConfidence;
    if (!checks.confidenceCheck) {
        return {
            shouldAutoApply: false,
            reason: `Confidence ${(calibratedConfidence * 100).toFixed(0)}% below threshold ${(config.minConfidence * 100).toFixed(0)}%`,
            calibratedConfidence,
            checksPerformed: checks
        };
    }

    // Check 2: Guardrails
    checks.guardrailsCheck = !config.requireAllGuardrailsPass || recommendation.guardrailsPassed;
    if (!checks.guardrailsCheck) {
        return {
            shouldAutoApply: false,
            reason: 'Guardrails not passed',
            calibratedConfidence,
            checksPerformed: checks
        };
    }

    // Check 3: Daily limit
    checks.dailyLimitCheck = dailyApplyCount < config.maxDailyAutoApplies;
    if (!checks.dailyLimitCheck) {
        return {
            shouldAutoApply: false,
            reason: `Daily auto-apply limit reached (${config.maxDailyAutoApplies})`,
            calibratedConfidence,
            checksPerformed: checks
        };
    }

    // Check 4: Action type not excluded
    checks.actionTypeCheck = !config.excludedActionTypes.includes(recommendation.recommendationType);
    if (!checks.actionTypeCheck) {
        return {
            shouldAutoApply: false,
            reason: `Action type "${recommendation.recommendationType}" excluded from auto-apply`,
            calibratedConfidence,
            checksPerformed: checks
        };
    }

    // Check 5: Entity not excluded
    checks.entityCheck = !config.excludedEntityIds.includes(recommendation.entityId);
    if (!checks.entityCheck) {
        return {
            shouldAutoApply: false,
            reason: 'Entity excluded from auto-apply',
            calibratedConfidence,
            checksPerformed: checks
        };
    }

    // All checks passed!
    return {
        shouldAutoApply: true,
        reason: 'All auto-apply criteria met',
        calibratedConfidence,
        checksPerformed: checks
    };
}

/**
 * Execute auto-apply for a recommendation
 */
export async function executeAutoApply(
    recommendationId: string,
    userId: string
): Promise<{ success: boolean; message: string }> {
    try {
        // Apply the recommendation via API
        const response = await fetch(`/api/ai/recommendations/${recommendationId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'apply',
                userId,
                autoApplied: true
            })
        });

        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                message: 'Recommendation auto-applied successfully'
            };
        } else {
            return {
                success: false,
                message: data.error || 'Failed to auto-apply'
            };
        }
    } catch (error) {
        console.error('Auto-apply error:', error);
        return {
            success: false,
            message: String(error)
        };
    }
}

/**
 * Get daily auto-apply count for a user
 */
export async function getDailyAutoApplyCount(userId: string): Promise<number> {
    try {
        const today = new Date().toISOString().split('T')[0];

        const response = await fetch(
            `/api/ai/recommendations?userId=${userId}&status=applied&date=${today}&autoApplied=true`
        );

        const data = await response.json();
        return data.recommendations?.length || 0;
    } catch (error) {
        console.error('Error getting auto-apply count:', error);
        return 0;
    }
}

export default {
    shouldAutoApply,
    executeAutoApply,
    getDailyAutoApplyCount,
    DEFAULT_CONFIG
};
