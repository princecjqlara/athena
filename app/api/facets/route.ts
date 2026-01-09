/**
 * Facet Intelligence API
 * 
 * Provides ML-powered insights from facet data:
 * - GET: Get insights from localStorage ads
 * - POST: Analyze provided facet data or predict for new combination
 */

import { NextResponse } from 'next/server';
import {
    analyzeFacets,
    predictFromFacets,
    calculateTraitEffects,
    analyzeCoOccurrence,
    FacetAd
} from '@/lib/ml/facet-intelligence';
import {
    autoConvertToFacetAds,
    standardAdsToFacetAds
} from '@/lib/ml/facet-converter';

// ============================================
// GET - Get insights from provided data
// ============================================

export async function GET() {
    try {
        // This endpoint requires POST with data
        // GET returns usage information
        return NextResponse.json({
            success: true,
            usage: {
                post: {
                    analyze: 'POST with { action: "analyze", ads: [...] } to get full insights',
                    predict: 'POST with { action: "predict", facets: {...}, traitEffects: [...] } to predict score',
                },
            },
            example: {
                action: 'analyze',
                ads: [
                    {
                        id: 'ad-1',
                        facets: { content_hook: ['curiosity'], platform_placement: ['tiktok'] },
                        successScore: 78
                    }
                ]
            }
        });
    } catch (error) {
        console.error('[Facet API] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process request'
        }, { status: 500 });
    }
}

// ============================================
// POST - Analyze data or predict
// ============================================

interface AnalyzeRequest {
    action: 'analyze';
    ads: unknown[];
}

interface PredictRequest {
    action: 'predict';
    facets: Record<string, string[]>;
    traitEffects?: unknown[];
    coOccurrences?: unknown[];
}

interface ConvertRequest {
    action: 'convert';
    data: unknown;
}

type RequestBody = AnalyzeRequest | PredictRequest | ConvertRequest;

export async function POST(request: Request) {
    try {
        const body = await request.json() as RequestBody;
        const { action } = body;

        // ----------------------------------------
        // ANALYZE: Full insights from ad data
        // ----------------------------------------
        if (action === 'analyze') {
            const { ads } = body as AnalyzeRequest;

            if (!ads || !Array.isArray(ads)) {
                return NextResponse.json({
                    success: false,
                    error: 'ads array is required'
                }, { status: 400 });
            }

            // Convert to FacetAd format
            const facetAds = autoConvertToFacetAds(ads);

            if (facetAds.length === 0) {
                return NextResponse.json({
                    success: false,
                    error: 'No valid ads found. Ensure ads have facets and successScore.',
                    hint: 'Each ad needs: { id, facets: { category: [...values] }, successScore: 0-100 }'
                }, { status: 400 });
            }

            // Run full analysis
            const insights = analyzeFacets(facetAds);

            return NextResponse.json({
                success: true,
                adsProcessed: facetAds.length,
                insights: {
                    summary: insights.summary,
                    topCoOccurrences: insights.coOccurrences.slice(0, 10),
                    contrastive: {
                        topTraits: insights.contrastive.topTraits.slice(0, 5),
                        bottomTraits: insights.contrastive.bottomTraits.slice(0, 5),
                        differentiators: insights.contrastive.differentiators.slice(0, 5),
                    },
                    suggestions: insights.suggestions.slice(0, 5),
                    traitEffects: insights.traitEffects.filter(t => t.isSignificant).slice(0, 15),
                },
                fullData: insights, // Include full data for detailed views
            });
        }

        // ----------------------------------------
        // PREDICT: Score for new facet combination
        // ----------------------------------------
        if (action === 'predict') {
            const { facets, traitEffects, coOccurrences } = body as PredictRequest;

            if (!facets || typeof facets !== 'object') {
                return NextResponse.json({
                    success: false,
                    error: 'facets object is required'
                }, { status: 400 });
            }

            // If trait effects provided, use them; otherwise return error
            if (!traitEffects || !Array.isArray(traitEffects)) {
                return NextResponse.json({
                    success: false,
                    error: 'traitEffects array is required. First call analyze to get trait effects.',
                    hint: 'Call POST /api/facets with action="analyze" first to get traitEffects'
                }, { status: 400 });
            }

            const prediction = predictFromFacets(
                facets,
                traitEffects as Parameters<typeof predictFromFacets>[1],
                (coOccurrences || []) as Parameters<typeof predictFromFacets>[2]
            );

            return NextResponse.json({
                success: true,
                facets,
                prediction: {
                    score: prediction.score,
                    confidence: prediction.confidence,
                    breakdown: prediction.breakdown,
                },
            });
        }

        // ----------------------------------------
        // CONVERT: Convert data to FacetAd format
        // ----------------------------------------
        if (action === 'convert') {
            const { data } = body as ConvertRequest;

            if (!data) {
                return NextResponse.json({
                    success: false,
                    error: 'data is required'
                }, { status: 400 });
            }

            const facetAds = autoConvertToFacetAds(data);

            return NextResponse.json({
                success: true,
                converted: facetAds.length,
                ads: facetAds,
            });
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action. Use: analyze, predict, or convert'
        }, { status: 400 });

    } catch (error) {
        console.error('[Facet API] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
