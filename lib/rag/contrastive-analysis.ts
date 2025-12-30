/**
 * Contrastive Trait Analysis Module
 * 
 * Core RAG functionality: splits neighbors into WITH/WITHOUT groups
 * for each trait and calculates lift (success difference).
 * This replaces "trait splitting" with retrieval-based counterfactual reasoning.
 */

import { AdOrb, NeighborAd, TraitEffect, ContrastiveAnalysis, DEFAULT_RAG_CONFIG } from './types';
import { getOrbSuccessScore, orbHasTrait } from './ad-orb';
import { SAFETY_CONFIG, clampLift } from './safety-config';

// ============================================
// TRAIT SPLITTING
// ============================================

/**
 * Split neighbors into WITH and WITHOUT groups for a trait
 */
export function splitByTrait(
    neighbors: NeighborAd[],
    traitKey: string,
    traitValue?: string | number | boolean
): {
    with: NeighborAd[];
    without: NeighborAd[];
} {
    const withTrait: NeighborAd[] = [];
    const withoutTrait: NeighborAd[] = [];

    for (const neighbor of neighbors) {
        if (orbHasTrait(neighbor.orb, traitKey, traitValue)) {
            withTrait.push(neighbor);
        } else {
            withoutTrait.push(neighbor);
        }
    }

    return { with: withTrait, without: withoutTrait };
}

// ============================================
// LIFT CALCULATION
// ============================================

/**
 * Calculate weighted average success score for a group
 * Weights by similarity and recency
 */
