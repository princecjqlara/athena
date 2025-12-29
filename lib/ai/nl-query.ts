/**
 * Natural Language Query Module
 * 
 * Translates natural language questions into structured queries
 * and generates human-readable responses.
 */

export interface NLQuery {
    original: string;
    intent: QueryIntent;
    entities: ExtractedEntities;
    timeRange: TimeRange;
    metrics: string[];
    filters: QueryFilter[];
    confidence: number;
}

export type QueryIntent =
    | 'performance_summary'
    | 'comparison'
    | 'trend_analysis'
    | 'anomaly_detection'
    | 'recommendation_request'
    | 'what_if'
    | 'explanation'
    | 'top_n'
    | 'bottom_n'
    | 'health_check'
    | 'unknown';

export interface ExtractedEntities {
    campaigns?: string[];
    adsets?: string[];
    ads?: string[];
    audiences?: string[];
    creatives?: string[];
    entityType?: 'campaign' | 'adset' | 'ad' | 'account';
}

export interface TimeRange {
    type: 'relative' | 'absolute';
    start?: string;
    end?: string;
    relativePeriod?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter';
}

export interface QueryFilter {
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
    value: string | number | string[] | number[];
}

export interface QueryResult {
    query: NLQuery;
    data: Record<string, unknown>[] | Record<string, unknown>;
    summary: string;
    insights?: string[];
    visualizationType?: 'table' | 'chart' | 'card' | 'list';
    followUpQuestions?: string[];
}

// Intent patterns for simple matching
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: QueryIntent }> = [
    { pattern: /how (is|are|was|were).*(performing|doing)/i, intent: 'performance_summary' },
    { pattern: /compare|vs|versus|difference between/i, intent: 'comparison' },
    { pattern: /trend|trending|over time|progression/i, intent: 'trend_analysis' },
    { pattern: /unusual|anomal|spike|drop|sudden/i, intent: 'anomaly_detection' },
    { pattern: /recommend|suggest|should I|what should/i, intent: 'recommendation_request' },
    { pattern: /what if|if I|simulate|would happen/i, intent: 'what_if' },
    { pattern: /why|explain|reason|cause/i, intent: 'explanation' },
    { pattern: /top \d+|best|highest|most/i, intent: 'top_n' },
    { pattern: /bottom \d+|worst|lowest|least/i, intent: 'bottom_n' },
    { pattern: /health|status|issue|problem/i, intent: 'health_check' }
];

// Metric keywords
const METRIC_KEYWORDS: Record<string, string[]> = {
    'spend': ['spend', 'spending', 'cost', 'budget', 'spent'],
    'impressions': ['impressions', 'views', 'eyeballs'],
    'clicks': ['clicks', 'click'],
    'conversions': ['conversions', 'conversion', 'converts', 'purchases', 'sales', 'leads'],
    'ctr': ['ctr', 'click rate', 'click-through', 'clickthrough'],
    'cpm': ['cpm', 'cost per thousand', 'cost per mille'],
    'cpc': ['cpc', 'cost per click'],
    'cpa': ['cpa', 'cost per acquisition', 'cost per conversion', 'cost per lead', 'cost per purchase'],
    'roas': ['roas', 'return on ad spend', 'return on spend'],
    'reach': ['reach', 'people reached'],
    'frequency': ['frequency', 'times shown']
};

// Time period keywords
const TIME_PATTERNS: Array<{ pattern: RegExp; period: TimeRange['relativePeriod'] }> = [
    { pattern: /today/i, period: 'today' },
    { pattern: /yesterday/i, period: 'yesterday' },
    { pattern: /last 7 days|past week|this week/i, period: 'last_7_days' },
    { pattern: /last 30 days|past month/i, period: 'last_30_days' },
    { pattern: /this month/i, period: 'this_month' },
    { pattern: /last month/i, period: 'last_month' },
    { pattern: /this quarter/i, period: 'this_quarter' },
    { pattern: /last quarter/i, period: 'last_quarter' }
];

/**
 * Parse a natural language query
 */
