/**
 * Creative Fatigue Detection Module
 * 
 * Detects creative fatigue using:
 * - Performance decay curves
 * - Exposure saturation analysis
 * - Slope analysis on key metrics
 */

export interface FatigueMetrics {
    date: string;
    impressions: number;
    frequency: number;
    ctr: number;
    cvr: number;
    cpa: number;
    cumulativeImpressions: number;
}

export interface FatigueAlert {
    alertType: 'fatigue_warning' | 'fatigue_critical' | 'refresh_needed' | 'saturation_risk';
    severity: number;          // 0-1
    detectionMethod: string;
    message: string;
    metrics: {
        ctrDeclinePct: number;
        frequencyAtDetection: number;
        daysRunning: number;
        saturationIndex: number;
    };
    recommendations: string[];
}

export interface FatigueAnalysis {
    creativeId: string;
    isFatigued: boolean;
    fatigueScore: number;      // 0-1 (higher = more fatigued)
    alerts: FatigueAlert[];
    metrics: {
        currentCtr: number;
        peakCtr: number;
        ctrDecline: number;
        currentFrequency: number;
        saturationIndex: number;
        daysRunning: number;
        totalImpressions: number;
    };
    trend: 'declining' | 'stable' | 'improving';
    daysUntilCritical?: number;
}

// Thresholds for fatigue detection
const FATIGUE_THRESHOLDS = {
    ctrDeclineWarning: 0.15,       // 15% decline triggers warning
    ctrDeclineCritical: 0.30,      // 30% decline triggers critical
    frequencyHigh: 3.0,            // High frequency threshold
    frequencyCritical: 5.0,        // Critical frequency
    saturationWarning: 0.7,        // 70% saturation
    saturationCritical: 0.9,       // 90% saturation
    minDaysForAnalysis: 3,         // Minimum days before analysis
    slopeThreshold: -0.02          // Negative slope per day
};

/**
 * Calculate cumulative impressions over time
 */
function calculateCumulativeImpressions(metrics: FatigueMetrics[]): FatigueMetrics[] {
    let cumulative = 0;
    return metrics.map(m => {
        cumulative += m.impressions;
        return { ...m, cumulativeImpressions: cumulative };
    });
}

/**
 * Calculate CTR decay rate using linear regression
 */
export function calculateCtrDecayRate(metrics: FatigueMetrics[]): {
    slope: number;
    rSquared: number;
    declinePerDay: number;
} {
    if (metrics.length < 3) {
        return { slope: 0, rSquared: 0, declinePerDay: 0 };
    }

    // Simple linear regression on CTR over time
    const n = metrics.length;
    const xValues = metrics.map((_, i) => i);
    const yValues = metrics.map(m => m.ctr);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // R-squared calculation
    const meanY = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
        const predicted = meanY + slope * (i - (n - 1) / 2);
        return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    return {
        slope,
        rSquared: Math.max(0, rSquared),
        declinePerDay: slope
    };
}

/**
 * Calculate saturation index based on frequency and impressions
 */
export function calculateSaturationIndex(params: {
    currentFrequency: number;
    totalImpressions: number;
    estimatedAudienceSize: number;
    daysRunning: number;
}): number {
    const { currentFrequency, totalImpressions, estimatedAudienceSize, daysRunning } = params;

    // Frequency-based saturation (0-1)
    const frequencySaturation = Math.min(1, currentFrequency / FATIGUE_THRESHOLDS.frequencyCritical);

    // Impression coverage saturation
    const coverageRatio = totalImpressions / (estimatedAudienceSize * 3); // Assume 3x for saturation
    const coverageSaturation = Math.min(1, coverageRatio);

    // Time decay factor (longer running = more saturated)
    const timeDecay = Math.min(1, daysRunning / 30);

    // Weighted combination
    return (frequencySaturation * 0.5) + (coverageSaturation * 0.3) + (timeDecay * 0.2);
}

/**
 * Detect fatigue alerts based on metrics
 */
