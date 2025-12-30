/**
 * Marketplace Match API Endpoint
 * 
 * POST /api/rag/marketplace-match
 * Finds matching datasets for given data needs
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchDataNeeds, generateSuggestions, getBestMatch, getTotalPotentialGain } from '@/lib/rag/marketplace-matching';
import { getAllDatasets, getTopDatasets, getFreshestDatasets } from '@/lib/rag/marketplace-datasets';
import { DataNeed, DEFAULT_MARKETPLACE_CONFIG } from '@/lib/rag/marketplace-types';

export async function GET() {
    // Return available datasets catalog
    const allDatasets = getAllDatasets(true);
    const topDatasets = getTopDatasets(5);
    const freshestDatasets = getFreshestDatasets(5);

    return NextResponse.json({
        success: true,
        data: {
            endpoint: '/api/rag/marketplace-match',
            methods: ['GET', 'POST'],
            description: 'Find matching datasets for data needs or browse available datasets',
            catalog: {
                totalDatasets: allDatasets.length,
                topByUsage: topDatasets.map(d => ({
                    id: d.id,
                    name: d.name,
                    usageCount: d.usageCount,
                    avgConfidenceGain: d.avgConfidenceGain,
                })),
                freshest: freshestDatasets.map(d => ({
                    id: d.id,
                    name: d.name,
                    freshnessScore: d.freshnessScore,
                    updatedAt: d.updatedAt,
                })),
            },
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dataNeeds, currentConfidence = 50, marketplaceConfig: userConfig } = body as {
            dataNeeds: DataNeed[];
            currentConfidence?: number;
            marketplaceConfig?: Partial<typeof DEFAULT_MARKETPLACE_CONFIG>;
        };

        if (!dataNeeds || !Array.isArray(dataNeeds)) {
            return NextResponse.json(
                { success: false, error: 'dataNeeds array is required' },
                { status: 400 }
            );
        }

        const marketplaceConfig = {
            ...DEFAULT_MARKETPLACE_CONFIG,
            ...userConfig,
        };

        // Find matching datasets
        const matches = matchDataNeeds(dataNeeds, marketplaceConfig);
        const suggestions = generateSuggestions(matches, currentConfidence);
        const bestMatch = getBestMatch(dataNeeds, marketplaceConfig);
        const totalPotentialGain = getTotalPotentialGain(matches);

        return NextResponse.json({
            success: true,
            data: {
                matches: matches.map(m => ({
                    dataset: {
                        id: m.dataset.id,
                        name: m.dataset.name,
                        description: m.dataset.description,
                        sampleCount: m.dataset.sampleCount,
                        freshnessScore: m.dataset.freshnessScore,
                        confidenceScore: m.dataset.confidenceScore,
                        usageCount: m.dataset.usageCount,
                        avgConfidenceGain: m.dataset.avgConfidenceGain,
                        accessTier: m.dataset.accessTier,
                        covers: m.dataset.covers,
                    },
                    scores: {
                        coverage: m.coverageScore,
                        freshness: m.freshnessScore,
                        confidence: m.confidenceScore,
                        match: m.matchScore,
                    },
                    estimatedConfidenceGain: m.estimatedConfidenceGain,
                    addressedNeedsCount: m.addressedNeeds.length,
                    explanation: m.explanation,
                })),
                suggestions: suggestions.map(s => ({
                    headline: s.headline,
                    reason: s.reason,
                    impact: s.impact,
                    datasetId: s.match.dataset.id,
                    datasetName: s.match.dataset.name,
                    matchScore: s.match.matchScore,
                    estimatedConfidenceGain: s.match.estimatedConfidenceGain,
                    priority: s.priority,
                    actions: s.actions,
                })),
                summary: {
                    totalMatches: matches.length,
                    bestMatchId: bestMatch?.dataset.id || null,
                    bestMatchName: bestMatch?.dataset.name || null,
                    bestMatchGain: bestMatch?.estimatedConfidenceGain || 0,
                    totalPotentialGain,
                    currentConfidence,
                    potentialConfidence: Math.min(100, currentConfidence + totalPotentialGain),
                },
            },
        });
    } catch (error) {
        console.error('Marketplace matching error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to match marketplace datasets' },
            { status: 500 }
        );
    }
}
