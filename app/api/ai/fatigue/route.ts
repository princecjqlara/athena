/**
 * Creative Fatigue API Route
 * 
 * GET - Get fatigue status for creatives
 * POST - Analyze creative for fatigue
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    analyzeCreativeFatigue,
    detectFatigueAlerts,
    type FatigueAlert,
    type FatigueAnalysis,
    type FatigueMetrics
} from '@/lib/ai/creative-fatigue';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const creativeId = searchParams.get('creativeId');
        const severity = searchParams.get('severity') || 'all';

        // Sample fatigue alerts - in production, fetch from database
        const sampleAlerts: FatigueAlert[] = [
            {
                alertType: 'fatigue_warning',
                severity: 65,
                detectionMethod: 'ctr_decline',
                message: 'CTR has declined 25% from peak',
                metrics: {
                    ctrDeclinePct: 25,
                    frequencyAtDetection: 3.2,
                    daysRunning: 14,
                    saturationIndex: 0.65
                },
                recommendations: ['Consider refreshing this creative', 'Test new variations']
            }
        ];

        return NextResponse.json({
            success: true,
            data: sampleAlerts,
            filters: { creativeId, severity },
            summary: {
                total: sampleAlerts.length,
                critical: sampleAlerts.filter(a => a.alertType === 'fatigue_critical').length,
                warning: sampleAlerts.filter(a => a.alertType === 'fatigue_warning').length
            }
        });

    } catch (error) {
        console.error('Creative fatigue GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch fatigue alerts' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, creativeId, dailyMetrics, estimatedAudienceSize } = body;

        if (!creativeId) {
            return NextResponse.json(
                { error: 'creativeId is required' },
                { status: 400 }
            );
        }

        if (action === 'analyze') {
            // Full fatigue analysis
            if (!dailyMetrics || !Array.isArray(dailyMetrics)) {
                return NextResponse.json(
                    { error: 'dailyMetrics array is required for analysis' },
                    { status: 400 }
                );
            }

            const analysis: FatigueAnalysis = analyzeCreativeFatigue({
                creativeId,
                dailyMetrics: dailyMetrics as FatigueMetrics[],
                estimatedAudienceSize: estimatedAudienceSize || 1000000
            });

            return NextResponse.json({
                success: true,
                data: analysis
            });
        }

        if (action === 'detect') {
            // Quick fatigue detection
            const { peakCtr, currentCtr, currentFrequency, saturationIndex, daysRunning } = body;

            if (!dailyMetrics) {
                return NextResponse.json(
                    { error: 'dailyMetrics required for detection' },
                    { status: 400 }
                );
            }

            const alerts = detectFatigueAlerts({
                metrics: dailyMetrics as FatigueMetrics[],
                peakCtr: peakCtr || 2.0,
                currentCtr: currentCtr || 1.5,
                currentFrequency: currentFrequency || 2.5,
                saturationIndex: saturationIndex || 0.5,
                daysRunning: daysRunning || 14
            });

            return NextResponse.json({
                success: true,
                data: { alerts }
            });
        }

        // Default: run full analysis
        if (dailyMetrics && Array.isArray(dailyMetrics)) {
            const analysis = analyzeCreativeFatigue({
                creativeId,
                dailyMetrics: dailyMetrics as FatigueMetrics[],
                estimatedAudienceSize: estimatedAudienceSize || 1000000
            });

            return NextResponse.json({
                success: true,
                data: analysis
            });
        }

        return NextResponse.json(
            { error: 'dailyMetrics array is required' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Creative fatigue POST error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze creative fatigue' },
            { status: 500 }
        );
    }
}
