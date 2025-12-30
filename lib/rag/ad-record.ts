/**
 * AdRecord Module
 * 
 * 3-Layer canonical ad representation:
 * - raw: Immutable, never modified after creation
 * - derived: Computed from raw, can be regenerated
 * - results: Appended when performance data available
 * 
 * One ad = one record.
 */

import { AdRecord, FacetSet, EmbeddingSet } from './types';
import { AdEntry, ExtractedAdData, ExtractedResultsData } from '@/types';
import { deriveFacetsFromAdData, deriveFacetsFromJSON, createEmptyFacetSet } from './facet-derivation';
import { generateMultiEmbeddings, generateMultiEmbeddingsWithTexts, createEmptyEmbeddingSet } from './multi-embedding';

// ============================================
// CONVERSION: AdEntry → AdRecord
// ============================================

/**
 * Convert AdEntry to AdRecord synchronously (without embeddings).
 * Use populateEmbeddings() afterward to add embeddings.
 */
export function convertToAdRecord(ad: AdEntry): AdRecord {
    const analysisJson = buildAnalysisJson(ad);
    const facets = deriveFacetsFromAdData(ad.extractedContent);

    return {
        id: ad.id,
        raw: {
            analysis_json: analysisJson,
            source: ad.importedFromFacebook ? 'facebook_import' : 'manual_upload',
            videoUrl: ad.mediaUrl,
            createdAt: ad.createdAt,
        },
        derived: {
            facets,
            embeddings: createEmptyEmbeddingSet(), // Placeholder
            embeddingVersion: 'v1.0',
            derivedAt: new Date().toISOString(),
        },
        results: ad.hasResults && ad.extractedResults ? convertResults(ad.extractedResults) : undefined,
    };
}

/**
 * Convert AdEntry to AdRecord with embeddings (async).
 */
export async function convertToAdRecordWithEmbeddings(ad: AdEntry): Promise<AdRecord> {
    const analysisJson = buildAnalysisJson(ad);
    const facets = deriveFacetsFromAdData(ad.extractedContent);

    const { embeddings, canonicalTexts } = await generateMultiEmbeddingsWithTexts(analysisJson, facets);

    return {
        id: ad.id,
        raw: {
            analysis_json: analysisJson,
            source: ad.importedFromFacebook ? 'facebook_import' : 'manual_upload',
            videoUrl: ad.mediaUrl,
            createdAt: ad.createdAt,
        },
        derived: {
            facets,
            embeddings,
            embeddingVersion: 'v1.0',
            canonicalTexts,
            derivedAt: new Date().toISOString(),
        },
        results: ad.hasResults && ad.extractedResults ? convertResults(ad.extractedResults) : undefined,
    };
}

/**
 * Create AdRecord from raw JSON analysis (new input format).
 */
export async function createAdRecordFromJSON(
    id: string,
    analysisJson: Record<string, unknown>,
    source: 'facebook_import' | 'manual_upload' | 'webhook' = 'manual_upload'
): Promise<AdRecord> {
    const facets = deriveFacetsFromJSON(analysisJson);
    const { embeddings, canonicalTexts } = await generateMultiEmbeddingsWithTexts(analysisJson, facets);

    return {
        id,
        raw: {
            analysis_json: analysisJson,
            source,
            videoUrl: analysisJson.videoUrl as string | undefined,
            createdAt: new Date().toISOString(),
        },
        derived: {
            facets,
            embeddings,
            embeddingVersion: 'v1.0',
            canonicalTexts,
            derivedAt: new Date().toISOString(),
        },
    };
}

// ============================================
// HELPERS
// ============================================

/**
 * Build analysis JSON from ExtractedAdData.
 */
