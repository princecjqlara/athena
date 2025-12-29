import { NextRequest, NextResponse } from 'next/server';

/**
 * Optimization Goals for different campaign objectives
 */
const OPTIMIZATION_GOALS = {
    'OUTCOME_AWARENESS': ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT', 'THRUPLAY'],
    'OUTCOME_ENGAGEMENT': ['ENGAGED_USERS', 'POST_ENGAGEMENT', 'PAGE_LIKES', 'CONVERSATIONS'],
    'OUTCOME_LEADS': ['LEAD_GENERATION', 'QUALITY_LEAD', 'CONVERSATIONS', 'LANDING_PAGE_VIEWS'],
    'OUTCOME_SALES': ['OFFSITE_CONVERSIONS', 'VALUE', 'CONVERSATIONS'],
    'OUTCOME_TRAFFIC': ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH'],
    'OUTCOME_APP_PROMOTION': ['APP_INSTALLS', 'OFFSITE_CONVERSIONS', 'VALUE']
} as const;

const BILLING_EVENTS = ['IMPRESSIONS', 'LINK_CLICKS', 'APP_INSTALLS', 'THRUPLAY'] as const;

/**
 * Build targeting spec from simplified parameters
 */
function buildTargetingSpec(params: {
    countries?: string[];
    cities?: string[];
    regions?: string[];
    ageMin?: number;
    ageMax?: number;
    genders?: number[]; // 1 = male, 2 = female
    interests?: string[];
    behaviors?: string[];
    customAudiences?: string[];
    excludedCustomAudiences?: string[];
    locales?: string[];
    devicePlatforms?: string[];
    publisherPlatforms?: string[];
}): Record<string, unknown> {
    const targeting: Record<string, unknown> = {};

    // Geographic targeting
    const geoLocations: Record<string, unknown[]> = {};

    if (params.countries && params.countries.length > 0) {
        geoLocations.countries = params.countries.map(c => c.toUpperCase());
    }

    if (params.cities && params.cities.length > 0) {
        // Cities require {key: string} format - simplified for now
        geoLocations.cities = params.cities.map(city => ({ key: city }));
    }

    if (params.regions && params.regions.length > 0) {
        geoLocations.regions = params.regions.map(region => ({ key: region }));
    }

    // Default to Philippines if no location specified
    if (Object.keys(geoLocations).length === 0) {
        geoLocations.countries = ['PH'];
    }

    targeting.geo_locations = geoLocations;

    // Age targeting (Facebook: 18-65+)
    if (params.ageMin) {
        targeting.age_min = Math.max(18, Math.min(65, params.ageMin));
    }
    if (params.ageMax) {
        targeting.age_max = Math.max(18, Math.min(65, params.ageMax));
    }

    // Gender targeting
    if (params.genders && params.genders.length > 0) {
        targeting.genders = params.genders;
    }

    // Interest targeting
    if (params.interests && params.interests.length > 0) {
        targeting.flexible_spec = [{
            interests: params.interests.map(interest => ({
                name: interest
            }))
        }];
    }

    // Custom audiences
    if (params.customAudiences && params.customAudiences.length > 0) {
        targeting.custom_audiences = params.customAudiences.map(id => ({ id }));
    }

    if (params.excludedCustomAudiences && params.excludedCustomAudiences.length > 0) {
        targeting.excluded_custom_audiences = params.excludedCustomAudiences.map(id => ({ id }));
    }

    // Publisher platforms
    if (params.publisherPlatforms && params.publisherPlatforms.length > 0) {
        targeting.publisher_platforms = params.publisherPlatforms;
    }

    // Device platforms
    if (params.devicePlatforms && params.devicePlatforms.length > 0) {
        targeting.device_platforms = params.devicePlatforms;
    }

    // Locales (language targeting)
    if (params.locales && params.locales.length > 0) {
        targeting.locales = params.locales;
    }

    return targeting;
}

