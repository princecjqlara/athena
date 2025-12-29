/**
 * Role-Based Access Control (RBAC) Module
 * 
 * Implements 4-tier role hierarchy:
 * - Organizer (super admin)
 * - Admin (org admin)
 * - Marketer (full access to their campaigns)
 * - Client/Viewer (read-only)
 * 
 * Plus permission-based access control for AI features.
 */

export type UserRole = 'organizer' | 'admin' | 'marketer' | 'client';

export interface Permission {
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'execute';
}

export interface RolePermissions {
    role: UserRole;
    permissions: Permission[];
    inheritsFrom?: UserRole;
}

// AI-specific permissions
export const AI_PERMISSIONS = {
    // Recommendations
    VIEW_RECOMMENDATIONS: { resource: 'recommendations', action: 'read' as const },
    CREATE_RECOMMENDATIONS: { resource: 'recommendations', action: 'create' as const },
    APPROVE_RECOMMENDATIONS: { resource: 'recommendations', action: 'approve' as const },
    EXECUTE_RECOMMENDATIONS: { resource: 'recommendations', action: 'execute' as const },

    // Automation
    VIEW_AUTOMATIONS: { resource: 'automations', action: 'read' as const },
    CREATE_AUTOMATIONS: { resource: 'automations', action: 'create' as const },
    TOGGLE_AUTOMATIONS: { resource: 'automations', action: 'update' as const },

    // Governance
    VIEW_GOVERNANCE: { resource: 'governance', action: 'read' as const },
    EDIT_GOVERNANCE: { resource: 'governance', action: 'update' as const },

    // Audit
    VIEW_AUDIT_LOGS: { resource: 'audit_logs', action: 'read' as const },

    // Agents
    RUN_AGENTS: { resource: 'agents', action: 'execute' as const },
    VIEW_AGENT_RUNS: { resource: 'agents', action: 'read' as const },

    // Forecasting
    VIEW_FORECASTS: { resource: 'forecasts', action: 'read' as const },
    CREATE_SIMULATIONS: { resource: 'simulations', action: 'create' as const },

    // Patterns
    VIEW_PATTERNS: { resource: 'patterns', action: 'read' as const },
    MANAGE_PATTERNS: { resource: 'patterns', action: 'update' as const }
};

// Role hierarchy with permissions
const ROLE_HIERARCHY: RolePermissions[] = [
    {
        role: 'client',
        permissions: [
            AI_PERMISSIONS.VIEW_RECOMMENDATIONS,
            AI_PERMISSIONS.VIEW_FORECASTS,
            AI_PERMISSIONS.VIEW_PATTERNS
        ]
    },
    {
        role: 'marketer',
        inheritsFrom: 'client',
        permissions: [
            AI_PERMISSIONS.CREATE_RECOMMENDATIONS,
            AI_PERMISSIONS.APPROVE_RECOMMENDATIONS,
            AI_PERMISSIONS.VIEW_AUTOMATIONS,
            AI_PERMISSIONS.CREATE_AUTOMATIONS,
            AI_PERMISSIONS.TOGGLE_AUTOMATIONS,
            AI_PERMISSIONS.RUN_AGENTS,
            AI_PERMISSIONS.VIEW_AGENT_RUNS,
            AI_PERMISSIONS.CREATE_SIMULATIONS,
            AI_PERMISSIONS.VIEW_GOVERNANCE
        ]
    },
    {
        role: 'admin',
        inheritsFrom: 'marketer',
        permissions: [
            AI_PERMISSIONS.EXECUTE_RECOMMENDATIONS,
            AI_PERMISSIONS.EDIT_GOVERNANCE,
            AI_PERMISSIONS.VIEW_AUDIT_LOGS,
            AI_PERMISSIONS.MANAGE_PATTERNS
        ]
    },
    {
        role: 'organizer',
        inheritsFrom: 'admin',
        permissions: [
            // Organizers have all permissions (no additional needed)
        ]
    }
];

/**
 * Get all permissions for a role (including inherited)
 */
export function getRolePermissions(role: UserRole): Permission[] {
    const roleConfig = ROLE_HIERARCHY.find(r => r.role === role);
    if (!roleConfig) return [];

    const permissions = [...roleConfig.permissions];

    // Add inherited permissions
    if (roleConfig.inheritsFrom) {
        const inherited = getRolePermissions(roleConfig.inheritsFrom);
        for (const perm of inherited) {
            if (!permissions.find(p => p.resource === perm.resource && p.action === perm.action)) {
                permissions.push(perm);
            }
        }
    }

    return permissions;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = getRolePermissions(role);
    return permissions.some(p => p.resource === permission.resource && p.action === permission.action);
}

