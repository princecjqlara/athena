import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Use service role key for privileged operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/organizer/users
 * Get all users with data sizes (organizer only)
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile || !isOrganizer(user.profile)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        // Get all user profiles
        const { data: profiles, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get auth user emails
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const emailMap = new Map(authUsers?.map(u => [u.id, u.email]) || []);

        // Get organization names
        const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name');
        const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

        // Get ads count per user
        const { data: adsStats } = await supabase
            .from('ads')
            .select('user_id');

        const adsCounts = new Map<string, number>();
        adsStats?.forEach(ad => {
            const count = adsCounts.get(ad.user_id) || 0;
            adsCounts.set(ad.user_id, count + 1);
        });

        // Combine data
        const usersWithData = profiles?.map(p => ({
            ...p,
            email: emailMap.get(p.id) || 'unknown@example.com',
            org_name: p.org_id ? orgMap.get(p.org_id) : null,
            data_size: {
                ads: adsCounts.get(p.id) || 0,
                contacts: 0, // Could add contacts count
                predictions: 0, // Could add predictions count
            },
        })) || [];

        return NextResponse.json({ success: true, data: usersWithData });
    } catch (error) {
        console.error('[Organizer] Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

/**
 * DELETE /api/organizer/users
 * Delete a user (organizer only)
 * Organizers can delete admins, marketers, and clients (but not other organizers)
 */
export async function DELETE(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile || !isOrganizer(user.profile)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

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

        // Organizers cannot delete other organizers
        if (targetProfile.role === 'organizer') {
            return NextResponse.json({ error: 'Cannot delete another organizer' }, { status: 403 });
        }

        // Delete user profile first
        const { error: deleteProfileError } = await supabaseAdmin
            .from('user_profiles')
            .delete()
            .eq('id', userId);

        if (deleteProfileError) {
            console.error('[Organizer] Error deleting profile:', deleteProfileError);
            throw deleteProfileError;
        }

        // Delete from auth.users
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            console.error('[Organizer] Error deleting auth user:', deleteAuthError);
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
        console.error('[Organizer] Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
