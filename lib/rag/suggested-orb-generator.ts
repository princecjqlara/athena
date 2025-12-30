/**
 * Suggested Orb Generator Module
 * 
 * Generates AI-powered ad suggestions based on:
 * - High-performing neighbor patterns (proven core)
 * - Low-confidence experimental levers (ONE per suggestion)
 * - Data gap detection
 * 
 * RULES:
 * - Maximum 3 suggestions per trigger
 * - Each suggestion has exactly ONE experimental lever
 * - Never generate if confidence is already high (>80%)
 * - Never auto-publish
 * - Preserve lineage
 */

import {
    Orb,
    OrbSpec,
    LearningIntent,
    SuggestionContext,
    SuggestionTrigger,
    ExperimentalLever,
    EXPERIMENTAL_LEVERS,
} from './orb-types';
import { FacetSet, TraitEffect, NeighborAd } from './types';
import { retrieveSimilarAdsWithResults } from './retrieve-similar';
import { performContrastiveAnalysis, getTraitsNeedingMoreData } from './contrastive-analysis';
import { computeConfidence } from './neighbor-prediction';
import { createSuggestedOrb } from './orb-lifecycle';
import { convertOrbToAdOrb } from './orb-adapter';
import { isFeatureEnabled, getFeatureValue } from './feature-flags';
import { createEmptyFacetSet } from './facet-derivation';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
    maxSuggestions: 3,
    minConfidenceForNoSuggestion: 80,
    minNeighborsForSuggestion: 5,
    minUncertaintyForExperiment: 40,
};

// ============================================
// TRIGGER DETECTION
// ============================================

/**
 * Check if suggestions should be generated
 */
export function shouldGenerateSuggestions(
    orb: Orb,
    confidence: number,
    recentSuggestionCount: number
): { shouldGenerate: boolean; trigger: SuggestionTrigger | null; reason: string } {
    // Check feature flag
    if (!isFeatureEnabled('SUGGESTED_ORBS_ENABLED')) {
        return { shouldGenerate: false, trigger: null, reason: 'Feature disabled' };
    }

    // Don't overwhelm with suggestions
    const maxSuggestions = getFeatureValue('MAX_SUGGESTIONS_PER_TRIGGER', DEFAULT_CONFIG.maxSuggestions);
    if (recentSuggestionCount >= maxSuggestions) {
        return { shouldGenerate: false, trigger: null, reason: 'Max suggestions reached' };
    }

    // High confidence = no suggestions needed
    const minConfidence = getFeatureValue('MIN_CONFIDENCE_FOR_NO_SUGGESTION', DEFAULT_CONFIG.minConfidenceForNoSuggestion);
    if (confidence >= minConfidence) {
        return { shouldGenerate: false, trigger: null, reason: 'Confidence already high' };
    }

    // Low confidence = suggest experiments
    if (confidence < 60) {
        return { shouldGenerate: true, trigger: 'low_confidence', reason: `Confidence is ${confidence}%` };
    }

    // New orb = generate suggestions
    if (orb.state === 'draft' && !orb.parentOrbId) {
        return { shouldGenerate: true, trigger: 'new_orb_added', reason: 'New orb created' };
    }

    return { shouldGenerate: false, trigger: null, reason: 'No trigger conditions met' };
}

// ============================================
// PROVEN CORE EXTRACTION
// ============================================

/**
 * Extract proven core elements from high-performing neighbors
 */
