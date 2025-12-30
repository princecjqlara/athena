'use client';

import { useEffect, useRef, useCallback } from 'react';
import { generateAdPrediction, adjustPredictionWithMetrics } from '@/lib/prediction-utils';

const SYNC_SETTINGS_KEY = 'fb_sync_settings';
const SYNC_CACHE_KEY = 'fb_sync_cache';
const DEFAULT_SYNC_INTERVAL = 15; // 15 minutes
const DEFAULT_MIN_SYNC_INTERVAL = 5; // Minimum 5 minutes between syncs

interface FacebookMetrics {
    impressions?: number;
    reach?: number;
    clicks?: number;
    ctr?: number;
    spend?: number;
    cpc?: number;
    cpm?: number;
    frequency?: number;
    resultType?: string;
    results?: number;
    costPerResult?: number;
    linkClicks?: number;
    landingPageViews?: number;
    pageEngagement?: number;
    postReactions?: number;
    postComments?: number;
    postShares?: number;
    leads?: number;
    purchases?: number;
    messagesStarted?: number;
    costPerMessage?: number;
    videoViews?: number;
    videoThruPlays?: number;
    qualityRanking?: string;
    engagementRateRanking?: string;
    conversionRateRanking?: string;
    [key: string]: unknown;
}

interface FacebookAd {
    id: string;
    name: string;
    effectiveStatus: string;
    metrics: FacebookMetrics | null;
    [key: string]: unknown;
}

interface StoredAd {
    id: string;
    facebookAdId?: string;
    name?: string;
    adInsights?: Record<string, unknown>;
    successScore?: number;
    scoreReasoning?: string[];
    hasResults?: boolean;
    lastSyncedAt?: string;
    predictedScore?: number;
    predictionDetails?: unknown;
    riskAssessment?: unknown;
    predictionGeneratedAt?: string;
    extractedContent?: Record<string, unknown>;
    status?: string;
    effectiveStatus?: string;
    [key: string]: unknown;
}

/**
 * BackgroundSyncProvider - Runs Facebook ad sync in the background globally.
 * This component should be placed in the AppWrapper so it persists across all pages.
 * It ensures ads are synced automatically even when the user is not on the /myads page.
 */
