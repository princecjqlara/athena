/**
 * Multi-Embedding Generation Module
 * 
 * Generates 3 separate embeddings for weighted similarity search:
 * - Creative (0.5 weight): Scene descriptions, tone, structure, facets
 * - Script (0.3 weight): ASR text, on-screen text, CTA language
 * - Visual (0.2 weight): Object descriptions, colors, motion, layout
 * 
 * Embeddings are the PRIMARY ML signal - NOT facets.
 * Facets are derived separately for explanation only.
 */

import { EmbeddingSet, AdRecord, FacetSet } from './types';
import { generateEmbedding } from './build-embedding';

// ============================================
// CANONICAL TEXT BUILDERS
// ============================================

/**
 * Build creative summary for embedding.
 * Includes: scene descriptions, tone, claims, structure, facets
 */
export function buildCreativeSummary(
    analysisJson: Record<string, unknown>,
    facets?: FacetSet
): string {
    const lines: string[] = [];

    // Scene/content description
    if (analysisJson.description) {
        lines.push(`description=${String(analysisJson.description).toLowerCase().slice(0, 200)}`);
    }

    // Content category/type
    if (analysisJson.contentCategory || analysisJson.content_category) {
        lines.push(`category=${String(analysisJson.contentCategory || analysisJson.content_category).toLowerCase()}`);
    }

    // Hook type and structure  
    if (analysisJson.hookType || analysisJson.hook_type) {
        lines.push(`hook=${String(analysisJson.hookType || analysisJson.hook_type).toLowerCase()}`);
    }

    // Pattern type
    if (analysisJson.patternType || analysisJson.pattern_type) {
        lines.push(`pattern=${String(analysisJson.patternType || analysisJson.pattern_type).toLowerCase()}`);
    }

    // Emotional tone
    if (analysisJson.emotionalTone || analysisJson.emotional_tone) {
        lines.push(`tone=${String(analysisJson.emotionalTone || analysisJson.emotional_tone).toLowerCase()}`);
    }

    // Overall sentiment
    if (analysisJson.overallSentiment || analysisJson.overall_sentiment) {
        lines.push(`sentiment=${String(analysisJson.overallSentiment || analysisJson.overall_sentiment).toLowerCase()}`);
    }

    // Editing style
    if (analysisJson.editingStyle || analysisJson.editing_style) {
        lines.push(`editing=${String(analysisJson.editingStyle || analysisJson.editing_style).toLowerCase()}`);
    }

    // Claims from analysis
    if (analysisJson.claims && Array.isArray(analysisJson.claims)) {
        const claimsText = (analysisJson.claims as string[]).join(' ').toLowerCase().slice(0, 200);
        lines.push(`claims=${claimsText}`);
    }

    // Structure info
    if (analysisJson.adStructure || analysisJson.structure) {
        const structure = analysisJson.adStructure || analysisJson.structure;
        if (typeof structure === 'object') {
            lines.push(`structure=${JSON.stringify(structure).toLowerCase().slice(0, 100)}`);
        } else {
            lines.push(`structure=${String(structure).toLowerCase()}`);
        }
    }

    // Include derived facets for semantic grounding
    if (facets) {
        if (facets.content_hook.length > 0) lines.push(`content_hook=${facets.content_hook.join(',')}`);
        if (facets.sentiment.length > 0) lines.push(`sentiment_facets=${facets.sentiment.join(',')}`);
        if (facets.media_format.length > 0) lines.push(`format=${facets.media_format.join(',')}`);
    }

    return lines.join('\n');
}

/**
 * Build script summary for embedding.
 * Includes: ASR text, on-screen text, CTA language
 */
