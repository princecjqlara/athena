/**
 * Confidence Scoring Module
 * 
 * Calculates confidence scores for AI recommendations based on:
 * - Data volume
 * - Data variance  
 * - Data freshness
 * - Anomaly noise
 * - Historical accuracy
 * - Sample size adequacy
 */

export interface ConfidenceFactors {
    dataVolume: number;        // 0-1: More data = higher confidence
    dataVariance: number;      // 0-1: Lower variance = higher confidence
    dataFreshness: number;     // 0-1: Recent data = higher confidence
    anomalyNoise: number;      // 0-1: Fewer anomalies = higher confidence
    historicalAccuracy: number; // 0-1: Past similar recommendations' accuracy
    sampleSize: number;        // 0-1: Adequate sample = higher confidence
}

export interface ConfidenceResult {
    score: number;             // 0-1 overall confidence
    factors: ConfidenceFactors;
    warnings: string[];
    recommendation_modifier: number; // Multiplier for priority scoring
}

// Default weights for confidence calculation
const CONFIDENCE_WEIGHTS = {
    dataVolume: 0.20,
    dataVariance: 0.15,
    dataFreshness: 0.15,
    anomalyNoise: 0.10,
    historicalAccuracy: 0.25,
    sampleSize: 0.15
};

// Thresholds for factor calculations
const THRESHOLDS = {
    minImpressionsHigh: 10000,
    minImpressionsLow: 1000,
    maxVarianceCoeff: 0.5,     // Coefficient of variation threshold
    freshHours: 4,
    staleHours: 48,
    minSampleConversions: 30,
    minSampleClicks: 100,
    anomalyZScoreThreshold: 2.5
};

/**
 * Calculate confidence score from individual factors
 */
export function calculateConfidence(factors: ConfidenceFactors): number {
    const score = Object.entries(CONFIDENCE_WEIGHTS).reduce((sum, [key, weight]) => {
        const factorValue = factors[key as keyof ConfidenceFactors] ?? 0;
        return sum + (factorValue * weight);
    }, 0);

    return Math.max(0, Math.min(1, score));
}

/**
 * Calculate data volume factor based on impressions
 */
export function calculateDataVolumeFactor(impressions: number): number {
    if (impressions >= THRESHOLDS.minImpressionsHigh) return 1.0;
    if (impressions <= THRESHOLDS.minImpressionsLow) return 0.3;

    // Linear interpolation between low and high
    const range = THRESHOLDS.minImpressionsHigh - THRESHOLDS.minImpressionsLow;
    const position = impressions - THRESHOLDS.minImpressionsLow;
    return 0.3 + (0.7 * (position / range));
}

/**
 * Calculate variance factor based on coefficient of variation
 */
export function calculateVarianceFactor(values: number[]): number {
    if (values.length < 3) return 0.5; // Not enough data points

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0.5;

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = stdDev / mean;

    // Lower variance = higher confidence
    if (coeffOfVariation <= 0.1) return 1.0;
    if (coeffOfVariation >= THRESHOLDS.maxVarianceCoeff) return 0.3;

    return 1.0 - ((coeffOfVariation - 0.1) / (THRESHOLDS.maxVarianceCoeff - 0.1)) * 0.7;
}

/**
 * Calculate freshness factor based on hours since last data update
 */
export function calculateFreshnessFactor(hoursSinceUpdate: number): number {
    if (hoursSinceUpdate <= THRESHOLDS.freshHours) return 1.0;
    if (hoursSinceUpdate >= THRESHOLDS.staleHours) return 0.2;

    // Exponential decay
    const decay = Math.exp(-0.05 * (hoursSinceUpdate - THRESHOLDS.freshHours));
    return 0.2 + (0.8 * decay);
}

/**
 * Calculate anomaly noise factor based on recent anomalies
 */
