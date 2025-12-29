/**
 * Data Health Scoring Module
 * 
 * Calculates health scores for data quality subsystem:
 * - Freshness: Hours since last data update
 * - Completeness: Percentage of fields with valid data
 * - Lag: Reporting delay from platform
 * - Attribution: Conversion attribution window health
 * - API Stability: Recent API success rate
 * - Consistency: Data consistency over time
 */

export interface HealthScores {
    freshness: number;      // 0-100
    completeness: number;   // 0-100
    lag: number;            // 0-100
    attribution: number;    // 0-100
    apiStability: number;   // 0-100
    consistency: number;    // 0-100
}

export interface HealthIssue {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metric?: string;
    value?: number;
    threshold?: number;
}

export interface DataHealthResult {
    scores: HealthScores;
    overallScore: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: HealthIssue[];
    confidenceModifier: number;
    recommendations: string[];
}

// Weights for overall score
const HEALTH_WEIGHTS = {
    freshness: 0.20,
    completeness: 0.25,
    lag: 0.15,
    attribution: 0.15,
    apiStability: 0.15,
    consistency: 0.10
};

// Thresholds
const THRESHOLDS = {
    freshness: {
        excellent: 4,    // <= 4 hours
        good: 12,       // <= 12 hours
        acceptable: 24, // <= 24 hours
        poor: 48        // > 48 hours = critical
    },
    completeness: {
        required: ['impressions', 'spend', 'clicks'],
        important: ['reach', 'ctr', 'cpc', 'cpm'],
        optional: ['frequency', 'video_views', 'conversions']
    },
    lag: {
        excellent: 2,    // <= 2 hours
        acceptable: 6,   // <= 6 hours
        poor: 12         // > 12 hours
    },
    apiStability: {
        excellent: 0.99,  // >= 99% success
        good: 0.95,       // >= 95%
        acceptable: 0.90  // >= 90%
    }
};

/**
 * Calculate freshness score
 */
export function calculateFreshnessScore(hoursSinceUpdate: number): number {
    if (hoursSinceUpdate <= THRESHOLDS.freshness.excellent) return 100;
    if (hoursSinceUpdate <= THRESHOLDS.freshness.good) return 80;
    if (hoursSinceUpdate <= THRESHOLDS.freshness.acceptable) return 60;
    if (hoursSinceUpdate <= THRESHOLDS.freshness.poor) return 40;

    // Exponential decay after 48 hours
    return Math.max(10, 40 - (hoursSinceUpdate - 48) * 0.5);
}

/**
 * Calculate completeness score based on available fields
 */
export function calculateCompletenessScore(
    availableFields: string[],
    fieldValues: Record<string, number | null>
): number {
    let score = 0;
    let totalWeight = 0;

    // Required fields (weight 3)
    for (const field of THRESHOLDS.completeness.required) {
        totalWeight += 3;
        if (availableFields.includes(field) && fieldValues[field] !== null) {
            score += 3;
        }
    }

    // Important fields (weight 2)
    for (const field of THRESHOLDS.completeness.important) {
        totalWeight += 2;
        if (availableFields.includes(field) && fieldValues[field] !== null) {
            score += 2;
        }
    }

    // Optional fields (weight 1)
    for (const field of THRESHOLDS.completeness.optional) {
        totalWeight += 1;
        if (availableFields.includes(field) && fieldValues[field] !== null) {
            score += 1;
        }
    }

    return Math.round((score / totalWeight) * 100);
}

/**
 * Calculate lag score based on reporting delay
 */
export function calculateLagScore(reportingDelayHours: number): number {
    if (reportingDelayHours <= THRESHOLDS.lag.excellent) return 100;
    if (reportingDelayHours <= THRESHOLDS.lag.acceptable) return 70;
    if (reportingDelayHours <= THRESHOLDS.lag.poor) return 40;
    return 20;
}

/**
 * Calculate attribution score based on conversion window health
 */
export function calculateAttributionScore(params: {
    attributionWindow: number;    // Current window in days
    hasAllConversions: boolean;   // All conversions within window
    conversionLag: number;        // Hours lag on conversions
}): number {
    let score = 100;

    // Penalize short attribution windows
    if (params.attributionWindow < 7) score -= 20;
    if (params.attributionWindow < 1) score -= 30;

    // Penalize missing conversions
    if (!params.hasAllConversions) score -= 30;

    // Penalize conversion lag
    if (params.conversionLag > 24) score -= 10;
    if (params.conversionLag > 48) score -= 20;

    return Math.max(0, score);
}

/**
 * Calculate API stability score
 */
export function calculateApiStabilityScore(
    successCount: number,
    totalCount: number
): number {
    if (totalCount === 0) return 50; // Unknown

    const successRate = successCount / totalCount;

    if (successRate >= THRESHOLDS.apiStability.excellent) return 100;
    if (successRate >= THRESHOLDS.apiStability.good) return 80;
    if (successRate >= THRESHOLDS.apiStability.acceptable) return 60;

    return Math.max(20, Math.round(successRate * 100));
}