/**
 * POST /api/facebook/adsets
 * Create a new Facebook ad set
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            campaignId,
            dailyBudget,          // In currency units (e.g., 500 for ₱500)
            lifetimeBudget,       // Alternative to daily budget
            startTime,            // ISO 8601 format
            endTime,              // ISO 8601 format (required for lifetime budget)
            optimizationGoal,     // e.g., 'LEAD_GENERATION', 'LINK_CLICKS'
            billingEvent = 'IMPRESSIONS',
            bidAmount,            // Optional manual bid in currency units
            status = 'PAUSED',
            // Targeting parameters
            targeting = {},
            // Simplified targeting (converted to targeting spec)
            countries,
            cities,
            regions,
            ageMin,
            ageMax,
            genders,
            interests,
            // Destination
            destinationType,      // 'WEBSITE', 'APP', 'MESSENGER', 'WHATSAPP'
            pageId,               // Required for some destination types
            accessToken,
            adAccountId
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;
        const accountId = adAccountId || process.env.META_AD_ACCOUNT_ID;

        // Validation
        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Missing ad set name' },
                { status: 400 }
            );
        }

        if (!campaignId) {
            return NextResponse.json(
                { success: false, error: 'Missing campaignId. Create a campaign first.' },
                { status: 400 }
            );
        }

        if (!dailyBudget && !lifetimeBudget) {
            return NextResponse.json(
                { success: false, error: 'Must provide either dailyBudget or lifetimeBudget' },
                { status: 400 }
            );
        }

        if (lifetimeBudget && !endTime) {
            return NextResponse.json(
                { success: false, error: 'endTime is required when using lifetime budget' },
                { status: 400 }
            );
        }

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

        // Build targeting spec from simplified parameters if not already provided
        let targetingSpec = targeting;
        if (countries || cities || regions || ageMin || ageMax || genders || interests) {
            targetingSpec = buildTargetingSpec({
                countries,
                cities,
                regions,
                ageMin,
                ageMax,
                genders,
                interests
            });
        }

        // Ensure targeting spec is not empty
        if (Object.keys(targetingSpec).length === 0) {
            targetingSpec = buildTargetingSpec({ countries: ['PH'] }); // Default to Philippines
        }

        // Build ad set data
        const adsetData: Record<string, unknown> = {
            name,
            campaign_id: campaignId,
            status: status.toUpperCase(),
            targeting: JSON.stringify(targetingSpec),
            optimization_goal: optimizationGoal || 'LINK_CLICKS',
            billing_event: billingEvent.toUpperCase(),
            access_token: token
        };

        // Budget (Facebook expects cents)
        if (dailyBudget) {
            adsetData.daily_budget = Math.round(dailyBudget * 100);
        }
        if (lifetimeBudget) {
            adsetData.lifetime_budget = Math.round(lifetimeBudget * 100);
        }

        // Scheduling
        if (startTime) {
            adsetData.start_time = new Date(startTime).toISOString();
        }
        if (endTime) {
            adsetData.end_time = new Date(endTime).toISOString();
        }

        // Bid amount (Facebook expects cents)
        if (bidAmount) {
            adsetData.bid_amount = Math.round(bidAmount * 100);
        }

        // Destination
        if (destinationType) {
            adsetData.destination_type = destinationType;
        }
        if (pageId) {
            adsetData.promoted_object = JSON.stringify({ page_id: pageId });
        }

        // Create ad set via Facebook Marketing API
        const createUrl = `https://graph.facebook.com/v24.0/act_${accountId}/adsets`;

        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(adsetData as Record<string, string>).toString()
        });

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API error:', data.error);

            // Provide helpful error messages
            let errorMessage = data.error.message;
            if (data.error.code === 100) {
                if (errorMessage.includes('daily_budget')) {
                    errorMessage = 'Daily budget must be at least ₱200 (or currency equivalent minimum)';
                } else if (errorMessage.includes('targeting')) {
                    errorMessage = 'Invalid targeting configuration. Check countries, ages, or interests.';
                }
            }

            return NextResponse.json(
                {
                    success: false,
                    error: errorMessage,
                    errorCode: data.error.code,
                    errorSubcode: data.error.error_subcode,
                    facebookError: data.error
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            adsetId: data.id,
            name,
            campaignId,
            status: status.toUpperCase(),
            dailyBudget,
            lifetimeBudget,
            targeting: targetingSpec,
            message: `Ad set "${name}" created successfully!`
        });

    } catch (error) {
        console.error('Ad set creation error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to create ad set' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/facebook/adsets
 * List ad sets for a campaign
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get('campaignId');
    const adAccountId = searchParams.get('adAccountId') || process.env.META_AD_ACCOUNT_ID;
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;

    if (!accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing accessToken' },
            { status: 400 }
        );
    }

    try {
        let url: string;

        if (campaignId) {
            // Get ad sets for a specific campaign
            url = `https://graph.facebook.com/v24.0/${campaignId}/adsets?fields=id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,targeting,optimization_goal,billing_event,bid_amount&access_token=${accessToken}`;
        } else if (adAccountId) {
            // Get all ad sets for the account
            url = `https://graph.facebook.com/v24.0/act_${adAccountId}/adsets?fields=id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,campaign_id,optimization_goal&limit=50&access_token=${accessToken}`;
        } else {
            return NextResponse.json(
                { success: false, error: 'Must provide either campaignId or adAccountId' },
                { status: 400 }
            );
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            return NextResponse.json(
                { success: false, error: data.error.message },
                { status: 400 }
            );
        }

        // Convert budget from cents to currency units
        const adsets = (data.data || []).map((adset: Record<string, unknown>) => ({
            ...adset,
            daily_budget: adset.daily_budget ? Number(adset.daily_budget) / 100 : null,
            lifetime_budget: adset.lifetime_budget ? Number(adset.lifetime_budget) / 100 : null,
            bid_amount: adset.bid_amount ? Number(adset.bid_amount) / 100 : null
        }));

        return NextResponse.json({
            success: true,
            adsets,
            paging: data.paging
        });

    } catch (error) {
        console.error('Ad set fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch ad sets' },
            { status: 500 }
        );
    }
}
