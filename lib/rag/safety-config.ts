/**
 * RAG Safety Configuration
 * 
 * Centralized safety thresholds and timeout configuration.
 * These values are conservative by design - prefer fallback over failure.
 */

// ============================================
// SAFETY CONFIGURATION
// ============================================

export const SAFETY_CONFIG = {
    // ========== TIMEOUTS ==========
    /** Maximum time for RAG prediction operations (ms) */
    ragTimeoutMs: 5000,

    /** Maximum time for similarity search (ms) */
    similaritySearchTimeoutMs: 3000,

    /** Maximum time for embedding generation (ms) */
    embeddingTimeoutMs: 2000,

    // ========== SCORE BOUNDS ==========
    /** Minimum valid score */
    minScore: 0,

    /** Maximum valid score */
    maxScore: 100,

    /** Default score when fallback triggered */
    defaultFallbackScore: 50,

    /** Default confidence when fallback triggered */
    defaultFallbackConfidence: 0,

    // ========== FALLBACK TRIGGERS ==========
    /** Minimum neighbors required for RAG prediction */
    minNeighborsForRAG: 5,

    /** Minimum average similarity for RAG to be trusted */
    minSimilarityForRAG: 0.5,

    /** Maximum variance before confidence is penalized */
    maxVarianceForConfidence: 15,

    /** Maximum variance before fallback to legacy */
    maxVarianceForFallback: 30,

    // ========== CONTRASTIVE GUARDRAILS ==========
    /** Minimum samples per group for significant trait effect */
    minSampleSizePerGroup: 3,

    /** Maximum absolute lift value (clamp outliers) */
    maxAbsoluteLift: 50,

    /** Minimum confidence for trait recommendation */
    minConfidenceForRecommendation: 40,

    /** Lift threshold below which effect is considered neutral */
    neutralLiftThreshold: 5,

    // ========== MARKETPLACE SAFETY ==========
    /** Minimum confidence gain to suggest a dataset */
    minConfidenceGainForSuggestion: 5,

    /** Require explicit user opt-in for dataset application */
    requireExplicitOptIn: true,

    /** Maximum datasets to suggest at once */
    maxDatasetSuggestions: 3,

    // ========== RETRIEVAL LIMITS ==========
    /** Maximum neighbors to retrieve in similarity search */
    maxNeighborsToRetrieve: 50,

    /** Default number of neighbors for prediction */
    defaultK: 20,

    // ========== CACHING ==========
    /** Cache TTL for embeddings (ms) */
    embeddingCacheTTL: 24 * 60 * 60 * 1000, // 24 hours

    /** Cache TTL for prediction results (ms) */
    predictionCacheTTL: 5 * 60 * 1000, // 5 minutes
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clamp a score to valid bounds [0, 100]
 */
export function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return SAFETY_CONFIG.defaultFallbackScore;
    }
    return Math.max(SAFETY_CONFIG.minScore, Math.min(SAFETY_CONFIG.maxScore, score));
}

/**
 * Check if a score is valid (finite number)
 */
export function isValidScore(score: number): boolean {
    return Number.isFinite(score) &&
        score >= SAFETY_CONFIG.minScore &&
        score <= SAFETY_CONFIG.maxScore;
}

/**
 * Clamp lift values to prevent outliers
 */
export function clampLift(lift: number): number {
    if (!Number.isFinite(lift)) {
        return 0;
    }
    return Math.max(-SAFETY_CONFIG.maxAbsoluteLift, Math.min(SAFETY_CONFIG.maxAbsoluteLift, lift));
}

/**
 * Check if we have enough data for RAG prediction
 */
export function hasEnoughDataForRAG(neighborCount: number, avgSimilarity: number): boolean {
    return neighborCount >= SAFETY_CONFIG.minNeighborsForRAG &&
        avgSimilarity >= SAFETY_CONFIG.minSimilarityForRAG;
}

/**
 * Check if variance is too high for confident prediction
 */
export function isVarianceTooHigh(variance: number): boolean {
    return variance > SAFETY_CONFIG.maxVarianceForFallback;
}

/**
 * Wrap a promise with a timeout
 * Returns fallback value if timeout exceeded
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutHandle!);
        return result;
    } catch {
        clearTimeout(timeoutHandle!);
        return fallback;
    }
}

/**
 * Safe wrapper that catches errors and returns fallback
 */
export async function safeExecute<T>(
    fn: () => Promise<T>,
    fallback: T,
    onError?: (error: unknown) => void
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (onError) {
            onError(error);
        }
        return fallback;
    }
}
