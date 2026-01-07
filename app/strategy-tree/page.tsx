'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import styles from './page.module.css';
import { useTheme } from '@/components/ThemeProvider';
import {
    buildStrategyTree,
    StrategyTreeNode,
} from '@/lib/ml/creative-strategy';
import {
    generateSuggestions,
    analyzePortfolio,
    CreativeSuggestion,
    PortfolioAnalysis,
} from '@/lib/ml/creative-suggestions';

// ============================================
// ORB NODE TYPES
// ============================================

interface OrbNode {
    id: string;
    label: string;
    type: 'center' | 'category' | 'item' | 'leaf';
    score: number;
    color: string;
    x: number;
    y: number;
    radius: number;
    children: OrbNode[];
    parent?: OrbNode;
    details?: {
        adsCount?: number;
        avgCTR?: number;
        totalSpend?: number;
        whyItWorked?: string[];
        whyItFailed?: string[];
        recommendations?: string[];
    };
}

// ============================================
// COLOR PALETTES FOR CATEGORIES
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
    // Platforms - Blue shades
    'facebook': '#3B82F6',
    'instagram': '#E1306C',
    'tiktok': '#000000',
    'youtube': '#FF0000',
    // Creative Types - Various colors
    'Problem_Solution': '#8B5CF6',   // Purple
    'Us_Vs_Them': '#F97316',         // Orange  
    'Founder_Story_BTS': '#10B981',  // Green
    'UGC_Testimonial': '#EC4899',    // Pink
    'Direct_Offer_Static': '#06B6D4', // Cyan
    'Unknown': '#6B7280',            // Gray
    // Default
    'default': '#6366F1',
};

function getNodeColor(label: string, score: number): string {
    const key = label.toLowerCase().replace(/\s+/g, '_');
    if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
    if (CATEGORY_COLORS[label]) return CATEGORY_COLORS[label];

    // Color by performance score
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#4ade80';
    if (score >= 50) return '#9ca3af';
    if (score >= 35) return '#f59e0b';
    return '#ef4444';
}

// ============================================
// LAYOUT ALGORITHM
// ============================================

function calculateOrbLayout(tree: StrategyTreeNode): OrbNode[] {
    const nodes: OrbNode[] = [];
    const centerX = 400;
    const centerY = 300;

    // Center node (Your Ad Strategy)
    const centerNode: OrbNode = {
        id: tree.id,
        label: 'Your Ad\nStrategy',
        type: 'center',
        score: tree.score,
        color: '#374151',
        x: centerX,
        y: centerY,
        radius: 60,
        children: [],
        details: {
            adsCount: tree.adsCount,
            avgCTR: tree.avgCTR,
            totalSpend: tree.totalSpend,
        }
    };
    nodes.push(centerNode);

    // First level - Platforms (around center)
    const platformCount = tree.children.length;
    tree.children.forEach((platform, pIndex) => {
        const platformAngle = (pIndex / platformCount) * Math.PI * 2 - Math.PI / 2;
        const platformDistance = 150;

        const platformNode: OrbNode = {
            id: platform.id,
            label: platform.label,
            type: 'category',
            score: platform.score,
            color: getNodeColor(platform.label, platform.score),
            x: centerX + Math.cos(platformAngle) * platformDistance,
            y: centerY + Math.sin(platformAngle) * platformDistance,
            radius: 45,
            children: [],
            parent: centerNode,
            details: {
                adsCount: platform.adsCount,
                avgCTR: platform.avgCTR,
                totalSpend: platform.totalSpend,
            }
        };
        nodes.push(platformNode);
        centerNode.children.push(platformNode);

        // Second level - Creative Types (branching from platform)
        const typeCount = platform.children.length;
        platform.children.forEach((creativeType, tIndex) => {
            // Spread around the platform node
            const baseAngle = platformAngle;
            const spreadAngle = (Math.PI * 0.6); // 108 degree spread
            const typeAngle = baseAngle + (tIndex - (typeCount - 1) / 2) * (spreadAngle / Math.max(typeCount - 1, 1));
            const typeDistance = 100;

            const typeNode: OrbNode = {
                id: creativeType.id,
                label: creativeType.label.replace(/_/g, '\n'),
                type: 'item',
                score: creativeType.score,
                color: getNodeColor(creativeType.label, creativeType.score),
                x: platformNode.x + Math.cos(typeAngle) * typeDistance,
                y: platformNode.y + Math.sin(typeAngle) * typeDistance,
                radius: 35,
                children: [],
                parent: platformNode,
                details: {
                    adsCount: creativeType.adsCount,
                    avgCTR: creativeType.avgCTR,
                    totalSpend: creativeType.totalSpend,
                    whyItWorked: creativeType.insights?.whyItWorked,
                    whyItFailed: creativeType.insights?.whyItFailed,
                    recommendations: creativeType.insights?.recommendations,
                }
            };
            nodes.push(typeNode);
            platformNode.children.push(typeNode);

            // Third level - Individual Ads (leaf nodes)
            const adCount = creativeType.children.length;
            creativeType.children.forEach((ad, aIndex) => {
                const adBaseAngle = typeAngle;
                const adSpreadAngle = (Math.PI * 0.4);
                const adAngle = adBaseAngle + (aIndex - (adCount - 1) / 2) * (adSpreadAngle / Math.max(adCount - 1, 1));
                const adDistance = 70;

                const adNode: OrbNode = {
                    id: ad.id,
                    label: ad.label.length > 12 ? ad.label.slice(0, 10) + '...' : ad.label,
                    type: 'leaf',
                    score: ad.score,
                    color: getNodeColor('', ad.score),
                    x: typeNode.x + Math.cos(adAngle) * adDistance,
                    y: typeNode.y + Math.sin(adAngle) * adDistance,
                    radius: 22,
                    children: [],
                    parent: typeNode,
                    details: {
                        adsCount: 1,
                        avgCTR: ad.avgCTR,
                        totalSpend: ad.totalSpend,
                        whyItWorked: ad.insights?.whyItWorked,
                        whyItFailed: ad.insights?.whyItFailed,
                        recommendations: ad.insights?.recommendations,
                    }
                };
                nodes.push(adNode);
                typeNode.children.push(adNode);
            });
        });
    });

    return nodes;
}

