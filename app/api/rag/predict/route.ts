/**
 * RAG Prediction API Route
 * 
 * POST /api/rag/predict
 * Returns RAG-based prediction for an ad with trait effects and explanations.
 * 
 * SAFETY: Uses safe prediction wrapper with feature flag checks
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    predictWithRAG,
    predictWithRAGOnly,
    getFlags,
    SAFETY_CONFIG,
} from '@/lib/rag';
import { AdEntry } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ad, useHybrid = true } = body;

        if (!ad) {
            return NextResponse.json(
                { success: false, error: 'Ad data is required' },
                { status: 400 }
            );
        }

        // Validate required ad fields
        if (!ad.id || !ad.extractedContent) {
            return NextResponse.json(
                { success: false, error: 'Ad must have id and extractedContent' },
                { status: 400 }
            );
        }

        // SAFETY: Check feature flags for logging
        const flags = getFlags();
        if (flags.enableDebugLogging) {
            console.log('[RAG API] Processing prediction request', {
                adId: ad.id,
                useHybrid,
                ragEnabled: flags.enableRAG
            });
        }

        // Run prediction using the RAG pipeline
        // Note: safePredict wrapper handles fallbacks internally
        const prediction = useHybrid
            ? await predictWithRAG(ad as AdEntry)
            : await predictWithRAGOnly(ad as AdEntry);

        return NextResponse.json({
            success: true,
            data: {
                successProbability: prediction.successProbability,
                confidence: prediction.confidence,
                method: prediction.method,
                ragScore: prediction.ragScore,
                legacyScore: prediction.legacyScore,
                blendAlpha: prediction.blendAlpha,
                neighbors: prediction.neighbors.map(n => ({
                    id: n.orb.id,
                    similarity: n.hybridSimilarity,
                    successScore: n.orb.results?.successScore,
                    platform: n.orb.metadata.platform,
                    traits: Object.keys(n.orb.traits).slice(0, 10),
                })),
                neighborCount: prediction.neighborCount,
                avgNeighborSimilarity: prediction.avgNeighborSimilarity,
                traitEffects: prediction.traitEffects.map(e => ({
                    trait: e.trait,
                    traitValue: e.traitValue,
                    lift: e.lift,
                    liftPercent: e.liftPercent,
                    confidence: e.confidence,
                    n_with: e.n_with,
                    n_without: e.n_without,
                    recommendation: e.recommendation,
                })),
                explanation: prediction.explanation,
                explanationDetails: prediction.explanationDetails,
                recommendations: prediction.recommendations,
                experimentsToRun: prediction.experimentsToRun,
                generatedAt: prediction.generatedAt,
                computeTimeMs: prediction.computeTimeMs,
            },
        });
    } catch (error) {
        console.error('RAG prediction error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Prediction failed'
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        data: {
            endpoint: '/api/rag/predict',
            method: 'POST',
            description: 'RAG-based ad prediction with contrastive analysis',
            requiredBody: {
                ad: 'AdEntry object with id and extractedContent',
                useHybrid: 'boolean (optional, default true) - blend with legacy predictor',
            },
            response: {
                successProbability: 'number (0-100)',
                confidence: 'number (0-100)',
                method: '"rag" | "hybrid" | "legacy"',
                traitEffects: 'array of trait impact analyses',
                explanation: 'human-readable explanation',
                recommendations: 'array of actionable suggestions',
            },
        },
    });
}
