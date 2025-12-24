import { NextRequest, NextResponse } from 'next/server';
import { contactsStore, findOrCreateContact, adLinksStore } from '@/lib/contacts-store';

// Webhook Verify Token - set this in environment variables
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'TEST_TOKEN';

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
        text: string;
    };
    postback?: {
        title: string;
        payload: string;
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

// Handle Messenger/Instagram messaging events
async function handleMessagingEvent(pageId: string, event: MessagingEvent) {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const timestamp = event.timestamp;

    console.log('[Webhook] Messaging event:', {
        pageId,
        senderId,
        recipientId,
        hasMessage: !!event.message,
        hasPostback: !!event.postback
    });

    if (event.message) {
        // Handle incoming message
        const messageData = {
            type: 'message',
            pageId,
            senderId,
            messageId: event.message.mid,
            text: event.message.text,
            timestamp: new Date(timestamp).toISOString()
        };

        // Find or create contact by PSID
        let contact = contactsStore.findByFacebookId(undefined, senderId);
        if (!contact) {
            // Create a new contact
            contact = findOrCreateContact({
                name: `Messenger User ${senderId.slice(-6)}`,
                facebookPsid: senderId,
            });
        }

        // Add message to contact
        if (contact && event.message.text) {
            contactsStore.addMessage(contact.id, {
                content: event.message.text,
                direction: 'inbound',
                timestamp: new Date(timestamp).toISOString(),
                messageId: event.message.mid
            });
        }

        console.log('[Webhook] New message stored for contact:', contact?.id);
    }

    if (event.postback) {
        // Handle postback (button click)
        const postbackData = {
            type: 'postback',
            pageId,
            senderId,
            title: event.postback.title,
            payload: event.postback.payload,
            timestamp: new Date(timestamp).toISOString()
        };

        console.log('[Webhook] Postback:', postbackData);
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
            // Message updates
            console.log('[Webhook] Message update:', value);
            break;

        default:
            console.log('[Webhook] Unknown change field:', field, value);
    }
}

// Handle Lead Generation events
async function handleLeadgenEvent(pageId: string, leadData: LeadgenValue, timestamp: number) {
    console.log('[Webhook] New lead received:', {
        pageId,
        leadgenId: leadData.leadgen_id,
        formId: leadData.form_id,
        adId: leadData.ad_id
    });

    // Find the pipeline linked to this ad
    const adLink = adLinksStore.getByAdId(leadData.ad_id);

    // Create contact from lead
    const contact = findOrCreateContact({
        name: `Lead ${leadData.leadgen_id.slice(-8)}`,
        facebookLeadId: leadData.leadgen_id,
        sourceAdId: leadData.ad_id,
        pipelineId: adLink?.pipelineId,
        stageId: adLink?.stageId,
    });

    const leadEvent = {
        type: 'lead',
        pageId,
        leadgenId: leadData.leadgen_id,
        formId: leadData.form_id,
        adId: leadData.ad_id,
        adgroupId: leadData.adgroup_id,
        createdTime: new Date(leadData.created_time * 1000).toISOString(),
        receivedAt: new Date().toISOString(),
        contactId: contact.id
    };

    console.log('[Webhook] Lead stored as contact:', contact.id, leadEvent);
}
