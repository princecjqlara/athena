// Time Decay System
// Weights recent data higher than old data to adapt to trends

import { TimeDecayConfig, AdEntry, FeatureWeight } from '@/types';

const CONFIG_KEY = 'ml_time_decay_config';

// Default time decay configuration
const DEFAULT_CONFIG: TimeDecayConfig = {
    enabled: true,
    decayRates: {
        thisWeek: 1.0,
        lastMonth: 0.8,
        threeMonths: 0.5,
        sixMonths: 0.3,
        older: 0.1,
    },
};

// Get time decay config
export function getTimeDecayConfig(): TimeDecayConfig {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const stored = localStorage.getItem(CONFIG_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
}

// Save config
export function saveTimeDecayConfig(config: TimeDecayConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// Calculate decay factor for a date
export function getDecayFactor(date: string | Date): number {
    const config = getTimeDecayConfig();
    if (!config.enabled) return 1.0;

    const now = new Date();
    const dataDate = new Date(date);
    const daysDiff = Math.floor((now.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 7) return config.decayRates.thisWeek;
    if (daysDiff <= 30) return config.decayRates.lastMonth;
    if (daysDiff <= 90) return config.decayRates.threeMonths;
    if (daysDiff <= 180) return config.decayRates.sixMonths;
    return config.decayRates.older;
}

// Apply time decay to a list of ads
export function applyTimeDecayToAds(ads: AdEntry[]): AdEntry[] {
    return ads.map(ad => {
        const decayFactor = getDecayFactor(ad.createdAt);
        return {
            ...ad,
            // Adjust success score by decay factor for trend analysis
            _timeDecayFactor: decayFactor,
            _decayedSuccessScore: ad.successScore
                ? Math.round(ad.successScore * decayFactor)
                : undefined,
        } as AdEntry & { _timeDecayFactor: number; _decayedSuccessScore?: number };
    });
}

// Apply time decay to weights calculation
export function getTimeDecayedWeight(
    weight: FeatureWeight,
    relevantAds: AdEntry[]
): number {
    if (relevantAds.length === 0) return weight.weight;

    const config = getTimeDecayConfig();
    if (!config.enabled) return weight.weight;

    // Calculate weighted average based on recency of relevant ads
    let totalWeight = 0;
    let totalDecay = 0;

    relevantAds.forEach(ad => {
        const decayFactor = getDecayFactor(ad.createdAt);
        totalWeight += weight.weight * decayFactor;
        totalDecay += decayFactor;
    });

    return totalDecay > 0 ? totalWeight / totalDecay : weight.weight;
}

// Detect concept drift (when a pattern stops working)
export function detectConceptDrift(
    feature: string,
    ads: AdEntry[],
    threshold: number = 0.3 // 30% drop
): { driftDetected: boolean; oldAverage: number; newAverage: number } {
    // Split ads into old (>3 months) and new (<1 month)
    const now = new Date();
    const oldAds = ads.filter(ad => {
        const daysDiff = Math.floor((now.getTime() - new Date(ad.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 90 && ad.successScore !== undefined;
    });
    const newAds = ads.filter(ad => {
        const daysDiff = Math.floor((now.getTime() - new Date(ad.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 30 && ad.successScore !== undefined;
    });

    if (oldAds.length < 3 || newAds.length < 3) {
        return { driftDetected: false, oldAverage: 0, newAverage: 0 };
    }

    // Calculate averages for ads with this feature
    const oldWithFeature = oldAds.filter(ad =>
        ad.extractedContent?.customTraits?.includes(feature) ||
        ad.extractedContent?.hookType === feature ||
        ad.extractedContent?.platform === feature
    );
    const newWithFeature = newAds.filter(ad =>
        ad.extractedContent?.customTraits?.includes(feature) ||
        ad.extractedContent?.hookType === feature ||
        ad.extractedContent?.platform === feature
    );

    if (oldWithFeature.length < 2 || newWithFeature.length < 2) {
        return { driftDetected: false, oldAverage: 0, newAverage: 0 };
    }

    const oldAverage = oldWithFeature.reduce((sum, ad) => sum + (ad.successScore || 0), 0) / oldWithFeature.length;
    const newAverage = newWithFeature.reduce((sum, ad) => sum + (ad.successScore || 0), 0) / newWithFeature.length;

    const drift = (oldAverage - newAverage) / oldAverage;
    const driftDetected = drift > threshold;

    if (driftDetected) {
        console.log(`[CONCEPT DRIFT] Detected for "${feature}": ${oldAverage.toFixed(1)}% → ${newAverage.toFixed(1)}%`);
    }

    return { driftDetected, oldAverage, newAverage };
}

// Get trend direction for a feature
export function getFeatureTrend(
    feature: string,
    ads: AdEntry[]
): 'rising' | 'falling' | 'stable' {
    const { driftDetected, oldAverage, newAverage } = detectConceptDrift(feature, ads, 0.1);

    if (!driftDetected && Math.abs(oldAverage - newAverage) < 5) {
        return 'stable';
    }

    return newAverage > oldAverage ? 'rising' : 'falling';
}
