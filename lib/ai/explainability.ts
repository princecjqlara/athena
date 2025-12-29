/**
 * Explainability Module
 * 
 * Generates evidence, assumptions, thresholds, and invalidation conditions
 * for every AI recommendation to make them transparent and trustworthy.
 */

export interface DataPoint {
    metric: string;
    value: number;
    benchmark: number;
    comparison: 'above' | 'below' | 'at';
    percentile?: number;
    trend?: 'up' | 'down' | 'stable';
    significance?: 'high' | 'medium' | 'low';
}

export interface Pattern {
    description: string;
    confidence: number;
    timeRange: string;
    occurrences: number;
    relatedMetrics: string[];
}

export interface SimilarCase {
    entityId: string;
    entityName: string;
    similarity: number;
    outcome: 'success' | 'failure' | 'neutral';
    keyDifferences: string[];
}

export interface Threshold {
    value: number;
    type: 'min' | 'max' | 'target' | 'range';
    source: 'industry_benchmark' | 'historical_avg' | 'user_defined' | 'statistical';
    confidence: number;
}

export interface RecommendationExplanation {
    // Evidence - Why we're recommending this
    evidence: {
        dataPoints: DataPoint[];
        patterns: Pattern[];
        similarCases: SimilarCase[];
        keyInsights: string[];
    };

    // Assumptions - What we're assuming to be true
    assumptions: string[];

    // Thresholds - The decision boundaries used
    thresholds: Record<string, Threshold>;

    // Invalidation - When this recommendation becomes invalid
    invalidationConditions: string[];

    // Plain text explanation
    summary: string;
    reasoning: string;
}

/**
 * Generate data point evidence from metrics
 */
export function generateDataPointEvidence(params: {
    metric: string;
    currentValue: number;
    historicalAvg: number;
    industryBenchmark?: number;
    recentTrend?: 'up' | 'down' | 'stable';
}): DataPoint {
    const benchmark = params.industryBenchmark || params.historicalAvg;
    const percentDiff = ((params.currentValue - benchmark) / benchmark) * 100;

    let comparison: 'above' | 'below' | 'at';
    if (Math.abs(percentDiff) < 5) {
        comparison = 'at';
    } else if (percentDiff > 0) {
        comparison = 'above';
    } else {
        comparison = 'below';
    }

    // Determine significance based on deviation
    let significance: 'high' | 'medium' | 'low';
    if (Math.abs(percentDiff) > 25) {
        significance = 'high';
    } else if (Math.abs(percentDiff) > 10) {
        significance = 'medium';
    } else {
        significance = 'low';
    }

    return {
        metric: params.metric,
        value: params.currentValue,
        benchmark,
        comparison,
        trend: params.recentTrend,
        significance
    };
}

/**
 * Generate standard assumptions based on recommendation type
 */
export function generateAssumptions(params: {
    recommendationType: string;
    targetMetric: string;
    attributionWindow: number;
    isLearningPhase: boolean;
}): string[] {
    const assumptions: string[] = [
        `Attribution window is ${params.attributionWindow} days`,
        'No major external events (holidays, news) affecting performance',
        'Audience targeting remains unchanged',
        'Creative content is not experiencing fatigue'
    ];

    if (params.isLearningPhase) {
        assumptions.push('Campaign is in learning phase - results may be volatile');
    }

    switch (params.recommendationType) {
        case 'budget':
            assumptions.push('Increasing budget will maintain similar CPM');
            assumptions.push('Audience pool is not saturated');
            break;
        case 'bid':
            assumptions.push('Auction dynamics remain stable');
            assumptions.push('Competition level stays consistent');
            break;
        case 'creative':
            assumptions.push('Creative performance patterns are consistent');
            assumptions.push('Audience preferences have not shifted');
            break;
        case 'audience':
            assumptions.push('Lookalike quality remains stable');
            assumptions.push('Targeting expansion will find similar users');
            break;
    }

    return assumptions;
}

/**
 * Generate invalidation conditions
 */
export function generateInvalidationConditions(params: {
    recommendationType: string;
    targetMetric: string;
    currentValue: number;
    expectedChange: number;
    confidence: number;
}): string[] {
    const conditions: string[] = [];

    // Always include these
    conditions.push('If learning phase resets');
    conditions.push('If there are significant algorithm changes');

    // Metric-specific conditions
    switch (params.targetMetric) {
        case 'roas':
            conditions.push(`If ROAS drops below ${Math.max(0.5, params.currentValue * 0.5).toFixed(2)}`);
            break;
        case 'cpa':
            conditions.push(`If CPA increases above ${(params.currentValue * 1.5).toFixed(2)}`);
            break;
        case 'ctr':
            conditions.push(`If CTR drops below ${(params.currentValue * 0.7).toFixed(4)}`);
            break;
    }

    // Type-specific conditions
    switch (params.recommendationType) {
        case 'budget':
            conditions.push('If CPM increases by more than 20%');
            conditions.push('If frequency exceeds 3.0');
            break;
        case 'creative':
            conditions.push('If engagement rate drops by 30%');
            conditions.push('If video completion rate significantly decreases');
            break;
        case 'audience':
            conditions.push('If audience overlap exceeds 50%');
            break;
    }

    // Confidence-based conditions
    if (params.confidence < 0.6) {
        conditions.push('Low confidence - validate results after 3 days');
    }

    return conditions;
}

