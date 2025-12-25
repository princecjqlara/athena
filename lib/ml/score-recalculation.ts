// Score Recalculation System
// Automatically updates all ad scores when weights change

import { ExtractedAdData, AdEntry, FeatureWeight } from '@/types';
import { calculateWeightedScore, getFeatureWeights } from './weight-adjustment';

const SCORE_HISTORY_KEY = 'ml_score_history';
const RECALCULATION_LOG_KEY = 'ml_recalculation_log';
const ADS_STORAGE_KEY = 'adVisionAds';

// ============================================
// TYPES
// ============================================

export interface ScoreHistoryEntry {
    adId: string;
    previousScore: number;
    newScore: number;
    scoreDelta: number;
    weightsUsed: string;  // JSON string of weights snapshot
    recalculatedAt: string;
}

export interface RecalculationLog {
    id: string;
    triggeredBy: 'weight_change' | 'manual' | 'baseline_update';
    adsRecalculated: number;
    totalScoreChange: number;
    avgScoreDelta: number;
    timestamp: string;
    weightsSnapshot: FeatureWeight[];
}

export interface RecalculationResult {
    success: boolean;
    adsUpdated: number;
    scoreChanges: Array<{
        adId: string;
        adName: string;
        oldScore: number;
        newScore: number;
        delta: number;
    }>;
    avgDelta: number;
    logId: string;
}

// ============================================
// STORAGE HELPERS
// ============================================

function getScoreHistory(): ScoreHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(SCORE_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveScoreHistory(history: ScoreHistoryEntry[]): void {
    if (typeof window === 'undefined') return;
    // Keep last 500 entries
    const trimmed = history.slice(-500);
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(trimmed));
}

function getRecalculationLogs(): RecalculationLog[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(RECALCULATION_LOG_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveRecalculationLog(log: RecalculationLog): void {
    if (typeof window === 'undefined') return;
    const logs = getRecalculationLogs();
    logs.push(log);
    // Keep last 50 logs
    const trimmed = logs.slice(-50);
    localStorage.setItem(RECALCULATION_LOG_KEY, JSON.stringify(trimmed));
}

function getStoredAds(): AdEntry[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(ADS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveAds(ads: AdEntry[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(ads));
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Convert an AdEntry to ExtractedAdData for scoring
 */
function adToExtractedData(ad: AdEntry): Partial<ExtractedAdData> {
    const content = ad.extractedContent || {} as ExtractedAdData;

    return {
        title: ad.name || '',
        description: content.description || '',
        mediaType: ad.mediaType || 'video',
        platform: content.platform || 'facebook',
        hookType: content.hookType || 'curiosity',
        hookText: content.hookText || '',
        contentCategory: content.contentCategory || 'product_demo',
        editingStyle: content.editingStyle || 'fast_cuts',
        colorScheme: content.colorScheme || 'neutral',
        hasTextOverlays: content.hasTextOverlays || false,
        hasSubtitles: content.hasSubtitles || false,
        isUGCStyle: content.isUGCStyle || false,
        hasVoiceover: content.hasVoiceover || false,
        musicType: content.musicType || 'original',
        numberOfActors: content.numberOfActors || 0,
    };
}

/**
 * Recalculate score for a single ad
 */
export function recalculateSingleScore(ad: AdEntry): {
    oldScore: number;
    newScore: number;
    delta: number;
} {
    const oldScore = ad.successScore || 50;
    const extractedData = adToExtractedData(ad);
    const newScore = calculateWeightedScore(extractedData as ExtractedAdData);

    return {
        oldScore,
        newScore,
        delta: newScore - oldScore,
    };
}

/**
 * Recalculate all ad scores with current weights
 */
export function recalculateAllScores(
    triggeredBy: 'weight_change' | 'manual' | 'baseline_update' = 'manual'
): RecalculationResult {
    const ads = getStoredAds();
    const weights = getFeatureWeights();
    const history = getScoreHistory();
    const scoreChanges: RecalculationResult['scoreChanges'] = [];

    let totalDelta = 0;

    // Process each ad
    ads.forEach(ad => {
        const { oldScore, newScore, delta } = recalculateSingleScore(ad);

        // Only record if there's a meaningful change
        if (Math.abs(delta) >= 1) {
            // Add to history
            history.push({
                adId: ad.id,
                previousScore: oldScore,
                newScore,
                scoreDelta: delta,
                weightsUsed: JSON.stringify(weights),
                recalculatedAt: new Date().toISOString(),
            });

            // Track changes
            scoreChanges.push({
                adId: ad.id,
                adName: ad.name || 'Unnamed Ad',
                oldScore,
                newScore,
                delta,
            });

            totalDelta += Math.abs(delta);

            // Update the ad's success score
            ad.successScore = newScore;
        }
    });

    // Save updated ads
    if (scoreChanges.length > 0) {
        saveAds(ads);
        saveScoreHistory(history);
    }

    // Create log entry
    const logId = `recalc-${Date.now()}`;
    const log: RecalculationLog = {
        id: logId,
        triggeredBy,
        adsRecalculated: scoreChanges.length,
        totalScoreChange: totalDelta,
        avgScoreDelta: scoreChanges.length > 0 ? totalDelta / scoreChanges.length : 0,
        timestamp: new Date().toISOString(),
        weightsSnapshot: weights,
    };
    saveRecalculationLog(log);

    return {
        success: true,
        adsUpdated: scoreChanges.length,
        scoreChanges,
        avgDelta: log.avgScoreDelta,
        logId,
    };
}

/**
 * Trigger recalculation when weights change
 * Called automatically from weight-adjustment.ts
 */
export function triggerRecalculationOnWeightChange(): RecalculationResult {
    console.log('[SCORE RECALC] Weights changed, recalculating all scores...');
    const result = recalculateAllScores('weight_change');
    console.log(`[SCORE RECALC] Updated ${result.adsUpdated} ads, avg delta: ${result.avgDelta.toFixed(1)}`);
    return result;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get score history for a specific ad
 */
export function getAdScoreHistory(adId: string): ScoreHistoryEntry[] {
    return getScoreHistory().filter(h => h.adId === adId);
}

/**
 * Get all recalculation logs
 */
export function getRecalculationLog(): RecalculationLog[] {
    return getRecalculationLogs();
}

/**
 * Get most significant score changes from last recalculation
 */
export function getRecentSignificantChanges(limit: number = 10): ScoreHistoryEntry[] {
    const history = getScoreHistory();
    return history
        .sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta))
        .slice(0, limit);
}

/**
 * Get summary statistics for score recalculations
 */
export function getRecalculationStats(): {
    totalRecalculations: number;
    lastRecalculatedAt: string | null;
    avgScoreDelta: number;
    totalAdsAffected: number;
} {
    const logs = getRecalculationLogs();

    if (logs.length === 0) {
        return {
            totalRecalculations: 0,
            lastRecalculatedAt: null,
            avgScoreDelta: 0,
            totalAdsAffected: 0,
        };
    }

    const totalAdsAffected = logs.reduce((sum, log) => sum + log.adsRecalculated, 0);
    const totalDelta = logs.reduce((sum, log) => sum + log.avgScoreDelta, 0);

    return {
        totalRecalculations: logs.length,
        lastRecalculatedAt: logs[logs.length - 1].timestamp,
        avgScoreDelta: totalDelta / logs.length,
        totalAdsAffected,
    };
}
