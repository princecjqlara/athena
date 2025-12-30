'use client';

import { useState } from 'react';
import styles from './AdAnalyticsPanel.module.css';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

// Types
interface AdInsights {
    impressions?: number;
    reach?: number;
    clicks?: number;
    uniqueClicks?: number;
    ctr?: number;
    uniqueCtr?: number;
    cpc?: number;
    cpm?: number;
    cpp?: number;
    spend?: number;
    frequency?: number;
    resultType?: string;
    results?: number;
    costPerResult?: number;
    linkClicks?: number;
    uniqueLinkClicks?: number;
    landingPageViews?: number;
    outboundClicks?: number;
    costPerLinkClick?: number;
    pageEngagement?: number;
    postEngagement?: number;
    postReactions?: number;
    likes?: number;
    postComments?: number;
    postShares?: number;
    postSaves?: number;
    engagementRate?: number;
    messagesStarted?: number;
    newMessagingContacts?: number;
    messagingReplies?: number;
    messagingConnections?: number;
    messagingPurchases?: number;
    messagingLeads?: number;
    costPerMessage?: number;
    costPerMessageStarted?: number;
    leads?: number;
    purchases?: number;
    addToCart?: number;
    contentViews?: number;
    completeRegistration?: number;
    costPerLead?: number;
    costPerPurchase?: number;
    purchaseRoas?: number | null;
    websitePurchaseRoas?: number | null;
    mobileAppPurchaseRoas?: number | null;
    conversionValue?: number;
    costPerConversion?: number;
    conversionRate?: number;
    appInstalls?: number;
    costPerAppInstall?: number;
    appLaunches?: number;
    appEngagement?: number;
    mobileAppPurchases?: number;
    mobileAppPurchaseValue?: number;
    onFacebookLeads?: number;
    leadFormOpens?: number;
    leadFormSubmissions?: number;
    completionRate?: number;
    instantFormImpressions?: number;
    videoViews?: number;
    videoPlays?: number;
    videoThruPlays?: number;
    video3SecViews?: number;
    video25Watched?: number;
    video50Watched?: number;
    video75Watched?: number;
    video100Watched?: number;
    videoAvgWatchTime?: number;
    videoPlayRate?: number;
    costPerThruPlay?: number;
    costPer3SecView?: number;
    qualityRanking?: string;
    engagementRateRanking?: string;
    conversionRateRanking?: string;
}

interface Ad {
    id: string;
    name?: string;
    facebookAdId?: string;
    extractedContent?: {
        title?: string;
        platform?: string;
        hookType?: string;
    };
    adInsights?: AdInsights;
    hasResults?: boolean;
    successScore?: number;
    status?: string;
    lastSyncedAt?: string;
    importedFromFacebook?: boolean;
    thumbnailUrl?: string;
    campaign?: { id?: string; name?: string };
    adset?: { id?: string; name?: string };
}

interface ExtendedInsights {
    dailyReport?: {
        days: Array<{
            date: string;
            impressions: number;
            reach: number;
            clicks: number;
            spend: number;
            ctr: number;
        }>;
        videoRetention?: {
            totalPlays: number;
            retention: Array<{ point: string; viewers: number; percent: number }>;
            avgWatchTime: number;
            completionRate: number;
        } | null;
        summary: {
            totalDays: number;
            avgDailySpend: number;
            avgDailyClicks: number;
            avgDailyImpressions: number;
        };
    };
    demographics?: {
        age: Record<string, { impressions: number; clicks: number; percent: number }>;
        gender: {
            male: { impressions: number; clicks: number; percent: number };
            female: { impressions: number; clicks: number; percent: number };
            unknown: { impressions: number; clicks: number; percent: number };
        };
    };
    distribution?: {
        platforms: Record<string, number>;
        placements: Record<string, number>;
        devices: Record<string, number>;
    };
    timeAnalysis?: {
        mostActiveHour: number;
        hourlyData: Array<{ hour: number; impressions: number; clicks: number }>;
    };
}

interface AdAnalyticsPanelProps {
    ad: Ad;
    allAds: Ad[];
    onClose: () => void;
}

// Chart colors
const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899', unknown: '#6b7280' };

// Helper functions
function formatNumber(num: number | undefined): string {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString();
}

function formatCurrency(num: number | undefined): string {
    if (num === undefined || num === null) return '₱-';
    return '₱' + num.toFixed(2);
}