function calculateWeightedAverage(neighbors: NeighborAd[]): number {
    if (neighbors.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const neighbor of neighbors) {
        const score = getOrbSuccessScore(neighbor.orb);
        if (score !== undefined) {
            const weight = neighbor.weightedSimilarity;
            weightedSum += score * weight;
            totalWeight += weight;
        }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Compute lift for a trait
 * lift = avg(success_with) - avg(success_without)
 */
export function computeLift(
    withGroup: NeighborAd[],
    withoutGroup: NeighborAd[]
): { lift: number; avgWith: number; avgWithout: number } {
    const avgWith = calculateWeightedAverage(withGroup);
    const avgWithout = calculateWeightedAverage(withoutGroup);
    const lift = avgWith - avgWithout;

    return { lift, avgWith, avgWithout };
}

/**
 * Calculate confidence score for a trait effect
 * Based on sample sizes and variance
 */
function calculateTraitConfidence(
    withGroup: NeighborAd[],
    withoutGroup: NeighborAd[],
    minSampleSize: number
): number {
    const nWith = withGroup.filter(n => getOrbSuccessScore(n.orb) !== undefined).length;
    const nWithout = withoutGroup.filter(n => getOrbSuccessScore(n.orb) !== undefined).length;

    // Base confidence from sample sizes
    let confidence = 0;

    // Need at least minSampleSize in each group for any confidence
    if (nWith < minSampleSize || nWithout < minSampleSize) {
        confidence = (nWith + nWithout) / (minSampleSize * 4) * 50; // Max 50% if imbalanced
    } else {
        // Full confidence calculation
        const totalSamples = nWith + nWithout;
        const sampleFactor = Math.min(1, totalSamples / 20); // Max at 20 samples

        // Balance factor - prefer balanced groups
        const balance = Math.min(nWith, nWithout) / Math.max(nWith, nWithout);
        const balanceFactor = 0.5 + balance * 0.5; // Range 0.5-1.0

        confidence = sampleFactor * balanceFactor * 100;
    }

    // Factor in average similarity
    const avgSimilarity = [...withGroup, ...withoutGroup]
        .reduce((sum, n) => sum + n.hybridSimilarity, 0) /
        Math.max(1, withGroup.length + withoutGroup.length);

    confidence *= avgSimilarity;

    return Math.round(Math.min(100, Math.max(0, confidence)));
}

/**
 * Determine recommendation based on lift and confidence
 */
function getRecommendation(
    lift: number,
    confidence: number,
    significanceThreshold: number
): TraitEffect['recommendation'] {
    if (confidence < 40) {
        return 'test'; // Not enough data
    }

    if (Math.abs(lift) < significanceThreshold) {
        return 'neutral'; // Lift is too small to matter
    }

    return lift > 0 ? 'use' : 'avoid';
}

// ============================================
// FULL TRAIT EFFECT ANALYSIS
// ============================================

/**
 * Analyze the effect of a single trait
 */
export function analyzeTraitEffect(
    neighbors: NeighborAd[],
    traitKey: string,
    traitValue?: string | number | boolean,
    config = DEFAULT_RAG_CONFIG
): TraitEffect {
    const { with: withGroup, without: withoutGroup } = splitByTrait(
        neighbors,
        traitKey,
        traitValue
    );

    const nWith = withGroup.filter(n => getOrbSuccessScore(n.orb) !== undefined).length;
    const nWithout = withoutGroup.filter(n => getOrbSuccessScore(n.orb) !== undefined).length;

    // SAFETY: Early return for insufficient sample sizes
    // Returns "insufficient evidence" result instead of potentially misleading data
    if (nWith < SAFETY_CONFIG.minSampleSizePerGroup || nWithout < SAFETY_CONFIG.minSampleSizePerGroup) {
        return {
            trait: traitKey,
            traitValue: traitValue ?? true,
            lift: 0,
            liftPercent: 0,
            confidence: Math.min(nWith + nWithout, 30), // Low confidence based on available data
            n_with: nWith,
            n_without: nWithout,
            avgSuccessWith: 0,
            avgSuccessWithout: 0,
            isSignificant: false,
            recommendation: 'test', // Recommend testing - insufficient evidence
        };
    }

    const { lift, avgWith, avgWithout } = computeLift(withGroup, withoutGroup);

    // SAFETY: Clamp lift values to prevent outliers
    const clampedLift = clampLift(lift);

    const confidence = calculateTraitConfidence(withGroup, withoutGroup, config.minSampleSize);
    const isSignificant = nWith >= config.minSampleSize &&
        nWithout >= config.minSampleSize &&
        Math.abs(clampedLift) >= config.significanceThreshold;

    const liftPercent = avgWithout > 0 ? (clampedLift / avgWithout) * 100 : 0;
    const recommendation = getRecommendation(clampedLift, confidence, config.significanceThreshold);

    return {
        trait: traitKey,
        traitValue: traitValue ?? true,
        lift: clampedLift,
        liftPercent: Number.isFinite(liftPercent) ? liftPercent : 0,
        confidence,
        n_with: nWith,
        n_without: nWithout,
        avgSuccessWith: avgWith,
        avgSuccessWithout: avgWithout,
        isSignificant,
        recommendation,
    };
}

/**
 * Extract all unique trait keys from neighbors
 */
function extractTraitKeys(neighbors: NeighborAd[]): Set<string> {
    const keys = new Set<string>();

    for (const neighbor of neighbors) {
        for (const key of Object.keys(neighbor.orb.traits)) {
            keys.add(key);
        }
    }

    return keys;
}

/**
 * Analyze effects for all traits found in neighbors
 */
export function analyzeAllTraitEffects(
    neighbors: NeighborAd[],
    config = DEFAULT_RAG_CONFIG
): TraitEffect[] {
    const traitKeys = extractTraitKeys(neighbors);
    const effects: TraitEffect[] = [];

    for (const key of traitKeys) {
        // For boolean traits, just analyze presence
        const sampleOrb = neighbors[0]?.orb;
        if (!sampleOrb) continue;

        const sampleValue = sampleOrb.traits[key];

        if (typeof sampleValue === 'boolean') {
            // Analyze boolean trait (presence vs absence)
            effects.push(analyzeTraitEffect(neighbors, key, true, config));
        } else if (typeof sampleValue === 'string') {
            // For string traits, analyze each unique value
            const uniqueValues = new Set<string>();
            for (const n of neighbors) {
                const val = n.orb.traits[key];
                if (typeof val === 'string') {
                    uniqueValues.add(val);
                }
            }

            for (const value of uniqueValues) {
                effects.push(analyzeTraitEffect(neighbors, key, value, config));
            }
        } else if (typeof sampleValue === 'number') {
            // For numeric traits, analyze above/below median
            effects.push(analyzeTraitEffect(neighbors, key, undefined, config));
        }
    }

    return effects;
}

/**
 * Analyze specific traits (for a query ad)
 */
export function analyzeQueryTraitEffects(
    queryOrb: AdOrb,
    neighbors: NeighborAd[],
    config = DEFAULT_RAG_CONFIG
): TraitEffect[] {
    const effects: TraitEffect[] = [];

    for (const [key, value] of Object.entries(queryOrb.traits)) {
        if (value !== undefined && value !== null && value !== '') {
            effects.push(analyzeTraitEffect(neighbors, key, value, config));
        }
    }

    return effects;
}

// ============================================
// FULL CONTRASTIVE ANALYSIS
// ============================================

/**
 * Perform full contrastive analysis on neighbors
 */
export function performContrastiveAnalysis(
    queryOrb: AdOrb,
    neighbors: NeighborAd[],
    config = DEFAULT_RAG_CONFIG
): ContrastiveAnalysis {
    // Analyze effects for query ad's traits
    const traitEffects = analyzeQueryTraitEffects(queryOrb, neighbors, config);

    // Sort by absolute lift
    const sortedByLift = [...traitEffects].sort(
        (a, b) => Math.abs(b.lift) - Math.abs(a.lift)
    );

    // Separate into positive, negative, and low confidence
    const topPositive = sortedByLift
        .filter(e => e.lift > 0 && e.isSignificant)
        .slice(0, 5);

    const topNegative = sortedByLift
        .filter(e => e.lift < 0 && e.isSignificant)
        .slice(0, 5);

    const lowConfidence = traitEffects.filter(e => e.confidence < 40);

    // Calculate average similarity
    const avgSimilarity = neighbors.length > 0
        ? neighbors.reduce((sum, n) => sum + n.hybridSimilarity, 0) / neighbors.length
        : 0;

    return {
        traitEffects,
        topPositive,
        topNegative,
        lowConfidence,
        totalNeighbors: neighbors.length,
        avgSimilarity,
    };
}

/**
 * Get top N most impactful traits (positive or negative)
 */
export function getTopImpactfulTraits(
    analysis: ContrastiveAnalysis,
    n: number = 5
): TraitEffect[] {
    return [...analysis.traitEffects]
        .filter(e => e.isSignificant)
        .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
        .slice(0, n);
}

/**
 * Get traits that need more data for reliable analysis
 */
export function getTraitsNeedingMoreData(
    analysis: ContrastiveAnalysis,
    minConfidenceThreshold: number = 40
): TraitEffect[] {
    return analysis.traitEffects.filter(e => e.confidence < minConfidenceThreshold);
}
