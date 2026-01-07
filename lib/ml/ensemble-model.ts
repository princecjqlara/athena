/**
 * Ensemble Methods Module
 * 
 * Combines multiple models (Neural Network + Gradient Boosting) for robust predictions.
 * Uses weighted averaging based on model confidence and recent performance.
 * 
 * Note: Pure JavaScript implementation of gradient boosting for browser compatibility.
 * 
 * @module lib/ml/ensemble-model
 */

// ============================================
// TYPES
// ============================================

export interface EnsemblePrediction {
    /** Final ensemble prediction */
    prediction: number;
    /** Confidence in prediction (0-100) */
    confidence: number;
    /** Individual model predictions */
    models: {
        neuralNetwork: { prediction: number; weight: number };
        gradientBoosting: { prediction: number; weight: number };
        rulesBasedBaseline: { prediction: number; weight: number };
    };
    /** Disagreement between models */
    disagreement: number;
    /** Which model was most influential */
    dominantModel: 'neuralNetwork' | 'gradientBoosting' | 'rulesBasedBaseline';
}

export interface EnsembleConfig {
    /** Base weight for neural network */
    nnWeight: number;
    /** Base weight for gradient boosting */
    gbWeight: number;
    /** Base weight for rules-based baseline */
    baselineWeight: number;
    /** Use dynamic weighting based on recent accuracy */
    dynamicWeighting: boolean;
    /** Number of decision trees in GB */
    numTrees: number;
    /** Max depth per tree */
    maxDepth: number;
    /** Learning rate for GB */
    learningRate: number;
}

export interface DecisionTree {
    featureIndex: number;
    threshold: number;
    leftValue: number | DecisionTree;
    rightValue: number | DecisionTree;
}

