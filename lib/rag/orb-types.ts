/**
 * Orb Types - Core type definitions for the Orb-based Ad Intelligence System
 * 
 * CORE PRINCIPLES:
 * - One orb = one ad concept
 * - Orbs have lifecycle states, not different object types
 * - Suggested orbs are draft ideas, not predictions
 * - Raw JSON is immutable and always preserved
 * - Embeddings drive similarity, not traits
 * - Traits/facets are for explanation, filtering, and contrast only
 */

import { FacetSet, EmbeddingSet, TraitEffect } from './types';

// ============================================
// ORB LIFECYCLE STATES
// ============================================

/**
 * OrbState - Lifecycle states for an orb
 * 
 * - suggested: AI-generated idea, not run
 * - draft: User-edited version
 * - published: Launched / imported
 * - observed: Results available
 */
export type OrbState = 'suggested' | 'draft' | 'published' | 'observed';

/**
 * OrbCreationSource - Who created the orb
 */
export type OrbCreationSource = 'user' | 'ai';

// ============================================
// LEARNING INTENT
// ============================================

/**
 * LearningIntent - Defines what a suggested orb is testing
 * 
 * Each suggested orb tests exactly ONE experimental lever.
 * This enables structured learning from results.
 */
export interface LearningIntent {
    /** The single experimental lever being tested */
    experimentLever: string;

    /** Why this experiment was chosen */
    reason: string;

    /** Expected information gain (0-100) */
    expectedInfoGain?: number;

    /** Control values (what the experiment is comparing against) */
    controlValues?: Record<string, unknown>;

    /** The facet group this lever belongs to */
    facetGroup?: keyof FacetSet;
}

// ============================================
// ORB SPECIFICATION
// ============================================

/**
 * CTA - Call to action specification
 */
export interface CTASpec {
    type: string;
    text?: string;
    strength?: 'strong' | 'moderate' | 'weak';
}

/**
 * OrbSpec - The creative specification for an orb
 * 
 * Contains all the configuration needed to create/run the ad.
 */
export interface OrbSpec {
    /** Target platform */
    platform: string;

    /** Campaign objective */
    objective: string;

    /** Derived facets for this spec */
    facets: FacetSet;

    /** Script outline (optional) */
    scriptOutline?: string[];

    /** Shot beats / scene descriptions (optional) */
    shotBeats?: string[];

    /** Edit checklist (optional) */
    editChecklist?: string[];

    /** Call to action specification */
    cta?: CTASpec;

    /** Additional notes */
    notes?: string;
}

// ============================================
// PREDICTION OUTPUT
// ============================================

/**
 * FourSectionExplanation - Structured explanation format
 * 
 * Every prediction includes these 4 sections:
 * 1. What similar ads did
 * 2. How differences matter
 * 3. Confidence level
 * 4. What data would help
 */
export interface FourSectionExplanation {
    /** "Here's what similar ads did" */
    neighborEvidence: string;

    /** "Here's how your differences matter" */
    contrastiveAnalysis: string;

    /** "Here's our confidence" */
    confidenceExplanation: string;

    /** "Here's what data would help" */
    dataGapSuggestions: string;
}

/**
 * PredictionOutput - Result of predicting an orb's success
 */
export interface PredictionOutput {
    /** Predicted success score (0-100) */
    score: number;

    /** Confidence in prediction (0-100) */
    confidence: number;

    /** Method used for prediction */
    method: 'rag' | 'hybrid' | 'legacy';

    /** 4-section explanation */
    explanation: FourSectionExplanation;

    /** Top positive trait effects */
    topPositive: TraitEffect[];

    /** Top negative trait effects */
    topNegative: TraitEffect[];

    /** Prediction bounds */
    bounds: {
        lower: number;
        upper: number;
    };

    /** Number of neighbors used */
    neighborCount: number;

    /** Average neighbor similarity */
    avgSimilarity: number;

    /** Timestamp */
    predictedAt: string;
}

// ============================================
// RESULTS
// ============================================

/**
 * OrbResults - Performance results for an observed orb
 */
export interface OrbResults {
    /** Normalized success score (0-100) */
    successScore?: number;

    /** Return on ad spend */
    roas?: number;

    /** Click-through rate */
    ctr?: number;

    /** Total conversions */
    conversions?: number;

    /** Total impressions */
    impressions?: number;

    /** Total clicks */
    clicks?: number;

    /** Total ad spend */
    adSpend?: number;

    /** Total revenue */
    revenue?: number;

    /** When results were fetched */
    fetchedAt?: string;

    /** When results were last updated */
    updatedAt?: string;
}

// ============================================
// MAIN ORB INTERFACE
// ============================================

/**
 * Orb - The canonical representation of an ad concept
 * 
 * INVARIANTS:
 * - One orb = one ad concept
 * - State transitions: suggested → draft → published → observed
 * - Raw data is immutable once set
 * - Derived data can be regenerated
 * - Results only attach in 'observed' state
 */
export interface Orb {
    /** Unique identifier */
    id: string;

    /** Current lifecycle state */
    state: OrbState;

    /** Parent orb ID (when derived from a suggestion or copied) */
    parentOrbId?: string;

    /** Who created this orb */
    createdFrom: OrbCreationSource;

    /** 
     * Layer 1: Raw data (IMMUTABLE)
     * Never modified after creation
     */
    raw?: {
        /** Full AI-generated analysis JSON (stored verbatim) */
        analysis_json?: Record<string, unknown>;

        /** Source of the ad */
        source?: 'facebook_import' | 'manual_upload' | 'webhook' | 'ai_suggested';

        /** Original video URL */
        videoUrl?: string;

        /** Original ad text */
        adText?: string;

        /** Facebook metadata (if imported) */
        fbMetadata?: Record<string, unknown>;

        /** When raw data was created */
        createdAt?: string;
    };

