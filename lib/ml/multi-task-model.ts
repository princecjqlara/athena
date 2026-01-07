/**
 * Multi-Task Learning Model
 * 
 * Predicts multiple metrics simultaneously using a shared representation trunk
 * with separate output heads for each metric: CTR, CVR, ROAS, Engagement, Success.
 * 
 * Benefits:
 * - Shared representations improve all predictions
 * - More efficient training
 * - Better generalization
 * 
 * @module lib/ml/multi-task-model
 */

import * as tf from '@tensorflow/tfjs';

// ============================================
// TYPES
// ============================================

export interface MultiTaskPrediction {
    /** Click-through rate prediction (0-100%) */
    ctr: number;
    /** Conversion rate prediction (0-100%) */
    cvr: number;
    /** Return on ad spend prediction (multiplier) */
    roas: number;
    /** Engagement score (0-100) */
    engagement: number;
    /** Overall success probability (0-100) */
    success: number;
    /** Confidence per metric */
    confidence: {
        ctr: number;
        cvr: number;
        roas: number;
        engagement: number;
        success: number;
    };
}

export interface MultiTaskConfig {
    /** Input feature dimension */
    inputDim: number;
    /** Shared trunk hidden units */
    sharedUnits: number[];
    /** Task-specific head units */
    taskHeadUnits: number[];
    /** Dropout rate */
    dropoutRate: number;
    /** Learning rate */
    learningRate: number;
    /** Task loss weights */
    taskWeights: {
        ctr: number;
        cvr: number;
        roas: number;
        engagement: number;
        success: number;
    };
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_MULTI_TASK_CONFIG: MultiTaskConfig = {
    inputDim: 27, // 23 base + 4 interaction features
    sharedUnits: [64, 32],
    taskHeadUnits: [16, 8],
    dropoutRate: 0.2,
    learningRate: 0.001,
    taskWeights: {
        ctr: 1.0,
        cvr: 1.2,      // Harder task, higher weight
        roas: 1.2,     // Harder task, higher weight
        engagement: 0.8,
        success: 1.0,
    },
};

// ============================================
// MODEL CREATION
// ============================================

/**
 * Create multi-task model with shared trunk and separate heads
 */
export function createMultiTaskModel(
    config: Partial<MultiTaskConfig> = {}
): tf.LayersModel {
    const cfg: MultiTaskConfig = { ...DEFAULT_MULTI_TASK_CONFIG, ...config };

    // Input layer
    const input = tf.input({ shape: [cfg.inputDim], name: 'features' });

    // Shared trunk
    let trunk: tf.SymbolicTensor = input;
    for (let i = 0; i < cfg.sharedUnits.length; i++) {
        trunk = tf.layers.dense({
            units: cfg.sharedUnits[i],
            activation: 'relu',
            name: `shared_dense_${i}`,
            kernelInitializer: 'glorotNormal',
        }).apply(trunk) as tf.SymbolicTensor;

        trunk = tf.layers.dropout({
            rate: cfg.dropoutRate,
            name: `shared_dropout_${i}`,
        }).apply(trunk) as tf.SymbolicTensor;
    }

    // Task-specific heads
    const ctrHead = createTaskHead(trunk, 'ctr', cfg.taskHeadUnits, cfg.dropoutRate);
    const cvrHead = createTaskHead(trunk, 'cvr', cfg.taskHeadUnits, cfg.dropoutRate);
    const roasHead = createTaskHead(trunk, 'roas', cfg.taskHeadUnits, cfg.dropoutRate, 'linear');
    const engagementHead = createTaskHead(trunk, 'engagement', cfg.taskHeadUnits, cfg.dropoutRate);
    const successHead = createTaskHead(trunk, 'success', cfg.taskHeadUnits, cfg.dropoutRate);

    // Create model with multiple outputs
    const model = tf.model({
        inputs: input,
        outputs: [ctrHead, cvrHead, roasHead, engagementHead, successHead],
        name: 'multi_task_model',
    });

    return model;
}

/**
 * Create a task-specific head
 */
function createTaskHead(
    trunk: tf.SymbolicTensor,
    taskName: string,
    units: number[],
    dropoutRate: number,
    outputActivation: 'sigmoid' | 'linear' = 'sigmoid'
): tf.SymbolicTensor {
    let head: tf.SymbolicTensor = trunk;

    for (let i = 0; i < units.length; i++) {
        head = tf.layers.dense({
            units: units[i],
            activation: 'relu',
            name: `${taskName}_dense_${i}`,
            kernelInitializer: 'glorotNormal',
        }).apply(head) as tf.SymbolicTensor;

        if (i < units.length - 1) {
            head = tf.layers.dropout({
                rate: dropoutRate * 0.5, // Less dropout in task heads
                name: `${taskName}_dropout_${i}`,
            }).apply(head) as tf.SymbolicTensor;
        }
    }

    // Output layer
    const output = tf.layers.dense({
        units: 1,
        activation: outputActivation,
        name: `${taskName}_output`,
    }).apply(head) as tf.SymbolicTensor;

    return output;
}

// ============================================
// MODEL COMPILATION
// ============================================

/**
 * Compile multi-task model with weighted losses
 */
export function compileMultiTaskModel(
    model: tf.LayersModel,
    config: Partial<MultiTaskConfig> = {}
): void {
    const cfg: MultiTaskConfig = { ...DEFAULT_MULTI_TASK_CONFIG, ...config };

    // Use simple single loss - TF.js has issues with dict losses for multi-output
    model.compile({
        optimizer: tf.train.adam(cfg.learningRate),
        loss: 'meanSquaredError',
        metrics: ['accuracy'],
    });
}

// ============================================
// PREDICTION
// ============================================

/**
 * Predict all metrics simultaneously
 */
export async function predictMultiTask(
    model: tf.LayersModel,
    features: number[]
): Promise<MultiTaskPrediction> {
    const inputTensor = tf.tensor2d([features]);

    const outputs = model.predict(inputTensor) as tf.Tensor[];

    const [ctrTensor, cvrTensor, roasTensor, engagementTensor, successTensor] = outputs;

    const ctr = (await ctrTensor.data())[0] * 100;
    const cvr = (await cvrTensor.data())[0] * 100;
    const roas = (await roasTensor.data())[0] * 5; // Scale to reasonable ROAS range
    const engagement = (await engagementTensor.data())[0] * 100;
    const success = (await successTensor.data())[0] * 100;

    // Cleanup
    inputTensor.dispose();
    outputs.forEach(t => t.dispose());

    // Calculate confidence based on prediction values
    // Extreme predictions (near 0 or 100) have lower confidence
    const calculateConfidence = (val: number) => {
        const distance = Math.min(val, 100 - val);
        return Math.min(90, 50 + distance);
    };

    return {
        ctr: Math.round(ctr * 100) / 100,
        cvr: Math.round(cvr * 100) / 100,
        roas: Math.round(roas * 100) / 100,
        engagement: Math.round(engagement * 10) / 10,
        success: Math.round(success * 10) / 10,
        confidence: {
            ctr: calculateConfidence(ctr),
            cvr: calculateConfidence(cvr),
            roas: 60, // ROAS confidence is generally lower
            engagement: calculateConfidence(engagement),
            success: calculateConfidence(success),
        },
    };
}

// ============================================
// TRAINING DATA PREPARATION
// ============================================

export interface MultiTaskTrainingData {
    features: number[][];
    labels: {
        ctr: number[];
        cvr: number[];
        roas: number[];
        engagement: number[];
        success: number[];
    };
}

/**
 * Prepare training data for multi-task model
 */
export function prepareMultiTaskTrainingData(
    features: number[][],
    results: Array<{
        ctr: number;
        cvr: number;
        roas: number;
        engagement: number;
        success: number;
    }>
): MultiTaskTrainingData {
    const labels = {
        ctr: results.map(r => r.ctr / 100), // Normalize to 0-1
        cvr: results.map(r => r.cvr / 100),
        roas: results.map(r => r.roas / 5), // Normalize ROAS
        engagement: results.map(r => r.engagement / 100),
        success: results.map(r => r.success / 100),
    };

    return { features, labels };
}

// ============================================
// MODEL PERSISTENCE
// ============================================

const MULTI_TASK_MODEL_KEY = 'ml_multi_task_model';

/**
 * Save multi-task model to localStorage
 */
export async function saveMultiTaskModel(model: tf.LayersModel): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        await model.save(`localstorage://${MULTI_TASK_MODEL_KEY}`);
        console.log('[MULTI-TASK] Model saved successfully');
    } catch (error) {
        console.error('[MULTI-TASK] Failed to save model:', error);
    }
}

