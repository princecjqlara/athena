'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './page.module.css';
import { ExtractedAdData } from '@/types';
import { DEFAULT_CATEGORIES, ExtendedAdInsights } from '@/types/extended-ad';

// Prediction result type
interface PredictionResult {
    globalScore: number;
    segmentScores: { segmentId: string; segmentName: string; score: number }[];
    bestSegment: { segmentId: string; segmentName: string; score: number } | null;
    confidence: number;
}

export default function UploadPage() {
    const [step, setStep] = useState<'upload' | 'document' | 'preview' | 'saved'>('upload');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Media state
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'video' | 'photo' | null>(null);

    // Document state
    const [contentDocument, setContentDocument] = useState('');

    // Extracted data state
    const [extractedData, setExtractedData] = useState<ExtractedAdData | null>(null);

    // Prediction state - calculated when ad is extracted
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);

    // Ad ID state - for linking to Facebook ad and auto-fetching results
    const [adId, setAdId] = useState('');
    const [autoSyncResults, setAutoSyncResults] = useState(false);
    const [adIdVerified, setAdIdVerified] = useState<boolean | null>(null);

    // Ad Copy state - Primary Text & Headline
    const [primaryText, setPrimaryText] = useState('');
    const [headline, setHeadline] = useState('');

    // Custom Categories state
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
    const [scriptChunks, setScriptChunks] = useState<Array<{ type: string, content: string }>>([]);

    // Extended Facebook Insights
    const [extendedInsights, setExtendedInsights] = useState<ExtendedAdInsights | null>(null);
    const [fetchingInsights, setFetchingInsights] = useState(false);

    const [adInsights, setAdInsights] = useState<{
        impressions?: number;
        clicks?: number;
        ctr?: number;
        conversions?: number;
        costPerResult?: number;
        adName?: string;
        adFormat?: string;
        primaryText?: string;
        headline?: string;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
        setStep('document');
    };

    // Parse document with AI
    const handleParseDocument = async () => {
        if (!contentDocument.trim()) {
            setError('Please describe your ad content');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse-content',
                    data: { rawText: contentDocument }
                })
            });

            const result = await response.json();

            if (result.success && result.data) {
                // Override media type if detected from file
                const extracted = {
                    ...result.data,
                    mediaType: mediaType || result.data.mediaType
                };
                setExtractedData(extracted);
                await calculatePrediction(extracted);

                // Automatically save AI-suggested learned traits
                if (extracted.learnedTraitsToCreate && extracted.learnedTraitsToCreate.length > 0) {
                    console.log('[Upload] Saving AI-suggested learned traits:', extracted.learnedTraitsToCreate.length);
                    for (const traitToCreate of extracted.learnedTraitsToCreate) {
                        try {
                            await fetch('/api/ai/learned-traits', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    traitName: traitToCreate.traitName,
                                    traitCategory: traitToCreate.traitCategory,
                                    definition: traitToCreate.definition,
                                    addedBy: 'ai_extraction'
                                })
                            });
                        } catch (traitError) {
                            console.warn('[Upload] Failed to save learned trait:', traitToCreate.traitName, traitError);
                        }
                    }
                }

                setStep('preview');
            } else {
                // Use fallback extraction
                const fallbackData = await fallbackExtraction(contentDocument);
                fallbackData.mediaType = mediaType || fallbackData.mediaType;
                setExtractedData(fallbackData);
                setStep('preview');
            }
        } catch (err) {
            console.error('Parsing error:', err);
            const fallbackData = await fallbackExtraction(contentDocument);
            fallbackData.mediaType = mediaType || fallbackData.mediaType;
            setExtractedData(fallbackData);
            await calculatePrediction(fallbackData);
            setStep('preview');
        }

        setIsLoading(false);
    };

    // Calculate AI prediction for the ad
    const calculatePrediction = async (adData: ExtractedAdData) => {
        const predictionResult: PredictionResult = {
            globalScore: 50,
            segmentScores: [],
            bestSegment: null,
            confidence: 60
        };

        // Calculate score based on features
        let score = 50;

        // Positive factors
        if (adData.isUGCStyle) score += 15;
        if (adData.hasSubtitles) score += 10;
        if (adData.hookType === 'curiosity' || adData.hookType === 'shock') score += 10;
        if (adData.musicType === 'trending') score += 10;
        if (adData.hasVoiceover) score += 5;
        if (adData.platform === 'tiktok') score += 5;
        if (adData.editingStyle === 'fast_cuts') score += 5;

        // Pre-flight score bonus
        if (adData.preFlightScore) score = (score + adData.preFlightScore) / 2;

        // Clamp score
        score = Math.max(0, Math.min(100, Math.round(score)));
        predictionResult.globalScore = score;

        // Segment-specific scores
        predictionResult.segmentScores = [
            { segmentId: 'gen-z', segmentName: 'Gen Z', score: adData.isUGCStyle ? score + 15 : score },
            { segmentId: 'millennials', segmentName: 'Millennials', score: adData.hasVoiceover ? score + 10 : score - 5 },
            { segmentId: 'gen-z-male', segmentName: 'Gen Z Male', score: adData.editingStyle === 'fast_cuts' ? score + 20 : score },
            { segmentId: 'gen-z-female', segmentName: 'Gen Z Female', score: adData.isUGCStyle && adData.hookType === 'transformation' ? score + 25 : score + 5 },
        ].map(s => ({ ...s, score: Math.min(100, s.score) })).sort((a, b) => b.score - a.score);

        predictionResult.bestSegment = predictionResult.segmentScores[0];
        predictionResult.confidence = adData.extractionConfidence || 60;

        setPrediction(predictionResult);
    };

    // Fallback extraction
    const fallbackExtraction = async (text: string): Promise<ExtractedAdData> => {
        const lower = text.toLowerCase();
        return {
            title: 'New Ad',
            description: text.slice(0, 100),
            mediaType: lower.includes('photo') ? 'photo' : 'video',
            aspectRatio: lower.includes('1:1') ? '1:1' : lower.includes('16:9') ? '16:9' : '9:16',
            platform: lower.includes('tiktok') ? 'tiktok' : lower.includes('instagram') ? 'instagram' : 'other',
            placement: lower.includes('stories') ? 'stories' : lower.includes('reels') ? 'reels' : 'feed',
            hookType: lower.includes('curiosity') ? 'curiosity' : lower.includes('shock') ? 'shock' : 'other',
            contentCategory: lower.includes('ugc') ? 'ugc' : lower.includes('testimonial') ? 'testimonial' : 'other',
            editingStyle: lower.includes('fast') ? 'fast_cuts' : 'other',
            colorScheme: 'other',
            hasTextOverlays: lower.includes('text') || lower.includes('overlay'),
            hasSubtitles: lower.includes('subtitle') || lower.includes('caption'),
            musicType: lower.includes('trending') ? 'trending' : 'other',
            hasVoiceover: lower.includes('voiceover') || lower.includes('narration'),
            numberOfActors: 1,
            isUGCStyle: lower.includes('ugc'),
            customTraits: [],
            extractionConfidence: 30
        };
    };

    // Save the ad
    const handleSave = async () => {
        setIsLoading(true);

        // In production, upload to Cloudinary and save to Supabase
        // For now, save to localStorage
        const ads = JSON.parse(localStorage.getItem('ads') || '[]');
        const newAd = {
            id: `ad-${Date.now()}`,
            mediaUrl: mediaPreview,
            thumbnailUrl: mediaPreview,
            mediaType: mediaType,
            contentDocument: contentDocument,
            extractedContent: extractedData,
            // Ad Copy
            primaryText: primaryText,
            headline: headline,
            adFormat: adInsights?.adFormat || mediaType?.toUpperCase() || 'UNKNOWN',
            // Custom Categories & Traits
            categories: selectedCategories,
            subcategories: selectedSubcategories,
            traits: selectedTraits,
            scriptChunks: scriptChunks,
            // Save the AI prediction score with the ad
            predictedScore: prediction?.globalScore,
            predictionDetails: prediction ? {
                globalScore: prediction.globalScore,
                bestSegment: prediction.bestSegment,
                segmentScores: prediction.segmentScores,
                confidence: prediction.confidence
            } : null,
            // Facebook Ad ID for auto-sync
            facebookAdId: adId || null,
            autoSyncResults: autoSyncResults,
            adInsights: adInsights,
            extendedInsights: extendedInsights,
            hasResults: adInsights ? true : false,
            successScore: adInsights?.ctr ? Math.min(100, Math.round(adInsights.ctr * 10)) : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        ads.push(newAd);
        localStorage.setItem('ads', JSON.stringify(ads));

        setIsLoading(false);
        setStep('saved');
    };

    // Verify Ad ID with Facebook API and fetch creative data
    const handleVerifyAdId = async () => {
        if (!adId.trim()) return;

        setIsLoading(true);
        setAdIdVerified(null);

        try {
            // Get saved Marketing token from localStorage
            const savedToken = localStorage.getItem('meta_marketing_token');

            if (!savedToken) {
                alert('Please configure your Meta API credentials in Settings first.');
                setIsLoading(false);
                return;
            }

            // Fetch both insights and creative data in parallel
            const [insightsResponse, creativeResponse] = await Promise.all([
                // Get ad insights
                fetch(`https://graph.facebook.com/v24.0/${adId}/insights?fields=impressions,clicks,ctr,actions,cost_per_action_type,ad_name&access_token=${savedToken}`),
                // Get ad creative data (format, primary text, headline)
                fetch(`https://graph.facebook.com/v24.0/${adId}?fields=name,creative{effective_object_story_spec,object_type,thumbnail_url}&access_token=${savedToken}`)
            ]);

            const insightsData = await insightsResponse.json();
            const creativeData = await creativeResponse.json();

            if (insightsData.error && creativeData.error) {
                console.error('Meta API Error:', insightsData.error);
                setAdIdVerified(false);
                setAdInsights(null);
            } else {
                // Parse insights
                const insights = insightsData.data?.[0] || {};

                // Extract conversions from actions array
                const conversions = insights.actions?.find((a: { action_type: string }) =>
                    a.action_type === 'lead' || a.action_type === 'purchase' || a.action_type === 'complete_registration'
                )?.value || 0;

                // Extract cost per result
                const costPerResult = insights.cost_per_action_type?.find((a: { action_type: string }) =>
                    a.action_type === 'lead' || a.action_type === 'purchase'
                )?.value || 0;

                // Parse creative data
                const creative = creativeData.creative || {};
                const objectStory = creative.effective_object_story_spec || {};
                const linkData = objectStory.link_data || {};
                const videoData = objectStory.video_data || {};

                // Determine ad format
                let adFormat = creative.object_type || 'UNKNOWN';
                if (adFormat === 'SHARE') adFormat = linkData.image_hash ? 'IMAGE' : 'VIDEO';

                // Extract primary text and headline
                const extractedPrimaryText = linkData.message || videoData.message || '';
                const extractedHeadline = linkData.name || linkData.title || videoData.title || '';

                setAdIdVerified(true);
                setAdInsights({
                    adName: creativeData.name || insights.ad_name || `Ad ${adId.slice(-4)}`,
                    impressions: parseInt(insights.impressions) || 0,
                    clicks: parseInt(insights.clicks) || 0,
                    ctr: parseFloat(insights.ctr) || 0,
                    conversions: parseInt(conversions),
                    costPerResult: parseFloat(costPerResult),
                    adFormat: adFormat,
                    primaryText: extractedPrimaryText,
                    headline: extractedHeadline
                });

                // Auto-fill primary text and headline if empty
                if (!primaryText && extractedPrimaryText) setPrimaryText(extractedPrimaryText);
                if (!headline && extractedHeadline) setHeadline(extractedHeadline);
            }
        } catch (error) {
            console.error('Ad verification error:', error);
            setAdIdVerified(false);
            setAdInsights(null);
        }

        setIsLoading(false);
    };

    // Reset form
    const handleReset = () => {
        setStep('upload');
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        setContentDocument('');
        setExtractedData(null);
        setError(null);
        setAdId('');
        setAdIdVerified(null);
        setAdInsights(null);
        setAutoSyncResults(false);
        setPrimaryText('');
        setHeadline('');
        setSelectedCategories([]);
        setSelectedSubcategories([]);
        setSelectedTraits([]);
        setScriptChunks([]);
        setExtendedInsights(null);
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>📤 Upload Ad</h1>
                <p className={styles.subtitle}>Upload your media and describe it - AI will extract all the details</p>
            </header>

            {/* Progress Steps */}
            <div className={styles.progressSteps}>
                <div className={`${styles.step} ${step === 'upload' || step === 'document' || step === 'preview' || step === 'saved' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>1</span>
                    <span>Upload Media</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${step === 'document' || step === 'preview' || step === 'saved' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>2</span>
                    <span>Describe Content</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${step === 'preview' || step === 'saved' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>3</span>
                    <span>AI Extraction</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${step === 'saved' ? styles.active : ''}`}>
                    <span className={styles.stepNumber}>4</span>
                    <span>Saved</span>
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

            {/* Step 1: Upload Media */}
            {step === 'upload' && (
                <div className={`glass-card ${styles.uploadCard}`}>
                    <div
                        className={styles.dropZone}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <h3>Drop your media here</h3>
                        <p>Upload a video or photo for your ad</p>
                        <div className={styles.supportedFormats}>
                            <span>📹 Videos: MP4, MOV, WebM</span>
                            <span>📷 Photos: JPG, PNG, WebP</span>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*,image/*"
                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>
            )}

            {/* Step 2: Content Document */}
            {step === 'document' && (
                <div className={styles.documentSection}>
                    {/* Media Preview */}
                    <div className={`glass-card ${styles.mediaPreviewCard}`}>
                        <h3>Media Preview</h3>
                        {mediaType === 'video' ? (
                            <video src={mediaPreview || ''} controls className={styles.mediaPreview} />
                        ) : (
                            <img src={mediaPreview || ''} alt="Preview" className={styles.mediaPreview} />
                        )}
                        <div className={styles.mediaInfo}>
                            <span className="badge badge-primary">{mediaType?.toUpperCase()}</span>
                            <span>{mediaFile?.name}</span>
                        </div>
                    </div>

                    {/* Document Input */}
                    <div className={`glass-card ${styles.documentCard}`}>
                        <h3>📝 Content Description</h3>
                        <p>Describe everything about this ad. The AI will extract all details automatically.</p>

                        <div className={styles.documentHints}>
                            <h4>📋 Complete List of Details to Include (90+ data points):</h4>

                            <div className={styles.hintsGrid}>
                                <div className={styles.hintCategory}>
                                    <h5>📊 Basic Info</h5>
                                    <ul>
                                        <li>• Ad title or campaign name</li>
                                        <li>• Aspect ratio (9:16, 1:1, 4:5, 16:9)</li>
                                        <li>• Duration in seconds</li>
                                        <li>• Media type (video/photo/carousel)</li>
                                        <li>• Resolution quality (HD, 4K)</li>
                                        <li>• Frame rate (24/30/60 fps)</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>📱 Platform & Placement</h5>
                                    <ul>
                                        <li>• Platform (TikTok, Instagram, Facebook, YouTube, Snapchat)</li>
                                        <li>• Placement (Feed, Stories, Reels, Shorts, In-stream)</li>
                                        <li>• Target age range (18-24, 25-34, 35-44, etc.)</li>
                                        <li>• Target gender (Male, Female, All)</li>
                                        <li>• Target interests (Beauty, Tech, Fitness, Fashion)</li>
                                        <li>• Geographic targeting (Countries/Regions)</li>
                                        <li>• Device targeting (Mobile/Desktop)</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>🎣 Hook & Content</h5>
                                    <ul>
                                        <li>• Hook type (Curiosity, Shock, Question, Transformation)</li>
                                        <li>• Hook type (Problem/Solution, Social Proof, Contrast)</li>
                                        <li>• Hook script (exact first 3 seconds text)</li>
                                        <li>• Opening visual (Face, Product, Text, Action shot)</li>
                                        <li>• Content category (UGC, Testimonial, Demo, Educational)</li>
                                        <li>• Full script or narration text</li>
                                        <li>• Key messages or selling points</li>
                                        <li>• Emotional tone (Funny, Serious, Inspirational)</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>🎨 Visual Style</h5>
                                    <ul>
                                        <li>• Editing style (Fast cuts, Jump cuts, Slow motion)</li>
                                        <li>• Editing style (Raw/Authentic, Polished, Mixed media)</li>
                                        <li>• Color scheme (Warm, Cool, Neutral, Vibrant, Dark)</li>
                                        <li>• Color grading or filter used</li>
                                        <li>• Has subtitles? (Yes/No, what color, what style)</li>
                                        <li>• Has text overlays? (Yes/No, animated?)</li>
                                        <li>• Shot composition (Close-up, Wide, Medium, POV)</li>
                                        <li>• Camera movement (Static, Handheld, Tracking)</li>
                                        <li>• Lighting style (Natural, Studio, Ring light, Moody)</li>
                                        <li>• Background setting (Home, Outdoor, Studio, Office)</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>🎵 Audio & Music</h5>
                                    <ul>
                                        <li>• Music type (Trending, Original, Licensed, No music)</li>
                                        <li>• Music genre (Pop, Hip-hop, EDM, Acoustic, Lo-fi)</li>
                                        <li>• TikTok sound name or audio source</li>
                                        <li>• Has voiceover? (Yes/No)</li>
                                        <li>• Voiceover style (Professional, Casual, AI-generated)</li>
                                        <li>• Voice gender and tone</li>
                                        <li>• BPM/tempo (Fast, Medium, Slow)</li>
                                        <li>• Sound effects used</li>
                                        <li>• Audio sync with visuals (Beat drops, etc.)</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>👤 Talent & Branding</h5>
                                    <ul>
                                        <li>• Number of people in ad</li>
                                        <li>• Is UGC style? (Yes/No)</li>
                                        <li>• Creator type (Influencer, Customer, Actor, Founder)</li>
                                        <li>• Creator gender and age range</li>
                                        <li>• Creator speaking to camera?</li>
                                        <li>• Logo placement (Start, End, Throughout, None)</li>
                                        <li>• Brand name mentions (how many times)</li>
                                        <li>• Product shown? (Yes/No, when)</li>
                                        <li>• Packaging visible?</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>💡 CTA & Engagement</h5>
                                    <ul>
                                        <li>• CTA type (Shop Now, Learn More, Link in Bio, Swipe Up)</li>
                                        <li>• CTA type (Follow, Comment, DM, Use Code)</li>
                                        <li>• CTA timing (Beginning, Middle, End)</li>
                                        <li>• CTA spoken or shown as text?</li>
                                        <li>• Discount or offer mentioned?</li>
                                        <li>• Promo code shown?</li>
                                        <li>• Urgency words (Limited, Now, Today only, Last chance)</li>
                                        <li>• Social proof (Reviews, Testimonials, Numbers)</li>
                                        <li>• FOMO elements used?</li>
                                    </ul>
                                </div>

                                <div className={styles.hintCategory}>
                                    <h5>✨ Unique Elements</h5>
                                    <ul>
                                        <li>• Any special effects (Green screen, Split screen)</li>
                                        <li>• Unusual visual patterns noticed</li>
                                        <li>• Unique transitions used</li>
                                        <li>• Before/After transformation shown?</li>
                                        <li>• Challenge or trend referenced?</li>
                                        <li>• Specific colors that pop</li>
                                        <li>• Memorable moments or quotes</li>
                                        <li>• What makes this ad different?</li>
                                        <li>• Custom traits you want to track</li>
                                    </ul>
                                </div>
                            </div>

                            <p className={styles.hintNote}>
                                💡 <strong>Tip:</strong> The more details you provide, the better the AI prediction!
                                Don't worry if you're missing some - AI will suggest what's needed.
                            </p>
                        </div>

                        <textarea
                            className={styles.documentTextarea}
                            placeholder={`Example: This is a 9:16 vertical video for TikTok Reels.

It uses a curiosity hook: "You won't believe what happened when I tried this..."

The video is UGC style with a female creator in her 20s. Shot raw/authentic style with fast cuts. Has subtitles and text overlays.

The script goes:
"Hey guys, I just tried this new skincare product and wait until you see the results..."

Uses trending audio from TikTok, also has voiceover.

CTA: "Link in bio to get 20% off"`}
                            value={contentDocument}
                            onChange={(e) => setContentDocument(e.target.value)}
                            rows={15}
                        />

                        <div className={styles.documentActions}>
                            <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                                ← Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleParseDocument}
                                disabled={isLoading || !contentDocument.trim()}
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                                        </svg>
                                        AI Analyzing...
                                    </>
                                ) : (
                                    <>
                                        🤖 Extract with AI
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Preview Extracted Data */}
            {step === 'preview' && extractedData && (
                <div className={styles.previewSection}>
                    {/* AI Prediction Score Card */}
                    {prediction && (
                        <div className={`glass-card ${styles.predictionCard}`} style={{
                            marginBottom: 'var(--spacing-xl)',
                            padding: 'var(--spacing-xl)',
                            background: prediction.globalScore >= 70
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 78, 59, 0.3) 100%)'
                                : prediction.globalScore >= 50
                                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(120, 53, 15, 0.3) 100%)'
                                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(127, 29, 29, 0.3) 100%)',
                            border: prediction.globalScore >= 70 ? '1px solid rgba(16, 185, 129, 0.4)' :
                                prediction.globalScore >= 50 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-lg)' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-xs)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        🤖 AI Prediction Score
                                        <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>NVIDIA AI</span>
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        Predicted success based on ad characteristics
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '3rem',
                                        fontWeight: 700,
                                        lineHeight: 1,
                                        color: prediction.globalScore >= 70 ? 'var(--success)' :
                                            prediction.globalScore >= 50 ? 'var(--warning)' : 'var(--error)'
                                    }}>
                                        {prediction.globalScore}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/ 100</div>
                                </div>
                            </div>

                            {/* Best Segment */}
                            {prediction.bestSegment && (
                                <div style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--spacing-lg)'
                                }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)' }}>
                                        🎯 Best Target Audience
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '1rem', fontWeight: 600 }}>{prediction.bestSegment.segmentName}</span>
                                        <span style={{
                                            fontSize: '1.25rem',
                                            fontWeight: 700,
                                            color: 'var(--accent-primary)'
                                        }}>{prediction.bestSegment.score}%</span>
                                    </div>
                                </div>
                            )}

                            {/* All Segment Scores */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-sm)' }}>
                                {prediction.segmentScores.map((segment) => (
                                    <div key={segment.segmentId} style={{
                                        background: 'var(--bg-tertiary)',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        borderRadius: 'var(--radius-sm)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{segment.segmentName}</span>
                                        <span style={{
                                            fontWeight: 600,
                                            color: segment.score >= 70 ? 'var(--success)' :
                                                segment.score >= 50 ? 'var(--warning)' : 'var(--error)'
                                        }}>{segment.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={`glass-card ${styles.previewCard}`}>
                        <div className={styles.previewHeader}>
                            <h2>✅ AI Extracted Data</h2>
                            <span className={styles.confidenceBadge}>
                                {extractedData.extractionConfidence}% confidence
                            </span>
                        </div>

                        <div className={styles.extractedGrid}>
                            <div className={styles.extractedSection}>
                                <h4>📊 Basic Info</h4>
                                <div className={styles.extractedItem}>
                                    <span>Title</span>
                                    <strong>{extractedData.title}</strong>
                                </div>
                                <div className={styles.extractedItem}>
                                    <span>Media Type</span>
                                    <strong>{extractedData.mediaType}</strong>
                                </div>
                                <div className={styles.extractedItem}>
                                    <span>Aspect Ratio</span>
                                    <strong>{extractedData.aspectRatio}</strong>
                                </div>
                            </div>

                            <div className={styles.extractedSection}>
                                <h4>📱 Platform</h4>
                                <div className={styles.extractedItem}>
                                    <span>Platform</span>
                                    <strong>{extractedData.platform}</strong>
                                </div>
                                <div className={styles.extractedItem}>
                                    <span>Placement</span>
                                    <strong>{extractedData.placement}</strong>
                                </div>
                            </div>

                            <div className={styles.extractedSection}>
                                <h4>🎣 Content</h4>
                                <div className={styles.extractedItem}>
                                    <span>Hook Type</span>
                                    <strong>{extractedData.hookType}</strong>
                                </div>
                                <div className={styles.extractedItem}>
                                    <span>Category</span>
                                    <strong>{extractedData.contentCategory}</strong>
                                </div>
                                <div className={styles.extractedItem}>
                                    <span>Editing Style</span>
                                    <strong>{extractedData.editingStyle}</strong>
                                </div>
                            </div>

                            <div className={styles.extractedSection}>
                                <h4>🎨 Features</h4>
                                <div className={styles.featureTags}>
                                    {extractedData.hasSubtitles && <span className="badge badge-success">Subtitles</span>}
                                    {extractedData.hasTextOverlays && <span className="badge badge-success">Text Overlays</span>}
                                    {extractedData.hasVoiceover && <span className="badge badge-success">Voiceover</span>}
                                    {extractedData.isUGCStyle && <span className="badge badge-success">UGC Style</span>}
                                </div>
                            </div>

                            <div className={styles.extractedSection}>
                                <h4>🎵 Audio</h4>
                                <div className={styles.extractedItem}>
                                    <span>Music Type</span>
                                    <strong>{extractedData.musicType}</strong>
                                </div>
                            </div>

                            <div className={styles.extractedSection}>
                                <h4>💡 CTA</h4>
                                <div className={styles.extractedItem}>
                                    <span>CTA Type</span>
                                    <strong>{extractedData.cta || 'Not specified'}</strong>
                                </div>
                            </div>

                            {extractedData.customTraits && extractedData.customTraits.length > 0 && (
                                <div className={`${styles.extractedSection} ${styles.fullWidth}`}>
                                    <h4>🏷️ Dynamically Extracted Traits ({extractedData.customTraits.length})</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                        These traits were intelligently extracted from your content
                                    </p>
                                    <div className={styles.featureTags} style={{ flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                        {extractedData.customTraits.map((trait, i) => (
                                            <span key={i} className="badge" style={{
                                                background: trait.includes(':') ? 'rgba(99, 102, 241, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                                                border: trait.includes(':') ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(168, 85, 247, 0.4)'
                                            }}>{trait}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {extractedData.learnedTraitsToCreate && extractedData.learnedTraitsToCreate.length > 0 && (
                                <div className={`${styles.extractedSection} ${styles.fullWidth}`} style={{
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)'
                                }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <span>🧠</span> AI-Suggested New Traits ({extractedData.learnedTraitsToCreate.length})
                                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Auto-Saved</span>
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                        These new traits have been learned and saved for future predictions
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                                        {extractedData.learnedTraitsToCreate.map((trait, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                background: 'rgba(16, 185, 129, 0.1)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.8125rem'
                                            }}>
                                                <div>
                                                    <strong style={{ color: 'var(--success)' }}>{trait.traitName}</strong>
                                                    <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--spacing-xs)' }}>
                                                        ({trait.traitCategory})
                                                    </span>
                                                </div>
                                                <span className="badge" style={{
                                                    fontSize: '0.625rem',
                                                    background: trait.importance === 'high' ? 'rgba(239, 68, 68, 0.2)' :
                                                        trait.importance === 'medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                                    border: trait.importance === 'high' ? '1px solid rgba(239, 68, 68, 0.4)' :
                                                        trait.importance === 'medium' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(107, 114, 128, 0.4)'
                                                }}>{trait.importance}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {extractedData.aiInsights && extractedData.aiInsights.length > 0 && (
                                <div className={`${styles.extractedSection} ${styles.fullWidth}`} style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05))',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)'
                                }}>
                                    <h4>💡 AI Insights</h4>
                                    <ul style={{ marginLeft: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                                        {extractedData.aiInsights.map((insight, i) => (
                                            <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                                {insight}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {extractedData.script && (
                                <div className={`${styles.extractedSection} ${styles.fullWidth}`}>
                                    <h4>📝 Script</h4>
                                    <p className={styles.scriptText}>{extractedData.script}</p>
                                </div>
                            )}
                        </div>

                        {/* Ad Copy Section - Primary Text & Headline */}
                        <div className={`glass-card`} style={{
                            marginTop: 'var(--spacing-lg)',
                            padding: 'var(--spacing-lg)',
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.05))',
                            border: '1px solid rgba(168, 85, 247, 0.2)'
                        }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <span>✍️</span> Ad Copy (Optional)
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)' }}>
                                Enter the primary text and headline used in your Facebook ad
                            </p>

                            <div className="form-group" style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label className="form-label">Primary Text</label>
                                <textarea
                                    placeholder="The main ad copy that appears above the media..."
                                    value={primaryText}
                                    onChange={(e) => setPrimaryText(e.target.value)}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Headline</label>
                                <input
                                    type="text"
                                    placeholder="The headline that appears below the media..."
                                    value={headline}
                                    onChange={(e) => setHeadline(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem'
                                    }}
                                />
                            </div>

                            {adInsights?.adFormat && (
                                <div style={{
                                    marginTop: 'var(--spacing-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)',
                                    fontSize: '0.8125rem'
                                }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Ad Format:</span>
                                    <span className="badge badge-primary">{adInsights.adFormat}</span>
                                </div>
                            )}
                        </div>

                        {/* Facebook Ad ID Section (Optional) */}
                        <div className={`glass-card`} style={{
                            marginTop: 'var(--spacing-lg)',
                            padding: 'var(--spacing-lg)',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
                            border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <span>🔗</span> Link to Facebook Ad (Optional)
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)' }}>
                                Connect this creative to a Facebook Ad to auto-fetch performance results
                            </p>

                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                                <input
                                    type="text"
                                    placeholder="Enter Facebook Ad ID (e.g., 23851234567890123)"
                                    value={adId}
                                    onChange={(e) => {
                                        setAdId(e.target.value);
                                        setAdIdVerified(null);
                                        setAdInsights(null);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem'
                                    }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleVerifyAdId}
                                    disabled={!adId.trim() || isLoading}
                                >
                                    {isLoading ? '...' : '🔍 Fetch'}
                                </button>
                            </div>

                            {/* Verification Status */}
                            {adIdVerified === true && adInsights && (
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)',
                                    marginBottom: 'var(--spacing-md)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                        <span style={{ color: 'var(--success)' }}>✅</span>
                                        <strong>Ad Found: {adInsights.adName}</strong>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--spacing-sm)', fontSize: '0.8125rem' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Impressions</span>
                                            <div style={{ fontWeight: 600 }}>{adInsights.impressions?.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Clicks</span>
                                            <div style={{ fontWeight: 600 }}>{adInsights.clicks?.toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>CTR</span>
                                            <div style={{ fontWeight: 600, color: 'var(--success)' }}>{adInsights.ctr}%</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Conversions</span>
                                            <div style={{ fontWeight: 600 }}>{adInsights.conversions}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Cost/Result</span>
                                            <div style={{ fontWeight: 600 }}>₱{adInsights.costPerResult}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {adIdVerified === false && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-md)',
                                    color: 'var(--error)',
                                    fontSize: '0.875rem',
                                    marginBottom: 'var(--spacing-md)'
                                }}>
                                    ❌ Could not find ad. Check the Ad ID and try again.
                                </div>
                            )}

                            {/* Auto-sync Option */}
                            {adIdVerified === true && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={autoSyncResults}
                                        onChange={(e) => setAutoSyncResults(e.target.checked)}
                                        style={{ width: 18, height: 18 }}
                                    />
                                    <span>🔄 Auto-sync results daily from Facebook</span>
                                </label>
                            )}
                        </div>

                        {/* Categories & Traits Section */}
                        <div className={`glass-card`} style={{
                            marginTop: 'var(--spacing-lg)',
                            padding: 'var(--spacing-lg)',
                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
                            border: '1px solid rgba(34, 197, 94, 0.2)'
                        }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <span>🏷️</span> Categories & Traits (For AI Learning)
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)' }}>
                                Tag your ad to help the AI learn what works
                            </p>

                            {/* Categories */}
                            <div className="form-group" style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label className="form-label">Categories</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                    {DEFAULT_CATEGORIES.categories.map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedCategories(prev =>
                                                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                            )}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '0.75rem',
                                                borderRadius: 'var(--radius-full)',
                                                border: selectedCategories.includes(cat) ? '1px solid var(--primary)' : '1px solid var(--border-primary)',
                                                background: selectedCategories.includes(cat) ? 'var(--primary)' : 'transparent',
                                                color: selectedCategories.includes(cat) ? 'white' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Traits */}
                            <div className="form-group">
                                <label className="form-label">Traits / Style</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                    {DEFAULT_CATEGORIES.traits.map(trait => (
                                        <button
                                            key={trait}
                                            type="button"
                                            onClick={() => setSelectedTraits(prev =>
                                                prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
                                            )}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '0.75rem',
                                                borderRadius: 'var(--radius-full)',
                                                border: selectedTraits.includes(trait) ? '1px solid var(--accent)' : '1px solid var(--border-primary)',
                                                background: selectedTraits.includes(trait) ? 'var(--accent)' : 'transparent',
                                                color: selectedTraits.includes(trait) ? 'white' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {trait}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Extended Insights Section (only show if fetched) */}
                        {extendedInsights && (
                            <div className={`glass-card`} style={{
                                marginTop: 'var(--spacing-lg)',
                                padding: 'var(--spacing-lg)',
                                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(249, 115, 22, 0.05))',
                                border: '1px solid rgba(249, 115, 22, 0.2)'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <span>📊</span> Detailed Facebook Insights
                                </h3>

                                {/* Demographics */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>👥 Demographics</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--spacing-sm)', fontSize: '0.75rem' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Male</span>
                                            <div style={{ fontWeight: 600 }}>{extendedInsights.demographics.gender.male.percent}%</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Female</span>
                                            <div style={{ fontWeight: 600 }}>{extendedInsights.demographics.gender.female.percent}%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Placements */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>📍 Placements</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                        {Object.entries(extendedInsights.distribution.placements).map(([placement, percent]) => (
                                            <span key={placement} className="tag" style={{ fontSize: '0.7rem' }}>
                                                {placement}: {percent}%
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Devices */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>📱 Devices</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                        {Object.entries(extendedInsights.distribution.devices).map(([device, percent]) => (
                                            <span key={device} className="tag" style={{ fontSize: '0.7rem' }}>
                                                {device}: {percent}%
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Time Analysis */}
                                <div>
                                    <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>⏰ Best Time</h4>
                                    <div style={{ fontSize: '0.8125rem' }}>
                                        Most active: <strong>{extendedInsights.timeAnalysis.mostActiveHour}:00</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={styles.previewActions}>
                            <button className="btn btn-secondary" onClick={() => setStep('document')}>
                                ← Edit Description
                            </button>
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleSave}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Saving...' : '💾 Save Ad'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Saved */}
            {step === 'saved' && (
                <div className={`glass-card ${styles.savedCard}`}>
                    <div className={styles.savedIcon}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                    <h2>Ad Saved Successfully!</h2>
                    <p>Your ad has been saved. Add performance results when you have them.</p>

                    <div className={styles.savedActions}>
                        <button className="btn btn-secondary" onClick={handleReset}>
                            📤 Upload Another
                        </button>
                        <a href="/results" className="btn btn-primary">
                            📊 Add Results
                        </a>
                        <a href="/mindmap" className="btn btn-ghost">
                            🧠 Algorithm
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
