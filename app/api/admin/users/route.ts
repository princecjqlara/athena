import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin, isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/admin/users
 * Get all users in the organization
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
        let query = supabase.from('user_profiles').select('*');

        // Admins can only see their org, organizers see all
        if (isAdmin(user.profile) && !isOrganizer(user.profile)) {
            query = query.eq('org_id', user.profile.org_id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Admin] Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/users
 * Update user status
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
        const { userId, status, role } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        const updates: any = { updated_at: new Date().toISOString() };
        if (status) updates.status = status;
        if (role && isOrganizer(user.profile)) updates.role = role;

        const { data, error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // Log the action
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            actor_role: user.profile.role,
            action: status ? 'user_status_change' : 'user_role_change',
            resource_type: 'user',
            resource_id: userId,
            details: { newStatus: status, newRole: role },
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Admin] Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
