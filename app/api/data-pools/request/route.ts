import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/data-pools/request - Submit access request for a data pool
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            userId,
            userEmail,
            poolId,
            reason,
            intendedUse
        } = body;

        if (!userId || !poolId) {
            return NextResponse.json(
                { error: 'userId and poolId are required' },
                { status: 400 }
            );
        }

        // Check if pool exists and requires approval
        const { data: pool, error: poolError } = await supabase
            .from('data_pools')
            .select('id, name, requires_approval')
            .eq('id', poolId)
            .single();

        if (poolError || !pool) {
            return NextResponse.json(
                { error: 'Data pool not found' },
                { status: 404 }
            );
        }

        // Check for existing request
        const { data: existingRequest } = await supabase
            .from('data_access_requests')
            .select('id, status')
            .eq('user_id', userId)
            .eq('pool_id', poolId)
            .single();

        if (existingRequest) {
            // Allow re-request if previously denied
            if (existingRequest.status === 'denied' || existingRequest.status === 'revoked') {
                // Update existing request to pending
                const { data: updatedRequest, error: updateError } = await supabase
                    .from('data_access_requests')
                    .update({
                        status: 'pending',
                        reason,
                        intended_use: intendedUse,
                        reviewed_by: null,
                        reviewed_at: null,
                        denial_reason: null,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', existingRequest.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Error updating request:', updateError);
                    return NextResponse.json(
                        { error: 'Failed to submit request' },
                        { status: 500 }
                    );
                }

                return NextResponse.json({
                    success: true,
                    message: 'Access request resubmitted',
                    data: updatedRequest
                });
            }

            return NextResponse.json(
                { error: `You already have a ${existingRequest.status} request for this pool` },
                { status: 409 }
            );
        }

        // If pool doesn't require approval, auto-approve
        const status = pool.requires_approval ? 'pending' : 'approved';
        const approvedAt = pool.requires_approval ? null : new Date().toISOString();

        // Create new request
        const { data: newRequest, error: insertError } = await supabase
            .from('data_access_requests')
            .insert({
                user_id: userId,
                user_email: userEmail,
                pool_id: poolId,
                reason,
                intended_use: intendedUse,
                status,
                approved_at: approvedAt
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating request:', insertError);
            return NextResponse.json(
                { error: 'Failed to submit request' },
                { status: 500 }
            );
        }

        const message = pool.requires_approval
            ? 'Access request submitted. Awaiting admin approval.'
            : 'Access granted automatically.';

        return NextResponse.json({
            success: true,
            message,
            data: newRequest
        });

    } catch (error) {
        console.error('Request access error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/data-pools/request - Get user's access requests
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        const { data: requests, error } = await supabase
            .from('data_access_requests')
            .select(`
        *,
        data_pools (
          id,
          name,
          slug,
          description,
          industry,
          platform,
          data_points
        )
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching requests:', error);
            return NextResponse.json(
                { error: 'Failed to fetch requests' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: requests
        });

    } catch (error) {
        console.error('Get requests error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
