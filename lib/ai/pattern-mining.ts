/**
 * Pattern Mining Module
 * 
 * Mines historical data to discover:
 * - Success patterns (what works)
 * - Failure patterns (what to avoid)
 * - Seasonal patterns
 * - Cross-campaign insights
 */

export interface Pattern {
    id: string;
    type: 'success' | 'failure' | 'seasonal' | 'cross_campaign';
    name: string;
    description: string;
    conditions: PatternCondition[];
    effect: {
        metric: string;
        direction: 'increase' | 'decrease';
        magnitude: number;      // Percentage effect
        confidence: number;
    };
    occurrences: number;
    lastSeen: string;
    applicability: {
        industries?: string[];
        budgetRanges?: [number, number][];
        campaignTypes?: string[];
    };
}

export interface PatternCondition {
    variable: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: string | number | string[] | number[];
}

export interface MinedInsight {
    pattern: Pattern;
    matchScore: number;       // How well current data matches pattern
    recommendation: string;
    expectedOutcome: string;
    evidence: Array<{
        entityId: string;
        entityType: string;
        metricChange: number;
        timestamp: string;
    }>;
}

export interface SeasonalPattern {
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    metric: string;
    peaks: Array<{
        label: string;          // e.g., "Monday", "Q4", "December"
        multiplier: number;     // e.g., 1.3 = 30% above average
        confidence: number;
    }>;
    troughs: Array<{
        label: string;
        multiplier: number;
        confidence: number;
    }>;
}

export interface HistoricalRecord {
    id: string;
    entityId: string;
    entityType: string;
    date: string;
    metrics: Record<string, number>;
    attributes: Record<string, string | number | boolean>;
}

/**
 * Mine success patterns from historical data
 */
export function mineSuccessPatterns(params: {
    historicalRecords: HistoricalRecord[];
    successMetric: string;
    successThreshold: number;
    minOccurrences?: number;
}): Pattern[] {
    const { historicalRecords, successMetric, successThreshold, minOccurrences = 5 } = params;
    const patterns: Pattern[] = [];

    // Find high-performing records
    const successRecords = historicalRecords.filter(r =>
        (r.metrics[successMetric] || 0) >= successThreshold
    );

    if (successRecords.length < minOccurrences) {
        return patterns;
    }

    // Analyze common attributes among successful records
    const attributeFrequency: Record<string, Record<string, number>> = {};

    for (const record of successRecords) {
        for (const [attr, value] of Object.entries(record.attributes)) {
            if (!attributeFrequency[attr]) {
                attributeFrequency[attr] = {};
            }
            const valStr = String(value);
            attributeFrequency[attr][valStr] = (attributeFrequency[attr][valStr] || 0) + 1;
        }
    }

    // Find attributes that appear in >60% of successes
    const totalSuccesses = successRecords.length;

    for (const [attr, valueCounts] of Object.entries(attributeFrequency)) {
        for (const [value, count] of Object.entries(valueCounts)) {
            const frequency = count / totalSuccesses;

            if (frequency >= 0.6 && count >= minOccurrences) {
                // Calculate effect size
                const avgWithAttribute = successRecords
                    .filter(r => String(r.attributes[attr]) === value)
                    .reduce((sum, r) => sum + (r.metrics[successMetric] || 0), 0) / count;

                const avgWithout = historicalRecords
                    .filter(r => String(r.attributes[attr]) !== value)
                    .reduce((sum, r) => sum + (r.metrics[successMetric] || 0), 0) /
                    Math.max(1, historicalRecords.filter(r => String(r.attributes[attr]) !== value).length);

                const effectSize = avgWithout > 0 ? (avgWithAttribute - avgWithout) / avgWithout : 0;

                if (effectSize > 0.1) { // At least 10% improvement
                    patterns.push({
                        id: `success_${attr}_${value}`.replace(/\s+/g, '_').toLowerCase(),
                        type: 'success',
                        name: `High ${successMetric} with ${attr}=${value}`,
                        description: `Records with ${attr} set to "${value}" show ${(effectSize * 100).toFixed(1)}% higher ${successMetric}`,
                        conditions: [{
                            variable: attr,
                            operator: 'eq',
                            value: isNaN(Number(value)) ? value : Number(value)
                        }],
                        effect: {
                            metric: successMetric,
                            direction: 'increase',
                            magnitude: effectSize * 100,
                            confidence: Math.min(0.95, frequency * (count / 10))
                        },
                        occurrences: count,
                        lastSeen: successRecords[0]?.date || new Date().toISOString(),
                        applicability: {}
                    });
                }
            }
        }
    }

    return patterns.sort((a, b) => b.effect.magnitude - a.effect.magnitude);
}

/**
 * Mine failure patterns
 */
