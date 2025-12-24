// Failure Taxonomy System
// Classifies WHY ads fail for better learning and anti-pattern detection

import { AdEntry, ExtractedAdData, ExtractedResultsData, FeatureWeight } from '@/types';

// ============================================
// FAILURE CLASSES
// ============================================

export type FailureClass =
    | 'hook_failure'         // High impressions, very low CTR - hook didn't grab attention
    | 'creative_fatigue'     // Performance dropped over time / vs similar past ads
    | 'trust_mismatch'       // UGC style on premium brand or vice versa
    | 'platform_mismatch'    // Wrong format/style for platform (e.g., cinematic on TikTok)
    | 'audience_mismatch'    // Content doesn't resonate with target demo
    | 'landing_page_issue'   // High CTR, very low conversions
    | 'cta_weak'             // Good engagement, poor action
    | 'timing_poor'          // Launched at suboptimal time
    | 'format_issue'         // Wrong aspect ratio, too long, etc.
    | 'unknown';             // Cannot determine cause

export interface FailureEvidence {
    signal: string;
    value: string | number;
    threshold: string | number;
    interpretation: string;
}

export interface FailureAnalysis {
    failureClass: FailureClass;
    confidence: number;          // 0-100 confidence in classification
    evidence: FailureEvidence[];
    antiPatterns: string[];      // Features to penalize
    recommendations: string[];   // How to fix
    learnedNegativeWeights: {    // Weights to decrease
        feature: string;
        weightDelta: number;
    }[];
}

// ============================================
// STORAGE
// ============================================

const FAILURE_PATTERNS_KEY = 'ml_failure_patterns';

export interface StoredFailurePattern {
    id: string;
    failureClass: FailureClass;
    adId: string;
    features: string[];          // Features present in failed ad
    timestamp: string;
    evidence: FailureEvidence[];
}

