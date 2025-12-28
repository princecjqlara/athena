/**
 * Historical Performance Weighting
 * Weights predictions based on how similar ads performed historically
 */

import { ExtractedAdData, ExtractedResultsData } from '@/types';

interface HistoricalAd {
    id: string;
    adData: ExtractedAdData;
    results?: ExtractedResultsData;
    successScore?: number;
    createdAt: string;
}

interface SimilarityScore {
    adId: string;
    similarity: number;
    successScore: number;
    weight: number;
}

const HISTORICAL_ADS_KEY = 'ml_historical_ads';

/**
 * Get historical ads from localStorage
 */
export function getHistoricalAds(): HistoricalAd[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(HISTORICAL_ADS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Add ad to historical data
 */
export function addToHistory(adId: string, adData: ExtractedAdData, results?: ExtractedResultsData): void {
    if (typeof window === 'undefined') return;

    const historical = getHistoricalAds();

    // Check if already exists
    const existingIndex = historical.findIndex(h => h.id === adId);

    const entry: HistoricalAd = {
        id: adId,
        adData,
        results,
        successScore: results?.successScore,
        createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        historical[existingIndex] = entry;
    } else {
        historical.push(entry);
    }

    // Keep last 200 ads
    if (historical.length > 200) {
        historical.splice(0, historical.length - 200);
    }

    localStorage.setItem(HISTORICAL_ADS_KEY, JSON.stringify(historical));
}

/**
 * Calculate similarity between two ads based on key traits
 */
export function calculateSimilarity(ad1: ExtractedAdData, ad2: ExtractedAdData): number {
    let matchScore = 0;
    let totalChecks = 0;

    // Platform match (high weight)
    if (ad1.platform === ad2.platform) matchScore += 2;
    totalChecks += 2;

    // Hook type match (high weight)
    if (ad1.hookType === ad2.hookType) matchScore += 2;
    totalChecks += 2;

    // Content category match
    if (ad1.contentCategory === ad2.contentCategory) matchScore += 1.5;
    totalChecks += 1.5;

    // Editing style match
    if (ad1.editingStyle === ad2.editingStyle) matchScore += 1;
    totalChecks += 1;

    // UGC style match (important)
    if (ad1.isUGCStyle === ad2.isUGCStyle) matchScore += 1.5;
    totalChecks += 1.5;

    // Subtitles match
    if (ad1.hasSubtitles === ad2.hasSubtitles) matchScore += 0.5;
    totalChecks += 0.5;

    // Voiceover match
    if (ad1.hasVoiceover === ad2.hasVoiceover) matchScore += 0.5;
    totalChecks += 0.5;

    // Music type match
    if (ad1.musicType === ad2.musicType) matchScore += 1;
    totalChecks += 1;

    // Objective type match (critical)
    if (ad1.objectiveType && ad2.objectiveType && ad1.objectiveType === ad2.objectiveType) {
        matchScore += 2;
    }
    if (ad1.objectiveType || ad2.objectiveType) totalChecks += 2;

    // Audience type match (critical)
    if (ad1.audienceType && ad2.audienceType && ad1.audienceType === ad2.audienceType) {
        matchScore += 2;
    }
    if (ad1.audienceType || ad2.audienceType) totalChecks += 2;

    return totalChecks > 0 ? matchScore / totalChecks : 0;
}

/**
 * Find similar historical ads with their performance
 */
export function findSimilarAds(adData: ExtractedAdData, minSimilarity: number = 0.5): SimilarityScore[] {
    const historical = getHistoricalAds().filter(h => h.results && h.successScore !== undefined);

    const scores: SimilarityScore[] = historical
        .map(h => ({
            adId: h.id,
            similarity: calculateSimilarity(adData, h.adData),
            successScore: h.successScore!,
            weight: 0
        }))
        .filter(s => s.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10); // Top 10 similar

    // Calculate weights based on similarity
    const totalSimilarity = scores.reduce((sum, s) => sum + s.similarity, 0);
    scores.forEach(s => {
        s.weight = totalSimilarity > 0 ? s.similarity / totalSimilarity : 0;
    });

    return scores;
}

/**
 * Get historical performance weighted prediction
 * Returns a weighted average of similar ads' performance
 */
export function getHistoricalWeightedPrediction(adData: ExtractedAdData): {
    score: number | null;
    confidence: number;
    similarAdsCount: number;
    topSimilar: SimilarityScore[];
} {
    const similar = findSimilarAds(adData, 0.4);

    if (similar.length === 0) {
        return { score: null, confidence: 0, similarAdsCount: 0, topSimilar: [] };
    }

    // Weighted average of success scores
    const weightedScore = similar.reduce((sum, s) => sum + s.successScore * s.weight, 0);

    // Confidence based on number of similar ads and average similarity
    const avgSimilarity = similar.reduce((sum, s) => sum + s.similarity, 0) / similar.length;
    const countBonus = Math.min(similar.length / 5, 1); // 5+ similar ads = max bonus
    const confidence = avgSimilarity * 0.6 + countBonus * 0.4;

    return {
        score: Math.round(weightedScore * 100) / 100,
        confidence: Math.round(confidence * 100),
        similarAdsCount: similar.length,
        topSimilar: similar.slice(0, 5)
    };
}

/**
 * Blend ML prediction with historical performance
 */
export function blendPredictions(
    mlPrediction: number,
    historicalPrediction: number | null,
    historicalConfidence: number
): number {
    if (historicalPrediction === null || historicalConfidence < 30) {
        return mlPrediction;
    }

    // Blend based on historical confidence
    // Higher confidence = more weight to historical data
    const historicalWeight = Math.min(historicalConfidence / 100, 0.4); // Max 40% historical
    const mlWeight = 1 - historicalWeight;

    return Math.round(mlPrediction * mlWeight + historicalPrediction * historicalWeight);
}

export default {
    getHistoricalAds,
    addToHistory,
    calculateSimilarity,
    findSimilarAds,
    getHistoricalWeightedPrediction,
    blendPredictions
};
