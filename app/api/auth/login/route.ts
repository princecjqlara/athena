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

        // Create response with cookies
        const response = NextResponse.json({
            success: true,
            user: {
                id: result.user?.id,
                email: result.user?.email,
                profile,
            },
        });

        // Set session cookies for middleware to read
        if (result.session) {
            response.cookies.set('sb-access-token', result.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: result.session.expires_in || 3600,
                path: '/',
            });

            if (result.session.refresh_token) {
                response.cookies.set('sb-refresh-token', result.session.refresh_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 7, // 7 days
                    path: '/',
                });
            }
        }

        return response;

    } catch (error) {
        console.error('[Auth] Login error:', error);
        return NextResponse.json({
            error: 'Login failed'
        }, { status: 500 });
    }
}
