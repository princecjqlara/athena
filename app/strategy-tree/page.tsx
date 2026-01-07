'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './page.module.css';
import { useTheme } from '@/components/ThemeProvider';
import { buildStrategyTree } from '@/lib/ml/creative-strategy';
import { generateSuggestions, analyzePortfolio } from '@/lib/ml/creative-suggestions';

// Types
interface OrbNode {
    id: string;
    label: string;
    type: 'center' | 'category' | 'item' | 'leaf';
    score: number;
    color: string;
    x: number;
    y: number;
    radius: number;
    parentId?: string;
    adsCount?: number;
}

// Vibrant color palette
const COLORS = ['#FF6B9D', '#4ADE80', '#FBBF24', '#38BDF8', '#F97316', '#A78BFA', '#22D3EE'];

function getColor(index: number, score: number): string {
    if (score >= 80) return '#4ADE80';
    if (score >= 65) return '#FBBF24';
    if (score >= 50) return '#38BDF8';
    return '#EF4444';
}

// Simplified organic layout
function createLayout(tree: ReturnType<typeof buildStrategyTree>): OrbNode[] {
    if (!tree) return [];

    const nodes: OrbNode[] = [];
    const cx = 450, cy = 300;

    // Center node
    nodes.push({
        id: tree.id,
        label: 'Strategy',
        type: 'center',
        score: tree.score,
        color: '#FF6B9D',
        x: cx, y: cy,
        radius: 50,
        adsCount: tree.adsCount
    });

    // Platforms
    tree.children.forEach((platform, i) => {
        const angle = (i / tree.children.length) * Math.PI * 2 - Math.PI / 2;
        const dist = 160;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;

        nodes.push({
            id: platform.id,
            label: platform.label,
            type: 'category',
            score: platform.score,
            color: COLORS[i % COLORS.length],
            x: px, y: py,
            radius: 38,
            parentId: tree.id,
            adsCount: platform.adsCount
        });

        // Creative types
        platform.children.forEach((ctype, j) => {
            const tAngle = angle + (j - (platform.children.length - 1) / 2) * 0.5;
            const tx = px + Math.cos(tAngle) * 90;
            const ty = py + Math.sin(tAngle) * 90;

            nodes.push({
                id: ctype.id,
                label: ctype.label.replace(/_/g, ' ').substring(0, 12),
                type: 'item',
                score: ctype.score,
                color: getColor(j, ctype.score),
                x: tx, y: ty,
                radius: 28,
                parentId: platform.id,
                adsCount: ctype.adsCount
            });

            // Ads (leaves)
            ctype.children.forEach((ad, k) => {
                const aAngle = tAngle + (k - (ctype.children.length - 1) / 2) * 0.4;
                nodes.push({
                    id: ad.id,
                    label: '',
                    type: 'leaf',
                    score: ad.score,
                    color: getColor(k, ad.score),
                    x: tx + Math.cos(aAngle) * 50,
                    y: ty + Math.sin(aAngle) * 50,
                    radius: 12,
                    parentId: ctype.id
                });
            });
        });
    });

    return nodes;
}