/**
 * Generate threshold explanations
 */
export function generateThresholds(params: {
    targetMetric: string;
    currentValue: number;
    historicalAvg: number;
    industryBenchmark?: number;
    userDefinedTarget?: number;
}): Record<string, Threshold> {
    const thresholds: Record<string, Threshold> = {};

    // Current value as baseline
    thresholds.baseline = {
        value: params.currentValue,
        type: 'target',
        source: 'historical_avg',
        confidence: 0.9
    };

    // Historical average
    thresholds.historical_avg = {
        value: params.historicalAvg,
        type: 'target',
        source: 'historical_avg',
        confidence: 0.85
    };

    // Industry benchmark if available
    if (params.industryBenchmark) {
        thresholds.industry = {
            value: params.industryBenchmark,
            type: 'target',
            source: 'industry_benchmark',
            confidence: 0.7
        };
    }

    // User defined if available
    if (params.userDefinedTarget) {
        thresholds.user_target = {
            value: params.userDefinedTarget,
            type: 'target',
            source: 'user_defined',
            confidence: 1.0
        };
    }

    // Minimum acceptable
    thresholds.minimum = {
        value: params.currentValue * 0.7,
        type: 'min',
        source: 'statistical',
        confidence: 0.8
    };

    return thresholds;
}

/**
 * Generate a plain text summary of the explanation
 */
export function generateExplanationSummary(params: {
    recommendationType: string;
    targetMetric: string;
    expectedImpact: number;
    confidence: number;
    keyFactors: string[];
}): string {
    const confidenceText = params.confidence >= 0.7 ? 'high' :
        params.confidence >= 0.5 ? 'medium' : 'low';

    const directionText = params.expectedImpact >= 0 ? 'improve' : 'decrease';
    const impactText = Math.abs(params.expectedImpact).toFixed(1);

    let summary = `This ${params.recommendationType} recommendation is expected to ${directionText} `;
    summary += `${params.targetMetric} by approximately ${impactText}% `;
    summary += `with ${confidenceText} confidence. `;

    if (params.keyFactors.length > 0) {
        summary += `Key factors: ${params.keyFactors.slice(0, 3).join(', ')}.`;
    }

    return summary;
}

/**
 * Generate full recommendation explanation
 */
export function generateFullExplanation(params: {
    recommendationType: string;
    targetMetric: string;
    currentMetrics: Record<string, number>;
    historicalMetrics: Record<string, number>;
    industryBenchmarks?: Record<string, number>;
    expectedImpact: number;
    confidence: number;
    patterns?: Pattern[];
    similarCases?: SimilarCase[];
    attributionWindow?: number;
    isLearningPhase?: boolean;
}): RecommendationExplanation {
    // Generate data points from metrics
    const dataPoints: DataPoint[] = [];
    for (const [metric, value] of Object.entries(params.currentMetrics)) {
        if (params.historicalMetrics[metric] !== undefined) {
            dataPoints.push(generateDataPointEvidence({
                metric,
                currentValue: value,
                historicalAvg: params.historicalMetrics[metric],
                industryBenchmark: params.industryBenchmarks?.[metric]
            }));
        }
    }

    // Generate key insights
    const keyInsights: string[] = [];
    const significantPoints = dataPoints.filter(d => d.significance === 'high');
    for (const point of significantPoints.slice(0, 3)) {
        const direction = point.comparison === 'above' ? 'above' : point.comparison === 'below' ? 'below' : 'at';
        keyInsights.push(`${point.metric} is ${direction} benchmark (${point.value.toFixed(2)} vs ${point.benchmark.toFixed(2)})`);
    }

    // Generate assumptions
    const assumptions = generateAssumptions({
        recommendationType: params.recommendationType,
        targetMetric: params.targetMetric,
        attributionWindow: params.attributionWindow || 7,
        isLearningPhase: params.isLearningPhase || false
    });

    // Generate thresholds
    const thresholds = generateThresholds({
        targetMetric: params.targetMetric,
        currentValue: params.currentMetrics[params.targetMetric] || 0,
        historicalAvg: params.historicalMetrics[params.targetMetric] || 0,
        industryBenchmark: params.industryBenchmarks?.[params.targetMetric]
    });

    // Generate invalidation conditions
    const invalidationConditions = generateInvalidationConditions({
        recommendationType: params.recommendationType,
        targetMetric: params.targetMetric,
        currentValue: params.currentMetrics[params.targetMetric] || 0,
        expectedChange: params.expectedImpact,
        confidence: params.confidence
    });

    // Generate summary
    const summary = generateExplanationSummary({
        recommendationType: params.recommendationType,
        targetMetric: params.targetMetric,
        expectedImpact: params.expectedImpact,
        confidence: params.confidence,
        keyFactors: keyInsights
    });

    return {
        evidence: {
            dataPoints,
            patterns: params.patterns || [],
            similarCases: params.similarCases || [],
            keyInsights
        },
        assumptions,
        thresholds,
        invalidationConditions,
        summary,
        reasoning: summary
    };
}
