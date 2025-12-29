'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface AthenaStats {
    recommendations: number;
    anomalies: number;
    dataHealthScore: number;
    agentRuns: number;
}

export default function AthenaPage() {
    const [stats, setStats] = useState<AthenaStats>({
        recommendations: 0,
        anomalies: 0,
        dataHealthScore: 85,
        agentRuns: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    // Load stats from API or calculate from local data
    useEffect(() => {
        const loadStats = async () => {
            try {
                // Try to fetch from API
                const response = await fetch('/api/athena/stats');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setStats(data.stats);
                    }
                }
            } catch (error) {
                console.log('Using local data for stats');
                // Calculate local stats from localStorage
                const ads = JSON.parse(localStorage.getItem('ads') || '[]');
                const leads = JSON.parse(localStorage.getItem('leads') || '[]');

                // Calculate data health based on completeness
                let dataHealth = 100;
                if (ads.length === 0) dataHealth -= 30;
                if (leads.length === 0) dataHealth -= 20;
                // Check for missing metrics
                const adsWithMetrics = ads.filter((a: { adInsights?: unknown }) => a.adInsights);
                if (adsWithMetrics.length < ads.length * 0.8) dataHealth -= 20;

                setStats({
                    recommendations: Math.floor(ads.length / 3), // Simulated recommendations
                    anomalies: Math.floor(Math.random() * 3), // Simulated anomalies
                    dataHealthScore: Math.max(50, dataHealth),
                    agentRuns: ads.length > 0 ? Math.floor(ads.length / 2) : 0
                });
            }
            setIsLoading(false);
        };

        loadStats();
    }, []);

    const features = [
        {
            id: 'recommendations',
            title: '💡 AI Recommendations',
            description: 'Get actionable suggestions to improve your ad performance based on historical data and patterns.',
            stat: stats.recommendations,
            statLabel: 'Active Recommendations',
            color: '#3b82f6',
            link: '/athena/recommendations',
            icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            )
        },
        {
            id: 'data-health',
            title: '🏥 Data Health',
            description: 'Monitor the completeness and quality of your ad data for more accurate predictions.',
            stat: `${stats.dataHealthScore}%`,
            statLabel: 'Health Score',
            color: stats.dataHealthScore >= 80 ? '#10b981' : stats.dataHealthScore >= 60 ? '#f59e0b' : '#ef4444',
            link: '/athena/health',
            icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
            )
        },
        {
            id: 'anomalies',
            title: '⚠️ Anomaly Detection',
            description: 'Automatically detect unusual patterns in your ad spending, performance, or conversions.',
            stat: stats.anomalies,
            statLabel: 'Active Alerts',
            color: stats.anomalies > 0 ? '#ef4444' : '#10b981',
            link: '/athena/anomalies',
            icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            )
        },
        {
            id: 'agent-activity',
            title: '🤖 Agent Activity',
            description: 'View the history of AI agent runs, analyses, and their reasoning chains.',
            stat: stats.agentRuns,
            statLabel: 'Total Runs',
            color: '#8b5cf6',
            link: '/athena/activity',
            icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00-1.32 4.24 3 3 0 00.34 5.58 2.5 2.5 0 002.96 3.08A2.5 2.5 0 0012 19.5" />
                    <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0112 19.5" />
                </svg>
            )
        },
        {
            id: 'predictions',
            title: '🎯 Predictions',
            description: 'See AI predictions for ad performance, best posting times, and audience segments.',
            stat: '📊',
            statLabel: 'View Predictions',
            color: '#14b8a6',
            link: '/predict',
            icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            )
        },
        {
            id: 'prompts',
            title: '📝 Prompt Versions',
            description: 'Manage and A/B test different AI prompt configurations for better recommendations.',
            stat: '⚙️',
            statLabel: 'Configure',
            color: '#f59e0b',
            link: '/athena/prompts',
            icon: (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
            )
        }
    ];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        🧠 Athena Intelligence
                    </h1>
                    <p className={styles.subtitle}>
                        AI-powered insights, recommendations, and analytics for your advertising
                    </p>
                </div>
            </header>

            {/* Quick Stats Overview */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <span className={styles.statValue} style={{ color: '#3b82f6' }}>
                        {isLoading ? '...' : stats.recommendations}
                    </span>
                    <span className={styles.statLabel}>Recommendations</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={styles.statValue} style={{
                        color: stats.dataHealthScore >= 80 ? '#10b981' : stats.dataHealthScore >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                        {isLoading ? '...' : `${stats.dataHealthScore}%`}
                    </span>
                    <span className={styles.statLabel}>Data Health</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={styles.statValue} style={{ color: stats.anomalies > 0 ? '#ef4444' : '#10b981' }}>
                        {isLoading ? '...' : stats.anomalies}
                    </span>
                    <span className={styles.statLabel}>Active Alerts</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={styles.statValue} style={{ color: '#8b5cf6' }}>
                        {isLoading ? '...' : stats.agentRuns}
                    </span>
                    <span className={styles.statLabel}>Agent Runs</span>
                </div>
            </div>

            {/* Feature Cards */}
            <div className={styles.featureGrid}>
                {features.map(feature => (
                    <Link key={feature.id} href={feature.link} style={{ textDecoration: 'none' }}>
                        <div
                            className={`glass-card ${styles.featureCard}`}
                            style={{
                                borderColor: `${feature.color}30`,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div className={styles.featureHeader}>
                                <div
                                    className={styles.featureIcon}
                                    style={{
                                        background: `${feature.color}20`,
                                        color: feature.color
                                    }}
                                >
                                    {feature.icon}
                                </div>
                                <div className={styles.featureStat}>
                                    <span
                                        className={styles.featureStatValue}
                                        style={{ color: feature.color }}
                                    >
                                        {isLoading ? '...' : feature.stat}
                                    </span>
                                    <span className={styles.featureStatLabel}>
                                        {feature.statLabel}
                                    </span>
                                </div>
                            </div>
                            <h3 className={styles.featureTitle}>{feature.title}</h3>
                            <p className={styles.featureDescription}>{feature.description}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    ⚡ Quick Actions
                </h3>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                    <Link href="/import" className="btn btn-primary">
                        📥 Import Ads from Facebook
                    </Link>
                    <Link href="/predict" className="btn btn-secondary">
                        🎯 Get Predictions
                    </Link>
                    <Link href="/mindmap" className="btn btn-secondary">
                        🗺️ View Algorithm
                    </Link>
                    <Link href="/settings/collective" className="btn btn-ghost">
                        🧠 Collective Intelligence
                    </Link>
                </div>
            </div>
        </div>
    );
}
