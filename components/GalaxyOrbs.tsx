'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

interface CommunityPattern {
    traits: string[];
    traitLabels: string[];
    avgZScore: number;
    sampleSize: number;
    confidence: number;
    convertedScore?: number;
    convertedPercentile?: number;
    trendDirection?: 'rising' | 'falling' | 'stable';
    lastUpdated: string;
    category?: string;
}

interface GalaxyOrbsProps {
    onPatternSelect?: (pattern: CommunityPattern) => void;
    searchQuery?: string;
    filters?: {
        industry?: string;
        platform?: string;
        audience?: string;
    };
    maxOrbs?: number;
    className?: string;
}

// Color palette for orbs based on performance
const getOrbColor = (zScore: number) => {
    if (zScore > 1.5) return { primary: '#22C55E', glow: 'rgba(34, 197, 94, 0.6)' }; // Excellent - Green
    if (zScore > 0.5) return { primary: '#3B82F6', glow: 'rgba(59, 130, 246, 0.6)' }; // Good - Blue
    if (zScore > -0.5) return { primary: '#F59E0B', glow: 'rgba(245, 158, 11, 0.6)' }; // Average - Amber
    if (zScore > -1.5) return { primary: '#F97316', glow: 'rgba(249, 115, 22, 0.6)' }; // Below Avg - Orange
    return { primary: '#EF4444', glow: 'rgba(239, 68, 68, 0.6)' }; // Poor - Red
};

// Get trend icon
const getTrendIcon = (trend?: 'rising' | 'falling' | 'stable') => {
    switch (trend) {
        case 'rising': return '📈';
        case 'falling': return '📉';
        default: return '➡️';
    }
};

