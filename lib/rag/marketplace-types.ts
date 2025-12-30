/**
 * Marketplace + Data Sharing Types
 * 
 * Types for the demand-driven marketplace that integrates with the RAG prediction pipeline.
 * Focuses on identifying coverage gaps and suggesting datasets to improve prediction confidence.
 */

import { Platform, ObjectiveType } from '@/types';

// ============================================
// DATA NEED TYPES
// ============================================

/**
 * DataNeed - Represents missing evidence required for confident prediction.
 * Generated when prediction confidence is low due to insufficient data.
 */
export interface DataNeed {
    id: string;

    // Dimension of the gap
    dimension: 'platform' | 'trait' | 'format' | 'objective' | 'audience';

    // Specific value that's missing data (e.g., "tiktok", "voiceover", "gen_z")
    value: string;

    // Human-readable reason for the need
    reason: string;

    // Severity of the gap
    severity: 'low' | 'medium' | 'high';

    // Current sample count for this dimension/value
    currentSamples: number;

    // Minimum samples needed for reliable prediction
    requiredSamples: number;

    // Estimated confidence impact if gap is filled (percentage points)
    confidenceImpact: number;

    // Context about why this matters
    context?: {
        avgSimilarity?: number;
        variance?: number;
        traitConfidence?: number;
    };
}

/**
 * Severity thresholds for data need detection
 */
export const DATA_NEED_SEVERITY_THRESHOLDS = {
    minSamplesForLow: 5,
    minSamplesForMedium: 10,
    minConfidenceForHigh: 40,
    minConfidenceForMedium: 60,
};

// ============================================
// MARKETPLACE DATASET TYPES
// ============================================

/**
 * MarketplaceDataset - A dataset in the marketplace that declares what gaps it can fill.
 * Never exposes raw data, only coverage metadata.
 */
export interface MarketplaceDataset {
    id: string;
    name: string;
    description: string;

    // Coverage declarations - what this dataset provides
    covers: {
        platforms?: Platform[];
        traits?: string[];
        objectives?: ObjectiveType[];
        formats?: string[];
        audiences?: string[];
    };

    // Dataset quality metrics
    sampleCount: number;
    freshnessScore: number;     // 0-100, based on recency of data
    confidenceScore: number;    // 0-100, based on data quality

    // Usage statistics (anonymized)
    usageCount?: number;        // How many users have added this dataset
    avgConfidenceGain?: number; // Average reported confidence improvement

    // Access information
    accessTier: 'free' | 'premium' | 'enterprise';
    isPublic: boolean;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

// ============================================
// SHARED CONTRASTIVE STATISTICS
// ============================================

/**
 * SharedContrastStat - Anonymized, aggregated trait statistics for collective intelligence.
 * These are safe to share because they:
 * - Are aggregated across multiple ads
 * - Never include raw data or embeddings
 * - Cannot be reversed to identify original ads
 */
export interface SharedContrastStat {
    // The trait being measured
    trait: string;

    // Contextual filters (optional)
    context: {
        platform?: Platform;
        objective?: ObjectiveType;
        format?: string;
    };

    // Aggregated metrics
    avgLift: number;           // Average lift across all samples
    variance: number;          // Variance of lift values
    confidence: number;        // 0-100 confidence score
    sampleSize: number;        // Number of ads used to compute this stat

    // Privacy metadata
    minContributors: number;   // Minimum contributors (for k-anonymity)
    aggregatedAt: string;      // When this statistic was computed
}

/**
 * Configuration for shared statistics
 */
export const SHARED_STATS_CONFIG = {
    minSamplesForSharing: 10,      // Minimum local samples before contributing
    minContributorsForUse: 5,      // Minimum contributors for shared stat to be used
    maxAlphaForSharedData: 0.5,    // Maximum weight given to shared data
};

// ============================================
// MARKETPLACE MATCHING TYPES
// ============================================

/**
 * MarketplaceMatch - A matched dataset with relevance scoring
 */
export interface MarketplaceMatch {
    dataset: MarketplaceDataset;

    // Matching scores (0-100)
    coverageScore: number;        // How well dataset covers the gap
    freshnessScore: number;       // Recency of data
    confidenceScore: number;      // Quality of data

    // Final combined score using formula:
    // matchScore = coverage*0.6 + freshness*0.2 + confidence*0.2
    matchScore: number;

    // Which needs this dataset addresses
    addressedNeeds: DataNeed[];

    // Estimated improvement
    estimatedConfidenceGain: number;

    // Match explanation
    explanation: string;
}

/**
 * MarketplaceSuggestion - Full suggestion for display to user
 */
export interface MarketplaceSuggestion {
    // The matched dataset
    match: MarketplaceMatch;

    // Human-readable messages
    headline: string;          // e.g., "You can improve this by adding..."
    reason: string;            // e.g., "Only 4 similar examples available"
    impact: string;            // e.g., "Estimated confidence gain: +32%"

    // Action buttons
    actions: {
        previewImpact: boolean;
        addDataset: boolean;
        learnMore: boolean;
    };

    // Priority for display ordering
    priority: number;
}

// ============================================
// MARKETPLACE INTEGRATION TYPES
// ============================================

/**
 * MarketplaceConfig - Configuration for marketplace integration
 */
export interface MarketplaceConfig {
    // Enable/disable marketplace features (feature flag)
    enabled: boolean;

    // Thresholds for triggering suggestions
    confidenceThreshold: number;     // Below this → suggest marketplace
    minNeighborThreshold: number;    // Below this → suggest marketplace
    minSimilarityThreshold: number;  // Below this → suggest marketplace

    // Matching configuration
    maxSuggestionsToShow: number;
    minMatchScoreToShow: number;

    // Data sharing configuration
    allowSharedStatsBlending: boolean;
    sharedStatsWeight: number;
}

/**
 * Default marketplace configuration
 */
export const DEFAULT_MARKETPLACE_CONFIG: MarketplaceConfig = {
    enabled: true,

    confidenceThreshold: 60,
    minNeighborThreshold: 10,
    minSimilarityThreshold: 50,

    maxSuggestionsToShow: 3,
    minMatchScoreToShow: 40,

    allowSharedStatsBlending: true,
    sharedStatsWeight: 0.3,
};

// ============================================
// GAP ANALYSIS RESULT TYPE
// ============================================

/**
 * GapAnalysis - Result of analyzing prediction for data gaps
 */
export interface GapAnalysis {
    // Detected needs
    dataNeeds: DataNeed[];

    // Summary statistics
    totalGaps: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;

    // Overall assessment
    hasSignificantGaps: boolean;
    primaryGapDimension?: DataNeed['dimension'];

    // Confidence metrics
    currentConfidence: number;
    potentialConfidence: number;    // If all gaps filled
    maxConfidenceGain: number;
}

// ============================================
// BLENDING RESULT TYPE
// ============================================

/**
 * BlendedLift - Result of blending local and shared lift values
 */
export interface BlendedLift {
    trait: string;
    localLift: number;
    sharedLift: number;
    blendedLift: number;
    alpha: number;                  // Weight given to local (1 = all local, 0 = all shared)
    usingSharedData: boolean;
}
