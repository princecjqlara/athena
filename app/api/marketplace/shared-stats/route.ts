/**
 * Shared Statistics API Endpoint
 * 
 * POST /api/marketplace/shared-stats
 * Get and submit anonymized, aggregated trait statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    generateSharedStats,
    loadSharedStats,
    saveSharedStats,
    canContribute,
    anonymizeStat,
} from '@/lib/rag/shared-stats';
import { SharedContrastStat, SHARED_STATS_CONFIG } from '@/lib/rag/marketplace-types';
import { TraitEffect } from '@/lib/rag/types';

export async function GET() {
    try {
        // Return available shared statistics
        const stats = loadSharedStats();

        return NextResponse.json({
            success: true,
            data: {
                endpoint: '/api/marketplace/shared-stats',
                methods: ['GET', 'POST'],
                description: 'Get or submit anonymized, aggregated trait statistics for collective intelligence',
                privacyInfo: {
                    minSamplesForSharing: SHARED_STATS_CONFIG.minSamplesForSharing,
                    minContributorsForUse: SHARED_STATS_CONFIG.minContributorsForUse,
                    maxSharedDataWeight: SHARED_STATS_CONFIG.maxAlphaForSharedData,
                },
                availableStats: stats.length,
                stats: stats.map(s => ({
                    trait: s.trait,
                    avgLift: s.avgLift,
                    confidence: s.confidence,
                    sampleSize: s.sampleSize,
                    context: s.context,
                })),
            },
        });
    } catch (error) {
        console.error('Failed to load shared stats:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load shared statistics' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, traitEffects, context, localSamples } = body as {
            action: 'contribute' | 'retrieve';
            traitEffects?: TraitEffect[];
            context?: { platform?: string };
            localSamples?: number;
        };

        if (action === 'retrieve') {
            // Return all available shared stats
            const stats = loadSharedStats();

            return NextResponse.json({
                success: true,
                data: {
                    stats,
                    count: stats.length,
                },
            });
        }

        if (action === 'contribute') {
            if (!traitEffects || !Array.isArray(traitEffects)) {
                return NextResponse.json(
                    { success: false, error: 'traitEffects array is required for contribution' },
                    { status: 400 }
                );
            }

            if (!canContribute(localSamples || 0)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Minimum ${SHARED_STATS_CONFIG.minSamplesForSharing} local samples required to contribute`,
                    },
                    { status: 400 }
                );
            }

            // Generate anonymized stats from trait effects
            const newStats = generateSharedStats(traitEffects, context as { platform?: undefined });

            // Anonymize before saving
            const anonymizedStats = newStats.map(s => anonymizeStat(s));

            // Load existing stats and merge
            const existingStats = loadSharedStats();

            // Merge: for same trait, aggregate the values
            const mergedStats = [...existingStats];

            for (const newStat of anonymizedStats) {
                const existingIndex = mergedStats.findIndex(
                    s => s.trait === newStat.trait &&
                        s.context.platform === newStat.context.platform
                );

                if (existingIndex >= 0) {
                    // Weighted average merge
                    const existing = mergedStats[existingIndex];
                    const totalSamples = existing.sampleSize + newStat.sampleSize;

                    mergedStats[existingIndex] = {
                        ...existing,
                        avgLift: (existing.avgLift * existing.sampleSize + newStat.avgLift * newStat.sampleSize) / totalSamples,
                        variance: (existing.variance * existing.sampleSize + newStat.variance * newStat.sampleSize) / totalSamples,
                        confidence: (existing.confidence * existing.sampleSize + newStat.confidence * newStat.sampleSize) / totalSamples,
                        sampleSize: totalSamples,
                        minContributors: existing.minContributors + 1,
                        aggregatedAt: new Date().toISOString(),
                    };
                } else {
                    mergedStats.push(newStat);
                }
            }

            // Save updated stats
            saveSharedStats(mergedStats);

            return NextResponse.json({
                success: true,
                data: {
                    contributed: anonymizedStats.length,
                    totalStats: mergedStats.length,
                    message: `Successfully contributed ${anonymizedStats.length} anonymized statistics`,
                },
            });
        }

        return NextResponse.json(
            { success: false, error: 'Invalid action. Use "contribute" or "retrieve"' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Shared stats error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process shared statistics request' },
            { status: 500 }
        );
    }
}
