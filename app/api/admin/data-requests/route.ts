import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/admin/data-requests - List all access requests (for admin)
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status') || 'pending';
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
            .from('data_access_requests')
            .select(`
        *,
        data_pools (
          id,
          name,
          slug,
          industry,
          platform,
          access_tier
        )
      `)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Filter by status if not 'all'
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: requests, error } = await query;

        if (error) {
            console.error('Error fetching requests:', error);
            return NextResponse.json(
                { error: 'Failed to fetch requests' },
                { status: 500 }
            );
        }

        // Get counts by status for dashboard
        const { data: countData } = await supabase
            .from('data_access_requests')
            .select('status');

        const counts = {
            pending: 0,
            approved: 0,
            denied: 0,
            revoked: 0,
            total: countData?.length || 0
        };

        countData?.forEach(r => {
            if (r.status in counts) {
                counts[r.status as keyof typeof counts]++;
            }
        });

        return NextResponse.json({
            success: true,
            data: requests,
            counts
        });

    } catch (error) {
        console.error('Admin get requests error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/admin/data-requests - Approve/Deny access request
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            requestId,
            action,        // 'approve' | 'deny' | 'revoke'
            adminId,
            denialReason,
            adminNotes,
            expiresInDays  // Optional: set expiration
        } = body;

        if (!requestId || !action || !adminId) {
            return NextResponse.json(
                { error: 'requestId, action, and adminId are required' },
                { status: 400 }
            );
        }

        if (!['approve', 'deny', 'revoke'].includes(action)) {
            return NextResponse.json(
                { error: 'action must be approve, deny, or revoke' },
                { status: 400 }
            );
        }

        // Get the request
        const { data: existingRequest, error: fetchError } = await supabase
            .from('data_access_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !existingRequest) {
            return NextResponse.json(
                { error: 'Request not found' },
                { status: 404 }
            );
        }

        // Build update object
        const now = new Date();
        const updateData: Record<string, unknown> = {
            status: action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'revoked',
            reviewed_by: adminId,
            reviewed_at: now.toISOString(),
            admin_notes: adminNotes || null
        };

        if (action === 'approve') {
            updateData.approved_at = now.toISOString();

            // Set expiration if specified
            if (expiresInDays) {
                const expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + expiresInDays);
                updateData.expires_at = expiresAt.toISOString();
            }
        }

        if (action === 'deny' || action === 'revoke') {
            updateData.denial_reason = denialReason || null;
            updateData.approved_at = null;
        }

        // Update the request
        const { data: updatedRequest, error: updateError } = await supabase
            .from('data_access_requests')
            .update(updateData)
            .eq('id', requestId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating request:', updateError);
            return NextResponse.json(
                { error: 'Failed to update request' },
                { status: 500 }
            );
        }

        // Log the action for audit trail
        await supabase.from('audit_logs').insert({
            actor_id: adminId,
            actor_role: 'admin',
            action: `data_access_${action}`,
            resource_type: 'data_access_request',
            resource_id: requestId,
            details: {
                pool_id: existingRequest.pool_id,
                user_id: existingRequest.user_id,
                previous_status: existingRequest.status,
                new_status: updateData.status,
                denial_reason: denialReason
            }
        });

        const actionLabels = {
            approve: 'approved',
            deny: 'denied',
            revoke: 'revoked'
        };

        return NextResponse.json({
            success: true,
            message: `Access request ${actionLabels[action as keyof typeof actionLabels]}`,
            data: updatedRequest
        });

    } catch (error) {
        console.error('Admin action error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
