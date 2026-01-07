/**
 * Bayesian Confidence Module
 * 
 * Provides Bayesian-inspired uncertainty estimation for predictions.
 * Uses ensemble variance and historical calibration to produce
 * well-calibrated confidence intervals.
 * 
 * @module lib/ml/bayesian-confidence
 */

// ============================================
// TYPES
// ============================================

export interface BayesianConfidence {
    /** Confidence level (0-100) */
    confidence: number;
    /** Epistemic uncertainty (model uncertainty) */
    epistemic: number;
    /** Aleatoric uncertainty (data noise) */
    aleatoric: number;
    /** Overall uncertainty (combined) */
    totalUncertainty: number;
    /** Calibration quality (how well-calibrated is this?) */
    calibrationScore: number;
    /** Decision recommendation */
    recommendation: 'trust' | 'verify' | 'question' | 'reject';
    /** Reason for recommendation */
    reason: string;
}

export interface CalibrationData {
    /** Predicted probability buckets */
    buckets: CalibrationBucket[];
    /** Expected Calibration Error (ECE) */
    ece: number;
    /** Maximum Calibration Error (MCE) */
    mce: number;
    /** Is well-calibrated? (ECE < 0.1) */
    isWellCalibrated: boolean;
}

export interface CalibrationBucket {
    /** Bucket range (e.g., 0.0-0.1) */
    range: { min: number; max: number };
    /** Average predicted probability */
    avgPredicted: number;
    /** Actual observed frequency */
    avgActual: number;
    /** Number of samples in bucket */
    count: number;
    /** Calibration error for this bucket */
    error: number;
}

