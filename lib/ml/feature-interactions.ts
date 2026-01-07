/**
 * Feature Interactions Module
 * 
 * Generates interaction features for ML predictions.
 * Interaction features capture combined effects that single features miss,
 * such as "Hook × Platform" or "UGC × Audience Type".
 * 
 * @module lib/ml/feature-interactions
 */

import type { ExtractedAdData, Platform, HookType, AudienceType } from '@/types';

// ============================================
// TYPES
// ============================================

export interface InteractionFeature {
    name: string;
    value: number;
    components: string[];
    importance: number;
}

export interface FeatureInteractionResult {
    interactions: InteractionFeature[];
    interactionVector: number[];
    featureNames: string[];
}

export interface FeatureImportance {
    feature: string;
    importance: number;
    correlation: number;
    sampleSize: number;
}

// ============================================
// INTERACTION DEFINITIONS
// ============================================

/**
 * Platform × Hook interaction weights
 * Based on empirical observation that certain hooks work better on specific platforms
 */
const PLATFORM_HOOK_INTERACTIONS: Record<string, Record<string, number>> = {
    tiktok: {
        curiosity: 0.95,
        shock: 0.90,
        challenge: 0.85,
        question: 0.80,
        story: 0.70,
        testimonial: 0.60,
        other: 0.50,
    },
    instagram: {
        transformation: 0.90,
        before_after: 0.88,
        testimonial: 0.85,
        curiosity: 0.80,
        story: 0.75,
        other: 0.50,
    },
    facebook: {
        testimonial: 0.85,
        problem_solution: 0.80,
        story: 0.78,
        statistic: 0.75,
        curiosity: 0.70,
        other: 0.50,
    },
    youtube: {
        story: 0.88,
        educational: 0.85,
        question: 0.80,
        curiosity: 0.78,
        other: 0.50,
    },
};

/**
 * UGC × Audience interaction weights
 * UGC performs differently for cold vs warm audiences
 */
const UGC_AUDIENCE_INTERACTIONS: Record<string, { ugc: number; professional: number }> = {
    cold: { ugc: 0.85, professional: 0.60 },
    warm: { ugc: 0.90, professional: 0.75 },
    retargeting: { ugc: 0.80, professional: 0.85 },
    lookalike: { ugc: 0.88, professional: 0.70 },
    custom: { ugc: 0.82, professional: 0.72 },
};

/**
 * Content Category × Platform interactions
 */
const CONTENT_PLATFORM_INTERACTIONS: Record<string, Record<string, number>> = {
    tiktok: {
        ugc: 0.95,
        entertainment: 0.90,
        tutorial: 0.80,
        product_demo: 0.70,
        testimonial: 0.75,
        other: 0.50,
    },
    instagram: {
        lifestyle: 0.90,
        ugc: 0.85,
        influencer: 0.88,
        behind_the_scenes: 0.80,
        product_demo: 0.75,
        other: 0.50,
    },
    facebook: {
        testimonial: 0.85,
        educational: 0.80,
        product_demo: 0.78,
        comparison: 0.75,
        other: 0.50,
    },
};

/**
 * Duration × Platform interactions
 * Different platforms have different optimal durations
 */
const DURATION_PLATFORM_INTERACTIONS: Record<string, Record<string, number>> = {
    tiktok: {
        under_15s: 0.90,
        '15_30s': 0.85,
        '30_60s': 0.60,
        over_60s: 0.40,
    },
    instagram: {
        under_15s: 0.85,
        '15_30s': 0.90,
        '30_60s': 0.70,
        over_60s: 0.50,
    },
    facebook: {
        under_15s: 0.70,
        '15_30s': 0.85,
        '30_60s': 0.80,
        over_60s: 0.65,
    },
    youtube: {
        under_15s: 0.50,
        '15_30s': 0.70,
        '30_60s': 0.85,
        over_60s: 0.90,
    },
};

// ============================================
// INTERACTION GENERATORS
// ============================================

/**
 * Get Platform × Hook interaction value
 */
export function getPlatformHookInteraction(
    platform: Platform,
    hookType: HookType
): InteractionFeature {
    const platformWeights = PLATFORM_HOOK_INTERACTIONS[platform] || PLATFORM_HOOK_INTERACTIONS.facebook;
    const value = platformWeights[hookType] ?? 0.5;

    return {
        name: `${platform}_x_${hookType}`,
        value,
        components: [platform, hookType],
        importance: 0.85, // High importance - platform-hook fit is critical
    };
}

/**
 * Get UGC × Audience interaction value
 */
export function getUGCAudienceInteraction(
    isUGC: boolean,
    audienceType: AudienceType = 'cold'
): InteractionFeature {
    const audienceWeights = UGC_AUDIENCE_INTERACTIONS[audienceType] || UGC_AUDIENCE_INTERACTIONS.cold;
    const value = isUGC ? audienceWeights.ugc : audienceWeights.professional;

    return {
        name: `${isUGC ? 'ugc' : 'professional'}_x_${audienceType}`,
        value,
        components: [isUGC ? 'ugc' : 'professional', audienceType],
        importance: 0.75,
    };
}

/**
 * Get Content × Platform interaction value
 */
