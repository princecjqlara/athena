/**
 * Marketplace Matching Engine
 * 
 * Core marketplace intelligence that matches DataNeeds to MarketplaceDatasets.
 * Uses overlap scoring: coverage*0.6 + freshness*0.2 + confidence*0.2
 */

import {
    DataNeed,
    MarketplaceDataset,
    MarketplaceMatch,
    MarketplaceSuggestion,
    MarketplaceConfig,
    DEFAULT_MARKETPLACE_CONFIG,
} from './marketplace-types';
import { getAllDatasets, datasetCoversPlatform, datasetCoversTrait } from './marketplace-datasets';
import { Platform } from '@/types';

// ============================================
// COVERAGE SCORING
// ============================================

/**
 * Calculate how well a dataset covers a specific data need
 * Returns a score from 0-100
 */
function calculateCoverageForNeed(dataset: MarketplaceDataset, need: DataNeed): number {
    switch (need.dimension) {
        case 'platform':
            return datasetCoversPlatform(dataset, need.value as Platform) ? 100 : 0;

        case 'trait': {
            // For traits, check direct match first
            const traitValue = need.value.split('=')[0]; // e.g., "voiceover=true" -> "voiceover"
            if (datasetCoversTrait(dataset, traitValue)) {
                return 100;
            }
            // Partial match
            const allTraits = dataset.covers.traits || [];
            const hasPartialMatch = allTraits.some(t =>
                t.toLowerCase().includes(traitValue.toLowerCase()) ||
                traitValue.toLowerCase().includes(t.toLowerCase())
            );
            return hasPartialMatch ? 60 : 0;
        }

        case 'format':
            return dataset.covers.formats?.includes(need.value) ? 100 : 0;

        case 'objective':
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return dataset.covers.objectives?.includes(need.value as any) ? 100 : 0;

        case 'audience':
            return dataset.covers.audiences?.includes(need.value) ? 100 : 0;

        default:
            return 0;
    }
}

/**
 * Calculate overall coverage score across all needs
 */
function calculateOverallCoverage(dataset: MarketplaceDataset, needs: DataNeed[]): number {
    if (needs.length === 0) return 0;

    // Weight needs by severity
    const severityWeights = { high: 1.5, medium: 1.0, low: 0.5 };

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const need of needs) {
        const coverage = calculateCoverageForNeed(dataset, need);
        const weight = severityWeights[need.severity];

        totalWeightedScore += coverage * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}

// ============================================
// MATCH SCORING
// ============================================

/**
 * Calculate the final match score using the formula:
 * matchScore = coverage*0.6 + freshness*0.2 + confidence*0.2
 */
function calculateMatchScore(
    coverageScore: number,
    freshnessScore: number,
    confidenceScore: number
): number {
    return (
        coverageScore * 0.6 +
        freshnessScore * 0.2 +
        confidenceScore * 0.2
    );
}

/**
 * Estimate confidence gain from adding a dataset
 */
function estimateConfidenceGain(
    dataset: MarketplaceDataset,
    needs: DataNeed[],
    coverageScore: number
): number {
    // Base gain from dataset's average reported gain
    const baseGain = dataset.avgConfidenceGain || 20;

    // Adjust based on coverage
    const coverageMultiplier = coverageScore / 100;

    // Adjust based on sample count (diminishing returns)
    const sampleMultiplier = Math.min(1, Math.log10(dataset.sampleCount) / 4);

    // Adjust based on dataset confidence
    const confidenceMultiplier = dataset.confidenceScore / 100;

    // Calculate total gain capped at sum of need impacts
    const maxPossibleGain = needs.reduce((sum, n) => sum + n.confidenceImpact, 0);
    const estimatedGain = baseGain * coverageMultiplier * sampleMultiplier * confidenceMultiplier;

    return Math.round(Math.min(estimatedGain, maxPossibleGain));
}

// ============================================
// MAIN MATCHING FUNCTION
// ============================================

/**
 * Match data needs to marketplace datasets
 * 
 * @param needs - Array of data needs to fulfill
 * @param config - Marketplace configuration
 * @returns Array of matched datasets with scores
 */
