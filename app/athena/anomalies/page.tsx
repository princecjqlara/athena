'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Anomaly {
    id: string;
    anomaly_type: string;
    entity_type: string;
    entity_id: string;
    metric_name: string;
    expected_value: number;
    actual_value: number;
    deviation_pct: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'acknowledged' | 'resolved';
    detected_at: string;
    resolved_at?: string;
    context_json?: Record<string, unknown>;
}

interface AnomalySummary {
    total: number;
    open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export default function AnomaliesPage() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [summary, setSummary] = useState<AnomalySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');

    useEffect(() => {
        loadAnomalies();
    }, []);

    const loadAnomalies = async () => {
        try {
            const response = await fetch('/api/ai/anomalies?orgId=default');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setAnomalies(data.anomalies || []);
                    setSummary(data.summary);
                }
            }
        } catch (error) {
            console.error('Failed to load anomalies:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateAnomalyStatus = async (id: string, status: string) => {
        try {
            const response = await fetch('/api/ai/anomalies', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            if (response.ok) {
                setAnomalies(prev =>
                    prev.map(a => a.id === id ? { ...a, status: status as Anomaly['status'] } : a)
                );
                // Update summary
                if (summary) {
                    const updatedOpen = status === 'resolved' ? summary.open - 1 : summary.open;
                    setSummary({ ...summary, open: updatedOpen });
                }
            }
        } catch (error) {
            console.error('Failed to update anomaly:', error);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#ef4444';
            case 'high': return '#f59e0b';
            case 'medium': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return '#ef4444';
            case 'acknowledged': return '#f59e0b';
            case 'resolved': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return '🚨';
            case 'high': return '⚠️';
            case 'medium': return '📊';
            default: return 'ℹ️';
        }
    };

    const filteredAnomalies = anomalies.filter(a => {
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
        return true;
    });

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Link href="/athena" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: 'var(--spacing-sm)', display: 'inline-block' }}>
                    ← Back to Athena
                </Link>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    ⚠️ Anomaly Detection
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Automatically detected unusual patterns in your advertising data
                </p>
            </header>

            {/* Summary Cards */}
            {summary && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.total}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</div>
                    </div>
                    <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{summary.open}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open</div>
                    </div>
                    <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{summary.critical}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Critical</div>
                    </div>
                    <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{summary.high}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High</div>
                    </div>
                    <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>{summary.medium}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Medium</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">All</option>
                        <option value="open">Open</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="resolved">Resolved</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Severity</label>
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {filteredAnomalies.length} anomal{filteredAnomalies.length !== 1 ? 'ies' : 'y'}
                    </span>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                    Loading anomalies...
                </div>
            ) : filteredAnomalies.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>✓</div>
                    <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No Anomalies Detected</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Everything looks normal! Athena will alert you when unusual patterns are detected.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {filteredAnomalies.map(anomaly => (
                        <div
                            key={anomaly.id}
                            className="glass-card"
                            style={{
                                padding: 'var(--spacing-lg)',
                                borderLeft: `4px solid ${getSeverityColor(anomaly.severity)}`
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                        <span style={{ fontSize: '1.25rem' }}>{getSeverityIcon(anomaly.severity)}</span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: `${getSeverityColor(anomaly.severity)}20`,
                                            color: getSeverityColor(anomaly.severity),
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>
                                            {anomaly.severity}
                                        </span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: `${getStatusColor(anomaly.status)}20`,
                                            color: getStatusColor(anomaly.status),
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>
                                            {anomaly.status}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                                        {anomaly.anomaly_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {anomaly.entity_type}: {anomaly.entity_id.slice(0, 12)}...
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Deviation</div>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        color: anomaly.deviation_pct > 0 ? '#ef4444' : '#10b981'
                                    }}>
                                        {anomaly.deviation_pct > 0 ? '+' : ''}{anomaly.deviation_pct.toFixed(1)}%
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-md)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Metric</div>
                                    <div style={{ fontWeight: 600 }}>{anomaly.metric_name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expected</div>
                                    <div style={{ fontWeight: 600 }}>{anomaly.expected_value.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actual</div>
                                    <div style={{ fontWeight: 600, color: getSeverityColor(anomaly.severity) }}>
                                        {anomaly.actual_value.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Detected: {new Date(anomaly.detected_at).toLocaleString()}
                                </span>
                                {anomaly.status !== 'resolved' && (
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        {anomaly.status === 'open' && (
                                            <button
                                                onClick={() => updateAnomalyStatus(anomaly.id, 'acknowledged')}
                                                className="btn btn-secondary"
                                                style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                                            >
                                                Acknowledge
                                            </button>
                                        )}
                                        <button
                                            onClick={() => updateAnomalyStatus(anomaly.id, 'resolved')}
                                            className="btn btn-primary"
                                            style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                                        >
                                            Resolve
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
