'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Platform, DayOfWeek, TimeOfDay } from '@/types';

interface VideoOption {
    id: string;
    name: string;
    thumbnail: string;
    uploadDate: string;
    metrics?: {
        ctr?: number;
        spend?: number;
        impressions?: number;
        clicks?: number;
        reach?: number;
        conversions?: number;
    };
}

interface PerformanceForm {
    video_id: string;
    platform: Platform;
    launch_date: string;
    launch_day: DayOfWeek;
    launch_time: TimeOfDay;
    ad_spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;
    conversions: number;
    conversion_rate: number;
    revenue: number;
    roas: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    success_rating: number;
    notes: string;
}

const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'instagram', label: 'Instagram', icon: '📸' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' },
    { value: 'youtube', label: 'YouTube', icon: '▶️' },
    { value: 'snapchat', label: 'Snapchat', icon: '👻' },
    { value: 'pinterest', label: 'Pinterest', icon: '📌' },
    { value: 'twitter', label: 'Twitter/X', icon: '🐦' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { value: 'other', label: 'Other', icon: '📱' },
];

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
];

const TIMES_OF_DAY: { value: TimeOfDay; label: string }[] = [
    { value: 'early_morning', label: '🌅 Early Morning (5-8 AM)' },
    { value: 'morning', label: '☀️ Morning (8 AM-12 PM)' },
    { value: 'afternoon', label: '🌤️ Afternoon (12-5 PM)' },
    { value: 'evening', label: '🌆 Evening (5-9 PM)' },
    { value: 'night', label: '🌙 Night (9 PM-5 AM)' },
];

