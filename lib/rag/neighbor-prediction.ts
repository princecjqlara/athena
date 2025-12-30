/**
 * Neighbor-Based Prediction Module
 * 
 * Computes weighted predictions from neighbors and confidence scores.
 */

import { NeighborAd, DEFAULT_RAG_CONFIG, RAGConfig } from './types';
import { getOrbSuccessScore } from './ad-orb';
import { clampScore } from './safety-config';

// ============================================
// WEIGHTED PREDICTION
// ============================================

/**
 * Compute similarity-weighted prediction from neighbors
 * Uses weightedSimilarity (hybrid * recency) as weight
 */
export function computeWeightedPrediction(neighbors: NeighborAd[]): number {
    if (neighbors.length === 0) {
        return 0;
    }

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

    if (totalWeight === 0) {
        return 50; // Safe default when no valid weights
    }

    const result = weightedSum / totalWeight;

    // Guard against NaN/Infinity and clamp to valid range
    if (!Number.isFinite(result)) {
        return 50; // Safe default
    }

    return clampScore(result);
}

/**
 * Compute simple average prediction (unweighted)
 */
export function computeSimpleAveragePrediction(neighbors: NeighborAd[]): number {
    const scores = neighbors
        .map(n => getOrbSuccessScore(n.orb))
        .filter((s): s is number => s !== undefined);

    if (scores.length === 0) {
        return 50; // Safe default when no scores
    }

    const result = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Guard against NaN/Infinity and clamp to valid range
    if (!Number.isFinite(result)) {
        return 50; // Safe default
    }

    return clampScore(result);
}

// ============================================
// VARIANCE CALCULATION
// ============================================

/**
 * Compute variance of success scores among neighbors
 * Higher variance = less confident prediction
 */
