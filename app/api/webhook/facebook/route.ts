import { NextRequest, NextResponse } from 'next/server';
import { supabaseContactsStore, supabaseMessagesStore, findOrCreateSupabaseContact } from '@/lib/supabase-contacts';
import { adLinksStore } from '@/lib/contacts-store';

// Webhook Verify Token - set this in environment variables
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'TEST_TOKEN';
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const USER_ACCESS_TOKEN = process.env.META_MARKETING_TOKEN;

// Cache for page access tokens (fetched dynamically)
let cachedPageTokens: Map<string, string> = new Map();

// Types for webhook events
interface WebhookEntry {
    id: string;
    time: number;
    messaging?: MessagingEvent[];
    changes?: ChangeEvent[];
}

interface MessagingEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
            type: string;
            payload: { url?: string };
        }>;
        is_echo?: boolean;
    };
    postback?: {
        title: string;
        payload: string;
        referral?: ReferralData;
    };
    referral?: ReferralData;
    optin?: {
        ref: string;
        user_ref?: string;
    };
}

interface ReferralData {
    ref?: string;
    source?: string;
    type?: string;
    ad_id?: string;
    ads_context_data?: {
        ad_title?: string;
        photo_url?: string;
        video_url?: string;
        post_id?: string;
        product_id?: string;
    };
}

interface ChangeEvent {
    field: string;
    value: any;
}

interface LeadgenValue {
    ad_id: string;
    form_id: string;
    leadgen_id: string;
    created_time: number;
    page_id: string;
    adgroup_id: string;
}

interface FacebookUserProfile {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    profile_pic?: string;
}

// Fixed pipeline stages for mapping (same as /api/ai/analyze)
const FIXED_PIPELINE_STAGES = [
    { id: 'inquiry', name: 'Inquiry', keywords: ['inquiry', 'initial', 'new', 'contacted'] },
    { id: 'interested', name: 'Interested', keywords: ['interested', 'engaged', 'qualified', 'warm'] },
    { id: 'scheduled', name: 'Scheduled', keywords: ['scheduled', 'negotiating', 'proposal', 'quote'] },
    { id: 'completed', name: 'Completed', keywords: ['completed', 'won', 'closed', 'converted', 'ready'] },
    { id: 'lost', name: 'Lost', keywords: ['lost', 'declined', 'cold'] },
];

// Determine suggested stage based on lead score and intent
function determineSuggestedStage(leadScore: number, intent: string): string {
    const intentLower = intent?.toLowerCase() || '';

    // Check for explicit signals in intent
    if (intentLower.includes('buy') || intentLower.includes('purchase') || intentLower.includes('order') || leadScore >= 80) {
        return 'completed';
    }
    if (intentLower.includes('price') || intentLower.includes('discount') || intentLower.includes('negotiat') || leadScore >= 60) {
        return 'scheduled';
    }
    if (intentLower.includes('interest') || intentLower.includes('info') || intentLower.includes('more') || leadScore >= 40) {
        return 'interested';
    }

    // Default to inquiry for new leads
    return 'inquiry';
}

