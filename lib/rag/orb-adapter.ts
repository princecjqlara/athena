/**
 * Orb Adapter Module
 * 
 * Converts between Orb (new system) and AdOrb (existing RAG system)
 * to maintain backward compatibility.
 */

import { Orb, OrbResults } from './orb-types';
import { AdOrb, FacetSet } from './types';
import { flattenFacets } from './facet-derivation';

// ============================================
// ORB → ADORB CONVERSION
// ============================================

/**
 * Convert an Orb to an AdOrb for RAG queries
 */
export function convertOrbToAdOrb(orb: Orb): AdOrb {
    // Flatten facets to traits
    const traits: Record<string, string | number | boolean> = {};

    // Add platform and objective
    traits['platform'] = orb.spec.platform;
    if (orb.spec.objective) traits['objective'] = orb.spec.objective;

    // Convert facets to traits
    const facetGroups: (keyof FacetSet)[] = [
        'platform_placement', 'media_format', 'visual_style', 'audio_voice',
        'content_hook', 'text_features', 'talent_face', 'sentiment', 'brand', 'cta'
    ];

    for (const group of facetGroups) {
        const values = orb.derived.facets[group];
        if (values && values.length > 0) {
            // Add primary value as trait
            traits[group] = values[0];

            // Add boolean traits for each value
            for (const value of values) {
                traits[`${group}_${value}`] = true;
            }
        }
    }

    // Convert results
    let results: AdOrb['results'] | undefined;
    if (orb.results) {
        results = {
            successScore: orb.results.successScore,
            roas: orb.results.roas,
            ctr: orb.results.ctr,
            conversions: orb.results.conversions,
            impressions: orb.results.impressions,
            clicks: orb.results.clicks,
            adSpend: orb.results.adSpend,
            revenue: orb.results.revenue,
        };
    }

    return {
        id: orb.id,
        traits,
        results,
        metadata: {
            platform: orb.spec.platform as AdOrb['metadata']['platform'],
            objective: orb.spec.objective as AdOrb['metadata']['objective'],
            createdAt: orb.createdAt,
            updatedAt: orb.updatedAt,
            hasResults: orb.state === 'observed' && !!orb.results,
        },
        embedding: orb.derived.embeddings.creative.length > 0
            ? orb.derived.embeddings.creative
            : undefined,
        canonicalText: orb.derived.canonicalTexts?.creative,
    };
}

// ============================================
// ADORB → ORB CONVERSION
// ============================================

/**
 * Convert an AdOrb to an Orb
 * Used for importing existing ads into the new system
 */
export function convertAdOrbToOrb(adOrb: AdOrb): Orb {
    const now = new Date().toISOString();

    // Determine state based on hasResults
    const state = adOrb.metadata.hasResults ? 'observed' : 'published';

    // Extract facets from traits
    const facets: FacetSet = {
        platform_placement: [],
        media_format: [],
        visual_style: [],
        audio_voice: [],
        content_hook: [],
        text_features: [],
        talent_face: [],
        sentiment: [],
        brand: [],
        cta: [],
    };

    // Map traits to facets
    if (adOrb.traits.platform) {
        facets.platform_placement.push(String(adOrb.traits.platform));
    }
    if (adOrb.traits.hook) {
        facets.content_hook.push(String(adOrb.traits.hook));
    }
    if (adOrb.traits.ugc === true) {
        facets.talent_face.push('ugc_creator');
    }
    if (adOrb.traits.subtitles === true) {
        facets.text_features.push('subtitles');
    }
    if (adOrb.traits.voiceover === true) {
        facets.audio_voice.push('voiceover');
    }
    if (adOrb.traits.text_overlays === true) {
        facets.text_features.push('text_overlay');
    }

    // Convert results
    let results: OrbResults | undefined;
    if (adOrb.results) {
        results = {
            successScore: adOrb.results.successScore,
            roas: adOrb.results.roas,
            ctr: adOrb.results.ctr,
            conversions: adOrb.results.conversions,
            impressions: adOrb.results.impressions,
            clicks: adOrb.results.clicks,
            adSpend: adOrb.results.adSpend,
            revenue: adOrb.results.revenue,
            fetchedAt: now,
        };
    }

    return {
        id: adOrb.id,
        state,
        createdFrom: 'user',
        raw: {
            source: 'manual_upload',
            createdAt: now,
        },
        derived: {
            facets,
            embeddings: {
                creative: adOrb.embedding || [],
                script: [],
                visual: [],
            },
            embeddingVersion: '1.0.0',
            canonicalTexts: adOrb.canonicalText
                ? { creative: adOrb.canonicalText, script: '', visual: '' }
                : undefined,
            createdAt: now,
        },
        spec: {
            platform: adOrb.metadata.platform,
            objective: adOrb.metadata.objective || 'conversions',
            facets,
        },
        results,
        createdAt: adOrb.metadata.createdAt,
        updatedAt: adOrb.metadata.updatedAt,
    };
}

// ============================================
// BATCH CONVERSIONS
// ============================================

/**
 * Convert multiple Orbs to AdOrbs
 */
export function convertManyOrbsToAdOrbs(orbs: Orb[]): AdOrb[] {
    return orbs.map(convertOrbToAdOrb);
}

/**
 * Convert multiple AdOrbs to Orbs
 */
export function convertManyAdOrbsToOrbs(adOrbs: AdOrb[]): Orb[] {
    return adOrbs.map(convertAdOrbToOrb);
}
