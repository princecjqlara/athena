/**
 * Prediction Utilities
 * 
 * Shared module for generating AI predictions automatically
 * for both manually uploaded ads and Facebook-imported ads.
 */

import { ExtractedAdData } from '@/types';
import { predictWithML, RiskAssessment } from './ml';

export interface AdPrediction {
    predictedScore: number;
    confidence: number;
    riskAssessment: RiskAssessment | null;
    predictionDetails: {
        globalScore: number;
        bestSegment: { segmentId: string; segmentName: string; score: number } | null;
        segmentScores: { segmentId: string; segmentName: string; score: number }[];
        confidence: number;
        keyFactors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }>;
        recommendations: string[];
    } | null;
    generatedAt: string;
}

/**
 * Build ExtractedAdData from ad object traits/categories
 * Works with both manually uploaded ads and Facebook imported ads
 */
function buildExtractedAdData(ad: Record<string, unknown>): ExtractedAdData {
    // Check for extractedContent (from upload) or traits (from import)
    const extracted = ad.extractedContent as Record<string, unknown> | undefined;
    const traits = (ad.traits || []) as string[];
    const categories = (ad.categories || []) as string[];
    const allTraits = [...traits, ...categories].map(t => t.toLowerCase());

    // If we have extractedContent, use it directly
    if (extracted && Object.keys(extracted).length > 0) {
        return {
            title: (extracted.title as string) || (ad.name as string) || 'Untitled Ad',
            description: (extracted.description as string) || '',
            mediaType: (extracted.mediaType as 'video' | 'photo') || (ad.mediaType as 'video' | 'photo') || 'video',
            aspectRatio: (extracted.aspectRatio as ExtractedAdData['aspectRatio']) || '9:16',
            platform: (extracted.platform as ExtractedAdData['platform']) || 'facebook',
            placement: (extracted.placement as ExtractedAdData['placement']) || 'feed',
            hookType: (extracted.hookType as ExtractedAdData['hookType']) || 'other',
            contentCategory: (extracted.contentCategory as ExtractedAdData['contentCategory']) || 'other',
            editingStyle: (extracted.editingStyle as ExtractedAdData['editingStyle']) || 'other',
            colorScheme: (extracted.colorScheme as ExtractedAdData['colorScheme']) || 'other',
            hasTextOverlays: Boolean(extracted.hasTextOverlays),
            hasSubtitles: Boolean(extracted.hasSubtitles),
            musicType: (extracted.musicType as ExtractedAdData['musicType']) || 'other',
            hasVoiceover: Boolean(extracted.hasVoiceover),
            numberOfActors: (extracted.numberOfActors as number) || 1,
            isUGCStyle: Boolean(extracted.isUGCStyle),
            customTraits: (extracted.customTraits as string[]) || [],
            extractionConfidence: (extracted.extractionConfidence as number) || 50,
        };
    }

    // Fallback: Build from traits/categories (for Facebook imports)
    return {
        title: (ad.name as string) || 'Untitled Ad',
        description: '',
        mediaType: (ad.mediaType as 'video' | 'photo') || 'video',
        aspectRatio: '9:16',
        platform: 'facebook',
        placement: 'feed',
        hookType: detectHookType(allTraits),
        contentCategory: detectContentCategory(allTraits, categories),
        editingStyle: detectEditingStyle(allTraits),
        colorScheme: 'other',
        hasTextOverlays: allTraits.some(t => t.includes('text') || t.includes('overlay')),
        hasSubtitles: allTraits.some(t => t.includes('subtitle') || t.includes('caption')),
        musicType: allTraits.some(t => t.includes('trending')) ? 'trending' : 'other',
        hasVoiceover: allTraits.some(t => t.includes('voiceover') || t.includes('narration')),
        numberOfActors: 1,
        isUGCStyle: allTraits.some(t => t.includes('ugc')),
        customTraits: allTraits,
        extractionConfidence: 40, // Lower confidence for trait-based extraction
    };
}

