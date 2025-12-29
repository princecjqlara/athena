import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for privileged operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Admin client bypasses RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/auth/signup
 * Create a new account with invite code validation
 */
export async function POST(request: NextRequest) {
    // Check configuration
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[Auth] Supabase not configured:', {
            hasUrl: !!supabaseUrl,
            hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            hasAnonKey: !!supabaseAnonKey
        });
        return NextResponse.json({
            error: 'Authentication not configured'
        }, { status: 500 });
    }

    try {
        const { email, password, fullName, role, inviteCode } = await request.json();

        console.log('[Auth] Signup attempt:', { email, role, inviteCode: inviteCode?.substring(0, 4) + '***' });

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

        // Validate the invite code using admin client
        console.log('[Auth] Validating invite code...');
        const { data: codeData, error: codeError } = await supabaseAdmin
            .from('invite_codes')
            .select('*')
            .eq('code', inviteCode.toUpperCase())
            .eq('code_type', role)
            .eq('is_used', false)
            .single();

        if (codeError) {
            console.error('[Auth] Invite code validation error:', codeError);
            return NextResponse.json({
                error: 'Invalid or expired invite code',
                details: codeError.message
            }, { status: 400 });
        }

        if (!codeData) {
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

        // Create the user using admin client
        console.log('[Auth] Creating user...');
        const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (signUpError) {
            console.error('[Auth] SignUp error:', signUpError);
            return NextResponse.json({
                error: signUpError.message
            }, { status: 400 });
        }

        if (!signUpData.user) {
            return NextResponse.json({
                error: 'Failed to create user'
            }, { status: 400 });
        }

        console.log('[Auth] User created:', signUpData.user.id);

        // Mark invite code as used
        console.log('[Auth] Marking invite code as used...');
        const { error: updateCodeError } = await supabaseAdmin
            .from('invite_codes')
            .update({
                is_used: true,
                used_by: signUpData.user.id,
                used_at: new Date().toISOString(),
            })
            .eq('id', codeData.id);

        if (updateCodeError) {
            console.error('[Auth] Failed to update invite code:', updateCodeError);
            // Continue anyway - user was created
        }

        // Update user profile with role and org
        // First, check if profile exists (created by trigger)
        console.log('[Auth] Checking for user profile...');
        const { data: existingProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('id')
            .eq('id', signUpData.user.id)
            .single();

        if (existingProfile) {
            // Profile exists, update it
            console.log('[Auth] Updating existing profile...');
            const { error: updateProfileError } = await supabaseAdmin
                .from('user_profiles')
                .update({
                    role: role,
                    org_id: codeData.org_id,
                    status: 'active',
                    full_name: fullName,
                })
                .eq('id', signUpData.user.id);

            if (updateProfileError) {
                console.error('[Auth] Failed to update profile:', updateProfileError);
            }
        } else {
            // Profile doesn't exist (trigger didn't fire), create it
            console.log('[Auth] Creating new profile...');
            const { error: insertProfileError } = await supabaseAdmin
                .from('user_profiles')
                .insert({
                    id: signUpData.user.id,
                    role: role,
                    org_id: codeData.org_id,
                    status: 'active',
                    full_name: fullName,
                });

            if (insertProfileError) {
                console.error('[Auth] Failed to create profile:', insertProfileError);
            }
        }

        console.log('[Auth] Signup successful!');
        return NextResponse.json({
            success: true,
            message: 'Account created successfully!',
            user: {
                id: signUpData.user.id,
                email: signUpData.user.email,
                role: role,
            },
        });

    } catch (error: any) {
        console.error('[Auth] Signup error:', error);
        return NextResponse.json({
            error: error?.message || 'Signup failed'
        }, { status: 500 });
    }
}
