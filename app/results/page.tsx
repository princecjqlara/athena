'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

// Define interfaces locally since they may differ from the types file
interface AdInsights {
    impressions?: number;
    reach?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    spend?: number;
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
}

interface StoredAd {
    id: string;
    facebookAdId?: string;
    name?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaType?: string;
    status?: string;
    extractedContent?: {
        title?: string;
        platform?: string;
        hookType?: string;
    };
    adInsights?: AdInsights;
    hasResults?: boolean;
    successScore?: number;
    resultsDescription?: string;
    importedFromFacebook?: boolean;
    lastSyncedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function ResultsPage() {
    const [ads, setAds] = useState<StoredAd[]>([]);
    const [selectedAd, setSelectedAd] = useState<StoredAd | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load ads from localStorage
    useEffect(() => {
        loadAds();
    }, []);

    const loadAds = () => {
        setLoading(true);
        const storedAds = JSON.parse(localStorage.getItem('ads') || '[]');
        setAds(storedAds);
        setLoading(false);
    };

    // Sync all results from Facebook
    const handleSyncAll = async () => {
        const adAccountId = localStorage.getItem('meta_ad_account_id');
        const accessToken = localStorage.getItem('meta_marketing_token');

        if (!adAccountId || !accessToken) {
            alert('Please connect your Facebook account first (Import page)');
            return;
        }

        setIsSyncing(true);
        setSyncStatus('🔄 Syncing latest results from Facebook...');

        try {
            const response = await fetch(
                `/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${accessToken}&status=all`
            );
            const data = await response.json();

            if (!data.success) {
                setSyncStatus('❌ ' + (data.error || 'Failed to sync'));
                return;
            }

            // Create a map of Facebook ads by ID
            const fbAdsMap = new Map();
            data.data.forEach((ad: any) => {
                fbAdsMap.set(ad.id, ad);
            });

            // Update stored ads with latest metrics
            const storedAds: StoredAd[] = JSON.parse(localStorage.getItem('ads') || '[]');
            let updatedCount = 0;

            const updatedAds = storedAds.map(ad => {
                if (ad.facebookAdId && fbAdsMap.has(ad.facebookAdId)) {
                    const fbAd = fbAdsMap.get(ad.facebookAdId);
                    if (fbAd.metrics) {
                        updatedCount++;
                        const m = fbAd.metrics;

                        // Calculate success score
                        let score = 0, factors = 0;
                        if (m.ctr && m.ctr > 0) { score += Math.min(40, m.ctr * 10); factors++; }
                        if (m.results && m.results > 0 && m.impressions && m.impressions > 0) {
                            score += Math.min(40, (m.results / m.impressions) * 1000); factors++;
                        } else if (m.messagesStarted && m.messagesStarted > 0) {
                            score += Math.min(40, m.messagesStarted * 4); factors++;
                        }
                        if (m.pageEngagement && m.pageEngagement > 0 && m.impressions && m.impressions > 0) {
                            score += Math.min(20, (m.pageEngagement / m.impressions) * 500); factors++;
                        }
                        const successScore = factors > 0 ? Math.round(Math.min(100, score)) : ad.successScore;

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
                            successScore,
                            status: fbAd.effectiveStatus,
                            lastSyncedAt: new Date().toISOString(),
                        };
                    }
                }
                return ad;
            });

            localStorage.setItem('ads', JSON.stringify(updatedAds));
            setAds(updatedAds);
            setSyncStatus(`✅ Synced ${updatedCount} ads with latest Facebook results!`);

            setTimeout(() => setSyncStatus(null), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('❌ Failed to sync: ' + String(error));
        } finally {
            setIsSyncing(false);
        }
    };

    // Delete an ad
    const handleDeleteAd = (e: React.MouseEvent, adId: string, adName: string) => {
        e.stopPropagation();
        const confirmed = window.confirm(`Delete "${adName}"?\n\nThis will permanently remove this ad.`);
        if (!confirmed) return;

        const updatedAds = ads.filter(a => a.id !== adId);
        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
        if (selectedAd?.id === adId) setSelectedAd(null);
    };

    // Format numbers
    const formatNumber = (num: number | undefined) => {
        if (num === undefined || num === null) return '-';
        return num.toLocaleString();
    };

    const formatCurrency = (num: number | undefined) => {
        if (num === undefined || num === null) return '₱-';
        return '₱' + num.toFixed(2);
    };

    const formatPercent = (num: number | undefined) => {
        if (num === undefined || num === null) return '-';
        return num.toFixed(2) + '%';
    };

    // Get success score color
    const getScoreColor = (score: number | undefined) => {
        if (!score) return '#6b7280';
        if (score >= 70) return '#22c55e';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    };

    // Separate ads with and without results
    const adsWithResults = ads.filter(ad => ad.hasResults || ad.adInsights);
    const adsWithoutResults = ads.filter(ad => !ad.hasResults && !ad.adInsights);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>📊 Ad Analytics</h1>
                <p className={styles.subtitle}>
                    View performance metrics for your imported ads • Auto-synced from Facebook
                </p>
            </header>

            {/* Sync Controls */}
            <div className="glass-card" style={{
                padding: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--spacing-md)'
            }}>
                <div>
                    <h3 style={{ margin: 0 }}>🔄 Auto-Sync Results</h3>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Fetch the latest performance data from Facebook for all imported ads
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                >
                    {isSyncing ? '🔄 Syncing...' : '🔄 Sync All from Facebook'}
                </button>
            </div>

