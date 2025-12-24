import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/facebook/ads
 * Fetch all ads from a Facebook Ad Account
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    // Use URL params first, then fall back to environment variables
    const adAccountId = searchParams.get('adAccountId') || process.env.META_AD_ACCOUNT_ID;
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;
    const status = searchParams.get('status') || 'all'; // 'active', 'paused', 'archived', 'all'

    if (!adAccountId || !accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing adAccountId or accessToken. Set them in URL params or environment variables (META_AD_ACCOUNT_ID, META_MARKETING_TOKEN)' },
            { status: 400 }
        );
    }

    try {
        // Build status filter
        let statusFilter = '';
        if (status === 'active') {
            statusFilter = '&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]';
        } else if (status === 'paused') {
            statusFilter = '&filtering=[{"field":"effective_status","operator":"IN","value":["PAUSED"]}]';
        } else if (status === 'archived') {
            statusFilter = '&filtering=[{"field":"effective_status","operator":"IN","value":["ARCHIVED"]}]';
        }
        // 'all' = no filter

        // Fetch ads from the account
        const adsUrl = `https://graph.facebook.com/v24.0/act_${adAccountId}/ads?fields=id,name,status,effective_status,created_time,updated_time,creative{id,name,thumbnail_url,object_story_spec,asset_feed_spec}&limit=100${statusFilter}&access_token=${accessToken}`;

        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        if (adsData.error) {
            return NextResponse.json(
                { success: false, error: adsData.error.message },
                { status: 400 }
            );
        }

        // For each ad, fetch its insights
        const adsWithInsights = await Promise.all(
            (adsData.data || []).map(async (ad: {
                id: string;
                name: string;
                status: string;
                effective_status: string;
                created_time: string;
                updated_time: string;
                creative?: {
                    id: string;
                    name: string;
                    thumbnail_url: string;
                    object_story_spec?: {
                        video_data?: { video_id: string };
                        photo_data?: { image_url: string };
                    };
                };
            }) => {
                try {
                    // Fetch lifetime insights for this ad
                    const insightsUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=impressions,reach,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type,frequency&date_preset=lifetime&access_token=${accessToken}`;
                    const insightsResponse = await fetch(insightsUrl);
                    const insightsData = await insightsResponse.json();

                    const insights = insightsData.data?.[0] || {};

                    // Extract conversions from actions
                    const actions = insights.actions || [];
                    const leads = actions.find((a: { action_type: string }) => a.action_type === 'lead')?.value || 0;
                    const purchases = actions.find((a: { action_type: string }) => a.action_type === 'purchase')?.value || 0;
                    const linkClicks = actions.find((a: { action_type: string }) => a.action_type === 'link_click')?.value || 0;

                    // Determine media type from creative
                    let mediaType = 'unknown';
                    let thumbnailUrl = ad.creative?.thumbnail_url || '';

                    if (ad.creative?.object_story_spec?.video_data) {
                        mediaType = 'video';
                    } else if (ad.creative?.object_story_spec?.photo_data) {
                        mediaType = 'photo';
                        thumbnailUrl = ad.creative.object_story_spec.photo_data.image_url || thumbnailUrl;
                    }

                    return {
                        id: ad.id,
                        name: ad.name,
                        status: ad.status,
                        effectiveStatus: ad.effective_status,
                        createdAt: ad.created_time,
                        updatedAt: ad.updated_time,
                        mediaType,
                        thumbnailUrl,
                        creativeId: ad.creative?.id,
                        // Metrics
                        metrics: {
                            impressions: parseInt(insights.impressions) || 0,
                            reach: parseInt(insights.reach) || 0,
                            clicks: parseInt(insights.clicks) || 0,
                            ctr: parseFloat(insights.ctr) || 0,
                            cpc: parseFloat(insights.cpc) || 0,
                            cpm: parseFloat(insights.cpm) || 0,
                            spend: parseFloat(insights.spend) || 0,
                            frequency: parseFloat(insights.frequency) || 0,
                            linkClicks: parseInt(linkClicks) || 0,
                            leads: parseInt(leads) || 0,
                            purchases: parseInt(purchases) || 0,
                        }
                    };
                } catch (err) {
                    console.error(`Error fetching insights for ad ${ad.id}:`, err);
                    return {
                        id: ad.id,
                        name: ad.name,
                        status: ad.status,
                        effectiveStatus: ad.effective_status,
                        createdAt: ad.created_time,
                        mediaType: 'unknown',
                        thumbnailUrl: ad.creative?.thumbnail_url || '',
                        metrics: null
                    };
                }
            })
        );

        return NextResponse.json({
            success: true,
            data: adsWithInsights,
            paging: adsData.paging
        });

    } catch (error) {
        console.error('Facebook ads fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch ads' },
            { status: 500 }
        );
    }
}
