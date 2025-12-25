import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin, isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/admin/requests
 * Get access requests for the organization
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile || (!isAdmin(user.profile) && !isOrganizer(user.profile))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        let query = supabase.from('access_requests').select('*');

        // Admins can only see their org requests
        if (isAdmin(user.profile) && !isOrganizer(user.profile)) {
            query = query.eq('org_id', user.profile.org_id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Admin] Error fetching requests:', error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/requests
 * Approve or deny an access request
 */
export async function PATCH(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile || (!isAdmin(user.profile) && !isOrganizer(user.profile))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { requestId, action, denialReason } = await request.json();

        if (!requestId || !action) {
            return NextResponse.json({ error: 'requestId and action required' }, { status: 400 });
        }

        // Get the request
        const { data: accessRequest, error: fetchError } = await supabase
            .from('access_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !accessRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Update request status
        const { error: updateError } = await supabase
            .from('access_requests')
            .update({
                status: action === 'approve' ? 'approved' : 'denied',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                denial_reason: denialReason,
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // If approved, update the user's profile
        if (action === 'approve') {
            await supabase
                .from('user_profiles')
                .update({
                    org_id: accessRequest.org_id,
                    role: accessRequest.requested_role,
                    status: 'active',
                })
                .eq('id', accessRequest.user_id);
        }

        // Log the action
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            actor_role: user.profile.role,
            action: `access_${action}`,
            resource_type: 'access_request',
            resource_id: requestId,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Admin] Error processing request:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
