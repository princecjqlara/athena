'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import DailyReportsViewer from '@/components/DailyReportsViewer';
import SyncIndicator from '@/components/SyncIndicator';
import { useFacebookSync } from '@/hooks/useFacebookSync';
import dynamic from 'next/dynamic';

// Lazy load tab content components
const UploadPage = dynamic(() => import('../upload/page'), { ssr: false });
const ImportPage = dynamic(() => import('../import/page'), { ssr: false });
const CreateAdPage = dynamic(() => import('../create-ad/page'), { ssr: false });

// Main tab type
type MainTab = 'all' | 'upload' | 'import' | 'create';


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
        reach?: number;
        clicks?: number;
        ctr?: number;
        cpc?: number;
        cpm?: number;
        spend?: number;
        leads?: number;
        purchases?: number;
    };
    importedFromFacebook?: boolean;
    // Campaign/AdSet hierarchy
    campaign?: { id?: string; name?: string };
    adset?: { id?: string; name?: string };
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
    scoreReasoning?: string[];  // AI reasoning for the score
    impressions?: number;
    spend?: number;
    hasResults?: boolean;
    // AI Prediction fields
    predictedScore?: number;
    predictionDetails?: {
        globalScore: number;
        bestSegment: { segmentId: string; segmentName: string; score: number } | null;
        segmentScores: { segmentId: string; segmentName: string; score: number }[];
        confidence: number;
        keyFactors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }>;
        recommendations: string[];
    } | null;
    predictionGeneratedAt?: string;
    // Ad Connection - Link imported ads to uploaded ads
    linkedAdId?: string;                    // ID of the connected ad
    linkedAdType?: 'imported' | 'uploaded'; // Type of the linked ad
    linkedAt?: string;                      // Timestamp when connection was made
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
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as MainTab) || 'all';
    const [mainTab, setMainTab] = useState<MainTab>(initialTab);
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
    const [adDescription, setAdDescription] = useState('');  // Document-style input
    const [isAnalyzing, setIsAnalyzing] = useState(false);  // AI analysis state
    const [viewMode, setViewMode] = useState<'grid' | 'folders'>('folders');  // View mode toggle - default to folders
    const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());  // Expanded folder state

    // Daily Reports Modal State
    const [selectedAdForReport, setSelectedAdForReport] = useState<Ad | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dailyReportData, setDailyReportData] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    // Ad Connection Modal State
    const [connectingAd, setConnectingAd] = useState<Ad | null>(null);  // Ad currently being connected
    const [connectionSearchQuery, setConnectionSearchQuery] = useState('');  // Search filter for connection modal

    // Facebook Auto-Sync Hook
    const {
        syncState,
        syncNow,
        toggleAutoSync,
        setSyncInterval,
        formatLastSynced
    } = useFacebookSync({ autoSyncOnMount: true, syncDelayMs: 1500 });

    // Fetch daily report for an ad
    const fetchDailyReport = async (ad: Ad) => {
        setSelectedAdForReport(ad);
        setIsLoadingReport(true);
        setDailyReportData(null);

        try {
            const accessToken = localStorage.getItem('fb_access_token');
            if (!accessToken || !ad.facebookAdId) {
                console.log('No access token or Facebook ID');
                setIsLoadingReport(false);
                return;
            }

            const response = await fetch(
                `/api/facebook/insights?adId=${ad.facebookAdId}&accessToken=${accessToken}`
            );
            const data = await response.json();

            if (data.success && data.data?.dailyReport) {
                setDailyReportData(data.data.dailyReport);
            }
        } catch (error) {
            console.error('Error fetching daily report:', error);
        } finally {
            setIsLoadingReport(false);
        }
    };

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

        // Listen for Facebook sync completion
        const handleSyncComplete = () => {
            console.log('[MyAds] Sync complete, reloading ads...');
            loadAds();
        };
        window.addEventListener('facebook-sync-complete', handleSyncComplete);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('facebook-sync-complete', handleSyncComplete);
        };
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
        // Build description from existing traits for document-style editing
        const existingTraits = [...(ad.categories || []), ...(ad.traits || [])];
        const description = existingTraits.length > 0
            ? `Platform: ${ad.platform || 'Facebook'}\nHook: ${ad.extractedContent?.hookType || 'Unknown'}\nTraits: ${existingTraits.join(', ')}`
            : '';
        setAdDescription(description);
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingAdId(null);
        setEditTraits({ categories: [], traits: [], hookType: '', platform: '' });
        setAdDescription('');
    };

    // Analyze description using AI to extract traits
    const analyzeDescription = async () => {
        if (!adDescription.trim()) return;

        setIsAnalyzing(true);
        try {
            // Try AI analysis first
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Analyze this ad description and extract traits. Return JSON only:
{
  "platform": "Facebook|TikTok|Instagram|YouTube|Other",
  "hookType": "curiosity|shock|question|transformation|story|testimonial|demonstration|other",
  "categories": ["category1", "category2"],
  "traits": ["trait1", "trait2", "trait3"]
}

Ad description: ${adDescription}`,
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    // Try to parse AI response
                    try {
                        const parsed = typeof result.data === 'string'
                            ? JSON.parse(result.data.replace(/```json\n?|\n?```/g, '').trim())
                            : result.data;

                        setEditTraits({
                            platform: parsed.platform || editTraits.platform,
                            hookType: parsed.hookType || editTraits.hookType,
                            categories: parsed.categories || editTraits.categories,
                            traits: parsed.traits || editTraits.traits,
                        });
                        return;
                    } catch (e) {
                        console.log('AI parse failed, using keyword extraction');
                    }
                }
            }

            // Fallback: Simple keyword extraction
            const text = adDescription.toLowerCase();
            const detectedTraits: string[] = [];
            const detectedCategories: string[] = [];

            // Detect platform
            let platform = 'Facebook';
            if (text.includes('tiktok')) platform = 'TikTok';
            else if (text.includes('instagram')) platform = 'Instagram';
            else if (text.includes('youtube')) platform = 'YouTube';

            // Detect hook type
            let hookType = '';
            if (text.includes('curiosity')) hookType = 'curiosity';
            else if (text.includes('question')) hookType = 'question';
            else if (text.includes('transformation')) hookType = 'transformation';
            else if (text.includes('story')) hookType = 'story';
            else if (text.includes('testimonial') || text.includes('ugc')) hookType = 'testimonial';

            // Detect traits
            const traitKeywords = ['fast-paced', 'slow-motion', 'text overlay', 'music', 'voiceover', 'captions', 'before/after', 'demo', 'tutorial'];
            traitKeywords.forEach(t => { if (text.includes(t)) detectedTraits.push(t); });

            // Detect categories
            const categoryKeywords = ['product', 'lifestyle', 'educational', 'entertainment', 'promo', 'sale'];
            categoryKeywords.forEach(c => { if (text.includes(c)) detectedCategories.push(c); });

            setEditTraits(prev => ({
                ...prev,
                platform: platform || prev.platform,
                hookType: hookType || prev.hookType,
                traits: detectedTraits.length > 0 ? detectedTraits : prev.traits,
                categories: detectedCategories.length > 0 ? detectedCategories : prev.categories,
            }));

        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
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

    // Get linked ad by ID
    const getLinkedAd = (linkedAdId: string | undefined): Ad | null => {
        if (!linkedAdId) return null;
        return ads.find(a => a.id === linkedAdId) || null;
    };

    // Connect two ads together (bidirectional link)
    const connectAds = (sourceAd: Ad, targetAd: Ad) => {
        const now = new Date().toISOString();
        const sourceType: 'imported' | 'uploaded' = sourceAd.importedFromFacebook ? 'imported' : 'uploaded';
        const targetType: 'imported' | 'uploaded' = targetAd.importedFromFacebook ? 'imported' : 'uploaded';

        const updatedAds = ads.map(a => {
            if (a.id === sourceAd.id) {
                return {
                    ...a,
                    linkedAdId: targetAd.id,
                    linkedAdType: targetType,
                    linkedAt: now,
                    // Merge metrics from imported ad if linking uploaded to imported
                    ...(targetType === 'imported' && {
                        adInsights: targetAd.adInsights || a.adInsights,
                        hasResults: targetAd.hasResults || a.hasResults,
                        successScore: targetAd.successScore || a.successScore,
                    })
                };
            }
            if (a.id === targetAd.id) {
                return {
                    ...a,
                    linkedAdId: sourceAd.id,
                    linkedAdType: sourceType,
                    linkedAt: now,
                    // Merge traits from uploaded ad if linking imported to uploaded
                    ...(sourceType === 'uploaded' && {
                        extractedContent: sourceAd.extractedContent || a.extractedContent,
                        categories: sourceAd.categories || a.categories,
                        traits: sourceAd.traits || a.traits,
                    })
                };
            }
            return a;
        });

        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
        setConnectingAd(null);
        setConnectionSearchQuery('');
    };

    // Disconnect an ad from its linked ad
    const disconnectAd = (adToDisconnect: Ad) => {
        const linkedId = adToDisconnect.linkedAdId;

        const updatedAds = ads.map(a => {
            if (a.id === adToDisconnect.id || a.id === linkedId) {
                // Remove connection fields but keep merged data
                const { linkedAdId, linkedAdType, linkedAt, ...rest } = a;
                return rest as Ad;
            }
            return a;
        });

        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
    };

    // Get compatible ads for connection (opposite type and not already linked)
    const getConnectableAds = (sourceAd: Ad): Ad[] => {
        const isSourceImported = sourceAd.importedFromFacebook;
        return ads.filter(a => {
            // Must be opposite type
            const isTargetImported = a.importedFromFacebook;
            if (isSourceImported === isTargetImported) return false;
            // Can't be the same ad
            if (a.id === sourceAd.id) return false;
            // Can't already be linked
            if (a.linkedAdId) return false;
            // Match search query
            if (connectionSearchQuery && !getAdName(a).toLowerCase().includes(connectionSearchQuery.toLowerCase())) {
                return false;
            }
            return true;
        });
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

    // Group ads by campaign > adset for folder view
    const groupedByCampaign = filteredAds.reduce((acc, ad) => {
        const campaignName = ad.campaign?.name || 'Uncategorized';
        const adsetName = ad.adset?.name || 'Default Ad Set';

        if (!acc[campaignName]) {
            acc[campaignName] = { adsets: {}, totalAds: 0, totalSpend: 0 };
        }
        if (!acc[campaignName].adsets[adsetName]) {
            acc[campaignName].adsets[adsetName] = [];
        }
        acc[campaignName].adsets[adsetName].push(ad);
        acc[campaignName].totalAds++;
        acc[campaignName].totalSpend += getAdSpend(ad);

        return acc;
    }, {} as Record<string, { adsets: Record<string, Ad[]>, totalAds: number, totalSpend: number }>);

    // Toggle campaign folder expansion
    const toggleCampaign = (campaignName: string) => {
        setExpandedCampaigns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(campaignName)) {
                newSet.delete(campaignName);
            } else {
                newSet.add(campaignName);
            }
            return newSet;
        });
    };

    return (
        <div className={styles.page}>
            {/* Main Tab Navigation */}
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Ads Hub</h1>
                    <p className={styles.subtitle}>Manage, upload, import, and create your ads in one place</p>
                </div>
            </header>

            {/* Main Tabs */}
            <div className={styles.mainTabs} style={{
                display: 'flex',
                gap: 'var(--spacing-xs)',
                marginBottom: 'var(--spacing-lg)',
                padding: 'var(--spacing-xs)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-primary)',
            }}>
                <button
                    className={`${styles.mainTab} ${mainTab === 'all' ? styles.activeMainTab : ''}`}
                    onClick={() => setMainTab('all')}
                    style={{
                        flex: 1,
                        padding: 'var(--spacing-md)',
                        border: 'none',
                        borderRadius: 'var(--radius-lg)',
                        background: mainTab === 'all' ? 'var(--accent-gradient)' : 'transparent',
                        color: mainTab === 'all' ? 'white' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        transition: 'all 0.2s',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    All Ads
                </button>
                <button
                    className={`${styles.mainTab} ${mainTab === 'upload' ? styles.activeMainTab : ''}`}
                    onClick={() => setMainTab('upload')}
                    style={{
                        flex: 1,
                        padding: 'var(--spacing-md)',
                        border: 'none',
                        borderRadius: 'var(--radius-lg)',
                        background: mainTab === 'upload' ? 'var(--accent-gradient)' : 'transparent',
                        color: mainTab === 'upload' ? 'white' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        transition: 'all 0.2s',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                </button>
                <button
                    className={`${styles.mainTab} ${mainTab === 'import' ? styles.activeMainTab : ''}`}
                    onClick={() => setMainTab('import')}
                    style={{
                        flex: 1,
                        padding: 'var(--spacing-md)',
                        border: 'none',
                        borderRadius: 'var(--radius-lg)',
                        background: mainTab === 'import' ? 'var(--accent-gradient)' : 'transparent',
                        color: mainTab === 'import' ? 'white' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        transition: 'all 0.2s',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Import from FB
                </button>
                <button
                    className={`${styles.mainTab} ${mainTab === 'create' ? styles.activeMainTab : ''}`}
                    onClick={() => setMainTab('create')}
                    style={{
                        flex: 1,
                        padding: 'var(--spacing-md)',
                        border: 'none',
                        borderRadius: 'var(--radius-lg)',
                        background: mainTab === 'create' ? 'var(--accent-gradient)' : 'transparent',
                        color: mainTab === 'create' ? 'white' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        transition: 'all 0.2s',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Create Campaign
                </button>
            </div>

            {/* Tab Content */}
            {mainTab === 'upload' && (
                <div style={{ marginLeft: 'calc(-1 * var(--spacing-xl))', marginRight: 'calc(-1 * var(--spacing-xl))' }}>
                    <UploadPage />
                </div>
            )}

            {mainTab === 'import' && (
                <div style={{ marginLeft: 'calc(-1 * var(--spacing-xl))', marginRight: 'calc(-1 * var(--spacing-xl))' }}>
                    <ImportPage />
                </div>
            )}

            {mainTab === 'create' && (
                <div style={{ marginLeft: 'calc(-1 * var(--spacing-xl))', marginRight: 'calc(-1 * var(--spacing-xl))' }}>
                    <CreateAdPage />
                </div>
            )}

            {/* All Ads Tab Content */}
            {mainTab === 'all' && (
                <>
                    {/* Facebook Auto-Sync Indicator */}
                    {stats.imported > 0 && (
                        <SyncIndicator
                            syncState={syncState}
                            onSync={syncNow}
                            onToggleAutoSync={toggleAutoSync}
                            onSetInterval={setSyncInterval}
                            formatLastSynced={formatLastSynced}
                        />
                    )}

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

                        {/* View Mode Toggle */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginLeft: 'auto' }}>
                            <button
                                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                            </button>
                            <button
                                className={`btn btn-sm ${viewMode === 'folders' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setViewMode('folders')}
                                title="Folder View"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Ads Display (Grid or Folder View) */}
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
                    ) : viewMode === 'folders' ? (
                        /* Folder View */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {Object.entries(groupedByCampaign).map(([campaignName, campaign]) => (
                                <div key={campaignName} className="glass-card" style={{ overflow: 'hidden' }}>
                                    {/* Campaign Header (expandable) */}
                                    <div
                                        onClick={() => toggleCampaign(campaignName)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-sm)',
                                            padding: 'var(--spacing-md)',
                                            cursor: 'pointer',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            borderBottom: expandedCampaigns.has(campaignName) ? '1px solid var(--border)' : 'none'
                                        }}
                                    >
                                        <svg
                                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                            style={{ transform: expandedCampaigns.has(campaignName) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                        >
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                        </svg>
                                        <span style={{ fontWeight: 600, flex: 1 }}>{campaignName}</span>
                                        <span className="tag">{campaign.totalAds} ads</span>
                                        <span className="tag tag-secondary">₱{campaign.totalSpend.toLocaleString()}</span>
                                    </div>

                                    {/* Campaign Content (Ad Sets) */}
                                    {expandedCampaigns.has(campaignName) && (
                                        <div style={{ padding: 'var(--spacing-md)' }}>
                                            {Object.entries(campaign.adsets).map(([adsetName, adsInSet]) => (
                                                <div key={adsetName} style={{ marginBottom: 'var(--spacing-md)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)', color: 'var(--text-muted)' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                                            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                                                        </svg>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{adsetName}</span>
                                                        <span style={{ fontSize: '0.8rem' }}>({adsInSet.length})</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-lg)' }}>
                                                        {adsInSet.map(ad => (
                                                            <div
                                                                key={ad.id}
                                                                style={{
                                                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    border: '1px solid var(--border)'
                                                                }}
                                                            >
                                                                {/* Ad Header */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                                                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                        {ad.thumbnailUrl ? (
                                                                            <img src={ad.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                                                                        ) : (
                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <polygon points="5 3 19 12 5 21 5 3" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getAdName(ad)}</div>
                                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ad.importedFromFacebook ? '📊 Imported' : '📤 Uploaded'}</div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                                        {ad.predictedScore && (
                                                                            <span
                                                                                className="tag"
                                                                                style={{
                                                                                    fontSize: '0.65rem',
                                                                                    fontWeight: 600,
                                                                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))',
                                                                                    color: '#a78bfa',
                                                                                    border: '1px solid rgba(168, 85, 247, 0.4)'
                                                                                }}
                                                                                title={`AI Prediction: ${ad.predictedScore}%\nConfidence: ${ad.predictionDetails?.confidence || 0}%\n${ad.predictionDetails?.recommendations?.slice(0, 2).join('\n') || ''}`}
                                                                            >
                                                                                🤖 {ad.predictedScore}%
                                                                            </span>
                                                                        )}
                                                                        {ad.successScore && (
                                                                            <span className="tag tag-primary" style={{ fontSize: '0.7rem', fontWeight: 600 }}>{ad.successScore}%</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* Detailed Metrics Grid */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-xs)', fontSize: '0.7rem' }}>
                                                                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(59,130,246,0.1)', borderRadius: '4px' }}>
                                                                        <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{(ad.adInsights?.impressions || 0).toLocaleString()}</div>
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>Impressions</div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(16,185,129,0.1)', borderRadius: '4px' }}>
                                                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>{(ad.adInsights?.reach || 0).toLocaleString()}</div>
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>Reach</div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(139,92,246,0.1)', borderRadius: '4px' }}>
                                                                        <div style={{ fontWeight: 600, color: '#a78bfa' }}>{(ad.adInsights?.clicks || 0).toLocaleString()}</div>
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>Clicks</div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(236,72,153,0.1)', borderRadius: '4px' }}>
                                                                        <div style={{ fontWeight: 600, color: '#f472b6' }}>₱{getAdSpend(ad).toFixed(0)}</div>
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>Spend</div>
                                                                    </div>
                                                                </div>
                                                                {/* Secondary Metrics */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--spacing-xs)', padding: '4px 0', borderTop: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                                    <span>CTR: <strong style={{ color: getAdCtr(ad) > 2 ? 'var(--success)' : getAdCtr(ad) > 1 ? 'var(--warning)' : 'var(--error)' }}>{getAdCtr(ad).toFixed(2)}%</strong></span>
                                                                    <span>CPC: <strong>₱{ad.adInsights?.cpc?.toFixed(2) || '0.00'}</strong></span>
                                                                    <span>CPM: <strong>₱{ad.adInsights?.cpm?.toFixed(2) || '0.00'}</strong></span>
                                                                    {ad.facebookAdId && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); fetchDailyReport(ad); }}
                                                                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.65rem', padding: 0 }}
                                                                        >
                                                                            📅 Daily
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Grid View (existing) */
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
                                            {ad.importedFromFacebook ? 'Imported' : getAdStatus(ad)}
                                        </div>
                                        {/* Linked Ad Indicator */}
                                        {ad.linkedAdId && (
                                            <div
                                                className={styles.linkedBadge}
                                                title={`Linked to: ${getAdName(getLinkedAd(ad.linkedAdId) || {} as Ad)}`}
                                                style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                                    color: 'white',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                }}
                                            >
                                                🔗 Linked
                                            </div>
                                        )}
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
                                                    fontSize: '0.75rem',
                                                    padding: '0.25rem 0.5rem',
                                                    minWidth: 'auto',
                                                    background: STATUS_OPTIONS.find(s => s.value === getDisplayStatus(ad))?.color || 'var(--bg-tertiary)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {STATUS_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Show metrics if available */}
                                        {(getAdImpressions(ad) > 0 || ad.importedFromFacebook) && (
                                            <div className={styles.videoStats}>
                                                <div className={styles.videoStat}>
                                                    <span className={styles.videoStatLabel}>CTR</span>
                                                    <span className={styles.videoStatValue}>{getAdCtr(ad).toFixed(2)}%</span>
                                                </div>
                                                <div className={styles.videoStat}>
                                                    <span className={styles.videoStatLabel}>Spend</span>
                                                    <span className={styles.videoStatValue}>₱{getAdSpend(ad).toFixed(0)}</span>
                                                </div>
                                                {ad.predictedScore && (
                                                    <div
                                                        className={styles.videoStat}
                                                        title={`AI Prediction\nConfidence: ${ad.predictionDetails?.confidence || 0}%\n${ad.predictionDetails?.recommendations?.slice(0, 2).join('\n') || ''}`}
                                                        style={{ cursor: 'help' }}
                                                    >
                                                        <span className={styles.videoStatLabel}>🤖 AI</span>
                                                        <span className={styles.videoStatValue} style={{ color: '#a78bfa' }}>{ad.predictedScore}%</span>
                                                    </div>
                                                )}
                                                {ad.successScore && (
                                                    <div
                                                        className={styles.videoStat}
                                                        title={ad.scoreReasoning?.join(' • ') || 'Performance Score'}
                                                        style={{ cursor: 'help' }}
                                                    >
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
                                        {ad.facebookAdId && (
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                title="View Daily Report"
                                                onClick={() => fetchDailyReport(ad)}
                                                style={{ color: 'var(--accent-primary)' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                </svg>
                                            </button>
                                        )}
                                        {/* Connect/Disconnect Button */}
                                        {ad.linkedAdId ? (
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                title={`Disconnect from: ${getAdName(getLinkedAd(ad.linkedAdId) || {} as Ad)}`}
                                                onClick={() => disconnectAd(ad)}
                                                style={{ color: '#8b5cf6' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 00-.12-7.07 5.006 5.006 0 00-6.95 0l-1.72 1.71" />
                                                    <path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 00.12 7.07 5.006 5.006 0 006.95 0l1.71-1.71" />
                                                    <line x1="8" y1="2" x2="2" y2="8" />
                                                    <line x1="22" y1="16" x2="16" y2="22" />
                                                </svg>
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                title="Connect to another ad"
                                                onClick={() => setConnectingAd(ad)}
                                                style={{ color: '#6366f1' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                                                </svg>
                                            </button>
                                        )}
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
                                    {/* Document-Style Input */}
                                    <div className={styles.traitSection}>
                                        <h4>Describe Your Ad</h4>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                            Describe your ad in plain text. AI will extract traits automatically.
                                        </p>
                                        <textarea
                                            className="form-textarea"
                                            value={adDescription}
                                            onChange={(e) => setAdDescription(e.target.value)}
                                            placeholder="Example: This is a TikTok ad with fast-paced editing, uses a curiosity hook, includes text overlays and trending music. It's a product demo showing before/after transformation..."
                                            rows={4}
                                            style={{ width: '100%', marginBottom: 'var(--spacing-sm)' }}
                                        />
                                        <button
                                            className="btn btn-secondary"
                                            onClick={analyzeDescription}
                                            disabled={isAnalyzing || !adDescription.trim()}
                                            style={{ width: '100%' }}
                                        >
                                            {isAnalyzing ? 'Analyzing...' : 'Extract Traits with AI'}
                                        </button>
                                    </div>

                                    {/* Extracted Traits Preview */}
                                    {(editTraits.platform || editTraits.hookType || editTraits.categories.length > 0 || editTraits.traits.length > 0) && (
                                        <div className={styles.traitSection} style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md)' }}>
                                            <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Extracted Traits</h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                                {editTraits.platform && (
                                                    <span className="tag tag-primary">{editTraits.platform}</span>
                                                )}
                                                {editTraits.hookType && (
                                                    <span className="tag tag-secondary">{editTraits.hookType}</span>
                                                )}
                                                {editTraits.categories.map(cat => (
                                                    <span key={cat} className="tag" style={{ background: 'var(--accent-secondary)', color: 'white' }}>{cat}</span>
                                                ))}
                                                {editTraits.traits.map(trait => (
                                                    <span key={trait} className="tag">{trait}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Manual Options (Collapsible) */}
                                    <details style={{ marginTop: 'var(--spacing-md)' }}>
                                        <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            Manual Options (click to expand)
                                        </summary>
                                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                                            {/* Platform */}
                                            <div className={styles.traitSection}>
                                                <h4>Platform</h4>
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
                                                <h4>Hook Type</h4>
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
                                                <h4>Content Categories</h4>
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
                                                <h4>Editing Style</h4>
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
                                                <h4>Features</h4>
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
                                    </details>
                                </div>

                                <div className={styles.modalFooter}>
                                    <button className="btn btn-secondary" onClick={cancelEditing}>Cancel</button>
                                    <button className="btn btn-primary" onClick={saveTraitEdits}>
                                        Save Traits
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Daily Report Modal */}
                    {selectedAdForReport && (
                        <div
                            className={styles.modalOverlay}
                            onClick={() => setSelectedAdForReport(null)}
                            style={{ zIndex: 1000 }}
                        >
                            <div
                                className={styles.modal}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    maxWidth: '900px',
                                    width: '95%',
                                    maxHeight: '90vh',
                                    overflow: 'auto'
                                }}
                            >
                                <div className={styles.modalHeader}>
                                    <h3>📅 Daily Performance Report</h3>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => setSelectedAdForReport(null)}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>

                                <div style={{ padding: '20px' }}>
                                    <DailyReportsViewer
                                        data={dailyReportData}
                                        adName={getAdName(selectedAdForReport)}
                                        isLoading={isLoadingReport}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ad Connection Modal */}
                    {connectingAd && (
                        <div
                            className={styles.modalOverlay}
                            onClick={() => { setConnectingAd(null); setConnectionSearchQuery(''); }}
                            style={{ zIndex: 1000 }}
                        >
                            <div
                                className={styles.modal}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    maxWidth: '600px',
                                    width: '95%',
                                    maxHeight: '80vh',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div className={styles.modalHeader}>
                                    <h3>🔗 Connect Ad</h3>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => { setConnectingAd(null); setConnectionSearchQuery(''); }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>

                                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                                    <p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        Connect <strong>&quot;{getAdName(connectingAd)}&quot;</strong> ({connectingAd.importedFromFacebook ? 'Imported' : 'Uploaded'}) to a {connectingAd.importedFromFacebook ? 'uploaded creative' : 'Facebook imported ad'}
                                    </p>

                                    {/* Search box */}
                                    <div style={{ position: 'relative' }}>
                                        <svg
                                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                                        >
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Search ads to connect..."
                                            value={connectionSearchQuery}
                                            onChange={(e) => setConnectionSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px 10px 36px',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.875rem'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                                    {getConnectableAds(connectingAd).length === 0 ? (
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '40px 20px',
                                            color: 'var(--text-muted)'
                                        }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                                                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                                            </svg>
                                            <p style={{ margin: 0 }}>
                                                {connectionSearchQuery
                                                    ? 'No matching ads found'
                                                    : connectingAd.importedFromFacebook
                                                        ? 'No uploaded ads available to connect'
                                                        : 'No imported ads available to connect'
                                                }
                                            </p>
                                            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                                                {connectingAd.importedFromFacebook
                                                    ? 'Upload a new ad creative to connect it here'
                                                    : 'Import ads from Facebook to connect them here'
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {getConnectableAds(connectingAd).map(targetAd => (
                                                <div
                                                    key={targetAd.id}
                                                    onClick={() => connectAds(connectingAd, targetAd)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '12px',
                                                        background: 'var(--bg-tertiary)',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--border)';
                                                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                                                    }}
                                                >
                                                    {/* Thumbnail */}
                                                    <div style={{
                                                        width: 48,
                                                        height: 48,
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--bg-secondary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        overflow: 'hidden'
                                                    }}>
                                                        {targetAd.thumbnailUrl ? (
                                                            <img
                                                                src={targetAd.thumbnailUrl}
                                                                alt=""
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                        ) : (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polygon points="5 3 19 12 5 21 5 3" />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{
                                                            fontWeight: 600,
                                                            fontSize: '0.9rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            {getAdName(targetAd)}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-muted)',
                                                            display: 'flex',
                                                            gap: '8px',
                                                            marginTop: '4px'
                                                        }}>
                                                            <span>{targetAd.importedFromFacebook ? '📊 Imported' : '📤 Uploaded'}</span>
                                                            {targetAd.adInsights?.impressions && (
                                                                <span>• {targetAd.adInsights.impressions.toLocaleString()} impr.</span>
                                                            )}
                                                            {targetAd.successScore && (
                                                                <span>• Score: {targetAd.successScore}%</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Connect icon */}
                                                    <div style={{
                                                        color: 'var(--accent-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500
                                                    }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                                                        </svg>
                                                        Connect
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    padding: '12px 16px',
                                    borderTop: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    💡 Connecting ads merges performance data from imported ads with creative traits from uploaded ads
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