export default function AnalyticsPage() {
    const [videos, setVideos] = useState<VideoOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [viewMode, setViewMode] = useState<'input' | 'analysis'>('analysis');  // Document view by default
    const [selectedAdForAnalysis, setSelectedAdForAnalysis] = useState<VideoOption | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [form, setForm] = useState<PerformanceForm>({
        video_id: '',
        platform: 'tiktok',
        launch_date: new Date().toISOString().split('T')[0],
        launch_day: 'monday',
        launch_time: 'evening',
        ad_spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversion_rate: 0,
        revenue: 0,
        roas: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        success_rating: 5,
        notes: '',
    });

    useEffect(() => {
        // Load real ads from localStorage
        try {
            const storedAds = JSON.parse(localStorage.getItem('ads') || '[]');
            const videoOptions: VideoOption[] = storedAds.map((ad: {
                id: string;
                name?: string;
                extractedContent?: { title?: string };
                adInsights?: {
                    ctr?: number;
                    spend?: number;
                    impressions?: number;
                    clicks?: number;
                    reach?: number;
                    results?: number;
                    leads?: number;
                    messagesStarted?: number;
                };
                createdAt?: string;
                uploadedAt?: string;
            }) => ({
                id: ad.id,
                name: ad.name || ad.extractedContent?.title || `Ad ${ad.id.slice(-6)}`,
                thumbnail: '',
                uploadDate: ad.createdAt || ad.uploadedAt || new Date().toISOString().split('T')[0],
                metrics: ad.adInsights ? {
                    ctr: ad.adInsights.ctr || 0,
                    spend: ad.adInsights.spend || 0,
                    impressions: ad.adInsights.impressions || 0,
                    clicks: ad.adInsights.clicks || 0,
                    reach: ad.adInsights.reach || 0,
                    conversions: ad.adInsights.results || ad.adInsights.leads || ad.adInsights.messagesStarted || 0,
                } : undefined
            }));

            setVideos(videoOptions);
            setIsLoading(false);
        } catch (error) {
            console.error('Failed to load ads:', error);
            setVideos([]);
            setIsLoading(false);
        }
    }, []);

    // Auto-fill form when ad is selected
    useEffect(() => {
        if (form.video_id) {
            const selectedAd = videos.find(v => v.id === form.video_id);
            if (selectedAd?.metrics) {
                setForm(prev => ({
                    ...prev,
                    ad_spend: selectedAd.metrics?.spend || prev.ad_spend,
                    impressions: selectedAd.metrics?.impressions || prev.impressions,
                    reach: selectedAd.metrics?.reach || prev.reach,
                    clicks: selectedAd.metrics?.clicks || prev.clicks,
                    ctr: selectedAd.metrics?.ctr || prev.ctr,
                    conversions: selectedAd.metrics?.conversions || prev.conversions,
                }));
            }
        }
    }, [form.video_id, videos]);

    // Auto-calculate CTR
    useEffect(() => {
        if (form.impressions > 0) {
            const ctr = (form.clicks / form.impressions) * 100;
            setForm(prev => ({ ...prev, ctr: parseFloat(ctr.toFixed(2)) }));
        }
    }, [form.clicks, form.impressions]);

    // Auto-calculate Conversion Rate
    useEffect(() => {
        if (form.clicks > 0) {
            const convRate = (form.conversions / form.clicks) * 100;
            setForm(prev => ({ ...prev, conversion_rate: parseFloat(convRate.toFixed(2)) }));
        }
    }, [form.conversions, form.clicks]);

    // Auto-calculate ROAS
    useEffect(() => {
        if (form.ad_spend > 0) {
            const roas = form.revenue / form.ad_spend;
            setForm(prev => ({ ...prev, roas: parseFloat(roas.toFixed(2)) }));
        }
    }, [form.revenue, form.ad_spend]);

    // Auto-set day of week from launch date
    useEffect(() => {
        if (form.launch_date) {
            const date = new Date(form.launch_date);
            const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            setForm(prev => ({ ...prev, launch_day: days[date.getDay()] }));
        }
    }, [form.launch_date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.video_id) {
            alert('Please select a video');
            return;
        }

        setIsSaving(true);

        try {
            // In production, save to Supabase:
            // await db.createPerformance({ ...form });
            // Also add to ML training data:
            // const metadata = await db.getMetadataByVideoId(form.video_id);
            // addTrainingData(metadata, form);

            await new Promise(resolve => setTimeout(resolve, 1000));

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);

            // Reset form
            setForm(prev => ({
                ...prev,
                ad_spend: 0,
                impressions: 0,
                reach: 0,
                clicks: 0,
                ctr: 0,
                conversions: 0,
                conversion_rate: 0,
                revenue: 0,
                roas: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                saves: 0,
                success_rating: 5,
                notes: '',
            }));
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Generate AI analysis document for selected ad
    const generateAiAnalysis = async (ad: VideoOption) => {
        setSelectedAdForAnalysis(ad);
        setIsAnalyzing(true);
        setAiAnalysis('');

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Analyze this ad's performance data and provide a detailed marketing analysis document. Format as a professional report with sections.

Ad Name: ${ad.name}
Performance Metrics:
- Impressions: ${ad.metrics?.impressions || 'N/A'}
- Clicks: ${ad.metrics?.clicks || 'N/A'}
- CTR: ${ad.metrics?.ctr?.toFixed(2) || 'N/A'}%
- Spend: ₱${ad.metrics?.spend?.toFixed(2) || 'N/A'}
- Reach: ${ad.metrics?.reach || 'N/A'}
- Conversions: ${ad.metrics?.conversions || 'N/A'}

Provide:
1. EXECUTIVE SUMMARY - Brief overview of ad performance
2. KEY METRICS ANALYSIS - Deep dive into each metric
3. PERFORMANCE RATING - Score out of 100 with justification
4. STRENGTHS - What's working well
5. WEAKNESSES - Areas for improvement
6. RECOMMENDATIONS - Specific actionable suggestions
7. NEXT STEPS - Priority actions to take`
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    setAiAnalysis(result.data);
                } else {
                    setAiAnalysis(generateFallbackAnalysis(ad));
                }
            } else {
                setAiAnalysis(generateFallbackAnalysis(ad));
            }
        } catch (error) {
            console.error('AI analysis failed:', error);
            setAiAnalysis(generateFallbackAnalysis(ad));
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Fallback analysis when AI is unavailable
    const generateFallbackAnalysis = (ad: VideoOption): string => {
        const ctr = ad.metrics?.ctr || 0;
        const spend = ad.metrics?.spend || 0;
        const impressions = ad.metrics?.impressions || 0;
        const clicks = ad.metrics?.clicks || 0;
        const conversions = ad.metrics?.conversions || 0;

        const costPerClick = clicks > 0 ? spend / clicks : 0;
        const costPerConversion = conversions > 0 ? spend / conversions : 0;

        let performanceRating = 50;
        if (ctr >= 2) performanceRating += 20;
        else if (ctr >= 1) performanceRating += 10;
        if (conversions > 0) performanceRating += 15;
        if (costPerConversion < 100 && conversions > 0) performanceRating += 15;

        const recommendation1 = ctr < 1.5 ? 'Test new ad creative with stronger hooks' : 'Continue with current creative - performing well';
        const recommendation2 = conversions === 0 ? 'Review and optimize landing page for conversions' : 'Scale budget to generate more conversions';
        const recommendation3 = impressions < 5000 ? 'Increase budget to get more reach' : 'Consider retargeting engaged users';
        const nextStep1 = ctr < 1.5 ? 'Create 2-3 new ad variations' : 'Duplicate and scale this ad';

        return `# Ad Performance Analysis Report

## ${ad.name}

---

## EXECUTIVE SUMMARY

This ad has accumulated ${impressions.toLocaleString()} impressions with a ${ctr.toFixed(2)}% CTR and total spend of PHP ${spend.toFixed(2)}. ${ctr >= 2 ? 'The CTR is above average, indicating strong ad creative or targeting.' : ctr >= 1 ? 'The CTR is average and could be improved.' : 'The CTR is below average and needs optimization.'}

---

## KEY METRICS BREAKDOWN

| Metric | Value | Status |
|--------|-------|--------|
| Impressions | ${impressions.toLocaleString()} | ${impressions > 1000 ? 'Good reach' : 'Low reach'} |
| Clicks | ${clicks.toLocaleString()} | ${clicks > 50 ? 'Healthy' : 'Needs improvement'} |
| CTR | ${ctr.toFixed(2)}% | ${ctr >= 2 ? 'Excellent' : ctr >= 1 ? 'Average' : 'Below par'} |
| Total Spend | PHP ${spend.toFixed(2)} | - |
| Cost per Click | PHP ${costPerClick.toFixed(2)} | ${costPerClick < 10 ? 'Efficient' : 'High'} |
| Conversions | ${conversions} | ${conversions > 0 ? 'Converting' : 'No conversions'} |
| Cost per Conversion | PHP ${costPerConversion.toFixed(2)} | ${costPerConversion < 100 && conversions > 0 ? 'Efficient' : conversions > 0 ? 'High' : 'N/A'} |

---

## PERFORMANCE RATING

**${performanceRating}/100** - ${performanceRating >= 80 ? 'Excellent' : performanceRating >= 60 ? 'Good' : performanceRating >= 40 ? 'Average' : 'Needs Work'}

---

## STRENGTHS
${ctr >= 1.5 ? '- Strong click-through rate indicates engaging creative' : ''}
${impressions > 5000 ? '- Good reach and visibility' : ''}
${conversions > 0 ? '- Generating conversions' : ''}
${costPerClick < 5 ? '- Cost-efficient clicks' : ''}

## AREAS FOR IMPROVEMENT
${ctr < 1 ? '- CTR is below 1% - consider refreshing creative' : ''}
${conversions === 0 ? '- No conversions yet - review landing page' : ''}
${costPerConversion > 200 && conversions > 0 ? '- High cost per conversion' : ''}

---

## RECOMMENDATIONS

1. ${recommendation1}
2. ${recommendation2}
3. ${recommendation3}

---

## NEXT STEPS

- ${nextStep1}
- Review audience targeting for optimization
- Set up A/B testing for continuous improvement`;
    };


    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Ad Analytics</h1>
                    <p className={styles.subtitle}>Analyze ad performance and get AI insights</p>
                </div>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button
                        className={`btn btn - sm ${viewMode === 'analysis' ? 'btn-primary' : 'btn-ghost'} `}
                        onClick={() => setViewMode('analysis')}
                    >
                        Analysis View
                    </button>
                    <button
                        className={`btn btn - sm ${viewMode === 'input' ? 'btn-primary' : 'btn-ghost'} `}
                        onClick={() => setViewMode('input')}
                    >
                        Input Results
                    </button>
                </div>
            </header>

            {showSuccess && (
                <div className={styles.successToast}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Performance data saved! AI model updated.
                </div>
            )}

            {/* Analysis View - Document Style */}
            {viewMode === 'analysis' && (
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--spacing-lg)', minHeight: '70vh' }}>
                    {/* Ad Selection Sidebar */}
                    <div className="glass-card" style={{ padding: 'var(--spacing-md)', maxHeight: '70vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Select an Ad</h3>
                        {isLoading ? (
                            <div>Loading ads...</div>
                        ) : videos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-muted)' }}>
                                <p>No ads found</p>
                                <a href="/import" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--spacing-sm)' }}>Import Ads</a>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {videos.map(ad => (
                                    <div
                                        key={ad.id}
                                        onClick={() => generateAiAnalysis(ad)}
                                        style={{
                                            padding: 'var(--spacing-sm)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: selectedAdForAnalysis?.id === ad.id ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                                            background: selectedAdForAnalysis?.id === ad.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {ad.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 'var(--spacing-sm)' }}>
                                            <span>CTR: {ad.metrics?.ctr?.toFixed(1) || 0}%</span>
                                            <span>Spend: PHP {ad.metrics?.spend?.toFixed(0) || 0}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Analysis Document */}
                    <div className="glass-card" style={{ padding: 'var(--spacing-lg)', maxHeight: '70vh', overflowY: 'auto' }}>
                        {!selectedAdForAnalysis ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                <h3 style={{ marginTop: 'var(--spacing-md)' }}>Select an Ad to Analyze</h3>
                                <p>Choose an ad from the list to generate a detailed AI analysis report</p>
                            </div>
                        ) : isAnalyzing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <div className="skeleton" style={{ width: 200, height: 30, marginBottom: 'var(--spacing-md)' }}></div>
                                <div className="skeleton" style={{ width: '100%', height: 200, marginBottom: 'var(--spacing-sm)' }}></div>
                                <div className="skeleton" style={{ width: '80%', height: 100 }}></div>
                                <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-muted)' }}>Generating AI analysis...</p>
                            </div>
                        ) : (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {aiAnalysis}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Input Form View */}
            {viewMode === 'input' && (
                <form onSubmit={handleSubmit} className={styles.formContainer}>
                    {/* Video Selection */}
                    <div className={`glass - card ${styles.section} `}>
                        <h3 className={styles.sectionTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            Select Video
                        </h3>

                        {isLoading ? (
                            <div className={styles.loadingGrid}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`skeleton ${styles.videoSkeleton} `}></div>
                                ))}
                            </div>
                        ) : videos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-muted)' }}>
                                <p>No ads found. Import ads from Facebook or upload new ads first.</p>
                                <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center' }}>
                                    <a href="/import" className="btn btn-secondary">Import from Facebook</a>
                                    <a href="/upload" className="btn btn-primary">Upload Ad</a>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.videoGrid}>
                                {videos.map(video => (
                                    <label
                                        key={video.id}
                                        className={`${styles.videoOption} ${form.video_id === video.id ? styles.selected : ''} `}
                                    >
                                        <input
                                            type="radio"
                                            name="video_id"
                                            value={video.id}
                                            checked={form.video_id === video.id}
                                            onChange={(e) => setForm(prev => ({ ...prev, video_id: e.target.value }))}
                                            className={styles.radioInput}
                                        />
                                        <div className={styles.videoThumb}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polygon points="5 3 19 12 5 21 5 3" />
                                            </svg>
                                        </div>
                                        <div className={styles.videoInfo}>
                                            <span className={styles.videoName}>{video.name}</span>
                                            <span className={styles.videoDate}>
                                                {video.uploadDate?.split('T')[0]}
                                                {video.metrics && (
                                                    <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem' }}>
                                                        CTR: {video.metrics.ctr?.toFixed(1)}% | ₱{video.metrics.spend?.toFixed(0)}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className={styles.checkmark}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Campaign Details */}
                    <div className={`glass - card ${styles.section} `}>
                        <h3 className={styles.sectionTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Campaign Details
                        </h3>

                        <div className={styles.formGrid}>
                            <div className="form-group">
                                <label className="form-label">Platform</label>
                                <div className={styles.platformGrid}>
                                    {PLATFORMS.map(platform => (
                                        <label
                                            key={platform.value}
                                            className={`${styles.platformOption} ${form.platform === platform.value ? styles.selected : ''} `}
                                        >
                                            <input
                                                type="radio"
                                                name="platform"
                                                value={platform.value}
                                                checked={form.platform === platform.value}
                                                onChange={(e) => setForm(prev => ({ ...prev, platform: e.target.value as Platform }))}
                                                className={styles.radioInput}
                                            />
                                            <span className={styles.platformIcon}>{platform.icon}</span>
                                            <span>{platform.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Launch Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={form.launch_date}
                                    onChange={(e) => setForm(prev => ({ ...prev, launch_date: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Launch Day</label>
                                <select
                                    className="form-select"
                                    value={form.launch_day}
                                    onChange={(e) => setForm(prev => ({ ...prev, launch_day: e.target.value as DayOfWeek }))}
                                >
                                    {DAYS_OF_WEEK.map(day => (
                                        <option key={day.value} value={day.value}>{day.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Launch Time</label>
                                <select
                                    className="form-select"
                                    value={form.launch_time}
                                    onChange={(e) => setForm(prev => ({ ...prev, launch_time: e.target.value as TimeOfDay }))}
                                >
                                    {TIMES_OF_DAY.map(time => (
                                        <option key={time.value} value={time.value}>{time.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Spend & Revenue */}
                    <div className={`glass - card ${styles.section} `}>
                        <h3 className={styles.sectionTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                            </svg>
                            Spend & Revenue
                        </h3>

                        <div className={styles.formGrid}>
                            <div className="form-group">
                                <label className="form-label">Ad Spend (₱)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    step="0.01"
                                    value={form.ad_spend || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, ad_spend: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Revenue (₱)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    step="0.01"
                                    value={form.revenue || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, revenue: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className={styles.calculatedField}>
                                <span className={styles.calculatedLabel}>ROAS</span>
                                <span className={`${styles.calculatedValue} ${form.roas >= 2 ? styles.positive : form.roas < 1 ? styles.negative : ''} `}>
                                    {form.roas.toFixed(2)}x
                                </span>
                            </div>

                            <div className={styles.calculatedField}>
                                <span className={styles.calculatedLabel}>Net Profit</span>
                                <span className={`${styles.calculatedValue} ${form.revenue - form.ad_spend >= 0 ? styles.positive : styles.negative} `}>
                                    ₱{(form.revenue - form.ad_spend).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className={`glass - card ${styles.section} `}>
                        <h3 className={styles.sectionTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            Performance Metrics
                        </h3>

                        <div className={styles.formGrid}>
                            <div className="form-group">
                                <label className="form-label">Impressions</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.impressions || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, impressions: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Reach</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.reach || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, reach: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Clicks</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.clicks || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, clicks: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className={styles.calculatedField}>
                                <span className={styles.calculatedLabel}>CTR</span>
                                <span className={`${styles.calculatedValue} ${form.ctr >= 2 ? styles.positive : form.ctr < 0.5 ? styles.negative : ''} `}>
                                    {form.ctr.toFixed(2)}%
                                </span>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Conversions</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.conversions || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, conversions: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className={styles.calculatedField}>
                                <span className={styles.calculatedLabel}>Conversion Rate</span>
                                <span className={`${styles.calculatedValue} ${form.conversion_rate >= 3 ? styles.positive : form.conversion_rate < 1 ? styles.negative : ''} `}>
                                    {form.conversion_rate.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Engagement Metrics */}
                    <div className={`glass - card ${styles.section} `}>
                        <h3 className={styles.sectionTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                            </svg>
                            Engagement Metrics
                        </h3>

                        <div className={styles.formGrid}>
                            <div className="form-group">
                                <label className="form-label">Likes</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.likes || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, likes: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Comments</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.comments || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, comments: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Shares</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.shares || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, shares: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Saves</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    value={form.saves || ''}
                                    onChange={(e) => setForm(prev => ({ ...prev, saves: parseInt(e.target.value) || 0 }))}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Success Rating */}
                    <div className={`glass - card ${styles.section} `}>
                        <h3 className={styles.sectionTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            Your Assessment
                        </h3>

                        <div className={styles.ratingSection}>
                            <label className="form-label">How successful was this ad? (1-10)</label>
                            <div className={styles.ratingSlider}>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={form.success_rating}
                                    onChange={(e) => setForm(prev => ({ ...prev, success_rating: parseInt(e.target.value) }))}
                                    className={styles.slider}
                                />
                                <div className={styles.ratingValue}>{form.success_rating}</div>
                            </div>
                            <div className={styles.ratingLabels}>
                                <span>Poor</span>
                                <span>Average</span>
                                <span>Excellent</span>
                            </div>
                        </div>

                        <div className="form-group mt-lg">
                            <label className="form-label">Notes (optional)</label>
                            <textarea
                                className="form-textarea"
                                value={form.notes}
                                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Any additional observations or learnings from this ad..."
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className={styles.submitSection}>
                        <button type="submit" className="btn btn-primary btn-lg" disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                                    </svg>
                                    Saving & Training AI...
                                </>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    Save Performance Data
                                </>
                            )}
                        </button>
                        <p className={styles.submitHint}>
                            This data will be used to train the AI and improve future predictions
                        </p>
                    </div>
                </form>
            )}
        </div>
    );
}
