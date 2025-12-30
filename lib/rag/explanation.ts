/**
 * Explanation Generation Module
 * 
 * Generates evidence-based explanations using contrastive evidence.
 * Format: "Among 18 similar ads, those with subtitles performed +11% better."
 */

import {
    AdOrb,
    NeighborAd,
    TraitEffect,
    ContrastiveAnalysis,
    ExplanationDetail,
    ExperimentSuggestion
} from './types';
import { getOrbSuccessScore } from './ad-orb';

// ============================================
// TRAIT IMPACT EXPLANATIONS
// ============================================

/**
 * Generate explanation for a single trait effect
 */
function explainTraitEffect(effect: TraitEffect, totalNeighbors: number): string {
    const { trait, traitValue, lift, liftPercent, n_with, n_without, confidence } = effect;

    const traitDisplay = typeof traitValue === 'boolean'
        ? trait
        : `${trait}=${traitValue}`;

    const direction = lift > 0 ? 'better' : 'worse';
    const absLiftPercent = Math.abs(Math.round(liftPercent));
    const absLift = Math.abs(Math.round(lift));

    if (confidence < 40) {
        return `Not enough data to determine impact of ${traitDisplay}. (${n_with} with, ${n_without} without)`;
    }

    if (Math.abs(lift) < 3) {
        return `${traitDisplay} shows minimal impact among ${n_with + n_without} similar ads.`;
    }

    // Main explanation format
    return `Among ${n_with + n_without} similar ads, those with ${traitDisplay} performed ${absLift > 10 ? `${absLiftPercent}%` : `${absLift} points`} ${direction}.`;
}

/**
 * Generate explanation for top positive traits
 */
function explainPositiveTraits(effects: TraitEffect[]): ExplanationDetail[] {
    return effects.map(effect => ({
        type: 'trait_impact' as const,
        text: explainTraitEffect(effect, effect.n_with + effect.n_without),
        confidence: effect.confidence,
        data: {
            trait: effect.trait,
            lift: effect.lift,
            recommendation: effect.recommendation,
        },
    }));
}

/**
 * Generate explanation for top negative traits
 */
function explainNegativeTraits(effects: TraitEffect[]): ExplanationDetail[] {
    return effects.map(effect => ({
        type: 'trait_impact' as const,
        text: explainTraitEffect(effect, effect.n_with + effect.n_without),
        confidence: effect.confidence,
        data: {
            trait: effect.trait,
            lift: effect.lift,
            recommendation: effect.recommendation,
        },
    }));
}

// ============================================
// NEIGHBOR EVIDENCE EXPLANATIONS
// ============================================

/**
 * Generate explanation about nearest neighbors
 */
function explainNeighbors(neighbors: NeighborAd[]): ExplanationDetail {
    if (neighbors.length === 0) {
        return {
            type: 'neighbor_evidence',
            text: 'No similar ads found in the database.',
            confidence: 0,
        };
    }

    const scores = neighbors
        .map(n => getOrbSuccessScore(n.orb))
        .filter((s): s is number => s !== undefined);

    const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    const avgSimilarity = Math.round(
        neighbors.reduce((sum, n) => sum + n.hybridSimilarity, 0) / neighbors.length * 100
    );

    const topNeighbor = neighbors[0];
    const topScore = getOrbSuccessScore(topNeighbor.orb);

    let text = `Found ${neighbors.length} similar ads with average ${avgSimilarity}% similarity.`;
    if (scores.length > 0) {
        text += ` Their average success score was ${avgScore}.`;
    }
    if (topScore !== undefined) {
        text += ` Most similar ad scored ${Math.round(topScore)}.`;
    }

    return {
        type: 'neighbor_evidence',
        text,
        confidence: avgSimilarity,
        data: {
            neighborCount: neighbors.length,
            avgSimilarity,
            avgScore,
        },
    };
}

// ============================================
// LOW CONFIDENCE EXPLANATIONS
// ============================================

/**
 * Generate explanation for low confidence situations
 */
function explainLowConfidence(
    neighbors: NeighborAd[],
    lowConfidenceTraits: TraitEffect[]
): ExplanationDetail[] {
    const details: ExplanationDetail[] = [];

    if (neighbors.length < 5) {
        details.push({
            type: 'low_confidence',
            text: `Only ${neighbors.length} similar ads found. Prediction reliability is limited.`,
            confidence: neighbors.length * 10,
        });
    }

    if (lowConfidenceTraits.length > 0) {
        const traitNames = lowConfidenceTraits.slice(0, 3).map(t => t.trait).join(', ');
        details.push({
            type: 'low_confidence',
            text: `Limited data for: ${traitNames}. Consider A/B testing.`,
            confidence: 30,
        });
    }

    return details;
}

// ============================================
// EXPERIMENT SUGGESTIONS
// ============================================

/**
 * Generate experiment suggestions for low confidence traits
 */
