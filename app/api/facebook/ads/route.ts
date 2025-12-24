import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/facebook/ads
 * Fetch all ads from a Facebook Ad Account with comprehensive metrics
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    // Use URL params first, then fall back to environment variables
    const adAccountId = searchParams.get('adAccountId') || process.env.META_AD_ACCOUNT_ID;
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;
    const status = searchParams.get('status') || 'all'; // 'active', 'paused', 'archived', 'all'
    const datePreset = searchParams.get('datePreset') || 'last_30d'; // Facebook date presets

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

        // Fetch ads from the account (start_time not available on Ad, use created_time)
        const adsUrl = `https://graph.facebook.com/v24.0/act_${adAccountId}/ads?fields=id,name,status,effective_status,configured_status,created_time,updated_time,adset{end_time,daily_budget,lifetime_budget,start_time},creative{id,name,thumbnail_url,object_story_spec,asset_feed_spec}&limit=100${statusFilter}&access_token=${accessToken}`;

        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        if (adsData.error) {
            return NextResponse.json(
                { success: false, error: adsData.error.message },
                { status: 400 }
            );
        }

        // For each ad, fetch comprehensive insights
        const adsWithInsights = await Promise.all(
            (adsData.data || []).map(async (ad: {
                id: string;
                name: string;
                status: string;
                effective_status: string;
                configured_status?: string;
                created_time: string;
                updated_time: string;
                adset?: {
                    start_time?: string;
                    end_time?: string;
                    daily_budget?: string;
                    lifetime_budget?: string;
                };
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
                    // Comprehensive insights fields - ALL available metrics
                    const insightsFields = [
                        // Core
                        'impressions', 'reach', 'frequency', 'spend',
                        'clicks', 'unique_clicks', 'ctr', 'unique_ctr',
                        'cpc', 'cpm', 'cpp',
                        // Actions
                        'actions', 'action_values', 'cost_per_action_type',
                        'cost_per_unique_action_type',
                        // Links
                        'inline_link_clicks', 'unique_inline_link_clicks',
                        'inline_link_click_ctr', 'outbound_clicks',
                        'cost_per_inline_link_click', 'cost_per_outbound_click',
                        // Engagement
                        'inline_post_engagement', 'social_spend',
                        // Video
                        'video_play_actions', 'video_avg_time_watched_actions',
                        'video_p25_watched_actions', 'video_p50_watched_actions',
                        'video_p75_watched_actions', 'video_p95_watched_actions',
                        'video_p100_watched_actions', 'video_30_sec_watched_actions',
                        'video_thruplay_watched_actions',
                        'video_continuous_2_sec_watched_actions',
                        'cost_per_thruplay',
                        // Quality
                        'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
                        // Ad Recall
                        'estimated_ad_recallers', 'estimated_ad_recall_rate',
                        'cost_per_estimated_ad_recallers',
                        // Conversions
                        'conversions', 'conversion_values', 'cost_per_conversion',
                        'purchase_roas', 'mobile_app_purchase_roas'
                    ].join(',');

                    // Main insights call
                    const insightsUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=${insightsFields}&date_preset=${datePreset}&access_token=${accessToken}`;
                    const insightsResponse = await fetch(insightsUrl);
                    const insightsData = await insightsResponse.json();
                    const insights = insightsData.data?.[0] || {};

                    // Debug: Log ALL raw metrics from Facebook to diagnose data accuracy
                    console.log(`[Ad ${ad.id}] === RAW FACEBOOK DATA (${datePreset}) ===`);
                    console.log(`  Impressions: ${insights.impressions || 'N/A'}`);
                    console.log(`  Clicks: ${insights.clicks || 'N/A'}`);
                    console.log(`  CTR: ${insights.ctr || 'N/A'}`);
                    console.log(`  Spend: ${insights.spend || 'N/A'}`);
                    console.log(`  Reach: ${insights.reach || 'N/A'}`);
                    console.log(`  Actions count: ${insights.actions?.length || 0}`);
                    console.log(`  Cost per action count: ${insights.cost_per_action_type?.length || 0}`);

                    // Extract all actions
                    const actions = insights.actions || [];
                    const costPerAction = insights.cost_per_action_type || [];

                    // Debug: Log all action types to diagnose
                    if (actions.length > 0) {
                        console.log(`[Ad ${ad.id}] All actions:`, actions.map((a: { action_type: string; value: string }) => `${a.action_type}=${a.value}`).join(', '));
                    }
                    if (costPerAction.length > 0) {
                        console.log(`[Ad ${ad.id}] Cost per action:`, costPerAction.map((a: { action_type: string; value: string }) => `${a.action_type}=${a.value}`).join(', '));
                    }

                    // Helper to get action values
                    const getAction = (type: string) => {
                        const action = actions.find((a: { action_type: string; value: string }) => a.action_type === type);
                        return action ? parseInt(action.value) || 0 : 0;
                    };

                    const getCostPerAction = (type: string) => {
                        const cpa = costPerAction.find((a: { action_type: string; value: string }) => a.action_type === type);
                        return cpa ? parseFloat(cpa.value) || 0 : 0;
                    };

                    // Get video completion metrics
                    const getVideoMetric = (metricArray: { action_type: string; value: string }[] | undefined) => {
                        if (!metricArray) return 0;
                        const video = metricArray.find((v: { action_type: string }) => v.action_type === 'video_view');
                        return video ? parseInt(video.value) || 0 : 0;
                    };

                    // Extract key action metrics
                    const leads = getAction('lead');
                    const purchases = getAction('purchase');
                    const linkClicks = getAction('link_click');
                    const pageEngagement = getAction('page_engagement');
                    const postEngagement = getAction('post_engagement');
                    const postReactions = getAction('post_reaction');
                    const postComments = getAction('comment');
                    const postShares = getAction('post');
                    const videoViews = getAction('video_view');
                    const onFacebookMessages = getAction('onsite_conversion.messaging_first_reply');
                    const onFacebookMessagesStarted = getAction('onsite_conversion.messaging_conversation_started_7d');
                    const newMessagingContacts = getAction('onsite_conversion.messaging_first_reply'); // New messaging contacts
                    const totalMessagingContacts = getAction('onsite_conversion.total_messaging_connection');
                    const landingPageViews = getAction('landing_page_view');
                    const addToCart = getAction('add_to_cart');
                    const initiateCheckout = getAction('initiate_checkout');
                    const outboundClicks = insights.outbound_clicks?.[0]?.value ? parseInt(insights.outbound_clicks[0].value) : 0;

                    // Cost per result calculations
                    const costPerLead = getCostPerAction('lead');
                    const costPerPurchase = getCostPerAction('purchase');
                    const costPerLinkClick = getCostPerAction('link_click');
                    const costPerMessage = getCostPerAction('onsite_conversion.messaging_first_reply');
                    const costPerMessageStarted = getCostPerAction('onsite_conversion.messaging_conversation_started_7d');
                    const costPerPageEngagement = getCostPerAction('page_engagement');
                    const costPerLandingPageView = getCostPerAction('landing_page_view');
                    const costPerAddToCart = getCostPerAction('add_to_cart');
                    const costPerContentView = getCostPerAction('view_content');

                    // Additional actions
                    const contentViews = getAction('view_content');
                    const completeRegistration = getAction('complete_registration');
                    const phoneCalls = getAction('phone_call');
                    const postSaves = getAction('onsite_conversion.post_save');
                    const pageLikes = getAction('like');

                    // Determine primary result and cost per result
                    let primaryResult = 0;
                    let costPerResult = 0;
                    let resultType = 'none';

                    // Debug: log available actions
                    console.log(`[Ad ${ad.id}] Actions summary: leads=${leads}, purchases=${purchases}, messages=${onFacebookMessages}, linkClicks=${linkClicks}`);

                    if (leads > 0) {
                        primaryResult = leads;
                        costPerResult = costPerLead;
                        resultType = 'leads';
                    } else if (purchases > 0) {
                        primaryResult = purchases;
                        costPerResult = costPerPurchase;
                        resultType = 'purchases';
                    } else if (onFacebookMessagesStarted > 0) {
                        // Use messaging_conversation_started_7d as primary (this is what Facebook reports)
                        primaryResult = onFacebookMessagesStarted;
                        costPerResult = costPerMessageStarted;
                        resultType = 'messages';
                    } else if (onFacebookMessages > 0) {
                        // Fallback to messaging_first_reply
                        primaryResult = onFacebookMessages;
                        costPerResult = costPerMessage;
                        resultType = 'messages';
                    }
                    // NOTE: Removed link_clicks as a "result" - it's not a conversion action

                    // If no results, ensure costPerResult is 0
                    if (primaryResult === 0) {
                        costPerResult = 0;
                    }

                    console.log(`[Ad ${ad.id}] Result: type=${resultType}, count=${primaryResult}, costPerResult=${costPerResult}`);

                    // Fetch demographics breakdown (age + gender) - must fetch impressions/reach, not actions
                    let demographics: { age?: string; gender?: string; impressions: number }[] = [];
                    try {
                        const demoUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=impressions,reach&breakdowns=age,gender&date_preset=${datePreset}&access_token=${accessToken}`;
                        const demoResponse = await fetch(demoUrl);
                        const demoData = await demoResponse.json();
                        console.log(`[Ad ${ad.id}] Demographics raw response:`, JSON.stringify(demoData.data?.slice(0, 3) || []));
                        if (demoData.data && Array.isArray(demoData.data)) {
                            demographics = demoData.data.map((d: { age?: string; gender?: string; impressions?: string; reach?: string }) => ({
                                age: d.age,
                                gender: d.gender,
                                impressions: parseInt(d.impressions || '0'),
                                reach: parseInt(d.reach || '0')
                            }));
                        }
                    } catch (e) {
                        console.log('Demographics fetch error:', e);
                    }

                    // Fetch placement breakdown
                    let placements: { placement?: string; impressions: number; spend: number }[] = [];
                    try {
                        const placementUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=impressions,spend&breakdowns=publisher_platform,platform_position&date_preset=${datePreset}&access_token=${accessToken}`;
                        const placementResponse = await fetch(placementUrl);
                        const placementData = await placementResponse.json();
                        if (placementData.data) {
                            placements = placementData.data.map((p: { publisher_platform: string; platform_position: string; impressions?: string; spend?: string }) => ({
                                platform: p.publisher_platform,
                                position: p.platform_position,
                                impressions: parseInt(p.impressions || '0'),
                                spend: parseFloat(p.spend || '0')
                            }));
                        }
                    } catch (e) {
                        console.log('Placements not available');
                    }

                    // Fetch region/country breakdown
                    let regions: { country?: string; region?: string; impressions: number }[] = [];
                    try {
                        const regionUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=impressions,spend&breakdowns=country&date_preset=${datePreset}&access_token=${accessToken}`;
                        const regionResponse = await fetch(regionUrl);
                        const regionData = await regionResponse.json();
                        if (regionData.data) {
                            regions = regionData.data.map((r: { country: string; impressions?: string; spend?: string }) => ({
                                country: r.country,
                                impressions: parseInt(r.impressions || '0'),
                                spend: parseFloat(r.spend || '0')
                            }));
                        }
                    } catch (e) {
                        console.log('Regions not available');
                    }

                    // Fetch by impression device
                    let byDevice: { device: string; impressions: number; clicks: number; spend: number }[] = [];
                    try {
                        const deviceUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=impressions,clicks,spend&breakdowns=impression_device&date_preset=${datePreset}&access_token=${accessToken}`;
                        const deviceResponse = await fetch(deviceUrl);
                        const deviceData = await deviceResponse.json();
                        if (deviceData.data) {
                            byDevice = deviceData.data.map((d: { impression_device: string; impressions?: string; clicks?: string; spend?: string }) => ({
                                device: d.impression_device,
                                impressions: parseInt(d.impressions || '0'),
                                clicks: parseInt(d.clicks || '0'),
                                spend: parseFloat(d.spend || '0')
                            }));
                        }
                    } catch (e) {
                        console.log('Device breakdown not available');
                    }

                    // Fetch by platform
                    let byPlatform: { platform: string; impressions: number; clicks: number; spend: number }[] = [];
                    try {
                        const platformUrl = `https://graph.facebook.com/v24.0/${ad.id}/insights?fields=impressions,clicks,spend&breakdowns=publisher_platform&date_preset=${datePreset}&access_token=${accessToken}`;
                        const platformResponse = await fetch(platformUrl);
                        const platformData = await platformResponse.json();
                        if (platformData.data) {
                            byPlatform = platformData.data.map((p: { publisher_platform: string; impressions?: string; clicks?: string; spend?: string }) => ({
                                platform: p.publisher_platform,
                                impressions: parseInt(p.impressions || '0'),
                                clicks: parseInt(p.clicks || '0'),
                                spend: parseFloat(p.spend || '0')
                            }));
                        }
                    } catch (e) {
                        console.log('Platform breakdown not available');
                    }

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
                        configuredStatus: ad.configured_status,
                        createdAt: ad.created_time,
                        updatedAt: ad.updated_time,
                        startTime: ad.adset?.start_time || ad.created_time, // Use created_time as fallback
                        endTime: ad.adset?.end_time || null, // When ad/adset is scheduled to stop
                        dailyBudget: ad.adset?.daily_budget ? parseFloat(ad.adset.daily_budget) / 100 : null,
                        lifetimeBudget: ad.adset?.lifetime_budget ? parseFloat(ad.adset.lifetime_budget) / 100 : null,
                        mediaType,
                        thumbnailUrl,
                        creativeId: ad.creative?.id,
                        // Comprehensive Metrics
                        metrics: {
                            // Core metrics
                            impressions: parseInt(insights.impressions) || 0,
                            reach: parseInt(insights.reach) || 0,
                            clicks: parseInt(insights.clicks) || 0,
                            uniqueClicks: parseInt(insights.unique_clicks) || 0,
                            // CTR: Always calculate ourselves from clicks/impressions for accuracy
                            // Facebook's "ctr" field is "CTR (all)" = all clicks / impressions
                            ctr: (() => {
                                const impressions = parseInt(insights.impressions) || 0;
                                const clicks = parseInt(insights.clicks) || 0;
                                // Calculate CTR ourselves
                                return impressions > 0 ? (clicks / impressions) * 100 : 0;
                            })(),
                            uniqueCtr: parseFloat(insights.unique_ctr) || 0,
                            cpc: parseFloat(insights.cpc) || 0,
                            cpm: parseFloat(insights.cpm) || 0,
                            cpp: parseFloat(insights.cpp) || 0,
                            spend: parseFloat(insights.spend) || 0,
                            frequency: parseFloat(insights.frequency) || 0,

                            // Results
                            resultType,
                            results: primaryResult,
                            costPerResult,

                            // Link & Landing
                            linkClicks,
                            inlineLinkClicks: parseInt(insights.inline_link_clicks) || 0,
                            landingPageViews,
                            outboundClicks: insights.outbound_clicks?.[0]?.value || 0,

                            // Engagement
                            pageEngagement,
                            postEngagement,
                            inlinePostEngagement: parseInt(insights.inline_post_engagement) || 0,
                            postReactions,
                            postComments,
                            postShares,

                            // Messages
                            messages: onFacebookMessages,
                            messagesStarted: onFacebookMessagesStarted,
                            newMessagingContacts,
                            totalMessagingContacts,
                            costPerMessage,
                            costPerMessageStarted,

                            // Cost per outbound click
                            costPerOutboundClick: insights.cost_per_outbound_click?.[0]?.value ? parseFloat(insights.cost_per_outbound_click[0].value) : 0,

                            // Leads & Purchases
                            leads,
                            purchases,
                            addToCart,
                            initiateCheckout,
                            costPerLead,
                            costPerPurchase,

                            // Video metrics
                            videoViews,
                            videoPlays: insights.video_play_actions?.[0]?.value || 0,
                            videoThruPlays: insights.video_thruplay_watched_actions?.[0]?.value || 0,
                            video2SecViews: insights.video_continuous_2_sec_watched_actions?.[0]?.value || 0,
                            video25Watched: getVideoMetric(insights.video_p25_watched_actions),
                            video50Watched: getVideoMetric(insights.video_p50_watched_actions),
                            video75Watched: getVideoMetric(insights.video_p75_watched_actions),
                            video95Watched: insights.video_p95_watched_actions?.[0]?.value || 0,
                            video100Watched: getVideoMetric(insights.video_p100_watched_actions),
                            videoAvgWatchTime: insights.video_avg_time_watched_actions?.[0]?.value || 0,
                            costPerThruPlay: parseFloat(insights.cost_per_thruplay?.[0]?.value) || 0,

                            // Quality Rankings
                            qualityRanking: insights.quality_ranking || 'N/A',
                            engagementRateRanking: insights.engagement_rate_ranking || 'N/A',
                            conversionRateRanking: insights.conversion_rate_ranking || 'N/A',

                            // Estimated Ad Recall
                            estimatedAdRecallers: parseInt(insights.estimated_ad_recallers) || 0,
                            estimatedAdRecallRate: parseFloat(insights.estimated_ad_recall_rate) || 0,

                            // Additional conversions
                            contentViews,
                            completeRegistration,
                            phoneCalls,
                            postSaves,
                            pageLikes,
                            costPerLandingPageView,
                            costPerAddToCart,
                            costPerContentView,

                            // ROAS
                            purchaseRoas: parseFloat(insights.purchase_roas?.[0]?.value) || 0,

                            // Raw data for debugging - all actions Facebook returned
                            rawActions: actions.map((a: { action_type: string; value: string }) => ({
                                type: a.action_type,
                                value: parseInt(a.value) || 0
                            })),
                            rawCostPerAction: costPerAction.map((a: { action_type: string; value: string }) => ({
                                type: a.action_type,
                                cost: parseFloat(a.value) || 0
                            })),
                        },
                        // Breakdowns
                        demographics,
                        placements,
                        regions,
                        byDevice,
                        byPlatform
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
                        metrics: null,
                        demographics: [],
                        placements: [],
                        regions: [],
                        byDevice: [],
                        byPlatform: []
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

