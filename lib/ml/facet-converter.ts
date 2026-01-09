/**
 * Facet Data Converter
 * 
 * Converts various ad data formats into the FacetAd format
 * required by the facet intelligence system.
 */

import { FacetAd } from './facet-intelligence';

// ============================================
// FROM ORB FORMAT
// ============================================

interface OrbFacets {
    platform_placement?: string[];
    media_format?: string[];
    visual_style?: string[];
    audio_voice?: string[];
    content_hook?: string[];
    text_features?: string[];
    talent_face?: string[];
    sentiment?: string[];
    brand?: string[];
    cta?: string[];
    [key: string]: string[] | undefined;
}

interface OrbData {
    id: string;
    derived?: {
        facets?: OrbFacets;
    };
    spec?: {
        facets?: OrbFacets;
    };
    results?: {
        successScore?: number;
        roas?: number;
        ctr?: number;
        conversions?: number;
    };
    successScore?: number;
}

/**
 * Convert orb-style data to FacetAd format
 */
export function orbToFacetAd(orb: OrbData): FacetAd | null {
    // Get facets from derived or spec
    const facets = orb.derived?.facets || orb.spec?.facets;
    if (!facets) return null;

    // Get success score from results or directly
    const successScore = orb.results?.successScore ?? orb.successScore ?? 50;

    // Clean facets (remove undefined values)
    const cleanFacets: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(facets)) {
        if (value && Array.isArray(value) && value.length > 0) {
            cleanFacets[key] = value;
        }
    }

    return {
        id: orb.id,
        facets: cleanFacets,
        successScore,
    };
}

/**
 * Convert array of orbs to FacetAd array
 */
export function orbsToFacetAds(orbs: OrbData[]): FacetAd[] {
    return orbs
        .map(orbToFacetAd)
        .filter((ad): ad is FacetAd => ad !== null);
}

// ============================================
// FROM STANDARD AD FORMAT (localStorage)
// ============================================

interface StandardAd {
    id: string;
    extractedContent?: {
        hookType?: string;
        platform?: string;
        contentCategory?: string;
        editingStyle?: string;
        musicType?: string;
        colorScheme?: string;
        hasSubtitles?: boolean;
        isUGCStyle?: boolean;
        hasVoiceover?: boolean;
        traits?: string[];
        [key: string]: unknown;
    };
    successScore?: number;
    adInsights?: {
        ctr?: number;
        roas?: number;
        conversions?: number;
    };
}

/**
 * Convert standard ad format (from localStorage) to FacetAd
 */
export function standardAdToFacetAd(ad: StandardAd): FacetAd | null {
    const content = ad.extractedContent;
    if (!content) return null;

    const facets: Record<string, string[]> = {};

    // Map standard fields to facets
    if (content.hookType) facets.content_hook = [content.hookType];
    if (content.platform) facets.platform_placement = [content.platform];
    if (content.contentCategory) facets.media_format = [content.contentCategory];
    if (content.editingStyle) facets.visual_style = [content.editingStyle];
    if (content.musicType) facets.audio_voice = [content.musicType];
    if (content.colorScheme) facets.color = [content.colorScheme];

    // Boolean features as facets
    const textFeatures: string[] = [];
    if (content.hasSubtitles) textFeatures.push('subtitles');
    if (content.hasVoiceover) textFeatures.push('voiceover');
    if (textFeatures.length > 0) facets.text_features = textFeatures;

    const talentFace: string[] = [];
    if (content.isUGCStyle) talentFace.push('ugc_creator');
    if (talentFace.length > 0) facets.talent_face = talentFace;

    // Include any explicit traits
    if (content.traits && Array.isArray(content.traits)) {
        facets.custom_traits = content.traits;
    }

    // Calculate success score
    let successScore = ad.successScore ?? 50;
    if (!ad.successScore && ad.adInsights) {
        // Estimate from metrics if no explicit score
        const ctr = ad.adInsights.ctr ?? 0;
        const roas = ad.adInsights.roas ?? 0;
        successScore = Math.min(100, Math.max(0,
            30 + (ctr * 10) + (roas * 5)
        ));
    }

    return {
        id: ad.id,
        facets,
        successScore,
    };
}

/**
 * Convert array of standard ads to FacetAd array
 */
export function standardAdsToFacetAds(ads: StandardAd[]): FacetAd[] {
    return ads
        .map(standardAdToFacetAd)
        .filter((ad): ad is FacetAd => ad !== null && Object.keys(ad.facets).length > 0);
}

// ============================================
// FROM JSON IMPORT
// ============================================

/**
 * Auto-detect format and convert to FacetAd array
 * Supports: orb format, standard format, or raw facet format
 */
export function autoConvertToFacetAds(data: unknown): FacetAd[] {
    if (!data) return [];

    // Handle array of items
    if (Array.isArray(data)) {
        const results: FacetAd[] = [];
        for (const item of data) {
            const converted = autoConvertToFacetAds(item);
            results.push(...converted);
        }
        return results;
    }

    // Handle object
    if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;

        // Check for orb format (has derived.facets)
        if (obj.derived && typeof obj.derived === 'object' && typeof obj.id === 'string') {
            const orb = orbToFacetAd(obj as unknown as OrbData);
            return orb ? [orb] : [];
        }

        // Check for standard format (has extractedContent)
        if (obj.extractedContent && typeof obj.extractedContent === 'object' && typeof obj.id === 'string') {
            const ad = standardAdToFacetAd(obj as unknown as StandardAd);
            return ad ? [ad] : [];
        }

        // Check for raw facet format (has facets directly)
        if (obj.facets && typeof obj.facets === 'object') {
            return [{
                id: (obj.id as string) || `ad-${Date.now()}`,
                facets: obj.facets as Record<string, string[]>,
                successScore: (obj.successScore as number) ?? 50,
            }];
        }

        // Check if it's a wrapper object with examples or data array
        if (obj.examples && typeof obj.examples === 'object') {
            return autoConvertToFacetAds(Object.values(obj.examples));
        }
        if (obj.data && Array.isArray(obj.data)) {
            return autoConvertToFacetAds(obj.data);
        }
        if (obj.ads && Array.isArray(obj.ads)) {
            return autoConvertToFacetAds(obj.ads);
        }
    }

    return [];
}
