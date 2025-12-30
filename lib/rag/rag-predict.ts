/**
 * RAG Prediction Pipeline
 * 
 * Main prediction function that combines:
 * - Similar ad retrieval
 * - Contrastive trait analysis
 * - Neighbor-based prediction
 * - Hybrid blending with legacy predictor
 * - Explanation generation
 * - Marketplace gap detection (NEW)
 */

import { AdEntry } from '@/types';
import {
    AdOrb,
    RAGPrediction,
    RAGConfig,
    DEFAULT_RAG_CONFIG,
    NeighborAd,
    TraitEffect,
    DataNeedSummary,
    MarketplaceSuggestionSummary,
} from './types';
import { convertToAdOrb } from './ad-orb';
import { generateOrbEmbedding } from './build-embedding';
import { retrieveSimilarAdsWithResults, getNeighborStats, hasEnoughNeighbors } from './retrieve-similar';
import { performContrastiveAnalysis, getTopImpactfulTraits } from './contrastive-analysis';
import { computeNeighborPrediction, calculateBlendAlpha } from './neighbor-prediction';
import { generateExplanation, generateSimpleExplanation } from './explanation';
import { saveOrb } from './orb-store';
import { detectDataNeeds, shouldShowMarketplaceSuggestions } from './data-needs';
import { matchDataNeeds, generateSuggestions } from './marketplace-matching';
import { DEFAULT_MARKETPLACE_CONFIG, MarketplaceConfig } from './marketplace-types';
import { clampScore, isValidScore, SAFETY_CONFIG } from './safety-config';
import { logError, logFallback } from './logging';

// ============================================
// FALLBACK TO LEGACY
// ============================================

/**
 * Get legacy prediction using existing ML system
 */
async function getLegacyPrediction(ad: AdEntry): Promise<{ score: number; confidence: number }> {
    try {
        // Dynamic import to avoid circular dependencies
        const { generateAdPrediction } = await import('../prediction-utils');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prediction = await generateAdPrediction(ad as any);
        return {
            score: prediction.predictedScore,
            confidence: prediction.confidence,
        };
    } catch (error) {
        console.warn('Legacy prediction failed:', error);
        return { score: 50, confidence: 0 }; // Default fallback
    }
}

// ============================================
// MAIN RAG PREDICTION
// ============================================

/**
 * Predict ad success using RAG + contrastive analysis
 * 
 * @deprecated Use `unifiedPredict` from './unified-predict' instead.
 * This function is kept for backward compatibility but the unified
 * pipeline provides clearer explanations and consistent behavior.
 * 
 * Flow:
 * 1. Convert ad to AdOrb
 * 2. Generate embedding
 * 3. Retrieve similar ads with results
 * 4. If insufficient neighbors → fallback to legacy
 * 5. Compute contrastive analysis
 * 6. Compute neighbor-based prediction
 * 7. Blend with legacy (hybrid)
 * 8. Generate explanation
 * 9. Detect data gaps and marketplace suggestions (if enabled)
 */