    /**
     * Layer 2: Derived data
     * Computed from raw, can be regenerated
     */
    derived: {
        /** Derived facets for filtering/explanation */
        facets: FacetSet;

        /** Multi-layer embeddings for similarity */
        embeddings: EmbeddingSet;

        /** Version of the embedding model used */
        embeddingVersion: string;

        /** Canonical text used for embedding generation */
        canonicalTexts?: {
            creative: string;
            script: string;
            visual: string;
        };

        /** When derived data was computed */
        createdAt: string;
    };

    /** The creative specification */
    spec: OrbSpec;

    /** Prediction results (if scored) */
    prediction?: PredictionOutput;

    /** Learning intent (for suggested orbs) */
    learningIntent?: LearningIntent;

    /** Performance results (only in 'observed' state) */
    results?: OrbResults;

    /** When the orb was created */
    createdAt: string;

    /** When the orb was last updated */
    updatedAt?: string;
}

// ============================================
// SUGGESTED ORB SCORING
// ============================================

/**
 * SuggestedOrbEvidence - Evidence used for scoring
 */
export interface SuggestedOrbEvidence {
    /** Number of neighbors used */
    neighbors: number;

    /** Average similarity to neighbors */
    avgSimilarity: number;

    /** Trait effects from contrastive analysis */
    traitEffects: TraitEffect[];

    /** Platforms represented in neighbors */
    platforms: string[];

    /** Date range of neighbors */
    dateRange: {
        oldest: string;
        newest: string;
    };
}

/**
 * SuggestedOrbExplanation - Human-readable explanation
 */
export interface SuggestedOrbExplanation {
    /** What's proven (high-confidence elements) */
    whatsProven: string[];

    /** What's being tested (the experimental lever) */
    whatsTested: string;

    /** Why this suggestion was generated */
    whySuggested: string;
}

/**
 * SuggestedOrbScore - Full scoring result for a suggested orb
 */
export interface SuggestedOrbScore {
    /** Predicted success score (0-100) */
    predictedScore: number;

    /** Confidence in prediction (0-100) */
    confidence: number;

    /** Human-readable explanation */
    explanation: SuggestedOrbExplanation;

    /** Evidence used for scoring */
    evidence: SuggestedOrbEvidence;

    /** When the score was computed */
    scoredAt: string;
}

// ============================================
// TRIGGER CONDITIONS
// ============================================

/**
 * SuggestionTrigger - Why suggestions were generated
 */
export type SuggestionTrigger =
    | 'new_orb_added'
    | 'low_confidence'
    | 'data_gap_detected'
    | 'user_request'
    | 'scheduled';

/**
 * SuggestionContext - Context for suggestion generation
 */
export interface SuggestionContext {
    /** What triggered the suggestion */
    trigger: SuggestionTrigger;

    /** Parent orb (if applicable) */
    parentOrbId?: string;

    /** Current confidence level (if low_confidence trigger) */
    currentConfidence?: number;

    /** Detected data gaps */
    dataGaps?: string[];

    /** Maximum suggestions to generate */
    maxSuggestions: number;
}

// ============================================
// EXPERIMENTAL LEVERS
// ============================================

/**
 * ExperimentalLever - A dimension to test
 */
export interface ExperimentalLever {
    /** Unique identifier for the lever */
    id: string;

    /** Human-readable name */
    name: string;

    /** Description of what's being tested */
    description: string;

    /** Facet group this belongs to */
    facetGroup: keyof FacetSet;

    /** Current sample size (ads with this trait) */
    sampleSize: number;

    /** Current uncertainty (0-100) */
    uncertainty: number;

    /** Estimated potential impact (0-100) */
    potentialImpact: number;

    /** The values to test */
    testValues: {
        control: unknown;
        variant: unknown;
    };
}

/**
 * Predefined experimental levers
 */
export const EXPERIMENTAL_LEVERS: Omit<ExperimentalLever, 'sampleSize' | 'uncertainty' | 'potentialImpact'>[] = [
    {
        id: 'brand_timing',
        name: 'Brand Reveal Timing',
        description: 'Early vs late brand reveal',
        facetGroup: 'brand',
        testValues: { control: 'early_reveal', variant: 'late_reveal' },
    },
    {
        id: 'voiceover',
        name: 'Voiceover',
        description: 'Voiceover on vs off',
        facetGroup: 'audio_voice',
        testValues: { control: false, variant: true },
    },
    {
        id: 'animation',
        name: 'Animation Style',
        description: 'Animation vs live action',
        facetGroup: 'media_format',
        testValues: { control: 'live_action', variant: 'animated' },
    },
    {
        id: 'jingle',
        name: 'Audio Jingle',
        description: 'Jingle vs silence/ambient',
        facetGroup: 'audio_voice',
        testValues: { control: 'music', variant: 'jingle' },
    },
    {
        id: 'subtitles',
        name: 'Subtitles',
        description: 'Subtitles on vs off',
        facetGroup: 'text_features',
        testValues: { control: false, variant: true },
    },
    {
        id: 'ugc_style',
        name: 'UGC Style',
        description: 'UGC creator vs professional',
        facetGroup: 'talent_face',
        testValues: { control: 'professional', variant: 'ugc_creator' },
    },
    {
        id: 'hook_type',
        name: 'Hook Type',
        description: 'Different hook approaches',
        facetGroup: 'content_hook',
        testValues: { control: 'curiosity', variant: 'question' },
    },
    {
        id: 'cta_strength',
        name: 'CTA Strength',
        description: 'Strong vs subtle CTA',
        facetGroup: 'cta',
        testValues: { control: 'moderate', variant: 'strong' },
    },
];
