'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface StrategyNode {
    id: string;
    label: string;
    category: string;
    performance: 'excellent' | 'good' | 'neutral' | 'opportunity' | 'poor';
    score: number;
    count: number;
    metrics: {
        avgCTR?: number;
        avgCPC?: number;
        avgROAS?: number;
        totalSpend?: number;
        totalConversions?: number;
    };
    children: StrategyNode[];
}

interface AISuggestion {
    type: 'focus' | 'expand' | 'reduce' | 'test';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    strategies: string[];
}

export default function StrategyPage() {
    const [strategyTree, setStrategyTree] = useState<StrategyNode | null>(null);
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedNode, setSelectedNode] = useState<StrategyNode | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        loadStrategyData();
    }, []);

    const loadStrategyData = async () => {
        try {
            // Load ads from localStorage
            const ads = JSON.parse(localStorage.getItem('ads') || '[]');

            if (ads.length === 0) {
                setIsLoading(false);
                return;
            }

            // Build strategy tree from ad data
            const tree = buildStrategyTree(ads);
            setStrategyTree(tree);

            // Generate AI suggestions
            const aiSuggestions = generateSuggestions(tree);
            setSuggestions(aiSuggestions);

        } catch (error) {
            console.error('Failed to load strategy data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const buildStrategyTree = (ads: any[]): StrategyNode => {
        const categories: Record<string, Record<string, { count: number; scores: number[]; metrics: any[] }>> = {
            'Platform': {},
            'Hook Type': {},
            'Content Style': {},
            'Visual Style': {},
            'Audio': {},
            'CTA': {},
            'Format': {},
        };

        // Analyze each ad
        ads.forEach(ad => {
            const content = ad.extractedContent || {};
            const insights = ad.adInsights || {};
            const score = ad.successScore || 50;

            const addToCategory = (cat: string, value: string | undefined) => {
                if (!value || value === 'other' || value === 'null') return;
                const cleanValue = value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                if (!categories[cat][cleanValue]) {
                    categories[cat][cleanValue] = { count: 0, scores: [], metrics: [] };
                }
                categories[cat][cleanValue].count++;
                categories[cat][cleanValue].scores.push(score);
                categories[cat][cleanValue].metrics.push(insights);
            };

            addToCategory('Platform', content.platform);
            addToCategory('Hook Type', content.hookType);
            addToCategory('Content Style', content.contentCategory);
            addToCategory('Visual Style', content.editingStyle);
            addToCategory('Audio', content.musicType);
            addToCategory('CTA', content.cta);
            addToCategory('Format', content.aspectRatio);
        });

        // Build tree structure
        const children: StrategyNode[] = Object.entries(categories).map(([category, values]) => {
            const categoryChildren: StrategyNode[] = Object.entries(values).map(([value, data]) => {
                const avgScore = data.scores.length > 0
                    ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
                    : 50;

                const avgCTR = data.metrics.filter(m => m.ctr).length > 0
                    ? data.metrics.filter(m => m.ctr).reduce((sum, m) => sum + (m.ctr || 0), 0) / data.metrics.filter(m => m.ctr).length
                    : undefined;

                return {
                    id: `${category}:${value}`,
                    label: value,
                    category,
                    performance: getPerformanceLevel(avgScore),
                    score: Math.round(avgScore),
                    count: data.count,
                    metrics: { avgCTR },
                    children: []
                };
            });

            // Sort by score descending
            categoryChildren.sort((a, b) => b.score - a.score);

            const categoryScore = categoryChildren.length > 0
                ? categoryChildren.reduce((sum, c) => sum + c.score, 0) / categoryChildren.length
                : 50;

            return {
                id: `category:${category}`,
                label: category,
                category: 'root',
                performance: getPerformanceLevel(categoryScore),
                score: Math.round(categoryScore),
                count: categoryChildren.reduce((sum, c) => sum + c.count, 0),
                metrics: {},
                children: categoryChildren
            };
        }).filter(cat => cat.children.length > 0);

        // Sort categories by score
        children.sort((a, b) => b.score - a.score);

        const overallScore = children.length > 0
            ? children.reduce((sum, c) => sum + c.score, 0) / children.length
            : 50;

        return {
            id: 'root',
            label: 'Your Ad Strategy',
            category: 'root',
            performance: getPerformanceLevel(overallScore),
            score: Math.round(overallScore),
            count: ads.length,
            metrics: {},
            children
        };
    };

    const getPerformanceLevel = (score: number): StrategyNode['performance'] => {
        if (score >= 80) return 'excellent';
        if (score >= 65) return 'good';
        if (score >= 50) return 'neutral';
        if (score >= 35) return 'opportunity';
        return 'poor';
    };

    const generateSuggestions = (tree: StrategyNode): AISuggestion[] => {
        const suggestions: AISuggestion[] = [];

        // Find top performers to focus on
        const topPerformers: string[] = [];
        const lowPerformers: string[] = [];
        const opportunities: string[] = [];

        tree.children.forEach(category => {
            category.children.forEach(strategy => {
                if (strategy.score >= 75 && strategy.count >= 2) {
                    topPerformers.push(`${strategy.label} (${category.label})`);
                } else if (strategy.score < 40) {
                    lowPerformers.push(`${strategy.label} (${category.label})`);
                } else if (strategy.count === 1 && strategy.score >= 60) {
                    opportunities.push(`${strategy.label} (${category.label})`);
                }
            });
        });

        if (topPerformers.length > 0) {
            suggestions.push({
                type: 'focus',
                title: '🎯 Double Down on Winners',
                description: 'These strategies are performing well. Consider allocating more budget here.',
                priority: 'high',
                strategies: topPerformers.slice(0, 5)
            });
        }

        if (opportunities.length > 0) {
            suggestions.push({
                type: 'test',
                title: '🧪 Test These Opportunities',
                description: 'Early signals look promising. Test more ads with these strategies.',
                priority: 'medium',
                strategies: opportunities.slice(0, 5)
            });
        }

        if (lowPerformers.length > 0) {
            suggestions.push({
                type: 'reduce',
                title: '⚠️ Consider Reducing',
                description: 'These strategies are underperforming. Consider pivoting or reducing spend.',
                priority: 'low',
                strategies: lowPerformers.slice(0, 5)
            });
        }

        // Add category-level suggestions
        const bestCategory = tree.children[0];
        if (bestCategory && bestCategory.score >= 70) {
            suggestions.push({
                type: 'expand',
                title: `📈 Expand ${bestCategory.label} Strategy`,
                description: `Your ${bestCategory.label} approach is working well. Try more variations.`,
                priority: 'high',
                strategies: bestCategory.children.slice(0, 3).map(c => c.label)
            });
        }

        return suggestions;
    };

    const getNodeColor = (performance: StrategyNode['performance']): string => {
        switch (performance) {
            case 'excellent': return '#166534'; // dark green
            case 'good': return '#22c55e'; // green
            case 'neutral': return '#9ca3af'; // gray
            case 'opportunity': return '#f59e0b'; // orange
            case 'poor': return '#1f2937'; // dark
        }
    };

    const getNodeBgColor = (performance: StrategyNode['performance']): string => {
        switch (performance) {
            case 'excellent': return 'rgba(22, 101, 52, 0.2)';
            case 'good': return 'rgba(34, 197, 94, 0.15)';
            case 'neutral': return 'rgba(156, 163, 175, 0.15)';
            case 'opportunity': return 'rgba(245, 158, 11, 0.15)';
            case 'poor': return 'rgba(31, 41, 55, 0.3)';
        }
    };

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            return newSet;
        });
    };

    const renderTreeNode = (node: StrategyNode, depth: number = 0): React.ReactNode => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children.length > 0;
        const isSelected = selectedNode?.id === node.id;

        return (
            <div key={node.id} className={styles.treeNode} style={{ marginLeft: depth * 24 }}>
                <div
                    className={`${styles.nodeContent} ${isSelected ? styles.selected : ''}`}
                    style={{
                        borderColor: getNodeColor(node.performance),
                        backgroundColor: getNodeBgColor(node.performance)
                    }}
                    onClick={() => setSelectedNode(node)}
                >
                    {hasChildren && (
                        <button
                            className={styles.expandBtn}
                            onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
                        >
                            {isExpanded ? '▼' : '▶'}
                        </button>
                    )}

                    <div
                        className={styles.nodeIndicator}
                        style={{ backgroundColor: getNodeColor(node.performance) }}
                    />

                    <div className={styles.nodeInfo}>
                        <span className={styles.nodeLabel}>{node.label}</span>
                        <span className={styles.nodeStats}>
                            {node.count} ads • {node.score}% score
                        </span>
                    </div>

                    <div
                        className={styles.nodeScore}
                        style={{ color: getNodeColor(node.performance) }}
                    >
                        {node.score}%
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className={styles.nodeChildren}>
                        {node.children.map(child => renderTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const getPriorityColor = (priority: AISuggestion['priority']): string => {
        switch (priority) {
            case 'high': return '#22c55e';
            case 'medium': return '#f59e0b';
            case 'low': return '#ef4444';
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <Link href="/athena" className={styles.backLink}>
                    ← Back to Athena
                </Link>
                <div className={styles.titleRow}>
                    <div>
                        <h1 className={styles.title}>🎯 Strategy Focus</h1>
                        <p className={styles.subtitle}>
                            AI-powered analysis of your winning strategies
                        </p>
                    </div>
                    <button
                        onClick={() => { setIsAnalyzing(true); loadStrategyData().then(() => setIsAnalyzing(false)); }}
                        disabled={isAnalyzing}
                        className="btn btn-secondary"
                    >
                        {isAnalyzing ? 'Analyzing...' : '🔄 Re-analyze'}
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p>Analyzing your strategies...</p>
                </div>
            ) : !strategyTree || strategyTree.children.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📊</div>
                    <h2>No Ad Data Yet</h2>
                    <p>Import your ads to see AI strategy recommendations</p>
                    <Link href="/import" className="btn btn-primary">
                        📥 Import Ads
                    </Link>
                </div>
            ) : (
                <div className={styles.content}>
                    {/* AI Suggestions Panel */}
                    <div className={styles.suggestionsPanel}>
                        <h2 className={styles.sectionTitle}>
                            🤖 AI Recommendations
                        </h2>
                        <div className={styles.suggestionsList}>
                            {suggestions.map((suggestion, idx) => (
                                <div
                                    key={idx}
                                    className={styles.suggestionCard}
                                    style={{ borderLeftColor: getPriorityColor(suggestion.priority) }}
                                >
                                    <div className={styles.suggestionHeader}>
                                        <h3>{suggestion.title}</h3>
                                        <span
                                            className={styles.priorityBadge}
                                            style={{ backgroundColor: getPriorityColor(suggestion.priority) }}
                                        >
                                            {suggestion.priority}
                                        </span>
                                    </div>
                                    <p className={styles.suggestionDesc}>{suggestion.description}</p>
                                    <div className={styles.strategyTags}>
                                        {suggestion.strategies.map((s, i) => (
                                            <span key={i} className={styles.strategyTag}>{s}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {suggestions.length === 0 && (
                                <p className={styles.noSuggestions}>
                                    Add more ads to get personalized recommendations
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Strategy Tree */}
                    <div className={styles.treePanel}>
                        <h2 className={styles.sectionTitle}>
                            🌳 Strategy Tree
                        </h2>

                        {/* Legend */}
                        <div className={styles.legend}>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: '#166534' }} />
                                <span>Excellent (80%+)</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: '#22c55e' }} />
                                <span>Good (65-79%)</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: '#9ca3af' }} />
                                <span>Neutral (50-64%)</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} />
                                <span>Opportunity (35-49%)</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ backgroundColor: '#1f2937' }} />
                                <span>Poor (&lt;35%)</span>
                            </div>
                        </div>

                        <div className={styles.treeContainer}>
                            {renderTreeNode(strategyTree)}
                        </div>
                    </div>

                    {/* Selected Node Details */}
                    {selectedNode && (
                        <div className={styles.detailsPanel}>
                            <h2 className={styles.sectionTitle}>
                                📋 Details: {selectedNode.label}
                            </h2>
                            <div className={styles.detailsContent}>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Performance</span>
                                    <span
                                        className={styles.detailValue}
                                        style={{ color: getNodeColor(selectedNode.performance) }}
                                    >
                                        {selectedNode.performance.toUpperCase()}
                                    </span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Score</span>
                                    <span className={styles.detailValue}>{selectedNode.score}%</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Ads Using This</span>
                                    <span className={styles.detailValue}>{selectedNode.count}</span>
                                </div>
                                {selectedNode.metrics.avgCTR && (
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Avg CTR</span>
                                        <span className={styles.detailValue}>
                                            {selectedNode.metrics.avgCTR.toFixed(2)}%
                                        </span>
                                    </div>
                                )}

                                {selectedNode.children.length > 0 && (
                                    <>
                                        <h4 className={styles.childrenTitle}>Sub-strategies:</h4>
                                        <div className={styles.childrenList}>
                                            {selectedNode.children.map(child => (
                                                <div
                                                    key={child.id}
                                                    className={styles.childItem}
                                                    onClick={() => setSelectedNode(child)}
                                                >
                                                    <span
                                                        className={styles.childDot}
                                                        style={{ backgroundColor: getNodeColor(child.performance) }}
                                                    />
                                                    <span>{child.label}</span>
                                                    <span className={styles.childScore}>{child.score}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
