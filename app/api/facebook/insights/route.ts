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
            hourlyBreakdown,
            dailyBreakdown
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
            fetchInsightsWithBreakdown(adId, accessToken, 'hourly_stats_aggregated_by_advertiser_time_zone', 'impressions,clicks'),
            // Daily breakdown (day-by-day performance with ALL metrics)
            fetchDailyInsights(adId, accessToken, 'impressions,reach,frequency,clicks,ctr,cpc,cpm,cpp,spend,actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions,video_play_actions,inline_link_clicks,inline_post_engagement,unique_clicks,cost_per_unique_click,outbound_clicks,cost_per_outbound_click')
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

            // Daily breakdown (day-by-day report)
            dailyReport: processDailyBreakdown(dailyBreakdown),

            // Raw data for debugging
            _raw: {
                basic: basicInsights,
                ageGender: ageGenderBreakdown,
                country: countryBreakdown,
                daily: dailyBreakdown,
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

// Helper: Fetch daily insights (day-by-day breakdown)
async function fetchDailyInsights(adId: string, accessToken: string, fields: string) {
    // Calculate date range: last 90 days (more reliable than date_preset=maximum)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const dateFormat = (d: Date) => d.toISOString().split('T')[0];
    const since = dateFormat(startDate);
    const until = dateFormat(endDate);

    // Build URL with explicit date range
    const url = `https://graph.facebook.com/v24.0/${adId}/insights?fields=${fields},date_start,date_stop&time_increment=1&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;

    console.log('[FetchDailyInsights] Requesting daily breakdown:', { adId, since, until });

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log('[FetchDailyInsights] Response:', {
            hasData: !!data.data,
            daysCount: data.data?.length || 0,
            error: data.error?.message || null,
            errorCode: data.error?.code || null
        });

        // If we got an error, try with simpler fields as fallback
        if (data.error) {
            console.error('[FetchDailyInsights] Facebook API Error:', data.error);

            // Try with minimal fields as fallback
            const fallbackUrl = `https://graph.facebook.com/v24.0/${adId}/insights?fields=impressions,reach,clicks,spend,ctr,cpc,cpm,date_start,date_stop&time_increment=1&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
            console.log('[FetchDailyInsights] Trying fallback with minimal fields...');

            const fallbackResponse = await fetch(fallbackUrl);
            const fallbackData = await fallbackResponse.json();

            console.log('[FetchDailyInsights] Fallback response:', {
                hasData: !!fallbackData.data,
                daysCount: fallbackData.data?.length || 0,
                error: fallbackData.error?.message || null
            });

            return fallbackData.data || [];
        }

        return data.data || [];
    } catch (error) {
        console.error('[FetchDailyInsights] Fetch error:', error);
        return [];
    }
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

// Interface for daily data with ALL metrics
interface DailyDataItem {
    date_start: string;
    date_stop: string;
    impressions?: string;
    reach?: string;
    frequency?: string;
    clicks?: string;
    unique_clicks?: string;
    spend?: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
    cpp?: string;
    cost_per_unique_click?: string;
    inline_link_clicks?: string;
    inline_post_engagement?: string;
    outbound_clicks?: Array<{ value: string }>;
    cost_per_outbound_click?: Array<{ value: string }>;
    video_p25_watched_actions?: Array<{ value: string }>;
    video_p50_watched_actions?: Array<{ value: string }>;
    video_p75_watched_actions?: Array<{ value: string }>;
    video_p100_watched_actions?: Array<{ value: string }>;
    video_avg_time_watched_actions?: Array<{ value: string }>;
    video_play_actions?: Array<{ value: string }>;
    actions?: Array<{ action_type: string; value: string }>;
}

// Helper to get first value from action array
function getFirstValue(arr: Array<{ value: string }> | undefined): number {
    return parseInt(arr?.[0]?.value || '0');
}