export function parseNaturalQuery(query: string): NLQuery {
    const intent = detectIntent(query);
    const entities = extractEntities(query);
    const timeRange = extractTimeRange(query);
    const metrics = extractMetrics(query);
    const filters = extractFilters(query);

    // Calculate confidence based on how many elements we could parse
    let confidence = 0.5;
    if (intent !== 'unknown') confidence += 0.2;
    if (metrics.length > 0) confidence += 0.15;
    if (timeRange.relativePeriod || timeRange.start) confidence += 0.1;
    if (Object.values(entities).some(v => v && v.length > 0)) confidence += 0.05;

    return {
        original: query,
        intent,
        entities,
        timeRange,
        metrics,
        filters,
        confidence: Math.min(0.95, confidence)
    };
}

function detectIntent(query: string): QueryIntent {
    for (const { pattern, intent } of INTENT_PATTERNS) {
        if (pattern.test(query)) {
            return intent;
        }
    }
    return 'unknown';
}

function extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Look for entity type mentions
    if (/campaigns?/i.test(query)) {
        entities.entityType = 'campaign';
    } else if (/ad ?sets?/i.test(query)) {
        entities.entityType = 'adset';
    } else if (/\bads?\b/i.test(query)) {
        entities.entityType = 'ad';
    } else if (/account/i.test(query)) {
        entities.entityType = 'account';
    }

    // Extract quoted names
    const quotedNames = query.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedNames) {
        const names = quotedNames.map(n => n.replace(/['"]/g, ''));
        if (entities.entityType === 'campaign') {
            entities.campaigns = names;
        } else if (entities.entityType === 'adset') {
            entities.adsets = names;
        } else if (entities.entityType === 'ad') {
            entities.ads = names;
        }
    }

    return entities;
}

function extractTimeRange(query: string): TimeRange {
    for (const { pattern, period } of TIME_PATTERNS) {
        if (pattern.test(query)) {
            return { type: 'relative', relativePeriod: period };
        }
    }

    // Check for date patterns (YYYY-MM-DD or MM/DD/YYYY)
    const dateMatches = query.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/g);
    if (dateMatches && dateMatches.length >= 2) {
        return {
            type: 'absolute',
            start: dateMatches[0],
            end: dateMatches[1]
        };
    } else if (dateMatches && dateMatches.length === 1) {
        return {
            type: 'absolute',
            start: dateMatches[0],
            end: dateMatches[0]
        };
    }

    // Default to last 7 days
    return { type: 'relative', relativePeriod: 'last_7_days' };
}

function extractMetrics(query: string): string[] {
    const foundMetrics: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [metric, keywords] of Object.entries(METRIC_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerQuery.includes(keyword)) {
                if (!foundMetrics.includes(metric)) {
                    foundMetrics.push(metric);
                }
                break;
            }
        }
    }

    // If no specific metrics found, infer from intent
    if (foundMetrics.length === 0) {
        const intent = detectIntent(query);
        if (intent === 'performance_summary') {
            return ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpa'];
        }
    }

    return foundMetrics;
}

function extractFilters(query: string): QueryFilter[] {
    const filters: QueryFilter[] = [];
    const lowerQuery = query.toLowerCase();

    // Look for comparison patterns
    const greaterThan = query.match(/(spend|cpa|cpm|cpc|roas).*(greater than|above|more than|over|>)\s*(\$?\d+(?:\.\d+)?)/i);
    if (greaterThan) {
        filters.push({
            field: greaterThan[1].toLowerCase(),
            operator: 'gt',
            value: parseFloat(greaterThan[3].replace('$', ''))
        });
    }

    const lessThan = query.match(/(spend|cpa|cpm|cpc|roas).*(less than|below|under|<)\s*(\$?\d+(?:\.\d+)?)/i);
    if (lessThan) {
        filters.push({
            field: lessThan[1].toLowerCase(),
            operator: 'lt',
            value: parseFloat(lessThan[3].replace('$', ''))
        });
    }

    // Status filters
    if (lowerQuery.includes('active')) {
        filters.push({ field: 'status', operator: 'eq', value: 'ACTIVE' });
    } else if (lowerQuery.includes('paused')) {
        filters.push({ field: 'status', operator: 'eq', value: 'PAUSED' });
    }

    return filters;
}

/**
 * Generate a natural language summary from query results
 */