/**
 * Check if a role can approve a specific action
 */
export function canApprove(role: UserRole, actionType: string): boolean {
    // Only admins and organizers can approve high-risk actions
    if (['budget_increase', 'automation_enable'].includes(actionType)) {
        return ['admin', 'organizer'].includes(role);
    }

    // Marketers can approve low-risk recommendations
    return ['marketer', 'admin', 'organizer'].includes(role);
}

/**
 * Get the minimum role required for an action
 */
export function getMinimumRole(permission: Permission): UserRole {
    for (const roleConfig of ROLE_HIERARCHY) {
        if (hasPermission(roleConfig.role, permission)) {
            return roleConfig.role;
        }
    }
    return 'organizer'; // Default to highest
}

// Approval chain configuration
export interface ApprovalChainConfig {
    actionType: string;
    riskThreshold: number;     // Actions with risk >= this need approval
    approverRoles: UserRole[]; // Roles that can approve
    requiredApprovals: number; // Number of approvals needed
    escalationPath: UserRole[]; // Who to escalate to if not approved
    timeoutHours: number;      // Auto-reject after this time
}

export const DEFAULT_APPROVAL_CHAINS: ApprovalChainConfig[] = [
    {
        actionType: 'budget_increase',
        riskThreshold: 50,
        approverRoles: ['admin', 'organizer'],
        requiredApprovals: 1,
        escalationPath: ['organizer'],
        timeoutHours: 24
    },
    {
        actionType: 'automation_enable',
        riskThreshold: 60,
        approverRoles: ['admin', 'organizer'],
        requiredApprovals: 1,
        escalationPath: ['organizer'],
        timeoutHours: 48
    },
    {
        actionType: 'creative_pause',
        riskThreshold: 40,
        approverRoles: ['marketer', 'admin', 'organizer'],
        requiredApprovals: 1,
        escalationPath: ['admin'],
        timeoutHours: 24
    },
    {
        actionType: 'audience_change',
        riskThreshold: 70,
        approverRoles: ['admin', 'organizer'],
        requiredApprovals: 2,
        escalationPath: ['organizer'],
        timeoutHours: 24
    }
];

/**
 * Get approval requirements for an action
 */
export function getApprovalRequirements(
    actionType: string,
    riskScore: number
): ApprovalChainConfig | null {
    const chain = DEFAULT_APPROVAL_CHAINS.find(c => c.actionType === actionType);

    if (!chain) return null;
    if (riskScore < chain.riskThreshold) return null;

    return chain;
}

/**
 * Check if a user can approve a specific request
 */
export function canUserApprove(
    userRole: UserRole,
    requesterId: string,
    approverId: string,
    approvalChain: ApprovalChainConfig
): { canApprove: boolean; reason?: string } {
    // Cannot approve own requests
    if (requesterId === approverId) {
        return { canApprove: false, reason: 'Cannot approve your own request' };
    }

    // Check if role is in approver list
    if (!approvalChain.approverRoles.includes(userRole)) {
        return {
            canApprove: false,
            reason: `Requires role: ${approvalChain.approverRoles.join(' or ')}`
        };
    }

    return { canApprove: true };
}

export interface AccessCheckResult {
    allowed: boolean;
    reason?: string;
    requiredRole?: UserRole;
    missingPermission?: Permission;
}

/**
 * Check access for a specific action
 */
export function checkAccess(params: {
    userRole: UserRole;
    permission: Permission;
    resourceOwnerId?: string;
    userId?: string;
}): AccessCheckResult {
    const { userRole, permission, resourceOwnerId, userId } = params;

    // Check permission
    if (!hasPermission(userRole, permission)) {
        return {
            allowed: false,
            reason: `Missing permission: ${permission.resource}.${permission.action}`,
            requiredRole: getMinimumRole(permission),
            missingPermission: permission
        };
    }

    // For non-admin roles, check ownership
    if (resourceOwnerId && userId && !['admin', 'organizer'].includes(userRole)) {
        if (resourceOwnerId !== userId) {
            return {
                allowed: false,
                reason: 'Can only access your own resources'
            };
        }
    }

    return { allowed: true };
}