// Process daily breakdown for day-by-day reports with ALL metrics
function processDailyBreakdown(data: DailyDataItem[]) {
    if (!data || data.length === 0) {
        return {
            days: [],
            videoRetention: null,
            summary: {
                totalDays: 0,
                startDate: null,
                endDate: null,
                avgDailySpend: 0,
                avgDailyClicks: 0,
                avgDailyImpressions: 0,
                bestDay: null,
                worstDay: null,
                totalVideoPlays: 0,
                avgWatchTime: 0
            }
        };
    }

    // Sort by date
    const sortedData = [...data].sort((a, b) =>
        new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );

    // Aggregate video retention data across all days
    let totalVideoPlays = 0;
    let totalP25 = 0, totalP50 = 0, totalP75 = 0, totalP100 = 0;
    let totalWatchTime = 0;
    let watchTimeCount = 0;

    const days = sortedData.map(item => {
        const actions = item.actions || [];

        // Video metrics
        const videoPlays = getFirstValue(item.video_play_actions);
        const p25 = getFirstValue(item.video_p25_watched_actions);
        const p50 = getFirstValue(item.video_p50_watched_actions);
        const p75 = getFirstValue(item.video_p75_watched_actions);
        const p100 = getFirstValue(item.video_p100_watched_actions);
        const avgWatchTime = parseFloat(item.video_avg_time_watched_actions?.[0]?.value || '0');

        // Aggregate for retention graph
        totalVideoPlays += videoPlays;
        totalP25 += p25;
        totalP50 += p50;
        totalP75 += p75;
        totalP100 += p100;
        if (avgWatchTime > 0) {
            totalWatchTime += avgWatchTime;
            watchTimeCount++;
        }

        return {
            date: item.date_start,
            // Core metrics
            impressions: parseInt(item.impressions || '0'),
            reach: parseInt(item.reach || '0'),
            frequency: parseFloat(item.frequency || '0'),
            clicks: parseInt(item.clicks || '0'),
            uniqueClicks: parseInt(item.unique_clicks || '0'),
            spend: parseFloat(item.spend || '0'),
            ctr: parseFloat(item.ctr || '0'),
            cpc: parseFloat(item.cpc || '0'),
            cpm: parseFloat(item.cpm || '0'),
            cpp: parseFloat(item.cpp || '0'),
            costPerUniqueClick: parseFloat(item.cost_per_unique_click || '0'),

            // Engagement metrics
            linkClicks: parseInt(item.inline_link_clicks || '0'),
            postEngagement: parseInt(item.inline_post_engagement || '0'),
            outboundClicks: getFirstValue(item.outbound_clicks),

            // Video metrics (per day)
            videoPlays,
            videoP25: p25,
            videoP50: p50,
            videoP75: p75,
            videoP100: p100,
            avgWatchTime,

            // Conversion metrics
            leads: parseInt(actions.find(a => a.action_type === 'lead')?.value || '0'),
            purchases: parseInt(actions.find(a => a.action_type === 'purchase')?.value || '0'),
            messagesStarted: parseInt(actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || '0'),
            pageEngagement: parseInt(actions.find(a => a.action_type === 'page_engagement')?.value || '0'),
            postReactions: parseInt(actions.find(a => a.action_type === 'post_reaction')?.value || '0'),
            comments: parseInt(actions.find(a => a.action_type === 'comment')?.value || '0'),
            shares: parseInt(actions.find(a => a.action_type === 'post')?.value || '0')
        };
    });

    // Calculate summary stats
    const totalSpend = days.reduce((sum, d) => sum + d.spend, 0);
    const totalClicks = days.reduce((sum, d) => sum + d.clicks, 0);
    const totalImpressions = days.reduce((sum, d) => sum + d.impressions, 0);

    // Find best and worst days by CTR (if they have impressions)
    const daysWithData = days.filter(d => d.impressions > 0);
    const bestDay = daysWithData.length > 0
        ? daysWithData.reduce((best, d) => d.ctr > best.ctr ? d : best)
        : null;
    const worstDay = daysWithData.length > 0
        ? daysWithData.reduce((worst, d) => d.ctr < worst.ctr ? d : worst)
        : null;

    // Build video retention graph data (aggregated percentages)
    const videoRetention = totalVideoPlays > 0 ? {
        totalPlays: totalVideoPlays,
        retention: [
            { point: '0%', viewers: totalVideoPlays, percent: 100 },
            { point: '25%', viewers: totalP25, percent: Math.round((totalP25 / totalVideoPlays) * 100) },
            { point: '50%', viewers: totalP50, percent: Math.round((totalP50 / totalVideoPlays) * 100) },
            { point: '75%', viewers: totalP75, percent: Math.round((totalP75 / totalVideoPlays) * 100) },
            { point: '100%', viewers: totalP100, percent: Math.round((totalP100 / totalVideoPlays) * 100) }
        ],
        avgWatchTime: watchTimeCount > 0 ? totalWatchTime / watchTimeCount : 0,
        completionRate: Math.round((totalP100 / totalVideoPlays) * 100)
    } : null;

    // Build daily watch time trend for graph
    const watchTimeTrend = days
        .filter(d => d.avgWatchTime > 0)
        .map(d => ({
            date: d.date,
            avgWatchTime: d.avgWatchTime,
            videoPlays: d.videoPlays
        }));

    return {
        days,
        videoRetention,
        watchTimeTrend,
        summary: {
            totalDays: days.length,
            startDate: days[0]?.date || null,
            endDate: days[days.length - 1]?.date || null,
            avgDailySpend: days.length > 0 ? Math.round((totalSpend / days.length) * 100) / 100 : 0,
            avgDailyClicks: days.length > 0 ? Math.round(totalClicks / days.length) : 0,
            avgDailyImpressions: days.length > 0 ? Math.round(totalImpressions / days.length) : 0,
            totalSpend: Math.round(totalSpend * 100) / 100,
            totalClicks,
            totalImpressions,
            totalVideoPlays,
            avgWatchTime: watchTimeCount > 0 ? Math.round((totalWatchTime / watchTimeCount) * 10) / 10 : 0,
            videoCompletionRate: totalVideoPlays > 0 ? Math.round((totalP100 / totalVideoPlays) * 100) : 0,
            bestDay: bestDay ? { date: bestDay.date, ctr: bestDay.ctr, clicks: bestDay.clicks, spend: bestDay.spend } : null,
            worstDay: worstDay ? { date: worstDay.date, ctr: worstDay.ctr, clicks: worstDay.clicks, spend: worstDay.spend } : null
        }
    };
}
