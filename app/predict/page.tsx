'use client';

import { useState } from 'react';
import styles from './page.module.css';
import {
    HookType,
    EditingStyle,
    ContentCategory,
    ColorScheme,
    MusicType,
    Platform,
    TimeOfDay,
    PredictionResult,
    ExtractedAdData,
} from '@/types';
import {
    predictWithML,
    RiskAssessment,
} from '@/lib/ml';

// Parsed traits from AI
interface ParsedTraits {
    hookType?: HookType;
    editingStyle?: EditingStyle;
    contentCategory?: ContentCategory;
    platform?: Platform;
    hasSubtitles?: boolean;
    hasTextOverlays?: boolean;
    isUGCStyle?: boolean;
    hasVoiceover?: boolean;
    musicType?: MusicType;
    colorScheme?: ColorScheme;
    numberOfActors?: number;
}

export default function PredictPage() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);
    const [dataPoints, setDataPoints] = useState(0);
    const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);

    // Document input state
    const [adDescription, setAdDescription] = useState('');
    const [parsedTraits, setParsedTraits] = useState<ParsedTraits | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    // Parse ad description using AI
    const parseAdDescription = async () => {
        if (!adDescription.trim()) {
            setParseError('Please describe your ad first');
            return;
        }

        setIsParsing(true);
        setParseError(null);

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse_ad_traits',
                    data: {
                        description: adDescription.trim(),
                    },
                }),
            });

            const result = await response.json();

            if (result.success && result.data) {
                const traits = result.data;
                setParsedTraits({
                    hookType: traits.hookType || 'curiosity',
                    editingStyle: traits.editingStyle || 'raw_authentic',
                    contentCategory: traits.contentCategory || 'ugc',
                    platform: traits.platform || 'tiktok',
                    hasSubtitles: traits.hasSubtitles ?? true,
                    hasTextOverlays: traits.hasTextOverlays ?? true,
                    isUGCStyle: traits.isUGCStyle ?? true,
                    hasVoiceover: traits.hasVoiceover ?? true,
                    musicType: traits.musicType || 'trending',
                    colorScheme: traits.colorScheme || 'vibrant',
                    numberOfActors: traits.numberOfActors || 1,
                });
            } else {
                // Fallback to smart defaults based on keywords
                setParsedTraits(inferTraitsFromText(adDescription));
            }
        } catch (error) {
            console.error('Parse error:', error);
            // Fallback to text-based inference
            setParsedTraits(inferTraitsFromText(adDescription));
        }

        setIsParsing(false);
    };

    // Infer traits from text using keywords (fallback)
    const inferTraitsFromText = (text: string): ParsedTraits => {
        const lower = text.toLowerCase();

        // Hook type inference
        let hookType: HookType = 'curiosity';
        if (lower.includes('shock') || lower.includes('surprising') || lower.includes('unbelievable')) {
            hookType = 'shock';
        } else if (lower.includes('before') && lower.includes('after')) {
            hookType = 'before_after';
        } else if (lower.includes('question') || lower.includes('?') || lower.includes('how to')) {
            hookType = 'question';
        } else if (lower.includes('story') || lower.includes('journey') || lower.includes('experience')) {
            hookType = 'story';
        }

        // Platform inference
        let platform: Platform = 'tiktok';
        if (lower.includes('instagram') || lower.includes('ig') || lower.includes('reels')) {
            platform = 'instagram';
        } else if (lower.includes('youtube') || lower.includes('shorts')) {
            platform = 'youtube';
        } else if (lower.includes('facebook') || lower.includes('fb')) {
            platform = 'facebook';
        }

        // Content category inference
        let contentCategory: ContentCategory = 'ugc';
        if (lower.includes('testimonial') || lower.includes('review') || lower.includes('customer')) {
            contentCategory = 'testimonial';
        } else if (lower.includes('lifestyle') || lower.includes('aesthetic') || lower.includes('vibe')) {
            contentCategory = 'lifestyle';
        } else if (lower.includes('demo') || lower.includes('tutorial') || lower.includes('how-to')) {
            contentCategory = 'product_demo';
        }

        // Editing style inference
        let editingStyle: EditingStyle = 'raw_authentic';
        if (lower.includes('fast') || lower.includes('quick cuts') || lower.includes('dynamic')) {
            editingStyle = 'fast_cuts';
        } else if (lower.includes('cinematic') || lower.includes('professional') || lower.includes('polished')) {
            editingStyle = 'cinematic';
        } else if (lower.includes('dynamic') || lower.includes('energetic')) {
            editingStyle = 'dynamic';
        }

        return {
            hookType,
            editingStyle,
            contentCategory,
            platform,
            hasSubtitles: lower.includes('subtitle') || lower.includes('caption') || !lower.includes('no subtitle'),
            hasTextOverlays: lower.includes('text') || lower.includes('overlay') || !lower.includes('no text'),
            isUGCStyle: lower.includes('ugc') || lower.includes('user generated') || lower.includes('authentic') || !lower.includes('professional'),
            hasVoiceover: lower.includes('voiceover') || lower.includes('narration') || lower.includes('voice'),
            musicType: lower.includes('trending') ? 'trending' : lower.includes('emotional') ? 'emotional' : 'upbeat',
            colorScheme: 'vibrant',
            numberOfActors: 1,
        };
    };

    const handlePredict = async () => {
        if (!parsedTraits) {
            setParseError('Please analyze your ad description first');
            return;
        }

        setIsAnalyzing(true);

        try {
            // Build ExtractedAdData for ML system
            const adData: Partial<ExtractedAdData> = {
                hookType: parsedTraits.hookType as HookType,
                editingStyle: parsedTraits.editingStyle as EditingStyle,
                contentCategory: parsedTraits.contentCategory as ContentCategory,
                colorScheme: parsedTraits.colorScheme || 'vibrant',
                musicType: parsedTraits.musicType || 'trending',
                platform: parsedTraits.platform as Platform,
                hasSubtitles: parsedTraits.hasSubtitles ?? true,
                hasTextOverlays: parsedTraits.hasTextOverlays ?? true,
                isUGCStyle: parsedTraits.isUGCStyle ?? true,
                hasVoiceover: parsedTraits.hasVoiceover ?? true,
                numberOfActors: parsedTraits.numberOfActors || 1,
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

            // Call the AI API for GPT-powered prediction
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'predict',
                    data: {
                        hookType: parsedTraits.hookType,
                        contentCategory: parsedTraits.contentCategory,
                        editingStyle: parsedTraits.editingStyle,
                        platform: parsedTraits.platform,
                        features: {
                            hasSubtitles: parsedTraits.hasSubtitles,
                            hasTextOverlays: parsedTraits.hasTextOverlays,
                            isUGC: parsedTraits.isUGCStyle,
                            hasVoiceover: parsedTraits.hasVoiceover,
                        },
                        adDescription: adDescription.trim(),
                    },
                }),
            });

            const result = await response.json();

            if (result.success && result.data) {
                // Use AI prediction
                const aiPrediction = result.data;
                const mockPrediction: PredictionResult = {
                    success_probability: aiPrediction.successProbability || mlResult.globalScore,
                    confidence: mlResult.confidence,
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
                        { factor: 'UGC Style', impact: parsedTraits.isUGCStyle ? 'positive' : 'negative', weight: parsedTraits.isUGCStyle ? 0.95 : 0.4 },
                        { factor: 'Hook Type', impact: mlResult.globalScore > 70 ? 'positive' : 'neutral', weight: 0.85 },
                        { factor: 'Subtitles', impact: parsedTraits.hasSubtitles ? 'positive' : 'negative', weight: parsedTraits.hasSubtitles ? 0.9 : 0.4 },
                        { factor: 'Platform Choice', impact: parsedTraits.platform === 'tiktok' ? 'positive' : 'neutral', weight: 0.75 },
                    ],
                    recommendations: [],
                    similar_videos: [],
                };

                // Add recommendations based on risk assessment
                if (mlResult.riskAssessment.potentialFailures.length > 0) {
                    mlResult.riskAssessment.potentialFailures.forEach(f => {
                        fallbackPrediction.recommendations.push(f.mitigation);
                    });
                }

                if (!parsedTraits.isUGCStyle) fallbackPrediction.recommendations.push('Consider using UGC-style content for +15% engagement');
                if (!parsedTraits.hasSubtitles) fallbackPrediction.recommendations.push('Add subtitles/captions for +12% watch time');

                setPrediction(fallbackPrediction);
            }
        } catch (error) {
            console.error('Prediction error:', error);
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

    const resetPrediction = () => {
        setPrediction(null);
        setRiskAssessment(null);
        setParsedTraits(null);
        setAdDescription('');
        setParseError(null);
    };

    // Format trait label for display
    const formatTraitLabel = (key: string, value: unknown): string => {
        if (typeof value === 'boolean') {
            return value ? '✓ Yes' : '✗ No';
        }
        if (typeof value === 'string') {
            return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        return String(value);
    };

    // Get trait icon
    const getTraitIcon = (key: string): string => {
        const icons: Record<string, string> = {
            hookType: '🎣',
            editingStyle: '✂️',
            contentCategory: '📁',
            platform: '📱',
            hasSubtitles: '📝',
            hasTextOverlays: '💬',
            isUGCStyle: '🎥',
            hasVoiceover: '🎙️',
            musicType: '🎵',
            colorScheme: '🎨',
            numberOfActors: '👤',
        };
        return icons[key] || '•';
    };

    // Get trait display name
    const getTraitName = (key: string): string => {
        const names: Record<string, string> = {
            hookType: 'Hook Type',
            editingStyle: 'Editing Style',
            contentCategory: 'Content Category',
            platform: 'Target Platform',
            hasSubtitles: 'Subtitles',
            hasTextOverlays: 'Text Overlays',
            isUGCStyle: 'UGC Style',
            hasVoiceover: 'Voiceover',
            musicType: 'Music Type',
            colorScheme: 'Color Scheme',
            numberOfActors: 'Number of Actors',
        };
        return names[key] || key;
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>🤖 GPT-Powered Predictions</h1>
                    <p className={styles.subtitle}>Describe your ad and let AI predict its success</p>
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
                    {/* Document Input Section */}
                    <div className={`glass-card ${styles.inputCard}`}>
                        <h2>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Describe Your Ad
                        </h2>
                        <p className={styles.muted}>
                            Tell us about your ad in natural language. Include details about the hook, style, platform, content type, and any features. Our AI will extract the relevant traits automatically.
                        </p>

                        <div className={styles.documentInputWrapper}>
                            <textarea
                                className={styles.documentInput}
                                placeholder="Example: I'm creating a TikTok ad with a shocking hook that grabs attention in the first second. It's UGC-style content featuring a customer testimonial with fast cuts and trending music. The video has subtitles throughout and text overlays highlighting key benefits. There's a voiceover narrating the customer's experience..."
                                value={adDescription}
                                onChange={(e) => {
                                    setAdDescription(e.target.value);
                                    setParsedTraits(null);
                                    setParseError(null);
                                }}
                                rows={8}
                            />
                            <div className={styles.charCount}>
                                {adDescription.length} characters
                            </div>
                        </div>

                        {parseError && (
                            <div className={styles.parseError}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {parseError}
                            </div>
                        )}

                        <button
                            className="btn btn-secondary"
                            onClick={parseAdDescription}
                            disabled={isParsing || !adDescription.trim()}
                            style={{ marginTop: 'var(--spacing-md)' }}
                        >
                            {isParsing ? (
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
                                    Extract Ad Traits
                                </>
                            )}
                        </button>
                    </div>

                    {/* Parsed Traits Display */}
                    {parsedTraits && (
                        <div className={`glass-card ${styles.parsedTraitsCard}`}>
                            <h3>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Extracted Ad Traits
                            </h3>
                            <p className={styles.muted}>AI has identified the following traits from your description. Review and proceed to get your prediction.</p>

                            <div className={styles.traitsGrid}>
                                {Object.entries(parsedTraits).map(([key, value]) => (
                                    <div key={key} className={styles.traitItem}>
                                        <span className={styles.traitIcon}>{getTraitIcon(key)}</span>
                                        <span className={styles.traitName}>{getTraitName(key)}</span>
                                        <span className={styles.traitValue}>{formatTraitLabel(key, value)}</span>
                                    </div>
                                ))}
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
                                        Getting Prediction...
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
                    )}
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
                            Try Different Ad
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
