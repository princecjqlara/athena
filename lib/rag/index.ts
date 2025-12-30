/**
 * RAG Module Index
 * 
 * RAG-Based Similarity & Contrastive Reasoning Layer
 * Exports all RAG functionality for easy imports.
 */

// Types
export type {
    AdOrb,
    NeighborAd,
    TraitEffect,
    ContrastiveAnalysis,
    RAGPrediction,
    ExplanationDetail,
    ExperimentSuggestion,
    RetrievalFilters,
    RAGConfig,
    StoredOrb,
    OrbStoreState,
} from './types';

export { DEFAULT_RAG_CONFIG } from './types';

// AdOrb conversion
export {
    convertToAdOrb,
    convertManyToAdOrbs,
    getOrbTraitList,
    orbHasTrait,
    getOrbSuccessScore,
    orbHasResults,
    getSharedTraits,
    getDifferentTraits,
} from './ad-orb';

// Embedding generation
export {
    buildCanonicalText,
    generateEmbedding,
    generateOrbEmbedding,
    generateOrbEmbeddingsBatch,
} from './build-embedding';

// Similarity scoring
export {
    computeVectorSimilarity,
    computeStructuredSimilarity,
    computeHybridSimilarity,
    computeRecencyWeight,
    scoreNeighbor,
    scoreNeighbors,
} from './similarity-score';

// Similar ad retrieval
export {
    retrieveSimilarAds,
    retrieveSimilarAdsWithResults,
    retrieveSimilarAdsForPlatform,
    getNeighborStats,
    hasEnoughNeighbors,
} from './retrieve-similar';

// Contrastive analysis
export {
    splitByTrait,
    computeLift,
    analyzeTraitEffect,
    analyzeAllTraitEffects,
    analyzeQueryTraitEffects,
    performContrastiveAnalysis,
    getTopImpactfulTraits,
    getTraitsNeedingMoreData,
} from './contrastive-analysis';

// Neighbor prediction
export {
    computeWeightedPrediction,
    computeSimpleAveragePrediction,
    computeVariance,
    computeScoreRange,
    computeConfidence,
    calculateBlendAlpha,
    getPredictionBounds,
    computeNeighborPrediction,
} from './neighbor-prediction';

// Main RAG prediction
export {
    predictWithRAG,
    predictWithRAGOnly,
    predictBatchWithRAG,
    analyzeAdTraits,
} from './rag-predict';

// Explanation generation
export {
    generateExperimentSuggestions,
    generateRecommendations,
    generateExplanation,
    generateSimpleExplanation,
} from './explanation';

// Orb storage
export {
    saveOrb,
    saveOrbs,
    getOrb,
    getAllOrbs,
    getOrbsWithResults,
    getOrbsWithEmbeddings,
    getOrbsNeedingEmbeddings,
    deleteOrb,
    clearOrbStore,
    getOrbStoreState,
    hasOrbs,
    getOrbCount,
    updateOrbEmbedding,
    orbHasEmbedding,
    getOrbsByPlatform,
    getOrbsByDateRange,
    getOrbsByMinSuccessScore,
} from './orb-store';

// Safety infrastructure
export {
    getFlags,
    setFlag,
    setFlags,
    resetFlags,
    isRAGEnabled,
    isContrastiveEnabled,
    isMarketplaceEnabled,
    isDebugLoggingEnabled,
} from './feature-flags';

export type { RAGFeatureFlags } from './feature-flags';

export {
    SAFETY_CONFIG,
    clampScore,
    isValidScore,
    clampLift,
    hasEnoughDataForRAG,
    isVarianceTooHigh,
    withTimeout,
    safeExecute,
} from './safety-config';

export {
    safePredict,
    safePredictBatch,
    isRAGReady,
    getPredictionReadiness,
} from './safe-predict';

export type { SafePredictionOptions, SafePredictionResult } from './safe-predict';

export {
    logPrediction,
    logError,
    logFallback,
    getPredictionLogs,
    getErrorLogs,
    getPredictionStats,
    clearLogs,
} from './logging';

export type { PredictionLog, FallbackReason, ErrorLog } from './logging';
