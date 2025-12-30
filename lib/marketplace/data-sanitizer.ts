/**
 * Marketplace Data Sanitizer
 * 
 * Ensures only safe, privacy-preserving data is shared through the marketplace.
 * NEVER shares: raw ads, embeddings, user identifiers, per-user metrics.
 * ONLY allows: aggregated trait statistics with confidence scores.
 */

import { SAFETY_CONFIG } from '../rag/safety-config';

// ============================================
// TYPES
// ============================================

/**
 * The ONLY allowed format for marketplace shared data
 * This is the maximum granularity permitted
 */
export interface SanitizedMarketplaceData {
    /** Trait being analyzed (e.g., "subtitles", "ugc") */
    trait: string;
    /** Context for the trait (e.g., "tiktok", "conversions") */
    context: string;
    /** Average lift percentage (clamped to safe range) */
    avgLift: number;
    /** Confidence score (0-100) */
    confidence: number;
    /** Sample size (minimum required for significance) */
    sampleSize: number;
    /** When this data was generated */
    generatedAt: string;
}

/**
 * Dataset for marketplace exchange
 */
export interface MarketplaceDataset {
    /** Unique dataset identifier (NOT user identifier) */
    id: string;
    /** Dataset name */
    name: string;
    /** Dataset description */
    description: string;
    /** Number of trait signals in dataset */
    signalCount: number;
    /** Average confidence across signals */
    avgConfidence: number;
    /** Sanitized trait data */
    data: SanitizedMarketplaceData[];
    /** When dataset was created */
    createdAt: string;
}

// ============================================
// BLOCKED FIELDS (NEVER SHARE)
// ============================================

const BLOCKED_FIELDS = new Set([
    // Raw content
    'rawAd',
    'adContent',
    'mediaUrl',
    'thumbnailUrl',
    'videoUrl',
    'imageUrl',
    'script',
    'copy',
    'headline',

    // Embeddings
    'embedding',
    'vector',
    'embeddings',
    'canonicalText',

    // User/Advertiser identifiers
    'userId',
    'user_id',
    'advertiserId',
    'advertiser_id',
    'accountId',
    'account_id',
    'email',
    'name',
    'fbAdId',
    'adId',
    'campaignId',
    'adSetId',

    // Per-user metrics
    'adSpend',
    'revenue',
    'profit',
    'roi',
    'budget',
    'dailySpend',

    // Sensitive metadata
    'ip',
    'userAgent',
    'location',
    'geo',
    'audience',
    'targeting',
]);

// ============================================
// SANITIZATION FUNCTIONS
// ============================================

/**
 * Check if a field name is blocked from sharing
 */
export function isBlockedField(fieldName: string): boolean {
    const normalized = fieldName.toLowerCase();
    return BLOCKED_FIELDS.has(normalized) ||
        BLOCKED_FIELDS.has(fieldName) ||
        normalized.includes('password') ||
        normalized.includes('token') ||
        normalized.includes('secret') ||
        normalized.includes('key');
}

/**
 * Sanitize a trait effect for marketplace sharing
 * Returns null if data cannot be safely shared
 */
