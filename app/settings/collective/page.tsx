'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './collective.css';

interface CISettings {
    user_id: string;
    opted_in: boolean;
    participation_mode: 'private' | 'contribute_receive' | 'receive_only';
    local_data_points: number;
    local_conversions: number;
    blend_ratio: number;
    collective_influence: number;
}

interface TopFeature {
    feature: string;
    liftPercentage: number;
    confidence: number;
    contributions: number;
}

interface CIStats {
    totalContributions: number;
    totalFeatures: number;
    avgConfidence: number;
    topFeatures: TopFeature[];
    surpriseFindings: Array<{ feature: string; insight: string }>;
}

export default function CollectiveIntelligencePage() {
    const [settings, setSettings] = useState<CISettings | null>(null);
    const [stats, setStats] = useState<CIStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string>('');

    // Get or create user ID from localStorage
    useEffect(() => {
        let id = localStorage.getItem('athena_user_id');
        if (!id) {
            id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('athena_user_id', id);
        }
        setUserId(id);
    }, []);

    // Fetch settings and stats
    useEffect(() => {
        if (!userId) return;

        const fetchData = async () => {
            try {
                const [settingsRes, statsRes] = await Promise.all([
                    fetch(`/api/collective/settings?userId=${userId}`),
                    fetch('/api/collective/stats'),
                ]);

                const settingsData = await settingsRes.json();
                const statsData = await statsRes.json();

                if (settingsData.success) {
                    setSettings(settingsData.data);
                }
                if (statsData.success) {
                    setStats(statsData.data);
                }
            } catch (error) {
                console.error('Error fetching CI data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    // Handle opt-in/out toggle
    const handleModeChange = async (mode: 'private' | 'contribute_receive' | 'receive_only') => {
        setSaving(true);
        try {
            const response = await fetch('/api/collective/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    optedIn: mode !== 'private',
                    participationMode: mode,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setSettings(data.data);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const getProgressWidth = () => {
        if (!settings) return 0;
        return Math.min((settings.local_data_points / 100) * 100, 100);
    };

    if (loading) {
        return (
            <div className="ci-page">
                <div className="ci-loading">Loading Collective Intelligence settings...</div>
            </div>
        );
    }

    return (
        <div className="ci-page">
            <div className="ci-header">
                <Link href="/settings" className="ci-back-link">← Back to Settings</Link>
                <h1>🧠 Collective Intelligence</h1>
                <p className="ci-subtitle">
                    Improve your ad predictions by learning from anonymized patterns across all Athena users.
                </p>
            </div>

            {/* Participation Mode */}
            <div className="ci-section">
                <h2>Participation Mode</h2>
                <div className="ci-mode-options">
                    <label className={`ci-mode-option ${settings?.participation_mode === 'private' ? 'selected' : ''}`}>
                        <input
                            type="radio"
                            name="mode"
                            value="private"
                            checked={settings?.participation_mode === 'private'}
                            onChange={() => handleModeChange('private')}
                            disabled={saving}
                        />
                        <div className="ci-mode-content">
                            <div className="ci-mode-title">🔒 Private Only</div>
                            <div className="ci-mode-desc">
                                Your data stays completely local. No contribution, no collective priors.
                            </div>
                        </div>
                    </label>

                    <label className={`ci-mode-option ${settings?.participation_mode === 'contribute_receive' ? 'selected' : ''}`}>
                        <input
                            type="radio"
                            name="mode"
                            value="contribute_receive"
                            checked={settings?.participation_mode === 'contribute_receive'}
                            onChange={() => handleModeChange('contribute_receive')}
                            disabled={saving}
                        />
                        <div className="ci-mode-content">
                            <div className="ci-mode-title">🤝 Contribute & Receive</div>
                            <div className="ci-mode-desc">
                                Share anonymized feature signals and get collective priors to improve predictions.
                            </div>
                            <div className="ci-mode-recommended">Recommended</div>
                        </div>
                    </label>

                    <label className={`ci-mode-option ${settings?.participation_mode === 'receive_only' ? 'selected' : ''}`}>
                        <input
                            type="radio"
                            name="mode"
                            value="receive_only"
                            checked={settings?.participation_mode === 'receive_only'}
                            onChange={() => handleModeChange('receive_only')}
                            disabled={saving}
                        />
                        <div className="ci-mode-content">
                            <div className="ci-mode-title">📥 Receive Only</div>
                            <div className="ci-mode-desc">
                                Benefit from collective priors without contributing your own data.
                            </div>
                        </div>
                    </label>
                </div>
            </div>

            {/* Blend Ratio */}
            <div className="ci-section">
                <h2>📊 Your Collective Influence</h2>
                <div className="ci-blend-info">
                    <div className="ci-blend-stats">
                        <div className="ci-stat">
                            <span className="ci-stat-value">{settings?.local_data_points || 0}</span>
                            <span className="ci-stat-label">Local Data Points</span>
                        </div>
                        <div className="ci-stat">
                            <span className="ci-stat-value">{settings?.local_conversions || 0}</span>
                            <span className="ci-stat-label">Conversions</span>
                        </div>
                        <div className="ci-stat">
                            <span className="ci-stat-value">{settings?.collective_influence || 80}%</span>
                            <span className="ci-stat-label">Collective Influence</span>
                        </div>
                    </div>

                    <div className="ci-progress-container">
                        <div className="ci-progress-bar">
                            <div
                                className="ci-progress-fill"
                                style={{ width: `${getProgressWidth()}%` }}
                            />
                        </div>
                        <div className="ci-progress-labels">
                            <span>{settings?.local_data_points || 0} / 100</span>
                            <span>Data points to full local control</span>
                        </div>
                    </div>

                    <p className="ci-blend-explanation">
                        Once you reach 100 conversions, collective priors will have less than 5% influence.
                        Your unique patterns will dominate the predictions.
                    </p>
                </div>
            </div>

            {/* Collective Insights */}
            {stats && settings?.participation_mode !== 'private' && (
                <div className="ci-section">
                    <h2>📈 Collective Insights</h2>
                    <div className="ci-insights">
                        <div className="ci-insights-header">
                            <span>🌐 {stats.totalContributions} total contributions</span>
                            <span>📊 {stats.totalFeatures} features tracked</span>
                        </div>

                        <div className="ci-top-features">
                            <h3>Top Performing Features (Collective)</h3>
                            {stats.topFeatures.length > 0 ? (
                                <ul>
                                    {stats.topFeatures.slice(0, 5).map((f, i) => (
                                        <li key={f.feature}>
                                            <span className="ci-feature-rank">{i + 1}.</span>
                                            <span className="ci-feature-name">{f.feature}</span>
                                            <span className="ci-feature-lift">+{f.liftPercentage.toFixed(1)}% lift</span>
                                            <span className="ci-feature-icon">📈</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="ci-no-data">Not enough data yet. Be among the first to contribute!</p>
                            )}
                        </div>

                        {stats.surpriseFindings.length > 0 && (
                            <div className="ci-surprises">
                                <h3>Surprising Findings</h3>
                                <ul>
                                    {stats.surpriseFindings.map((s, i) => (
                                        <li key={i}>💡 {s.insight}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Privacy Info */}
            <div className="ci-section ci-privacy">
                <h2>🔐 What Data Is Shared</h2>
                <div className="ci-privacy-content">
                    <div className="ci-privacy-shared">
                        <h4>✅ Shared (Anonymized)</h4>
                        <ul>
                            <li>Feature weight changes after conversions</li>
                            <li>Feature-to-outcome correlations</li>
                            <li>Confidence scores</li>
                            <li>Surprise signals (when predictions were wrong)</li>
                        </ul>
                    </div>
                    <div className="ci-privacy-never">
                        <h4>❌ Never Shared</h4>
                        <ul>
                            <li>Raw creatives, ad copy, or media</li>
                            <li>Spend, ROAS, or revenue data</li>
                            <li>Your identity or account info</li>
                            <li>Campaign or ad names</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