/**
 * Load multi-task model from localStorage
 */
export async function loadMultiTaskModel(): Promise<tf.LayersModel | null> {
    if (typeof window === 'undefined') return null;

    try {
        const model = await tf.loadLayersModel(`localstorage://${MULTI_TASK_MODEL_KEY}`);
        console.log('[MULTI-TASK] Model loaded successfully');
        return model;
    } catch (error) {
        console.log('[MULTI-TASK] No saved model found, will create new one');
        return null;
    }
}

/**
 * Check if multi-task model exists
 */
export function hasMultiTaskModel(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`tensorflowjs_models/${MULTI_TASK_MODEL_KEY}/info`) !== null;
}

/**
 * Delete saved multi-task model
 */
export async function deleteMultiTaskModel(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        // Clear all related localStorage keys
        const keys = Object.keys(localStorage).filter(k => k.includes(MULTI_TASK_MODEL_KEY));
        keys.forEach(k => localStorage.removeItem(k));
        console.log('[MULTI-TASK] Model deleted');
    } catch (error) {
        console.error('[MULTI-TASK] Failed to delete model:', error);
    }
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

const MULTI_TASK_CONFIG_KEY = 'ml_multi_task_config';

/**
 * Get multi-task configuration
 */
export function getMultiTaskConfig(): MultiTaskConfig {
    if (typeof window === 'undefined') return DEFAULT_MULTI_TASK_CONFIG;
    const stored = localStorage.getItem(MULTI_TASK_CONFIG_KEY);
    return stored ? { ...DEFAULT_MULTI_TASK_CONFIG, ...JSON.parse(stored) } : DEFAULT_MULTI_TASK_CONFIG;
}

/**
 * Save multi-task configuration
 */
export function saveMultiTaskConfig(config: Partial<MultiTaskConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getMultiTaskConfig();
    localStorage.setItem(MULTI_TASK_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Get default multi-task configuration
 */
export function getDefaultMultiTaskConfig(): MultiTaskConfig {
    return { ...DEFAULT_MULTI_TASK_CONFIG };
}
