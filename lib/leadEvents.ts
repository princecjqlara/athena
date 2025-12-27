/**
 * Lead Lifecycle Events - Hybrid Scoring + Revenue Model
 * 
 * Funnel Stages (Canonical Order):
 * Inquiry → Interested → Scheduled → Completed
 *                                   ↓
 *                                  Lost (terminal)
 */

// Event names - EXACT as specified, do not change
export const LEAD_EVENT_NAMES = {
    INQUIRY: 'inquiry',
    INTERESTED: 'interested',
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    LOST: 'lost'
} as const;

export type LeadEventName = typeof LEAD_EVENT_NAMES[keyof typeof LEAD_EVENT_NAMES];

// Score-based values for progression tracking
export const LEAD_EVENT_SCORES: Record<LeadEventName, number> = {
    inquiry: 10,
    interested: 30,
    scheduled: 70,
    completed: 100,
    lost: 0
};

// Funnel stage order for validation (lost is outside funnel)
export const FUNNEL_ORDER: LeadEventName[] = ['inquiry', 'interested', 'scheduled', 'completed'];

// Terminal states that cannot transition
export const TERMINAL_STATES: LeadEventName[] = ['completed', 'lost'];

// Stage descriptions for AI and UI
export const STAGE_DESCRIPTIONS: Record<LeadEventName, string> = {
    inquiry: 'First contact occurs - message, form, or inbound request created',
    interested: 'User explicitly expresses intent - requests pricing, asks availability, confirms interest',
    scheduled: 'Date/time confirmed - appointment, consultation, or call booked',
    completed: 'Service delivered, contract signed, deal closed, or payment confirmed',
    lost: 'User declined, stopped responding, chose competitor, or budget rejected'
};

// Detection keywords for AI classification
export const STAGE_KEYWORDS: Record<LeadEventName, string[]> = {
    inquiry: ['hi', 'hello', 'inquiry', 'question', 'interested', 'info', 'how much', 'price'],
    interested: ['yes', 'interested', 'want', 'need', 'book', 'schedule', 'available', 'when', 'price check', 'budget'],
    scheduled: ['booked', 'confirmed', 'appointment', 'ocular', 'consultation', 'meeting', 'call scheduled', 'date set'],
    completed: ['paid', 'done', 'completed', 'signed', 'delivered', 'closed', 'purchased', 'bought'],
    lost: ['no', 'not interested', 'cancel', 'never mind', 'too expensive', 'competitor', 'busy', 'later', 'decline']
};

/**
 * Lead Event Data Structure
 */
export interface LeadEvent {
    event_name: LeadEventName;
    value: number;              // Score for progression, revenue for completed
    currency?: string;          // Only for completed
    lead_score?: number;        // Always 0-100 score
    reason?: string;            // For lost events
    timestamp: number;          // Unix timestamp
    lead_id: string;
    previous_stage?: LeadEventName;
}

/**
 * Validate if a stage transition is allowed
 * 
 * Rules:
 * - Events must be fired sequentially and may not be skipped
 * - Any stage can transition to lost
 * - Lost and completed are terminal (cannot transition out)
 */
export function isValidTransition(
    fromStage: LeadEventName | null,
    toStage: LeadEventName
): { valid: boolean; reason?: string } {
    // Handle lost - any stage can go to lost
    if (toStage === 'lost') {
        return { valid: true };
    }

    // Cannot transition FROM terminal states
    if (fromStage && TERMINAL_STATES.includes(fromStage)) {
        return {
            valid: false,
            reason: `Cannot transition from ${fromStage} (terminal state)`
        };
    }

    // First event must be inquiry
    if (fromStage === null) {
        if (toStage === 'inquiry') {
            return { valid: true };
        }
        return {
            valid: false,
            reason: 'First event must be inquiry'
        };
    }

    // Check sequential order
    const fromIndex = FUNNEL_ORDER.indexOf(fromStage);
    const toIndex = FUNNEL_ORDER.indexOf(toStage);

    // Cannot go backwards
    if (toIndex < fromIndex) {
        return {
            valid: false,
            reason: `Cannot move backwards: ${fromStage} → ${toStage}`
        };
    }

    // Cannot skip stages
    if (toIndex > fromIndex + 1) {
        const expectedNext = FUNNEL_ORDER[fromIndex + 1];
        return {
            valid: false,
            reason: `Cannot skip stages: ${fromStage} → ${toStage}. Expected: ${expectedNext}`
        };
    }

    return { valid: true };
}

/**
 * Create a lead event payload
 */
export function createLeadEvent(
    eventName: LeadEventName,
    leadId: string,
    options?: {
        revenueValue?: number;       // Only for completed
        currency?: string;           // Only for completed
        lostReason?: string;         // Only for lost
        previousStage?: LeadEventName;
    }
): LeadEvent {
    const event: LeadEvent = {
        event_name: eventName,
        value: LEAD_EVENT_SCORES[eventName],
        lead_score: LEAD_EVENT_SCORES[eventName],
        timestamp: Math.floor(Date.now() / 1000),
        lead_id: leadId,
        previous_stage: options?.previousStage
    };

    // Only completed gets revenue value
    if (eventName === 'completed' && options?.revenueValue) {
        event.value = options.revenueValue;
        event.currency = options.currency || 'PHP';
    }

    // Lost gets reason
    if (eventName === 'lost' && options?.lostReason) {
        event.reason = options.lostReason;
    }

    return event;
}

/**
 * Map pipeline stage name to canonical lead event
 */
export function mapStageToEvent(stageName: string): LeadEventName | null {
    const normalized = stageName.toLowerCase().trim();

    // Direct matches
    if (normalized === 'inquiry' || normalized === 'new' || normalized === 'new lead') {
        return 'inquiry';
    }
    if (normalized === 'interested' || normalized === 'contacted' || normalized === 'qualified') {
        return 'interested';
    }
    if (normalized === 'scheduled' || normalized === 'booked' || normalized === 'appointment') {
        return 'scheduled';
    }
    if (normalized === 'completed' || normalized === 'won' || normalized === 'closed' || normalized === 'purchased') {
        return 'completed';
    }
    if (normalized === 'lost' || normalized === 'cold' || normalized === 'dead' || normalized === 'rejected') {
        return 'lost';
    }

    // Keyword matching fallback
    for (const [event, keywords] of Object.entries(STAGE_KEYWORDS)) {
        if (keywords.some(kw => normalized.includes(kw))) {
            return event as LeadEventName;
        }
    }

    return null;
}

/**
 * Get the default pipeline stages based on canonical funnel
 */
export function getCanonicalStages() {
    return [
        {
            id: 'stage-inquiry',
            name: 'Inquiry',
            description: STAGE_DESCRIPTIONS.inquiry,
            facebookEvent: 'inquiry',
            isGoal: false,
            eventScore: 10
        },
        {
            id: 'stage-interested',
            name: 'Interested',
            description: STAGE_DESCRIPTIONS.interested,
            facebookEvent: 'interested',
            isGoal: false,
            eventScore: 30
        },
        {
            id: 'stage-scheduled',
            name: 'Scheduled',
            description: STAGE_DESCRIPTIONS.scheduled,
            facebookEvent: 'scheduled',
            isGoal: false,
            eventScore: 70
        },
        {
            id: 'stage-completed',
            name: 'Completed',
            description: STAGE_DESCRIPTIONS.completed,
            facebookEvent: 'completed',
            isGoal: true,
            eventScore: 100
        }
    ];
}

/**
 * Summary Rule:
 * Track progression with scores, measure success with revenue, 
 * and isolate loss as a terminal diagnostic state.
 */
