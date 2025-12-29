import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/invite-codes
 * Get active invite codes for current user
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    // Try Supabase auth first, then fall back to header-based auth
    let userId: string | null = null;
    let userRole: string = 'marketer';

    const authUser = await getCurrentUser();
    if (authUser?.profile) {
        userId = authUser.id;
        userRole = authUser.profile.role;
    } else {
        // Fall back to header-based user ID (from localStorage)
        userId = request.headers.get('x-user-id');
        userRole = request.headers.get('x-user-role') || 'organizer';
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get codes created by this user that are not expired or used
        const { data, error } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('created_by', userId)
            .eq('is_used', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Invite] Error fetching codes:', error);
        return NextResponse.json({ error: 'Failed to fetch codes' }, { status: 500 });
    }
}

/**
 * POST /api/invite-codes
 * Generate a new invite code
 * Body: { roleType?: 'admin' | 'marketer' | 'client', userId?: string, userRole?: string }
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    let body: { roleType?: string; userId?: string; userRole?: string } = {};

    try {
        body = await request.json();
    } catch {
        // No body is fine
    }

    // Try Supabase auth first, then fall back to body/header-based auth
    let userId: string | null = null;
    let userRole: string = 'marketer';
    let orgId: string | null = null;

    const authUser = await getCurrentUser();
    if (authUser?.profile) {
        userId = authUser.id;
        userRole = authUser.profile.role;
        orgId = authUser.profile.org_id;
    } else {
        // Fall back to body or header-based user ID
        userId = body.userId || request.headers.get('x-user-id');
        userRole = body.userRole || request.headers.get('x-user-role') || 'organizer';
    }

    // For organizer page, default to organizer role if accessing from that context
    // Check URL referer to see if coming from organizer page
    const referer = request.headers.get('referer') || '';
    if (referer.includes('/organizer')) {
        userRole = 'organizer';
    }

    if (!userId) {
        // Generate a temporary user ID for organizer access
        userId = `organizer-${Date.now()}`;
    }

    // Determine what type of code this user can generate
    let codeType: string | null = null;

    if (userRole === 'organizer') {
        // Organizers can generate codes for any role
        const requestedType = body.roleType;
        if (requestedType && ['admin', 'marketer', 'client'].includes(requestedType)) {
            codeType = requestedType;
        } else {
            codeType = 'admin'; // Default for organizers
        }
    } else if (userRole === 'admin') {
        codeType = 'marketer';
    } else if (userRole === 'marketer') {
        codeType = 'client';
    } else {
        // Default: allow any logged-in user to generate codes (for easier access)
        codeType = body.roleType || 'client';
    }

    if (!codeType) {
        return NextResponse.json({ error: 'You cannot generate invite codes' }, { status: 403 });
    }

    try {
        // Generate a unique code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Create the invite code
        const { data, error } = await supabase
            .from('invite_codes')
            .insert({
                code,
                code_type: codeType,
                created_by: userId,
                org_id: orgId,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            })
            .select()
            .single();

        if (error) {
            console.error('[Invite] Supabase error:', error);
            throw error;
        }

        return NextResponse.json({
            success: true,
            code: data.code,
            expiresAt: data.expires_at,
            codeType: data.code_type,
        });
    } catch (error: any) {
        console.error('[Invite] Error generating code:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate code',
            details: error?.details || null
        }, { status: 500 });
    }
}