export default function StrategyTreePage() {
    const [ads, setAds] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<OrbNode | null>(null);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        try {
            const stored = localStorage.getItem('ads');
            if (stored) setAds(JSON.parse(stored));
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    const nodes = useMemo(() => {
        if (ads.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createLayout(buildStrategyTree(ads as any));
    }, [ads]);

    const portfolio = useMemo(() => {
        if (ads.length === 0) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return analyzePortfolio(ads as any);
    }, [ads]);

    const suggestions = useMemo(() => {
        if (ads.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return generateSuggestions(ads as any);
    }, [ads]);

    // Get connections
    const connections = useMemo(() => {
        const conns: { from: OrbNode; to: OrbNode }[] = [];
        nodes.forEach(n => {
            if (n.parentId) {
                const parent = nodes.find(p => p.id === n.parentId);
                if (parent) conns.push({ from: parent, to: n });
            }
        });
        return conns;
    }, [nodes]);

    if (loading) {
        return (
            <div className={styles.container} data-theme={resolvedTheme}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container} data-theme={resolvedTheme}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <span className={styles.titleIcon}>🌐</span>
                    Strategy Network
                </h1>
            </div>

            <div className={styles.mainLayout}>
                <div className={styles.networkContainer}>
                    {ads.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🌐</div>
                            <div className={styles.emptyTitle}>No Ads Yet</div>
                            <div className={styles.emptyText}>Import ads to build your network</div>
                        </div>
                    ) : (
                        <svg viewBox="0 0 900 600" className={styles.networkSvg}>
                            {/* Connections */}
                            <g>
                                {connections.map((c, i) => {
                                    const dx = c.to.x - c.from.x;
                                    const dy = c.to.y - c.from.y;
                                    const d = Math.sqrt(dx * dx + dy * dy);
                                    const sx = c.from.x + (dx / d) * c.from.radius;
                                    const sy = c.from.y + (dy / d) * c.from.radius;
                                    const ex = c.to.x - (dx / d) * c.to.radius;
                                    const ey = c.to.y - (dy / d) * c.to.radius;
                                    const mx = (sx + ex) / 2 + (-dy * 0.15);
                                    const my = (sy + ey) / 2 + (dx * 0.15);

                                    return (
                                        <path
                                            key={i}
                                            d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                                            fill="none"
                                            stroke={c.from.color}
                                            strokeWidth={c.from.type === 'center' ? 4 : 3}
                                            opacity={0.6}
                                        />
                                    );
                                })}
                            </g>

                            {/* Nodes */}
                            <g>
                                {nodes.map(n => (
                                    <g
                                        key={n.id}
                                        onClick={() => setSelected(n)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <circle
                                            cx={n.x} cy={n.y} r={n.radius + 3}
                                            fill="none" stroke={n.color} strokeWidth="2"
                                            opacity={selected?.id === n.id ? 0.8 : 0.3}
                                        />
                                        <circle
                                            cx={n.x} cy={n.y} r={n.radius}
                                            fill={n.color}
                                            stroke={selected?.id === n.id ? '#fff' : 'rgba(255,255,255,0.2)'}
                                            strokeWidth={selected?.id === n.id ? 2 : 1}
                                        />
                                        <circle
                                            cx={n.x - n.radius * 0.2}
                                            cy={n.y - n.radius * 0.2}
                                            r={n.radius * 0.25}
                                            fill="rgba(255,255,255,0.2)"
                                        />
                                        {n.type !== 'leaf' && (
                                            <text
                                                x={n.x} y={n.y}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize={n.type === 'center' ? 12 : 9}
                                                fontWeight="600"
                                                fill="#fff"
                                            >
                                                {n.label}
                                            </text>
                                        )}
                                        {n.type !== 'center' && n.type !== 'leaf' && (
                                            <g>
                                                <circle
                                                    cx={n.x + n.radius * 0.65}
                                                    cy={n.y - n.radius * 0.65}
                                                    r={9}
                                                    fill="#1f2937"
                                                    stroke={n.color}
                                                    strokeWidth="1.5"
                                                />
                                                <text
                                                    x={n.x + n.radius * 0.65}
                                                    y={n.y - n.radius * 0.65 + 3}
                                                    textAnchor="middle"
                                                    fontSize="7"
                                                    fontWeight="bold"
                                                    fill="#fff"
                                                >
                                                    {n.score}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                ))}
                            </g>
                        </svg>
                    )}
                </div>

                <div className={styles.detailsPanel}>
                    {selected ? (
                        <>
                            <div className={styles.panelHeader}>
                                <div className={styles.nodeColorDot} style={{ backgroundColor: selected.color }} />
                                <div className={styles.panelTitle}>{selected.label || 'Ad'}</div>
                            </div>
                            <div className={styles.scoreDisplay}>
                                <span className={styles.scoreValue} style={{ color: selected.color }}>
                                    {selected.score}%
                                </span>
                                <span className={styles.scoreLabel}>
                                    {selected.score >= 80 ? 'EXCELLENT' : selected.score >= 65 ? 'GOOD' : selected.score >= 50 ? 'NEUTRAL' : 'NEEDS WORK'}
                                </span>
                            </div>
                            {selected.adsCount && (
                                <div className={styles.statRow}>
                                    <span>Ads</span>
                                    <span>{selected.adsCount}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className={styles.panelTitle}>📊 Select a Node</div>
                            <p className={styles.panelHint}>Click any node to view details</p>
                            {portfolio && (
                                <div className={styles.portfolioPreview}>
                                    <div className={styles.statRow}>
                                        <span>Total Ads</span>
                                        <span>{portfolio.totalAds}</span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span>Balance</span>
                                        <span>{portfolio.balanceScore}%</span>
                                    </div>
                                </div>
                            )}
                            {suggestions.length > 0 && (
                                <div className={styles.suggestionBox}>
                                    <div className={styles.insightTitle}>💡 Suggestion</div>
                                    <div className={styles.suggestionName}>{suggestions[0].title}</div>
                                    <div className={styles.suggestionScore}>
                                        Predicted: {suggestions[0].predictedScore}%
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
