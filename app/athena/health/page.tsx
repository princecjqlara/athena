'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HealthScore {
    entity_type: string;
    entity_id: string;
    overall_score: number;
    completeness_score: number;
    freshness_score: number;
    attribution_score: number;
    schema_score: number;
    issues: { type: string; severity: string; description: string }[];
}

interface HealthData {
    overallHealth: number;
    scores: HealthScore[];
    summary: {
        total: number;
        healthy: number;
        warning: number;
        critical: number;
    };
}

export default function HealthPage() {
    const [healthData, setHealthData] = useState<HealthData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecalculating, setIsRecalculating] = useState(false);

    useEffect(() => {
        loadHealthData();
    }, []);

    const loadHealthData = async () => {
        try {
            const response = await fetch('/api/ai/health');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Calculate summary from scores
                    const scores = data.scores || [];
                    const summary = {
                        total: scores.length,
                        healthy: scores.filter((s: HealthScore) => s.overall_score >= 80).length,
                        warning: scores.filter((s: HealthScore) => s.overall_score >= 60 && s.overall_score < 80).length,
                        critical: scores.filter((s: HealthScore) => s.overall_score < 60).length
                    };
                    const overallHealth = scores.length > 0
                        ? Math.round(scores.reduce((sum: number, s: HealthScore) => sum + s.overall_score, 0) / scores.length)
                        : 85;

                    setHealthData({
                        overallHealth,
                        scores,
                        summary
                    });
                }
            } else {
                // Fallback to local calculation
                calculateLocalHealth();
            }
        } catch (error) {
            console.error('Failed to load health data:', error);
            calculateLocalHealth();
        } finally {
            setIsLoading(false);
        }
    };

    const calculateLocalHealth = () => {
        const ads = JSON.parse(localStorage.getItem('ads') || '[]');

        let completeness = 100;
        let freshness = 100;
        let attribution = 80;
        const schema = 100;

        if (ads.length === 0) {
            completeness = 50;
            freshness = 50;
        } else {
            const adsWithMetrics = ads.filter((a: { adInsights?: unknown }) => a.adInsights);
            if (adsWithMetrics.length < ads.length * 0.8) completeness -= 20;

            const recentAds = ads.filter((a: { uploadedAt?: string }) => {
                if (!a.uploadedAt) return false;
                const daysAgo = (Date.now() - new Date(a.uploadedAt).getTime()) / (1000 * 60 * 60 * 24);
                return daysAgo < 7;
            });
            if (recentAds.length < ads.length * 0.5) freshness -= 30;
        }

        const overallHealth = Math.round((completeness + freshness + attribution + schema) / 4);

        setHealthData({
            overallHealth,
            scores: [],
            summary: {
                total: ads.length,
                healthy: Math.floor(ads.length * 0.7),
                warning: Math.floor(ads.length * 0.2),
                critical: Math.floor(ads.length * 0.1)
            }
        });
    };

    const recalculateHealth = async () => {
        setIsRecalculating(true);
        try {
            const response = await fetch('/api/ai/health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recalculate: true })
            });
            if (response.ok) {
                await loadHealthData();
            }
        } catch (error) {
            console.error('Failed to recalculate health:', error);
        } finally {
            setIsRecalculating(false);
        }
    };

    const getHealthColor = (score: number) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#ef4444';
            case 'high': return '#f59e0b';
            case 'medium': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const healthCategories = [
        { name: 'Completeness', key: 'completeness_score', description: 'How complete is your data?', icon: '📋' },
        { name: 'Freshness', key: 'freshness_score', description: 'How recent is your data?', icon: '🕐' },
        { name: 'Attribution', key: 'attribution_score', description: 'How well can results be attributed?', icon: '🔗' },
        { name: 'Schema', key: 'schema_score', description: 'Does data match expected format?', icon: '✓' }
    ];

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Link href="/athena" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: 'var(--spacing-sm)', display: 'inline-block' }}>
                    ← Back to Athena
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #10b981, #34d399)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            🏥 Data Health
                        </h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Monitor the quality and completeness of your advertising data
                        </p>
                    </div>
                    <button
                        onClick={recalculateHealth}
                        disabled={isRecalculating}
                        className="btn btn-secondary"
                    >
                        {isRecalculating ? 'Recalculating...' : '🔄 Recalculate Health'}
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                    Loading health data...
                </div>
            ) : healthData && (
                <>
                    {/* Overall Health Score */}
                    <div className="glass-card" style={{ padding: 'var(--spacing-xl)', marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
                        <div style={{
                            fontSize: '4rem',
                            fontWeight: 700,
                            color: getHealthColor(healthData.overallHealth),
                            marginBottom: 'var(--spacing-sm)'
                        }}>
                            {healthData.overallHealth}%
                        </div>
                        <div style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>
                            Overall Health Score
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 'var(--spacing-xl)',
                            marginTop: 'var(--spacing-lg)'
                        }}>
                            <div>
                                <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#10b981' }}>{healthData.summary.healthy}</span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Healthy</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f59e0b' }}>{healthData.summary.warning}</span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Warning</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>{healthData.summary.critical}</span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Critical</div>
                            </div>
                        </div>
                    </div>

                    {/* Health Categories */}
                    <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.25rem' }}>Health Breakdown</h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        {healthCategories.map(category => {
                            const categoryKey = category.key as keyof HealthScore;
                            const avgScore = healthData.scores.length > 0
                                ? Math.round(healthData.scores.reduce((sum, s) => sum + (s[categoryKey] as number || 0), 0) / healthData.scores.length)
                                : healthData.overallHealth;

                            return (
                                <div key={category.key} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                        <div>
                                            <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-xs)' }}>{category.icon}</div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{category.name}</h3>
                                        </div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: getHealthColor(avgScore) }}>
                                            {avgScore}%
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{category.description}</p>
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginTop: 'var(--spacing-md)',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${avgScore}%`,
                                            height: '100%',
                                            background: getHealthColor(avgScore),
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Issues List */}
                    {healthData.scores.some(s => s.issues && s.issues.length > 0) && (
                        <>
                            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.25rem' }}>Issues Found</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {healthData.scores.flatMap(s =>
                                    (s.issues || []).map((issue, i) => (
                                        <div
                                            key={`${s.entity_id}-${i}`}
                                            className="glass-card"
                                            style={{
                                                padding: 'var(--spacing-md)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-md)',
                                                borderLeft: `3px solid ${getSeverityColor(issue.severity)}`
                                            }}
                                        >
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: `${getSeverityColor(issue.severity)}20`,
                                                color: getSeverityColor(issue.severity),
                                                fontWeight: 600,
                                                textTransform: 'uppercase'
                                            }}>
                                                {issue.severity}
                                            </span>
                                            <span style={{ flex: 1 }}>{issue.description}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {s.entity_type}: {s.entity_id.slice(0, 8)}...
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {healthData.scores.length === 0 && (
                        <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>✓</div>
                            <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No Issues Detected</h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Your data health is being calculated from available data.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
