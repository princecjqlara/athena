import { NextRequest, NextResponse } from 'next/server';
import { submitContribution, ciSettings, UserContribution } from '@/lib/collective-intelligence';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/collective/contribute
 * Submit anonymized feature signals after a conversion
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured'
        }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { userId, contributions } = body;

        if (!userId) {
            return NextResponse.json({
                success: false,
                error: 'userId is required'
            }, { status: 400 });
        }

        if (!contributions || !Array.isArray(contributions)) {
            return NextResponse.json({
                success: false,
                error: 'contributions array is required'
            }, { status: 400 });
        }

        // Get user settings to check if opted in
        const settings = await ciSettings.get(userId);

        if (!settings || !settings.opted_in) {
            return NextResponse.json({
                success: false,
                error: 'User is not opted in to collective intelligence'
            }, { status: 403 });
        }

        if (settings.participation_mode === 'receive_only') {
            return NextResponse.json({
                success: false,
                error: 'User is in receive-only mode'
            }, { status: 403 });
        }

        // Submit each contribution
        let submitted = 0;
        for (const contribution of contributions as UserContribution[]) {
            const success = await submitContribution(
                settings.contributor_hash || `anon_${Date.now()}`,
                contribution
            );
            if (success) submitted++;
        }

        // Update local data points
        await ciSettings.incrementDataPoints(userId, true);

        return NextResponse.json({
            success: true,
            submitted,
            message: `${submitted} contributions submitted anonymously`
        });

    } catch (error) {
        console.error('[CI API] Error submitting contribution:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to submit contribution'
        }, { status: 500 });
    }
}
