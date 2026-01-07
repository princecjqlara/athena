/**
 * JSON Import Utility Module
 * 
 * Handles JSON data import for ad creatives with:
 * - Validation and parsing
 * - Duplicate detection
 * - 10x AI validation for reliability
 * - Data point counting
 * 
 * @module lib/json-import
 */

// ============================================
// TYPES
// ============================================

export interface AdJsonData {
    name: string;
    platform?: string;
    hookType?: string;
    editingStyle?: string;
    contentCategory?: string;
    categories?: string[];
    traits?: string[];
    // Performance data (optional)
    ctr?: number;
    cvr?: number;
    roas?: number;
    spend?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
}

export interface ValidationResult {
    valid: boolean;
    confidence: number;
    errors: string[];
    warnings: string[];
    checksCompleted: number;
    checksPassed: number;
}

export interface DuplicateCheckResult {
    hasDuplicates: boolean;
    duplicateCount: number;
    duplicates: Array<{
        inputIndex: number;
        inputName: string;
        existingId: string;
        existingName: string;
        matchType: 'exact_name' | 'similar_traits' | 'same_signature';
    }>;
    uniqueAds: AdJsonData[];
}

export interface ImportSummary {
    totalInput: number;
    valid: number;
    invalid: number;
    duplicates: number;
    toBeAdded: number;
    existingCount: number;
    newTotal: number;
}

// ============================================
// VALIDATION
// ============================================

const VALID_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'other'];
const VALID_HOOK_TYPES = ['curiosity', 'problem-solution', 'social-proof', 'urgency', 'benefit-led', 'story', 'question', 'shock', 'educational', 'emotional'];
const VALID_EDITING_STYLES = ['fast-paced', 'slow-burn', 'documentary', 'testimonial', 'product-demo', 'lifestyle', 'ugc', 'professional', 'animated'];

/**
 * Parse and validate JSON input
 */
export function parseAdJson(jsonString: string): {
    success: boolean;
    data: AdJsonData[];
    errors: string[];
} {
    try {
        const parsed = JSON.parse(jsonString);

        // Handle single object
        const dataArray = Array.isArray(parsed) ? parsed : [parsed];

        const errors: string[] = [];
        const validData: AdJsonData[] = [];

        dataArray.forEach((item, index) => {
            const itemErrors = validateAdItem(item, index);
            if (itemErrors.length === 0) {
                validData.push(normalizeAdData(item));
            } else {
                errors.push(...itemErrors);
            }
        });

        return {
            success: errors.length === 0,
            data: validData,
            errors,
        };
    } catch (e) {
        return {
            success: false,
            data: [],
            errors: [`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`],
        };
    }
}

/**
 * Validate a single ad item
 */