function detectHookType(traits: string[]): ExtractedAdData['hookType'] {
    if (traits.some(t => t.includes('curiosity'))) return 'curiosity';
    if (traits.some(t => t.includes('shock'))) return 'shock';
    if (traits.some(t => t.includes('question'))) return 'question';
    if (traits.some(t => t.includes('transformation') || t.includes('before') || t.includes('after'))) return 'transformation';
    if (traits.some(t => t.includes('story'))) return 'story';
    if (traits.some(t => t.includes('problem') || t.includes('solution'))) return 'problem_solution';
    return 'other';
}

function detectContentCategory(traits: string[], categories: string[]): ExtractedAdData['contentCategory'] {
    const all = [...traits, ...categories.map(c => c.toLowerCase())];
    if (all.some(t => t.includes('ugc'))) return 'ugc';
    if (all.some(t => t.includes('testimonial'))) return 'testimonial';
    if (all.some(t => t.includes('demo') || t.includes('product'))) return 'product_demo';
    if (all.some(t => t.includes('tutorial') || t.includes('howto') || t.includes('how-to'))) return 'tutorial';
    if (all.some(t => t.includes('lifestyle'))) return 'lifestyle';
    if (all.some(t => t.includes('education') || t.includes('educational'))) return 'educational';
    if (all.some(t => t.includes('entertainment') || t.includes('funny'))) return 'entertainment';
    return 'other';
}

function detectEditingStyle(traits: string[]): ExtractedAdData['editingStyle'] {
    if (traits.some(t => t.includes('fast') || t.includes('quick'))) return 'fast_cuts';
    if (traits.some(t => t.includes('cinematic'))) return 'cinematic';
    if (traits.some(t => t.includes('raw') || t.includes('authentic'))) return 'raw_authentic';
    if (traits.some(t => t.includes('minimal'))) return 'minimal';
    if (traits.some(t => t.includes('dynamic'))) return 'dynamic';
    return 'other';
}

/**
 * Generate key factors from ad data traits
 */
function generateKeyFactors(adData: ExtractedAdData): Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }> {
    const factors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }> = [];

    // UGC Style is highly impactful
    if (adData.isUGCStyle) {
        factors.push({ factor: 'UGC Style', impact: 'positive', weight: 0.95 });
    } else {
        factors.push({ factor: 'Non-UGC Style', impact: 'neutral', weight: 0.5 });
    }

    // Hook type
    if (adData.hookType === 'curiosity' || adData.hookType === 'shock') {
        factors.push({ factor: `${adData.hookType.charAt(0).toUpperCase() + adData.hookType.slice(1)} Hook`, impact: 'positive', weight: 0.85 });
    } else if (adData.hookType !== 'other') {
        factors.push({ factor: `${adData.hookType.charAt(0).toUpperCase() + adData.hookType.slice(1)} Hook`, impact: 'neutral', weight: 0.65 });
    }

    // Subtitles
    if (adData.hasSubtitles) {
        factors.push({ factor: 'Has Subtitles', impact: 'positive', weight: 0.9 });
    } else {
        factors.push({ factor: 'No Subtitles', impact: 'negative', weight: 0.4 });
    }

    // Platform
    if (adData.platform === 'tiktok') {
        factors.push({ factor: 'TikTok Platform', impact: 'positive', weight: 0.8 });
    } else if (adData.platform === 'facebook') {
        factors.push({ factor: 'Facebook Platform', impact: 'neutral', weight: 0.7 });
    }

    // Voiceover
    if (adData.hasVoiceover) {
        factors.push({ factor: 'Has Voiceover', impact: 'positive', weight: 0.75 });
    }

    // Editing style
    if (adData.editingStyle === 'fast_cuts') {
        factors.push({ factor: 'Fast Cuts Editing', impact: 'positive', weight: 0.7 });
    }

    return factors;
}

/**
 * Generate recommendations based on ad data
 */
