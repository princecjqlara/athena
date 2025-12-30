/**
 * Data Needs Detection Module
 * 
 * Analyzes prediction results to identify coverage gaps and missing data.
 * Generates DataNeed objects when prediction confidence is low due to:
 * - Insufficient neighbors
 * - Low similarity scores
 * - High outcome variance
 * - Low trait confidence
 */

import {
    DataNeed,
    GapAnalysis,
    DATA_NEED_SEVERITY_THRESHOLDS,
    MarketplaceConfig,
    DEFAULT_MARKETPLACE_CONFIG,
} from './marketplace-types';
import { NeighborAd, TraitEffect, RAGConfig, DEFAULT_RAG_CONFIG } from './types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique ID for a data need
 */
function generateNeedId(dimension: DataNeed['dimension'], value: string): string {
    return `need_${dimension}_${value}_${Date.now()}`;
}

/**
 * Calculate severity based on sample count and confidence
 */
function calculateSeverity(
    currentSamples: number,
    confidence: number
): DataNeed['severity'] {
    const thresholds = DATA_NEED_SEVERITY_THRESHOLDS;

    // High severity: very few samples or very low confidence
    if (currentSamples < thresholds.minSamplesForLow || confidence < thresholds.minConfidenceForHigh) {
        return 'high';
    }

    // Medium severity: below threshold samples or moderate confidence
    if (currentSamples < thresholds.minSamplesForMedium || confidence < thresholds.minConfidenceForMedium) {
        return 'medium';
    }

    return 'low';
}

/**
 * Estimate confidence impact if gap is filled
 */
function estimateConfidenceImpact(
    currentSamples: number,
    requiredSamples: number,
    currentConfidence: number
): number {
    // Simple model: each additional sample up to threshold adds confidence
    const sampleDeficit = Math.max(0, requiredSamples - currentSamples);
    const maxGain = 100 - currentConfidence;

    // Diminishing returns: first samples matter more
    const gain = maxGain * (1 - Math.exp(-sampleDeficit / requiredSamples));

    return Math.round(gain);
}

// ============================================
// PLATFORM GAP DETECTION
// ============================================

/**
 * Detect platform-level data needs
 */
function detectPlatformNeeds(
    neighbors: NeighborAd[],
    queryPlatform: string | undefined,
    config: RAGConfig
): DataNeed[] {
    const needs: DataNeed[] = [];

    if (!queryPlatform) return needs;

    // Count neighbors on same platform
    const platformNeighbors = neighbors.filter(
        n => n.orb.metadata.platform === queryPlatform
    );

    const currentSamples = platformNeighbors.length;
    const requiredSamples = config.minNeighbors * 2; // Need more for platform-specific

    if (currentSamples < requiredSamples) {
        const avgSimilarity = platformNeighbors.length > 0
            ? platformNeighbors.reduce((sum, n) => sum + n.weightedSimilarity, 0) / platformNeighbors.length
            : 0;

        const confidence = (currentSamples / requiredSamples) * 100;
        const severity = calculateSeverity(currentSamples, confidence);

        needs.push({
            id: generateNeedId('platform', queryPlatform),
            dimension: 'platform',
            value: queryPlatform,
            reason: `Only ${currentSamples} similar ads on ${queryPlatform} (need ${requiredSamples} for reliable prediction)`,
            severity,
            currentSamples,
            requiredSamples,
            confidenceImpact: estimateConfidenceImpact(currentSamples, requiredSamples, confidence),
            context: {
                avgSimilarity,
            },
        });
    }

    return needs;
}

// ============================================
// TRAIT GAP DETECTION
// ============================================

/**
 * Detect trait-level data needs from contrastive analysis
 */
