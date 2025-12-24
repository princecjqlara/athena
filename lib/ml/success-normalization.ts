// Success Normalization System
// Replaces raw metrics with Z-scores normalized to account baseline

import { ExtractedResultsData, Platform } from '@/types';

// ============================================
// STORAGE
// ============================================

const BASELINE_KEY = 'ml_account_baseline';
const PRIORS_VERSION = '1.0';

// ============================================
// PLATFORM PRIORS (Cold-Start Baselines)
// ============================================

export interface PlatformPrior {
    platform: Platform;
    avgCTR: number;
    avgCVR: number;
    avgROAS: number;
    avgCPC: number;
    sampleSize: number; // Industry average sample size
}

// Industry-average priors for cold-start scenarios
// Sources: Meta Business Suite averages, industry benchmarks
export const PLATFORM_PRIORS: Record<Platform, PlatformPrior> = {
    tiktok: {
        platform: 'tiktok',
        avgCTR: 0.03,      // 3% CTR
        avgCVR: 0.02,      // 2% CVR
        avgROAS: 1.5,
        avgCPC: 0.50,
        sampleSize: 10000,
    },
    instagram: {
        platform: 'instagram',
        avgCTR: 0.025,     // 2.5% CTR
        avgCVR: 0.018,     // 1.8% CVR
        avgROAS: 1.3,
        avgCPC: 0.70,
        sampleSize: 10000,
    },
    facebook: {
        platform: 'facebook',
        avgCTR: 0.02,      // 2% CTR
        avgCVR: 0.015,     // 1.5% CVR
        avgROAS: 1.2,
        avgCPC: 0.80,
        sampleSize: 10000,
    },
    youtube: {
        platform: 'youtube',
        avgCTR: 0.04,      // 4% CTR (higher for video)
        avgCVR: 0.012,     // 1.2% CVR
        avgROAS: 1.1,
        avgCPC: 1.00,
        sampleSize: 10000,
    },
    snapchat: {
        platform: 'snapchat',
        avgCTR: 0.015,     // 1.5% CTR
        avgCVR: 0.01,      // 1% CVR
        avgROAS: 0.9,
        avgCPC: 0.40,
        sampleSize: 5000,
    },
    pinterest: {
        platform: 'pinterest',
        avgCTR: 0.02,      // 2% CTR
        avgCVR: 0.015,     // 1.5% CVR
        avgROAS: 1.0,
        avgCPC: 0.60,
        sampleSize: 5000,
    },
    twitter: {
        platform: 'twitter',
        avgCTR: 0.015,     // 1.5% CTR
        avgCVR: 0.008,     // 0.8% CVR
        avgROAS: 0.8,
        avgCPC: 0.90,
        sampleSize: 5000,
    },
    linkedin: {
        platform: 'linkedin',
        avgCTR: 0.01,      // 1% CTR (B2B)
        avgCVR: 0.025,     // 2.5% CVR (higher value conversions)
        avgROAS: 2.0,      // Higher B2B value
        avgCPC: 3.00,
        sampleSize: 3000,
    },
    other: {
        platform: 'other',
        avgCTR: 0.02,
        avgCVR: 0.015,
        avgROAS: 1.0,
        avgCPC: 0.75,
        sampleSize: 1000,
    },
};

// ============================================
// ACCOUNT BASELINE
// ============================================

export interface AccountBaseline {
    // Aggregated metrics from user's account
    avgCTR: number;
    avgCVR: number;
    avgROAS: number;
    avgCPC: number;
    avgSuccessRating: number;

    // Standard deviations for Z-score calculation
    stdCTR: number;
    stdCVR: number;
    stdROAS: number;
    stdCPC: number;
    stdSuccessRating: number;

    // Sample size
    sampleSize: number;

    // Platform-specific baselines (optional)
    platformBaselines?: Partial<Record<Platform, Partial<AccountBaseline>>>;

    // Metadata
    lastUpdated: string;
    version: string;
}

// Default baseline for cold-start (uses platform priors)
const DEFAULT_BASELINE: AccountBaseline = {
    avgCTR: 0.025,
    avgCVR: 0.015,
    avgROAS: 1.2,
    avgCPC: 0.70,
    avgSuccessRating: 5.0,
    stdCTR: 0.015,
    stdCVR: 0.01,
    stdROAS: 0.8,
    stdCPC: 0.40,
    stdSuccessRating: 2.0,
    sampleSize: 0,
    lastUpdated: new Date().toISOString(),
    version: PRIORS_VERSION,
};

// ============================================
// BASELINE MANAGEMENT
// ============================================

/**
 * Get the current account baseline
 */
export function getAccountBaseline(): AccountBaseline {
    if (typeof window === 'undefined') return DEFAULT_BASELINE;

    const stored = localStorage.getItem(BASELINE_KEY);
    if (!stored) return DEFAULT_BASELINE;

    try {
        const baseline = JSON.parse(stored) as AccountBaseline;
        return baseline;
    } catch {
        return DEFAULT_BASELINE;
    }
}

