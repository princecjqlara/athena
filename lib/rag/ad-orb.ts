/**
 * AdOrb Conversion Module
 * 
 * Converts AdEntry to the canonical AdOrb representation.
 * Each ad becomes a single structured document for RAG retrieval.
 */

import { AdEntry, ExtractedAdData, ExtractedResultsData } from '@/types';
import { AdOrb } from './types';

// ============================================
// TRAIT EXTRACTION
// ============================================

/**
 * Extract predictive traits from ExtractedAdData
 * Flattens nested structures and normalizes values
 */
function extractTraitsFromAdData(data: ExtractedAdData): Record<string, string | number | boolean> {
    const traits: Record<string, string | number | boolean> = {};

    // Core creative traits
    if (data.hookType) traits['hook'] = data.hookType;
    if (data.contentCategory) traits['category'] = data.contentCategory;
    if (data.editingStyle) traits['editing'] = data.editingStyle;
    if (data.colorScheme) traits['color'] = data.colorScheme;
    if (data.musicType) traits['music'] = data.musicType;
    if (data.platform) traits['platform'] = data.platform;
    if (data.placement) traits['placement'] = data.placement;

    // Boolean traits (normalized to true/false)
    traits['ugc'] = Boolean(data.isUGCStyle);
    traits['subtitles'] = Boolean(data.hasSubtitles);
    traits['voiceover'] = Boolean(data.hasVoiceover);
    traits['text_overlays'] = Boolean(data.hasTextOverlays);
    traits['face_presence'] = Boolean(data.facePresence);

    // Media type
    if (data.mediaType) traits['media_type'] = data.mediaType;
    if (data.aspectRatio) traits['aspect_ratio'] = data.aspectRatio;
    if (data.durationCategory) traits['duration'] = data.durationCategory;

    // Advanced traits
    if (data.patternType) traits['pattern'] = data.patternType;
    if (data.emotionalTone) traits['tone'] = data.emotionalTone;
    if (data.overallSentiment) traits['sentiment'] = data.overallSentiment;
    if (data.hookVelocity) traits['hook_velocity'] = data.hookVelocity;
    if (data.ctaStrength) traits['cta_strength'] = data.ctaStrength;
    if (data.cta) traits['cta_type'] = data.cta;

    // Talent/Actor traits
    if (data.numberOfActors !== undefined) traits['actors'] = data.numberOfActors;
    if (data.talentType) traits['talent'] = data.talentType;

    // Visual style traits
    if (data.sceneVelocity) traits['scene_velocity'] = data.sceneVelocity;
    if (data.shotComposition) traits['composition'] = data.shotComposition;
    if (data.bpm) traits['bpm'] = data.bpm;
    if (data.voiceoverStyle) traits['voiceover_style'] = data.voiceoverStyle;

    // Brand traits
    if (data.logoConsistency) traits['logo'] = data.logoConsistency;
    if (data.brandColorUsage) traits['brand_color'] = data.brandColorUsage;

    // Engagement triggers (as booleans)
    if (data.curiosityGap !== undefined) traits['curiosity_gap'] = Boolean(data.curiosityGap);
    if (data.socialProofElements && data.socialProofElements.length > 0) {
        traits['social_proof'] = true;
    }
    if (data.urgencyTriggers && data.urgencyTriggers.length > 0) {
        traits['urgency'] = true;
    }
    if (data.trustSignals && data.trustSignals.length > 0) {
        traits['trust_signals'] = true;
    }

    // ML-critical campaign traits
    if (data.budgetTier) traits['budget_tier'] = data.budgetTier;
    if (data.objectiveType) traits['objective'] = data.objectiveType;
    if (data.audienceType) traits['audience'] = data.audienceType;
    if (data.targetAgeGroup) traits['age_group'] = data.targetAgeGroup;
    if (data.hookRetention) traits['retention'] = data.hookRetention;

    // Custom traits
    if (data.customTraits && data.customTraits.length > 0) {
        data.customTraits.forEach((trait, i) => {
            traits[`custom_${i}`] = trait;
        });
    }

    return traits;
}

/**
 * Extract results from ExtractedResultsData
 */
function extractResults(data: ExtractedResultsData): AdOrb['results'] {
    return {
        successScore: data.successScore,
        roas: data.roas,
        ctr: data.ctr,
        conversions: data.conversions,
        impressions: data.impressions,
        clicks: data.clicks,
        adSpend: data.adSpend,
        revenue: data.revenue,
    };
}

// ============================================
// MAIN CONVERSION FUNCTION
// ============================================

/**
 * Convert an AdEntry to an AdOrb
 * Creates the canonical representation for RAG retrieval
 */
export function convertToAdOrb(ad: AdEntry): AdOrb {
    const traits = extractTraitsFromAdData(ad.extractedContent);

    const orb: AdOrb = {
        id: ad.id,
        traits,
        metadata: {
            platform: ad.extractedContent.platform,
            objective: ad.extractedContent.objectiveType,
            createdAt: ad.createdAt,
            updatedAt: ad.updatedAt,
            hasResults: ad.hasResults,
        },
    };

    // Add results if available
    if (ad.hasResults && ad.extractedResults) {
        orb.results = extractResults(ad.extractedResults);
    }

    return orb;
}

/**
 * Convert multiple AdEntries to AdOrbs
 */
export function convertManyToAdOrbs(ads: AdEntry[]): AdOrb[] {
    return ads.map(convertToAdOrb);
}

/**
 * Get trait list from an AdOrb (for contrastive analysis)
 */
export function getOrbTraitList(orb: AdOrb): string[] {
    return Object.entries(orb.traits)
        .filter(([, value]) => value !== false && value !== '' && value !== null)
        .map(([key, value]) => {
            if (typeof value === 'boolean') {
                return key; // Just the trait name for booleans
            }
            return `${key}=${value}`; // key=value for strings/numbers
        });
}

/**
 * Check if an orb has a specific trait
 */
export function orbHasTrait(orb: AdOrb, traitKey: string, traitValue?: string | number | boolean): boolean {
    if (!(traitKey in orb.traits)) {
        return false;
    }

    if (traitValue === undefined) {
        // Just checking if trait exists and is truthy
        return Boolean(orb.traits[traitKey]);
    }

    return orb.traits[traitKey] === traitValue;
}

/**
 * Get the success score from an orb (if available)
 */
export function getOrbSuccessScore(orb: AdOrb): number | undefined {
    return orb.results?.successScore;
}

/**
 * Check if an orb has sufficient results for analysis
 */
export function orbHasResults(orb: AdOrb): boolean {
    return orb.metadata.hasResults &&
        orb.results !== undefined &&
        orb.results.successScore !== undefined;
}

/**
 * Get shared traits between two orbs
 */
export function getSharedTraits(orbA: AdOrb, orbB: AdOrb): string[] {
    const traitsA = getOrbTraitList(orbA);
    const traitsB = new Set(getOrbTraitList(orbB));

    return traitsA.filter(trait => traitsB.has(trait));
}

/**
 * Get different traits between two orbs
 */
export function getDifferentTraits(orbA: AdOrb, orbB: AdOrb): { onlyInA: string[]; onlyInB: string[] } {
    const traitsA = new Set(getOrbTraitList(orbA));
    const traitsB = new Set(getOrbTraitList(orbB));

    const onlyInA = [...traitsA].filter(trait => !traitsB.has(trait));
    const onlyInB = [...traitsB].filter(trait => !traitsA.has(trait));

    return { onlyInA, onlyInB };
}
