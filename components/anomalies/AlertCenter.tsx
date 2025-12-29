/**
 * AlertCenter Component
 * Shows anomalies with severity badges and actions
 */

'use client';

import { useState, useEffect } from 'react';
import styles from './AlertCenter.module.css';

interface Anomaly {
    id: string;
    anomaly_type: string;
    entity_type: string;
    entity_id: string;
    metric_name: string;
    expected_value: number;
    actual_value: number;
    deviation_pct: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: string;
    detected_at: string;
    context_json?: {
        trend?: string;
        recent_changes?: string[];
    };
}

interface AlertCenterProps {
    orgId: string;
    userId: string;
    maxItems?: number;
}

const SEVERITY_CONFIG = {
    critical: { emoji: '🚨', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' },
    high: { emoji: '⚠️', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    medium: { emoji: '⚡', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    low: { emoji: 'ℹ️', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' }
};

const TYPE_LABELS: Record<string, string> = {
    spend_spike: 'Spend Spike',
    cpa_spike: 'CPA Spike',
    roas_drop: 'ROAS Drop',
    ctr_drop: 'CTR Drop',
    cvr_drop: 'CVR Drop',
    tracking_break: 'Tracking Issue',
    creative_fatigue: 'Creative Fatigue',
    conversions_drop: 'Conversion Drop'
};

export default function AlertCenter({ orgId, userId, maxItems = 10 }: AlertCenterProps) {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [summary, setSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

    useEffect(() => {
        fetchAnomalies();
    }, [orgId]);

    const fetchAnomalies = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/ai/anomalies?orgId=${orgId}&status=open&limit=${maxItems}`);
            const data = await res.json();

            if (data.success) {
                setAnomalies(data.anomalies || []);
                setSummary(data.summary || { critical: 0, high: 0, medium: 0, low: 0, total: 0 });
            }
        } catch (error) {
            console.error('Error fetching anomalies:', error);
        } finally {
            setLoading(false);
        }
    };

    const runDetection = async () => {
        try {
            setDetecting(true);

            // Import and run detection
            const { runAnomalyDetection } = await import('@/lib/ai/anomaly-detection');
            const detected = await runAnomalyDetection(orgId);

            if (detected.length > 0) {
                // Save to database
                await fetch('/api/ai/anomalies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orgId, anomalies: detected })
                });
            }

            fetchAnomalies();
        } catch (error) {
            console.error('Error running detection:', error);
        } finally {
            setDetecting(false);
        }
    };

    const handleAcknowledge = async (id: string) => {
        try {
            await fetch('/api/ai/anomalies', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'acknowledged', acknowledgedBy: userId })
            });
            fetchAnomalies();
        } catch (error) {
            console.error('Error acknowledging:', error);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await fetch('/api/ai/anomalies', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'resolved' })
            });
            fetchAnomalies();
        } catch (error) {
            console.error('Error resolving:', error);
        }
    };

    const filteredAnomalies = anomalies.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'critical') return a.severity === 'critical';
        if (filter === 'high') return a.severity === 'critical' || a.severity === 'high';
        return true;
    });

    const hasCritical = summary.critical > 0;

    return (
        <div className={`${styles.alertCenter} ${hasCritical ? styles.hasCritical : ''}`}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h2 className={styles.title}>
                        {hasCritical ? '🚨' : '📊'} Alert Center
                    </h2>
                    <div className={styles.badges}>
                        {summary.critical > 0 && (
                            <span className={styles.criticalBadge}>
                                {summary.critical} Critical
                            </span>
                        )}
                        {summary.high > 0 && (
                            <span className={styles.highBadge}>
                                {summary.high} High
                            </span>
                        )}
                        {summary.total > 0 && (
                            <span className={styles.totalBadge}>
                                {summary.total} Total
                            </span>
                        )}
                    </div>
                </div>
                <div className={styles.actions}>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as 'all' | 'critical' | 'high')}
                        className={styles.filterSelect}
                    >
                        <option value="all">All Alerts</option>
                        <option value="critical">Critical Only</option>
                        <option value="high">High & Critical</option>
                    </select>
                    <button
                        className={styles.detectBtn}
                        onClick={runDetection}
                        disabled={detecting}
                    >
                        {detecting ? '🔍 Scanning...' : '🔍 Scan Now'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {loading ? (
                    <div className={styles.loading}>Loading alerts...</div>
                ) : filteredAnomalies.length === 0 ? (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>✅</span>
                        <h3>All Clear!</h3>
                        <p>No anomalies detected. Your campaigns are performing normally.</p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {filteredAnomalies.map(anomaly => (
                            <div
                                key={anomaly.id}
                                className={`${styles.alertCard} ${styles[anomaly.severity]}`}
                            >
                                <div className={styles.alertHeader}>
                                    <span className={styles.alertIcon}>
                                        {SEVERITY_CONFIG[anomaly.severity].emoji}
                                    </span>
                                    <span className={styles.alertType}>
                                        {TYPE_LABELS[anomaly.anomaly_type] || anomaly.anomaly_type}
                                    </span>
                                    <span
                                        className={styles.severityBadge}
                                        style={{
                                            background: SEVERITY_CONFIG[anomaly.severity].bg,
                                            color: SEVERITY_CONFIG[anomaly.severity].color
                                        }}
                                    >
                                        {anomaly.severity.toUpperCase()}
                                    </span>
                                </div>

                                <div className={styles.alertBody}>
                                    <div className={styles.metric}>
                                        <span className={styles.metricLabel}>{anomaly.metric_name}</span>
                                        <span className={styles.metricChange}>
                                            {anomaly.deviation_pct > 0 ? '↑' : '↓'}
                                            {Math.abs(anomaly.deviation_pct).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className={styles.values}>
                                        <span>Expected: {anomaly.expected_value.toFixed(2)}</span>
                                        <span>Actual: {anomaly.actual_value.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.entityInfo}>
                                        {anomaly.entity_type}: {anomaly.entity_id.slice(0, 8)}...
                                    </div>
                                </div>

                                <div className={styles.alertActions}>
                                    <button
                                        className={styles.acknowledgeBtn}
                                        onClick={() => handleAcknowledge(anomaly.id)}
                                    >
                                        👁️ Acknowledge
                                    </button>
                                    <button
                                        className={styles.resolveBtn}
                                        onClick={() => handleResolve(anomaly.id)}
                                    >
                                        ✓ Resolve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
