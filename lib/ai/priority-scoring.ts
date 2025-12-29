/**
 * Priority Scoring Module
 * 
 * Ranks insights by: expected impact × confidence × urgency × (1 - risk)
 * Used for recommendation prioritization (Capability 17)
 */

export interface PriorityFactors {
    expectedImpact: number;    // 0-1: Expected improvement magnitude
    confidence: number;        // 0-1: Confidence in the recommendation
    urgency: number;           // 0-1: How time-sensitive (higher = more urgent)
    risk: number;              // 0-1: Risk level (higher = more risky)
}

export interface PriorityResult {
    score: number;             // Combined priority score (0-1)
    factors: PriorityFactors;
    rank: 'critical' | 'high' | 'medium' | 'low';
    reasoning: string;
}

// Weights for priority calculation
const PRIORITY_WEIGHTS = {
    expectedImpact: 0.35,
    confidence: 0.25,
    urgency: 0.25,
    risk: 0.15              // Risk is inverted in calculation
};

/**
 * Calculate expected impact score based on metric improvement potential
 */
export function calculateExpectedImpact(params: {
    metric: string;
    currentValue: number;
    expectedValue: number;
    metricImportance?: number;  // 0-1, how important this metric is
}): number {
    const { currentValue, expectedValue, metricImportance = 0.5 } = params;

    if (currentValue === 0) return 0.5;

    const percentChange = Math.abs((expectedValue - currentValue) / currentValue);

    // Cap at 100% improvement for normalization
    const normalizedChange = Math.min(percentChange, 1);

    // Apply metric importance multiplier
    return normalizedChange * (0.5 + metricImportance * 0.5);
}

/**
 * Calculate urgency score based on time factors
 */
export function calculateUrgency(params: {
    daysUntilBudgetExhausted?: number;
    daysInLearningPhase?: number;
    performanceDeclineDays?: number;
    upcomingEvent?: boolean;
    seasonalOpportunity?: boolean;
}): number {
    let urgency = 0.3; // Base urgency

    // Budget running out
    if (params.daysUntilBudgetExhausted !== undefined) {
        if (params.daysUntilBudgetExhausted <= 1) urgency += 0.3;
        else if (params.daysUntilBudgetExhausted <= 3) urgency += 0.2;
        else if (params.daysUntilBudgetExhausted <= 7) urgency += 0.1;
    }

    // Learning phase ending
    if (params.daysInLearningPhase !== undefined) {
        if (params.daysInLearningPhase >= 7) urgency += 0.15; // Need action before exit
    }

    // Performance declining
    if (params.performanceDeclineDays !== undefined) {
        if (params.performanceDeclineDays >= 7) urgency += 0.25;
        else if (params.performanceDeclineDays >= 3) urgency += 0.15;
    }

    // Upcoming event or seasonal opportunity
    if (params.upcomingEvent) urgency += 0.1;
    if (params.seasonalOpportunity) urgency += 0.1;

    return Math.min(1, urgency);
}

/**
 * Calculate risk score based on action characteristics
 */
export function calculateRisk(params: {
    actionType: string;
    changeMagnitude: number;       // Percentage change being proposed
    inLearningPhase: boolean;
    hasHistoricalData: boolean;
    isReversible: boolean;
    budgetImpact?: number;         // Dollar amount at risk
}): number {
    let risk = 0.2; // Base risk

    // Action type risk
    const actionRisks: Record<string, number> = {
        'budget_increase': 0.15,
        'budget_decrease': 0.05,
        'bid_change': 0.2,
        'audience_expansion': 0.25,
        'creative_swap': 0.15,
        'pause_ad': 0.1,
        'enable_ad': 0.1,
        'targeting_change': 0.3
    };
    risk += actionRisks[params.actionType] || 0.15;

    // Change magnitude risk
    if (params.changeMagnitude > 50) risk += 0.2;
    else if (params.changeMagnitude > 30) risk += 0.1;
    else if (params.changeMagnitude > 20) risk += 0.05;

    // Learning phase risk
    if (params.inLearningPhase) risk += 0.15;

    // No historical data = more risk
    if (!params.hasHistoricalData) risk += 0.15;

    // Irreversible = more risk
    if (!params.isReversible) risk += 0.1;

    // Budget impact
    if (params.budgetImpact) {
        if (params.budgetImpact > 1000) risk += 0.1;
        if (params.budgetImpact > 5000) risk += 0.1;
    }

    return Math.min(1, risk);
}