/**
 * Save account baseline
 */
export function saveAccountBaseline(baseline: AccountBaseline): void {
    if (typeof window === 'undefined') return;

    baseline.lastUpdated = new Date().toISOString();
    baseline.version = PRIORS_VERSION;
    localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
}

/**
 * Calculate baseline from historical results
 */
export function calculateAccountBaseline(
    allResults: ExtractedResultsData[]
): AccountBaseline {
    if (allResults.length === 0) return DEFAULT_BASELINE;

    // Extract values for each metric
    const ctrs = allResults.map(r => r.ctr).filter(v => v !== undefined && v > 0);
    const cvrs = allResults.map(r => r.conversionRate).filter((v): v is number => v !== undefined && v > 0);
    const roass = allResults.map(r => r.roas).filter((v): v is number => v !== undefined && v > 0);
    const cpcs = allResults.map(r => {
        if (r.adSpend && r.clicks && r.clicks > 0) {
            return r.adSpend / r.clicks;
        }
        return undefined;
    }).filter((v): v is number => v !== undefined && v > 0);
    const ratings = allResults.map(r => r.successScore).filter(v => v !== undefined);

    // Calculate means
    const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // Calculate standard deviations
    const std = (arr: number[], avg: number) => {
        if (arr.length < 2) return avg * 0.5; // Default to 50% of mean if not enough data
        const variance = arr.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (arr.length - 1);
        return Math.sqrt(variance);
    };

    const avgCTR = mean(ctrs);
    const avgCVR = mean(cvrs);
    const avgROAS = mean(roass);
    const avgCPC = mean(cpcs);
    const avgSuccessRating = mean(ratings);

    const baseline: AccountBaseline = {
        avgCTR: avgCTR || DEFAULT_BASELINE.avgCTR,
        avgCVR: avgCVR || DEFAULT_BASELINE.avgCVR,
        avgROAS: avgROAS || DEFAULT_BASELINE.avgROAS,
        avgCPC: avgCPC || DEFAULT_BASELINE.avgCPC,
        avgSuccessRating: avgSuccessRating || DEFAULT_BASELINE.avgSuccessRating,
        stdCTR: std(ctrs, avgCTR) || DEFAULT_BASELINE.stdCTR,
        stdCVR: std(cvrs, avgCVR) || DEFAULT_BASELINE.stdCVR,
        stdROAS: std(roass, avgROAS) || DEFAULT_BASELINE.stdROAS,
        stdCPC: std(cpcs, avgCPC) || DEFAULT_BASELINE.stdCPC,
        stdSuccessRating: std(ratings, avgSuccessRating) || DEFAULT_BASELINE.stdSuccessRating,
        sampleSize: allResults.length,
        lastUpdated: new Date().toISOString(),
        version: PRIORS_VERSION,
    };

    return baseline;
}

// ============================================
// Z-SCORE CALCULATION
// ============================================

/**
 * Calculate Z-score for a value relative to baseline
 */
export function calculateZScore(
    value: number,
    mean: number,
    stdDev: number
): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

/**
 * Convert Z-score to percentile (0-100)
 */
export function zScoreToPercentile(zScore: number): number {
    // Using error function approximation
    const erf = (x: number) => {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);

        const t = 1 / (1 + p * x);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    };

    const percentile = 50 * (1 + erf(zScore / Math.sqrt(2)));
    return Math.max(0, Math.min(100, percentile));
}

// ============================================
// NORMALIZED SUCCESS SCORE
// ============================================

export interface NormalizedScore {
    rawScore: number;           // Original 0-100 score
    normalizedScore: number;    // Z-score adjusted (0-100)

    // Component scores
    ctrZScore: number;
    cvrZScore: number;
    roasZScore: number;
    ratingZScore: number;

    // Baseline info
    accountBaseline: {
        avgCTR: number;
        avgCVR: number;
        avgROAS: number;
    };
    platformDelta: number;     // How much above/below platform average

    // Confidence
    confidenceLevel: number;   // Based on sample size
    isUsingPriors: boolean;    // True if using platform priors (cold start)
}

/**
 * Calculate normalized success score
 */
