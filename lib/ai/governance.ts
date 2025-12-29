/**
 * Governance Module
 * 
 * Extends guardrails with:
 * - Organization-level governance config
 * - Approval workflows
 * - Rate limiting for changes
 * - Risk scoring for actions
 */

export interface GovernanceConfig {
    organizationId: string;
    budgetGuardrails: {
        maxDailyChangePercent: number;
        maxWeeklyChangePercent: number;
        requireApprovalAbove: number;
    };
    bidGuardrails: {
        maxIncreasePercent: number;
        maxDecreasePercent: number;
    };
    changeRateLimits: {
        maxChangesPerDay: number;
        maxChangesPerWeek: number;
        cooldownMinutes: number;
    };
    approvalThresholds: {
        budgetChange: number;     // Require approval if change > this %
        riskScore: number;        // Require approval if risk > this
        affectedEntities: number; // Require approval if affecting > this many entities
    };
    riskWeights: {
        changeSize: number;
        entityValue: number;
        historicalFailure: number;
        learningPhase: number;
    };
}

export interface ChangeRequest {
    id: string;
    organizationId: string;
    requesterId: string;
    entityType: 'ad' | 'adset' | 'campaign';
    entityId: string;
    entityName: string;
    changeType: 'budget' | 'bid' | 'status' | 'targeting' | 'creative';
    currentValue: unknown;
    proposedValue: unknown;
    changePercent?: number;
    riskScore: number;
    riskFactors: Array<{
        factor: string;
        score: number;
        description: string;
    }>;
    status: 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'auto_rejected';
    requiresApproval: boolean;
    approvers: Array<{
        userId: string;
        name: string;
        decision?: 'approved' | 'rejected';
        comment?: string;
        decidedAt?: string;
    }>;
    createdAt: string;
    resolvedAt?: string;
}

export interface RateLimitCheck {
    allowed: boolean;
    reason?: string;
    remainingToday: number;
    remainingThisWeek: number;
    nextAvailableAt?: string;
}

const DEFAULT_GOVERNANCE: GovernanceConfig = {
    organizationId: '',
    budgetGuardrails: {
        maxDailyChangePercent: 30,
        maxWeeklyChangePercent: 100,
        requireApprovalAbove: 50
    },
    bidGuardrails: {
        maxIncreasePercent: 25,
        maxDecreasePercent: 50
    },
    changeRateLimits: {
        maxChangesPerDay: 20,
        maxChangesPerWeek: 50,
        cooldownMinutes: 5
    },
    approvalThresholds: {
        budgetChange: 50,
        riskScore: 70,
        affectedEntities: 5
    },
    riskWeights: {
        changeSize: 0.3,
        entityValue: 0.25,
        historicalFailure: 0.25,
        learningPhase: 0.2
    }
};

/**
 * Calculate risk score for a proposed change
 */
export function calculateChangeRiskScore(params: {
    changePercent: number;
    entityMetrics: {
        spend?: number;
        conversions?: number;
        roas?: number;
    };
    historicalFailureRate?: number;
    inLearningPhase?: boolean;
    config?: GovernanceConfig;
}): {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: Array<{ factor: string; score: number; description: string }>;
} {
    const { changePercent, entityMetrics, historicalFailureRate = 0, inLearningPhase = false, config = DEFAULT_GOVERNANCE } = params;
    const weights = config.riskWeights;
    const factors: Array<{ factor: string; score: number; description: string }> = [];

    // Change size risk
    const changeSizeRisk = Math.min(100, Math.abs(changePercent) * 1.5);
    factors.push({
        factor: 'Change Size',
        score: changeSizeRisk * weights.changeSize,
        description: `${Math.abs(changePercent).toFixed(1)}% change`
    });

    // Entity value risk
    const spend = entityMetrics.spend || 0;
    const entityValueRisk = Math.min(100, (spend / 1000) * 10);
    factors.push({
        factor: 'Entity Value',
        score: entityValueRisk * weights.entityValue,
        description: `$${spend.toFixed(0)} spend`
    });

    // Historical failure risk
    const failureRisk = historicalFailureRate * 100;
    factors.push({
        factor: 'Historical Failure',
        score: failureRisk * weights.historicalFailure,
        description: `${(historicalFailureRate * 100).toFixed(0)}% failure rate`
    });

    // Learning phase risk
    const learningRisk = inLearningPhase ? 80 : 0;
    factors.push({
        factor: 'Learning Phase',
        score: learningRisk * weights.learningPhase,
        description: inLearningPhase ? 'In learning phase' : 'Stable'
    });

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

    let level: 'low' | 'medium' | 'high' | 'critical';
    if (totalScore >= 75) level = 'critical';
    else if (totalScore >= 50) level = 'high';
    else if (totalScore >= 25) level = 'medium';
    else level = 'low';

    return { score: Math.min(100, totalScore), level, factors };
}