export default function GalaxyOrbs({
    onPatternSelect,
    searchQuery = '',
    filters = {},
    maxOrbs = 50,
    className = ''
}: GalaxyOrbsProps) {
    const [patterns, setPatterns] = useState<CommunityPattern[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<CommunityPattern | null>(null);
    const [hoveredOrb, setHoveredOrb] = useState<string | null>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isAutoRotate, setIsAutoRotate] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // Fetch patterns from public pool
    useEffect(() => {
        fetchPatterns();
    }, [filters.industry, filters.platform, filters.audience]);

    const fetchPatterns = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.industry) params.set('industry', filters.industry);
            params.set('limit', maxOrbs.toString());
            params.set('sortBy', 'avgZScore');
            params.set('sortOrder', 'desc');

            const response = await fetch(`/api/pool/public?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setPatterns(data.patterns || []);
            } else {
                setError(data.error || 'Failed to fetch patterns');
            }
        } catch (err) {
            console.error('Failed to fetch patterns:', err);
            setError('Unable to load community patterns');
        } finally {
            setLoading(false);
        }
    };

    // Filter patterns by search query
    const filteredPatterns = useMemo(() => {
        if (!searchQuery) return patterns;
        const query = searchQuery.toLowerCase();
        return patterns.filter(p =>
            p.traitLabels.some(label => label.toLowerCase().includes(query)) ||
            p.traits.some(trait => trait.toLowerCase().includes(query)) ||
            p.category?.toLowerCase().includes(query)
        );
    }, [patterns, searchQuery]);

    // Calculate orb positions in 3D space
    const orbPositions = useMemo(() => {
        return filteredPatterns.map((pattern, index) => {
            const total = filteredPatterns.length;
            const phi = Math.acos(-1 + (2 * index) / Math.max(total, 1));
            const theta = Math.sqrt(total * Math.PI) * phi;
            const radius = 120 + (pattern.sampleSize / 10); // Larger samples = further out

            return {
                x: radius * Math.cos(theta) * Math.sin(phi),
                y: radius * Math.sin(theta) * Math.sin(phi),
                z: radius * Math.cos(phi),
                size: Math.min(50, 15 + Math.sqrt(pattern.sampleSize) * 2),
                pattern
            };
        });
    }, [filteredPatterns]);

    // Auto-rotation animation
    useEffect(() => {
        if (!isAutoRotate) return;

        const interval = setInterval(() => {
            setRotation(prev => ({
                x: prev.x,
                y: prev.y + 0.3
            }));
        }, 50);

        return () => clearInterval(interval);
    }, [isAutoRotate]);

    // Mouse handlers for rotation
    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        setIsAutoRotate(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;

        const deltaX = e.clientX - lastMouse.current.x;
        const deltaY = e.clientY - lastMouse.current.y;

        setRotation(prev => ({
            x: prev.x + deltaY * 0.3,
            y: prev.y + deltaX * 0.3
        }));

        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    // Transform 3D to 2D with rotation
    const transform3Dto2D = (x: number, y: number, z: number) => {
        const radX = (rotation.x * Math.PI) / 180;
        const radY = (rotation.y * Math.PI) / 180;

        // Rotate around Y axis
        const x1 = x * Math.cos(radY) - z * Math.sin(radY);
        const z1 = x * Math.sin(radY) + z * Math.cos(radY);

        // Rotate around X axis
        const y1 = y * Math.cos(radX) - z1 * Math.sin(radX);
        const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

        // Project to 2D with perspective
        const perspective = 400;
        const scale = perspective / (perspective + z2);

        return {
            x: x1 * scale + 200, // Center in container
            y: y1 * scale + 200,
            scale,
            z: z2
        };
    };

    const handleOrbClick = (pattern: CommunityPattern) => {
        setSelectedPattern(pattern);
        onPatternSelect?.(pattern);
    };

    if (loading) {
        return (
            <div className={`galaxy-orbs-loading ${className}`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))',
                borderRadius: '16px',
                border: '1px solid rgba(99,102,241,0.2)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid rgba(99,102,241,0.3)',
                        borderTop: '3px solid #6366F1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading Galaxy Orbs...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`galaxy-orbs-error ${className}`} style={{
                padding: '24px',
                background: 'rgba(239,68,68,0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(239,68,68,0.3)',
                textAlign: 'center'
            }}>
                <p style={{ color: '#EF4444' }}>⚠️ {error}</p>
                <button
                    onClick={fetchPatterns}
                    style={{
                        marginTop: '12px',
                        padding: '8px 16px',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className={`galaxy-orbs-container ${className}`} style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🌌 Galaxy Orbs
                        <span style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            background: 'rgba(99,102,241,0.2)',
                            borderRadius: '12px',
                            color: 'var(--primary)'
                        }}>
                            {filteredPatterns.length} patterns
                        </span>
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Community patterns • Drag to rotate • Click orb for details
                    </p>
                </div>
                <button
                    onClick={() => setIsAutoRotate(!isAutoRotate)}
                    style={{
                        padding: '6px 12px',
                        background: isAutoRotate ? 'var(--primary)' : 'var(--bg-secondary)',
                        color: isAutoRotate ? 'white' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                    }}
                >
                    {isAutoRotate ? '⏸️ Pause' : '▶️ Auto-Rotate'}
                </button>
            </div>

            {/* 3D Orb Visualization */}
            <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '400px',
                    background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, rgba(15,23,42,0.95) 70%)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: isDragging.current ? 'grabbing' : 'grab',
                    border: '1px solid rgba(99,102,241,0.2)'
                }}
            >
                {/* Stars background */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\'%3E%3Cdefs%3E%3Cpattern id=\'stars\' patternUnits=\'userSpaceOnUse\' width=\'100\' height=\'100\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'0.5\' fill=\'%23fff\' opacity=\'0.3\'/%3E%3Ccircle cx=\'50\' cy=\'30\' r=\'0.3\' fill=\'%23fff\' opacity=\'0.2\'/%3E%3Ccircle cx=\'80\' cy=\'60\' r=\'0.4\' fill=\'%23fff\' opacity=\'0.25\'/%3E%3Ccircle cx=\'30\' cy=\'80\' r=\'0.5\' fill=\'%23fff\' opacity=\'0.3\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'url(%23stars)\' width=\'100%25\' height=\'100%25\'/%3E%3C/svg%3E")',
                    opacity: 0.5
                }}></div>

                {/* Orbs */}
                {orbPositions
                    .map(({ x, y, z, size, pattern }) => {
                        const pos = transform3Dto2D(x, y, z);
                        const orbId = pattern.traits.join('-');
                        const colors = getOrbColor(pattern.avgZScore);
                        const isHovered = hoveredOrb === orbId;
                        const isSelected = selectedPattern?.traits.join('-') === orbId;

                        return {
                            pos,
                            size,
                            pattern,
                            orbId,
                            colors,
                            isHovered,
                            isSelected
                        };
                    })
                    .sort((a, b) => a.pos.z - b.pos.z) // Sort by depth
                    .map(({ pos, size, pattern, orbId, colors, isHovered, isSelected }) => (
                        <div
                            key={orbId}
                            onMouseEnter={() => setHoveredOrb(orbId)}
                            onMouseLeave={() => setHoveredOrb(null)}
                            onClick={() => handleOrbClick(pattern)}
                            style={{
                                position: 'absolute',
                                left: `${pos.x}px`,
                                top: `${pos.y}px`,
                                width: `${size * pos.scale}px`,
                                height: `${size * pos.scale}px`,
                                borderRadius: '50%',
                                background: `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.primary}88)`,
                                boxShadow: isHovered || isSelected
                                    ? `0 0 30px ${colors.glow}, 0 0 60px ${colors.glow}`
                                    : `0 0 15px ${colors.glow}`,
                                transform: `translate(-50%, -50%) scale(${isHovered ? 1.2 : 1})`,
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer',
                                opacity: 0.4 + pos.scale * 0.6,
                                zIndex: Math.round(pos.z + 200),
                                border: isSelected ? '2px solid white' : 'none'
                            }}
                        >
                            {/* Trend indicator */}
                            {isHovered && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-20px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                    background: 'rgba(0,0,0,0.8)',
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                }}>
                                    {getTrendIcon(pattern.trendDirection)} {pattern.convertedScore || Math.round(50 + pattern.avgZScore * 15)}%
                                </span>
                            )}
                        </div>
                    ))}

                {/* Center glow */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '80px',
                    height: '80px',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)',
                    pointerEvents: 'none'
                }}></div>
            </div>

            {/* Pattern Details Panel */}
            {selectedPattern && (
                <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
                                {getTrendIcon(selectedPattern.trendDirection)} Pattern Details
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                {selectedPattern.traitLabels.map((label, idx) => (
                                    <span key={idx} style={{
                                        padding: '4px 10px',
                                        background: 'rgba(99,102,241,0.2)',
                                        borderRadius: '16px',
                                        fontSize: '0.8rem',
                                        color: 'var(--primary)'
                                    }}>
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedPattern(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                color: 'var(--text-muted)'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: getOrbColor(selectedPattern.avgZScore).primary }}>
                                {selectedPattern.convertedScore || Math.round(50 + selectedPattern.avgZScore * 15)}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Success Score</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{selectedPattern.sampleSize}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sample Size</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{Math.round(selectedPattern.confidence * 100)}%</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{selectedPattern.convertedPercentile || '—'}th</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Percentile</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div style={{
                marginTop: '12px',
                display: 'flex',
                gap: '16px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E' }}></span>
                    Excellent
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3B82F6' }}></span>
                    Good
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }}></span>
                    Average
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }}></span>
                    Poor
                </span>
            </div>

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