function detectTraitNeeds(
    traitEffects: TraitEffect[],
    config: RAGConfig
): DataNeed[] {
    const needs: DataNeed[] = [];

    for (const effect of traitEffects) {
        // Low confidence traits indicate data gaps
        if (effect.confidence < 40) {
            const totalSamples = effect.n_with + effect.n_without;
            const requiredSamples = config.minSampleSize * 4; // Need more for trait analysis

            // Compute variance from lift if we had the data
            const variance = Math.abs(effect.avgSuccessWith - effect.avgSuccessWithout) > 0
                ? Math.abs(effect.lift) / 2 // Rough estimate
                : 0;

            const severity = calculateSeverity(effect.n_with, effect.confidence);

            needs.push({
                id: generateNeedId('trait', effect.trait),
                dimension: 'trait',
                value: `${effect.trait}=${effect.traitValue}`,
                reason: `Only ${effect.n_with} examples with "${effect.trait}" (confidence: ${effect.confidence}%)`,
                severity,
                currentSamples: effect.n_with,
                requiredSamples,
                confidenceImpact: estimateConfidenceImpact(effect.n_with, requiredSamples, effect.confidence),
                context: {
                    traitConfidence: effect.confidence,
                    variance,
                },
            });
        }
    }

    return needs;
}

// ============================================
// NEIGHBOR-BASED GAP DETECTION
// ============================================

/**
 * Detect gaps based on neighbor count and quality
 */
