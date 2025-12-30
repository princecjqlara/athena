/**
 * RAG Similar Ads API Route
 * 
 * POST /api/rag/similar
 * Returns similar ads for a given ad using RAG retrieval.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    convertToAdOrb,
    generateOrbEmbedding,
    retrieveSimilarAds,
    getNeighborStats,
    saveOrb,
} from '@/lib/rag';
import { AdEntry } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            ad,
            k = 20,
            filters = {},
            includeWithoutResults = false
        } = body;

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

        // Convert to orb and generate embedding
        let orb = convertToAdOrb(ad as AdEntry);
        orb = await generateOrbEmbedding(orb);
        saveOrb(orb);

        // Prepare filters
        const retrievalFilters = {
            ...filters,
            requireResults: !includeWithoutResults,
        };

        // Retrieve similar ads
        const neighbors = await retrieveSimilarAds(orb, k, retrievalFilters);
        const stats = getNeighborStats(neighbors);

        return NextResponse.json({
            success: true,
            data: {
                query: {
                    id: orb.id,
                    platform: orb.metadata.platform,
                    traitCount: Object.keys(orb.traits).length,
                },
                neighbors: neighbors.map(n => ({
                    id: n.orb.id,
                    vectorSimilarity: Math.round(n.vectorSimilarity * 100) / 100,
                    structuredSimilarity: Math.round(n.structuredSimilarity * 100) / 100,
                    hybridSimilarity: Math.round(n.hybridSimilarity * 100) / 100,
                    recencyWeight: Math.round(n.recencyWeight * 100) / 100,
                    weightedSimilarity: Math.round(n.weightedSimilarity * 100) / 100,
                    successScore: n.orb.results?.successScore,
                    platform: n.orb.metadata.platform,
                    objective: n.orb.metadata.objective,
                    createdAt: n.orb.metadata.createdAt,
                    hasResults: n.orb.metadata.hasResults,
                    traits: n.orb.traits,
                })),
                stats: {
                    count: stats.count,
                    avgSimilarity: Math.round(stats.avgSimilarity * 100) / 100,
                    avgVectorSimilarity: Math.round(stats.avgVectorSimilarity * 100) / 100,
                    avgStructuredSimilarity: Math.round(stats.avgStructuredSimilarity * 100) / 100,
                    avgRecency: Math.round(stats.avgRecency * 100) / 100,
                    avgSuccessScore: Math.round(stats.avgSuccessScore * 10) / 10,
                    variance: Math.round(stats.variance * 10) / 10,
                    minSimilarity: Math.round(stats.minSimilarity * 100) / 100,
                    maxSimilarity: Math.round(stats.maxSimilarity * 100) / 100,
                },
            },
        });
    } catch (error) {
        console.error('RAG similar ads error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Retrieval failed'
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        data: {
            endpoint: '/api/rag/similar',
            method: 'POST',
            description: 'Retrieve similar ads using RAG-based vector + structured similarity',
            requiredBody: {
                ad: 'AdEntry object with id and extractedContent',
                k: 'number (optional, default 20) - number of neighbors to return',
                filters: {
                    platform: 'string (optional) - filter by platform',
                    objective: 'string (optional) - filter by objective',
                    maxAgeDays: 'number (optional) - max age in days',
                    minSuccessScore: 'number (optional) - min success score',
                },
                includeWithoutResults: 'boolean (optional, default false) - include ads without results',
            },
            response: {
                query: 'query ad summary',
                neighbors: 'array of similar ads with similarity scores',
                stats: 'aggregate statistics about neighbors',
            },
        },
    });
}
