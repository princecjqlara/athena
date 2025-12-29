/**
 * Unified Timeline Module
 * 
 * Aggregates all AI actions, recommendations, automations, and audit events
 * into a single chronological view for transparency and debugging.
 */

export type TimelineEventType =
    | 'recommendation_created'
    | 'recommendation_accepted'
    | 'recommendation_rejected'
    | 'recommendation_applied'
    | 'recommendation_evaluated'
    | 'automation_triggered'
    | 'automation_executed'
    | 'automation_failed'
    | 'agent_run_started'
    | 'agent_run_completed'
    | 'guardrail_blocked'
    | 'guardrail_warned'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_denied'
    | 'pattern_detected'
    | 'anomaly_detected'
    | 'fatigue_alert'
    | 'health_degraded'
    | 'user_action'
    | 'system_event';

export interface TimelineEvent {
    id: string;
    type: TimelineEventType;
    category: 'recommendation' | 'automation' | 'agent' | 'guardrail' | 'approval' | 'alert' | 'user' | 'system';

    // Timing
    timestamp: string;
    duration?: number;        // For events with duration (agent runs, etc.)

    // Entity context
    entityType?: 'ad' | 'adset' | 'campaign' | 'account' | 'creative';
    entityId?: string;
    entityName?: string;

    // Actor
    actorType: 'ai' | 'user' | 'system' | 'automation';
    actorId?: string;
    actorName?: string;

    // Content
    title: string;
    description: string;
    details?: Record<string, unknown>;

    // Status
    status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    outcome?: 'success' | 'failure' | 'partial' | 'blocked';

    // Metrics (for evaluation events)
    metrics?: Record<string, number>;

    // Related events
    parentEventId?: string;
    relatedEventIds?: string[];

    // UI hints
    severity?: 'info' | 'warning' | 'error' | 'success';
    collapsed?: boolean;
    icon?: string;
}

export interface TimelineFilter {
    types?: TimelineEventType[];
    categories?: TimelineEvent['category'][];
    entityTypes?: string[];
    entityIds?: string[];
    actorTypes?: TimelineEvent['actorType'][];
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    severity?: TimelineEvent['severity'][];
}

export interface TimelineGroup {
    date: string;            // YYYY-MM-DD
    events: TimelineEvent[];
    summary: {
        total: number;
        byCategory: Record<string, number>;
        bySeverity: Record<string, number>;
    };
}

/**
 * Filter timeline events
 */
