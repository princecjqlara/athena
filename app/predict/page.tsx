'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import {
    HookType,
    EditingStyle,
    ContentCategory,
    ColorScheme,
    MusicType,
    Platform,
    DayOfWeek,
    TimeOfDay,
    PredictionResult,
    PredictionFactor,
    ExtractedAdData,
} from '@/types';
import {
    predictWithML,
    RiskTier,
    RiskAssessment,
    PotentialFailure,
    getRiskTierDisplay,
} from '@/lib/ml';

// Ad interface for existing ads from localStorage
interface Ad {
    id: string;
    name?: string;
    extractedContent?: {
        title?: string;
        platform?: string;
        hookType?: string;
        contentCategory?: string;
        mediaType?: string;
    };
    categories?: string[];
    traits?: string[];
    thumbnail?: string;
    thumbnailUrl?: string;
    platform?: string;
    hook_type?: string;
    mediaType?: 'video' | 'photo' | string;
    importedFromFacebook?: boolean;
}

// Source mode type
type SourceMode = 'configure' | 'pick' | 'upload';

const QUICK_OPTIONS = {
    hook_types: [
        { value: 'curiosity', label: '🤔 Curiosity', score: 90 },
        { value: 'shock', label: '😱 Shock', score: 85 },
        { value: 'before_after', label: '⚡ Before/After', score: 85 },
        { value: 'question', label: '❓ Question', score: 80 },
        { value: 'story', label: '📖 Story', score: 75 },
    ],
    editing_styles: [
        { value: 'raw_authentic', label: '📱 Raw/Authentic', score: 90 },
        { value: 'fast_cuts', label: '⚡ Fast Cuts', score: 85 },
        { value: 'dynamic', label: '💫 Dynamic', score: 80 },
        { value: 'cinematic', label: '🎬 Cinematic', score: 70 },
    ],
    content_categories: [
        { value: 'ugc', label: '📱 UGC', score: 90 },
        { value: 'testimonial', label: '💬 Testimonial', score: 85 },
        { value: 'lifestyle', label: '🌟 Lifestyle', score: 80 },
        { value: 'product_demo', label: '🎬 Product Demo', score: 75 },
    ],
    platforms: [
        { value: 'tiktok', label: '🎵 TikTok', score: 90 },
        { value: 'instagram', label: '📸 Instagram', score: 85 },
        { value: 'youtube', label: '▶️ YouTube', score: 75 },
        { value: 'facebook', label: '📘 Facebook', score: 70 },
    ],
};

