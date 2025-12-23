import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/facebook/insights
 * Fetch detailed ad insights including demographics, placements, and time breakdowns
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const adId = searchParams.get('adId');
    const accessToken = searchParams.get('accessToken');

    if (!adId || !accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing adId or accessToken' },
            { status: 400 }
        );
    }

    try {
        // Fetch multiple breakdowns in parallel
        const [
            basicInsights,
            ageGenderBreakdown,
            countryBreakdown,
            platformBreakdown,
            placementBreakdown,
            deviceBreakdown,
            hourlyBreakdown
        ] = await Promise.all([
            // Basic metrics
            fetchInsights(adId, accessToken,
                'impressions,reach,frequency,clicks,ctr,cpc,cpm,spend,actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,inline_link_clicks,inline_post_engagement'
            ),
            // Age & Gender breakdown
            fetchInsightsWithBreakdown(adId, accessToken, 'age,gender', 'impressions,clicks,spend,reach'),
            // Country breakdown
            fetchInsightsWithBreakdown(adId, accessToken, 'country', 'impressions,clicks,spend,reach'),
            // Platform breakdown (Facebook, Instagram, Messenger)
            fetchInsightsWithBreakdown(adId, accessToken, 'publisher_platform', 'impressions,clicks,spend,reach'),
            // Placement breakdown (Feed, Stories, Reels)
            fetchInsightsWithBreakdown(adId, accessToken, 'platform_position', 'impressions,clicks,spend,reach'),
            // Device breakdown
            fetchInsightsWithBreakdown(adId, accessToken, 'device_platform', 'impressions,clicks,spend,reach'),
            // Hourly breakdown (for most active time)
            fetchInsightsWithBreakdown(adId, accessToken, 'hourly_stats_aggregated_by_advertiser_time_zone', 'impressions,clicks')
        ]);

        // Process and aggregate the data
        const processedData = {
            // Basic metrics
            basic: processBasicMetrics(basicInsights),

            // Demographics
            demographics: {
                age: processAgeBreakdown(ageGenderBreakdown),
                gender: processGenderBreakdown(ageGenderBreakdown),
            },

            // Geographic
            geographic: {
                countries: processCountryBreakdown(countryBreakdown),
            },

            // Platform & Placement
            distribution: {
                platforms: processPlatformBreakdown(platformBreakdown),
                placements: processPlacementBreakdown(placementBreakdown),
                devices: processDeviceBreakdown(deviceBreakdown),
            },

            // Time analysis
            timeAnalysis: {
                mostActiveHour: findMostActiveHour(hourlyBreakdown),
                hourlyData: processHourlyBreakdown(hourlyBreakdown),
            },

            // Raw data for debugging
            _raw: {
                basic: basicInsights,
                ageGender: ageGenderBreakdown,
                country: countryBreakdown,
            }
        };

        return NextResponse.json({
            success: true,
            data: processedData
        });

    } catch (error) {
        console.error('Facebook insights error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch insights' },
            { status: 500 }
        );
    }
}

// Helper: Fetch basic insights
async function fetchInsights(adId: string, accessToken: string, fields: string) {
    const response = await fetch(
        `https://graph.facebook.com/v24.0/${adId}/insights?fields=${fields}&access_token=${accessToken}`
    );
    const data = await response.json();
    return data.data?.[0] || {};
}

// Helper: Fetch insights with breakdown
async function fetchInsightsWithBreakdown(
    adId: string,
    accessToken: string,
    breakdown: string,
    fields: string
) {
    const response = await fetch(
        `https://graph.facebook.com/v24.0/${adId}/insights?fields=${fields}&breakdowns=${breakdown}&access_token=${accessToken}`
    );
    const data = await response.json();
    return data.data || [];
}

// Process basic metrics
function processBasicMetrics(data: Record<string, unknown>) {
    const actions = (data.actions as Array<{ action_type: string, value: string }>) || [];

    return {
        impressions: parseInt(data.impressions as string) || 0,
        reach: parseInt(data.reach as string) || 0,
        frequency: parseFloat(data.frequency as string) || 0,
        clicks: parseInt(data.clicks as string) || 0,
        ctr: parseFloat(data.ctr as string) || 0,
        cpc: parseFloat(data.cpc as string) || 0,
        cpm: parseFloat(data.cpm as string) || 0,
        spend: parseFloat(data.spend as string) || 0,
        linkClicks: parseInt(data.inline_link_clicks as string) || 0,
        postEngagement: parseInt(data.inline_post_engagement as string) || 0,

        // Video metrics
        videoViews25: getActionValue(data.video_p25_watched_actions as Array<{ value: string }>),
        videoViews50: getActionValue(data.video_p50_watched_actions as Array<{ value: string }>),
        videoViews75: getActionValue(data.video_p75_watched_actions as Array<{ value: string }>),
        videoViews100: getActionValue(data.video_p100_watched_actions as Array<{ value: string }>),

        // Conversions
        leads: actions.find(a => a.action_type === 'lead')?.value || 0,
        purchases: actions.find(a => a.action_type === 'purchase')?.value || 0,
        registrations: actions.find(a => a.action_type === 'complete_registration')?.value || 0,
    };
}

function getActionValue(actions: Array<{ value: string }> | undefined): number {
    return parseInt(actions?.[0]?.value || '0');
}

