import { NextRequest, NextResponse } from 'next/server';

/**
 * Facebook Marketing API - Simplified Objectives (v19.0+)
 * As of 2024, Meta requires using simplified objectives:
 * - OUTCOME_AWARENESS: Brand awareness, reach
 * - OUTCOME_ENGAGEMENT: Post engagement, page likes, event responses
 * - OUTCOME_LEADS: Lead generation
 * - OUTCOME_SALES: Conversions, catalog sales
 * - OUTCOME_TRAFFIC: Link clicks, landing page views
 * - OUTCOME_APP_PROMOTION: App installs
 */
const VALID_OBJECTIVES = [
    'OUTCOME_AWARENESS',
    'OUTCOME_ENGAGEMENT',
    'OUTCOME_LEADS',
    'OUTCOME_SALES',
    'OUTCOME_TRAFFIC',
    'OUTCOME_APP_PROMOTION'
] as const;

// Map common names to Facebook objectives
const OBJECTIVE_ALIASES: Record<string, typeof VALID_OBJECTIVES[number]> = {
    // Awareness
    'awareness': 'OUTCOME_AWARENESS',
    'brand': 'OUTCOME_AWARENESS',
    'reach': 'OUTCOME_AWARENESS',
    'brand_awareness': 'OUTCOME_AWARENESS',

    // Engagement
    'engagement': 'OUTCOME_ENGAGEMENT',
    'likes': 'OUTCOME_ENGAGEMENT',
    'page_likes': 'OUTCOME_ENGAGEMENT',
    'post_engagement': 'OUTCOME_ENGAGEMENT',
    'messages': 'OUTCOME_ENGAGEMENT',

    // Leads
    'leads': 'OUTCOME_LEADS',
    'lead_generation': 'OUTCOME_LEADS',
    'lead': 'OUTCOME_LEADS',

    // Sales/Conversions
    'sales': 'OUTCOME_SALES',
    'conversions': 'OUTCOME_SALES',
    'purchase': 'OUTCOME_SALES',
    'purchases': 'OUTCOME_SALES',
    'catalog': 'OUTCOME_SALES',

    // Traffic
    'traffic': 'OUTCOME_TRAFFIC',
    'clicks': 'OUTCOME_TRAFFIC',
    'link_clicks': 'OUTCOME_TRAFFIC',
    'website': 'OUTCOME_TRAFFIC',
    'website_traffic': 'OUTCOME_TRAFFIC',

    // App
    'app': 'OUTCOME_APP_PROMOTION',
    'app_install': 'OUTCOME_APP_PROMOTION',
    'app_installs': 'OUTCOME_APP_PROMOTION',
    'app_promotion': 'OUTCOME_APP_PROMOTION'
};

/**
 * POST /api/facebook/campaigns
 * Create a new Facebook ad campaign
 * 
 * Required: ads_management permission
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            objective,          // One of VALID_OBJECTIVES or an alias
            status = 'PAUSED',  // Start paused by default for safety
            specialAdCategories = [], // HOUSING, EMPLOYMENT, CREDIT, etc.
            accessToken,
            adAccountId
        } = body;

        const token = accessToken || process.env.META_MARKETING_TOKEN;
        const accountId = adAccountId || process.env.META_AD_ACCOUNT_ID;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Missing campaign name' },
                { status: 400 }
            );
        }

        if (!objective) {
            return NextResponse.json(
                { success: false, error: 'Missing campaign objective. Valid options: awareness, engagement, leads, sales, traffic, app' },
                { status: 400 }
            );
        }

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Missing accessToken. Set META_MARKETING_TOKEN in environment variables or provide in request.' },
                { status: 400 }
            );
        }

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: 'Missing adAccountId. Set META_AD_ACCOUNT_ID in environment variables or provide in request.' },
                { status: 400 }
            );
        }

        // Resolve objective from alias
        const normalizedObjective = objective.toLowerCase().replace(/[^a-z_]/g, '');
        let fbObjective: string = objective.toUpperCase();

        if (OBJECTIVE_ALIASES[normalizedObjective]) {
            fbObjective = OBJECTIVE_ALIASES[normalizedObjective];
        } else if (!VALID_OBJECTIVES.includes(objective.toUpperCase() as typeof VALID_OBJECTIVES[number])) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid objective "${objective}". Valid options: awareness, engagement, leads, sales, traffic, app`,
                    validObjectives: Object.keys(OBJECTIVE_ALIASES)
                },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['ACTIVE', 'PAUSED'];
        const campaignStatus = status.toUpperCase();
        if (!validStatuses.includes(campaignStatus)) {
            return NextResponse.json(
                { success: false, error: 'Invalid status. Must be ACTIVE or PAUSED' },
                { status: 400 }
            );
        }

        // Create campaign via Facebook Marketing API
        const createUrl = `https://graph.facebook.com/v24.0/act_${accountId}/campaigns`;

        const campaignData: Record<string, unknown> = {
            name,
            objective: fbObjective,
            status: campaignStatus,
            access_token: token
        };

        // Add special ad categories if provided
        if (specialAdCategories && specialAdCategories.length > 0) {
            campaignData.special_ad_categories = JSON.stringify(specialAdCategories);
        } else {
            // Required field - empty array for no special categories
            campaignData.special_ad_categories = JSON.stringify([]);
        }

        const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(campaignData as Record<string, string>).toString()
        });

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API error:', data.error);
            return NextResponse.json(
                {
                    success: false,
                    error: data.error.message || 'Failed to create campaign',
                    errorCode: data.error.code,
                    errorSubcode: data.error.error_subcode
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            campaignId: data.id,
            name,
            objective: fbObjective,
            status: campaignStatus,
            message: `Campaign "${name}" created successfully!`
        });

    } catch (error) {
        console.error('Campaign creation error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to create campaign' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/facebook/campaigns
 * List all campaigns for the ad account
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const adAccountId = searchParams.get('adAccountId') || process.env.META_AD_ACCOUNT_ID;
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;
    const status = searchParams.get('status') || 'all';

    if (!adAccountId || !accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing adAccountId or accessToken' },
            { status: 400 }
        );
    }

    try {
        let statusFilter = '';
        if (status !== 'all') {
            statusFilter = `&filtering=[{"field":"effective_status","operator":"IN","value":["${status.toUpperCase()}"]}]`;
        }

        const url = `https://graph.facebook.com/v24.0/act_${adAccountId}/campaigns?fields=id,name,objective,status,effective_status,created_time,daily_budget,lifetime_budget&limit=50${statusFilter}&access_token=${accessToken}`;

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
            campaigns: data.data || [],
            paging: data.paging
        });

    } catch (error) {
        console.error('Campaign fetch error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch campaigns' },
            { status: 500 }
        );
    }
}
