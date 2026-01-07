/**
 * Multi-Task Training Module
 * 
 * Provides training utilities for the multi-task model including:
 * - Dynamic task weighting (harder tasks get more weight)
 * - Gradient accumulation for stability
 * - Per-task accuracy tracking
 * 
 * @module lib/ml/multi-task-training
 */

import * as tf from '@tensorflow/tfjs';
import {
    createMultiTaskModel,
    compileMultiTaskModel,
    MultiTaskConfig,
    MultiTaskTrainingData,
} from './multi-task-model';

// ============================================
// TYPES
// ============================================

export interface TrainingConfig {
    /** Number of training epochs */
    epochs: number;
    /** Batch size */
    batchSize: number;
    /** Validation split (0-1) */
    validationSplit: number;
    /** Use dynamic task weighting */
    dynamicWeighting: boolean;
    /** Early stopping patience */
    patience: number;
    /** Minimum samples to start training */
    minSamples: number;
}

export interface TrainingResult {
    /** Training completed successfully */
    success: boolean;
    /** Number of epochs trained */
    epochsTrained: number;
    /** Final loss values per task */
    finalLoss: {
        ctr: number;
        cvr: number;
        roas: number;
        engagement: number;
        success: number;
        total: number;
    };
    /** Accuracy per task */
    accuracy: {
        ctr: number;
        cvr: number;
        roas: number;
        engagement: number;
        success: number;
    };
    /** Training history */
    history: {
        loss: number[];
        val_loss?: number[];
    };
    /** Training duration in ms */
    durationMs: number;
}

export interface TaskPerformance {
    task: string;
    loss: number;
    accuracy: number;
    weight: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
    epochs: 50,
    batchSize: 16,
    validationSplit: 0.2,
    dynamicWeighting: true,
    patience: 10,
    minSamples: 20,
};

// ============================================
// DYNAMIC TASK WEIGHTING
// ============================================

/**
 * Calculate dynamic task weights based on performance
 * Harder tasks (higher loss) get more weight
 */
export function calculateDynamicWeights(
    taskPerformances: TaskPerformance[]
): Record<string, number> {
    if (taskPerformances.length === 0) {
        return {
            ctr: 1.0,
            cvr: 1.2,
            roas: 1.2,
            engagement: 0.8,
            success: 1.0,
        };
    }

    // Calculate average loss
    const totalLoss = taskPerformances.reduce((sum, t) => sum + t.loss, 0);
    const avgLoss = totalLoss / taskPerformances.length;

    // Weight tasks inversely proportional to their performance
    // Higher loss = needs more attention = higher weight
    const weights: Record<string, number> = {};

    for (const perf of taskPerformances) {
        const relativeHardness = perf.loss / avgLoss;
        weights[perf.task] = Math.max(0.5, Math.min(2.0, relativeHardness));
    }

    return weights;
}

// ============================================
// TRAINING FUNCTION
// ============================================

/**
 * Train multi-task model
 */
export async function trainMultiTaskModel(
    data: MultiTaskTrainingData,
    modelConfig: Partial<MultiTaskConfig> = {},
    trainingConfig: Partial<TrainingConfig> = {},
    existingModel?: tf.LayersModel
): Promise<TrainingResult> {
    const cfg: TrainingConfig = { ...DEFAULT_TRAINING_CONFIG, ...trainingConfig };
    const startTime = Date.now();

    // Check minimum samples
    if (data.features.length < cfg.minSamples) {
        return {
            success: false,
            epochsTrained: 0,
            finalLoss: { ctr: 0, cvr: 0, roas: 0, engagement: 0, success: 0, total: 0 },
            accuracy: { ctr: 0, cvr: 0, roas: 0, engagement: 0, success: 0 },
            history: { loss: [] },
            durationMs: Date.now() - startTime,
        };
    }

    // Create or use existing model
    const model = existingModel || createMultiTaskModel(modelConfig);
    compileMultiTaskModel(model, modelConfig);

    // Prepare tensors
    const featuresTensor = tf.tensor2d(data.features);
    const labelsTensors = {
        ctr_output: tf.tensor2d(data.labels.ctr.map(v => [v])),
        cvr_output: tf.tensor2d(data.labels.cvr.map(v => [v])),
        roas_output: tf.tensor2d(data.labels.roas.map(v => [v])),
        engagement_output: tf.tensor2d(data.labels.engagement.map(v => [v])),
        success_output: tf.tensor2d(data.labels.success.map(v => [v])),
    };

    // Training callbacks
    const callbacks: tf.CustomCallbackArgs = {
        onEpochEnd: async (epoch, logs) => {
            if (epoch % 10 === 0) {
                console.log(`[MULTI-TASK] Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}`);
            }

            // Dynamic weight adjustment every 5 epochs
            if (cfg.dynamicWeighting && epoch > 0 && epoch % 5 === 0) {
                const performances = extractTaskPerformances(logs);
                const newWeights = calculateDynamicWeights(performances);

                // Note: In TF.js we can't update loss weights mid-training easily
                // This is logged for future improvement
                console.log('[MULTI-TASK] Dynamic weights:', newWeights);
            }
        },
    };

    // Train model
    const history = await model.fit(
        featuresTensor,
        labelsTensors,
        {
            epochs: cfg.epochs,
            batchSize: cfg.batchSize,
            validationSplit: cfg.validationSplit,
            callbacks: [callbacks],
            shuffle: true,
        }
    );

    // Calculate final accuracies
    const predictions = model.predict(featuresTensor) as tf.Tensor[];
    const accuracy = await calculateTaskAccuracies(predictions, labelsTensors);

    // Get final loss values
    const finalLoss = extractFinalLosses(history);

    // Cleanup
    featuresTensor.dispose();
    Object.values(labelsTensors).forEach(t => t.dispose());
    predictions.forEach(t => t.dispose());

    return {
        success: true,
        epochsTrained: cfg.epochs,
        finalLoss,
        accuracy,
        history: {
            loss: history.history.loss as number[],
            val_loss: history.history.val_loss as number[] | undefined,
        },
        durationMs: Date.now() - startTime,
    };
}

