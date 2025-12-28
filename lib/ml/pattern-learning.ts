/**
 * Cross-Ad Pattern Learning
 * Discovers which trait combinations consistently lead to success
 */

import { ExtractedAdData } from '@/types';

interface TraitCombination {
    traits: string[];
    occurrences: number;
    avgSuccessScore: number;
    successCount: number; // Ads with score > 70
    failureCount: number; // Ads with score < 40
    confidenceLevel: number;
    lastUpdated: string;
}

interface PatternInsight {
    pattern: string;
    impact: 'positive' | 'negative' | 'neutral';
    strength: number; // 0-100
    recommendation: string;
}

const PATTERNS_KEY = 'ml_trait_patterns';
const MIN_OCCURRENCES = 3; // Need at least 3 ads to establish a pattern

/**
 * Extract key traits from an ad as a consistent set
 */
export function extractTraits(adData: ExtractedAdData): string[] {
    const traits: string[] = [];

    // Core traits
    if (adData.platform) traits.push(`platform:${adData.platform}`);
    if (adData.hookType) traits.push(`hook:${adData.hookType}`);
    if (adData.contentCategory) traits.push(`content:${adData.contentCategory}`);
    if (adData.editingStyle) traits.push(`editing:${adData.editingStyle}`);
    if (adData.musicType) traits.push(`music:${adData.musicType}`);

    // Boolean traits
    if (adData.isUGCStyle) traits.push('ugc:true');
    if (adData.hasSubtitles) traits.push('subtitles:true');
    if (adData.hasVoiceover) traits.push('voiceover:true');
    if (adData.hasTextOverlays) traits.push('text_overlays:true');
    if (adData.curiosityGap) traits.push('curiosity_gap:true');

    // Campaign traits (if available)
    if (adData.objectiveType) traits.push(`objective:${adData.objectiveType}`);
    if (adData.audienceType) traits.push(`audience:${adData.audienceType}`);
    if (adData.budgetTier) traits.push(`budget:${adData.budgetTier}`);

    return traits.sort(); // Sort for consistent combination keys
}

/**
 * Generate trait combinations (pairs and triples)
 */
export function generateCombinations(traits: string[]): string[][] {
    const combinations: string[][] = [];

    // Pairs
    for (let i = 0; i < traits.length; i++) {
        for (let j = i + 1; j < traits.length; j++) {
            combinations.push([traits[i], traits[j]].sort());
        }
    }

    // Important triples (limit to avoid explosion)
    const priorityTraits = traits.filter(t =>
        t.startsWith('platform:') ||
        t.startsWith('hook:') ||
        t.startsWith('objective:') ||
        t.startsWith('audience:')
    );

    for (let i = 0; i < priorityTraits.length; i++) {
        for (let j = i + 1; j < priorityTraits.length; j++) {
            for (let k = j + 1; k < priorityTraits.length; k++) {
                combinations.push([priorityTraits[i], priorityTraits[j], priorityTraits[k]].sort());
            }
        }
    }

    return combinations;
}

/**
 * Get stored patterns
 */
export function getPatterns(): Map<string, TraitCombination> {
    if (typeof window === 'undefined') return new Map();
    try {
        const stored = localStorage.getItem(PATTERNS_KEY);
        if (!stored) return new Map();
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
    } catch {
        return new Map();
    }
}

/**
 * Save patterns
 */
function savePatterns(patterns: Map<string, TraitCombination>): void {
    if (typeof window === 'undefined') return;
    const obj = Object.fromEntries(patterns);
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(obj));
}

/**
 * Learn from a new ad's performance
 */
