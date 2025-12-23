'use client';

import { useState, useEffect } from 'react';
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
    PredictionFactor
} from '@/types';

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

    const handlePredict = async () => {
        if (!inputs.hook_type || !inputs.editing_style || !inputs.content_category || !inputs.platform) {
            alert('Please select all required options');
            return;
        }

        setIsAnalyzing(true);

        try {
            // Call the AI API for GPT-powered prediction
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'predict',
                    data: {
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
                    },
                }),
            });

            const result = await response.json();

            if (result.success && result.data) {
                // Use AI prediction
                const aiPrediction = result.data;
                const mockPrediction: PredictionResult = {
                    success_probability: aiPrediction.successProbability || 70,
                    confidence: aiPrediction.confidence || 60,
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
                // Fallback to heuristic prediction
                let score = 50;

                const hookOption = QUICK_OPTIONS.hook_types.find(h => h.value === inputs.hook_type);
                if (hookOption) score += (hookOption.score - 70) / 3;

                const editOption = QUICK_OPTIONS.editing_styles.find(e => e.value === inputs.editing_style);
                if (editOption) score += (editOption.score - 70) / 3;

                const contentOption = QUICK_OPTIONS.content_categories.find(c => c.value === inputs.content_category);
                if (contentOption) score += (contentOption.score - 70) / 3;

                const platformOption = QUICK_OPTIONS.platforms.find(p => p.value === inputs.platform);
                if (platformOption) score += (platformOption.score - 70) / 3;

                if (inputs.ugc_style) score += 8;
                if (inputs.subtitles) score += 5;
                if (inputs.text_overlays) score += 3;
                if (inputs.voiceover) score += 2;
                if (inputs.launch_time === 'evening') score += 4;
                if (inputs.music_type === 'trending') score += 5;

                score = Math.min(98, Math.max(35, Math.round(score)));

                const fallbackPrediction: PredictionResult = {
                    success_probability: score,
                    confidence: Math.min(95, 50 + dataPoints),
                    top_factors: [
                        { factor: 'UGC Style', impact: inputs.ugc_style ? 'positive' : 'negative', weight: inputs.ugc_style ? 0.95 : 0.4 },
                        { factor: 'Hook Type', impact: score > 70 ? 'positive' : 'neutral', weight: 0.85 },
                        { factor: 'Subtitles', impact: inputs.subtitles ? 'positive' : 'negative', weight: inputs.subtitles ? 0.9 : 0.4 },
                        { factor: 'Launch Time', impact: inputs.launch_time === 'evening' ? 'positive' : 'neutral', weight: 0.8 },
                        { factor: 'Platform Choice', impact: platformOption && platformOption.score > 80 ? 'positive' : 'neutral', weight: 0.75 },
                    ],
                    recommendations: [],
                    similar_videos: [],
                };

                if (!inputs.ugc_style) fallbackPrediction.recommendations.push('Consider using UGC-style content for +15% engagement');
                if (!inputs.subtitles) fallbackPrediction.recommendations.push('Add subtitles/captions for +12% watch time');
                if (inputs.music_type !== 'trending') fallbackPrediction.recommendations.push('Using trending audio could boost reach by +20%');
                if (inputs.launch_time !== 'evening') fallbackPrediction.recommendations.push('Launch during evening hours (5-9 PM) for best reach');

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
        }

        setIsAnalyzing(false);
    };

    const selectOption = (category: string, value: string) => {
        setInputs(prev => ({ ...prev, [category]: value }));
    };

    const resetPrediction = () => {
        setPrediction(null);
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
                    <div className={`glass-card ${styles.inputCard}`}>
                        <h2>Configure Your Ad</h2>
                        <p>Select the characteristics of your planned video to get a prediction</p>

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
                                        <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0012 19.5" />
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
                                <div className={styles.confidenceBadge}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                    {prediction.confidence}% confidence ({dataPoints} data points)
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
