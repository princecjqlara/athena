import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, signOut } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/auth/session
 * Get current session and user profile
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            user: null,
            error: 'Authentication not configured'
        });
    }

    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ user: null });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                profile: user.profile,
            },
        });

    } catch (error) {
        console.error('[Auth] Session error:', error);
        return NextResponse.json({ user: null });
    }
}

/**
 * DELETE /api/auth/session
 * Sign out current user
 */
export async function DELETE(request: NextRequest) {
    try {
        await signOut();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Auth] Signout error:', error);
        return NextResponse.json({ error: 'Signout failed' }, { status: 500 });
    }
}
