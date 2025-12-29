/**
 * Audit Logging Utility
 * 
 * Provides functions for creating immutable audit log entries
 * for all AI decisions, recommendations, and actions.
 */

// Supabase client passed as 'any' since new tables aren't in generated types yet

// Action types for categorization
export type AuditActionType =
    // Recommendation lifecycle
    | 'recommendation_created'
    | 'recommendation_accepted'
    | 'recommendation_rejected'
    | 'recommendation_expired'
    | 'recommendation_superseded'
    | 'recommendation_auto_applied'
    // Automation
    | 'action_executed'
    | 'action_failed'
    | 'action_rolled_back'
    // Guardrails
    | 'guardrail_triggered'
    | 'guardrail_blocked'
    | 'guardrail_overridden'
    // Override
    | 'user_override'
    | 'admin_override'
    | 'emergency_stop'
    // System
    | 'sync_started'
    | 'sync_completed'
    | 'sync_failed'
    | 'evaluation_started'
    | 'evaluation_completed'
    | 'health_check'
    | 'anomaly_detected';

export type AuditActionCategory =
    | 'recommendation'
    | 'automation'
    | 'guardrail'
    | 'override'
    | 'system';

export interface AuditLogEntry {
    userId?: string;
    sessionId?: string;
    actionType: AuditActionType;
    actionCategory: AuditActionCategory;
    entityType?: string;
    entityId?: string;
    entityName?: string;
    actionDetails: Record<string, unknown>;
    stateBefore?: Record<string, unknown>;
    stateAfter?: Record<string, unknown>;
    promptVersionId?: string;
    modelVersion?: string;
    reasoning?: string;
    confidence?: number;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
}

/**
 * Get action category from action type
 */
export function getActionCategory(actionType: AuditActionType): AuditActionCategory {
    if (actionType.startsWith('recommendation_')) return 'recommendation';
    if (actionType.startsWith('action_')) return 'automation';
    if (actionType.startsWith('guardrail_')) return 'guardrail';
    if (actionType.includes('override') || actionType === 'emergency_stop') return 'override';
    return 'system';
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    entry: AuditLogEntry
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const insertData = {
            user_id: entry.userId,
            session_id: entry.sessionId,
            action_type: entry.actionType,
            action_category: entry.actionCategory,
            entity_type: entry.entityType,
            entity_id: entry.entityId,
            entity_name: entry.entityName,
            action_details: entry.actionDetails,
            state_before: entry.stateBefore,
            state_after: entry.stateAfter,
            prompt_version_id: entry.promptVersionId,
            model_version: entry.modelVersion,
            reasoning: entry.reasoning,
            confidence: entry.confidence,
            ip_address: entry.ipAddress,
            user_agent: entry.userAgent,
            request_id: entry.requestId
        };

        const { data, error } = await supabase
            .from('ai_audit_logs')
            .insert(insertData)
            .select('id')
            .single();

        if (error) {
            console.error('[Audit] Failed to create log:', error);
            return { success: false, error: error.message };
        }

        return { success: true, id: data?.id };
    } catch (err) {
        console.error('[Audit] Exception:', err);
        return { success: false, error: String(err) };
    }
}

/**
 * Log a recommendation action
 */
export async function logRecommendationAction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    params: {
        userId?: string;
        actionType: 'recommendation_created' | 'recommendation_accepted' | 'recommendation_rejected' |
        'recommendation_expired' | 'recommendation_superseded' | 'recommendation_auto_applied';
        recommendationId: string;
        recommendationType: string;
        targetType: string;
        targetId: string;
        details: Record<string, unknown>;
        confidence?: number;
    }
): Promise<{ success: boolean; id?: string }> {
    return createAuditLog(supabase, {
        userId: params.userId,
        actionType: params.actionType,
        actionCategory: 'recommendation',
        entityType: 'recommendation',
        entityId: params.recommendationId,
        actionDetails: {
            recommendation_type: params.recommendationType,
            target_type: params.targetType,
            target_id: params.targetId,
            ...params.details
        },
        confidence: params.confidence
    });
}

/**
 * Log a guardrail action
 */
export async function logGuardrailAction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    params: {
        userId?: string;
        actionType: 'guardrail_triggered' | 'guardrail_blocked' | 'guardrail_overridden';
        guardrailName: string;
        entityType: string;
        entityId: string;
        details: Record<string, unknown>;
        wasBlocked: boolean;
    }
): Promise<{ success: boolean; id?: string }> {
    return createAuditLog(supabase, {
        userId: params.userId,
        actionType: params.actionType,
        actionCategory: 'guardrail',
        entityType: params.entityType,
        entityId: params.entityId,
        actionDetails: {
            guardrail_name: params.guardrailName,
            was_blocked: params.wasBlocked,
            ...params.details
        }
    });
}

/**
 * Log a system event
 */
export async function logSystemEvent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    params: {
        actionType: 'sync_started' | 'sync_completed' | 'sync_failed' |
        'evaluation_started' | 'evaluation_completed' | 'health_check' | 'anomaly_detected';
        entityType?: string;
        entityId?: string;
        details: Record<string, unknown>;
    }
): Promise<{ success: boolean; id?: string }> {
    return createAuditLog(supabase, {
        actionType: params.actionType,
        actionCategory: 'system',
        entityType: params.entityType,
        entityId: params.entityId,
        actionDetails: params.details
    });
}

/**
 * Query recent audit logs
 */
export async function getRecentAuditLogs(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    params: {
        userId?: string;
        entityType?: string;
        entityId?: string;
        actionCategory?: AuditActionCategory;
        limit?: number;
        offset?: number;
    }
): Promise<{ success: boolean; logs?: unknown[]; error?: string }> {
    try {
        let query = supabase
            .from('ai_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(params.limit || 50);

        if (params.userId) query = query.eq('user_id', params.userId);
        if (params.entityType) query = query.eq('entity_type', params.entityType);
        if (params.entityId) query = query.eq('entity_id', params.entityId);
        if (params.actionCategory) query = query.eq('action_category', params.actionCategory);
        if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);

        const { data, error } = await query;

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, logs: data || [] };
    } catch (err) {
        return { success: false, error: String(err) };
    }
}
