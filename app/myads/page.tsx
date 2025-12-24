'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

// Unified Ad interface that handles both imported and uploaded ads
interface Ad {
    id: string;
    // For uploaded ads
    extractedContent?: {
        title?: string;
        platform?: string;
        hookType?: string;
        contentCategory?: string;
        mediaType?: string;
    };
    // For imported ads
    name?: string;
    facebookAdId?: string;
    categories?: string[];
    traits?: string[];
    adInsights?: {
        impressions?: number;
        clicks?: number;
        ctr?: number;
        spend?: number;
        leads?: number;
        purchases?: number;
    };
    importedFromFacebook?: boolean;
    // Common fields
    thumbnail?: string;
    thumbnailUrl?: string;
    uploadDate?: string;
    createdAt?: string;
    importedAt?: string;
    platform?: string;
    hook_type?: string;
    status?: 'active' | 'completed' | 'draft' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    // User-defined status tag
    userStatus?: 'active' | 'completed' | 'paused' | 'discontinued' | 'testing' | 'archived';
    mediaType?: 'video' | 'photo' | string;
    ctr?: number;
    roas?: number;
    successScore?: number;
    impressions?: number;
    spend?: number;
    hasResults?: boolean;
}

// Status options for dropdown
const STATUS_OPTIONS = [
    { value: 'active', label: '🟢 Active', color: '#22c55e' },
    { value: 'paused', label: '⏸️ Paused', color: '#f59e0b' },
    { value: 'completed', label: '✅ Completed', color: '#3b82f6' },
    { value: 'testing', label: '🧪 Testing', color: '#8b5cf6' },
    { value: 'discontinued', label: '🚫 Discontinued', color: '#ef4444' },
    { value: 'archived', label: '📦 Archived', color: '#6b7280' },
];

// Helper to get normalized values from either data format
function getAdName(ad: Ad): string {
    return ad.extractedContent?.title || ad.name || 'Untitled Ad';
}

function getAdPlatform(ad: Ad): string {
    return ad.extractedContent?.platform || ad.platform || 'Unknown';
}

function getAdHookType(ad: Ad): string {
    return ad.extractedContent?.hookType || ad.hook_type || 'N/A';
}

function getAdStatus(ad: Ad): string {
    const s = ad.status?.toLowerCase() || 'active';
    if (s === 'active') return 'active';
    if (s === 'paused' || s === 'archived') return 'completed';
    return 'draft';
}

function getAdDate(ad: Ad): string {
    const date = ad.uploadDate || ad.importedAt || ad.createdAt;
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
}

function getAdCtr(ad: Ad): number {
    return ad.adInsights?.ctr || ad.ctr || 0;
}

function getAdSpend(ad: Ad): number {
    return ad.adInsights?.spend || ad.spend || 0;
}

function getAdImpressions(ad: Ad): number {
    return ad.adInsights?.impressions || ad.impressions || 0;
}

function getMediaType(ad: Ad): string {
    return ad.extractedContent?.mediaType || ad.mediaType || 'video';
}

// Available trait options for editing
const TRAIT_OPTIONS = {
    categories: [
        'UGC', 'Testimonial', 'Product Demo', 'Educational', 'Entertainment',
        'Behind the Scenes', 'Tutorial', 'Unboxing', 'Review', 'Lifestyle'
    ],
    hookTypes: [
        'Curiosity', 'Shock', 'Question', 'Transformation', 'Story',
        'Problem Solution', 'Social Proof', 'Urgency', 'Benefit First'
    ],
    platforms: ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'Snapchat'],
    editingStyles: [
        'Fast Cuts', 'Cinematic', 'Raw Authentic', 'UGC Style', 'Slow Motion',
        'Stop Motion', 'Split Screen', 'Before/After'
    ],
    features: [
        'Subtitles', 'Text Overlays', 'Voiceover', 'Trending Music', 'Original Audio',
        'Face Visible', 'Product Focus', 'Logo Visible', 'CTA Button'
    ]
};

