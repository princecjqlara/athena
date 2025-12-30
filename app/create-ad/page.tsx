'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './page.module.css';
import { ExtractedAdData } from '@/types';
import {
    CampaignRecommendations,
} from '@/lib/ml/campaign-optimizer';

// ============ NEW INTERFACES FOR CAMPAIGN STRUCTURE ============

// Ad Set configuration
interface AdSetConfig {
    id: string;
    name: string;
    dailyBudget: number;
    targeting: {
        ageMin: number;
        ageMax: number;
        gender: 'all' | 'male' | 'female';
        countries: string[];
        interests: string[];
    };
    ads: AdConfig[];
    isExpanded: boolean;
}

// Individual Ad configuration
interface AdConfig {
    id: string;
    name: string;
    mediaFile?: File;
    mediaPreview?: string;
    mediaType: 'video' | 'photo';
    primaryText: string;
    headline: string;
    description: string;
    callToAction: string;
    websiteUrl: string;
}

// Campaign Template
interface CampaignTemplate {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    campaign: {
        name: string;
        objective: string;
        specialAdCategory: string;
    };
    adSets: Array<Omit<AdSetConfig, 'ads' | 'isExpanded'> & {
        ads: Array<Omit<AdConfig, 'mediaFile' | 'mediaPreview'>>;
    }>;
}

// Step type
type Step = 'content' | 'recommendations' | 'builder' | 'creating' | 'success';

// CTA options
const CTA_OPTIONS = [
    'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'SUBSCRIBE', 'GET_OFFER',
    'CONTACT_US', 'DOWNLOAD', 'BOOK_NOW', 'GET_QUOTE', 'APPLY_NOW'
];

