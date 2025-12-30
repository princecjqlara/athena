// Weight Adjustment System
// Adjusts feature weights based on prediction errors
//
// ⚠️ ADVISORY SYSTEM - Weight learning in FALLBACK_ONLY mode by default
// Part of the unified pipeline simplification.
// Weights are used only when RAG similarity fails.
// Set mode to 'active' to enable continuous learning.

import { FeatureWeight, WeightAdjustmentEvent, PredictionRecord, ExtractedAdData } from '@/types';

const WEIGHTS_KEY = 'ml_feature_weights';
const ADJUSTMENTS_KEY = 'ml_weight_adjustments';
const WEIGHT_MODE_KEY = 'ml_weight_mode';

// Flag to prevent circular imports - recalculation import is dynamic
let recalculationEnabled = true;

// ============================================
// WEIGHT MODE CONFIGURATION
// ============================================

/**
 * Weight adjustment modes:
 * - 'active': Continuously update weights from prediction errors (legacy behavior)
 * - 'fallback_only': Log adjustments but don't apply (default for simplification)
 * - 'frozen': No adjustments at all
 */
export type WeightMode = 'active' | 'fallback_only' | 'frozen';

/**
 * Get current weight mode (default: fallback_only)
 */
export function getWeightMode(): WeightMode {
    if (typeof window === 'undefined') return 'fallback_only';
    const stored = localStorage.getItem(WEIGHT_MODE_KEY) as WeightMode | null;
    return stored || 'fallback_only'; // Default: fallback_only (was implicitly 'active')
}

/**
 * Set weight mode
 */
export function setWeightMode(mode: WeightMode): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WEIGHT_MODE_KEY, mode);
    console.log(`[WEIGHTS] Mode set to: ${mode}`);
}