/**
 * Check if change requires approval
 */
export function requiresApproval(params: {
    changePercent?: number;
    riskScore: number;
    affectedEntities?: number;
    config?: GovernanceConfig;
}): {
    required: boolean;
    reasons: string[];
} {
    const { changePercent = 0, riskScore, affectedEntities = 1, config = DEFAULT_GOVERNANCE } = params;
    const reasons: string[] = [];

    if (Math.abs(changePercent) >= config.approvalThresholds.budgetChange) {
        reasons.push(`Change exceeds ${config.approvalThresholds.budgetChange}% threshold`);
    }

    if (riskScore >= config.approvalThresholds.riskScore) {
        reasons.push(`Risk score ${riskScore} exceeds ${config.approvalThresholds.riskScore} threshold`);
    }

    if (affectedEntities >= config.approvalThresholds.affectedEntities) {
        reasons.push(`Affects ${affectedEntities} entities (threshold: ${config.approvalThresholds.affectedEntities})`);
    }

    return { required: reasons.length > 0, reasons };
}

/**
 * Check rate limits for changes
 */
export function checkRateLimits(params: {
    recentChanges: Array<{ timestamp: string }>;
    config?: GovernanceConfig;
}): RateLimitCheck {
    const { recentChanges, config = DEFAULT_GOVERNANCE } = params;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const changesToday = recentChanges.filter(c => new Date(c.timestamp).getTime() > oneDayAgo);
    const changesThisWeek = recentChanges.filter(c => new Date(c.timestamp).getTime() > oneWeekAgo);

    const remainingToday = Math.max(0, config.changeRateLimits.maxChangesPerDay - changesToday.length);
    const remainingThisWeek = Math.max(0, config.changeRateLimits.maxChangesPerWeek - changesThisWeek.length);

    // Check cooldown
    const lastChange = recentChanges.length > 0
        ? new Date(recentChanges[recentChanges.length - 1].timestamp).getTime()
        : 0;
    const cooldownEnd = lastChange + config.changeRateLimits.cooldownMinutes * 60 * 1000;
    const inCooldown = now < cooldownEnd;

    if (inCooldown) {
        return {
            allowed: false,
            reason: `Cooldown period in effect`,
            remainingToday,
            remainingThisWeek,
            nextAvailableAt: new Date(cooldownEnd).toISOString()
        };
    }

    if (remainingToday <= 0) {
        return {
            allowed: false,
            reason: `Daily change limit (${config.changeRateLimits.maxChangesPerDay}) reached`,
            remainingToday: 0,
            remainingThisWeek
        };
    }

    if (remainingThisWeek <= 0) {
        return {
            allowed: false,
            reason: `Weekly change limit (${config.changeRateLimits.maxChangesPerWeek}) reached`,
            remainingToday,
            remainingThisWeek: 0
        };
    }

    return { allowed: true, remainingToday, remainingThisWeek };
}

/**
 * Create a change request
 */
export function createChangeRequest(params: {
    organizationId: string;
    requesterId: string;
    entityType: 'ad' | 'adset' | 'campaign';
    entityId: string;
    entityName: string;
    changeType: 'budget' | 'bid' | 'status' | 'targeting' | 'creative';
    currentValue: unknown;
    proposedValue: unknown;
    entityMetrics?: Record<string, number>;
    historicalFailureRate?: number;
    inLearningPhase?: boolean;
    config?: GovernanceConfig;
}): ChangeRequest {
    const {
        organizationId, requesterId, entityType, entityId, entityName,
        changeType, currentValue, proposedValue,
        entityMetrics = {}, historicalFailureRate, inLearningPhase, config
    } = params;

    // Calculate change percent for numeric values
    let changePercent: number | undefined;
    if (typeof currentValue === 'number' && typeof proposedValue === 'number' && currentValue > 0) {
        changePercent = ((proposedValue - currentValue) / currentValue) * 100;
    }

    // Calculate risk
    const risk = calculateChangeRiskScore({
        changePercent: changePercent || 0,
        entityMetrics,
        historicalFailureRate,
        inLearningPhase,
        config
    });

    // Check if approval required
    const approval = requiresApproval({
        changePercent,
        riskScore: risk.score,
        config
    });

    return {
        id: `cr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId,
        requesterId,
        entityType,
        entityId,
        entityName,
        changeType,
        currentValue,
        proposedValue,
        changePercent,
        riskScore: risk.score,
        riskFactors: risk.factors,
        status: approval.required ? 'pending' : 'auto_approved',
        requiresApproval: approval.required,
        approvers: [],
        createdAt: new Date().toISOString()
    };
}

export { DEFAULT_GOVERNANCE };