/**
 * Calculate consistency score based on data over time
 */
export function calculateConsistencyScore(
    dailyValues: number[],
    expectedRange?: { min: number; max: number }
): number {
    if (dailyValues.length < 3) return 70; // Not enough data

    // Check for missing days (zeros)
    const missingDays = dailyValues.filter(v => v === 0).length;
    const missingPenalty = (missingDays / dailyValues.length) * 50;

    // Check for outliers
    const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
    const stdDev = Math.sqrt(
        dailyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyValues.length
    );

    const outliers = dailyValues.filter(v => Math.abs(v - mean) > 3 * stdDev).length;
    const outlierPenalty = outliers * 10;

    // Check if within expected range
    let rangePenalty = 0;
    if (expectedRange) {
        const outsideRange = dailyValues.filter(
            v => v < expectedRange.min || v > expectedRange.max
        ).length;
        rangePenalty = (outsideRange / dailyValues.length) * 30;
    }

    return Math.max(0, 100 - missingPenalty - outlierPenalty - rangePenalty);
}

/**
 * Calculate overall health score
 */
export function calculateOverallHealthScore(scores: HealthScores): number {
    return Math.round(
        scores.freshness * HEALTH_WEIGHTS.freshness +
        scores.completeness * HEALTH_WEIGHTS.completeness +
        scores.lag * HEALTH_WEIGHTS.lag +
        scores.attribution * HEALTH_WEIGHTS.attribution +
        scores.apiStability * HEALTH_WEIGHTS.apiStability +
        scores.consistency * HEALTH_WEIGHTS.consistency
    );
}

/**
 * Get health status from score
 */
export function getHealthStatus(score: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'degraded';
    return 'unhealthy';
}

/**
 * Detect issues from scores
 */
export function detectHealthIssues(scores: HealthScores): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (scores.freshness < 40) {
        issues.push({
            type: 'stale_data',
            severity: 'critical',
            message: 'Data is significantly outdated',
            metric: 'freshness',
            value: scores.freshness
        });
    } else if (scores.freshness < 60) {
        issues.push({
            type: 'stale_data',
            severity: 'warning',
            message: 'Data may be outdated',
            metric: 'freshness',
            value: scores.freshness
        });
    }

    if (scores.completeness < 50) {
        issues.push({
            type: 'incomplete_data',
            severity: 'critical',
            message: 'Required metrics are missing',
            metric: 'completeness',
            value: scores.completeness
        });
    }

    if (scores.apiStability < 60) {
        issues.push({
            type: 'api_instability',
            severity: 'warning',
            message: 'API connection has been unstable',
            metric: 'apiStability',
            value: scores.apiStability
        });
    }

    if (scores.attribution < 50) {
        issues.push({
            type: 'attribution_issue',
            severity: 'warning',
            message: 'Conversion attribution may be incomplete',
            metric: 'attribution',
            value: scores.attribution
        });
    }

    if (scores.consistency < 40) {
        issues.push({
            type: 'inconsistent_data',
            severity: 'info',
            message: 'Data shows unexpected patterns',
            metric: 'consistency',
            value: scores.consistency
        });
    }

    return issues;
}

/**
 * Full data health calculation
 */
export function calculateDataHealth(params: {
    hoursSinceUpdate: number;
    availableFields: string[];
    fieldValues: Record<string, number | null>;
    reportingDelayHours: number;
    attributionParams: {
        attributionWindow: number;
        hasAllConversions: boolean;
        conversionLag: number;
    };
    apiStats: {
        successCount: number;
        totalCount: number;
    };
    dailyValues: number[];
}): DataHealthResult {
    const scores: HealthScores = {
        freshness: calculateFreshnessScore(params.hoursSinceUpdate),
        completeness: calculateCompletenessScore(params.availableFields, params.fieldValues),
        lag: calculateLagScore(params.reportingDelayHours),
        attribution: calculateAttributionScore(params.attributionParams),
        apiStability: calculateApiStabilityScore(params.apiStats.successCount, params.apiStats.totalCount),
        consistency: calculateConsistencyScore(params.dailyValues)
    };

    const overallScore = calculateOverallHealthScore(scores);
    const status = getHealthStatus(overallScore);
    const issues = detectHealthIssues(scores);

    // Calculate confidence modifier based on health
    let confidenceModifier = 1.0;
    if (status === 'unhealthy') confidenceModifier = 0.5;
    else if (status === 'degraded') confidenceModifier = 0.75;

    // Generate recommendations
    const recommendations: string[] = [];
    if (scores.freshness < 60) {
        recommendations.push('Sync data more frequently to improve freshness');
    }
    if (scores.completeness < 70) {
        recommendations.push('Ensure all required metrics are being tracked');
    }
    if (scores.apiStability < 80) {
        recommendations.push('Check API connection and error logs');
    }

    return {
        scores,
        overallScore,
        status,
        issues,
        confidenceModifier,
        recommendations
    };
}
