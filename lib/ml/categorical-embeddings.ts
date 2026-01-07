/**
 * Categorical Embeddings Module
 * 
 * Replaces manual encoding maps with learnable embedding layers.
 * Uses TensorFlow.js embedding layers for categorical features,
 * providing better representation learning than fixed encodings.
 * 
 * @module lib/ml/categorical-embeddings
 */

import * as tf from '@tensorflow/tfjs';
import type {
    HookType,
    EditingStyle,
    ContentCategory,
    ColorScheme,
    MusicType,
    Platform,
    DayOfWeek,
    TimeOfDay,
} from '@/types';

// ============================================
// TYPES
// ============================================

export interface EmbeddingConfig {
    vocabularySize: number;
    embeddingDim: number;
    name: string;
}

export interface CategoricalEmbeddings {
    hookType: tf.Tensor2D;
    editingStyle: tf.Tensor2D;
    contentCategory: tf.Tensor2D;
    colorScheme: tf.Tensor2D;
    musicType: tf.Tensor2D;
    platform: tf.Tensor2D;
    dayOfWeek: tf.Tensor2D;
    timeOfDay: tf.Tensor2D;
}

export interface EmbeddingResult {
    embeddings: number[];
    featureNames: string[];
    totalDim: number;
}

// ============================================
// VOCABULARY DEFINITIONS
// ============================================

const HOOK_TYPES: HookType[] = [
    'curiosity', 'shock', 'question', 'story', 'statistic',
    'controversy', 'transformation', 'before_after', 'problem_solution',
    'testimonial', 'unboxing', 'challenge', 'other'
];

const EDITING_STYLES: EditingStyle[] = [
    'fast_cuts', 'cinematic', 'raw_authentic', 'animated',
    'mixed_media', 'minimal', 'dynamic', 'slow_motion', 'other'
];

const CONTENT_CATEGORIES: ContentCategory[] = [
    'product_demo', 'lifestyle', 'testimonial', 'educational',
    'entertainment', 'behind_the_scenes', 'comparison', 'tutorial',
    'ugc', 'influencer', 'brand_story', 'other'
];

const COLOR_SCHEMES: ColorScheme[] = [
    'vibrant', 'muted', 'monochrome', 'warm', 'cool',
    'pastel', 'dark', 'neon', 'natural', 'other'
];

const MUSIC_TYPES: MusicType[] = [
    'trending', 'original', 'voiceover_only', 'no_music',
    'licensed', 'cinematic', 'upbeat', 'emotional', 'other'
];

const PLATFORMS: Platform[] = [
    'facebook', 'instagram', 'tiktok', 'youtube',
    'linkedin', 'snapchat', 'pinterest', 'twitter', 'other'
];

const DAYS_OF_WEEK: DayOfWeek[] = [
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday'
];

const TIMES_OF_DAY: TimeOfDay[] = [
    'early_morning', 'morning', 'afternoon', 'evening', 'night'
];

// ============================================
// EMBEDDING CONFIGURATIONS
// ============================================

const EMBEDDING_CONFIGS: Record<string, EmbeddingConfig> = {
    hookType: { vocabularySize: HOOK_TYPES.length + 1, embeddingDim: 4, name: 'hook_embedding' },
    editingStyle: { vocabularySize: EDITING_STYLES.length + 1, embeddingDim: 3, name: 'editing_embedding' },
    contentCategory: { vocabularySize: CONTENT_CATEGORIES.length + 1, embeddingDim: 4, name: 'content_embedding' },
    colorScheme: { vocabularySize: COLOR_SCHEMES.length + 1, embeddingDim: 3, name: 'color_embedding' },
    musicType: { vocabularySize: MUSIC_TYPES.length + 1, embeddingDim: 3, name: 'music_embedding' },
    platform: { vocabularySize: PLATFORMS.length + 1, embeddingDim: 4, name: 'platform_embedding' },
    dayOfWeek: { vocabularySize: DAYS_OF_WEEK.length + 1, embeddingDim: 2, name: 'day_embedding' },
    timeOfDay: { vocabularySize: TIMES_OF_DAY.length + 1, embeddingDim: 2, name: 'time_embedding' },
};

// Total embedding dimension: 4+3+4+3+3+4+2+2 = 25
const TOTAL_EMBEDDING_DIM = 25;

// ============================================
// INDEX LOOKUPS
// ============================================

function getHookTypeIndex(hookType: HookType): number {
    const idx = HOOK_TYPES.indexOf(hookType);
    return idx >= 0 ? idx : HOOK_TYPES.length; // Unknown = last index
}

