import { NextRequest, NextResponse } from 'next/server';
import {
    AdQualityAnalysis,
    QualityAnalysisInput,
    QualityIssue,
    QualityPositive,
    IssueSeverity,
    PositiveRating,
    IssueCategory,
    ISSUE_PENALTIES,
    POSITIVE_BONUSES,
    calculateGrade,
    calculateVictoryChance,
} from '@/types/ad-quality-types';

/**
 * POST /api/ai/ad-quality-score
 * 
 * Analyze ad traits and content for quality issues
 * Returns chess-style scoring with issues, positives, and recommendations
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const input: QualityAnalysisInput = body.extractedData || body;

        console.log('[AdQuality] Analyzing ad:', input.adId || input.title || 'Unknown');

        // Run the analysis
        const analysis = analyzeAdQuality(input);

        console.log('[AdQuality] Analysis complete:', {
            score: analysis.overallScore,
            grade: analysis.grade,
            issues: analysis.issues.length,
            positives: analysis.positives.length,
        });

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('[AdQuality] Error analyzing ad:', error);
        return NextResponse.json(
            { error: 'Failed to analyze ad quality', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * Main analysis function
 * Starts with a base score of 70 and applies penalties/bonuses
 */
function analyzeAdQuality(input: QualityAnalysisInput): AdQualityAnalysis {
    const issues: QualityIssue[] = [];
    const positives: QualityPositive[] = [];
    let issueId = 0;
    let positiveId = 0;

    // Helper to add issues
    const addIssue = (
        severity: IssueSeverity,
        category: IssueCategory,
        title: string,
        description: string,
        impact: string,
        fix: string
    ) => {
        issues.push({
            id: `issue_${++issueId}`,
            severity,
            category,
            title,
            description,
            impact,
            fix,
            penaltyApplied: ISSUE_PENALTIES[severity],
        });
    };

    // Helper to add positives
    const addPositive = (
        rating: PositiveRating,
        category: IssueCategory,
        title: string,
        description: string,
        impact: string
    ) => {
        positives.push({
            id: `positive_${++positiveId}`,
            rating,
            category,
            title,
            description,
            impact,
            bonusApplied: POSITIVE_BONUSES[rating],
        });
    };

    // ==========================================
    // ACCESSIBILITY CHECKS
    // ==========================================

    // Subtitles check (major impact on watch time)
    if (input.hasSubtitles === false && input.mediaType === 'video') {
        addIssue(
            'mistake',
            'accessibility',
            'No Subtitles Detected',
            'Video ads without subtitles lose viewers who watch with sound off (85% of Facebook users)',
            '-12% avg watch time',
            'Add closed captions or burned-in subtitles'
        );
    } else if (input.hasSubtitles === true) {
        addPositive(
            'excellent',
            'accessibility',
            'Subtitles Present',
            'Subtitles ensure message reaches viewers watching without sound',
            '+12% watch time'
        );
    }

    // ==========================================
    // TECHNICAL CHECKS
    // ==========================================

    // Aspect ratio for placement
    if (input.placement === 'reels' || input.placement === 'stories') {
        if (input.aspectRatio && !['9:16', '4:5'].includes(input.aspectRatio)) {
            addIssue(
                'mistake',
                'technical',
                'Wrong Aspect Ratio for Vertical Placement',
                `${input.aspectRatio} format on ${input.placement} placement loses screen real estate`,
                '-15% engagement',
                'Use 9:16 vertical format for Stories/Reels'
            );
        } else if (input.aspectRatio === '9:16') {
            addPositive(
                'good',
                'technical',
                'Optimal Vertical Format',
                'Full-screen 9:16 format maximizes impact on Stories/Reels',
                '+15% engagement'
            );
        }
    } else if (input.placement === 'feed') {
        if (input.aspectRatio === '16:9') {
            addIssue(
                'inaccuracy',
                'technical',
                'Horizontal Format in Feed',
                'Landscape videos take up less screen space in mobile feed',
                '-8% visibility',
                'Consider 4:5 or 1:1 for better feed presence'
            );
        } else if (input.aspectRatio === '4:5' || input.aspectRatio === '1:1') {
            addPositive(
                'book_move',
                'technical',
                'Feed-Optimized Format',
                `${input.aspectRatio} format works well for feed placement`,
                '+8% visibility'
            );
        }
    }

    // Video duration check
    if (input.mediaType === 'video' && input.duration) {
        if (input.duration > 60 && input.placement === 'reels') {
            addIssue(
                'inaccuracy',
                'technical',
                'Long Video for Reels',
                'Reels over 60 seconds have lower completion rates',
                '-10% completion rate',
                'Keep Reels under 30 seconds for best performance'
            );
        } else if (input.duration > 0 && input.duration <= 15) {
            addPositive(
                'good',
                'technical',
                'Concise Duration',
                'Short-form content maintains viewer attention',
                '+5% completion rate'
            );
        }
    }

    // ==========================================
    // CREATIVE CHECKS
    // ==========================================

    // Hook type analysis
    if (input.hookType) {
        const strongHooks = ['curiosity', 'shock', 'transformation', 'question'];
        const mediumHooks = ['story', 'problem_solution', 'benefit'];

        if (strongHooks.includes(input.hookType.toLowerCase())) {
            addPositive(
                'excellent',
                'creative',
                'Strong Hook Type',
                `${input.hookType} hooks are proven to capture attention quickly`,
                '+18% hook rate'
            );
        } else if (mediumHooks.includes(input.hookType.toLowerCase())) {
            addPositive(
                'good',
                'creative',
                'Effective Hook',
                `${input.hookType} hook engages viewers effectively`,
                '+10% hook rate'
            );
        }
    } else {
        addIssue(
            'inaccuracy',
            'creative',
            'No Clear Hook Identified',
            'Ads without a strong hook in the first 3 seconds lose viewers',
            '-15% hook rate',
            'Start with a curiosity gap, question, or bold statement'
        );
    }

    // UGC Style check
    if (input.isUGCStyle === true) {
        addPositive(
            'excellent',
            'creative',
            'UGC-Style Content',
            'User-generated style content feels authentic and trustworthy',
            '+25% engagement, +15% trust'
        );
    }

    // Human face presence
    if (input.hasHumanFace === true) {
        addPositive(
            'good',
            'creative',
            'Human Presence',
            'Faces increase emotional connection and stop-scroll rate',
            '+10% stop-scroll rate'
        );
    }

    // Editing style
    if (input.editingStyle) {
        const dynamicStyles = ['fast_cuts', 'dynamic', 'cinematic'];
        if (dynamicStyles.includes(input.editingStyle.toLowerCase())) {
            addPositive(
                'good',
                'creative',
                'Dynamic Editing',
                `${input.editingStyle} maintains visual interest`,
                '+8% watch time'
            );
        }
    }

    // ==========================================
    // COPY & CTA CHECKS
    // ==========================================

    // CTA presence (critical)
    if (input.hasCTA === false) {
        addIssue(
            'blunder',
            'copy',
            'No Call-to-Action',
            'Ads without a clear CTA fail to convert interested viewers',
            '-40% conversion rate',
            'Add a clear CTA: Shop Now, Learn More, Sign Up, etc.'
        );
    } else if (input.hasCTA === true) {
        addPositive(
            'book_move',
            'copy',
            'CTA Present',
            'Clear call-to-action guides viewers to next step',
            '+15% click-through'
        );

        // CTA type optimization
        if (input.ctaType) {
            const strongCTAs = ['shop_now', 'get_offer', 'sign_up', 'learn_more'];
            if (strongCTAs.includes(input.ctaType.toLowerCase().replace(' ', '_'))) {
                addPositive(
                    'good',
                    'copy',
                    'Action-Oriented CTA',
                    `"${input.ctaType}" creates urgency and clear action`,
                    '+8% CTR'
                );
            }
        }
    }

    // Voiceover for video
    if (input.mediaType === 'video') {
        if (input.hasVoiceover === true) {
            addPositive(
                'good',
                'copy',
                'Voiceover Present',
                'Narration reinforces message for viewers with sound on',
                '+10% message retention'
            );
        } else if (input.hasVoiceover === false && input.hasSubtitles === false) {
            addIssue(
                'mistake',
                'copy',
                'No Audio Communication',
                'Video lacks both voiceover and subtitles for message delivery',
                '-20% message clarity',
                'Add either voiceover or text overlays to communicate message'
            );
        }
    }

    // Text overlays
    if (input.hasTextOverlays === true) {
        addPositive(
            'book_move',
            'creative',
            'Text Overlays',
            'On-screen text reinforces key messages',
            '+5% comprehension'
        );
    }

    // ==========================================
    // TARGETING/PLATFORM CHECKS
    // ==========================================

    // Platform-specific optimizations
    if (input.platform === 'tiktok') {
        if (input.isUGCStyle !== true) {
            addIssue(
                'inaccuracy',
                'targeting',
                'Non-Native TikTok Style',
                'Polished ads stand out negatively on TikTok',
                '-20% engagement',
                'Use raw, authentic UGC-style content for TikTok'
            );
        }
        if (input.musicType === 'trending') {
            addPositive(
                'excellent',
                'targeting',
                'Trending Audio',
                'Trending sounds boost discoverability on TikTok',
                '+30% reach'
            );
        }
    }

    // ==========================================
    // CALCULATE FINAL SCORE
    // ==========================================

    // Base score of 70 (assumes a reasonably competent ad)
    let score = 70;

    // Apply penalties
    for (const issue of issues) {
        score += issue.penaltyApplied; // penalties are negative
    }

    // Apply bonuses
    for (const positive of positives) {
        score += positive.bonusApplied;
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Calculate confidence based on how much data we had
    const dataPoints = [
        input.hasSubtitles !== undefined,
        input.aspectRatio !== undefined,
        input.hookType !== undefined,
        input.hasCTA !== undefined,
        input.isUGCStyle !== undefined,
        input.hasVoiceover !== undefined,
        input.mediaType !== undefined,
        input.placement !== undefined,
        input.platform !== undefined,
        input.editingStyle !== undefined,
    ].filter(Boolean).length;

    const confidence = Math.min(95, 40 + (dataPoints * 5.5));

    // Calculate victory chance
    const victoryChance = calculateVictoryChance(score, confidence);

    // Generate prioritized recommendations from issues
    const recommendations = issues
        .sort((a, b) => ISSUE_PENALTIES[a.severity] - ISSUE_PENALTIES[b.severity]) // Most severe first
        .slice(0, 5)
        .map(issue => issue.fix);

    // Count by severity
    const blunderCount = issues.filter(i => i.severity === 'blunder').length;
    const mistakeCount = issues.filter(i => i.severity === 'mistake').length;
    const inaccuracyCount = issues.filter(i => i.severity === 'inaccuracy').length;

    return {
        overallScore: score,
        victoryChance,
        grade: calculateGrade(score),
        issues,
        positives,
        blunderCount,
        mistakeCount,
        inaccuracyCount,
        recommendations,
        analyzedAt: new Date().toISOString(),
        analysisVersion: '1.0.0',
        confidence: Math.round(confidence),
    };
}
