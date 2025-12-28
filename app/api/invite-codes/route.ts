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

    const user = await getCurrentUser();
    if (!user?.profile) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get codes created by this user that are not expired or used
        const { data, error } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('created_by', user.id)
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
 * Body: { roleType?: 'admin' | 'marketer' | 'client' } - for organizers only
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user?.profile) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = user.profile.role;
    let body: { roleType?: string } = {};

    try {
        body = await request.json();
    } catch {
        // No body is fine
    }

    // Determine what type of code this user can generate
    let codeType: string | null = null;

    if (role === 'organizer') {
        // Organizers can generate codes for any role
        const requestedType = body.roleType;
        if (requestedType && ['admin', 'marketer', 'client'].includes(requestedType)) {
            codeType = requestedType;
        } else {
            codeType = 'admin'; // Default for organizers
        }
    } else if (role === 'admin') {
        codeType = 'marketer';
    } else if (role === 'marketer') {
        codeType = 'client';
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
                created_by: user.id,
                org_id: user.profile.org_id,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            code: data.code,
            expiresAt: data.expires_at,
            codeType: data.code_type,
        });
    } catch (error) {
        console.error('[Invite] Error generating code:', error);
        return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }
}

