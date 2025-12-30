/**
 * Facet Derivation Module
 * 
 * Derives stable, finite, low-cardinality facets from rich JSON analysis.
 * 
 * IMPORTANT: Facets are used ONLY for:
 * - Explanation & UI display
 * - Contrastive analysis grouping
 * - Marketplace metadata
 * - Filtering
 * 
 * Facets are NOT used as prediction weights - embeddings are the primary ML signal.
 */

import { FacetSet, AdRecord } from './types';
import { ExtractedAdData } from '@/types';

// ============================================
// FACET VALUE MAPPINGS
// ============================================

const MEDIA_FORMAT_MAP: Record<string, string> = {
    'animated': 'animated',
    'fast_cuts': 'live_action',
    'cinematic': 'live_action',
    'raw_authentic': 'live_action',
    'mixed_media': 'mixed',
    'minimal': 'live_action',
    'dynamic': 'live_action',
    'slow_motion': 'live_action',
};

const VISUAL_STYLE_MAP: Record<string, string> = {
    'vibrant': 'bright_palette',
    'pastel': 'bright_palette',
    'neon': 'bright_palette',
    'muted': 'muted_palette',
    'dark': 'dark_palette',
    'monochrome': 'monochrome',
    'warm': 'warm_tones',
    'cool': 'cool_tones',
    'natural': 'natural',
};

const SENTIMENT_MAP: Record<string, string> = {
    'inspiring': 'inspirational',
    'urgent': 'urgent',
    'calm': 'calm',
    'exciting': 'upbeat',
    'serious': 'serious',
    'humorous': 'playful',
};

const HOOK_TYPE_MAP: Record<string, string> = {
    'curiosity': 'curiosity',
    'shock': 'shock',
    'question': 'question',
    'story': 'storytelling',
    'statistic': 'data_driven',
    'controversy': 'controversy',
    'transformation': 'transformation',
    'before_after': 'before_after',
    'problem_solution': 'problem_solution',
    'testimonial': 'social_proof',
    'unboxing': 'unboxing',
    'challenge': 'challenge',
};

const CTA_TYPE_MAP: Record<string, string> = {
    'shop_now': 'shop_now',
    'learn_more': 'learn_more',
    'sign_up': 'sign_up',
    'download': 'download',
    'contact_us': 'contact_us',
    'swipe_up': 'swipe_up',
    'link_in_bio': 'link_in_bio',
    'book_now': 'book_now',
    'get_offer': 'get_offer',
};

// ============================================
// MAIN DERIVATION FUNCTION
// ============================================

/**
 * Derive facets from ExtractedAdData (existing system)
 */
export function deriveFacetsFromAdData(data: ExtractedAdData): FacetSet {
    return {
        platform_placement: derivePlatformPlacement(data),
        media_format: deriveMediaFormat(data),
        visual_style: deriveVisualStyle(data),
        audio_voice: deriveAudioVoice(data),
        content_hook: deriveContentHook(data),
        text_features: deriveTextFeatures(data),
        talent_face: deriveTalentFace(data),
        sentiment: deriveSentiment(data),
        brand: deriveBrand(data),
        cta: deriveCTA(data),
    };
}

/**
 * Derive facets from raw analysis JSON (rich JSON input)
 */
