/**
 * Athena Anomaly Detection Engine
 * Detects KPI spikes, drops, tracking breaks, and creative fatigue
 */

export interface AnomalyConfig {
    metric: string;
    displayName: string;
    baselineDays: number;
    seasonality: 'none' | 'daily' | 'weekly';
    thresholds: {
        low: number;      // % deviation for low severity
        medium: number;
        high: number;
        critical: number;
    };
    direction: 'both' | 'increase' | 'decrease';
}

export interface DetectedAnomaly {
    anomaly_type: string;
    entity_type: string;
    entity_id: string;
    entity_name?: string;
    metric_name: string;
    expected_value: number;
    actual_value: number;
    deviation_pct: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    baseline_json: {
        mean: number;
        stddev: number;
        sample_size: number;
        seasonality_factor?: number;
    };
    context_json: {
        trend: 'increasing' | 'decreasing' | 'stable';
        recent_changes?: string[];
    };
    detected_at: string;
}

// Anomaly detection configurations
const ANOMALY_CONFIGS: AnomalyConfig[] = [
    {
        metric: 'spend',
        displayName: 'Ad Spend',
        baselineDays: 14,
        seasonality: 'weekly',
        thresholds: { low: 30, medium: 50, high: 100, critical: 200 },
        direction: 'increase'
    },
    {
        metric: 'cpa',
        displayName: 'Cost per Acquisition',
        baselineDays: 14,
        seasonality: 'weekly',
        thresholds: { low: 20, medium: 40, high: 80, critical: 150 },
        direction: 'increase'
    },
    {
        metric: 'roas',
        displayName: 'Return on Ad Spend',
        baselineDays: 14,
        seasonality: 'weekly',
        thresholds: { low: 20, medium: 35, high: 50, critical: 70 },
        direction: 'decrease'
    },
    {
        metric: 'ctr',
        displayName: 'Click-through Rate',
        baselineDays: 7,
        seasonality: 'daily',
        thresholds: { low: 25, medium: 40, high: 60, critical: 80 },
        direction: 'decrease'
    },
    {
        metric: 'cvr',
        displayName: 'Conversion Rate',
        baselineDays: 7,
        seasonality: 'daily',
        thresholds: { low: 20, medium: 35, high: 50, critical: 75 },
        direction: 'decrease'
    },
    {
        metric: 'conversions',
        displayName: 'Conversions',
        baselineDays: 7,
        seasonality: 'daily',
        thresholds: { low: 30, medium: 50, high: 70, critical: 90 },
        direction: 'decrease' // Tracking break detection
    }
];

// Day of week weights for seasonality
const DOW_WEIGHTS = {
    0: 0.7,  // Sunday
    1: 1.0,  // Monday
    2: 1.1,  // Tuesday
    3: 1.1,  // Wednesday
    4: 1.0,  // Thursday
    5: 0.9,  // Friday
    6: 0.8   // Saturday
};

/**
 * Calculate baseline with seasonality adjustment
 */
function calculateBaseline(
    historicalValues: number[],
    seasonality: 'none' | 'daily' | 'weekly'
): { mean: number; stddev: number; sample_size: number; seasonality_factor: number } {
    if (historicalValues.length === 0) {
        return { mean: 0, stddev: 0, sample_size: 0, seasonality_factor: 1 };
    }

    // Calculate mean
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;

    // Calculate standard deviation
    const squaredDiffs = historicalValues.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stddev = Math.sqrt(avgSquaredDiff);

    // Get seasonality factor (day of week adjustment)
    const today = new Date().getDay();
    const seasonalityFactor = seasonality === 'weekly'
        ? DOW_WEIGHTS[today as keyof typeof DOW_WEIGHTS]
        : 1;

    return {
        mean,
        stddev,
        sample_size: historicalValues.length,
        seasonality_factor: seasonalityFactor
    };
}

/**
 * Determine severity based on deviation and thresholds
 */
function determineSeverity(
    deviationPct: number,
    thresholds: AnomalyConfig['thresholds']
): 'low' | 'medium' | 'high' | 'critical' | null {
    const absDeviation = Math.abs(deviationPct);

    if (absDeviation >= thresholds.critical) return 'critical';
    if (absDeviation >= thresholds.high) return 'high';
    if (absDeviation >= thresholds.medium) return 'medium';
    if (absDeviation >= thresholds.low) return 'low';

    return null;
}

/**
 * Detect trend from recent values
 */
function detectTrend(recentValues: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (recentValues.length < 3) return 'stable';

    const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
    const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePct = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePct > 10) return 'increasing';
    if (changePct < -10) return 'decreasing';
    return 'stable';
}

/**
 * Detect anomalies for a single entity
 */
