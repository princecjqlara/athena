import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/organizer/organizations
 * Get all organizations (organizer only)
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
        const { data: orgs, error } = await supabase
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get user counts for each org
        const orgsWithCounts = await Promise.all(
            (orgs || []).map(async (org) => {
                const { count } = await supabase
                    .from('user_profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', org.id);

                return { ...org, user_count: count || 0 };
            })
        );

        return NextResponse.json({ success: true, data: orgsWithCounts });
    } catch (error) {
        console.error('[Organizer] Error fetching organizations:', error);
        return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }
}
