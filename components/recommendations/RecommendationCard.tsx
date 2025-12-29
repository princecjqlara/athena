/**
 * RecommendationCard Component
 * Displays AI recommendations with confidence, evidence, and feedback actions
 */

'use client';

import { useState } from 'react';
import styles from './RecommendationCard.module.css';

interface Recommendation {
    id: string;
    title: string;
    description?: string;
    recommendation_type: string;
    entity_type: string;
    entity_id: string;
    confidence_score: number;
    evidence_json?: {
        data_points?: number;
        variance?: string;
        completeness?: number;
        sources?: string[];
    };
    action_json: {
        type: string;
        current_value?: string | number;
        proposed_value?: string | number;
        change_pct?: number;
        expected_impact?: {
            metric: string;
            direction: string;
            magnitude: string;
        };
    };
    status: string;
    created_at: string;
}

interface RecommendationCardProps {
    recommendation: Recommendation;
    onAccept?: (id: string) => void;
    onReject?: (id: string, reason: string) => void;
    onApply?: (id: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
    budget: '💰',
    creative: '🎨',
    audience: '👥',
    pause: '⏸️',
    scale: '📈',
    default: '💡'
};

const CONFIDENCE_COLORS: Record<string, string> = {
    high: '#22c55e',
    medium: '#f59e0b',
    low: '#ef4444'
};

export default function RecommendationCard({
    recommendation,
    onAccept,
    onReject,
    onApply
}: RecommendationCardProps) {
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [showReasoning, setShowReasoning] = useState(false);

    const confidence = recommendation.confidence_score || 0;
    const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
    const icon = TYPE_ICONS[recommendation.recommendation_type] || TYPE_ICONS.default;
    const evidence = recommendation.evidence_json || {};
    const action = recommendation.action_json || {};

    const handleReject = () => {
        if (onReject && feedback.trim()) {
            onReject(recommendation.id, feedback);
            setShowFeedback(false);
            setFeedback('');
        }
    };

    return (
        <div className={styles.card}>
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.icon}>{icon}</span>
                <h3 className={styles.title}>{recommendation.title}</h3>
                <div
                    className={styles.confidenceBadge}
                    style={{ background: CONFIDENCE_COLORS[confidenceLevel] }}
                >
                    {Math.round(confidence * 100)}% confidence
                </div>
            </div>

            {/* Description */}
            {recommendation.description && (
                <p className={styles.description}>{recommendation.description}</p>
            )}

            {/* Evidence */}
            <div className={styles.evidence}>
                {evidence.data_points && (
                    <span className={styles.evidenceItem}>
                        📊 {evidence.data_points} data points
                    </span>
                )}
                {evidence.variance && (
                    <span className={styles.evidenceItem}>
                        📈 Variance: {evidence.variance}
                    </span>
                )}
                {evidence.completeness && (
                    <span className={styles.evidenceItem}>
                        ✓ {Math.round(evidence.completeness * 100)}% complete
                    </span>
                )}
            </div>

            {/* Expected Impact */}
            {action.expected_impact && (
                <div className={styles.impact}>
                    <span className={styles.impactLabel}>Expected:</span>
                    <strong>{action.expected_impact.metric}</strong>
                    <span className={styles.impactDirection}>
                        {action.expected_impact.direction === 'decrease' ? '↓' : '↑'}
                    </span>
                    <span className={styles.impactMagnitude}>
                        {action.expected_impact.magnitude}
                    </span>
                </div>
            )}

            {/* Proposed Change */}
            {action.current_value !== undefined && action.proposed_value !== undefined && (
                <div className={styles.change}>
                    <span className={styles.changeLabel}>Change:</span>
                    <span className={styles.changeValue}>
                        {action.current_value} → {action.proposed_value}
                    </span>
                    {action.change_pct && (
                        <span className={styles.changePct}>
                            ({action.change_pct > 0 ? '+' : ''}{action.change_pct}%)
                        </span>
                    )}
                </div>
            )}

            {/* Reasoning Toggle */}
            <button
                className={styles.reasoningToggle}
                onClick={() => setShowReasoning(!showReasoning)}
            >
                {showReasoning ? '▼ Hide reasoning' : '▶ See reasoning'}
            </button>

            {showReasoning && (
                <div className={styles.reasoning}>
                    Based on analysis of {evidence.data_points || 'N/A'} data points
                    with {evidence.variance || 'unknown'} variance.
                    Sources: {evidence.sources?.join(', ') || 'metrics API'}.
                </div>
            )}

            {/* Actions */}
            {recommendation.status === 'pending' && (
                <div className={styles.actions}>
                    {onApply && (
                        <button
                            className={styles.applyBtn}
                            onClick={() => onApply(recommendation.id)}
                        >
                            ✓ Apply Now
                        </button>
                    )}
                    {onAccept && (
                        <button
                            className={styles.acceptBtn}
                            onClick={() => onAccept(recommendation.id)}
                        >
                            👍 Accept
                        </button>
                    )}
                    <button
                        className={styles.rejectBtn}
                        onClick={() => setShowFeedback(true)}
                    >
                        👎 Reject
                    </button>
                </div>
            )}

            {/* Status Badge */}
            {recommendation.status !== 'pending' && (
                <div className={`${styles.statusBadge} ${styles[recommendation.status]}`}>
                    {recommendation.status === 'accepted' && '✓ Accepted'}
                    {recommendation.status === 'rejected' && '✕ Rejected'}
                    {recommendation.status === 'applied' && '🚀 Applied'}
                    {recommendation.status === 'expired' && '⏰ Expired'}
                </div>
            )}

            {/* Feedback Modal */}
            {showFeedback && (
                <div className={styles.feedbackModal}>
                    <h4>Why are you rejecting this?</h4>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Help us improve by sharing your reason..."
                        rows={3}
                    />
                    <div className={styles.feedbackActions}>
                        <button onClick={handleReject} disabled={!feedback.trim()}>
                            Submit Feedback
                        </button>
                        <button onClick={() => setShowFeedback(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