export function generateExperimentSuggestions(
    queryOrb: AdOrb,
    lowConfidenceTraits: TraitEffect[]
): ExperimentSuggestion[] {
    const suggestions: ExperimentSuggestion[] = [];

    for (const effect of lowConfidenceTraits.slice(0, 3)) {
        const currentValue = queryOrb.traits[effect.trait];
        let suggestedVariant: string | number | boolean;
        let reason: string;

        if (typeof currentValue === 'boolean') {
            suggestedVariant = !currentValue;
            reason = `Not enough data to determine impact of ${effect.trait}. Test both versions.`;
        } else {
            // For string/number traits, suggest testing without
            suggestedVariant = 'alternative';
            reason = `Limited data for ${effect.trait}=${currentValue}. Consider testing other options.`;
        }

        suggestions.push({
            trait: effect.trait,
            currentValue,
            suggestedVariant,
            reason,
            expectedImpact: 'unknown',
        });
    }

    return suggestions;
}

// ============================================
// RECOMMENDATIONS
// ============================================

/**
 * Generate actionable recommendations from analysis
 */
export function generateRecommendations(analysis: ContrastiveAnalysis): string[] {
    const recommendations: string[] = [];

    // Positive recommendations
    for (const effect of analysis.topPositive.slice(0, 3)) {
        if (effect.lift > 5 && effect.confidence >= 50) {
            recommendations.push(
                `Consider using ${effect.trait}=${effect.traitValue} - associated with ${Math.round(effect.lift)} point higher success.`
            );
        }
    }

    // Negative recommendations (avoid)
    for (const effect of analysis.topNegative.slice(0, 2)) {
        if (effect.lift < -5 && effect.confidence >= 50) {
            recommendations.push(
                `Caution with ${effect.trait}=${effect.traitValue} - associated with ${Math.round(Math.abs(effect.lift))} point lower success.`
            );
        }
    }

    // Test recommendations
    if (analysis.lowConfidence.length > 0) {
        const testTraits = analysis.lowConfidence.slice(0, 2).map(e => e.trait);
        recommendations.push(
            `A/B test recommended for: ${testTraits.join(', ')} - not enough evidence yet.`
        );
    }

    // General recommendations
    if (analysis.totalNeighbors < 5) {
        recommendations.push(
            `Low sample size (${analysis.totalNeighbors} similar ads). Results will improve as you add more ads.`
        );
    }

    return recommendations;
}

// ============================================
// MAIN EXPLANATION GENERATOR
// ============================================

/**
 * Generate full explanation from prediction data
 */
export function generateExplanation(
    prediction: number,
    confidence: number,
    neighbors: NeighborAd[],
    analysis: ContrastiveAnalysis
): {
    summary: string;
    details: ExplanationDetail[];
    recommendations: string[];
    experiments: ExperimentSuggestion[];
} {
    const details: ExplanationDetail[] = [];

    // Add neighbor evidence
    details.push(explainNeighbors(neighbors));

    // Add positive trait impacts
    details.push(...explainPositiveTraits(analysis.topPositive.slice(0, 3)));

    // Add negative trait impacts
    details.push(...explainNegativeTraits(analysis.topNegative.slice(0, 2)));

    // Add low confidence warnings
    details.push(...explainLowConfidence(neighbors, analysis.lowConfidence));

    // Generate summary
    let summary: string;
    if (neighbors.length < 3) {
        summary = `Prediction based on limited data (${neighbors.length} similar ads). Treat as rough estimate.`;
    } else if (confidence >= 70) {
        summary = `Predicted ${Math.round(prediction)}% success with high confidence based on ${neighbors.length} similar ads.`;
    } else if (confidence >= 40) {
        summary = `Predicted ${Math.round(prediction)}% success with moderate confidence. More data would improve accuracy.`;
    } else {
        summary = `Predicted ${Math.round(prediction)}% success, but confidence is low. Consider A/B testing.`;
    }

    // Generate recommendations
    const recommendations = generateRecommendations(analysis);

    // Generate experiment suggestions
    const queryOrb = neighbors[0]?.orb;
    const experiments = queryOrb
        ? generateExperimentSuggestions(queryOrb, analysis.lowConfidence)
        : [];

    return {
        summary,
        details,
        recommendations,
        experiments,
    };
}

/**
 * Generate simple explanation string for display
 */
export function generateSimpleExplanation(
    neighbors: NeighborAd[],
    analysis: ContrastiveAnalysis
): string {
    const parts: string[] = [];

    // Neighbor summary
    if (neighbors.length > 0) {
        parts.push(`Based on ${neighbors.length} similar ads.`);
    }

    // Top positive impact
    if (analysis.topPositive.length > 0) {
        const top = analysis.topPositive[0];
        parts.push(explainTraitEffect(top, analysis.totalNeighbors));
    }

    // Top negative impact
    if (analysis.topNegative.length > 0) {
        const top = analysis.topNegative[0];
        parts.push(explainTraitEffect(top, analysis.totalNeighbors));
    }

    return parts.join(' ');
}
