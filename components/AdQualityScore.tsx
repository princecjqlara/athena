'use client';

import { useState } from 'react';
import styles from './AdQualityScore.module.css';
import {
    AdQualityAnalysis,
    QualityIssue,
    QualityPositive,
    SEVERITY_ICONS,
    POSITIVE_ICONS,
    getGradeColor,
} from '@/types/ad-quality-types';

interface AdQualityScoreProps {
    analysis: AdQualityAnalysis;
    compact?: boolean;
    showDetails?: boolean;
}

export default function AdQualityScore({ analysis, compact = false, showDetails = true }: AdQualityScoreProps) {
    const [expandedSection, setExpandedSection] = useState<'issues' | 'positives' | null>(null);

    const toggleSection = (section: 'issues' | 'positives') => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // Calculate stroke dasharray for circular progress
    const circumference = 2 * Math.PI * 45;
    const strokeDasharray = `${(analysis.overallScore / 100) * circumference} ${circumference}`;

    if (compact) {
        return (
            <div className={styles.compactContainer}>
                <div
                    className={styles.gradeBadge}
                    style={{ backgroundColor: getGradeColor(analysis.grade) }}
                >
                    <span className={styles.gradeText}>{analysis.grade}</span>
                </div>
                <div className={styles.compactScore}>
                    <span className={styles.scoreValue}>{analysis.overallScore}</span>
                    {analysis.blunderCount + analysis.mistakeCount + analysis.inaccuracyCount > 0 && (
                        <span className={styles.issueIndicator}>
                            {analysis.blunderCount > 0 && <span>🔴{analysis.blunderCount}</span>}
                            {analysis.mistakeCount > 0 && <span>🟠{analysis.mistakeCount}</span>}
                            {analysis.inaccuracyCount > 0 && <span>🟡{analysis.inaccuracyCount}</span>}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header with score gauge */}
            <div className={styles.header}>
                <div className={styles.scoreGauge}>
                    <svg viewBox="0 0 100 100" className={styles.gaugeSvg}>
                        {/* Background circle */}
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />
                        {/* Score arc */}
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke={getGradeColor(analysis.grade)}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={strokeDasharray}
                            transform="rotate(-90 50 50)"
                            className={styles.scoreArc}
                        />
                    </svg>
                    <div className={styles.scoreCenter}>
                        <span className={styles.scoreNumber}>{analysis.overallScore}</span>
                        <span className={styles.scoreLabel}>Score</span>
                    </div>
                </div>

                <div className={styles.gradeSection}>
                    <div
                        className={styles.gradeCard}
                        style={{ backgroundColor: getGradeColor(analysis.grade) }}
                    >
                        <span className={styles.gradeValue}>{analysis.grade}</span>
                    </div>
                    <div className={styles.victoryChance}>
                        <span className={styles.victoryLabel}>Victory Chance</span>
                        <div className={styles.victoryBar}>
                            <div
                                className={styles.victoryFill}
                                style={{ width: `${analysis.victoryChance}%` }}
                            />
                        </div>
                        <span className={styles.victoryValue}>{analysis.victoryChance}%</span>
                    </div>
                    <div className={styles.confidence}>
                        Confidence: {analysis.confidence}%
                    </div>
                </div>
            </div>

            {/* Issue/Positive Summary */}
            <div className={styles.summary}>
                <div className={styles.summaryItem} data-type="issues">
                    {analysis.blunderCount > 0 && (
                        <span className={styles.severityCount} data-severity="blunder">
                            🔴 {analysis.blunderCount} Blunder{analysis.blunderCount > 1 ? 's' : ''}
                        </span>
                    )}
                    {analysis.mistakeCount > 0 && (
                        <span className={styles.severityCount} data-severity="mistake">
                            🟠 {analysis.mistakeCount} Mistake{analysis.mistakeCount > 1 ? 's' : ''}
                        </span>
                    )}
                    {analysis.inaccuracyCount > 0 && (
                        <span className={styles.severityCount} data-severity="inaccuracy">
                            🟡 {analysis.inaccuracyCount} Inaccurac{analysis.inaccuracyCount > 1 ? 'ies' : 'y'}
                        </span>
                    )}
                    {analysis.issues.length === 0 && (
                        <span className={styles.noIssues}>✅ No issues found!</span>
                    )}
                </div>
                <div className={styles.summaryItem} data-type="positives">
                    <span className={styles.positiveCount}>
                        ✨ {analysis.positives.length} Positive{analysis.positives.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {showDetails && (
                <>
                    {/* Issues Section */}
                    {analysis.issues.length > 0 && (
                        <div className={styles.section}>
                            <button
                                className={styles.sectionHeader}
                                onClick={() => toggleSection('issues')}
                            >
                                <span>Issues to Fix ({analysis.issues.length})</span>
                                <span className={styles.expandIcon}>
                                    {expandedSection === 'issues' ? '−' : '+'}
                                </span>
                            </button>
                            {expandedSection === 'issues' && (
                                <div className={styles.sectionContent}>
                                    {analysis.issues.map((issue) => (
                                        <IssueCard key={issue.id} issue={issue} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Positives Section */}
                    {analysis.positives.length > 0 && (
                        <div className={styles.section}>
                            <button
                                className={styles.sectionHeader}
                                onClick={() => toggleSection('positives')}
                            >
                                <span>What&apos;s Working ({analysis.positives.length})</span>
                                <span className={styles.expandIcon}>
                                    {expandedSection === 'positives' ? '−' : '+'}
                                </span>
                            </button>
                            {expandedSection === 'positives' && (
                                <div className={styles.sectionContent}>
                                    {analysis.positives.map((positive) => (
                                        <PositiveCard key={positive.id} positive={positive} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Recommendations */}
                    {analysis.recommendations.length > 0 && (
                        <div className={styles.recommendations}>
                            <h4 className={styles.recTitle}>Quick Fixes</h4>
                            <ul className={styles.recList}>
                                {analysis.recommendations.map((rec, index) => (
                                    <li key={index} className={styles.recItem}>
                                        <span className={styles.recIcon}>💡</span>
                                        {rec}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// Issue Card Component
function IssueCard({ issue }: { issue: QualityIssue }) {
    return (
        <div className={styles.issueCard} data-severity={issue.severity}>
            <div className={styles.issueHeader}>
                <span className={styles.issueIcon}>{SEVERITY_ICONS[issue.severity]}</span>
                <span className={styles.issueTitle}>{issue.title}</span>
                <span className={styles.issuePenalty}>{issue.penaltyApplied} pts</span>
            </div>
            <p className={styles.issueDescription}>{issue.description}</p>
            <div className={styles.issueFooter}>
                <span className={styles.issueImpact}>Impact: {issue.impact}</span>
                <span className={styles.issueCategory}>{issue.category}</span>
            </div>
            <div className={styles.issueFix}>
                <span className={styles.fixIcon}>🔧</span>
                {issue.fix}
            </div>
        </div>
    );
}

// Positive Card Component
function PositiveCard({ positive }: { positive: QualityPositive }) {
    return (
        <div className={styles.positiveCard} data-rating={positive.rating}>
            <div className={styles.positiveHeader}>
                <span className={styles.positiveIcon}>{POSITIVE_ICONS[positive.rating]}</span>
                <span className={styles.positiveTitle}>{positive.title}</span>
                <span className={styles.positiveBonus}>+{positive.bonusApplied} pts</span>
            </div>
            <p className={styles.positiveDescription}>{positive.description}</p>
            <div className={styles.positiveFooter}>
                <span className={styles.positiveImpact}>Impact: {positive.impact}</span>
                <span className={styles.positiveCategory}>{positive.category}</span>
            </div>
        </div>
    );
}
