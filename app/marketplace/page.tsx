'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

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
    { value: 'tiktok', label: 'TikTok' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'multi', label: 'Multi-platform' },
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
    const [filters, setFilters] = useState<Filters>({
        industry: '',
        platform: '',
        audience: '',
        format: '',
    });

    // Request modal state
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedPool, setSelectedPool] = useState<DataPool | null>(null);
    const [requestReason, setRequestReason] = useState('');
    const [intendedUse, setIntendedUse] = useState('learning');
    const [submitting, setSubmitting] = useState(false);

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

            if (data.success) {
                setPools(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch data pools:', error);
        } finally {
            setLoading(false);
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

    return (
        <main className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>Data Marketplace</h1>
                    <p className={styles.subtitle}>
                        Browse and request access to public ad performance data pools
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
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

            {/* Data Pools Grid */}
            {loading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <span>Loading data pools...</span>
                </div>
            ) : pools.length === 0 ? (
                <div className={styles.empty}>
                    <p>No data pools found matching your filters.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {pools.map((pool) => {
                        const statusBadge = getStatusBadge(pool.accessStatus);
                        const canRequest = pool.accessStatus === 'none' || pool.accessStatus === 'denied' || pool.accessStatus === 'revoked';

                        return (
                            <div key={pool.id} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>{pool.name}</h3>
                                    <span className={`${styles.tierBadge} ${pool.access_tier === 'premium' ? styles.tierPremium : ''}`}>
                                        {pool.access_tier}
                                    </span>
                                </div>

                                <p className={styles.cardDescription}>{pool.description}</p>

                                <div className={styles.cardTags}>
                                    {pool.industry && <span className={styles.tag}>{pool.industry}</span>}
                                    {pool.platform && <span className={styles.tag}>{pool.platform}</span>}
                                    {pool.target_audience && <span className={styles.tag}>{pool.target_audience}</span>}
                                    {pool.creative_format && <span className={styles.tag}>{pool.creative_format}</span>}
                                </div>

                                <div className={styles.cardStats}>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{formatNumber(pool.data_points)}</span>
                                        <span className={styles.statLabel}>Data Points</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{pool.contributors}</span>
                                        <span className={styles.statLabel}>Contributors</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{pool.avg_success_rate}%</span>
                                        <span className={styles.statLabel}>Avg Success</span>
                                    </div>
                                </div>

                                <div className={styles.cardFooter}>
                                    {canRequest ? (
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
