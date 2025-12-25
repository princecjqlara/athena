import { NextRequest, NextResponse } from 'next/server';
import { collectivePriors, ciStats } from '@/lib/collective-intelligence';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/collective/priors
 * Fetch collective priors (shared feature weights)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const featureName = searchParams.get('feature') || undefined;

    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured',
            data: []
        }, { status: 500 });
    }

    try {
        if (featureName) {
            // Get specific feature prior
            const prior = await collectivePriors.getByFeature(featureName, category);
            return NextResponse.json({
                success: true,
                data: prior,
            });
        }

        // Get all priors
        const priors = await collectivePriors.getAll(category);

        return NextResponse.json({
            success: true,
            data: priors,
            count: priors.length,
        });

    } catch (error) {
        console.error('[CI API] Error fetching priors:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch priors'
        }, { status: 500 });
    }
}