export interface GradientBoostingModel {
    trees: DecisionTree[];
    weights: number[];
    featureImportance: number[];
    baseScore: number;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_ENSEMBLE_CONFIG: EnsembleConfig = {
    nnWeight: 0.5,
    gbWeight: 0.35,
    baselineWeight: 0.15,
    dynamicWeighting: true,
    numTrees: 10,
    maxDepth: 4,
    learningRate: 0.1,
};

// ============================================
// GRADIENT BOOSTING (Pure JavaScript)
// ============================================

/**
 * Build a single decision tree
 */
function buildDecisionTree(
    features: number[][],
    residuals: number[],
    depth: number,
    maxDepth: number
): DecisionTree | number {
    // Base case: max depth reached or not enough samples
    if (depth >= maxDepth || features.length < 4) {
        return residuals.reduce((a, b) => a + b, 0) / residuals.length;
    }

    // Find best split
    let bestGain = -Infinity;
    let bestFeature = 0;
    let bestThreshold = 0;
    let bestLeftIdx: number[] = [];
    let bestRightIdx: number[] = [];

    const numFeatures = features[0]?.length || 0;

    for (let f = 0; f < numFeatures; f++) {
        // Get unique values for this feature
        const values = features.map((x, i) => ({ val: x[f], idx: i }))
            .sort((a, b) => a.val - b.val);

        // Try splits
        for (let i = 1; i < values.length; i++) {
            const threshold = (values[i - 1].val + values[i].val) / 2;

            const leftIdx = values.slice(0, i).map(v => v.idx);
            const rightIdx = values.slice(i).map(v => v.idx);

            if (leftIdx.length === 0 || rightIdx.length === 0) continue;

            const leftResiduals = leftIdx.map(i => residuals[i]);
            const rightResiduals = rightIdx.map(i => residuals[i]);

            // Calculate information gain (variance reduction)
            const totalVar = variance(residuals);
            const leftVar = variance(leftResiduals);
            const rightVar = variance(rightResiduals);

            const weightedVar = (leftIdx.length * leftVar + rightIdx.length * rightVar) / features.length;
            const gain = totalVar - weightedVar;

            if (gain > bestGain) {
                bestGain = gain;
                bestFeature = f;
                bestThreshold = threshold;
                bestLeftIdx = leftIdx;
                bestRightIdx = rightIdx;
            }
        }
    }

    // No good split found
    if (bestGain <= 0) {
        return residuals.reduce((a, b) => a + b, 0) / residuals.length;
    }

    // Build child trees
    const leftFeatures = bestLeftIdx.map(i => features[i]);
    const leftResiduals = bestLeftIdx.map(i => residuals[i]);
    const rightFeatures = bestRightIdx.map(i => features[i]);
    const rightResiduals = bestRightIdx.map(i => residuals[i]);

    return {
        featureIndex: bestFeature,
        threshold: bestThreshold,
        leftValue: buildDecisionTree(leftFeatures, leftResiduals, depth + 1, maxDepth),
        rightValue: buildDecisionTree(rightFeatures, rightResiduals, depth + 1, maxDepth),
    };
}

/**
 * Calculate variance of an array
 */
function variance(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
}

/**
 * Predict with a single tree
 */
function predictTree(tree: DecisionTree | number, features: number[]): number {
    if (typeof tree === 'number') return tree;

    if (features[tree.featureIndex] <= tree.threshold) {
        return predictTree(tree.leftValue, features);
    } else {
        return predictTree(tree.rightValue, features);
    }
}

/**
 * Train gradient boosting model
 */
export function trainGradientBoosting(
    features: number[][],
    targets: number[],
    config: Partial<EnsembleConfig> = {}
): GradientBoostingModel {
    const cfg: EnsembleConfig = { ...DEFAULT_ENSEMBLE_CONFIG, ...config };

    if (features.length === 0) {
        return {
            trees: [],
            weights: [],
            featureImportance: [],
            baseScore: 50,
        };
    }

    // Initialize with mean
    const baseScore = targets.reduce((a, b) => a + b, 0) / targets.length;
    const predictions = new Array(targets.length).fill(baseScore);

    const trees: DecisionTree[] = [];
    const weights: number[] = [];
    const featureContributions: number[] = new Array(features[0]?.length || 0).fill(0);

    for (let i = 0; i < cfg.numTrees; i++) {
        // Calculate residuals
        const residuals = targets.map((t, j) => t - predictions[j]);

        // Build tree to predict residuals
        const tree = buildDecisionTree(features, residuals, 0, cfg.maxDepth);

        if (typeof tree === 'number') {
            // Tree is just a leaf, use it
            trees.push({
                featureIndex: 0,
                threshold: 0,
                leftValue: tree,
                rightValue: tree,
            });
        } else {
            trees.push(tree);
        }

        weights.push(cfg.learningRate);

        // Update predictions
        for (let j = 0; j < features.length; j++) {
            const treePred = predictTree(trees[i], features[j]);
            predictions[j] += cfg.learningRate * treePred;
        }

        // Track feature importance (based on splits)
        if (typeof tree !== 'number') {
            featureContributions[tree.featureIndex] += 1;
        }
    }

    // Normalize feature importance
    const totalContrib = featureContributions.reduce((a, b) => a + b, 0) || 1;
    const featureImportance = featureContributions.map(c => c / totalContrib);

    return {
        trees,
        weights,
        featureImportance,
        baseScore,
    };
}

/**
 * Predict with gradient boosting model
 */
export function predictGradientBoosting(
    model: GradientBoostingModel,
    features: number[]
): number {
    let prediction = model.baseScore;

    for (let i = 0; i < model.trees.length; i++) {
        prediction += model.weights[i] * predictTree(model.trees[i], features);
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, prediction));
}

// ============================================
// RULES-BASED BASELINE
// ============================================

/**
 * Simple rules-based prediction for baseline
 */
export function predictRulesBaseline(features: number[]): number {
    // Simple weighted sum with domain knowledge priors
    // Features assumed to be normalized 0-1
    const weights = [
        0.15,  // hookType - important
        0.10,  // editingStyle
        0.10,  // contentCategory
        0.05,  // colorScheme
        0.05,  // musicType
        0.10,  // platform - important
        0.05,  // textOverlays
        0.05,  // subtitles
        0.10,  // UGC style - important
        0.05,  // voiceover
        0.05,  // actors
        0.08,  // duration
        0.07,  // remaining features...
    ];

    let score = 0;
    for (let i = 0; i < Math.min(features.length, weights.length); i++) {
        score += features[i] * weights[i] * 100;
    }

    // Add some non-linearity for UGC + platform combos
    if (features[8] > 0.7 && features[5] > 0.6) {
        score *= 1.1; // UGC on TikTok/Instagram boost
    }

    return Math.max(0, Math.min(100, score));
}

// ============================================
// ENSEMBLE PREDICTION
// ============================================

/**
 * Combine predictions from all models
 */