function formatPercent(num: number | undefined): string {
    if (num === undefined || num === null) return '-';
    return num.toFixed(2) + '%';
}

function getScoreColor(score: number | undefined): string {
    if (!score) return '#6b7280';
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
}

// Helper to get all ads in the same adset
function getAdsInSameAdset(ads: Ad[], currentAd: Ad): Ad[] {
    const adsetId = currentAd.adset?.id;
    const adsetName = currentAd.adset?.name;
    if (!adsetId && !adsetName) return [currentAd];
    return ads.filter(ad =>
        (adsetId && ad.adset?.id === adsetId) ||
        (adsetName && ad.adset?.name === adsetName)
    );
}

// Metric check helpers
function adsetHasMetric(adsInAdset: Ad[], metricKey: keyof AdInsights): boolean {
    return adsInAdset.some(ad => {
        const value = ad.adInsights?.[metricKey];
        return value !== undefined && value !== null && value !== 0 && value !== '';
    });
}

function adsetHasClicksMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.clicks && i.clicks > 0) || (i?.linkClicks && i.linkClicks > 0) ||
            (i?.ctr && i.ctr > 0) || (i?.cpc && i.cpc > 0);
    });
}

function adsetHasResultsMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.results && i.results > 0) || (i?.leads && i.leads > 0) ||
            (i?.purchases && i.purchases > 0) || (i?.landingPageViews && i.landingPageViews > 0);
    });
}

function adsetHasSocialMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.pageEngagement && i.pageEngagement > 0) || (i?.postReactions && i.postReactions > 0) ||
            (i?.postComments && i.postComments > 0) || (i?.postShares && i.postShares > 0);
    });
}

function adsetHasVideoMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.videoViews && i.videoViews > 0) || (i?.videoPlays && i.videoPlays > 0) ||
            (i?.videoThruPlays && i.videoThruPlays > 0) || (i?.video3SecViews && i.video3SecViews > 0);
    });
}

function adsetHasQualityMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return i?.qualityRanking || i?.engagementRateRanking || i?.conversionRateRanking;
    });
}

function adsetHasMessageMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.messagesStarted && i.messagesStarted > 0) || (i?.messagingReplies && i.messagingReplies > 0);
    });
}

function adsetHasRoasMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.purchaseRoas && i.purchaseRoas > 0) || (i?.conversionValue && i.conversionValue > 0);
    });
}

function adsetHasLeadAdsMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.onFacebookLeads && i.onFacebookLeads > 0) || (i?.leadFormOpens && i.leadFormOpens > 0);
    });
}

function adsetHasAppMetrics(adsInAdset: Ad[]): boolean {
    return adsInAdset.some(ad => {
        const i = ad.adInsights;
        return (i?.appInstalls && i.appInstalls > 0) || (i?.appLaunches && i.appLaunches > 0);
    });
}

// MetricBox component
function MetricBox({ label, value, highlight, isRanking }: { label: string; value: string; highlight?: boolean; isRanking?: boolean }) {
    const getRankingColor = (rank: string): string => {
        if (rank.toLowerCase().includes('above')) return '#22c55e';
        if (rank.toLowerCase().includes('below')) return '#ef4444';
        return '#f59e0b';
    };

    return (
        <div className={`${styles.metricBox} ${highlight ? styles.highlight : ''}`}>
            <div className={styles.metricBoxLabel}>{label}</div>
            <div className={styles.metricBoxValue} style={isRanking ? { color: getRankingColor(value), fontSize: '0.9rem' } : {}}>
                {value}
            </div>
        </div>
    );
}

