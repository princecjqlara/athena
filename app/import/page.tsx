'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { DEFAULT_CATEGORIES } from '@/types/extended-ad';

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
    metrics: {
        impressions: number;
        reach: number;
        clicks: number;
        ctr: number;
        cpc: number;
        cpm: number;
        spend: number;
        frequency: number;
        linkClicks: number;
        leads: number;
        purchases: number;
    } | null;
}

export default function ImportPage() {
    const [adAccountId, setAdAccountId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

            const newAd = {
                id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                facebookAdId: fbAd.id,
                name: fbAd.name,
                mediaUrl: fbAd.thumbnailUrl,
                thumbnailUrl: fbAd.thumbnailUrl,
                mediaType: fbAd.mediaType,
                // Traits from user selection
                categories: traits.categories,
                traits: traits.traits,
                // Auto-filled from Facebook
                adInsights: fbAd.metrics ? {
                    impressions: fbAd.metrics.impressions,
                    clicks: fbAd.metrics.clicks,
                    ctr: fbAd.metrics.ctr,
                    reach: fbAd.metrics.reach,
                    spend: fbAd.metrics.spend,
                    cpc: fbAd.metrics.cpc,
                    frequency: fbAd.metrics.frequency,
                    leads: fbAd.metrics.leads,
                    purchases: fbAd.metrics.purchases,
                } : null,
                hasResults: !!fbAd.metrics,
                successScore,
                status: fbAd.effectiveStatus,
                importedFromFacebook: true,
                createdAt: fbAd.createdAt,
                importedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
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
            case 'ACTIVE': return '#10B981';
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
                    Import existing ads with auto-filled results • Just add traits for AI learning
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
                        <small style={{ color: 'var(--text-muted)' }}>Without "act_" prefix</small>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
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
                        {isLoading ? '🔄 Fetching...' : '📥 Fetch Ads'}
                    </button>
                </div>

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

            {/* Ads List */}
            {facebookAds.length > 0 && (
                <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                        <h3>📊 Found {facebookAds.length} Ads</h3>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
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
                                    background: selectedAds.has(ad.id) ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-secondary)',
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

                                        {/* Metrics */}
                                        {ad.metrics && (
                                            <div style={{
                                                display: 'flex',
                                                gap: 'var(--spacing-md)',
                                                fontSize: '0.8125rem',
                                                flexWrap: 'wrap',
                                                marginBottom: 'var(--spacing-sm)'
                                            }}>
                                                <span><strong>{ad.metrics.impressions.toLocaleString()}</strong> impressions</span>
                                                <span><strong>{ad.metrics.clicks.toLocaleString()}</strong> clicks</span>
                                                <span style={{ color: 'var(--success)' }}><strong>{ad.metrics.ctr.toFixed(2)}%</strong> CTR</span>
                                                <span><strong>${ad.metrics.spend.toFixed(2)}</strong> spent</span>
                                                {ad.metrics.leads > 0 && <span style={{ color: 'var(--primary)' }}><strong>{ad.metrics.leads}</strong> leads</span>}
                                                {ad.metrics.purchases > 0 && <span style={{ color: 'var(--success)' }}><strong>{ad.metrics.purchases}</strong> purchases</span>}
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
                                                                ? 'white'
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
                                                                ? 'white'
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
                        <li>✅ Just add traits for AI learning</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