export function ensemblePrediction(
    nnPrediction: number,
    gbModel: GradientBoostingModel,
    features: number[],
    config: Partial<EnsembleConfig> = {}
): EnsemblePrediction {
    const cfg: EnsembleConfig = { ...DEFAULT_ENSEMBLE_CONFIG, ...config };

    // Get individual predictions
    const gbPrediction = predictGradientBoosting(gbModel, features);
    const baselinePrediction = predictRulesBaseline(features);

    // Normalize weights
    const totalWeight = cfg.nnWeight + cfg.gbWeight + cfg.baselineWeight;
    const nnW = cfg.nnWeight / totalWeight;
    const gbW = cfg.gbWeight / totalWeight;
    const baseW = cfg.baselineWeight / totalWeight;

    // Weighted average
    const prediction =
        nnPrediction * nnW +
        gbPrediction * gbW +
        baselinePrediction * baseW;

    // Calculate disagreement
    const predictions = [nnPrediction, gbPrediction, baselinePrediction];
    const mean = predictions.reduce((a, b) => a + b, 0) / 3;
    const disagreement = Math.sqrt(
        predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / 3
    );

    // Lower confidence when models disagree
    const confidence = Math.max(0, 100 - disagreement * 2);

    // Determine dominant model
    const absWeights = [
        { model: 'neuralNetwork' as const, contribution: Math.abs(nnPrediction - mean) },
        { model: 'gradientBoosting' as const, contribution: Math.abs(gbPrediction - mean) },
        { model: 'rulesBasedBaseline' as const, contribution: Math.abs(baselinePrediction - mean) },
    ];
    const dominantModel = absWeights.sort((a, b) => b.contribution - a.contribution)[0].model;

    return {
        prediction: Math.round(prediction * 10) / 10,
        confidence: Math.round(confidence),
        models: {
            neuralNetwork: { prediction: Math.round(nnPrediction * 10) / 10, weight: nnW },
            gradientBoosting: { prediction: Math.round(gbPrediction * 10) / 10, weight: gbW },
            rulesBasedBaseline: { prediction: Math.round(baselinePrediction * 10) / 10, weight: baseW },
        },
        disagreement: Math.round(disagreement * 10) / 10,
        dominantModel,
    };
}

// ============================================
// MODEL PERSISTENCE
// ============================================

const ENSEMBLE_GB_KEY = 'ml_ensemble_gb_model';
const ENSEMBLE_WEIGHTS_KEY = 'ml_ensemble_weights';

/**
 * Save gradient boosting model
 */
export function saveGradientBoostingModel(model: GradientBoostingModel): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ENSEMBLE_GB_KEY, JSON.stringify(model));
}

/**
 * Load gradient boosting model
 */
export function loadGradientBoostingModel(): GradientBoostingModel | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(ENSEMBLE_GB_KEY);
    return stored ? JSON.parse(stored) : null;
}

/**
 * Save ensemble weights (for dynamic weighting)
 */
export function saveEnsembleWeights(weights: {
    nnWeight: number;
    gbWeight: number;
    baselineWeight: number;
}): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ENSEMBLE_WEIGHTS_KEY, JSON.stringify(weights));
}

/**
 * Load ensemble weights
 */
export function loadEnsembleWeights(): {
    nnWeight: number;
    gbWeight: number;
    baselineWeight: number;
} | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(ENSEMBLE_WEIGHTS_KEY);
    return stored ? JSON.parse(stored) : null;
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

const ENSEMBLE_CONFIG_KEY = 'ml_ensemble_config';

/**
 * Get ensemble configuration
 */
export function getEnsembleConfig(): EnsembleConfig {
    if (typeof window === 'undefined') return DEFAULT_ENSEMBLE_CONFIG;
    const stored = localStorage.getItem(ENSEMBLE_CONFIG_KEY);
    return stored ? { ...DEFAULT_ENSEMBLE_CONFIG, ...JSON.parse(stored) } : DEFAULT_ENSEMBLE_CONFIG;
}

/**
 * Save ensemble configuration
 */
export function saveEnsembleConfig(config: Partial<EnsembleConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getEnsembleConfig();
    localStorage.setItem(ENSEMBLE_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Get default ensemble configuration
 */
export function getDefaultEnsembleConfig(): EnsembleConfig {
    return { ...DEFAULT_ENSEMBLE_CONFIG };
}
