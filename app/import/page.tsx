'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { DEFAULT_CATEGORIES } from '@/types/extended-ad';

interface FacebookMetrics {
    // Core
    impressions: number;
    reach: number;
    clicks: number;
    uniqueClicks?: number;
    ctr: number;
    uniqueCtr?: number;
    cpc: number;
    cpm: number;
    cpp?: number;
    spend: number;
    frequency: number;
    // Results
    resultType?: string;
    results?: number;
    costPerResult?: number;
    // Links
    linkClicks?: number;
    uniqueLinkClicks?: number;
    inlineLinkClicks?: number;
    landingPageViews?: number;
    outboundClicks?: number;
    costPerLinkClick?: number;
    costPerLandingPageView?: number;
    // Engagement
    pageEngagement?: number;
    postEngagement?: number;
    inlinePostEngagement?: number;
    postReactions?: number;
    postComments?: number;
    postShares?: number;
    postSaves?: number;
    pageLikes?: number;
    // Messages
    messages?: number;
    messagesStarted?: number;
    costPerMessage?: number;
    // Conversions
    leads?: number;
    purchases?: number;
    addToCart?: number;
    initiateCheckout?: number;
    contentViews?: number;
    completeRegistration?: number;
    phoneCalls?: number;
    costPerLead?: number;
    costPerPurchase?: number;
    costPerAddToCart?: number;
    costPerContentView?: number;
    purchaseRoas?: number;
    // Video
    videoViews?: number;
    videoPlays?: number;
    videoThruPlays?: number;
    video2SecViews?: number;
    video25Watched?: number;
    video50Watched?: number;
    video75Watched?: number;
    video95Watched?: number;
    video100Watched?: number;
    videoAvgWatchTime?: number;
    costPerThruPlay?: number;
    // Quality Rankings
    qualityRanking?: string;
    engagementRateRanking?: string;
    conversionRateRanking?: string;
    // Ad Recall
    estimatedAdRecallers?: number;
    estimatedAdRecallRate?: number;
}

interface FacebookAd {
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
    createdAt: string;
    updatedAt?: string;
    mediaType: string;
    thumbnailUrl: string;
    creativeId?: string;
    metrics: FacebookMetrics | null;
    demographics?: { age?: string; gender?: string; impressions?: number }[];
    placements?: { platform?: string; position?: string; impressions?: number; spend?: number }[];
    regions?: { country?: string; impressions?: number; spend?: number }[];
    byDevice?: { device: string; impressions: number; clicks: number; spend: number }[];
    byPlatform?: { platform: string; impressions: number; clicks: number; spend: number }[];
}

interface StoredAd {
    id: string;
    facebookAdId?: string;
    name?: string;
    adInsights?: FacebookMetrics;
    demographics?: { age?: string; gender?: string; impressions?: number }[];
    placements?: { platform?: string; position?: string; impressions?: number; spend?: number }[];
    regions?: { country?: string; impressions?: number; spend?: number }[];
    successScore?: number;
    hasResults?: boolean;
    lastSyncedAt?: string;
}

