'use client';

import { ReactNode, useEffect, useState } from 'react';
import { UserRole, UserProfile } from '@/lib/auth';
import { roleHasPermission, Permission, userHasPermission } from '@/lib/rbac';

interface RoleGateProps {
    children: ReactNode;
    /**
     * Required roles - user must have one of these roles
     */
    allowedRoles?: UserRole[];
    /**
     * Required permissions - user must have all of these
     */
    requiredPermissions?: Permission[];
    /**
     * Any permission - user must have at least one
     */
    anyPermission?: Permission[];
    /**
     * Fallback to show when access denied
     */
    fallback?: ReactNode;
    /**
     * Hide completely instead of showing fallback
     */
    hide?: boolean;
}

/**
 * RoleGate - Conditionally render content based on user role/permissions
 * 
 * Usage:
 * <RoleGate allowedRoles={['marketer', 'admin']}>
 *   <SensitiveContent />
 * </RoleGate>
 * 
 * <RoleGate requiredPermissions={['upload_ads']} fallback={<UpgradePrompt />}>
 *   <UploadButton />
 * </RoleGate>
 */
export function RoleGate({
    children,
    allowedRoles,
    requiredPermissions,
    anyPermission,
    fallback = null,
    hide = false,
}: RoleGateProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            setProfile(data.user?.profile || null);
        } catch {
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    // While loading, optionally hide content
    if (loading) {
        return hide ? null : <>{fallback}</>;
    }

    // No profile = no access
    if (!profile) {
        return hide ? null : <>{fallback}</>;
    }

    // Check role restriction
    if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(profile.role)) {
            return hide ? null : <>{fallback}</>;
        }
    }

    // Check required permissions (must have ALL)
    if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAll = requiredPermissions.every(p => userHasPermission(profile, p));
        if (!hasAll) {
            return hide ? null : <>{fallback}</>;
        }
    }

    // Check any permission (must have AT LEAST ONE)
    if (anyPermission && anyPermission.length > 0) {
        const hasAny = anyPermission.some(p => userHasPermission(profile, p));
        if (!hasAny) {
            return hide ? null : <>{fallback}</>;
        }
    }

    // Access granted
    return <>{children}</>;
}

/**
 * useUserRole - Hook to get current user's role
 */
export function useUserRole() {
    const [role, setRole] = useState<UserRole | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();
                setProfile(data.user?.profile || null);
                setRole(data.user?.profile?.role || null);
            } catch {
                setProfile(null);
                setRole(null);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    return { role, profile, loading };
}

/**
 * MarketerOnly - Shorthand for marketer-only content
 */
export function MarketerOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
    return (
        <RoleGate allowedRoles={['marketer']} fallback={fallback}>
            {children}
        </RoleGate>
    );
}

/**
 * AdminOnly - Shorthand for admin-only content
 */
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
    return (
        <RoleGate allowedRoles={['admin', 'organizer']} fallback={fallback}>
            {children}
        </RoleGate>
    );
}

/**
 * OrganizerOnly - Shorthand for organizer-only content
 */
export function OrganizerOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
    return (
        <RoleGate allowedRoles={['organizer']} fallback={fallback}>
            {children}
        </RoleGate>
    );
}

/**
 * NotClient - Hide from client role
 */
export function NotClient({ children }: { children: ReactNode }) {
    return (
        <RoleGate allowedRoles={['marketer', 'admin', 'organizer']} hide>
            {children}
        </RoleGate>
    );
}

export default RoleGate;
