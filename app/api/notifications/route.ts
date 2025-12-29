import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/notifications
 * Get announcements and unread messages for a user
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const userId = searchParams.get('userId');
        const userRole = searchParams.get('userRole') || 'marketer';

        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
        }

        // Get announcements for user's role
        const { data: announcements, error: announcementsError } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .or(`target_audience.eq.all,target_audience.eq.${userRole}`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (announcementsError) {
            console.error('[Notifications] Announcements error:', announcementsError);
        }

        // Get unread direct messages
        const { data: messages, error: messagesError } = await supabase
            .from('direct_messages')
            .select('*')
            .eq('to_user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(20);

        if (messagesError) {
            console.error('[Notifications] Messages error:', messagesError);
        }

        // Filter unread announcements (not in read_by array)
        const unreadAnnouncements = (announcements || []).filter(
            (a: { read_by: string[] }) => !a.read_by?.includes(userId)
        );

        // Count totals
        const unreadAnnouncementCount = unreadAnnouncements.length;
        const unreadMessageCount = messages?.length || 0;
        const totalUnread = unreadAnnouncementCount + unreadMessageCount;

        return NextResponse.json({
            success: true,
            notifications: {
                announcements: unreadAnnouncements,
                messages: messages || [],
                counts: {
                    announcements: unreadAnnouncementCount,
                    messages: unreadMessageCount,
                    total: totalUnread
                }
            }
        });
    } catch (error) {
        console.error('[Notifications] GET error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
    }
}

/**
 * POST /api/notifications
 * Mark notifications as read
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { userId, announcementIds, messageIds, markAllRead } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
        }

        const results: { announcements: number; messages: number } = { announcements: 0, messages: 0 };

        // Mark announcements as read
        if (announcementIds?.length > 0 || markAllRead) {
            let query = supabase.from('announcements').select('id, read_by');

            if (!markAllRead && announcementIds?.length > 0) {
                query = query.in('id', announcementIds);
            }

            const { data: announcementsToUpdate } = await query;

            for (const announcement of announcementsToUpdate || []) {
                const readBy = announcement.read_by || [];
                if (!readBy.includes(userId)) {
                    readBy.push(userId);
                    await supabase
                        .from('announcements')
                        .update({ read_by: readBy })
                        .eq('id', announcement.id);
                    results.announcements++;
                }
            }
        }

        // Mark messages as read
        if (messageIds?.length > 0) {
            const { count } = await supabase
                .from('direct_messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', messageIds)
                .eq('to_user_id', userId);
            results.messages = count || 0;
        }

        // Mark all messages as read
        if (markAllRead) {
            const { count } = await supabase
                .from('direct_messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('to_user_id', userId)
                .eq('is_read', false);
            results.messages = count || 0;
        }

        return NextResponse.json({
            success: true,
            marked: results
        });
    } catch (error) {
        console.error('[Notifications] POST error:', error);
        return NextResponse.json({ success: false, error: 'Failed to mark notifications as read' }, { status: 500 });
    }
}
