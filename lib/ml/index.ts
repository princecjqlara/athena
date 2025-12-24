// ML System Index
// Exports all ML modules and provides unified interface

export * from './feedback-loop';
export * from './weight-adjustment';
export * from './feature-discovery';
export * from './time-decay';
export * from './exploration';
export * from './audience-segmentation';
export * from './history';
export * from './feature-eligibility';
export * from './success-normalization';
export * from './failure-taxonomy';
export * from './risk-assessment';

import { AdEntry, ExtractedAdData, ExtractedResultsData, MLSystemState } from '@/types';
import { getLearningStats, updatePredictionWithReality, analyzePredictionResult } from './feedback-loop';
import { getFeatureWeights, calculateWeightedScore, adjustWeightsForError, getWeightsSummary } from './weight-adjustment';
import { discoverFeaturesFromAd, getActiveFeatures } from './feature-discovery';
import { getTimeDecayConfig, detectConceptDrift, getFeatureTrend } from './time-decay';
import { getExplorationConfig, generateWildcardRecommendations, getWildcardStats } from './exploration';
import { getAudienceSegments, getAllSegmentScores, findBestSegment } from './audience-segmentation';
import { getHistorySummary, getUndoableEntries, getRedoableEntries, undoLast, redoLast } from './history';
import { validatePredictionInput, filterEligibleFeatures, logFeatureViolations } from './feature-eligibility';
import { normalizeSuccessScore, updateBaselineWithResults, getBaselineStats } from './success-normalization';
import { classifyFailure, isAntiPattern, getFailurePatterns } from './failure-taxonomy';
import { assessPredictionRisk, RiskAssessment, RiskTier } from './risk-assessment';

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

// Full prediction pipeline with risk assessment
export async function predictWithML(
    adData: ExtractedAdData,
    targetSegment?: string
): Promise<{
    globalScore: number;
    segmentScores: { segmentId: string; segmentName: string; score: number }[];
    bestSegment: { segmentId: string; segmentName: string; score: number } | null;
    wildcards: ReturnType<typeof generateWildcardRecommendations>;
    confidence: number;
    riskAssessment: RiskAssessment;
    featureValidation: ReturnType<typeof validatePredictionInput>;
    baselineStats: ReturnType<typeof getBaselineStats>;
}> {
    // Validate features - ensure we're only using pre-spend data
    const allFeatures = Object.keys(adData);
    const featureValidation = validatePredictionInput(
        Object.fromEntries(allFeatures.map(f => [f, true]))
    );

    // Log any violations for debugging
    if (!featureValidation.isValid) {
        logFeatureViolations(featureValidation);
    }

    // Filter to only eligible features for scoring
    const eligibleAdData = filterEligibleFeatures(adData) as ExtractedAdData;

    // Calculate global score using only eligible features
    const globalScore = calculateWeightedScore(eligibleAdData);

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

    // Assess prediction risk
    const riskAssessment = assessPredictionRisk(adData, globalScore);

    // Get baseline stats for context
    const baselineStats = getBaselineStats();

    // Use risk assessment confidence instead of simple average
    const confidence = riskAssessment.overallConfidence;

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
        confidence,
        riskAssessment,
        featureValidation,
        baselineStats,
    };
}

// Learn from results (full pipeline) with failure classification
export async function learnFromResults(
    ad: AdEntry,
    results: ExtractedResultsData
): Promise<{
    analysisType: string;
    weightAdjustments: number;
    newFeaturesDiscovered: number;
    recommendations: string[];
    normalizedScore: ReturnType<typeof normalizeSuccessScore>;
    failureAnalysis?: ReturnType<typeof classifyFailure>;
}> {
    // Normalize the success score relative to account baseline
    const normalizedScore = normalizeSuccessScore(results);

    // Update the baseline with this new result
    updateBaselineWithResults(results);

    // Analyze prediction vs reality
    const analysis = await analyzePredictionResult(ad, results);

    let weightAdjustments = 0;
    let newFeaturesDiscovered = 0;
    let failureAnalysis: ReturnType<typeof classifyFailure> | undefined;

    // If ad underperformed, classify the failure
    if (normalizedScore.normalizedScore < 40 ||
        analysis.analysisType === 'surprise_failure') {
        failureAnalysis = classifyFailure(ad, results);

        // Apply negative weights from failure analysis
        if (failureAnalysis.learnedNegativeWeights.length > 0) {
            weightAdjustments += failureAnalysis.learnedNegativeWeights.length;
        }

        // Add failure taxonomy recommendations
        analysis.recommendations.push(...failureAnalysis.recommendations);
    }

    // If high error, trigger correction
    if (analysis.needsCorrection) {
        // Adjust weights
        weightAdjustments += 3;

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
        normalizedScore,
        failureAnalysis,
    };
}

// Get ML dashboard stats with baseline info
export function getMLDashboard(): {
    stats: ReturnType<typeof getLearningStats>;
    weights: ReturnType<typeof getWeightsSummary>;
    wildcardStats: ReturnType<typeof getWildcardStats>;
    segments: ReturnType<typeof getAudienceSegments>;
    baselineStats: ReturnType<typeof getBaselineStats>;
    failurePatterns: ReturnType<typeof getFailurePatterns>;
} {
    return {
        stats: getLearningStats(),
        weights: getWeightsSummary(),
        wildcardStats: getWildcardStats(),
        segments: getAudienceSegments(),
        baselineStats: getBaselineStats(),
        failurePatterns: getFailurePatterns(),
    };
}