function detectNeighborNeeds(
    neighbors: NeighborAd[],
    config: RAGConfig
): DataNeed[] {
    const needs: DataNeed[] = [];

    // Check total neighbor count
    if (neighbors.length < config.minNeighbors) {
        needs.push({
            id: generateNeedId('trait', 'similar_ads'),
            dimension: 'trait',
            value: 'similar_ads',
            reason: `Only ${neighbors.length} similar ads found (need ${config.minNeighbors} minimum)`,
            severity: 'high',
            currentSamples: neighbors.length,
            requiredSamples: config.minNeighbors,
            confidenceImpact: estimateConfidenceImpact(neighbors.length, config.minNeighbors, 30),
        });
    }

    // Check average similarity quality
    if (neighbors.length > 0) {
        const avgSimilarity = neighbors.reduce((sum, n) => sum + n.weightedSimilarity, 0) / neighbors.length;

        if (avgSimilarity < config.minSimilarity * 100) {
            needs.push({
                id: generateNeedId('trait', 'similarity_quality'),
                dimension: 'trait',
                value: 'similarity_quality',
                reason: `Low similarity scores (avg: ${avgSimilarity.toFixed(1)}%)`,
                severity: avgSimilarity < 30 ? 'high' : 'medium',
                currentSamples: neighbors.length,
                requiredSamples: config.minNeighbors,
                confidenceImpact: Math.round(60 - avgSimilarity),
                context: {
                    avgSimilarity,
                },
            });
        }
    }

    // Check outcome variance
    const successScores = neighbors
        .filter(n => n.orb.results?.successScore !== undefined)
        .map(n => n.orb.results!.successScore!);

    if (successScores.length >= 3) {
        const mean = successScores.reduce((a, b) => a + b, 0) / successScores.length;
        const variance = successScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / successScores.length;
        const stdDev = Math.sqrt(variance);

        // High variance indicates inconsistent outcomes
        if (stdDev > 25) {
            needs.push({
                id: generateNeedId('trait', 'outcome_variance'),
                dimension: 'trait',
                value: 'outcome_variance',
                reason: `High outcome variance (std dev: ${stdDev.toFixed(1)}) - results are inconsistent`,
                severity: stdDev > 35 ? 'high' : 'medium',
                currentSamples: successScores.length,
                requiredSamples: Math.ceil(successScores.length * 1.5),
                confidenceImpact: Math.round(stdDev - 15),
                context: {
                    variance: stdDev,
                },
            });
        }
    }

    return needs;
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect all data needs based on prediction state
 * 
 * @param neighbors - Retrieved similar ads
 * @param traitEffects - Contrastive analysis results
 * @param queryPlatform - Platform of the query ad
 * @param currentConfidence - Current prediction confidence
 * @param config - RAG configuration
 * @param marketplaceConfig - Marketplace configuration
 * @returns GapAnalysis with all detected needs
 */
export function detectDataNeeds(
    neighbors: NeighborAd[],
    traitEffects: TraitEffect[],
    queryPlatform?: string,
    currentConfidence: number = 50,
    config: RAGConfig = DEFAULT_RAG_CONFIG,
    marketplaceConfig: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): GapAnalysis {
    // Skip detection if confidence is above threshold
    if (currentConfidence >= marketplaceConfig.confidenceThreshold &&
        neighbors.length >= marketplaceConfig.minNeighborThreshold) {
        return {
            dataNeeds: [],
            totalGaps: 0,
            highSeverityCount: 0,
            mediumSeverityCount: 0,
            lowSeverityCount: 0,
            hasSignificantGaps: false,
            currentConfidence,
            potentialConfidence: currentConfidence,
            maxConfidenceGain: 0,
        };
    }

    // Collect all needs
    const allNeeds: DataNeed[] = [
        ...detectNeighborNeeds(neighbors, config),
        ...detectPlatformNeeds(neighbors, queryPlatform, config),
        ...detectTraitNeeds(traitEffects, config),
    ];

    // Deduplicate by dimension + value
    const uniqueNeeds = allNeeds.reduce((acc, need) => {
        const key = `${need.dimension}:${need.value}`;
        if (!acc.has(key) || acc.get(key)!.severity < need.severity) {
            acc.set(key, need);
        }
        return acc;
    }, new Map<string, DataNeed>());

    const dataNeeds = Array.from(uniqueNeeds.values());

    // Sort by severity (high first) then by confidence impact
    dataNeeds.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.confidenceImpact - a.confidenceImpact;
    });

    // Count by severity
    const highSeverityCount = dataNeeds.filter(n => n.severity === 'high').length;
    const mediumSeverityCount = dataNeeds.filter(n => n.severity === 'medium').length;
    const lowSeverityCount = dataNeeds.filter(n => n.severity === 'low').length;

    // Calculate potential confidence if all gaps filled
    const maxConfidenceGain = dataNeeds.reduce((sum, n) => sum + n.confidenceImpact, 0);
    const potentialConfidence = Math.min(100, currentConfidence + maxConfidenceGain);

    // Determine primary gap dimension
    const dimensionCounts = dataNeeds.reduce((acc, n) => {
        acc[n.dimension] = (acc[n.dimension] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const primaryGapDimension = Object.entries(dimensionCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] as DataNeed['dimension'] | undefined;

    return {
        dataNeeds,
        totalGaps: dataNeeds.length,
        highSeverityCount,
        mediumSeverityCount,
        lowSeverityCount,
        hasSignificantGaps: highSeverityCount > 0 || mediumSeverityCount >= 2,
        primaryGapDimension,
        currentConfidence,
        potentialConfidence,
        maxConfidenceGain,
    };
}

// ============================================
// QUICK CHECK FUNCTIONS
// ============================================

/**
 * Quick check if marketplace suggestions should be shown
 */
export function shouldShowMarketplaceSuggestions(
    neighborCount: number,
    confidence: number,
    avgSimilarity: number,
    config: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): boolean {
    if (!config.enabled) return false;

    return (
        neighborCount < config.minNeighborThreshold ||
        confidence < config.confidenceThreshold ||
        avgSimilarity < config.minSimilarityThreshold
    );
}

/**
 * Get the primary reason for showing marketplace
 */
export function getPrimaryGapReason(
    neighborCount: number,
    confidence: number,
    avgSimilarity: number,
    config: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): string {
    if (neighborCount < config.minNeighborThreshold) {
        return `Only ${neighborCount} similar ads found (minimum: ${config.minNeighborThreshold})`;
    }

    if (avgSimilarity < config.minSimilarityThreshold) {
        return `Low similarity to existing ads (${avgSimilarity.toFixed(0)}% average)`;
    }

    if (confidence < config.confidenceThreshold) {
        return `Prediction confidence is ${confidence}% (threshold: ${config.confidenceThreshold}%)`;
    }

    return 'Prediction data is sufficient';
}