/**
 * Calculate combined priority score
 */
export function calculatePriority(factors: PriorityFactors): number {
    // Invert risk so higher risk = lower priority contribution
    const adjustedRisk = 1 - factors.risk;

    const score = (
        factors.expectedImpact * PRIORITY_WEIGHTS.expectedImpact +
        factors.confidence * PRIORITY_WEIGHTS.confidence +
        factors.urgency * PRIORITY_WEIGHTS.urgency +
        adjustedRisk * PRIORITY_WEIGHTS.risk
    );

    return Math.max(0, Math.min(1, score));
}

/**
 * Get priority rank from score
 */
export function getPriorityRank(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
}

/**
 * Generate priority reasoning
 */
export function generatePriorityReasoning(factors: PriorityFactors, score: number): string {
    const reasons: string[] = [];

    if (factors.expectedImpact >= 0.7) {
        reasons.push('high expected improvement');
    } else if (factors.expectedImpact <= 0.3) {
        reasons.push('modest expected improvement');
    }

    if (factors.confidence >= 0.7) {
        reasons.push('high confidence in outcome');
    } else if (factors.confidence <= 0.4) {
        reasons.push('lower confidence (limited data)');
    }

    if (factors.urgency >= 0.7) {
        reasons.push('time-sensitive action needed');
    }

    if (factors.risk >= 0.6) {
        reasons.push('carries notable risk');
    } else if (factors.risk <= 0.3) {
        reasons.push('low risk action');
    }

    const rank = getPriorityRank(score);
    return `${rank.toUpperCase()} priority: ${reasons.join(', ') || 'balanced factors'}`;
}

/**
 * Full priority calculation
 */
export function calculateFullPriority(params: {
    // Impact factors
    metric: string;
    currentValue: number;
    expectedValue: number;
    metricImportance?: number;

    // Confidence (direct pass-through)
    confidence: number;

    // Urgency factors
    daysUntilBudgetExhausted?: number;
    daysInLearningPhase?: number;
    performanceDeclineDays?: number;
    upcomingEvent?: boolean;
    seasonalOpportunity?: boolean;

    // Risk factors
    actionType: string;
    changeMagnitude: number;
    inLearningPhase: boolean;
    hasHistoricalData: boolean;
    isReversible: boolean;
    budgetImpact?: number;
}): PriorityResult {
    const factors: PriorityFactors = {
        expectedImpact: calculateExpectedImpact({
            metric: params.metric,
            currentValue: params.currentValue,
            expectedValue: params.expectedValue,
            metricImportance: params.metricImportance
        }),
        confidence: params.confidence,
        urgency: calculateUrgency({
            daysUntilBudgetExhausted: params.daysUntilBudgetExhausted,
            daysInLearningPhase: params.daysInLearningPhase,
            performanceDeclineDays: params.performanceDeclineDays,
            upcomingEvent: params.upcomingEvent,
            seasonalOpportunity: params.seasonalOpportunity
        }),
        risk: calculateRisk({
            actionType: params.actionType,
            changeMagnitude: params.changeMagnitude,
            inLearningPhase: params.inLearningPhase,
            hasHistoricalData: params.hasHistoricalData,
            isReversible: params.isReversible,
            budgetImpact: params.budgetImpact
        })
    };

    const score = calculatePriority(factors);
    const rank = getPriorityRank(score);
    const reasoning = generatePriorityReasoning(factors, score);

    return {
        score,
        factors,
        rank,
        reasoning
    };
}

/**
 * Sort recommendations by priority
 */
export function sortByPriority<T extends { priorityScore?: number }>(
    recommendations: T[]
): T[] {
    return [...recommendations].sort((a, b) =>
        (b.priorityScore || 0) - (a.priorityScore || 0)
    );
}
