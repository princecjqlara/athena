/**
 * Contrastive Learning Module
 * 
 * Implements triplet loss training to learn better ad embeddings.
 * Brings similar-performing ads closer together in embedding space.
 * 
 * @module lib/ml/contrastive-training
 */

import * as tf from '@tensorflow/tfjs';

// ============================================
// TYPES
// ============================================

export interface Triplet {
    /** Anchor: the reference ad */
    anchor: number[];
    /** Positive: similar performance to anchor */
    positive: number[];
    /** Negative: different performance from anchor */
    negative: number[];
}

export interface ContrastiveConfig {
    /** Embedding dimension */
    embeddingDim: number;
    /** Margin for triplet loss */
    margin: number;
    /** Learning rate */
    learningRate: number;
    /** Batch size for training */
    batchSize: number;
    /** Use hard negative mining */
    hardNegativeMining: boolean;
    /** Score difference threshold for positive/negative */
    scoreThreshold: number;
}

export interface ContrastiveEmbeddingResult {
    /** The learned embedding vector */
    embedding: number[];
    /** Similarity to cluster center */
    clusterAffinity: number;
    /** Nearest neighbors in embedding space */
    nearestNeighbors: string[];
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONTRASTIVE_CONFIG: ContrastiveConfig = {
    embeddingDim: 32,
    margin: 1.0,
    learningRate: 0.001,
    batchSize: 32,
    hardNegativeMining: true,
    scoreThreshold: 15, // |score_a - score_b| < 15 = positive
};

// ============================================
// TRIPLET LOSS
// ============================================

/**
 * Compute triplet loss
 * L = max(d(a,p) - d(a,n) + margin, 0)
 */
export function tripletLoss(
    anchor: tf.Tensor,
    positive: tf.Tensor,
    negative: tf.Tensor,
    margin: number = 1.0
): tf.Tensor {
    // Compute distances
    const distAP = tf.sum(tf.square(anchor.sub(positive)), -1); // d(anchor, positive)
    const distAN = tf.sum(tf.square(anchor.sub(negative)), -1); // d(anchor, negative)

    // Triplet loss with margin
    const loss = tf.maximum(distAP.sub(distAN).add(margin), 0);

    return tf.mean(loss);
}

/**
 * Custom triplet loss layer for training
 */
export function createTripletLossLayer(margin: number = 1.0): (
    yTrue: tf.Tensor,
    yPred: tf.Tensor
) => tf.Tensor {
    return (yTrue: tf.Tensor, yPred: tf.Tensor) => {
        // yPred contains concatenated [anchor_emb, positive_emb, negative_emb]
        const embeddingDim = (yPred.shape[1] ?? 96) / 3;

        const anchor = yPred.slice([0, 0], [-1, embeddingDim]);
        const positive = yPred.slice([0, embeddingDim], [-1, embeddingDim]);
        const negative = yPred.slice([0, embeddingDim * 2], [-1, embeddingDim]);

        return tripletLoss(anchor, positive, negative, margin);
    };
}

// ============================================
// TRIPLET MINING
// ============================================

export interface AdWithScore {
    id: string;
    features: number[];
    successScore: number;
}

/**
 * Generate triplets from ads based on success scores
 */
export function generateTriplets(
    ads: AdWithScore[],
    config: Partial<ContrastiveConfig> = {}
): Triplet[] {
    const cfg: ContrastiveConfig = { ...DEFAULT_CONTRASTIVE_CONFIG, ...config };
    const triplets: Triplet[] = [];

    if (ads.length < 3) return triplets;

    // Sort by score for efficient mining
    const sortedAds = [...ads].sort((a, b) => b.successScore - a.successScore);

    for (let i = 0; i < sortedAds.length; i++) {
        const anchor = sortedAds[i];

        // Find positives (similar score)
        const positives = sortedAds.filter(
            ad => ad.id !== anchor.id &&
                Math.abs(ad.successScore - anchor.successScore) < cfg.scoreThreshold
        );

        // Find negatives (different score)
        const negatives = sortedAds.filter(
            ad => ad.id !== anchor.id &&
                Math.abs(ad.successScore - anchor.successScore) >= cfg.scoreThreshold
        );

        if (positives.length === 0 || negatives.length === 0) continue;

        // Generate triplets
        for (const positive of positives.slice(0, 3)) { // Limit positives
            for (const negative of negatives.slice(0, 3)) { // Limit negatives
                triplets.push({
                    anchor: anchor.features,
                    positive: positive.features,
                    negative: negative.features,
                });
            }
        }
    }

    return triplets;
}

/**
 * Hard negative mining: find negatives that are close to anchor but have different score
 */
export function hardNegativeMining(
    anchor: number[],
    negatives: AdWithScore[],
    embeddings: Map<string, number[]>,
    topK: number = 5
): AdWithScore[] {
    // Calculate distances to all negatives
    const distances = negatives.map(neg => {
        const embedding = embeddings.get(neg.id) || neg.features;
        const dist = euclideanDistance(anchor, embedding);
        return { ad: neg, distance: dist };
    });

    // Sort by distance (closest first = hardest negatives)
    distances.sort((a, b) => a.distance - b.distance);

    return distances.slice(0, topK).map(d => d.ad);
}

/**
 * Euclidean distance between two vectors
 */
function euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
}

// ============================================
// SIAMESE NETWORK
// ============================================

/**
 * Create embedding network (base of Siamese network)
 */