export default function ImportPage() {
    const [adAccountId, setAdAccountId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');

    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const [facebookAds, setFacebookAds] = useState<FacebookAd[]>([]);
    const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());

    // Traits for each selected ad
    const [adTraits, setAdTraits] = useState<Record<string, {
        categories: string[];
        traits: string[];
    }>>({});

    const [importProgress, setImportProgress] = useState<{ total: number; imported: number } | null>(null);

    // Load saved credentials
    useEffect(() => {
        const savedAccountId = localStorage.getItem('meta_ad_account_id');
        const savedToken = localStorage.getItem('meta_marketing_token');
        if (savedAccountId) setAdAccountId(savedAccountId);
        if (savedToken) setAccessToken(savedToken);
    }, []);

    // Fetch ads from Facebook
    const handleFetchAds = async () => {
        if (!adAccountId || !accessToken) {
            setError('Please enter Ad Account ID and Access Token');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${accessToken}&status=${statusFilter}`
            );
            const data = await response.json();

            if (data.success) {
                setFacebookAds(data.data);
                // Save credentials for future use
                localStorage.setItem('meta_ad_account_id', adAccountId);
            } else {
                setError(data.error || 'Failed to fetch ads');
            }
        } catch (err) {
            setError('Failed to connect to Facebook API');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-sync all imported ads with latest results from Facebook
    const handleSyncAllResults = useCallback(async () => {
        if (!adAccountId || !accessToken) {
            setError('Please enter Ad Account ID and Access Token to sync');
            return;
        }

        setIsSyncing(true);
        setSyncMessage('🔄 Syncing results from Facebook...');
        setError(null);

        try {
            // Fetch fresh data from Facebook
            const response = await fetch(
                `/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${accessToken}&status=all`
            );
            const data = await response.json();

            if (!data.success) {
                setError(data.error || 'Failed to sync ads');
                setSyncMessage(null);
                return;
            }

            const facebookAdsMap = new Map<string, FacebookAd>();
            data.data.forEach((ad: FacebookAd) => {
                facebookAdsMap.set(ad.id, ad);
            });

            // Get stored ads and update their results
            const storedAds: StoredAd[] = JSON.parse(localStorage.getItem('ads') || '[]');
            let updatedCount = 0;

            const updatedAds = storedAds.map((ad: StoredAd) => {
                if (ad.facebookAdId && facebookAdsMap.has(ad.facebookAdId)) {
                    const fbAd = facebookAdsMap.get(ad.facebookAdId)!;

                    if (fbAd.metrics) {
                        updatedCount++;

                        // Calculate success score based on CTR
                        const successScore = Math.min(100, Math.round((fbAd.metrics.ctr || 0) * 20));

                        return {
                            ...ad,
                            adInsights: {
                                impressions: fbAd.metrics.impressions,
                                clicks: fbAd.metrics.clicks,
                                ctr: fbAd.metrics.ctr,
                                reach: fbAd.metrics.reach,
                                spend: fbAd.metrics.spend,
                                cpc: fbAd.metrics.cpc,
                                frequency: fbAd.metrics.frequency,
                                leads: fbAd.metrics.leads,
                                purchases: fbAd.metrics.purchases,
                            },
                            hasResults: true,
                            successScore: successScore > 0 ? successScore : ad.successScore,
                            lastSyncedAt: new Date().toISOString(),
                        };
                    }
                }
                return ad;
            });

            // Save updated ads
            localStorage.setItem('ads', JSON.stringify(updatedAds));
            setSyncMessage(`✅ Synced ${updatedCount} ads with latest results from Facebook!`);

            // Clear message after 3 seconds
            setTimeout(() => setSyncMessage(null), 3000);

        } catch (err) {
            setError('Failed to sync with Facebook');
            console.error(err);
        } finally {
            setIsSyncing(false);
        }
    }, [adAccountId, accessToken]);

    // Toggle ad selection
    const toggleAdSelection = (adId: string) => {
        const newSelected = new Set(selectedAds);
        if (newSelected.has(adId)) {
            newSelected.delete(adId);
        } else {
            newSelected.add(adId);
            // Initialize traits for this ad if not exists
            if (!adTraits[adId]) {
                setAdTraits(prev => ({
                    ...prev,
                    [adId]: { categories: [], traits: [] }
                }));
            }
        }
        setSelectedAds(newSelected);
    };

    // Select all ads
    const selectAllAds = () => {
        const allIds = new Set(facebookAds.map(ad => ad.id));
        setSelectedAds(allIds);
        // Initialize traits for all ads
        const newTraits: Record<string, { categories: string[], traits: string[] }> = {};
        facebookAds.forEach(ad => {
            if (!adTraits[ad.id]) {
                newTraits[ad.id] = { categories: [], traits: [] };
            }
        });
        setAdTraits(prev => ({ ...prev, ...newTraits }));
    };

    // Toggle trait for an ad
    const toggleTrait = (adId: string, traitType: 'categories' | 'traits', trait: string) => {
        setAdTraits(prev => {
            const current = prev[adId] || { categories: [], traits: [] };
            const list = current[traitType];
            const newList = list.includes(trait)
                ? list.filter(t => t !== trait)
                : [...list, trait];
            return {
                ...prev,
                [adId]: { ...current, [traitType]: newList }
            };
        });
    };

    // Import selected ads
    const handleImportAds = () => {
        if (selectedAds.size === 0) {
            setError('Please select at least one ad to import');
            return;
        }

        setImportProgress({ total: selectedAds.size, imported: 0 });

        // Get existing ads
        const existingAds = JSON.parse(localStorage.getItem('ads') || '[]');
        const existingFbIds = new Set(existingAds.map((a: { facebookAdId?: string }) => a.facebookAdId));

        let imported = 0;
        const newAds: Array<Record<string, unknown>> = [];

        selectedAds.forEach(adId => {
            // Skip if already imported
            if (existingFbIds.has(adId)) {
                imported++;
                setImportProgress({ total: selectedAds.size, imported });
                return;
            }

            const fbAd = facebookAds.find(a => a.id === adId);
            if (!fbAd) return;

            const traits = adTraits[adId] || { categories: [], traits: [] };

            // Calculate success score based on CTR
            const successScore = fbAd.metrics
                ? Math.min(100, Math.round((fbAd.metrics.ctr || 0) * 20))
                : undefined;

            // Create extractedContent for Algorithm/mindmap compatibility
            const extractedContent = {
                title: fbAd.name,
                platform: 'Facebook',
                placement: 'Feed',
                mediaType: fbAd.mediaType || 'video',
                // Map user-selected categories and traits
                contentCategory: traits.categories[0] || 'other',
                hookType: traits.traits.find((t: string) => ['curiosity', 'shock', 'question', 'transformation', 'story'].includes(t.toLowerCase())) || 'other',
                editingStyle: traits.traits.find((t: string) => ['fast_cuts', 'cinematic', 'raw_authentic', 'ugc'].includes(t.toLowerCase())) || 'other',
                isUGCStyle: traits.traits.some((t: string) => t.toLowerCase().includes('ugc')),
                hasSubtitles: traits.traits.some((t: string) => t.toLowerCase().includes('subtitle')),
                hasVoiceover: traits.traits.some((t: string) => t.toLowerCase().includes('voiceover')),
                customTraits: [...traits.categories, ...traits.traits],
            };

            const newAd = {
                id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                facebookAdId: fbAd.id,
                name: fbAd.name,
                mediaUrl: fbAd.thumbnailUrl,
                thumbnailUrl: fbAd.thumbnailUrl,
                mediaType: fbAd.mediaType,
                // Add extractedContent for Algorithm compatibility
                extractedContent,
                // Traits from user selection
                categories: traits.categories,
                traits: traits.traits,
                // Comprehensive Facebook Insights
                adInsights: fbAd.metrics ? {
                    // Core metrics
                    impressions: fbAd.metrics.impressions,
                    reach: fbAd.metrics.reach,
                    clicks: fbAd.metrics.clicks,
                    uniqueClicks: fbAd.metrics.uniqueClicks,
                    ctr: fbAd.metrics.ctr,
                    uniqueCtr: fbAd.metrics.uniqueCtr,
                    cpc: fbAd.metrics.cpc,
                    cpm: fbAd.metrics.cpm,
                    cpp: fbAd.metrics.cpp,
                    spend: fbAd.metrics.spend,
                    frequency: fbAd.metrics.frequency,
                    // Results
                    resultType: fbAd.metrics.resultType,
                    results: fbAd.metrics.results,
                    costPerResult: fbAd.metrics.costPerResult,
                    // Links
                    linkClicks: fbAd.metrics.linkClicks,
                    inlineLinkClicks: fbAd.metrics.inlineLinkClicks,
                    landingPageViews: fbAd.metrics.landingPageViews,
                    outboundClicks: fbAd.metrics.outboundClicks,
                    // Engagement
                    pageEngagement: fbAd.metrics.pageEngagement,
                    postEngagement: fbAd.metrics.postEngagement,
                    inlinePostEngagement: fbAd.metrics.inlinePostEngagement,
                    postReactions: fbAd.metrics.postReactions,
                    postComments: fbAd.metrics.postComments,
                    postShares: fbAd.metrics.postShares,
                    // Messages
                    messages: fbAd.metrics.messages,
                    messagesStarted: fbAd.metrics.messagesStarted,
                    costPerMessage: fbAd.metrics.costPerMessage,
                    // Conversions
                    leads: fbAd.metrics.leads,
                    purchases: fbAd.metrics.purchases,
                    addToCart: fbAd.metrics.addToCart,
                    initiateCheckout: fbAd.metrics.initiateCheckout,
                    costPerLead: fbAd.metrics.costPerLead,
                    costPerPurchase: fbAd.metrics.costPerPurchase,
                    // Video
                    videoViews: fbAd.metrics.videoViews,
                    videoPlays: fbAd.metrics.videoPlays,
                    video25Watched: fbAd.metrics.video25Watched,
                    video50Watched: fbAd.metrics.video50Watched,
                    video75Watched: fbAd.metrics.video75Watched,
                    video100Watched: fbAd.metrics.video100Watched,
                } : null,
                // Breakdown data
                demographics: fbAd.demographics || [],
                placements: fbAd.placements || [],
                regions: fbAd.regions || [],
                // Status flags
                hasResults: !!fbAd.metrics && (fbAd.metrics.impressions > 0 || fbAd.metrics.clicks > 0),
                successScore,
                status: fbAd.effectiveStatus,
                importedFromFacebook: true,
                createdAt: fbAd.createdAt,
                importedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastSyncedAt: new Date().toISOString(),
            };

            newAds.push(newAd);
            imported++;
            setImportProgress({ total: selectedAds.size, imported });
        });

        // Save to localStorage
        const allAds = [...existingAds, ...newAds];
        localStorage.setItem('ads', JSON.stringify(allAds));

        // Reset state
        setTimeout(() => {
            setImportProgress(null);
            setSelectedAds(new Set());
            setFacebookAds([]);
            alert(`✅ Successfully imported ${newAds.length} ads! They are now available in the Algorithm and My Ads pages.`);
        }, 500);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#22c55e';
            case 'PAUSED': return '#F59E0B';
            case 'ARCHIVED': return '#6B7280';
            default: return '#8B5CF6';
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>📥 Import from Facebook</h1>
                <p className={styles.subtitle}>
                    Import existing ads with auto-filled results • Tag traits for AI learning
                </p>
            </header>

            {/* Connection Section */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)' }}>🔗 Connect to Ad Account</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Ad Account ID</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="123456789"
                            value={adAccountId}
                            onChange={(e) => setAdAccountId(e.target.value.replace('act_', ''))}
                        />
                        <small style={{ color: 'var(--text-muted)' }}>Without &quot;act_&quot; prefix</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Marketing Access Token</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="EAAxxxxxxx..."
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Filter by Status</label>
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused' | 'archived')}
                        >
                            <option value="all">All Ads</option>
                            <option value="active">Active Only</option>
                            <option value="paused">Paused Only</option>
                            <option value="archived">Archived Only</option>
                        </select>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleFetchAds}
                        disabled={isLoading}
                        style={{ marginTop: '24px' }}
                    >
                        {isLoading ? '🔄 Fetching...' : '📥 Fetch Ads to Import'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleSyncAllResults}
                        disabled={isSyncing || !adAccountId || !accessToken}
                        style={{ marginTop: '24px' }}
                    >
                        {isSyncing ? '🔄 Syncing...' : '🔄 Sync All Results'}
                    </button>
                </div>

                {syncMessage && (
                    <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--success)'
                    }}>
                        {syncMessage}
                    </div>
                )}

                {error && (
                    <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--error)'
                    }}>
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* Sync Info */}
            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', background: 'rgba(200, 245, 96, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span>💡</span>
                    <span style={{ fontSize: '0.875rem' }}>
                        <strong>New ads may show 0 results</strong> - Facebook takes time to report metrics.
                        Use <strong>&quot;Sync All Results&quot;</strong> to update your imported ads with the latest data.
                    </span>
                </div>
            </div>

            {/* Ads List */}
            {facebookAds.length > 0 && (
                <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                        <h3>📊 Found {facebookAds.length} Ads</h3>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={selectAllAds}>
                                ✓ Select All
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAds(new Set())}>
                                ✗ Clear Selection
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleImportAds}
                                disabled={selectedAds.size === 0}
                            >
                                📥 Import {selectedAds.size} Selected
                            </button>
                        </div>
                    </div>

                    {/* Import Progress */}
                    {importProgress && (
                        <div style={{
                            marginBottom: 'var(--spacing-lg)',
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ marginBottom: '8px' }}>
                                Importing... {importProgress.imported} / {importProgress.total}
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(importProgress.imported / importProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Ads Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {facebookAds.map(ad => (
                            <div
                                key={ad.id}
                                style={{
                                    border: selectedAds.has(ad.id) ? '2px solid var(--primary)' : '1px solid var(--border-primary)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-md)',
                                    background: selectedAds.has(ad.id) ? 'rgba(200, 245, 96, 0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                    {/* Checkbox + Thumbnail */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAds.has(ad.id)}
                                            onChange={() => toggleAdSelection(ad.id)}
                                            style={{ width: 20, height: 20, marginTop: 4 }}
                                        />
                                        <div style={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: 'var(--radius-md)',
                                            background: ad.thumbnailUrl ? `url(${ad.thumbnailUrl}) center/cover` : 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem'
                                        }}>
                                            {!ad.thumbnailUrl && (ad.mediaType === 'video' ? '🎬' : '📷')}
                                        </div>
                                    </div>

                                    {/* Ad Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '4px' }}>
                                            <h4 style={{ margin: 0 }}>{ad.name}</h4>
                                            <span
                                                className="tag"
                                                style={{
                                                    background: getStatusColor(ad.effectiveStatus),
                                                    color: 'white',
                                                    fontSize: '0.6875rem'
                                                }}
                                            >
                                                {ad.effectiveStatus}
                                            </span>
                                        </div>

                                        {/* Dynamic Metrics Display - Shows ALL available metrics */}
                                        {ad.metrics ? (
                                            <div style={{ fontSize: '0.75rem' }}>
                                                {/* Render all metrics dynamically */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '8px',
                                                    flexWrap: 'wrap',
                                                    marginBottom: 'var(--spacing-sm)'
                                                }}>
                                                    {/* Core Performance */}
                                                    {ad.metrics.impressions > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.impressions.toLocaleString()}</strong> impressions</span>}
                                                    {(ad.metrics.reach ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.reach?.toLocaleString()}</strong> reach</span>}
                                                    {ad.metrics.clicks > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.clicks.toLocaleString()}</strong> clicks</span>}
                                                    {(ad.metrics.uniqueClicks ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.uniqueClicks?.toLocaleString()}</strong> unique clicks</span>}
                                                    {ad.metrics.ctr > 0 && <span style={{ background: 'var(--success)', color: '#000', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.ctr.toFixed(2)}%</strong> CTR</span>}
                                                    {(ad.metrics.uniqueCtr ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.uniqueCtr?.toFixed(2)}%</strong> unique CTR</span>}
                                                    {ad.metrics.spend > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.spend.toFixed(2)}</strong> spent</span>}
                                                    {(ad.metrics.frequency ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.frequency?.toFixed(2)}</strong> frequency</span>}
                                                    {(ad.metrics.cpc ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.cpc?.toFixed(2)}</strong> CPC</span>}
                                                    {(ad.metrics.cpm ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.cpm?.toFixed(2)}</strong> CPM</span>}
                                                    {(ad.metrics.cpp ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.cpp?.toFixed(2)}</strong> CPP</span>}

                                                    {/* Results & CPR */}
                                                    {(ad.metrics.results ?? 0) > 0 && <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.results}</strong> {ad.metrics.resultType || 'results'}</span>}
                                                    {(ad.metrics.costPerResult ?? 0) > 0 && <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerResult?.toFixed(2)}</strong> CPR</span>}

                                                    {/* Links */}
                                                    {(ad.metrics.linkClicks ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>🔗 <strong>{ad.metrics.linkClicks}</strong> link clicks</span>}
                                                    {(ad.metrics.uniqueLinkClicks ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.uniqueLinkClicks}</strong> unique link clicks</span>}
                                                    {(ad.metrics.inlineLinkClicks ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.inlineLinkClicks}</strong> inline link clicks</span>}
                                                    {(ad.metrics.outboundClicks ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.outboundClicks}</strong> outbound clicks</span>}
                                                    {(ad.metrics.landingPageViews ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>📄 <strong>{ad.metrics.landingPageViews}</strong> landing page views</span>}
                                                    {(ad.metrics.costPerLinkClick ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerLinkClick?.toFixed(2)}</strong> per link click</span>}
                                                    {(ad.metrics.costPerLandingPageView ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerLandingPageView?.toFixed(2)}</strong> per LPV</span>}

                                                    {/* Engagement */}
                                                    {(ad.metrics.pageEngagement ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>👍 <strong>{ad.metrics.pageEngagement}</strong> page engagement</span>}
                                                    {(ad.metrics.postEngagement ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.postEngagement}</strong> post engagement</span>}
                                                    {(ad.metrics.postReactions ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>❤️ <strong>{ad.metrics.postReactions}</strong> reactions</span>}
                                                    {(ad.metrics.postComments ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>💬 <strong>{ad.metrics.postComments}</strong> comments</span>}
                                                    {(ad.metrics.postShares ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>↗️ <strong>{ad.metrics.postShares}</strong> shares</span>}
                                                    {(ad.metrics.postSaves ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>📌 <strong>{ad.metrics.postSaves}</strong> saves</span>}
                                                    {(ad.metrics.pageLikes ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>👍 <strong>{ad.metrics.pageLikes}</strong> page likes</span>}

                                                    {/* Messages */}
                                                    {(ad.metrics.messages ?? 0) > 0 && <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>💬 <strong>{ad.metrics.messages}</strong> messages</span>}
                                                    {(ad.metrics.messagesStarted ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.messagesStarted}</strong> conversations started</span>}
                                                    {(ad.metrics.costPerMessage ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerMessage?.toFixed(2)}</strong> per message</span>}

                                                    {/* Leads */}
                                                    {(ad.metrics.leads ?? 0) > 0 && <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>🎯 <strong>{ad.metrics.leads}</strong> leads</span>}
                                                    {(ad.metrics.costPerLead ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerLead?.toFixed(2)}</strong> CPL</span>}

                                                    {/* Purchases & Commerce */}
                                                    {(ad.metrics.purchases ?? 0) > 0 && <span style={{ background: 'var(--success)', color: '#000', padding: '2px 8px', borderRadius: '4px' }}>🛒 <strong>{ad.metrics.purchases}</strong> purchases</span>}
                                                    {(ad.metrics.costPerPurchase ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerPurchase?.toFixed(2)}</strong> per purchase</span>}
                                                    {(ad.metrics.purchaseRoas ?? 0) > 0 && <span style={{ background: 'var(--success)', color: '#000', padding: '2px 8px', borderRadius: '4px' }}>📈 <strong>{ad.metrics.purchaseRoas?.toFixed(2)}x</strong> ROAS</span>}
                                                    {(ad.metrics.addToCart ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>🛍️ <strong>{ad.metrics.addToCart}</strong> add to cart</span>}
                                                    {(ad.metrics.costPerAddToCart ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerAddToCart?.toFixed(2)}</strong> per ATC</span>}
                                                    {(ad.metrics.initiateCheckout ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.initiateCheckout}</strong> checkouts</span>}

                                                    {/* Content Views & Registration */}
                                                    {(ad.metrics.contentViews ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>👁️ <strong>{ad.metrics.contentViews}</strong> content views</span>}
                                                    {(ad.metrics.costPerContentView ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerContentView?.toFixed(2)}</strong> per view</span>}
                                                    {(ad.metrics.completeRegistration ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>✅ <strong>{ad.metrics.completeRegistration}</strong> registrations</span>}
                                                    {(ad.metrics.phoneCalls ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>📞 <strong>{ad.metrics.phoneCalls}</strong> calls</span>}

                                                    {/* Video Metrics */}
                                                    {(ad.metrics.videoViews ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>▶️ <strong>{ad.metrics.videoViews}</strong> video views</span>}
                                                    {(ad.metrics.videoPlays ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.videoPlays}</strong> video plays</span>}
                                                    {(ad.metrics.videoThruPlays ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>🎬 <strong>{ad.metrics.videoThruPlays}</strong> ThruPlays</span>}
                                                    {(ad.metrics.video2SecViews ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.video2SecViews}</strong> 2s views</span>}
                                                    {(ad.metrics.video25Watched ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.video25Watched}</strong> 25% watched</span>}
                                                    {(ad.metrics.video50Watched ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.video50Watched}</strong> 50% watched</span>}
                                                    {(ad.metrics.video75Watched ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.video75Watched}</strong> 75% watched</span>}
                                                    {(ad.metrics.video95Watched ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.video95Watched}</strong> 95% watched</span>}
                                                    {(ad.metrics.video100Watched ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.video100Watched}</strong> 100% watched</span>}
                                                    {(ad.metrics.videoAvgWatchTime ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.videoAvgWatchTime}s</strong> avg watch</span>}
                                                    {(ad.metrics.costPerThruPlay ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>₱{ad.metrics.costPerThruPlay?.toFixed(2)}</strong> per ThruPlay</span>}

                                                    {/* Quality Rankings */}
                                                    {ad.metrics.qualityRanking && ad.metrics.qualityRanking !== 'N/A' && <span style={{ background: ad.metrics.qualityRanking === 'ABOVE_AVERAGE' ? 'var(--success)' : 'var(--bg-tertiary)', color: ad.metrics.qualityRanking === 'ABOVE_AVERAGE' ? '#000' : 'inherit', padding: '2px 8px', borderRadius: '4px' }}>Quality: <strong>{ad.metrics.qualityRanking}</strong></span>}
                                                    {ad.metrics.engagementRateRanking && ad.metrics.engagementRateRanking !== 'N/A' && <span style={{ background: ad.metrics.engagementRateRanking === 'ABOVE_AVERAGE' ? 'var(--success)' : 'var(--bg-tertiary)', color: ad.metrics.engagementRateRanking === 'ABOVE_AVERAGE' ? '#000' : 'inherit', padding: '2px 8px', borderRadius: '4px' }}>Engagement: <strong>{ad.metrics.engagementRateRanking}</strong></span>}
                                                    {ad.metrics.conversionRateRanking && ad.metrics.conversionRateRanking !== 'N/A' && <span style={{ background: ad.metrics.conversionRateRanking === 'ABOVE_AVERAGE' ? 'var(--success)' : 'var(--bg-tertiary)', color: ad.metrics.conversionRateRanking === 'ABOVE_AVERAGE' ? '#000' : 'inherit', padding: '2px 8px', borderRadius: '4px' }}>Conversion: <strong>{ad.metrics.conversionRateRanking}</strong></span>}

                                                    {/* Ad Recall */}
                                                    {(ad.metrics.estimatedAdRecallers ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>🧠 <strong>{ad.metrics.estimatedAdRecallers?.toLocaleString()}</strong> ad recall</span>}
                                                    {(ad.metrics.estimatedAdRecallRate ?? 0) > 0 && <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><strong>{ad.metrics.estimatedAdRecallRate?.toFixed(2)}%</strong> recall rate</span>}
                                                </div>

                                                {/* Breakdowns */}
                                                {(ad.byPlatform?.length > 0 || ad.byDevice?.length > 0 || ad.demographics?.length > 0 || ad.regions?.length > 0) && (
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        flexWrap: 'wrap',
                                                        marginTop: 'var(--spacing-xs)',
                                                        fontSize: '0.6875rem'
                                                    }}>
                                                        {ad.byPlatform?.length > 0 && (
                                                            <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                                                📱 {ad.byPlatform.map((p: { platform: string }) => p.platform).join(', ')}
                                                            </span>
                                                        )}
                                                        {ad.byDevice?.length > 0 && (
                                                            <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                                                💻 {ad.byDevice.map((d: { device: string }) => d.device).join(', ')}
                                                            </span>
                                                        )}
                                                        {ad.demographics?.length > 0 && (
                                                            <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                                                👥 {ad.demographics.slice(0, 3).map((d: { age: string; gender: string }) => `${d.age} ${d.gender}`).join(', ')}...
                                                            </span>
                                                        )}
                                                        {ad.regions?.length > 0 && (
                                                            <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                                                🌍 {ad.regions.slice(0, 3).map((r: { country: string }) => r.country).join(', ')}
                                                            </span>
                                                        )}
                                                        {ad.placements?.length > 0 && (
                                                            <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                                                                📍 {ad.placements.slice(0, 3).map((p: { position: string }) => p.position).join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                No metrics available yet
                                            </div>
                                        )}

                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            ID: {ad.id} • Created: {new Date(ad.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Trait Selection (only for selected ads) */}
                                {selectedAds.has(ad.id) && (
                                    <div style={{
                                        marginTop: 'var(--spacing-md)',
                                        paddingTop: 'var(--spacing-md)',
                                        borderTop: '1px solid var(--border-primary)'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                            🏷️ Tag traits for AI learning:
                                        </div>

                                        {/* Categories */}
                                        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                            <span style={{ fontSize: '0.75rem', marginRight: '8px' }}>Categories:</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                {DEFAULT_CATEGORIES.categories.slice(0, 8).map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTrait(ad.id, 'categories', cat);
                                                        }}
                                                        style={{
                                                            padding: '2px 8px',
                                                            fontSize: '0.6875rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: adTraits[ad.id]?.categories.includes(cat)
                                                                ? '1px solid var(--primary)'
                                                                : '1px solid var(--border-primary)',
                                                            background: adTraits[ad.id]?.categories.includes(cat)
                                                                ? 'var(--primary)'
                                                                : 'transparent',
                                                            color: adTraits[ad.id]?.categories.includes(cat)
                                                                ? '#120a1c'
                                                                : 'var(--text-secondary)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Traits */}
                                        <div>
                                            <span style={{ fontSize: '0.75rem', marginRight: '8px' }}>Traits:</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                {DEFAULT_CATEGORIES.traits.slice(0, 10).map(trait => (
                                                    <button
                                                        key={trait}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTrait(ad.id, 'traits', trait);
                                                        }}
                                                        style={{
                                                            padding: '2px 8px',
                                                            fontSize: '0.6875rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: adTraits[ad.id]?.traits.includes(trait)
                                                                ? '1px solid var(--accent)'
                                                                : '1px solid var(--border-primary)',
                                                            background: adTraits[ad.id]?.traits.includes(trait)
                                                                ? 'var(--accent)'
                                                                : 'transparent',
                                                            color: adTraits[ad.id]?.traits.includes(trait)
                                                                ? '#120a1c'
                                                                : 'var(--text-secondary)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {trait}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {facebookAds.length === 0 && !isLoading && (
                <div className="glass-card" style={{
                    padding: 'var(--spacing-xl)',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>📥</div>
                    <h3>Import Existing Ads</h3>
                    <p>Connect your Facebook Ad Account to import ads with auto-filled results</p>
                    <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto', marginTop: 'var(--spacing-md)' }}>
                        <li>✅ Auto-fetch impressions, clicks, CTR, conversions</li>
                        <li>✅ Import active, paused, or archived ads</li>
                        <li>✅ Tag traits for AI learning</li>
                        <li>✅ Sync results anytime to update algorithm</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
