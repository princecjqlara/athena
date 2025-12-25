import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/auth/login
 * Sign in with email and password
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            error: 'Authentication not configured'
        }, { status: 500 });
    }

    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({
                error: 'Email and password are required'
            }, { status: 400 });
        }

        const result = await signIn(email, password);

        if (result.error) {
            return NextResponse.json({
                error: result.error
            }, { status: 401 });
        }

        // Get user profile
        const { supabase } = await import('@/lib/supabase');
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', result.user?.id)
            .single();

        return NextResponse.json({
            success: true,
            user: {
                id: result.user?.id,
                email: result.user?.email,
                profile,
            },
        });

    } catch (error) {
        console.error('[Auth] Login error:', error);
        return NextResponse.json({
            error: 'Login failed'
        }, { status: 500 });
    }
}