export function extractProvenCore(
    neighbors: NeighborAd[],
    traitEffects: TraitEffect[]
): {
    facets: Partial<FacetSet>;
    traits: string[];
    avgScore: number;
} {
    // Get high-confidence positive traits
    const provenTraits = traitEffects
        .filter(e => e.isSignificant && e.lift > 0 && e.confidence >= 60)
        .sort((a, b) => b.lift - a.lift)
        .slice(0, 5)
        .map(e => e.trait);

    // Get average score from top neighbors
    const topNeighbors = neighbors.slice(0, Math.min(5, neighbors.length));
    const avgScore = topNeighbors.reduce((sum, n) => {
        const score = n.orb.results?.successScore ?? 50;
        return sum + score;
    }, 0) / topNeighbors.length;

    // Extract common facets from top performers
    const facetCounts: Record<string, Record<string, number>> = {};
    const facetGroups: (keyof FacetSet)[] = [
        'platform_placement', 'media_format', 'visual_style', 'audio_voice',
        'content_hook', 'text_features', 'talent_face', 'sentiment', 'brand', 'cta'
    ];

    for (const neighbor of topNeighbors) {
        // Access facets from derived if available, otherwise skip
        const facets = (neighbor.orb as unknown as Orb).derived?.facets;
        if (!facets) continue;

        for (const group of facetGroups) {
            if (!facetCounts[group]) facetCounts[group] = {};
            for (const value of facets[group] || []) {
                facetCounts[group][value] = (facetCounts[group][value] || 0) + 1;
            }
        }
    }

    // Extract most common facets (appearing in >50% of top performers)
    const threshold = Math.ceil(topNeighbors.length / 2);
    const provenFacets: Partial<FacetSet> = {};

    for (const group of facetGroups) {
        const groupCounts = facetCounts[group] || {};
        const commonValues = Object.entries(groupCounts)
            .filter(([, count]) => count >= threshold)
            .map(([value]) => value);

        if (commonValues.length > 0) {
            provenFacets[group] = commonValues;
        }
    }

    return {
        facets: provenFacets,
        traits: provenTraits,
        avgScore,
    };
}

// ============================================
// EXPERIMENTAL LEVER SELECTION
// ============================================

/**
 * Select the best experimental lever to test
 */
export function selectExperimentalLever(
    lowConfidenceTraits: TraitEffect[],
    usedLevers: string[]
): ExperimentalLever | null {
    // Score each lever based on:
    // - Low sample size (high uncertainty)
    // - Potential impact (based on variance in existing data)
    // - Not already used

    const scoredLevers: { lever: ExperimentalLever; score: number }[] = [];

    for (const baseLever of EXPERIMENTAL_LEVERS) {
        // Skip if already used
        if (usedLevers.includes(baseLever.id)) continue;

        // Find matching trait effect
        const matchingEffect = lowConfidenceTraits.find(
            e => e.trait.toLowerCase().includes(baseLever.id.replace('_', ''))
        );

        // Calculate uncertainty and potential impact
        const uncertainty = matchingEffect
            ? 100 - matchingEffect.confidence
            : DEFAULT_CONFIG.minUncertaintyForExperiment;

        const potentialImpact = matchingEffect
            ? Math.abs(matchingEffect.lift) * 2 // Higher lift = more potential
            : 50; // Default moderate impact

        // Skip if uncertainty is too low
        if (uncertainty < DEFAULT_CONFIG.minUncertaintyForExperiment) continue;

        const lever: ExperimentalLever = {
            ...baseLever,
            sampleSize: matchingEffect ? matchingEffect.n_with + matchingEffect.n_without : 0,
            uncertainty,
            potentialImpact: Math.min(100, potentialImpact),
        };

        // Score = uncertainty * impact
        const score = lever.uncertainty * 0.6 + lever.potentialImpact * 0.4;

        scoredLevers.push({ lever, score });
    }

    // Sort by score and return best
    scoredLevers.sort((a, b) => b.score - a.score);

    return scoredLevers[0]?.lever ?? null;
}

// ============================================
// SPEC GENERATION
// ============================================

/**
 * Generate a spec for a suggested orb
 */
