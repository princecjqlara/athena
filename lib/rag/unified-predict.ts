/**
 * Unified Prediction Pipeline
 * 
 * THE SINGLE DECISION SPINE for all ad predictions.
 * 
 * Pipeline Order:
 * 1. Retrieve similar ads (RAG)
 * 2. Estimate outcome from neighbors
 * 3. Adjust via contrast (trait differences)
 * 4. Measure confidence
 * 5. If confidence low → fallback + suggest data
 * 
 * Everything else (exploration, discovery, weights) is ADVISORY only.
 */

import { AdEntry } from '@/types';
import {
    AdOrb,
    RAGConfig,
    DEFAULT_RAG_CONFIG,
    NeighborAd,
    TraitEffect,
    ContrastiveAnalysis,
    ExplanationDetail,
    ExperimentSuggestion,
} from './types';
import { DataNeed, GapAnalysis } from './marketplace-types';
import { convertToAdOrb } from './ad-orb';
import { generateOrbEmbedding } from './build-embedding';
import { retrieveSimilarAdsWithResults, getNeighborStats, hasEnoughNeighbors } from './retrieve-similar';
import { performContrastiveAnalysis, getTopImpactfulTraits, getTraitsNeedingMoreData } from './contrastive-analysis';
import { computeNeighborPrediction, calculateBlendAlpha, applyContrastiveAdjustment } from './neighbor-prediction';
import { saveOrb } from './orb-store';
import {
    PipelineConfig,
    DEFAULT_PIPELINE_CONFIG,
    getPipelineConfig,
    getConfidenceLevel,
    isConfidenceSufficient,
    ConfidenceLevel,
} from './decision-config';

// ============================================
// UNIFIED PREDICTION RESULT
// ============================================

/**
 * UnifiedPrediction - The single output format for all predictions
 * 
 * Designed for clarity:
 * - One prediction value
 * - One confidence value
 * - One explanation structure (4 sections)
 * - Clear data gap suggestions when needed
 */
export interface UnifiedPrediction {
    // Core prediction
    successProbability: number;   // 0-100 predicted success score
    confidence: number;           // 0-100 confidence level
    confidenceLevel: ConfidenceLevel;

    // Method used
    method: 'rag' | 'hybrid' | 'fallback';

    // Pipeline explanation (4 clear sections)
    explanation: PipelineExplanation;

    // Raw data for advanced users
    details: {
        neighbors: NeighborAd[];
        neighborCount: number;
        avgSimilarity: number;
        traitEffects: TraitEffect[];
        contrastiveAnalysis?: ContrastiveAnalysis;
    };

    // Hybrid blend info (when method = 'hybrid')
    blend?: {
        ragScore: number;
        fallbackScore: number;
        alpha: number;
    };

    // Metadata
    generatedAt: string;
    computeTimeMs: number;
}

/**
 * PipelineExplanation - The 4-section explanation format
 * 
 * 1. "Here's what similar ads did"
 * 2. "Here's how your differences matter"
 * 3. "Here's our confidence"
 * 4. "Here's what data would help" (only if low confidence)
 */
export interface PipelineExplanation {
    // Section 1: Similar ads evidence
    similarAdsEvidence: {
        summary: string;
        neighborCount: number;
        avgPerformance: number;
        performanceRange: { min: number; max: number };
    };

    // Section 2: Contrastive insights
    contrastiveInsights: {
        summary: string;
        positiveTraits: Array<{ trait: string; lift: number; confidence: number }>;
        negativeTraits: Array<{ trait: string; lift: number; confidence: number }>;
        netImpact: number;
    };

    // Section 3: Confidence statement
    confidenceStatement: {
        level: ConfidenceLevel;
        percentage: number;
        reasons: string[];
    };

    // Section 4: Data gap suggestions (only if low confidence)
    dataGapSuggestions?: {
        summary: string;
        gaps: DataNeed[];
        estimatedConfidenceGain: number;
        experiments?: ExperimentSuggestion[];
    };

