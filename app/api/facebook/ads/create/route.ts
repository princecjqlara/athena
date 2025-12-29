import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/facebook/ads/create
 * Create a complete Facebook ad by linking a creative to an ad set
 * 
 * This is the final step in ad creation:
 * 1. Campaign (objective) ✓
 * 2. Ad Set (targeting, budget) ✓
 * 3. Creative (image, text) ✓
 * 4. Ad (links creative to ad set) ← This endpoint
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            adsetId,            // Required - which ad set this ad belongs to
            creativeId,         // Required - the creative to use
            status = 'PAUSED',  // Start paused for safety
            trackingSpecs,      // Optional - conversion tracking
            accessToken,
            adAccountId
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;
        const accountId = adAccountId || process.env.META_AD_ACCOUNT_ID;

        // Validation
        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Missing accessToken' },
                { status: 400 }
            );
        }

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: 'Missing adAccountId' },
                { status: 400 }
            );
        }

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Missing ad name' },
                { status: 400 }
            );
        }

        if (!adsetId) {
            return NextResponse.json(
                { success: false, error: 'Missing adsetId. Create an ad set first.' },
                { status: 400 }
            );
        }

        if (!creativeId) {
            return NextResponse.json(
                { success: false, error: 'Missing creativeId. Create a creative first.' },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['ACTIVE', 'PAUSED'];
        const adStatus = status.toUpperCase();
        if (!validStatuses.includes(adStatus)) {
            return NextResponse.json(
                { success: false, error: 'Invalid status. Must be ACTIVE or PAUSED' },
                { status: 400 }
            );
        }

        // Build ad data
        const adData: Record<string, string> = {
            name,
            adset_id: adsetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: adStatus,
            access_token: token
        };

        // Add tracking specs if provided
        if (trackingSpecs) {
            adData.tracking_specs = JSON.stringify(trackingSpecs);
        }

        // Create the ad
        const createUrl = `https://graph.facebook.com/v24.0/act_${accountId}/ads`;

        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(adData).toString()
        });

        const data = await response.json();

        if (data.error) {
            console.error('Facebook ad creation error:', data.error);

            let errorMessage = data.error.message;
            // Common error handling
            if (data.error.code === 100) {
                if (errorMessage.includes('adset')) {
                    errorMessage = 'Invalid ad set ID. Make sure the ad set exists and is not deleted.';
                } else if (errorMessage.includes('creative')) {
                    errorMessage = 'Invalid creative ID. Make sure the creative exists.';
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
            adId: data.id,
            name,
            adsetId,
            creativeId,
            status: adStatus,
            message: `🎉 Ad "${name}" created successfully! ${adStatus === 'PAUSED' ? 'The ad is paused. Enable it when ready.' : 'The ad is now active!'}`
        });

    } catch (error) {
        console.error('Ad creation error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to create ad' },
            { status: 500 }
        );
    }
}