export function mineFailurePatterns(params: {
    historicalRecords: HistoricalRecord[];
    failureMetric: string;
    failureThreshold: number;
    minOccurrences?: number;
}): Pattern[] {
    const { historicalRecords, failureMetric, failureThreshold, minOccurrences = 5 } = params;
    const patterns: Pattern[] = [];

    // Find low-performing records
    const failureRecords = historicalRecords.filter(r =>
        (r.metrics[failureMetric] || 0) <= failureThreshold
    );

    if (failureRecords.length < minOccurrences) {
        return patterns;
    }

    // Analyze common attributes among failures
    const attributeFrequency: Record<string, Record<string, number>> = {};

    for (const record of failureRecords) {
        for (const [attr, value] of Object.entries(record.attributes)) {
            if (!attributeFrequency[attr]) {
                attributeFrequency[attr] = {};
            }
            const valStr = String(value);
            attributeFrequency[attr][valStr] = (attributeFrequency[attr][valStr] || 0) + 1;
        }
    }

    const totalFailures = failureRecords.length;

    for (const [attr, valueCounts] of Object.entries(attributeFrequency)) {
        for (const [value, count] of Object.entries(valueCounts)) {
            const frequency = count / totalFailures;

            if (frequency >= 0.5 && count >= minOccurrences) {
                const avgWithAttribute = failureRecords
                    .filter(r => String(r.attributes[attr]) === value)
                    .reduce((sum, r) => sum + (r.metrics[failureMetric] || 0), 0) / count;

                const avgWithout = historicalRecords
                    .filter(r => String(r.attributes[attr]) !== value)
                    .reduce((sum, r) => sum + (r.metrics[failureMetric] || 0), 0) /
                    Math.max(1, historicalRecords.filter(r => String(r.attributes[attr]) !== value).length);

                const effectSize = avgWithout > 0 ? (avgWithout - avgWithAttribute) / avgWithout : 0;

                if (effectSize > 0.1) {
                    patterns.push({
                        id: `failure_${attr}_${value}`.replace(/\s+/g, '_').toLowerCase(),
                        type: 'failure',
                        name: `Low ${failureMetric} with ${attr}=${value}`,
                        description: `Records with ${attr} set to "${value}" show ${(effectSize * 100).toFixed(1)}% lower ${failureMetric}`,
                        conditions: [{
                            variable: attr,
                            operator: 'eq',
                            value: isNaN(Number(value)) ? value : Number(value)
                        }],
                        effect: {
                            metric: failureMetric,
                            direction: 'decrease',
                            magnitude: effectSize * 100,
                            confidence: Math.min(0.9, frequency * (count / 10))
                        },
                        occurrences: count,
                        lastSeen: failureRecords[0]?.date || new Date().toISOString(),
                        applicability: {}
                    });
                }
            }
        }
    }

    return patterns.sort((a, b) => b.effect.magnitude - a.effect.magnitude);
}

/**
 * Detect seasonal patterns
 */
