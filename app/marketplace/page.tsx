'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import GalaxyOrbs from '@/components/GalaxyOrbs';
import AIDataGatherer from '@/components/AIDataGatherer';

interface DataPool {
    id: string;
    name: string;
    slug: string;
    description: string;
    industry: string;
    target_audience: string;
    platform: string;
    creative_format: string;
    data_points: number;
    contributors: number;
    avg_success_rate: number;
    access_tier: string;
    accessStatus: 'none' | 'pending' | 'approved' | 'denied' | 'revoked';
}

interface Filters {
    industry: string;
    platform: string;
    audience: string;
    format: string;
}

interface CompiledData {
    targetAudience: {
        demographics: string[];
        interests: string[];
        behaviors: string[];
        painPoints: string[];
    };
    adPreferences: {
        platforms: string[];
        contentTypes: string[];
        tones: string[];
        hooks: string[];
    };
    businessContext: {
        industry: string;
        products: string[];
        uniqueValue: string;
        competitors: string[];
    };
    goals: {
        objectives: string[];
        metrics: string[];
        timeline: string;
    };
}

interface PoolInsights {
    totalPatterns: number;
    avgConfidence: number;
    totalSampleSize: number;
}

const INDUSTRIES = [
    { value: '', label: 'All Industries' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'saas', label: 'SaaS' },
    { value: 'finance', label: 'Finance' },
    { value: 'health', label: 'Health & Wellness' },
    { value: 'local_services', label: 'Local Services' },
];

