/**
 * Similar Ad Retrieval Module
 * 
 * Retrieves the top-k most similar ads from the orb store
 * with optional filtering by platform, objective, and recency.
 */

import { AdOrb, NeighborAd, RetrievalFilters, DEFAULT_RAG_CONFIG, RAGConfig } from './types';
import { scoreNeighbors, computeRecencyWeight } from './similarity-score';
import { getOrbSuccessScore, orbHasResults } from './ad-orb';
import { getAllOrbs, getOrbsWithResults } from './orb-store';
import { generateOrbEmbedding } from './build-embedding';

// ============================================
// FILTER FUNCTIONS
// ============================================

/**
 * Filter orbs by platform
 */
function filterByPlatform(orbs: AdOrb[], platform: string): AdOrb[] {
    return orbs.filter(orb => orb.metadata.platform === platform);
}

/**
 * Filter orbs by objective
 */
function filterByObjective(orbs: AdOrb[], objective: string): AdOrb[] {
    return orbs.filter(orb => orb.metadata.objective === objective);
}

/**
 * Filter orbs by max age (days)
 */
function filterByRecency(orbs: AdOrb[], maxAgeDays: number): AdOrb[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    return orbs.filter(orb => {
        const orbDate = new Date(orb.metadata.createdAt);
        return orbDate >= cutoffDate;
    });
}

/**
 * Filter orbs by minimum success score
 */
function filterByMinSuccessScore(orbs: AdOrb[], minScore: number): AdOrb[] {
    return orbs.filter(orb => {
        const score = getOrbSuccessScore(orb);
        return score !== undefined && score >= minScore;
    });
}

/**
 * Apply all filters to orb list
 */
function applyFilters(orbs: AdOrb[], filters?: RetrievalFilters): AdOrb[] {
    if (!filters) {
        return orbs;
    }

    let filtered = orbs;

    if (filters.platform) {
        filtered = filterByPlatform(filtered, filters.platform);
    }

    if (filters.objective) {
        filtered = filterByObjective(filtered, filters.objective);
    }

    if (filters.maxAgeDays) {
        filtered = filterByRecency(filtered, filters.maxAgeDays);
    }

    if (filters.minSuccessScore) {
        filtered = filterByMinSuccessScore(filtered, filters.minSuccessScore);
    }

    if (filters.requireResults) {
        filtered = filtered.filter(orbHasResults);
    }

    return filtered;
}

// ============================================
// MAIN RETRIEVAL FUNCTION
// ============================================

/**
 * Retrieve the top-k most similar ads to a query ad
 * 
 * @param queryOrb - The ad to find similar ads for
 * @param k - Number of neighbors to return
 * @param filters - Optional filters for platform, objective, recency
 * @param config - RAG configuration (uses defaults if not provided)
 * @returns Array of NeighborAds sorted by weighted similarity
 */
export async function retrieveSimilarAds(
    queryOrb: AdOrb,
    k: number = DEFAULT_RAG_CONFIG.defaultK,
    filters?: RetrievalFilters,
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<NeighborAd[]> {
    // Ensure query orb has embedding
    let queryWithEmbedding = queryOrb;
    if (!queryOrb.embedding) {
        queryWithEmbedding = await generateOrbEmbedding(queryOrb);
    }

    // Get candidate orbs from store
    let candidates: AdOrb[];
    if (filters?.requireResults) {
        candidates = getOrbsWithResults();
    } else {
        candidates = getAllOrbs();
    }

    // Apply filters
    candidates = applyFilters(candidates, filters);

    // Score all candidates
    const scoredNeighbors = scoreNeighbors(queryWithEmbedding, candidates, config);

    // Return top-k
    return scoredNeighbors.slice(0, k);
}

/**
 * Retrieve similar ads with results only (for prediction/analysis)
 * This is the primary function for RAG prediction
 */
export async function retrieveSimilarAdsWithResults(
    queryOrb: AdOrb,
    k: number = DEFAULT_RAG_CONFIG.defaultK,
    filters?: Omit<RetrievalFilters, 'requireResults'>,
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<NeighborAd[]> {
    return retrieveSimilarAds(
        queryOrb,
        k,
        { ...filters, requireResults: true },
        config
    );
}

/**
 * Retrieve similar ads matching the query's platform
 * Useful for platform-specific prediction
 */
export async function retrieveSimilarAdsForPlatform(
    queryOrb: AdOrb,
    k: number = DEFAULT_RAG_CONFIG.defaultK,
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<NeighborAd[]> {
    return retrieveSimilarAds(
        queryOrb,
        k,
        {
            platform: queryOrb.metadata.platform,
            requireResults: true
        },
        config
    );
}

// ============================================
// RETRIEVAL STATISTICS
// ============================================

/**
 * Get statistics about retrieved neighbors
 */
export function getNeighborStats(neighbors: NeighborAd[]): {
    count: number;
    avgSimilarity: number;
    avgVectorSimilarity: number;
    avgStructuredSimilarity: number;
    avgRecency: number;
    avgSuccessScore: number;
    variance: number;
    minSimilarity: number;
    maxSimilarity: number;
} {
    if (neighbors.length === 0) {
        return {
            count: 0,
            avgSimilarity: 0,
            avgVectorSimilarity: 0,
            avgStructuredSimilarity: 0,
            avgRecency: 0,
            avgSuccessScore: 0,
            variance: 0,
            minSimilarity: 0,
            maxSimilarity: 0,
        };
    }

    const similarities = neighbors.map(n => n.hybridSimilarity);
    const vectorSims = neighbors.map(n => n.vectorSimilarity);
    const structuredSims = neighbors.map(n => n.structuredSimilarity);
    const recencies = neighbors.map(n => n.recencyWeight);
    const successScores = neighbors
        .map(n => getOrbSuccessScore(n.orb))
        .filter((s): s is number => s !== undefined);

    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const avgVectorSimilarity = vectorSims.reduce((a, b) => a + b, 0) / vectorSims.length;
    const avgStructuredSimilarity = structuredSims.reduce((a, b) => a + b, 0) / structuredSims.length;
    const avgRecency = recencies.reduce((a, b) => a + b, 0) / recencies.length;
    const avgSuccessScore = successScores.length > 0
        ? successScores.reduce((a, b) => a + b, 0) / successScores.length
        : 0;

    // Calculate variance of success scores
    let variance = 0;
    if (successScores.length > 1) {
        const sqDiffs = successScores.map(s => Math.pow(s - avgSuccessScore, 2));
        variance = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (successScores.length - 1));
    }

    return {
        count: neighbors.length,
        avgSimilarity,
        avgVectorSimilarity,
        avgStructuredSimilarity,
        avgRecency,
        avgSuccessScore,
        variance,
        minSimilarity: Math.min(...similarities),
        maxSimilarity: Math.max(...similarities),
    };
}

/**
 * Check if we have enough neighbors for reliable RAG prediction
 */
export function hasEnoughNeighbors(
    neighbors: NeighborAd[],
    config: RAGConfig = DEFAULT_RAG_CONFIG
): boolean {
    if (neighbors.length < config.minNeighbors) {
        return false;
    }

    const stats = getNeighborStats(neighbors);
    return stats.avgSimilarity >= config.minSimilarity;
}
