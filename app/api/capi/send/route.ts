import { NextRequest, NextResponse } from 'next/server';
import { sendCAPIEvent, CAPI_EVENT_NAMES } from '@/lib/capi';

/**
 * POST /api/capi/send
 * Send a conversion event to Facebook CAPI
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            datasetId,
            accessToken,
            eventName,
            eventTime,
            eventId,
            leadId,
            email,
            phone,
            firstName,
            lastName,
            clientIpAddress,
            clientUserAgent,
            value,
            currency,
            customData
        } = body;

        // Validate required fields
        if (!datasetId) {
            return NextResponse.json(
                { success: false, error: 'Dataset ID is required' },
                { status: 400 }
            );
        }

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'CAPI Access Token is required' },
                { status: 400 }
            );
        }

        if (!eventName) {
            return NextResponse.json(
                { success: false, error: 'Event name is required' },
                { status: 400 }
            );
        }

        // event_id is REQUIRED for deduplication
        if (!eventId) {
            return NextResponse.json(
                { success: false, error: 'event_id is required for deduplication (use unique conversion ID)' },
                { status: 400 }
            );
        }

        // event_time is REQUIRED for proper attribution
        if (!eventTime) {
            return NextResponse.json(
                { success: false, error: 'event_time is required (Unix timestamp of when action occurred)' },
                { status: 400 }
            );
        }

        // At least one identifier is needed for matching
        if (!leadId && !email && !phone) {
            return NextResponse.json(
                { success: false, error: 'At least one identifier required: leadId, email, or phone' },
                { status: 400 }
            );
        }

        // Send the event
        const result = await sendCAPIEvent(datasetId, accessToken, {
            eventName,
            eventTime,
            eventId,
            leadId,
            email,
            phone,
            firstName,
            lastName,
            clientIpAddress,
            clientUserAgent,
            value,
            currency,
            customData
        });

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Conversion event sent successfully',
                events_received: result.events_received,
                fbtrace_id: result.fbtrace_id
            });
        } else {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('CAPI API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/capi/send
 * Get list of available event names
 */
export async function GET() {
    return NextResponse.json({
        availableEvents: CAPI_EVENT_NAMES,
        documentation: 'https://developers.facebook.com/docs/marketing-api/conversions-api/',
        usage: {
            method: 'POST',
            required: {
                datasetId: 'Your Facebook Dataset ID',
                accessToken: 'Your CAPI Access Token',
                eventName: 'Purchase | Lead | CompleteRegistration | etc.',
                eventId: 'Unique conversion ID for deduplication',
                eventTime: 'Unix timestamp (seconds) when action occurred'
            },
            identifiers: {
                leadId: 'Facebook lead_id from webhook (best - 100% match rate)',
                email: 'User email (will be hashed)',
                phone: 'User phone (will be hashed)'
            },
            optional: {
                firstName: 'User first name (will be hashed)',
                lastName: 'User last name (will be hashed)',
                clientIpAddress: 'User IP address (improves iOS matching)',
                clientUserAgent: 'User agent string (improves matching)',
                value: 'Numeric value of conversion',
                currency: 'USD (default)'
            }
        }
    });
}
