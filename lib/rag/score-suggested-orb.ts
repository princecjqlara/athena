/**
 * Suggested Orb Scoring Module
 * 
 * Scores suggested orbs like real ads:
 * 1. Build embeddings from suggested spec
 * 2. Retrieve neighbors
 * 3. Predict baseline score
 * 4. Apply contrastive effects
 * 5. Compute confidence
 * 6. Generate explanation
 * 
 * RULES:
 * - Score must always return a result (fallback allowed)
 * - Never expose embeddings
 * - Deterministic behavior
 */

import {
    Orb,
    SuggestedOrbScore,
    SuggestedOrbExplanation,
    SuggestedOrbEvidence,
    PredictionOutput,
    FourSectionExplanation,
} from './orb-types';
import { TraitEffect, NeighborAd, DEFAULT_RAG_CONFIG } from './types';
import { convertOrbToAdOrb } from './orb-adapter';
import { generateOrbEmbedding } from './build-embedding';
import { retrieveSimilarAdsWithResults } from './retrieve-similar';
import { performContrastiveAnalysis } from './contrastive-analysis';
import {
    computeWeightedPrediction,
    computeConfidence,
    applyContrastiveAdjustment,
    getPredictionBounds,
} from './neighbor-prediction';
import { getOrbSuccessScore } from './ad-orb';
import { clampScore } from './safety-config';

// ============================================
// MAIN SCORING FUNCTION
// ============================================

/**
 * Score a suggested orb
 */
export async function scoreSuggestedOrb(orb: Orb): Promise<SuggestedOrbScore> {
    const startTime = Date.now();

    try {
        // Convert to AdOrb for RAG queries
        const adOrb = convertOrbToAdOrb(orb);

        // Generate embedding if not already present
        const orbWithEmbedding = adOrb.embedding?.length
            ? adOrb
            : await generateOrbEmbedding(adOrb);

        // Retrieve similar ads
        const neighbors = await retrieveSimilarAdsWithResults(orbWithEmbedding, 20);

        // If not enough neighbors, return low-confidence score
        if (neighbors.length < DEFAULT_RAG_CONFIG.minNeighbors) {
            return createLowConfidenceScore(orb, neighbors.length);
        }

        // Compute baseline prediction
        const basePrediction = computeWeightedPrediction(neighbors);

        // Perform contrastive analysis
        const analysis = performContrastiveAnalysis(orbWithEmbedding, neighbors);

        // Apply contrastive adjustment
        const adjustedPrediction = applyContrastiveAdjustment(basePrediction, analysis);

        // Compute confidence
        const confidence = computeConfidence(neighbors);

        // Generate explanation
        const explanation = generateExplanation(orb, analysis, neighbors);

        // Build evidence
        const evidence = buildEvidence(neighbors, analysis.traitEffects);

        return {
            predictedScore: clampScore(adjustedPrediction),
            confidence,
            explanation,
            evidence,
            scoredAt: new Date().toISOString(),
        };
    } catch (error) {
        // Fallback on error
        console.error('Error scoring suggested orb:', error);
        return createFallbackScore(orb);
    }
}

// ============================================
// PREDICTION OUTPUT GENERATION
// ============================================

/**
 * Generate full prediction output for an orb
 */
export async function generatePrediction(orb: Orb): Promise<PredictionOutput> {
    const score = await scoreSuggestedOrb(orb);

    // Convert to AdOrb for queries
    const adOrb = convertOrbToAdOrb(orb);
    const neighbors = await retrieveSimilarAdsWithResults(adOrb, 20);
    const analysis = performContrastiveAnalysis(adOrb, neighbors);

    // Determine method
    const method: 'rag' | 'hybrid' | 'legacy' =
        score.confidence >= 60 ? 'rag' :
            score.confidence >= 30 ? 'hybrid' : 'legacy';

    // Build 4-section explanation
    const fourSection: FourSectionExplanation = {
        neighborEvidence: buildNeighborEvidence(neighbors, score.predictedScore),
        contrastiveAnalysis: buildContrastiveSection(analysis.topPositive, analysis.topNegative),
        confidenceExplanation: buildConfidenceSection(score.confidence, neighbors.length),
        dataGapSuggestions: buildDataGapSection(analysis.lowConfidence),
    };

    // Calculate bounds
    const bounds = getPredictionBounds(neighbors, score.predictedScore);

    return {
        score: score.predictedScore,
        confidence: score.confidence,
        method,
        explanation: fourSection,
        topPositive: analysis.topPositive,
        topNegative: analysis.topNegative,
        bounds,
        neighborCount: neighbors.length,
        avgSimilarity: score.evidence.avgSimilarity,
        predictedAt: new Date().toISOString(),
    };
}

// ============================================
// EXPLANATION HELPERS
// ============================================

/**
 * Generate explanation for suggested orb
 */
function generateExplanation(
    orb: Orb,
    analysis: { topPositive: TraitEffect[]; topNegative: TraitEffect[] },
    neighbors: NeighborAd[]
): SuggestedOrbExplanation {
    // What's proven
    const whatsProven: string[] = [];

    for (const effect of analysis.topPositive.slice(0, 3)) {
        whatsProven.push(
            `${formatTraitName(effect.trait)} adds +${Math.round(effect.lift)} points`
        );
    }

    if (neighbors.length >= 10) {
        const topScores = neighbors.slice(0, 5).map(n => getOrbSuccessScore(n.orb) ?? 50);
        const avgTop = topScores.reduce((a, b) => a + b, 0) / topScores.length;
        whatsProven.unshift(`Top similar ads average ${Math.round(avgTop)}% success`);
    }

    // What's tested
    const whatsTested = orb.learningIntent
        ? `${orb.learningIntent.experimentLever}: ${orb.learningIntent.reason}`
        : 'Unknown experimental lever';

    // Why suggested
    let whySuggested = 'To reduce uncertainty and improve future predictions';
    if (orb.learningIntent?.expectedInfoGain) {
        whySuggested = `Expected to reduce uncertainty by ${orb.learningIntent.expectedInfoGain}%`;
    }

    return {
        whatsProven,
        whatsTested,
        whySuggested,
    };
}

