import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/facebook/ads/manage
 * Manage ads: pause, resume, archive, delete
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            adId,
            action, // 'pause' | 'resume' | 'archive' | 'delete'
            accessToken
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;

        if (!adId) {
            return NextResponse.json(
                { success: false, error: 'Missing adId' },
                { status: 400 }
            );
        }

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Missing accessToken. Set META_MARKETING_TOKEN in environment variables or provide in request.' },
                { status: 400 }
            );
        }

        if (!action || !['pause', 'resume', 'archive', 'delete'].includes(action)) {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Must be: pause, resume, archive, or delete' },
                { status: 400 }
            );
        }

        // Map action to Facebook API status
        let newStatus: string;
        let method: 'POST' | 'DELETE' = 'POST';

        switch (action) {
            case 'pause':
                newStatus = 'PAUSED';
                break;
            case 'resume':
                newStatus = 'ACTIVE';
                break;
            case 'archive':
                newStatus = 'ARCHIVED';
                break;
            case 'delete':
                method = 'DELETE';
                newStatus = '';
                break;
            default:
                newStatus = 'PAUSED';
        }

        let response;
        let data;

        if (method === 'DELETE') {
            // Delete the ad
            const deleteUrl = `https://graph.facebook.com/v24.0/${adId}?access_token=${token}`;
            response = await fetch(deleteUrl, { method: 'DELETE' });
            data = await response.json();
        } else {
            // Update ad status
            const updateUrl = `https://graph.facebook.com/v24.0/${adId}`;
            response = await fetch(updateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: newStatus,
                    access_token: token
                })
            });
            data = await response.json();
        }

        if (data.error) {
            console.error('Facebook API error:', data.error);
            return NextResponse.json(
                {
                    success: false,
                    error: data.error.message || 'Failed to update ad',
                    errorCode: data.error.code,
                    errorSubcode: data.error.error_subcode
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            adId,
            action,
            newStatus: action === 'delete' ? 'DELETED' : newStatus,
            message: `Ad successfully ${action}d`
        });

    } catch (error) {
        console.error('Ad manage error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to manage ad' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/facebook/ads/manage
 * Update ad properties (name, etc.)
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            adId,
            name,
            accessToken
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;

        if (!adId) {
            return NextResponse.json(
                { success: false, error: 'Missing adId' },
                { status: 400 }
            );
        }

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Missing accessToken' },
                { status: 400 }
            );
        }

        const updates: Record<string, string> = {};
        if (name) updates.name = name;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { success: false, error: 'No updates provided' },
                { status: 400 }
            );
        }

        const updateUrl = `https://graph.facebook.com/v24.0/${adId}`;
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
            return NextResponse.json(
                { success: false, error: data.error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            adId,
            updates,
            message: 'Ad updated successfully'
        });

    } catch (error) {
        console.error('Ad update error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to update ad' },
            { status: 500 }
        );
    }
}
