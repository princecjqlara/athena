'use client';

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
    text?: string;
}

/**
 * Loading Spinner Component
 * Displays a spinning loader with optional text
 */
export function LoadingSpinner({ size = 'md', color = '#6366F1', text }: LoadingSpinnerProps) {
    const sizes = {
        sm: { spinner: 20, stroke: 2 },
        md: { spinner: 32, stroke: 3 },
        lg: { spinner: 48, stroke: 4 }
    };

    const { spinner, stroke } = sizes[size];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
        }}>
            <svg
                width={spinner}
                height={spinner}
                viewBox="0 0 50 50"
                style={{ animation: 'spin 1s linear infinite' }}
            >
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth={stroke}
                />
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray="31.4 31.4"
                    style={{ animation: 'dash 1.5s ease-in-out infinite' }}
                />
            </svg>
            {text && (
                <p style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
                    margin: 0
                }}>
                    {text}
                </p>
            )}
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes dash {
                    0% { stroke-dashoffset: 62.8; }
                    50% { stroke-dashoffset: 15.7; }
                    100% { stroke-dashoffset: 62.8; }
                }
            `}</style>
        </div>
    );
}

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string;
    className?: string;
}

/**
 * Skeleton Loader Component
 * Displays a pulsing placeholder for loading content
 */
export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px', className }: SkeletonProps) {
    return (
        <div
            className={className}
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                borderRadius,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite'
            }}
        >
            <style jsx global>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
}

interface SkeletonCardProps {
    lines?: number;
}

/**
 * Skeleton Card Component
 * Pre-built skeleton for card-like content
 */
export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
    return (
        <div style={{
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            <Skeleton width="60%" height="24px" />
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} width={`${100 - i * 15}%`} height="16px" />
            ))}
        </div>
    );
}

interface LoadingOverlayProps {
    isLoading: boolean;
    text?: string;
    children: React.ReactNode;
}

/**
 * Loading Overlay Component
 * Wraps content with a loading overlay when isLoading is true
 */
export function LoadingOverlay({ isLoading, text, children }: LoadingOverlayProps) {
    return (
        <div style={{ position: 'relative' }}>
            {children}
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 15, 26, 0.8)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'inherit',
                    zIndex: 10
                }}>
                    <LoadingSpinner text={text} />
                </div>
            )}
        </div>
    );
}

export default LoadingSpinner;