/**
 * Build evidence object
 */
function buildEvidence(
    neighbors: NeighborAd[],
    traitEffects: TraitEffect[]
): SuggestedOrbEvidence {
    const timestamps = neighbors.map(n => new Date(n.orb.metadata.createdAt).getTime());
    const platforms = [...new Set(neighbors.map(n => n.orb.metadata.platform))];

    const avgSimilarity = neighbors.length > 0
        ? neighbors.reduce((sum, n) => sum + n.hybridSimilarity, 0) / neighbors.length
        : 0;

    return {
        neighbors: neighbors.length,
        avgSimilarity: Math.round(avgSimilarity * 100) / 100,
        traitEffects: traitEffects.slice(0, 10),
        platforms,
        dateRange: {
            oldest: new Date(Math.min(...timestamps)).toISOString(),
            newest: new Date(Math.max(...timestamps)).toISOString(),
        },
    };
}

// ============================================
// 4-SECTION EXPLANATION BUILDERS
// ============================================

/**
 * Build "Here's what similar ads did" section
 */
function buildNeighborEvidence(neighbors: NeighborAd[], prediction: number): string {
    if (neighbors.length === 0) {
        return 'Not enough similar ads found for comparison.';
    }

    const scores = neighbors
        .map(n => getOrbSuccessScore(n.orb))
        .filter((s): s is number => s !== undefined);

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    return `Based on ${neighbors.length} similar ads with scores ranging from ${Math.round(minScore)}% to ${Math.round(maxScore)}% (average: ${Math.round(avgScore)}%), we predict ${Math.round(prediction)}% success.`;
}

/**
 * Build "Here's how your differences matter" section
 */
function buildContrastiveSection(
    positive: TraitEffect[],
    negative: TraitEffect[]
): string {
    const parts: string[] = [];

    if (positive.length > 0) {
        const topPositive = positive[0];
        parts.push(
            `${formatTraitName(topPositive.trait)} typically adds +${Math.round(topPositive.lift)} points`
        );
    }

    if (negative.length > 0) {
        const topNegative = negative[0];
        parts.push(
            `${formatTraitName(topNegative.trait)} typically reduces by ${Math.round(Math.abs(topNegative.lift))} points`
        );
    }

    if (parts.length === 0) {
        return 'No significant trait differences detected.';
    }

    return parts.join('. ') + '.';
}

/**
 * Build "Here's our confidence" section
 */
function buildConfidenceSection(confidence: number, neighborCount: number): string {
    let level: string;
    let reason: string;

    if (confidence >= 80) {
        level = 'High';
        reason = 'Strong pattern match with many similar ads';
    } else if (confidence >= 60) {
        level = 'Moderate';
        reason = 'Good pattern match, some uncertainty remains';
    } else if (confidence >= 40) {
        level = 'Low';
        reason = 'Limited similar data available';
    } else {
        level = 'Very Low';
        reason = 'Insufficient data for reliable prediction';
    }

    return `${level} confidence (${confidence}%). ${reason}. Based on ${neighborCount} similar ads.`;
}

/**
 * Build "Here's what data would help" section
 */
function buildDataGapSection(lowConfidence: TraitEffect[]): string {
    if (lowConfidence.length === 0) {
        return 'No significant data gaps identified.';
    }

    const gaps = lowConfidence.slice(0, 3).map(e =>
        `${formatTraitName(e.trait)} (only ${e.n_with + e.n_without} examples)`
    );

    return `More data would help for: ${gaps.join(', ')}.`;
}

// ============================================
// FALLBACK SCORES
// ============================================

/**
 * Create low confidence score when not enough neighbors
 */
function createLowConfidenceScore(orb: Orb, neighborCount: number): SuggestedOrbScore {
    return {
        predictedScore: 50, // Default neutral
        confidence: Math.min(neighborCount * 10, 30),
        explanation: {
            whatsProven: ['Insufficient data for proven patterns'],
            whatsTested: orb.learningIntent?.experimentLever ?? 'Unknown',
            whySuggested: 'To gather more data for future predictions',
        },
        evidence: {
            neighbors: neighborCount,
            avgSimilarity: 0,
            traitEffects: [],
            platforms: [],
            dateRange: {
                oldest: new Date().toISOString(),
                newest: new Date().toISOString(),
            },
        },
        scoredAt: new Date().toISOString(),
    };
}

/**
 * Create fallback score on error
 */
function createFallbackScore(orb: Orb): SuggestedOrbScore {
    return {
        predictedScore: 50,
        confidence: 0,
        explanation: {
            whatsProven: ['Unable to analyze similar ads'],
            whatsTested: orb.learningIntent?.experimentLever ?? 'Unknown',
            whySuggested: 'Scoring system encountered an error',
        },
        evidence: {
            neighbors: 0,
            avgSimilarity: 0,
            traitEffects: [],
            platforms: [],
            dateRange: {
                oldest: new Date().toISOString(),
                newest: new Date().toISOString(),
            },
        },
        scoredAt: new Date().toISOString(),
    };
}

// ============================================
// UTILITIES
// ============================================

/**
 * Format trait name for display
 */
function formatTraitName(trait: string): string {
    return trait
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}