export function sanitizeTraitEffect(traitEffect: {
    trait: string;
    lift: number;
    confidence: number;
    n_with: number;
    n_without: number;
}, context: string): SanitizedMarketplaceData | null {
    // Validate required fields
    if (!traitEffect.trait || typeof traitEffect.trait !== 'string') {
        return null;
    }

    // Check minimum sample size
    const sampleSize = (traitEffect.n_with || 0) + (traitEffect.n_without || 0);
    if (sampleSize < SAFETY_CONFIG.minSampleSizePerGroup * 2) {
        return null; // Not enough data to share
    }

    // Check confidence threshold
    if ((traitEffect.confidence || 0) < SAFETY_CONFIG.minConfidenceForRecommendation) {
        return null; // Not confident enough to share
    }

    // Clamp lift to safe range
    const clampedLift = Math.max(
        -SAFETY_CONFIG.maxAbsoluteLift,
        Math.min(SAFETY_CONFIG.maxAbsoluteLift, traitEffect.lift || 0)
    );

    return {
        trait: traitEffect.trait,
        context: context || 'general',
        avgLift: Math.round(clampedLift * 10) / 10,
        confidence: Math.round(Math.min(100, Math.max(0, traitEffect.confidence || 0))),
        sampleSize,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Sanitize an object by removing all blocked fields
 * Returns a clean copy safe for sharing
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const sanitized: Partial<T> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (isBlockedField(key)) {
            continue; // Skip blocked fields
        }

        if (value === null || value === undefined) {
            continue; // Skip null/undefined
        }

        if (typeof value === 'object' && !Array.isArray(value)) {
            // Recursively sanitize nested objects
            sanitized[key as keyof T] = sanitizeObject(value as Record<string, unknown>) as T[keyof T];
        } else if (Array.isArray(value)) {
            // Check if array contains embeddings (number arrays)
            if (value.length > 0 && typeof value[0] === 'number' && value.length > 10) {
                continue; // Skip potential embedding vectors
            }
            sanitized[key as keyof T] = value as T[keyof T];
        } else {
            sanitized[key as keyof T] = value as T[keyof T];
        }
    }

    return sanitized;
}

/**
 * Validate that a marketplace dataset conforms to safe sharing rules
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateMarketplaceDataset(dataset: unknown): { valid: boolean; reason?: string } {
    if (!dataset || typeof dataset !== 'object') {
        return { valid: false, reason: 'Invalid dataset format' };
    }

    const ds = dataset as Record<string, unknown>;

    // Check for blocked fields at top level
    for (const key of Object.keys(ds)) {
        if (isBlockedField(key)) {
            return { valid: false, reason: `Blocked field detected: ${key}` };
        }
    }

    // Validate data array
    if (!Array.isArray(ds.data)) {
        return { valid: false, reason: 'Dataset must have data array' };
    }

    // Validate each data point
    for (const item of ds.data) {
        if (!item || typeof item !== 'object') {
            return { valid: false, reason: 'Invalid data item format' };
        }

        const dataItem = item as Record<string, unknown>;

        // Check for blocked fields in data items
        for (const key of Object.keys(dataItem)) {
            if (isBlockedField(key)) {
                return { valid: false, reason: `Blocked field in data: ${key}` };
            }
        }

        // Check required fields
        if (!dataItem.trait || !dataItem.sampleSize) {
            return { valid: false, reason: 'Data items must have trait and sampleSize' };
        }

        // Verify sample size meets minimum
        if (typeof dataItem.sampleSize === 'number' &&
            dataItem.sampleSize < SAFETY_CONFIG.minSampleSizePerGroup * 2) {
            return { valid: false, reason: 'Sample size below minimum threshold' };
        }
    }

    return { valid: true };
}

/**
 * Create a safe marketplace dataset from trait effects
 */
export function createMarketplaceDataset(
    name: string,
    description: string,
    traitEffects: Array<{
        trait: string;
        lift: number;
        confidence: number;
        n_with: number;
        n_without: number;
    }>,
    context: string
): MarketplaceDataset | null {
    const sanitizedData: SanitizedMarketplaceData[] = [];

    for (const effect of traitEffects) {
        const sanitized = sanitizeTraitEffect(effect, context);
        if (sanitized) {
            sanitizedData.push(sanitized);
        }
    }

    if (sanitizedData.length === 0) {
        return null; // No valid data to share
    }

    const avgConfidence = sanitizedData.reduce((sum, d) => sum + d.confidence, 0) / sanitizedData.length;

    return {
        id: `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        signalCount: sanitizedData.length,
        avgConfidence: Math.round(avgConfidence),
        data: sanitizedData,
        createdAt: new Date().toISOString(),
    };
}