// Default feature weights
const DEFAULT_WEIGHTS: FeatureWeight[] = [
    // Hook Types
    { feature: 'curiosity', category: 'hook_type', weight: 0.8, confidenceLevel: 50, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
    { feature: 'shock', category: 'hook_type', weight: 0.7, confidenceLevel: 50, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
    { feature: 'question', category: 'hook_type', weight: 0.6, confidenceLevel: 50, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },

    // Content Style
    { feature: 'ugc_style', category: 'content', weight: 0.9, confidenceLevel: 50, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
    { feature: 'professional', category: 'content', weight: 0.5, confidenceLevel: 50, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },

    // Visual Elements
    { feature: 'subtitles', category: 'visual', weight: 0.7, confidenceLevel: 70, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'rising', trendStrength: 30 },
    { feature: 'shaky_camera', category: 'visual', weight: -0.3, confidenceLevel: 40, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
    { feature: 'fast_cuts', category: 'visual', weight: 0.6, confidenceLevel: 60, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },

    // Audio
    { feature: 'trending_audio', category: 'audio', weight: 0.8, confidenceLevel: 70, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'rising', trendStrength: 50 },
    { feature: 'voiceover', category: 'audio', weight: 0.5, confidenceLevel: 60, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },

    // Platform
    { feature: 'tiktok', category: 'platform', weight: 0.7, confidenceLevel: 70, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
    { feature: 'instagram_reels', category: 'platform', weight: 0.65, confidenceLevel: 65, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
];

// Get current weights
export function getFeatureWeights(): FeatureWeight[] {
    if (typeof window === 'undefined') return DEFAULT_WEIGHTS;
    const stored = localStorage.getItem(WEIGHTS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_WEIGHTS;
}

// Save weights
function saveFeatureWeights(weights: FeatureWeight[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}

// Get weight for a specific feature
export function getWeight(feature: string): number {
    const weights = getFeatureWeights();
    const w = weights.find(w => w.feature === feature);
    return w ? w.weight : 0;
}

// Calculate score based on ad features and current weights
export function calculateWeightedScore(adData: ExtractedAdData): number {
    const weights = getFeatureWeights();
    let score = 50; // Base score
    let totalWeight = 0;

    // Apply weights based on ad characteristics
    const applyWeight = (feature: string, isPresent: boolean) => {
        const w = weights.find(wt => wt.feature === feature);
        if (w && isPresent) {
            score += w.weight * 10;
            totalWeight += Math.abs(w.weight);
        }
    };

    // Hook type
    applyWeight(adData.hookType, true);

    // Content style
    applyWeight('ugc_style', adData.isUGCStyle);

    // Visual elements
    applyWeight('subtitles', adData.hasSubtitles);
    applyWeight('fast_cuts', adData.editingStyle === 'fast_cuts');

    // Audio
    applyWeight('trending_audio', adData.musicType === 'trending');
    applyWeight('voiceover', adData.hasVoiceover);

    // Platform
    applyWeight(adData.platform, true);

    // Normalize score to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}

// Adjust weights based on prediction error
// ⚠️ RESPECTS WEIGHT MODE - in 'frozen' or 'fallback_only' mode, adjustments are logged but not applied
export function adjustWeightsForError(
    prediction: PredictionRecord,
    adData: ExtractedAdData,
    actualScore: number
): WeightAdjustmentEvent {
    const mode = getWeightMode();

    // Guard: check weight mode
    if (mode === 'frozen') {
        console.log('[WEIGHTS] Frozen mode - no adjustments allowed');
        return {
            id: `adj-${Date.now()}-frozen`,
            timestamp: new Date().toISOString(),
            triggeredBy: prediction.id,
            adjustments: [],
            validatedImprovement: false,
        };
    }

    const weights = getFeatureWeights();
    const adjustments: WeightAdjustmentEvent['adjustments'] = [];

    const delta = actualScore - prediction.predictedScore;
    const learningRate = 0.1; // How much to adjust

    // Determine which features to adjust
    const featuresPresent: string[] = [];

    featuresPresent.push(adData.hookType);
    if (adData.isUGCStyle) featuresPresent.push('ugc_style');
    if (adData.hasSubtitles) featuresPresent.push('subtitles');
    if (adData.editingStyle === 'fast_cuts') featuresPresent.push('fast_cuts');
    if (adData.musicType === 'trending') featuresPresent.push('trending_audio');
    if (adData.hasVoiceover) featuresPresent.push('voiceover');
    featuresPresent.push(adData.platform);

    // Adjust weights for features present in the ad
    featuresPresent.forEach(feature => {
        const weightIndex = weights.findIndex(w => w.feature === feature);
        if (weightIndex !== -1) {
            const oldWeight = weights[weightIndex].weight;

            // If surprise success (predicted low, actual high) → increase weight
            // If surprise failure (predicted high, actual low) → decrease weight
            const adjustment = (delta / 100) * learningRate;
            const newWeight = Math.max(-1, Math.min(1, oldWeight + adjustment));

            if (Math.abs(newWeight - oldWeight) > 0.01) {
                weights[weightIndex].previousWeight = oldWeight;
                weights[weightIndex].weight = newWeight;
                weights[weightIndex].lastUpdated = new Date().toISOString();
                weights[weightIndex].sampleSize += 1;
                weights[weightIndex].confidenceLevel = Math.min(100, weights[weightIndex].confidenceLevel + 2);

                // Update trend
                if (newWeight > oldWeight) {
                    weights[weightIndex].trend = 'rising';
                    weights[weightIndex].trendStrength = Math.min(100, (weights[weightIndex].trendStrength || 0) + 10);
                } else {
                    weights[weightIndex].trend = 'falling';
                    weights[weightIndex].trendStrength = Math.min(100, (weights[weightIndex].trendStrength || 0) + 10);
                }

                adjustments.push({
                    feature,
                    oldWeight,
                    newWeight,
                    reason: delta > 0
                        ? `Surprise success: increased weight by ${(adjustment * 100).toFixed(1)}%`
                        : `Surprise failure: decreased weight by ${(adjustment * 100).toFixed(1)}%`,
                });
            }
        }
    });

    // Save updated weights
    saveFeatureWeights(weights);

    // Trigger score recalculation for all ads
    if (recalculationEnabled && adjustments.length > 0) {
        // Dynamic import to avoid circular dependency
        import('./score-recalculation').then(({ triggerRecalculationOnWeightChange }) => {
            triggerRecalculationOnWeightChange();
        }).catch(err => {
            console.warn('[WEIGHT ADJUST] Could not trigger recalculation:', err);
        });
    }

    // Create adjustment event
    const event: WeightAdjustmentEvent = {
        id: `adj-${Date.now()}`,
        timestamp: new Date().toISOString(),
        triggeredBy: prediction.id,
        adjustments,
        validatedImprovement: false,
    };

    // Save adjustment event
    saveAdjustmentEvent(event);

    return event;
}

// Add a new weight for discovered feature
export function addNewWeight(
    feature: string,
    category: string,
    initialWeight: number = 0.5
): FeatureWeight {
    const weights = getFeatureWeights();

    // Check if already exists
    const existing = weights.find(w => w.feature === feature);
    if (existing) return existing;

    const newWeight: FeatureWeight = {
        feature,
        category,
        weight: initialWeight,
        confidenceLevel: 20, // Low confidence for new features
        sampleSize: 1,
        lastUpdated: new Date().toISOString(),
        trend: 'stable',
        trendStrength: 0,
    };

    weights.push(newWeight);
    saveFeatureWeights(weights);

    return newWeight;
}

// Get adjustment history
function saveAdjustmentEvent(event: WeightAdjustmentEvent): void {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(ADJUSTMENTS_KEY);
    const events: WeightAdjustmentEvent[] = stored ? JSON.parse(stored) : [];
    events.push(event);
    // Keep last 100 events
    if (events.length > 100) events.shift();
    localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify(events));
}

export function getAdjustmentHistory(): WeightAdjustmentEvent[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(ADJUSTMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Get weights summary for display
export function getWeightsSummary(): {
    topPositive: FeatureWeight[];
    topNegative: FeatureWeight[];
    rising: FeatureWeight[];
    falling: FeatureWeight[];
} {
    const weights = getFeatureWeights();

    return {
        topPositive: [...weights].filter(w => w.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 5),
        topNegative: [...weights].filter(w => w.weight < 0).sort((a, b) => a.weight - b.weight).slice(0, 5),
        rising: weights.filter(w => w.trend === 'rising').sort((a, b) => b.trendStrength - a.trendStrength),
        falling: weights.filter(w => w.trend === 'falling').sort((a, b) => b.trendStrength - a.trendStrength),
    };
}