export interface BayesianConfig {
    /** Prior mean (default prediction without data) */
    priorMean: number;
    /** Prior strength (how much to weight prior) */
    priorStrength: number;
    /** Min samples for confident prediction */
    minSamplesForConfidence: number;
    /** Epistemic decay rate (more data = less epistemic uncertainty) */
    epistemicDecayRate: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_BAYESIAN_CONFIG: BayesianConfig = {
    priorMean: 50,           // Neutral prior
    priorStrength: 5,        // Equivalent to 5 pseudo-observations
    minSamplesForConfidence: 10,
    epistemicDecayRate: 0.1,
};

// ============================================
// STORAGE
// ============================================

const CALIBRATION_KEY = 'ml_calibration_history';
const BAYESIAN_CONFIG_KEY = 'ml_bayesian_config';

interface CalibrationSample {
    predicted: number;
    actual: number;
    timestamp: string;
}

function getCalibrationHistory(): CalibrationSample[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(CALIBRATION_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveCalibrationSample(sample: CalibrationSample): void {
    if (typeof window === 'undefined') return;
    const history = getCalibrationHistory();
    history.push(sample);
    // Keep last 1000 samples
    if (history.length > 1000) history.shift();
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(history));
}

// ============================================
// BAYESIAN CONFIDENCE CALCULATION
// ============================================

/**
 * Calculate Bayesian confidence for a prediction
 * Uses posterior updating with historical calibration
 */
export function calculateBayesianConfidence(
    prediction: number,
    neighborCount: number,
    variance: number,
    config: Partial<BayesianConfig> = {}
): BayesianConfidence {
    const cfg: BayesianConfig = { ...DEFAULT_BAYESIAN_CONFIG, ...config };

    // Epistemic uncertainty: decreases with more data
    // Formula: epistemic = base * exp(-decay * n)
    const baseEpistemic = 50;
    const epistemic = baseEpistemic * Math.exp(-cfg.epistemicDecayRate * neighborCount);

    // Aleatoric uncertainty: from observed variance in data
    // Higher variance in neighbor outcomes = higher aleatoric
    const aleatoric = Math.min(50, Math.sqrt(variance) * 2);

    // Total uncertainty (combine using quadrature)
    const totalUncertainty = Math.sqrt(
        Math.pow(epistemic, 2) + Math.pow(aleatoric, 2)
    );

    // Confidence is inverse of uncertainty
    const confidence = Math.max(0, Math.min(100, 100 - totalUncertainty));

    // Get calibration score from history
    const calibrationScore = getCalibrationScore(prediction);

    // Determine recommendation
    const { recommendation, reason } = getRecommendation(
        confidence,
        epistemic,
        aleatoric,
        calibrationScore,
        cfg
    );

    return {
        confidence: Math.round(confidence),
        epistemic: Math.round(epistemic * 10) / 10,
        aleatoric: Math.round(aleatoric * 10) / 10,
        totalUncertainty: Math.round(totalUncertainty * 10) / 10,
        calibrationScore: Math.round(calibrationScore),
        recommendation,
        reason,
    };
}

/**
 * Get recommendation based on uncertainty analysis
 */
function getRecommendation(
    confidence: number,
    epistemic: number,
    aleatoric: number,
    calibrationScore: number,
    config: BayesianConfig
): { recommendation: 'trust' | 'verify' | 'question' | 'reject'; reason: string } {
    // High confidence + good calibration = trust
    if (confidence > 75 && calibrationScore > 70) {
        return { recommendation: 'trust', reason: 'High confidence with good calibration' };
    }

    // Moderate confidence = verify
    if (confidence > 50 && confidence <= 75) {
        if (epistemic > aleatoric) {
            return {
                recommendation: 'verify',
                reason: 'Model uncertainty high - need more similar data'
            };
        } else {
            return {
                recommendation: 'verify',
                reason: 'Data variance high - outcomes are inherently variable'
            };
        }
    }

    // Low confidence but not terrible = question
    if (confidence > 25 && confidence <= 50) {
        return {
            recommendation: 'question',
            reason: 'Low confidence - treat prediction as directional only'
        };
    }

    // Very low confidence = reject
    return {
        recommendation: 'reject',
        reason: 'Insufficient data for reliable prediction'
    };
}

// ============================================
// CALIBRATION ANALYSIS
// ============================================

/**
 * Get calibration score for a prediction
 * Based on historical accuracy at similar prediction levels
 */
function getCalibrationScore(prediction: number): number {
    const history = getCalibrationHistory();
    if (history.length < 10) return 50; // Not enough data

    // Find samples with similar predictions (within 10 points)
    const similar = history.filter(
        s => Math.abs(s.predicted - prediction) < 10
    );

    if (similar.length < 5) return 50;

    // Calculate how well predictions matched reality
    const errors = similar.map(s => Math.abs(s.predicted - s.actual));
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;

    // Convert to 0-100 score (lower error = higher score)
    return Math.max(0, 100 - avgError);
}

/**
 * Calculate full calibration data
 */
export function calculateCalibrationData(): CalibrationData {
    const history = getCalibrationHistory();
    const numBuckets = 10;
    const buckets: CalibrationBucket[] = [];

    for (let i = 0; i < numBuckets; i++) {
        const min = i * 10;
        const max = (i + 1) * 10;

        const inBucket = history.filter(
            s => s.predicted >= min && s.predicted < max
        );

        if (inBucket.length > 0) {
            const avgPredicted = inBucket.reduce((sum, s) => sum + s.predicted, 0) / inBucket.length;
            const avgActual = inBucket.reduce((sum, s) => sum + s.actual, 0) / inBucket.length;
            const error = Math.abs(avgPredicted - avgActual);

            buckets.push({
                range: { min, max },
                avgPredicted,
                avgActual,
                count: inBucket.length,
                error,
            });
        } else {
            buckets.push({
                range: { min, max },
                avgPredicted: (min + max) / 2,
                avgActual: (min + max) / 2,
                count: 0,
                error: 0,
            });
        }
    }

    // Calculate ECE (Expected Calibration Error)
    const totalSamples = history.length;
    const ece = totalSamples > 0
        ? buckets.reduce((sum, b) => sum + (b.count / totalSamples) * b.error, 0)
        : 0;

    // Calculate MCE (Maximum Calibration Error)
    const mce = Math.max(...buckets.filter(b => b.count > 0).map(b => b.error), 0);

    return {
        buckets,
        ece: Math.round(ece * 10) / 10,
        mce: Math.round(mce * 10) / 10,
        isWellCalibrated: ece < 10,
    };
}

// ============================================
// CALIBRATION UPDATES
// ============================================

/**
 * Record a prediction result for calibration tracking
 */
export function recordPredictionResult(
    predictedScore: number,
    actualScore: number
): void {
    saveCalibrationSample({
        predicted: predictedScore,
        actual: actualScore,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Clear calibration history
 */
export function clearCalibrationHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CALIBRATION_KEY);
}

// ============================================
// POSTERIOR UPDATING
// ============================================

/**
 * Update prediction with Bayesian posterior
 * Combines prior knowledge with new observation
 */
export function updatePosterior(
    priorMean: number,
    priorVariance: number,
    likelihoodMean: number,
    likelihoodVariance: number
): { posteriorMean: number; posteriorVariance: number } {
    // Bayesian posterior updating formula
    // posterior = prior * likelihood (normalized)

    const priorPrecision = 1 / priorVariance;
    const likelihoodPrecision = 1 / likelihoodVariance;

    const posteriorPrecision = priorPrecision + likelihoodPrecision;
    const posteriorVariance = 1 / posteriorPrecision;

    const posteriorMean = posteriorVariance * (
        priorPrecision * priorMean +
        likelihoodPrecision * likelihoodMean
    );

    return {
        posteriorMean: Math.round(posteriorMean * 10) / 10,
        posteriorVariance: Math.round(posteriorVariance * 10) / 10,
    };
}

/**
 * Get Bayesian updated prediction
 * Combines prior (default) with observed neighbors
 */
export function getBayesianPrediction(
    neighborMean: number,
    neighborVariance: number,
    neighborCount: number,
    config: Partial<BayesianConfig> = {}
): { prediction: number; confidence: number } {
    const cfg: BayesianConfig = { ...DEFAULT_BAYESIAN_CONFIG, ...config };

    // If no neighbors, return prior
    if (neighborCount === 0) {
        return {
            prediction: cfg.priorMean,
            confidence: 0,
        };
    }

    // Weight prior by priorStrength pseudo-observations
    const effectiveSamples = neighborCount + cfg.priorStrength;

    // Weighted average of prior and neighbors
    const prediction = (
        cfg.priorMean * cfg.priorStrength +
        neighborMean * neighborCount
    ) / effectiveSamples;

    // Posterior variance decreases with more samples
    const priorVar = 400; // High prior variance
    const posteriorVar = priorVar / effectiveSamples;

    // Confidence from posterior variance
    const confidence = Math.max(0, Math.min(100, 100 - Math.sqrt(posteriorVar)));

    return {
        prediction: Math.round(prediction * 10) / 10,
        confidence: Math.round(confidence),
    };
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

/**
 * Get Bayesian configuration
 */
export function getBayesianConfig(): BayesianConfig {
    if (typeof window === 'undefined') return DEFAULT_BAYESIAN_CONFIG;
    const stored = localStorage.getItem(BAYESIAN_CONFIG_KEY);
    return stored ? { ...DEFAULT_BAYESIAN_CONFIG, ...JSON.parse(stored) } : DEFAULT_BAYESIAN_CONFIG;
}

/**
 * Save Bayesian configuration
 */
export function saveBayesianConfig(config: Partial<BayesianConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getBayesianConfig();
    localStorage.setItem(BAYESIAN_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Reset Bayesian configuration to defaults
 */
export function resetBayesianConfig(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(BAYESIAN_CONFIG_KEY);
}

/**
 * Get default Bayesian configuration
 */
export function getDefaultBayesianConfig(): BayesianConfig {
    return { ...DEFAULT_BAYESIAN_CONFIG };
}
