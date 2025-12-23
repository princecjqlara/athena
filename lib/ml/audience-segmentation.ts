// Audience Segmentation System
// Context-specific scoring per audience segment

import { AudienceSegment, FeatureWeight, AdEntry } from '@/types';

const SEGMENTS_KEY = 'ml_audience_segments';

// Default audience segments
const DEFAULT_SEGMENTS: AudienceSegment[] = [
    {
        id: 'gen-z',
        name: 'Gen Z',
        description: 'Young adults 18-24',
        ageRange: { min: 18, max: 24 },
        gender: 'all',
        interests: ['entertainment', 'trends', 'social media'],
        platforms: ['tiktok', 'instagram'],
        featureWeights: [
            { feature: 'ugc_style', category: 'content', weight: 0.95, confidenceLevel: 80, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'trending_audio', category: 'audio', weight: 0.9, confidenceLevel: 75, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'rising', trendStrength: 50 },
            { feature: 'fast_cuts', category: 'visual', weight: 0.8, confidenceLevel: 70, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'shaky_camera', category: 'visual', weight: 0.3, confidenceLevel: 60, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'rising', trendStrength: 40 },
        ],
        totalAds: 0,
        avgSuccessRate: 0,
        isActive: true,
        lastUpdated: new Date().toISOString(),
    },
    {
        id: 'millennials',
        name: 'Millennials',
        description: 'Adults 25-40',
        ageRange: { min: 25, max: 40 },
        gender: 'all',
        interests: ['lifestyle', 'finance', 'wellness'],
        platforms: ['instagram', 'facebook', 'youtube'],
        featureWeights: [
            { feature: 'professional', category: 'content', weight: 0.7, confidenceLevel: 65, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'voiceover', category: 'audio', weight: 0.65, confidenceLevel: 60, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'subtitles', category: 'visual', weight: 0.8, confidenceLevel: 75, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
        ],
        totalAds: 0,
        avgSuccessRate: 0,
        isActive: true,
        lastUpdated: new Date().toISOString(),
    },
    {
        id: 'gen-z-male',
        name: 'Gen Z Male',
        description: 'Young men 18-24',
        ageRange: { min: 18, max: 24 },
        gender: 'male',
        interests: ['gaming', 'sports', 'tech'],
        platforms: ['tiktok', 'youtube'],
        featureWeights: [
            { feature: 'ugc_style', category: 'content', weight: 0.85, confidenceLevel: 70, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'shock', category: 'hook_type', weight: 0.8, confidenceLevel: 65, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'fast_cuts', category: 'visual', weight: 0.85, confidenceLevel: 70, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
        ],
        totalAds: 0,
        avgSuccessRate: 0,
        isActive: true,
        lastUpdated: new Date().toISOString(),
    },
    {
        id: 'gen-z-female',
        name: 'Gen Z Female',
        description: 'Young women 18-24',
        ageRange: { min: 18, max: 24 },
        gender: 'female',
        interests: ['beauty', 'fashion', 'wellness'],
        platforms: ['tiktok', 'instagram'],
        featureWeights: [
            { feature: 'ugc_style', category: 'content', weight: 0.95, confidenceLevel: 80, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'transformation', category: 'hook_type', weight: 0.85, confidenceLevel: 75, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
            { feature: 'trending_audio', category: 'audio', weight: 0.9, confidenceLevel: 80, sampleSize: 0, lastUpdated: new Date().toISOString(), trend: 'stable', trendStrength: 0 },
        ],
        totalAds: 0,
        avgSuccessRate: 0,
        isActive: true,
        lastUpdated: new Date().toISOString(),
    },
];

// Get all audience segments
export function getAudienceSegments(): AudienceSegment[] {
    if (typeof window === 'undefined') return DEFAULT_SEGMENTS;
    const stored = localStorage.getItem(SEGMENTS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SEGMENTS;
}

// Save segments
function saveAudienceSegments(segments: AudienceSegment[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SEGMENTS_KEY, JSON.stringify(segments));
}

// Get segment by ID
export function getSegmentById(id: string): AudienceSegment | undefined {
    return getAudienceSegments().find(s => s.id === id);
}

// Get weight for a feature in a specific segment
export function getSegmentWeight(segmentId: string, feature: string): number {
    const segment = getSegmentById(segmentId);
    if (!segment) return 0;

    const weight = segment.featureWeights.find(w => w.feature === feature);
    return weight ? weight.weight : 0;
}

// Calculate segment-specific score
export function calculateSegmentScore(
    segmentId: string,
    features: { feature: string; present: boolean }[]
): number {
    const segment = getSegmentById(segmentId);
    if (!segment) return 50; // Default score

    let score = 50;
    features.forEach(({ feature, present }) => {
        if (present) {
            const weight = segment.featureWeights.find(w => w.feature === feature);
            if (weight) {
                score += weight.weight * 10;
            }
        }
    });

    return Math.max(0, Math.min(100, Math.round(score)));
}

// Update segment weights based on results
export function updateSegmentWeights(
    segmentId: string,
    ad: AdEntry,
    actualScore: number
): void {
    const segments = getAudienceSegments();
    const segmentIndex = segments.findIndex(s => s.id === segmentId);

    if (segmentIndex === -1) return;

    const segment = segments[segmentIndex];
    const content = ad.extractedContent;
    const learningRate = 0.1;

    // Determine features present in this ad
    const featuresPresent: string[] = [];
    if (content.isUGCStyle) featuresPresent.push('ugc_style');
    if (content.hasSubtitles) featuresPresent.push('subtitles');
    if (content.editingStyle === 'fast_cuts') featuresPresent.push('fast_cuts');
    if (content.musicType === 'trending') featuresPresent.push('trending_audio');
    if (content.hasVoiceover) featuresPresent.push('voiceover');
    featuresPresent.push(content.hookType);

    // Calculate current prediction for this segment
    const currentScore = calculateSegmentScore(segmentId,
        featuresPresent.map(f => ({ feature: f, present: true }))
    );

    const delta = (actualScore - currentScore) / 100;

    // Adjust weights for features present
    featuresPresent.forEach(feature => {
        const weightIndex = segment.featureWeights.findIndex(w => w.feature === feature);
        if (weightIndex !== -1) {
            const w = segment.featureWeights[weightIndex];
            w.previousWeight = w.weight;
            w.weight = Math.max(-1, Math.min(1, w.weight + delta * learningRate));
            w.lastUpdated = new Date().toISOString();
            w.sampleSize += 1;
        }
    });

    // Update segment stats
    segment.totalAds += 1;
    segment.avgSuccessRate = Math.round(
        ((segment.avgSuccessRate * (segment.totalAds - 1)) + actualScore) / segment.totalAds
    );
    segment.lastUpdated = new Date().toISOString();

    saveAudienceSegments(segments);
}

// Add a custom segment
export function addAudienceSegment(segment: Omit<AudienceSegment, 'id'>): AudienceSegment {
    const segments = getAudienceSegments();

    const newSegment: AudienceSegment = {
        ...segment,
        id: `segment-${Date.now()}`,
    };

    segments.push(newSegment);
    saveAudienceSegments(segments);

    return newSegment;
}

// Get scores for all segments
export function getAllSegmentScores(
    features: { feature: string; present: boolean }[]
): { segmentId: string; segmentName: string; score: number }[] {
    const segments = getAudienceSegments();

    return segments
        .filter(s => s.isActive)
        .map(segment => ({
            segmentId: segment.id,
            segmentName: segment.name,
            score: calculateSegmentScore(segment.id, features),
        }))
        .sort((a, b) => b.score - a.score);
}

// Find best segment for given features
export function findBestSegment(
    features: { feature: string; present: boolean }[]
): { segment: AudienceSegment; score: number } | null {
    const scores = getAllSegmentScores(features);
    if (scores.length === 0) return null;

    const best = scores[0];
    const segment = getSegmentById(best.segmentId);

    return segment ? { segment, score: best.score } : null;
}