export function buildScriptSummary(analysisJson: Record<string, unknown>): string {
    const lines: string[] = [];

    // Script/narration
    if (analysisJson.script) {
        lines.push(`script=${String(analysisJson.script).toLowerCase().slice(0, 500)}`);
    }

    // ASR/transcription
    if (analysisJson.asr || analysisJson.transcription || analysisJson.speechText) {
        const asrText = String(analysisJson.asr || analysisJson.transcription || analysisJson.speechText);
        lines.push(`asr=${asrText.toLowerCase().slice(0, 500)}`);
    }

    // On-screen text events
    if (analysisJson.on_screen_text_events && Array.isArray(analysisJson.on_screen_text_events)) {
        const textEvents = analysisJson.on_screen_text_events as Array<{ text?: string }>;
        const texts = textEvents.map(e => e.text || '').filter(t => t).join(' ');
        lines.push(`text_overlay=${texts.toLowerCase().slice(0, 300)}`);
    }

    // Headlines
    if (analysisJson.headlines && Array.isArray(analysisJson.headlines)) {
        lines.push(`headlines=${(analysisJson.headlines as string[]).join(' ').toLowerCase()}`);
    }

    // CTA text
    if (analysisJson.ctaText || analysisJson.cta_text) {
        lines.push(`cta_text=${String(analysisJson.ctaText || analysisJson.cta_text).toLowerCase()}`);
    }

    // CTA type
    if (analysisJson.cta) {
        lines.push(`cta_type=${String(analysisJson.cta).toLowerCase()}`);
    }

    // Hook text
    if (analysisJson.hookText || analysisJson.hook_text) {
        lines.push(`hook_text=${String(analysisJson.hookText || analysisJson.hook_text).toLowerCase()}`);
    }

    // Pain points
    if (analysisJson.painPoints && Array.isArray(analysisJson.painPoints)) {
        lines.push(`pain_points=${(analysisJson.painPoints as string[]).join(' ').toLowerCase()}`);
    }

    return lines.join('\n');
}

/**
 * Build visual summary for embedding.
 * Includes: object descriptions, colors, motion, layout
 */
export function buildVisualSummary(analysisJson: Record<string, unknown>): string {
    const lines: string[] = [];

    // Color scheme
    if (analysisJson.colorScheme || analysisJson.color_scheme) {
        lines.push(`color=${String(analysisJson.colorScheme || analysisJson.color_scheme).toLowerCase()}`);
    }

    // Color temperature
    if (analysisJson.colorTemperature || analysisJson.color_temperature) {
        lines.push(`temperature=${String(analysisJson.colorTemperature || analysisJson.color_temperature).toLowerCase()}`);
    }

    // Shot composition
    if (analysisJson.shotComposition || analysisJson.shot_composition) {
        lines.push(`composition=${String(analysisJson.shotComposition || analysisJson.shot_composition).toLowerCase()}`);
    }

    // Scene velocity/pace
    if (analysisJson.sceneVelocity || analysisJson.scene_velocity) {
        lines.push(`velocity=${String(analysisJson.sceneVelocity || analysisJson.scene_velocity).toLowerCase()}`);
    }

    // Object tracks (from video analysis)
    if (analysisJson.object_tracks && Array.isArray(analysisJson.object_tracks)) {
        const objects = analysisJson.object_tracks as Array<{ label?: string }>;
        const labels = [...new Set(objects.map(o => o.label || '').filter(l => l))];
        lines.push(`objects=${labels.join(',').toLowerCase()}`);
    }

    // Shots info
    if (analysisJson.shots && Array.isArray(analysisJson.shots)) {
        const shots = analysisJson.shots as Array<{ description?: string }>;
        const descriptions = shots.map(s => s.description || '').filter(d => d).join(' ');
        lines.push(`shots=${descriptions.toLowerCase().slice(0, 300)}`);
    }

    // Visual style array
    if (analysisJson.visualStyle && Array.isArray(analysisJson.visualStyle)) {
        lines.push(`style=${(analysisJson.visualStyle as string[]).join(',').toLowerCase()}`);
    }

    // Aspect ratio
    if (analysisJson.aspectRatio || analysisJson.aspect_ratio) {
        lines.push(`aspect=${String(analysisJson.aspectRatio || analysisJson.aspect_ratio)}`);
    }

    // Media type
    if (analysisJson.mediaType || analysisJson.media_type) {
        lines.push(`media=${String(analysisJson.mediaType || analysisJson.media_type).toLowerCase()}`);
    }

    // Face/talent presence
    if (analysisJson.facePresence || analysisJson.face_presence) {
        lines.push('face_present=true');
    }
    if (analysisJson.numberOfFaces || analysisJson.number_of_faces) {
        lines.push(`faces=${analysisJson.numberOfFaces || analysisJson.number_of_faces}`);
    }

    // Logo placement
    if (analysisJson.logoConsistency) {
        lines.push(`logo=${String(analysisJson.logoConsistency).toLowerCase()}`);
    }

    return lines.join('\n');
}

