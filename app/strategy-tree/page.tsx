'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styles from './page.module.css';
import { useTheme } from '@/components/ThemeProvider';
import { buildStrategyTree } from '@/lib/ml/creative-strategy';
import { generateSuggestions, analyzePortfolio, getAvoidanceAdvice, analyzeHistoricalPatterns, CreativeSuggestion, PortfolioAnalysis, AvoidanceAdvice, HistoricalPattern } from '@/lib/ml/creative-suggestions';
import { analyzeWinningAds, WinningInsight } from '@/lib/ml/andromeda-insights';

// Types
interface MindMapNode {
    id: string;
    label: string;
    type: 'center' | 'branch' | 'subbranch' | 'leaf';
    color: string;
    x: number;
    y: number;
    radius: number;
    parentId?: string;
    angle?: number;
    score?: number;
    adsCount?: number;
}

interface AdData {
    id: string;
    name?: string;
    facebookAdId?: string;
    extractedContent?: Record<string, unknown>;
    adInsights?: Record<string, unknown>;
    [key: string]: unknown;
}

// Vibrant color palette matching the reference image
const BRANCH_COLORS = {
    pink: '#E91E8C',
    green: '#8BC53F',
    blue: '#00A0E3',
    orange: '#F7931E',
    red: '#ED1C24',
    teal: '#00BCD4',
    purple: '#9C27B0',
};

const COLOR_ARRAY = Object.values(BRANCH_COLORS);

// Performance-based color calculation
// Green = good performance (70+), Yellow/Orange = medium (40-70), Red = poor (<40)
function getPerformanceColor(score: number | undefined): string {
    if (score === undefined) return '#64748b'; // Gray for no data
    if (score >= 75) return '#22c55e'; // Bright green - excellent
    if (score >= 60) return '#84cc16'; // Lime - good
    if (score >= 45) return '#eab308'; // Yellow - average
    if (score >= 30) return '#f97316'; // Orange - below average
    return '#ef4444'; // Red - poor
}

// Get gradient ID based on branch color
function getGradientId(color: string): string {
    const colorMap: Record<string, string> = {
        '#E91E8C': 'url(#grad-pink)',
        '#8BC53F': 'url(#grad-green)',
        '#00A0E3': 'url(#grad-blue)',
        '#F7931E': 'url(#grad-orange)',
        '#ED1C24': 'url(#grad-red)',
        '#00BCD4': 'url(#grad-teal)',
        '#9C27B0': 'url(#grad-purple)',
    };
    return colorMap[color] || color;
}