export async function predictWithRAG(
    ad: AdEntry,
    config: RAGConfig = DEFAULT_RAG_CONFIG,
    marketplaceConfig: MarketplaceConfig = DEFAULT_MARKETPLACE_CONFIG
): Promise<RAGPrediction> {
    const startTime = Date.now();

    // Step 1: Convert to AdOrb
    let orb = convertToAdOrb(ad);

    // Step 2: Generate embedding
    orb = await generateOrbEmbedding(orb);

    // Save orb for future retrieval
    saveOrb(orb);

    // Step 3: Retrieve similar ads with results
    const neighbors = await retrieveSimilarAdsWithResults(
        orb,
        config.defaultK,
        undefined,
        config
    );

    const neighborStats = getNeighborStats(neighbors);

    // Step 4: Check if we have enough neighbors for RAG
    if (!hasEnoughNeighbors(neighbors, config)) {
        // Fallback to legacy prediction
        const legacy = await getLegacyPrediction(ad);

        return buildRAGPrediction({
            method: 'legacy',
            successProbability: legacy.score,
            confidence: legacy.confidence,
            neighbors: [],
            neighborCount: neighbors.length,
            avgNeighborSimilarity: neighborStats.avgSimilarity,
            traitEffects: [],
            explanation: `Prediction based on ML model. Only ${neighbors.length} similar ads found (minimum: ${config.minNeighbors}).`,
            explanationDetails: [{
                type: 'low_confidence',
                text: `Not enough similar ads for RAG prediction. Using traditional ML.`,
                confidence: legacy.confidence,
            }],
            recommendations: ['Add more ads to improve RAG predictions.'],
            computeTimeMs: Date.now() - startTime,
        });
    }

    // Step 5: Perform contrastive analysis
    const analysis = performContrastiveAnalysis(orb, neighbors, config);

    // Step 6: Compute neighbor-based prediction
    const neighborPrediction = computeNeighborPrediction(neighbors, config);

    // Step 7: Blend with legacy (hybrid)
    const alpha = calculateBlendAlpha(neighbors, config);
    const legacy = await getLegacyPrediction(ad);

    let method: 'rag' | 'hybrid' | 'legacy';
    let finalScore: number;

    if (alpha >= 0.9) {
        // High confidence in RAG
        method = 'rag';
        finalScore = neighborPrediction.prediction;
    } else if (alpha >= 0.3) {
        // Blend RAG and legacy
        method = 'hybrid';
        finalScore = alpha * neighborPrediction.prediction + (1 - alpha) * legacy.score;
    } else {
        // Low confidence in RAG, mostly legacy
        method = 'legacy';
        finalScore = legacy.score;
    }

    // Step 8: Generate explanation
    const explanationData = generateExplanation(
        finalScore,
        neighborPrediction.confidence,
        neighbors,
        analysis
    );

    // Step 9: Detect data gaps and generate marketplace suggestions (if enabled)
    let marketplaceData: {
        dataNeeds: DataNeedSummary[];
        marketplaceSuggestions: MarketplaceSuggestionSummary[];
        gapAnalysis: {
            hasSignificantGaps: boolean;
            totalGaps: number;
            potentialConfidenceGain: number;
        };
        hasMarketplaceData: boolean;
    } | undefined;

    if (marketplaceConfig.enabled && shouldShowMarketplaceSuggestions(
        neighbors.length,
        neighborPrediction.confidence,
        neighborStats.avgSimilarity,
        marketplaceConfig
    )) {
        const queryPlatform = orb.metadata.platform;
        const gapAnalysis = detectDataNeeds(
            neighbors,
            getTopImpactfulTraits(analysis, 20),
            queryPlatform,
            neighborPrediction.confidence,
            config,
            marketplaceConfig
        );

        if (gapAnalysis.hasSignificantGaps) {
            const matches = matchDataNeeds(gapAnalysis.dataNeeds, marketplaceConfig);
            const suggestions = generateSuggestions(matches, neighborPrediction.confidence);

            marketplaceData = {
                dataNeeds: gapAnalysis.dataNeeds.slice(0, 5).map(need => ({
                    dimension: need.dimension,
                    value: need.value,
                    reason: need.reason,
                    severity: need.severity,
                    confidenceImpact: need.confidenceImpact,
                })),
                marketplaceSuggestions: suggestions.slice(0, 3).map(s => ({
                    datasetId: s.match.dataset.id,
                    datasetName: s.match.dataset.name,
                    matchScore: s.match.matchScore,
                    estimatedConfidenceGain: s.match.estimatedConfidenceGain,
                    headline: s.headline,
                    reason: s.reason,
                })),
                gapAnalysis: {
                    hasSignificantGaps: gapAnalysis.hasSignificantGaps,
                    totalGaps: gapAnalysis.totalGaps,
                    potentialConfidenceGain: gapAnalysis.maxConfidenceGain,
                },
                hasMarketplaceData: true,
            };
        }
    }

    return buildRAGPrediction({
        method,
        // SAFETY: Clamp and validate final score
        successProbability: clampScore(Math.round(finalScore * 10) / 10),
        confidence: clampScore(neighborPrediction.confidence),
        ragScore: neighborPrediction.prediction,
        legacyScore: legacy.score,
        blendAlpha: alpha,
        neighbors: neighbors.slice(0, 5), // Return top 5 for display
        neighborCount: neighbors.length,
        avgNeighborSimilarity: neighborStats.avgSimilarity,
        traitEffects: getTopImpactfulTraits(analysis, 10),
        explanation: explanationData.summary,
        explanationDetails: explanationData.details,
        recommendations: explanationData.recommendations,
        experimentsToRun: explanationData.experiments,
        computeTimeMs: Date.now() - startTime,
        // Marketplace data (optional)
        ...marketplaceData,
    });
}

/**
 * Build RAGPrediction object with defaults
 */
