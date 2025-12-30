/**
 * RAG-Based Similarity & Contrastive Reasoning Types
 * 
 * Core type definitions for the RAG prediction layer.
 * Each ad is treated as a single structured "orb" document.
 */

import { Platform, ObjectiveType } from '@/types';

// ============================================
// CANONICAL AD REPRESENTATION
// ============================================

/**
 * AdOrb - Canonical "one-ad = one orb" representation
 * A single structured document containing all ad information
 * for retrieval-based prediction.
 */
export interface AdOrb {
    id: string;

    // Flattened traits (key-value pairs for all predictive features)
    traits: Record<string, string | number | boolean>;

    // Performance results (if available)
    results?: {
        successScore?: number;
        roas?: number;
        ctr?: number;
        conversions?: number;
        impressions?: number;
        clicks?: number;
        adSpend?: number;
        revenue?: number;
    };

    // Ad metadata
    metadata: {
        platform: Platform;
        objective?: ObjectiveType;
        createdAt: string;
        updatedAt?: string;
        hasResults: boolean;
    };

    // Vector embedding (generated from canonical text)
    embedding?: number[];

    // Canonical text representation (cached for debugging)
    canonicalText?: string;
}

// ============================================
// NEIGHBOR & SIMILARITY TYPES
// ============================================

/**
 * NeighborAd - A similar ad with similarity scores
 */
export interface NeighborAd {
    orb: AdOrb;

    // Similarity scores
    vectorSimilarity: number;      // Cosine similarity of embeddings
    structuredSimilarity: number;  // Trait overlap score
    hybridSimilarity: number;      // Combined: 0.6*vector + 0.4*structured

    // Recency weight (1.0 = recent, 0.1 = old)
    recencyWeight: number;

    // Final weighted similarity
    weightedSimilarity: number;
}

/**
 * Retrieval filters for similar ad search
 */
export interface RetrievalFilters {
    platform?: Platform;
    objective?: ObjectiveType;
    maxAgeDays?: number;          // Only ads within this age
    minSuccessScore?: number;     // Only ads with results above threshold
    requireResults?: boolean;     // Only ads that have results
}

// ============================================
// CONTRASTIVE ANALYSIS TYPES
// ============================================

/**
 * TraitEffect - Result of contrastive analysis for a single trait
 * Calculates: lift = avg(success_with) - avg(success_without)
 */
export interface TraitEffect {
    trait: string;
    traitValue: string | number | boolean;

    // Lift calculation
    lift: number;                 // Difference in success scores
    liftPercent: number;          // Lift as percentage

    // Statistical confidence
    confidence: number;           // 0-100 confidence score

    // Sample sizes
    n_with: number;               // Ads WITH this trait
    n_without: number;            // Ads WITHOUT this trait

    // Group averages
    avgSuccessWith: number;       // Average success when trait present
    avgSuccessWithout: number;    // Average success when trait absent

    // Significance
    isSignificant: boolean;       // Meets minimum sample threshold
    recommendation: 'use' | 'avoid' | 'test' | 'neutral';
}

/**
 * Contrastive analysis result for all traits
 */
export interface ContrastiveAnalysis {
    traitEffects: TraitEffect[];
    topPositive: TraitEffect[];   // Traits with highest positive lift
    topNegative: TraitEffect[];   // Traits with highest negative lift
    lowConfidence: TraitEffect[]; // Traits needing more data
    totalNeighbors: number;
    avgSimilarity: number;
}

// ============================================
// RAG PREDICTION TYPES
// ============================================

/**
 * RAGPrediction - Full prediction result from RAG system
 */
export interface RAGPrediction {
    // Core prediction
    successProbability: number;   // 0-100 predicted success score
    confidence: number;           // 0-100 confidence level

    // Method used
    method: 'rag' | 'hybrid' | 'legacy';

    // Breakdown (when hybrid)
    ragScore?: number;
    legacyScore?: number;
    blendAlpha?: number;          // Weight given to RAG score

    // Neighbors used
    neighbors: NeighborAd[];
    neighborCount: number;
    avgNeighborSimilarity: number;