export function generateSummary(params: {
    query: NLQuery;
    results: Record<string, unknown>[];
    aggregates?: Record<string, number>;
}): string {
    const { query, results, aggregates } = params;

    if (results.length === 0) {
        return `No data found for your query about ${query.entities.entityType || 'ads'} in the ${query.timeRange.relativePeriod || 'specified period'}.`;
    }

    let summary = '';

    switch (query.intent) {
        case 'performance_summary':
            if (aggregates) {
                const parts: string[] = [];
                if (aggregates.spend) parts.push(`spent $${aggregates.spend.toLocaleString()}`);
                if (aggregates.impressions) parts.push(`${aggregates.impressions.toLocaleString()} impressions`);
                if (aggregates.clicks) parts.push(`${aggregates.clicks.toLocaleString()} clicks`);
                if (aggregates.conversions) parts.push(`${aggregates.conversions.toLocaleString()} conversions`);
                summary = `In the ${query.timeRange.relativePeriod || 'selected period'}, your ${query.entities.entityType || 'account'} ${parts.join(', ')}.`;
            }
            break;

        case 'top_n':
        case 'bottom_n':
            const direction = query.intent === 'top_n' ? 'top' : 'bottom';
            summary = `Here are the ${direction} ${results.length} ${query.entities.entityType || 'items'} by ${query.metrics[0] || 'performance'}:`;
            break;

        case 'trend_analysis':
            summary = `Here's the ${query.metrics[0] || 'performance'} trend for the ${query.timeRange.relativePeriod || 'selected period'}:`;
            break;

        case 'comparison':
            summary = `Comparison results for the requested ${query.entities.entityType || 'entities'}:`;
            break;

        default:
            summary = `Found ${results.length} ${query.entities.entityType || 'items'} matching your query.`;
    }

    return summary;
}

/**
 * Suggest follow-up questions based on query and results
 */
export function suggestFollowups(query: NLQuery): string[] {
    const suggestions: string[] = [];
    const entityType = query.entities.entityType || 'campaigns';

    switch (query.intent) {
        case 'performance_summary':
            suggestions.push(`What are the top performing ${entityType}?`);
            suggestions.push(`Are there any anomalies in the data?`);
            suggestions.push(`What recommendations do you have?`);
            break;

        case 'top_n':
            suggestions.push(`Why is this the top performer?`);
            suggestions.push(`What can I do to improve the others?`);
            break;

        case 'anomaly_detection':
            suggestions.push(`What caused this anomaly?`);
            suggestions.push(`How can I fix this issue?`);
            break;

        default:
            suggestions.push(`Show me performance summary`);
            suggestions.push(`What needs my attention?`);
    }

    return suggestions.slice(0, 3);
}

/**
 * Convert structured query to SQL-like filter conditions
 */
export function queryToFilters(query: NLQuery): {
    where: Record<string, unknown>;
    orderBy?: { field: string; direction: 'asc' | 'desc' };
    limit?: number;
} {
    const where: Record<string, unknown> = {};

    // Add entity filters
    if (query.entities.campaigns?.length) {
        where.campaign_name = { in: query.entities.campaigns };
    }
    if (query.entities.adsets?.length) {
        where.adset_name = { in: query.entities.adsets };
    }
    if (query.entities.ads?.length) {
        where.ad_name = { in: query.entities.ads };
    }

    // Add parsed filters
    for (const filter of query.filters) {
        where[filter.field] = { [filter.operator]: filter.value };
    }

    // Determine ordering
    let orderBy: { field: string; direction: 'asc' | 'desc' } | undefined;
    if (query.intent === 'top_n' && query.metrics.length > 0) {
        orderBy = { field: query.metrics[0], direction: 'desc' };
    } else if (query.intent === 'bottom_n' && query.metrics.length > 0) {
        orderBy = { field: query.metrics[0], direction: 'asc' };
    }

    // Extract limit from query (e.g., "top 5")
    let limit: number | undefined;
    const limitMatch = query.original.match(/(top|bottom)\s+(\d+)/i);
    if (limitMatch) {
        limit = parseInt(limitMatch[2]);
    }

    return { where, orderBy, limit };
}
