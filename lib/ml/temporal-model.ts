/**
 * Temporal Modeling Module
 * 
 * Implements LSTM/GRU-based models for time-series ad performance prediction.
 * Captures sequential patterns in ad performance over time.
 * 
 * @module lib/ml/temporal-model
 */

import * as tf from '@tensorflow/tfjs';

// ============================================
// TYPES
// ============================================

export interface TemporalPrediction {
    /** Current prediction */
    current: number;
    /** Predicted trajectory (next N time steps) */
    trajectory: number[];
    /** Trend direction */
    trend: 'rising' | 'falling' | 'stable';
    /** Trend strength (0-100) */
    trendStrength: number;
    /** Seasonality detected */
    seasonality: {
        dayOfWeek: number[];  // Performance by day
        timeOfDay: number[];  // Performance by time
    };
    /** Confidence in trajectory */
    confidence: number;
}

export interface TemporalConfig {
    /** Sequence length for input */
    sequenceLength: number;
    /** Number of hidden units in LSTM */
    lstmUnits: number;
    /** Use GRU instead of LSTM */
    useGRU: boolean;
    /** Number of layers */
    numLayers: number;
    /** Dropout rate */
    dropoutRate: number;
    /** Learning rate */
    learningRate: number;
}

export interface PerformanceSequence {
    /** Timestamp */
    timestamp: string;
    /** Performance metrics */
    metrics: {
        ctr: number;
        cvr: number;
        roas: number;
        engagement: number;
        spend: number;
    };
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_TEMPORAL_CONFIG: TemporalConfig = {
    sequenceLength: 7,  // 7 days of history
    lstmUnits: 32,
    useGRU: false,
    numLayers: 2,
    dropoutRate: 0.2,
    learningRate: 0.001,
};

// ============================================
// SEQUENCE PREPARATION
// ============================================

/**
 * Prepare sequential data for temporal model
 * Converts performance history into sequences
 */
export function prepareSequences(
    history: PerformanceSequence[],
    sequenceLength: number = 7
): { sequences: number[][][]; targets: number[][] } {
    if (history.length < sequenceLength + 1) {
        return { sequences: [], targets: [] };
    }

    const sequences: number[][][] = [];
    const targets: number[][] = [];

    // Extract features from each time step
    const features = history.map(h => [
        h.metrics.ctr / 10,      // Normalize CTR
        h.metrics.cvr / 100,     // Normalize CVR
        h.metrics.roas / 5,      // Normalize ROAS
        h.metrics.engagement / 100,
        Math.log(h.metrics.spend + 1) / 10,  // Log-scale spend
    ]);

    // Create sliding window sequences
    for (let i = 0; i < features.length - sequenceLength; i++) {
        const sequence = features.slice(i, i + sequenceLength);
        const target = features[i + sequenceLength];
        sequences.push(sequence);
        targets.push(target);
    }

    return { sequences, targets };
}

/**
 * Normalize a single sequence for prediction
 */
export function normalizeSequence(
    sequence: PerformanceSequence[]
): number[][] {
    return sequence.map(h => [
        h.metrics.ctr / 10,
        h.metrics.cvr / 100,
        h.metrics.roas / 5,
        h.metrics.engagement / 100,
        Math.log(h.metrics.spend + 1) / 10,
    ]);
}

// ============================================
// TEMPORAL MODEL CREATION
// ============================================

/**
 * Create LSTM/GRU model for temporal prediction
 */
export function createTemporalModel(
    config: Partial<TemporalConfig> = {}
): tf.LayersModel {
    const cfg: TemporalConfig = { ...DEFAULT_TEMPORAL_CONFIG, ...config };
    const numFeatures = 5; // ctr, cvr, roas, engagement, spend

    const model = tf.sequential();

    // First recurrent layer
    if (cfg.useGRU) {
        model.add(tf.layers.gru({
            units: cfg.lstmUnits,
            inputShape: [cfg.sequenceLength, numFeatures],
            returnSequences: cfg.numLayers > 1,
            dropout: cfg.dropoutRate,
            recurrentDropout: cfg.dropoutRate,
            name: 'gru_1',
        }));
    } else {
        model.add(tf.layers.lstm({
            units: cfg.lstmUnits,
            inputShape: [cfg.sequenceLength, numFeatures],
            returnSequences: cfg.numLayers > 1,
            dropout: cfg.dropoutRate,
            recurrentDropout: cfg.dropoutRate,
            name: 'lstm_1',
        }));
    }

    // Additional layers
    for (let i = 1; i < cfg.numLayers; i++) {
        const returnSequences = i < cfg.numLayers - 1;

        if (cfg.useGRU) {
            model.add(tf.layers.gru({
                units: cfg.lstmUnits,
                returnSequences,
                dropout: cfg.dropoutRate,
                recurrentDropout: cfg.dropoutRate,
                name: `gru_${i + 1}`,
            }));
        } else {
            model.add(tf.layers.lstm({
                units: cfg.lstmUnits,
                returnSequences,
                dropout: cfg.dropoutRate,
                recurrentDropout: cfg.dropoutRate,
                name: `lstm_${i + 1}`,
            }));
        }
    }

    // Dense output layer
    model.add(tf.layers.dense({
        units: 16,
        activation: 'relu',
        name: 'dense_1',
    }));

    model.add(tf.layers.dropout({
        rate: cfg.dropoutRate,
        name: 'dropout_1',
    }));

    model.add(tf.layers.dense({
        units: numFeatures,
        activation: 'linear',
        name: 'output',
    }));

    // Compile
    model.compile({
        optimizer: tf.train.adam(cfg.learningRate),
        loss: 'meanSquaredError',
        metrics: ['mse'],
    });

    return model;
}

// ============================================
// TEMPORAL PREDICTION
// ============================================

/**
 * Predict next time step from sequence
 */
export async function predictNextStep(
    model: tf.LayersModel,
    sequence: number[][]
): Promise<number[]> {
    const inputTensor = tf.tensor3d([sequence]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    const values = Array.from(await prediction.data());

    inputTensor.dispose();
    prediction.dispose();

    return values;
}

/**
 * Predict multiple future steps (trajectory)
 */
export async function predictTrajectory(
    model: tf.LayersModel,
    initialSequence: number[][],
    steps: number = 7
): Promise<number[][]> {
    const trajectory: number[][] = [];
    let currentSequence = [...initialSequence];

    for (let i = 0; i < steps; i++) {
        const nextStep = await predictNextStep(model, currentSequence);
        trajectory.push(nextStep);

        // Shift sequence and add new prediction
        currentSequence = [...currentSequence.slice(1), nextStep];
    }

    return trajectory;
}

/**
 * Full temporal prediction with trend analysis
 */
export async function predictTemporal(
    model: tf.LayersModel,
    history: PerformanceSequence[],
    config: Partial<TemporalConfig> = {}
): Promise<TemporalPrediction> {
    const cfg: TemporalConfig = { ...DEFAULT_TEMPORAL_CONFIG, ...config };

    if (history.length < cfg.sequenceLength) {
        // Not enough data, return neutral prediction
        return {
            current: 50,
            trajectory: new Array(7).fill(50),
            trend: 'stable',
            trendStrength: 0,
            seasonality: {
                dayOfWeek: new Array(7).fill(50),
                timeOfDay: new Array(5).fill(50),
            },
            confidence: 0,
        };
    }

    // Prepare sequence
    const sequence = normalizeSequence(history.slice(-cfg.sequenceLength));

    // Predict trajectory
    const trajectory = await predictTrajectory(model, sequence, 7);

    // Calculate current (average of first prediction)
    const current = trajectory[0].reduce((a, b) => a + b, 0) / trajectory[0].length * 100;

    // Calculate trend
    const firstAvg = trajectory[0].reduce((a, b) => a + b, 0) / trajectory[0].length;
    const lastAvg = trajectory[trajectory.length - 1].reduce((a, b) => a + b, 0) / trajectory[trajectory.length - 1].length;
    const trendDiff = lastAvg - firstAvg;

    let trend: 'rising' | 'falling' | 'stable';
    if (trendDiff > 0.05) trend = 'rising';
    else if (trendDiff < -0.05) trend = 'falling';
    else trend = 'stable';

    const trendStrength = Math.min(100, Math.abs(trendDiff) * 500);

    // Analyze seasonality from history
    const seasonality = analyzeSeasonality(history);

    // Confidence based on data availability
    const confidence = Math.min(100, (history.length / 30) * 100);

    return {
        current: Math.round(current * 10) / 10,
        trajectory: trajectory.map(t =>
            Math.round(t.reduce((a, b) => a + b, 0) / t.length * 1000) / 10
        ),
        trend,
        trendStrength: Math.round(trendStrength),
        seasonality,
        confidence: Math.round(confidence),
    };
}

// ============================================
// SEASONALITY ANALYSIS
// ============================================

/**
 * Analyze performance patterns by day/time
 */
export function analyzeSeasonality(
    history: PerformanceSequence[]
): TemporalPrediction['seasonality'] {
    // Initialize accumulators
    const dayPerformance = new Array(7).fill(0).map(() => ({ sum: 0, count: 0 }));
    const timePerformance = new Array(5).fill(0).map(() => ({ sum: 0, count: 0 }));

    for (const entry of history) {
        const date = new Date(entry.timestamp);
        const dayIndex = date.getDay();
        const hour = date.getHours();

        // Map hour to time slot
        let timeIndex: number;
        if (hour < 6) timeIndex = 4;        // night
        else if (hour < 9) timeIndex = 0;   // early_morning
        else if (hour < 12) timeIndex = 1;  // morning
        else if (hour < 17) timeIndex = 2;  // afternoon
        else if (hour < 21) timeIndex = 3;  // evening
        else timeIndex = 4;                 // night

        // Calculate average performance
        const avgPerf = (
            entry.metrics.ctr / 10 +
            entry.metrics.cvr / 100 +
            entry.metrics.roas / 5 +
            entry.metrics.engagement / 100
        ) / 4 * 100;

        dayPerformance[dayIndex].sum += avgPerf;
        dayPerformance[dayIndex].count++;

        timePerformance[timeIndex].sum += avgPerf;
        timePerformance[timeIndex].count++;
    }

    // Calculate averages
    const dayOfWeek = dayPerformance.map(d =>
        d.count > 0 ? Math.round(d.sum / d.count) : 50
    );
    const timeOfDay = timePerformance.map(t =>
        t.count > 0 ? Math.round(t.sum / t.count) : 50
    );

    return { dayOfWeek, timeOfDay };
}

// ============================================
// MODEL PERSISTENCE
// ============================================

const TEMPORAL_MODEL_KEY = 'ml_temporal_model';

/**
 * Save temporal model
 */
export async function saveTemporalModel(model: tf.LayersModel): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        await model.save(`localstorage://${TEMPORAL_MODEL_KEY}`);
        console.log('[TEMPORAL] Model saved');
    } catch (error) {
        console.error('[TEMPORAL] Save failed:', error);
    }
}

/**
 * Load temporal model
 */
export async function loadTemporalModel(): Promise<tf.LayersModel | null> {
    if (typeof window === 'undefined') return null;

    try {
        return await tf.loadLayersModel(`localstorage://${TEMPORAL_MODEL_KEY}`);
    } catch {
        return null;
    }
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

const TEMPORAL_CONFIG_KEY = 'ml_temporal_config';

/**
 * Get temporal configuration
 */
export function getTemporalConfig(): TemporalConfig {
    if (typeof window === 'undefined') return DEFAULT_TEMPORAL_CONFIG;
    const stored = localStorage.getItem(TEMPORAL_CONFIG_KEY);
    return stored ? { ...DEFAULT_TEMPORAL_CONFIG, ...JSON.parse(stored) } : DEFAULT_TEMPORAL_CONFIG;
}

/**
 * Save temporal configuration
 */
export function saveTemporalConfig(config: Partial<TemporalConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getTemporalConfig();
    localStorage.setItem(TEMPORAL_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Get default temporal configuration
 */
export function getDefaultTemporalConfig(): TemporalConfig {
    return { ...DEFAULT_TEMPORAL_CONFIG };
}