// Deduplication utilities
function generateAdHash(ad: AdData): string {
    const fields = [
        ad.facebookAdId || '',
        ad.name || '',
        JSON.stringify(ad.extractedContent?.title || ''),
        JSON.stringify(ad.extractedContent?.hookType || ''),
        JSON.stringify(ad.adInsights?.spend || 0),
    ].join('|');

    let hash = 0;
    for (let i = 0; i < fields.length; i++) {
        const char = fields.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

function deduplicateAds(existingAds: AdData[], newAds: AdData[]): {
    merged: AdData[];
    added: number;
    duplicates: number;
} {
    const existingHashes = new Set(existingAds.map(generateAdHash));
    const existingIds = new Set(existingAds.map(a => a.id));

    const uniqueNewAds: AdData[] = [];
    let duplicates = 0;

    for (const ad of newAds) {
        const hash = generateAdHash(ad);
        if (existingHashes.has(hash) || existingIds.has(ad.id)) {
            duplicates++;
        } else {
            const newAd = {
                ...ad,
                id: ad.id || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            };
            uniqueNewAds.push(newAd);
            existingHashes.add(hash);
            existingIds.add(newAd.id);
        }
    }

    return {
        merged: [...existingAds, ...uniqueNewAds],
        added: uniqueNewAds.length,
        duplicates
    };
}

// Create organic mind map layout
function createMindMapLayout(tree: ReturnType<typeof buildStrategyTree>): MindMapNode[] {
    if (!tree) return [];

    const nodes: MindMapNode[] = [];
    const cx = 500, cy = 350;
    const centerRadius = 55;

    // Center node - "STRATEGY" hub
    nodes.push({
        id: tree.id,
        label: 'STRATEGY',
        type: 'center',
        color: BRANCH_COLORS.green,
        x: cx,
        y: cy,
        radius: centerRadius,
        score: tree.score,
        adsCount: tree.adsCount
    });

    const branchCount = Math.min(tree.children.length, 6);
    const angleStep = (Math.PI * 2) / Math.max(branchCount, 1);

    // Main branches (platforms/categories)
    tree.children.slice(0, 6).forEach((platform, i) => {
        const baseAngle = angleStep * i - Math.PI / 2;
        // Reduced jitter to prevent overlap
        const angle = baseAngle;
        const dist = 180; // Increased from 140 for more spacing
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        const branchColor = COLOR_ARRAY[i % COLOR_ARRAY.length];

        nodes.push({
            id: platform.id,
            label: platform.label.toUpperCase(),
            type: 'branch',
            color: branchColor,
            x: px,
            y: py,
            radius: 42,
            parentId: tree.id,
            angle: angle,
            score: platform.score,
            adsCount: platform.adsCount
        });

        // Sub-branches extending outward
        const subCount = Math.min(platform.children.length, 5);
        platform.children.slice(0, 5).forEach((ctype, j) => {
            // Wider spread angle to prevent overlap
            const spreadAngle = 0.5; // Increased from 0.35
            const subAngle = angle + (j - (subCount - 1) / 2) * spreadAngle;
            const subDist = 110; // Increased from 85 for more spacing
            const tx = px + Math.cos(subAngle) * subDist;
            const ty = py + Math.sin(subAngle) * subDist;

            nodes.push({
                id: ctype.id,
                label: ctype.label.replace(/_/g, ' ').toUpperCase().substring(0, 10),
                type: 'subbranch',
                color: branchColor,
                x: tx,
                y: ty,
                radius: 28, // Slightly smaller to reduce overlap
                parentId: platform.id,
                angle: subAngle,
                score: ctype.score,
                adsCount: ctype.adsCount
            });

            // Leaf nodes (individual ads/items)
            const leafCount = Math.min(ctype.children.length, 4);
            ctype.children.slice(0, 4).forEach((ad, k) => {
                // Wider leaf spread to prevent overlap
                const leafSpread = 0.55; // Increased from 0.4
                const leafAngle = subAngle + (k - (leafCount - 1) / 2) * leafSpread;
                const leafDist = 65; // Increased from 50 for more spacing

                nodes.push({
                    id: ad.id,
                    label: ad.label?.substring(0, 8).toUpperCase() || '',
                    type: 'leaf',
                    color: branchColor,
                    x: tx + Math.cos(leafAngle) * leafDist,
                    y: ty + Math.sin(leafAngle) * leafDist,
                    radius: 18, // Slightly smaller to reduce overlap
                    parentId: ctype.id,
                    angle: leafAngle,
                    score: ad.score
                });
            });
        });
    });

    return nodes;
}

// Import Modal Component
interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: AdData[]) => void;
}

