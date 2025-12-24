import { NextRequest, NextResponse } from 'next/server';

interface FacebookPage {
    id: string;
    name: string;
    access_token: string;
    category?: string;
    tasks?: string[];
}

interface PagesResponse {
    data: FacebookPage[];
    paging?: {
        cursors: { before: string; after: string };
        next?: string;
    };
}

/**
 * GET /api/facebook/pages
 * Fetch all Facebook Pages the user has access to, along with their page access tokens.
 * This uses the user's access token to get page tokens automatically.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userAccessToken = searchParams.get('access_token');

    if (!userAccessToken) {
        return NextResponse.json(
            { error: 'access_token is required' },
            { status: 400 }
        );
    }

    try {
        console.log('[Pages API] Fetching pages with user token...');

        // Fetch pages the user manages
        const pagesUrl = `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,category,tasks&access_token=${userAccessToken}`;
        const response = await fetch(pagesUrl);
        const data: PagesResponse = await response.json();

        if (!response.ok) {
            console.error('[Pages API] Error fetching pages:', data);
            return NextResponse.json(
                { error: 'Failed to fetch pages', details: data },
                { status: response.status }
            );
        }

        console.log(`[Pages API] Found ${data.data?.length || 0} pages`);

        // Return pages with their tokens
        const pages = data.data.map(page => ({
            id: page.id,
            name: page.name,
            accessToken: page.access_token,
            category: page.category,
            // Check if page has messaging permissions
            canMessage: page.tasks?.includes('MESSAGING') || page.tasks?.includes('MANAGE'),
        }));

        return NextResponse.json({
            success: true,
            pages,
            count: pages.length,
        });

    } catch (error) {
        console.error('[Pages API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pages', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * POST /api/facebook/pages
 * Exchange a short-lived page token for a long-lived page token
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pageAccessToken, pageId, pageName } = body;

        if (!pageAccessToken) {
            return NextResponse.json(
                { error: 'pageAccessToken is required' },
                { status: 400 }
            );
        }

        const appId = process.env.FACEBOOK_APP_ID;
        const appSecret = process.env.FACEBOOK_APP_SECRET;

        if (!appId || !appSecret) {
            // If no app credentials, return the page token as-is
            console.log('[Pages API] No app credentials, returning token as-is');
            return NextResponse.json({
                success: true,
                pageId,
                pageName,
                accessToken: pageAccessToken,
                tokenType: 'short-lived',
                note: 'Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to get long-lived tokens'
            });
        }

        // Exchange for long-lived token
        const exchangeUrl = `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${pageAccessToken}`;

        console.log('[Pages API] Exchanging for long-lived page token...');
        const response = await fetch(exchangeUrl);
        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('[Pages API] Token exchange failed:', data);
            // Return original token if exchange fails
            return NextResponse.json({
                success: true,
                pageId,
                pageName,
                accessToken: pageAccessToken,
                tokenType: 'short-lived',
                exchangeError: data.error?.message || 'Token exchange failed'
            });
        }

        console.log('[Pages API] Successfully got long-lived page token');

        return NextResponse.json({
            success: true,
            pageId,
            pageName,
            accessToken: data.access_token,
            tokenType: 'long-lived',
            expiresIn: data.expires_in, // Usually never expires for page tokens
        });

    } catch (error) {
        console.error('[Pages API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to exchange token', details: String(error) },
            { status: 500 }
        );
    }
}
