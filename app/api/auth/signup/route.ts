import { NextRequest, NextResponse } from 'next/server';
import { signUp } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/auth/signup
 * Create a new account
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            error: 'Authentication not configured'
        }, { status: 500 });
    }

    try {
        const { email, password, fullName } = await request.json();

        if (!email || !password) {
            return NextResponse.json({
                error: 'Email and password are required'
            }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({
                error: 'Password must be at least 6 characters'
            }, { status: 400 });
        }

        const result = await signUp(email, password, fullName);

        if (result.error) {
            return NextResponse.json({
                error: result.error
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account created. Please check your email to verify.',
            user: {
                id: result.user?.id,
                email: result.user?.email,
            },
        });

    } catch (error) {
        console.error('[Auth] Signup error:', error);
        return NextResponse.json({
            error: 'Signup failed'
        }, { status: 500 });
    }
}
