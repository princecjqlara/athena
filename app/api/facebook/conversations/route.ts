import { NextRequest, NextResponse } from 'next/server';

interface Conversation {
    id: string;
    link?: string;
    updated_time: string;
    participants?: {
        data: Array<{
            id: string;
            name: string;
            email?: string;
        }>;
    };
    messages?: {
        data: Array<{
            id: string;
            message: string;
            from: { id: string; name: string; email?: string };
            created_time: string;
        }>;
    };
}

interface ConversationsResponse {
    data: Conversation[];
    paging?: {
        cursors: { before: string; after: string };
        next?: string;
    };
}

/**
 * GET /api/facebook/conversations
 * Fetch all Messenger conversations for a Page, including historical ones.
 * This allows importing old leads/contacts who messaged from ads.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('page_id');
    const pageAccessToken = searchParams.get('page_access_token');
    const userAccessToken = searchParams.get('access_token'); // Fallback to user token
    const limit = parseInt(searchParams.get('limit') || '50');

    // Need either page token or user token with page_id
    let accessToken = pageAccessToken;

    if (!accessToken && userAccessToken && pageId) {
        // Try to get page token from user token
        try {
            const pageUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=access_token&access_token=${userAccessToken}`;
            const pageResponse = await fetch(pageUrl);
            const pageData = await pageResponse.json();
            if (pageData.access_token) {
                accessToken = pageData.access_token;
            }
        } catch (e) {
            console.error('[Conversations] Failed to get page token:', e);
        }
    }

    if (!accessToken) {
        return NextResponse.json(
            { error: 'page_access_token or (access_token + page_id) is required' },
            { status: 400 }
        );
    }

    try {
        console.log('[Conversations] Fetching conversations...');

        // Fetch conversations with participants and messages
        const conversationsUrl = `https://graph.facebook.com/v24.0/me/conversations?fields=id,link,updated_time,participants,messages.limit(5){id,message,from,created_time}&limit=${limit}&access_token=${accessToken}`;

        const response = await fetch(conversationsUrl);
        const data: ConversationsResponse = await response.json();

        if (!response.ok) {
            console.error('[Conversations] Error fetching:', data);
            return NextResponse.json(
                { error: 'Failed to fetch conversations', details: data },
                { status: response.status }
            );
        }

        console.log(`[Conversations] Found ${data.data?.length || 0} conversations`);

        // Process conversations into contact format
        const contacts = data.data.map(conv => {
            // Get the customer (non-page participant)
            const participants = conv.participants?.data || [];
            const customer = participants.find(p => p.id !== pageId) || participants[0];

            // Get messages
            const messages = conv.messages?.data || [];
            const firstMessage = messages[messages.length - 1]; // Oldest
            const lastMessage = messages[0]; // Newest

            // Check if this might be from an ad (has link or certain patterns)
            const isFromAd = conv.link && (
                conv.link.includes('ad_id') ||
                conv.link.includes('ref=') ||
                conv.link.includes('referral')
            );

            return {
                conversationId: conv.id,
                facebookPsid: customer?.id,
                name: customer?.name || 'Unknown',
                email: customer?.email,
                link: conv.link,
                isFromAd,
                messageCount: messages.length,
                firstMessageAt: firstMessage?.created_time,
                lastMessageAt: lastMessage?.created_time,
                lastMessage: lastMessage?.message?.substring(0, 100),
                messages: messages.map(m => ({
                    id: m.id,
                    content: m.message,
                    from: m.from?.name || 'Unknown',
                    fromId: m.from?.id,
                    timestamp: m.created_time
                })),
                updatedAt: conv.updated_time
            };
        });

        // Sort by most recent first
        contacts.sort((a, b) =>
            new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
        );

        return NextResponse.json({
            success: true,
            contacts,
            count: contacts.length,
            hasMore: !!data.paging?.next,
            nextCursor: data.paging?.cursors?.after
        });

    } catch (error) {
        console.error('[Conversations] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conversations', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * POST /api/facebook/conversations
 * Import selected conversations as contacts into Supabase
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { contacts, pipelineId, stageId } = body;

        if (!contacts || !Array.isArray(contacts)) {
            return NextResponse.json(
                { error: 'contacts array is required' },
                { status: 400 }
            );
        }

        // Import to Supabase (dynamic import to avoid client-side issues)
        const { supabaseContactsStore, supabaseMessagesStore } = await import('@/lib/supabase-contacts');

        const importedContacts = [];

        for (const contact of contacts) {
            // Create contact in Supabase
            const newContact = await supabaseContactsStore.create({
                name: contact.name || 'Unknown',
                email: contact.email,
                phone: contact.phone,
                facebook_psid: contact.facebookPsid,
                source_ad_id: contact.isFromAd ? 'messenger_ad' : undefined,
                source_ad_name: contact.isFromAd ? 'Messenger Ad' : 'Organic',
                pipeline_id: pipelineId,
                stage_id: stageId || 'new-lead',
                last_message_at: contact.lastMessageAt,
            });

            if (newContact) {
                // Also save messages if available
                if (contact.messages && Array.isArray(contact.messages)) {
                    for (const msg of contact.messages) {
                        await supabaseMessagesStore.add({
                            contact_id: newContact.id!,
                            content: msg.content || msg.message || '',
                            direction: msg.fromId === contact.facebookPsid ? 'inbound' : 'outbound',
                            message_id: msg.id,
                            timestamp: msg.timestamp,
                        });
                    }
                }
                importedContacts.push(newContact);
            }
        }

        console.log(`[Conversations] Imported ${importedContacts.length} contacts to Supabase`);

        return NextResponse.json({
            success: true,
            contacts: importedContacts,
            count: importedContacts.length,
            message: `${importedContacts.length} contacts imported to Supabase!`
        });

    } catch (error) {
        console.error('[Conversations] Import error:', error);
        return NextResponse.json(
            { error: 'Failed to import contacts', details: String(error) },
            { status: 500 }
        );
    }
}
