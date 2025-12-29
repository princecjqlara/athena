/**
 * Privacy-Safe Benchmarking Module
 * 
 * Provides anonymized industry benchmarks while preserving privacy:
 * - k-anonymity (min contributors per bucket)
 * - Differential privacy noise
 * - Aggregation only (no individual data exposed)
 */

export interface BenchmarkDimensions {
    industry?: string;
    region?: string;
    companySize?: 'small' | 'medium' | 'large' | 'enterprise';
    campaignType?: string;
    objective?: string;
    platform?: 'facebook' | 'instagram' | 'audience_network' | 'messenger';
}

export interface BenchmarkData {
    dimensions: BenchmarkDimensions;
    period: string;           // e.g., '2024-Q4', '2024-12'
    metric: string;
    values: {
        p10: number;
        p25: number;
        p50: number;           // Median
        p75: number;
        p90: number;
        mean: number;
        stdDev: number;
    };
    sampleSize: number;
    lastUpdated: string;
}

export interface BenchmarkComparison {
    metric: string;
    yourValue: number;
    percentile: number;
    industryMedian: number;
    industryMean: number;
    status: 'below_average' | 'average' | 'above_average' | 'top_performer';
    gap: number;             // Difference from median
    gapPercent: number;
}

export interface ContributionData {
    organizationId: string;
    period: string;
    dimensions: BenchmarkDimensions;
    metrics: Record<string, number>;
    contributedAt: string;
}

// Minimum contributors for k-anonymity
const MIN_CONTRIBUTORS = 5;

// Noise factor for differential privacy
const NOISE_FACTOR = 0.05;

/**
 * Add differential privacy noise to a value
 */
function addNoise(value: number, factor: number = NOISE_FACTOR): number {
    const noise = (Math.random() - 0.5) * 2 * value * factor;
    return Math.max(0, value + noise);
}

/**
 * Calculate percentiles from values
 */
