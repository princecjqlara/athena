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
 * This now includes ALL auth users, even those without profiles yet
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    // Extract access token from cookies
    const accessToken = request.cookies.get('sb-access-token')?.value;

    if (!accessToken) {
        console.error('[Organizer] No access token in cookies');
        return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 });
    }

    // Validate token and get user using admin client
    const { data: { user: authUser }, error: authUserError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authUserError || !authUser) {
        console.error('[Organizer] Auth error:', authUserError);
        return NextResponse.json({ error: 'Unauthorized - invalid session' }, { status: 401 });
    }

    // Get user profile with admin client (bypasses RLS)
    const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

    if (profileError) {
        console.error('[Organizer] Profile fetch error:', profileError);
        return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    // Check if user is an organizer
    if (userProfile?.role !== 'organizer') {
        return NextResponse.json({ error: 'Unauthorized - not an organizer' }, { status: 403 });
    }


    try {
        // Get all auth users first - this is the source of truth for who exists
        const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

        if (authError) {
            console.error('[Organizer] Error fetching auth users:', authError);
            throw authError;
        }

        // Get all user profiles - use supabaseAdmin to bypass RLS
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('*');

        if (profileError) {
            console.error('[Organizer] Error fetching profiles:', profileError);
            // Don't throw - we can still return auth users with default profiles
        }

        // Create a map of profiles by ID
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Get organization names - use supabaseAdmin to bypass RLS
        const { data: orgs } = await supabaseAdmin
            .from('organizations')
            .select('id, name');
        const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

        // Get ads count per user - use supabaseAdmin to bypass RLS
        const { data: adsStats } = await supabaseAdmin
            .from('ads')
            .select('user_id');

        const adsCounts = new Map<string, number>();
        adsStats?.forEach(ad => {
            const count = adsCounts.get(ad.user_id) || 0;
            adsCounts.set(ad.user_id, count + 1);
        });

        // Track users without profiles so we can create them
        const usersWithoutProfiles: Array<{ id: string; email: string; full_name: string }> = [];

        // Combine auth users with their profiles (or create default profile data)
        const usersWithData = (authUsers || []).map(authUser => {
            const profile = profileMap.get(authUser.id);

            if (!profile) {
                // User exists in auth but not in profiles - track for profile creation
                usersWithoutProfiles.push({
                    id: authUser.id,
                    email: authUser.email || '',
                    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown'
                });
            }

            const baseProfile = profile || {
                id: authUser.id,
                role: 'marketer', // Default role
                status: 'pending', // Default status
                org_id: null,
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown',
                created_at: authUser.created_at,
                last_login_at: authUser.last_sign_in_at,
            };

            return {
                ...baseProfile,
                email: authUser.email || 'unknown@example.com',
                org_name: baseProfile.org_id ? orgMap.get(baseProfile.org_id) : null,
                data_size: {
                    ads: adsCounts.get(authUser.id) || 0,
                    contacts: 0,
                    predictions: 0,
                },
                _hasProfile: !!profile, // Flag to indicate if profile exists
            };
        });

        // Attempt to create profiles for users who don't have them (async, non-blocking)
        if (usersWithoutProfiles.length > 0) {
            console.log(`[Organizer] Creating ${usersWithoutProfiles.length} missing profiles...`);

            // Insert missing profiles in the background
            const profilesToInsert = usersWithoutProfiles.map(u => ({
                id: u.id,
                role: 'marketer',
                status: 'pending',
                full_name: u.full_name,
                created_at: new Date().toISOString(),
            }));

            supabaseAdmin
                .from('user_profiles')
                .upsert(profilesToInsert, { onConflict: 'id' })
                .then(({ error }) => {
                    if (error) {
                        console.error('[Organizer] Error creating missing profiles:', error);
                    } else {
                        console.log(`[Organizer] Created ${usersWithoutProfiles.length} missing profiles`);
                    }
                });
        }

        // Sort by created_at descending
        usersWithData.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

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