// ============================================
// MAIN EMBEDDING GENERATION
// ============================================

/**
 * Generate multi-embeddings from analysis JSON.
 * Returns 3 embeddings for weighted similarity.
 */
export async function generateMultiEmbeddings(
    analysisJson: Record<string, unknown>,
    facets?: FacetSet
): Promise<EmbeddingSet> {
    // Build canonical texts
    const creativeText = buildCreativeSummary(analysisJson, facets);
    const scriptText = buildScriptSummary(analysisJson);
    const visualText = buildVisualSummary(analysisJson);

    // Generate embeddings in parallel
    const [creative, script, visual] = await Promise.all([
        generateEmbedding(creativeText || 'empty'),
        generateEmbedding(scriptText || 'empty'),
        generateEmbedding(visualText || 'empty'),
    ]);

    return { creative, script, visual };
}

/**
 * Generate multi-embeddings with cached canonical texts.
 * Also returns the canonical texts for debugging.
 */
export async function generateMultiEmbeddingsWithTexts(
    analysisJson: Record<string, unknown>,
    facets?: FacetSet
): Promise<{
    embeddings: EmbeddingSet;
    canonicalTexts: { creative: string; script: string; visual: string };
}> {
    const creativeText = buildCreativeSummary(analysisJson, facets);
    const scriptText = buildScriptSummary(analysisJson);
    const visualText = buildVisualSummary(analysisJson);

    const [creative, script, visual] = await Promise.all([
        generateEmbedding(creativeText || 'empty'),
        generateEmbedding(scriptText || 'empty'),
        generateEmbedding(visualText || 'empty'),
    ]);

    return {
        embeddings: { creative, script, visual },
        canonicalTexts: {
            creative: creativeText,
            script: scriptText,
            visual: visualText,
        },
    };
}

// ============================================
// SIMILARITY COMPUTATION
// ============================================

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
}

/**
 * Compute weighted multi-embedding similarity.
 * 
 * Formula: 0.5 * creative + 0.3 * script + 0.2 * visual
 */
export function computeMultiEmbeddingSimilarity(
    embA: EmbeddingSet,
    embB: EmbeddingSet
): {
    creativeSimilarity: number;
    scriptSimilarity: number;
    visualSimilarity: number;
    weightedSimilarity: number;
} {
    const creativeSim = cosineSimilarity(embA.creative, embB.creative);
    const scriptSim = cosineSimilarity(embA.script, embB.script);
    const visualSim = cosineSimilarity(embA.visual, embB.visual);

    // Weighted combination
    const weightedSim = 0.5 * creativeSim + 0.3 * scriptSim + 0.2 * visualSim;

    return {
        creativeSimilarity: creativeSim,
        scriptSimilarity: scriptSim,
        visualSimilarity: visualSim,
        weightedSimilarity: weightedSim,
    };
}

/**
 * Check if an embedding set is valid (non-empty arrays).
 */
export function isValidEmbeddingSet(embeddings: EmbeddingSet): boolean {
    return (
        Array.isArray(embeddings.creative) && embeddings.creative.length > 0 &&
        Array.isArray(embeddings.script) && embeddings.script.length > 0 &&
        Array.isArray(embeddings.visual) && embeddings.visual.length > 0
    );
}

/**
 * Create empty embedding set (for fallback).
 */
export function createEmptyEmbeddingSet(dimensions: number = 384): EmbeddingSet {
    return {
        creative: new Array(dimensions).fill(0),
        script: new Array(dimensions).fill(0),
        visual: new Array(dimensions).fill(0),
    };
}
