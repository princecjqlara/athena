/**
 * Marketplace Datasets Module
 * 
 * Defines available datasets in the marketplace with their coverage declarations.
 * Datasets declare what gaps they can fill without exposing any raw data.
 */

import { MarketplaceDataset } from './marketplace-types';
import { Platform, ObjectiveType } from '@/types';

// ============================================
// SAMPLE MARKETPLACE DATASETS
// ============================================

/**
 * Sample datasets available in the marketplace.
 * In production, these would come from a database.
 */
export const MARKETPLACE_DATASETS: MarketplaceDataset[] = [
    {
        id: 'dataset-tiktok-ugc',
        name: 'TikTok UGC Performance Data',
        description: 'Aggregated performance statistics for UGC-style ads on TikTok, including voiceover and trending audio patterns.',
        covers: {
            platforms: ['tiktok'] as Platform[],
            traits: ['ugc', 'voiceover', 'trending_audio', 'raw_authentic'],
            formats: ['ugc', 'testimonial'],
        },
        sampleCount: 2500,
        freshnessScore: 92,
        confidenceScore: 88,
        usageCount: 183,
        avgConfidenceGain: 28,
        accessTier: 'free',
        isPublic: true,
        createdAt: '2024-11-01T00:00:00Z',
        updatedAt: '2024-12-28T00:00:00Z',
    },
    {
        id: 'dataset-facebook-ecommerce',
        name: 'Facebook E-commerce Ads',
        description: 'Performance patterns for product-focused ads on Facebook and Instagram, optimized for conversions.',
        covers: {
            platforms: ['facebook', 'instagram'] as Platform[],
            traits: ['product_demo', 'carousel', 'cta_strong'],
            objectives: ['conversions', 'sales'] as ObjectiveType[],
            formats: ['product_demo', 'carousel'],
        },
        sampleCount: 4200,
        freshnessScore: 85,
        confidenceScore: 91,
        usageCount: 342,
        avgConfidenceGain: 32,
        accessTier: 'free',
        isPublic: true,
        createdAt: '2024-10-15T00:00:00Z',
        updatedAt: '2024-12-27T00:00:00Z',
    },
    {
        id: 'dataset-youtube-longform',
        name: 'YouTube Long-Form Ad Performance',
        description: 'Statistics for 15-60 second YouTube ads with storytelling hooks and branded content.',
        covers: {
            platforms: ['youtube'] as Platform[],
            traits: ['storytelling', 'branded', 'cinematic', 'longform'],
            formats: ['brand_story', 'explainer'],
        },
        sampleCount: 1800,
        freshnessScore: 78,
        confidenceScore: 84,
        usageCount: 89,
        avgConfidenceGain: 24,
        accessTier: 'premium',
        isPublic: true,
        createdAt: '2024-09-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
    },
    {
        id: 'dataset-instagram-reels',
        name: 'Instagram Reels Trends',
        description: 'Performance data for Reels-optimized content including trending effects and music.',
        covers: {
            platforms: ['instagram'] as Platform[],
            traits: ['reels', 'trending_audio', 'fast_cuts', 'vertical'],
            formats: ['ugc', 'trend'],
        },
        sampleCount: 3100,
        freshnessScore: 95,
        confidenceScore: 86,
        usageCount: 267,
        avgConfidenceGain: 30,
        accessTier: 'free',
        isPublic: true,
        createdAt: '2024-11-10T00:00:00Z',
        updatedAt: '2024-12-29T00:00:00Z',
    },
    {
        id: 'dataset-b2b-linkedin',
        name: 'B2B LinkedIn Ad Insights',
        description: 'Aggregated B2B advertising patterns for LinkedIn, focused on lead generation and professional audiences.',
        covers: {
            platforms: ['linkedin'] as Platform[],
            traits: ['professional', 'thought_leadership', 'case_study'],
            objectives: ['leads', 'awareness'] as ObjectiveType[],
            audiences: ['b2b', 'enterprise', 'decision_makers'],
        },
        sampleCount: 1200,
        freshnessScore: 72,
        confidenceScore: 79,
        usageCount: 56,
        avgConfidenceGain: 22,
        accessTier: 'premium',
        isPublic: true,
        createdAt: '2024-08-01T00:00:00Z',
        updatedAt: '2024-12-15T00:00:00Z',
    },
    {
        id: 'dataset-curiosity-hooks',
        name: 'Curiosity Hook Performance',
        description: 'Cross-platform analysis of curiosity-driven hooks and their impact on engagement.',
        covers: {
            platforms: ['tiktok', 'instagram', 'facebook', 'youtube'] as Platform[],
            traits: ['curiosity', 'hook_strong', 'question_hook', 'teaser'],
        },
        sampleCount: 5600,
        freshnessScore: 88,
        confidenceScore: 93,
        usageCount: 412,
        avgConfidenceGain: 35,
        accessTier: 'free',
        isPublic: true,
        createdAt: '2024-10-01T00:00:00Z',
        updatedAt: '2024-12-28T00:00:00Z',
    },
    {
        id: 'dataset-voiceover-patterns',
        name: 'Voiceover Ad Patterns',
        description: 'Analysis of ads with voiceover across platforms, including pacing and tone effectiveness.',
        covers: {
            traits: ['voiceover', 'narration', 'asmr', 'enthusiastic'],
        },
        sampleCount: 2800,
        freshnessScore: 82,
        confidenceScore: 87,
        usageCount: 198,
        avgConfidenceGain: 26,
        accessTier: 'free',
        isPublic: true,
        createdAt: '2024-09-15T00:00:00Z',
        updatedAt: '2024-12-25T00:00:00Z',
    },
    {
        id: 'dataset-gen-z-targeting',
        name: 'Gen Z Audience Insights',
        description: 'Performance patterns for Gen Z targeted ads across TikTok and Instagram.',
        covers: {
            platforms: ['tiktok', 'instagram'] as Platform[],
            traits: ['gen_z', 'trend_aware', 'authentic', 'humor'],
            audiences: ['gen_z', '18-25', 'students'],
        },
        sampleCount: 3400,
        freshnessScore: 94,
        confidenceScore: 89,
        usageCount: 289,
        avgConfidenceGain: 31,
        accessTier: 'free',
        isPublic: true,
        createdAt: '2024-11-05T00:00:00Z',
        updatedAt: '2024-12-29T00:00:00Z',
    },
];

