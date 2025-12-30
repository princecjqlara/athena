/**
 * Similarity Scoring Module
 * 
 * Computes vector similarity (cosine) and structured similarity (trait overlap)
 * for RAG-based ad retrieval.
 */

import { AdOrb, NeighborAd, DEFAULT_RAG_CONFIG } from './types';

// ============================================
// VECTOR SIMILARITY
// ============================================

/**
 * Compute cosine similarity between two embedding vectors
 */
export function computeVectorSimilarity(embeddingA: number[], embeddingB: number[]): number {
    if (!embeddingA || !embeddingB || embeddingA.length === 0 || embeddingB.length === 0) {
        return 0;
    }

    if (embeddingA.length !== embeddingB.length) {
        console.warn('Embedding dimension mismatch:', embeddingA.length, 'vs', embeddingB.length);
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
        dotProduct += embeddingA[i] * embeddingB[i];
        magnitudeA += embeddingA[i] * embeddingA[i];
        magnitudeB += embeddingB[i] * embeddingB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    // Cosine similarity ranges from -1 to 1, normalize to 0-1
    const cosineSim = dotProduct / (magnitudeA * magnitudeB);
    return (cosineSim + 1) / 2;
}

// ============================================
// STRUCTURED SIMILARITY
// ============================================

/**
 * Trait weights for structured similarity
 * Higher weights for more predictive traits
 */
const TRAIT_WEIGHTS: Record<string, number> = {
    platform: 2.0,        // Platform is very important
    hook: 1.5,            // Hook type matters a lot
    category: 1.5,        // Content category is key
    editing: 1.2,         // Editing style influences performance
    ugc: 1.3,             // UGC vs polished is major factor
    subtitles: 1.0,
    voiceover: 1.0,
    music: 1.0,
    objective: 1.5,       // Campaign objective matters
    audience: 1.2,        // Audience type
    placement: 1.0,
    cta_type: 0.8,
    tone: 0.8,
    pattern: 0.8,
};

/**
 * Compute structured similarity based on trait overlap
 * Uses weighted Jaccard-like similarity
 */
export function computeStructuredSimilarity(orbA: AdOrb, orbB: AdOrb): number {
    const traitsA = orbA.traits;
    const traitsB = orbB.traits;

    const allKeys = new Set([...Object.keys(traitsA), ...Object.keys(traitsB)]);

    let matchScore = 0;
    let totalWeight = 0;

    for (const key of allKeys) {
        const weight = TRAIT_WEIGHTS[key] ?? 0.5;
        totalWeight += weight;

        const valueA = traitsA[key];
        const valueB = traitsB[key];

        // Both have the trait
        if (valueA !== undefined && valueB !== undefined) {
            if (valueA === valueB) {
                // Exact match
                matchScore += weight;
            } else if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
                // Boolean mismatch
                matchScore += 0;
            } else if (typeof valueA === 'string' && typeof valueB === 'string') {
                // Partial string similarity (simple)
                if (valueA.includes(valueB) || valueB.includes(valueA)) {
                    matchScore += weight * 0.5;
                }
            }
        }
        // One has trait, one doesn't: 0 points
    }

    if (totalWeight === 0) {
        return 0;
    }

    return matchScore / totalWeight;
}

/**
 * Compute major trait overlap (for quick filtering)
 */
export function computeMajorTraitOverlap(orbA: AdOrb, orbB: AdOrb): number {
    const majorTraits = ['platform', 'hook', 'category', 'ugc', 'editing'];
    let matches = 0;
    let total = 0;

    for (const trait of majorTraits) {
        if (trait in orbA.traits || trait in orbB.traits) {
            total++;
            if (orbA.traits[trait] === orbB.traits[trait]) {
                matches++;
            }
        }
    }

    return total > 0 ? matches / total : 0;
}

// ============================================
// HYBRID SIMILARITY
// ============================================

/**
 * Compute hybrid similarity combining vector and structured
 */
export function computeHybridSimilarity(
    orbA: AdOrb,
    orbB: AdOrb,
    vectorWeight: number = DEFAULT_RAG_CONFIG.vectorWeight,
    structuredWeight: number = DEFAULT_RAG_CONFIG.structuredWeight
): number {
    const vectorSim = computeVectorSimilarity(orbA.embedding || [], orbB.embedding || []);
    const structuredSim = computeStructuredSimilarity(orbA, orbB);

    return vectorWeight * vectorSim + structuredWeight * structuredSim;
}

// ============================================
// RECENCY WEIGHTING
// ============================================

/**
 * Compute recency weight based on ad age
 * Returns 1.0 for very recent, decreasing with age
 */
export function computeRecencyWeight(
    createdAt: string,
    decayDays: number = DEFAULT_RAG_CONFIG.recencyDecayDays
): number {
    const adDate = new Date(createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - adDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 0) {
        return 1.0;
    }

    // Exponential decay with half-life of decayDays
    const weight = Math.exp(-0.693 * daysDiff / decayDays);

    // Minimum weight of 0.1
    return Math.max(0.1, weight);
}

// ============================================
// FULL NEIGHBOR SCORING
// ============================================

/**
 * Compute full neighbor scoring for a candidate ad
 */
export function scoreNeighbor(
    queryOrb: AdOrb,
    candidateOrb: AdOrb,
    config = DEFAULT_RAG_CONFIG
): NeighborAd {
    const vectorSimilarity = computeVectorSimilarity(
        queryOrb.embedding || [],
        candidateOrb.embedding || []
    );

    const structuredSimilarity = computeStructuredSimilarity(queryOrb, candidateOrb);

    const hybridSimilarity =
        config.vectorWeight * vectorSimilarity +
        config.structuredWeight * structuredSimilarity;

    const recencyWeight = computeRecencyWeight(
        candidateOrb.metadata.createdAt,
        config.recencyDecayDays
    );

    const weightedSimilarity = hybridSimilarity * recencyWeight;

    return {
        orb: candidateOrb,
        vectorSimilarity,
        structuredSimilarity,
        hybridSimilarity,
        recencyWeight,
        weightedSimilarity,
    };
}

/**
 * Score multiple candidate orbs and return sorted neighbors
 */
export function scoreNeighbors(
    queryOrb: AdOrb,
    candidates: AdOrb[],
    config = DEFAULT_RAG_CONFIG
): NeighborAd[] {
    return candidates
        .filter(c => c.id !== queryOrb.id) // Exclude self
        .map(candidate => scoreNeighbor(queryOrb, candidate, config))
        .filter(n => n.hybridSimilarity >= config.minSimilarity)
        .sort((a, b) => b.weightedSimilarity - a.weightedSimilarity);
}
