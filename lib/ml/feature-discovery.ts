// Feature Discovery System
// Discovers new patterns from surprise successes using AI

import { DiscoveredMLFeature, AdEntry, ExtractedAdData } from '@/types';

const FEATURES_KEY = 'ml_discovered_features';

// Get all discovered features
export function getDiscoveredFeatures(): DiscoveredMLFeature[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(FEATURES_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Save discovered features
function saveDiscoveredFeatures(features: DiscoveredMLFeature[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
}

// Discover new features from a surprise success ad
export async function discoverFeaturesFromAd(
    ad: AdEntry,
    reason: 'surprise_success' | 'surprise_failure' | 'pattern_analysis'
): Promise<DiscoveredMLFeature[]> {
    const discovered: DiscoveredMLFeature[] = [];

    try {
        // Call AI to discover hidden patterns
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'discover-features',
                data: {
                    adContent: ad.extractedContent,
                    adResults: ad.extractedResults,
                    adDocument: ad.contentDocument,
                    reason,
                },
            }),
        });

        const result = await response.json();

        if (result.success && result.data?.discoveredFeatures) {
            for (const feature of result.data.discoveredFeatures) {
                const newFeature: DiscoveredMLFeature = {
                    id: `feat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: feature.name,
                    description: feature.description,
                    discoveredFrom: ad.id,
                    discoveredAt: new Date().toISOString(),
                    discoveryReason: reason,
                    validatedAgainst: [],
                    successCorrelation: feature.correlation || 50,
                    isValidated: false,
                    isActive: false,
                    featureType: feature.type || 'other',
                    detectionCriteria: feature.criteria || `Presence of ${feature.name}`,
                    exampleValue: feature.exampleValue,
                };
                discovered.push(newFeature);
            }
        }
    } catch (error) {
        console.error('Feature discovery error:', error);
        // Fallback: extract custom traits from ad data
        const fallbackFeatures = extractFallbackFeatures(ad.extractedContent, reason);
        discovered.push(...fallbackFeatures);
    }

    if (discovered.length > 0) {
        const existing = getDiscoveredFeatures();
        existing.push(...discovered);
        saveDiscoveredFeatures(existing);
    }

    return discovered;
}

// Fallback feature extraction
function extractFallbackFeatures(
    content: ExtractedAdData,
    reason: 'surprise_success' | 'surprise_failure' | 'pattern_analysis'
): DiscoveredMLFeature[] {
    const features: DiscoveredMLFeature[] = [];

    // Look at AI-discovered metrics from content
    if (content.aiDiscoveredMetrics) {
        for (const metric of content.aiDiscoveredMetrics) {
            if (metric.importance === 'high') {
                features.push({
                    id: `feat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: metric.name,
                    description: metric.description,
                    discoveredFrom: 'content_analysis',
                    discoveredAt: new Date().toISOString(),
                    discoveryReason: reason,
                    validatedAgainst: [],
                    successCorrelation: 60,
                    isValidated: false,
                    isActive: false,
                    featureType: 'other',
                    detectionCriteria: `Look for ${metric.name}`,
                    exampleValue: String(metric.value),
                });
            }
        }
    }

    // Extract unusual combinations as potential features
    if (content.hookVelocity === 'instant' && content.sceneVelocity === 'fast') {
        features.push({
            id: `feat-${Date.now()}-velocity`,
            name: 'high_velocity_combo',
            description: 'Instant hook with fast scene velocity',
            discoveredFrom: 'pattern_analysis',
            discoveredAt: new Date().toISOString(),
            discoveryReason: reason,
            validatedAgainst: [],
            successCorrelation: 55,
            isValidated: false,
            isActive: false,
            featureType: 'visual',
            detectionCriteria: 'hookVelocity=instant AND sceneVelocity=fast',
        });
    }

    return features;
}

// Validate a discovered feature against other ads
export function validateFeature(
    featureId: string,
    ads: AdEntry[]
): { validationScore: number; matchingAds: string[] } {
    const features = getDiscoveredFeatures();
    const feature = features.find(f => f.id === featureId);

    if (!feature) return { validationScore: 0, matchingAds: [] };

    const matchingAds: string[] = [];
    let successSum = 0;
    let matchCount = 0;

    // Look for similar patterns in other successful ads
    ads.forEach(ad => {
        if (ad.successScore && ad.successScore >= 70) {
            // Check if this ad has similar traits
            const content = ad.extractedContent;
            if (content.customTraits?.includes(feature.name) ||
                content.aiDiscoveredMetrics?.some(m => m.name === feature.name)) {
                matchingAds.push(ad.id);
                successSum += ad.successScore;
                matchCount++;
            }
        }
    });

    const validationScore = matchCount > 0
        ? Math.round(successSum / matchCount)
        : 0;

    // Update feature validation status
    const featureIndex = features.findIndex(f => f.id === featureId);
    if (featureIndex !== -1) {
        features[featureIndex].validatedAgainst = matchingAds;
        features[featureIndex].successCorrelation = validationScore;
        features[featureIndex].isValidated = matchCount >= 2; // Need at least 2 matches
        features[featureIndex].isActive = matchCount >= 2 && validationScore >= 70;
        saveDiscoveredFeatures(features);
    }

    return { validationScore, matchingAds };
}

// Get active (validated) features
export function getActiveFeatures(): DiscoveredMLFeature[] {
    return getDiscoveredFeatures().filter(f => f.isActive);
}

// Get pending (unvalidated) features
export function getPendingFeatures(): DiscoveredMLFeature[] {
    return getDiscoveredFeatures().filter(f => !f.isValidated);
}

// Delete a feature
export function deleteFeature(featureId: string): void {
    const features = getDiscoveredFeatures();
    const filtered = features.filter(f => f.id !== featureId);
    saveDiscoveredFeatures(filtered);
}