    // Trait effects from contrastive analysis
    traitEffects: TraitEffect[];

    // Explanation
    explanation: string;
    explanationDetails: ExplanationDetail[];

    // Recommendations
    recommendations: string[];
    experimentsToRun?: ExperimentSuggestion[];

    // Marketplace integration (optional - enabled by feature flag)
    dataNeeds?: DataNeedSummary[];
    marketplaceSuggestions?: MarketplaceSuggestionSummary[];
    gapAnalysis?: {
        hasSignificantGaps: boolean;
        totalGaps: number;
        potentialConfidenceGain: number;
    };
    hasMarketplaceData?: boolean;

    // Metadata
    generatedAt: string;
    computeTimeMs?: number;
}

/**
 * Simplified DataNeed for RAGPrediction (full type in marketplace-types.ts)
 */
export interface DataNeedSummary {
    dimension: 'platform' | 'trait' | 'format' | 'objective' | 'audience';
    value: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
    confidenceImpact: number;
}

/**
 * Simplified MarketplaceSuggestion for RAGPrediction
 */
export interface MarketplaceSuggestionSummary {
    datasetId: string;
    datasetName: string;
    matchScore: number;
    estimatedConfidenceGain: number;
    headline: string;
    reason: string;
}

/**
 * Detailed explanation component
 */
export interface ExplanationDetail {
    type: 'neighbor_evidence' | 'trait_impact' | 'low_confidence' | 'recommendation';
    text: string;
    confidence: number;
    data?: Record<string, unknown>;
}

/**
 * Experiment suggestion when confidence is low
 */
export interface ExperimentSuggestion {
    trait: string;
    currentValue: string | number | boolean;
    suggestedVariant: string | number | boolean;
    reason: string;
    expectedImpact: 'unknown' | 'potentially_positive' | 'potentially_negative';
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * RAG system configuration
 */
export interface RAGConfig {
    // Retrieval settings
    defaultK: number;             // Default number of neighbors to retrieve
    minNeighbors: number;         // Minimum neighbors for RAG (else fallback)
    minSimilarity: number;        // Minimum similarity threshold

    // Similarity weights
    vectorWeight: number;         // Weight for vector similarity (default 0.6)
    structuredWeight: number;     // Weight for structured similarity (default 0.4)

    // Recency decay
    recencyDecayDays: number;     // Days until 50% decay

    // Contrastive analysis
    minSampleSize: number;        // Minimum samples per group for significance
    significanceThreshold: number; // Minimum lift for significance

    // Hybrid blending
    baseAlpha: number;            // Base weight for RAG in hybrid
    alphaAdjustForNeighbors: boolean;  // Adjust alpha based on neighbor count
    alphaAdjustForSimilarity: boolean; // Adjust alpha based on similarity

