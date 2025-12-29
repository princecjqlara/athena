/**
 * Confidence Calibration Module
 * Adjusts confidence scores based on historical accuracy
 */

export interface CalibrationData {
    promptVersion: string;
    confidenceBucket: string;  // '0.0-0.2', '0.2-0.4', etc.
    totalPredictions: number;
    correctPredictions: number;
    actualAccuracy: number;
}

export interface CalibrationResult {
    originalConfidence: number;
    calibratedConfidence: number;
    adjustmentFactor: number;
    calibrationSource: string;
}

// Historical calibration data (in production, fetch from DB)
const CALIBRATION_BUCKETS: Record<string, { predictedAccuracy: number; actualAccuracy: number }> = {
    '0.0-0.2': { predictedAccuracy: 0.1, actualAccuracy: 0.15 },
    '0.2-0.4': { predictedAccuracy: 0.3, actualAccuracy: 0.35 },
    '0.4-0.6': { predictedAccuracy: 0.5, actualAccuracy: 0.52 },
    '0.6-0.8': { predictedAccuracy: 0.7, actualAccuracy: 0.65 },
    '0.8-1.0': { predictedAccuracy: 0.9, actualAccuracy: 0.78 }
};

/**
 * Get confidence bucket for a score
 */
function getConfidenceBucket(confidence: number): string {
    if (confidence < 0.2) return '0.0-0.2';
    if (confidence < 0.4) return '0.2-0.4';
    if (confidence < 0.6) return '0.4-0.6';
    if (confidence < 0.8) return '0.6-0.8';
    return '0.8-1.0';
}

/**
 * Calibrate confidence score based on historical accuracy
 */
export function calibrateConfidence(originalConfidence: number): CalibrationResult {
    const bucket = getConfidenceBucket(originalConfidence);
    const calibration = CALIBRATION_BUCKETS[bucket];

    if (!calibration) {
        return {
            originalConfidence,
            calibratedConfidence: originalConfidence,
            adjustmentFactor: 1.0,
            calibrationSource: 'none'
        };
    }

    // Calculate adjustment factor
    const adjustmentFactor = calibration.actualAccuracy / calibration.predictedAccuracy;

    // Apply adjustment (bounded between 0 and 1)
    const calibratedConfidence = Math.min(1, Math.max(0, originalConfidence * adjustmentFactor));

    return {
        originalConfidence,
        calibratedConfidence,
        adjustmentFactor,
        calibrationSource: `bucket:${bucket}`
    };
}

/**
 * Update calibration data based on new evaluation results
 */
export async function updateCalibration(
    promptVersion: string,
    predictedConfidence: number,
    wasCorrect: boolean
): Promise<void> {
    try {
        // In production, update the database with new data point
        const bucket = getConfidenceBucket(predictedConfidence);

        console.log(`Calibration update: ${bucket}, predicted=${predictedConfidence}, correct=${wasCorrect}`);

        // Would aggregate and recalculate bucket accuracies
    } catch (error) {
        console.error('Error updating calibration:', error);
    }
}

/**
 * Calculate Brier Score for calibration quality
 * Lower is better (0 = perfect calibration)
 */
export function calculateBrierScore(
    predictions: Array<{ confidence: number; wasCorrect: boolean }>
): number {
    if (predictions.length === 0) return 1;

    const sumSquaredErrors = predictions.reduce((sum, p) => {
        const outcome = p.wasCorrect ? 1 : 0;
        return sum + Math.pow(p.confidence - outcome, 2);
    }, 0);

    return sumSquaredErrors / predictions.length;
}

/**
 * Get calibration statistics for a prompt version
 */
export async function getCalibrationStats(promptVersion?: string): Promise<{
    bucketStats: Record<string, { total: number; correct: number; accuracy: number }>;
    brierScore: number;
    isWellCalibrated: boolean;
}> {
    // In production, query from database
    const bucketStats: Record<string, { total: number; correct: number; accuracy: number }> = {};

    for (const [bucket, data] of Object.entries(CALIBRATION_BUCKETS)) {
        bucketStats[bucket] = {
            total: 100, // Mock
            correct: Math.round(100 * data.actualAccuracy),
            accuracy: data.actualAccuracy
        };
    }

    // Calculate overall Brier score
    const allPredictions = Object.entries(CALIBRATION_BUCKETS).flatMap(([bucket, data]) => {
        const midpoint = (parseFloat(bucket.split('-')[0]) + parseFloat(bucket.split('-')[1])) / 2;
        return Array(100).fill(null).map((_, i) => ({
            confidence: midpoint,
            wasCorrect: i < 100 * data.actualAccuracy
        }));
    });

    const brierScore = calculateBrierScore(allPredictions);

    return {
        bucketStats,
        brierScore,
        isWellCalibrated: brierScore < 0.15 // Good calibration threshold
    };
}

export default {
    calibrateConfidence,
    updateCalibration,
    calculateBrierScore,
    getCalibrationStats
};