export function matchDataNeeds(
    needs: DataNeed[],
    config: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): MarketplaceMatch[] {
    if (!config.enabled || needs.length === 0) {
        return [];
    }

    const datasets = getAllDatasets(true); // Only public datasets
    const matches: MarketplaceMatch[] = [];

    for (const dataset of datasets) {
        // Calculate coverage score
        const coverageScore = calculateOverallCoverage(dataset, needs);

        // Skip datasets with no coverage
        if (coverageScore === 0) continue;

        // Get scores from dataset
        const freshnessScore = dataset.freshnessScore;
        const confidenceScore = dataset.confidenceScore;

        // Calculate final match score
        const matchScore = calculateMatchScore(coverageScore, freshnessScore, confidenceScore);

        // Skip if below threshold
        if (matchScore < config.minMatchScoreToShow) continue;

        // Find which needs this dataset addresses
        const addressedNeeds = needs.filter(need =>
            calculateCoverageForNeed(dataset, need) > 0
        );

        // Estimate confidence gain
        const estimatedConfidenceGain = estimateConfidenceGain(dataset, addressedNeeds, coverageScore);

        // Generate explanation
        const explanation = generateMatchExplanation(dataset, addressedNeeds, estimatedConfidenceGain);

        matches.push({
            dataset,
            coverageScore,
            freshnessScore,
            confidenceScore,
            matchScore,
            addressedNeeds,
            estimatedConfidenceGain,
            explanation,
        });
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Limit results
    return matches.slice(0, config.maxSuggestionsToShow);
}

/**
 * Generate human-readable explanation for a match
 */
function generateMatchExplanation(
    dataset: MarketplaceDataset,
    addressedNeeds: DataNeed[],
    confidenceGain: number
): string {
    const needCount = addressedNeeds.length;
    const highPriorityNeeds = addressedNeeds.filter(n => n.severity === 'high').length;

    if (highPriorityNeeds > 0) {
        return `Addresses ${highPriorityNeeds} critical gap${highPriorityNeeds > 1 ? 's' : ''} with ${dataset.sampleCount.toLocaleString()} data points, potentially improving confidence by ${confidenceGain}%.`;
    }

    return `Covers ${needCount} data gap${needCount > 1 ? 's' : ''} with ${dataset.sampleCount.toLocaleString()} samples. Estimated confidence gain: +${confidenceGain}%.`;
}

// ============================================
// SUGGESTION GENERATION
// ============================================

/**
 * Convert matches to user-facing suggestions
 */
export function generateSuggestions(
    matches: MarketplaceMatch[],
    currentConfidence: number
): MarketplaceSuggestion[] {
    return matches.map((match, index) => {
        const { dataset, addressedNeeds, estimatedConfidenceGain } = match;

        // Generate headline based on priority
        let headline: string;
        if (index === 0) {
            headline = 'Best match to improve your prediction';
        } else if (match.matchScore >= 70) {
            headline = 'Highly relevant dataset available';
        } else {
            headline = 'Additional data available';
        }

        // Generate reason from top need
        const topNeed = addressedNeeds[0];
        const reason = topNeed
            ? topNeed.reason
            : `Adds ${dataset.sampleCount.toLocaleString()} relevant data points`;

        // Generate impact message
        const newConfidence = Math.min(100, currentConfidence + estimatedConfidenceGain);
        const impact = `Estimated confidence: ${currentConfidence}% → ${newConfidence}% (+${estimatedConfidenceGain}%)`;

        return {
            match,
            headline,
            reason,
            impact,
            actions: {
                previewImpact: true,
                addDataset: dataset.accessTier === 'free',
                learnMore: true,
            },
            priority: matches.length - index,
        };
    });
}

// ============================================
// QUICK MATCH FUNCTIONS
// ============================================

/**
 * Get best single match for a set of needs
 */
export function getBestMatch(
    needs: DataNeed[],
    config: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): MarketplaceMatch | null {
    const matches = matchDataNeeds(needs, config);
    return matches.length > 0 ? matches[0] : null;
}

/**
 * Check if any datasets can help with given needs
 */
export function hasAvailableDatasets(
    needs: DataNeed[],
    config: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): boolean {
    return matchDataNeeds(needs, config).length > 0;
}

/**
 * Get total potential confidence gain from all matches
 */
export function getTotalPotentialGain(
    matches: MarketplaceMatch[]
): number {
    // Don't simply sum - there's overlap
    // Use a diminishing returns model
    if (matches.length === 0) return 0;

    const sortedGains = matches.map(m => m.estimatedConfidenceGain).sort((a, b) => b - a);

    let total = 0;
    let multiplier = 1.0;

    for (const gain of sortedGains) {
        total += gain * multiplier;
        multiplier *= 0.5; // Each additional dataset contributes less
    }

    return Math.round(total);
}