export function getContentPlatformInteraction(
    platform: Platform,
    contentCategory: string
): InteractionFeature {
    const platformWeights = CONTENT_PLATFORM_INTERACTIONS[platform] || {};
    const value = platformWeights[contentCategory] ?? 0.5;

    return {
        name: `${platform}_x_${contentCategory}`,
        value,
        components: [platform, contentCategory],
        importance: 0.70,
    };
}

/**
 * Get Duration × Platform interaction value
 */
export function getDurationPlatformInteraction(
    platform: Platform,
    durationCategory: string
): InteractionFeature {
    const platformWeights = DURATION_PLATFORM_INTERACTIONS[platform] || DURATION_PLATFORM_INTERACTIONS.facebook;
    const value = platformWeights[durationCategory] ?? 0.6;

    return {
        name: `${platform}_x_${durationCategory}`,
        value,
        components: [platform, durationCategory],
        importance: 0.65,
    };
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

/**
 * Extract all interaction features from ad data
 * Returns both individual features and a combined vector for ML input
 */
export function extractInteractionFeatures(adData: Partial<ExtractedAdData>): FeatureInteractionResult {
    const interactions: InteractionFeature[] = [];

    // Platform × Hook
    if (adData.platform && adData.hookType) {
        interactions.push(getPlatformHookInteraction(adData.platform, adData.hookType));
    }

    // UGC × Audience
    if (adData.isUGCStyle !== undefined) {
        interactions.push(getUGCAudienceInteraction(
            adData.isUGCStyle,
            adData.audienceType || 'cold'
        ));
    }

    // Content × Platform
    if (adData.platform && adData.contentCategory) {
        interactions.push(getContentPlatformInteraction(
            adData.platform,
            adData.contentCategory
        ));
    }

    // Duration × Platform
    if (adData.platform && adData.durationCategory) {
        interactions.push(getDurationPlatformInteraction(
            adData.platform,
            adData.durationCategory
        ));
    }

    // Fill missing interactions with neutral values
    while (interactions.length < 4) {
        interactions.push({
            name: 'unknown_interaction',
            value: 0.5,
            components: ['unknown', 'unknown'],
            importance: 0,
        });
    }

    // Create normalized vector
    const interactionVector = interactions.map(i => i.value);
    const featureNames = interactions.map(i => i.name);

    return {
        interactions,
        interactionVector,
        featureNames,
    };
}

/**
 * Get interaction feature names for model input
 */
export function getInteractionFeatureNames(): string[] {
    return [
        'platform_x_hook',
        'style_x_audience',
        'content_x_platform',
        'duration_x_platform',
    ];
}

// ============================================
// FEATURE IMPORTANCE TRACKING
// ============================================

const IMPORTANCE_STORAGE_KEY = 'ml_feature_importance';

/**
 * Get stored feature importance rankings
 */
export function getFeatureImportance(): FeatureImportance[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(IMPORTANCE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : getDefaultImportance();
}

/**
 * Save feature importance rankings
 */
export function saveFeatureImportance(importance: FeatureImportance[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(IMPORTANCE_STORAGE_KEY, JSON.stringify(importance));
}

/**
 * Update feature importance based on prediction results
 */
export function updateFeatureImportance(
    featureName: string,
    correlation: number,
    sampleSize: number
): void {
    const importance = getFeatureImportance();
    const existing = importance.find(f => f.feature === featureName);

    if (existing) {
        // Weighted average update
        const totalSamples = existing.sampleSize + sampleSize;
        existing.correlation = (
            existing.correlation * existing.sampleSize +
            correlation * sampleSize
        ) / totalSamples;
        existing.sampleSize = totalSamples;
        existing.importance = Math.abs(existing.correlation) * 100;
    } else {
        importance.push({
            feature: featureName,
            importance: Math.abs(correlation) * 100,
            correlation,
            sampleSize,
        });
    }

    // Sort by importance
    importance.sort((a, b) => b.importance - a.importance);

    saveFeatureImportance(importance);
}

/**
 * Get default feature importance (initial values)
 */
function getDefaultImportance(): FeatureImportance[] {
    return [
        { feature: 'platform_x_hook', importance: 85, correlation: 0.85, sampleSize: 0 },
        { feature: 'isUGCStyle', importance: 80, correlation: 0.80, sampleSize: 0 },
        { feature: 'hasSubtitles', importance: 75, correlation: 0.75, sampleSize: 0 },
        { feature: 'style_x_audience', importance: 72, correlation: 0.72, sampleSize: 0 },
        { feature: 'hookType', importance: 70, correlation: 0.70, sampleSize: 0 },
        { feature: 'content_x_platform', importance: 68, correlation: 0.68, sampleSize: 0 },
        { feature: 'musicType', importance: 65, correlation: 0.65, sampleSize: 0 },
        { feature: 'duration_x_platform', importance: 62, correlation: 0.62, sampleSize: 0 },
        { feature: 'editingStyle', importance: 60, correlation: 0.60, sampleSize: 0 },
        { feature: 'platform', importance: 55, correlation: 0.55, sampleSize: 0 },
    ];
}

/**
 * Get top N most important features
 */
export function getTopFeatures(n: number = 10): FeatureImportance[] {
    return getFeatureImportance().slice(0, n);
}

/**
 * Reset feature importance to defaults
 */
export function resetFeatureImportance(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(IMPORTANCE_STORAGE_KEY);
}
