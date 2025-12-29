'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateAdPrediction, adjustPredictionWithMetrics } from '@/lib/prediction-utils';

interface SyncState {
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
    syncCount: number;
    autoSyncEnabled: boolean;
    syncIntervalMinutes: number;
    // Smart sync stats
    adsUpdated: number;
    apiCallsSaved: number;
    syncSkippedReason: string | null;
    onlyActiveAds: boolean;
    minSyncIntervalMinutes: number;
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

interface UseFacebookSyncOptions {
    autoSyncOnMount?: boolean;
    syncDelayMs?: number;
    // Smart sync options
    onlyActiveAds?: boolean;          // Only sync ads with ACTIVE status
    minSyncIntervalMinutes?: number;  // Minimum time between syncs (cache duration)
    forceSync?: boolean;              // Bypass cache check
}

interface UseFacebookSyncReturn {
    syncState: SyncState;
    syncNow: (options?: { force?: boolean }) => Promise<void>;
    toggleAutoSync: () => void;
    setSyncInterval: (minutes: number) => void;
    toggleOnlyActiveAds: () => void;
    formatLastSynced: () => string;
    checkForWebhookTrigger: () => Promise<boolean>;
}

const SYNC_SETTINGS_KEY = 'fb_sync_settings';
const SYNC_CACHE_KEY = 'fb_sync_cache';
const DEFAULT_SYNC_INTERVAL = 15; // Increased to 15 minutes to reduce API calls
const DEFAULT_MIN_SYNC_INTERVAL = 5; // Don't sync more than once every 5 minutes

export function useFacebookSync(options?: UseFacebookSyncOptions): UseFacebookSyncReturn {
    const {
        autoSyncOnMount = true,
        syncDelayMs = 2000,
        onlyActiveAds = true,
        minSyncIntervalMinutes = DEFAULT_MIN_SYNC_INTERVAL,
        forceSync = false
    } = options || {};

    const [syncState, setSyncState] = useState<SyncState>({
        isSyncing: false,
        lastSyncedAt: null,
        lastSyncError: null,
        syncCount: 0,
        autoSyncEnabled: true,
        syncIntervalMinutes: DEFAULT_SYNC_INTERVAL,
        adsUpdated: 0,
        apiCallsSaved: 0,
        syncSkippedReason: null,
        onlyActiveAds: onlyActiveAds,
        minSyncIntervalMinutes: minSyncIntervalMinutes
    });

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // Check if we should skip sync based on cache
    const shouldSkipSync = useCallback((force: boolean = false): { skip: boolean; reason: string | null } => {
        if (force) return { skip: false, reason: null };

        // Check cache
        const cacheStr = localStorage.getItem(SYNC_CACHE_KEY);
        if (cacheStr) {
            try {
                const cache = JSON.parse(cacheStr);
                const lastSync = new Date(cache.lastSyncedAt);
                const now = new Date();
                const minutesSinceLast = (now.getTime() - lastSync.getTime()) / (1000 * 60);

                if (minutesSinceLast < syncState.minSyncIntervalMinutes) {
                    return {
                        skip: true,
                        reason: `Data is fresh (synced ${Math.round(minutesSinceLast)}m ago, min interval: ${syncState.minSyncIntervalMinutes}m)`
                    };
                }
            } catch (e) {
                // Invalid cache, continue with sync
            }
        }

        return { skip: false, reason: null };
    }, [syncState.minSyncIntervalMinutes]);

    // Check for webhook trigger from Supabase
    const checkForWebhookTrigger = useCallback(async (): Promise<boolean> => {
        try {
            const adAccountId = localStorage.getItem('meta_ad_account_id');
            if (!adAccountId) return false;

            // In a real implementation, this would check Supabase for webhook triggers
            // For now, we'll return false (no pending triggers)
            console.log('[SmartSync] Checking for webhook triggers...');
            return false;
        } catch (error) {
            console.error('[SmartSync] Error checking webhook triggers:', error);
            return false;
        }
    }, []);

    // Load settings from localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const savedSettings = localStorage.getItem(SYNC_SETTINGS_KEY);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                setSyncState(prev => ({
                    ...prev,
                    autoSyncEnabled: parsed.autoSyncEnabled ?? true,
                    syncIntervalMinutes: parsed.syncIntervalMinutes ?? DEFAULT_SYNC_INTERVAL,
                    onlyActiveAds: parsed.onlyActiveAds ?? true,
                    minSyncIntervalMinutes: parsed.minSyncIntervalMinutes ?? DEFAULT_MIN_SYNC_INTERVAL,
                    lastSyncedAt: parsed.lastSyncedAt ? new Date(parsed.lastSyncedAt) : null
                }));
            } catch (e) {
                console.error('Error parsing sync settings:', e);
            }
        }

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Save settings to localStorage
    const saveSettings = useCallback((state: Partial<SyncState>) => {
        if (typeof window === 'undefined') return;

        const current = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || '{}');
        const updated = {
            ...current,
            ...state,
            lastSyncedAt: state.lastSyncedAt?.toISOString() || current.lastSyncedAt
        };
        localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(updated));
    }, []);

    // Main sync function with smart caching
    const syncNow = useCallback(async (options?: { force?: boolean }) => {
        if (typeof window === 'undefined') return;

        const force = options?.force || forceSync;

        // Check if we should skip sync
        const skipCheck = shouldSkipSync(force);
        if (skipCheck.skip) {
            console.log(`[SmartSync] ⏭️ Skipping sync: ${skipCheck.reason}`);
            setSyncState(prev => ({
                ...prev,
                syncSkippedReason: skipCheck.reason,
                apiCallsSaved: prev.apiCallsSaved + 1
            }));
            return;
        }

        // Get credentials
        const adAccountId = localStorage.getItem('meta_ad_account_id');
        const accessToken = localStorage.getItem('meta_marketing_token');

        if (!adAccountId || !accessToken) {
            console.log('[SmartSync] No Facebook credentials found, skipping sync');
            return;
        }

        if (!mountedRef.current) return;


        setSyncState(prev => ({ ...prev, isSyncing: true, lastSyncError: null }));

        try {
            console.log('[AutoSync] 🔄 Starting Facebook data sync...');

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
                console.error('[AutoSync] Error updating predictions:', predError);
            }

            const now = new Date();
            console.log(`[AutoSync] ✅ Synced ${updatedCount} ads, updated ${predictionsUpdated} predictions`);

            if (mountedRef.current) {
                setSyncState(prev => ({
                    ...prev,
                    isSyncing: false,
                    lastSyncedAt: now,
                    lastSyncError: null,
                    syncCount: prev.syncCount + 1
                }));
                saveSettings({ lastSyncedAt: now });
            }

            // Dispatch custom event so other components can react
            window.dispatchEvent(new CustomEvent('facebook-sync-complete', {
                detail: { updatedCount, predictionsUpdated }
            }));

        } catch (error) {
            console.error('[AutoSync] ❌ Sync failed:', error);
            if (mountedRef.current) {
                setSyncState(prev => ({
                    ...prev,
                    isSyncing: false,
                    lastSyncError: error instanceof Error ? error.message : 'Sync failed'
                }));
            }
        }
    }, [saveSettings]);

    // Toggle auto-sync
    const toggleAutoSync = useCallback(() => {
        setSyncState(prev => {
            const newEnabled = !prev.autoSyncEnabled;
            saveSettings({ autoSyncEnabled: newEnabled });
            return { ...prev, autoSyncEnabled: newEnabled };
        });
    }, [saveSettings]);

    // Set sync interval
    const setSyncInterval = useCallback((minutes: number) => {
        setSyncState(prev => {
            saveSettings({ syncIntervalMinutes: minutes });
            return { ...prev, syncIntervalMinutes: minutes };
        });
    }, [saveSettings]);

    // Format last synced time
    const formatLastSynced = useCallback(() => {
        if (!syncState.lastSyncedAt) return 'Never';

        const now = new Date();
        const diff = now.getTime() - syncState.lastSyncedAt.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 30) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return syncState.lastSyncedAt.toLocaleDateString();
    }, [syncState.lastSyncedAt]);

    // Toggle only active ads sync
    const toggleOnlyActiveAds = useCallback(() => {
        setSyncState(prev => {
            const newValue = !prev.onlyActiveAds;
            saveSettings({ onlyActiveAds: newValue });
            return { ...prev, onlyActiveAds: newValue };
        });
    }, [saveSettings]);

    // Auto-sync on mount
    useEffect(() => {
        if (!autoSyncOnMount) return;

        const timer = setTimeout(() => {
            if (mountedRef.current) {
                syncNow();
            }
        }, syncDelayMs);

        return () => clearTimeout(timer);
    }, [autoSyncOnMount, syncDelayMs, syncNow]);

    // Set up interval for background sync
    useEffect(() => {
        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Set up new interval if auto-sync is enabled
        if (syncState.autoSyncEnabled && syncState.syncIntervalMinutes > 0) {
            const intervalMs = syncState.syncIntervalMinutes * 60 * 1000;
            console.log(`[SmartSync] Setting up background sync every ${syncState.syncIntervalMinutes} minutes`);

            intervalRef.current = setInterval(() => {
                if (mountedRef.current && !syncState.isSyncing) {
                    console.log('[SmartSync] Running scheduled background sync...');
                    syncNow();
                }
            }, intervalMs);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [syncState.autoSyncEnabled, syncState.syncIntervalMinutes, syncState.isSyncing, syncNow]);

    return {
        syncState,
        syncNow,
        toggleAutoSync,
        setSyncInterval,
        toggleOnlyActiveAds,
        formatLastSynced,
        checkForWebhookTrigger
    };
}

export type { SyncState, UseFacebookSyncReturn };

