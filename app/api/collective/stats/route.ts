import { NextRequest, NextResponse } from 'next/server';
import { ciStats, collectivePriors } from '@/lib/collective-intelligence';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/collective/stats
 * Get collective intelligence statistics and insights
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;

    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured',
            data: null
        }, { status: 500 });
    }

    try {
        // Get overall stats
        const stats = await ciStats.getStats();

        // Get top features for the category
        const topFeatures = await collectivePriors.getTopFeatures(10, category);

        // Find surprise findings (features that outperform expectations)
        const surpriseFeatures = topFeatures.filter(f => f.lift_percentage > 15);

        return NextResponse.json({
            success: true,
            data: {
                totalContributions: stats.totalContributions,
                totalFeatures: stats.totalFeatures,
                avgConfidence: stats.avgConfidence,
                topFeatures: topFeatures.map(f => ({
                    feature: f.feature_name,
                    liftPercentage: f.lift_percentage,
                    confidence: f.confidence,
                    contributions: f.contribution_count,
                })),
                surpriseFindings: surpriseFeatures.map(f => ({
                    feature: f.feature_name,
                    insight: `"${f.feature_name}" shows ${f.lift_percentage.toFixed(1)}% lift`,
                })),
            },
        });

    } catch (error) {
        console.error('[CI API] Error fetching stats:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch stats'
        }, { status: 500 });
    }
}
