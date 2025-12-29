/**
 * Forecasting and What-If Simulation Module
 * 
 * Provides forecasting for:
 * - Spend, CPA, ROAS, volume projections
 * - Confidence bands
 * - What-if scenario simulations
 */

export interface ForecastPoint {
    date: string;
    value: number;
    lowerBound: number;
    upperBound: number;
}

export interface Forecast {
    entityId: string;
    metric: string;
    horizonDays: number;
    predictions: ForecastPoint[];
    modelType: 'linear' | 'exponential' | 'moving_average' | 'arima_simple';
    quality: {
        mape: number;           // Mean Absolute Percentage Error
        rmse: number;           // Root Mean Square Error
        confidence: number;     // Overall confidence
    };
    generated_at: string;
}

export interface WhatIfScenario {
    interventions: Array<{
        variable: string;
        changeType: 'set' | 'increase_pct' | 'decrease_pct' | 'increase_abs' | 'decrease_abs';
        value: number;
    }>;
    baselineMetrics: Record<string, number>;
    simulatedMetrics: Record<string, number>;
    confidenceIntervals: Record<string, [number, number]>;
    assumptions: string[];
    limitations: string[];
}

export interface HistoricalDataPoint {
    date: string;
    value: number;
}

/**
 * Simple linear regression for forecasting
 */
function linearRegression(data: HistoricalDataPoint[]): {
    slope: number;
    intercept: number;
    rSquared: number;
} {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: data[0]?.value || 0, rSquared: 0 };

    const xValues = data.map((_, i) => i);
    const yValues = data.map(d => d.value);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const meanY = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
        const predicted = intercept + slope * i;
        return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { slope, intercept, rSquared: Math.max(0, rSquared) };
}

/**
 * Calculate prediction error (MAPE)
 */
function calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length === 0) return 0;

    let totalError = 0;
    let count = 0;

    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== 0) {
            totalError += Math.abs((actual[i] - predicted[i]) / actual[i]);
            count++;
        }
    }

    return count > 0 ? totalError / count : 0;
}

/**
 * Calculate RMSE
 */
function calculateRMSE(actual: number[], predicted: number[]): number {
    if (actual.length === 0) return 0;

    const mse = actual.reduce((sum, val, i) => {
        return sum + Math.pow(val - predicted[i], 2);
    }, 0) / actual.length;

    return Math.sqrt(mse);
}

/**
 * Moving average forecast
 */
function movingAverageForecast(data: HistoricalDataPoint[], window: number = 7): number {
    if (data.length < window) {
        return data.reduce((sum, d) => sum + d.value, 0) / data.length;
    }

    const recent = data.slice(-window);
    return recent.reduce((sum, d) => sum + d.value, 0) / window;
}

/**
 * Calculate confidence interval width based on variance
 */
function calculateConfidenceWidth(data: HistoricalDataPoint[], daysAhead: number): number {
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Widen confidence interval for further-out predictions
    const uncertaintyFactor = 1 + (daysAhead * 0.05);

    return stdDev * 1.96 * uncertaintyFactor; // 95% confidence
}

/**
 * Generate forecast for a metric
 */
export function generateForecast(params: {
    entityId: string;
    metric: string;
    historicalData: HistoricalDataPoint[];
    horizonDays: number;
    modelType?: 'linear' | 'moving_average' | 'auto';
}): Forecast {
    const { entityId, metric, historicalData, horizonDays, modelType = 'auto' } = params;

    if (historicalData.length < 3) {
        // Insufficient data - return flat forecast
        const lastValue = historicalData[historicalData.length - 1]?.value || 0;
        const predictions: ForecastPoint[] = [];

        for (let i = 1; i <= horizonDays; i++) {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + i);
            predictions.push({
                date: futureDate.toISOString().split('T')[0],
                value: lastValue,
                lowerBound: lastValue * 0.7,
                upperBound: lastValue * 1.3
            });
        }

        return {
            entityId,
            metric,
            horizonDays,
            predictions,
            modelType: 'linear',
            quality: { mape: 0, rmse: 0, confidence: 0.3 },
            generated_at: new Date().toISOString()
        };
    }

    // Determine best model
    let selectedModel: 'linear' | 'moving_average' = 'linear';

    if (modelType === 'auto') {
        const regression = linearRegression(historicalData);
        // If R² is low, use moving average instead
        selectedModel = regression.rSquared > 0.3 ? 'linear' : 'moving_average';
    } else {
        selectedModel = modelType === 'linear' ? 'linear' : 'moving_average';
    }

    const predictions: ForecastPoint[] = [];
    const n = historicalData.length;

    if (selectedModel === 'linear') {
        const { slope, intercept } = linearRegression(historicalData);

        for (let i = 1; i <= horizonDays; i++) {
            const dayIndex = n + i - 1;
            const predicted = intercept + slope * dayIndex;
            const confidenceWidth = calculateConfidenceWidth(historicalData, i);

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + i);

            predictions.push({
                date: futureDate.toISOString().split('T')[0],
                value: Math.max(0, predicted),
                lowerBound: Math.max(0, predicted - confidenceWidth),
                upperBound: predicted + confidenceWidth
            });
        }
    } else {
        const maValue = movingAverageForecast(historicalData, 7);

        for (let i = 1; i <= horizonDays; i++) {
            const confidenceWidth = calculateConfidenceWidth(historicalData, i);

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + i);

            predictions.push({
                date: futureDate.toISOString().split('T')[0],
                value: Math.max(0, maValue),
                lowerBound: Math.max(0, maValue - confidenceWidth),
                upperBound: maValue + confidenceWidth
            });
        }
    }

    // Calculate quality metrics using holdout
    const holdoutSize = Math.min(3, Math.floor(historicalData.length * 0.2));
    const trainData = historicalData.slice(0, -holdoutSize);
    const testData = historicalData.slice(-holdoutSize);

    let mape = 0;
    let rmse = 0;

    if (testData.length > 0) {
        const regression = linearRegression(trainData);
        const predicted = testData.map((_, i) =>
            regression.intercept + regression.slope * (trainData.length + i)
        );
        const actual = testData.map(d => d.value);

        mape = calculateMAPE(actual, predicted);
        rmse = calculateRMSE(actual, predicted);
    }

    // Calculate confidence based on data quality and model fit
    const regression = linearRegression(historicalData);
    const confidence = Math.max(0.2, Math.min(0.95,
        (1 - mape) * 0.4 +
        regression.rSquared * 0.4 +
        Math.min(1, historicalData.length / 30) * 0.2
    ));

    return {
        entityId,
        metric,
        horizonDays,
        predictions,
        modelType: selectedModel,
        quality: {
            mape,
            rmse,
            confidence
        },
        generated_at: new Date().toISOString()
    };
}