// ============================================
// DATASET ACCESS FUNCTIONS
// ============================================

/**
 * Get all available marketplace datasets
 */
export function getAllDatasets(publicOnly: boolean = true): MarketplaceDataset[] {
    if (publicOnly) {
        return MARKETPLACE_DATASETS.filter(d => d.isPublic);
    }
    return MARKETPLACE_DATASETS;
}

/**
 * Get dataset by ID
 */
export function getDatasetById(id: string): MarketplaceDataset | undefined {
    return MARKETPLACE_DATASETS.find(d => d.id === id);
}

/**
 * Get datasets by platform
 */
export function getDatasetsByPlatform(platform: Platform): MarketplaceDataset[] {
    return MARKETPLACE_DATASETS.filter(d =>
        d.covers.platforms?.includes(platform)
    );
}

/**
 * Get datasets by trait
 */
export function getDatasetsByTrait(trait: string): MarketplaceDataset[] {
    const normalizedTrait = trait.toLowerCase();
    return MARKETPLACE_DATASETS.filter(d =>
        d.covers.traits?.some(t => t.toLowerCase().includes(normalizedTrait))
    );
}

/**
 * Get datasets by access tier
 */
export function getDatasetsByTier(tier: MarketplaceDataset['accessTier']): MarketplaceDataset[] {
    return MARKETPLACE_DATASETS.filter(d => d.accessTier === tier);
}

/**
 * Get top datasets by usage
 */
export function getTopDatasets(limit: number = 5): MarketplaceDataset[] {
    return [...MARKETPLACE_DATASETS]
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, limit);
}

/**
 * Get freshest datasets
 */
export function getFreshestDatasets(limit: number = 5): MarketplaceDataset[] {
    return [...MARKETPLACE_DATASETS]
        .sort((a, b) => b.freshnessScore - a.freshnessScore)
        .slice(0, limit);
}

// ============================================
// DATASET COVERAGE HELPERS
// ============================================

/**
 * Check if a dataset covers a specific platform
 */
export function datasetCoversPlatform(dataset: MarketplaceDataset, platform: Platform): boolean {
    return dataset.covers.platforms?.includes(platform) ?? false;
}

/**
 * Check if a dataset covers a specific trait
 */
export function datasetCoversTrait(dataset: MarketplaceDataset, trait: string): boolean {
    const normalizedTrait = trait.toLowerCase();
    return dataset.covers.traits?.some(t =>
        t.toLowerCase() === normalizedTrait ||
        t.toLowerCase().includes(normalizedTrait) ||
        normalizedTrait.includes(t.toLowerCase())
    ) ?? false;
}

/**
 * Check if a dataset covers a specific objective
 */
export function datasetCoversObjective(dataset: MarketplaceDataset, objective: ObjectiveType): boolean {
    return dataset.covers.objectives?.includes(objective) ?? false;
}

/**
 * Get all traits covered by a dataset
 */
export function getDatasetTraits(dataset: MarketplaceDataset): string[] {
    return dataset.covers.traits || [];
}

/**
 * Get all platforms covered by a dataset
 */
export function getDatasetPlatforms(dataset: MarketplaceDataset): Platform[] {
    return dataset.covers.platforms || [];
}
