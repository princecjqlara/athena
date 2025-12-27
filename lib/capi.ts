// Facebook Conversions API (CAPI) utility
// Sends conversion events to Facebook with proper user data hashing

/**
 * SHA-256 hash function for user data
 * Facebook requires email, phone, and other PII to be hashed
 */
export async function sha256Hash(value: string): Promise<string> {
    if (!value) return '';

    // Normalize: lowercase and trim
    const normalizedValue = value.toLowerCase().trim();

    // Use Web Crypto API for SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedValue);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

/**
 * Normalize phone number for hashing
 * Remove spaces, dashes, parentheses, and + sign
 */
export function normalizePhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/[\s\-\(\)\+]/g, '');
}

/**
 * Normalize email for hashing
 * Lowercase and trim
 */
export function normalizeEmail(email: string): string {
    if (!email) return '';
    return email.toLowerCase().trim();
}

interface CAPIEventData {
    eventName: string;          // e.g., "Purchase", "Lead", "CompleteRegistration"
    eventTime?: number;         // Unix timestamp (REQUIRED: when action happened)
    eventId: string;            // REQUIRED: unique ID for deduplication
    leadId?: string;            // Facebook lead_id from webhook (BEST for matching)
    email?: string;             // Will be hashed
    phone?: string;             // Will be hashed
    firstName?: string;         // Will be hashed
    lastName?: string;          // Will be hashed
    clientIpAddress?: string;   // Recommended: improves match quality
    clientUserAgent?: string;   // Recommended: improves match quality
    value?: number;             // Conversion value
    currency?: string;          // Default: USD
    customData?: Record<string, any>;  // Additional custom data
}

interface CAPIResponse {
    success: boolean;
    events_received?: number;
    fbtrace_id?: string;
    error?: string;
}

/**
 * Send conversion event to Facebook CAPI
 */
export async function sendCAPIEvent(
    datasetId: string,
    accessToken: string,
    eventData: CAPIEventData
): Promise<CAPIResponse> {
    if (!datasetId || !accessToken) {
        return { success: false, error: 'Missing Dataset ID or Access Token' };
    }

    try {
        // Hash user data
        const hashedEmail = eventData.email ? await sha256Hash(normalizeEmail(eventData.email)) : undefined;
        const hashedPhone = eventData.phone ? await sha256Hash(normalizePhone(eventData.phone)) : undefined;
        const hashedFirstName = eventData.firstName ? await sha256Hash(eventData.firstName.toLowerCase().trim()) : undefined;
        const hashedLastName = eventData.lastName ? await sha256Hash(eventData.lastName.toLowerCase().trim()) : undefined;

        // Build user_data object
        const userData: Record<string, string> = {};

        // Lead ID is the best match - no hashing needed
        if (eventData.leadId) {
            userData.lead_id = eventData.leadId;
        }

        // Add hashed PII for fallback matching
        if (hashedEmail) userData.em = hashedEmail;
        if (hashedPhone) userData.ph = hashedPhone;
        if (hashedFirstName) userData.fn = hashedFirstName;
        if (hashedLastName) userData.ln = hashedLastName;

        // Add client context for improved matching (especially iOS)
        if (eventData.clientIpAddress) userData.client_ip_address = eventData.clientIpAddress;
        if (eventData.clientUserAgent) userData.client_user_agent = eventData.clientUserAgent;

        // Build the event payload
        const eventPayload = {
            event_name: eventData.eventName,
            event_time: eventData.eventTime || Math.floor(Date.now() / 1000),
            event_id: eventData.eventId,  // Required for deduplication
            action_source: 'system_generated',
            user_data: userData,
            custom_data: {
                value: eventData.value || 0,
                currency: eventData.currency || 'USD',
                ...eventData.customData
            }
        };

        // Send to Facebook CAPI
        const response = await fetch(
            `https://graph.facebook.com/v24.0/${datasetId}/events?access_token=${accessToken}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: [eventPayload]
                })
            }
        );

        const result = await response.json();

        if (result.error) {
            console.error('CAPI Error:', result.error);
            return {
                success: false,
                error: result.error.message || 'Facebook API error'
            };
        }

        console.log('✅ CAPI Event sent successfully:', result);
        return {
            success: true,
            events_received: result.events_received,
            fbtrace_id: result.fbtrace_id
        };

    } catch (error) {
        console.error('CAPI send error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Standard event names for CAPI
 */
export const CAPI_EVENT_NAMES = {
    // Standard Facebook events
    PURCHASE: 'Purchase',
    LEAD: 'Lead',
    COMPLETE_REGISTRATION: 'CompleteRegistration',
    SUBSCRIBE: 'Subscribe',
    START_TRIAL: 'StartTrial',
    SCHEDULE: 'Schedule',
    CONTACT: 'Contact',
    SUBMIT_APPLICATION: 'SubmitApplication',
    INITIATE_CHECKOUT: 'InitiateCheckout',
    ADD_TO_CART: 'AddToCart',
    VIEW_CONTENT: 'ViewContent',
    SEARCH: 'Search',
    CUSTOM: 'Custom',
    // Lead Lifecycle Events (Hybrid Scoring Model)
    INQUIRY: 'inquiry',
    INTERESTED: 'interested',
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    LOST: 'lost'
} as const;