// Process age breakdown
function processAgeBreakdown(data: Array<{ age: string, impressions: string, clicks: string }>) {
    const ageGroups: Record<string, { impressions: number, clicks: number, percent: number }> = {};
    let totalImpressions = 0;

    data.forEach(item => {
        const age = item.age;
        const impressions = parseInt(item.impressions) || 0;
        totalImpressions += impressions;

        if (!ageGroups[age]) {
            ageGroups[age] = { impressions: 0, clicks: 0, percent: 0 };
        }
        ageGroups[age].impressions += impressions;
        ageGroups[age].clicks += parseInt(item.clicks) || 0;
    });

    // Calculate percentages
    Object.keys(ageGroups).forEach(age => {
        ageGroups[age].percent = totalImpressions > 0
            ? Math.round((ageGroups[age].impressions / totalImpressions) * 100)
            : 0;
    });

    return ageGroups;
}

// Process gender breakdown
function processGenderBreakdown(data: Array<{ gender: string, impressions: string, clicks: string }>) {
    const genders: Record<string, { impressions: number, clicks: number, percent: number }> = {
        male: { impressions: 0, clicks: 0, percent: 0 },
        female: { impressions: 0, clicks: 0, percent: 0 },
        unknown: { impressions: 0, clicks: 0, percent: 0 }
    };
    let totalImpressions = 0;

    data.forEach(item => {
        const gender = item.gender?.toLowerCase() || 'unknown';
        const impressions = parseInt(item.impressions) || 0;
        totalImpressions += impressions;

        if (genders[gender]) {
            genders[gender].impressions += impressions;
            genders[gender].clicks += parseInt(item.clicks) || 0;
        }
    });

    // Calculate percentages
    Object.keys(genders).forEach(g => {
        genders[g].percent = totalImpressions > 0
            ? Math.round((genders[g].impressions / totalImpressions) * 100)
            : 0;
    });

    return genders;
}

// Process country breakdown
function processCountryBreakdown(data: Array<{ country: string, impressions: string, clicks: string, spend: string }>) {
    return data
        .map(item => ({
            country: item.country,
            impressions: parseInt(item.impressions) || 0,
            clicks: parseInt(item.clicks) || 0,
            spend: parseFloat(item.spend) || 0
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10); // Top 10 countries
}

// Process platform breakdown
function processPlatformBreakdown(data: Array<{ publisher_platform: string, impressions: string }>) {
    const platforms: Record<string, number> = {};
    let total = 0;

    data.forEach(item => {
        const platform = item.publisher_platform || 'other';
        const impressions = parseInt(item.impressions) || 0;
        platforms[platform] = (platforms[platform] || 0) + impressions;
        total += impressions;
    });

    // Convert to percentages
    const result: Record<string, number> = {};
    Object.keys(platforms).forEach(p => {
        result[p] = total > 0 ? Math.round((platforms[p] / total) * 100) : 0;
    });

    return result;
}

// Process placement breakdown
function processPlacementBreakdown(data: Array<{ platform_position: string, impressions: string }>) {
    const placements: Record<string, number> = {};
    let total = 0;

    data.forEach(item => {
        const placement = item.platform_position || 'other';
        const impressions = parseInt(item.impressions) || 0;
        placements[placement] = (placements[placement] || 0) + impressions;
        total += impressions;
    });

    // Convert to percentages
    const result: Record<string, number> = {};
    Object.keys(placements).forEach(p => {
        result[p] = total > 0 ? Math.round((placements[p] / total) * 100) : 0;
    });

    return result;
}

// Process device breakdown
function processDeviceBreakdown(data: Array<{ device_platform: string, impressions: string }>) {
    const devices: Record<string, number> = {};
    let total = 0;

    data.forEach(item => {
        const device = item.device_platform || 'other';
        const impressions = parseInt(item.impressions) || 0;
        devices[device] = (devices[device] || 0) + impressions;
        total += impressions;
    });

    // Convert to percentages
    const result: Record<string, number> = {};
    Object.keys(devices).forEach(d => {
        result[d] = total > 0 ? Math.round((devices[d] / total) * 100) : 0;
    });

    return result;
}

// Find most active hour
function findMostActiveHour(data: Array<{ hourly_stats_aggregated_by_advertiser_time_zone: string, impressions: string }>) {
    let maxImpressions = 0;
    let mostActiveHour = 0;

    data.forEach((item) => {
        // Extract hour from the breakdown
        const hourMatch = item.hourly_stats_aggregated_by_advertiser_time_zone?.match(/(\d+):00/);
        if (hourMatch) {
            const hour = parseInt(hourMatch[1]);
            const impressions = parseInt(item.impressions) || 0;
            if (impressions > maxImpressions) {
                maxImpressions = impressions;
                mostActiveHour = hour;
            }
        }
    });

    return mostActiveHour;
}

// Process hourly breakdown
function processHourlyBreakdown(data: Array<{ hourly_stats_aggregated_by_advertiser_time_zone: string, impressions: string, clicks: string }>) {
    const hourlyData: Array<{ hour: number, impressions: number, clicks: number }> = [];

    data.forEach((item) => {
        const hourMatch = item.hourly_stats_aggregated_by_advertiser_time_zone?.match(/(\d+):00/);
        if (hourMatch) {
            hourlyData.push({
                hour: parseInt(hourMatch[1]),
                impressions: parseInt(item.impressions) || 0,
                clicks: parseInt(item.clicks) || 0
            });
        }
    });

    return hourlyData.sort((a, b) => a.hour - b.hour);
}