export function filterTimelineEvents(
    events: TimelineEvent[],
    filter: TimelineFilter
): TimelineEvent[] {
    return events.filter(event => {
        if (filter.types?.length && !filter.types.includes(event.type)) {
            return false;
        }
        if (filter.categories?.length && !filter.categories.includes(event.category)) {
            return false;
        }
        if (filter.entityTypes?.length && event.entityType && !filter.entityTypes.includes(event.entityType)) {
            return false;
        }
        if (filter.entityIds?.length && event.entityId && !filter.entityIds.includes(event.entityId)) {
            return false;
        }
        if (filter.actorTypes?.length && !filter.actorTypes.includes(event.actorType)) {
            return false;
        }
        if (filter.severity?.length && event.severity && !filter.severity.includes(event.severity)) {
            return false;
        }
        if (filter.dateFrom && event.timestamp < filter.dateFrom) {
            return false;
        }
        if (filter.dateTo && event.timestamp > filter.dateTo) {
            return false;
        }
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesTitle = event.title.toLowerCase().includes(searchLower);
            const matchesDesc = event.description.toLowerCase().includes(searchLower);
            const matchesEntity = event.entityName?.toLowerCase().includes(searchLower);
            if (!matchesTitle && !matchesDesc && !matchesEntity) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: TimelineEvent[]): TimelineGroup[] {
    const groups: Map<string, TimelineEvent[]> = new Map();

    for (const event of events) {
        const date = event.timestamp.split('T')[0];
        if (!groups.has(date)) {
            groups.set(date, []);
        }
        groups.get(date)!.push(event);
    }

    return Array.from(groups.entries())
        .map(([date, groupEvents]) => ({
            date,
            events: groupEvents.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            ),
            summary: {
                total: groupEvents.length,
                byCategory: groupEvents.reduce((acc, e) => {
                    acc[e.category] = (acc[e.category] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
                bySeverity: groupEvents.reduce((acc, e) => {
                    const sev = e.severity || 'info';
                    acc[sev] = (acc[sev] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            }
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get event chain (parent + children)
 */
export function getEventChain(
    events: TimelineEvent[],
    eventId: string
): TimelineEvent[] {
    const chain: TimelineEvent[] = [];
    const target = events.find(e => e.id === eventId);

    if (!target) return chain;

    // Find root parent
    let root = target;
    while (root.parentEventId) {
        const parent = events.find(e => e.id === root.parentEventId);
        if (!parent) break;
        root = parent;
    }

    // Collect all descendants
    const collectDescendants = (parentId: string) => {
        const children = events.filter(e => e.parentEventId === parentId);
        for (const child of children) {
            chain.push(child);
            collectDescendants(child.id);
        }
    };

    chain.push(root);
    collectDescendants(root.id);

    return chain.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

/**
 * Create a timeline event from an audit log entry
 */
export function auditLogToTimelineEvent(params: {
    id: string;
    actionType: string;
    actionCategory: string;
    entityType?: string;
    entityId?: string;
    actionDetails: Record<string, unknown>;
    userId?: string;
    createdAt: string;
}): TimelineEvent {
    const { id, actionType, actionCategory, entityType, entityId, actionDetails, userId, createdAt } = params;

    // Map action type to timeline type
    const typeMap: Record<string, TimelineEventType> = {
        'recommendation_created': 'recommendation_created',
        'recommendation_accepted': 'recommendation_accepted',
        'recommendation_rejected': 'recommendation_rejected',
        'auto_action_executed': 'automation_executed',
        'guardrail_triggered': 'guardrail_blocked',
        'agent_run_started': 'agent_run_started',
        'agent_run_completed': 'agent_run_completed',
        'anomaly_detected': 'anomaly_detected'
    };

    const categoryMap: Record<string, TimelineEvent['category']> = {
        'recommendation': 'recommendation',
        'automation': 'automation',
        'guardrail': 'guardrail',
        'override': 'user',
        'system': 'system'
    };

    // Generate title and description
    const title = generateEventTitle(actionType, actionDetails);
    const description = generateEventDescription(actionType, actionDetails);

    // Determine severity
    const severity = getSeverityForAction(actionType);

    return {
        id,
        type: typeMap[actionType] || 'system_event',
        category: categoryMap[actionCategory] || 'system',
        timestamp: createdAt,
        entityType: entityType as TimelineEvent['entityType'],
        entityId,
        entityName: actionDetails.entity_name as string | undefined,
        actorType: userId ? 'user' : 'ai',
        actorId: userId,
        title,
        description,
        details: actionDetails,
        severity,
        icon: getIconForEventType(actionType)
    };
}

function generateEventTitle(actionType: string, details: Record<string, unknown>): string {
    const titles: Record<string, string> = {
        'recommendation_created': `New ${details.type || 'AI'} Recommendation`,
        'recommendation_accepted': 'Recommendation Accepted',
        'recommendation_rejected': 'Recommendation Rejected',
        'automation_executed': 'Automation Executed',
        'guardrail_blocked': 'Action Blocked by Guardrail',
        'agent_run_started': 'AI Analysis Started',
        'agent_run_completed': 'AI Analysis Completed',
        'anomaly_detected': 'Anomaly Detected',
        'fatigue_alert': 'Creative Fatigue Alert',
        'approval_requested': 'Approval Required',
        'approval_granted': 'Approval Granted'
    };
    return titles[actionType] || 'System Event';
}

function generateEventDescription(actionType: string, details: Record<string, unknown>): string {
    switch (actionType) {
        case 'recommendation_created':
            return details.title as string || 'New recommendation generated';
        case 'recommendation_accepted':
            return `Recommendation "${details.title || ''}" was accepted`;
        case 'recommendation_rejected':
            return `Recommendation rejected: ${details.reason || 'No reason provided'}`;
        case 'guardrail_blocked':
            return `${details.guardrail_name || 'Guardrail'}: ${details.message || 'Action blocked'}`;
        case 'anomaly_detected':
            return `Unusual ${details.metric || 'metric'} detected: ${details.change || 'significant change'}`;
        default:
            return details.message as string || 'Event occurred';
    }
}

function getSeverityForAction(actionType: string): TimelineEvent['severity'] {
    const severities: Record<string, TimelineEvent['severity']> = {
        'recommendation_created': 'info',
        'recommendation_accepted': 'success',
        'recommendation_rejected': 'warning',
        'automation_executed': 'success',
        'automation_failed': 'error',
        'guardrail_blocked': 'warning',
        'agent_run_completed': 'success',
        'anomaly_detected': 'warning',
        'fatigue_alert': 'warning',
        'health_degraded': 'error'
    };
    return severities[actionType] || 'info';
}

function getIconForEventType(actionType: string): string {
    const icons: Record<string, string> = {
        'recommendation_created': '💡',
        'recommendation_accepted': '✅',
        'recommendation_rejected': '❌',
        'automation_executed': '⚡',
        'automation_failed': '🔴',
        'guardrail_blocked': '🛡️',
        'agent_run_started': '🤖',
        'agent_run_completed': '🤖',
        'anomaly_detected': '📊',
        'fatigue_alert': '⚠️',
        'approval_requested': '📋',
        'approval_granted': '✔️',
        'pattern_detected': '🔍'
    };
    return icons[actionType] || '📌';
}

/**
 * Generate timeline summary for a time period
 */
export function generateTimelineSummary(events: TimelineEvent[]): {
    totalEvents: number;
    byCategory: Record<string, number>;
    byType: Record<string, number>;
    successRate: number;
    topEntities: Array<{ entityId: string; entityName?: string; count: number }>;
    recentAlerts: TimelineEvent[];
} {
    const byCategory: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const entityCounts: Map<string, { name?: string; count: number }> = new Map();
    let successCount = 0;
    let outcomeCount = 0;

    for (const event of events) {
        byCategory[event.category] = (byCategory[event.category] || 0) + 1;
        byType[event.type] = (byType[event.type] || 0) + 1;

        if (event.outcome) {
            outcomeCount++;
            if (event.outcome === 'success') successCount++;
        }

        if (event.entityId) {
            const existing = entityCounts.get(event.entityId) || { name: event.entityName, count: 0 };
            existing.count++;
            entityCounts.set(event.entityId, existing);
        }
    }

    const topEntities = Array.from(entityCounts.entries())
        .map(([entityId, data]) => ({ entityId, entityName: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const recentAlerts = events
        .filter(e => e.severity === 'warning' || e.severity === 'error')
        .slice(0, 5);

    return {
        totalEvents: events.length,
        byCategory,
        byType,
        successRate: outcomeCount > 0 ? successCount / outcomeCount : 0,
        topEntities,
        recentAlerts
    };
}
