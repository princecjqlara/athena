/**
 * Safe Prediction Wrapper
 * 
 * Top-level entry point for all predictions with full safety guardrails.
 * Implements the mandatory guard layer with fallback chain:
 * RAG → hybrid → legacy (never skip legacy)
 * 
 * This wrapper is MANDATORY for all prediction paths.
 */

import { AdEntry } from '@/types';
import { getFlags, RAGFeatureFlags } from './feature-flags';
import {
    SAFETY_CONFIG,
    clampScore,
    isValidScore,
    withTimeout,
    hasEnoughDataForRAG,
    isVarianceTooHigh,
} from './safety-config';
import { logPrediction, logError, logFallback, FallbackReason } from './logging';
import { RAGPrediction, DEFAULT_RAG_CONFIG } from './types';

// ============================================
// TYPES
// ============================================

export interface SafePredictionOptions {
    /** Use hybrid blending with legacy (default: true) */
    useHybrid?: boolean;
    /** Override feature flags for this prediction */
    flags?: Partial<RAGFeatureFlags>;
    /** Custom timeout in ms (default: from SAFETY_CONFIG) */
    timeoutMs?: number;
}

export interface SafePredictionResult {
    /** Predicted success score (0-100, always valid) */
    successProbability: number;
    /** Confidence level (0-100) */
    confidence: number;
    /** Method used for prediction */
    method: 'rag' | 'hybrid' | 'legacy';
    /** Reason for fallback if any */
    fallbackReason?: FallbackReason;
    /** Full RAG prediction if available */
    ragPrediction?: RAGPrediction;
    /** Compute time in milliseconds */
    computeTimeMs: number;
}

// ============================================
// MAIN SAFE PREDICTION
// ============================================

/**
 * Safe prediction wrapper - the ONLY entry point for predictions
 * 
 * Guarantees:
 * - Always returns a valid result (never null/undefined)
 * - Score always in 0-100 range
 * - Graceful fallback on any error
 * - Respects feature flags
 * - Enforces timeouts
 */
export async function safePredict(
    ad: AdEntry,
    options: SafePredictionOptions = {}
): Promise<SafePredictionResult> {
    const startTime = Date.now();
    const flags = { ...getFlags(), ...options.flags };
    const timeoutMs = options.timeoutMs ?? SAFETY_CONFIG.ragTimeoutMs;

    // If RAG is disabled, go straight to legacy
    if (!flags.enableRAG) {
        const result = await safeLegacyPredict(ad);
        logPrediction({
            method: 'legacy',
            fallbackReason: 'rag_disabled',
            confidenceInputs: { neighbors: 0, similarity: 0, variance: 0 },
            scores: { final: result.successProbability },
            computeTimeMs: Date.now() - startTime,
        });
        return { ...result, computeTimeMs: Date.now() - startTime };
    }

    // Try RAG with timeout
    try {
        const ragResult = await withTimeout(
            attemptRAGPrediction(ad, flags, options.useHybrid ?? true),
            timeoutMs,
            null // null indicates timeout
        );

        if (ragResult === null) {
            // Timeout occurred
            logFallback('timeout', { timeoutMs });
            const legacyResult = await safeLegacyPredict(ad);
            return {
                ...legacyResult,
                fallbackReason: 'timeout',
                computeTimeMs: Date.now() - startTime,
            };
        }

        // Validate RAG result
        if (!isValidScore(ragResult.successProbability)) {
            logFallback('invalid_score', { score: ragResult.successProbability });
            const legacyResult = await safeLegacyPredict(ad);
            return {
                ...legacyResult,
                fallbackReason: 'invalid_score',
                computeTimeMs: Date.now() - startTime,
            };
        }

        // Log successful prediction
        logPrediction({
            method: ragResult.method,
            confidenceInputs: {
                neighbors: ragResult.neighborCount,
                similarity: ragResult.avgNeighborSimilarity,
                variance: 0, // Computed inside RAG
            },
            scores: {
                rag: ragResult.ragScore,
                legacy: ragResult.legacyScore,
                final: ragResult.successProbability,
            },
            blendAlpha: ragResult.blendAlpha,
            computeTimeMs: Date.now() - startTime,
        });

        return {
            successProbability: clampScore(ragResult.successProbability),
            confidence: clampScore(ragResult.confidence),
            method: ragResult.method,
            ragPrediction: ragResult,
            computeTimeMs: Date.now() - startTime,
        };

    } catch (error) {
        // Any error triggers fallback to legacy
        logError('safePredict', error);
        logFallback('error', { error: error instanceof Error ? error.message : String(error) });

        const legacyResult = await safeLegacyPredict(ad);
        return {
            ...legacyResult,
            fallbackReason: 'error',
            computeTimeMs: Date.now() - startTime,
        };
    }
}

