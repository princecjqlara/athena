/**
 * Ad Quality Scoring Types
 * Chess-inspired quality analysis system for ads
 */

// Quality issue severity levels (chess-inspired)
export type IssueSeverity = 'blunder' | 'mistake' | 'inaccuracy';
export type PositiveRating = 'brilliant' | 'excellent' | 'good' | 'book_move';

// Score impacts for issues
export const ISSUE_PENALTIES: Record<IssueSeverity, number> = {
    blunder: -50,      // Critical error (e.g., no CTA, broken link, completely wrong format)
    mistake: -25,      // Significant problem (e.g., wrong aspect ratio, poor hook)
    inaccuracy: -10,   // Minor issue (e.g., missing subtitles, suboptimal placement)
};

// Score bonuses for positives
export const POSITIVE_BONUSES: Record<PositiveRating, number> = {
    brilliant: 30,     // Innovative technique that exceeds best practices
    excellent: 20,     // Best practice implementation
    good: 10,          // Solid choice
    book_move: 5,      // Standard practice followed
};

// Issue categories
export type IssueCategory =
    | 'creative'       // Hook, editing, visual quality
    | 'technical'      // Format, resolution, aspect ratio
    | 'copy'           // CTA, messaging, clarity
    | 'targeting'      // Placement, audience fit
    | 'accessibility'  // Subtitles, captions, alt text
    | 'compliance';    // Policy adherence

// Individual quality issue
export interface QualityIssue {
    id: string;
    severity: IssueSeverity;
    category: IssueCategory;
    title: string;
    description: string;
    impact: string;           // e.g., "-12% avg watch time"
    fix: string;              // Actionable recommendation
    penaltyApplied: number;   // Actual points deducted
}

// Individual positive aspect
export interface QualityPositive {
    id: string;
    rating: PositiveRating;
    category: IssueCategory;
    title: string;
    description: string;
    impact: string;           // e.g., "+15% hook rate"
    bonusApplied: number;     // Actual points added
}

// Letter grade thresholds
export type QualityGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export const GRADE_THRESHOLDS: Record<QualityGrade, { min: number; label: string; color: string }> = {
    'S': { min: 95, label: 'Exceptional', color: '#fbbf24' },   // Gold
    'A': { min: 85, label: 'Excellent', color: '#22c55e' },     // Green
    'B': { min: 70, label: 'Good', color: '#3b82f6' },          // Blue
    'C': { min: 55, label: 'Average', color: '#f59e0b' },       // Orange
    'D': { min: 40, label: 'Below Average', color: '#ef4444' }, // Red
    'F': { min: 0, label: 'Poor', color: '#6b7280' },           // Gray
};

// Complete quality analysis result
export interface AdQualityAnalysis {
    // Core scores
    overallScore: number;           // 0-100 score (starts at 70, modified by issues/positives)
    victoryChance: number;          // Predicted success % (0-100, like chess win probability)
    grade: QualityGrade;            // Letter grade based on score

    // Breakdown
    issues: QualityIssue[];         // List of identified problems
    positives: QualityPositive[];   // List of positive aspects

    // Aggregated counts
    blunderCount: number;
    mistakeCount: number;
    inaccuracyCount: number;

    // Recommendations prioritized by impact
    recommendations: string[];

    // Metadata
    analyzedAt: string;
    analysisVersion: string;        // For tracking algorithm changes
    confidence: number;             // How confident the analysis is (0-100)
}

// Input for quality analysis
export interface QualityAnalysisInput {
    // Core ad data
    adId?: string;
    title?: string;
    description?: string;

    // Media properties
    mediaType?: 'video' | 'photo' | 'carousel';
    aspectRatio?: string;
    duration?: number;              // Video duration in seconds

    // Platform/placement
    platform?: 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'other';
    placement?: 'feed' | 'stories' | 'reels' | 'explore' | 'other';

    // Content features
    hookType?: string;
    contentCategory?: string;
    editingStyle?: string;

    // Technical features
    hasSubtitles?: boolean;
    hasTextOverlays?: boolean;
    hasVoiceover?: boolean;
    hasCTA?: boolean;
    ctaType?: string;

    // Style
    isUGCStyle?: boolean;
    hasHumanFace?: boolean;
    colorScheme?: string;
    musicType?: string;

    // Source context
    source: 'webhook' | 'upload' | 'import' | 'manual';

    // Additional traits (for flexible analysis)
    customTraits?: string[];

    // Performance hints (if available, for validation)
    actualCtr?: number;
    actualRoas?: number;
}

// Chess-style move annotation icons
export const SEVERITY_ICONS: Record<IssueSeverity, string> = {
    blunder: '🔴',      // Red circle - critical error
    mistake: '🟠',      // Orange circle - significant issue
    inaccuracy: '🟡',   // Yellow circle - minor issue
};

export const POSITIVE_ICONS: Record<PositiveRating, string> = {
    brilliant: '✨',    // Sparkles - exceptional
    excellent: '🌟',    // Star - excellent
    good: '✅',         // Check - good
    book_move: '📖',    // Book - standard practice
};

// Helper function to calculate grade from score
export function calculateGrade(score: number): QualityGrade {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
}

// Helper function to get grade color
export function getGradeColor(grade: QualityGrade): string {
    return GRADE_THRESHOLDS[grade].color;
}

// Helper to calculate victory chance from score
export function calculateVictoryChance(score: number, confidence: number): number {
    // Victory chance is influenced by both score and confidence
    // Higher confidence means the victory chance is closer to the raw score
    // Lower confidence adds uncertainty, pulling toward 50%
    const baseChance = score;
    const uncertainty = (100 - confidence) / 100;
    const pullToMiddle = (50 - score) * uncertainty * 0.5;

    return Math.round(Math.max(0, Math.min(100, baseChance + pullToMiddle)));
}