function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<{ count: number; sample?: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setJsonText(content);
            parseAndPreview(content);
        };
        reader.readAsText(file);
    };

    // Lenient JSON parsing - tries to fix common issues
    const lenientParse = (text: string): { data: unknown[]; warnings: string[] } => {
        const warnings: string[] = [];
        let cleanText = text.trim();

        // Try direct parse first
        try {
            const data = JSON.parse(cleanText);
            return { data: Array.isArray(data) ? data : [data], warnings };
        } catch (e) {
            // Continue with fixes
        }

        // Fix 1: Try removing trailing commas
        cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');
        try {
            const data = JSON.parse(cleanText);
            warnings.push('Fixed trailing commas');
            return { data: Array.isArray(data) ? data : [data], warnings };
        } catch (e) {
            // Continue
        }

        // Fix 2: Try wrapping single object in array
        if (!cleanText.startsWith('[')) {
            try {
                const data = JSON.parse(`[${cleanText}]`);
                warnings.push('Wrapped object in array');
                return { data, warnings };
            } catch (e) {
                // Continue
            }
        }

        // Fix 3: Try extracting any valid JSON objects from text
        const objectMatches = cleanText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (objectMatches && objectMatches.length > 0) {
            const validObjects: unknown[] = [];
            for (const match of objectMatches) {
                try {
                    validObjects.push(JSON.parse(match));
                } catch {
                    // Skip invalid object
                }
            }
            if (validObjects.length > 0) {
                warnings.push(`Extracted ${validObjects.length} valid objects from malformed JSON`);
                return { data: validObjects, warnings };
            }
        }

        throw new Error('Could not parse JSON even with lenient parsing');
    };

    // Validate that an item looks like ad data
    const isValidAdData = (item: unknown): boolean => {
        if (!item || typeof item !== 'object') return false;
        const obj = item as Record<string, unknown>;
        // Accept if it has any of these identifiers or ad-like properties
        return !!(obj.id || obj.facebookAdId || obj.adId || obj.name ||
            obj.extractedContent || obj.adInsights || obj.creativeId);
    };

    const parseAndPreview = (text: string) => {
        try {
            setError('');
            const { data, warnings } = lenientParse(text);

            // Filter to valid ad-like items
            const validAds = data.filter(isValidAdData);
            const skipped = data.length - validAds.length;

            if (validAds.length === 0) {
                setError('No valid ad data found in JSON');
                setPreview(null);
                return;
            }

            let warningText = '';
            if (skipped > 0) {
                warningText = ` (${skipped} invalid items skipped)`;
            }
            if (warnings.length > 0) {
                warningText += ` • ${warnings.join(', ')}`;
            }

            setPreview({
                count: validAds.length,
                sample: ((validAds[0] as Record<string, unknown>)?.name as string) ||
                    ((validAds[0] as Record<string, unknown>)?.id as string) ||
                    'Ad data' + (warningText ? warningText : '')
            });
        } catch {
            setError('Unable to parse JSON - please check format');
            setPreview(null);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJsonText(e.target.value);
        if (e.target.value.trim()) {
            parseAndPreview(e.target.value);
        } else {
            setPreview(null);
            setError('');
        }
    };

    const handleImport = () => {
        try {
            const { data } = lenientParse(jsonText);
            const validAds = data.filter(isValidAdData);

            if (validAds.length === 0) {
                setError('No valid ad data to import');
                return;
            }

            onImport(validAds as AdData[]);
            setJsonText('');
            setPreview(null);
            onClose();
        } catch {
            setError('Failed to parse JSON');
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>Import Traits JSON</h2>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.importOptions}>
                        <button
                            className={styles.uploadBtn}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            📁 Upload JSON File
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                    </div>

                    <div className={styles.divider}>or paste JSON below</div>

                    <textarea
                        className={styles.jsonInput}
                        value={jsonText}
                        onChange={handleTextChange}
                        placeholder='[{"id": "ad-1", "name": "My Ad", "extractedContent": {...}}]'
                        rows={8}
                    />

                    {error && <div className={styles.importError}>{error}</div>}

                    {preview && (
                        <div className={styles.importPreview}>
                            ✅ Found <strong>{preview.count}</strong> ad(s) ready to import
                            {preview.sample && <span> • Sample: {preview.sample}</span>}
                        </div>
                    )}

                    <div className={styles.dedupeNote}>
                        💡 Duplicates will be automatically detected and skipped
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button
                        className={styles.importBtn}
                        onClick={handleImport}
                        disabled={!preview || !!error}
                    >
                        Import {preview?.count || 0} Ad(s)
                    </button>
                </div>
            </div>
        </div>
    );
}

