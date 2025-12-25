import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/auth/validate-code
 * Validate an invite code before signup
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    try {
        const { code, role } = await request.json();

        if (!code || !role) {
            return NextResponse.json({ error: 'Code and role required' }, { status: 400 });
        }

        // Find the code
        const { data: inviteCode, error } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('code_type', role)
            .single();

        if (error || !inviteCode) {
            return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
        }

        // Check if already used
        if (inviteCode.is_used) {
            return NextResponse.json({ error: 'This code has already been used' }, { status: 400 });
        }

        // Check if expired
        const now = new Date();
        const expiresAt = new Date(inviteCode.expires_at);
        if (now > expiresAt) {
            return NextResponse.json({ error: 'This code has expired' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            valid: true,
            codeId: inviteCode.id,
            orgId: inviteCode.org_id,
        });

    } catch (error) {
        console.error('[Auth] Code validation error:', error);
        return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
    }
}