/**
 * Run what-if simulation
 */
export function runWhatIfSimulation(params: {
    entityId: string;
    currentMetrics: Record<string, number>;
    interventions: Array<{
        variable: string;
        changeType: 'set' | 'increase_pct' | 'decrease_pct' | 'increase_abs' | 'decrease_abs';
        value: number;
    }>;
    causalEffects?: Record<string, Record<string, number>>; // variable -> affected_metric -> effect_size
}): WhatIfScenario {
    const { currentMetrics, interventions, causalEffects = DEFAULT_CAUSAL_EFFECTS } = params;

    // Start with baseline
    const simulatedMetrics = { ...currentMetrics };
    const confidenceIntervals: Record<string, [number, number]> = {};
    const assumptions: string[] = [];
    const limitations: string[] = [];

    // Apply interventions
    for (const intervention of interventions) {
        const { variable, changeType, value } = intervention;
        const currentValue = currentMetrics[variable] || 0;

        let newValue: number;
        switch (changeType) {
            case 'set':
                newValue = value;
                break;
            case 'increase_pct':
                newValue = currentValue * (1 + value / 100);
                break;
            case 'decrease_pct':
                newValue = currentValue * (1 - value / 100);
                break;
            case 'increase_abs':
                newValue = currentValue + value;
                break;
            case 'decrease_abs':
                newValue = currentValue - value;
                break;
            default:
                newValue = currentValue;
        }

        simulatedMetrics[variable] = newValue;

        // Propagate effects through causal model
        const effects = causalEffects[variable] || {};
        for (const [affectedMetric, effectSize] of Object.entries(effects)) {
            const changePct = (newValue - currentValue) / (currentValue || 1);
            const baseValue = simulatedMetrics[affectedMetric] || currentMetrics[affectedMetric] || 0;

            // Apply effect (positive effect size = positive correlation)
            simulatedMetrics[affectedMetric] = baseValue * (1 + changePct * effectSize);
        }

        assumptions.push(`Change in ${variable} affects downstream metrics proportionally`);
    }

    // Calculate confidence intervals
    for (const [metric, value] of Object.entries(simulatedMetrics)) {
        const uncertainty = Math.abs(value - (currentMetrics[metric] || value)) * 0.3;
        confidenceIntervals[metric] = [
            Math.max(0, value - uncertainty),
            value + uncertainty
        ];
    }

    // Add limitations
    limitations.push('Assumes no external market changes');
    limitations.push('Based on historical causal relationships');
    limitations.push('Does not account for non-linear effects');
    if (interventions.length > 1) {
        limitations.push('Interaction effects between interventions are approximated');
    }

    return {
        interventions,
        baselineMetrics: currentMetrics,
        simulatedMetrics,
        confidenceIntervals,
        assumptions,
        limitations
    };
}

// Default causal effects based on typical ad performance relationships
const DEFAULT_CAUSAL_EFFECTS: Record<string, Record<string, number>> = {
    budget: {
        impressions: 0.9,      // 10% budget increase → ~9% more impressions
        reach: 0.7,            // Diminishing returns on reach
        conversions: 0.5,      // Lower effect due to audience saturation
        cpm: 0.1,              // Slight CPM increase at higher scales
        roas: -0.2             // ROAS typically drops with spend increase
    },
    bid: {
        impressions: 0.6,
        cpm: 0.8,
        reach: 0.5,
        cpa: 0.3
    },
    creative_quality: {
        ctr: 0.7,
        cvr: 0.5,
        cpc: -0.3,
        roas: 0.4
    }
};