export default function PredictPage() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);
    const [dataPoints, setDataPoints] = useState(0);
    const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);

    // Source mode state
    const [sourceMode, setSourceMode] = useState<SourceMode>('configure');

    // Existing ads for pick mode
    const [existingAds, setExistingAds] = useState<Ad[]>([]);
    const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
    const [adSearchQuery, setAdSearchQuery] = useState('');

    // Upload mode state
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ad copy section (optional)
    const [primaryText, setPrimaryText] = useState('');
    const [headline, setHeadline] = useState('');

    const [inputs, setInputs] = useState({
        hook_type: '' as HookType | '',
        editing_style: '' as EditingStyle | '',
        content_category: '' as ContentCategory | '',
        color_scheme: 'vibrant' as ColorScheme,
        music_type: 'trending' as MusicType,
        text_overlays: true,
        subtitles: true,
        ugc_style: true,
        influencer_used: false,
        voiceover: true,
        number_of_actors: 1,
        platform: '' as Platform | '',
        launch_day: 'thursday' as DayOfWeek,
        launch_time: 'evening' as TimeOfDay,
    });

    // Load existing ads from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('ads');
            if (stored) {
                const parsed = JSON.parse(stored);
                setExistingAds(parsed);
            }
        } catch (e) {
            console.error('Error loading ads:', e);
        }
    }, []);

    // Helper to get ad name
    const getAdName = (ad: Ad): string => {
        return ad.extractedContent?.title || ad.name || 'Untitled Ad';
    };

    // Handle selecting an existing ad
    const handleSelectAd = (ad: Ad) => {
        setSelectedAd(ad);

        // Auto-populate inputs from ad data
        const hookType = ad.extractedContent?.hookType || ad.hook_type || '';
        const platform = ad.extractedContent?.platform || ad.platform || '';
        const contentCategory = ad.extractedContent?.contentCategory || ad.categories?.[0] || '';

        // Map to valid enum values
        const hookTypeMap: Record<string, HookType> = {
            'curiosity': 'curiosity',
            'shock': 'shock',
            'before_after': 'before_after',
            'question': 'question',
            'story': 'story',
            'transformation': 'before_after',
            'testimonial': 'story',
        };

        const platformMap: Record<string, Platform> = {
            'tiktok': 'tiktok',
            'instagram': 'instagram',
            'facebook': 'facebook',
            'youtube': 'youtube',
        };

        const categoryMap: Record<string, ContentCategory> = {
            'ugc': 'ugc',
            'testimonial': 'testimonial',
            'lifestyle': 'lifestyle',
            'product_demo': 'product_demo',
            'product demo': 'product_demo',
            'educational': 'lifestyle',
        };

        setInputs(prev => ({
            ...prev,
            hook_type: hookTypeMap[hookType.toLowerCase()] || prev.hook_type,
            platform: platformMap[platform.toLowerCase()] || prev.platform,
            content_category: categoryMap[contentCategory.toLowerCase()] || prev.content_category,
            // Infer features from traits if available
            ugc_style: ad.traits?.some(t => t.toLowerCase().includes('ugc')) || ad.categories?.includes('UGC') || prev.ugc_style,
            subtitles: ad.traits?.some(t => t.toLowerCase().includes('subtitle') || t.toLowerCase().includes('caption')) ?? prev.subtitles,
            voiceover: ad.traits?.some(t => t.toLowerCase().includes('voiceover')) ?? prev.voiceover,
            text_overlays: ad.traits?.some(t => t.toLowerCase().includes('text') || t.toLowerCase().includes('overlay')) ?? prev.text_overlays,
        }));
    };

    // Handle file upload
    const handleFileUpload = (file: File) => {
        setUploadedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                handleFileUpload(file);
            }
        }
    };

    const handlePredict = async () => {
        if (!inputs.hook_type || !inputs.editing_style || !inputs.content_category || !inputs.platform) {
            alert('Please select all required options');
            return;
        }

        setIsAnalyzing(true);

        try {
            // Build ExtractedAdData for ML system
            const adData: Partial<ExtractedAdData> = {
                hookType: inputs.hook_type as HookType,
                editingStyle: inputs.editing_style as EditingStyle,
                contentCategory: inputs.content_category as ContentCategory,
                colorScheme: inputs.color_scheme,
                musicType: inputs.music_type,
                platform: inputs.platform as Platform,
                hasSubtitles: inputs.subtitles,
                hasTextOverlays: inputs.text_overlays,
                isUGCStyle: inputs.ugc_style,
                hasVoiceover: inputs.voiceover,
                numberOfActors: inputs.number_of_actors,
                mediaType: 'video',
                aspectRatio: '9:16',
                placement: 'feed',
                customTraits: [],
                extractionConfidence: 100,
            };

            // Call ML system for risk assessment
            const mlResult = await predictWithML(adData as ExtractedAdData);
            setRiskAssessment(mlResult.riskAssessment);
            setDataPoints(mlResult.baselineStats.sampleSize);

            // Build enhanced prediction request with ad copy
            const predictionData: Record<string, unknown> = {
                hookType: inputs.hook_type,
                contentCategory: inputs.content_category,
                editingStyle: inputs.editing_style,
                platform: inputs.platform,
                features: {
                    hasSubtitles: inputs.subtitles,
                    hasTextOverlays: inputs.text_overlays,
                    isUGC: inputs.ugc_style,
                    hasVoiceover: inputs.voiceover,
                },
            };

            // Include ad copy if provided
            if (primaryText.trim() || headline.trim()) {
                predictionData.adCopy = {
                    primaryText: primaryText.trim(),
                    headline: headline.trim(),
                };
            }

            // Include source info
            if (sourceMode === 'pick' && selectedAd) {
                predictionData.sourceAdId = selectedAd.id;
                predictionData.sourceAdName = getAdName(selectedAd);
            }

            // Call the AI API for GPT-powered prediction
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'predict',
                    data: predictionData,
                }),
            });

            const result = await response.json();

            if (result.success && result.data) {
                // Use AI prediction
                const aiPrediction = result.data;
                const mockPrediction: PredictionResult = {
                    success_probability: aiPrediction.successProbability || mlResult.globalScore,
                    confidence: mlResult.confidence, // Use ML confidence
                    top_factors: (aiPrediction.keyFactors || []).map((f: { name: string; impact: string; weight: number }) => ({
                        factor: f.name,
                        impact: f.impact as 'positive' | 'negative' | 'neutral',
                        weight: f.weight,
                    })),
                    recommendations: aiPrediction.recommendations || [],
                    similar_videos: [],
                };
                setPrediction(mockPrediction);
            } else {
                // Use ML prediction as fallback
                const fallbackPrediction: PredictionResult = {
                    success_probability: mlResult.globalScore,
                    confidence: mlResult.confidence,
                    top_factors: [
                        { factor: 'UGC Style', impact: inputs.ugc_style ? 'positive' : 'negative', weight: inputs.ugc_style ? 0.95 : 0.4 },
                        { factor: 'Hook Type', impact: mlResult.globalScore > 70 ? 'positive' : 'neutral', weight: 0.85 },
                        { factor: 'Subtitles', impact: inputs.subtitles ? 'positive' : 'negative', weight: inputs.subtitles ? 0.9 : 0.4 },
                        { factor: 'Platform Choice', impact: inputs.platform === 'tiktok' ? 'positive' : 'neutral', weight: 0.75 },
                    ],
                    recommendations: [],
                    similar_videos: [],
                };

                // Add copy-related factors if provided
                if (primaryText.trim()) {
                    fallbackPrediction.top_factors.push({
                        factor: 'Ad Copy Provided',
                        impact: 'positive',
                        weight: 0.7,
                    });
                }

                // Add recommendations based on risk assessment
                if (mlResult.riskAssessment.potentialFailures.length > 0) {
                    mlResult.riskAssessment.potentialFailures.forEach(f => {
                        fallbackPrediction.recommendations.push(f.mitigation);
                    });
                }

                if (!inputs.ugc_style) fallbackPrediction.recommendations.push('Consider using UGC-style content for +15% engagement');
                if (!inputs.subtitles) fallbackPrediction.recommendations.push('Add subtitles/captions for +12% watch time');
                if (!primaryText.trim()) fallbackPrediction.recommendations.push('Add primary text to improve ad relevance and targeting');

                setPrediction(fallbackPrediction);
            }
        } catch (error) {
            console.error('Prediction error:', error);
            // Set a basic fallback prediction on error
            setPrediction({
                success_probability: 65,
                confidence: 40,
                top_factors: [{ factor: 'Analysis Error', impact: 'neutral', weight: 0.5 }],
                recommendations: ['Unable to get AI prediction. Please try again.'],
                similar_videos: [],
            });
            setRiskAssessment(null);
        }

        setIsAnalyzing(false);
    };

    const selectOption = (category: string, value: string) => {
        setInputs(prev => ({ ...prev, [category]: value }));
    };

    const resetPrediction = () => {
        setPrediction(null);
        setRiskAssessment(null);
        setSelectedAd(null);
        setUploadedFile(null);
        setUploadPreview(null);
        setPrimaryText('');
        setHeadline('');
        setInputs({
            hook_type: '',
            editing_style: '',
            content_category: '',
            color_scheme: 'vibrant',
            music_type: 'trending',
            text_overlays: true,
            subtitles: true,
            ugc_style: true,
            influencer_used: false,
            voiceover: true,
            number_of_actors: 1,
            platform: '',
            launch_day: 'thursday',
            launch_time: 'evening',
        });
    };

    // Filter ads based on search
    const filteredAds = existingAds.filter(ad =>
        getAdName(ad).toLowerCase().includes(adSearchQuery.toLowerCase())
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>🤖 GPT-Powered Predictions</h1>
                    <p className={styles.subtitle}>Get AI-powered success predictions before creating your next ad</p>
                </div>
                <div className={styles.modelInfo}>
                    <div className={styles.modelStatus}>
                        <div className={styles.statusDot}></div>
                        <span>NVIDIA AI Active</span>
                    </div>
                    <span className={styles.dataPoints}>{dataPoints} data points</span>
                </div>
            </header>

            {!prediction ? (
                <div className={styles.inputSection}>
                    {/* Source Selection Tabs */}
                    <div className={styles.sourceTabs}>
                        <button
                            className={`${styles.sourceTab} ${sourceMode === 'configure' ? styles.active : ''}`}
                            onClick={() => setSourceMode('configure')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3h7a2 2 0 012 2v14a2 2 0 01-2 2h-7m0-18H5a2 2 0 00-2 2v14a2 2 0 002 2h7m0-18v18" />
                            </svg>
                            Configure Manually
                        </button>
                        <button
                            className={`${styles.sourceTab} ${sourceMode === 'pick' ? styles.active : ''}`}
                            onClick={() => setSourceMode('pick')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            Pick Existing Ad
                        </button>
                        <button
                            className={`${styles.sourceTab} ${sourceMode === 'upload' ? styles.active : ''}`}
                            onClick={() => setSourceMode('upload')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload New Ad
                        </button>
                    </div>

                    {/* Pick Existing Ad Mode */}
                    {sourceMode === 'pick' && (
                        <div className={`glass-card ${styles.pickSection}`}>
                            <h3>Select an Ad from Your Library</h3>
                            <p className={styles.muted}>Choose an existing ad to predict its performance with current traits</p>

                            <div className={styles.adSearchBox}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search your ads..."
                                    value={adSearchQuery}
                                    onChange={(e) => setAdSearchQuery(e.target.value)}
                                />
                            </div>

                            {filteredAds.length === 0 ? (
                                <div className={styles.emptyAds}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                        <polygon points="23 7 16 12 23 17 23 7" />
                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                    </svg>
                                    <p>No ads found. <a href="/upload">Upload an ad</a> or <a href="/import">import from Facebook</a>.</p>
                                </div>
                            ) : (
                                <div className={styles.adGrid}>
                                    {filteredAds.slice(0, 12).map(ad => (
                                        <div
                                            key={ad.id}
                                            className={`${styles.adCard} ${selectedAd?.id === ad.id ? styles.selected : ''}`}
                                            onClick={() => handleSelectAd(ad)}
                                        >
                                            <div className={styles.adThumbnail}>
                                                {ad.thumbnailUrl ? (
                                                    <img src={ad.thumbnailUrl} alt={getAdName(ad)} />
                                                ) : (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className={styles.adInfo}>
                                                <span className={styles.adName}>{getAdName(ad)}</span>
                                                <span className={styles.adMeta}>
                                                    {ad.importedFromFacebook ? '📊 Facebook' : '📤 Uploaded'}
                                                </span>
                                            </div>
                                            {selectedAd?.id === ad.id && (
                                                <div className={styles.selectedCheck}>✓</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedAd && (
                                <div className={styles.selectedAdPreview}>
                                    <h4>Selected: {getAdName(selectedAd)}</h4>
                                    <p className={styles.muted}>Traits have been auto-populated. You can adjust them below.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload New Ad Mode */}
                    {sourceMode === 'upload' && (
                        <div className={`glass-card ${styles.uploadSection}`}>
                            <h3>Upload Ad Creative</h3>
                            <p className={styles.muted}>Upload an image or video to analyze its traits</p>

                            <div
                                className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${uploadPreview ? styles.hasFile : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                    style={{ display: 'none' }}
                                />

                                {uploadPreview ? (
                                    <div className={styles.uploadPreview}>
                                        {uploadedFile?.type.startsWith('video/') ? (
                                            <video src={uploadPreview} controls style={{ maxHeight: '200px', borderRadius: '8px' }} />
                                        ) : (
                                            <img src={uploadPreview} alt="Preview" style={{ maxHeight: '200px', borderRadius: '8px' }} />
                                        )}
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUploadedFile(null);
                                                setUploadPreview(null);
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <p>Drag & drop your image or video</p>
                                        <span className={styles.muted}>or click to browse</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Ad Copy Section (Optional) */}
                    <div className={`glass-card ${styles.adCopySection}`}>
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Ad Copy <span className={styles.optional}>(Optional)</span>
                        </h3>
                        <p className={styles.muted}>Add your ad text for more accurate predictions based on messaging analysis</p>

                        <div className={styles.adCopyInputs}>
                            <div className="form-group">
                                <label className="form-label">Headline</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Stop Scrolling! This Will Change Your Life..."
                                    value={headline}
                                    onChange={(e) => setHeadline(e.target.value)}
                                    maxLength={150}
                                />
                                <span className={styles.charCount}>{headline.length}/150</span>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Primary Text</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Enter your ad's primary text/body copy here. The more context you provide, the better the prediction accuracy."
                                    value={primaryText}
                                    onChange={(e) => setPrimaryText(e.target.value)}
                                    rows={4}
                                    maxLength={500}
                                />
                                <span className={styles.charCount}>{primaryText.length}/500</span>
                            </div>
                        </div>
                    </div>

                    {/* Configuration Section */}
                    <div className={`glass-card ${styles.inputCard}`}>
                        <h2>Configure Ad Traits</h2>
                        <p>Select the characteristics of your ad to get a prediction</p>

                        {/* Hook Type */}
                        <div className={styles.optionSection}>
                            <h3>Hook Type <span className={styles.required}>*</span></h3>
                            <div className={styles.optionGrid}>
                                {QUICK_OPTIONS.hook_types.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`${styles.optionButton} ${inputs.hook_type === option.value ? styles.selected : ''}`}
                                        onClick={() => selectOption('hook_type', option.value)}
                                    >
                                        <span className={styles.optionLabel}>{option.label}</span>
                                        <span className={styles.optionScore}>{option.score}%</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Editing Style */}
                        <div className={styles.optionSection}>
                            <h3>Editing Style <span className={styles.required}>*</span></h3>
                            <div className={styles.optionGrid}>
                                {QUICK_OPTIONS.editing_styles.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`${styles.optionButton} ${inputs.editing_style === option.value ? styles.selected : ''}`}
                                        onClick={() => selectOption('editing_style', option.value)}
                                    >
                                        <span className={styles.optionLabel}>{option.label}</span>
                                        <span className={styles.optionScore}>{option.score}%</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Category */}
                        <div className={styles.optionSection}>
                            <h3>Content Category <span className={styles.required}>*</span></h3>
                            <div className={styles.optionGrid}>
                                {QUICK_OPTIONS.content_categories.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`${styles.optionButton} ${inputs.content_category === option.value ? styles.selected : ''}`}
                                        onClick={() => selectOption('content_category', option.value)}
                                    >
                                        <span className={styles.optionLabel}>{option.label}</span>
                                        <span className={styles.optionScore}>{option.score}%</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Platform */}
                        <div className={styles.optionSection}>
                            <h3>Target Platform <span className={styles.required}>*</span></h3>
                            <div className={styles.optionGrid}>
                                {QUICK_OPTIONS.platforms.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`${styles.optionButton} ${inputs.platform === option.value ? styles.selected : ''}`}
                                        onClick={() => selectOption('platform', option.value)}
                                    >
                                        <span className={styles.optionLabel}>{option.label}</span>
                                        <span className={styles.optionScore}>{option.score}%</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Video Features */}
                        <div className={styles.optionSection}>
                            <h3>Video Features</h3>
                            <div className={styles.toggleGrid}>
                                <label className={styles.toggleOption}>
                                    <span>🎬 UGC Style</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={inputs.ugc_style}
                                            onChange={(e) => setInputs(prev => ({ ...prev, ugc_style: e.target.checked }))}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </label>

                                <label className={styles.toggleOption}>
                                    <span>📝 Subtitles</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={inputs.subtitles}
                                            onChange={(e) => setInputs(prev => ({ ...prev, subtitles: e.target.checked }))}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </label>

                                <label className={styles.toggleOption}>
                                    <span>💬 Text Overlays</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={inputs.text_overlays}
                                            onChange={(e) => setInputs(prev => ({ ...prev, text_overlays: e.target.checked }))}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </label>

                                <label className={styles.toggleOption}>
                                    <span>🎙️ Voiceover</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={inputs.voiceover}
                                            onChange={(e) => setInputs(prev => ({ ...prev, voiceover: e.target.checked }))}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </label>
                            </div>
                        </div>

                        {/* Launch Settings */}
                        <div className={styles.optionSection}>
                            <h3>Launch Settings</h3>
                            <div className={styles.launchGrid}>
                                <div className="form-group">
                                    <label className="form-label">Music Type</label>
                                    <select
                                        className="form-select"
                                        value={inputs.music_type}
                                        onChange={(e) => setInputs(prev => ({ ...prev, music_type: e.target.value as MusicType }))}
                                    >
                                        <option value="trending">📈 Trending</option>
                                        <option value="upbeat">🎉 Upbeat</option>
                                        <option value="emotional">❤️ Emotional</option>
                                        <option value="voiceover_only">🎙️ Voiceover Only</option>
                                        <option value="original">🎵 Original</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Launch Time</label>
                                    <select
                                        className="form-select"
                                        value={inputs.launch_time}
                                        onChange={(e) => setInputs(prev => ({ ...prev, launch_time: e.target.value as TimeOfDay }))}
                                    >
                                        <option value="early_morning">🌅 Early Morning (5-8 AM)</option>
                                        <option value="morning">☀️ Morning (8 AM-12 PM)</option>
                                        <option value="afternoon">🌤️ Afternoon (12-5 PM)</option>
                                        <option value="evening">🌆 Evening (5-9 PM)</option>
                                        <option value="night">🌙 Night (9 PM-5 AM)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handlePredict}
                            disabled={isAnalyzing}
                            style={{ width: '100%', marginTop: 'var(--spacing-lg)' }}
                        >
                            {isAnalyzing ? (
                                <>
                                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                                    </svg>
                                    Analyzing with AI...
                                </>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00-1.32 4.24 3 3 0 00.34 5.58 2.5 2.5 0 002.96 3.08A2.5 2.5 0 0012 19.5" />
                                        <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0112 19.5" />
                                    </svg>
                                    Get AI Prediction
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles.resultSection}>
                    {/* Main Prediction Card */}
                    <div className={`glass-card ${styles.predictionCard}`}>
                        <div className={styles.scoreSection}>
                            <div className={styles.scoreCircle}>
                                <svg viewBox="0 0 100 100" className={styles.scoreRing}>
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        stroke="var(--bg-tertiary)"
                                        strokeWidth="8"
                                    />
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        stroke="url(#scoreGradient)"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeDasharray={`${prediction.success_probability * 2.83} 283`}
                                        transform="rotate(-90 50 50)"
                                    />
                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="50%" stopColor="#a855f7" />
                                            <stop offset="100%" stopColor="#ec4899" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className={styles.scoreValue}>
                                    <span className={styles.scoreNumber}>{prediction.success_probability}</span>
                                    <span className={styles.scorePercent}>%</span>
                                </div>
                            </div>
                            <div className={styles.scoreInfo}>
                                <h2>Success Probability</h2>
                                <p>
                                    {prediction.success_probability >= 80
                                        ? '🎉 Excellent! This ad has high potential for success.'
                                        : prediction.success_probability >= 60
                                            ? '👍 Good! This ad should perform well with some tweaks.'
                                            : prediction.success_probability >= 40
                                                ? '⚠️ Average. Consider implementing the recommendations.'
                                                : '❌ Low potential. Significant changes recommended.'}
                                </p>
                                <div className={styles.badgeRow}>
                                    <div className={styles.confidenceBadge}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        {prediction.confidence}% confidence ({dataPoints} data points)
                                    </div>
                                    {riskAssessment && (
                                        <div
                                            className={`${styles.riskBadge} ${styles[`risk${riskAssessment.tierInfo.color.charAt(0).toUpperCase() + riskAssessment.tierInfo.color.slice(1)}`]}`}
                                        >
                                            {riskAssessment.tier === 'proven_pattern' && '✅'}
                                            {riskAssessment.tier === 'likely_success' && '👍'}
                                            {riskAssessment.tier === 'moderate_risk' && '⚠️'}
                                            {riskAssessment.tier === 'high_variance' && '⚡'}
                                            {riskAssessment.tier === 'unproven_territory' && '🔬'}
                                            {' '}{riskAssessment.tierInfo.label}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Factors Panel */}
                    <div className={styles.sidePanels}>
                        <div className={`glass-card ${styles.factorsCard}`}>
                            <h3>Key Success Factors</h3>
                            <div className={styles.factorsList}>
                                {prediction.top_factors.map((factor, index) => (
                                    <div key={index} className={styles.factorItem}>
                                        <div className={`${styles.factorIndicator} ${styles[factor.impact]}`}>
                                            {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
                                        </div>
                                        <span className={styles.factorName}>{factor.factor}</span>
                                        <div className={styles.factorBar}>
                                            <div
                                                className={`${styles.factorFill} ${styles[factor.impact]}`}
                                                style={{ width: `${factor.weight * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`glass-card ${styles.recommendationsCard}`}>
                            <h3>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                Recommendations
                            </h3>
                            {prediction.recommendations.length > 0 ? (
                                <ul className={styles.recommendationsList}>
                                    {prediction.recommendations.map((rec, index) => (
                                        <li key={index}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 5v14M5 12h14" />
                                            </svg>
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.noRecommendations}>
                                    ✨ Great job! Your configuration is optimized.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Potential Failures (Why This May Fail) */}
                    {riskAssessment && riskAssessment.potentialFailures.length > 0 && (
                        <div className={`glass-card ${styles.failuresCard}`}>
                            <h3>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                Why This May Fail
                            </h3>
                            <div className={styles.failuresList}>
                                {riskAssessment.potentialFailures.slice(0, 4).map((failure, index) => (
                                    <div key={index} className={`${styles.failureItem} ${styles[`severity${failure.severity.charAt(0).toUpperCase() + failure.severity.slice(1)}`]}`}>
                                        <div className={styles.failureHeader}>
                                            <span className={styles.failureReason}>{failure.reason}</span>
                                            <span className={styles.failureProbability}>{failure.probability}% likely</span>
                                        </div>
                                        <div className={styles.failureMitigation}>
                                            💡 {failure.mitigation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Actions */}
                    <div className={styles.resultActions}>
                        <button className="btn btn-secondary" onClick={resetPrediction}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="1 4 1 10 7 10" />
                                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                            </svg>
                            Try Different Settings
                        </button>
                        <a href="/upload" className="btn btn-primary">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload This Video
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