function buildRAGPrediction(data: Partial<RAGPrediction> & Pick<RAGPrediction, 'method' | 'successProbability' | 'confidence'>): RAGPrediction {
    return {
        successProbability: data.successProbability,
        confidence: data.confidence,
        method: data.method,
        ragScore: data.ragScore,
        legacyScore: data.legacyScore,
        blendAlpha: data.blendAlpha,
        neighbors: data.neighbors || [],
        neighborCount: data.neighborCount || 0,
        avgNeighborSimilarity: data.avgNeighborSimilarity || 0,
        traitEffects: data.traitEffects || [],
        explanation: data.explanation || '',
        explanationDetails: data.explanationDetails || [],
        recommendations: data.recommendations || [],
        experimentsToRun: data.experimentsToRun,
        // Marketplace fields (optional)
        dataNeeds: data.dataNeeds,
        marketplaceSuggestions: data.marketplaceSuggestions,
        gapAnalysis: data.gapAnalysis,
        hasMarketplaceData: data.hasMarketplaceData,
        // Metadata
        generatedAt: new Date().toISOString(),
        computeTimeMs: data.computeTimeMs,
    };
}

// ============================================
// QUICK PREDICTION (NO LEGACY BLEND)
// ============================================

/**
 * Quick RAG prediction without legacy blending
 * Faster but may be less accurate with limited data
 */
export async function predictWithRAGOnly(
    ad: AdEntry,
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<RAGPrediction> {
    const startTime = Date.now();

    // Convert and embed
    let orb = convertToAdOrb(ad);
    orb = await generateOrbEmbedding(orb);
    saveOrb(orb);

    // Retrieve neighbors
    const neighbors = await retrieveSimilarAdsWithResults(orb, config.defaultK, undefined, config);

    if (neighbors.length === 0) {
        return buildRAGPrediction({
            method: 'rag',
            successProbability: 50,
            confidence: 0,
            explanation: 'No similar ads found. Cannot make prediction.',
            computeTimeMs: Date.now() - startTime,
        });
    }

    // Analyze and predict
    const analysis = performContrastiveAnalysis(orb, neighbors, config);
    const prediction = computeNeighborPrediction(neighbors, config);
    const explanationData = generateExplanation(
        prediction.prediction,
        prediction.confidence,
        neighbors,
        analysis
    );

    return buildRAGPrediction({
        method: 'rag',
        successProbability: prediction.prediction,
        confidence: prediction.confidence,
        neighbors: neighbors.slice(0, 5),
        neighborCount: neighbors.length,
        avgNeighborSimilarity: prediction.avgSimilarity,
        traitEffects: getTopImpactfulTraits(analysis, 10),
        explanation: explanationData.summary,
        explanationDetails: explanationData.details,
        recommendations: explanationData.recommendations,
        experimentsToRun: explanationData.experiments,
        computeTimeMs: Date.now() - startTime,
    });
}

// ============================================
// BATCH PREDICTION
// ============================================

/**
 * Predict for multiple ads
 */
export async function predictBatchWithRAG(
    ads: AdEntry[],
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<RAGPrediction[]> {
    const results: RAGPrediction[] = [];

    for (const ad of ads) {
        try {
            const prediction = await predictWithRAG(ad, config);
            results.push(prediction);
        } catch (error) {
            console.error('Batch prediction error for ad:', ad.id, error);
            results.push(buildRAGPrediction({
                method: 'legacy',
                successProbability: 50,
                confidence: 0,
                explanation: 'Prediction failed.',
            }));
        }
    }

    return results;
}

// ============================================
// ANALYSIS ONLY (NO PREDICTION)
// ============================================

/**
 * Get contrastive analysis for an ad without prediction
 * Useful for understanding trait effects
 */
export async function analyzeAdTraits(
    ad: AdEntry,
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<{
    traitEffects: TraitEffect[];
    neighbors: NeighborAd[];
    explanation: string;
}> {
    let orb = convertToAdOrb(ad);
    orb = await generateOrbEmbedding(orb);

    const neighbors = await retrieveSimilarAdsWithResults(orb, config.defaultK, undefined, config);

    if (neighbors.length === 0) {
        return {
            traitEffects: [],
            neighbors: [],
            explanation: 'No similar ads found for analysis.',
        };
    }

    const analysis = performContrastiveAnalysis(orb, neighbors, config);
    const explanation = generateSimpleExplanation(neighbors, analysis);

    return {
        traitEffects: analysis.traitEffects,
        neighbors: neighbors.slice(0, 10),
        explanation,
    };
}
