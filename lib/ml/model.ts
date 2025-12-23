import * as tf from '@tensorflow/tfjs';
import { VideoMetadata, AdPerformance, PredictionResult, PredictionFactor } from '@/types';
import {
    extractAllFeatures,
    getFeatureNames,
    calculateSuccessScore,
    normalizeFeatures
} from './features';

// Number of input features
const NUM_FEATURES = 17;

// Model singleton
let model: tf.Sequential | null = null;
let isModelTrained = false;

// Training data storage
interface TrainingData {
    features: number[][];
    labels: number[];
}

let trainingData: TrainingData = {
    features: [],
    labels: [],
};

// Create the neural network model
export const createModel = (): tf.Sequential => {
    const newModel = tf.sequential();

    // Input layer
    newModel.add(tf.layers.dense({
        units: 32,
        activation: 'relu',
        inputShape: [NUM_FEATURES],
    }));

    // Hidden layers
    newModel.add(tf.layers.dropout({ rate: 0.2 }));
    newModel.add(tf.layers.dense({
        units: 16,
        activation: 'relu',
    }));

    newModel.add(tf.layers.dropout({ rate: 0.1 }));
    newModel.add(tf.layers.dense({
        units: 8,
        activation: 'relu',
    }));

    // Output layer (success probability)
    newModel.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
    }));

    // Compile the model
    newModel.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
    });

    return newModel;
};

// Initialize or get the model
export const getModel = (): tf.Sequential => {
    if (!model) {
        model = createModel();
    }
    return model;
};

// Add training data point
export const addTrainingData = (
    metadata: VideoMetadata,
    performance: AdPerformance
): void => {
    const features = normalizeFeatures(extractAllFeatures(metadata, performance));
    const label = calculateSuccessScore(performance);

    trainingData.features.push(features);
    trainingData.labels.push(label);
};

// Train the model with accumulated data
export const trainModel = async (
    epochs: number = 50,
    onProgress?: (epoch: number, logs: tf.Logs) => void
): Promise<tf.History> => {
    if (trainingData.features.length < 5) {
        throw new Error('Need at least 5 data points to train the model');
    }

    const currentModel = getModel();

    // Convert training data to tensors
    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1]);

    // Train the model
    const history = await currentModel.fit(xs, ys, {
        epochs,
        batchSize: Math.min(32, trainingData.features.length),
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (onProgress && logs) {
                    onProgress(epoch, logs);
                }
            },
        },
    });

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    isModelTrained = true;
    return history;
};

// Make a prediction for new video
export const predict = async (
    metadata: Partial<VideoMetadata>,
    campaignDetails?: Partial<AdPerformance>
): Promise<PredictionResult> => {
    const currentModel = getModel();

    // Extract and normalize features
    const features = normalizeFeatures(extractAllFeatures(metadata, campaignDetails));

    // If model is not trained, use heuristic prediction
    if (!isModelTrained || trainingData.features.length < 5) {
        return heuristicPrediction(features, metadata, campaignDetails);
    }

    // Make prediction with trained model
    const inputTensor = tf.tensor2d([features]);
    const prediction = currentModel.predict(inputTensor) as tf.Tensor;
    const probability = (await prediction.data())[0];

    // Clean up
    inputTensor.dispose();
    prediction.dispose();

    // Calculate confidence based on training data size
    const confidence = Math.min(0.95, 0.5 + (trainingData.features.length / 100));

    // Analyze factors
    const factors = analyzeFactors(features);

    // Generate recommendations
    const recommendations = generateRecommendations(features, factors);

    return {
        success_probability: Math.round(probability * 100),
        confidence: Math.round(confidence * 100),
        top_factors: factors,
        recommendations,
        similar_videos: [], // Would be populated from database
    };
};

// Heuristic prediction when model is not trained
const heuristicPrediction = (
    features: number[],
    metadata: Partial<VideoMetadata>,
    _campaignDetails?: Partial<AdPerformance>
): PredictionResult => {
    // Calculate average of features as base probability
    const avgFeature = features.reduce((a, b) => a + b, 0) / features.length;
    const probability = Math.round(avgFeature * 100);

    const factors = analyzeFactors(features);
    const recommendations = generateRecommendations(features, factors);

    return {
        success_probability: probability,
        confidence: 40, // Low confidence without training data
        top_factors: factors,
        recommendations,
        similar_videos: [],
    };
};

// Analyze which factors contribute most to prediction
const analyzeFactors = (features: number[]): PredictionFactor[] => {
    const featureNames = getFeatureNames();

    const factors: PredictionFactor[] = features.map((value, index) => ({
        factor: featureNames[index],
        impact: value > 0.7 ? 'positive' : value < 0.4 ? 'negative' : 'neutral',
        weight: value,
    }));

    // Sort by absolute distance from neutral (0.5)
    factors.sort((a, b) => Math.abs(b.weight - 0.5) - Math.abs(a.weight - 0.5));

    // Return top 5 factors
    return factors.slice(0, 5);
};

// Generate actionable recommendations
const generateRecommendations = (
    features: number[],
    factors: PredictionFactor[]
): string[] => {
    const recommendations: string[] = [];
    const featureNames = getFeatureNames();

    // Find weak areas (features below 0.5)
    features.forEach((value, index) => {
        if (value < 0.5) {
            switch (featureNames[index]) {
                case 'Hook Type':
                    recommendations.push('Try using a more engaging hook like curiosity, shock, or before/after transformation');
                    break;
                case 'UGC Style':
                    recommendations.push('Consider using UGC-style content for higher authenticity and engagement');
                    break;
                case 'Subtitles':
                    recommendations.push('Add subtitles to increase accessibility and watch time');
                    break;
                case 'Text Overlays':
                    recommendations.push('Add text overlays to reinforce key messages');
                    break;
                case 'Music Type':
                    recommendations.push('Use trending music or upbeat tracks to boost engagement');
                    break;
                case 'Launch Time':
                    recommendations.push('Consider launching during evening hours (5-9 PM) for better reach');
                    break;
            }
        }
    });

    // Add general recommendations based on positive factors
    const positiveFactor = factors.find(f => f.impact === 'positive');
    if (positiveFactor) {
        recommendations.push(`Your ${positiveFactor.factor.toLowerCase()} is strong - keep using this approach`);
    }

    return recommendations.slice(0, 4);
};

// Save model to localStorage
export const saveModel = async (): Promise<void> => {
    if (model && isModelTrained) {
        await model.save('localstorage://ads-algorithm-model');
        localStorage.setItem('ads-algorithm-training-data', JSON.stringify(trainingData));
    }
};

// Load model from localStorage
export const loadModel = async (): Promise<boolean> => {
    try {
        model = (await tf.loadLayersModel('localstorage://ads-algorithm-model')) as tf.Sequential;

        const savedData = localStorage.getItem('ads-algorithm-training-data');
        if (savedData) {
            trainingData = JSON.parse(savedData);
        }

        isModelTrained = trainingData.features.length >= 5;
        return true;
    } catch {
        return false;
    }
};

// Get training data count
export const getTrainingDataCount = (): number => {
    return trainingData.features.length;
};

// Check if model is ready for predictions
export const isModelReady = (): boolean => {
    return isModelTrained && trainingData.features.length >= 5;
};

// Reset the model
export const resetModel = (): void => {
    if (model) {
        model.dispose();
    }
    model = null;
    isModelTrained = false;
    trainingData = { features: [], labels: [] };
    localStorage.removeItem('ads-algorithm-model');
    localStorage.removeItem('ads-algorithm-training-data');
};
