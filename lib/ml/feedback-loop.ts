// Feedback Loop System
// Compares predictions to reality and triggers corrections

import {
    PredictionRecord,
    FeatureWeight,
    AdEntry,
    ExtractedResultsData
} from '@/types';

const STORAGE_KEY = 'ml_predictions';

// Get all prediction records
export function getPredictionRecords(): PredictionRecord[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Save prediction records
function savePredictionRecords(records: PredictionRecord[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Create a new prediction record
export function recordPrediction(
    adId: string,
    predictedScore: number,
    weightsUsed: FeatureWeight[],
    audienceSegment?: string
): PredictionRecord {
    const record: PredictionRecord = {
        id: `pred-${Date.now()}`,
        adId,
        predictedScore,
        predictedAt: new Date().toISOString(),
        isHighError: false,
        isSurpriseSuccess: false,
        isSurpriseFailure: false,
        weightsUsed,
        audienceSegment,
        correctionApplied: false,
    };

    const records = getPredictionRecords();
    records.push(record);
    savePredictionRecords(records);

    return record;
}

// Update prediction with actual results
export function updatePredictionWithReality(
    adId: string,
    actualScore: number
): PredictionRecord | null {
    const records = getPredictionRecords();
    const record = records.find(r => r.adId === adId && !r.actualScore);

    if (!record) return null;

    // Calculate delta
    const delta = actualScore - record.predictedScore;
    const deltaPercent = Math.abs(delta) / Math.max(record.predictedScore, 1) * 100;

    // Determine error type
    const isHighError = deltaPercent > 50;
    const isSurpriseSuccess = record.predictedScore < 50 && actualScore >= 70;
    const isSurpriseFailure = record.predictedScore >= 70 && actualScore < 50;

    // Update record
    record.actualScore = actualScore;
    record.actualResultsAt = new Date().toISOString();
    record.delta = delta;
    record.deltaPercent = deltaPercent;
    record.isHighError = isHighError;
    record.isSurpriseSuccess = isSurpriseSuccess;
    record.isSurpriseFailure = isSurpriseFailure;

    savePredictionRecords(records);

    // Trigger correction if high error
    if (isHighError) {
        console.log(`[FEEDBACK LOOP] High error detected for ad ${adId}. Delta: ${deltaPercent.toFixed(1)}%`);
    }

    return record;
}

// Get high-error predictions that need correction
export function getHighErrorPredictions(): PredictionRecord[] {
    return getPredictionRecords().filter(r => r.isHighError && !r.correctionApplied);
}

// Get surprise successes for feature discovery
export function getSurpriseSuccesses(): PredictionRecord[] {
    return getPredictionRecords().filter(r => r.isSurpriseSuccess);
}

// Get surprise failures
export function getSurpriseFailures(): PredictionRecord[] {
    return getPredictionRecords().filter(r => r.isSurpriseFailure);
}

// Calculate accuracy rate
export function calculateAccuracyRate(): number {
    const records = getPredictionRecords().filter(r => r.actualScore !== undefined);
    if (records.length === 0) return 0;

    const accurateCount = records.filter(r => {
        const deltaPercent = Math.abs((r.actualScore! - r.predictedScore) / Math.max(r.predictedScore, 1) * 100);
        return deltaPercent <= 20; // Within 20% is considered accurate
    }).length;

    return Math.round((accurateCount / records.length) * 100);
}

// Analyze prediction for an ad when results come in
export async function analyzePredictionResult(
    ad: AdEntry,
    results: ExtractedResultsData
): Promise<{
    needsCorrection: boolean;
    analysisType: 'surprise_success' | 'surprise_failure' | 'accurate' | 'minor_error';
    delta: number;
    recommendations: string[];
}> {
    const records = getPredictionRecords();
    const prediction = records.find(r => r.adId === ad.id && !r.actualScore);

    if (!prediction) {
        return {
            needsCorrection: false,
            analysisType: 'accurate',
            delta: 0,
            recommendations: [],
        };
    }

    const actualScore = results.successScore;
    const delta = actualScore - prediction.predictedScore;
    const deltaPercent = Math.abs(delta) / Math.max(prediction.predictedScore, 1) * 100;

    let analysisType: 'surprise_success' | 'surprise_failure' | 'accurate' | 'minor_error';
    const recommendations: string[] = [];

    if (prediction.predictedScore < 50 && actualScore >= 70) {
        analysisType = 'surprise_success';
        recommendations.push('Trigger feature discovery to find what made this work');
        recommendations.push('Increase weights for traits present in this ad');
    } else if (prediction.predictedScore >= 70 && actualScore < 50) {
        analysisType = 'surprise_failure';
        recommendations.push('Decrease weights for traits that we overvalued');
        recommendations.push('Check for concept drift in current trends');
    } else if (deltaPercent <= 20) {
        analysisType = 'accurate';
    } else {
        analysisType = 'minor_error';
        recommendations.push('Minor weight adjustment recommended');
    }

    // Update the prediction record
    updatePredictionWithReality(ad.id, actualScore);

    return {
        needsCorrection: analysisType === 'surprise_success' || analysisType === 'surprise_failure',
        analysisType,
        delta,
        recommendations,
    };
}

// Get learning statistics
export function getLearningStats(): {
    totalPredictions: number;
    accuracyRate: number;
    surpriseSuccesses: number;
    surpriseFailures: number;
    pendingCorrections: number;
} {
    const records = getPredictionRecords();
    const withResults = records.filter(r => r.actualScore !== undefined);

    return {
        totalPredictions: records.length,
        accuracyRate: calculateAccuracyRate(),
        surpriseSuccesses: records.filter(r => r.isSurpriseSuccess).length,
        surpriseFailures: records.filter(r => r.isSurpriseFailure).length,
        pendingCorrections: records.filter(r => r.isHighError && !r.correctionApplied).length,
    };
}
