import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/facebook/exchange-token
 * Exchange a short-lived Facebook token for a long-lived token
 * 
 * Short-lived tokens: ~1-2 hours
 * Long-lived tokens: ~60 days
 */
export async function POST(request: NextRequest) {
    try {
        const { shortLivedToken, appId, appSecret } = await request.json();

        // Use environment variables if not provided
        const fbAppId = appId || process.env.FACEBOOK_APP_ID;
        const fbAppSecret = appSecret || process.env.FACEBOOK_APP_SECRET;

        if (!shortLivedToken) {
            return NextResponse.json(
                { success: false, error: 'Missing shortLivedToken' },
                { status: 400 }
            );
        }

        if (!fbAppId || !fbAppSecret) {
            return NextResponse.json(
                { success: false, error: 'Missing Facebook App ID or App Secret. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in environment variables.' },
                { status: 400 }
            );
        }

        // Exchange short-lived token for long-lived token
        const exchangeUrl = `https://graph.facebook.com/v24.0/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${fbAppId}&` +
            `client_secret=${fbAppSecret}&` +
            `fb_exchange_token=${shortLivedToken}`;

        const response = await fetch(exchangeUrl);
        const data = await response.json();

        if (data.error) {
            console.error('Token exchange error:', data.error);
            return NextResponse.json(
                { success: false, error: data.error.message || 'Token exchange failed' },
                { status: 400 }
            );
        }

        // Calculate expiry date
        const expiresAt = data.expires_in
            ? new Date(Date.now() + data.expires_in * 1000).toISOString()
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // Default 60 days

        return NextResponse.json({
            success: true,
            accessToken: data.access_token,
            tokenType: 'long_lived',
            expiresIn: data.expires_in || 5184000, // ~60 days in seconds
            expiresAt: expiresAt
        });

    } catch (error) {
        console.error('Token exchange error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Token exchange failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/facebook/exchange-token
 * Check if a token is valid and get its expiry info
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json(
            { success: false, error: 'Missing token parameter' },
            { status: 400 }
        );
    }

    try {
        // Debug token to check validity and expiry
        const debugUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${token}&access_token=${token}`;
        const response = await fetch(debugUrl);
        const data = await response.json();

        if (data.error) {
            return NextResponse.json({
                success: false,
                error: data.error.message,
                isValid: false
            });
        }

        const tokenData = data.data;
        const expiresAt = tokenData.expires_at
            ? new Date(tokenData.expires_at * 1000).toISOString()
            : null;

        return NextResponse.json({
            success: true,
            isValid: tokenData.is_valid,
            appId: tokenData.app_id,
            userId: tokenData.user_id,
            expiresAt: expiresAt,
            scopes: tokenData.scopes,
            // Check if it's a long-lived token (expires in > 1 day)
            isLongLived: tokenData.expires_at
                ? (tokenData.expires_at * 1000 - Date.now()) > 24 * 60 * 60 * 1000
                : false
        });

    } catch (error) {
        console.error('Token debug error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to check token' },
            { status: 500 }
        );
    }
}
