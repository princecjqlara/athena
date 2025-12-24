import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/facebook/leads
 * Fetch leads from Facebook Lead Ads
 * 
 * Requires: ads_read, leads_retrieval permissions
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const adId = searchParams.get('adId');
    const formId = searchParams.get('formId');
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;

    if (!accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing access token' },
            { status: 400 }
        );
    }

    try {
        let leadsData: any[] = [];

        // If we have a specific form ID, fetch leads from that form
        if (formId) {
            const leadsUrl = `https://graph.facebook.com/v24.0/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,campaign_id&access_token=${accessToken}`;
            const response = await fetch(leadsUrl);
            const data = await response.json();

            if (data.error) {
                console.error('Facebook Leads API error:', data.error);
                return NextResponse.json(
                    { success: false, error: data.error.message },
                    { status: 400 }
                );
            }

            leadsData = data.data || [];
        }
        // If we have an ad ID, get the leadgen forms for that ad first
        else if (adId) {
            // Get the ad's adset to find lead forms
            const adUrl = `https://graph.facebook.com/v24.0/${adId}?fields=adset_id&access_token=${accessToken}`;
            const adResponse = await fetch(adUrl);
            const adData = await adResponse.json();

            if (adData.error) {
                return NextResponse.json(
                    { success: false, error: adData.error.message },
                    { status: 400 }
                );
            }

            // Try to get leads directly from the ad
            const leadsUrl = `https://graph.facebook.com/v24.0/${adId}/leads?fields=id,created_time,field_data&access_token=${accessToken}`;
            const leadsResponse = await fetch(leadsUrl);
            const data = await leadsResponse.json();

            if (data.error) {
                // If direct lead fetch fails, it might not be a lead ad
                console.log('No leads endpoint for this ad:', data.error.message);
                return NextResponse.json({
                    success: true,
                    data: [],
                    message: 'This ad may not be a Lead Ad or has no leads yet'
                });
            }

            leadsData = data.data || [];
        }

        // Transform leads into a standardized format
        const transformedLeads = leadsData.map((lead: any) => {
            const fields: Record<string, string> = {};

            if (lead.field_data) {
                lead.field_data.forEach((field: { name: string; values: string[] }) => {
                    fields[field.name] = field.values?.[0] || '';
                });
            }

            return {
                id: lead.id,
                createdAt: lead.created_time,
                adId: lead.ad_id,
                adName: lead.ad_name,
                campaignId: lead.campaign_id,
                // Common lead fields
                email: fields.email || fields.EMAIL || null,
                phone: fields.phone_number || fields.PHONE || fields.phone || null,
                fullName: fields.full_name || fields.FULL_NAME ||
                    (fields.first_name && fields.last_name
                        ? `${fields.first_name} ${fields.last_name}`
                        : fields.first_name || fields.last_name || null),
                firstName: fields.first_name || fields.FIRST_NAME || null,
                lastName: fields.last_name || fields.LAST_NAME || null,
                // All raw fields
                rawFields: fields
            };
        });

        return NextResponse.json({
            success: true,
            data: transformedLeads,
            total: transformedLeads.length
        });

    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