export function deriveFacetsFromJSON(analysisJson: Record<string, unknown>): FacetSet {
    // Map from rich JSON structure to facets
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

    // Platform & Placement
    if (analysisJson.platform) {
        facets.platform_placement.push(String(analysisJson.platform).toLowerCase());
    }
    if (analysisJson.placement) {
        facets.platform_placement.push(String(analysisJson.placement).toLowerCase());
    }
    if (analysisJson.aspectRatio || analysisJson.aspect_ratio) {
        facets.platform_placement.push(String(analysisJson.aspectRatio || analysisJson.aspect_ratio));
    }

    // Media Format
    const editingStyle = String(analysisJson.editingStyle || analysisJson.editing_style || '').toLowerCase();
    if (editingStyle && MEDIA_FORMAT_MAP[editingStyle]) {
        facets.media_format.push(MEDIA_FORMAT_MAP[editingStyle]);
    }
    if (analysisJson.mediaType === 'video' || analysisJson.media_type === 'video') {
        facets.media_format.push('video');
    }
    if (analysisJson.mediaType === 'photo' || analysisJson.media_type === 'photo') {
        facets.media_format.push('static');
    }

    // Detect animation from various signals
    if (editingStyle === 'animated' || analysisJson.isAnimated || analysisJson.has_animation) {
        facets.media_format.push('animated');
    }

    // Visual Style
    const colorScheme = String(analysisJson.colorScheme || analysisJson.color_scheme || '').toLowerCase();
    if (colorScheme && VISUAL_STYLE_MAP[colorScheme]) {
        facets.visual_style.push(VISUAL_STYLE_MAP[colorScheme]);
    }

    // Audio & Voice
    if (analysisJson.hasVoiceover || analysisJson.has_voiceover || analysisJson.voiceover) {
        facets.audio_voice.push('voiceover');
    }
    const musicType = String(analysisJson.musicType || analysisJson.music_type || '').toLowerCase();
    if (musicType && musicType !== 'no_music' && musicType !== 'voiceover_only') {
        facets.audio_voice.push('music');
        if (musicType === 'upbeat' || musicType === 'energetic') {
            facets.audio_voice.push('energetic');
        }
    }

    // Content & Hook
    const hookType = String(analysisJson.hookType || analysisJson.hook_type || '').toLowerCase();
    if (hookType && HOOK_TYPE_MAP[hookType]) {
        facets.content_hook.push(HOOK_TYPE_MAP[hookType]);
    }
    if (analysisJson.hookPresent !== false && analysisJson.hook_present !== false) {
        facets.content_hook.push('hook_present');
    }

    // Text Features
    if (analysisJson.hasSubtitles || analysisJson.has_subtitles || analysisJson.subtitles) {
        facets.text_features.push('subtitles');
    }
    if (analysisJson.hasTextOverlays || analysisJson.has_text_overlays || analysisJson.text_overlays) {
        facets.text_features.push('text_overlay');
    }

    // Talent & Face
    if (analysisJson.facePresence || analysisJson.face_presence || analysisJson.humanPresent) {
        facets.talent_face.push('human_present');
        facets.talent_face.push('face_visible');
    }
    if (analysisJson.isUGCStyle || analysisJson.is_ugc || analysisJson.ugc) {
        facets.talent_face.push('ugc_creator');
    }

    // Sentiment
    const emotionalTone = String(analysisJson.emotionalTone || analysisJson.emotional_tone || '').toLowerCase();
    if (emotionalTone && SENTIMENT_MAP[emotionalTone]) {
        facets.sentiment.push(SENTIMENT_MAP[emotionalTone]);
    }

    // Brand
    if (analysisJson.logoConsistency && analysisJson.logoConsistency !== 'absent') {
        facets.brand.push('brand_present');
    }
    const logoTiming = String(analysisJson.logoTiming || analysisJson.logo_timing || '').toLowerCase();
    if (logoTiming === 'intro') {
        facets.brand.push('early_reveal');
    } else if (logoTiming === 'outro') {
        facets.brand.push('late_reveal');
    }

    // CTA
    const ctaType = String(analysisJson.cta || analysisJson.ctaType || analysisJson.cta_type || '').toLowerCase();
    if (ctaType && CTA_TYPE_MAP[ctaType]) {
        facets.cta.push(CTA_TYPE_MAP[ctaType]);
    }
    const ctaStrength = String(analysisJson.ctaStrength || analysisJson.cta_strength || '').toLowerCase();
    if (ctaStrength) {
        facets.cta.push(ctaStrength);
    }

    return facets;
}

// ============================================
// INDIVIDUAL FACET DERIVERS
// ============================================

function derivePlatformPlacement(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.platform) facets.push(data.platform);
    if (data.placement) facets.push(data.placement);
    if (data.aspectRatio) facets.push(data.aspectRatio);
    return facets;
}

function deriveMediaFormat(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.mediaType) facets.push(data.mediaType);
    if (data.editingStyle && MEDIA_FORMAT_MAP[data.editingStyle]) {
        facets.push(MEDIA_FORMAT_MAP[data.editingStyle]);
    }
    return facets;
}

