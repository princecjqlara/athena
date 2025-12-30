/**
 * Marketplace Explanation Module
 * 
 * Generates human-readable explanations for data gaps and marketplace suggestions.
 * Follows the principle: explain uncertainty like a scientist, recommend like a guide.
 */

import {
    DataNeed,
    GapAnalysis,
    MarketplaceMatch,
    MarketplaceSuggestion,
} from './marketplace-types';

// ============================================
// GAP EXPLANATIONS
// ============================================

/**
 * Generate a headline explaining why confidence is limited
 */
export function explainConfidenceLimit(analysis: GapAnalysis): string {
    if (analysis.highSeverityCount > 0) {
        return 'Your prediction confidence is significantly limited due to data gaps.';
    }

    if (analysis.mediumSeverityCount >= 2) {
        return 'Your prediction has moderate uncertainty due to limited data.';
    }

    if (analysis.totalGaps > 0) {
        return 'Your prediction could be improved with additional data.';
    }

    return 'Your prediction has sufficient data coverage.';
}

/**
 * Generate a detailed explanation for a specific data need
 */
export function explainDataNeed(need: DataNeed): string {
    switch (need.dimension) {
        case 'platform':
            return `Missing data for ${need.value}: Only ${need.currentSamples} similar ads found on this platform (recommended: ${need.requiredSamples}+).`;

        case 'trait':
            if (need.value.includes('similar_ads')) {
                return `Low neighbor count: Only ${need.currentSamples} similar ads found overall. More data would improve prediction reliability.`;
            }
            if (need.value.includes('similarity_quality')) {
                return `Low similarity: The most similar ads aren't very close matches (${need.context?.avgSimilarity?.toFixed(0)}% average).`;
            }
            if (need.value.includes('outcome_variance')) {
                return `High variance: Similar ads have inconsistent outcomes (std dev: ${need.context?.variance?.toFixed(0)}), making predictions less reliable.`;
            }
            // Trait-specific need
            const traitName = need.value.split('=')[0];
            return `Limited evidence for "${traitName}": Only ${need.currentSamples} examples with this trait (confidence: ${need.context?.traitConfidence?.toFixed(0)}%).`;

        case 'format':
            return `Rare format "${need.value}": Only ${need.currentSamples} similar ads use this format.`;

        case 'objective':
            return `Limited data for ${need.value} objective: Only ${need.currentSamples} similar campaigns.`;

        case 'audience':
            return `Sparse audience data for ${need.value}: Only ${need.currentSamples} similar targeting patterns.`;

        default:
            return need.reason;
    }
}

/**
 * Generate a bullet list of all gaps
 */
export function explainAllGaps(analysis: GapAnalysis): string[] {
    return analysis.dataNeeds.map(need => explainDataNeed(need));
}

/**
 * Generate a summary of gaps
 */