// ============================================
// SVG ORB COMPONENT
// ============================================

interface OrbProps {
    node: OrbNode;
    isSelected: boolean;
    onSelect: (node: OrbNode) => void;
}

function Orb({ node, isSelected, onSelect }: OrbProps) {
    const isCenter = node.type === 'center';

    return (
        <g
            className={`${styles.orb} ${isSelected ? styles.selected : ''}`}
            onClick={() => onSelect(node)}
            style={{ cursor: 'pointer' }}
        >
            {/* Glow effect */}
            <circle
                cx={node.x}
                cy={node.y}
                r={node.radius + 4}
                fill="none"
                stroke={node.color}
                strokeWidth="2"
                opacity={isSelected ? 0.8 : 0.3}
                className={styles.orbGlow}
            />

            {/* Main circle */}
            <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={node.color}
                stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
                strokeWidth={isSelected ? 3 : 1}
            />

            {/* Score badge for non-center nodes */}
            {!isCenter && (
                <g>
                    <circle
                        cx={node.x + node.radius * 0.7}
                        cy={node.y - node.radius * 0.7}
                        r={12}
                        fill={node.score >= 65 ? '#22c55e' : node.score >= 50 ? '#9ca3af' : '#ef4444'}
                        stroke="#fff"
                        strokeWidth="1"
                    />
                    <text
                        x={node.x + node.radius * 0.7}
                        y={node.y - node.radius * 0.7 + 4}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill="#fff"
                    >
                        {node.score}
                    </text>
                </g>
            )}

            {/* Label */}
            <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isCenter ? 12 : node.type === 'leaf' ? 8 : 10}
                fontWeight={isCenter ? 'bold' : '600'}
                fill="#fff"
                className={styles.orbLabel}
            >
                {node.label.split('\n').map((line, i) => (
                    <tspan
                        key={i}
                        x={node.x}
                        dy={i === 0 ? 0 : 12}
                    >
                        {line}
                    </tspan>
                ))}
            </text>
        </g>
    );
}

// ============================================
// CONNECTION LINES
// ============================================

interface ConnectionProps {
    from: OrbNode;
    to: OrbNode;
}

function Connection({ from, to }: ConnectionProps) {
    // Calculate edge points
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const startX = from.x + (dx / distance) * from.radius;
    const startY = from.y + (dy / distance) * from.radius;
    const endX = to.x - (dx / distance) * to.radius;
    const endY = to.y - (dy / distance) * to.radius;

    return (
        <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={from.color}
            strokeWidth={from.type === 'center' ? 4 : 3}
            strokeLinecap="round"
            opacity={0.7}
            className={styles.connection}
        />
    );
}