export function detectSeasonalPatterns(params: {
    historicalRecords: HistoricalRecord[];
    metric: string;
    period: 'daily' | 'weekly' | 'monthly';
}): SeasonalPattern | null {
    const { historicalRecords, metric, period } = params;

    if (historicalRecords.length < 14) {
        return null; // Need at least 2 weeks of data
    }

    const groupedData: Record<string, number[]> = {};

    for (const record of historicalRecords) {
        const date = new Date(record.date);
        let key: string;

        switch (period) {
            case 'daily':
                key = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                break;
            case 'weekly':
                key = `Week ${Math.ceil(date.getDate() / 7)}`;
                break;
            case 'monthly':
                key = date.toLocaleString('en-US', { month: 'short' });
                break;
        }

        if (!groupedData[key]) {
            groupedData[key] = [];
        }
        groupedData[key].push(record.metrics[metric] || 0);
    }

    // Calculate averages per period
    const periodAverages: Record<string, number> = {};
    for (const [key, values] of Object.entries(groupedData)) {
        periodAverages[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Overall average
    const allValues = Object.values(groupedData).flat();
    const overallAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;

    if (overallAvg === 0) return null;

    // Find peaks and troughs
    const peaks: SeasonalPattern['peaks'] = [];
    const troughs: SeasonalPattern['troughs'] = [];

    for (const [key, avg] of Object.entries(periodAverages)) {
        const multiplier = avg / overallAvg;
        const sampleSize = groupedData[key].length;
        const confidence = Math.min(0.95, sampleSize / 10);

        if (multiplier >= 1.1) {
            peaks.push({ label: key, multiplier, confidence });
        } else if (multiplier <= 0.9) {
            troughs.push({ label: key, multiplier, confidence });
        }
    }

    if (peaks.length === 0 && troughs.length === 0) {
        return null; // No significant seasonality
    }

    return {
        period,
        metric,
        peaks: peaks.sort((a, b) => b.multiplier - a.multiplier),
        troughs: troughs.sort((a, b) => a.multiplier - b.multiplier)
    };
}

/**
 * Match current context to known patterns
 */
export function matchPatterns(params: {
    patterns: Pattern[];
    currentContext: Record<string, string | number | boolean>;
}): MinedInsight[] {
    const { patterns, currentContext } = params;
    const insights: MinedInsight[] = [];

    for (const pattern of patterns) {
        let matchScore = 0;
        let matchedConditions = 0;

        for (const condition of pattern.conditions) {
            const currentValue = currentContext[condition.variable];

            if (currentValue === undefined) continue;

            let matches = false;
            switch (condition.operator) {
                case 'eq':
                    matches = currentValue === condition.value;
                    break;
                case 'gt':
                    matches = Number(currentValue) > Number(condition.value);
                    break;
                case 'lt':
                    matches = Number(currentValue) < Number(condition.value);
                    break;
                case 'gte':
                    matches = Number(currentValue) >= Number(condition.value);
                    break;
                case 'lte':
                    matches = Number(currentValue) <= Number(condition.value);
                    break;
                case 'in':
                    matches = Array.isArray(condition.value) && condition.value.includes(currentValue as never);
                    break;
                case 'contains':
                    matches = String(currentValue).includes(String(condition.value));
                    break;
            }

            if (matches) {
                matchedConditions++;
            }
        }

        if (pattern.conditions.length > 0) {
            matchScore = matchedConditions / pattern.conditions.length;
        }

        if (matchScore >= 0.5) {
            const rec = pattern.type === 'success'
                ? `Continue using this approach - historical data shows ${pattern.effect.magnitude.toFixed(1)}% improvement in ${pattern.effect.metric}`
                : `Consider changing approach - historical data shows ${pattern.effect.magnitude.toFixed(1)}% decline in ${pattern.effect.metric}`;

            insights.push({
                pattern,
                matchScore,
                recommendation: rec,
                expectedOutcome: `${pattern.effect.direction === 'increase' ? '+' : '-'}${pattern.effect.magnitude.toFixed(1)}% ${pattern.effect.metric}`,
                evidence: []
            });
        }
    }

    return insights.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find cross-campaign insights
 */
export function findCrossCampaignInsights(params: {
    campaigns: Array<{
        id: string;
        name: string;
        attributes: Record<string, string | number>;
        metrics: Record<string, number>;
    }>;
    targetMetric: string;
}): Pattern[] {
    const { campaigns, targetMetric } = params;

    if (campaigns.length < 3) return [];

    // Sort by performance
    const sorted = [...campaigns].sort((a, b) =>
        (b.metrics[targetMetric] || 0) - (a.metrics[targetMetric] || 0)
    );

    const topPerformers = sorted.slice(0, Math.ceil(sorted.length * 0.25));
    const bottomPerformers = sorted.slice(-Math.ceil(sorted.length * 0.25));

    const patterns: Pattern[] = [];

    // Find attributes common in top but not bottom
    const topAttributes: Record<string, Set<string>> = {};
    const bottomAttributes: Record<string, Set<string>> = {};

    for (const campaign of topPerformers) {
        for (const [key, value] of Object.entries(campaign.attributes)) {
            if (!topAttributes[key]) topAttributes[key] = new Set();
            topAttributes[key].add(String(value));
        }
    }

    for (const campaign of bottomPerformers) {
        for (const [key, value] of Object.entries(campaign.attributes)) {
            if (!bottomAttributes[key]) bottomAttributes[key] = new Set();
            bottomAttributes[key].add(String(value));
        }
    }

    for (const [attr, topValues] of Object.entries(topAttributes)) {
        const bottomValues = bottomAttributes[attr] || new Set();

        for (const value of topValues) {
            if (!bottomValues.has(value)) {
                const avgTop = topPerformers.reduce((s, c) => s + (c.metrics[targetMetric] || 0), 0) / topPerformers.length;
                const avgBottom = bottomPerformers.reduce((s, c) => s + (c.metrics[targetMetric] || 0), 0) / bottomPerformers.length;
                const lift = avgBottom > 0 ? (avgTop - avgBottom) / avgBottom : 0;

                if (lift > 0.2) {
                    patterns.push({
                        id: `cross_${attr}_${value}`.replace(/\s+/g, '_').toLowerCase(),
                        type: 'cross_campaign',
                        name: `Top performers use ${attr}=${value}`,
                        description: `High-performing campaigns commonly use ${attr}="${value}" while low performers don't`,
                        conditions: [{ variable: attr, operator: 'eq', value }],
                        effect: {
                            metric: targetMetric,
                            direction: 'increase',
                            magnitude: lift * 100,
                            confidence: Math.min(0.8, topPerformers.length / 5)
                        },
                        occurrences: topPerformers.length,
                        lastSeen: new Date().toISOString(),
                        applicability: {}
                    });
                }
            }
        }
    }

    return patterns;
}