export default function AdAnalyticsPanel({ ad, allAds, onClose }: AdAnalyticsPanelProps) {
    const [extendedInsights, setExtendedInsights] = useState<ExtendedInsights | null>(null);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [insightsError, setInsightsError] = useState<string | null>(null);
    const [activeChart, setActiveChart] = useState<'performance' | 'audience' | 'distribution'>('performance');

    // Fetch extended insights for the ad
    const fetchExtendedInsights = async () => {
        if (!ad?.facebookAdId) {
            setInsightsError('No Facebook Ad ID available');
            return;
        }

        const accessToken = localStorage.getItem('fb_access_token') || localStorage.getItem('meta_marketing_token');
        if (!accessToken) {
            setInsightsError('Please connect your Facebook account first');
            return;
        }

        setIsLoadingInsights(true);
        setInsightsError(null);

        try {
            const response = await fetch(
                `/api/facebook/insights?adId=${ad.facebookAdId}&accessToken=${accessToken}`
            );
            const data = await response.json();

            if (!data.success) {
                setInsightsError(data.error || 'Failed to fetch insights');
                return;
            }

            setExtendedInsights(data.data);
        } catch (error) {
            console.error('Error fetching extended insights:', error);
            setInsightsError('Failed to fetch insights: ' + String(error));
        } finally {
            setIsLoadingInsights(false);
        }
    };

    // Get ads in the same adset for smart metric visibility
    const adsInAdset = getAdsInSameAdset(allAds, ad);
    const showClicksSection = adsetHasClicksMetrics(adsInAdset);
    const showResultsSection = adsetHasResultsMetrics(adsInAdset);
    const showSocialSection = adsetHasSocialMetrics(adsInAdset);
    const showVideoSection = adsetHasVideoMetrics(adsInAdset);
    const showQualitySection = adsetHasQualityMetrics(adsInAdset);
    const showMessagingSection = adsetHasMessageMetrics(adsInAdset);
    const showRoasSection = adsetHasRoasMetrics(adsInAdset);
    const showLeadFormSection = adsetHasLeadAdsMetrics(adsInAdset);
    const showAppSection = adsetHasAppMetrics(adsInAdset);

    return (
        <>
            {/* Overlay */}
            <div className={styles.panelOverlay} onClick={onClose} />

            {/* Panel */}
            <div className={styles.panel}>
                {/* Header */}
                <div className={styles.panelHeader}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 className={styles.panelTitle}>
                            {ad.name || ad.extractedContent?.title || 'Untitled Ad'}
                        </h2>
                        <div className={styles.panelSubtitle}>
                            {ad.importedFromFacebook && <span className="badge badge-primary">📘 Facebook</span>}
                            <span className="badge">{ad.status || 'UNKNOWN'}</span>
                            {ad.lastSyncedAt && (
                                <span className="badge" style={{ fontSize: '0.7rem' }}>
                                    Synced: {new Date(ad.lastSyncedAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Score */}
                    <div className={styles.scoreBox} style={{ background: `${getScoreColor(ad.successScore)}20` }}>
                        <div className={styles.scoreValue} style={{ color: getScoreColor(ad.successScore) }}>
                            {ad.successScore || '-'}
                        </div>
                        <div className={styles.scoreLabel}>Score</div>
                    </div>

                    {/* Close Button */}
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className={styles.panelContent}>
                    {ad.adInsights ? (
                        <>
                            {/* Core Metrics */}
                            <div className={styles.metricsGrid}>
                                <div className={styles.metricCard} style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                                    <div className={styles.metricLabel}>💰 Spend</div>
                                    <div className={styles.metricValue} style={{ color: '#8b5cf6' }}>
                                        {formatCurrency(ad.adInsights.spend)}
                                    </div>
                                </div>
                                <div className={styles.metricCard} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                                    <div className={styles.metricLabel}>👁️ Impressions</div>
                                    <div className={styles.metricValue} style={{ color: '#3b82f6' }}>
                                        {formatNumber(ad.adInsights.impressions)}
                                    </div>
                                </div>
                                <div className={styles.metricCard} style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                                    <div className={styles.metricLabel}>👥 Reach</div>
                                    <div className={styles.metricValue} style={{ color: '#22c55e' }}>
                                        {formatNumber(ad.adInsights.reach)}
                                    </div>
                                </div>
                            </div>

                            {/* Clicks Section */}
                            {showClicksSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>🔗 Clicks & Engagement</h3>
                                    <div className={styles.metricBoxGrid}>
                                        {adsetHasMetric(adsInAdset, 'clicks') && <MetricBox label="Clicks" value={formatNumber(ad.adInsights.clicks)} />}
                                        {adsetHasMetric(adsInAdset, 'linkClicks') && <MetricBox label="Link Clicks" value={formatNumber(ad.adInsights.linkClicks)} />}
                                        {adsetHasMetric(adsInAdset, 'ctr') && <MetricBox label="CTR" value={formatPercent(ad.adInsights.ctr)} highlight={!!(ad.adInsights.ctr && ad.adInsights.ctr > 2)} />}
                                        {adsetHasMetric(adsInAdset, 'cpc') && <MetricBox label="CPC" value={formatCurrency(ad.adInsights.cpc)} />}
                                        {adsetHasMetric(adsInAdset, 'cpm') && <MetricBox label="CPM" value={formatCurrency(ad.adInsights.cpm)} />}
                                        {adsetHasMetric(adsInAdset, 'frequency') && <MetricBox label="Frequency" value={ad.adInsights.frequency?.toFixed(2) || '-'} />}
                                    </div>
                                </>
                            )}

                            {/* Results Section */}
                            {showResultsSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>🎯 Results & Conversions</h3>
                                    <div className={styles.metricBoxGrid}>
                                        {adsetHasMetric(adsInAdset, 'results') && <MetricBox label={ad.adInsights.resultType || 'Results'} value={formatNumber(ad.adInsights.results)} highlight />}
                                        {adsetHasMetric(adsInAdset, 'costPerResult') && <MetricBox label="Cost/Result" value={formatCurrency(ad.adInsights.costPerResult)} />}
                                        {adsetHasMetric(adsInAdset, 'landingPageViews') && <MetricBox label="Landing Views" value={formatNumber(ad.adInsights.landingPageViews)} />}
                                        {adsetHasMetric(adsInAdset, 'leads') && <MetricBox label="Leads" value={formatNumber(ad.adInsights.leads)} />}
                                        {adsetHasMetric(adsInAdset, 'purchases') && <MetricBox label="Purchases" value={formatNumber(ad.adInsights.purchases)} />}
                                    </div>
                                </>
                            )}

                            {/* Social Section */}
                            {showSocialSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>🔥 Social Engagement</h3>
                                    <div className={styles.metricBoxGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                        {adsetHasMetric(adsInAdset, 'pageEngagement') && <MetricBox label="Engagement" value={formatNumber(ad.adInsights.pageEngagement)} />}
                                        {adsetHasMetric(adsInAdset, 'postReactions') && <MetricBox label="Reactions" value={formatNumber(ad.adInsights.postReactions)} />}
                                        {adsetHasMetric(adsInAdset, 'postComments') && <MetricBox label="Comments" value={formatNumber(ad.adInsights.postComments)} />}
                                        {adsetHasMetric(adsInAdset, 'postShares') && <MetricBox label="Shares" value={formatNumber(ad.adInsights.postShares)} />}
                                    </div>
                                </>
                            )}

                            {/* Video Section */}
                            {showVideoSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>🎬 Video Performance</h3>
                                    <div className={styles.metricBoxGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                        {adsetHasMetric(adsInAdset, 'videoViews') && <MetricBox label="Views" value={formatNumber(ad.adInsights.videoViews)} />}
                                        {adsetHasMetric(adsInAdset, 'videoThruPlays') && <MetricBox label="ThruPlays" value={formatNumber(ad.adInsights.videoThruPlays)} highlight />}
                                        {adsetHasMetric(adsInAdset, 'video3SecViews') && <MetricBox label="3-Sec Views" value={formatNumber(ad.adInsights.video3SecViews)} />}
                                        {adsetHasMetric(adsInAdset, 'video25Watched') && <MetricBox label="25%" value={formatNumber(ad.adInsights.video25Watched)} />}
                                        {adsetHasMetric(adsInAdset, 'video50Watched') && <MetricBox label="50%" value={formatNumber(ad.adInsights.video50Watched)} />}
                                        {adsetHasMetric(adsInAdset, 'video75Watched') && <MetricBox label="75%" value={formatNumber(ad.adInsights.video75Watched)} />}
                                        {adsetHasMetric(adsInAdset, 'video100Watched') && <MetricBox label="100%" value={formatNumber(ad.adInsights.video100Watched)} highlight />}
                                        {adsetHasMetric(adsInAdset, 'videoAvgWatchTime') && <MetricBox label="Avg Time" value={(ad.adInsights.videoAvgWatchTime?.toFixed(1) || '-') + 's'} />}
                                    </div>
                                </>
                            )}

                            {/* Quality Section */}
                            {showQualitySection && (
                                <>
                                    <h3 className={styles.sectionTitle}>⭐ Quality Rankings</h3>
                                    <div className={styles.metricBoxGrid}>
                                        <MetricBox label="Quality" value={ad.adInsights.qualityRanking || '-'} isRanking />
                                        <MetricBox label="Engagement" value={ad.adInsights.engagementRateRanking || '-'} isRanking />
                                        <MetricBox label="Conversion" value={ad.adInsights.conversionRateRanking || '-'} isRanking />
                                    </div>
                                </>
                            )}

                            {/* Messaging Section */}
                            {showMessagingSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>💬 Messaging</h3>
                                    <div className={styles.metricBoxGrid}>
                                        {adsetHasMetric(adsInAdset, 'messagesStarted') && <MetricBox label="Started" value={formatNumber(ad.adInsights.messagesStarted)} />}
                                        {adsetHasMetric(adsInAdset, 'messagingReplies') && <MetricBox label="Replies" value={formatNumber(ad.adInsights.messagingReplies)} />}
                                        {adsetHasMetric(adsInAdset, 'costPerMessageStarted') && <MetricBox label="Cost/Msg" value={formatCurrency(ad.adInsights.costPerMessageStarted)} />}
                                    </div>
                                </>
                            )}

                            {/* ROAS Section */}
                            {showRoasSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>💰 ROAS & Revenue</h3>
                                    <div className={styles.metricBoxGrid}>
                                        {adsetHasMetric(adsInAdset, 'purchaseRoas') && <MetricBox label="Purchase ROAS" value={(ad.adInsights.purchaseRoas?.toFixed(2) || '-') + 'x'} highlight={!!(ad.adInsights.purchaseRoas && ad.adInsights.purchaseRoas > 2)} />}
                                        {adsetHasMetric(adsInAdset, 'conversionValue') && <MetricBox label="Conv. Value" value={formatCurrency(ad.adInsights.conversionValue)} highlight />}
                                        {adsetHasMetric(adsInAdset, 'conversionRate') && <MetricBox label="Conv. Rate" value={formatPercent(ad.adInsights.conversionRate)} />}
                                    </div>
                                </>
                            )}

                            {/* Lead Form Section */}
                            {showLeadFormSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>📋 Lead Forms</h3>
                                    <div className={styles.metricBoxGrid}>
                                        {adsetHasMetric(adsInAdset, 'onFacebookLeads') && <MetricBox label="FB Leads" value={formatNumber(ad.adInsights.onFacebookLeads)} highlight />}
                                        {adsetHasMetric(adsInAdset, 'leadFormOpens') && <MetricBox label="Form Opens" value={formatNumber(ad.adInsights.leadFormOpens)} />}
                                        {adsetHasMetric(adsInAdset, 'leadFormSubmissions') && <MetricBox label="Submissions" value={formatNumber(ad.adInsights.leadFormSubmissions)} />}
                                    </div>
                                </>
                            )}

                            {/* App Section */}
                            {showAppSection && (
                                <>
                                    <h3 className={styles.sectionTitle}>📱 App Performance</h3>
                                    <div className={styles.metricBoxGrid}>
                                        {adsetHasMetric(adsInAdset, 'appInstalls') && <MetricBox label="Installs" value={formatNumber(ad.adInsights.appInstalls)} highlight />}
                                        {adsetHasMetric(adsInAdset, 'costPerAppInstall') && <MetricBox label="Cost/Install" value={formatCurrency(ad.adInsights.costPerAppInstall)} />}
                                        {adsetHasMetric(adsInAdset, 'appLaunches') && <MetricBox label="Launches" value={formatNumber(ad.adInsights.appLaunches)} />}
                                    </div>
                                </>
                            )}

                            {/* Extended Insights & Charts */}
                            <div className={styles.chartsSection}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                    <h3 style={{ margin: 0 }}>📊 Advanced Analytics</h3>
                                    {!extendedInsights && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={fetchExtendedInsights}
                                            disabled={isLoadingInsights || !ad?.facebookAdId}
                                            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                                        >
                                            {isLoadingInsights ? '🔄 Loading...' : '📈 Load Graphs'}
                                        </button>
                                    )}
                                </div>

                                {insightsError && (
                                    <div className={styles.errorState}>⚠️ {insightsError}</div>
                                )}

                                {isLoadingInsights && (
                                    <div className={styles.loadingState}>
                                        <div className={styles.loadingIcon}>📊</div>
                                        <p>Loading extended insights...</p>
                                    </div>
                                )}

                                {extendedInsights && (
                                    <>
                                        {/* Chart Tabs */}
                                        <div className={styles.chartTabs}>
                                            <button
                                                className={`${styles.chartTab} ${activeChart === 'performance' ? styles.active : ''}`}
                                                onClick={() => setActiveChart('performance')}
                                            >
                                                📈 Performance
                                            </button>
                                            <button
                                                className={`${styles.chartTab} ${activeChart === 'audience' ? styles.active : ''}`}
                                                onClick={() => setActiveChart('audience')}
                                            >
                                                👥 Audience
                                            </button>
                                            <button
                                                className={`${styles.chartTab} ${activeChart === 'distribution' ? styles.active : ''}`}
                                                onClick={() => setActiveChart('distribution')}
                                            >
                                                🌍 Distribution
                                            </button>
                                        </div>

                                        {/* Performance Charts */}
                                        {activeChart === 'performance' && extendedInsights.dailyReport?.days?.length ? (
                                            <div>
                                                {/* Summary */}
                                                <div className={styles.summaryGrid}>
                                                    <div className={styles.summaryCard}>
                                                        <div className={styles.summaryLabel}>Total Days</div>
                                                        <div className={styles.summaryValue} style={{ color: '#8b5cf6' }}>
                                                            {extendedInsights.dailyReport.summary.totalDays}
                                                        </div>
                                                    </div>
                                                    <div className={styles.summaryCard}>
                                                        <div className={styles.summaryLabel}>Avg Spend/Day</div>
                                                        <div className={styles.summaryValue} style={{ color: '#3b82f6' }}>
                                                            {formatCurrency(extendedInsights.dailyReport.summary.avgDailySpend)}
                                                        </div>
                                                    </div>
                                                    <div className={styles.summaryCard}>
                                                        <div className={styles.summaryLabel}>Avg Clicks/Day</div>
                                                        <div className={styles.summaryValue} style={{ color: '#22c55e' }}>
                                                            {extendedInsights.dailyReport.summary.avgDailyClicks}
                                                        </div>
                                                    </div>
                                                    <div className={styles.summaryCard}>
                                                        <div className={styles.summaryLabel}>Avg Impr/Day</div>
                                                        <div className={styles.summaryValue} style={{ color: '#f59e0b' }}>
                                                            {formatNumber(extendedInsights.dailyReport.summary.avgDailyImpressions)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Line Chart */}
                                                <h4 className={styles.chartTitle}>📅 Daily Performance</h4>
                                                <div className={styles.chartContainer}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={extendedInsights.dailyReport.days.map(d => ({
                                                            ...d,
                                                            date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        }))}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                                                            <YAxis yAxisId="left" stroke="#8b5cf6" fontSize={11} />
                                                            <YAxis yAxisId="right" orientation="right" stroke="#22c55e" fontSize={11} />
                                                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                                            <Legend />
                                                            <Line yAxisId="left" type="monotone" dataKey="impressions" name="Impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                                            <Line yAxisId="right" type="monotone" dataKey="clicks" name="Clicks" stroke="#22c55e" strokeWidth={2} dot={false} />
                                                            <Line yAxisId="right" type="monotone" dataKey="spend" name="Spend (₱)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                {/* CTR Chart */}
                                                <h4 className={styles.chartTitle}>📊 CTR Trend</h4>
                                                <div style={{ height: '200px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={extendedInsights.dailyReport.days.map(d => ({
                                                            ...d,
                                                            date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        }))}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                                                            <YAxis stroke="var(--text-muted)" fontSize={11} />
                                                            <Tooltip
                                                                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                                                formatter={(value) => [Number(value ?? 0).toFixed(2) + '%', 'CTR']}
                                                            />
                                                            <Area type="monotone" dataKey="ctr" name="CTR %" stroke="#22c55e" fill="rgba(34, 197, 94, 0.2)" strokeWidth={2} />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                {/* Video Retention */}
                                                {extendedInsights.dailyReport.videoRetention && (
                                                    <>
                                                        <h4 className={styles.chartTitle} style={{ marginTop: '24px' }}>🎬 Video Retention</h4>
                                                        <div className={styles.retentionGrid}>
                                                            <div style={{ height: '200px' }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={extendedInsights.dailyReport.videoRetention.retention}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                                        <XAxis dataKey="point" stroke="var(--text-muted)" fontSize={11} />
                                                                        <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
                                                                        <Tooltip
                                                                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                                                            formatter={(value) => [(value ?? 0) + '%', 'Retention']}
                                                                        />
                                                                        <Area type="monotone" dataKey="percent" stroke="#ec4899" fill="rgba(236, 72, 153, 0.3)" strokeWidth={2} />
                                                                    </AreaChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                            <div className={styles.retentionStats}>
                                                                <div className={styles.retentionStatCard}>
                                                                    <div className={styles.retentionStatLabel}>Total Plays</div>
                                                                    <div className={styles.retentionStatValue}>{formatNumber(extendedInsights.dailyReport.videoRetention.totalPlays)}</div>
                                                                </div>
                                                                <div className={styles.retentionStatCard}>
                                                                    <div className={styles.retentionStatLabel}>Completion Rate</div>
                                                                    <div className={styles.retentionStatValue} style={{ color: extendedInsights.dailyReport.videoRetention.completionRate > 20 ? '#22c55e' : '#f59e0b' }}>
                                                                        {extendedInsights.dailyReport.videoRetention.completionRate}%
                                                                    </div>
                                                                </div>
                                                                <div className={styles.retentionStatCard}>
                                                                    <div className={styles.retentionStatLabel}>Avg Watch Time</div>
                                                                    <div className={styles.retentionStatValue}>{extendedInsights.dailyReport.videoRetention.avgWatchTime.toFixed(1)}s</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : activeChart === 'performance' && (
                                            <div className={styles.noDataState}>
                                                <p>No daily performance data available.</p>
                                            </div>
                                        )}

                                        {/* Audience Charts */}
                                        {activeChart === 'audience' && (
                                            <div className={styles.twoColumnGrid}>
                                                {/* Age */}
                                                <div>
                                                    <h4 className={styles.chartTitle}>👤 Age Breakdown</h4>
                                                    <div style={{ height: '250px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={Object.entries(extendedInsights.demographics?.age || {}).map(([age, data]) => ({
                                                                age, percent: data.percent
                                                            }))}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                                <XAxis dataKey="age" stroke="var(--text-muted)" fontSize={10} />
                                                                <YAxis stroke="var(--text-muted)" fontSize={11} />
                                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                                                <Bar dataKey="percent" name="Share %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Gender */}
                                                <div>
                                                    <h4 className={styles.chartTitle}>🚻 Gender</h4>
                                                    <div style={{ height: '250px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={Object.entries(extendedInsights.demographics?.gender || {})
                                                                        .filter(([, data]) => data.percent > 0)
                                                                        .map(([gender, data]) => ({
                                                                            name: gender.charAt(0).toUpperCase() + gender.slice(1),
                                                                            value: data.percent
                                                                        }))}
                                                                    cx="50%" cy="50%" outerRadius={80} dataKey="value"
                                                                    label={({ name, value }) => `${name}: ${value}%`} labelLine={false}
                                                                >
                                                                    {Object.keys(extendedInsights.demographics?.gender || {}).map((gender, index) => (
                                                                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[gender as keyof typeof GENDER_COLORS] || CHART_COLORS[index]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Distribution Charts */}
                                        {activeChart === 'distribution' && (
                                            <div className={styles.twoColumnGrid}>
                                                {/* Platform */}
                                                <div>
                                                    <h4 className={styles.chartTitle}>📱 Platform</h4>
                                                    <div style={{ height: '220px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={Object.entries(extendedInsights.distribution?.platforms || {}).map(([name, value]) => ({
                                                                        name: name.charAt(0).toUpperCase() + name.slice(1), value
                                                                    }))}
                                                                    cx="50%" cy="50%" outerRadius={70} dataKey="value"
                                                                    label={({ name, value }) => `${name}: ${value}%`} labelLine={false}
                                                                >
                                                                    {Object.keys(extendedInsights.distribution?.platforms || {}).map((_, index) => (
                                                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* Device */}
                                                <div>
                                                    <h4 className={styles.chartTitle}>💻 Device</h4>
                                                    <div style={{ height: '220px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie
                                                                    data={Object.entries(extendedInsights.distribution?.devices || {}).map(([name, value]) => ({
                                                                        name: name.charAt(0).toUpperCase() + name.slice(1), value
                                                                    }))}
                                                                    cx="50%" cy="50%" outerRadius={70} dataKey="value"
                                                                    label={({ name, value }) => `${name}: ${value}%`} labelLine={false}
                                                                >
                                                                    {Object.keys(extendedInsights.distribution?.devices || {}).map((_, index) => (
                                                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className={styles.noDataState}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
                            <h3>No Analytics Data</h3>
                            <p>This ad doesn&apos;t have any performance data yet. Import from Facebook or wait for results to populate.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
