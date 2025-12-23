'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { AdEntry, ExtractedResultsData } from '@/types';

export default function ResultsPage() {
    const [ads, setAds] = useState<AdEntry[]>([]);
    const [selectedAd, setSelectedAd] = useState<AdEntry | null>(null);
    const [resultsDocument, setResultsDocument] = useState('');
    const [extractedResults, setExtractedResults] = useState<ExtractedResultsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'select' | 'document' | 'preview' | 'saved'>('select');

    // Load ads from localStorage
    useEffect(() => {
        const storedAds = JSON.parse(localStorage.getItem('ads') || '[]');
        setAds(storedAds);
    }, []);

    // Parse results with AI
    const handleParseResults = async () => {
        if (!resultsDocument.trim()) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse-results',
                    data: { rawText: resultsDocument }
                })
            });

            const result = await response.json();

            if (result.success && result.data) {
                setExtractedResults(result.data);
                setStep('preview');
            } else {
                // Fallback extraction
                const fallback = fallbackResultsExtraction(resultsDocument);
                setExtractedResults(fallback);
                setStep('preview');
            }
        } catch (error) {
            console.error('Error parsing results:', error);
            const fallback = fallbackResultsExtraction(resultsDocument);
            setExtractedResults(fallback);
            setStep('preview');
        }
        setIsLoading(false);
    };

    // Fallback extraction
    const fallbackResultsExtraction = (text: string): ExtractedResultsData => {
        const lower = text.toLowerCase();

        const spendMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:spent|spend)/i);
        const impressionsMatch = text.match(/([\d,]+)k?\s*(?:impressions|impr)/i);
        const clicksMatch = text.match(/([\d,]+)\s*(?:clicks)/i);
        const ctrMatch = text.match(/([\d.]+)%?\s*(?:ctr)/i);
        const revenueMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:revenue)/i);
        const roasMatch = text.match(/([\d.]+)x?\s*(?:roas)/i);

        const adSpend = spendMatch ? parseFloat(spendMatch[1].replace(/,/g, '')) : 0;
        const impressions = impressionsMatch ? parseFloat(impressionsMatch[1].replace(/,/g, '')) * (text.includes('k') ? 1000 : 1) : 0;
        const clicks = clicksMatch ? parseFloat(clicksMatch[1].replace(/,/g, '')) : 0;
        const ctr = ctrMatch ? parseFloat(ctrMatch[1]) : (impressions > 0 ? (clicks / impressions) * 100 : 0);
        const revenue = revenueMatch ? parseFloat(revenueMatch[1].replace(/,/g, '')) : undefined;
        const roas = roasMatch ? parseFloat(roasMatch[1]) : (revenue && adSpend > 0 ? revenue / adSpend : undefined);

        let successScore = 50;
        if (ctr > 4) successScore += 20;
        else if (ctr > 2) successScore += 10;
        if (roas && roas > 3) successScore += 25;
        else if (roas && roas > 2) successScore += 15;

        return {
            platform: lower.includes('tiktok') ? 'tiktok' : lower.includes('instagram') ? 'instagram' : 'other',
            adSpend,
            impressions,
            clicks,
            ctr: Math.round(ctr * 100) / 100,
            revenue,
            roas: roas ? Math.round(roas * 100) / 100 : undefined,
            successScore: Math.min(100, successScore),
            extractionConfidence: 30
        };
    };

    // Save results
    const handleSave = () => {
        if (!selectedAd || !extractedResults) return;

        const updatedAds = ads.map(ad => {
            if (ad.id === selectedAd.id) {
                return {
                    ...ad,
                    resultsDocument,
                    extractedResults,
                    hasResults: true,
                    successScore: extractedResults.successScore,
                    updatedAt: new Date().toISOString()
                };
            }
            return ad;
        });

        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setStep('saved');
    };

    // Reset
    const handleReset = () => {
        setSelectedAd(null);
        setResultsDocument('');
        setExtractedResults(null);
        setStep('select');
        const storedAds = JSON.parse(localStorage.getItem('ads') || '[]');
        setAds(storedAds);
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>📊 Add Results</h1>
                <p className={styles.subtitle}>Add performance data to your ads for AI analysis</p>
            </header>

            {/* Step 1: Select Ad */}
            {step === 'select' && (
                <div className={styles.selectSection}>
                    <h2>Select an Ad to Add Results</h2>

                    {ads.length === 0 ? (
                        <div className={`glass-card ${styles.emptyState}`}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            <h3>No Ads Yet</h3>
                            <p>Upload ads first, then come back to add results.</p>
                            <a href="/upload" className="btn btn-primary">📤 Upload Ad</a>
                        </div>
                    ) : (
                        <div className={styles.adsGrid}>
                            {ads.map(ad => (
                                <div
                                    key={ad.id}
                                    className={`glass-card ${styles.adCard} ${ad.hasResults ? styles.hasResults : ''}`}
                                    onClick={() => {
                                        setSelectedAd(ad);
                                        setStep('document');
                                    }}
                                >
                                    <div className={styles.adThumbnail}>
                                        {ad.mediaType === 'video' ? (
                                            <video src={ad.mediaUrl} />
                                        ) : (
                                            <img src={ad.mediaUrl} alt={ad.extractedContent?.title} />
                                        )}
                                        <span className={styles.mediaBadge}>{ad.mediaType}</span>
                                    </div>
                                    <div className={styles.adInfo}>
                                        <h3>{ad.extractedContent?.title || 'Untitled'}</h3>
                                        <div className={styles.adMeta}>
                                            <span className="badge">{ad.extractedContent?.platform}</span>
                                            <span className="badge">{ad.extractedContent?.hookType}</span>
                                        </div>
                                        {ad.hasResults ? (
                                            <div className={styles.resultsStatus}>
                                                <span className="badge badge-success">✓ Has Results</span>
                                                <span className={styles.successScore}>{ad.successScore}%</span>
                                            </div>
                                        ) : (
                                            <span className="badge badge-warning">Needs Results</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Results Document */}
            {step === 'document' && selectedAd && (
                <div className={styles.documentSection}>
                    <div className={`glass-card ${styles.selectedAdCard}`}>
                        <h3>Selected Ad</h3>
                        <div className={styles.selectedAdPreview}>
                            {selectedAd.mediaType === 'video' ? (
                                <video src={selectedAd.mediaUrl} controls />
                            ) : (
                                <img src={selectedAd.mediaUrl} alt="" />
                            )}
                        </div>
                        <h4>{selectedAd.extractedContent?.title}</h4>
                        <div className={styles.adMeta}>
                            <span className="badge">{selectedAd.extractedContent?.platform}</span>
                            <span className="badge">{selectedAd.extractedContent?.hookType}</span>
                        </div>
                    </div>

                    <div className={`glass-card ${styles.documentCard}`}>
                        <h3>📊 Results Description</h3>
                        <p>Describe the performance of this ad. Include all metrics you have.</p>

                        <div className={styles.documentHints}>
                            <h4>Include metrics like:</h4>
                            <ul>
                                <li>💰 Ad spend and revenue</li>
                                <li>📈 Impressions, reach, clicks</li>
                                <li>🎯 CTR, conversions, ROAS</li>
                                <li>❤️ Engagement (likes, comments, shares)</li>
                                <li>📅 Date range and best performing times</li>
                                <li>💡 Any observations or insights</li>
                            </ul>
                        </div>

                        <textarea
                            className={styles.documentTextarea}
                            placeholder={`Example: Ran this ad on TikTok from Dec 1-15, 2024

Total spend: $500
Impressions: 125,000
Clicks: 5,200
CTR: 4.16%

Conversions: 85
Revenue: $2,100
ROAS: 4.2x

Engagement:
- 12,500 likes
- 856 comments
- 2,100 shares
- 950 saves

Best performing day was Thursday evening. 
Younger audience (18-24) converted better.
Comments mentioned they loved the hook.`}
                            value={resultsDocument}
                            onChange={(e) => setResultsDocument(e.target.value)}
                            rows={12}
                        />

                        <div className={styles.documentActions}>
                            <button className="btn btn-secondary" onClick={() => setStep('select')}>
                                ← Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleParseResults}
                                disabled={isLoading || !resultsDocument.trim()}
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                                        </svg>
                                        AI Analyzing...
                                    </>
                                ) : '🤖 Extract Metrics'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && extractedResults && (
                <div className={styles.previewSection}>
                    <div className={`glass-card ${styles.previewCard}`}>
                        <div className={styles.previewHeader}>
                            <h2>✅ Extracted Metrics</h2>
                            <div className={styles.successBadge}>
                                <span>Success Score</span>
                                <strong>{extractedResults.successScore}%</strong>
                            </div>
                        </div>

                        <div className={styles.metricsGrid}>
                            <div className={styles.metricCard}>
                                <span className={styles.metricLabel}>Ad Spend</span>
                                <span className={styles.metricValue}>${extractedResults.adSpend?.toLocaleString()}</span>
                            </div>
                            <div className={styles.metricCard}>
                                <span className={styles.metricLabel}>Impressions</span>
                                <span className={styles.metricValue}>{extractedResults.impressions?.toLocaleString()}</span>
                            </div>
                            <div className={styles.metricCard}>
                                <span className={styles.metricLabel}>Clicks</span>
                                <span className={styles.metricValue}>{extractedResults.clicks?.toLocaleString()}</span>
                            </div>
                            <div className={styles.metricCard}>
                                <span className={styles.metricLabel}>CTR</span>
                                <span className={`${styles.metricValue} ${extractedResults.ctr > 2 ? styles.positive : ''}`}>
                                    {extractedResults.ctr}%
                                </span>
                            </div>
                            {extractedResults.revenue && (
                                <div className={styles.metricCard}>
                                    <span className={styles.metricLabel}>Revenue</span>
                                    <span className={styles.metricValue}>${extractedResults.revenue?.toLocaleString()}</span>
                                </div>
                            )}
                            {extractedResults.roas && (
                                <div className={styles.metricCard}>
                                    <span className={styles.metricLabel}>ROAS</span>
                                    <span className={`${styles.metricValue} ${extractedResults.roas > 2 ? styles.positive : ''}`}>
                                        {extractedResults.roas}x
                                    </span>
                                </div>
                            )}
                        </div>

                        {extractedResults.notes && (
                            <div className={styles.notesSection}>
                                <h4>📝 Notes</h4>
                                <p>{extractedResults.notes}</p>
                            </div>
                        )}

                        <div className={styles.previewActions}>
                            <button className="btn btn-secondary" onClick={() => setStep('document')}>
                                ← Edit
                            </button>
                            <button className="btn btn-primary btn-lg" onClick={handleSave}>
                                💾 Save Results
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
                    <h2>Results Saved!</h2>
                    <p>The AI will now use this data to improve pattern detection.</p>

                    <div className={styles.savedActions}>
                        <button className="btn btn-secondary" onClick={handleReset}>
                            ➕ Add More Results
                        </button>
                        <a href="/mindmap" className="btn btn-primary">
                            🗺️ View Mind Map
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
