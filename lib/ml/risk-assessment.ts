// Risk Assessment System
// Provides user-facing uncertainty communication and failure prediction

import { ExtractedAdData, FeatureWeight } from '@/types';
import { getFeatureWeights } from './weight-adjustment';
import { isAntiPattern, FailureClass, getFailureClassInfo } from './failure-taxonomy';
import { getBaselineStats } from './success-normalization';

// ============================================
// RISK TIERS
// ============================================

export type RiskTier =
    | 'proven_pattern'      // High confidence, many samples, similar ads worked
    | 'likely_success'      // Good confidence, reasonable samples
    | 'moderate_risk'       // Medium confidence, some uncertainty
    | 'high_variance'       // Low samples, outcome uncertain
    | 'unproven_territory'; // Novel pattern, minimal data, high uncertainty

export interface RiskTierInfo {
    tier: RiskTier;
    label: string;
    color: 'green' | 'blue' | 'yellow' | 'orange' | 'red';
    description: string;
    actionGuidance: string;
}

const RISK_TIER_INFO: Record<RiskTier, Omit<RiskTierInfo, 'tier'>> = {
    proven_pattern: {
        label: 'Proven Pattern',
        color: 'green',
        description: 'This creative combination has worked well before',
        actionGuidance: 'Safe to scale - similar ads have historically performed well',
    },
    likely_success: {
        label: 'Likely Success',
        color: 'blue',
        description: 'Good prediction confidence based on available data',
        actionGuidance: 'Good to test - expected to perform above average',
    },
    moderate_risk: {
        label: 'Moderate Risk',
        color: 'yellow',
        description: 'Some uncertainty in the prediction',
        actionGuidance: 'Test with moderate budget before scaling',
    },
    high_variance: {
        label: 'High Variance',
        color: 'orange',
        description: 'Limited data - outcome could vary significantly',
        actionGuidance: 'Small test recommended - prediction may be unreliable',
    },
    unproven_territory: {
        label: 'Unproven Territory',
        color: 'red',
        description: 'Novel pattern with minimal historical data',
        actionGuidance: 'Experimental - treat as a learning opportunity',
    },
};

// ============================================
// RISK ASSESSMENT
// ============================================

export interface RiskAssessment {
    // Primary classification
    tier: RiskTier;
    tierInfo: RiskTierInfo;

    // Confidence metrics
    overallConfidence: number;      // 0-100
    predictionReliability: number;  // 0-100, how reliable is this prediction

    // Sample size context
    sampleSize: number;
    minSamplesForConfidence: number;

    // Potential issues
    potentialFailures: PotentialFailure[];
    uncertainFeatures: UncertainFeature[];
    antiPatternWarnings: AntiPatternWarning[];

    // Summary for UI
    summaryMessage: string;
    riskFactors: string[];
}

export interface PotentialFailure {
    reason: string;
    probability: number;         // 0-100
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
    relatedFailureClass?: FailureClass;
}

export interface UncertainFeature {
    feature: string;
    currentWeight: number;
    sampleSize: number;
    uncertainty: number;          // 0-100, higher = more uncertain
    recommendation: string;
}

export interface AntiPatternWarning {
    pattern: string;
    matchedFailures: number;
    riskLevel: 'low' | 'medium' | 'high';
    description: string;
}

// ============================================
// MAIN ASSESSMENT FUNCTION
// ============================================

/**
 * Assess the risk level of a prediction
 */