export function computeVariance(neighbors: NeighborAd[]): number {
    const scores = neighbors
        .map(n => getOrbSuccessScore(n.orb))
        .filter((s): s is number => s !== undefined);

    if (scores.length < 2) {
        return 0;
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (scores.length - 1);

    return Math.sqrt(variance); // Return standard deviation
}

/**
 * Compute range (max - min) of success scores
 */
export function computeScoreRange(neighbors: NeighborAd[]): { min: number; max: number; range: number } {
    const scores = neighbors
        .map(n => getOrbSuccessScore(n.orb))
        .filter((s): s is number => s !== undefined);

    if (scores.length === 0) {
        return { min: 0, max: 0, range: 0 };
    }

    const min = Math.min(...scores);
    const max = Math.max(...scores);

    return { min, max, range: max - min };
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

/**
 * Compute confidence score for RAG prediction
 * Based on: neighbor count, average similarity, variance
 */
export function computeConfidence(
    neighbors: NeighborAd[],
    config: RAGConfig = DEFAULT_RAG_CONFIG
): number {
    if (neighbors.length === 0) {
        return 0;
    }

    const validNeighbors = neighbors.filter(n => getOrbSuccessScore(n.orb) !== undefined);
    if (validNeighbors.length === 0) {
        return 0;
    }

    // Factor 1: Sample size (more neighbors = more confident)
    // 0-5: low, 5-10: medium, 10-20: good, 20+: high
    const sampleFactor = Math.min(1, validNeighbors.length / 15);

    // Factor 2: Average similarity (higher = more confident)
    const avgSimilarity = validNeighbors.reduce((sum, n) => sum + n.hybridSimilarity, 0) / validNeighbors.length;
    const similarityFactor = avgSimilarity;

    // Factor 3: Variance penalty (higher variance = less confident)
    let varianceFactor = 1;
    if (config.variancePenaltyEnabled) {
        const stdDev = computeVariance(validNeighbors);
        if (stdDev > config.maxVarianceForFullConfidence) {
            varianceFactor = config.maxVarianceForFullConfidence / stdDev;
        }
    }

    // Factor 4: Recency (more recent neighbors = more confident)
    const avgRecency = validNeighbors.reduce((sum, n) => sum + n.recencyWeight, 0) / validNeighbors.length;
    const recencyFactor = avgRecency;

    // Combine factors with weights
    const confidence = (
        sampleFactor * 0.35 +
        similarityFactor * 0.35 +
        varianceFactor * 0.15 +
        recencyFactor * 0.15
    ) * 100;

    return Math.round(Math.min(100, Math.max(0, confidence)));
}

// ============================================
// ALPHA CALCULATION (BLEND WEIGHT)
// ============================================

/**
 * Calculate blend alpha for hybrid prediction
 * alpha = weight given to RAG score vs legacy score
 * Higher when: more neighbors, higher similarity, lower variance
 */
export function calculateBlendAlpha(
    neighbors: NeighborAd[],
    config: RAGConfig = DEFAULT_RAG_CONFIG
): number {
    let alpha = config.baseAlpha;

    if (!config.alphaAdjustForNeighbors && !config.alphaAdjustForSimilarity) {
        return alpha;
    }

    const validNeighbors = neighbors.filter(n => getOrbSuccessScore(n.orb) !== undefined);

    if (validNeighbors.length < config.minNeighbors) {
        return 0; // Fall back to legacy entirely
    }

    // Adjust for neighbor count
    if (config.alphaAdjustForNeighbors) {
        const neighborFactor = Math.min(1, validNeighbors.length / 15);
        alpha *= (0.5 + neighborFactor * 0.5); // Range: 0.5-1.0 of base
    }

    // Adjust for similarity
    if (config.alphaAdjustForSimilarity) {
        const avgSimilarity = validNeighbors.reduce((sum, n) => sum + n.hybridSimilarity, 0) / validNeighbors.length;
        if (avgSimilarity < config.minSimilarity) {
            alpha *= 0.5; // Halve alpha if low similarity
        } else {
            alpha *= (0.7 + avgSimilarity * 0.3); // Range: 0.7-1.0 of current
        }
    }

    // Adjust for variance
    if (config.variancePenaltyEnabled) {
        const stdDev = computeVariance(validNeighbors);
        if (stdDev > config.maxVarianceForFullConfidence * 2) {
            alpha *= 0.7; // High variance reduces trust in RAG
        }
    }

    return Math.max(0, Math.min(1, alpha));
}

// ============================================
// PREDICTION BOUNDS
// ============================================

/**
 * Get prediction bounds (confidence interval)
 */
export function getPredictionBounds(
    neighbors: NeighborAd[],
    prediction: number
): { lower: number; upper: number } {
    const stdDev = computeVariance(neighbors);
    const { min, max } = computeScoreRange(neighbors);

    // Use tighter bounds if we have good data
    const bound = neighbors.length >= 10
        ? stdDev * 1.5  // ~87% confidence interval
        : stdDev * 2;    // ~95% confidence interval

    return {
        lower: Math.max(0, Math.max(min, prediction - bound)),
        upper: Math.min(100, Math.min(max, prediction + bound)),
    };
}

// ============================================
// FULL NEIGHBOR PREDICTION
// ============================================

/**
 * Full neighbor-based prediction with all metadata
 */
export function computeNeighborPrediction(
    neighbors: NeighborAd[],
    config: RAGConfig = DEFAULT_RAG_CONFIG
): {
    prediction: number;
    confidence: number;
    variance: number;
    bounds: { lower: number; upper: number };
    sampleSize: number;
    avgSimilarity: number;
    avgRecency: number;
} {
    const validNeighbors = neighbors.filter(n => getOrbSuccessScore(n.orb) !== undefined);

    if (validNeighbors.length === 0) {
        return {
            prediction: 0,
            confidence: 0,
            variance: 0,
            bounds: { lower: 0, upper: 0 },
            sampleSize: 0,
            avgSimilarity: 0,
            avgRecency: 0,
        };
    }

    const prediction = computeWeightedPrediction(validNeighbors);
    const confidence = computeConfidence(validNeighbors, config);
    const variance = computeVariance(validNeighbors);
    const bounds = getPredictionBounds(validNeighbors, prediction);

    const avgSimilarity = validNeighbors.reduce((sum, n) => sum + n.hybridSimilarity, 0) / validNeighbors.length;
    const avgRecency = validNeighbors.reduce((sum, n) => sum + n.recencyWeight, 0) / validNeighbors.length;

    return {
        prediction: Math.round(prediction * 10) / 10,
        confidence,
        variance: Math.round(variance * 10) / 10,
        bounds: {
            lower: Math.round(bounds.lower * 10) / 10,
            upper: Math.round(bounds.upper * 10) / 10,
        },
        sampleSize: validNeighbors.length,
        avgSimilarity: Math.round(avgSimilarity * 100) / 100,
        avgRecency: Math.round(avgRecency * 100) / 100,
    };
}

// ============================================
// CONTRASTIVE ADJUSTMENT
// ============================================

/**
 * Apply contrastive analysis adjustments to base prediction
 * 
 * Adjusts the neighbor-based prediction based on trait effects:
 * - Positive lifts increase prediction
 * - Negative lifts decrease prediction
 * - Adjustments are confidence-weighted
 */
export function applyContrastiveAdjustment(
    basePrediction: number,
    analysis: { topPositive: { lift: number; confidence: number }[]; topNegative: { lift: number; confidence: number }[] }
): number {
    if (!analysis) {
        return basePrediction;
    }

    let adjustment = 0;

    // Apply positive trait effects (confidence-weighted)
    for (const effect of analysis.topPositive) {
        const confidenceWeight = effect.confidence / 100;
        adjustment += effect.lift * confidenceWeight * 0.5; // Dampen effect
    }

    // Apply negative trait effects (confidence-weighted)
    for (const effect of analysis.topNegative) {
        const confidenceWeight = effect.confidence / 100;
        adjustment += effect.lift * confidenceWeight * 0.5; // lift is already negative
    }

    // Apply adjustment with bounds
    const adjusted = basePrediction + adjustment;

    return clampScore(adjusted);
}