function generateRecommendations(adData: ExtractedAdData, score: number): string[] {
    const recommendations: string[] = [];

    if (!adData.isUGCStyle) {
        recommendations.push('Consider using UGC-style content for +15% engagement');
    }

    if (!adData.hasSubtitles) {
        recommendations.push('Add subtitles/captions for +12% watch time');
    }

    if (!adData.hasVoiceover && !adData.hasSubtitles) {
        recommendations.push('Add voiceover or subtitles to improve accessibility');
    }

    if (adData.hookType === 'other') {
        recommendations.push('Try a curiosity or transformation hook for better engagement');
    }

    if (score < 60 && adData.editingStyle !== 'fast_cuts') {
        recommendations.push('Consider faster editing pace to maintain viewer attention');
    }

    return recommendations;
}

/**
 * Generate a complete prediction for an ad
 * Can be called during import, upload save, or sync
 */
export async function generateAdPrediction(ad: Record<string, unknown>): Promise<AdPrediction> {
    try {
        // Build ExtractedAdData from ad object
        const adData = buildExtractedAdData(ad);

        // Call ML system for prediction
        const mlResult = await predictWithML(adData);

        // Generate key factors and recommendations
        const keyFactors = generateKeyFactors(adData);
        const recommendations = generateRecommendations(adData, mlResult.globalScore);

        // Merge with risk assessment recommendations
        if (mlResult.riskAssessment?.potentialFailures) {
            mlResult.riskAssessment.potentialFailures.forEach(failure => {
                if (failure.mitigation && !recommendations.includes(failure.mitigation)) {
                    recommendations.push(failure.mitigation);
                }
            });
        }

        return {
            predictedScore: mlResult.globalScore,
            confidence: mlResult.confidence,
            riskAssessment: mlResult.riskAssessment,
            predictionDetails: {
                globalScore: mlResult.globalScore,
                bestSegment: mlResult.bestSegment,
                segmentScores: mlResult.segmentScores,
                confidence: mlResult.confidence,
                keyFactors,
                recommendations: recommendations.slice(0, 5), // Limit to 5 recommendations
            },
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error generating prediction:', error);

        // Return a basic fallback prediction
        return {
            predictedScore: 50,
            confidence: 20,
            riskAssessment: null,
            predictionDetails: {
                globalScore: 50,
                bestSegment: null,
                segmentScores: [],
                confidence: 20,
                keyFactors: [{ factor: 'Prediction Error', impact: 'neutral', weight: 0.5 }],
                recommendations: ['Unable to generate full prediction. Try adding more ad traits.'],
            },
            generatedAt: new Date().toISOString(),
        };
    }
}

/**
 * Adjust prediction score based on actual Facebook performance metrics
 * Called during sync to update predictions with real data
 */
export function adjustPredictionWithMetrics(
    basePrediction: AdPrediction,
    metrics: Record<string, unknown>
): AdPrediction {
    const ctr = (metrics.ctr as number) || 0;
    const spend = (metrics.spend as number) || 0;
    const results = (metrics.results as number) || (metrics.leads as number) || (metrics.messagesStarted as number) || 0;

    // Calculate performance-adjusted score
    let adjustedScore = basePrediction.predictedScore;
    let adjustedConfidence = basePrediction.confidence;

    // If we have actual performance data, blend it with prediction
    if (spend > 0 && results > 0) {
        // Calculate cost efficiency score
        const costPerResult = spend / results;
        let efficiencyBonus = 0;

        if (costPerResult < 50) efficiencyBonus = 15;
        else if (costPerResult < 100) efficiencyBonus = 10;
        else if (costPerResult < 200) efficiencyBonus = 5;
        else if (costPerResult > 500) efficiencyBonus = -10;

        adjustedScore = Math.min(100, Math.max(0, adjustedScore + efficiencyBonus));
        adjustedConfidence = Math.min(95, adjustedConfidence + 20); // Higher confidence with real data
    }

    // CTR adjustment
    if (ctr > 0) {
        if (ctr >= 3) adjustedScore = Math.min(100, adjustedScore + 10);
        else if (ctr >= 1.5) adjustedScore = Math.min(100, adjustedScore + 5);
        else if (ctr < 0.5) adjustedScore = Math.max(0, adjustedScore - 10);

        adjustedConfidence = Math.min(95, adjustedConfidence + 10);
    }

    return {
        ...basePrediction,
        predictedScore: Math.round(adjustedScore),
        confidence: Math.round(adjustedConfidence),
        generatedAt: new Date().toISOString(),
    };
}

// ============================================
// RAG-ENHANCED PREDICTION (OPTIONAL)
// ============================================

/**
 * Generate prediction using RAG-based similarity + contrastive analysis
 * Falls back to legacy ML if RAG has insufficient data
 * 
 * This wraps the RAG prediction and converts to AdPrediction format
 */
export async function generateAdPredictionWithRAG(ad: Record<string, unknown>): Promise<AdPrediction & {
    ragDetails?: {
        method: 'rag' | 'hybrid' | 'legacy';
        neighborCount: number;
        avgSimilarity: number;
        traitEffects: Array<{
            trait: string;
            lift: number;
            confidence: number;
            recommendation: string;
        }>;
        explanation: string;
        ragScore?: number;
        legacyScore?: number;
        blendAlpha?: number;
    };
}> {
    try {
        // Dynamic import to avoid circular dependencies
        const { predictWithRAG } = await import('./rag');

        // Ensure ad has required shape
        const adEntry = {
            id: (ad.id as string) || `temp-${Date.now()}`,
            mediaUrl: (ad.mediaUrl as string) || (ad.thumbnailUrl as string) || '',
            thumbnailUrl: (ad.thumbnailUrl as string) || '',
            mediaType: (ad.mediaType as 'video' | 'photo') || 'video',
            name: (ad.name as string) || '',
            contentDocument: (ad.contentDocument as string) || '',
            extractedContent: buildExtractedAdData(ad),
            extractedResults: ad.extractedResults as Record<string, unknown> | undefined,
            hasResults: Boolean(ad.hasResults || ad.extractedResults),
            createdAt: (ad.createdAt as string) || new Date().toISOString(),
            updatedAt: (ad.updatedAt as string) || new Date().toISOString(),
        };

        // Get RAG prediction (type assertion since we control the shape)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ragResult = await predictWithRAG(adEntry as any);

        // Convert to AdPrediction format with RAG details
        return {
            predictedScore: ragResult.successProbability,
            confidence: ragResult.confidence,
            riskAssessment: null,
            predictionDetails: {
                globalScore: ragResult.successProbability,
                bestSegment: null,
                segmentScores: [],
                confidence: ragResult.confidence,
                keyFactors: ragResult.traitEffects.slice(0, 5).map(e => ({
                    factor: `${e.trait}=${e.traitValue}`,
                    impact: e.lift > 0 ? 'positive' as const : e.lift < 0 ? 'negative' as const : 'neutral' as const,
                    weight: Math.min(1, Math.abs(e.lift) / 20),
                })),
                recommendations: ragResult.recommendations.slice(0, 5),
            },
            generatedAt: ragResult.generatedAt,
            ragDetails: {
                method: ragResult.method,
                neighborCount: ragResult.neighborCount,
                avgSimilarity: ragResult.avgNeighborSimilarity,
                traitEffects: ragResult.traitEffects.map(e => ({
                    trait: e.trait,
                    lift: e.lift,
                    confidence: e.confidence,
                    recommendation: e.recommendation,
                })),
                explanation: ragResult.explanation,
                ragScore: ragResult.ragScore,
                legacyScore: ragResult.legacyScore,
                blendAlpha: ragResult.blendAlpha,
            },
        };
    } catch (error) {
        console.warn('RAG prediction failed, falling back to legacy:', error);
        // Fall back to legacy prediction
        return generateAdPrediction(ad);
    }
}