// Trigger AI analysis for a lead (runs in background, non-blocking)
async function triggerLeadAnalysis(contactId: string, contactName: string) {
    try {
        // Fetch recent messages for this contact
        const messages = await supabaseMessagesStore.getByContact(contactId);

        if (!messages || messages.length === 0) {
            console.log('[Webhook] No messages to analyze for contact:', contactId);
            return;
        }

        // Call the analyze-conversation API
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        const response = await fetch(`${baseUrl}/api/ai/analyze-conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages.slice(-20).map((m: { content: string; direction: string; timestamp?: string }) => ({  // Last 20 messages
                    content: m.content,
                    direction: m.direction,
                    timestamp: m.timestamp
                })),
                contactName
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                const { sentiment, intent, leadScore, summary } = result.data;

                // Determine suggested stage based on AI analysis
                const suggestedStageId = determineSuggestedStage(leadScore, intent);

                // Update contact with AI analysis results AND stage
                await supabaseContactsStore.update(contactId, {
                    ai_analysis: {
                        sentiment,
                        intent,
                        lead_score: leadScore,
                        summary,
                    },
                    stage_id: suggestedStageId, // Auto-update pipeline stage!
                });

                console.log('[Webhook] AI Re-analyzed lead:', {
                    contactId,
                    contactName,
                    newScore: leadScore,
                    intent: intent?.substring(0, 50),
                    suggestedStage: suggestedStageId
                });

                console.log('[Webhook] Stage updated:', {
                    contactId,
                    previousStage: 'unknown', // We don't track previous here
                    newStage: suggestedStageId
                });
            }
        } else {
            console.log('[Webhook] AI analysis failed:', response.status);
        }
    } catch (error) {
        // Don't let analysis failures affect webhook
        console.error('[Webhook] AI analysis error (non-blocking):', error);
    }
}

// GET - Webhook Verification (Facebook verifies your endpoint)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log('[Webhook] Verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Webhook] Verification successful!');
        return new NextResponse(challenge, { status: 200 });
    }

    console.log('[Webhook] Verification failed - token mismatch');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST - Receive Webhook Events
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log('[Webhook] Received event:', JSON.stringify(body, null, 2));

        const { object, entry } = body;

        if (!entry || !Array.isArray(entry)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Process each entry
        for (const entryItem of entry as WebhookEntry[]) {
            const pageId = entryItem.id;
            const timestamp = entryItem.time;

            // Handle Messaging Events (Messenger, Instagram DM)
            if (entryItem.messaging) {
                for (const messagingEvent of entryItem.messaging) {
                    await handleMessagingEvent(pageId, messagingEvent);
                }
            }

            // Handle Change Events (Leads, Page updates, etc.)
            if (entryItem.changes) {
                for (const change of entryItem.changes) {
                    await handleChangeEvent(pageId, change, timestamp);
                }
            }
        }

        // Always respond with 200 to acknowledge receipt
        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        // Still return 200 to prevent Facebook from retrying
        return NextResponse.json({ received: true, error: 'Processing error' }, { status: 200 });
    }
}

// Get page access token - try cached, then fetch dynamically, then fallback to env
async function getPageAccessToken(pageId: string): Promise<string | null> {
    // 1. Check env variable first
    if (PAGE_ACCESS_TOKEN) {
        return PAGE_ACCESS_TOKEN;
    }

    // 2. Check cache
    if (cachedPageTokens.has(pageId)) {
        return cachedPageTokens.get(pageId)!;
    }

    // 3. Try to fetch page token using user's access token
    if (USER_ACCESS_TOKEN) {
        try {
            console.log('[Webhook] Fetching page token dynamically...');
            const url = `https://graph.facebook.com/v24.0/${pageId}?fields=access_token&access_token=${USER_ACCESS_TOKEN}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.access_token) {
                cachedPageTokens.set(pageId, data.access_token);
                console.log('[Webhook] Got page token for', pageId);
                return data.access_token;
            }
        } catch (error) {
            console.error('[Webhook] Failed to fetch page token:', error);
        }
    }

    return null;
}