export default function MyAdsPage() {
    const [ads, setAds] = useState<Ad[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'paused' | 'discontinued' | 'imported'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'score' | 'ctr' | 'spend'>('date');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingAdId, setEditingAdId] = useState<string | null>(null);
    const [editTraits, setEditTraits] = useState<{ categories: string[], traits: string[], hookType: string, platform: string }>({
        categories: [],
        traits: [],
        hookType: '',
        platform: ''
    });

    // Load ads from localStorage
    useEffect(() => {
        const loadAds = () => {
            try {
                const stored = localStorage.getItem('ads');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setAds(parsed);
                }
            } catch (e) {
                console.error('Error loading ads:', e);
            }
            setIsLoading(false);
        };

        loadAds();

        // Listen for storage changes (from other tabs/pages)
        const handleStorageChange = () => loadAds();
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Delete an ad
    const handleDeleteAd = (adId: string, adName: string) => {
        const confirmed = window.confirm(`Delete "${adName}"?\n\nThis will permanently remove this ad and its data. This cannot be undone.`);
        if (!confirmed) return;

        const updatedAds = ads.filter(a => a.id !== adId);
        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
    };

    // Change ad status
    const handleStatusChange = (adId: string, newStatus: string) => {
        const updatedAds = ads.map(a =>
            a.id === adId ? { ...a, userStatus: newStatus as Ad['userStatus'] } : a
        );
        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
    };

    // Start editing traits for an ad
    const startEditingTraits = (ad: Ad) => {
        setEditingAdId(ad.id);
        setEditTraits({
            categories: ad.categories || [],
            traits: ad.traits || [],
            hookType: ad.extractedContent?.hookType || '',
            platform: ad.extractedContent?.platform || ad.platform || 'Facebook'
        });
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingAdId(null);
        setEditTraits({ categories: [], traits: [], hookType: '', platform: '' });
    };

    // Toggle a trait
    const toggleTrait = (type: 'categories' | 'traits', value: string) => {
        setEditTraits(prev => {
            const list = prev[type];
            return {
                ...prev,
                [type]: list.includes(value) ? list.filter(t => t !== value) : [...list, value]
            };
        });
    };

    // Save trait edits
    const saveTraitEdits = () => {
        if (!editingAdId) return;

        const updatedAds = ads.map(a => {
            if (a.id !== editingAdId) return a;
            return {
                ...a,
                categories: editTraits.categories,
                traits: editTraits.traits,
                extractedContent: {
                    ...a.extractedContent,
                    hookType: editTraits.hookType,
                    platform: editTraits.platform,
                    contentCategory: editTraits.categories[0] || a.extractedContent?.contentCategory,
                    customTraits: [...editTraits.categories, ...editTraits.traits]
                }
            };
        });

        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
        cancelEditing();
    };

    // Get display status (user-defined takes precedence)
    const getDisplayStatus = (ad: Ad): string => {
        return ad.userStatus || getAdStatus(ad);
    };

    const filteredAds = ads
        .filter(a => {
            if (filter === 'all') return true;
            if (filter === 'imported') return a.importedFromFacebook;
            // Check userStatus first, then fall back to computed status
            const status = a.userStatus || getAdStatus(a);
            return status === filter;
        })
        .filter(a => getAdName(a).toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            switch (sortBy) {
                case 'score':
                    return (b.successScore || 0) - (a.successScore || 0);
                case 'ctr':
                    return getAdCtr(b) - getAdCtr(a);
                case 'spend':
                    return getAdSpend(b) - getAdSpend(a);
                default:
                    const dateA = new Date(a.uploadDate || a.importedAt || a.createdAt || 0).getTime();
                    const dateB = new Date(b.uploadDate || b.importedAt || b.createdAt || 0).getTime();
                    return dateB - dateA;
            }
        });

    const stats = {
        total: ads.length,
        imported: ads.filter(a => a.importedFromFacebook).length,
        withResults: ads.filter(a => a.hasResults || getAdImpressions(a) > 0).length,
        avgCtr: ads.length > 0
            ? (ads.reduce((sum, a) => sum + getAdCtr(a), 0) / ads.length).toFixed(2)
            : '0.00',
        totalSpend: ads.reduce((sum, a) => sum + getAdSpend(a), 0),
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>My Ads</h1>
                    <p className={styles.subtitle}>Manage all your uploaded and imported ads</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <a href="/import" className="btn btn-secondary">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Import from Facebook
                    </a>
                    <a href="/upload" className="btn btn-primary">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Upload New
                    </a>
                </div>
            </header>

            {/* Quick Stats */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.total}</span>
                    <span className={styles.statLabel}>Total Ads</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={`${styles.statValue} ${styles.active}`}>{stats.imported}</span>
                    <span className={styles.statLabel}>From Facebook</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.withResults}</span>
                    <span className={styles.statLabel}>With Results</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={`${styles.statValue} ${styles.score}`}>{stats.avgCtr}%</span>
                    <span className={styles.statLabel}>Avg. CTR</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={styles.statValue}>₱{stats.totalSpend.toLocaleString()}</span>
                    <span className={styles.statLabel}>Total Spend</span>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filtersBar}>
                <div className={styles.searchBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search ads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.filterTabs}>
                    {(['all', 'imported', 'active', 'paused', 'completed', 'discontinued'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.filterTab} ${filter === tab ? styles.active : ''}`}
                            onClick={() => setFilter(tab)}
                        >
                            {tab === 'imported' ? '📥 FB' :
                                tab === 'discontinued' ? '🚫' :
                                    tab === 'paused' ? '⏸️' :
                                        tab === 'completed' ? '✅' :
                                            tab === 'active' ? '🟢' :
                                                tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                <div className={styles.sortSelect}>
                    <label>Sort by:</label>
                    <select
                        className="form-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    >
                        <option value="date">Date</option>
                        <option value="score">Success Score</option>
                        <option value="ctr">CTR</option>
                        <option value="spend">Spend</option>
                    </select>
                </div>
            </div>

            {/* Ads Grid */}
            {isLoading ? (
                <div className={styles.videoGrid}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className={`skeleton ${styles.videoSkeleton}`}></div>
                    ))}
                </div>
            ) : filteredAds.length === 0 ? (
                <div className={styles.emptyState}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <h3>No ads found</h3>
                    <p>
                        {searchQuery
                            ? 'Try adjusting your search or filters'
                            : 'Upload your first ad or import from Facebook'}
                    </p>
                    {!searchQuery && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                            <a href="/import" className="btn btn-secondary">Import from Facebook</a>
                            <a href="/upload" className="btn btn-primary">Upload Ad</a>
                        </div>
                    )}
                </div>
            ) : (
                <div className={styles.videoGrid}>
                    {filteredAds.map(ad => (
                        <div key={ad.id} className={`glass-card ${styles.videoCard}`}>
                            <div className={styles.videoThumbnail}>
                                {ad.thumbnailUrl ? (
                                    <img src={ad.thumbnailUrl} alt={getAdName(ad)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : getMediaType(ad) === 'photo' ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <polyline points="21 15 16 10 5 21" />
                                    </svg>
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                )}
                                <div className={`${styles.statusBadge} ${styles[getAdStatus(ad)]}`}>
                                    {ad.importedFromFacebook ? '📥 Imported' : getAdStatus(ad)}
                                </div>
                            </div>

                            <div className={styles.videoContent}>
                                <h3 className={styles.videoName}>{getAdName(ad)}</h3>

                                <div className={styles.videoMeta}>
                                    <span className="tag tag-primary">{getAdPlatform(ad)}</span>
                                    {/* Status dropdown */}
                                    <select
                                        className="form-select"
                                        value={getDisplayStatus(ad)}
                                        onChange={(e) => handleStatusChange(ad.id, e.target.value)}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '0.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: STATUS_OPTIONS.find(s => s.value === getDisplayStatus(ad))?.color || 'var(--bg-secondary)',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            minWidth: '100px'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {STATUS_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.videoDate}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    {getAdDate(ad)}
                                </div>

                                {/* Show metrics if available */}
                                {(getAdImpressions(ad) > 0 || getAdCtr(ad) > 0) && (
                                    <div className={styles.videoStats}>
                                        <div className={styles.videoStat}>
                                            <span className={styles.videoStatLabel}>CTR</span>
                                            <span className={styles.videoStatValue}>{getAdCtr(ad).toFixed(2)}%</span>
                                        </div>
                                        <div className={styles.videoStat}>
                                            <span className={styles.videoStatLabel}>Spend</span>
                                            <span className={styles.videoStatValue}>₱{getAdSpend(ad).toFixed(0)}</span>
                                        </div>
                                        {ad.successScore && (
                                            <div className={styles.videoStat}>
                                                <span className={styles.videoStatLabel}>Score</span>
                                                <span className={`${styles.videoStatValue} ${styles.score}`}>{ad.successScore}%</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={styles.videoActions}>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    title="Edit Traits"
                                    onClick={() => startEditingTraits(ad)}
                                    style={{ color: 'var(--accent-primary)' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                </button>
                                <a href="/analytics" className="btn btn-ghost btn-icon" title="Add Results">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="20" x2="12" y2="10" />
                                        <line x1="18" y1="20" x2="18" y2="4" />
                                        <line x1="6" y1="20" x2="6" y2="16" />
                                    </svg>
                                </a>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    title="Delete"
                                    onClick={() => handleDeleteAd(ad.id, getAdName(ad))}
                                    style={{ color: 'var(--error)' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                        <line x1="10" y1="11" x2="10" y2="17" />
                                        <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trait Editing Modal */}
            {editingAdId && (
                <div className={styles.modalOverlay} onClick={cancelEditing}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>🏷️ Edit Ad Traits</h3>
                            <button className="btn btn-ghost btn-icon" onClick={cancelEditing}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.modalContent}>
                            {/* Platform */}
                            <div className={styles.traitSection}>
                                <h4>📱 Platform</h4>
                                <div className={styles.traitGrid}>
                                    {TRAIT_OPTIONS.platforms.map(platform => (
                                        <button
                                            key={platform}
                                            className={`${styles.traitChip} ${editTraits.platform === platform ? styles.selected : ''}`}
                                            onClick={() => setEditTraits(prev => ({ ...prev, platform }))}
                                        >
                                            {platform}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Hook Type */}
                            <div className={styles.traitSection}>
                                <h4>🎣 Hook Type</h4>
                                <div className={styles.traitGrid}>
                                    {TRAIT_OPTIONS.hookTypes.map(hook => (
                                        <button
                                            key={hook}
                                            className={`${styles.traitChip} ${editTraits.hookType === hook ? styles.selected : ''}`}
                                            onClick={() => setEditTraits(prev => ({ ...prev, hookType: hook }))}
                                        >
                                            {hook}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Categories */}
                            <div className={styles.traitSection}>
                                <h4>📂 Content Categories</h4>
                                <div className={styles.traitGrid}>
                                    {TRAIT_OPTIONS.categories.map(cat => (
                                        <button
                                            key={cat}
                                            className={`${styles.traitChip} ${editTraits.categories.includes(cat) ? styles.selected : ''}`}
                                            onClick={() => toggleTrait('categories', cat)}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Editing Styles */}
                            <div className={styles.traitSection}>
                                <h4>🎬 Editing Style</h4>
                                <div className={styles.traitGrid}>
                                    {TRAIT_OPTIONS.editingStyles.map(style => (
                                        <button
                                            key={style}
                                            className={`${styles.traitChip} ${editTraits.traits.includes(style) ? styles.selected : ''}`}
                                            onClick={() => toggleTrait('traits', style)}
                                        >
                                            {style}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Features */}
                            <div className={styles.traitSection}>
                                <h4>✨ Features</h4>
                                <div className={styles.traitGrid}>
                                    {TRAIT_OPTIONS.features.map(feature => (
                                        <button
                                            key={feature}
                                            className={`${styles.traitChip} ${editTraits.traits.includes(feature) ? styles.selected : ''}`}
                                            onClick={() => toggleTrait('traits', feature)}
                                        >
                                            {feature}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className="btn btn-secondary" onClick={cancelEditing}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveTraitEdits}>
                                💾 Save Traits
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
