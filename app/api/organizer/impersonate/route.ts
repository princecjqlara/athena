import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/organizer/impersonate
 * Start impersonating a user (organizer only)
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile || !isOrganizer(user.profile)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { targetUserId } = await request.json();

        if (!targetUserId) {
            return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });
        }

        // Get target user info
        const { data: targetUser, error: fetchError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', targetUserId)
            .single();

        if (fetchError || !targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Log the impersonation start
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            actor_role: user.profile.role,
            impersonating_user_id: targetUserId,
            action: 'impersonate_start',
            resource_type: 'user',
            resource_id: targetUserId,
            details: {
                target_name: targetUser.full_name,
                target_role: targetUser.role,
                target_org_id: targetUser.org_id,
            },
        });

        return NextResponse.json({
            success: true,
            targetUser: {
                id: targetUser.id,
                name: targetUser.full_name,
                role: targetUser.role,
            },
        });
    } catch (error) {
        console.error('[Organizer] Error starting impersonation:', error);
        return NextResponse.json({ error: 'Failed to start impersonation' }, { status: 500 });
    }
}

/**
 * DELETE /api/organizer/impersonate
 * End impersonation session
 */
export async function DELETE(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        // Log the impersonation end
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            actor_role: user.profile.role,
            action: 'impersonate_end',
            resource_type: 'session',
            resource_id: user.id,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Organizer] Error ending impersonation:', error);
        return NextResponse.json({ error: 'Failed to end impersonation' }, { status: 500 });
    }
}