// ============================================
// DETAILS PANEL
// ============================================

interface DetailsPanelProps {
    node: OrbNode | null;
    suggestions: CreativeSuggestion[];
    portfolio: PortfolioAnalysis | null;
}

function DetailsPanel({ node, suggestions, portfolio }: DetailsPanelProps) {
    if (!node) {
        return (
            <div className={styles.detailsPanel}>
                <div className={styles.panelTitle}>📊 Select a Node</div>
                <p className={styles.panelHint}>Click on any orb to view details</p>
            </div>
        );
    }

    const statusLabel = node.score >= 80 ? 'EXCELLENT' :
        node.score >= 65 ? 'GOOD' :
            node.score >= 50 ? 'NEUTRAL' :
                node.score >= 35 ? 'OPPORTUNITY' : 'POOR';

    const statusColor = node.score >= 80 ? '#22c55e' :
        node.score >= 65 ? '#4ade80' :
            node.score >= 50 ? '#9ca3af' :
                node.score >= 35 ? '#f59e0b' : '#ef4444';

    return (
        <div className={styles.detailsPanel}>
            <div className={styles.panelTitle}>
                <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: node.color,
                    marginRight: 8
                }}></span>
                {node.label.replace('\n', ' ')}
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Status</span>
                    <span className={styles.statValue} style={{ color: statusColor }}>
                        {statusLabel}
                    </span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Score</span>
                    <span className={styles.statValue}>{node.score}%</span>
                </div>
                {node.details?.adsCount !== undefined && (
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>Ads</span>
                        <span className={styles.statValue}>{node.details.adsCount}</span>
                    </div>
                )}
                {node.details?.avgCTR !== undefined && node.details.avgCTR > 0 && (
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>CTR</span>
                        <span className={styles.statValue}>{node.details.avgCTR.toFixed(2)}%</span>
                    </div>
                )}
            </div>

            {/* Why It Worked */}
            {node.details?.whyItWorked && node.details.whyItWorked.length > 0 && (
                <div className={styles.insightSection}>
                    <div className={styles.insightTitle}>✅ Why It Worked</div>
                    {node.details.whyItWorked.map((reason, i) => (
                        <div key={i} className={styles.insightItem + ' ' + styles.success}>
                            {reason}
                        </div>
                    ))}
                </div>
            )}

            {/* Why It Failed */}
            {node.details?.whyItFailed && node.details.whyItFailed.length > 0 && (
                <div className={styles.insightSection}>
                    <div className={styles.insightTitle}>❌ Why It Failed</div>
                    {node.details.whyItFailed.map((reason, i) => (
                        <div key={i} className={styles.insightItem + ' ' + styles.failure}>
                            {reason}
                        </div>
                    ))}
                </div>
            )}

            {/* Recommendations */}
            {node.details?.recommendations && node.details.recommendations.length > 0 && (
                <div className={styles.insightSection}>
                    <div className={styles.insightTitle}>💡 Recommendations</div>
                    {node.details.recommendations.map((rec, i) => (
                        <div key={i} className={styles.insightItem + ' ' + styles.recommendation}>
                            {rec}
                        </div>
                    ))}
                </div>
            )}

            {/* Portfolio Balance */}
            {portfolio && node.type === 'center' && (
                <div className={styles.portfolioSection}>
                    <div className={styles.insightTitle}>⚖️ Portfolio Balance</div>
                    <div className={styles.balanceBar}>
                        <div
                            className={styles.balanceSafe}
                            style={{ width: `${portfolio.safeWildRatio.safe}%` }}
                        />
                        <div
                            className={styles.balanceWild}
                            style={{ width: `${portfolio.safeWildRatio.wild}%` }}
                        />
                    </div>
                    <div className={styles.balanceLabels}>
                        <span>Safe: {portfolio.safeWildRatio.safe}%</span>
                        <span>Wild: {portfolio.safeWildRatio.wild}%</span>
                    </div>
                </div>
            )}

            {/* Top Suggestion */}
            {suggestions.length > 0 && node.type === 'center' && (
                <div className={styles.suggestionPreview}>
                    <div className={styles.insightTitle}>🎯 Top Suggestion</div>
                    <div className={styles.suggestionCard}>
                        <div className={styles.suggestionHeader}>
                            <span>{suggestions[0].title}</span>
                            <span className={styles.suggestionScore}>
                                {suggestions[0].predictedScore}%
                            </span>
                        </div>
                        <div className={styles.suggestionReason}>
                            {suggestions[0].reason}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

interface AdEntry {
    id: string;
    extractedContent?: {
        title?: string;
        platform?: string;
        hookType?: string;
        contentCategory?: string;
        [key: string]: unknown;
    };
    adInsights?: {
        ctr?: number;
        spend?: number;
        results?: number;
        [key: string]: unknown;
    };
}

export default function StrategyTreePage() {
    const [ads, setAds] = useState<AdEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<OrbNode | null>(null);
    const [viewBox, setViewBox] = useState('0 0 800 600');
    const svgRef = useRef<SVGSVGElement>(null);

    const { resolvedTheme } = useTheme();

    // Load ads from localStorage
    useEffect(() => {
        const loadAds = async () => {
            try {
                const stored = localStorage.getItem('ads');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setAds(parsed);
                }
            } catch (error) {
                console.error('Error loading ads:', error);
            } finally {
                setLoading(false);
            }
        };
        loadAds();
    }, []);

    // Build orb layout
    const orbNodes = useMemo(() => {
        if (ads.length === 0) return [];
        const tree = buildStrategyTree(ads as any);
        if (!tree) return [];
        return calculateOrbLayout(tree);
    }, [ads]);

    // Calculate viewBox based on nodes
    useEffect(() => {
        if (orbNodes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        orbNodes.forEach(node => {
            minX = Math.min(minX, node.x - node.radius - 20);
            minY = Math.min(minY, node.y - node.radius - 20);
            maxX = Math.max(maxX, node.x + node.radius + 20);
            maxY = Math.max(maxY, node.y + node.radius + 20);
        });

        const padding = 50;
        setViewBox(`${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`);
    }, [orbNodes]);

    const suggestions = useMemo(() => {
        if (ads.length === 0) return [];
        return generateSuggestions(ads as any);
    }, [ads]);

    const portfolio = useMemo(() => {
        if (ads.length === 0) return null;
        return analyzePortfolio(ads as any);
    }, [ads]);

    // Collect all connections
    const connections = useMemo(() => {
        const conns: { from: OrbNode; to: OrbNode }[] = [];
        orbNodes.forEach(node => {
            if (node.parent) {
                conns.push({ from: node.parent, to: node });
            }
        });
        return conns;
    }, [orbNodes]);

    if (loading) {
        return (
            <div className={styles.container} data-theme={resolvedTheme}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <span>Loading strategy network...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container} data-theme={resolvedTheme}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <span className={styles.titleIcon}>🌐</span>
                    Strategy Network
                </h1>
                <div className={styles.legend}>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#22c55e' }}></span>
                        Excellent
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#4ade80' }}></span>
                        Good
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#9ca3af' }}></span>
                        Neutral
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#f59e0b' }}></span>
                        Opportunity
                    </div>
                    <div className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: '#ef4444' }}></span>
                        Poor
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={styles.mainLayout}>
                {/* SVG Network Visualization */}
                <div className={styles.networkContainer}>
                    {ads.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🌐</div>
                            <div className={styles.emptyTitle}>No Ads Yet</div>
                            <div className={styles.emptyText}>
                                Import ads from Facebook or create new ones to build your strategy network.
                            </div>
                        </div>
                    ) : (
                        <svg
                            ref={svgRef}
                            className={styles.networkSvg}
                            viewBox={viewBox}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            {/* Background gradient */}
                            <defs>
                                <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.1)" />
                                    <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
                                </radialGradient>
                            </defs>

                            {/* Connections first (behind nodes) */}
                            <g className={styles.connections}>
                                {connections.map((conn, i) => (
                                    <Connection key={i} from={conn.from} to={conn.to} />
                                ))}
                            </g>

                            {/* Nodes */}
                            <g className={styles.nodes}>
                                {orbNodes.map(node => (
                                    <Orb
                                        key={node.id}
                                        node={node}
                                        isSelected={selectedNode?.id === node.id}
                                        onSelect={setSelectedNode}
                                    />
                                ))}
                            </g>
                        </svg>
                    )}
                </div>

                {/* Details Panel */}
                <DetailsPanel
                    node={selectedNode}
                    suggestions={suggestions}
                    portfolio={portfolio}
                />
            </div>
        </div>
    );
}