function getEditingStyleIndex(style: EditingStyle): number {
    const idx = EDITING_STYLES.indexOf(style);
    return idx >= 0 ? idx : EDITING_STYLES.length;
}

function getContentCategoryIndex(category: ContentCategory): number {
    const idx = CONTENT_CATEGORIES.indexOf(category);
    return idx >= 0 ? idx : CONTENT_CATEGORIES.length;
}

function getColorSchemeIndex(scheme: ColorScheme): number {
    const idx = COLOR_SCHEMES.indexOf(scheme);
    return idx >= 0 ? idx : COLOR_SCHEMES.length;
}

function getMusicTypeIndex(musicType: MusicType): number {
    const idx = MUSIC_TYPES.indexOf(musicType);
    return idx >= 0 ? idx : MUSIC_TYPES.length;
}

function getPlatformIndex(platform: Platform): number {
    const idx = PLATFORMS.indexOf(platform);
    return idx >= 0 ? idx : PLATFORMS.length;
}

function getDayOfWeekIndex(day: DayOfWeek): number {
    const idx = DAYS_OF_WEEK.indexOf(day);
    return idx >= 0 ? idx : DAYS_OF_WEEK.length;
}

function getTimeOfDayIndex(time: TimeOfDay): number {
    const idx = TIMES_OF_DAY.indexOf(time);
    return idx >= 0 ? idx : TIMES_OF_DAY.length;
}

// ============================================
// EMBEDDING LAYERS
// ============================================

// Singleton storage for embedding weights
const embeddingWeights: Map<string, tf.Tensor2D> = new Map();
let isInitialized = false;

/**
 * Initialize embedding weights with Xavier/Glorot initialization
 */
export function initializeEmbeddings(): void {
    if (isInitialized) return;

    for (const [key, config] of Object.entries(EMBEDDING_CONFIGS)) {
        // Xavier initialization: sqrt(2 / (fan_in + fan_out))
        const scale = Math.sqrt(2 / (config.vocabularySize + config.embeddingDim));
        const weights = tf.randomNormal(
            [config.vocabularySize, config.embeddingDim],
            0,
            scale
        ) as tf.Tensor2D;
        embeddingWeights.set(key, weights);
    }

    isInitialized = true;
}

/**
 * Get embedding for a categorical value
 */
function lookupEmbedding(key: string, index: number): number[] {
    initializeEmbeddings();
    const weights = embeddingWeights.get(key);
    if (!weights) {
        console.warn(`No embedding weights found for ${key}`);
        return new Array(EMBEDDING_CONFIGS[key]?.embeddingDim || 3).fill(0);
    }

    // Slice the row for this index
    const embedding = weights.slice([index, 0], [1, -1]);
    const values = Array.from(embedding.dataSync());
    embedding.dispose();

    return values;
}

// ============================================
// MAIN EMBEDDING EXTRACTION
// ============================================

/**
 * Extract categorical embeddings for ad data
 * Returns a concatenated embedding vector
 */
export function extractCategoricalEmbeddings(
    hookType: HookType = 'other',
    editingStyle: EditingStyle = 'other',
    contentCategory: ContentCategory = 'other',
    colorScheme: ColorScheme = 'other',
    musicType: MusicType = 'other',
    platform: Platform = 'other',
    dayOfWeek: DayOfWeek = 'monday',
    timeOfDay: TimeOfDay = 'morning'
): EmbeddingResult {
    const embeddings: number[] = [];
    const featureNames: string[] = [];

    // Hook Type Embedding
    const hookEmbed = lookupEmbedding('hookType', getHookTypeIndex(hookType));
    embeddings.push(...hookEmbed);
    for (let i = 0; i < hookEmbed.length; i++) {
        featureNames.push(`hook_emb_${i}`);
    }

    // Editing Style Embedding
    const editEmbed = lookupEmbedding('editingStyle', getEditingStyleIndex(editingStyle));
    embeddings.push(...editEmbed);
    for (let i = 0; i < editEmbed.length; i++) {
        featureNames.push(`edit_emb_${i}`);
    }

    // Content Category Embedding
    const contentEmbed = lookupEmbedding('contentCategory', getContentCategoryIndex(contentCategory));
    embeddings.push(...contentEmbed);
    for (let i = 0; i < contentEmbed.length; i++) {
        featureNames.push(`content_emb_${i}`);
    }

    // Color Scheme Embedding
    const colorEmbed = lookupEmbedding('colorScheme', getColorSchemeIndex(colorScheme));
    embeddings.push(...colorEmbed);
    for (let i = 0; i < colorEmbed.length; i++) {
        featureNames.push(`color_emb_${i}`);
    }

    // Music Type Embedding
    const musicEmbed = lookupEmbedding('musicType', getMusicTypeIndex(musicType));
    embeddings.push(...musicEmbed);
    for (let i = 0; i < musicEmbed.length; i++) {
        featureNames.push(`music_emb_${i}`);
    }

    // Platform Embedding
    const platformEmbed = lookupEmbedding('platform', getPlatformIndex(platform));
    embeddings.push(...platformEmbed);
    for (let i = 0; i < platformEmbed.length; i++) {
        featureNames.push(`platform_emb_${i}`);
    }

    // Day of Week Embedding
    const dayEmbed = lookupEmbedding('dayOfWeek', getDayOfWeekIndex(dayOfWeek));
    embeddings.push(...dayEmbed);
    for (let i = 0; i < dayEmbed.length; i++) {
        featureNames.push(`day_emb_${i}`);
    }

    // Time of Day Embedding
    const timeEmbed = lookupEmbedding('timeOfDay', getTimeOfDayIndex(timeOfDay));
    embeddings.push(...timeEmbed);
    for (let i = 0; i < timeEmbed.length; i++) {
        featureNames.push(`time_emb_${i}`);
    }

    return {
        embeddings,
        featureNames,
        totalDim: TOTAL_EMBEDDING_DIM,
    };
}