export function detectFatigueAlerts(params: {
    metrics: FatigueMetrics[];
    peakCtr: number;
    currentCtr: number;
    currentFrequency: number;
    saturationIndex: number;
    daysRunning: number;
}): FatigueAlert[] {
    const alerts: FatigueAlert[] = [];
    const { metrics, peakCtr, currentCtr, currentFrequency, saturationIndex, daysRunning } = params;

    // CTR decline check
    const ctrDecline = peakCtr > 0 ? (peakCtr - currentCtr) / peakCtr : 0;

    if (ctrDecline >= FATIGUE_THRESHOLDS.ctrDeclineCritical) {
        alerts.push({
            alertType: 'fatigue_critical',
            severity: 0.9,
            detectionMethod: 'decay_curve',
            message: `CTR has declined ${(ctrDecline * 100).toFixed(1)}% from peak - creative fatigue is severe`,
            metrics: {
                ctrDeclinePct: ctrDecline * 100,
                frequencyAtDetection: currentFrequency,
                daysRunning,
                saturationIndex
            },
            recommendations: [
                'Replace creative immediately',
                'Consider pausing ad to preserve budget',
                'Test new creative variations'
            ]
        });
    } else if (ctrDecline >= FATIGUE_THRESHOLDS.ctrDeclineWarning) {
        alerts.push({
            alertType: 'fatigue_warning',
            severity: 0.6,
            detectionMethod: 'decay_curve',
            message: `CTR has declined ${(ctrDecline * 100).toFixed(1)}% from peak - early fatigue signs`,
            metrics: {
                ctrDeclinePct: ctrDecline * 100,
                frequencyAtDetection: currentFrequency,
                daysRunning,
                saturationIndex
            },
            recommendations: [
                'Prepare replacement creative',
                'Consider audience expansion',
                'Monitor performance closely'
            ]
        });
    }

    // Frequency check
    if (currentFrequency >= FATIGUE_THRESHOLDS.frequencyCritical) {
        alerts.push({
            alertType: 'fatigue_critical',
            severity: 0.85,
            detectionMethod: 'exposure_saturation',
            message: `Frequency is ${currentFrequency.toFixed(1)} - audience is over-exposed`,
            metrics: {
                ctrDeclinePct: ctrDecline * 100,
                frequencyAtDetection: currentFrequency,
                daysRunning,
                saturationIndex
            },
            recommendations: [
                'Expand audience targeting',
                'Reduce budget to lower frequency',
                'Rotate to fresh creative'
            ]
        });
    } else if (currentFrequency >= FATIGUE_THRESHOLDS.frequencyHigh) {
        alerts.push({
            alertType: 'fatigue_warning',
            severity: 0.5,
            detectionMethod: 'exposure_saturation',
            message: `Frequency is ${currentFrequency.toFixed(1)} - approaching saturation`,
            metrics: {
                ctrDeclinePct: ctrDecline * 100,
                frequencyAtDetection: currentFrequency,
                daysRunning,
                saturationIndex
            },
            recommendations: [
                'Consider audience expansion',
                'Monitor for engagement drops'
            ]
        });
    }

    // Saturation check
    if (saturationIndex >= FATIGUE_THRESHOLDS.saturationCritical) {
        alerts.push({
            alertType: 'saturation_risk',
            severity: 0.8,
            detectionMethod: 'saturation_analysis',
            message: `Saturation index at ${(saturationIndex * 100).toFixed(0)}% - audience exhausted`,
            metrics: {
                ctrDeclinePct: ctrDecline * 100,
                frequencyAtDetection: currentFrequency,
                daysRunning,
                saturationIndex
            },
            recommendations: [
                'Expand to new audiences',
                'Create fresh creative angles',
                'Consider lookalike expansion'
            ]
        });
    }

    // Slope analysis
    const decay = calculateCtrDecayRate(metrics);
    if (decay.slope < FATIGUE_THRESHOLDS.slopeThreshold && decay.rSquared > 0.5) {
        alerts.push({
            alertType: 'refresh_needed',
            severity: 0.7,
            detectionMethod: 'slope_analysis',
            message: `Consistent CTR decline of ${(Math.abs(decay.slope) * 100).toFixed(2)}% per day`,
            metrics: {
                ctrDeclinePct: ctrDecline * 100,
                frequencyAtDetection: currentFrequency,
                daysRunning,
                saturationIndex
            },
            recommendations: [
                'Refresh creative within 3-5 days',
                'Test new hook variations',
                'A/B test creative elements'
            ]
        });
    }

    return alerts;
}