export function detectEntityAnomalies(
    entityId: string,
    entityType: string,
    entityName: string | undefined,
    currentMetrics: Record<string, number>,
    historicalMetrics: Record<string, number[]>
): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const now = new Date().toISOString();

    for (const config of ANOMALY_CONFIGS) {
        const currentValue = currentMetrics[config.metric];
        const historicalValues = historicalMetrics[config.metric] || [];

        // Skip if no data
        if (currentValue === undefined || historicalValues.length < 3) {
            continue;
        }

        // Calculate baseline
        const baseline = calculateBaseline(historicalValues, config.seasonality);

        if (baseline.mean === 0) continue;

        // Apply seasonality adjustment
        const adjustedExpected = baseline.mean * baseline.seasonality_factor;

        // Calculate deviation
        const deviation = ((currentValue - adjustedExpected) / adjustedExpected) * 100;

        // Check direction
        const isAnomalous =
            config.direction === 'both' ? true :
                config.direction === 'increase' ? deviation > 0 :
                    deviation < 0;

        if (!isAnomalous) continue;

        // Determine severity
        const severity = determineSeverity(deviation, config.thresholds);

        if (severity) {
            const anomalyType = deviation > 0
                ? `${config.metric}_spike`
                : `${config.metric}_drop`;

            // Special case: conversion drop = potential tracking break
            const finalType = config.metric === 'conversions' && deviation < -50
                ? 'tracking_break'
                : anomalyType;

            anomalies.push({
                anomaly_type: finalType,
                entity_type: entityType,
                entity_id: entityId,
                entity_name: entityName,
                metric_name: config.metric,
                expected_value: adjustedExpected,
                actual_value: currentValue,
                deviation_pct: deviation,
                severity,
                baseline_json: baseline,
                context_json: {
                    trend: detectTrend(historicalValues)
                },
                detected_at: now
            });
        }
    }

    return anomalies;
}

/**
 * Detect creative fatigue
 * CTR declining over time while impressions remain stable
 */
export function detectCreativeFatigue(
    entityId: string,
    entityName: string | undefined,
    ctrHistory: number[],
    impressionsHistory: number[]
): DetectedAnomaly | null {
    if (ctrHistory.length < 7 || impressionsHistory.length < 7) {
        return null;
    }

    // Check if CTR is declining
    const ctrTrend = detectTrend(ctrHistory);
    const impressionsTrend = detectTrend(impressionsHistory);

    // Creative fatigue: CTR declining while impressions stable or increasing
    if (ctrTrend === 'decreasing' && impressionsTrend !== 'decreasing') {
        const recentCtr = ctrHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const earlierCtr = ctrHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const decline = ((recentCtr - earlierCtr) / earlierCtr) * 100;

        if (decline < -20) {
            return {
                anomaly_type: 'creative_fatigue',
                entity_type: 'ad',
                entity_id: entityId,
                entity_name: entityName,
                metric_name: 'ctr',
                expected_value: earlierCtr,
                actual_value: recentCtr,
                deviation_pct: decline,
                severity: decline < -40 ? 'high' : 'medium',
                baseline_json: {
                    mean: earlierCtr,
                    stddev: 0,
                    sample_size: ctrHistory.length,
                    seasonality_factor: 1
                },
                context_json: {
                    trend: 'decreasing',
                    recent_changes: ['CTR declining while impressions stable - possible audience fatigue']
                },
                detected_at: new Date().toISOString()
            };
        }
    }

    return null;
}

/**
 * Run anomaly detection for all ads in storage
 */
export async function runAnomalyDetection(orgId: string): Promise<DetectedAnomaly[]> {
    const allAnomalies: DetectedAnomaly[] = [];

    try {
        // Get ads from local storage (in production, fetch from API)
        const ads = JSON.parse(localStorage?.getItem('ads') || '[]');

        for (const ad of ads) {
            // Build historical data (mock - in production use real time series)
            const currentMetrics = {
                spend: ad.spend || 0,
                cpa: ad.cpa || 0,
                roas: ad.roas || 0,
                ctr: ad.ctr || 0,
                cvr: ad.cvr || 0,
                conversions: ad.conversions || 0
            };

            // Mock historical (would come from time series data)
            const historicalMetrics: Record<string, number[]> = {
                spend: Array(14).fill(null).map(() => (ad.spend || 0) * (0.8 + Math.random() * 0.4)),
                cpa: Array(14).fill(null).map(() => (ad.cpa || 0) * (0.8 + Math.random() * 0.4)),
                roas: Array(14).fill(null).map(() => (ad.roas || 0) * (0.8 + Math.random() * 0.4)),
                ctr: Array(7).fill(null).map(() => (ad.ctr || 0) * (0.8 + Math.random() * 0.4)),
                cvr: Array(7).fill(null).map(() => (ad.cvr || 0) * (0.8 + Math.random() * 0.4)),
                conversions: Array(7).fill(null).map(() => (ad.conversions || 0) * (0.8 + Math.random() * 0.4))
            };

            // Detect anomalies for this entity
            const entityAnomalies = detectEntityAnomalies(
                ad.id,
                'ad',
                ad.name,
                currentMetrics,
                historicalMetrics
            );

            allAnomalies.push(...entityAnomalies);

            // Also check for creative fatigue
            const fatigue = detectCreativeFatigue(
                ad.id,
                ad.name,
                historicalMetrics.ctr,
                Array(7).fill(ad.impressions || 1000)
            );

            if (fatigue) {
                allAnomalies.push(fatigue);
            }
        }

        // Sort by severity (critical first)
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        allAnomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return allAnomalies;

    } catch (error) {
        console.error('Anomaly detection error:', error);
        return [];
    }
}

export default {
    detectEntityAnomalies,
    detectCreativeFatigue,
    runAnomalyDetection,
    ANOMALY_CONFIGS
};
