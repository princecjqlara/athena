/**
 * Pattern Mining API Route
 * 
 * GET - Get discovered patterns
 * POST - Mine new patterns from data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    mineSuccessPatterns,
    mineFailurePatterns,
    detectSeasonalPatterns,
    matchPatterns,
    findCrossCampaignInsights,
    type Pattern,
    type SeasonalPattern
} from '@/lib/ai/pattern-mining';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type') || 'all';
        const metric = searchParams.get('metric') || 'roas';

        // In production, fetch from database
        // For now, return sample patterns
        const samplePatterns: Pattern[] = [
            {
                id: 'success_video_content',
                type: 'success',
                name: 'Video content performs well',
                description: 'Campaigns with video creatives show 45% higher ROAS',
                conditions: [{ variable: 'creative_type', operator: 'eq', value: 'video' }],
                effect: { metric: 'roas', direction: 'increase', magnitude: 45, confidence: 0.82 },
                occurrences: 23,
                lastSeen: new Date().toISOString(),
                applicability: {}
            },
            {
                id: 'failure_narrow_audience',
                type: 'failure',
                name: 'Very narrow audiences underperform',
                description: 'Audiences under 100k show 30% lower reach efficiency',
                conditions: [{ variable: 'audience_size', operator: 'lt', value: 100000 }],
                effect: { metric: 'reach_efficiency', direction: 'decrease', magnitude: 30, confidence: 0.75 },
                occurrences: 12,
                lastSeen: new Date().toISOString(),
                applicability: {}
            }
        ];

        const sampleSeasonal: SeasonalPattern = {
            period: 'weekly',
            metric: 'conversions',
            peaks: [
                { label: 'Mon', multiplier: 1.15, confidence: 0.8 },
                { label: 'Thu', multiplier: 1.12, confidence: 0.78 }
            ],
            troughs: [
                { label: 'Sat', multiplier: 0.85, confidence: 0.82 },
                { label: 'Sun', multiplier: 0.88, confidence: 0.79 }
            ]
        };

        if (type === 'seasonal') {
            return NextResponse.json({
                success: true,
                data: { seasonal: sampleSeasonal }
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                patterns: type === 'all'
                    ? samplePatterns
                    : samplePatterns.filter(p => p.type === type),
                seasonal: sampleSeasonal
            }
        });

    } catch (error) {
        console.error('Patterns GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch patterns' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            action,
            historicalRecords,
            metric,
            threshold,
            currentContext,
            campaigns
        } = body;

        switch (action) {
            case 'mine_success': {
                if (!historicalRecords || !metric || threshold === undefined) {
                    return NextResponse.json(
                        { error: 'historicalRecords, metric, and threshold required' },
                        { status: 400 }
                    );
                }
                const patterns = mineSuccessPatterns({
                    historicalRecords,
                    successMetric: metric,
                    successThreshold: threshold
                });
                return NextResponse.json({ success: true, data: patterns });
            }

            case 'mine_failure': {
                if (!historicalRecords || !metric || threshold === undefined) {
                    return NextResponse.json(
                        { error: 'historicalRecords, metric, and threshold required' },
                        { status: 400 }
                    );
                }
                const patterns = mineFailurePatterns({
                    historicalRecords,
                    failureMetric: metric,
                    failureThreshold: threshold
                });
                return NextResponse.json({ success: true, data: patterns });
            }

            case 'detect_seasonal': {
                if (!historicalRecords || !metric) {
                    return NextResponse.json(
                        { error: 'historicalRecords and metric required' },
                        { status: 400 }
                    );
                }
                const pattern = detectSeasonalPatterns({
                    historicalRecords,
                    metric,
                    period: body.period || 'weekly'
                });
                return NextResponse.json({ success: true, data: pattern });
            }

            case 'match': {
                if (!currentContext) {
                    return NextResponse.json(
                        { error: 'currentContext required for matching' },
                        { status: 400 }
                    );
                }
                // In production, fetch patterns from DB
                const patterns = body.patterns || [];
                const insights = matchPatterns({ patterns, currentContext });
                return NextResponse.json({ success: true, data: insights });
            }

            case 'cross_campaign': {
                if (!campaigns || !metric) {
                    return NextResponse.json(
                        { error: 'campaigns array and metric required' },
                        { status: 400 }
                    );
                }
                const patterns = findCrossCampaignInsights({
                    campaigns,
                    targetMetric: metric
                });
                return NextResponse.json({ success: true, data: patterns });
            }

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }

    } catch (error) {
        console.error('Pattern mining error:', error);
        return NextResponse.json(
            { error: 'Failed to mine patterns' },
            { status: 500 }
        );
    }
}