function deriveVisualStyle(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.colorScheme && VISUAL_STYLE_MAP[data.colorScheme]) {
        facets.push(VISUAL_STYLE_MAP[data.colorScheme]);
    }
    if (data.colorTemperature) facets.push(`${data.colorTemperature}_tones`);
    return facets;
}

function deriveAudioVoice(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.hasVoiceover) facets.push('voiceover');
    if (data.musicType && data.musicType !== 'no_music' && data.musicType !== 'voiceover_only') {
        facets.push('music');
    }
    // Check for upbeat music type (energetic mood derived from upbeat type)
    if (data.musicType === 'upbeat') {
        facets.push('energetic');
    }
    return facets;
}

function deriveContentHook(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.hookType && HOOK_TYPE_MAP[data.hookType]) {
        facets.push(HOOK_TYPE_MAP[data.hookType]);
    }
    if (data.patternType) facets.push(data.patternType);
    return facets;
}

function deriveTextFeatures(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.hasSubtitles) facets.push('subtitles');
    if (data.hasTextOverlays) facets.push('text_overlay');
    if (data.textOverlayRatio === 'heavy') facets.push('high_density');
    return facets;
}

function deriveTalentFace(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.facePresence) {
        facets.push('human_present');
        facets.push('face_visible');
    }
    if (data.isUGCStyle) facets.push('ugc_creator');
    if (data.numberOfActors && data.numberOfActors > 1) facets.push('multiple_talent');
    return facets;
}

function deriveSentiment(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.emotionalTone && SENTIMENT_MAP[data.emotionalTone]) {
        facets.push(SENTIMENT_MAP[data.emotionalTone]);
    }
    if (data.overallSentiment) facets.push(data.overallSentiment);
    return facets;
}

function deriveBrand(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.logoConsistency && data.logoConsistency !== 'absent') {
        facets.push('brand_present');
    }
    if (data.logoTiming === 'intro') {
        facets.push('early_reveal');
    } else if (data.logoTiming === 'outro') {
        facets.push('late_reveal');
    }
    return facets;
}

function deriveCTA(data: ExtractedAdData): string[] {
    const facets: string[] = [];
    if (data.cta && CTA_TYPE_MAP[data.cta]) {
        facets.push(CTA_TYPE_MAP[data.cta]);
    }
    if (data.ctaStrength) facets.push(data.ctaStrength);
    return facets;
}

// ============================================
// FACET UTILITIES
// ============================================

/**
 * Create empty facet set
 */
export function createEmptyFacetSet(): FacetSet {
    return {
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
}

/**
 * Get all facets as flat list
 */
export function flattenFacets(facets: FacetSet): string[] {
    return [
        ...facets.platform_placement,
        ...facets.media_format,
        ...facets.visual_style,
        ...facets.audio_voice,
        ...facets.content_hook,
        ...facets.text_features,
        ...facets.talent_face,
        ...facets.sentiment,
        ...facets.brand,
        ...facets.cta,
    ];
}

/**
 * Check if facet set has a specific facet
 */
export function hasFacet(facets: FacetSet, group: keyof FacetSet, value: string): boolean {
    return facets[group].includes(value.toLowerCase());
}

/**
 * Count matching facets between two sets
 */
export function countMatchingFacets(a: FacetSet, b: FacetSet): number {
    let count = 0;
    const groups: (keyof FacetSet)[] = [
        'platform_placement', 'media_format', 'visual_style', 'audio_voice',
        'content_hook', 'text_features', 'talent_face', 'sentiment', 'brand', 'cta'
    ];

    for (const group of groups) {
        const setA = new Set(a[group]);
        for (const val of b[group]) {
            if (setA.has(val)) count++;
        }
    }

    return count;
}

/**
 * Get facet groups where two ads differ
 */
export function getDifferingFacetGroups(a: FacetSet, b: FacetSet): (keyof FacetSet)[] {
    const groups: (keyof FacetSet)[] = [
        'platform_placement', 'media_format', 'visual_style', 'audio_voice',
        'content_hook', 'text_features', 'talent_face', 'sentiment', 'brand', 'cta'
    ];

    return groups.filter(group => {
        const setA = new Set(a[group]);
        const setB = new Set(b[group]);
        if (setA.size !== setB.size) return true;
        for (const val of setA) {
            if (!setB.has(val)) return true;
        }
        return false;
    });
}
