import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/facebook/adimages
 * Upload an image to Facebook Ads for use in creatives
 * 
 * Facebook accepts images via:
 * 1. URL (image_url) - Easiest, Facebook fetches from URL
 * 2. Base64 (bytes) - For direct upload
 * 3. File hash - For previously uploaded images
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            imageUrl,           // URL to fetch image from
            imageBase64,        // Base64 encoded image data
            imageName,          // Optional name for the image
            accessToken,
            adAccountId
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;
        const accountId = adAccountId || process.env.META_AD_ACCOUNT_ID;

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

        if (!imageUrl && !imageBase64) {
            return NextResponse.json(
                { success: false, error: 'Must provide either imageUrl or imageBase64' },
                { status: 400 }
            );
        }

        // Build image upload request
        const uploadUrl = `https://graph.facebook.com/v24.0/act_${accountId}/adimages`;

        const formData = new FormData();
        formData.append('access_token', token);

        if (imageUrl) {
            // Upload via URL - Facebook will fetch the image
            formData.append('url', imageUrl);
        } else if (imageBase64) {
            // Upload via base64
            // Remove data URL prefix if present
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            formData.append('bytes', base64Data);
        }

        if (imageName) {
            formData.append('name', imageName);
        }

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            console.error('Facebook image upload error:', data.error);
            return NextResponse.json(
                {
                    success: false,
                    error: data.error.message || 'Failed to upload image',
                    errorCode: data.error.code
                },
                { status: 400 }
            );
        }

        // Extract image hash from response
        // Response format: { images: { "filename": { hash: "...", url: "..." } } }
        const images = data.images;
        if (!images || Object.keys(images).length === 0) {
            return NextResponse.json(
                { success: false, error: 'No image data in response' },
                { status: 400 }
            );
        }

        const firstImage = Object.values(images)[0] as { hash: string; url: string; url_128?: string };

        return NextResponse.json({
            success: true,
            imageHash: firstImage.hash,
            imageUrl: firstImage.url,
            thumbnailUrl: firstImage.url_128,
            message: 'Image uploaded successfully!'
        });

    } catch (error) {
        console.error('Image upload error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to upload image' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/facebook/adimages
 * List uploaded images for the ad account
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
        const url = `https://graph.facebook.com/v24.0/act_${adAccountId}/adimages?fields=hash,name,url,url_128,created_time,status&limit=50&access_token=${accessToken}`;

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
            images: data.data || [],
            paging: data.paging
        });

    } catch (error) {
        console.error('Image fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch images' },
            { status: 500 }
        );
    }
}
