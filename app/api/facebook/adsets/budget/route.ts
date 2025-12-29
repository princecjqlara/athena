import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/facebook/adsets/budget
 * Update ad set budget
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            adsetId,
            dailyBudget,      // In currency units (e.g., 100 for $100)
            lifetimeBudget,   // In currency units
            bidAmount,        // In currency units (for manual bidding)
            accessToken
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;

        if (!adsetId) {
            return NextResponse.json(
                { success: false, error: 'Missing adsetId' },
                { status: 400 }
            );
        }

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Missing accessToken. Set META_MARKETING_TOKEN in environment variables or provide in request.' },
                { status: 400 }
            );
        }

        if (dailyBudget === undefined && lifetimeBudget === undefined && bidAmount === undefined) {
            return NextResponse.json(
                { success: false, error: 'Must provide at least one of: dailyBudget, lifetimeBudget, or bidAmount' },
                { status: 400 }
            );
        }

        // Facebook API expects budget in cents (multiply by 100)
        const updates: Record<string, number | string> = {};

        if (dailyBudget !== undefined) {
            updates.daily_budget = Math.round(dailyBudget * 100);
        }

        if (lifetimeBudget !== undefined) {
            updates.lifetime_budget = Math.round(lifetimeBudget * 100);
        }

        if (bidAmount !== undefined) {
            updates.bid_amount = Math.round(bidAmount * 100);
        }

        const updateUrl = `https://graph.facebook.com/v24.0/${adsetId}`;
        const response = await fetch(updateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...updates,
                access_token: token
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API error:', data.error);

            // Handle common budget errors with user-friendly messages
            let errorMessage = data.error.message;
            if (data.error.code === 100) {
                if (errorMessage.includes('daily_budget')) {
                    errorMessage = 'Daily budget must be at least ₱200 (or your currency equivalent minimum)';
                } else if (errorMessage.includes('lifetime_budget')) {
                    errorMessage = 'Lifetime budget must be at least ₱200 (or your currency equivalent minimum)';
                }
            }

            return NextResponse.json(
                {
                    success: false,
                    error: errorMessage,
                    errorCode: data.error.code,
                    errorSubcode: data.error.error_subcode
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            adsetId,
            updates: {
                dailyBudget: dailyBudget !== undefined ? dailyBudget : undefined,
                lifetimeBudget: lifetimeBudget !== undefined ? lifetimeBudget : undefined,
                bidAmount: bidAmount !== undefined ? bidAmount : undefined
            },
            message: 'Ad set budget updated successfully'
        });

    } catch (error) {
        console.error('Budget update error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to update budget' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/facebook/adsets/budget
 * Get current budget for an ad set
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const adsetId = searchParams.get('adsetId');
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;

    if (!adsetId) {
        return NextResponse.json(
            { success: false, error: 'Missing adsetId parameter' },
            { status: 400 }
        );
    }

    if (!accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing accessToken' },
            { status: 400 }
        );
    }

    try {
        const url = `https://graph.facebook.com/v24.0/${adsetId}?fields=id,name,daily_budget,lifetime_budget,bid_amount,optimization_goal,billing_event,status&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            return NextResponse.json(
                { success: false, error: data.error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            adset: {
                id: data.id,
                name: data.name,
                status: data.status,
                dailyBudget: data.daily_budget ? parseFloat(data.daily_budget) / 100 : null,
                lifetimeBudget: data.lifetime_budget ? parseFloat(data.lifetime_budget) / 100 : null,
                bidAmount: data.bid_amount ? parseFloat(data.bid_amount) / 100 : null,
                optimizationGoal: data.optimization_goal,
                billingEvent: data.billing_event
            }
        });

    } catch (error) {
        console.error('Budget fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch budget' },
            { status: 500 }
        );
    }
}