export function normalizeSuccessScore(
    results: ExtractedResultsData,
    baseline?: AccountBaseline
): NormalizedScore {
    const actualBaseline = baseline || getAccountBaseline();
    const platformPrior = PLATFORM_PRIORS[results.platform] || PLATFORM_PRIORS.other;

    // Determine if we're using priors (cold start)
    const isUsingPriors = actualBaseline.sampleSize < 5;
    const effectiveBaseline = isUsingPriors
        ? {
            ...actualBaseline,
            avgCTR: platformPrior.avgCTR,
            avgCVR: platformPrior.avgCVR,
            avgROAS: platformPrior.avgROAS,
            stdCTR: platformPrior.avgCTR * 0.5,
            stdCVR: platformPrior.avgCVR * 0.5,
            stdROAS: platformPrior.avgROAS * 0.5,
        }
        : actualBaseline;

    // Calculate Z-scores for each metric
    const ctrZScore = calculateZScore(
        results.ctr,
        effectiveBaseline.avgCTR,
        effectiveBaseline.stdCTR
    );

    const cvrZScore = results.conversionRate !== undefined
        ? calculateZScore(results.conversionRate, effectiveBaseline.avgCVR, effectiveBaseline.stdCVR)
        : 0;

    const roasZScore = results.roas !== undefined
        ? calculateZScore(results.roas, effectiveBaseline.avgROAS, effectiveBaseline.stdROAS)
        : 0;

    const ratingZScore = calculateZScore(
        results.successScore / 10, // Convert 0-100 to 0-10 scale
        effectiveBaseline.avgSuccessRating / 10,
        effectiveBaseline.stdSuccessRating / 10
    );

    // Weighted combination
    const weights = {
        ctr: 0.25,
        cvr: 0.30,
        roas: 0.25,
        rating: 0.20,
    };

    // Handle missing metrics
    let totalWeight = weights.ctr + weights.rating;
    let combinedZScore = ctrZScore * weights.ctr + ratingZScore * weights.rating;

    if (results.conversionRate !== undefined) {
        combinedZScore += cvrZScore * weights.cvr;
        totalWeight += weights.cvr;
    }

    if (results.roas !== undefined) {
        combinedZScore += roasZScore * weights.roas;
        totalWeight += weights.roas;
    }

    // Normalize to account for missing metrics
    combinedZScore = combinedZScore / totalWeight;

    // Convert Z-score to 0-100 scale
    const normalizedScore = zScoreToPercentile(combinedZScore);

    // Calculate platform delta
    const platformDelta = results.ctr - platformPrior.avgCTR;

    // Calculate confidence based on sample size
    const confidenceLevel = Math.min(100, Math.round(
        (actualBaseline.sampleSize / 50) * 100 // Full confidence at 50 samples
    ));

    return {
        rawScore: results.successScore,
        normalizedScore: Math.round(normalizedScore),
        ctrZScore,
        cvrZScore,
        roasZScore,
        ratingZScore,
        accountBaseline: {
            avgCTR: effectiveBaseline.avgCTR,
            avgCVR: effectiveBaseline.avgCVR,
            avgROAS: effectiveBaseline.avgROAS,
        },
        platformDelta,
        confidenceLevel,
        isUsingPriors,
    };
}

/**
 * Get platform priors for a given platform
 */
export function getPlatformPriors(platform: Platform): PlatformPrior {
    return PLATFORM_PRIORS[platform] || PLATFORM_PRIORS.other;
}

/**
 * Update baseline with new results
 */
export function updateBaselineWithResults(
    newResults: ExtractedResultsData
): AccountBaseline {
    const currentBaseline = getAccountBaseline();

    // Incremental update (running average)
    const n = currentBaseline.sampleSize;
    const newN = n + 1;

    // Update means incrementally
    const updateMean = (oldMean: number, newValue: number | undefined) => {
        if (newValue === undefined) return oldMean;
        return oldMean + (newValue - oldMean) / newN;
    };

    const newBaseline: AccountBaseline = {
        ...currentBaseline,
        avgCTR: updateMean(currentBaseline.avgCTR, newResults.ctr),
        avgCVR: updateMean(currentBaseline.avgCVR, newResults.conversionRate),
        avgROAS: updateMean(currentBaseline.avgROAS, newResults.roas),
        avgSuccessRating: updateMean(currentBaseline.avgSuccessRating, newResults.successScore),
        sampleSize: newN,
        lastUpdated: new Date().toISOString(),
    };

    saveAccountBaseline(newBaseline);
    return newBaseline;
}

/**
 * Get baseline stats for display
 */
export function getBaselineStats(): {
    isReady: boolean;
    sampleSize: number;
    confidenceLevel: number;
    usingPriors: boolean;
    readinessMessage: string;
} {
    const baseline = getAccountBaseline();
    const isReady = baseline.sampleSize >= 5;
    const confidenceLevel = Math.min(100, Math.round((baseline.sampleSize / 50) * 100));
    const usingPriors = baseline.sampleSize < 5;

    let readinessMessage: string;
    if (baseline.sampleSize === 0) {
        readinessMessage = 'No historical data. Using platform averages for normalization.';
    } else if (baseline.sampleSize < 5) {
        readinessMessage = `${5 - baseline.sampleSize} more ads needed for reliable baselines.`;
    } else if (baseline.sampleSize < 20) {
        readinessMessage = 'Baseline active. Accuracy improves with more data.';
    } else if (baseline.sampleSize < 50) {
        readinessMessage = 'Good baseline. Predictions are reliable.';
    } else {
        readinessMessage = 'Excellent baseline. High prediction confidence.';
    }

    return {
        isReady,
        sampleSize: baseline.sampleSize,
        confidenceLevel,
        usingPriors,
        readinessMessage,
    };
}
