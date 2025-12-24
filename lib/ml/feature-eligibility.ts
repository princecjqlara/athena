// Feature Eligibility System
// Enforces pre-spend vs post-spend feature separation for valid causal predictions

import { ExtractedAdData } from '@/types';

// ============================================
// FEATURE CLASSIFICATION
// ============================================

// Pre-spend features - ALLOWED in predictions
// These are creative traits known BEFORE running the ad
export const PRE_SPEND_FEATURES = [
    // Media & Format
    'mediaType', 'aspectRatio', 'duration', 'durationCategory', 'adFormat',

    // Platform & Placement
    'platform', 'placement', 'industryVertical',

    // Creative Intelligence
    'hookType', 'hookText', 'hookVelocity', 'hookKeywords',
    'contentCategory', 'editingStyle', 'patternType',

    // Sentiment & Emotion
    'overallSentiment', 'emotionalTone',

    // Face & Visual
    'facePresence', 'numberOfFaces', 'facialEmotion',
    'hasTextOverlays', 'textOverlayRatio', 'textReadability', 'readabilityScore',
    'colorScheme', 'colorTemperature', 'brandVisualTiming',
    'safeZoneAdherence', 'visualAudioMismatch', 'visualStyle',
    'hasSubtitles', 'subtitleStyle',
    'saliencyMapScore', 'sceneVelocity', 'textToBackgroundContrast',
    'shotComposition', 'semanticCongruence', 'moodMatching',

    // Audio
    'musicType', 'bpm', 'hasVoiceover', 'voiceoverStyle',
    'silenceDetection', 'audioPeakTiming', 'audioDescription',

    // Script & Copy
    'script', 'painPointAddressing', 'painPoints',
    'cta', 'ctaText', 'ctaStrength', 'headlines',

    // Brand
    'logoConsistency', 'logoTiming', 'brandColorUsage',

    // Voice
    'voiceAuthorityScore', 'voiceGender', 'voiceAge', 'speechPace',

    // Engagement Triggers (predicted, not measured)
    'curiosityGap', 'socialProofElements', 'urgencyTriggers', 'trustSignals',

    // Talent
    'numberOfActors', 'talentType', 'isUGCStyle',

    // Custom
    'customTraits',
] as const;

// Post-spend features - BLOCKED from predictions
// These are metrics only known AFTER running the ad
export const POST_SPEND_FEATURES = [
    // Spend & Delivery
    'adSpend', 'spend', 'impressions', 'reach', 'frequency',

    // Clicks & Traffic
    'clicks', 'uniqueClicks', 'ctr', 'uniqueCtr', 'cpc', 'cpm', 'cpp',
    'linkClicks', 'uniqueLinkClicks', 'inlineLinkClicks',
    'landingPageViews', 'outboundClicks',
    'costPerLinkClick', 'costPerLandingPageView',

    // Engagement Results
    'likes', 'comments', 'shares', 'saves',
    'pageEngagement', 'postEngagement', 'postReactions',
    'postComments', 'postShares', 'postSaves', 'pageLikes',

    // Messaging
    'messages', 'messagesStarted', 'costPerMessage',

    // Conversions
    'conversions', 'conversionRate', 'revenue', 'roas',
    'leads', 'costPerLead', 'purchases', 'costPerPurchase',
    'purchaseValue', 'purchaseRoas',
    'addToCart', 'initiateCheckout', 'contentViews', 'completeRegistration',

    // Video Performance (post-run metrics)
    'videoViews', 'videoPlays', 'videoThruPlays',
    'video2SecViews', 'video25Watched', 'video50Watched',
    'video75Watched', 'video95Watched', 'video100Watched',
    'videoAvgWatchTime', 'costPerThruPlay',

    // Quality Rankings (assigned after running)
    'qualityRanking', 'engagementRateRanking', 'conversionRateRanking',

    // Ad Recall
    'estimatedAdRecallers', 'estimatedAdRecallRate',

    // Results
    'resultType', 'results', 'costPerResult',

    // Success Metrics
    'successRating', 'successScore', 'actualScore',
] as const;

// Type for feature eligibility
export type PreSpendFeature = typeof PRE_SPEND_FEATURES[number];
export type PostSpendFeature = typeof POST_SPEND_FEATURES[number];
export type FeatureEligibility = 'pre_spend' | 'post_spend' | 'unknown';

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Check if a feature is eligible for use in predictions
 */
export function isFeatureEligible(featureName: string): boolean {
    const normalizedName = featureName.toLowerCase().replace(/[-_\s]/g, '');
    const preSpendNormalized = PRE_SPEND_FEATURES.map(f =>
        f.toLowerCase().replace(/[-_\s]/g, '')
    );
    return preSpendNormalized.includes(normalizedName);
}

