import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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
