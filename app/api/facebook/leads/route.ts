import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/facebook/leads
 * Fetch leads from Facebook Lead Ads
 * 
 * Requires: ads_read, leads_retrieval permissions
 * 
 * Query Parameters:
 * - adId: Facebook Ad ID to fetch leads for
 * - formId: Specific lead form ID to fetch leads from
 * - pageId: Facebook Page ID (for fetching all leads from page forms)
 * - accessToken: User/Page access token
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const adId = searchParams.get('adId');
    const formId = searchParams.get('formId');
    const pageId = searchParams.get('pageId');
    const accessToken = searchParams.get('accessToken') || process.env.META_MARKETING_TOKEN;

    if (!accessToken) {
        return NextResponse.json(
            { success: false, error: 'Missing access token' },
            { status: 400 }
        );
    }

    try {
        let leadsData: any[] = [];
        let adInfo: { id?: string; name?: string } = {};

        // If we have a specific form ID, fetch leads from that form
        if (formId) {
            console.log('[Leads API] Fetching leads from form:', formId);
            const leadsUrl = `https://graph.facebook.com/v24.0/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,campaign_id,form_id&limit=100&access_token=${accessToken}`;
            const response = await fetch(leadsUrl);
            const data = await response.json();

            if (data.error) {
                console.error('[Leads API] Facebook error:', data.error);
                return NextResponse.json(
                    { success: false, error: data.error.message, errorCode: data.error.code },
                    { status: 400 }
                );
            }

            leadsData = data.data || [];
            console.log(`[Leads API] Found ${leadsData.length} leads from form`);
        }
        // If we have a page ID, get all lead forms for that page first
        else if (pageId) {
            console.log('[Leads API] Fetching lead forms for page:', pageId);

            // Get all leadgen forms for this page
            const formsUrl = `https://graph.facebook.com/v24.0/${pageId}/leadgen_forms?fields=id,name,status,leads_count&access_token=${accessToken}`;
            const formsResponse = await fetch(formsUrl);
            const formsData = await formsResponse.json();

            if (formsData.error) {
                console.error('[Leads API] Error fetching forms:', formsData.error);
                return NextResponse.json(
                    { success: false, error: formsData.error.message },
                    { status: 400 }
                );
            }

            const forms = formsData.data || [];
            console.log(`[Leads API] Found ${forms.length} lead forms on page`);

            // Fetch leads from each form
            for (const form of forms) {
                if (form.leads_count > 0) {
                    const formLeadsUrl = `https://graph.facebook.com/v24.0/${form.id}/leads?fields=id,created_time,field_data,ad_id,ad_name,campaign_id,form_id&limit=100&access_token=${accessToken}`;
                    const formLeadsResponse = await fetch(formLeadsUrl);
                    const formLeadsData = await formLeadsResponse.json();

                    if (!formLeadsData.error && formLeadsData.data) {
                        leadsData.push(...formLeadsData.data);
                    }
                }
            }
            console.log(`[Leads API] Total leads from all forms: ${leadsData.length}`);
        }
        // If we have an ad ID, try multiple approaches
        else if (adId) {
            console.log('[Leads API] Fetching leads for ad:', adId);

            // First, get the ad details including the creative and leadgen form ID
            const adUrl = `https://graph.facebook.com/v24.0/${adId}?fields=id,name,adset_id,creative{id,object_story_spec},effective_status&access_token=${accessToken}`;
            const adResponse = await fetch(adUrl);
            const adData = await adResponse.json();

            if (adData.error) {
                console.error('[Leads API] Error fetching ad:', adData.error);
                return NextResponse.json(
                    { success: false, error: adData.error.message },
                    { status: 400 }
                );
            }

            adInfo = { id: adData.id, name: adData.name };
            console.log('[Leads API] Ad info:', adData.name, '- Status:', adData.effective_status);

            // Try to get leads directly from the ad endpoint
            const leadsUrl = `https://graph.facebook.com/v24.0/${adId}/leads?fields=id,created_time,field_data,ad_id,ad_name,campaign_id,form_id&limit=100&access_token=${accessToken}`;
            const leadsResponse = await fetch(leadsUrl);
            const data = await leadsResponse.json();

            if (data.error) {
                // Error code 100 = (#100) Unsupported get request - this is not a lead ad
                if (data.error.code === 100) {
                    console.log('[Leads API] This is not a Lead Ad (no leadgen form attached)');
                    return NextResponse.json({
                        success: true,
                        data: [],
                        adInfo,
                        message: 'This is not a Lead Ad. For Messages/Messenger campaigns, leads come through webhooks.',
                        isLeadAd: false
                    });
                }
                console.error('[Leads API] Error fetching leads:', data.error);
                return NextResponse.json({
                    success: true,
                    data: [],
                    adInfo,
                    error: data.error.message,
                    message: 'Could not fetch leads - check permissions'
                });
            }

            leadsData = data.data || [];
            console.log(`[Leads API] Found ${leadsData.length} leads from ad`);
        }

        // Transform leads into a standardized format
        const transformedLeads = leadsData.map((lead: any) => {
            const fields: Record<string, string> = {};

            if (lead.field_data) {
                lead.field_data.forEach((field: { name: string; values: string[] }) => {
                    // Normalize field names to lowercase
                    const fieldName = field.name.toLowerCase();
                    fields[fieldName] = field.values?.[0] || '';
                    // Also keep original case
                    fields[field.name] = field.values?.[0] || '';
                });
            }

            // Build full name from various possible field combinations
            let fullName = fields.full_name || fields.FULL_NAME || fields.fullname || null;
            if (!fullName) {
                const firstName = fields.first_name || fields.FIRST_NAME || fields.firstname || '';
                const lastName = fields.last_name || fields.LAST_NAME || fields.lastname || '';
                if (firstName || lastName) {
                    fullName = `${firstName} ${lastName}`.trim();
                }
            }

            return {
                id: lead.id,
                createdAt: lead.created_time,
                adId: lead.ad_id || adInfo.id,
                adName: lead.ad_name || adInfo.name,
                campaignId: lead.campaign_id,
                formId: lead.form_id,
                // Common lead fields with multiple fallback keys
                email: fields.email || fields.EMAIL || fields.e_mail || null,
                phone: fields.phone_number || fields.PHONE || fields.phone || fields.mobile || fields.tel || null,
                fullName: fullName,
                firstName: fields.first_name || fields.FIRST_NAME || fields.firstname || null,
                lastName: fields.last_name || fields.LAST_NAME || fields.lastname || null,
                // Additional common fields
                city: fields.city || fields.CITY || null,
                state: fields.state || fields.STATE || null,
                country: fields.country || fields.COUNTRY || null,
                zipCode: fields.zip_code || fields.ZIP_CODE || fields.postal_code || null,
                // All raw fields for custom field access
                rawFields: fields,
                // Metadata
                isRealLead: true,
                source: 'facebook_lead_ad'
            };
        });

        return NextResponse.json({
            success: true,
            data: transformedLeads,
            total: transformedLeads.length,
            adInfo,
            isLeadAd: true
        });

    } catch (error) {
        console.error('[Leads API] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