/**
 * Get the eligibility classification of a feature
 */
export function getFeatureEligibility(featureName: string): FeatureEligibility {
    const normalizedName = featureName.toLowerCase().replace(/[-_\s]/g, '');

    const preSpendNormalized = PRE_SPEND_FEATURES.map(f =>
        f.toLowerCase().replace(/[-_\s]/g, '')
    );
    const postSpendNormalized = POST_SPEND_FEATURES.map(f =>
        f.toLowerCase().replace(/[-_\s]/g, '')
    );

    if (preSpendNormalized.includes(normalizedName)) return 'pre_spend';
    if (postSpendNormalized.includes(normalizedName)) return 'post_spend';
    return 'unknown';
}

/**
 * Validation result for prediction input
 */
export interface FeatureValidationResult {
    isValid: boolean;
    eligibleFeatures: string[];
    blockedFeatures: string[];
    unknownFeatures: string[];
    warnings: string[];
}

/**
 * Validate prediction input and identify any post-spend features
 */
export function validatePredictionInput(
    features: Record<string, unknown>
): FeatureValidationResult {
    const eligibleFeatures: string[] = [];
    const blockedFeatures: string[] = [];
    const unknownFeatures: string[] = [];
    const warnings: string[] = [];

    for (const featureName of Object.keys(features)) {
        const eligibility = getFeatureEligibility(featureName);

        switch (eligibility) {
            case 'pre_spend':
                eligibleFeatures.push(featureName);
                break;
            case 'post_spend':
                blockedFeatures.push(featureName);
                warnings.push(
                    `Feature "${featureName}" is a post-spend metric and cannot be used for prediction. ` +
                    `This metric is only known after running the ad.`
                );
                break;
            case 'unknown':
                unknownFeatures.push(featureName);
                // Unknown features are allowed but flagged
                break;
        }
    }

    const isValid = blockedFeatures.length === 0;

    if (!isValid) {
        warnings.unshift(
            `⚠️ ${blockedFeatures.length} post-spend feature(s) detected in prediction input. ` +
            `These have been excluded to maintain causal validity.`
        );
    }

    return {
        isValid,
        eligibleFeatures,
        blockedFeatures,
        unknownFeatures,
        warnings,
    };
}

/**
 * Filter ExtractedAdData to only include eligible pre-spend features
 */
export function filterEligibleFeatures(
    adData: ExtractedAdData
): Partial<ExtractedAdData> {
    const filtered: Partial<ExtractedAdData> = {};

    for (const [key, value] of Object.entries(adData)) {
        if (isFeatureEligible(key)) {
            (filtered as Record<string, unknown>)[key] = value;
        }
    }

    return filtered;
}

/**
 * Get a summary of feature eligibility for display in UI
 */
export function getFeatureEligibilitySummary(): {
    preSpendCount: number;
    postSpendCount: number;
    preSpendCategories: Record<string, string[]>;
    postSpendCategories: Record<string, string[]>;
} {
    return {
        preSpendCount: PRE_SPEND_FEATURES.length,
        postSpendCount: POST_SPEND_FEATURES.length,
        preSpendCategories: {
            'Media & Format': ['mediaType', 'aspectRatio', 'duration', 'adFormat'],
            'Creative Style': ['hookType', 'editingStyle', 'contentCategory', 'colorScheme'],
            'Audio': ['musicType', 'hasVoiceover', 'bpm'],
            'Visual': ['hasSubtitles', 'hasTextOverlays', 'facePresence'],
            'Talent': ['numberOfActors', 'isUGCStyle', 'talentType'],
            'Script': ['cta', 'ctaStrength', 'script'],
        },
        postSpendCategories: {
            'Spend': ['adSpend', 'spend', 'cpm', 'cpc'],
            'Delivery': ['impressions', 'reach', 'frequency'],
            'Engagement': ['clicks', 'likes', 'comments', 'shares'],
            'Conversions': ['conversions', 'revenue', 'roas', 'leads'],
            'Rankings': ['qualityRanking', 'engagementRateRanking'],
        },
    };
}

// ============================================
// LOGGING FOR DEVELOPMENT
// ============================================

/**
 * Log feature eligibility violations (for debugging)
 */
export function logFeatureViolations(
    validationResult: FeatureValidationResult
): void {
    if (!validationResult.isValid) {
        console.warn('[FEATURE ELIGIBILITY] Post-spend features detected in prediction:');
        validationResult.blockedFeatures.forEach(f => {
            console.warn(`  - ${f} (blocked)`);
        });
    }

    if (validationResult.unknownFeatures.length > 0) {
        console.info('[FEATURE ELIGIBILITY] Unknown features (allowed but unclassified):');
        validationResult.unknownFeatures.forEach(f => {
            console.info(`  - ${f}`);
        });
    }
}
