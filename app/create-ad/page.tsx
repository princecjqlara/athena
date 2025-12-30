'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './page.module.css';
import { ExtractedAdData } from '@/types';
import {
    CampaignRecommendations,
    ObjectiveRecommendation,
    BudgetRecommendation,
    TargetingRecommendation,
} from '@/lib/ml/campaign-optimizer';

// Step type
type Step = 'content' | 'recommendations' | 'customize' | 'creating' | 'success';

// Campaign settings that user can customize
interface CampaignSettings {
    campaignName: string;
    objective: string;
    dailyBudget: number;
    structure: 'CBO' | 'ABO';
    ageMin: number;
    ageMax: number;
    gender: 'all' | 'male' | 'female';
    interests: string[];
    countries: string[];
    launchImmediately: boolean;
    specialAdCategory: string;
}

// Creation result
interface CreationResult {
    campaignId?: string;
    adsetId?: string;
    error?: string;
}

export default function CreateAdPage() {
    // Step state
    const [step, setStep] = useState<Step>('content');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Content state
    const [contentDocument, setContentDocument] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'video' | 'photo' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Extracted data
    const [extractedData, setExtractedData] = useState<ExtractedAdData | null>(null);

    // ML Recommendations
    const [recommendations, setRecommendations] = useState<CampaignRecommendations | null>(null);

    // User-customizable settings (initialized from recommendations)
    const [settings, setSettings] = useState<CampaignSettings>({
        campaignName: '',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 500,
        structure: 'CBO',
        ageMin: 18,
        ageMax: 65,
        gender: 'all',
        interests: [],
        countries: ['PH'],
        launchImmediately: false,
        specialAdCategory: '',
    });

    // Creation result
    const [creationResult, setCreationResult] = useState<CreationResult | null>(null);

    // Handle file drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, []);

    const handleFile = (file: File) => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        if (!isVideo && !isImage) {
            setError('Please upload a video or image file');
            return;
        }

        setMediaFile(file);
        setMediaType(isVideo ? 'video' : 'photo');
        setMediaPreview(URL.createObjectURL(file));
        setError(null);
    };

    // Fallback trait extraction when AI API fails
    const extractTraitsFallback = (text: string) => {
        const lowText = text.toLowerCase();

        // Detect platform
        let platform = 'facebook';
        if (lowText.includes('tiktok')) platform = 'tiktok';
        else if (lowText.includes('instagram') || lowText.includes('ig') || lowText.includes('reels')) platform = 'instagram';
        else if (lowText.includes('youtube') || lowText.includes('yt')) platform = 'youtube';

        // Detect hook type
        let hookType = 'curiosity';
        if (lowText.includes('question') || lowText.includes('?')) hookType = 'question';
        else if (lowText.includes('shock') || lowText.includes('surprising')) hookType = 'shock';
        else if (lowText.includes('before') && lowText.includes('after')) hookType = 'before_after';
        else if (lowText.includes('story') || lowText.includes('journey')) hookType = 'story';
        else if (lowText.includes('testimonial') || lowText.includes('review')) hookType = 'testimonial';

        // Detect content category
        let contentCategory = 'product_demo';
        if (lowText.includes('ugc') || lowText.includes('user generated') || lowText.includes('authentic')) contentCategory = 'ugc';
        else if (lowText.includes('testimonial') || lowText.includes('review')) contentCategory = 'testimonial';
        else if (lowText.includes('lifestyle')) contentCategory = 'lifestyle';
        else if (lowText.includes('tutorial') || lowText.includes('how to')) contentCategory = 'educational';

        // Detect editing style
        let editingStyle = 'raw_authentic';
        if (lowText.includes('fast cut') || lowText.includes('quick')) editingStyle = 'fast_cuts';
        else if (lowText.includes('cinematic') || lowText.includes('polished')) editingStyle = 'cinematic';
        else if (lowText.includes('dynamic') || lowText.includes('energetic')) editingStyle = 'dynamic';

        // Detect features
        const hasSubtitles = lowText.includes('subtitle') || lowText.includes('caption') || lowText.includes('text');
        const hasVoiceover = lowText.includes('voiceover') || lowText.includes('voice over') || lowText.includes('narrat');
        const isUGCStyle = lowText.includes('ugc') || lowText.includes('authentic') || lowText.includes('raw');

        // Detect industry
        let industryVertical = 'general';
        if (lowText.includes('beauty') || lowText.includes('skincare') || lowText.includes('makeup')) industryVertical = 'beauty';
        else if (lowText.includes('fitness') || lowText.includes('workout') || lowText.includes('gym')) industryVertical = 'fitness';
        else if (lowText.includes('tech') || lowText.includes('app') || lowText.includes('software')) industryVertical = 'tech';
        else if (lowText.includes('food') || lowText.includes('restaurant') || lowText.includes('recipe')) industryVertical = 'food';
        else if (lowText.includes('fashion') || lowText.includes('clothing') || lowText.includes('apparel')) industryVertical = 'fashion';

        return {
            title: 'AI Ad Campaign',
            description: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
            mediaType: mediaType || 'video',
            aspectRatio: '9:16',
            platform,
            placement: 'feed',
            hookType,
            contentCategory,
            editingStyle,
            industryVertical,
            hasSubtitles,
            hasVoiceover,
            isUGCStyle,
            hasTextOverlays: lowText.includes('text') || lowText.includes('overlay'),
            colorScheme: 'vibrant',
            musicType: lowText.includes('trending') ? 'trending' : 'upbeat',
            numberOfActors: 1,
            customTraits: [] as string[],
            extractionConfidence: 50, // Lower confidence for fallback
        } as unknown as ExtractedAdData;
    };

    // Step 1: Parse content and extract traits
    const handleAnalyzeContent = async () => {
        if (!contentDocument.trim()) {
            setError('Please describe your ad content');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Extract ad traits using AI
            const parseResponse = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse-content',
                    data: { rawText: contentDocument }
                })
            });

            const parseResult = await parseResponse.json();

            let extracted;
            let usedFallback = false;

            // Check if AI API returned success with data
            if (parseResult.success && parseResult.data) {
                extracted = {
                    ...parseResult.data,
                    mediaType: mediaType || parseResult.data.mediaType
                };
            } else if (parseResult.fallback || parseResult.error) {
                // AI API failed - use fallback extraction
                console.warn('AI API unavailable, using fallback extraction:', parseResult.error);
                extracted = extractTraitsFallback(contentDocument);
                usedFallback = true;
            } else {
                // Unexpected response format
                console.error('Unexpected AI API response:', parseResult);
                extracted = extractTraitsFallback(contentDocument);
                usedFallback = true;
            }

            setExtractedData(extracted);

            // Get ML campaign recommendations
            const recResponse = await fetch('/api/campaign/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adTraits: extracted,
                    goals: {
                        targetROAS: 2.5,
                        monthlyBudget: settings.dailyBudget * 30
                    }
                })
            });

            const recResult = await recResponse.json();

            if (recResult.success && recResult.recommendations) {
                setRecommendations(recResult.recommendations);

                // Initialize settings from recommendations
                const recs = recResult.recommendations as CampaignRecommendations;
                setSettings(prev => ({
                    ...prev,
                    campaignName: `${extracted.platform || 'FB'} - ${extracted.contentCategory || 'Ad'} - ${new Date().toLocaleDateString()}`,
                    objective: recs.objective.recommended,
                    dailyBudget: recs.budget.dailyBudget.optimal,
                    structure: recs.budget.structure,
                    ageMin: recs.targeting.ageRange.min,
                    ageMax: recs.targeting.ageRange.max,
                    gender: recs.targeting.gender,
                    interests: recs.targeting.interests.slice(0, 5),
                }));
            } else {
                // Still continue to recommendations step even without ML recommendations
                // Use default settings
                // Create partial recommendations that work with UI even if not fully typed
                setRecommendations({
                    objective: {
                        recommended: 'OUTCOME_LEADS',
                        confidence: 60,
                        reasoning: 'Default recommendation based on content analysis.',
                        alternatives: ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'],
                        historicalPerformance: []
                    },
                    budget: {
                        dailyBudget: { min: 300, optimal: 500, max: 1000 },
                        structure: 'CBO',
                        confidence: 60,
                        reasoning: 'Default budget based on industry averages.'
                    },
                    targeting: {
                        ageRange: { min: 18, max: 45 },
                        gender: 'all' as const,
                        interests: ['Online Shopping', 'Social Media'],
                        confidence: 60,
                        reasoning: 'Default targeting based on content analysis.'
                    },
                    timing: {
                        bestLaunchDay: 'tuesday',
                        bestLaunchTime: '9:00 AM',
                        confidence: 60,
                        reasoning: 'Default timing based on general best practices.'
                    },
                    overallConfidence: 60,
                    dataQuality: 'low' as const,
                    warnings: usedFallback
                        ? ['AI analysis unavailable - using basic extraction. Results may be less accurate.']
                        : ['Limited data available for recommendations.']
                } as unknown as CampaignRecommendations);
            }

            // Show warning if fallback was used but still proceed
            if (usedFallback) {
                setError('⚠️ AI analysis temporarily unavailable. Using basic extraction - you can adjust traits in the next step.');
            }

            setStep('recommendations');
        } catch (err) {
            console.error('Analysis error:', err);

            // Even on complete failure, try to proceed with fallback
            try {
                const extracted = extractTraitsFallback(contentDocument);
                setExtractedData(extracted);

                // Set default recommendations
                // Create partial recommendations that work with UI
                setRecommendations({
                    objective: {
                        recommended: 'OUTCOME_LEADS',
                        confidence: 50,
                        reasoning: 'Default recommendation - AI service unavailable.',
                        alternatives: ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'],
                        historicalPerformance: []
                    },
                    budget: {
                        dailyBudget: { min: 300, optimal: 500, max: 1000 },
                        structure: 'CBO',
                        confidence: 50,
                        reasoning: 'Default budget recommendation.'
                    },
                    targeting: {
                        ageRange: { min: 18, max: 45 },
                        gender: 'all' as const,
                        interests: ['Online Shopping', 'Social Media'],
                        confidence: 50,
                        reasoning: 'Default targeting.'
                    },
                    timing: {
                        bestLaunchDay: 'tuesday',
                        bestLaunchTime: '9:00 AM',
                        confidence: 50,
                        reasoning: 'Default timing.'
                    },
                    overallConfidence: 50,
                    dataQuality: 'low' as const,
                    warnings: ['AI service unavailable. Using basic analysis - please review and adjust settings carefully.']
                } as unknown as CampaignRecommendations);

                setError('⚠️ AI service unavailable. Using basic analysis - please review settings carefully.');
                setStep('recommendations');
            } catch (fallbackErr) {
                setError('Failed to analyze content. Please check your internet connection and try again.');
            }
        }

        setIsLoading(false);
    };

    // Step 4: Create campaign on Facebook
    const handleCreateCampaign = async () => {
        setStep('creating');
        setIsLoading(true);
        setError(null);

        try {
            const savedToken = localStorage.getItem('meta_marketing_token');
            const savedAccountId = localStorage.getItem('meta_ad_account_id');

            if (!savedToken || !savedAccountId) {
                setError('Please configure your Meta API credentials in Settings first.');
                setStep('customize');
                setIsLoading(false);
                return;
            }

            // 1. Create Campaign
            const campaignResponse = await fetch('/api/facebook/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: settings.campaignName,
                    objective: settings.objective,
                    status: settings.launchImmediately ? 'ACTIVE' : 'PAUSED',
                    specialAdCategories: settings.specialAdCategory ? [settings.specialAdCategory] : [],
                    accessToken: savedToken,
                    adAccountId: savedAccountId
                })
            });

            const campaignResult = await campaignResponse.json();

            if (!campaignResult.success) {
                throw new Error(campaignResult.error || 'Failed to create campaign');
            }

            // 2. Create Ad Set
            const adsetResponse = await fetch('/api/facebook/adsets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${settings.campaignName} - Ad Set`,
                    campaignId: campaignResult.campaignId,
                    dailyBudget: settings.dailyBudget,
                    optimizationGoal: getOptimizationGoal(settings.objective),
                    billingEvent: 'IMPRESSIONS',
                    status: settings.launchImmediately ? 'ACTIVE' : 'PAUSED',
                    countries: settings.countries,
                    ageMin: settings.ageMin,
                    ageMax: settings.ageMax,
                    genders: settings.gender === 'all' ? undefined : settings.gender === 'male' ? [1] : [2],
                    interests: settings.interests.length > 0 ? settings.interests : undefined,
                    accessToken: savedToken,
                    adAccountId: savedAccountId
                })
            });

            const adsetResult = await adsetResponse.json();

            if (!adsetResult.success) {
                throw new Error(adsetResult.error || 'Failed to create ad set');
            }

            setCreationResult({
                campaignId: campaignResult.campaignId,
                adsetId: adsetResult.adsetId
            });
            setStep('success');

        } catch (err) {
            console.error('Creation error:', err);
            setError(err instanceof Error ? err.message : 'Failed to create campaign');
            setStep('customize');
        }

        setIsLoading(false);
    };

    // Helper: Get optimization goal from objective
    const getOptimizationGoal = (objective: string): string => {
        const goalMap: Record<string, string> = {
            'OUTCOME_AWARENESS': 'REACH',
            'OUTCOME_ENGAGEMENT': 'POST_ENGAGEMENT',
            'OUTCOME_LEADS': 'LEAD_GENERATION',
            'OUTCOME_SALES': 'OFFSITE_CONVERSIONS',
            'OUTCOME_TRAFFIC': 'LINK_CLICKS',
            'OUTCOME_APP_PROMOTION': 'APP_INSTALLS'
        };
        return goalMap[objective] || 'LINK_CLICKS';
    };

    // Helper: Format objective for display
    const formatObjective = (objective: string): string => {
        return objective.replace('OUTCOME_', '').replace(/_/g, ' ').toLowerCase()
            .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    // Helper: Get confidence color
    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 80) return 'var(--success)';
        if (confidence >= 60) return 'var(--warning)';
        return 'var(--error)';
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>➕ Create Facebook Ad</h1>
                <p className={styles.subtitle}>ML-powered campaign creation with intelligent recommendations</p>
            </header>

            {/* Progress Steps */}
            <div className={styles.progressSteps}>
                <div className={`${styles.step} ${step === 'content' || step === 'recommendations' || step === 'customize' || step === 'creating' || step === 'success' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>1</span>
                    <span>Describe Ad</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${step === 'recommendations' || step === 'customize' || step === 'creating' || step === 'success' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>2</span>
                    <span>ML Recommendations</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${step === 'customize' || step === 'creating' || step === 'success' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>3</span>
                    <span>Customize</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${step === 'creating' || step === 'success' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>4</span>
                    <span>Create</span>
                </div>
            </div>

            {error && (
                <div className={styles.errorBanner}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Step 1: Content Input */}
            {step === 'content' && (
                <div className={styles.contentSection}>
                    {/* Optional Media Upload */}
                    <div className={`glass-card ${styles.mediaCard}`}>
                        <h3>📷 Media (Optional)</h3>
                        <div
                            className={styles.dropZone}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {mediaPreview ? (
                                mediaType === 'video' ? (
                                    <video src={mediaPreview} controls className={styles.mediaPreview} />
                                ) : (
                                    <img src={mediaPreview} alt="Preview" className={styles.mediaPreview} />
                                )
                            ) : (
                                <>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <p>Drop media here (optional)</p>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*,image/*"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Content Description */}
                    <div className={`glass-card ${styles.descriptionCard}`}>
                        <h3>📝 Describe Your Ad</h3>
                        <p>Tell us about your ad - platform, style, content type, target audience, etc.</p>

                        <textarea
                            className={styles.textarea}
                            placeholder={`Example:
TikTok vertical video, UGC style with curiosity hook.
Female creator in her 20s talking about skincare.
Raw authentic editing with fast cuts.
Has subtitles and trending audio.
Targeting Gen Z women interested in beauty.
CTA: "Link in bio for 20% off"`}
                            value={contentDocument}
                            onChange={(e) => setContentDocument(e.target.value)}
                            rows={12}
                        />

                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleAnalyzeContent}
                            disabled={isLoading || !contentDocument.trim()}
                            style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                                    </svg>
                                    Analyzing...
                                </>
                            ) : (
                                <>🤖 Analyze & Get Recommendations</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: ML Recommendations */}
            {step === 'recommendations' && recommendations && extractedData && (
                <div className={styles.recommendationsSection}>
                    {/* Overall Confidence & Data Points */}
                    <div className={`glass-card ${styles.overallCard}`}>
                        <div className={styles.overallHeader}>
                            <div>
                                <h2>🧠 ML Campaign Recommendations</h2>
                                <p>Based on your ad content and historical performance data</p>
                            </div>
                            <div className={styles.confidenceScore} style={{ color: getConfidenceColor(recommendations.overallConfidence) }}>
                                <span className={styles.confidenceNumber}>{recommendations.overallConfidence}%</span>
                                <span className={styles.confidenceLabel}>Confidence</span>
                            </div>
                        </div>
                        <div className={styles.dataQuality}>
                            <span>Data Quality: <span className={`badge badge-${recommendations.dataQuality === 'high' ? 'success' : recommendations.dataQuality === 'medium' ? 'warning' : 'secondary'}`}>
                                {recommendations.dataQuality.toUpperCase()}
                            </span></span>
                            {recommendations.dataPoints && (
                                <span style={{ marginLeft: 'var(--spacing-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    📊 {recommendations.dataPoints.totalAdsAnalyzed} ads analyzed |
                                    Avg ROAS: {recommendations.dataPoints.avgROAS}x
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Primary Recommendation Cards - 2 columns */}
                    <div className={styles.recGrid}>
                        {/* Objective Recommendation */}
                        <div className={`glass-card ${styles.recCard}`}>
                            <div className={styles.recHeader}>
                                <span className={styles.recIcon}>🎯</span>
                                <h3>Campaign Objective</h3>
                                <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.objective.confidence) }}>
                                    {recommendations.objective.confidence}%
                                </span>
                            </div>
                            <div className={styles.recValue}>
                                {formatObjective(recommendations.objective.recommended)}
                            </div>
                            <p className={styles.recReasoning}>{recommendations.objective.reasoning}</p>
                            {recommendations.objective.historicalPerformance && recommendations.objective.historicalPerformance.length > 0 && (
                                <div className={styles.historicalData}>
                                    <small><strong>Historical Performance:</strong></small>
                                    <div className={styles.histTable}>
                                        {recommendations.objective.historicalPerformance.slice(0, 3).map((perf, i) => (
                                            <div key={i} className={styles.histRow}>
                                                <span>{formatObjective(perf.objective)}</span>
                                                <span>ROAS: {perf.avgROAS}x</span>
                                                <span>({perf.sampleSize} ads)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className={styles.recAlternatives}>
                                <small>Alternatives: {recommendations.objective.alternatives?.slice(0, 2).map(formatObjective).join(', ')}</small>
                            </div>
                        </div>

                        {/* Budget Recommendation - Enhanced */}
                        <div className={`glass-card ${styles.recCard}`}>
                            <div className={styles.recHeader}>
                                <span className={styles.recIcon}>💰</span>
                                <h3>Budget & Structure</h3>
                                <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.budget.confidence) }}>
                                    {recommendations.budget.confidence}%
                                </span>
                            </div>
                            <div className={styles.recValue}>
                                ₱{recommendations.budget.dailyBudget.optimal}/day
                            </div>
                            <div className={styles.budgetRange}>
                                Range: ₱{recommendations.budget.dailyBudget.min} - ₱{recommendations.budget.dailyBudget.max}
                            </div>
                            <div className={styles.structureBadge}>
                                <span className="badge badge-primary">{recommendations.budget.structure}</span>
                                <span className={`badge ${recommendations.budget.budgetType === 'daily' ? 'badge-success' : 'badge-warning'}`}>
                                    {recommendations.budget.budgetType?.toUpperCase() || 'DAILY'}
                                </span>
                            </div>
                            <p className={styles.recReasoning}>{recommendations.budget.reasoning}</p>
                            {recommendations.budget.budgetTypeReasoning && (
                                <p className={styles.recReasoning} style={{ marginTop: 'var(--spacing-xs)', fontStyle: 'italic' }}>
                                    💡 {recommendations.budget.budgetTypeReasoning}
                                </p>
                            )}
                            {recommendations.budget.historicalBudgetData && recommendations.budget.historicalBudgetData.length > 0 && (
                                <div className={styles.historicalData}>
                                    <small><strong>Budget Tier Performance:</strong></small>
                                    <div className={styles.histTable}>
                                        {recommendations.budget.historicalBudgetData.slice(0, 3).map((data, i) => (
                                            <div key={i} className={styles.histRow}>
                                                <span>{data.tier}</span>
                                                <span>ROAS: {data.avgROAS}x</span>
                                                <span>({data.sampleSize} ads)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Targeting Recommendation */}
                        <div className={`glass-card ${styles.recCard}`}>
                            <div className={styles.recHeader}>
                                <span className={styles.recIcon}>👥</span>
                                <h3>Target Audience</h3>
                                <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.targeting.confidence) }}>
                                    {recommendations.targeting.confidence}%
                                </span>
                            </div>
                            <div className={styles.recValue}>
                                Ages {recommendations.targeting.ageRange.min}-{recommendations.targeting.ageRange.max}
                                {recommendations.targeting.gender !== 'all' && `, ${recommendations.targeting.gender}`}
                            </div>
                            <div className={styles.interestTags}>
                                {recommendations.targeting.interests.slice(0, 4).map((interest, i) => (
                                    <span key={i} className="badge badge-secondary">{interest}</span>
                                ))}
                            </div>
                            <p className={styles.recReasoning}>{recommendations.targeting.reasoning}</p>
                            {recommendations.targeting.segments && recommendations.targeting.segments.length > 0 && (
                                <div className={styles.historicalData}>
                                    <small><strong>Top Segments:</strong></small>
                                    <div className={styles.histTable}>
                                        {recommendations.targeting.segments.slice(0, 3).map((seg, i) => (
                                            <div key={i} className={styles.histRow}>
                                                <span>{seg.name}</span>
                                                <span>Score: {Math.round(seg.score)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Placements Recommendation - NEW */}
                        {recommendations.placements && (
                            <div className={`glass-card ${styles.recCard}`}>
                                <div className={styles.recHeader}>
                                    <span className={styles.recIcon}>📍</span>
                                    <h3>Placements</h3>
                                    <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.placements.confidence) }}>
                                        {recommendations.placements.confidence}%
                                    </span>
                                </div>
                                <div className={styles.recValue}>
                                    {recommendations.placements.automaticPlacements ? 'Automatic' : `${recommendations.placements.placements.length} Placements`}
                                </div>
                                <div className={styles.interestTags}>
                                    {recommendations.placements.placements.slice(0, 4).map((p, i) => (
                                        <span key={i} className="badge badge-success">{p.replace('_', ' ')}</span>
                                    ))}
                                </div>
                                {recommendations.placements.excludedPlacements.length > 0 && (
                                    <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                        <small style={{ color: 'var(--text-muted)' }}>Excluded: </small>
                                        {recommendations.placements.excludedPlacements.slice(0, 2).map((p, i) => (
                                            <span key={i} className="badge badge-secondary" style={{ opacity: 0.6, marginLeft: '4px' }}>{p.replace('_', ' ')}</span>
                                        ))}
                                    </div>
                                )}
                                <p className={styles.recReasoning}>{recommendations.placements.reasoning}</p>
                            </div>
                        )}

                        {/* Ad Copy Recommendation - NEW */}
                        {recommendations.adCopy && (
                            <div className={`glass-card ${styles.recCard}`}>
                                <div className={styles.recHeader}>
                                    <span className={styles.recIcon}>✏️</span>
                                    <h3>Ad Copy</h3>
                                    <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.adCopy.confidence) }}>
                                        {recommendations.adCopy.confidence}%
                                    </span>
                                </div>
                                <div className={styles.adCopyPreview}>
                                    <div className={styles.copyField}>
                                        <small>Primary Text:</small>
                                        <p>{recommendations.adCopy.primaryText}</p>
                                    </div>
                                    <div className={styles.copyField}>
                                        <small>Headline:</small>
                                        <p><strong>{recommendations.adCopy.headline}</strong></p>
                                    </div>
                                    <div className={styles.copyField}>
                                        <span className="badge badge-primary">{recommendations.adCopy.callToAction.replace('_', ' ')}</span>
                                    </div>
                                </div>
                                <p className={styles.recReasoning}>{recommendations.adCopy.reasoning}</p>
                                {recommendations.adCopy.alternatives && recommendations.adCopy.alternatives.length > 0 && (
                                    <div className={styles.recAlternatives}>
                                        <small>Alt headline: {recommendations.adCopy.alternatives[0]?.headline}</small>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Flexible Ads (Advantage+) - NEW */}
                        {recommendations.flexibleAds && (
                            <div className={`glass-card ${styles.recCard}`}>
                                <div className={styles.recHeader}>
                                    <span className={styles.recIcon}>🔄</span>
                                    <h3>Advantage+ Creative</h3>
                                    <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.flexibleAds.confidence) }}>
                                        {recommendations.flexibleAds.confidence}%
                                    </span>
                                </div>
                                <div className={styles.recValue}>
                                    {recommendations.flexibleAds.useFlexibleAds ? '✅ Enabled' : '❌ Disabled'}
                                </div>
                                {recommendations.flexibleAds.useFlexibleAds && (
                                    <div className={styles.enhancementsList}>
                                        {recommendations.flexibleAds.enhancements.textOptimization && <span className="badge badge-success">Text Optimization</span>}
                                        {recommendations.flexibleAds.enhancements.imageBrightness && <span className="badge badge-success">Image Enhancement</span>}
                                        {recommendations.flexibleAds.enhancements.musicGeneration && <span className="badge badge-success">Music</span>}
                                        {recommendations.flexibleAds.enhancements.imageTemplates && <span className="badge badge-success">Templates</span>}
                                    </div>
                                )}
                                <p className={styles.recReasoning}>{recommendations.flexibleAds.reasoning}</p>
                            </div>
                        )}

                        {/* Timing Recommendation */}
                        <div className={`glass-card ${styles.recCard}`}>
                            <div className={styles.recHeader}>
                                <span className={styles.recIcon}>⏰</span>
                                <h3>Best Launch Time</h3>
                                <span className={styles.recConfidence} style={{ color: getConfidenceColor(recommendations.timing.confidence) }}>
                                    {recommendations.timing.confidence}%
                                </span>
                            </div>
                            <div className={styles.recValue}>
                                {recommendations.timing.bestLaunchDay.charAt(0).toUpperCase() + recommendations.timing.bestLaunchDay.slice(1)} {recommendations.timing.bestLaunchTime}
                            </div>
                            <p className={styles.recReasoning}>{recommendations.timing.reasoning}</p>
                        </div>
                    </div>

                    {/* Top Performing Traits from Data */}
                    {recommendations.dataPoints?.topPerformingTraits && recommendations.dataPoints.topPerformingTraits.length > 0 && (
                        <div className={`glass-card ${styles.dataPointsCard}`}>
                            <h4>📈 Top Performing Traits in Your Data</h4>
                            <div className={styles.traitsList}>
                                {recommendations.dataPoints.topPerformingTraits.map((trait, i) => (
                                    <span key={i} className="badge badge-primary">{trait}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Warnings */}
                    {recommendations.warnings && recommendations.warnings.length > 0 && (
                        <div className={styles.warningsCard}>
                            <h4>⚠️ Notes</h4>
                            <ul>
                                {recommendations.warnings.map((warning, i) => (
                                    <li key={i}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles.recActions}>
                        <button className="btn btn-secondary" onClick={() => setStep('content')}>
                            ← Back
                        </button>
                        <button className="btn btn-primary btn-lg" onClick={() => setStep('customize')}>
                            Accept & Customize →
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Customize Settings */}
            {step === 'customize' && (
                <div className={styles.customizeSection}>
                    <div className={`glass-card ${styles.settingsCard}`}>
                        <h2>⚙️ Campaign Settings</h2>
                        <p>Review and customize your campaign settings before creating</p>

                        <div className={styles.settingsGrid}>
                            {/* Campaign Name */}
                            <div className={styles.formGroup}>
                                <label>Campaign Name</label>
                                <input
                                    type="text"
                                    value={settings.campaignName}
                                    onChange={(e) => setSettings({ ...settings, campaignName: e.target.value })}
                                    placeholder="Enter campaign name"
                                />
                            </div>

                            {/* Objective */}
                            <div className={styles.formGroup}>
                                <label>Objective</label>
                                <select
                                    value={settings.objective}
                                    onChange={(e) => setSettings({ ...settings, objective: e.target.value })}
                                >
                                    <option value="OUTCOME_AWARENESS">Awareness</option>
                                    <option value="OUTCOME_TRAFFIC">Traffic</option>
                                    <option value="OUTCOME_ENGAGEMENT">Engagement</option>
                                    <option value="OUTCOME_LEADS">Leads</option>
                                    <option value="OUTCOME_SALES">Sales</option>
                                    <option value="OUTCOME_APP_PROMOTION">App Promotion</option>
                                </select>
                            </div>

                            {/* Daily Budget */}
                            <div className={styles.formGroup}>
                                <label>Daily Budget (₱)</label>
                                <input
                                    type="number"
                                    value={settings.dailyBudget}
                                    onChange={(e) => setSettings({ ...settings, dailyBudget: parseInt(e.target.value) || 0 })}
                                    min={200}
                                />
                            </div>

                            {/* Age Range */}
                            <div className={styles.formGroup}>
                                <label>Age Range</label>
                                <div className={styles.ageInputs}>
                                    <input
                                        type="number"
                                        value={settings.ageMin}
                                        onChange={(e) => setSettings({ ...settings, ageMin: parseInt(e.target.value) || 18 })}
                                        min={18}
                                        max={65}
                                    />
                                    <span>to</span>
                                    <input
                                        type="number"
                                        value={settings.ageMax}
                                        onChange={(e) => setSettings({ ...settings, ageMax: parseInt(e.target.value) || 65 })}
                                        min={18}
                                        max={65}
                                    />
                                </div>
                            </div>

                            {/* Gender */}
                            <div className={styles.formGroup}>
                                <label>Gender</label>
                                <select
                                    value={settings.gender}
                                    onChange={(e) => setSettings({ ...settings, gender: e.target.value as 'all' | 'male' | 'female' })}
                                >
                                    <option value="all">All</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>

                            {/* Special Ad Category */}
                            <div className={styles.formGroup}>
                                <label>Special Ad Category (if applicable)</label>
                                <select
                                    value={settings.specialAdCategory}
                                    onChange={(e) => setSettings({ ...settings, specialAdCategory: e.target.value })}
                                >
                                    <option value="">None</option>
                                    <option value="HOUSING">Housing</option>
                                    <option value="EMPLOYMENT">Employment</option>
                                    <option value="CREDIT">Credit</option>
                                    <option value="ISSUES_ELECTIONS_POLITICS">Issues, Elections, Politics</option>
                                </select>
                            </div>
                        </div>

                        {/* Launch Option */}
                        <div className={styles.launchOption}>
                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={settings.launchImmediately}
                                    onChange={(e) => setSettings({ ...settings, launchImmediately: e.target.checked })}
                                />
                                <span>Launch immediately (otherwise starts paused)</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className={styles.settingsActions}>
                            <button className="btn btn-secondary" onClick={() => setStep('recommendations')}>
                                ← Back
                            </button>
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleCreateCampaign}
                                disabled={!settings.campaignName || settings.dailyBudget < 200}
                            >
                                🚀 Create Campaign on Facebook
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Creating */}
            {step === 'creating' && (
                <div className={styles.creatingSection}>
                    <div className={`glass-card ${styles.creatingCard}`}>
                        <div className={styles.spinner}></div>
                        <h2>Creating Your Campaign...</h2>
                        <p>Setting up your campaign on Facebook</p>
                        <div className={styles.creatingSteps}>
                            <div className={styles.creatingStep}>
                                <span className={styles.creatingIcon}>📊</span>
                                <span>Creating Campaign...</span>
                            </div>
                            <div className={styles.creatingStep}>
                                <span className={styles.creatingIcon}>🎯</span>
                                <span>Creating Ad Set...</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 5: Success */}
            {step === 'success' && creationResult && (
                <div className={styles.successSection}>
                    <div className={`glass-card ${styles.successCard}`}>
                        <div className={styles.successIcon}>🎉</div>
                        <h2>Campaign Created Successfully!</h2>
                        <p>Your campaign structure is ready on Facebook</p>

                        <div className={styles.createdIds}>
                            <div className={styles.createdItem}>
                                <span>Campaign ID:</span>
                                <code>{creationResult.campaignId}</code>
                            </div>
                            <div className={styles.createdItem}>
                                <span>Ad Set ID:</span>
                                <code>{creationResult.adsetId}</code>
                            </div>
                        </div>

                        <div className={styles.nextSteps}>
                            <h4>Next Steps:</h4>
                            <ol>
                                <li>Go to Facebook Ads Manager to add your creative</li>
                                <li>Review and enable the campaign when ready</li>
                                <li>Monitor performance in the Analytics page</li>
                            </ol>
                        </div>

                        <div className={styles.successActions}>
                            <a
                                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${localStorage.getItem('meta_ad_account_id')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                Open Ads Manager →
                            </a>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setStep('content');
                                    setContentDocument('');
                                    setExtractedData(null);
                                    setRecommendations(null);
                                    setCreationResult(null);
                                }}
                            >
                                Create Another
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
