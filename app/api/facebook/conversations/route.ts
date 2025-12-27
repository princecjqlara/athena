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
    error?: {
        message: string;
        code: number;
    };
}

interface FacebookUserProfile {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    profile_pic?: string;
    error?: {
        message: string;
        code: number;
    };
}

/**
 * Fetch user profile from Facebook Graph API to get real name
 */
async function fetchUserProfile(psid: string, accessToken: string): Promise<FacebookUserProfile | null> {
    try {
        const url = `https://graph.facebook.com/v24.0/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${accessToken}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.log(`[Conversations] Failed to fetch profile for ${psid}: ${response.status}`);
            return null;
        }

        const profile = await response.json();

        if (profile.error) {
            console.log(`[Conversations] Profile error for ${psid}:`, profile.error.message);
            return null;
        }

        console.log(`[Conversations] Fetched profile: ${profile.name || profile.first_name || 'Unknown'}`);
        return profile;
    } catch (error) {
        console.error(`[Conversations] Error fetching profile for ${psid}:`, error);
        return null;
    }
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
    const userAccessToken = searchParams.get('access_token'); // User token from Facebook Login
    const limit = parseInt(searchParams.get('limit') || '50');
    const filterAdId = searchParams.get('ad_id'); // Optional: filter to only show conversations from this ad
    const getPages = searchParams.get('get_pages') === 'true'; // Get list of pages user manages

    // If user wants list of pages they manage
    if (getPages && userAccessToken) {
        try {
            console.log('[Conversations] Fetching ALL user pages with pagination...');

            // Fetch all pages using pagination (Facebook limits to 25 per request)
            let allPages: Array<{ id: string; name: string; access_token: string; category: string }> = [];
            let nextUrl: string | null = `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${userAccessToken}`;

            while (nextUrl) {
                const pagesResponse = await fetch(nextUrl);
                const pagesData = await pagesResponse.json();

                if (pagesData.error) {
                    console.error('[Conversations] Error fetching pages:', pagesData.error);
                    return NextResponse.json(
                        { error: pagesData.error.message, success: false },
                        { status: 400 }
                    );
                }

                if (pagesData.data && pagesData.data.length > 0) {
                    allPages = [...allPages, ...pagesData.data];
                }

                // Check if there are more pages
                nextUrl = pagesData.paging?.next || null;
            }

            console.log(`[Conversations] Found ${allPages.length} total pages`);
            return NextResponse.json({
                success: true,
                pages: allPages,
                count: allPages.length
            });
        } catch (e) {
            console.error('[Conversations] Failed to get pages:', e);
            return NextResponse.json(
                { error: 'Failed to fetch pages', success: false },
                { status: 500 }
            );
        }
    }

    // Need either page token or user token with page_id
    let accessToken = pageAccessToken;

    if (!accessToken && userAccessToken && pageId) {
        // Try to get page token from user token
        try {
            console.log('[Conversations] Getting page token for:', pageId);
            const pageUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=access_token&access_token=${userAccessToken}`;
            const pageResponse = await fetch(pageUrl);
            const pageData = await pageResponse.json();
            if (pageData.access_token) {
                accessToken = pageData.access_token;
                console.log('[Conversations] Got page token successfully');
            } else if (pageData.error) {
                console.error('[Conversations] Error getting page token:', pageData.error);
            }
        } catch (e) {
            console.error('[Conversations] Failed to get page token:', e);
        }
    }

    if (!accessToken) {
        return NextResponse.json(
            { error: 'page_access_token or (access_token + page_id) is required', success: false },
            { status: 400 }
        );
    }

    try {
        console.log('[Conversations] Fetching conversations for pageId:', pageId);
        console.log('[Conversations] Token type:', pageAccessToken ? 'page_access_token' : userAccessToken ? 'user_token_exchanged' : 'unknown');

        // CRITICAL: Use /{page_id}/conversations NOT /me/conversations for Page Messenger
        // /me/conversations only works with user tokens, not page tokens
        const conversationsUrl = `https://graph.facebook.com/v24.0/${pageId}/conversations?fields=id,link,updated_time,participants,messages.limit(10){id,message,from,created_time}&limit=${limit}&access_token=${accessToken}`;

        console.log('[Conversations] Request URL:', `graph.facebook.com/v24.0/${pageId}/conversations?fields=...&limit=${limit}`);

        const response = await fetch(conversationsUrl);
        const data: ConversationsResponse = await response.json();

        if (!response.ok || data.error) {
            console.error('[Conversations] ❌ API Error:', data.error || data);
            return NextResponse.json(
                { error: 'Failed to fetch conversations', details: data.error?.message || data, success: false },
                { status: response.status }
            );
        }

        console.log(`[Conversations] ✅ Response received. Data array length: ${data.data?.length || 0}`);

        // Debug: Log raw response structure if empty
        if (!data.data || data.data.length === 0) {
            console.log('[Conversations] ⚠️ No conversations returned from Facebook. Full response:', JSON.stringify(data).substring(0, 500));
        } else {
            console.log(`[Conversations] First conversation structure:`, {
                id: data.data[0].id,
                hasParticipants: !!data.data[0].participants,
                participantCount: data.data[0].participants?.data?.length || 0,
                hasMessages: !!data.data[0].messages,
                messageCount: data.data[0].messages?.data?.length || 0
            });
        }

        // Process conversations into contact format - fetch real names for each
        const contactPromises = data.data.map(async (conv, index) => {
            // Get the customer (non-page participant)
            const participants = conv.participants?.data || [];
            const customer = participants.find(p => p.id !== pageId) || participants[0];
            console.log(`[Conversations] Conv ${index + 1}: PSID=${customer?.id}, participants=${participants.length}`);

            // Fetch real name from Facebook profile API
            let customerName = 'Unknown';
            if (customer?.id && accessToken) {
                const profile = await fetchUserProfile(customer.id, accessToken);
                if (profile) {
                    customerName = profile.name ||
                        (profile.first_name && profile.last_name
                            ? `${profile.first_name} ${profile.last_name}`
                            : profile.first_name || 'Unknown');
                }
            }

            // Get messages
            const messages = conv.messages?.data || [];
            const firstMessage = messages[messages.length - 1]; // Oldest
            const lastMessage = messages[0]; // Newest

            // Extract ad_id from link if present
            let adIdFromLink: string | null = null;
            if (conv.link) {
                const adIdMatch = conv.link.match(/ad_id[=:](\d+)/);
                if (adIdMatch) {
                    adIdFromLink = adIdMatch[1];
                }
            }

            // Check if this is from an ad
            const isFromAd = !!(adIdFromLink || (conv.link && (
                conv.link.includes('ref=') ||
                conv.link.includes('referral')
            )));

            return {
                conversationId: conv.id,
                facebookPsid: customer?.id,
                name: customerName,
                email: customer?.email,
                link: conv.link,
                adId: adIdFromLink,
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

        let contacts = await Promise.all(contactPromises);

        // Log the fetched names for debugging
        console.log(`[Conversations] Contacts fetched with names:`, contacts.map(c => ({ psid: c.facebookPsid, name: c.name })));

        // Filter by ad_id if specified
        if (filterAdId) {
            contacts = contacts.filter(c => c.adId === filterAdId);
            console.log(`[Conversations] Filtered to ${contacts.length} conversations from ad ${filterAdId}`);
        }

        // Sort by most recent first
        contacts.sort((a, b) =>
            new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
        );

        return NextResponse.json({
            success: true,
            contacts,
            count: contacts.length,
            hasMore: !!data.paging?.next,
            nextCursor: data.paging?.cursors?.after,
            // Debug info
            debug: {
                pageIdUsed: pageId,
                rawConversationsCount: data.data?.length || 0,
                tokenType: pageAccessToken ? 'page_access_token' : userAccessToken ? 'user_token_exchanged' : 'unknown',
                rawResponse: data.data?.length === 0 ? data : undefined // Only include if empty to debug
            }
        });

    } catch (error) {
        console.error('[Conversations] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conversations', details: String(error), success: false },
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