    // Variance penalty
    variancePenaltyEnabled: boolean;
    maxVarianceForFullConfidence: number;
}

/**
 * Default RAG configuration
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
    defaultK: 20,
    minNeighbors: 5,
    minSimilarity: 0.5,

    vectorWeight: 0.6,
    structuredWeight: 0.4,

    recencyDecayDays: 30,

    minSampleSize: 3,
    significanceThreshold: 5,  // 5% lift minimum

    baseAlpha: 0.7,
    alphaAdjustForNeighbors: true,
    alphaAdjustForSimilarity: true,

    variancePenaltyEnabled: true,
    maxVarianceForFullConfidence: 15,
};

// ============================================
// STORAGE TYPES
// ============================================

/**
 * Orb storage entry with caching metadata
 */
export interface StoredOrb {
    orb: AdOrb;
    embeddingGeneratedAt?: string;
    lastAccessedAt: string;
}

/**
 * Orb store state
 */
export interface OrbStoreState {
    orbs: Record<string, StoredOrb>;
    lastUpdated: string;
    totalOrbs: number;
    orbsWithEmbeddings: number;
    orbsWithResults: number;
}

// ============================================
// FACET-BASED AD RECORD MODEL
// ============================================

/**
 * FacetSet - Finite, low-cardinality labels for explanation & filtering.
 * 
 * Facets are derived from rich JSON analysis and are used ONLY for:
 * - UI display
 * - Contrastive analysis explanation
 * - Marketplace metadata
 * - Filtering
 * 
 * Facets are NOT used as prediction weights - embeddings are the primary ML signal.
 */
export interface FacetSet {
    platform_placement: string[];  // ['tiktok', 'feed', '9:16']
    media_format: string[];        // ['animated', 'single_scene', 'kinetic_typography']
    visual_style: string[];        // ['flat_design', 'bright_palette', 'realistic']
    audio_voice: string[];         // ['voiceover', 'music', 'energetic', 'jingle']
    content_hook: string[];        // ['curiosity', 'benefit', 'emotional', 'problem_solution']
    text_features: string[];       // ['subtitles', 'text_overlay', 'high_density']
    talent_face: string[];         // ['human_present', 'face_visible', 'animated_character']
    sentiment: string[];           // ['upbeat', 'serious', 'playful', 'inspirational']
    brand: string[];               // ['brand_present', 'early_reveal', 'late_reveal']
    cta: string[];                 // ['shop_now', 'learn_more', 'strong', 'weak']
}

/**
 * EmbeddingSet - Multi-embedding for weighted similarity search.
 * 
 * Three separate embeddings with weighted contribution:
 * - creative (0.5): Scene descriptions, tone, claims, structure
 * - script (0.3): ASR text, on-screen text, CTA language
 * - visual (0.2): Object descriptions, colors, motion, layout
 */
export interface EmbeddingSet {
    creative: number[];   // Scene, tone, structure, facets
    script: number[];     // ASR, on-screen text, CTA
    visual: number[];     // Objects, colors, motion, layout
}

/**
 * AdRecord - 3-Layer canonical ad representation.
 * 
 * Layer 1 (raw): Immutable, never modified after creation
 * Layer 2 (derived): Computed from raw, can be regenerated
 * Layer 3 (results): Appended when performance data available
 */
export interface AdRecord {
    id: string;

    /** Layer 1: Immutable raw data */
    raw: {
        analysis_json: Record<string, unknown>;  // Full uploaded JSON, stored verbatim
        source: 'facebook_import' | 'manual_upload' | 'webhook';
        videoUrl?: string;
        adText?: string;
        fbMetadata?: Record<string, unknown>;
        userTraits?: Record<string, unknown>;    // User-entered overrides
        createdAt: string;
    };

    /** Layer 2: Derived from raw, can be regenerated */
    derived: {
        facets: FacetSet;
        embeddings: EmbeddingSet;
        embeddingModel?: string;
        embeddingVersion: string;
        canonicalTexts?: {
            creative: string;
            script: string;
            visual: string;
        };
        derivedAt: string;
    };

    /** Layer 3: Performance results (optional) */
    results?: {
        impressions?: number;
        clicks?: number;
        ctr?: number;
        conversions?: number;
        roas?: number;
        successScore?: number;     // Normalized 0-100
        adSpend?: number;
        revenue?: number;
        fetchedAt?: string;
        updatedAt?: string;
    };
}

/**
 * FacetEffect - Contrastive analysis result for a facet.
 * Similar to TraitEffect but specifically for facets.
 */
export interface FacetEffect {
    facetGroup: keyof FacetSet;
    facetValue: string;
    lift: number;
    liftPercent: number;
    confidence: number;
    n_with: number;
    n_without: number;
    avgSuccessWith: number;
    avgSuccessWithout: number;
    isSignificant: boolean;
    recommendation: 'use' | 'avoid' | 'test' | 'neutral';
}

/**
 * MultiEmbeddingSimilarity - Weighted similarity across embeddings
 */
export interface MultiEmbeddingSimilarity {
    creativeSimilarity: number;
    scriptSimilarity: number;
    visualSimilarity: number;
    weightedSimilarity: number;  // 0.5*creative + 0.3*script + 0.2*visual
}
