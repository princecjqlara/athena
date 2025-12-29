/**
 * AlertCenter Component
 * Shows anomalies with severity badges and actions
 * Now with AUTO-SCANNING support!
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
    autoScanEnabled?: boolean;
    autoScanIntervalMinutes?: number;
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

// Auto-scan interval options (in minutes)
const SCAN_INTERVAL_OPTIONS = [
    { value: 1, label: '1 min' },
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour' }
];

export default function AlertCenter({
    orgId,
    userId,
    maxItems = 10,
    autoScanEnabled: initialAutoScan = true,
    autoScanIntervalMinutes: initialInterval = 5
}: AlertCenterProps) {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [summary, setSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

    // Auto-scan state
    const [autoScanActive, setAutoScanActive] = useState(initialAutoScan);
    const [scanInterval, setScanInterval] = useState(initialInterval);
    const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
    const [nextScanIn, setNextScanIn] = useState<number>(0);
    const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch anomalies on mount
    useEffect(() => {
        fetchAnomalies();
    }, [orgId]);

    // Setup auto-scan interval
    useEffect(() => {
        if (autoScanActive && orgId) {
            // Run initial scan
            runDetection(true);

            // Setup interval
            const intervalMs = scanInterval * 60 * 1000;
            autoScanTimerRef.current = setInterval(() => {
                runDetection(true);
            }, intervalMs);

            // Setup countdown
            setNextScanIn(scanInterval * 60);
            countdownTimerRef.current = setInterval(() => {
                setNextScanIn(prev => {
                    if (prev <= 1) return scanInterval * 60;
                    return prev - 1;
                });
            }, 1000);

            return () => {
                if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            };
        } else {
            // Clear timers when auto-scan is disabled
            if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setNextScanIn(0);
        }
    }, [autoScanActive, scanInterval, orgId]);

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

    const runDetection = async (isAutoScan: boolean = false) => {
        // Skip if already detecting
        if (detecting) return;

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

            // Update last scan time
            setLastScanTime(new Date());

            // Reset countdown
            if (autoScanActive) {
                setNextScanIn(scanInterval * 60);
            }

            fetchAnomalies();
        } catch (error) {
            console.error('Error running detection:', error);
        } finally {
            setDetecting(false);
        }
    };

    // Format countdown time
    const formatCountdown = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format last scan time
    const formatLastScan = (date: Date | null): string => {
        if (!date) return 'Never';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins === 1) return '1 min ago';
        if (diffMins < 60) return `${diffMins} mins ago`;
        return date.toLocaleTimeString();
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
                        onClick={() => runDetection(false)}
                        disabled={detecting}
                    >
                        {detecting ? '🔍 Scanning...' : '🔍 Scan Now'}
                    </button>
                </div>
            </div>

            {/* Auto-Scan Controls */}
            <div className={styles.autoScanBar}>
                <div className={styles.autoScanToggle}>
                    <label className={styles.toggleLabel}>
                        <input
                            type="checkbox"
                            checked={autoScanActive}
                            onChange={(e) => setAutoScanActive(e.target.checked)}
                            className={styles.toggleInput}
                        />
                        <span className={styles.toggleSlider}></span>
                        <span className={styles.toggleText}>Auto-Scan</span>
                    </label>
                </div>

                {autoScanActive && (
                    <>
                        <div className={styles.intervalSelector}>
                            <span className={styles.intervalLabel}>Every:</span>
                            <select
                                value={scanInterval}
                                onChange={(e) => setScanInterval(Number(e.target.value))}
                                className={styles.intervalSelect}
                            >
                                {SCAN_INTERVAL_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.scanStatus}>
                            <span className={styles.statusDot}></span>
                            <span className={styles.nextScan}>
                                Next: {formatCountdown(nextScanIn)}
                            </span>
                        </div>
                    </>
                )}

                <div className={styles.lastScan}>
                    Last: {formatLastScan(lastScanTime)}
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
