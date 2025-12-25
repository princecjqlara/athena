/**
 * RBAC Library - Role-Based Access Control utilities
 * Provides permission checking and route guards
 */

import { UserRole, UserStatus, UserProfile, getCurrentUser } from './auth';

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export type Permission =
    // Content
    | 'upload_ads'
    | 'view_ads'
    | 'delete_ads'
    // Predictions
    | 'run_predictions'
    | 'view_predictions'
    // Pipelines
    | 'manage_pipelines'
    | 'view_pipelines'
    | 'control_pipeline_items' // approve, pause, advance
    // Analytics
    | 'view_analytics'
    | 'export_analytics'
    // Settings
    | 'manage_settings'
    | 'view_settings'
    | 'connect_meta'
    | 'manage_capi'
    | 'manage_collective_intelligence'
    // Admin
    | 'manage_users'
    | 'view_audit_logs'
    | 'approve_access_requests'
    | 'suspend_users'
    // Organizer
    | 'impersonate_users'
    | 'view_all_organizations';

// Role to permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    marketer: [
        'upload_ads',
        'view_ads',
        'delete_ads',
        'run_predictions',
        'view_predictions',
        'manage_pipelines',
        'view_pipelines',
        'control_pipeline_items',
        'view_analytics',
        'export_analytics',
        'manage_settings',
        'view_settings',
        'connect_meta',
        'manage_capi',
        'manage_collective_intelligence',
    ],
    client: [
        'view_predictions',
        'view_pipelines',
        'control_pipeline_items', // Only for assigned items
        'view_analytics',
    ],
    admin: [
        'view_ads',
        'view_predictions',
        'view_pipelines',
        'view_analytics',
        'view_settings',
        'manage_users',
        'view_audit_logs',
        'approve_access_requests',
        'suspend_users',
    ],
    organizer: [
        'view_ads',
        'view_predictions',
        'view_pipelines',
        'view_analytics',
        'view_settings',
        'view_audit_logs',
        'impersonate_users',
        'view_all_organizations',
    ],
};

// ============================================
// PERMISSION CHECKING
// ============================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user has permission (considering status)
 */
export function userHasPermission(profile: UserProfile | null, permission: Permission): boolean {
    if (!profile) return false;
    if (profile.status !== 'active') return false;

    return roleHasPermission(profile.role, permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function userHasAnyPermission(profile: UserProfile | null, permissions: Permission[]): boolean {
    return permissions.some(p => userHasPermission(profile, p));
}

/**
 * Check if user has all of the specified permissions
 */
export function userHasAllPermissions(profile: UserProfile | null, permissions: Permission[]): boolean {
    return permissions.every(p => userHasPermission(profile, p));
}

// ============================================
// ROUTE ACCESS
// ============================================

// Route to required permissions mapping
const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
    '/': ['view_predictions'],
    '/upload': ['upload_ads'],
    '/import': ['upload_ads'],
    '/myads': ['view_ads'],
    '/predict': ['run_predictions'],
    '/results': ['view_predictions'],
    '/analytics': ['view_analytics'],
    '/pipeline': ['view_pipelines'],
    '/mindmap': ['view_predictions'],
    '/settings': ['view_settings'],
    '/settings/collective': ['manage_collective_intelligence'],
    '/admin': ['manage_users'],
    '/admin/users': ['manage_users'],
    '/admin/requests': ['approve_access_requests'],
    '/admin/logs': ['view_audit_logs'],
    '/organizer': ['view_all_organizations'],
    '/organizer/impersonate': ['impersonate_users'],
};

/**
 * Check if user can access a route
 */
export function canAccessRoute(profile: UserProfile | null, route: string): boolean {
    if (!profile) return false;
    if (profile.status !== 'active') return false;

    // Find matching route (handle dynamic routes)
    const routeKey = Object.keys(ROUTE_PERMISSIONS).find(key => {
        if (route === key) return true;
        if (key.endsWith('/*') && route.startsWith(key.slice(0, -2))) return true;
        return false;
    });

    if (!routeKey) {
        // No specific permissions required, allow if active
        return true;
    }

    const requiredPermissions = ROUTE_PERMISSIONS[routeKey];
    return userHasAnyPermission(profile, requiredPermissions);
}

/**
 * Get default route for a role after login
 */
export function getDefaultRouteForRole(role: UserRole): string {
    switch (role) {
        case 'marketer':
            return '/';
        case 'client':
            return '/pipeline';
        case 'admin':
            return '/admin';
        case 'organizer':
            return '/organizer';
        default:
            return '/';
    }
}

// ============================================
// STATUS CHECKS
// ============================================

/**
 * Check if user account is active
 */
export function isUserActive(profile: UserProfile | null): boolean {
    return profile?.status === 'active';
}

/**
 * Check if user is pending approval
 */
export function isUserPending(profile: UserProfile | null): boolean {
    return profile?.status === 'pending';
}

/**
 * Check if user is suspended
 */
export function isUserSuspended(profile: UserProfile | null): boolean {
    return profile?.status === 'suspended';
}

// ============================================
// ROLE CHECKS
// ============================================

export function isMarketer(profile: UserProfile | null): boolean {
    return profile?.role === 'marketer' && profile.status === 'active';
}

export function isClient(profile: UserProfile | null): boolean {
    return profile?.role === 'client' && profile.status === 'active';
}

export function isAdmin(profile: UserProfile | null): boolean {
    return profile?.role === 'admin' && profile.status === 'active';
}

export function isOrganizer(profile: UserProfile | null): boolean {
    return profile?.role === 'organizer' && profile.status === 'active';
}

/**
 * Check if user can manage another user
 */
export function canManageUser(actorProfile: UserProfile | null, targetProfile: UserProfile | null): boolean {
    if (!actorProfile || !targetProfile) return false;

    // Organizers can manage anyone
    if (isOrganizer(actorProfile)) return true;

    // Admins can manage users in their org (except other admins)
    if (isAdmin(actorProfile)) {
        if (actorProfile.org_id !== targetProfile.org_id) return false;
        if (targetProfile.role === 'admin' || targetProfile.role === 'organizer') return false;
        return true;
    }

    return false;
}

// ============================================
// SERVER-SIDE GUARD (for API routes)
// ============================================

export interface GuardResult {
    allowed: boolean;
    user: { id: string; profile: UserProfile } | null;
    error?: string;
    statusCode?: number;
}

/**
 * Server-side permission guard for API routes
 */
export async function guardApiRoute(
    requiredPermissions: Permission[],
    requireAll: boolean = false
): Promise<GuardResult> {
    const user = await getCurrentUser();

    if (!user) {
        return {
            allowed: false,
            user: null,
            error: 'Unauthorized',
            statusCode: 401,
        };
    }

    if (!user.profile) {
        return {
            allowed: false,
            user: null,
            error: 'Profile not found',
            statusCode: 403,
        };
    }

    if (user.profile.status !== 'active') {
        return {
            allowed: false,
            user: null,
            error: `Account is ${user.profile.status}`,
            statusCode: 403,
        };
    }

    const hasPermission = requireAll
        ? userHasAllPermissions(user.profile, requiredPermissions)
        : userHasAnyPermission(user.profile, requiredPermissions);

    if (!hasPermission) {
        return {
            allowed: false,
            user: { id: user.id, profile: user.profile },
            error: 'Insufficient permissions',
            statusCode: 403,
        };
    }

    return {
        allowed: true,
        user: { id: user.id, profile: user.profile },
    };
}
