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

/**
 * DELETE /api/admin/users
 * Delete a user (admin can delete marketers and clients in their org)
 */
export async function DELETE(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile || (!isAdmin(user.profile) && !isOrganizer(user.profile))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Need service role for deleting auth users
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get the target user's profile
        const { data: targetProfile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !targetProfile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check permissions
        if (isAdmin(user.profile) && !isOrganizer(user.profile)) {
            // Regular admins can only delete users in their org
            if (targetProfile.org_id !== user.profile.org_id) {
                return NextResponse.json({ error: 'Cannot delete user from another organization' }, { status: 403 });
            }
            // Regular admins can only delete marketers and clients
            if (targetProfile.role === 'admin' || targetProfile.role === 'organizer') {
                return NextResponse.json({ error: 'Cannot delete admin or organizer users' }, { status: 403 });
            }
        }

        // Organizers can delete anyone except other organizers
        if (isOrganizer(user.profile) && targetProfile.role === 'organizer') {
            return NextResponse.json({ error: 'Cannot delete another organizer' }, { status: 403 });
        }

        // Delete user profile first
        const { error: deleteProfileError } = await supabaseAdmin
            .from('user_profiles')
            .delete()
            .eq('id', userId);

        if (deleteProfileError) {
            console.error('[Admin] Error deleting profile:', deleteProfileError);
            throw deleteProfileError;
        }

        // Delete from auth.users
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            console.error('[Admin] Error deleting auth user:', deleteAuthError);
            // Profile is already deleted, log this as a partial failure
        }

        // Log the action
        await supabaseAdmin.from('audit_logs').insert({
            actor_id: user.id,
            actor_role: user.profile.role,
            action: 'user_delete',
            resource_type: 'user',
            resource_id: userId,
            details: {
                deletedRole: targetProfile.role,
                deletedName: targetProfile.full_name
            },
        });

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('[Admin] Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
