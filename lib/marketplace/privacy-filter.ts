/**
 * Marketplace Privacy Filter
 * 
 * Enforces privacy rules for all marketplace operations.
 * Validates suggestions, requires explicit opt-in, prevents auto-enrollment.
 */

import { SAFETY_CONFIG } from '../rag/safety-config';
import { SanitizedMarketplaceData, MarketplaceDataset, validateMarketplaceDataset } from './data-sanitizer';

// ============================================
// TYPES
// ============================================

export interface DataGap {
    trait: string;
    context: string;
    currentSampleSize: number;
    currentConfidence: number;
    requiredSampleSize: number;
}

export interface MarketplaceSuggestion {
    dataset: MarketplaceDataset;
    relevantTraits: string[];
    estimatedConfidenceGain: number;
    gapsFilled: DataGap[];
    requiresOptIn: true; // Always true - never auto-apply
}

export interface SuggestionValidation {
    valid: boolean;
    reason?: string;
    suggestion?: MarketplaceSuggestion;
}

// ============================================
// PRIVACY SETTINGS
// ============================================

const PRIVACY_STORAGE_KEY = 'marketplace_privacy_settings';

export interface PrivacySettings {
    /** User has explicitly opted in to receiving marketplace data */
    optedInToReceive: boolean;
    /** User has explicitly opted in to sharing data */
    optedInToShare: boolean;
    /** Timestamp of last opt-in confirmation */
    lastOptInConfirmation?: string;
    /** Categories user allows to share (empty = none) */
    allowedCategories: string[];
}

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
    optedInToReceive: false,
    optedInToShare: false,
    allowedCategories: [],
};

/**
 * Get current privacy settings
 */
export function getPrivacySettings(): PrivacySettings {
    if (typeof window === 'undefined' || !window.localStorage) {
        return DEFAULT_PRIVACY_SETTINGS;
    }

    try {
        const stored = localStorage.getItem(PRIVACY_STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(stored) };
        }
    } catch {
        // Ignore parse errors
    }

    return DEFAULT_PRIVACY_SETTINGS;
}

/**
 * Update privacy settings - requires explicit action
 */
export function updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        const current = getPrivacySettings();
        const updated = {
            ...current,
            ...settings,
            lastOptInConfirmation: new Date().toISOString(),
        };
        localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // Ignore storage errors
    }
}

// ============================================
// DATA GAP DETECTION
// ============================================

/**
 * Detect data gaps in current prediction capabilities
 */
export function detectDataGaps(
    currentTraitEffects: Array<{
        trait: string;
        confidence: number;
        n_with: number;
        n_without: number;
    }>,
    context: string
): DataGap[] {
    const gaps: DataGap[] = [];
    const minSampleSize = SAFETY_CONFIG.minSampleSizePerGroup * 2;

    for (const effect of currentTraitEffects) {
        const sampleSize = effect.n_with + effect.n_without;

        if (sampleSize < minSampleSize || effect.confidence < SAFETY_CONFIG.minConfidenceForRecommendation) {
            gaps.push({
                trait: effect.trait,
                context,
                currentSampleSize: sampleSize,
                currentConfidence: effect.confidence,
                requiredSampleSize: minSampleSize,
            });
        }
    }

    return gaps;
}

/**
 * Check if a dataset fills any data gaps
 */
export function datasetFillsGaps(dataset: MarketplaceDataset, gaps: DataGap[]): DataGap[] {
    const filledGaps: DataGap[] = [];
    const datasetTraits = new Set(dataset.data.map(d => d.trait.toLowerCase()));

    for (const gap of gaps) {
        if (datasetTraits.has(gap.trait.toLowerCase())) {
            filledGaps.push(gap);
        }
    }

    return filledGaps;
}

// ============================================
// SUGGESTION VALIDATION
// ============================================

/**
 * Validate a marketplace suggestion meets all safety requirements
 * 
 * Requirements:
 * 1. Dataset passes privacy validation
 * 2. Data gap actually exists
 * 3. Dataset reduces uncertainty
 * 4. Estimated confidence gain > threshold
 * 5. Requires explicit opt-in (never auto-apply)
 */
