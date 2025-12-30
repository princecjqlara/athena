/**
 * Data Needs API Endpoint
 * 
 * POST /api/rag/data-needs
 * Analyzes an ad for data gaps and returns marketplace suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectDataNeeds, shouldShowMarketplaceSuggestions } from '@/lib/rag/data-needs';
import { matchDataNeeds, generateSuggestions } from '@/lib/rag/marketplace-matching';
import { convertToAdOrb } from '@/lib/rag/ad-orb';
import { generateOrbEmbedding } from '@/lib/rag/build-embedding';
import { retrieveSimilarAdsWithResults, getNeighborStats } from '@/lib/rag/retrieve-similar';
import { performContrastiveAnalysis, getTopImpactfulTraits } from '@/lib/rag/contrastive-analysis';
import { DEFAULT_RAG_CONFIG } from '@/lib/rag/types';
import { DEFAULT_MARKETPLACE_CONFIG } from '@/lib/rag/marketplace-types';
import { AdEntry } from '@/types';

export async function GET() {
    return NextResponse.json({
        success: true,
        data: {
            endpoint: '/api/rag/data-needs',
            method: 'POST',
            description: 'Analyze an ad for data gaps and get marketplace suggestions',
            requestBody: {
                ad: 'AdEntry object',
                marketplaceConfig: 'Optional marketplace configuration overrides',
            },
            response: {
                dataNeeds: 'Array of DataNeed objects',
                suggestions: 'Array of MarketplaceSuggestion objects',
                gapAnalysis: 'Summary of gap analysis',
            },
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ad, marketplaceConfig: userConfig } = body as {
            ad: AdEntry;
            marketplaceConfig?: Partial<typeof DEFAULT_MARKETPLACE_CONFIG>;
        };

        if (!ad) {
            return NextResponse.json(
                { success: false, error: 'Ad is required' },
                { status: 400 }
            );
        }

        const config = DEFAULT_RAG_CONFIG;
        const marketplaceConfig = {
            ...DEFAULT_MARKETPLACE_CONFIG,
            ...userConfig,
        };

        // Convert ad to orb
        let orb = convertToAdOrb(ad);
        orb = await generateOrbEmbedding(orb);

        // Retrieve neighbors
        const neighbors = await retrieveSimilarAdsWithResults(
            orb,
            config.defaultK,
            undefined,
            config
        );
        const neighborStats = getNeighborStats(neighbors);

        // Perform contrastive analysis
        const analysis = performContrastiveAnalysis(orb, neighbors, config);
        const traitEffects = getTopImpactfulTraits(analysis, 20);

        // Calculate confidence (simplified)
        const confidence = Math.min(100, neighbors.length * 10);

        // Check if marketplace suggestions should be shown
        const shouldShow = shouldShowMarketplaceSuggestions(
            neighbors.length,
            confidence,
            neighborStats.avgSimilarity,
            marketplaceConfig
        );

        if (!shouldShow) {
            return NextResponse.json({
                success: true,
                data: {
                    dataNeeds: [],
                    suggestions: [],
                    gapAnalysis: {
                        hasSignificantGaps: false,
                        totalGaps: 0,
                        potentialConfidenceGain: 0,
                        currentConfidence: confidence,
                    },
                    message: 'No significant data gaps detected',
                },
            });
        }

        // Detect data needs
        const gapAnalysis = detectDataNeeds(
            neighbors,
            traitEffects,
            orb.metadata.platform,
            confidence,
            config,
            marketplaceConfig
        );

        // Match with marketplace datasets
        const matches = matchDataNeeds(gapAnalysis.dataNeeds, marketplaceConfig);
        const suggestions = generateSuggestions(matches, confidence);

        return NextResponse.json({
            success: true,
            data: {
                dataNeeds: gapAnalysis.dataNeeds,
                suggestions: suggestions.map(s => ({
                    datasetId: s.match.dataset.id,
                    datasetName: s.match.dataset.name,
                    description: s.match.dataset.description,
                    matchScore: s.match.matchScore,
                    estimatedConfidenceGain: s.match.estimatedConfidenceGain,
                    headline: s.headline,
                    reason: s.reason,
                    impact: s.impact,
                    addressedNeeds: s.match.addressedNeeds.map(n => n.id),
                })),
                gapAnalysis: {
                    hasSignificantGaps: gapAnalysis.hasSignificantGaps,
                    totalGaps: gapAnalysis.totalGaps,
                    highSeverityCount: gapAnalysis.highSeverityCount,
                    mediumSeverityCount: gapAnalysis.mediumSeverityCount,
                    lowSeverityCount: gapAnalysis.lowSeverityCount,
                    currentConfidence: gapAnalysis.currentConfidence,
                    potentialConfidence: gapAnalysis.potentialConfidence,
                    maxConfidenceGain: gapAnalysis.maxConfidenceGain,
                    primaryGapDimension: gapAnalysis.primaryGapDimension,
                },
            },
        });
    } catch (error) {
        console.error('Data needs analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to analyze data needs' },
            { status: 500 }
        );
    }
}