function getStoredFailurePatterns(): StoredFailurePattern[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(FAILURE_PATTERNS_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveFailurePattern(pattern: StoredFailurePattern): void {
    if (typeof window === 'undefined') return;
    const patterns = getStoredFailurePatterns();
    patterns.push(pattern);
    // Keep last 100 patterns
    const trimmed = patterns.slice(-100);
    localStorage.setItem(FAILURE_PATTERNS_KEY, JSON.stringify(trimmed));
}

// ============================================
// FAILURE CLASSIFICATION
// ============================================

/**
 * Classify why an ad failed based on creative and results data
 */
export function classifyFailure(
    ad: AdEntry,
    results: ExtractedResultsData
): FailureAnalysis {
    const content = ad.extractedContent;
    const evidence: FailureEvidence[] = [];
    const antiPatterns: string[] = [];
    const recommendations: string[] = [];
    const learnedNegativeWeights: { feature: string; weightDelta: number }[] = [];

    // Calculate derived metrics
    const hasHighImpressions = results.impressions > 1000;
    const hasLowCTR = results.ctr < 0.01; // Less than 1%
    const hasGoodCTR = results.ctr > 0.02;
    const hasLowConversions = (results.conversionRate || 0) < 0.005;
    const hasLowROAS = (results.roas || 0) < 0.5;

    // Score each failure type
    const scores: Record<FailureClass, number> = {
        hook_failure: 0,
        creative_fatigue: 0,
        trust_mismatch: 0,
        platform_mismatch: 0,
        audience_mismatch: 0,
        landing_page_issue: 0,
        cta_weak: 0,
        timing_poor: 0,
        format_issue: 0,
        unknown: 0,
    };

    // ===== HOOK FAILURE =====
    // High impressions but very low CTR = hook didn't work
    if (hasHighImpressions && hasLowCTR) {
        scores.hook_failure += 40;
        evidence.push({
            signal: 'High impressions, low CTR',
            value: `${results.impressions} impressions, ${(results.ctr * 100).toFixed(2)}% CTR`,
            threshold: '>1000 impressions, <1% CTR',
            interpretation: 'Users saw the ad but did not click - hook failed to grab attention',
        });
        antiPatterns.push(content.hookType);
        recommendations.push('Try a different hook type - curiosity or shock hooks often perform better');
        learnedNegativeWeights.push({ feature: content.hookType, weightDelta: -0.1 });
    }

    // Hook velocity check
    if (content.hookVelocity === 'delayed' && hasLowCTR) {
        scores.hook_failure += 20;
        evidence.push({
            signal: 'Delayed hook velocity',
            value: content.hookVelocity,
            threshold: 'instant or gradual',
            interpretation: 'Hook takes too long to grab attention',
        });
        recommendations.push('Move the hook to the first 1-2 seconds');
        learnedNegativeWeights.push({ feature: 'delayed_hook', weightDelta: -0.15 });
    }

    // ===== PLATFORM MISMATCH =====
    const platformStyleMismatch = checkPlatformMismatch(content, results.platform);
    if (platformStyleMismatch.isMismatch) {
        scores.platform_mismatch += 35;
        evidence.push({
            signal: 'Platform-style mismatch',
            value: platformStyleMismatch.currentStyle,
            threshold: platformStyleMismatch.recommendedStyle,
            interpretation: platformStyleMismatch.reason,
        });
        antiPatterns.push(`${content.editingStyle}_on_${results.platform}`);
        recommendations.push(platformStyleMismatch.recommendation);
        learnedNegativeWeights.push({
            feature: `${content.editingStyle}_${results.platform}`,
            weightDelta: -0.12
        });
    }

    // ===== TRUST MISMATCH =====
    // UGC style with premium product positioning or vice versa
    if (content.isUGCStyle && content.brandColorUsage === 'dominant') {
        scores.trust_mismatch += 25;
        evidence.push({
            signal: 'UGC with heavy branding',
            value: 'UGC style + dominant brand colors',
            threshold: 'Consistent authenticity',
            interpretation: 'UGC should feel authentic, heavy branding breaks trust',
        });
        recommendations.push('Either go full UGC (subtle branding) or full branded (not UGC)');
        antiPatterns.push('ugc_heavy_branding');
        learnedNegativeWeights.push({ feature: 'ugc_heavy_branding', weightDelta: -0.1 });
    }

    // ===== LANDING PAGE ISSUE =====
    // Good CTR but very low conversions = problem is after the click
    if (hasGoodCTR && hasLowConversions) {
        scores.landing_page_issue += 40;
        evidence.push({
            signal: 'High CTR, low conversions',
            value: `${(results.ctr * 100).toFixed(2)}% CTR, ${((results.conversionRate || 0) * 100).toFixed(2)}% CVR`,
            threshold: '>2% CTR should yield >0.5% CVR',
            interpretation: 'Ad is working, but something breaks after the click',
        });
        recommendations.push('Check landing page load time, mobile experience, and message match');
        // Don't penalize creative - issue is not the ad
    }

    // ===== CTA WEAK =====
    if (content.ctaStrength === 'weak' && hasLowConversions) {
        scores.cta_weak += 30;
        evidence.push({
            signal: 'Weak CTA',
            value: content.cta || 'No clear CTA',
            threshold: 'Strong, clear CTA',
            interpretation: 'Users watch but don\'t know what to do next',
        });
        recommendations.push('Add a clear, urgent CTA in the last 2-3 seconds');
        antiPatterns.push('weak_cta');
        learnedNegativeWeights.push({ feature: 'weak_cta', weightDelta: -0.1 });
    }

    // ===== FORMAT ISSUE =====
    // Wrong aspect ratio for platform
    const formatIssue = checkFormatIssue(content, results.platform);
    if (formatIssue.isIssue) {
        scores.format_issue += 25;
        evidence.push({
            signal: 'Format mismatch',
            value: formatIssue.currentFormat,
            threshold: formatIssue.recommendedFormat,
            interpretation: formatIssue.reason,
        });
        recommendations.push(formatIssue.recommendation);
        antiPatterns.push(`${content.aspectRatio}_on_${results.platform}`);
        learnedNegativeWeights.push({
            feature: `format_${content.aspectRatio}_${results.platform}`,
            weightDelta: -0.08
        });
    }

    // ===== AUDIENCE MISMATCH =====
    // Check if content style doesn't match platform demographics
    if (content.emotionalTone === 'serious' && results.platform === 'tiktok') {
        scores.audience_mismatch += 20;
        evidence.push({
            signal: 'Tone mismatch with platform audience',
            value: 'Serious tone on TikTok',
            threshold: 'Entertaining or casual tone',
            interpretation: 'TikTok audience expects lighter content',
        });
        recommendations.push('Adjust tone to match platform culture - more casual, entertaining');
        learnedNegativeWeights.push({ feature: 'serious_tiktok', weightDelta: -0.08 });
    }

    // ===== CREATIVE FATIGUE =====
    // This would require historical comparison - placeholder
    // Would check if similar ads have declining performance over time

    // Find the highest scoring failure class
    let maxScore = 0;
    let detectedClass: FailureClass = 'unknown';

    for (const [failureClass, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedClass = failureClass as FailureClass;
        }
    }

    // If no clear failure detected
    if (maxScore < 20) {
        detectedClass = 'unknown';
        recommendations.push('No clear failure pattern detected - review creative holistically');
    }

    // Save the failure pattern for future learning
    if (detectedClass !== 'unknown') {
        saveFailurePattern({
            id: `failure-${Date.now()}`,
            failureClass: detectedClass,
            adId: ad.id,
            features: extractPresentFeatures(content),
            timestamp: new Date().toISOString(),
            evidence,
        });
    }

    return {
        failureClass: detectedClass,
        confidence: Math.min(100, maxScore),
        evidence,
        antiPatterns,
        recommendations,
        learnedNegativeWeights,
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function checkPlatformMismatch(
    content: ExtractedAdData,
    platform: string
): {
    isMismatch: boolean;
    currentStyle: string;
    recommendedStyle: string;
    reason: string;
    recommendation: string;
} {
    // TikTok prefers raw, authentic, fast content
    if (platform === 'tiktok') {
        if (content.editingStyle === 'cinematic') {
            return {
                isMismatch: true,
                currentStyle: 'cinematic',
                recommendedStyle: 'raw_authentic or fast_cuts',
                reason: 'Cinematic style feels too polished for TikTok\'s native aesthetic',
                recommendation: 'Use raw, authentic footage with quick cuts for TikTok',
            };
        }
        if (content.editingStyle === 'minimal') {
            return {
                isMismatch: true,
                currentStyle: 'minimal',
                recommendedStyle: 'dynamic or fast_cuts',
                reason: 'Minimal editing doesn\'t capture attention on a fast-scrolling platform',
                recommendation: 'Add more dynamic movement and quick transitions',
            };
        }
    }

    // LinkedIn prefers professional, polished content
    if (platform === 'linkedin') {
        if (content.isUGCStyle || content.editingStyle === 'raw_authentic') {
            return {
                isMismatch: true,
                currentStyle: 'UGC/raw',
                recommendedStyle: 'professional or cinematic',
                reason: 'LinkedIn audience expects polished, professional content',
                recommendation: 'Use more polished visuals and professional presentation',
            };
        }
    }

    // YouTube prefers longer, higher quality content
    if (platform === 'youtube') {
        if ((content.duration || 0) < 15) {
            return {
                isMismatch: true,
                currentStyle: `${content.duration}s video`,
                recommendedStyle: '30s+ video',
                reason: 'YouTube ads work better with longer, more complete narratives',
                recommendation: 'Consider extending the ad length for YouTube',
            };
        }
    }

    return {
        isMismatch: false,
        currentStyle: content.editingStyle,
        recommendedStyle: content.editingStyle,
        reason: '',
        recommendation: '',
    };
}

function checkFormatIssue(
    content: ExtractedAdData,
    platform: string
): {
    isIssue: boolean;
    currentFormat: string;
    recommendedFormat: string;
    reason: string;
    recommendation: string;
} {
    // TikTok/Reels need vertical
    if ((platform === 'tiktok' || platform === 'instagram') &&
        content.aspectRatio === '16:9') {
        return {
            isIssue: true,
            currentFormat: '16:9 horizontal',
            recommendedFormat: '9:16 vertical',
            reason: 'Horizontal video doesn\'t fill the screen on mobile-first platforms',
            recommendation: 'Reformat to 9:16 vertical for full-screen impact',
        };
    }

    // YouTube prefers horizontal
    if (platform === 'youtube' && content.aspectRatio === '9:16') {
        return {
            isIssue: true,
            currentFormat: '9:16 vertical',
            recommendedFormat: '16:9 horizontal',
            reason: 'Vertical video has black bars on desktop YouTube',
            recommendation: 'Use 16:9 horizontal for YouTube',
        };
    }

    return {
        isIssue: false,
        currentFormat: content.aspectRatio,
        recommendedFormat: content.aspectRatio,
        reason: '',
        recommendation: '',
    };
}

function extractPresentFeatures(content: ExtractedAdData): string[] {
    const features: string[] = [];

    features.push(content.hookType);
    features.push(content.editingStyle);
    features.push(content.contentCategory);
    features.push(content.platform);

    if (content.isUGCStyle) features.push('ugc_style');
    if (content.hasSubtitles) features.push('subtitles');
    if (content.hasTextOverlays) features.push('text_overlays');
    if (content.hasVoiceover) features.push('voiceover');
    if (content.curiosityGap) features.push('curiosity_gap');

    return features;
}

// ============================================
// ANTI-PATTERN DETECTION
// ============================================

/**
 * Check if a feature combination is a known anti-pattern
 */
export function isAntiPattern(
    features: string[],
    failureClass?: FailureClass
): {
    isAntiPattern: boolean;
    matchedPatterns: StoredFailurePattern[];
    riskLevel: 'low' | 'medium' | 'high';
} {
    const patterns = getStoredFailurePatterns();

    // Find patterns that match current features
    const matchedPatterns = patterns.filter(pattern => {
        const matchCount = pattern.features.filter(f => features.includes(f)).length;
        const matchRatio = matchCount / pattern.features.length;

        // If filtering by failure class
        if (failureClass && pattern.failureClass !== failureClass) {
            return false;
        }

        // Match if 70%+ features overlap
        return matchRatio >= 0.7;
    });

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (matchedPatterns.length >= 3) {
        riskLevel = 'high';
    } else if (matchedPatterns.length >= 1) {
        riskLevel = 'medium';
    }

    return {
        isAntiPattern: matchedPatterns.length > 0,
        matchedPatterns,
        riskLevel,
    };
}

/**
 * Get all stored failure patterns for analysis
 */
export function getFailurePatterns(): StoredFailurePattern[] {
    return getStoredFailurePatterns();
}

/**
 * Get failure class display info
 */
export function getFailureClassInfo(failureClass: FailureClass): {
    label: string;
    description: string;
    icon: string;
} {
    const info: Record<FailureClass, { label: string; description: string; icon: string }> = {
        hook_failure: {
            label: 'Hook Failure',
            description: 'Opening seconds didn\'t capture attention',
            icon: '🎣',
        },
        creative_fatigue: {
            label: 'Creative Fatigue',
            description: 'Audience has seen similar content too often',
            icon: '😴',
        },
        trust_mismatch: {
            label: 'Trust Mismatch',
            description: 'Content authenticity doesn\'t match brand positioning',
            icon: '🤝',
        },
        platform_mismatch: {
            label: 'Platform Mismatch',
            description: 'Creative style doesn\'t fit platform culture',
            icon: '📱',
        },
        audience_mismatch: {
            label: 'Audience Mismatch',
            description: 'Content doesn\'t resonate with target demographic',
            icon: '👥',
        },
        landing_page_issue: {
            label: 'Landing Page Issue',
            description: 'Ad works but post-click experience fails',
            icon: '🔗',
        },
        cta_weak: {
            label: 'Weak CTA',
            description: 'No clear call-to-action or it\'s not compelling',
            icon: '📢',
        },
        timing_poor: {
            label: 'Poor Timing',
            description: 'Launched at suboptimal time or day',
            icon: '⏰',
        },
        format_issue: {
            label: 'Format Issue',
            description: 'Wrong aspect ratio, length, or technical format',
            icon: '📐',
        },
        unknown: {
            label: 'Unknown',
            description: 'Unable to determine specific failure cause',
            icon: '❓',
        },
    };

    return info[failureClass] || info.unknown;
}
