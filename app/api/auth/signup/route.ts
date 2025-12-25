import { NextRequest, NextResponse } from 'next/server';
import { signUp } from '@/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/auth/signup
 * Create a new account with invite code validation
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            error: 'Authentication not configured'
        }, { status: 500 });
    }

    try {
        const { email, password, fullName, role, inviteCode } = await request.json();

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

        if (!inviteCode || !role) {
            return NextResponse.json({
                error: 'Invite code and role are required'
            }, { status: 400 });
        }

        // Validate the invite code again
        const { data: codeData, error: codeError } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('code', inviteCode.toUpperCase())
            .eq('code_type', role)
            .eq('is_used', false)
            .single();

        if (codeError || !codeData) {
            return NextResponse.json({
                error: 'Invalid or expired invite code'
            }, { status: 400 });
        }

        // Check expiration
        if (new Date() > new Date(codeData.expires_at)) {
            return NextResponse.json({
                error: 'Invite code has expired'
            }, { status: 400 });
        }

        // Create the user
        const result = await signUp(email, password, fullName);

        if (result.error) {
            return NextResponse.json({
                error: result.error
            }, { status: 400 });
        }

        // Mark invite code as used
        await supabase
            .from('invite_codes')
            .update({
                is_used: true,
                used_by: result.user?.id,
                used_at: new Date().toISOString(),
            })
            .eq('id', codeData.id);

        // Update user profile with role and org
        if (result.user) {
            await supabase
                .from('user_profiles')
                .update({
                    role: role,
                    org_id: codeData.org_id,
                    status: 'active', // Activate immediately since they had a valid code
                })
                .eq('id', result.user.id);
        }

        return NextResponse.json({
            success: true,
            message: 'Account created successfully!',
            user: {
                id: result.user?.id,
                email: result.user?.email,
                role: role,
            },
        });

    } catch (error) {
        console.error('[Auth] Signup error:', error);
        return NextResponse.json({
            error: 'Signup failed'
        }, { status: 500 });
    }
}
