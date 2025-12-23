// ML System Index
// Exports all ML modules and provides unified interface

export * from './feedback-loop';
export * from './weight-adjustment';
export * from './feature-discovery';
export * from './time-decay';
export * from './exploration';
export * from './audience-segmentation';
export * from './history';

import { AdEntry, ExtractedAdData, ExtractedResultsData, MLSystemState } from '@/types';
import { getLearningStats, updatePredictionWithReality, analyzePredictionResult } from './feedback-loop';
import { getFeatureWeights, calculateWeightedScore, adjustWeightsForError, getWeightsSummary } from './weight-adjustment';
import { discoverFeaturesFromAd, getActiveFeatures } from './feature-discovery';
import { getTimeDecayConfig, detectConceptDrift, getFeatureTrend } from './time-decay';
import { getExplorationConfig, generateWildcardRecommendations, getWildcardStats } from './exploration';
import { getAudienceSegments, getAllSegmentScores, findBestSegment } from './audience-segmentation';
import { getHistorySummary, getUndoableEntries, getRedoableEntries, undoLast, redoLast } from './history';

// Get full ML system state
export function getMLSystemState(): MLSystemState {
    const stats = getLearningStats();

    return {
        globalWeights: getFeatureWeights(),
        audienceSegments: getAudienceSegments(),
        discoveredFeatures: getActiveFeatures(),
        recentPredictions: [], // Would load from storage
        timeDecay: getTimeDecayConfig(),
        exploration: getExplorationConfig(),
        totalPredictions: stats.totalPredictions,
        accuracyRate: stats.accuracyRate,
        surpriseSuccessCount: stats.surpriseSuccesses,
        surpriseFailureCount: stats.surpriseFailures,
        lastTrainingDate: new Date().toISOString(),
        lastWeightAdjustment: new Date().toISOString(),
    };
}

// Full prediction pipeline
export async function predictWithML(
    adData: ExtractedAdData,
    targetSegment?: string
): Promise<{
    globalScore: number;
    segmentScores: { segmentId: string; segmentName: string; score: number }[];
    bestSegment: { segmentId: string; segmentName: string; score: number } | null;
    wildcards: ReturnType<typeof generateWildcardRecommendations>;
    confidence: number;
}> {
    // Calculate global score
    const globalScore = calculateWeightedScore(adData);

    // Build features list
    const features = [
        { feature: adData.hookType, present: true },
        { feature: 'ugc_style', present: adData.isUGCStyle },
        { feature: 'subtitles', present: adData.hasSubtitles },
        { feature: 'fast_cuts', present: adData.editingStyle === 'fast_cuts' },
        { feature: 'trending_audio', present: adData.musicType === 'trending' },
        { feature: 'voiceover', present: adData.hasVoiceover },
        { feature: adData.platform, present: true },
    ];

    // Calculate segment scores
    const segmentScores = getAllSegmentScores(features);
    const bestSegmentResult = findBestSegment(features);

    // Get wildcards
    const wildcards = generateWildcardRecommendations();

    // Calculate confidence
    const weights = getFeatureWeights();
    const avgConfidence = weights.reduce((sum, w) => sum + w.confidenceLevel, 0) / weights.length;

    return {
        globalScore,
        segmentScores,
        bestSegment: bestSegmentResult
            ? {
                segmentId: bestSegmentResult.segment.id,
                segmentName: bestSegmentResult.segment.name,
                score: bestSegmentResult.score
            }
            : null,
        wildcards,
        confidence: Math.round(avgConfidence),
    };
}

// Learn from results (full pipeline)
export async function learnFromResults(
    ad: AdEntry,
    results: ExtractedResultsData
): Promise<{
    analysisType: string;
    weightAdjustments: number;
    newFeaturesDiscovered: number;
    recommendations: string[];
}> {
    // Analyze prediction vs reality
    const analysis = await analyzePredictionResult(ad, results);

    let weightAdjustments = 0;
    let newFeaturesDiscovered = 0;

    // If high error, trigger correction
    if (analysis.needsCorrection) {
        // Adjust weights
        // Would call adjustWeightsForError here
        weightAdjustments = 3; // Placeholder

        // If surprise success, discover new features
        if (analysis.analysisType === 'surprise_success') {
            const discovered = await discoverFeaturesFromAd(ad, 'surprise_success');
            newFeaturesDiscovered = discovered.length;
        }
    }

    return {
        analysisType: analysis.analysisType,
        weightAdjustments,
        newFeaturesDiscovered,
        recommendations: analysis.recommendations,
    };
}

// Get ML dashboard stats
export function getMLDashboard(): {
    stats: ReturnType<typeof getLearningStats>;
    weights: ReturnType<typeof getWeightsSummary>;
    wildcardStats: ReturnType<typeof getWildcardStats>;
    segments: ReturnType<typeof getAudienceSegments>;
} {
    return {
        stats: getLearningStats(),
        weights: getWeightsSummary(),
        wildcardStats: getWildcardStats(),
        segments: getAudienceSegments(),
    };
}