/**
 * Full fatigue analysis for a creative
 */
export function analyzeCreativeFatigue(params: {
    creativeId: string;
    dailyMetrics: FatigueMetrics[];
    estimatedAudienceSize?: number;
}): FatigueAnalysis {
    const { creativeId, dailyMetrics, estimatedAudienceSize = 100000 } = params;

    if (dailyMetrics.length < FATIGUE_THRESHOLDS.minDaysForAnalysis) {
        return {
            creativeId,
            isFatigued: false,
            fatigueScore: 0,
            alerts: [],
            metrics: {
                currentCtr: dailyMetrics[dailyMetrics.length - 1]?.ctr || 0,
                peakCtr: 0,
                ctrDecline: 0,
                currentFrequency: dailyMetrics[dailyMetrics.length - 1]?.frequency || 0,
                saturationIndex: 0,
                daysRunning: dailyMetrics.length,
                totalImpressions: dailyMetrics.reduce((sum, m) => sum + m.impressions, 0)
            },
            trend: 'stable'
        };
    }

    // Calculate metrics
    const metricsWithCumulative = calculateCumulativeImpressions(dailyMetrics);
    const peakCtr = Math.max(...dailyMetrics.map(m => m.ctr));
    const currentCtr = dailyMetrics[dailyMetrics.length - 1].ctr;
    const currentFrequency = dailyMetrics[dailyMetrics.length - 1].frequency;
    const totalImpressions = metricsWithCumulative[metricsWithCumulative.length - 1].cumulativeImpressions;
    const daysRunning = dailyMetrics.length;

    const saturationIndex = calculateSaturationIndex({
        currentFrequency,
        totalImpressions,
        estimatedAudienceSize,
        daysRunning
    });

    const ctrDecline = peakCtr > 0 ? (peakCtr - currentCtr) / peakCtr : 0;

    // Detect alerts
    const alerts = detectFatigueAlerts({
        metrics: dailyMetrics,
        peakCtr,
        currentCtr,
        currentFrequency,
        saturationIndex,
        daysRunning
    });

    // Calculate overall fatigue score
    const fatigueScore = Math.min(1, (
        (ctrDecline * 0.4) +
        (saturationIndex * 0.3) +
        (Math.min(1, currentFrequency / FATIGUE_THRESHOLDS.frequencyCritical) * 0.3)
    ));

    // Determine trend
    const decay = calculateCtrDecayRate(dailyMetrics);
    let trend: 'declining' | 'stable' | 'improving';
    if (decay.slope < -0.01) trend = 'declining';
    else if (decay.slope > 0.01) trend = 'improving';
    else trend = 'stable';

    // Estimate days until critical
    let daysUntilCritical: number | undefined;
    if (trend === 'declining' && decay.slope < 0) {
        const ctrToLose = currentCtr * (FATIGUE_THRESHOLDS.ctrDeclineCritical - ctrDecline);
        daysUntilCritical = Math.ceil(Math.abs(ctrToLose / decay.slope));
    }

    return {
        creativeId,
        isFatigued: fatigueScore > 0.5 || alerts.some(a => a.alertType === 'fatigue_critical'),
        fatigueScore,
        alerts,
        metrics: {
            currentCtr,
            peakCtr,
            ctrDecline,
            currentFrequency,
            saturationIndex,
            daysRunning,
            totalImpressions
        },
        trend,
        daysUntilCritical
    };
}
