/**
 * Governance API Route
 * 
 * GET - Get governance config and change requests
 * POST - Create change request or update governance
 * PATCH - Approve/reject change request
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    calculateChangeRiskScore,
    requiresApproval,
    checkRateLimits,
    createChangeRequest,
    DEFAULT_GOVERNANCE,
    type ChangeRequest,
    type GovernanceConfig
} from '@/lib/ai/governance';
import { checkAllGuardrails, type GuardrailContext } from '@/lib/ai/guardrails';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action') || 'config';
        const status = searchParams.get('status');

        if (action === 'config') {
            // Return governance config
            // In production, fetch from database
            const config: GovernanceConfig = {
                ...DEFAULT_GOVERNANCE,
                organizationId: 'org_sample'
            };

            return NextResponse.json({
                success: true,
                data: config
            });
        }

        if (action === 'requests') {
            // Return change requests
            // In production, fetch from database with filters
            const sampleRequests: ChangeRequest[] = [
                {
                    id: 'cr_1',
                    organizationId: 'org_sample',
                    requesterId: 'user_123',
                    entityType: 'campaign',
                    entityId: 'camp_456',
                    entityName: 'Summer Sale Campaign',
                    changeType: 'budget',
                    currentValue: 1000,
                    proposedValue: 1500,
                    changePercent: 50,
                    riskScore: 65,
                    riskFactors: [
                        { factor: 'Change Size', score: 22.5, description: '50.0% change' },
                        { factor: 'Entity Value', score: 10, description: '$1000 spend' }
                    ],
                    status: 'pending',
                    requiresApproval: true,
                    approvers: [],
                    createdAt: new Date().toISOString()
                }
            ];

            const filtered = status
                ? sampleRequests.filter(r => r.status === status)
                : sampleRequests;

            return NextResponse.json({
                success: true,
                data: filtered
            });
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
        );

    } catch (error) {
        console.error('Governance GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch governance data' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'check_guardrails') {
            // Check guardrails for a proposed action
            const { entity, actionType, proposedChange, orgContext } = body;

            const context: GuardrailContext = {
                entity: {
                    id: entity.id,
                    type: entity.type,
                    metrics: entity.metrics
                },
                actionType,
                proposedChange,
                orgContext: orgContext || { orgId: 'default' }
            };

            const result = await checkAllGuardrails(context);
            return NextResponse.json({ success: true, data: result });
        }

        if (action === 'check_risk') {
            // Calculate risk score for a change
            const { changePercent, entityMetrics, historicalFailureRate, inLearningPhase } = body;

            const risk = calculateChangeRiskScore({
                changePercent: changePercent || 0,
                entityMetrics: entityMetrics || {},
                historicalFailureRate,
                inLearningPhase
            });

            return NextResponse.json({ success: true, data: risk });
        }

        if (action === 'check_rate_limit') {
            // Check if more changes are allowed
            const { recentChanges } = body;

            const result = checkRateLimits({ recentChanges: recentChanges || [] });
            return NextResponse.json({ success: true, data: result });
        }

        if (action === 'create_request') {
            // Create a new change request
            const {
                organizationId,
                requesterId,
                entityType,
                entityId,
                entityName,
                changeType,
                currentValue,
                proposedValue,
                entityMetrics
            } = body;

            if (!entityType || !entityId || !changeType) {
                return NextResponse.json(
                    { error: 'entityType, entityId, and changeType are required' },
                    { status: 400 }
                );
            }

            const changeRequest = createChangeRequest({
                organizationId: organizationId || 'default',
                requesterId: requesterId || 'unknown',
                entityType,
                entityId,
                entityName: entityName || entityId,
                changeType,
                currentValue,
                proposedValue,
                entityMetrics
            });

            // In production, save to database
            return NextResponse.json({ success: true, data: changeRequest });
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
        );

    } catch (error) {
        console.error('Governance POST error:', error);
        return NextResponse.json(
            { error: 'Failed to process governance request' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestId, decision, approverId, approverName, approverRole, comment } = body;

        if (!requestId || !decision) {
            return NextResponse.json(
                { error: 'requestId and decision are required' },
                { status: 400 }
            );
        }

        if (!['approved', 'rejected'].includes(decision)) {
            return NextResponse.json(
                { error: 'decision must be "approved" or "rejected"' },
                { status: 400 }
            );
        }

        // In production, fetch and update the request in database
        const updatedRequest: ChangeRequest = {
            id: requestId,
            organizationId: 'org_sample',
            requesterId: 'user_original',
            entityType: 'campaign',
            entityId: 'camp_456',
            entityName: 'Sample Campaign',
            changeType: 'budget',
            currentValue: 1000,
            proposedValue: 1500,
            riskScore: 45,
            riskFactors: [],
            status: decision,
            requiresApproval: true,
            approvers: [{
                userId: approverId || 'approver_1',
                name: approverName || 'Approver',
                decision,
                comment,
                decidedAt: new Date().toISOString()
            }],
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            resolvedAt: new Date().toISOString()
        };

        return NextResponse.json({
            success: true,
            data: updatedRequest
        });

    } catch (error) {
        console.error('Governance PATCH error:', error);
        return NextResponse.json(
            { error: 'Failed to update request' },
            { status: 500 }
        );
    }
}
