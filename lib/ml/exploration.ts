// Exploration System (Epsilon-Greedy Strategy)
// Recommends wildcards to prevent self-fulfilling prophecies

import { ExplorationConfig, AdEntry, ExtractedAdData } from '@/types';
import { getFeatureWeights, calculateWeightedScore } from './weight-adjustment';

const CONFIG_KEY = 'ml_exploration_config';

// Default exploration configuration
const DEFAULT_CONFIG: ExplorationConfig = {
    enabled: true,
    explorationRate: 0.1, // 10% wildcards
    wildcardCount: 1,
    minScoreForWildcard: 20, // Don't recommend truly terrible ideas
    maxScoreForWildcard: 50, // Wildcards should be "surprising" choices
};

// Get exploration config
export function getExplorationConfig(): ExplorationConfig {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const stored = localStorage.getItem(CONFIG_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
}

// Save config
export function saveExplorationConfig(config: ExplorationConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// Decide if we should explore (show wildcard) or exploit (show best)
export function shouldExplore(): boolean {
    const config = getExplorationConfig();
    if (!config.enabled) return false;
    return Math.random() < config.explorationRate;
}

// Generate wildcard recommendations
export function generateWildcardRecommendations(): {
    trait: string;
    description: string;
    expectedScore: number;
    explorationReason: string;
}[] {
    const config = getExplorationConfig();
    const weights = getFeatureWeights();
    const wildcards: {
        trait: string;
        description: string;
        expectedScore: number;
        explorationReason: string;
    }[] = [];

    // Find low-weighted features that might be undervalued
    const lowWeightFeatures = weights
        .filter(w => w.weight > -0.5 && w.weight < 0.3)
        .filter(w => w.sampleSize < 10) // Low sample size = uncertain
        .sort((a, b) => a.sampleSize - b.sampleSize);

    for (const feature of lowWeightFeatures.slice(0, config.wildcardCount)) {
        wildcards.push({
            trait: feature.feature,
            description: getFeatureDescription(feature.feature),
            expectedScore: 35 + Math.random() * 20, // Random score in wildcard range
            explorationReason: feature.sampleSize === 0
                ? `Never tested before - could be a hidden gem!`
                : `Only ${feature.sampleSize} data points - needs more testing`,
        });
    }

    // Add some contrarian suggestions
    const highWeightFeatures = weights
        .filter(w => w.weight > 0.7)
        .filter(w => w.trend === 'falling');

    if (highWeightFeatures.length > 0 && wildcards.length < config.wildcardCount) {
        const feature = highWeightFeatures[0];
        wildcards.push({
            trait: `anti_${feature.feature}`,
            description: `Try WITHOUT ${getFeatureDescription(feature.feature)}`,
            expectedScore: 40,
            explorationReason: `${feature.feature} is trending down - maybe it's overused?`,
        });
    }

    // Add some unusual combinations
    if (wildcards.length < config.wildcardCount) {
        wildcards.push({
            trait: 'unusual_combo',
            description: 'Try mixing styles: Professional visuals + UGC voice',
            expectedScore: 45,
            explorationReason: 'Unusual combinations sometimes go viral',
        });
    }

    return wildcards;
}

// Get description for a feature
function getFeatureDescription(feature: string): string {
    const descriptions: Record<string, string> = {
        curiosity: 'Curiosity hook ("You won\'t believe...")',
        shock: 'Shock value hook',
        question: 'Question-based hook',
        ugc_style: 'User-generated content style',
        subtitles: 'Subtitles/captions on video',
        shaky_camera: 'Raw, shaky camera work',
        fast_cuts: 'Fast-paced editing',
        trending_audio: 'Trending audio/music',
        voiceover: 'Voiceover narration',
        tiktok: 'TikTok platform',
        instagram_reels: 'Instagram Reels',
    };
    return descriptions[feature] || feature.replace(/_/g, ' ');
}

// Split recommendations into exploit and explore
export function getRecommendationMix(
    topRecommendations: { trait: string; score: number; description: string }[]
): {
    exploit: { trait: string; score: number; description: string }[];
    explore: { trait: string; description: string; expectedScore: number; explorationReason: string }[];
} {
    const config = getExplorationConfig();

    // 90% exploitation - top recommendations based on current knowledge
    const exploitCount = Math.ceil(topRecommendations.length * (1 - config.explorationRate));
    const exploit = topRecommendations.slice(0, exploitCount);

    // 10% exploration - wildcards
    const explore = config.enabled ? generateWildcardRecommendations() : [];

    return { exploit, explore };
}

// Track wildcard performance
const WILDCARD_RESULTS_KEY = 'ml_wildcard_results';

export function recordWildcardTest(
    trait: string,
    actualScore: number
): void {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(WILDCARD_RESULTS_KEY);
    const results: { trait: string; score: number; date: string }[] = stored ? JSON.parse(stored) : [];

    results.push({
        trait,
        score: actualScore,
        date: new Date().toISOString(),
    });

    // Keep last 50 results
    if (results.length > 50) results.shift();

    localStorage.setItem(WILDCARD_RESULTS_KEY, JSON.stringify(results));

    // If wildcard succeeded, notify for weight adjustment
    if (actualScore >= 70) {
        console.log(`[EXPLORATION] Wildcard success! "${trait}" scored ${actualScore}. Consider increasing weight.`);
    }
}

// Get wildcard success rate
export function getWildcardStats(): {
    totalTested: number;
    successCount: number;
    successRate: number;
    topPerformers: { trait: string; score: number }[];
} {
    if (typeof window === 'undefined') {
        return { totalTested: 0, successCount: 0, successRate: 0, topPerformers: [] };
    }

    const stored = localStorage.getItem(WILDCARD_RESULTS_KEY);
    const results: { trait: string; score: number; date: string }[] = stored ? JSON.parse(stored) : [];

    const successCount = results.filter(r => r.score >= 70).length;
    const topPerformers = [...results]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => ({ trait: r.trait, score: r.score }));

    return {
        totalTested: results.length,
        successCount,
        successRate: results.length > 0 ? Math.round((successCount / results.length) * 100) : 0,
        topPerformers,
    };
}