// ============================================
// RAG PREDICTION ATTEMPT
// ============================================

/**
 * Attempt RAG prediction with all safety checks
 * Returns null if RAG should not be used
 */
async function attemptRAGPrediction(
    ad: AdEntry,
    flags: RAGFeatureFlags,
    useHybrid: boolean
): Promise<RAGPrediction | null> {
    // Dynamic import to avoid circular dependencies
    const { predictWithRAG, predictWithRAGOnly } = await import('./rag-predict');

    const prediction = useHybrid
        ? await predictWithRAG(ad, DEFAULT_RAG_CONFIG)
        : await predictWithRAGOnly(ad, DEFAULT_RAG_CONFIG);

    // Check if RAG had enough data
    if (!hasEnoughDataForRAG(prediction.neighborCount, prediction.avgNeighborSimilarity)) {
        logFallback('insufficient_neighbors', {
            neighbors: prediction.neighborCount,
            similarity: prediction.avgNeighborSimilarity,
        });
        // RAG already falls back internally, just log it
    }

    return prediction;
}

// ============================================
// LEGACY FALLBACK
// ============================================

/**
 * Safe legacy prediction with error handling
 * This ALWAYS returns a valid result
 */
async function safeLegacyPredict(ad: AdEntry): Promise<SafePredictionResult> {
    try {
        // Dynamic import to avoid circular dependencies
        const { generateAdPrediction } = await import('../prediction-utils');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await generateAdPrediction(ad as any);

        return {
            successProbability: clampScore(result.predictedScore),
            confidence: clampScore(result.confidence),
            method: 'legacy',
            computeTimeMs: 0, // Will be set by caller
        };
    } catch (error) {
        logError('safeLegacyPredict', error);

        // Ultimate fallback - neutral prediction
        return {
            successProbability: SAFETY_CONFIG.defaultFallbackScore,
            confidence: SAFETY_CONFIG.defaultFallbackConfidence,
            method: 'legacy',
            fallbackReason: 'error',
            computeTimeMs: 0,
        };
    }
}

// ============================================
// BATCH PREDICTION
// ============================================

/**
 * Safe batch prediction with per-item error handling
 */
export async function safePredictBatch(
    ads: AdEntry[],
    options: SafePredictionOptions = {}
): Promise<SafePredictionResult[]> {
    const results: SafePredictionResult[] = [];

    for (const ad of ads) {
        // Each item gets its own try/catch for isolation
        const result = await safePredict(ad, options);
        results.push(result);
    }

    return results;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if RAG is ready for prediction (has orbs with results)
 */
export async function isRAGReady(): Promise<boolean> {
    try {
        const { getOrbsWithResults } = await import('./orb-store');
        const orbs = getOrbsWithResults();
        return orbs.length >= SAFETY_CONFIG.minNeighborsForRAG;
    } catch {
        return false;
    }
}

/**
 * Get prediction readiness status
 */
export async function getPredictionReadiness(): Promise<{
    ragEnabled: boolean;
    ragReady: boolean;
    orbCount: number;
    minRequired: number;
}> {
    const flags = getFlags();

    let orbCount = 0;
    try {
        const { getOrbsWithResults } = await import('./orb-store');
        orbCount = getOrbsWithResults().length;
    } catch {
        // Ignore errors
    }

    return {
        ragEnabled: flags.enableRAG,
        ragReady: orbCount >= SAFETY_CONFIG.minNeighborsForRAG,
        orbCount,
        minRequired: SAFETY_CONFIG.minNeighborsForRAG,
    };
}
