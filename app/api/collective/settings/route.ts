import { NextRequest, NextResponse } from 'next/server';
import { ciSettings, calculateBlendRatio } from '@/lib/collective-intelligence';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/collective/settings
 * Get user's collective intelligence settings
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({
            success: false,
            error: 'userId is required'
        }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured',
        }, { status: 500 });
    }

    try {
        const settings = await ciSettings.get(userId);

        if (!settings) {
            // Return default settings for new users
            return NextResponse.json({
                success: true,
                data: {
                    user_id: userId,
                    opted_in: false,
                    participation_mode: 'private',
                    local_data_points: 0,
                    local_conversions: 0,
                    blend_ratio: calculateBlendRatio(0),
                    collective_influence: 80, // % that collective has
                },
            });
        }

        const blendRatio = calculateBlendRatio(settings.local_data_points);

        // Derive toggle values from participation mode for backward compatibility
        const receivePublicData = settings.participation_mode !== 'private';
        const autoShareData = settings.participation_mode === 'contribute_receive';

        return NextResponse.json({
            success: true,
            data: {
                ...settings,
                blend_ratio: blendRatio,
                collective_influence: Math.round((1 - blendRatio) * 100),
                receive_public_data: receivePublicData,
                auto_share_data: autoShareData,
            },
        });


    } catch (error) {
        console.error('[CI API] Error fetching settings:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch settings'
        }, { status: 500 });
    }
}

/**
 * POST /api/collective/settings
 * Update user's collective intelligence settings
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
        const { userId, optedIn, participationMode, shareCategory } = body;

        if (!userId) {
            return NextResponse.json({
                success: false,
                error: 'userId is required'
            }, { status: 400 });
        }

        const updated = await ciSettings.upsert({
            user_id: userId,
            opted_in: optedIn ?? false,
            participation_mode: participationMode || 'private',
            share_category: shareCategory ?? true,
        });

        if (!updated) {
            return NextResponse.json({
                success: false,
                error: 'Failed to update settings'
            }, { status: 500 });
        }

        // Derive toggle values from participation mode for the response
        const receivePublicData = participationMode !== 'private';
        const autoShareData = participationMode === 'contribute_receive';
        const blendRatio = calculateBlendRatio(updated.local_data_points || 0);

        return NextResponse.json({
            success: true,
            data: {
                ...updated,
                blend_ratio: blendRatio,
                collective_influence: Math.round((1 - blendRatio) * 100),
                receive_public_data: receivePublicData,
                auto_share_data: autoShareData,
            },
            message: optedIn
                ? 'You are now contributing to collective intelligence!'
                : 'Collective intelligence disabled',
        });

    } catch (error) {
        console.error('[CI API] Error updating settings:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to update settings'
        }, { status: 500 });
    }
}
