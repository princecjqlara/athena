/**
 * RBAC (Role-Based Access Control) API Route
 * 
 * GET - Get permissions for role
 * POST - Check access for action
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getRolePermissions,
    hasPermission,
    canApprove,
    getApprovalRequirements,
    checkAccess,
    AI_PERMISSIONS,
    DEFAULT_APPROVAL_CHAINS,
    type UserRole
} from '@/lib/ai/rbac';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const role = searchParams.get('role') as UserRole;
        const action = searchParams.get('action') || 'permissions';

        if (!role) {
            // Return all roles and their descriptions
            return NextResponse.json({
                success: true,
                data: {
                    roles: [
                        { role: 'organizer', description: 'Super admin with full access', level: 4 },
                        { role: 'admin', description: 'Organization admin with governance access', level: 3 },
                        { role: 'marketer', description: 'Full campaign management access', level: 2 },
                        { role: 'client', description: 'Read-only access to reports', level: 1 }
                    ],
                    permissions: Object.keys(AI_PERMISSIONS),
                    approvalChains: DEFAULT_APPROVAL_CHAINS.map(c => ({
                        actionType: c.actionType,
                        approverRoles: c.approverRoles,
                        requiredApprovals: c.requiredApprovals
                    }))
                }
            });
        }

        if (action === 'permissions') {
            const permissions = getRolePermissions(role);
            return NextResponse.json({
                success: true,
                data: {
                    role,
                    permissions,
                    count: permissions.length
                }
            });
        }

        if (action === 'approval_chains') {
            const chains = DEFAULT_APPROVAL_CHAINS.filter(c =>
                c.approverRoles.includes(role)
            );
            return NextResponse.json({
                success: true,
                data: {
                    role,
                    canApprove: chains.map(c => c.actionType),
                    chains
                }
            });
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
        );

    } catch (error) {
        console.error('RBAC GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch RBAC data' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, userRole, permission, actionType, riskScore, resourceOwnerId, userId } = body;

        if (!userRole) {
            return NextResponse.json(
                { error: 'userRole is required' },
                { status: 400 }
            );
        }

        if (action === 'check_permission') {
            if (!permission) {
                return NextResponse.json(
                    { error: 'permission object is required' },
                    { status: 400 }
                );
            }

            const has = hasPermission(userRole, permission);
            return NextResponse.json({
                success: true,
                data: { hasPermission: has, role: userRole, permission }
            });
        }

        if (action === 'check_access') {
            if (!permission) {
                return NextResponse.json(
                    { error: 'permission object is required' },
                    { status: 400 }
                );
            }

            const result = checkAccess({
                userRole,
                permission,
                resourceOwnerId,
                userId
            });

            return NextResponse.json({
                success: true,
                data: result
            });
        }

        if (action === 'can_approve') {
            if (!actionType) {
                return NextResponse.json(
                    { error: 'actionType is required' },
                    { status: 400 }
                );
            }

            const can = canApprove(userRole, actionType);
            return NextResponse.json({
                success: true,
                data: { canApprove: can, role: userRole, actionType }
            });
        }

        if (action === 'approval_required') {
            if (!actionType) {
                return NextResponse.json(
                    { error: 'actionType is required' },
                    { status: 400 }
                );
            }

            const requirements = getApprovalRequirements(actionType, riskScore || 0);
            return NextResponse.json({
                success: true,
                data: {
                    requiresApproval: requirements !== null,
                    requirements
                }
            });
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
        );

    } catch (error) {
        console.error('RBAC POST error:', error);
        return NextResponse.json(
            { error: 'Failed to check access' },
            { status: 500 }
        );
    }
}
