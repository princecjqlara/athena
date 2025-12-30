/**
 * RAG Prediction Logging
 * 
 * Structured logging for prediction diagnostics.
 * Disabled by default - only enabled when debug flag is ON.
 * 
 * IMPORTANT: Never logs raw ad data, embeddings, or user identifiers.
 */

import { isDebugLoggingEnabled } from './feature-flags';

// ============================================
// TYPES
// ============================================

export interface PredictionLog {
    timestamp: string;
    method: 'rag' | 'hybrid' | 'legacy';
    fallbackReason?: FallbackReason;
    confidenceInputs: {
        neighbors: number;
        similarity: number;
        variance: number;
    };
    scores: {
        rag?: number;
        legacy?: number;
        final: number;
    };
    blendAlpha?: number;
    marketplaceMatches?: number;
    computeTimeMs: number;
}

export type FallbackReason =
    | 'rag_disabled'
    | 'insufficient_neighbors'
    | 'low_similarity'
    | 'high_variance'
    | 'missing_embeddings'
    | 'timeout'
    | 'error'
    | 'invalid_score';

export interface ErrorLog {
    timestamp: string;
    operation: string;
    error: string;
    fallbackUsed: boolean;
}

// ============================================
// LOG STORAGE (IN-MEMORY, LIMITED)
// ============================================

const MAX_LOG_ENTRIES = 100;
const predictionLogs: PredictionLog[] = [];
const errorLogs: ErrorLog[] = [];

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Log a prediction event
 * Only logs if debug logging is enabled
 */
export function logPrediction(log: Omit<PredictionLog, 'timestamp'>): void {
    if (!isDebugLoggingEnabled()) return;

    const entry: PredictionLog = {
        ...log,
        timestamp: new Date().toISOString(),
    };

    predictionLogs.push(entry);

    // Keep log size bounded
    if (predictionLogs.length > MAX_LOG_ENTRIES) {
        predictionLogs.shift();
    }

    // Console output in development
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        console.log('[RAG Prediction]', JSON.stringify(entry, null, 2));
    }
}

/**
 * Log an error with fallback information
 * Always logs errors (not gated by debug flag)
 */
export function logError(
    operation: string,
    error: unknown,
    fallbackUsed: boolean = true
): void {
    const entry: ErrorLog = {
        timestamp: new Date().toISOString(),
        operation,
        error: error instanceof Error ? error.message : String(error),
        fallbackUsed,
    };

    errorLogs.push(entry);

    // Keep log size bounded
    if (errorLogs.length > MAX_LOG_ENTRIES) {
        errorLogs.shift();
    }

    // Always log errors to console
    console.warn(`[RAG Error] ${operation}:`, entry.error, fallbackUsed ? '(fallback used)' : '');
}

/**
 * Log a fallback event
 */
export function logFallback(reason: FallbackReason, details?: Record<string, unknown>): void {
    if (!isDebugLoggingEnabled()) return;

    console.log('[RAG Fallback]', reason, details || '');
}

// ============================================
// LOG RETRIEVAL (FOR DIAGNOSTICS)
// ============================================

/**
 * Get recent prediction logs
 * Returns empty array if logging disabled
 */
export function getPredictionLogs(limit: number = 20): PredictionLog[] {
    if (!isDebugLoggingEnabled()) return [];
    return predictionLogs.slice(-limit);
}

/**
 * Get recent error logs
 */
export function getErrorLogs(limit: number = 20): ErrorLog[] {
    return errorLogs.slice(-limit);
}

/**
 * Get prediction statistics
 */
export function getPredictionStats(): {
    total: number;
    byMethod: Record<string, number>;
    avgComputeTime: number;
    fallbackRate: number;
} {
    if (predictionLogs.length === 0) {
        return { total: 0, byMethod: {}, avgComputeTime: 0, fallbackRate: 0 };
    }

    const byMethod: Record<string, number> = {};
    let totalTime = 0;
    let fallbackCount = 0;

    for (const log of predictionLogs) {
        byMethod[log.method] = (byMethod[log.method] || 0) + 1;
        totalTime += log.computeTimeMs;
        if (log.fallbackReason) fallbackCount++;
    }

    return {
        total: predictionLogs.length,
        byMethod,
        avgComputeTime: Math.round(totalTime / predictionLogs.length),
        fallbackRate: Math.round((fallbackCount / predictionLogs.length) * 100) / 100,
    };
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
    predictionLogs.length = 0;
    errorLogs.length = 0;
}
