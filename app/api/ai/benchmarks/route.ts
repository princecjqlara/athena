/**
 * Benchmarking API Route
 * 
 * GET - Get industry benchmarks
 * POST - Contribute anonymized data or compare to benchmarks
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    generateBenchmark,
    compareToIndustry,
    anonymizeContribution,
    getAvailableDimensions,
    getBenchmarkTrend,
    type BenchmarkData,
    type BenchmarkDimensions
} from '@/lib/ai/benchmarking';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action') || 'benchmarks';
        const industry = searchParams.get('industry');
        const metric = searchParams.get('metric') || 'cpa';
        const period = searchParams.get('period') || '2024-Q4';

        // Sample benchmark data - in production, fetch from database
        const sampleBenchmarks: BenchmarkData[] = [
            {
                dimensions: { industry: 'ecommerce', companySize: 'medium' },
                period: '2024-Q4',
                metric: 'cpa',
                values: { p10: 5.50, p25: 8.20, p50: 12.50, p75: 18.30, p90: 28.00, mean: 14.20, stdDev: 7.80 },
                sampleSize: 142,
                lastUpdated: new Date().toISOString()
            },
            {
                dimensions: { industry: 'ecommerce', companySize: 'medium' },
                period: '2024-Q4',
                metric: 'roas',
                values: { p10: 1.20, p25: 1.80, p50: 2.50, p75: 3.80, p90: 5.50, mean: 2.85, stdDev: 1.45 },
                sampleSize: 142,
                lastUpdated: new Date().toISOString()
            },
            {
                dimensions: { industry: 'ecommerce', companySize: 'medium' },
                period: '2024-Q4',
                metric: 'ctr',
                values: { p10: 0.80, p25: 1.10, p50: 1.50, p75: 2.10, p90: 3.00, mean: 1.65, stdDev: 0.72 },
                sampleSize: 142,
                lastUpdated: new Date().toISOString()
            },
            {
                dimensions: { industry: 'saas', companySize: 'small' },
                period: '2024-Q4',
                metric: 'cpa',
                values: { p10: 35.00, p25: 55.00, p50: 85.00, p75: 125.00, p90: 180.00, mean: 95.00, stdDev: 48.00 },
                sampleSize: 87,
                lastUpdated: new Date().toISOString()
            }
        ];

        if (action === 'dimensions') {
            const dimensions = getAvailableDimensions(sampleBenchmarks);
            return NextResponse.json({ success: true, data: dimensions });
        }

        if (action === 'trend') {
            const dimensions: BenchmarkDimensions = {};
            if (industry) dimensions.industry = industry;

            const trend = getBenchmarkTrend({
                benchmarks: sampleBenchmarks,
                metric,
                dimensions
            });
            return NextResponse.json({ success: true, data: trend });
        }

        // Filter benchmarks
        let filtered = sampleBenchmarks;
        if (industry) {
            filtered = filtered.filter(b => b.dimensions.industry === industry);
        }
        if (metric !== 'all') {
            filtered = filtered.filter(b => b.metric === metric);
        }

        return NextResponse.json({
            success: true,
            data: filtered
        });

    } catch (error) {
        console.error('Benchmarking GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch benchmarks' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'contribute') {
            // Anonymize and contribute data
            const { organizationId, period, dimensions, rawMetrics } = body;

            if (!organizationId || !period || !rawMetrics) {
                return NextResponse.json(
                    { error: 'organizationId, period, and rawMetrics are required' },
                    { status: 400 }
                );
            }

            const contribution = anonymizeContribution({
                organizationId,
                period,
                dimensions: dimensions || {},
                rawMetrics
            });

            // In production, save to database
            return NextResponse.json({
                success: true,
                data: {
                    contributed: true,
                    anonymizedId: contribution.organizationId,
                    metricsCount: Object.keys(contribution.metrics).length
                }
            });
        }

        if (action === 'compare') {
            // Compare your metrics to industry
            const { yourMetrics, industry, companySize, period } = body;

            if (!yourMetrics) {
                return NextResponse.json(
                    { error: 'yourMetrics are required' },
                    { status: 400 }
                );
            }

            // Sample benchmarks - in production, fetch matching from database
            const sampleBenchmarks: BenchmarkData[] = [
                {
                    dimensions: { industry: industry || 'ecommerce', companySize: companySize || 'medium' },
                    period: period || '2024-Q4',
                    metric: 'cpa',
                    values: { p10: 5.50, p25: 8.20, p50: 12.50, p75: 18.30, p90: 28.00, mean: 14.20, stdDev: 7.80 },
                    sampleSize: 142,
                    lastUpdated: new Date().toISOString()
                },
                {
                    dimensions: { industry: industry || 'ecommerce', companySize: companySize || 'medium' },
                    period: period || '2024-Q4',
                    metric: 'roas',
                    values: { p10: 1.20, p25: 1.80, p50: 2.50, p75: 3.80, p90: 5.50, mean: 2.85, stdDev: 1.45 },
                    sampleSize: 142,
                    lastUpdated: new Date().toISOString()
                },
                {
                    dimensions: { industry: industry || 'ecommerce', companySize: companySize || 'medium' },
                    period: period || '2024-Q4',
                    metric: 'ctr',
                    values: { p10: 0.80, p25: 1.10, p50: 1.50, p75: 2.10, p90: 3.00, mean: 1.65, stdDev: 0.72 },
                    sampleSize: 142,
                    lastUpdated: new Date().toISOString()
                }
            ];

            const comparison = compareToIndustry({ yourMetrics, benchmarks: sampleBenchmarks });

            return NextResponse.json({
                success: true,
                data: comparison
            });
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
        );

    } catch (error) {
        console.error('Benchmarking POST error:', error);
        return NextResponse.json(
            { error: 'Failed to process benchmarking request' },
            { status: 500 }
        );
    }
}