export function calculateAnomalyNoiseFactor(
    recentAnomalies: { date: string; zscore: number }[]
): number {
    if (recentAnomalies.length === 0) return 1.0;

    // Count significant anomalies
    const significantAnomalies = recentAnomalies.filter(
        a => Math.abs(a.zscore) > THRESHOLDS.anomalyZScoreThreshold
    );

    if (significantAnomalies.length === 0) return 0.95;
    if (significantAnomalies.length >= 5) return 0.3;

    return 1.0 - (significantAnomalies.length * 0.14);
}

/**
 * Calculate historical accuracy factor based on past similar recommendations
 */
export function calculateHistoricalAccuracyFactor(
    pastAccuracies: { accuracy: number; weight: number }[]
): number {
    if (pastAccuracies.length === 0) return 0.5; // Unknown, use neutral

    // Weighted average of past accuracies
    const totalWeight = pastAccuracies.reduce((sum, a) => sum + a.weight, 0);
    const weightedSum = pastAccuracies.reduce((sum, a) => sum + (a.accuracy * a.weight), 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Calculate sample size factor based on conversions/events
 */
export function calculateSampleSizeFactor(
    conversions: number,
    clicks: number,
    targetMetric: 'conversions' | 'ctr' | 'engagement' = 'conversions'
): number {
    const threshold = targetMetric === 'conversions'
        ? THRESHOLDS.minSampleConversions
        : THRESHOLDS.minSampleClicks;

    const sample = targetMetric === 'conversions' ? conversions : clicks;

    if (sample >= threshold) return 1.0;
    if (sample <= 5) return 0.2;

    return 0.2 + (0.8 * (sample / threshold));
}

/**
 * Full confidence calculation with all factors
 */
export function calculateFullConfidence(params: {
    impressions: number;
    dailyMetricValues: number[];      // Array of daily metric values for variance
    hoursSinceUpdate: number;
    recentAnomalies: { date: string; zscore: number }[];
    pastAccuracies: { accuracy: number; weight: number }[];
    conversions: number;
    clicks: number;
    targetMetric?: 'conversions' | 'ctr' | 'engagement';
}): ConfidenceResult {
    const warnings: string[] = [];

    const factors: ConfidenceFactors = {
        dataVolume: calculateDataVolumeFactor(params.impressions),
        dataVariance: calculateVarianceFactor(params.dailyMetricValues),
        dataFreshness: calculateFreshnessFactor(params.hoursSinceUpdate),
        anomalyNoise: calculateAnomalyNoiseFactor(params.recentAnomalies),
        historicalAccuracy: calculateHistoricalAccuracyFactor(params.pastAccuracies),
        sampleSize: calculateSampleSizeFactor(
            params.conversions,
            params.clicks,
            params.targetMetric || 'conversions'
        )
    };

    // Add warnings for low factors
    if (factors.dataVolume < 0.5) {
        warnings.push(`Low data volume: ${params.impressions.toLocaleString()} impressions`);
    }
    if (factors.dataFreshness < 0.5) {
        warnings.push(`Stale data: ${params.hoursSinceUpdate} hours old`);
    }
    if (factors.sampleSize < 0.5) {
        warnings.push(`Insufficient sample size for statistical significance`);
    }
    if (factors.anomalyNoise < 0.7) {
        warnings.push(`Recent anomalies detected in data`);
    }
    if (factors.historicalAccuracy < 0.5) {
        warnings.push(`Similar recommendations have had mixed accuracy`);
    }

    const score = calculateConfidence(factors);

    // Calculate recommendation modifier
    let modifier = 1.0;
    if (score < 0.3) modifier = 0.5;
    else if (score < 0.5) modifier = 0.7;
    else if (score < 0.7) modifier = 0.9;

    return {
        score,
        factors,
        warnings,
        recommendation_modifier: modifier
    };
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 0.85) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
}

/**
 * Calculate context hash for similarity matching
 */
export function calculateContextHash(context: {
    recommendationType: string;
    targetMetric: string;
    campaignObjective?: string;
    budgetTier?: string;
    industryCategory?: string;
}): string {
    const normalizedContext = Object.entries(context)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|');

    // Simple hash for similarity grouping
    let hash = 0;
    for (let i = 0; i < normalizedContext.length; i++) {
        const char = normalizedContext.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}