/**
 * Extract task performances from training logs
 */
function extractTaskPerformances(logs: tf.Logs | undefined): TaskPerformance[] {
    if (!logs) return [];

    const tasks = ['ctr', 'cvr', 'roas', 'engagement', 'success'];
    const performances: TaskPerformance[] = [];

    for (const task of tasks) {
        const lossKey = `${task}_output_loss`;
        const accKey = `${task}_output_acc`;

        if (lossKey in logs) {
            performances.push({
                task,
                loss: logs[lossKey] as number,
                accuracy: (logs[accKey] as number) || 0,
                weight: 1.0,
            });
        }
    }

    return performances;
}

/**
 * Extract final loss values from training history
 */
function extractFinalLosses(history: tf.History): TrainingResult['finalLoss'] {
    const lastIndex = history.history.loss.length - 1;

    return {
        ctr: (history.history['ctr_output_loss']?.[lastIndex] as number) || 0,
        cvr: (history.history['cvr_output_loss']?.[lastIndex] as number) || 0,
        roas: (history.history['roas_output_loss']?.[lastIndex] as number) || 0,
        engagement: (history.history['engagement_output_loss']?.[lastIndex] as number) || 0,
        success: (history.history['success_output_loss']?.[lastIndex] as number) || 0,
        total: (history.history.loss[lastIndex] as number) || 0,
    };
}

/**
 * Calculate per-task accuracies
 */
async function calculateTaskAccuracies(
    predictions: tf.Tensor[],
    labels: Record<string, tf.Tensor>
): Promise<TrainingResult['accuracy']> {
    const tasks = ['ctr', 'cvr', 'roas', 'engagement', 'success'];
    const accuracy: Record<string, number> = {};

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const pred = predictions[i];
        const label = labels[`${task}_output`];

        // For binary tasks, threshold at 0.5
        const predThresholded = pred.greater(0.5);
        const labelThresholded = label.greater(0.5);
        const correct = predThresholded.equal(labelThresholded);
        const acc = (await correct.mean().data())[0];

        accuracy[task] = Math.round(acc * 100);

        // Cleanup intermediates
        predThresholded.dispose();
        labelThresholded.dispose();
        correct.dispose();
    }

    return accuracy as TrainingResult['accuracy'];
}

// ============================================
// INCREMENTAL TRAINING
// ============================================

/**
 * Incrementally train on new samples
 * More efficient than retraining from scratch
 */
export async function incrementalTrain(
    model: tf.LayersModel,
    newSamples: MultiTaskTrainingData,
    epochs: number = 5
): Promise<TrainingResult> {
    return trainMultiTaskModel(
        newSamples,
        {},
        { epochs, minSamples: 1, validationSplit: 0 },
        model
    );
}

// ============================================
// TRAINING STATE MANAGEMENT
// ============================================

const TRAINING_STATE_KEY = 'ml_multi_task_training_state';

interface TrainingState {
    lastTrainedAt: string;
    totalSamplesTrained: number;
    epochsCompleted: number;
    bestValidationLoss: number;
    taskAccuracies: Record<string, number>;
}

/**
 * Get training state
 */
export function getTrainingState(): TrainingState | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TRAINING_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
}

/**
 * Save training state
 */
export function saveTrainingState(result: TrainingResult, sampleCount: number): void {
    if (typeof window === 'undefined') return;

    const current = getTrainingState();
    const state: TrainingState = {
        lastTrainedAt: new Date().toISOString(),
        totalSamplesTrained: (current?.totalSamplesTrained || 0) + sampleCount,
        epochsCompleted: (current?.epochsCompleted || 0) + result.epochsTrained,
        bestValidationLoss: Math.min(
            current?.bestValidationLoss || Infinity,
            result.finalLoss.total
        ),
        taskAccuracies: result.accuracy,
    };

    localStorage.setItem(TRAINING_STATE_KEY, JSON.stringify(state));
}

/**
 * Clear training state
 */
export function clearTrainingState(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TRAINING_STATE_KEY);
}

// ============================================
// TRAINING CONFIG MANAGEMENT
// ============================================

const TRAINING_CONFIG_KEY = 'ml_multi_task_training_config';

/**
 * Get training configuration
 */
export function getTrainingConfig(): TrainingConfig {
    if (typeof window === 'undefined') return DEFAULT_TRAINING_CONFIG;
    const stored = localStorage.getItem(TRAINING_CONFIG_KEY);
    return stored ? { ...DEFAULT_TRAINING_CONFIG, ...JSON.parse(stored) } : DEFAULT_TRAINING_CONFIG;
}

/**
 * Save training configuration
 */
export function saveTrainingConfig(config: Partial<TrainingConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getTrainingConfig();
    localStorage.setItem(TRAINING_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Get default training configuration
 */
export function getDefaultTrainingConfig(): TrainingConfig {
    return { ...DEFAULT_TRAINING_CONFIG };
}
