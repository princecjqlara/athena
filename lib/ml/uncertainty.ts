/**
 * Uncertainty Quantification Module
 * 
 * Implements Monte Carlo Dropout for confidence interval estimation.
 * Runs multiple forward passes with dropout enabled to estimate
 * prediction uncertainty and generate confidence bounds.
 * 
 * @module lib/ml/uncertainty
 */

import * as tf from '@tensorflow/tfjs';

// ============================================
// TYPES
// ============================================

export interface UncertaintyResult {
    /** Mean prediction across all samples */
    mean: number;
    /** Standard deviation of predictions */
    stdDev: number;
    /** Prediction variance */
    variance: number;
    /** Lower bound of confidence interval */
    lowerBound: number;
    /** Upper bound of confidence interval */
    upperBound: number;
    /** Confidence interval width */
    intervalWidth: number;
    /** Confidence level (e.g., 0.95 for 95% CI) */
    confidenceLevel: number;
    /** Trust score (0-100): higher = more trustworthy */
    trustScore: number;
    /** Should question this prediction? */
    shouldQuestion: boolean;
    /** Reason for questioning if applicable */
    questionReason?: string;
    /** All sample predictions (for distribution visualization) */
    samples: number[];
}

export interface MCDropoutConfig {
    /** Number of forward passes (default: 30) */
    numSamples: number;
    /** Confidence level for interval (default: 0.95) */
    confidenceLevel: number;
    /** Dropout rate during inference (default: 0.2) */
    dropoutRate: number;
    /** Threshold for high uncertainty flag (default: 15) */
    highUncertaintyThreshold: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_MC_CONFIG: MCDropoutConfig = {
    numSamples: 30,
    confidenceLevel: 0.95,
    dropoutRate: 0.2,
    highUncertaintyThreshold: 15,
};

// ============================================
// Z-SCORES FOR CONFIDENCE INTERVALS
// ============================================

const Z_SCORES: Record<number, number> = {
    0.80: 1.28,
    0.85: 1.44,
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
};

function getZScore(confidenceLevel: number): number {
    return Z_SCORES[confidenceLevel] || 1.96; // Default to 95%
}

// ============================================
// MONTE CARLO DROPOUT IMPLEMENTATION
// ============================================

/**
 * Apply dropout to tensor during inference
 * TensorFlow.js doesn't have a built-in way to enable dropout during inference,
 * so we implement it manually.
 */
function applyDropout(tensor: tf.Tensor, rate: number): tf.Tensor {
    // Create a dropout mask
    const mask = tf.randomUniform(tensor.shape).greater(rate).cast('float32');
    // Scale remaining values to maintain expected sum
    const scale = 1 / (1 - rate);
    return tensor.mul(mask).mul(scale);
}

/**
 * Run Monte Carlo Dropout forward passes
 * Returns array of predictions from multiple stochastic forward passes
 */
export async function runMCDropout(
    model: tf.LayersModel,
    input: tf.Tensor,
    config: Partial<MCDropoutConfig> = {}
): Promise<number[]> {
    const cfg: MCDropoutConfig = { ...DEFAULT_MC_CONFIG, ...config };
    const predictions: number[] = [];

    for (let i = 0; i < cfg.numSamples; i++) {
        // Apply dropout to input features
        const droppedInput = applyDropout(input, cfg.dropoutRate);

        // Run prediction
        const prediction = model.predict(droppedInput) as tf.Tensor;
        const value = (await prediction.data())[0];
        predictions.push(value * 100); // Scale to 0-100

        // Cleanup
        droppedInput.dispose();
        prediction.dispose();
    }

    return predictions;
}

/**
 * Calculate uncertainty metrics from samples
 */
export function calculateUncertainty(
    samples: number[],
    config: Partial<MCDropoutConfig> = {}
): UncertaintyResult {
    const cfg: MCDropoutConfig = { ...DEFAULT_MC_CONFIG, ...config };
    const n = samples.length;

    if (n === 0) {
        return {
            mean: 50,
            stdDev: 25,
            variance: 625,
            lowerBound: 0,
            upperBound: 100,
            intervalWidth: 100,
            confidenceLevel: cfg.confidenceLevel,
            trustScore: 0,
            shouldQuestion: true,
            questionReason: 'No samples available',
            samples: [],
        };
    }

    // Calculate mean
    const mean = samples.reduce((a, b) => a + b, 0) / n;

    // Calculate variance and standard deviation
    const squaredDiffs = samples.map(s => Math.pow(s - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1 || 1);
    const stdDev = Math.sqrt(variance);

    // Calculate confidence interval
    const z = getZScore(cfg.confidenceLevel);
    const marginOfError = z * (stdDev / Math.sqrt(n));
    const lowerBound = Math.max(0, mean - marginOfError);
    const upperBound = Math.min(100, mean + marginOfError);
    const intervalWidth = upperBound - lowerBound;

    // Calculate trust score (inverse of relative uncertainty)
    // Lower uncertainty = higher trust
    const relativeUncertainty = stdDev / Math.max(mean, 1);
    const trustScore = Math.max(0, Math.min(100, 100 - relativeUncertainty * 100));

    // Determine if prediction should be questioned
    const shouldQuestion = stdDev > cfg.highUncertaintyThreshold;
    let questionReason: string | undefined;

    if (shouldQuestion) {
        if (stdDev > 25) {
            questionReason = 'Very high uncertainty: prediction highly variable';
        } else if (stdDev > 20) {
            questionReason = 'High uncertainty: recommend gathering more data';
        } else {
            questionReason = 'Moderate uncertainty: prediction may vary';
        }
    }

    return {
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        variance: Math.round(variance * 10) / 10,
        lowerBound: Math.round(lowerBound * 10) / 10,
        upperBound: Math.round(upperBound * 10) / 10,
        intervalWidth: Math.round(intervalWidth * 10) / 10,
        confidenceLevel: cfg.confidenceLevel,
        trustScore: Math.round(trustScore),
        shouldQuestion,
        questionReason,
        samples,
    };
}

// ============================================
// HIGH-LEVEL API
// ============================================

/**
 * Predict with uncertainty estimation
 * Combines MC Dropout with uncertainty calculation
 */
export async function predictWithUncertainty(
    model: tf.LayersModel,
    input: tf.Tensor,
    config: Partial<MCDropoutConfig> = {}
): Promise<UncertaintyResult> {
    const samples = await runMCDropout(model, input, config);
    return calculateUncertainty(samples, config);
}

/**
 * Quick uncertainty check without full model
 * Uses simpler variance estimation from historical predictions
 */
export function estimateUncertaintyFromHistory(
    recentPredictions: number[],
    windowSize: number = 10
): { uncertainty: number; trend: 'stable' | 'increasing' | 'decreasing' } {
    if (recentPredictions.length < 2) {
        return { uncertainty: 50, trend: 'stable' };
    }

    // Take recent window
    const window = recentPredictions.slice(-windowSize);

    // Calculate variance
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (window.length - 1);
    const uncertainty = Math.min(100, Math.sqrt(variance) * 3);

    // Determine trend
    if (window.length < 3) {
        return { uncertainty, trend: 'stable' };
    }

    const firstHalf = window.slice(0, Math.floor(window.length / 2));
    const secondHalf = window.slice(Math.floor(window.length / 2));

    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondMean - firstMean;
    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable';

    if (Math.abs(diff) > 5) {
        trend = diff > 0 ? 'increasing' : 'decreasing';
    }

    return { uncertainty, trend };
}

// ============================================
// ENSEMBLE VARIANCE (Bayesian-like)
// ============================================

/**
 * Estimate uncertainty from ensemble predictions
 * When you have multiple models, use their disagreement as uncertainty measure
 */
export function calculateEnsembleUncertainty(
    modelPredictions: number[]
): { mean: number; uncertainty: number; agreement: number } {
    if (modelPredictions.length === 0) {
        return { mean: 50, uncertainty: 100, agreement: 0 };
    }

    if (modelPredictions.length === 1) {
        return { mean: modelPredictions[0], uncertainty: 20, agreement: 100 };
    }

    const mean = modelPredictions.reduce((a, b) => a + b, 0) / modelPredictions.length;
    const variance = modelPredictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (modelPredictions.length - 1);
    const uncertainty = Math.min(100, Math.sqrt(variance) * 2);

    // Agreement is inverse of spread
    const range = Math.max(...modelPredictions) - Math.min(...modelPredictions);
    const agreement = Math.max(0, 100 - range);

    return {
        mean: Math.round(mean * 10) / 10,
        uncertainty: Math.round(uncertainty * 10) / 10,
        agreement: Math.round(agreement),
    };
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

const UNCERTAINTY_CONFIG_KEY = 'ml_uncertainty_config';

/**
 * Get uncertainty configuration
 */
export function getUncertaintyConfig(): MCDropoutConfig {
    if (typeof window === 'undefined') return DEFAULT_MC_CONFIG;
    const stored = localStorage.getItem(UNCERTAINTY_CONFIG_KEY);
    return stored ? { ...DEFAULT_MC_CONFIG, ...JSON.parse(stored) } : DEFAULT_MC_CONFIG;
}

/**
 * Save uncertainty configuration
 */
export function saveUncertaintyConfig(config: Partial<MCDropoutConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getUncertaintyConfig();
    localStorage.setItem(UNCERTAINTY_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Reset uncertainty configuration to defaults
 */
export function resetUncertaintyConfig(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(UNCERTAINTY_CONFIG_KEY);
}

/**
 * Get default MC Dropout configuration
 */
export function getDefaultMCConfig(): MCDropoutConfig {
    return { ...DEFAULT_MC_CONFIG };
}
