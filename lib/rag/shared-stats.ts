/**
 * Shared Statistics Module
 * 
 * Privacy-safe data sharing through aggregated, anonymized contrastive statistics.
 * Never shares raw data, embeddings, or identifiable information.
 */

import {
    SharedContrastStat,
    BlendedLift,
    SHARED_STATS_CONFIG,
} from './marketplace-types';
import { TraitEffect } from './types';
import { Platform, ObjectiveType } from '@/types';

// ============================================
// STAT GENERATION
// ============================================

/**
 * Generate a shared statistic from a trait effect.
 * Only generates if sample size meets privacy threshold.
 */
export function generateSharedStat(
    effect: TraitEffect,
    context: { platform?: Platform; objective?: ObjectiveType; format?: string } = {}
): SharedContrastStat | null {
    // Privacy check: don't share stats with too few samples
    if (effect.n_with + effect.n_without < SHARED_STATS_CONFIG.minSamplesForSharing) {
        return null;
    }

    // Don't share low-confidence stats
    if (effect.confidence < 30) {
        return null;
    }

    return {
        trait: effect.trait,
        context,
        avgLift: effect.lift,
        variance: Math.abs(effect.avgSuccessWith - effect.avgSuccessWithout) / 2, // Approximate
        confidence: effect.confidence,
        sampleSize: effect.n_with + effect.n_without,
        minContributors: 1, // Would be aggregated in production
        aggregatedAt: new Date().toISOString(),
    };
}

/**
 * Generate shared stats from multiple trait effects.
 * Filters by privacy thresholds.
 */
export function generateSharedStats(
    effects: TraitEffect[],
    context: { platform?: Platform; objective?: ObjectiveType; format?: string } = {}
): SharedContrastStat[] {
    const stats: SharedContrastStat[] = [];

    for (const effect of effects) {
        const stat = generateSharedStat(effect, context);
        if (stat) {
            stats.push(stat);
        }
    }

    return stats;
}

// ============================================
// STAT BLENDING
// ============================================

/**
 * Blend local lift with shared lift.
 * Formula: finalLift = alpha * localLift + (1 - alpha) * sharedLift
 * Where alpha = localConfidence / 100 (clamped)
 */
export function blendWithSharedData(
    localLift: number,
    sharedLift: number,
    localConfidence: number,
    allowSharedOnly: boolean = false
): BlendedLift {
    // Calculate alpha based on local confidence
    let alpha = Math.min(1, Math.max(0, localConfidence / 100));

    // Cap shared data influence
    const maxSharedWeight = SHARED_STATS_CONFIG.maxAlphaForSharedData;
    if ((1 - alpha) > maxSharedWeight && !allowSharedOnly) {
        alpha = 1 - maxSharedWeight;
    }

    const blendedLift = alpha * localLift + (1 - alpha) * sharedLift;

    return {
        trait: '', // Set by caller
        localLift,
        sharedLift,
        blendedLift,
        alpha,
        usingSharedData: alpha < 1,
    };
}

/**
 * Blend a trait effect with a shared stat.
 */
export function blendTraitEffect(
    effect: TraitEffect,
    sharedStat: SharedContrastStat | null
): BlendedLift {
    if (!sharedStat) {
        // No shared data, use local only
        return {
            trait: effect.trait,
            localLift: effect.lift,
            sharedLift: 0,
            blendedLift: effect.lift,
            alpha: 1,
            usingSharedData: false,
        };
    }

    // Check if shared stat has enough contributors
    if (sharedStat.minContributors < SHARED_STATS_CONFIG.minContributorsForUse) {
        return {
            trait: effect.trait,
            localLift: effect.lift,
            sharedLift: sharedStat.avgLift,
            blendedLift: effect.lift,
            alpha: 1,
            usingSharedData: false,
        };
    }

    const blended = blendWithSharedData(effect.lift, sharedStat.avgLift, effect.confidence);

    return {
        ...blended,
        trait: effect.trait,
    };
}

/**
 * Blend all trait effects with available shared stats.
 */