export function assessPredictionRisk(
    adData: ExtractedAdData,
    predictedScore: number
): RiskAssessment {
    const weights = getFeatureWeights();
    const baselineStats = getBaselineStats();

    // Extract features present in this ad
    const presentFeatures = extractFeaturesFromAd(adData);

    // Analyze feature confidence
    const uncertainFeatures = analyzeFeatureUncertainty(presentFeatures, weights);

    // Check for anti-patterns
    const antiPatternCheck = isAntiPattern(presentFeatures);
    const antiPatternWarnings: AntiPatternWarning[] = antiPatternCheck.isAntiPattern
        ? [{
            pattern: 'Similar feature combination',
            matchedFailures: antiPatternCheck.matchedPatterns.length,
            riskLevel: antiPatternCheck.riskLevel,
            description: `This feature combination has failed ${antiPatternCheck.matchedPatterns.length} time(s) before`,
        }]
        : [];

    // Generate potential failure reasons
    const potentialFailures = generatePotentialFailures(adData, predictedScore);

    // Calculate overall confidence
    const { confidence, reliability, sampleSize } = calculateConfidenceMetrics(
        presentFeatures,
        weights,
        baselineStats
    );

    // Determine risk tier
    const tier = determineRiskTier(
        confidence,
        sampleSize,
        antiPatternCheck.riskLevel,
        potentialFailures.length
    );

    // Build summary message
    const summaryMessage = buildSummaryMessage(tier, confidence, potentialFailures);

    // Collect risk factors
    const riskFactors = collectRiskFactors(
        uncertainFeatures,
        antiPatternWarnings,
        potentialFailures,
        baselineStats
    );

    return {
        tier,
        tierInfo: { tier, ...RISK_TIER_INFO[tier] },
        overallConfidence: confidence,
        predictionReliability: reliability,
        sampleSize,
        minSamplesForConfidence: 10,
        potentialFailures,
        uncertainFeatures,
        antiPatternWarnings,
        summaryMessage,
        riskFactors,
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractFeaturesFromAd(adData: ExtractedAdData): string[] {
    const features: string[] = [];

    // Always present features
    features.push(adData.hookType);
    features.push(adData.editingStyle);
    features.push(adData.contentCategory);
    features.push(adData.colorScheme);
    features.push(adData.musicType);
    features.push(adData.platform);

    // Boolean features
    if (adData.isUGCStyle) features.push('ugc_style');
    if (adData.hasSubtitles) features.push('subtitles');
    if (adData.hasTextOverlays) features.push('text_overlays');
    if (adData.hasVoiceover) features.push('voiceover');
    if (adData.curiosityGap) features.push('curiosity_gap');
    if (adData.facePresence) features.push('face_presence');

    return features;
}

function analyzeFeatureUncertainty(
    features: string[],
    weights: FeatureWeight[]
): UncertainFeature[] {
    const uncertainFeatures: UncertainFeature[] = [];

    for (const feature of features) {
        const weight = weights.find(w => w.feature.toLowerCase() === feature.toLowerCase());

        if (!weight) {
            uncertainFeatures.push({
                feature,
                currentWeight: 0.5,
                sampleSize: 0,
                uncertainty: 100,
                recommendation: 'No historical data for this feature - treat prediction as experimental',
            });
        } else if (weight.sampleSize < 5) {
            uncertainFeatures.push({
                feature,
                currentWeight: weight.weight,
                sampleSize: weight.sampleSize,
                uncertainty: Math.max(0, 100 - weight.sampleSize * 20),
                recommendation: `Only ${weight.sampleSize} data points - more testing needed`,
            });
        } else if (weight.confidenceLevel < 50) {
            uncertainFeatures.push({
                feature,
                currentWeight: weight.weight,
                sampleSize: weight.sampleSize,
                uncertainty: 100 - weight.confidenceLevel,
                recommendation: 'Mixed historical results - outcome variable',
            });
        }
    }

    // Sort by uncertainty (highest first)
    return uncertainFeatures.sort((a, b) => b.uncertainty - a.uncertainty);
}

function generatePotentialFailures(
    adData: ExtractedAdData,
    predictedScore: number
): PotentialFailure[] {
    const failures: PotentialFailure[] = [];

    // Hook-related risks
    if (adData.hookVelocity === 'delayed') {
        failures.push({
            reason: 'Delayed hook may not capture short attention spans',
            probability: 35,
            severity: 'medium',
            mitigation: 'Front-load the hook into the first 1-2 seconds',
            relatedFailureClass: 'hook_failure',
        });
    }

    // Platform-style mismatches
    if (adData.platform === 'tiktok' && adData.editingStyle === 'cinematic') {
        failures.push({
            reason: 'Cinematic style often underperforms on TikTok',
            probability: 45,
            severity: 'medium',
            mitigation: 'Consider raw_authentic or fast_cuts editing for TikTok',
            relatedFailureClass: 'platform_mismatch',
        });
    }

    if (adData.platform === 'linkedin' && adData.isUGCStyle) {
        failures.push({
            reason: 'UGC style may not resonate with LinkedIn audience',
            probability: 40,
            severity: 'medium',
            mitigation: 'Use more polished, professional creative for LinkedIn',
            relatedFailureClass: 'platform_mismatch',
        });
    }

    // Format risks
    if (adData.aspectRatio === '16:9' &&
        (adData.platform === 'tiktok' || adData.platform === 'instagram')) {
        failures.push({
            reason: 'Horizontal video may have lower engagement on mobile-first platforms',
            probability: 30,
            severity: 'low',
            mitigation: 'Reformat to 9:16 vertical',
            relatedFailureClass: 'format_issue',
        });
    }

    // CTA risks
    if (adData.ctaStrength === 'weak' || !adData.cta || adData.cta === 'none') {
        failures.push({
            reason: 'Missing or weak call-to-action may reduce conversions',
            probability: 50,
            severity: 'high',
            mitigation: 'Add a clear, compelling CTA at the end',
            relatedFailureClass: 'cta_weak',
        });
    }

    // Audio risks
    if (!adData.hasSubtitles) {
        failures.push({
            reason: 'No subtitles - 85% of mobile viewers watch without sound',
            probability: 25,
            severity: 'low',
            mitigation: 'Add subtitles or captions',
        });
    }

    // Trust risks
    if (adData.isUGCStyle && adData.brandColorUsage === 'dominant') {
        failures.push({
            reason: 'Heavy branding in UGC content may feel inauthentic',
            probability: 35,
            severity: 'medium',
            mitigation: 'Reduce brand elements for more authentic UGC feel',
            relatedFailureClass: 'trust_mismatch',
        });
    }

    // If predicted score is borderline
    if (predictedScore >= 45 && predictedScore <= 55) {
        failures.push({
            reason: 'Borderline predicted performance - could go either way',
            probability: 50,
            severity: 'medium',
            mitigation: 'Consider A/B testing variations to improve',
        });
    }

    // Sort by probability * severity
    const severityScore = { low: 1, medium: 2, high: 3 };
    return failures.sort((a, b) =>
        (b.probability * severityScore[b.severity]) -
        (a.probability * severityScore[a.severity])
    );
}

function calculateConfidenceMetrics(
    features: string[],
    weights: FeatureWeight[],
    baselineStats: ReturnType<typeof getBaselineStats>
): { confidence: number; reliability: number; sampleSize: number } {
    // Average confidence from feature weights
    let totalConfidence = 0;
    let totalSampleSize = 0;
    let matchedFeatures = 0;

    for (const feature of features) {
        const weight = weights.find(w => w.feature.toLowerCase() === feature.toLowerCase());
        if (weight) {
            totalConfidence += weight.confidenceLevel;
            totalSampleSize += weight.sampleSize;
            matchedFeatures++;
        }
    }

    const avgConfidence = matchedFeatures > 0
        ? totalConfidence / matchedFeatures
        : 30;

    // Factor in account baseline readiness
    const baselineBonus = baselineStats.isReady ? 20 : 0;

    // Calculate overall confidence
    const confidence = Math.min(100, Math.round(avgConfidence + baselineBonus));

    // Reliability is lower if we're using priors
    const reliability = baselineStats.usingPriors
        ? Math.round(confidence * 0.7)
        : confidence;

    return {
        confidence,
        reliability,
        sampleSize: baselineStats.sampleSize,
    };
}

function determineRiskTier(
    confidence: number,
    sampleSize: number,
    antiPatternRisk: 'low' | 'medium' | 'high',
    failureCount: number
): RiskTier {
    // High anti-pattern risk = immediate concern
    if (antiPatternRisk === 'high') {
        return 'high_variance';
    }

    // Very low sample size = unproven
    if (sampleSize < 3) {
        return 'unproven_territory';
    }

    // Low sample size with medium anti-pattern risk
    if (sampleSize < 10 && antiPatternRisk === 'medium') {
        return 'high_variance';
    }

    // Confidence-based tiers
    if (confidence >= 80 && failureCount <= 1) {
        return 'proven_pattern';
    }

    if (confidence >= 65 && failureCount <= 2) {
        return 'likely_success';
    }

    if (confidence >= 50) {
        return 'moderate_risk';
    }

    if (confidence >= 30) {
        return 'high_variance';
    }

    return 'unproven_territory';
}

function buildSummaryMessage(
    tier: RiskTier,
    confidence: number,
    failures: PotentialFailure[]
): string {
    const tierInfo = RISK_TIER_INFO[tier];

    if (tier === 'proven_pattern') {
        return `High confidence (${confidence}%) - ${tierInfo.actionGuidance}`;
    }

    if (tier === 'likely_success') {
        return `Good confidence (${confidence}%) - ${tierInfo.actionGuidance}`;
    }

    if (failures.length > 0) {
        const topFailure = failures[0];
        return `${tierInfo.label}: ${topFailure.reason}. ${topFailure.mitigation}`;
    }

    return `${tierInfo.label} (${confidence}% confidence) - ${tierInfo.actionGuidance}`;
}

function collectRiskFactors(
    uncertainFeatures: UncertainFeature[],
    antiPatternWarnings: AntiPatternWarning[],
    failures: PotentialFailure[],
    baselineStats: ReturnType<typeof getBaselineStats>
): string[] {
    const factors: string[] = [];

    // Baseline status
    if (baselineStats.usingPriors) {
        factors.push(`Using platform averages (${baselineStats.sampleSize} ads in account)`);
    }

    // Most uncertain feature
    if (uncertainFeatures.length > 0) {
        const top = uncertainFeatures[0];
        factors.push(`Uncertain: "${top.feature}" has only ${top.sampleSize} data points`);
    }

    // Anti-patterns
    for (const warning of antiPatternWarnings) {
        factors.push(`⚠️ ${warning.description}`);
    }

    // Top failure risk
    if (failures.length > 0 && failures[0].probability >= 30) {
        factors.push(`Risk: ${failures[0].reason}`);
    }

    return factors;
}

// ============================================
// EXPORTS FOR UI
// ============================================

/**
 * Get risk tier label and color for display
 */
export function getRiskTierDisplay(tier: RiskTier): RiskTierInfo {
    return { tier, ...RISK_TIER_INFO[tier] };
}

/**
 * Get all risk tier options for legend/help
 */
export function getAllRiskTiers(): RiskTierInfo[] {
    return Object.entries(RISK_TIER_INFO).map(([tier, info]) => ({
        tier: tier as RiskTier,
        ...info,
    }));
}

/**
 * Format failure for display with severity color
 */
export function formatPotentialFailure(failure: PotentialFailure): {
    text: string;
    color: string;
    icon: string;
} {
    const colors = { low: 'yellow', medium: 'orange', high: 'red' };
    const icons = { low: '⚡', medium: '⚠️', high: '🚨' };

    const classInfo = failure.relatedFailureClass
        ? getFailureClassInfo(failure.relatedFailureClass)
        : null;

    return {
        text: `${failure.reason} (${failure.probability}% likelihood)`,
        color: colors[failure.severity],
        icon: classInfo?.icon || icons[failure.severity],
    };
}