export function generateSuggestedSpec(
    parentSpec: OrbSpec,
    provenCore: ReturnType<typeof extractProvenCore>,
    lever: ExperimentalLever
): OrbSpec {
    // Start with parent spec
    const spec: OrbSpec = {
        ...parentSpec,
        facets: createEmptyFacetSet(),
    };

    // Apply proven core facets
    for (const [group, values] of Object.entries(provenCore.facets)) {
        if (values && values.length > 0) {
            spec.facets[group as keyof FacetSet] = [...values];
        }
    }

    // Apply experimental lever
    const leverFacetGroup = lever.facetGroup;
    const variantValue = lever.testValues.variant;

    // Ensure the facet group exists
    if (!spec.facets[leverFacetGroup]) {
        spec.facets[leverFacetGroup] = [];
    }

    // Add the variant value
    if (typeof variantValue === 'string') {
        if (!spec.facets[leverFacetGroup].includes(variantValue)) {
            spec.facets[leverFacetGroup].push(variantValue);
        }
    } else if (typeof variantValue === 'boolean' && variantValue) {
        // For boolean levers, add the lever name as a facet
        const facetName = lever.id.replace('_', '-');
        if (!spec.facets[leverFacetGroup].includes(facetName)) {
            spec.facets[leverFacetGroup].push(facetName);
        }
    }

    // Add notes about the experiment
    spec.notes = `Testing: ${lever.name} (${lever.description})`;

    return spec;
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Generate suggested orbs for a parent orb
 */
export async function generateSuggestedOrbs(
    parentOrb: Orb,
    context: SuggestionContext
): Promise<Orb[]> {
    const suggestions: Orb[] = [];
    const usedLevers: string[] = [];

    // Convert to AdOrb for RAG queries
    const queryOrb = convertOrbToAdOrb(parentOrb);

    // Retrieve similar ads
    const neighbors = await retrieveSimilarAdsWithResults(queryOrb, 20);

    // If not enough neighbors, can't generate suggestions
    if (neighbors.length < DEFAULT_CONFIG.minNeighborsForSuggestion) {
        return [];
    }

    // Perform contrastive analysis
    const analysis = performContrastiveAnalysis(queryOrb, neighbors);

    // Get low confidence traits
    const lowConfidenceTraits = getTraitsNeedingMoreData(analysis);

    // Extract proven core
    const provenCore = extractProvenCore(neighbors, analysis.traitEffects);

    // Generate up to maxSuggestions
    const maxSuggestions = Math.min(
        context.maxSuggestions,
        getFeatureValue('MAX_SUGGESTIONS_PER_TRIGGER', DEFAULT_CONFIG.maxSuggestions)
    );

    for (let i = 0; i < maxSuggestions; i++) {
        // Select experimental lever
        const lever = selectExperimentalLever(lowConfidenceTraits, usedLevers);

        if (!lever) {
            break; // No more levers to test
        }

        usedLevers.push(lever.id);

        // Generate spec
        const spec = generateSuggestedSpec(parentOrb.spec, provenCore, lever);

        // Create learning intent
        const learningIntent: LearningIntent = {
            experimentLever: lever.id,
            reason: `Testing ${lever.name}: ${lever.description}. Current uncertainty: ${lever.uncertainty}%`,
            expectedInfoGain: lever.potentialImpact,
            controlValues: { [lever.facetGroup]: lever.testValues.control },
            facetGroup: lever.facetGroup,
        };

        // Create suggested orb
        const suggestion = createSuggestedOrb({
            parentOrbId: parentOrb.id,
            spec,
            learningIntent,
        });

        suggestions.push(suggestion);
    }

    return suggestions;
}

// ============================================
// EXPLANATION GENERATION
// ============================================

/**
 * Generate explanation for why a suggestion was created
 */
export function explainSuggestion(
    suggestion: Orb,
    provenCore: ReturnType<typeof extractProvenCore>
): {
    whatsProven: string[];
    whatsTested: string;
    whySuggested: string;
} {
    if (!suggestion.learningIntent) {
        return {
            whatsProven: [],
            whatsTested: 'Unknown',
            whySuggested: 'No learning intent specified',
        };
    }

    // What's proven
    const whatsProven = provenCore.traits.map(trait => {
        return `${trait} correlates with higher performance`;
    });

    if (provenCore.avgScore > 70) {
        whatsProven.unshift(`Top performers average ${Math.round(provenCore.avgScore)}% success`);
    }

    // What's tested
    const lever = EXPERIMENTAL_LEVERS.find(l => l.id === suggestion.learningIntent!.experimentLever);
    const whatsTested = lever
        ? `${lever.name}: ${lever.description}`
        : suggestion.learningIntent.experimentLever;

    // Why suggested
    const whySuggested = suggestion.learningIntent.reason;

    return {
        whatsProven,
        whatsTested,
        whySuggested,
    };
}
