/**
 * Embedding Generation Module
 * 
 * Builds canonical text representations and generates vector embeddings
 * for RAG-based similarity search.
 */

import { AdOrb } from './types';

// ============================================
// CANONICAL TEXT GENERATION
// ============================================

/**
 * Predictive trait keys to include in canonical text
 * Ordered by importance for deterministic output
 */
const CANONICAL_TRAIT_ORDER = [
    // Platform & Media
    'platform',
    'placement',
    'media_type',
    'aspect_ratio',
    'duration',

    // Creative Style
    'hook',
    'category',
    'editing',
    'color',
    'pattern',
    'tone',
    'sentiment',

    // Audio
    'music',
    'bpm',
    'voiceover',
    'voiceover_style',

    // Visual Elements
    'ugc',
    'subtitles',
    'text_overlays',
    'face_presence',
    'scene_velocity',
    'composition',

    // Talent
    'actors',
    'talent',

    // CTA & Engagement
    'cta_type',
    'cta_strength',
    'hook_velocity',
    'curiosity_gap',
    'social_proof',
    'urgency',
    'trust_signals',

    // Brand
    'logo',
    'brand_color',

    // Campaign
    'objective',
    'budget_tier',
    'audience',
    'age_group',
    'retention',
];

/**
 * Keys to exclude from canonical text (volatile/non-predictive)
 */
const EXCLUDED_KEYS = [
    'id',
    'createdAt',
    'updatedAt',
    'lastAccessedAt',
    'embeddingGeneratedAt',
];

/**
 * Normalize boolean to text representation
 */
function normalizeBoolean(value: boolean): string {
    return value ? 'true' : 'false';
}

/**
 * Normalize value to string for canonical text
 */
function normalizeValue(value: string | number | boolean): string {
    if (typeof value === 'boolean') {
        return normalizeBoolean(value);
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return String(value).toLowerCase().trim();
}

/**
 * Build canonical text representation of an AdOrb
 * 
 * Format:
 * platform=tiktok
 * hook=curiosity
 * ugc=true
 * subtitles=true
 * voiceover=false
 * editing=raw
 */
export function buildCanonicalText(orb: AdOrb): string {
    const lines: string[] = [];

    // Add traits in canonical order first
    for (const key of CANONICAL_TRAIT_ORDER) {
        if (key in orb.traits && orb.traits[key] !== undefined && orb.traits[key] !== null) {
            const value = normalizeValue(orb.traits[key]);
            if (value !== '' && value !== 'undefined') {
                lines.push(`${key}=${value}`);
            }
        }
    }

    // Add any remaining traits not in canonical order (sorted alphabetically)
    const remainingKeys = Object.keys(orb.traits)
        .filter(key => !CANONICAL_TRAIT_ORDER.includes(key) && !EXCLUDED_KEYS.includes(key))
        .sort();

    for (const key of remainingKeys) {
        const value = orb.traits[key];
        if (value !== undefined && value !== null) {
            const normalized = normalizeValue(value);
            if (normalized !== '' && normalized !== 'undefined') {
                lines.push(`${key}=${normalized}`);
            }
        }
    }

    // Add metadata (non-volatile fields only)
    if (orb.metadata.platform) {
        // Platform is already in traits, no need to duplicate
    }
    if (orb.metadata.objective) {
        // Objective is already in traits, no need to duplicate
    }

    return lines.join('\n');
}

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate embedding using NVIDIA NIM API
 * Falls back to simple hash-based embedding if API unavailable
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    // Try NVIDIA NIM embedding API first
    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generate-embedding',
                data: { text }
            }),
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.embedding) {
                return result.data.embedding;
            }
        }
    } catch (error) {
        console.warn('NVIDIA embedding API failed, using fallback:', error);
    }

    // Fallback: Simple hash-based embedding (deterministic, 384 dimensions)
    return generateFallbackEmbedding(text);
}

/**
 * Fallback embedding generation using character-based hashing
 * Creates a deterministic 384-dimensional vector from text
 */
function generateFallbackEmbedding(text: string): number[] {
    const dimensions = 384;
    const embedding = new Array(dimensions).fill(0);

    // Simple character-based embedding
    const chars = text.toLowerCase();
    for (let i = 0; i < chars.length; i++) {
        const charCode = chars.charCodeAt(i);
        const dimIndex = (charCode * (i + 1)) % dimensions;
        embedding[dimIndex] += Math.sin(charCode * (i + 1) * 0.1);
    }

    // Add n-gram features
    const words = text.toLowerCase().split(/[\n=\s]+/).filter(w => w.length > 0);
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let hash = 0;
        for (let j = 0; j < word.length; j++) {
            hash = ((hash << 5) - hash) + word.charCodeAt(j);
            hash = hash & hash; // Convert to 32-bit integer
        }
        const dimIndex = Math.abs(hash) % dimensions;
        embedding[dimIndex] += 1.0;

        // Bigram features
        if (i < words.length - 1) {
            const bigram = word + '_' + words[i + 1];
            let bigramHash = 0;
            for (let j = 0; j < bigram.length; j++) {
                bigramHash = ((bigramHash << 5) - bigramHash) + bigram.charCodeAt(j);
                bigramHash = bigramHash & bigramHash;
            }
            const bigramDim = Math.abs(bigramHash) % dimensions;
            embedding[bigramDim] += 0.5;
        }
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
        for (let i = 0; i < dimensions; i++) {
            embedding[i] /= magnitude;
        }
    }

    return embedding;
}

/**
 * Generate embedding for an AdOrb
 * Builds canonical text and generates vector embedding
 */
export async function generateOrbEmbedding(orb: AdOrb): Promise<AdOrb> {
    const canonicalText = buildCanonicalText(orb);
    const embedding = await generateEmbedding(canonicalText);

    return {
        ...orb,
        canonicalText,
        embedding,
    };
}

/**
 * Batch generate embeddings for multiple orbs
 * Processes in parallel with rate limiting
 */
export async function generateOrbEmbeddingsBatch(
    orbs: AdOrb[],
    batchSize: number = 5
): Promise<AdOrb[]> {
    const results: AdOrb[] = [];

    for (let i = 0; i < orbs.length; i += batchSize) {
        const batch = orbs.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(orb => generateOrbEmbedding(orb))
        );
        results.push(...batchResults);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < orbs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}