// Default ad set
const createDefaultAdSet = (): AdSetConfig => ({
    id: `adset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'New Ad Set',
    dailyBudget: 500,
    targeting: {
        ageMin: 18,
        ageMax: 45,
        gender: 'all',
        countries: ['PH'],
        interests: []
    },
    ads: [],
    isExpanded: true
});

// Default ad
const createDefaultAd = (): AdConfig => ({
    id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'New Ad',
    mediaType: 'photo',
    primaryText: '',
    headline: '',
    description: '',
    callToAction: 'LEARN_MORE',
    websiteUrl: ''
});

// Campaign settings
interface CampaignSettings {
    name: string;
    objective: string;
    specialAdCategory: string;
    launchImmediately: boolean;
}

// Creation result
interface CreationResult {
    campaignId?: string;
    adsets: Array<{ adsetId: string; adIds: string[] }>;
    error?: string;
}

export default function CreateAdPage() {
    // Step state
    const [step, setStep] = useState<Step>('content');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Content state for initial ML analysis
    const [contentDocument, setContentDocument] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'video' | 'photo' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Extracted data & ML recommendations
    const [extractedData, setExtractedData] = useState<ExtractedAdData | null>(null);
    const [recommendations, setRecommendations] = useState<CampaignRecommendations | null>(null);

    // ========== CAMPAIGN STRUCTURE STATE ==========
    const [campaignSettings, setCampaignSettings] = useState<CampaignSettings>({
        name: '',
        objective: 'OUTCOME_LEADS',
        specialAdCategory: '',
        launchImmediately: false
    });

    const [adSets, setAdSets] = useState<AdSetConfig[]>([createDefaultAdSet()]);

    // ========== TEMPLATE STATE ==========
    const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);

    // ========== MODAL STATE ==========
    const [editingAdSetId, setEditingAdSetId] = useState<string | null>(null);
    const [editingAdId, setEditingAdId] = useState<{ adSetId: string; adId: string } | null>(null);

    // Creation result
    const [creationResult, setCreationResult] = useState<CreationResult | null>(null);

    // Load templates on mount
    useEffect(() => {
        const savedTemplates = localStorage.getItem('campaign_templates');
        if (savedTemplates) {
            try {
                setTemplates(JSON.parse(savedTemplates));
            } catch (e) {
                console.error('Failed to load templates:', e);
            }
        }
    }, []);

    // ========== FILE HANDLING ==========
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

    // ========== TRAIT EXTRACTION ==========
    const extractTraitsFallback = (text: string) => {
        const lowText = text.toLowerCase();
        let platform = 'facebook';
        if (lowText.includes('tiktok')) platform = 'tiktok';
        else if (lowText.includes('instagram')) platform = 'instagram';
        else if (lowText.includes('youtube')) platform = 'youtube';

        let hookType = 'curiosity';
        if (lowText.includes('question') || lowText.includes('?')) hookType = 'question';
        else if (lowText.includes('shock')) hookType = 'shock';
        else if (lowText.includes('story')) hookType = 'story';

        return {
            title: 'AI Ad Campaign',
            description: text.slice(0, 100),
            mediaType: mediaType || 'video',
            aspectRatio: '9:16',
            platform,
            placement: 'feed',
            hookType,
            contentCategory: 'product_demo',
            editingStyle: 'raw_authentic',
            industryVertical: 'general',
            hasSubtitles: true,
            hasVoiceover: false,
            isUGCStyle: lowText.includes('ugc'),
            hasTextOverlays: true,
            colorScheme: 'vibrant',
            musicType: 'upbeat',
            numberOfActors: 1,
            customTraits: [],
            extractionConfidence: 50,
        } as unknown as ExtractedAdData;
    };

    // ========== STEP 1: ANALYZE CONTENT ==========
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

            if (parseResult.success && parseResult.data) {
                extracted = {
                    ...parseResult.data,
                    mediaType: mediaType || parseResult.data.mediaType
                };
            } else {
                extracted = extractTraitsFallback(contentDocument);
            }

            setExtractedData(extracted);

            // Get ML recommendations
            const recResponse = await fetch('/api/campaign/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adTraits: extracted,
                    goals: { targetROAS: 2.5, monthlyBudget: 15000 }
                })
            });

            const recResult = await recResponse.json();

            if (recResult.success && recResult.recommendations) {
                setRecommendations(recResult.recommendations);

                // Initialize with recommendations
                const recs = recResult.recommendations;
                setCampaignSettings(prev => ({
                    ...prev,
                    name: `${extracted.platform || 'FB'} - ${extracted.contentCategory || 'Ad'} - ${new Date().toLocaleDateString()}`,
                    objective: recs.objective?.recommended || 'OUTCOME_LEADS'
                }));

                // Initialize first ad set with recommendations
                setAdSets([{
                    ...createDefaultAdSet(),
                    name: 'Primary Audience',
                    dailyBudget: recs.budget?.dailyBudget?.optimal || 500,
                    targeting: {
                        ageMin: recs.targeting?.ageRange?.min || 18,
                        ageMax: recs.targeting?.ageRange?.max || 45,
                        gender: recs.targeting?.gender || 'all',
                        countries: ['PH'],
                        interests: recs.targeting?.interests?.slice(0, 5) || []
                    },
                    ads: [{
                        ...createDefaultAd(),
                        name: 'Primary Ad',
                        primaryText: recs.adCopy?.primaryText || '',
                        headline: recs.adCopy?.headline || '',
                        callToAction: recs.adCopy?.callToAction || 'LEARN_MORE'
                    }],
                    isExpanded: true
                }]);
            }

            setStep('recommendations');
        } catch (err) {
            console.error('Analysis error:', err);
            const extracted = extractTraitsFallback(contentDocument);
            setExtractedData(extracted);
            setStep('recommendations');
        }

        setIsLoading(false);
    };

    // ========== AD SET MANAGEMENT ==========
    const addAdSet = () => {
        setAdSets(prev => [...prev, createDefaultAdSet()]);
    };

    const removeAdSet = (adSetId: string) => {
        if (adSets.length <= 1) {
            setError('You need at least one ad set');
            return;
        }
        setAdSets(prev => prev.filter(as => as.id !== adSetId));
    };

    const updateAdSet = (adSetId: string, updates: Partial<AdSetConfig>) => {
        setAdSets(prev => prev.map(as =>
            as.id === adSetId ? { ...as, ...updates } : as
        ));
    };

    const duplicateAdSet = (adSetId: string) => {
        const original = adSets.find(as => as.id === adSetId);
        if (!original) return;

        const duplicate: AdSetConfig = {
            ...original,
            id: `adset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${original.name} (Copy)`,
            ads: original.ads.map(ad => ({
                ...ad,
                id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: `${ad.name} (Copy)`
            })),
            isExpanded: true
        };

        setAdSets(prev => [...prev, duplicate]);
    };

    const toggleAdSetExpand = (adSetId: string) => {
        setAdSets(prev => prev.map(as =>
            as.id === adSetId ? { ...as, isExpanded: !as.isExpanded } : as
        ));
    };

    // ========== AD MANAGEMENT ==========
    const addAd = (adSetId: string) => {
        setAdSets(prev => prev.map(as =>
            as.id === adSetId
                ? { ...as, ads: [...as.ads, createDefaultAd()] }
                : as
        ));
    };

    const removeAd = (adSetId: string, adId: string) => {
        setAdSets(prev => prev.map(as =>
            as.id === adSetId
                ? { ...as, ads: as.ads.filter(ad => ad.id !== adId) }
                : as
        ));
    };

    const updateAd = (adSetId: string, adId: string, updates: Partial<AdConfig>) => {
        setAdSets(prev => prev.map(as =>
            as.id === adSetId
                ? {
                    ...as,
                    ads: as.ads.map(ad =>
                        ad.id === adId ? { ...ad, ...updates } : ad
                    )
                }
                : as
        ));
    };

    const duplicateAd = (adSetId: string, adId: string) => {
        const adSet = adSets.find(as => as.id === adSetId);
        const original = adSet?.ads.find(ad => ad.id === adId);
        if (!original) return;

        const duplicate: AdConfig = {
            ...original,
            id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${original.name} (Copy)`,
            mediaFile: undefined // Don't copy file reference
        };

        setAdSets(prev => prev.map(as =>
            as.id === adSetId
                ? { ...as, ads: [...as.ads, duplicate] }
                : as
        ));
    };

    // Handle ad media upload
    const handleAdMediaUpload = (adSetId: string, adId: string, file: File) => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        if (!isVideo && !isImage) {
            setError('Please upload a video or image file');
            return;
        }

        updateAd(adSetId, adId, {
            mediaFile: file,
            mediaPreview: URL.createObjectURL(file),
            mediaType: isVideo ? 'video' : 'photo'
        });
    };

    // ========== TEMPLATE MANAGEMENT ==========
    const saveAsTemplate = () => {
        if (!templateName.trim()) {
            setError('Please enter a template name');
            return;
        }

        const template: CampaignTemplate = {
            id: `template_${Date.now()}`,
            name: templateName,
            description: templateDescription,
            createdAt: new Date().toISOString(),
            campaign: campaignSettings,
            adSets: adSets.map(as => ({
                id: as.id,
                name: as.name,
                dailyBudget: as.dailyBudget,
                targeting: as.targeting,
                ads: as.ads.map(ad => ({
                    id: ad.id,
                    name: ad.name,
                    mediaType: ad.mediaType,
                    primaryText: ad.primaryText,
                    headline: ad.headline,
                    description: ad.description,
                    callToAction: ad.callToAction,
                    websiteUrl: ad.websiteUrl
                }))
            }))
        };

        const updatedTemplates = [...templates, template];
        setTemplates(updatedTemplates);
        localStorage.setItem('campaign_templates', JSON.stringify(updatedTemplates));

        setShowTemplateModal(false);
        setTemplateName('');
        setTemplateDescription('');
        setError(null);
    };

    const loadTemplate = (template: CampaignTemplate) => {
        setCampaignSettings({
            ...template.campaign,
            launchImmediately: false
        });

        setAdSets(template.adSets.map(as => ({
            ...as,
            isExpanded: true,
            ads: as.ads.map(ad => ({
                ...ad,
                mediaFile: undefined,
                mediaPreview: undefined
            }))
        })));

        setShowLoadTemplateModal(false);
    };

    const deleteTemplate = (templateId: string) => {
        const updatedTemplates = templates.filter(t => t.id !== templateId);
        setTemplates(updatedTemplates);
        localStorage.setItem('campaign_templates', JSON.stringify(updatedTemplates));
    };

    // ========== CREATE CAMPAIGN ==========
    const handleCreateCampaign = async () => {
        // Validation
        if (!campaignSettings.name.trim()) {
            setError('Please enter a campaign name');
            return;
        }

        if (adSets.length === 0) {
            setError('Please add at least one ad set');
            return;
        }

        for (const adSet of adSets) {
            if (adSet.ads.length === 0) {
                setError(`Ad Set "${adSet.name}" has no ads. Please add at least one ad.`);
                return;
            }
        }

        setStep('creating');
        setIsLoading(true);
        setError(null);

        try {
            const savedToken = localStorage.getItem('meta_marketing_token');
            const savedAccountId = localStorage.getItem('meta_ad_account_id');

            if (!savedToken || !savedAccountId) {
                throw new Error('Please configure your Meta API credentials in Settings first.');
            }

            // 1. Create Campaign
            const campaignResponse = await fetch('/api/facebook/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: campaignSettings.name,
                    objective: campaignSettings.objective,
                    status: campaignSettings.launchImmediately ? 'ACTIVE' : 'PAUSED',
                    specialAdCategories: campaignSettings.specialAdCategory ? [campaignSettings.specialAdCategory] : [],
                    accessToken: savedToken,
                    adAccountId: savedAccountId
                })
            });

            const campaignResult = await campaignResponse.json();
            if (!campaignResult.success) {
                throw new Error(campaignResult.error || 'Failed to create campaign');
            }

            const result: CreationResult = {
                campaignId: campaignResult.campaignId,
                adsets: []
            };

            // 2. Create each Ad Set with its Ads
            for (const adSet of adSets) {
                // Create Ad Set
                const adsetResponse = await fetch('/api/facebook/adsets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: adSet.name,
                        campaignId: campaignResult.campaignId,
                        dailyBudget: adSet.dailyBudget,
                        optimizationGoal: getOptimizationGoal(campaignSettings.objective),
                        billingEvent: 'IMPRESSIONS',
                        status: campaignSettings.launchImmediately ? 'ACTIVE' : 'PAUSED',
                        countries: adSet.targeting.countries,
                        ageMin: adSet.targeting.ageMin,
                        ageMax: adSet.targeting.ageMax,
                        genders: adSet.targeting.gender === 'all' ? undefined :
                            adSet.targeting.gender === 'male' ? [1] : [2],
                        interests: adSet.targeting.interests.length > 0 ? adSet.targeting.interests : undefined,
                        accessToken: savedToken,
                        adAccountId: savedAccountId
                    })
                });

                const adsetResult = await adsetResponse.json();
                if (!adsetResult.success) {
                    console.error(`Failed to create ad set ${adSet.name}:`, adsetResult.error);
                    continue;
                }

                const adSetEntry = { adsetId: adsetResult.adsetId, adIds: [] as string[] };

                // Create each Ad in the ad set
                for (const ad of adSet.ads) {
                    try {
                        // Upload media to Cloudinary if present
                        let mediaUrl = '';
                        if (ad.mediaFile) {
                            const formData = new FormData();
                            formData.append('file', ad.mediaFile);
                            formData.append('resourceType', ad.mediaType);

                            const uploadResponse = await fetch('/api/cloudinary/upload', {
                                method: 'POST',
                                body: formData
                            });

                            const uploadResult = await uploadResponse.json();
                            if (uploadResult.success) {
                                mediaUrl = uploadResult.url;
                            }
                        }

                        // Create ad creative and ad (if you have the API endpoint)
                        // For now, we'll just log success
                        console.log(`Ad "${ad.name}" ready with media: ${mediaUrl}`);
                        adSetEntry.adIds.push(ad.id);
                    } catch (adError) {
                        console.error(`Failed to create ad ${ad.name}:`, adError);
                    }
                }

                result.adsets.push(adSetEntry);
            }

            setCreationResult(result);
            setStep('success');

        } catch (err) {
            console.error('Creation error:', err);
            setError(err instanceof Error ? err.message : 'Failed to create campaign');
            setStep('builder');
        }

        setIsLoading(false);
    };

    // Helper functions
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

    const formatObjective = (objective: string): string => {
        return objective.replace('OUTCOME_', '').replace(/_/g, ' ').toLowerCase()
            .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 80) return 'var(--success)';
        if (confidence >= 60) return 'var(--warning)';
        return 'var(--error)';
    };

    // Calculate totals
    const totalAds = adSets.reduce((sum, as) => sum + as.ads.length, 0);
    const totalBudget = adSets.reduce((sum, as) => sum + as.dailyBudget, 0);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>➕ Campaign Builder</h1>
                <p className={styles.subtitle}>Create Facebook campaigns with multiple ad sets and ads</p>
            </header>

            {/* Progress Steps */}
            <div className={styles.progressSteps}>
                <div className={`${styles.step} ${['content', 'recommendations', 'builder', 'creating', 'success'].includes(step) ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>1</span>
                    <span>Describe</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${['recommendations', 'builder', 'creating', 'success'].includes(step) ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>2</span>
                    <span>ML Recs</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${['builder', 'creating', 'success'].includes(step) ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>3</span>
                    <span>Build</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${['creating', 'success'].includes(step) ? styles.active : ''}`}>
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
                    <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
                </div>
            )}

            {/* ========== STEP 1: CONTENT INPUT ========== */}
            {step === 'content' && (
                <div className={styles.contentSection}>
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

                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                            {templates.length > 0 && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowLoadTemplateModal(true)}
                                >
                                    📂 Load Template
                                </button>
                            )}
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleAnalyzeContent}
                                disabled={isLoading || !contentDocument.trim()}
                                style={{ flex: 1 }}
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
                </div>
            )}

            {/* ========== STEP 2: ML RECOMMENDATIONS ========== */}
            {step === 'recommendations' && recommendations && (
                <div className={styles.recommendationsSection}>
                    <div className={`glass-card ${styles.overallCard}`}>
                        <div className={styles.overallHeader}>
                            <div>
                                <h2>🧠 ML Campaign Recommendations</h2>
                                <p>Based on your content analysis</p>
                            </div>
                            <div className={styles.confidenceScore} style={{ color: getConfidenceColor(recommendations.overallConfidence) }}>
                                <span className={styles.confidenceNumber}>{recommendations.overallConfidence}%</span>
                                <span className={styles.confidenceLabel}>Confidence</span>
                            </div>
                        </div>
                    </div>

                    {/* Compact recommendation grid */}
                    <div className={styles.recGrid}>
                        <div className="glass-card" style={{ padding: 'var(--spacing-md)' }}>
                            <h4>🎯 Objective</h4>
                            <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatObjective(recommendations.objective?.recommended || 'LEADS')}</p>
                        </div>
                        <div className="glass-card" style={{ padding: 'var(--spacing-md)' }}>
                            <h4>💰 Budget</h4>
                            <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>₱{recommendations.budget?.dailyBudget?.optimal || 500}/day</p>
                        </div>
                        <div className="glass-card" style={{ padding: 'var(--spacing-md)' }}>
                            <h4>👥 Audience</h4>
                            <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                Ages {recommendations.targeting?.ageRange?.min || 18}-{recommendations.targeting?.ageRange?.max || 45}
                            </p>
                        </div>
                    </div>

                    <div className={styles.recActions}>
                        <button className="btn btn-secondary" onClick={() => setStep('content')}>
                            ← Back
                        </button>
                        <button className="btn btn-primary btn-lg" onClick={() => setStep('builder')}>
                            Build Campaign →
                        </button>
                    </div>
                </div>
            )}

            {/* ========== STEP 3: CAMPAIGN BUILDER ========== */}
            {step === 'builder' && (
                <div className={styles.builderSection}>
                    {/* Campaign Settings Card */}
                    <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                            <h2 style={{ margin: 0 }}>📊 Campaign Settings</h2>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowTemplateModal(true)}>
                                    💾 Save Template
                                </button>
                                {templates.length > 0 && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowLoadTemplateModal(true)}>
                                        📂 Load
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
                            <div className={styles.formGroup}>
                                <label>Campaign Name</label>
                                <input
                                    type="text"
                                    value={campaignSettings.name}
                                    onChange={(e) => setCampaignSettings({ ...campaignSettings, name: e.target.value })}
                                    placeholder="Enter campaign name"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Objective</label>
                                <select
                                    value={campaignSettings.objective}
                                    onChange={(e) => setCampaignSettings({ ...campaignSettings, objective: e.target.value })}
                                >
                                    <option value="OUTCOME_AWARENESS">Awareness</option>
                                    <option value="OUTCOME_TRAFFIC">Traffic</option>
                                    <option value="OUTCOME_ENGAGEMENT">Engagement</option>
                                    <option value="OUTCOME_LEADS">Leads</option>
                                    <option value="OUTCOME_SALES">Sales</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Special Ad Category</label>
                                <select
                                    value={campaignSettings.specialAdCategory}
                                    onChange={(e) => setCampaignSettings({ ...campaignSettings, specialAdCategory: e.target.value })}
                                >
                                    <option value="">None</option>
                                    <option value="HOUSING">Housing</option>
                                    <option value="EMPLOYMENT">Employment</option>
                                    <option value="CREDIT">Credit</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Summary Bar */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-lg)',
                        padding: 'var(--spacing-md)',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: 'var(--spacing-lg)',
                        border: '1px solid var(--border-primary)'
                    }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ad Sets</span>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{adSets.length}</p>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Ads</span>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{totalAds}</p>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Daily Budget</span>
                            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>₱{totalBudget.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Ad Sets */}
                    <div className={styles.adSetsContainer}>
                        {adSets.map((adSet, asIndex) => (
                            <div key={adSet.id} className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                                {/* Ad Set Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: adSet.isExpanded ? 'var(--spacing-md)' : 0 }}>
                                    <button
                                        onClick={() => toggleAdSetExpand(adSet.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                            style={{ transform: adSet.isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-muted)' }}>#{asIndex + 1}</span>
                                    <input
                                        type="text"
                                        value={adSet.name}
                                        onChange={(e) => updateAdSet(adSet.id, { name: e.target.value })}
                                        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '1rem', fontWeight: 600 }}
                                    />
                                    <span className="badge badge-secondary">₱{adSet.dailyBudget}/day</span>
                                    <span className="badge badge-primary">{adSet.ads.length} ads</span>
                                    <button className="btn btn-ghost btn-sm" onClick={() => duplicateAdSet(adSet.id)} title="Duplicate">📋</button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => removeAdSet(adSet.id)} title="Delete">🗑️</button>
                                </div>

                                {/* Ad Set Body */}
                                {adSet.isExpanded && (
                                    <div style={{ paddingLeft: 'var(--spacing-lg)', borderLeft: '2px solid var(--border-primary)' }}>
                                        {/* Targeting Row */}
                                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
                                            <div className={styles.formGroup} style={{ flex: '1 1 100px' }}>
                                                <label style={{ fontSize: '0.75rem' }}>Budget</label>
                                                <input
                                                    type="number"
                                                    value={adSet.dailyBudget}
                                                    onChange={(e) => updateAdSet(adSet.id, { dailyBudget: parseInt(e.target.value) || 0 })}
                                                    min={200}
                                                />
                                            </div>
                                            <div className={styles.formGroup} style={{ flex: '1 1 150px' }}>
                                                <label style={{ fontSize: '0.75rem' }}>Ages</label>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        value={adSet.targeting.ageMin}
                                                        onChange={(e) => updateAdSet(adSet.id, {
                                                            targeting: { ...adSet.targeting, ageMin: parseInt(e.target.value) || 18 }
                                                        })}
                                                        min={18} max={65}
                                                        style={{ width: 60 }}
                                                    />
                                                    <span>-</span>
                                                    <input
                                                        type="number"
                                                        value={adSet.targeting.ageMax}
                                                        onChange={(e) => updateAdSet(adSet.id, {
                                                            targeting: { ...adSet.targeting, ageMax: parseInt(e.target.value) || 65 }
                                                        })}
                                                        min={18} max={65}
                                                        style={{ width: 60 }}
                                                    />
                                                </div>
                                            </div>
                                            <div className={styles.formGroup} style={{ flex: '1 1 100px' }}>
                                                <label style={{ fontSize: '0.75rem' }}>Gender</label>
                                                <select
                                                    value={adSet.targeting.gender}
                                                    onChange={(e) => updateAdSet(adSet.id, {
                                                        targeting: { ...adSet.targeting, gender: e.target.value as 'all' | 'male' | 'female' }
                                                    })}
                                                >
                                                    <option value="all">All</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Ads */}
                                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                                            <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)' }}>Ads</h4>
                                            {adSet.ads.map((ad, adIndex) => (
                                                <div key={ad.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-sm)',
                                                    padding: 'var(--spacing-sm)',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    marginBottom: 'var(--spacing-xs)'
                                                }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{adIndex + 1}</span>

                                                    {/* Media preview thumbnail */}
                                                    <div style={{
                                                        width: 40, height: 40,
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {ad.mediaPreview ? (
                                                            ad.mediaType === 'video' ? (
                                                                <video src={ad.mediaPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <img src={ad.mediaPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            )
                                                        ) : (
                                                            <span style={{ fontSize: '1.25rem' }}>{ad.mediaType === 'video' ? '🎬' : '🖼️'}</span>
                                                        )}
                                                    </div>

                                                    <input
                                                        type="text"
                                                        value={ad.name}
                                                        onChange={(e) => updateAd(adSet.id, ad.id, { name: e.target.value })}
                                                        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '0.875rem' }}
                                                        placeholder="Ad name"
                                                    />

                                                    <input
                                                        type="file"
                                                        accept="video/*,image/*"
                                                        onChange={(e) => e.target.files?.[0] && handleAdMediaUpload(adSet.id, ad.id, e.target.files[0])}
                                                        style={{ display: 'none' }}
                                                        id={`ad-media-${ad.id}`}
                                                    />
                                                    <label htmlFor={`ad-media-${ad.id}`} className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                                        📷
                                                    </label>

                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingAdId({ adSetId: adSet.id, adId: ad.id })}>
                                                        ✏️
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => duplicateAd(adSet.id, ad.id)}>📋</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => removeAd(adSet.id, ad.id)}>🗑️</button>
                                                </div>
                                            ))}

                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => addAd(adSet.id)}
                                                style={{ marginTop: 'var(--spacing-xs)' }}
                                            >
                                                ➕ Add Ad
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        <button className="btn btn-secondary" onClick={addAdSet} style={{ width: '100%' }}>
                            ➕ Add Ad Set
                        </button>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)' }}>
                        <button className="btn btn-secondary" onClick={() => setStep('recommendations')}>
                            ← Back
                        </button>
                        <label className={styles.checkbox} style={{ marginLeft: 'auto' }}>
                            <input
                                type="checkbox"
                                checked={campaignSettings.launchImmediately}
                                onChange={(e) => setCampaignSettings({ ...campaignSettings, launchImmediately: e.target.checked })}
                            />
                            <span>Launch immediately</span>
                        </label>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleCreateCampaign}
                            disabled={!campaignSettings.name || adSets.length === 0 || totalAds === 0}
                        >
                            🚀 Create Campaign
                        </button>
                    </div>
                </div>
            )}

            {/* ========== STEP 4: CREATING ========== */}
            {step === 'creating' && (
                <div className={styles.creatingSection}>
                    <div className={`glass-card ${styles.creatingCard}`}>
                        <div className={styles.spinner}></div>
                        <h2>Creating Your Campaign...</h2>
                        <p>Setting up {adSets.length} ad set{adSets.length > 1 ? 's' : ''} with {totalAds} ad{totalAds > 1 ? 's' : ''}</p>
                    </div>
                </div>
            )}

            {/* ========== STEP 5: SUCCESS ========== */}
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
                                <span>Ad Sets Created:</span>
                                <code>{creationResult.adsets.length}</code>
                            </div>
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
                                    setAdSets([createDefaultAdSet()]);
                                    setCreationResult(null);
                                }}
                            >
                                Create Another
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== MODALS ========== */}

            {/* Save Template Modal */}
            {showTemplateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowTemplateModal(false)}>
                    <div className={`glass-card ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
                        <h3>💾 Save as Template</h3>
                        <div className={styles.formGroup}>
                            <label>Template Name</label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="e.g., Lead Gen - Beauty"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Description (optional)</label>
                            <textarea
                                value={templateDescription}
                                onChange={(e) => setTemplateDescription(e.target.value)}
                                placeholder="What is this template for?"
                                rows={3}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveAsTemplate}>Save Template</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Load Template Modal */}
            {showLoadTemplateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowLoadTemplateModal(false)}>
                    <div className={`glass-card ${styles.modal}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <h3>📂 Load Template</h3>
                        {templates.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No templates saved yet.</p>
                        ) : (
                            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {templates.map((t) => (
                                    <div key={t.id} style={{
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        marginBottom: 'var(--spacing-sm)',
                                        cursor: 'pointer'
                                    }}
                                        onClick={() => loadTemplate(t)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong>{t.name}</strong>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteTemplate(t.id);
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        {t.description && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{t.description}</p>}
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                            {t.adSets.length} ad sets • Created {new Date(t.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                            <button className="btn btn-ghost" onClick={() => setShowLoadTemplateModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Ad Modal */}
            {editingAdId && (() => {
                const adSet = adSets.find(as => as.id === editingAdId.adSetId);
                const ad = adSet?.ads.find(a => a.id === editingAdId.adId);
                if (!ad) return null;

                return (
                    <div className={styles.modalOverlay} onClick={() => setEditingAdId(null)}>
                        <div className={`glass-card ${styles.modal}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                            <h3>✏️ Edit Ad: {ad.name}</h3>

                            <div className={styles.formGroup}>
                                <label>Primary Text</label>
                                <textarea
                                    value={ad.primaryText}
                                    onChange={(e) => updateAd(editingAdId.adSetId, editingAdId.adId, { primaryText: e.target.value })}
                                    placeholder="Main ad copy..."
                                    rows={3}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div className={styles.formGroup}>
                                    <label>Headline</label>
                                    <input
                                        type="text"
                                        value={ad.headline}
                                        onChange={(e) => updateAd(editingAdId.adSetId, editingAdId.adId, { headline: e.target.value })}
                                        placeholder="Attention-grabbing headline"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Call to Action</label>
                                    <select
                                        value={ad.callToAction}
                                        onChange={(e) => updateAd(editingAdId.adSetId, editingAdId.adId, { callToAction: e.target.value })}
                                    >
                                        {CTA_OPTIONS.map(cta => (
                                            <option key={cta} value={cta}>{cta.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={ad.description}
                                    onChange={(e) => updateAd(editingAdId.adSetId, editingAdId.adId, { description: e.target.value })}
                                    placeholder="Brief description"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Website URL</label>
                                <input
                                    type="url"
                                    value={ad.websiteUrl}
                                    onChange={(e) => updateAd(editingAdId.adSetId, editingAdId.adId, { websiteUrl: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                                <button className="btn btn-primary" onClick={() => setEditingAdId(null)}>Done</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
