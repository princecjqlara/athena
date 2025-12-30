/**
 * Decision Pipeline Configuration
 * 
 * Centralized configuration for the unified prediction pipeline.
 * This replaces scattered configuration across multiple ML modules.
 * 
 * Philosophy: ONE decision spine with advisory systems OFF by default.
 */

// ============================================
// PIPELINE CONFIGURATION
// ============================================

/**
 * PipelineConfig - Unified configuration for all prediction decisions
 */
export interface PipelineConfig {
    // ==========================================
    // Core Pipeline Settings (always active)
    // ==========================================

    /** Minimum confidence level to return prediction without fallback (0-100) */
    confidenceThreshold: number;

    /** Minimum similar neighbors required for RAG prediction */
    minNeighborsRequired: number;

    /** Minimum similarity score for neighbors (0-100) */
    minSimilarityThreshold: number;

    // ==========================================
    // Advisory Systems (all OFF by default)
    // ==========================================

    /** 
     * Enable random wildcard recommendations (exploration.ts)
     * When OFF: No random wildcards in predictions
     * When ON: 10% chance of wildcard recommendations
     */
    enableExploration: boolean;

    /** 
     * Enable automatic trait discovery (feature-discovery.ts)
     * When OFF: No auto-discovery, traits are metadata only
     * When ON: Surprise successes trigger AI feature discovery
     */
    enableAutoDiscovery: boolean;

    /** 
     * Enable global weight learning (weight-adjustment.ts)
     * When OFF: Weights frozen, used only for fallback
     * When ON: Weights continuously updated from prediction errors
     */
    enableWeightLearning: boolean;

    /** 
     * Enable proactive marketplace suggestions
     * When OFF: Marketplace only triggered by explicit low confidence
     * When ON: Marketplace checks run on every prediction
     */
    enableProactiveMarketplace: boolean;

    // ==========================================
    // Fallback Configuration
    // ==========================================

    /** Use legacy ML weights when RAG confidence is low */
    enableLegacyFallback: boolean;

    /** Weight for blending legacy scores (0 = all RAG, 1 = all legacy) */
    legacyBlendWeight: number;

    // ==========================================
    // Explanation Settings
    // ==========================================

    /** Include data gap suggestions in low-confidence explanations */
    includeDataGapSuggestions: boolean;

    /** Maximum number of traits to explain */
    maxTraitsToExplain: number;
}

/**
 * Default pipeline configuration - conservative defaults
 * All advisory systems OFF to minimize noise
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
    // Core pipeline
    confidenceThreshold: 60,
    minNeighborsRequired: 5,
    minSimilarityThreshold: 50,

    // Advisory systems (ALL OFF)
    enableExploration: false,
    enableAutoDiscovery: false,
    enableWeightLearning: false,
    enableProactiveMarketplace: false,

    // Fallback
    enableLegacyFallback: true,
    legacyBlendWeight: 0.3,

    // Explanation
    includeDataGapSuggestions: true,
    maxTraitsToExplain: 5,
};

// ============================================
// PIPELINE CONFIG STORAGE
// ============================================

const PIPELINE_CONFIG_KEY = 'rag_pipeline_config';

/**
 * Get current pipeline configuration
 */
export function getPipelineConfig(): PipelineConfig {
    if (typeof window === 'undefined') return DEFAULT_PIPELINE_CONFIG;

    try {
        const stored = localStorage.getItem(PIPELINE_CONFIG_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to handle new fields
            return { ...DEFAULT_PIPELINE_CONFIG, ...parsed };
        }
    } catch (error) {
        console.warn('Failed to load pipeline config:', error);
    }

    return DEFAULT_PIPELINE_CONFIG;
}

/**
 * Save pipeline configuration
 */
export function savePipelineConfig(config: Partial<PipelineConfig>): void {
    if (typeof window === 'undefined') return;

    const current = getPipelineConfig();
    const updated = { ...current, ...config };

    try {
        localStorage.setItem(PIPELINE_CONFIG_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to save pipeline config:', error);
    }
}

/**
 * Reset pipeline configuration to defaults
 */
export function resetPipelineConfig(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PIPELINE_CONFIG_KEY);
}

// ============================================
// FEATURE FLAGS HELPERS
// ============================================

/**
 * Check if an advisory system is enabled
 */
export function isAdvisoryEnabled(
    system: 'exploration' | 'discovery' | 'weights' | 'marketplace'
): boolean {
    const config = getPipelineConfig();

    switch (system) {
        case 'exploration':
            return config.enableExploration;
        case 'discovery':
            return config.enableAutoDiscovery;
        case 'weights':
            return config.enableWeightLearning;
        case 'marketplace':
            return config.enableProactiveMarketplace;
        default:
            return false;
    }
}

/**
 * Enable or disable a specific advisory system
 */
export function setAdvisoryEnabled(
    system: 'exploration' | 'discovery' | 'weights' | 'marketplace',
    enabled: boolean
): void {
    const updates: Partial<PipelineConfig> = {};

    switch (system) {
        case 'exploration':
            updates.enableExploration = enabled;
            break;
        case 'discovery':
            updates.enableAutoDiscovery = enabled;
            break;
        case 'weights':
            updates.enableWeightLearning = enabled;
            break;
        case 'marketplace':
            updates.enableProactiveMarketplace = enabled;
            break;
    }

    savePipelineConfig(updates);
}

// ============================================
// CONFIDENCE LEVEL HELPERS
// ============================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Get confidence level from a numeric score
 */
export function getConfidenceLevel(
    confidence: number,
    config: PipelineConfig = getPipelineConfig()
): ConfidenceLevel {
    if (confidence >= config.confidenceThreshold) {
        return 'high';
    } else if (confidence >= config.confidenceThreshold * 0.6) {
        return 'medium';
    } else {
        return 'low';
    }
}

/**
 * Check if confidence is sufficient for prediction
 */
export function isConfidenceSufficient(
    confidence: number,
    config: PipelineConfig = getPipelineConfig()
): boolean {
    return confidence >= config.confidenceThreshold;
}