            {syncStatus && (
                <div style={{
                    padding: 'var(--spacing-md)',
                    background: syncStatus.includes('✅') ? 'rgba(34, 197, 94, 0.1)' :
                        syncStatus.includes('❌') ? 'rgba(239, 68, 68, 0.1)' :
                            'rgba(139, 92, 246, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-lg)',
                    color: syncStatus.includes('✅') ? '#22c55e' :
                        syncStatus.includes('❌') ? '#ef4444' :
                            '#8b5cf6'
                }}>
                    {syncStatus}
                </div>
            )}

            {loading ? (
                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <p>Loading ads...</p>
                </div>
            ) : ads.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '16px' }}>
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <h3>No Ads Yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Import ads from Facebook to see their results here.</p>
                    <a href="/import" className="btn btn-primary" style={{ marginTop: '16px' }}>
                        📥 Import from Facebook
                    </a>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: selectedAd ? '1fr 1.5fr' : '1fr', gap: 'var(--spacing-lg)' }}>
                    {/* Ads List */}
                    <div>
                        {/* Ads with Results */}
                        <h2 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✅ Ads with Results
                            <span className="badge badge-success">{adsWithResults.length}</span>
                        </h2>

                        {adsWithResults.length === 0 ? (
                            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                                <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                                    No ads with results yet. Click "Sync All from Facebook" to fetch metrics.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                                {adsWithResults.map(ad => (
                                    <div
                                        key={ad.id}
                                        className={`glass-card ${selectedAd?.id === ad.id ? 'ring-primary' : ''}`}
                                        style={{
                                            padding: 'var(--spacing-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-md)',
                                            border: selectedAd?.id === ad.id ? '2px solid var(--primary)' : 'none'
                                        }}
                                        onClick={() => setSelectedAd(ad)}
                                    >
                                        {/* Thumbnail */}
                                        <div style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: 'var(--radius-sm)',
                                            overflow: 'hidden',
                                            background: 'var(--surface)',
                                            flexShrink: 0
                                        }}>
                                            {ad.thumbnailUrl ? (
                                                <img src={ad.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>📺</div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h4 style={{ margin: 0, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {ad.name || ad.extractedContent?.title || 'Untitled'}
                                            </h4>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                {ad.importedFromFacebook && <span className="badge" style={{ fontSize: '0.7rem' }}>Facebook</span>}
                                                <span className="badge" style={{ fontSize: '0.7rem' }}>{formatNumber(ad.adInsights?.impressions)} impr</span>
                                                <span className="badge" style={{ fontSize: '0.7rem' }}>{formatPercent(ad.adInsights?.ctr)} CTR</span>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '8px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: `${getScoreColor(ad.successScore)}20`
                                        }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: getScoreColor(ad.successScore) }}>
                                                {ad.successScore || '-'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Score</div>
                                        </div>

                                        {/* Delete */}
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={(e) => handleDeleteAd(e, ad.id, ad.name || 'Untitled')}
                                            style={{ color: '#ef4444', padding: '4px 8px' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Ads without Results */}
                        {adsWithoutResults.length > 0 && (
                            <>
                                <h2 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    ⏳ Pending Results
                                    <span className="badge badge-warning">{adsWithoutResults.length}</span>
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {adsWithoutResults.map(ad => (
                                        <div
                                            key={ad.id}
                                            className="glass-card"
                                            style={{
                                                padding: 'var(--spacing-md)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-md)',
                                                opacity: 0.7
                                            }}
                                        >
                                            <div style={{
                                                width: '50px',
                                                height: '50px',
                                                borderRadius: 'var(--radius-sm)',
                                                overflow: 'hidden',
                                                background: 'var(--surface)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {ad.thumbnailUrl ? (
                                                    <img src={ad.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : '📺'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{ad.name || 'Untitled'}</h4>
                                                <span className="badge badge-warning" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                                                    Awaiting Facebook sync
                                                </span>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={(e) => handleDeleteAd(e, ad.id, ad.name || 'Untitled')}
                                                style={{ color: '#ef4444', padding: '4px 8px' }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Details Panel */}
                    {selectedAd && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-lg)', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-lg)' }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>{selectedAd.name || selectedAd.extractedContent?.title || 'Untitled'}</h2>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {selectedAd.importedFromFacebook && <span className="badge badge-primary">📘 Facebook Import</span>}
                                        <span className="badge">{selectedAd.status || 'UNKNOWN'}</span>
                                        {selectedAd.lastSyncedAt && (
                                            <span className="badge" style={{ fontSize: '0.7rem' }}>
                                                Last synced: {new Date(selectedAd.lastSyncedAt).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{
                                    textAlign: 'center',
                                    padding: '16px 24px',
                                    borderRadius: 'var(--radius-md)',
                                    background: `${getScoreColor(selectedAd.successScore)}20`
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getScoreColor(selectedAd.successScore) }}>
                                        {selectedAd.successScore || '-'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Success Score</div>
                                </div>
                            </div>

                            {selectedAd.adInsights ? (
                                <>
                                    {/* Spend & Reach */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: 'var(--spacing-md)',
                                        marginBottom: 'var(--spacing-lg)'
                                    }}>
                                        <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>💰 Spend</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                                                {formatCurrency(selectedAd.adInsights.spend)}
                                            </div>
                                        </div>
                                        <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>👁️ Impressions</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                                                {formatNumber(selectedAd.adInsights.impressions)}
                                            </div>
                                        </div>
                                        <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center', background: 'rgba(34, 197, 94, 0.1)' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>👥 Reach</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>
                                                {formatNumber(selectedAd.adInsights.reach)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clicks & CTR */}
                                    <h3 style={{ marginBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                        🔗 Clicks & Engagement
                                    </h3>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: 'var(--spacing-sm)',
                                        marginBottom: 'var(--spacing-lg)'
                                    }}>
                                        <MetricBox label="Clicks" value={formatNumber(selectedAd.adInsights.clicks)} />
                                        <MetricBox label="Link Clicks" value={formatNumber(selectedAd.adInsights.linkClicks)} />
                                        <MetricBox label="CTR" value={formatPercent(selectedAd.adInsights.ctr)} highlight={!!(selectedAd.adInsights.ctr && selectedAd.adInsights.ctr > 2)} />
                                        <MetricBox label="CPC" value={formatCurrency(selectedAd.adInsights.cpc)} />
                                        <MetricBox label="CPM" value={formatCurrency(selectedAd.adInsights.cpm)} />
                                        <MetricBox label="Frequency" value={selectedAd.adInsights.frequency?.toFixed(2) || '-'} />
                                    </div>

                                    {/* Results & Conversions */}
                                    <h3 style={{ marginBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                        🎯 Results & Conversions
                                    </h3>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: 'var(--spacing-sm)',
                                        marginBottom: 'var(--spacing-lg)'
                                    }}>
                                        <MetricBox label={selectedAd.adInsights.resultType || 'Results'} value={formatNumber(selectedAd.adInsights.results)} highlight />
                                        <MetricBox label="Cost per Result" value={formatCurrency(selectedAd.adInsights.costPerResult)} />
                                        <MetricBox label="Landing Page Views" value={formatNumber(selectedAd.adInsights.landingPageViews)} />
                                        <MetricBox label="Leads" value={formatNumber(selectedAd.adInsights.leads)} />
                                        <MetricBox label="Purchases" value={formatNumber(selectedAd.adInsights.purchases)} />
                                        <MetricBox label="Messages" value={formatNumber(selectedAd.adInsights.messagesStarted)} />
                                    </div>

                                    {/* Engagement */}
                                    <h3 style={{ marginBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                        👍 Social Engagement
                                    </h3>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: 'var(--spacing-sm)',
                                        marginBottom: 'var(--spacing-lg)'
                                    }}>
                                        <MetricBox label="Page Engagement" value={formatNumber(selectedAd.adInsights.pageEngagement)} />
                                        <MetricBox label="Reactions" value={formatNumber(selectedAd.adInsights.postReactions)} />
                                        <MetricBox label="Comments" value={formatNumber(selectedAd.adInsights.postComments)} />
                                        <MetricBox label="Shares" value={formatNumber(selectedAd.adInsights.postShares)} />
                                    </div>

                                    {/* Video (if applicable) */}
                                    {(selectedAd.adInsights.videoViews || selectedAd.adInsights.videoThruPlays) && (
                                        <>
                                            <h3 style={{ marginBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                                🎬 Video Performance
                                            </h3>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(2, 1fr)',
                                                gap: 'var(--spacing-sm)',
                                                marginBottom: 'var(--spacing-lg)'
                                            }}>
                                                <MetricBox label="Video Views" value={formatNumber(selectedAd.adInsights.videoViews)} />
                                                <MetricBox label="ThruPlays" value={formatNumber(selectedAd.adInsights.videoThruPlays)} />
                                            </div>
                                        </>
                                    )}

                                    {/* Quality Rankings */}
                                    {(selectedAd.adInsights.qualityRanking || selectedAd.adInsights.engagementRateRanking || selectedAd.adInsights.conversionRateRanking) && (
                                        <>
                                            <h3 style={{ marginBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                                                ⭐ Quality Rankings
                                            </h3>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: 'var(--spacing-sm)',
                                                marginBottom: 'var(--spacing-lg)'
                                            }}>
                                                <MetricBox label="Quality" value={selectedAd.adInsights.qualityRanking || '-'} isRanking />
                                                <MetricBox label="Engagement Rate" value={selectedAd.adInsights.engagementRateRanking || '-'} isRanking />
                                                <MetricBox label="Conversion Rate" value={selectedAd.adInsights.conversionRateRanking || '-'} isRanking />
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                                    <p>No metrics available yet.</p>
                                    <p>Click "Sync All from Facebook" to fetch the latest data.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Metric Box Component
function MetricBox({ label, value, highlight, isRanking }: { label: string; value: string; highlight?: boolean; isRanking?: boolean }) {
    const getRankingColor = (rank: string) => {
        const r = rank.toLowerCase();
        if (r.includes('above') || r === 'good') return '#22c55e';
        if (r.includes('below') || r === 'poor') return '#ef4444';
        return 'var(--text)';
    };

    return (
        <div style={{
            padding: '12px',
            background: highlight ? 'rgba(34, 197, 94, 0.1)' : 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
            <div style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: highlight ? '#22c55e' : isRanking ? getRankingColor(value) : 'var(--text)'
            }}>
                {value}
            </div>
        </div>
    );
}
