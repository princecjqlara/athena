// POST /api/data-pools/share - Share ad to a data pool
// GET /api/data-pools/share - Get user's shares

import { NextRequest, NextResponse } from 'next/server';
import { shareAdToPool, unshareFromPool, getUserShares } from '@/lib/pool/share';

// POST - Share an ad to a pool
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, poolId, adId } = body;

        // Validation
        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (!poolId) {
            return NextResponse.json(
                { success: false, error: 'Pool ID is required' },
                { status: 400 }
            );
        }

        if (!adId) {
            return NextResponse.json(
                { success: false, error: 'Ad ID is required' },
                { status: 400 }
            );
        }

        // Share the ad
        const result = await shareAdToPool(userId, poolId, adId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: result.message,
            data: {
                contributionId: result.contributionId,
                poolStats: result.poolStats,
            }
        });

    } catch (error) {
        console.error('Share API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Get user's shares
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        const result = await getUserShares(userId);

        return NextResponse.json({
            success: result.success,
            data: result.shares,
            count: result.shares.length,
        });

    } catch (error) {
        console.error('Get shares API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE - Remove a share
export async function DELETE(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('userId');
        const poolId = searchParams.get('poolId');
        const adId = searchParams.get('adId');

        if (!userId || !poolId || !adId) {
            return NextResponse.json(
                { success: false, error: 'userId, poolId, and adId are required' },
                { status: 400 }
            );
        }

        const result = await unshareFromPool(userId, poolId, adId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: result.message,
        });

    } catch (error) {
        console.error('Unshare API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
