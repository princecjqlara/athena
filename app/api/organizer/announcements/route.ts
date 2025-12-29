import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/organizer/announcements
 * List all announcements with optional filters
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const audience = searchParams.get('audience');
        const activeOnly = searchParams.get('activeOnly') !== 'false';
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (audience && audience !== 'all') {
            query = query.or(`target_audience.eq.all,target_audience.eq.${audience}`);
        }

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Announcements] GET error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            announcements: data || []
        });
    } catch (error) {
        console.error('[Announcements] GET error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch announcements' }, { status: 500 });
    }
}

/**
 * POST /api/organizer/announcements
 * Create a new announcement
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { title, content, targetAudience, priority, expiresAt, createdBy } = body;

        if (!title || !content) {
            return NextResponse.json({
                success: false,
                error: 'Title and content are required'
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('announcements')
            .insert({
                title,
                content,
                target_audience: targetAudience || 'all',
                priority: priority || 'normal',
                expires_at: expiresAt || null,
                created_by: createdBy,
                is_active: true,
                read_by: []
            })
            .select()
            .single();

        if (error) {
            console.error('[Announcements] POST error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            announcement: data
        });
    } catch (error) {
        console.error('[Announcements] POST error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create announcement' }, { status: 500 });
    }
}

/**
 * PATCH /api/organizer/announcements
 * Update an announcement (mark read, deactivate, etc.)
 */
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { id, isActive, markReadBy, title, content, priority } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Announcement ID required' }, { status: 400 });
        }

        // Handle marking as read
        if (markReadBy) {
            // Get current read_by array
            const { data: current } = await supabase
                .from('announcements')
                .select('read_by')
                .eq('id', id)
                .single();

            const readBy = current?.read_by || [];
            if (!readBy.includes(markReadBy)) {
                readBy.push(markReadBy);
            }

            const { data, error } = await supabase
                .from('announcements')
                .update({ read_by: readBy })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, announcement: data });
        }

        // Handle other updates
        const updateData: Record<string, unknown> = {};
        if (typeof isActive === 'boolean') updateData.is_active = isActive;
        if (title) updateData.title = title;
        if (content) updateData.content = content;
        if (priority) updateData.priority = priority;

        const { data, error } = await supabase
            .from('announcements')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[Announcements] PATCH error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, announcement: data });
    } catch (error) {
        console.error('[Announcements] PATCH error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update announcement' }, { status: 500 });
    }
}

/**
 * DELETE /api/organizer/announcements
 * Delete an announcement
 */
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Announcement ID required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[Announcements] DELETE error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        console.error('[Announcements] DELETE error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete announcement' }, { status: 500 });
    }
}