export function BackgroundSyncProvider({ children }: { children: React.ReactNode }) {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);
    const isSyncingRef = useRef(false);

    // Get sync settings from localStorage
    const getSyncSettings = useCallback(() => {
        if (typeof window === 'undefined') return { autoSyncEnabled: true, syncIntervalMinutes: DEFAULT_SYNC_INTERVAL, minSyncIntervalMinutes: DEFAULT_MIN_SYNC_INTERVAL };

        try {
            const saved = localStorage.getItem(SYNC_SETTINGS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    autoSyncEnabled: parsed.autoSyncEnabled ?? true,
                    syncIntervalMinutes: parsed.syncIntervalMinutes ?? DEFAULT_SYNC_INTERVAL,
                    minSyncIntervalMinutes: parsed.minSyncIntervalMinutes ?? DEFAULT_MIN_SYNC_INTERVAL,
                };
            }
        } catch (e) {
            console.error('[BackgroundSync] Error reading settings:', e);
        }
        return { autoSyncEnabled: true, syncIntervalMinutes: DEFAULT_SYNC_INTERVAL, minSyncIntervalMinutes: DEFAULT_MIN_SYNC_INTERVAL };
    }, []);

    // Check if we should skip sync based on cache
    const shouldSkipSync = useCallback((): { skip: boolean; reason: string | null } => {
        if (typeof window === 'undefined') return { skip: true, reason: 'Not in browser' };

        const settings = getSyncSettings();
        const cacheStr = localStorage.getItem(SYNC_CACHE_KEY);

        if (cacheStr) {
            try {
                const cache = JSON.parse(cacheStr);
                const lastSync = new Date(cache.lastSyncedAt);
                const now = new Date();
                const minutesSinceLast = (now.getTime() - lastSync.getTime()) / (1000 * 60);

                if (minutesSinceLast < settings.minSyncIntervalMinutes) {
                    return {
                        skip: true,
                        reason: `Data is fresh (synced ${Math.round(minutesSinceLast)}m ago)`
                    };
                }
            } catch (e) {
                // Invalid cache, continue with sync
            }
        }

        return { skip: false, reason: null };
    }, [getSyncSettings]);

    // Main background sync function
    const runBackgroundSync = useCallback(async () => {
        if (typeof window === 'undefined') return;
        if (isSyncingRef.current) {
            console.log('[BackgroundSync] Sync already in progress, skipping...');
            return;
        }

        const settings = getSyncSettings();
        if (!settings.autoSyncEnabled) {
            console.log('[BackgroundSync] Auto-sync is disabled');
            return;
        }

        // Check if we should skip
        const skipCheck = shouldSkipSync();
        if (skipCheck.skip) {
            console.log(`[BackgroundSync] ⏭️ Skipping: ${skipCheck.reason}`);
            return;
        }

        // Get credentials
        const adAccountId = localStorage.getItem('meta_ad_account_id');
        const accessToken = localStorage.getItem('meta_marketing_token');

        if (!adAccountId || !accessToken) {
            console.log('[BackgroundSync] No Facebook credentials found');
            return;
        }

        isSyncingRef.current = true;
        console.log('[BackgroundSync] 🔄 Starting background sync...');

        try {
            // Fetch fresh data from Facebook
            const response = await fetch(
                `/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${accessToken}&status=all`
            );
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch ads from Facebook');
            }

            // Create lookup map
            const facebookAdsMap = new Map<string, FacebookAd>();
            data.data.forEach((ad: FacebookAd) => {
                facebookAdsMap.set(ad.id, ad);
            });

            // Get stored ads and update
            const storedAds: StoredAd[] = JSON.parse(localStorage.getItem('ads') || '[]');
            let updatedCount = 0;

            const updatedAds = storedAds.map((ad: StoredAd) => {
                if (ad.facebookAdId && facebookAdsMap.has(ad.facebookAdId)) {
                    const fbAd = facebookAdsMap.get(ad.facebookAdId)!;

                    if (fbAd.metrics) {
                        updatedCount++;
                        const m = fbAd.metrics;

                        // Calculate success score
                        let score = 0, factors = 0;
                        const syncReasoning: string[] = [];

                        // CTR (0-35 pts)
                        if (m.ctr && m.ctr > 0) {
                            score += Math.min(35, m.ctr * 10);
                            factors++;
                            if (m.ctr >= 3) syncReasoning.push(`Excellent CTR (${m.ctr.toFixed(2)}%)`);
                            else if (m.ctr >= 1.5) syncReasoning.push(`Good CTR (${m.ctr.toFixed(2)}%)`);
                        }

                        // Results (0-35 pts)
                        if (m.results && m.results > 0 && m.impressions && m.impressions > 0) {
                            score += Math.min(35, (m.results / m.impressions) * 1000);
                            factors++;
                            syncReasoning.push(`${m.results} results`);
                        } else if (m.messagesStarted && m.messagesStarted > 0) {
                            score += Math.min(35, m.messagesStarted * 4);
                            factors++;
                            syncReasoning.push(`${m.messagesStarted} conversations`);
                        } else if (m.leads && m.leads > 0) {
                            score += Math.min(35, m.leads * 5);
                            factors++;
                            syncReasoning.push(`${m.leads} leads`);
                        }

                        // Spend efficiency (0-20 pts)
                        if (m.spend && m.spend > 0) {
                            const resultCount = m.results || m.leads || m.messagesStarted || 0;
                            if (resultCount > 0) {
                                const costPerResult = m.spend / resultCount;
                                if (costPerResult < 50) { score += 20; syncReasoning.push(`₱${costPerResult.toFixed(0)}/result`); }
                                else if (costPerResult < 100) { score += 15; syncReasoning.push(`₱${costPerResult.toFixed(0)}/result`); }
                                else if (costPerResult < 200) { score += 10; syncReasoning.push(`₱${costPerResult.toFixed(0)}/result`); }
                                else if (costPerResult < 500) { score += 5; }
                                factors++;
                            } else if (m.spend > 100) {
                                score = Math.max(0, score - 10);
                                syncReasoning.push(`₱${m.spend.toFixed(0)} spent, no results`);
                            }
                        }

                        // Engagement (0-10 pts)
                        if (m.pageEngagement && m.pageEngagement > 0 && m.impressions && m.impressions > 0) {
                            score += Math.min(10, (m.pageEngagement / m.impressions) * 200);
                            factors++;
                        }

                        const successScore = factors > 0 ? Math.round(Math.min(100, score)) : undefined;
                        if (successScore !== undefined) {
                            if (successScore >= 80) syncReasoning.unshift('Top Performer');
                            else if (successScore >= 60) syncReasoning.unshift('Above Average');
                            else if (successScore >= 40) syncReasoning.unshift('Average');
                            else syncReasoning.unshift('Below Average');
                        }

                        return {
                            ...ad,
                            adInsights: {
                                impressions: m.impressions,
                                reach: m.reach,
                                clicks: m.clicks,
                                ctr: m.ctr,
                                spend: m.spend,
                                cpc: m.cpc,
                                cpm: m.cpm,
                                frequency: m.frequency,
                                resultType: m.resultType,
                                results: m.results,
                                costPerResult: m.costPerResult,
                                linkClicks: m.linkClicks,
                                landingPageViews: m.landingPageViews,
                                pageEngagement: m.pageEngagement,
                                postReactions: m.postReactions,
                                postComments: m.postComments,
                                postShares: m.postShares,
                                leads: m.leads,
                                purchases: m.purchases,
                                messagesStarted: m.messagesStarted,
                                costPerMessage: m.costPerMessage,
                                videoViews: m.videoViews,
                                videoThruPlays: m.videoThruPlays,
                                qualityRanking: m.qualityRanking,
                                engagementRateRanking: m.engagementRateRanking,
                                conversionRateRanking: m.conversionRateRanking,
                            },
                            hasResults: true,
                            successScore: successScore || ad.successScore,
                            scoreReasoning: syncReasoning.length > 0 ? syncReasoning : ad.scoreReasoning,
                            status: fbAd.effectiveStatus,
                            lastSyncedAt: new Date().toISOString(),
                        };
                    }
                }
                return ad;
            });

            // Save updated ads
            localStorage.setItem('ads', JSON.stringify(updatedAds));

            // Update predictions for synced ads
            let predictionsUpdated = 0;
            try {
                for (const ad of updatedAds) {
                    if (ad.facebookAdId && ad.adInsights && ad.lastSyncedAt) {
                        const basePrediction = await generateAdPrediction(ad as unknown as Record<string, unknown>);
                        const adjustedPrediction = adjustPredictionWithMetrics(basePrediction, ad.adInsights as Record<string, unknown>);

                        ad.predictedScore = adjustedPrediction.predictedScore;
                        ad.predictionDetails = adjustedPrediction.predictionDetails;
                        ad.riskAssessment = adjustedPrediction.riskAssessment;
                        ad.predictionGeneratedAt = adjustedPrediction.generatedAt;
                        predictionsUpdated++;
                    }
                }

                if (predictionsUpdated > 0) {
                    localStorage.setItem('ads', JSON.stringify(updatedAds));
                }
            } catch (predError) {
                console.error('[BackgroundSync] Error updating predictions:', predError);
            }

            const now = new Date();
            console.log(`[BackgroundSync] ✅ Synced ${updatedCount} ads, updated ${predictionsUpdated} predictions`);

            // Save to cache
            localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify({
                lastSyncedAt: now.toISOString(),
                adsUpdated: updatedCount
            }));

            // Update settings with last sync time
            const currentSettings = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || '{}');
            localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify({
                ...currentSettings,
                lastSyncedAt: now.toISOString()
            }));

            // Dispatch custom event so other components can react
            window.dispatchEvent(new CustomEvent('facebook-sync-complete', {
                detail: { updatedCount, predictionsUpdated, source: 'background' }
            }));

        } catch (error) {
            console.error('[BackgroundSync] ❌ Sync failed:', error);
        } finally {
            isSyncingRef.current = false;
        }
    }, [getSyncSettings, shouldSkipSync]);

    // Set up the background sync interval
    useEffect(() => {
        if (typeof window === 'undefined') return;

        mountedRef.current = true;

        // Initial sync after a short delay
        const initialTimer = setTimeout(() => {
            if (mountedRef.current) {
                runBackgroundSync();
            }
        }, 5000); // Wait 5 seconds after app loads

        // Set up recurring interval
        const setupInterval = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            const settings = getSyncSettings();
            if (settings.autoSyncEnabled && settings.syncIntervalMinutes > 0) {
                const intervalMs = settings.syncIntervalMinutes * 60 * 1000;
                console.log(`[BackgroundSync] 🔁 Setting up background sync every ${settings.syncIntervalMinutes} minutes`);

                intervalRef.current = setInterval(() => {
                    if (mountedRef.current) {
                        runBackgroundSync();
                    }
                }, intervalMs);
            }
        };

        setupInterval();

        // Listen for settings changes to update interval
        const handleSettingsChange = () => {
            setupInterval();
        };

        window.addEventListener('storage', handleSettingsChange);

        return () => {
            mountedRef.current = false;
            clearTimeout(initialTimer);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            window.removeEventListener('storage', handleSettingsChange);
        };
    }, [runBackgroundSync, getSyncSettings]);

    // Listen for visibility changes - sync when tab becomes visible after being hidden
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Tab became visible, check if we need to sync
                const skipCheck = shouldSkipSync();
                if (!skipCheck.skip) {
                    console.log('[BackgroundSync] Tab visible, triggering sync...');
                    runBackgroundSync();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [runBackgroundSync, shouldSkipSync]);

    return <>{children}</>;
}
