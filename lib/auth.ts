/**
 * Auth Library - Authentication utilities for Athena
 * Uses Supabase Auth for session management
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// TYPES
// ============================================

export type UserRole = 'marketer' | 'client' | 'admin' | 'organizer';
export type UserStatus = 'active' | 'pending' | 'suspended' | 'inactive';

export interface UserProfile {
    id: string;
    org_id: string | null;
    role: UserRole;
    status: UserStatus;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    last_login_at: string | null;
}

export interface AuthUser {
    id: string;
    email: string;
    profile: UserProfile | null;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, any>;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get current authenticated user with profile
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured()) return null;

    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) return null;

        // Get user profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return {
            id: user.id,
            email: user.email || '',
            profile: profile || null,
        };
    } catch (error) {
        console.error('[Auth] Error getting current user:', error);
        return null;
    }
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, fullName?: string) {
    if (!isSupabaseConfigured()) {
        return { error: 'Supabase not configured' };
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) {
        return { error: error.message };
    }

    return { user: data.user, session: data.session };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured()) {
        return { error: 'Supabase not configured' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    // Update last login
    if (data.user) {
        await supabase
            .from('user_profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', data.user.id);
    }

    return { user: data.user, session: data.session };
}

/**
 * Sign out current user
 */
export async function signOut() {
    if (!isSupabaseConfigured()) return;

    await supabase.auth.signOut();
}

/**
 * Get current session
 */
export async function getSession() {
    if (!isSupabaseConfigured()) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('[Auth] Error fetching profile:', error);
        return null;
    }

    return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url'>>
): Promise<UserProfile | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('user_profiles')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('[Auth] Error updating profile:', error);
        return null;
    }

    return data;
}

// ============================================
// ORGANIZATION
// ============================================

/**
 * Get user's organization
 */
export async function getUserOrganization(userId: string): Promise<Organization | null> {
    if (!isSupabaseConfigured()) return null;

    const profile = await getUserProfile(userId);
    if (!profile?.org_id) return null;

    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single();

    if (error) {
        console.error('[Auth] Error fetching organization:', error);
        return null;
    }

    return data;
}

/**
 * Create a new organization
 */
export async function createOrganization(
    name: string,
    slug: string,
    creatorId: string
): Promise<Organization | null> {
    if (!isSupabaseConfigured()) return null;

    // Create org
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, slug })
        .select()
        .single();

    if (orgError) {
        console.error('[Auth] Error creating organization:', orgError);
        return null;
    }

    // Update creator to be admin of org
    await supabase
        .from('user_profiles')
        .update({
            org_id: org.id,
            role: 'admin',
            status: 'active',
        })
        .eq('id', creatorId);

    return org;
}

// ============================================
// IMPERSONATION (Organizer only)
// ============================================

const IMPERSONATION_KEY = 'athena_impersonation';

export interface ImpersonationContext {
    originalUserId: string;
    impersonatedUserId: string;
    startedAt: string;
}

/**
 * Start impersonating a user (organizer only)
 */
export function startImpersonation(originalUserId: string, targetUserId: string): void {
    const context: ImpersonationContext = {
        originalUserId,
        impersonatedUserId: targetUserId,
        startedAt: new Date().toISOString(),
    };
    localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(context));
}

/**
 * End impersonation
 */
export function endImpersonation(): void {
    localStorage.removeItem(IMPERSONATION_KEY);
}

/**
 * Get current impersonation context
 */
export function getImpersonationContext(): ImpersonationContext | null {
    const stored = localStorage.getItem(IMPERSONATION_KEY);
    if (!stored) return null;

    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Check if currently impersonating
 */
export function isImpersonating(): boolean {
    return getImpersonationContext() !== null;
}