// Toast Component
interface ToastProps {
    message: string;
    type: 'success' | 'info' | 'error';
    onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`${styles.toast} ${styles[type]}`}>
            {message}
        </div>
    );
}

// AI Suggestions Panel Component
interface AISuggestionsPanelProps {
    suggestions: CreativeSuggestion[];
    portfolio: PortfolioAnalysis | null;
    patterns: HistoricalPattern[];
    avoidance: AvoidanceAdvice[];
}

function AISuggestionsPanel({ suggestions, portfolio, patterns, avoidance }: AISuggestionsPanelProps) {
    const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

    const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
        switch (priority) {
            case 'high': return '#8BC53F';
            case 'medium': return '#00A0E3';
            case 'low': return '#F7931E';
        }
    };

    const topSuggestions = suggestions.slice(0, 3);
    const topPatterns = patterns.filter(p => p.successRate >= 60).slice(0, 4);

    return (
        <div className={styles.aiSuggestionsPanel}>
            {/* What's Next Section */}
            <div className={styles.aiSection}>
                <div className={styles.aiSectionTitle}>
                    <span>🎯</span> What&apos;s Next
                </div>
                {topSuggestions.length > 0 ? (
                    <div className={styles.suggestionsStack}>
                        {topSuggestions.map(suggestion => (
                            <div
                                key={suggestion.id}
                                className={styles.suggestionCard}
                                style={{ borderLeftColor: getPriorityColor(suggestion.priority) }}
                            >
                                <div className={styles.suggestionHeader}>
                                    <span
                                        className={styles.priorityBadge}
                                        style={{ backgroundColor: `${getPriorityColor(suggestion.priority)}20`, color: getPriorityColor(suggestion.priority) }}
                                    >
                                        {suggestion.priority.toUpperCase()}
                                    </span>
                                    <span className={styles.confidenceBadge}>
                                        {suggestion.confidence}% conf
                                    </span>
                                </div>
                                <div className={styles.suggestionTitle}>{suggestion.title}</div>
                                <div className={styles.suggestionReason}>{suggestion.reason}</div>
                                <div className={styles.suggestionScore}>
                                    Predicted Score: <strong>{suggestion.predictedScore}%</strong>
                                </div>
                                <button
                                    className={styles.expandBtn}
                                    onClick={() => setExpandedSuggestion(
                                        expandedSuggestion === suggestion.id ? null : suggestion.id
                                    )}
                                >
                                    {expandedSuggestion === suggestion.id ? '▲ Hide Details' : '▼ View Implementation'}
                                </button>
                                {expandedSuggestion === suggestion.id && (
                                    <div className={styles.implementationDetails}>
                                        <div className={styles.detailRow}>
                                            <span>Format:</span>
                                            <span>{suggestion.implementation.format}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <span>Hook:</span>
                                            <span>{suggestion.implementation.hook}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <span>Duration:</span>
                                            <span>{suggestion.implementation.duration}</span>
                                        </div>
                                        <div className={styles.exampleBox}>
                                            <strong>Example:</strong> {suggestion.implementation.example}
                                        </div>
                                        {suggestion.basedOn.length > 0 && (
                                            <div className={styles.basedOnList}>
                                                <strong>Why this works:</strong>
                                                <ul>
                                                    {suggestion.basedOn.slice(0, 3).map((reason, i) => (
                                                        <li key={i}>{reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyHint}>Import ads to see suggestions</div>
                )}
            </div>

            {/* Portfolio Health Section */}
            {portfolio && (
                <div className={styles.aiSection}>
                    <div className={styles.aiSectionTitle}>
                        <span>📊</span> Portfolio Health
                    </div>
                    <div className={styles.healthGrid}>
                        <div className={styles.healthStat}>
                            <span className={styles.healthValue}>{portfolio.balanceScore}%</span>
                            <span className={styles.healthLabel}>Balance</span>
                        </div>
                        <div className={styles.healthStat}>
                            <span className={styles.healthValue}>{portfolio.totalAds}</span>
                            <span className={styles.healthLabel}>Total Ads</span>
                        </div>
                        <div className={styles.healthStat}>
                            <span className={styles.healthValue}>{portfolio.safeWildRatio.safe}/{portfolio.safeWildRatio.wild}</span>
                            <span className={styles.healthLabel}>Safe/Wild</span>
                        </div>
                    </div>
                    {portfolio.gaps.length > 0 && (
                        <div className={styles.gapsWarning}>
                            <strong>Missing:</strong> {portfolio.gaps.map(g => g.replace(/_/g, ' ')).join(', ')}
                        </div>
                    )}
                    {portfolio.recommendations.length > 0 && (
                        <div className={styles.recommendationsList}>
                            {portfolio.recommendations.slice(0, 2).map((rec, i) => (
                                <div key={i} className={styles.recommendationItem}>💡 {rec}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Winning Patterns Section */}
            {topPatterns.length > 0 && (
                <div className={styles.aiSection}>
                    <div className={styles.aiSectionTitle}>
                        <span>⚡</span> Winning Patterns
                    </div>
                    <div className={styles.patternsList}>
                        {topPatterns.map((pattern, i) => (
                            <div key={i} className={styles.patternItem}>
                                <span className={styles.patternName}>
                                    {pattern.feature.replace(/_/g, ' ').replace(/:/g, ': ')}
                                </span>
                                <span className={styles.patternSuccess} style={{
                                    color: pattern.successRate >= 70 ? '#8BC53F' : '#F7931E'
                                }}>
                                    {pattern.successRate}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Avoidance Advice Section */}
            {avoidance.length > 0 && (
                <div className={styles.aiSection}>
                    <div className={styles.aiSectionTitle}>
                        <span>⚠️</span> Avoid These
                    </div>
                    <div className={styles.avoidanceList}>
                        {avoidance.slice(0, 2).map((advice, i) => (
                            <div key={i} className={styles.warningCard}>
                                <div className={styles.warningHeader}>
                                    <span className={styles.warningPattern}>{advice.pattern}</span>
                                    <span className={styles.failureRate}>{advice.failureRate}% fail</span>
                                </div>
                                <div className={styles.warningReason}>{advice.reason}</div>
                                {advice.examples.length > 0 && (
                                    <div className={styles.fixSuggestions}>
                                        <strong>Fix:</strong> {advice.examples.slice(0, 2).join(' • ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StrategyTreePage() {
    const [ads, setAds] = useState<AdData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<MindMapNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
    const { resolvedTheme } = useTheme();

    // Pan & Zoom state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('ads');
            if (stored) setAds(JSON.parse(stored));
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    const handleImport = useCallback((newAds: AdData[]) => {
        const result = deduplicateAds(ads, newAds);
        localStorage.setItem('ads', JSON.stringify(result.merged));
        setAds(result.merged);

        if (result.duplicates > 0) {
            setToast({
                message: `Added ${result.added} ad(s), skipped ${result.duplicates} duplicate(s)`,
                type: 'info'
            });
        } else {
            setToast({
                message: `Successfully imported ${result.added} ad(s)`,
                type: 'success'
            });
        }
    }, [ads]);

    // Zoom handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 0.3), 3));
    }, []);

    const handleZoomIn = useCallback(() => setZoom(z => Math.min(z * 1.2, 3)), []);
    const handleZoomOut = useCallback(() => setZoom(z => Math.max(z * 0.8, 0.3)), []);
    const handleResetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    // Pan handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPan({
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y
        });
    }, [isPanning, panStart]);

    const handleMouseUp = useCallback(() => setIsPanning(false), []);

    const nodes = useMemo(() => {
        if (ads.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createMindMapLayout(buildStrategyTree(ads as any));
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

    const patterns = useMemo(() => {
        if (ads.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return analyzeHistoricalPatterns(ads as any);
    }, [ads]);

    const avoidance = useMemo(() => {
        if (ads.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getAvoidanceAdvice(ads as any);
    }, [ads]);

    // Analyze winning ads for "Why It Worked" insights
    const winningInsights = useMemo(() => {
        if (ads.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return analyzeWinningAds(ads as any, 70);
    }, [ads]);

    // Create a map of insights by ad ID for quick lookup
    const insightsMap = useMemo(() => {
        const map = new Map<string, WinningInsight>();
        winningInsights.forEach(insight => map.set(insight.adId, insight));
        return map;
    }, [winningInsights]);

    // Panel tab state
    const [activeTab, setActiveTab] = useState<'node' | 'ai'>('ai');

    // Get connections between nodes
    const connections = useMemo(() => {
        const conns: { from: MindMapNode; to: MindMapNode }[] = [];
        nodes.forEach(n => {
            if (n.parentId) {
                const parent = nodes.find(p => p.id === n.parentId);
                if (parent) conns.push({ from: parent, to: n });
            }
        });
        return conns;
    }, [nodes]);

    // Generate curved path for organic connections
    const generateCurvePath = (from: MindMapNode, to: MindMapNode): string => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Start and end at circle edges
        const startX = from.x + (dx / dist) * from.radius;
        const startY = from.y + (dy / dist) * from.radius;
        const endX = to.x - (dx / dist) * to.radius;
        const endY = to.y - (dy / dist) * to.radius;

        // Control point for organic curve
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const curveFactor = 0.15;
        const cx = midX + (-dy * curveFactor);
        const cy = midY + (dx * curveFactor);

        return `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`;
    };

    if (loading) {
        return (
            <div className={styles.container} data-theme={resolvedTheme}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span>Loading Mind Map...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container} data-theme={resolvedTheme}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <span className={styles.titleIcon}>🧠</span>
                    Strategy Mind Map
                </h1>
                <button
                    className={styles.importButton}
                    onClick={() => setShowImportModal(true)}
                >
                    📥 Import JSON
                </button>
            </div>

            <div className={styles.mainLayout}>
                <div
                    className={styles.mindmapContainer}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                >
                    {ads.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🧠</div>
                            <div className={styles.emptyTitle}>Build Your Mind Map</div>
                            <div className={styles.emptyText}>Import your ad data to visualize strategy connections</div>
                            <button
                                className={styles.importButtonLarge}
                                onClick={() => setShowImportModal(true)}
                            >
                                📥 Import Traits JSON
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Zoom Controls */}
                            <div className={styles.zoomControls}>
                                <button onClick={handleZoomIn} title="Zoom In">+</button>
                                <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
                                <button onClick={handleZoomOut} title="Zoom Out">−</button>
                                <button onClick={handleResetView} title="Reset View" className={styles.resetBtn}>⟲</button>
                            </div>

                            <svg
                                ref={svgRef}
                                viewBox="0 0 1000 700"
                                className={styles.mindmapSvg}
                                preserveAspectRatio="xMidYMid meet"
                            >
                                {/* Light gradient background */}
                                <defs>
                                    <radialGradient id="bgGradient" cx="50%" cy="50%" r="60%">
                                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
                                        <stop offset="100%" stopColor="transparent" />
                                    </radialGradient>

                                    {/* Glow filters for nodes */}
                                    <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="3" result="blur" />
                                        <feMerge>
                                            <feMergeNode in="blur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>

                                    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                                    </filter>

                                    {/* Connection line glow filter */}
                                    <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="2" result="glow" />
                                        <feMerge>
                                            <feMergeNode in="glow" />
                                            <feMergeNode in="glow" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>

                                    {/* Gradient definitions for each branch color */}
                                    <linearGradient id="grad-pink" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#E91E8C" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#E91E8C" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#FF69B4" stopOpacity="0.6" />
                                    </linearGradient>
                                    <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#8BC53F" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#8BC53F" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#A8E063" stopOpacity="0.6" />
                                    </linearGradient>
                                    <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#00A0E3" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#00A0E3" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.6" />
                                    </linearGradient>
                                    <linearGradient id="grad-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#F7931E" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#F7931E" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#FFB347" stopOpacity="0.6" />
                                    </linearGradient>
                                    <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#ED1C24" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#ED1C24" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.6" />
                                    </linearGradient>
                                    <linearGradient id="grad-teal" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#00BCD4" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#00BCD4" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#4DD0E1" stopOpacity="0.6" />
                                    </linearGradient>
                                    <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#9C27B0" stopOpacity="0.4" />
                                        <stop offset="50%" stopColor="#9C27B0" stopOpacity="1" />
                                        <stop offset="100%" stopColor="#CE93D8" stopOpacity="0.6" />
                                    </linearGradient>
                                </defs>

                                {/* Subtle background circle */}
                                <circle cx="500" cy="350" r="320" fill="url(#bgGradient)" />

                                {/* Transform group for pan/zoom */}
                                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: '500px 350px' }}>

                                    {/* Connection lines - organic curves with gradients */}
                                    <g className={styles.connectionsGroup}>
                                        {connections.map((conn, i) => {
                                            const isHighlighted = hoveredNode === conn.to.id || hoveredNode === conn.from.id;
                                            const strokeWidth = conn.from.type === 'center' ? 5 : conn.to.type === 'leaf' ? 2.5 : 3.5;

                                            return (
                                                <g key={`conn-${i}`}>
                                                    {/* Glow layer (behind) */}
                                                    <path
                                                        d={generateCurvePath(conn.from, conn.to)}
                                                        fill="none"
                                                        stroke={conn.to.color}
                                                        strokeWidth={strokeWidth + 4}
                                                        strokeLinecap="round"
                                                        opacity={isHighlighted ? 0.4 : 0.15}
                                                        className={styles.connectionGlow}
                                                    />
                                                    {/* Main line */}
                                                    <path
                                                        d={generateCurvePath(conn.from, conn.to)}
                                                        fill="none"
                                                        stroke={getGradientId(conn.to.color)}
                                                        strokeWidth={strokeWidth}
                                                        strokeLinecap="round"
                                                        opacity={isHighlighted ? 1 : 0.85}
                                                        className={styles.connectionLine}
                                                        filter={isHighlighted ? 'url(#lineGlow)' : undefined}
                                                    />
                                                </g>
                                            );
                                        })}
                                    </g>

                                    {/* Nodes */}
                                    <g className={styles.nodesGroup}>
                                        {nodes.map(node => {
                                            const isHovered = hoveredNode === node.id;
                                            const isSelected = selected?.id === node.id;
                                            const scale = isHovered ? 1.1 : 1;
                                            // Use performance color for leaf nodes, branch color for others
                                            const nodeColor = node.type === 'leaf' || node.type === 'subbranch'
                                                ? getPerformanceColor(node.score)
                                                : node.color;

                                            return (
                                                <g
                                                    key={node.id}
                                                    className={styles.nodeGroup}
                                                    onClick={(e) => { e.stopPropagation(); setSelected(node); }}
                                                    onMouseEnter={() => setHoveredNode(node.id)}
                                                    onMouseLeave={() => setHoveredNode(null)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {/* Performance ring for nodes with scores */}
                                                    {node.score !== undefined && node.type !== 'center' && (
                                                        <circle
                                                            cx={node.x}
                                                            cy={node.y}
                                                            r={node.radius * scale + 4}
                                                            fill="none"
                                                            stroke={getPerformanceColor(node.score)}
                                                            strokeWidth={2}
                                                            opacity={0.6}
                                                            className={styles.performanceRing}
                                                        />
                                                    )}
                                                    {/* Main bubble */}
                                                    <circle
                                                        cx={node.x}
                                                        cy={node.y}
                                                        r={node.radius * scale}
                                                        fill={nodeColor}
                                                        filter={isHovered || isSelected ? 'url(#nodeGlow)' : 'url(#dropShadow)'}
                                                        stroke={isSelected ? '#fff' : 'none'}
                                                        strokeWidth={isSelected ? 3 : 0}
                                                        className={styles.nodeBubble}
                                                    />

                                                    {/* Highlight/shine effect */}
                                                    <ellipse
                                                        cx={node.x - node.radius * 0.25}
                                                        cy={node.y - node.radius * 0.25}
                                                        rx={node.radius * 0.35}
                                                        ry={node.radius * 0.25}
                                                        fill="rgba(255, 255, 255, 0.25)"
                                                        className={styles.nodeShine}
                                                    />

                                                    {/* Insight indicator - shows on high-performing ads with traits */}
                                                    {node.type === 'leaf' && insightsMap.has(node.id) && (
                                                        <g className={styles.insightIndicator}>
                                                            {/* Pulsing glow */}
                                                            <circle
                                                                cx={node.x + node.radius * 0.6}
                                                                cy={node.y - node.radius * 0.6}
                                                                r={6}
                                                                fill="#fbbf24"
                                                                className={styles.insightPulse}
                                                            />
                                                            {/* Star icon */}
                                                            <text
                                                                x={node.x + node.radius * 0.6}
                                                                y={node.y - node.radius * 0.6}
                                                                textAnchor="middle"
                                                                dominantBaseline="central"
                                                                fontSize={8}
                                                                fill="#1e293b"
                                                            >
                                                                ★
                                                            </text>
                                                        </g>
                                                    )}

                                                    {/* Label text */}
                                                    {(node.type !== 'leaf' || node.label) && (
                                                        <text
                                                            x={node.x}
                                                            y={node.y}
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            fill="#fff"
                                                            fontSize={
                                                                node.type === 'center' ? 12 :
                                                                    node.type === 'branch' ? 9 :
                                                                        node.type === 'subbranch' ? 7 : 6
                                                            }
                                                            fontWeight="700"
                                                            fontFamily="Arial, sans-serif"
                                                            className={styles.nodeLabel}
                                                        >
                                                            {node.label}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </g>
                                </g>
                            </svg>
                        </>
                    )}
                </div>

                {/* Details Panel */}
                <div className={styles.detailsPanel}>
                    {/* Panel Tabs */}
                    <div className={styles.panelTabs}>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'ai' ? styles.activeTab : ''}`}
                            onClick={() => { setActiveTab('ai'); setSelected(null); }}
                        >
                            🤖 AI Insights
                        </button>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'node' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('node')}
                        >
                            📍 Node Info
                        </button>
                    </div>

                    {activeTab === 'ai' ? (
                        <AISuggestionsPanel
                            suggestions={suggestions}
                            portfolio={portfolio}
                            patterns={patterns}
                            avoidance={avoidance}
                        />
                    ) : selected ? (
                        <>
                            <div className={styles.panelHeader}>
                                <div className={styles.nodeColorDot} style={{ backgroundColor: selected.color }} />
                                <div className={styles.panelTitle}>{selected.label || 'Item'}</div>
                            </div>
                            <div className={styles.nodeTypeTag} style={{ backgroundColor: `${selected.color}20`, color: selected.color }}>
                                {selected.type.toUpperCase()}
                            </div>
                            {selected.score !== undefined && (
                                <div className={styles.scoreDisplay}>
                                    <span className={styles.scoreValue} style={{ color: selected.color }}>
                                        {selected.score}%
                                    </span>
                                    <span className={styles.scoreLabel}>
                                        {selected.score >= 80 ? 'EXCELLENT' : selected.score >= 65 ? 'GOOD' : selected.score >= 50 ? 'NEUTRAL' : 'NEEDS WORK'}
                                    </span>
                                </div>
                            )}
                            {selected.adsCount !== undefined && selected.adsCount > 0 && (
                                <div className={styles.statRow}>
                                    <span>Connected Ads</span>
                                    <span>{selected.adsCount}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.nodeSelectHint}>
                            <div className={styles.hintIcon}>📍</div>
                            <div className={styles.panelTitle}>Select a Node</div>
                            <p className={styles.panelHint}>Click any bubble on the map to view its details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Import Modal */}
            <ImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
            />

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
