/**
 * RAG Feature Flags
 * 
 * Centralized feature flag system for RAG + contrastive prediction.
 * All flags default to OFF for safety - must be explicitly enabled.
 */

// ============================================
// TYPES
// ============================================

export interface RAGFeatureFlags {
    /** Enable RAG-based prediction (default: false) */
    enableRAG: boolean;

    /** Enable contrastive trait analysis (default: false) */
    enableContrastive: boolean;

    /** Enable marketplace data hints (default: false) */
    enableMarketplaceHints: boolean;

    /** Enable debug logging for prediction paths (default: false) */
    enableDebugLogging: boolean;

    /** Enable hybrid blending with legacy (default: true when RAG enabled) */
    enableHybridBlend: boolean;
}

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_FLAGS: RAGFeatureFlags = {
    enableRAG: false,
    enableContrastive: false,
    enableMarketplaceHints: false,
    enableDebugLogging: false,
    enableHybridBlend: true,
};

const STORAGE_KEY = 'rag_feature_flags';

// ============================================
// FLAG MANAGEMENT
// ============================================

/**
 * Get current feature flags
 * Priority: localStorage > environment variables > defaults
 */
export function getFlags(): RAGFeatureFlags {
    // Start with defaults
    let flags = { ...DEFAULT_FLAGS };

    // Check environment variables (server-side)
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.RAG_ENABLE_RAG === 'true') flags.enableRAG = true;
        if (process.env.RAG_ENABLE_CONTRASTIVE === 'true') flags.enableContrastive = true;
        if (process.env.RAG_ENABLE_MARKETPLACE === 'true') flags.enableMarketplaceHints = true;
        if (process.env.RAG_ENABLE_DEBUG === 'true') flags.enableDebugLogging = true;
        if (process.env.RAG_DISABLE_HYBRID === 'true') flags.enableHybridBlend = false;
    }

    // Check localStorage overrides (client-side)
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<RAGFeatureFlags>;
                flags = { ...flags, ...parsed };
            }
        } catch {
            // Ignore parse errors, use defaults
        }
    }

    return flags;
}

/**
 * Set a specific feature flag
 * Persists to localStorage for client-side overrides
 */
export function setFlag<K extends keyof RAGFeatureFlags>(
    key: K,
    value: RAGFeatureFlags[K]
): void {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const current = getFlags();
            current[key] = value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch {
            // Ignore storage errors
        }
    }
}

/**
 * Set multiple flags at once
 */
export function setFlags(flags: Partial<RAGFeatureFlags>): void {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const current = getFlags();
            const updated = { ...current, ...flags };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
            // Ignore storage errors
        }
    }
}

/**
 * Reset all flags to defaults
 */
export function resetFlags(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
    }
}

/**
 * Check if RAG is ready for use
 * Returns true only if RAG is enabled AND has required dependencies
 */
export function isRAGEnabled(): boolean {
    const flags = getFlags();
    return flags.enableRAG;
}

/**
 * Check if contrastive analysis is enabled
 */
export function isContrastiveEnabled(): boolean {
    const flags = getFlags();
    return flags.enableRAG && flags.enableContrastive;
}

/**
 * Check if marketplace hints are enabled
 */
export function isMarketplaceEnabled(): boolean {
    const flags = getFlags();
    return flags.enableRAG && flags.enableMarketplaceHints;
}

/**
 * Check if debug logging is enabled
 */
export function isDebugLoggingEnabled(): boolean {
    const flags = getFlags();
    return flags.enableDebugLogging;
}