export function blendAllTraitEffects(
    effects: TraitEffect[],
    sharedStats: SharedContrastStat[]
): BlendedLift[] {
    // Create lookup map for shared stats
    const sharedMap = new Map<string, SharedContrastStat>();
    for (const stat of sharedStats) {
        sharedMap.set(stat.trait.toLowerCase(), stat);
    }

    return effects.map(effect => {
        const sharedStat = sharedMap.get(effect.trait.toLowerCase());
        return blendTraitEffect(effect, sharedStat || null);
    });
}

// ============================================
// STAT AGGREGATION (for server-side use)
// ============================================

/**
 * Aggregate multiple shared stats into one.
 * Used to combine stats from multiple contributors.
 */
export function aggregateSharedStats(
    stats: SharedContrastStat[]
): SharedContrastStat | null {
    if (stats.length === 0) return null;

    // Weighted average by sample size
    let totalSamples = 0;
    let weightedLiftSum = 0;
    let weightedVarianceSum = 0;
    let weightedConfidenceSum = 0;

    const uniqueContributors = new Set<string>();

    for (const stat of stats) {
        const weight = stat.sampleSize;
        totalSamples += weight;
        weightedLiftSum += stat.avgLift * weight;
        weightedVarianceSum += stat.variance * weight;
        weightedConfidenceSum += stat.confidence * weight;

        // Track contributors (would use actual contributor IDs in production)
        uniqueContributors.add(stat.aggregatedAt);
    }

    if (totalSamples === 0) return null;

    return {
        trait: stats[0].trait,
        context: stats[0].context,
        avgLift: weightedLiftSum / totalSamples,
        variance: weightedVarianceSum / totalSamples,
        confidence: weightedConfidenceSum / totalSamples,
        sampleSize: totalSamples,
        minContributors: uniqueContributors.size,
        aggregatedAt: new Date().toISOString(),
    };
}

// ============================================
// PRIVACY HELPERS
// ============================================

/**
 * Check if local data meets threshold for contributing
 */
export function canContribute(localSamples: number): boolean {
    return localSamples >= SHARED_STATS_CONFIG.minSamplesForSharing;
}

/**
 * Check if shared stat is usable
 */
export function canUseSharedStat(stat: SharedContrastStat): boolean {
    return stat.minContributors >= SHARED_STATS_CONFIG.minContributorsForUse;
}

/**
 * Anonymize a shared stat by removing potentially identifying context
 */
export function anonymizeStat(stat: SharedContrastStat): SharedContrastStat {
    return {
        ...stat,
        // Keep broad context, remove specific details
        context: {
            platform: stat.context.platform,
            // Remove objective and format to increase anonymity
        },
        // Round numbers to reduce precision
        avgLift: Math.round(stat.avgLift * 10) / 10,
        variance: Math.round(stat.variance * 10) / 10,
        confidence: Math.round(stat.confidence),
    };
}

// ============================================
// STORAGE (client-side simulation)
// ============================================

const SHARED_STATS_KEY = 'athena_shared_stats';

/**
 * Save shared stats to local storage (for testing)
 */
export function saveSharedStats(stats: SharedContrastStat[]): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(SHARED_STATS_KEY, JSON.stringify({
            stats,
            savedAt: new Date().toISOString(),
        }));
    } catch (e) {
        console.warn('Failed to save shared stats:', e);
    }
}

/**
 * Load shared stats from local storage (for testing)
 */
export function loadSharedStats(): SharedContrastStat[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(SHARED_STATS_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        return parsed.stats || [];
    } catch (e) {
        console.warn('Failed to load shared stats:', e);
        return [];
    }
}

/**
 * Get shared stat for a specific trait
 */
export function getSharedStatForTrait(
    trait: string,
    context?: { platform?: Platform }
): SharedContrastStat | null {
    const stats = loadSharedStats();

    // Find best matching stat
    const exactMatch = stats.find(s =>
        s.trait.toLowerCase() === trait.toLowerCase() &&
        (!context?.platform || s.context.platform === context.platform)
    );

    if (exactMatch) return exactMatch;

    // Try without platform context
    return stats.find(s => s.trait.toLowerCase() === trait.toLowerCase()) || null;
}
