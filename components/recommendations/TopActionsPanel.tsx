/**
 * TopActionsPanel Component
 * Shows top 5 AI recommendations ranked by impact × confidence
 */

'use client';

import { useState, useEffect } from 'react';
import RecommendationCard from './RecommendationCard';
import styles from './TopActionsPanel.module.css';

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

interface TopActionsPanelProps {
    orgId: string;
    userId: string;
    maxItems?: number;
    onRefresh?: () => void;
}

export default function TopActionsPanel({
    orgId,
    userId,
    maxItems = 5,
    onRefresh
}: TopActionsPanelProps) {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState<string | null>(null);

    useEffect(() => {
        fetchRecommendations();
    }, [orgId]);

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/ai/recommendations?orgId=${orgId}&status=pending&limit=${maxItems}`);
            const data = await res.json();

            if (data.success) {
                // Sort by impact × confidence (simplified: just confidence for now)
                const sorted = (data.recommendations || []).sort(
                    (a: Recommendation, b: Recommendation) =>
                        (b.confidence_score || 0) - (a.confidence_score || 0)
                );
                setRecommendations(sorted.slice(0, maxItems));
            }
        } catch (error) {
            console.error('Error fetching recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateRecommendations = async () => {
        try {
            setGenerating(true);

            // Get entity IDs from stored ads
            const ads = JSON.parse(localStorage.getItem('ads') || '[]');
            const entityIds = ads.slice(0, 10).map((ad: { id: string }) => ad.id);

            const res = await fetch('/api/ai/agent/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: 'Generate top recommendations for my ads',
                    orgId,
                    userId,
                    entityIds
                })
            });

            const data = await res.json();

            if (data.success && data.run.recommendations.length > 0) {
                // Save recommendations to database
                for (const rec of data.run.recommendations) {
                    await fetch('/api/ai/recommendations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orgId,
                            userId,
                            ...rec
                        })
                    });
                }

                setLastGenerated(new Date().toLocaleTimeString());
                fetchRecommendations();
            }

            if (onRefresh) onRefresh();

        } catch (error) {
            console.error('Error generating recommendations:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleAccept = async (id: string) => {
        try {
            await fetch(`/api/ai/recommendations/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept', userId })
            });
            fetchRecommendations();
        } catch (error) {
            console.error('Error accepting recommendation:', error);
        }
    };

    const handleReject = async (id: string, reason: string) => {
        try {
            await fetch(`/api/ai/recommendations/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', feedback: reason, userId })
            });
            fetchRecommendations();
        } catch (error) {
            console.error('Error rejecting recommendation:', error);
        }
    };

    const handleApply = async (id: string) => {
        try {
            await fetch(`/api/ai/recommendations/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply', userId })
            });
            fetchRecommendations();
        } catch (error) {
            console.error('Error applying recommendation:', error);
        }
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h2 className={styles.title}>
                        🎯 Top Actions Today
                    </h2>
                    <span className={styles.subtitle}>
                        AI-powered recommendations ranked by impact
                    </span>
                </div>
                <div className={styles.actions}>
                    {lastGenerated && (
                        <span className={styles.lastGenerated}>
                            Last: {lastGenerated}
                        </span>
                    )}
                    <button
                        className={styles.generateBtn}
                        onClick={generateRecommendations}
                        disabled={generating}
                    >
                        {generating ? (
                            <>
                                <span className={styles.spinner} />
                                Analyzing...
                            </>
                        ) : (
                            '✨ Generate New'
                        )}
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {loading ? (
                    <div className={styles.loading}>
                        <div className={styles.loadingSpinner} />
                        <span>Loading recommendations...</span>
                    </div>
                ) : recommendations.length === 0 ? (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>💡</span>
                        <h3>No pending recommendations</h3>
                        <p>Click "Generate New" to analyze your ads and get AI-powered suggestions.</p>
                        <button
                            className={styles.generateBtn}
                            onClick={generateRecommendations}
                            disabled={generating}
                        >
                            {generating ? 'Analyzing...' : '✨ Generate Recommendations'}
                        </button>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {recommendations.map((rec, index) => (
                            <div key={rec.id} className={styles.cardWrapper}>
                                <span className={styles.rank}>#{index + 1}</span>
                                <RecommendationCard
                                    recommendation={rec}
                                    onAccept={() => handleAccept(rec.id)}
                                    onReject={(reason) => handleReject(rec.id, reason)}
                                    onApply={() => handleApply(rec.id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
