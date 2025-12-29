/**
 * DataHealthBadge Component
 * Shows data quality indicator (green/yellow/red)
 */

'use client';

import { useState } from 'react';
import styles from './DataHealthBadge.module.css';

interface Issue {
    type: string;
    severity: string;
    description: string;
}

interface DataHealthBadgeProps {
    score: number;          // 0-100
    issues?: Issue[];
    showDetails?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export default function DataHealthBadge({
    score,
    issues = [],
    showDetails = false,
    size = 'medium'
}: DataHealthBadgeProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const status = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';
    const statusLabel = score >= 80 ? 'Healthy' : score >= 50 ? 'Warning' : 'Critical';
    const statusIcon = score >= 80 ? '✓' : score >= 50 ? '⚠' : '✕';

    return (
        <div className={`${styles.badge} ${styles[status]} ${styles[size]}`}>
            <div
                className={styles.content}
                onClick={() => showDetails && setIsExpanded(!isExpanded)}
                style={{ cursor: showDetails ? 'pointer' : 'default' }}
            >
                <span className={styles.icon}>{statusIcon}</span>
                <span className={styles.score}>{score}</span>
                {size !== 'small' && (
                    <span className={styles.label}>{statusLabel}</span>
                )}
            </div>

            {/* Expanded Details */}
            {showDetails && isExpanded && issues.length > 0 && (
                <div className={styles.details}>
                    <h4>Issues</h4>
                    <ul>
                        {issues.map((issue, idx) => (
                            <li key={idx} className={styles[issue.severity]}>
                                <span className={styles.issueType}>{issue.type}</span>
                                <span className={styles.issueDesc}>{issue.description}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// Mini version for inline use
export function HealthDot({ score }: { score: number }) {
    const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <span
            className={styles.dot}
            style={{ backgroundColor: color }}
            title={`Health: ${score}/100`}
        />
    );
}
