import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isOrganizer } from '@/lib/rbac';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/organizer/teams
 * Get team performance stats (organizer only)
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
        // Get all admins (team leads)
        const { data: admins } = await supabase
            .from('user_profiles')
            .select('id, full_name, org_id')
            .eq('role', 'admin');

        if (!admins || admins.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Build team stats for each admin
        const teamStats = await Promise.all(admins.map(async (admin) => {
            // Get org members
            const { data: members } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('org_id', admin.org_id);

            const marketers = members?.filter(m => m.role === 'marketer').length || 0;
            const clients = members?.filter(m => m.role === 'client').length || 0;

            // Get total ads for org
            const memberIds = members?.map(m => m.role) || [];
            const { count: adsCount } = await supabase
                .from('ads')
                .select('*', { count: 'exact', head: true });

            return {
                admin_id: admin.id,
                admin_name: admin.full_name || 'Unknown Admin',
                marketers,
                clients,
                total_ads: adsCount || 0,
                total_conversions: 0, // Could add from CAPI events
            };
        }));

        return NextResponse.json({ success: true, data: teamStats });
    } catch (error) {
        console.error('[Organizer] Error fetching teams:', error);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}