function calculatePercentiles(values: number[]): {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    stdDev: number;
} {
    if (values.length === 0) {
        return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, mean: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const percentile = (p: number) => {
        const index = (p / 100) * (n - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
        p10: addNoise(percentile(10)),
        p25: addNoise(percentile(25)),
        p50: addNoise(percentile(50)),
        p75: addNoise(percentile(75)),
        p90: addNoise(percentile(90)),
        mean: addNoise(mean),
        stdDev: addNoise(stdDev)
    };
}

/**
 * Generate benchmark from contributions
 */
export function generateBenchmark(params: {
    contributions: ContributionData[];
    metric: string;
    dimensions: BenchmarkDimensions;
    period: string;
}): BenchmarkData | null {
    const { contributions, metric, dimensions, period } = params;

    // Filter contributions matching dimensions and period
    const matching = contributions.filter(c => {
        if (c.period !== period) return false;
        if (dimensions.industry && c.dimensions.industry !== dimensions.industry) return false;
        if (dimensions.region && c.dimensions.region !== dimensions.region) return false;
        if (dimensions.companySize && c.dimensions.companySize !== dimensions.companySize) return false;
        if (dimensions.campaignType && c.dimensions.campaignType !== dimensions.campaignType) return false;
        return true;
    });

    // k-anonymity check
    if (matching.length < MIN_CONTRIBUTORS) {
        return null; // Not enough contributors
    }

    // Extract metric values
    const values = matching
        .map(c => c.metrics[metric])
        .filter((v): v is number => v !== undefined && !isNaN(v));

    if (values.length < MIN_CONTRIBUTORS) {
        return null;
    }

    const percentiles = calculatePercentiles(values);

    return {
        dimensions,
        period,
        metric,
        values: percentiles,
        sampleSize: values.length,
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Compare your metrics to benchmarks
 */
export function compareToIndustry(params: {
    yourMetrics: Record<string, number>;
    benchmarks: BenchmarkData[];
}): BenchmarkComparison[] {
    const { yourMetrics, benchmarks } = params;
    const comparisons: BenchmarkComparison[] = [];

    for (const [metric, value] of Object.entries(yourMetrics)) {
        const benchmark = benchmarks.find(b => b.metric === metric);

        if (!benchmark) continue;

        // Calculate percentile
        let percentile: number;
        const { p10, p25, p50, p75, p90 } = benchmark.values;

        if (value <= p10) percentile = 10;
        else if (value <= p25) percentile = 10 + (value - p10) / (p25 - p10) * 15;
        else if (value <= p50) percentile = 25 + (value - p25) / (p50 - p25) * 25;
        else if (value <= p75) percentile = 50 + (value - p50) / (p75 - p50) * 25;
        else if (value <= p90) percentile = 75 + (value - p75) / (p90 - p75) * 15;
        else percentile = 90 + Math.min(10, (value - p90) / p90 * 10);

        // Determine status
        let status: BenchmarkComparison['status'];
        if (percentile >= 75) status = 'top_performer';
        else if (percentile >= 50) status = 'above_average';
        else if (percentile >= 25) status = 'average';
        else status = 'below_average';

        const gap = value - p50;
        const gapPercent = p50 > 0 ? (gap / p50) * 100 : 0;

        comparisons.push({
            metric,
            yourValue: value,
            percentile: Math.round(percentile),
            industryMedian: p50,
            industryMean: benchmark.values.mean,
            status,
            gap,
            gapPercent
        });
    }

    return comparisons;
}

/**
 * Anonymize organization contribution
 */
export function anonymizeContribution(params: {
    organizationId: string;
    period: string;
    dimensions: BenchmarkDimensions;
    rawMetrics: Record<string, number>;
}): ContributionData {
    const { organizationId, period, dimensions, rawMetrics } = params;

    // Generate anonymous metrics (add slight noise)
    const anonymizedMetrics: Record<string, number> = {};
    for (const [metric, value] of Object.entries(rawMetrics)) {
        anonymizedMetrics[metric] = addNoise(value, 0.02); // 2% noise
    }

    // Round values to reduce precision
    for (const metric of Object.keys(anonymizedMetrics)) {
        const value = anonymizedMetrics[metric];
        if (value > 1000) {
            anonymizedMetrics[metric] = Math.round(value / 10) * 10;
        } else if (value > 100) {
            anonymizedMetrics[metric] = Math.round(value);
        } else {
            anonymizedMetrics[metric] = Math.round(value * 100) / 100;
        }
    }

    return {
        organizationId: hashOrganization(organizationId),
        period,
        dimensions,
        metrics: anonymizedMetrics,
        contributedAt: new Date().toISOString()
    };
}

/**
 * Hash organization ID for privacy
 */
function hashOrganization(orgId: string): string {
    // Simple hash for demo - in production use crypto
    let hash = 0;
    for (let i = 0; i < orgId.length; i++) {
        const char = orgId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `org_${Math.abs(hash).toString(16)}`;
}

/**
 * Get available benchmark dimensions
 */
export function getAvailableDimensions(benchmarks: BenchmarkData[]): {
    industries: string[];
    regions: string[];
    companySizes: string[];
    campaignTypes: string[];
    periods: string[];
} {
    const industries = new Set<string>();
    const regions = new Set<string>();
    const companySizes = new Set<string>();
    const campaignTypes = new Set<string>();
    const periods = new Set<string>();

    for (const b of benchmarks) {
        if (b.dimensions.industry) industries.add(b.dimensions.industry);
        if (b.dimensions.region) regions.add(b.dimensions.region);
        if (b.dimensions.companySize) companySizes.add(b.dimensions.companySize);
        if (b.dimensions.campaignType) campaignTypes.add(b.dimensions.campaignType);
        periods.add(b.period);
    }

    return {
        industries: [...industries].sort(),
        regions: [...regions].sort(),
        companySizes: [...companySizes].sort(),
        campaignTypes: [...campaignTypes].sort(),
        periods: [...periods].sort()
    };
}

/**
 * Generate trend data from historical benchmarks
 */
export function getBenchmarkTrend(params: {
    benchmarks: BenchmarkData[];
    metric: string;
    dimensions: BenchmarkDimensions;
}): { period: string; median: number; mean: number }[] {
    const { benchmarks, metric, dimensions } = params;

    return benchmarks
        .filter(b => {
            if (b.metric !== metric) return false;
            if (dimensions.industry && b.dimensions.industry !== dimensions.industry) return false;
            if (dimensions.region && b.dimensions.region !== dimensions.region) return false;
            return true;
        })
        .map(b => ({
            period: b.period,
            median: b.values.p50,
            mean: b.values.mean
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
}