export function validateSuggestion(
    dataset: MarketplaceDataset,
    currentGaps: DataGap[],
    currentConfidence: number
): SuggestionValidation {
    // Step 1: Validate dataset privacy
    const privacyCheck = validateMarketplaceDataset(dataset);
    if (!privacyCheck.valid) {
        return { valid: false, reason: `Privacy violation: ${privacyCheck.reason}` };
    }

    // Step 2: Check user has opted in
    const settings = getPrivacySettings();
    if (!settings.optedInToReceive) {
        return { valid: false, reason: 'User has not opted in to receive marketplace data' };
    }

    // Step 3: Verify data gap exists
    if (currentGaps.length === 0) {
        return { valid: false, reason: 'No data gaps detected - dataset not needed' };
    }

    // Step 4: Check dataset fills gaps
    const filledGaps = datasetFillsGaps(dataset, currentGaps);
    if (filledGaps.length === 0) {
        return { valid: false, reason: 'Dataset does not address any current data gaps' };
    }

    // Step 5: Estimate confidence gain
    const avgDatasetConfidence = dataset.avgConfidence;
    const estimatedGain = Math.max(0, avgDatasetConfidence - currentConfidence) *
        (filledGaps.length / Math.max(1, currentGaps.length));

    if (estimatedGain < SAFETY_CONFIG.minConfidenceGainForSuggestion) {
        return {
            valid: false,
            reason: `Estimated confidence gain (${estimatedGain.toFixed(1)}%) below threshold (${SAFETY_CONFIG.minConfidenceGainForSuggestion}%)`
        };
    }

    // All checks passed - create suggestion
    return {
        valid: true,
        suggestion: {
            dataset,
            relevantTraits: filledGaps.map(g => g.trait),
            estimatedConfidenceGain: Math.round(estimatedGain * 10) / 10,
            gapsFilled: filledGaps,
            requiresOptIn: true, // ALWAYS require opt-in
        },
    };
}

/**
 * Apply a marketplace dataset to local predictions
 * REQUIRES explicit user confirmation
 */
export async function applyMarketplaceDataset(
    dataset: MarketplaceDataset,
    userConfirmed: boolean
): Promise<{ success: boolean; reason?: string }> {
    // CRITICAL: Never auto-apply
    if (!userConfirmed) {
        return {
            success: false,
            reason: 'Explicit user confirmation required to apply marketplace data'
        };
    }

    // Verify privacy settings
    const settings = getPrivacySettings();
    if (!settings.optedInToReceive) {
        return { success: false, reason: 'User has not opted in to receive marketplace data' };
    }

    // Validate dataset one more time
    const validation = validateMarketplaceDataset(dataset);
    if (!validation.valid) {
        return { success: false, reason: validation.reason };
    }

    // Apply dataset (placeholder - actual implementation depends on prediction system)
    // This would typically blend the marketplace data with local predictions
    console.log(`[Marketplace] Applied dataset ${dataset.id} with ${dataset.signalCount} signals`);

    return { success: true };
}

/**
 * Get available marketplace suggestions for current data gaps
 */
export async function getMarketplaceSuggestions(
    currentGaps: DataGap[],
    currentConfidence: number,
    availableDatasets: MarketplaceDataset[]
): Promise<MarketplaceSuggestion[]> {
    const suggestions: MarketplaceSuggestion[] = [];
    const settings = getPrivacySettings();

    // No suggestions if not opted in
    if (!settings.optedInToReceive) {
        return [];
    }

    // No suggestions if no gaps
    if (currentGaps.length === 0) {
        return [];
    }

    // Validate each dataset and collect valid suggestions
    for (const dataset of availableDatasets) {
        const validation = validateSuggestion(dataset, currentGaps, currentConfidence);
        if (validation.valid && validation.suggestion) {
            suggestions.push(validation.suggestion);
        }
    }

    // Sort by confidence gain and limit
    return suggestions
        .sort((a, b) => b.estimatedConfidenceGain - a.estimatedConfidenceGain)
        .slice(0, SAFETY_CONFIG.maxDatasetSuggestions);
}