// Fetch user profile from Facebook Graph API
async function fetchUserProfile(psid: string, pageId?: string): Promise<FacebookUserProfile | null> {
    // Get page token (automatically or from env)
    const accessToken = pageId ? await getPageAccessToken(pageId) : PAGE_ACCESS_TOKEN;

    if (!accessToken) {
        console.log('[Webhook] No access token available, skipping profile fetch');
        return null;
    }

    try {
        const url = `https://graph.facebook.com/v24.0/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${accessToken}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error('[Webhook] Failed to fetch profile:', response.status);
            return null;
        }

        const profile = await response.json();
        console.log('[Webhook] Fetched user profile:', profile.name || profile.first_name);
        return profile;
    } catch (error) {
        console.error('[Webhook] Error fetching profile:', error);
        return null;
    }
}

// Find matching ad in localStorage by Facebook Ad ID
function findImportedAdByFacebookId(adId: string): { id: string; name: string } | null {
    // This would need to be done client-side or through a database
    // For now, we'll store the ad_id for later matching
    console.log('[Webhook] Looking for imported ad with Facebook ID:', adId);
    return null; // Will be enhanced with database lookup
}

// Handle Messenger/Instagram messaging events
async function handleMessagingEvent(pageId: string, event: MessagingEvent) {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const timestamp = event.timestamp;

    // Skip echo messages (messages sent by your page)
    if (event.message?.is_echo) {
        console.log('[Webhook] Skipping echo message');
        return;
    }

    console.log('[Webhook] Messaging event:', {
        pageId,
        senderId,
        recipientId,
        hasMessage: !!event.message,
        hasPostback: !!event.postback,
        hasReferral: !!event.referral,
        hasOptin: !!event.optin
    });

    // Check for ad referral (user came from an ad)
    let sourceAdId: string | undefined;
    let adTitle: string | undefined;
    let referralSource: string | undefined;

    // Referral can come from direct referral, postback, or optin
    const referral = event.referral || event.postback?.referral;
    if (referral) {
        sourceAdId = referral.ad_id;
        adTitle = referral.ads_context_data?.ad_title;
        referralSource = referral.source;

        console.log('[Webhook] 🎯 USER CAME FROM AD:', {
            adId: sourceAdId,
            adTitle,
            source: referralSource,
            type: referral.type
        });
    }

    // Find or create contact in Supabase
    let contact = await supabaseContactsStore.findByFacebookId(undefined, senderId);
    let isNewContact = false;

    if (!contact) {
        isNewContact = true;

        // Try to fetch user profile from Facebook (now auto-gets page token)
        const profile = await fetchUserProfile(senderId, pageId);
        const userName = profile?.name || profile?.first_name || `Messenger User ${senderId.slice(-6)}`;

        // Find pipeline linked to this ad (if referral exists)
        const adLink = sourceAdId ? adLinksStore.getByAdId(sourceAdId) : null;

        // Create new contact in Supabase
        contact = await findOrCreateSupabaseContact({
            name: userName,
            facebookPsid: senderId,
            sourceAdId: sourceAdId,
            sourceAdName: adTitle,
            pipelineId: adLink?.pipelineId,
            stageId: adLink?.stageId,
        });

        console.log('[Webhook] ✨ NEW CONTACT CREATED IN SUPABASE:', {
            id: contact?.id,
            name: userName,
            fromAd: !!sourceAdId,
            adId: sourceAdId
        });
    } else if (sourceAdId && !contact.source_ad_id) {
        // Update existing contact with ad source if not already set
        const updated = await supabaseContactsStore.update(contact.id!, {
            source_ad_id: sourceAdId,
            source_ad_name: adTitle,
        });
        if (updated) contact = updated;
        console.log('[Webhook] Updated contact with ad source:', contact?.id);
    }

    // Handle incoming message
    if (event.message && contact) {
        const messageContent = event.message.text || '[Attachment]';
        const attachments = event.message.attachments?.map(att => ({
            type: att.type,
            url: att.payload.url
        }));

        // Add message to contact in Supabase
        await supabaseMessagesStore.add({
            contact_id: contact.id!,
            content: messageContent,
            direction: 'inbound',
            timestamp: new Date(timestamp).toISOString(),
            message_id: event.message.mid,
        });

        // Update last message timestamp
        await supabaseContactsStore.update(contact.id!, {
            last_message_at: new Date(timestamp).toISOString(),
        });

        console.log('[Webhook] Message stored:', {
            contactId: contact.id,
            contactName: contact.name,
            preview: messageContent.substring(0, 50),
            fromAd: !!contact.source_ad_id
        });

        // Trigger async AI re-analysis for stage placement (don't await - run in background)
        triggerLeadAnalysis(contact.id!, contact.name);
    }

    // Handle postback (button click)
    if (event.postback && contact) {
        await supabaseMessagesStore.add({
            contact_id: contact.id!,
            content: `[Button Click: ${event.postback.title}]`,
            direction: 'inbound',
            timestamp: new Date(timestamp).toISOString(),
        });

        console.log('[Webhook] 🔘 Postback recorded:', event.postback.title);
    }

    // Handle optin (Get Started, checkbox plugin, etc.)
    if (event.optin) {
        console.log('[Webhook] ✅ User opted in:', event.optin);

        if (contact) {
            // Note: opted fields not in Supabase schema, just log for now
            console.log('[Webhook] User opted in with ref:', event.optin.ref);
        }
    }

    // If this is a new contact from an ad, log it for analytics
    if (isNewContact && sourceAdId) {
        console.log('[Webhook] 📊 NEW MESSENGER LEAD FROM AD:', {
            contactId: contact?.id,
            contactName: contact?.name,
            adId: sourceAdId,
            adTitle,
            timestamp: new Date(timestamp).toISOString()
        });
    }
}

// Handle change events (leads, page updates, etc.)
async function handleChangeEvent(pageId: string, change: ChangeEvent, timestamp: number) {
    const { field, value } = change;

    console.log('[Webhook] Change event:', { pageId, field, valueType: typeof value });

    switch (field) {
        case 'leadgen':
            await handleLeadgenEvent(pageId, value as LeadgenValue, timestamp);
            break;

        case 'feed':
            // Page feed updates (posts, comments)
            console.log('[Webhook] Feed update:', value);
            break;

        case 'conversations':
            // Conversation updates
            console.log('[Webhook] Conversation update:', value);
            break;

        case 'messages':
            // Message updates (for Instagram)
            console.log('[Webhook] Message update:', value);
            break;

        case 'messaging_handovers':
            // Handover protocol events
            console.log('[Webhook] Handover event:', value);
            break;

        default:
            console.log('[Webhook] Unknown change field:', field, value);
    }
}

// Handle Lead Generation events (from Lead Ads forms)
async function handleLeadgenEvent(pageId: string, leadData: LeadgenValue, timestamp: number) {
    console.log('[Webhook] 📋 New lead form submission:', {
        pageId,
        leadgenId: leadData.leadgen_id,
        formId: leadData.form_id,
        adId: leadData.ad_id
    });

    // Find the pipeline linked to this ad
    const adLink = adLinksStore.getByAdId(leadData.ad_id);

    // Create contact from lead in Supabase
    const contact = await findOrCreateSupabaseContact({
        name: `Lead ${leadData.leadgen_id.slice(-8)}`,
        facebookLeadId: leadData.leadgen_id,
        sourceAdId: leadData.ad_id,
        pipelineId: adLink?.pipelineId,
        stageId: adLink?.stageId,
    });

    // Optionally fetch lead data from Facebook (requires additional permissions)
    if (PAGE_ACCESS_TOKEN) {
        try {
            const leadUrl = `https://graph.facebook.com/v24.0/${leadData.leadgen_id}?access_token=${PAGE_ACCESS_TOKEN}`;
            const leadResponse = await fetch(leadUrl);

            if (leadResponse.ok) {
                const leadDetails = await leadResponse.json();
                console.log('[Webhook] Lead form data:', leadDetails);

                // Extract field data (name, email, phone, etc.)
                if (leadDetails.field_data) {
                    const fields: Record<string, string> = {};
                    for (const field of leadDetails.field_data) {
                        fields[field.name] = field.values?.[0] || '';
                    }

                    // Update contact with lead data in Supabase
                    await supabaseContactsStore.update(contact!.id!, {
                        name: fields.full_name || fields.first_name || contact!.name,
                        email: fields.email,
                        phone: fields.phone_number || fields.phone,
                    });

                    console.log('[Webhook] Lead contact updated with form data:', fields);
                }
            }
        } catch (error) {
            console.error('[Webhook] Error fetching lead data:', error);
        }
    }

    console.log('[Webhook] ✅ Lead stored as contact:', contact?.id);
}