const PLATFORMS = [
    { value: '', label: 'All Platforms' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
];

const AUDIENCES = [
    { value: '', label: 'All Audiences' },
    { value: 'gen_z', label: 'Gen Z (18-25)' },
    { value: 'millennials', label: 'Millennials (26-40)' },
    { value: 'b2b', label: 'B2B' },
    { value: 'high_income', label: 'High Income' },
    { value: 'parents', label: 'Parents' },
];

const FORMATS = [
    { value: '', label: 'All Formats' },
    { value: 'ugc', label: 'UGC' },
    { value: 'testimonial', label: 'Testimonial' },
    { value: 'product_demo', label: 'Product Demo' },
    { value: 'founder_led', label: 'Founder-Led' },
    { value: 'meme', label: 'Meme/Trend' },
];

const INTENDED_USES = [
    { value: 'learning', label: 'Learning & Research' },
    { value: 'business', label: 'Business/Commercial' },
    { value: 'agency', label: 'Agency Use' },
    { value: 'research', label: 'Academic Research' },
    { value: 'other', label: 'Other' },
];

export default function MarketplacePage() {
    const [pools, setPools] = useState<DataPool[]>([]);
    const [loading, setLoading] = useState(true);

    // View mode: 'orbs' for Galaxy Orbs, 'pools' for traditional grid
    const [viewMode, setViewMode] = useState<'orbs' | 'pools'>('orbs');

    // AI Data Gatherer state
    const [showAIGatherer, setShowAIGatherer] = useState(false);
    const [isPersonalized, setIsPersonalized] = useState(false);
    const [personalizedData, setPersonalizedData] = useState<CompiledData | null>(null);

    // Pool insights from public API
    const [poolInsights, setPoolInsights] = useState<PoolInsights | null>(null);

    // AI Suggestion Mode (replaces manual filters)
    const [useAiMode, setUseAiMode] = useState(true);
    const [businessType, setBusinessType] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [products, setProducts] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<Array<{
        poolName: string;
        industry: string;
        platform: string;
        audience: string;
        format: string;
        relevanceScore: number;
        reasoning: string;
        expectedInsights: string[];
    }>>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Legacy filters (for manual mode)
    const [filters, setFilters] = useState<Filters>({
        industry: '',
        platform: '',
        audience: '',
        format: '',
    });

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Request modal state
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedPool, setSelectedPool] = useState<DataPool | null>(null);
    const [requestReason, setRequestReason] = useState('');
    const [intendedUse, setIntendedUse] = useState('learning');
    const [submitting, setSubmitting] = useState(false);
    
    // Seeding state for Galaxy Orbs
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

    // Get user ID from localStorage
    const getUserId = () => {
        if (typeof window === 'undefined') return null;
        let userId = localStorage.getItem('athena_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            localStorage.setItem('athena_user_id', userId);
        }
        return userId;
    };

    // Generate user's personal data pool from localStorage ads
    const generateMyDataPool = (): DataPool | null => {
        try {
            const storedAds = JSON.parse(localStorage.getItem('ads') || '[]');
            if (storedAds.length === 0) return null;

            // Calculate aggregate stats from user's ads
            let totalImpressions = 0;
            let totalSpend = 0;
            let totalCTR = 0;
            let totalROAS = 0;
            let adsWithCTR = 0;
            let adsWithROAS = 0;
            let adsWithResults = 0;
            const platforms: Record<string, number> = {};
            const formats: Record<string, number> = {};
            const industries: Record<string, number> = {};
            const audiences: Record<string, number> = {};

            storedAds.forEach((ad: any) => {
                const metrics = ad.metrics || ad.adInsights || {};
                const content = ad.extractedContent || {};

                // Aggregate metrics
                totalImpressions += metrics.impressions || 0;
                totalSpend += metrics.spend || 0;
                if (metrics.ctr) { totalCTR += metrics.ctr; adsWithCTR++; }
                const roas = metrics.purchaseRoas || metrics.roas;
                if (roas) { totalROAS += roas; adsWithROAS++; }
                if (ad.successScore) adsWithResults++;

                // Count platforms
                const platform = content.platform || 'facebook';
                platforms[platform] = (platforms[platform] || 0) + 1;

                // Count formats
                const format = content.contentCategory || ad.mediaType || 'video';
                formats[format] = (formats[format] || 0) + 1;

                // Count demographics from ad data
                if (ad.demographics && Array.isArray(ad.demographics)) {
                    ad.demographics.forEach((demo: any) => {
                        if (demo.age) {
                            // Map age to audience category
                            if (demo.age.includes('18') || demo.age.includes('24')) {
                                audiences['gen_z'] = (audiences['gen_z'] || 0) + demo.impressions;
                            } else if (demo.age.includes('25') || demo.age.includes('34') || demo.age.includes('35') || demo.age.includes('44')) {
                                audiences['millennials'] = (audiences['millennials'] || 0) + demo.impressions;
                            }
                        }
                    });
                }
            });

            // Determine primary platform
            const primaryPlatform = Object.entries(platforms)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'facebook';

            // Determine primary format
            const primaryFormat = Object.entries(formats)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'video';

            // Determine primary audience
            const primaryAudience = Object.entries(audiences)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'millennials';

            // Calculate averages
            const avgCTR = adsWithCTR > 0 ? totalCTR / adsWithCTR : 0;
            const avgROAS = adsWithROAS > 0 ? totalROAS / adsWithROAS : 0;
            const avgSuccessRate = adsWithResults > 0 ? (adsWithResults / storedAds.length) * 100 : 0;

            return {
                id: 'my-data-pool',
                name: '📊 My Ad Data',
                slug: 'my-data',
                description: `Your personal Facebook/Instagram ad performance data. Contains ${storedAds.length} ads with ${totalImpressions.toLocaleString()} total impressions and $${totalSpend.toFixed(2)} total spend.`,
                industry: 'my_business',
                target_audience: primaryAudience,
                platform: primaryPlatform,
                creative_format: primaryFormat,
                data_points: storedAds.length,
                contributors: 1,
                avg_success_rate: Math.round(avgSuccessRate),
                access_tier: 'owner',
                accessStatus: 'approved' as const,
            };
        } catch (e) {
            console.error('Error generating my data pool:', e);
            return null;
        }
    };

    // Fetch data pools
    useEffect(() => {
        fetchPools();
    }, [filters]);

    const fetchPools = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.industry) params.set('industry', filters.industry);
            if (filters.platform) params.set('platform', filters.platform);
            if (filters.audience) params.set('audience', filters.audience);
            if (filters.format) params.set('format', filters.format);

            const userId = getUserId();
            if (userId) params.set('userId', userId);

            const response = await fetch(`/api/data-pools?${params.toString()}`);
            const data = await response.json();

            // Generate user's personal data pool from their localStorage ads
            const myDataPool = generateMyDataPool();

            if (data.success) {
                // Prepend user's data pool if they have ads
                const allPools = myDataPool ? [myDataPool, ...(data.data || [])] : (data.data || []);
                setPools(allPools);
            } else {
                // Even if API fails, show user's data pool
                if (myDataPool) {
                    setPools([myDataPool]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch data pools:', error);
            // Still show user's data pool on error
            const myDataPool = generateMyDataPool();
            if (myDataPool) {
                setPools([myDataPool]);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch AI suggestions based on business profile
    const fetchAiSuggestions = async () => {
        if (!businessType.trim()) {
            alert('Please describe your business type first');
            return;
        }

        setLoadingSuggestions(true);
        try {
            const response = await fetch('/api/ai/suggest-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessType,
                    targetAudience,
                    products,
                    currentAds: parseInt(localStorage.getItem('ads_count') || '0')
                })
            });

            const data = await response.json();

            if (data.success && data.suggestions) {
                setAiSuggestions(data.suggestions);

                // Apply first suggestion's filters to match pools
                if (data.suggestions.length > 0) {
                    const first = data.suggestions[0];
                    setFilters({
                        industry: first.industry || '',
                        platform: first.platform || '',
                        audience: first.audience || '',
                        format: first.format || ''
                    });
                }
            }
        } catch (error) {
            console.error('Failed to get AI suggestions:', error);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const openRequestModal = (pool: DataPool) => {
        setSelectedPool(pool);
        setRequestReason('');
        setIntendedUse('learning');
        setShowRequestModal(true);
    };

    const submitRequest = async () => {
        if (!selectedPool) return;

        setSubmitting(true);
        try {
            const userId = getUserId();
            const userEmail = localStorage.getItem('athena_user_email') || '';

            const response = await fetch('/api/data-pools/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    userEmail,
                    poolId: selectedPool.id,
                    reason: requestReason,
                    intendedUse,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Refresh pools to update access status
                await fetchPools();
                setShowRequestModal(false);
                alert(data.message);
            } else {
                alert(data.error || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Failed to submit request:', error);
            alert('Failed to submit request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Seed Galaxy Orbs with user's ad traits
    const seedGalaxyOrbs = async () => {
        setSeeding(true);
        setSeedResult(null);
        try {
            const storedAds = JSON.parse(localStorage.getItem('ads') || '[]');
            if (storedAds.length === 0) {
                setSeedResult({ success: false, message: 'No ads to seed. Import some ads first!' });
                return;
            }

            const userId = getUserId();
            const response = await fetch('/api/pool/seed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ads: storedAds,
                    contributorHash: userId,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setSeedResult({ 
                    success: true, 
                    message: `✨ ${data.message}` 
                });
                // Refresh the page to reload Galaxy Orbs
                window.location.reload();
            } else {
                setSeedResult({ success: false, message: data.error || 'Failed to seed' });
            }
        } catch (error) {
            console.error('Seed error:', error);
            setSeedResult({ success: false, message: 'Failed to seed Galaxy Orbs' });
        } finally {
            setSeeding(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { label: string; className: string }> = {
            none: { label: 'Request Access', className: styles.statusNone },
            pending: { label: 'Pending', className: styles.statusPending },
            approved: { label: 'Access Granted', className: styles.statusApproved },
            denied: { label: 'Denied', className: styles.statusDenied },
            revoked: { label: 'Revoked', className: styles.statusDenied },
        };
        return statusConfig[status] || statusConfig.none;
    };

    const formatNumber = (num: number) => {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    };

    // Filter pools by search query
    const filteredPools = pools.filter(pool => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            pool.name.toLowerCase().includes(query) ||
            pool.description?.toLowerCase().includes(query) ||
            pool.industry?.toLowerCase().includes(query) ||
            pool.platform?.toLowerCase().includes(query)
        );
    });

    return (
        <main className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>
                        Data Marketplace
                        {isPersonalized && (
                            <span className={styles.personalizedBadge}>
                                ✨ Personalized
                            </span>
                        )}
                    </h1>
                    <p className={styles.subtitle}>
                        Explore community patterns and request access to public ad performance data
                    </p>
                </div>
            </div>

            {/* View Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.viewToggleBtn} ${viewMode === 'orbs' ? styles.viewToggleBtnActive : ''}`}
                        onClick={() => setViewMode('orbs')}
                    >
                        🌌 Galaxy Orbs
                    </button>
                    <button
                        className={`${styles.viewToggleBtn} ${viewMode === 'pools' ? styles.viewToggleBtnActive : ''}`}
                        onClick={() => setViewMode('pools')}
                    >
                        📊 Data Pools
                    </button>
                </div>
            </div>

            {/* Galaxy Orbs Section */}
            {viewMode === 'orbs' && (
                <div className={styles.galaxyOrbsSection}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            🌌 Community Patterns
                            <span className={styles.sectionBadge}>Public Pool</span>
                        </h2>
                    </div>

                    {/* AI Data Gatherer Trigger */}
                    <button
                        className={styles.aiGathererTrigger}
                        onClick={() => setShowAIGatherer(true)}
                        style={{ marginBottom: '20px' }}
                    >
                        🤖 Ask AI to find data for you
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            (e.g., &quot;Get me data for business owners&quot;)
                        </span>
                    </button>

                    {/* Seed Galaxy Orbs Button - shows when pool might be empty */}
                    {generateMyDataPool() && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '16px',
                            padding: '12px 16px',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
                            borderRadius: '12px',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}>
                            <span style={{ fontSize: '0.9rem' }}>
                                🚀 <strong>Seed Galaxy Orbs</strong> with your ad traits to visualize patterns
                            </span>
                            <button
                                onClick={seedGalaxyOrbs}
                                disabled={seeding}
                                style={{
                                    padding: '8px 16px',
                                    background: seeding ? 'var(--bg-tertiary)' : 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: seeding ? 'wait' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                {seeding ? (
                                    <>
                                        <span style={{ 
                                            width: '14px', 
                                            height: '14px', 
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTop: '2px solid white',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                        }}></span>
                                        Seeding...
                                    </>
                                ) : (
                                    '✨ Seed Now'
                                )}
                            </button>
                            {seedResult && (
                                <span style={{ 
                                    fontSize: '0.85rem', 
                                    color: seedResult.success ? 'var(--success)' : 'var(--error)' 
                                }}>
                                    {seedResult.message}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Galaxy Orbs Visualization */}
                    <GalaxyOrbs
                        searchQuery={searchQuery}
                        filters={{
                            industry: filters.industry,
                            platform: filters.platform,
                            audience: filters.audience
                        }}
                        onPatternSelect={(pattern) => {
                            console.log('Selected pattern:', pattern);
                            // Could open a detail modal or apply as filter
                        }}
                        maxOrbs={50}
                    />

                    {/* Insights Summary */}
                    {poolInsights && (
                        <div className={styles.insightsSummary}>
                            <div className={styles.insightCard}>
                                <div className={styles.insightValue}>{poolInsights.totalPatterns}</div>
                                <div className={styles.insightLabel}>Patterns</div>
                            </div>
                            <div className={styles.insightCard}>
                                <div className={styles.insightValue}>{poolInsights.avgConfidence}%</div>
                                <div className={styles.insightLabel}>Avg Confidence</div>
                            </div>
                            <div className={styles.insightCard}>
                                <div className={styles.insightValue}>{formatNumber(poolInsights.totalSampleSize)}</div>
                                <div className={styles.insightLabel}>Data Points</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* AI Data Gatherer Modal */}
            {showAIGatherer && (
                <div className={styles.aiGathererOpen} onClick={() => setShowAIGatherer(false)}>
                    <div className={styles.aiGathererContainer} onClick={e => e.stopPropagation()}>
                        <AIDataGatherer
                            onComplete={(data) => {
                                setPersonalizedData(data);
                                setIsPersonalized(true);
                                setShowAIGatherer(false);
                                // Apply filters based on gathered data
                                if (data.businessContext.industry) {
                                    setFilters(prev => ({
                                        ...prev,
                                        industry: data.businessContext.industry.toLowerCase()
                                    }));
                                }
                                if (data.adPreferences.platforms.length > 0) {
                                    setFilters(prev => ({
                                        ...prev,
                                        platform: data.adPreferences.platforms[0].toLowerCase()
                                    }));
                                }
                            }}
                            onCancel={() => setShowAIGatherer(false)}
                        />
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className={styles.searchContainer}>
                <input
                    type="search"
                    placeholder="🔍 Search pools by name, description, industry..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* AI-Powered Business Profile */}
            <div className={styles.filters} style={{ flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>🧠 AI-Powered Suggestions</h3>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setUseAiMode(!useAiMode)}
                        style={{ fontSize: '0.8rem' }}
                    >
                        {useAiMode ? '⚙️ Manual Mode' : '🤖 AI Mode'}
                    </button>
                </div>

                {useAiMode ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                            <div className={styles.filterGroup}>
                                <label>🏢 Your Business Type *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., E-commerce, SaaS, Local Services..."
                                    value={businessType}
                                    onChange={(e) => setBusinessType(e.target.value)}
                                    className={styles.searchInput}
                                    style={{ background: 'var(--bg-secondary)', padding: '10px 12px' }}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>🎯 Target Audience</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Gen Z, Business owners, Parents..."
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    className={styles.searchInput}
                                    style={{ background: 'var(--bg-secondary)', padding: '10px 12px' }}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>📦 Products/Services</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Skincare products, Project management SaaS..."
                                    value={products}
                                    onChange={(e) => setProducts(e.target.value)}
                                    className={styles.searchInput}
                                    style={{ background: 'var(--bg-secondary)', padding: '10px 12px' }}
                                />
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={fetchAiSuggestions}
                            disabled={loadingSuggestions || !businessType.trim()}
                            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {loadingSuggestions ? (
                                <>
                                    <span className={styles.spinner} style={{ width: 16, height: 16 }}></span>
                                    Analyzing...
                                </>
                            ) : (
                                '✨ Suggest for Me'
                            )}
                        </button>

                        {/* AI Suggestions Display */}
                        {aiSuggestions.length > 0 && (
                            <div style={{
                                marginTop: '16px',
                                padding: '16px',
                                background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))',
                                borderRadius: '12px',
                                border: '1px solid rgba(16,185,129,0.3)'
                            }}>
                                <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--success)' }}>
                                    🎯 Recommended for Your Business
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {aiSuggestions.map((suggestion, idx) => (
                                        <div key={idx} style={{
                                            padding: '12px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            border: filters.industry === suggestion.industry ? '2px solid var(--primary)' : '2px solid transparent'
                                        }}
                                            onClick={() => setFilters({
                                                industry: suggestion.industry || '',
                                                platform: suggestion.platform || '',
                                                audience: suggestion.audience || '',
                                                format: suggestion.format || ''
                                            })}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <strong style={{ fontSize: '0.9rem' }}>{suggestion.poolName}</strong>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '2px 8px',
                                                    background: suggestion.relevanceScore >= 90 ? 'var(--success)' : 'var(--warning)',
                                                    borderRadius: '12px',
                                                    color: 'white'
                                                }}>
                                                    {suggestion.relevanceScore}% Match
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                                                💡 {suggestion.reasoning}
                                            </p>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {suggestion.expectedInsights?.map((insight, i) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.7rem',
                                                        padding: '2px 6px',
                                                        background: 'rgba(99,102,241,0.2)',
                                                        borderRadius: '4px',
                                                        color: 'var(--primary)'
                                                    }}>
                                                        {insight}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Manual Filter Mode (legacy) */
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div className={styles.filterGroup}>
                            <label>Industry</label>
                            <select
                                value={filters.industry}
                                onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                            >
                                {INDUSTRIES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Platform</label>
                            <select
                                value={filters.platform}
                                onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                            >
                                {PLATFORMS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Audience</label>
                            <select
                                value={filters.audience}
                                onChange={(e) => setFilters({ ...filters, audience: e.target.value })}
                            >
                                {AUDIENCES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterGroup}>
                            <label>Format</label>
                            <select
                                value={filters.format}
                                onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                            >
                                {FORMATS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* No Ads Banner - encourage import */}
            {!loading && !generateMyDataPool() && (
                <div style={{ 
                    background: 'linear-gradient(135deg, rgba(24, 119, 242, 0.15) 0%, rgba(138, 58, 185, 0.15) 100%)',
                    border: '1px dashed rgba(24, 119, 242, 0.5)',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                    textAlign: 'center'
                }}>
                    <h3 style={{ margin: '0 0 8px 0', color: '#1877F2' }}>📊 No Ad Data Yet</h3>
                    <p style={{ margin: '0 0 16px 0', opacity: 0.8 }}>
                        Import your Facebook/Instagram ads to see your personal data pool and compare with marketplace insights.
                    </p>
                    <a 
                        href="/import" 
                        style={{ 
                            background: '#1877F2',
                            color: 'white',
                            padding: '10px 24px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            display: 'inline-block'
                        }}
                    >
                        Import from Facebook →
                    </a>
                </div>
            )}

            {/* Data Pools Grid */}
            {loading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <span>Loading data pools...</span>
                </div>
            ) : filteredPools.length === 0 ? (
                <div className={styles.empty}>
                    <p>{searchQuery ? 'No pools match your search.' : 'No data pools found matching your filters.'}</p>
                    {!generateMyDataPool() && (
                        <p style={{ marginTop: '12px' }}>
                            <a href="/import" style={{ color: '#1877F2' }}>Import your Facebook ads</a> to get started!
                        </p>
                    )}
                </div>
            ) : (
                <div className={styles.grid}>
                    {filteredPools.map((pool) => {
                        const statusBadge = getStatusBadge(pool.accessStatus);
                        const canRequest = pool.accessStatus === 'none' || pool.accessStatus === 'denied' || pool.accessStatus === 'revoked';
                        const isMyData = pool.id === 'my-data-pool';

                        return (
                            <div 
                                key={pool.id} 
                                className={`${styles.card} ${isMyData ? styles.cardMyData : ''}`}
                                style={isMyData ? { border: '2px solid #4CAF50', background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(33, 150, 243, 0.1) 100%)' } : undefined}
                            >
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>{pool.name}</h3>
                                    <span 
                                        className={`${styles.tierBadge} ${pool.access_tier === 'premium' ? styles.tierPremium : ''}`}
                                        style={isMyData ? { background: '#4CAF50', color: 'white' } : undefined}
                                    >
                                        {isMyData ? '✓ Your Data' : pool.access_tier}
                                    </span>
                                </div>

                                <p className={styles.cardDescription}>{pool.description}</p>

                                <div className={styles.cardTags}>
                                    {isMyData ? (
                                        <>
                                            <span className={styles.tag} style={{ background: '#1877F2', color: 'white' }}>Facebook</span>
                                            <span className={styles.tag} style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', color: 'white' }}>Instagram</span>
                                        </>
                                    ) : (
                                        <>
                                            {pool.industry && <span className={styles.tag}>{pool.industry}</span>}
                                            {pool.platform && <span className={styles.tag}>{pool.platform}</span>}
                                            {pool.target_audience && <span className={styles.tag}>{pool.target_audience}</span>}
                                            {pool.creative_format && <span className={styles.tag}>{pool.creative_format}</span>}
                                        </>
                                    )}
                                </div>

                                <div className={styles.cardStats}>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{formatNumber(pool.data_points)}</span>
                                        <span className={styles.statLabel}>{isMyData ? 'Ads' : 'Data Points'}</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{pool.contributors}</span>
                                        <span className={styles.statLabel}>{isMyData ? 'Account' : 'Contributors'}</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{pool.avg_success_rate}%</span>
                                        <span className={styles.statLabel}>Avg Success</span>
                                    </div>
                                </div>

                                <div className={styles.cardFooter}>
                                    {isMyData ? (
                                        <a 
                                            href="/myads" 
                                            className={styles.requestBtn}
                                            style={{ background: '#4CAF50', textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}
                                        >
                                            View My Ads →
                                        </a>
                                    ) : canRequest ? (
                                        <button
                                            className={styles.requestBtn}
                                            onClick={() => openRequestModal(pool)}
                                        >
                                            Request Access
                                        </button>
                                    ) : (
                                        <span className={`${styles.statusBadge} ${statusBadge.className}`}>
                                            {statusBadge.label}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Request Modal */}
            {showRequestModal && selectedPool && (
                <div className={styles.modalOverlay} onClick={() => setShowRequestModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Request Access</h2>
                            <button className={styles.closeBtn} onClick={() => setShowRequestModal(false)}>×</button>
                        </div>

                        <div className={styles.modalBody}>
                            <p className={styles.modalPoolName}>
                                Requesting access to: <strong>{selectedPool.name}</strong>
                            </p>

                            <div className={styles.formGroup}>
                                <label>Intended Use *</label>
                                <select
                                    value={intendedUse}
                                    onChange={(e) => setIntendedUse(e.target.value)}
                                >
                                    {INTENDED_USES.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Why do you need access? (Optional)</label>
                                <textarea
                                    value={requestReason}
                                    onChange={(e) => setRequestReason(e.target.value)}
                                    placeholder="Briefly describe how you plan to use this data..."
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowRequestModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.submitBtn}
                                onClick={submitRequest}
                                disabled={submitting}
                            >
                                {submitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
