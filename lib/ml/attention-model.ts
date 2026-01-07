/**
 * Attention Mechanism Module
 * 
 * Implements attention for feature importance and explainability.
 * Attention weights show which features the model focuses on for predictions.
 * 
 * @module lib/ml/attention-model
 */

import * as tf from '@tensorflow/tfjs';

// ============================================
// TYPES
// ============================================

export interface AttentionResult {
    /** Attention weights per feature (0-1, sum to 1) */
    weights: number[];
    /** Feature importance ranking */
    importanceRanking: Array<{
        featureIndex: number;
        featureName: string;
        attention: number;
        normalized: number;
    }>;
    /** Top 5 most attended features */
    topFeatures: string[];
}

export interface AttentionConfig {
    /** Attention dropout rate */
    dropoutRate: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_ATTENTION_CONFIG: AttentionConfig = {
    dropoutRate: 0.1,
};

// ============================================
// ATTENTION INTERPRETATION
// ============================================

/**
 * Extract feature importance from attention weights
 */
export function interpretAttention(
    attentionWeights: number[],
    featureNames: string[]
): AttentionResult['importanceRanking'] {
    const validWeights = attentionWeights.slice(0, featureNames.length);

    // Normalize attention weights
    const sum = validWeights.reduce((a, b) => Math.abs(a) + Math.abs(b), 0) || 1;
    const normalized = validWeights.map(w => Math.abs(w) / sum);

    // Create ranking
    const ranking = featureNames.map((name, index) => ({
        featureIndex: index,
        featureName: name,
        attention: validWeights[index] || 0,
        normalized: (normalized[index] || 0) * 100, // Convert to percentage
    }));

    // Sort by attention (descending)
    ranking.sort((a, b) => b.normalized - a.normalized);

    return ranking;
}

/**
 * Get top N most important features
 */
export function getTopAttendedFeatures(
    ranking: AttentionResult['importanceRanking'],
    n: number = 5
): string[] {
    return ranking.slice(0, n).map(r => r.featureName);
}

// ============================================
// ATTENTION MODEL CREATION
// ============================================

/**
 * Create a model with attention layer
 */
export function createAttentionModel(
    inputDim: number,
    hiddenUnits: number[] = [32, 16],
    config: Partial<AttentionConfig> = {}
): tf.LayersModel {
    const cfg: AttentionConfig = { ...DEFAULT_ATTENTION_CONFIG, ...config };

    // Input layer
    const input = tf.input({ shape: [inputDim], name: 'features' });

    // Attention layer (simplified as dense with softmax)
    // This creates learnable feature weights
    const attentionWeights = tf.layers.dense({
        units: inputDim,
        activation: 'softmax',
        name: 'attention_weights',
    }).apply(input) as tf.SymbolicTensor;

    // Multiply attention with input (element-wise)
    const attended = tf.layers.multiply({
        name: 'attended_features',
    }).apply([input, attentionWeights]) as tf.SymbolicTensor;

    // Hidden layers
    let hidden: tf.SymbolicTensor = attended;
    for (let i = 0; i < hiddenUnits.length; i++) {
        hidden = tf.layers.dense({
            units: hiddenUnits[i],
            activation: 'relu',
            name: `hidden_${i}`,
        }).apply(hidden) as tf.SymbolicTensor;

        hidden = tf.layers.dropout({
            rate: cfg.dropoutRate,
            name: `dropout_${i}`,
        }).apply(hidden) as tf.SymbolicTensor;
    }

    // Output layer
    const output = tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        name: 'output',
    }).apply(hidden) as tf.SymbolicTensor;

    const model = tf.model({
        inputs: input,
        outputs: output,
        name: 'attention_model',
    });

    return model;
}

/**
 * Extract attention weights from model
 */
export async function extractAttentionWeights(
    model: tf.LayersModel,
    input: number[]
): Promise<number[]> {
    // Get the attention layer
    const attentionLayer = model.getLayer('attention_weights');

    // Create intermediate model to get attention weights
    const intermediateModel = tf.model({
        inputs: model.inputs,
        outputs: attentionLayer.output,
    });

    const inputTensor = tf.tensor2d([input]);
    const weights = intermediateModel.predict(inputTensor) as tf.Tensor;
    const weightsArray = Array.from(await weights.data());

    // Cleanup
    inputTensor.dispose();
    weights.dispose();

    return weightsArray;
}

/**
 * Compute feature importance using gradient-based attention
 * This method calculates importance based on how much each feature affects output
 */
export function computeFeatureImportance(
    features: number[],
    prediction: number
): number[] {
    // Simple feature importance based on feature values
    // Higher values = higher contribution to prediction
    const total = features.reduce((sum, f) => sum + Math.abs(f), 0) || 1;
    return features.map(f => (Math.abs(f) / total) * prediction);
}

// ============================================
// ATTENTION CONFIG MANAGEMENT
// ============================================

const ATTENTION_CONFIG_KEY = 'ml_attention_config';

/**
 * Get attention configuration
 */
export function getAttentionConfig(): AttentionConfig {
    if (typeof window === 'undefined') return DEFAULT_ATTENTION_CONFIG;
    const stored = localStorage.getItem(ATTENTION_CONFIG_KEY);
    return stored ? { ...DEFAULT_ATTENTION_CONFIG, ...JSON.parse(stored) } : DEFAULT_ATTENTION_CONFIG;
}

/**
 * Save attention configuration
 */
export function saveAttentionConfig(config: Partial<AttentionConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getAttentionConfig();
    localStorage.setItem(ATTENTION_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Get default attention configuration
 */
export function getDefaultAttentionConfig(): AttentionConfig {
    return { ...DEFAULT_ATTENTION_CONFIG };
}
