'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Recommendation {
    id: string;
    recommendation_type: string;
    entity_type: string;
    entity_id: string;
    title: string;
    description: string;
    confidence_score: number;
    status: string;
    created_at: string;
    expires_at: string;
    reasoning_steps?: string[];
    action_json?: Record<string, unknown>;
}

export default function RecommendationsPage() {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
    const [entityFilter, setEntityFilter] = useState<string>('all');

    useEffect(() => {
        loadRecommendations();
    }, []);

    const loadRecommendations = async () => {
        try {
            const response = await fetch('/api/ai/recommendations');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setRecommendations(data.recommendations || []);
                }
            }
        } catch (error) {
            console.error('Failed to load recommendations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            const response = await fetch('/api/ai/recommendations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            if (response.ok) {
                setRecommendations(prev =>
                    prev.map(r => r.id === id ? { ...r, status } : r)
                );
            }
        } catch (error) {
            console.error('Failed to update recommendation:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted': return '#10b981';
            case 'rejected': return '#ef4444';
            case 'expired': return '#6b7280';
            default: return '#f59e0b';
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 0.8) return '#10b981';
        if (score >= 0.6) return '#f59e0b';
        return '#ef4444';
    };

    const filteredRecommendations = recommendations.filter(r => {
        if (filter !== 'all' && r.status !== filter) return false;
        if (entityFilter !== 'all' && r.entity_type !== entityFilter) return false;
        return true;
    });

    const entityTypes = [...new Set(recommendations.map(r => r.entity_type))];

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Link href="/athena" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: 'var(--spacing-sm)', display: 'inline-block' }}>
                    ← Back to Athena
                </Link>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    💡 AI Recommendations
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Actionable suggestions to improve your ad performance
                </p>
            </header>

            {/* Filters */}
            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Status</label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as typeof filter)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Entity Type</label>
                    <select
                        value={entityFilter}
                        onChange={(e) => setEntityFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">All Types</option>
                        {entityTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {filteredRecommendations.length} recommendation{filteredRecommendations.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                    Loading recommendations...
                </div>
            ) : filteredRecommendations.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>💡</div>
                    <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No Recommendations Yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-lg)' }}>
                        AI recommendations will appear here as Athena analyzes your data.
                    </p>
                    <Link href="/import" className="btn btn-primary">
                        Import Ads to Get Started
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {filteredRecommendations.map(rec => (
                        <div key={rec.id} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: `${getStatusColor(rec.status)}20`,
                                            color: getStatusColor(rec.status),
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>
                                            {rec.status}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {rec.entity_type}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{rec.title}</h3>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        color: getConfidenceColor(rec.confidence_score)
                                    }}>
                                        {Math.round((rec.confidence_score || 0) * 100)}%
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence</div>
                                </div>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)', lineHeight: 1.6 }}>
                                {rec.description}
                            </p>

                            {rec.reasoning_steps && rec.reasoning_steps.length > 0 && (
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Reasoning:</div>
                                    <ul style={{ paddingLeft: 'var(--spacing-lg)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        {rec.reasoning_steps.map((step, i) => (
                                            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{step}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Created: {new Date(rec.created_at).toLocaleDateString()}
                                </span>
                                {rec.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <button
                                            onClick={() => updateStatus(rec.id, 'accepted')}
                                            className="btn btn-primary"
                                            style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                                        >
                                            ✓ Accept
                                        </button>
                                        <button
                                            onClick={() => updateStatus(rec.id, 'rejected')}
                                            className="btn btn-ghost"
                                            style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
