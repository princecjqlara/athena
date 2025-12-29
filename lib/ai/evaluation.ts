/**
 * Recommendation Evaluation Engine
 * Before/after impact analysis with statistical significance
 */

export interface EvaluationResult {
    recommendation_id: string;
    before_start: string;
    before_end: string;
    after_start: string;
    after_end: string;
    before_metrics: MetricSet;
    after_metrics: MetricSet;
    lift_pct: number;
    p_value: number;
    is_significant: boolean;
    sample_size_before: number;
    sample_size_after: number;
    outcome: 'positive' | 'negative' | 'neutral' | 'insufficient_data';
    notes: string;
}

interface MetricSet {
    spend: number;
    conversions: number;
    cpa: number;
    roas: number;
    ctr: number;
    cvr: number;
    impressions: number;
    clicks: number;
}

/**
 * Calculate simple p-value using normal approximation
 * For comparing two proportions or means
 */
function calculatePValue(
    before: number,
    after: number,
    sampleSizeBefore: number,
    sampleSizeAfter: number
): number {
    if (sampleSizeBefore < 10 || sampleSizeAfter < 10) {
        return 1; // Insufficient data
    }

    // Pooled estimate
    const pooled = (before * sampleSizeBefore + after * sampleSizeAfter) /
        (sampleSizeBefore + sampleSizeAfter);

    if (pooled === 0) return 1;

    // Standard error
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / sampleSizeBefore + 1 / sampleSizeAfter));

    if (se === 0) return 1;

    // Z-score
    const z = Math.abs(after - before) / se;

    // Approximate p-value from z-score (two-tailed)
    const pValue = 2 * (1 - normalCDF(z));

    return Math.min(1, Math.max(0, pValue));
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

/**
 * Evaluate a recommendation by comparing before/after metrics
 */
export function evaluateRecommendation(
    recommendationId: string,
    primaryMetric: string,
    beforeMetrics: MetricSet,
    afterMetrics: MetricSet,
    beforePeriod: { start: string; end: string },
    afterPeriod: { start: string; end: string }
): EvaluationResult {
    // Calculate lift on primary metric
    const beforeValue = beforeMetrics[primaryMetric as keyof MetricSet] as number;
    const afterValue = afterMetrics[primaryMetric as keyof MetricSet] as number;

    const liftPct = beforeValue !== 0
        ? ((afterValue - beforeValue) / beforeValue) * 100
        : 0;

    // Calculate p-value
    const pValue = calculatePValue(
        beforeValue,
        afterValue,
        beforeMetrics.impressions,
        afterMetrics.impressions
    );

    const isSignificant = pValue < 0.05;

    // Determine outcome
    let outcome: EvaluationResult['outcome'];
    let notes = '';

    if (beforeMetrics.impressions < 100 || afterMetrics.impressions < 100) {
        outcome = 'insufficient_data';
        notes = 'Not enough data to determine impact';
    } else if (!isSignificant) {
        outcome = 'neutral';
        notes = `Change not statistically significant (p=${pValue.toFixed(3)})`;
    } else if (liftPct > 0) {
        // For CPA, lower is better
        if (primaryMetric === 'cpa') {
            outcome = liftPct < 0 ? 'positive' : 'negative';
        } else {
            outcome = liftPct > 0 ? 'positive' : 'negative';
        }
        notes = `${primaryMetric} changed by ${liftPct > 0 ? '+' : ''}${liftPct.toFixed(1)}% (p=${pValue.toFixed(3)})`;
    } else {
        // For CPA, decrease is positive
        if (primaryMetric === 'cpa') {
            outcome = 'positive';
        } else {
            outcome = 'negative';
        }
        notes = `${primaryMetric} changed by ${liftPct.toFixed(1)}% (p=${pValue.toFixed(3)})`;
    }

    return {
        recommendation_id: recommendationId,
        before_start: beforePeriod.start,
        before_end: beforePeriod.end,
        after_start: afterPeriod.start,
        after_end: afterPeriod.end,
        before_metrics: beforeMetrics,
        after_metrics: afterMetrics,
        lift_pct: liftPct,
        p_value: pValue,
        is_significant: isSignificant,
        sample_size_before: beforeMetrics.impressions,
        sample_size_after: afterMetrics.impressions,
        outcome,
        notes
    };
}

/**
 * Get metrics for a date range (mock implementation)
 */
export async function getMetricsForPeriod(
    entityId: string,
    entityType: string,
    startDate: string,
    endDate: string
): Promise<MetricSet | null> {
    try {
        // In production, query time-series data from database
        const ads = JSON.parse(localStorage?.getItem('ads') || '[]');
        const ad = ads.find((a: { id: string }) => a.id === entityId);

        if (!ad) return null;

        // Return current metrics (mock - would aggregate over date range)
        return {
            spend: ad.spend || 0,
            conversions: ad.conversions || 0,
            cpa: ad.cpa || 0,
            roas: ad.roas || 0,
            ctr: ad.ctr || 0,
            cvr: ad.cvr || 0,
            impressions: ad.impressions || 0,
            clicks: ad.clicks || 0
        };
    } catch (error) {
        console.error('Error fetching metrics:', error);
        return null;
    }
}

/**
 * Run evaluation for a specific recommendation
 */
export async function runEvaluation(
    recommendationId: string,
    entityId: string,
    entityType: string,
    appliedAt: string,
    primaryMetric: string = 'roas'
): Promise<EvaluationResult | null> {
    const appliedDate = new Date(appliedAt);

    // Define windows: 7 days before and 7 days after
    const beforeEnd = new Date(appliedDate.getTime() - 1000); // 1 second before
    const beforeStart = new Date(beforeEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const afterStart = appliedDate;
    const afterEnd = new Date(afterStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Check if enough time has passed
    if (afterEnd > new Date()) {
        console.log('Not enough time has passed for evaluation');
        return null;
    }

    // Get metrics for both periods
    const beforeMetrics = await getMetricsForPeriod(
        entityId,
        entityType,
        beforeStart.toISOString(),
        beforeEnd.toISOString()
    );

    const afterMetrics = await getMetricsForPeriod(
        entityId,
        entityType,
        afterStart.toISOString(),
        afterEnd.toISOString()
    );

    if (!beforeMetrics || !afterMetrics) {
        return null;
    }

    return evaluateRecommendation(
        recommendationId,
        primaryMetric,
        beforeMetrics,
        afterMetrics,
        { start: beforeStart.toISOString(), end: beforeEnd.toISOString() },
        { start: afterStart.toISOString(), end: afterEnd.toISOString() }
    );
}

export default {
    evaluateRecommendation,
    getMetricsForPeriod,
    runEvaluation
};