// ============================================
// EMBEDDING PERSISTENCE
// ============================================

const EMBEDDINGS_STORAGE_KEY = 'ml_categorical_embeddings';

/**
 * Save embedding weights to localStorage
 */
export async function saveEmbeddings(): Promise<void> {
    if (typeof window === 'undefined') return;
    initializeEmbeddings();

    const serialized: Record<string, number[][]> = {};
    for (const [key, tensor] of embeddingWeights.entries()) {
        const data = await tensor.array();
        serialized[key] = data;
    }

    localStorage.setItem(EMBEDDINGS_STORAGE_KEY, JSON.stringify(serialized));
}

/**
 * Load embedding weights from localStorage
 */
export function loadEmbeddings(): boolean {
    if (typeof window === 'undefined') return false;

    const stored = localStorage.getItem(EMBEDDINGS_STORAGE_KEY);
    if (!stored) return false;

    try {
        const serialized = JSON.parse(stored) as Record<string, number[][]>;

        // Dispose existing tensors
        for (const tensor of embeddingWeights.values()) {
            tensor.dispose();
        }
        embeddingWeights.clear();

        // Create new tensors from stored data
        for (const [key, data] of Object.entries(serialized)) {
            embeddingWeights.set(key, tf.tensor2d(data));
        }

        isInitialized = true;
        return true;
    } catch (error) {
        console.warn('Failed to load embeddings:', error);
        return false;
    }
}

/**
 * Reset embeddings to random initialization
 */
export function resetEmbeddings(): void {
    // Dispose existing tensors
    for (const tensor of embeddingWeights.values()) {
        tensor.dispose();
    }
    embeddingWeights.clear();
    isInitialized = false;

    if (typeof window !== 'undefined') {
        localStorage.removeItem(EMBEDDINGS_STORAGE_KEY);
    }

    // Reinitialize
    initializeEmbeddings();
}

// ============================================
// EMBEDDING TRAINING (for future use)
// ============================================

/**
 * Get embedding layer for use in model
 * Returns a TensorFlow.js embedding layer that can be trained
 */
export function createEmbeddingLayer(
    featureKey: keyof typeof EMBEDDING_CONFIGS
): tf.layers.Layer {
    const config = EMBEDDING_CONFIGS[featureKey];
    return tf.layers.embedding({
        inputDim: config.vocabularySize,
        outputDim: config.embeddingDim,
        name: config.name,
        embeddingsInitializer: 'glorotNormal',
    });
}

/**
 * Get total embedding dimension for all categorical features
 */
export function getTotalEmbeddingDim(): number {
    return TOTAL_EMBEDDING_DIM;
}

/**
 * Get embedding configuration
 */
export function getEmbeddingConfigs(): Record<string, EmbeddingConfig> {
    return EMBEDDING_CONFIGS;
}

/**
 * Get vocabularies for all categorical features
 */
export function getVocabularies(): Record<string, string[]> {
    return {
        hookType: [...HOOK_TYPES],
        editingStyle: [...EDITING_STYLES],
        contentCategory: [...CONTENT_CATEGORIES],
        colorScheme: [...COLOR_SCHEMES],
        musicType: [...MUSIC_TYPES],
        platform: [...PLATFORMS],
        dayOfWeek: [...DAYS_OF_WEEK],
        timeOfDay: [...TIMES_OF_DAY],
    };
}