    // Legacy-compatible fields
    recommendations: string[];
}

// ============================================
// MAIN UNIFIED PREDICTION FUNCTION
// ============================================

/**
 * unifiedPredict - THE single entry point for all ad predictions
 * 
 * This function enforces the pipeline order and ensures consistent output.
 * All other prediction functions should delegate to this one.
 */
export async function unifiedPredict(
    ad: AdEntry,
    config: PipelineConfig = getPipelineConfig(),
    ragConfig: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<UnifiedPrediction> {
    const startTime = Date.now();

    // ==========================================
    // Step 1: Retrieve similar ads (RAG)
    // ==========================================

    // Convert to AdOrb and generate embedding
    let orb = convertToAdOrb(ad);
    orb = await generateOrbEmbedding(orb);
    saveOrb(orb);

    // Retrieve similar ads with results
    const neighbors = await retrieveSimilarAdsWithResults(
        orb,
        ragConfig.defaultK,
        undefined,
        ragConfig
    );

    const neighborStats = getNeighborStats(neighbors);

    // ==========================================
    // Step 2: Estimate outcome from neighbors
    // ==========================================

    let neighborPrediction: { prediction: number; confidence: number; avgSimilarity: number };
    let analysis: ContrastiveAnalysis | undefined;
    let adjustedPrediction: number;

    if (hasEnoughNeighbors(neighbors, ragConfig)) {
        // We have enough neighbors for RAG
        neighborPrediction = computeNeighborPrediction(neighbors, ragConfig);

        // ==========================================
        // Step 3: Adjust via contrast (trait differences)
        // ==========================================

        analysis = performContrastiveAnalysis(orb, neighbors, ragConfig);
        adjustedPrediction = applyContrastiveAdjustment(
            neighborPrediction.prediction,
            analysis
        );
    } else {
        // Not enough neighbors - use baseline
        neighborPrediction = {
            prediction: 50,
            confidence: Math.max(0, neighbors.length * 10), // Low confidence
            avgSimilarity: neighborStats.avgSimilarity,
        };
        adjustedPrediction = neighborPrediction.prediction;
    }

    // ==========================================
    // Step 4: Measure confidence
    // ==========================================

    const confidence = calculatePipelineConfidence(
        neighbors,
        neighborPrediction.confidence,
        analysis,
        ragConfig
    );

    const confidenceLevel = getConfidenceLevel(confidence, config);

    // ==========================================
    // Step 5: If confidence low → fallback + suggest data
    // ==========================================

    let finalPrediction: number;
    let method: 'rag' | 'hybrid' | 'fallback';
    let blend: UnifiedPrediction['blend'];

    if (isConfidenceSufficient(confidence, config)) {
        // High confidence - use RAG prediction
        method = 'rag';
        finalPrediction = adjustedPrediction;
    } else if (config.enableLegacyFallback && neighbors.length > 0) {
        // Medium confidence - blend with fallback
        method = 'hybrid';
        const fallbackScore = await getLegacyFallbackScore(ad);
        const alpha = calculateBlendAlpha(neighbors, ragConfig);

        finalPrediction = alpha * adjustedPrediction + (1 - alpha) * fallbackScore;
        blend = {
            ragScore: adjustedPrediction,
            fallbackScore,
            alpha,
        };
    } else {
        // Low confidence - full fallback
        method = 'fallback';
        finalPrediction = await getLegacyFallbackScore(ad);
    }

    // ==========================================
    // Generate Explanation
    // ==========================================

    const explanation = buildPipelineExplanation(
        neighbors,
        analysis,
        confidence,
        confidenceLevel,
        config
    );

    return {
        successProbability: Math.round(finalPrediction * 10) / 10,
        confidence: Math.round(confidence),
        confidenceLevel,
        method,
        explanation,
        details: {
            neighbors: neighbors.slice(0, 5),
            neighborCount: neighbors.length,
            avgSimilarity: neighborStats.avgSimilarity,
            traitEffects: analysis ? getTopImpactfulTraits(analysis, config.maxTraitsToExplain) : [],
            contrastiveAnalysis: analysis,
        },
        blend,
        generatedAt: new Date().toISOString(),
        computeTimeMs: Date.now() - startTime,
    };
}

// ============================================
// PIPELINE HELPERS
// ============================================

/**
 * Calculate overall pipeline confidence
 */
function calculatePipelineConfidence(
    neighbors: NeighborAd[],
    neighborConfidence: number,
    analysis: ContrastiveAnalysis | undefined,
    config: RAGConfig
): number {
    // Base confidence from neighbors
    let confidence = neighborConfidence;

    // Adjust for neighbor count
    const neighborRatio = Math.min(neighbors.length / config.defaultK, 1);
    confidence = confidence * (0.5 + 0.5 * neighborRatio);

    // Adjust for analysis quality if available
    if (analysis) {
        // Penalize if many traits have low confidence
        const lowConfidenceRatio = analysis.lowConfidence.length /
            Math.max(analysis.traitEffects.length, 1);
        confidence = confidence * (1 - 0.2 * lowConfidenceRatio);
    }

    return Math.max(0, Math.min(100, confidence));
}

/**
 * Get legacy fallback prediction score
 */
async function getLegacyFallbackScore(ad: AdEntry): Promise<number> {
    try {
        const { generateAdPrediction } = await import('../prediction-utils');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prediction = await generateAdPrediction(ad as any);
        return prediction.predictedScore;
    } catch (error) {
        console.warn('Legacy fallback failed:', error);
        return 50; // Default neutral score
    }
}

/**
 * Build the 4-section pipeline explanation
 */
function buildPipelineExplanation(
    neighbors: NeighborAd[],
    analysis: ContrastiveAnalysis | undefined,
    confidence: number,
    confidenceLevel: ConfidenceLevel,
    config: PipelineConfig
): PipelineExplanation {
    // Section 1: Similar ads evidence
    const performances = neighbors
        .filter(n => n.orb.results?.successScore !== undefined)
        .map(n => n.orb.results!.successScore!);

    const avgPerformance = performances.length > 0
        ? performances.reduce((a, b) => a + b, 0) / performances.length
        : 50;

    const similarAdsEvidence = {
        summary: neighbors.length > 0
            ? `Based on ${neighbors.length} similar ads, the average success score was ${Math.round(avgPerformance)}%.`
            : 'No similar ads found for comparison.',
        neighborCount: neighbors.length,
        avgPerformance: Math.round(avgPerformance),
        performanceRange: {
            min: performances.length > 0 ? Math.min(...performances) : 0,
            max: performances.length > 0 ? Math.max(...performances) : 0,
        },
    };

    // Section 2: Contrastive insights
    const positiveTraits = analysis?.topPositive.slice(0, 3).map(t => ({
        trait: t.trait,
        lift: Math.round(t.lift * 10) / 10,
        confidence: Math.round(t.confidence),
    })) || [];

    const negativeTraits = analysis?.topNegative.slice(0, 3).map(t => ({
        trait: t.trait,
        lift: Math.round(t.lift * 10) / 10,
        confidence: Math.round(t.confidence),
    })) || [];

    const netImpact = positiveTraits.reduce((sum, t) => sum + t.lift, 0) +
        negativeTraits.reduce((sum, t) => sum + t.lift, 0);

    let contrastSummary = 'No trait differences analyzed.';
    if (positiveTraits.length > 0 || negativeTraits.length > 0) {
        const parts: string[] = [];
        if (positiveTraits.length > 0) {
            parts.push(`${positiveTraits.length} traits working in your favor`);
        }
        if (negativeTraits.length > 0) {
            parts.push(`${negativeTraits.length} traits that may hurt performance`);
        }
        contrastSummary = `Your ad has ${parts.join(' and ')}. Net impact: ${netImpact > 0 ? '+' : ''}${Math.round(netImpact)}%.`;
    }

    const contrastiveInsights = {
        summary: contrastSummary,
        positiveTraits,
        negativeTraits,
        netImpact: Math.round(netImpact * 10) / 10,
    };

    // Section 3: Confidence statement
    const confidenceReasons: string[] = [];
    if (neighbors.length >= 10) {
        confidenceReasons.push(`${neighbors.length} similar examples found`);
    } else if (neighbors.length > 0) {
        confidenceReasons.push(`Only ${neighbors.length} similar examples (need more data)`);
    } else {
        confidenceReasons.push('No similar examples found');
    }

    if (analysis && analysis.lowConfidence.length > 0) {
        confidenceReasons.push(`${analysis.lowConfidence.length} traits need more data`);
    }

    const confidenceStatement = {
        level: confidenceLevel,
        percentage: Math.round(confidence),
        reasons: confidenceReasons,
    };

    // Section 4: Data gap suggestions (only if low/medium confidence)
    let dataGapSuggestions: PipelineExplanation['dataGapSuggestions'];

    if (confidenceLevel !== 'high' && config.includeDataGapSuggestions) {
        const gaps: DataNeed[] = [];

        // Add gap for low neighbor count
        if (neighbors.length < 10) {
            gaps.push({
                id: 'gap-neighbors',
                dimension: 'trait',
                value: 'similar_ads',
                reason: `Only ${neighbors.length} similar ads found`,
                severity: neighbors.length < 5 ? 'high' : 'medium',
                currentSamples: neighbors.length,
                requiredSamples: 10,
                confidenceImpact: 15,
            });
        }

        // Add gaps for low-confidence traits
        if (analysis) {
            const lowConfTraits = getTraitsNeedingMoreData(analysis, 40);
            for (const trait of lowConfTraits.slice(0, 3)) {
                gaps.push({
                    id: `gap-trait-${trait.trait}`,
                    dimension: 'trait',
                    value: trait.trait,
                    reason: `Low confidence for "${trait.trait}" effect`,
                    severity: trait.confidence < 20 ? 'high' : 'medium',
                    currentSamples: trait.n_with + trait.n_without,
                    requiredSamples: 10,
                    confidenceImpact: 10,
                });
            }
        }

        const estimatedGain = gaps.reduce((sum, g) => sum + g.confidenceImpact, 0);

        dataGapSuggestions = {
            summary: gaps.length > 0
                ? `Adding ${gaps.length} data points could improve confidence by up to ${estimatedGain}%.`
                : 'More ads with results will improve prediction accuracy.',
            gaps,
            estimatedConfidenceGain: estimatedGain,
        };
    }

    // Build recommendations
    const recommendations: string[] = [];
    if (positiveTraits.length > 0) {
        recommendations.push(`Keep using: ${positiveTraits.map(t => t.trait).join(', ')}`);
    }
    if (negativeTraits.length > 0) {
        recommendations.push(`Consider changing: ${negativeTraits.map(t => t.trait).join(', ')}`);
    }
    if (confidenceLevel === 'low') {
        recommendations.push('Add more ads with results to improve predictions');
    }

    return {
        similarAdsEvidence,
        contrastiveInsights,
        confidenceStatement,
        dataGapSuggestions,
        recommendations,
    };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick prediction with default config
 */
export async function predict(ad: AdEntry): Promise<UnifiedPrediction> {
    return unifiedPredict(ad);
}

/**
 * Prediction with custom confidence threshold
 */
export async function predictWithThreshold(
    ad: AdEntry,
    confidenceThreshold: number
): Promise<UnifiedPrediction> {
    const config = { ...getPipelineConfig(), confidenceThreshold };
    return unifiedPredict(ad, config);
}

/**
 * Check if an ad has enough data for confident prediction
 */
export async function canPredictConfidently(ad: AdEntry): Promise<boolean> {
    const prediction = await unifiedPredict(ad);
    return prediction.confidenceLevel === 'high';
}