export function learnFromAd(adData: ExtractedAdData, successScore: number): void {
    const traits = extractTraits(adData);
    const combinations = generateCombinations(traits);
    const patterns = getPatterns();

    const isSuccess = successScore >= 70;
    const isFailure = successScore < 40;

    for (const combo of combinations) {
        const key = combo.join('+');

        const existing = patterns.get(key) || {
            traits: combo,
            occurrences: 0,
            avgSuccessScore: 0,
            successCount: 0,
            failureCount: 0,
            confidenceLevel: 0,
            lastUpdated: ''
        };

        // Update running average
        const newOccurrences = existing.occurrences + 1;
        const newAvg = (existing.avgSuccessScore * existing.occurrences + successScore) / newOccurrences;

        existing.occurrences = newOccurrences;
        existing.avgSuccessScore = Math.round(newAvg * 10) / 10;
        if (isSuccess) existing.successCount++;
        if (isFailure) existing.failureCount++;
        existing.confidenceLevel = Math.min(100, newOccurrences * 15); // 7+ occurrences = 100%
        existing.lastUpdated = new Date().toISOString();

        patterns.set(key, existing);
    }

    savePatterns(patterns);
}

/**
 * Get pattern insights for an ad
 */
export function getPatternInsights(adData: ExtractedAdData): PatternInsight[] {
    const traits = extractTraits(adData);
    const combinations = generateCombinations(traits);
    const patterns = getPatterns();
    const insights: PatternInsight[] = [];

    for (const combo of combinations) {
        const key = combo.join('+');
        const pattern = patterns.get(key);

        if (!pattern || pattern.occurrences < MIN_OCCURRENCES) continue;

        const successRate = pattern.successCount / pattern.occurrences;
        const failureRate = pattern.failureCount / pattern.occurrences;

        let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
        let strength = 50;
        let recommendation = '';

        if (successRate >= 0.6) {
            impact = 'positive';
            strength = Math.round(successRate * 100);
            recommendation = `This combination has ${Math.round(successRate * 100)}% success rate`;
        } else if (failureRate >= 0.5) {
            impact = 'negative';
            strength = Math.round(failureRate * 100);
            recommendation = `Warning: This combination has ${Math.round(failureRate * 100)}% failure rate`;
        }

        if (impact !== 'neutral') {
            insights.push({
                pattern: combo.map(t => t.split(':')[1]).join(' + '),
                impact,
                strength,
                recommendation
            });
        }
    }

    // Sort by strength descending
    return insights.sort((a, b) => b.strength - a.strength).slice(0, 10);
}

/**
 * Get top performing patterns across all data
 */
export function getTopPatterns(limit: number = 10): TraitCombination[] {
    const patterns = getPatterns();

    return Array.from(patterns.values())
        .filter(p => p.occurrences >= MIN_OCCURRENCES)
        .sort((a, b) => b.avgSuccessScore - a.avgSuccessScore)
        .slice(0, limit);
}

/**
 * Get worst performing patterns (to avoid)
 */
export function getWorstPatterns(limit: number = 10): TraitCombination[] {
    const patterns = getPatterns();

    return Array.from(patterns.values())
        .filter(p => p.occurrences >= MIN_OCCURRENCES && p.failureCount > 0)
        .sort((a, b) => a.avgSuccessScore - b.avgSuccessScore)
        .slice(0, limit);
}

/**
 * Calculate pattern-based score adjustment
 */
export function getPatternScoreAdjustment(adData: ExtractedAdData): {
    adjustment: number;
    reason: string;
} {
    const insights = getPatternInsights(adData);

    if (insights.length === 0) {
        return { adjustment: 0, reason: 'No established patterns found' };
    }

    // Calculate weighted adjustment based on insights
    let totalAdjustment = 0;
    const reasons: string[] = [];

    for (const insight of insights.slice(0, 3)) { // Top 3 patterns
        if (insight.impact === 'positive') {
            const boost = (insight.strength - 50) / 5; // Max +10 per pattern
            totalAdjustment += boost;
            reasons.push(`+${boost.toFixed(1)}: ${insight.pattern}`);
        } else if (insight.impact === 'negative') {
            const penalty = (insight.strength - 50) / 5; // Max -10 per pattern
            totalAdjustment -= penalty;
            reasons.push(`-${penalty.toFixed(1)}: ${insight.pattern}`);
        }
    }

    return {
        adjustment: Math.round(totalAdjustment),
        reason: reasons.join(', ') || 'Neutral patterns'
    };
}

export default {
    extractTraits,
    learnFromAd,
    getPatternInsights,
    getTopPatterns,
    getWorstPatterns,
    getPatternScoreAdjustment
};