export function createEmbeddingNetwork(
    inputDim: number,
    config: Partial<ContrastiveConfig> = {}
): tf.LayersModel {
    const cfg: ContrastiveConfig = { ...DEFAULT_CONTRASTIVE_CONFIG, ...config };

    const model = tf.sequential();

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
        inputShape: [inputDim],
        name: 'embed_dense_1',
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
        units: cfg.embeddingDim,
        activation: 'linear',
        name: 'embedding_output',
    }));

    // L2 normalize embeddings
    model.add(tf.layers.layerNormalization({
        name: 'embedding_norm',
    }));

    return model;
}

/**
 * Create full Siamese network for triplet training
 */
export function createSiameseNetwork(
    inputDim: number,
    config: Partial<ContrastiveConfig> = {}
): tf.LayersModel {
    const cfg: ContrastiveConfig = { ...DEFAULT_CONTRASTIVE_CONFIG, ...config };

    // Shared embedding network
    const embeddingNet = createEmbeddingNetwork(inputDim, config);

    // Three inputs: anchor, positive, negative
    const anchorInput = tf.input({ shape: [inputDim], name: 'anchor' });
    const positiveInput = tf.input({ shape: [inputDim], name: 'positive' });
    const negativeInput = tf.input({ shape: [inputDim], name: 'negative' });

    // Get embeddings (shared weights)
    const anchorEmb = embeddingNet.apply(anchorInput) as tf.SymbolicTensor;
    const positiveEmb = embeddingNet.apply(positiveInput) as tf.SymbolicTensor;
    const negativeEmb = embeddingNet.apply(negativeInput) as tf.SymbolicTensor;

    // Concatenate for loss computation
    const output = tf.layers.concatenate({ name: 'triplet_output' })
        .apply([anchorEmb, positiveEmb, negativeEmb]) as tf.SymbolicTensor;

    const model = tf.model({
        inputs: [anchorInput, positiveInput, negativeInput],
        outputs: output,
        name: 'siamese_network',
    });

    // Compile with triplet loss
    model.compile({
        optimizer: tf.train.adam(cfg.learningRate),
        loss: createTripletLossLayer(cfg.margin),
    });

    return model;
}

// ============================================
// EMBEDDING EXTRACTION
// ============================================

/**
 * Extract embedding for a single ad
 */
export async function extractEmbedding(
    embeddingNetwork: tf.LayersModel,
    features: number[]
): Promise<number[]> {
    const inputTensor = tf.tensor2d([features]);
    const embedding = embeddingNetwork.predict(inputTensor) as tf.Tensor;
    const values = Array.from(await embedding.data());

    inputTensor.dispose();
    embedding.dispose();

    return values;
}

/**
 * Find nearest neighbors in embedding space
 */
export function findNearestNeighbors(
    targetEmbedding: number[],
    allEmbeddings: Map<string, number[]>,
    topK: number = 5
): string[] {
    const distances: { id: string; dist: number }[] = [];

    for (const [id, embedding] of allEmbeddings.entries()) {
        const dist = euclideanDistance(targetEmbedding, embedding);
        distances.push({ id, dist });
    }

    distances.sort((a, b) => a.dist - b.dist);
    return distances.slice(0, topK).map(d => d.id);
}

// ============================================
// MODEL PERSISTENCE
// ============================================

const CONTRASTIVE_MODEL_KEY = 'ml_contrastive_model';
const EMBEDDINGS_CACHE_KEY = 'ml_contrastive_embeddings';

/**
 * Save contrastive model
 */
export async function saveContrastiveModel(model: tf.LayersModel): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        await model.save(`localstorage://${CONTRASTIVE_MODEL_KEY}`);
        console.log('[CONTRASTIVE] Model saved');
    } catch (error) {
        console.error('[CONTRASTIVE] Save failed:', error);
    }
}

/**
 * Load contrastive model
 */
export async function loadContrastiveModel(): Promise<tf.LayersModel | null> {
    if (typeof window === 'undefined') return null;

    try {
        return await tf.loadLayersModel(`localstorage://${CONTRASTIVE_MODEL_KEY}`);
    } catch {
        return null;
    }
}

/**
 * Cache embeddings for fast lookup
 */
export function cacheEmbeddings(embeddings: Map<string, number[]>): void {
    if (typeof window === 'undefined') return;
    const obj = Object.fromEntries(embeddings);
    localStorage.setItem(EMBEDDINGS_CACHE_KEY, JSON.stringify(obj));
}

/**
 * Load cached embeddings
 */
export function loadCachedEmbeddings(): Map<string, number[]> {
    if (typeof window === 'undefined') return new Map();
    const stored = localStorage.getItem(EMBEDDINGS_CACHE_KEY);
    if (!stored) return new Map();
    return new Map(Object.entries(JSON.parse(stored)));
}

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

const CONTRASTIVE_CONFIG_KEY = 'ml_contrastive_config';

/**
 * Get contrastive configuration
 */
export function getContrastiveConfig(): ContrastiveConfig {
    if (typeof window === 'undefined') return DEFAULT_CONTRASTIVE_CONFIG;
    const stored = localStorage.getItem(CONTRASTIVE_CONFIG_KEY);
    return stored ? { ...DEFAULT_CONTRASTIVE_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONTRASTIVE_CONFIG;
}

/**
 * Save contrastive configuration
 */
export function saveContrastiveConfig(config: Partial<ContrastiveConfig>): void {
    if (typeof window === 'undefined') return;
    const current = getContrastiveConfig();
    localStorage.setItem(CONTRASTIVE_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
}

/**
 * Get default contrastive configuration
 */
export function getDefaultContrastiveConfig(): ContrastiveConfig {
    return { ...DEFAULT_CONTRASTIVE_CONFIG };
}