function buildAnalysisJson(ad: AdEntry): Record<string, unknown> {
    const data = ad.extractedContent;
    return {
        // Basic info
        title: data.title,
        description: data.description,
        mediaType: data.mediaType,
        aspectRatio: data.aspectRatio,
        duration: data.duration,

        // Platform
        platform: data.platform,
        placement: data.placement,

        // Creative
        hookType: data.hookType,
        hookText: data.hookText,
        contentCategory: data.contentCategory,
        editingStyle: data.editingStyle,
        patternType: data.patternType,

        // Visual
        colorScheme: data.colorScheme,
        colorTemperature: data.colorTemperature,
        hasTextOverlays: data.hasTextOverlays,
        hasSubtitles: data.hasSubtitles,

        // Audio
        musicType: data.musicType,
        hasVoiceover: data.hasVoiceover,
        voiceoverStyle: data.voiceoverStyle,

        // Script
        script: data.script,
        headlines: data.headlines,
        cta: data.cta,
        ctaText: data.ctaText,
        ctaStrength: data.ctaStrength,
        painPoints: data.painPoints,

        // Talent
        facePresence: data.facePresence,
        numberOfFaces: data.numberOfFaces,
        numberOfActors: data.numberOfActors,
        isUGCStyle: data.isUGCStyle,
        talentType: data.talentType,

        // Sentiment
        emotionalTone: data.emotionalTone,
        overallSentiment: data.overallSentiment,

        // Brand
        logoConsistency: data.logoConsistency,
        logoTiming: data.logoTiming,
        brandColorUsage: data.brandColorUsage,

        // Engagement triggers
        curiosityGap: data.curiosityGap,
        socialProofElements: data.socialProofElements,
        urgencyTriggers: data.urgencyTriggers,
        trustSignals: data.trustSignals,

        // Visual analytics
        sceneVelocity: data.sceneVelocity,
        shotComposition: data.shotComposition,

        // Custom
        customTraits: data.customTraits,
        aiInsights: data.aiInsights,
    };
}

/**
 * Convert ExtractedResultsData to AdRecord results.
 */
function convertResults(results: ExtractedResultsData): AdRecord['results'] {
    return {
        impressions: results.impressions,
        clicks: results.clicks,
        ctr: results.ctr,
        conversions: results.conversions,
        roas: results.roas,
        successScore: results.successScore,
        adSpend: results.adSpend,
        revenue: results.revenue,
        updatedAt: new Date().toISOString(),
    };
}

// ============================================
// EMBEDDING POPULATION
// ============================================

/**
 * Populate embeddings for an AdRecord that doesn't have them.
 */
export async function populateEmbeddings(record: AdRecord): Promise<AdRecord> {
    if (
        record.derived.embeddings.creative.length > 0 &&
        record.derived.embeddings.creative.some(v => v !== 0)
    ) {
        // Already has embeddings
        return record;
    }

    const { embeddings, canonicalTexts } = await generateMultiEmbeddingsWithTexts(
        record.raw.analysis_json,
        record.derived.facets
    );

    return {
        ...record,
        derived: {
            ...record.derived,
            embeddings,
            canonicalTexts,
            derivedAt: new Date().toISOString(),
        },
    };
}

/**
 * Regenerate derived layer from raw data.
 */
export async function regenerateDerived(record: AdRecord): Promise<AdRecord> {
    const facets = deriveFacetsFromJSON(record.raw.analysis_json);
    const { embeddings, canonicalTexts } = await generateMultiEmbeddingsWithTexts(
        record.raw.analysis_json,
        facets
    );

    return {
        ...record,
        derived: {
            facets,
            embeddings,
            embeddingVersion: 'v1.0',
            canonicalTexts,
            derivedAt: new Date().toISOString(),
        },
    };
}

// ============================================
// UTILITIES
// ============================================

/**
 * Check if AdRecord has valid embeddings.
 */
export function hasValidEmbeddings(record: AdRecord): boolean {
    const emb = record.derived.embeddings;
    return (
        emb.creative.length > 0 && emb.creative.some(v => v !== 0) &&
        emb.script.length > 0 && emb.script.some(v => v !== 0) &&
        emb.visual.length > 0 && emb.visual.some(v => v !== 0)
    );
}

/**
 * Check if AdRecord has results.
 */
export function hasResults(record: AdRecord): boolean {
    return record.results !== undefined && record.results.successScore !== undefined;
}

/**
 * Get success score from AdRecord.
 */
export function getSuccessScore(record: AdRecord): number | undefined {
    return record.results?.successScore;
}

/**
 * Add results to AdRecord (immutable).
 */
export function addResults(
    record: AdRecord,
    results: NonNullable<AdRecord['results']>
): AdRecord {
    return {
        ...record,
        results: {
            ...results,
            updatedAt: new Date().toISOString(),
        },
    };
}

/**
 * Create empty AdRecord (for testing).
 */
export function createEmptyAdRecord(id: string): AdRecord {
    return {
        id,
        raw: {
            analysis_json: {},
            source: 'manual_upload',
            createdAt: new Date().toISOString(),
        },
        derived: {
            facets: createEmptyFacetSet(),
            embeddings: createEmptyEmbeddingSet(),
            embeddingVersion: 'v1.0',
            derivedAt: new Date().toISOString(),
        },
    };
}
