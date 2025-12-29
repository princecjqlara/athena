import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/organizer/messages
 * List messages - inbox or sent
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const userId = searchParams.get('userId');
        const type = searchParams.get('type') || 'inbox'; // 'inbox' or 'sent'
        const unreadOnly = searchParams.get('unreadOnly') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
            .from('direct_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (userId) {
            if (type === 'inbox') {
                query = query.eq('to_user_id', userId);
            } else if (type === 'sent') {
                query = query.eq('from_user_id', userId);
            }
        }

        if (unreadOnly) {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Messages] GET error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Get unread count if userId is provided
        let unreadCount = 0;
        if (userId) {
            const { count } = await supabase
                .from('direct_messages')
                .select('*', { count: 'exact', head: true })
                .eq('to_user_id', userId)
                .eq('is_read', false);
            unreadCount = count || 0;
        }

        return NextResponse.json({
            success: true,
            messages: data || [],
            unreadCount
        });
    } catch (error) {
        console.error('[Messages] GET error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
    }
}

/**
 * POST /api/organizer/messages
 * Send a direct message
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { fromUserId, toUserId, subject, content, parentMessageId } = body;

        if (!fromUserId || !toUserId || !content) {
            return NextResponse.json({
                success: false,
                error: 'fromUserId, toUserId, and content are required'
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                subject: subject || null,
                content,
                parent_message_id: parentMessageId || null,
                is_read: false
            })
            .select()
            .single();

        if (error) {
            console.error('[Messages] POST error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: data
        });
    } catch (error) {
        console.error('[Messages] POST error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
    }
}

/**
 * PATCH /api/organizer/messages
 * Mark message as read
 */
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { id, isRead, markAllRead, userId } = body;

        // Mark all messages as read for a user
        if (markAllRead && userId) {
            const { error } = await supabase
                .from('direct_messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('to_user_id', userId)
                .eq('is_read', false);

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'All messages marked as read' });
        }

        // Mark single message as read
        if (!id) {
            return NextResponse.json({ success: false, error: 'Message ID required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (typeof isRead === 'boolean') {
            updateData.is_read = isRead;
            if (isRead) {
                updateData.read_at = new Date().toISOString();
            }
        }

        const { data, error } = await supabase
            .from('direct_messages')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[Messages] PATCH error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: data });
    } catch (error) {
        console.error('[Messages] PATCH error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update message' }, { status: 500 });
    }
}

/**
 * DELETE /api/organizer/messages
 * Delete a message
 */
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Message ID required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('direct_messages')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[Messages] DELETE error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        console.error('[Messages] DELETE error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete message' }, { status: 500 });
    }
}
