/**
 * Orb Lifecycle Management Module
 * 
 * Handles state transitions for orbs:
 * suggested → draft → published → observed
 * 
 * INVARIANTS:
 * - State transitions are unidirectional
 * - Lineage is always preserved
 * - User must explicitly convert suggested → draft
 * - Results only attach in observed state
 * - Raw data is never modified
 */

import { v4 as uuidv4 } from 'uuid';
import {
    Orb,
    OrbState,
    OrbSpec,
    OrbResults,
    LearningIntent,
    OrbCreationSource,
} from './orb-types';
import { FacetSet, EmbeddingSet } from './types';
import { createEmptyFacetSet } from './facet-derivation';

// ============================================
// VALID STATE TRANSITIONS
// ============================================

const VALID_TRANSITIONS: Record<OrbState, OrbState[]> = {
    suggested: ['draft'],           // User accepts suggestion
    draft: ['published', 'draft'],  // User publishes or edits
    published: ['observed'],        // Results come in
    observed: [],                   // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: OrbState, to: OrbState): boolean {
    return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get valid next states for a given state
 */
export function getValidNextStates(state: OrbState): OrbState[] {
    return VALID_TRANSITIONS[state];
}

// ============================================
// ORB CREATION
// ============================================

/**
 * Create an empty embedding set
 */
function createEmptyEmbeddingSet(): EmbeddingSet {
    return {
        creative: [],
        script: [],
        visual: [],
    };
}

/**
 * Create a new orb with initial state
 */
export function createOrb(params: {
    state: OrbState;
    createdFrom: OrbCreationSource;
    parentOrbId?: string;
    spec: OrbSpec;
    raw?: Orb['raw'];
    learningIntent?: LearningIntent;
}): Orb {
    const now = new Date().toISOString();

    return {
        id: uuidv4(),
        state: params.state,
        createdFrom: params.createdFrom,
        parentOrbId: params.parentOrbId,
        raw: params.raw,
        derived: {
            facets: params.spec.facets,
            embeddings: createEmptyEmbeddingSet(),
            embeddingVersion: '1.0.0',
            createdAt: now,
        },
        spec: params.spec,
        learningIntent: params.learningIntent,
        createdAt: now,
    };
}

/**
 * Create a suggested orb from a parent orb
 */
export function createSuggestedOrb(params: {
    parentOrbId: string;
    spec: OrbSpec;
    learningIntent: LearningIntent;
}): Orb {
    return createOrb({
        state: 'suggested',
        createdFrom: 'ai',
        parentOrbId: params.parentOrbId,
        spec: params.spec,
        learningIntent: params.learningIntent,
    });
}

/**
 * Create a user orb (manual creation)
 */
export function createUserOrb(params: {
    spec: OrbSpec;
    raw?: Orb['raw'];
}): Orb {
    return createOrb({
        state: 'draft',
        createdFrom: 'user',
        spec: params.spec,
        raw: params.raw,
    });
}

/**
 * Create an imported orb (from Facebook, etc.)
 */
export function createImportedOrb(params: {
    spec: OrbSpec;
    raw: Orb['raw'];
    results?: OrbResults;
}): Orb {
    const orb = createOrb({
        state: params.results ? 'observed' : 'published',
        createdFrom: 'user',
        spec: params.spec,
        raw: params.raw,
    });

    if (params.results) {
        orb.results = params.results;
    }

    return orb;
}

// ============================================
// STATE TRANSITIONS
// ============================================

/**
 * Convert a suggested orb to a draft
 * This is an explicit user action
 */
export function convertSuggestedToDraft(orb: Orb): Orb {
    if (orb.state !== 'suggested') {
        throw new Error(`Cannot convert orb in state '${orb.state}' to draft. Must be 'suggested'.`);
    }

    return {
        ...orb,
        state: 'draft',
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Update a draft orb (user edits)
 */
export function updateDraft(orb: Orb, updates: Partial<OrbSpec>): Orb {
    if (orb.state !== 'draft') {
        throw new Error(`Cannot update orb in state '${orb.state}'. Must be 'draft'.`);
    }

    return {
        ...orb,
        spec: {
            ...orb.spec,
            ...updates,
        },
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Publish a draft orb
 * This marks the orb as launched/active
 */
export function publishDraft(orb: Orb): Orb {
    if (orb.state !== 'draft') {
        throw new Error(`Cannot publish orb in state '${orb.state}'. Must be 'draft'.`);
    }

    return {
        ...orb,
        state: 'published',
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Attach results to a published orb
 * This transitions the orb to 'observed' state
 */
export function attachResults(orb: Orb, results: OrbResults): Orb {
    if (orb.state !== 'published') {
        throw new Error(`Cannot attach results to orb in state '${orb.state}'. Must be 'published'.`);
    }

    return {
        ...orb,
        state: 'observed',
        results: {
            ...results,
            fetchedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Update results for an observed orb
 */
export function updateResults(orb: Orb, results: Partial<OrbResults>): Orb {
    if (orb.state !== 'observed') {
        throw new Error(`Cannot update results for orb in state '${orb.state}'. Must be 'observed'.`);
    }

    return {
        ...orb,
        results: {
            ...orb.results,
            ...results,
            updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
    };
}

// ============================================
// LINEAGE TRACKING
// ============================================

/**
 * Get the lineage chain for an orb
 * Returns orb IDs from oldest ancestor to current orb
 */
export function getOrbLineage(orb: Orb, orbStore: Map<string, Orb>): string[] {
    const lineage: string[] = [];
    let current: Orb | undefined = orb;

    while (current) {
        lineage.unshift(current.id);
        if (current.parentOrbId) {
            current = orbStore.get(current.parentOrbId);
        } else {
            break;
        }
    }

    return lineage;
}

/**
 * Get all descendants of an orb
 */
export function getOrbDescendants(orbId: string, orbStore: Map<string, Orb>): Orb[] {
    const descendants: Orb[] = [];

    for (const orb of orbStore.values()) {
        if (orb.parentOrbId === orbId) {
            descendants.push(orb);
            descendants.push(...getOrbDescendants(orb.id, orbStore));
        }
    }

    return descendants;
}

/**
 * Check if orb is a descendant of another
 */
export function isDescendantOf(orb: Orb, ancestorId: string, orbStore: Map<string, Orb>): boolean {
    const lineage = getOrbLineage(orb, orbStore);
    return lineage.includes(ancestorId) && lineage[lineage.length - 1] !== ancestorId;
}

// ============================================
// ORB QUERIES
// ============================================

/**
 * Filter orbs by state
 */
export function filterByState(orbs: Orb[], state: OrbState): Orb[] {
    return orbs.filter(orb => orb.state === state);
}

/**
 * Get suggested orbs
 */
export function getSuggestedOrbs(orbs: Orb[]): Orb[] {
    return filterByState(orbs, 'suggested');
}

/**
 * Get observed orbs (with results)
 */
export function getObservedOrbs(orbs: Orb[]): Orb[] {
    return filterByState(orbs, 'observed');
}

/**
 * Get user's active ads (published + observed)
 */
export function getUserAds(orbs: Orb[]): Orb[] {
    return orbs.filter(orb => orb.state === 'published' || orb.state === 'observed');
}

/**
 * Get AI suggestions (not yet converted)
 */
export function getAISuggestions(orbs: Orb[]): Orb[] {
    return orbs.filter(orb => orb.state === 'suggested' && orb.createdFrom === 'ai');
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate an orb structure
 */
export function validateOrb(orb: Orb): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!orb.id) errors.push('Missing id');
    if (!orb.state) errors.push('Missing state');
    if (!orb.createdFrom) errors.push('Missing createdFrom');
    if (!orb.spec) errors.push('Missing spec');
    if (!orb.derived) errors.push('Missing derived');

    // State-specific validation
    if (orb.state === 'suggested' && !orb.learningIntent) {
        errors.push('Suggested orbs must have learningIntent');
    }

    if (orb.state === 'observed' && !orb.results) {
        errors.push('Observed orbs must have results');
    }

    // Spec validation
    if (orb.spec) {
        if (!orb.spec.platform) errors.push('Spec missing platform');
        if (!orb.spec.objective) errors.push('Spec missing objective');
        if (!orb.spec.facets) errors.push('Spec missing facets');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// ============================================
// LEARNING LOOP
// ============================================

/**
 * Record when a suggested orb is accepted
 */
export interface SuggestionAcceptance {
    suggestionId: string;
    acceptedAt: string;
    experimentLever: string;
    facetGroup: string;
}

/**
 * Record learning from an observed orb that came from a suggestion
 */
export interface LearningRecord {
    originalSuggestionId: string;
    observedOrbId: string;
    experimentLever: string;
    predictedScore: number;
    actualScore: number;
    delta: number;
    recordedAt: string;
}

/**
 * Create a learning record when a suggested orb becomes observed
 */
export function createLearningRecord(
    originalSuggestion: Orb,
    observedOrb: Orb
): LearningRecord | null {
    if (!originalSuggestion.learningIntent) {
        return null;
    }

    if (!observedOrb.results?.successScore) {
        return null;
    }

    const predictedScore = originalSuggestion.prediction?.score ?? 50;
    const actualScore = observedOrb.results.successScore;

    return {
        originalSuggestionId: originalSuggestion.id,
        observedOrbId: observedOrb.id,
        experimentLever: originalSuggestion.learningIntent.experimentLever,
        predictedScore,
        actualScore,
        delta: actualScore - predictedScore,
        recordedAt: new Date().toISOString(),
    };
}
