import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/facebook/adcreatives
 * Create an ad creative with image/video and text
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            pageId,              // Required - Facebook Page ID
            imageHash,           // Image hash from adimages upload
            imageUrl,            // Alternative: direct image URL
            videoId,             // For video ads
            message,             // Primary text (body)
            headline,            // Link headline
            description,         // Link description
            linkUrl,             // Destination URL
            callToAction = 'LEARN_MORE',  // CTA button type
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

        if (!pageId) {
            return NextResponse.json(
                { success: false, error: 'Missing pageId. You need a Facebook Page to create ads.' },
                { status: 400 }
            );
        }

        if (!imageHash && !imageUrl && !videoId) {
            return NextResponse.json(
                { success: false, error: 'Must provide imageHash, imageUrl, or videoId' },
                { status: 400 }
            );
        }

        // Valid CTA types
        const validCTAs = [
            'APPLY_NOW', 'BOOK_TRAVEL', 'BUY_NOW', 'CALL_NOW', 'CONTACT_US',
            'DOWNLOAD', 'GET_DIRECTIONS', 'GET_OFFER', 'GET_QUOTE', 'INSTALL_APP',
            'LEARN_MORE', 'LISTEN_NOW', 'MESSAGE_PAGE', 'NO_BUTTON', 'OPEN_LINK',
            'ORDER_NOW', 'PLAY_GAME', 'REQUEST_TIME', 'SEND_MESSAGE', 'SEND_WHATSAPP_MESSAGE',
            'SHOP_NOW', 'SIGN_UP', 'SUBSCRIBE', 'USE_APP', 'WATCH_MORE', 'WHATSAPP_MESSAGE'
        ];

        const ctaType = callToAction.toUpperCase().replace(/ /g, '_');
        if (!validCTAs.includes(ctaType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid callToAction. Valid options: ${validCTAs.slice(0, 10).join(', ')}...`,
                    validOptions: validCTAs
                },
                { status: 400 }
            );
        }

        // Build object_story_spec based on creative type
        let objectStorySpec: Record<string, unknown> = {
            page_id: pageId
        };

        if (videoId) {
            // Video ad
            objectStorySpec.video_data = {
                video_id: videoId,
                message: message || '',
                call_to_action: linkUrl ? {
                    type: ctaType,
                    value: { link: linkUrl }
                } : undefined,
                title: headline
            };
        } else {
            // Image ad (link ad)
            const linkData: Record<string, unknown> = {
                message: message || '',
                name: headline,
                description: description,
                call_to_action: {
                    type: ctaType,
                    value: linkUrl ? { link: linkUrl } : undefined
                }
            };

            if (linkUrl) {
                linkData.link = linkUrl;
            }

            if (imageHash) {
                linkData.image_hash = imageHash;
            } else if (imageUrl) {
                linkData.picture = imageUrl;
            }

            objectStorySpec.link_data = linkData;
        }

        // Create the creative
        const createUrl = `https://graph.facebook.com/v24.0/act_${accountId}/adcreatives`;

        const creativeData: Record<string, string> = {
            name: name || `Creative ${new Date().toISOString()}`,
            object_story_spec: JSON.stringify(objectStorySpec),
            access_token: token
        };

        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(creativeData).toString()
        });

        const data = await response.json();

        if (data.error) {
            console.error('Facebook creative creation error:', data.error);
            return NextResponse.json(
                {
                    success: false,
                    error: data.error.message || 'Failed to create creative',
                    errorCode: data.error.code,
                    errorSubcode: data.error.error_subcode
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            creativeId: data.id,
            name: name || `Creative ${new Date().toISOString()}`,
            message: `Ad creative created successfully!`
        });

    } catch (error) {
        console.error('Creative creation error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to create creative' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/facebook/adcreatives
 * List ad creatives for the account
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const adAccountId = searchParams.get('adAccountId') || process.env.META_AD_ACCOUNT_ID;
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;

    if (!adAccountId || !accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing adAccountId or accessToken' },
            { status: 400 }
        );
    }

    try {
        const url = `https://graph.facebook.com/v24.0/act_${adAccountId}/adcreatives?fields=id,name,status,thumbnail_url,object_story_spec,effective_object_story_id&limit=50&access_token=${accessToken}`;

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
            creatives: data.data || [],
            paging: data.paging
        });

    } catch (error) {
        console.error('Creatives fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch creatives' },
            { status: 500 }
        );
    }
}