function validateAdItem(item: unknown, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Item ${index + 1}`;

    if (!item || typeof item !== 'object') {
        return [`${prefix}: Must be an object`];
    }

    const ad = item as Record<string, unknown>;

    // Required: name
    if (!ad.name || typeof ad.name !== 'string' || ad.name.trim() === '') {
        errors.push(`${prefix}: Missing or invalid 'name' field`);
    }

    // Optional validations
    if (ad.platform && !VALID_PLATFORMS.includes(String(ad.platform).toLowerCase())) {
        errors.push(`${prefix}: Invalid platform '${ad.platform}'`);
    }

    if (ad.hookType && !VALID_HOOK_TYPES.includes(String(ad.hookType).toLowerCase())) {
        errors.push(`${prefix}: Invalid hookType '${ad.hookType}'`);
    }

    if (ad.categories && !Array.isArray(ad.categories)) {
        errors.push(`${prefix}: 'categories' must be an array`);
    }

    if (ad.traits && !Array.isArray(ad.traits)) {
        errors.push(`${prefix}: 'traits' must be an array`);
    }

    // Numeric validations
    ['ctr', 'cvr', 'roas', 'spend', 'impressions', 'clicks', 'conversions'].forEach(field => {
        if (ad[field] !== undefined && (typeof ad[field] !== 'number' || isNaN(ad[field] as number))) {
            errors.push(`${prefix}: '${field}' must be a number`);
        }
    });

    return errors;
}

/**
 * Normalize ad data to consistent format
 */
function normalizeAdData(item: Record<string, unknown>): AdJsonData {
    return {
        name: String(item.name).trim(),
        platform: item.platform ? String(item.platform).toLowerCase() : undefined,
        hookType: item.hookType ? String(item.hookType).toLowerCase() : undefined,
        editingStyle: item.editingStyle ? String(item.editingStyle).toLowerCase() : undefined,
        contentCategory: item.contentCategory ? String(item.contentCategory) : undefined,
        categories: Array.isArray(item.categories) ? item.categories.map(String) : [],
        traits: Array.isArray(item.traits) ? item.traits.map(String) : [],
        ctr: typeof item.ctr === 'number' ? item.ctr : undefined,
        cvr: typeof item.cvr === 'number' ? item.cvr : undefined,
        roas: typeof item.roas === 'number' ? item.roas : undefined,
        spend: typeof item.spend === 'number' ? item.spend : undefined,
        impressions: typeof item.impressions === 'number' ? item.impressions : undefined,
        clicks: typeof item.clicks === 'number' ? item.clicks : undefined,
        conversions: typeof item.conversions === 'number' ? item.conversions : undefined,
    };
}

// ============================================
// DUPLICATE DETECTION
// ============================================

interface ExistingAd {
    id: string;
    name?: string;
    platform?: string;
    hookType?: string;
    categories?: string[];
    traits?: string[];
}

/**
 * Detect duplicates in import data vs existing ads
 */
export function detectDuplicates(
    inputData: AdJsonData[],
    existingAds: ExistingAd[]
): DuplicateCheckResult {
    const duplicates: DuplicateCheckResult['duplicates'] = [];
    const uniqueAds: AdJsonData[] = [];

    inputData.forEach((input, index) => {
        const duplicate = findDuplicate(input, existingAds);

        if (duplicate) {
            duplicates.push({
                inputIndex: index,
                inputName: input.name,
                existingId: duplicate.id,
                existingName: duplicate.name || 'Unnamed',
                matchType: duplicate.matchType,
            });
        } else {
            uniqueAds.push(input);
        }
    });

    return {
        hasDuplicates: duplicates.length > 0,
        duplicateCount: duplicates.length,
        duplicates,
        uniqueAds,
    };
}

/**
 * Find if input matches any existing ad
 */
function findDuplicate(
    input: AdJsonData,
    existingAds: ExistingAd[]
): { id: string; name?: string; matchType: 'exact_name' | 'similar_traits' | 'same_signature' } | null {
    for (const existing of existingAds) {
        // Check exact name match
        if (existing.name && input.name.toLowerCase() === existing.name.toLowerCase()) {
            return { id: existing.id, name: existing.name, matchType: 'exact_name' };
        }

        // Check same signature (platform + hook + category)
        // Note: We check if input.contentCategory exists in existing.categories array
        // since contentCategory is a single string while categories is an array
        if (
            existing.platform && existing.hookType &&
            input.platform === existing.platform &&
            input.hookType === existing.hookType &&
            input.contentCategory &&
            existing.categories?.includes(input.contentCategory)
        ) {
            return { id: existing.id, name: existing.name, matchType: 'same_signature' };
        }

        // Check similar traits (>80% overlap of the smaller set)
        // This means at least 80% of the traits in the smaller set must exist in the larger set
        const inputTraits = new Set([...(input.categories || []), ...(input.traits || [])]);
        const existingTraits = new Set([...(existing.categories || []), ...(existing.traits || [])]);

        if (inputTraits.size > 0 && existingTraits.size > 0) {
            const overlap = [...inputTraits].filter(t => existingTraits.has(t)).length;
            // Use min to check if 80% of the smaller set overlaps
            const similarity = overlap / Math.min(inputTraits.size, existingTraits.size);

            if (similarity >= 0.8) {
                return { id: existing.id, name: existing.name, matchType: 'similar_traits' };
            }
        }
    }

    return null;
}

// ============================================
// AI VALIDATION (10x CHECKS)
// ============================================

/**
 * Run 10x AI validation checks for reliability
 * Uses majority vote (≥6/10) to determine validity
 */
export async function validateWithAI(
    data: AdJsonData[],
    apiEndpoint: string = '/api/ai'
): Promise<ValidationResult> {
    const NUM_CHECKS = 10;
    const MAJORITY_THRESHOLD = 6;

    try {
        // Run 10 parallel validation calls
        const checkPromises = Array(NUM_CHECKS).fill(null).map(async (_, i) => {
            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'validate_json_import',
                        data,
                        checkIndex: i,
                    }),
                });

                if (!response.ok) {
                    return { valid: false, errors: ['API error'] };
                }

                const result = await response.json();
                return {
                    valid: result.valid === true,
                    errors: result.errors || [],
                };
            } catch {
                return { valid: false, errors: ['Network error'] };
            }
        });

        const results = await Promise.all(checkPromises);

        // Count valid checks
        const passedChecks = results.filter(r => r.valid).length;
        const allErrors = results.flatMap(r => r.errors);
        const uniqueErrors = [...new Set(allErrors)];

        // Majority vote
        const isValid = passedChecks >= MAJORITY_THRESHOLD;
        const confidence = passedChecks / NUM_CHECKS;

        return {
            valid: isValid,
            confidence,
            errors: isValid ? [] : uniqueErrors.slice(0, 5),
            warnings: uniqueErrors.length > 5 ? [`And ${uniqueErrors.length - 5} more issues...`] : [],
            checksCompleted: NUM_CHECKS,
            checksPassed: passedChecks,
        };
    } catch (error) {
        return {
            valid: false,
            confidence: 0,
            errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            warnings: [],
            checksCompleted: 0,
            checksPassed: 0,
        };
    }
}

/**
 * Quick local validation (no AI) for immediate feedback
 */
export function quickValidate(data: AdJsonData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.length === 0) {
        errors.push('No valid data to import');
    }

    data.forEach((item, i) => {
        if (!item.name) errors.push(`Item ${i + 1}: Missing name`);
        if (!item.platform) warnings.push(`Item ${i + 1}: No platform specified`);
        if (!item.hookType) warnings.push(`Item ${i + 1}: No hook type specified`);
    });

    return {
        valid: errors.length === 0,
        confidence: errors.length === 0 ? 1 : 0,
        errors,
        warnings,
        checksCompleted: 1,
        checksPassed: errors.length === 0 ? 1 : 0,
    };
}

// ============================================
// DATA COUNTING
// ============================================

/**
 * Count total data points in storage
 */
export function countDataPoints(storageKey: string = 'ads'): number {
    if (typeof window === 'undefined') return 0;

    try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return 0;

        const data = JSON.parse(stored);
        return Array.isArray(data) ? data.length : 0;
    } catch {
        return 0;
    }
}

/**
 * Generate import summary
 */
export function generateImportSummary(
    inputData: AdJsonData[],
    validData: AdJsonData[],
    duplicateResult: DuplicateCheckResult,
    existingCount: number
): ImportSummary {
    return {
        totalInput: inputData.length,
        valid: validData.length,
        invalid: inputData.length - validData.length,
        duplicates: duplicateResult.duplicateCount,
        toBeAdded: duplicateResult.uniqueAds.length,
        existingCount,
        newTotal: existingCount + duplicateResult.uniqueAds.length,
    };
}

// ============================================
// EXPORT FORMAT EXAMPLES
// ============================================

export const JSON_EXAMPLE = `[
  {
    "name": "UGC Testimonial - Sarah v2",
    "platform": "facebook",
    "hookType": "social-proof",
    "editingStyle": "testimonial",
    "categories": ["beauty"],
    "traits": ["ugc-style", "selfie-camera", "trending-music"],
    "ctr": 3.2,
    "spend": 250
  },
  {
    "name": "Before-After Demo 15s",
    "platform": "tiktok",
    "hookType": "curiosity",
    "editingStyle": "fast-paced",
    "categories": ["skincare"],
    "traits": ["before-after", "text-overlays"]
  }
]`;