export function summarizeGaps(analysis: GapAnalysis): string {
    const parts: string[] = [];

    if (analysis.highSeverityCount > 0) {
        parts.push(`${analysis.highSeverityCount} critical gap${analysis.highSeverityCount > 1 ? 's' : ''}`);
    }
    if (analysis.mediumSeverityCount > 0) {
        parts.push(`${analysis.mediumSeverityCount} moderate gap${analysis.mediumSeverityCount > 1 ? 's' : ''}`);
    }
    if (analysis.lowSeverityCount > 0) {
        parts.push(`${analysis.lowSeverityCount} minor gap${analysis.lowSeverityCount > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
        return 'No significant data gaps detected.';
    }

    return `Found ${parts.join(', ')}. Maximum potential confidence gain: +${analysis.maxConfidenceGain}%.`;
}

// ============================================
// DATASET MATCH EXPLANATIONS
// ============================================

/**
 * Generate headline for dataset recommendation
 */
export function explainDatasetRecommendation(match: MarketplaceMatch): string {
    const { dataset, estimatedConfidenceGain, addressedNeeds } = match;

    if (estimatedConfidenceGain >= 30) {
        return `"${dataset.name}" can significantly improve your prediction`;
    }

    if (estimatedConfidenceGain >= 15) {
        return `"${dataset.name}" addresses ${addressedNeeds.length} of your data gaps`;
    }

    return `"${dataset.name}" may provide relevant insights`;
}

/**
 * Generate detailed explanation for why a dataset matches
 */
export function explainMatchReason(match: MarketplaceMatch): string {
    const { dataset, addressedNeeds, matchScore } = match;

    const parts: string[] = [];

    // Coverage explanation
    const platformNeeds = addressedNeeds.filter(n => n.dimension === 'platform');
    const traitNeeds = addressedNeeds.filter(n => n.dimension === 'trait');

    if (platformNeeds.length > 0) {
        const platforms = platformNeeds.map(n => n.value).join(', ');
        parts.push(`Contains ${dataset.sampleCount.toLocaleString()} data points for ${platforms}`);
    }

    if (traitNeeds.length > 0) {
        const traitCount = traitNeeds.length;
        parts.push(`Covers ${traitCount} trait${traitCount > 1 ? 's' : ''} you're missing data for`);
    }

    // Quality indicators
    if (dataset.freshnessScore >= 90) {
        parts.push('Recently updated with fresh data');
    }

    if (dataset.confidenceScore >= 90) {
        parts.push('High confidence data from verified sources');
    }

    if (dataset.usageCount && dataset.usageCount > 100) {
        parts.push(`Used by ${dataset.usageCount}+ creators`);
    }

    if (parts.length === 0) {
        parts.push(`Match score: ${matchScore.toFixed(0)}%`);
    }

    return parts.join('. ') + '.';
}

/**
 * Generate confidence gain explanation
 */
export function explainConfidenceGain(
    currentConfidence: number,
    estimatedGain: number
): string {
    const newConfidence = Math.min(100, currentConfidence + estimatedGain);

    if (estimatedGain >= 30) {
        return `Could boost your prediction confidence from ${currentConfidence}% to approximately ${newConfidence}% (+${estimatedGain}%).`;
    }

    if (estimatedGain >= 15) {
        return `Estimated confidence improvement: ${currentConfidence}% → ${newConfidence}% (+${estimatedGain}%).`;
    }

    return `May improve confidence by approximately ${estimatedGain}%.`;
}

// ============================================
// FULL SUGGESTION GENERATION
// ============================================

/**
 * Generate a complete user-facing explanation
 */
export function generateFullExplanation(
    analysis: GapAnalysis,
    suggestions: MarketplaceSuggestion[]
): {
    mainMessage: string;
    gapDetails: string[];
    datasetSuggestions: Array<{
        headline: string;
        reason: string;
        impact: string;
    }>;
} {
    // Main message
    const mainMessage = explainConfidenceLimit(analysis);

    // Gap details (top 3)
    const gapDetails = analysis.dataNeeds
        .slice(0, 3)
        .map(need => explainDataNeed(need));

    // Dataset suggestions
    const datasetSuggestions = suggestions.map(suggestion => ({
        headline: explainDatasetRecommendation(suggestion.match),
        reason: explainMatchReason(suggestion.match),
        impact: explainConfidenceGain(
            analysis.currentConfidence,
            suggestion.match.estimatedConfidenceGain
        ),
    }));

    return {
        mainMessage,
        gapDetails,
        datasetSuggestions,
    };
}

// ============================================
// SHORT-FORM EXPLANATIONS
// ============================================

/**
 * Generate a one-line summary for display in prediction results
 */
export function generateShortSummary(
    analysis: GapAnalysis,
    topMatch: MarketplaceMatch | null
): string {
    if (!analysis.hasSignificantGaps) {
        return '';
    }

    if (topMatch) {
        return `💡 Your confidence could increase by ~${topMatch.estimatedConfidenceGain}% with "${topMatch.dataset.name}"`;
    }

    const topNeed = analysis.dataNeeds[0];
    if (topNeed) {
        return `⚠️ Limited data: ${topNeed.reason}`;
    }

    return `⚠️ Prediction based on limited data (${analysis.totalGaps} gaps detected)`;
}

/**
 * Generate tooltip text for confidence indicator
 */
export function generateConfidenceTooltip(
    analysis: GapAnalysis
): string {
    if (!analysis.hasSignificantGaps) {
        return 'Good data coverage for this prediction.';
    }

    const highCount = analysis.highSeverityCount;
    const potentialGain = analysis.maxConfidenceGain;

    if (highCount > 0) {
        return `${highCount} significant data gap${highCount > 1 ? 's' : ''} limiting confidence. Potential improvement: +${potentialGain}%`;
    }

    return `Some data gaps detected. Marketplace datasets could improve confidence by up to ${potentialGain}%.`;
}
