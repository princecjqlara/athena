import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * GET /api/organizer/marketplace/requests
 * Get all data access requests for organizer management
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const poolId = searchParams.get('poolId');

        let query = supabase
            .from('data_access_requests')
            .select(`
                *,
                data_pools (name, slug, industry)
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }
        if (poolId) {
            query = query.eq('pool_id', poolId);
        }

        const { data: requests, error } = await query;

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: requests || [],
        });
    } catch (error) {
        console.error('[Organizer] Error fetching access requests:', error);
        return NextResponse.json({ error: 'Failed to fetch access requests' }, { status: 500 });
    }
}

/**
 * PATCH /api/organizer/marketplace/requests
 * Approve or deny a data access request
 */
export async function PATCH(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { requestId, action, denialReason, adminNotes } = body;

        if (!requestId || !action) {
            return NextResponse.json({ error: 'Request ID and action are required' }, { status: 400 });
        }

        if (!['approve', 'deny', 'revoke'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const updates: Record<string, any> = {
            reviewed_at: new Date().toISOString(),
        };

        if (action === 'approve') {
            updates.status = 'approved';
            updates.approved_at = new Date().toISOString();
        } else if (action === 'deny') {
            updates.status = 'denied';
            updates.denial_reason = denialReason || null;
        } else if (action === 'revoke') {
            updates.status = 'revoked';
        }

        if (adminNotes) {
            updates.admin_notes = adminNotes;
        }

        const { data: updated, error } = await supabase
            .from('data_access_requests')
            .update(updates)
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: updated,
            message: `Request ${action}d successfully`,
        });
    } catch (error) {
        console.error('[Organizer] Error updating access request:', error);
        return NextResponse.json({ error: 'Failed to update access request' }, { status: 500 });
    }
}
