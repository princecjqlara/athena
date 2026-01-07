// Creative Suggestions Engine
// ML-powered suggestions for next creatives based on portfolio gaps and performance

import {
    CreativeType,
    classifyCreativeType,
    calculatePerformanceScore,
} from './creative-strategy';

// Re-use the extended AdEntry type from creative-strategy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdEntry = any;

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CreativeSuggestion {
    id: string;
    type: CreativeType;
    title: string;
    reason: string;
    predictedScore: number;
    confidence: number;
    priority: 'high' | 'medium' | 'low';
    basedOn: string[];
    implementation: {
        format: string;
        hook: string;
        example: string;
        duration: string;
        platform: string;
    };
    avoidBecause?: string[];
}

export interface PortfolioAnalysis {
    currentMix: { type: CreativeType; count: number; percentage: number; avgScore: number }[];
    gaps: CreativeType[];
    overExposed: CreativeType[];
    balanceScore: number;
    safeWildRatio: { safe: number; wild: number };
    totalAds: number;
    recommendations: string[];
}

export interface HistoricalPattern {
    feature: string;
    successRate: number;
    sampleSize: number;
    trend: 'improving' | 'stable' | 'declining';
}

// ============================================
// CREATIVE TYPE METADATA
// ============================================

const CREATIVE_TYPE_INFO: Record<CreativeType, {
    purpose: string;
    example: string;
    formats: string[];
    hooks: string[];
    isSafe: boolean;
    avgSuccessRate: number;
}> = {
    Problem_Solution: {
        purpose: 'Targets unaware users by highlighting specific pain points',
        example: 'Tired of back pain? This chair aligns your spine.',
        formats: ['9:16 Video', '4:5 Video', 'Carousel'],
        hooks: ['Curiosity', 'Pain Point', 'Question'],
        isSafe: true,
        avgSuccessRate: 72
    },
    Us_Vs_Them: {
        purpose: 'Targets comparison shoppers by highlighting superiority',
        example: 'Split screen: Our Product (Green Checks) vs. Competitors (Red Xs)',
        formats: ['9:16 Video', '4:5 Video', 'Static Split'],
        hooks: ['Comparison', 'Challenge', 'Proof'],
        isSafe: true,
        avgSuccessRate: 68
    },
    Founder_Story_BTS: {
        purpose: 'Builds trust and brand affinity',
        example: 'Selfie-style video explaining the "Why" behind the brand',
        formats: ['9:16 Video (Stories)', '4:5 Video (Feed)'],
        hooks: ['Story', 'Personal', 'Authentic'],
        isSafe: false, // Wild creative
        avgSuccessRate: 58
    },
    UGC_Testimonial: {
        purpose: 'Social proof to validate the purchase',
        example: 'Customer unboxing and genuine reaction',
        formats: ['9:16 Video', '4:5 Video', 'Carousel'],
        hooks: ['Testimonial', 'Unboxing', 'Review'],
        isSafe: true,
        avgSuccessRate: 75
    },
    Direct_Offer_Static: {
        purpose: 'High-intent retargeting and quick sales',
        example: 'High-quality photo with text overlay: "50% OFF - Ends Tonight"',
        formats: ['Static Image', 'Carousel', '1:1 Static'],
        hooks: ['Urgency', 'Offer', 'Discount'],
        isSafe: true,
        avgSuccessRate: 62
    },
    Unknown: {
        purpose: 'Uncategorized creative',
        example: 'N/A',
        formats: ['Any'],
        hooks: ['Any'],
        isSafe: false,
        avgSuccessRate: 50
    }
};

// ============================================
// PORTFOLIO ANALYSIS
// ============================================

export function analyzePortfolio(ads: AdEntry[]): PortfolioAnalysis {
    const completeAds = ads.filter(ad => ad.extractedContent);
    const totalAds = completeAds.length;

    // Count and score by type
    const typeStats = new Map<CreativeType, { count: number; scoreSum: number }>();

    completeAds.forEach(ad => {
        const { type } = classifyCreativeType(ad);
        const score = calculatePerformanceScore(ad);

        if (!typeStats.has(type)) {
            typeStats.set(type, { count: 0, scoreSum: 0 });
        }
        const stats = typeStats.get(type)!;
        stats.count++;
        stats.scoreSum += score;
    });

    // Build current mix
    const currentMix: PortfolioAnalysis['currentMix'] = [];
    const allTypes: CreativeType[] = ['Problem_Solution', 'Us_Vs_Them', 'Founder_Story_BTS', 'UGC_Testimonial', 'Direct_Offer_Static'];

    allTypes.forEach(type => {
        const stats = typeStats.get(type);
        if (stats && stats.count > 0) {
            currentMix.push({
                type,
                count: stats.count,
                percentage: Math.round((stats.count / totalAds) * 100),
                avgScore: Math.round(stats.scoreSum / stats.count)
            });
        }
    });

    // Identify gaps (types with 0 ads)
    const gaps = allTypes.filter(type => !typeStats.has(type) || typeStats.get(type)!.count === 0);

    // Identify overexposed (types with > 40% of portfolio)
    const overExposed = currentMix
        .filter(m => m.percentage > 40)
        .map(m => m.type);

    // Calculate safe/wild ratio
    let safeCount = 0;
    let wildCount = 0;
    completeAds.forEach(ad => {
        const { type } = classifyCreativeType(ad);
        if (CREATIVE_TYPE_INFO[type].isSafe) {
            safeCount++;
        } else {
            wildCount++;
        }
    });

    const safeWildRatio = {
        safe: totalAds > 0 ? Math.round((safeCount / totalAds) * 100) : 0,
        wild: totalAds > 0 ? Math.round((wildCount / totalAds) * 100) : 0
    };

    // Calculate balance score (how close to ideal mix)
    // Ideal: 5 types evenly distributed (20% each), 70/30 safe/wild
    let balanceScore = 100;

    // Penalize for gaps
    balanceScore -= gaps.length * 15;

    // Penalize for overexposure
    balanceScore -= overExposed.length * 10;

    // Penalize for bad safe/wild ratio (target: 70/30)
    const safeDeviation = Math.abs(safeWildRatio.safe - 70);
    balanceScore -= Math.min(20, safeDeviation / 2);

    balanceScore = Math.max(0, balanceScore);

    // Generate recommendations
    const recommendations: string[] = [];
    if (gaps.length > 0) {
        recommendations.push(`Missing ${gaps.length} creative type(s): ${gaps.map(g => g.replace('_', ' ')).join(', ')}`);
    }
    if (overExposed.length > 0) {
        recommendations.push(`Over-relying on: ${overExposed.map(o => o.replace('_', ' ')).join(', ')}`);
    }
    if (safeWildRatio.wild < 20) {
        recommendations.push('Try more "wild" creatives (founder stories, memes, controversial takes)');
    }
    if (safeWildRatio.wild > 40) {
        recommendations.push('Add more "safe" proven formats to stabilize performance');
    }

    return {
        currentMix,
        gaps,
        overExposed,
        balanceScore,
        safeWildRatio,
        totalAds,
        recommendations
    };
}

// ============================================
// HISTORICAL PATTERN ANALYSIS
// ============================================

export function analyzeHistoricalPatterns(ads: AdEntry[]): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = [];
    const featureStats = new Map<string, { successSum: number; count: number }>();

    ads.forEach(ad => {
        const score = calculatePerformanceScore(ad);
        const content = ad.extractedContent;
        if (!content) return;

        const addFeature = (feature: string) => {
            if (!featureStats.has(feature)) {
                featureStats.set(feature, { successSum: 0, count: 0 });
            }
            const stats = featureStats.get(feature)!;
            stats.successSum += score >= 65 ? 1 : 0;
            stats.count++;
        };

        // Track key features
        if (content.hasSubtitles) addFeature('subtitles');
        if (content.isUGCStyle) addFeature('ugc_style');
        if (content.hookType) addFeature(`hook:${content.hookType}`);
        if (content.platform) addFeature(`platform:${content.platform}`);
        if (content.aspectRatio) addFeature(`aspect:${content.aspectRatio}`);
        if (content.hasVoiceover) addFeature('voiceover');
        if (content.musicType) addFeature(`music:${content.musicType}`);
    });

    featureStats.forEach((stats, feature) => {
        if (stats.count >= 2) { // Minimum sample size
            patterns.push({
                feature,
                successRate: Math.round((stats.successSum / stats.count) * 100),
                sampleSize: stats.count,
                trend: 'stable' // Would need time-series data for real trend
            });
        }
    });

    // Sort by success rate descending
    patterns.sort((a, b) => b.successRate - a.successRate);

    return patterns;
}

// ============================================
// PREDICTION ENGINE
// ============================================

interface PredictionFactors {
    baseScore: number;
    typeBonus: number;
    patternBonus: number;
    gapBonus: number;
    confidence: number;
    reasoning: string[];
}

function predictScore(
    creativeType: CreativeType,
    portfolio: PortfolioAnalysis,
    patterns: HistoricalPattern[]
): PredictionFactors {
    const reasoning: string[] = [];

    // Base score from type's historical performance
    let baseScore = CREATIVE_TYPE_INFO[creativeType].avgSuccessRate;
    reasoning.push(`Base score for ${creativeType.replace('_', ' ')}: ${baseScore}%`);

    // Bonus if this type performed well in user's portfolio
    const typeInMix = portfolio.currentMix.find(m => m.type === creativeType);
    let typeBonus = 0;
    if (typeInMix && typeInMix.avgScore > 65) {
        typeBonus = 10;
        reasoning.push(`+10 bonus: Your ${creativeType.replace('_', ' ')} ads average ${typeInMix.avgScore}%`);
    }

    // Bonus for patterns that work well
    let patternBonus = 0;
    const relevantPatterns = patterns.filter(p => p.successRate > 70);
    if (relevantPatterns.length > 0) {
        patternBonus = Math.min(10, relevantPatterns.length * 3);
        reasoning.push(`+${patternBonus} bonus: Strong performance with ${relevantPatterns.map(p => p.feature).join(', ')}`);
    }

    // Bonus for filling a gap (untested creative types have upside)
    let gapBonus = 0;
    if (portfolio.gaps.includes(creativeType)) {
        gapBonus = 5;
        reasoning.push(`+5 bonus: Untested creative type - diversification opportunity`);
    }

    // Calculate confidence based on data volume
    let confidence = 50; // Base confidence
    if (portfolio.totalAds >= 10) confidence += 20;
    else if (portfolio.totalAds >= 5) confidence += 10;

    if (typeInMix && typeInMix.count >= 3) confidence += 15;
    if (patterns.length >= 5) confidence += 10;

    confidence = Math.min(95, confidence);

    return {
        baseScore,
        typeBonus,
        patternBonus,
        gapBonus,
        confidence,
        reasoning
    };
}

// ============================================
// SUGGESTION GENERATOR
// ============================================

export function generateSuggestions(ads: AdEntry[]): CreativeSuggestion[] {
    const portfolio = analyzePortfolio(ads);
    const patterns = analyzeHistoricalPatterns(ads);
    const suggestions: CreativeSuggestion[] = [];

    // Find what's working and what's failing
    const workingTypes = portfolio.currentMix
        .filter(m => m.avgScore >= 65)
        .map(m => m.type);

    const failingTypes = portfolio.currentMix
        .filter(m => m.avgScore < 50)
        .map(m => m.type);

    const allTypes: CreativeType[] = ['Problem_Solution', 'Us_Vs_Them', 'Founder_Story_BTS', 'UGC_Testimonial', 'Direct_Offer_Static'];

    allTypes.forEach(type => {
        const info = CREATIVE_TYPE_INFO[type];
        const prediction = predictScore(type, portfolio, patterns);
        const totalScore = prediction.baseScore + prediction.typeBonus + prediction.patternBonus + prediction.gapBonus;
        const clampedScore = Math.min(95, Math.max(20, totalScore));

        // Determine priority
        let priority: 'high' | 'medium' | 'low' = 'medium';
        const basedOn: string[] = [];
        const avoidBecause: string[] = [];

        // High priority: Gaps with good predicted score
        if (portfolio.gaps.includes(type) && clampedScore >= 60) {
            priority = 'high';
            basedOn.push('You haven\'t tested this creative type yet');
            basedOn.push('Similar advertisers see good results');
        }
        // High priority: Working type that could be expanded
        else if (workingTypes.includes(type)) {
            priority = 'high';
            basedOn.push(`Your existing ${type.replace('_', ' ')} ads are performing well`);
            basedOn.push('Test more variations of this winning concept');
        }
        // Low priority: Failing types
        else if (failingTypes.includes(type)) {
            priority = 'low';
            avoidBecause.push(`Your ${type.replace('_', ' ')} ads are underperforming`);
            avoidBecause.push('Consider a different angle or skip this type');
        }

        // Add pattern-based insights
        patterns.slice(0, 3).forEach(p => {
            if (p.successRate >= 70) {
                basedOn.push(`${p.feature} has ${p.successRate}% success rate in your ads`);
            }
        });

        suggestions.push({
            id: `suggestion-${type}`,
            type,
            title: `Try: ${type.replace(/_/g, ' ')}`,
            reason: info.purpose,
            predictedScore: clampedScore,
            confidence: prediction.confidence,
            priority,
            basedOn: basedOn.length > 0 ? basedOn : ['Industry best practices'],
            implementation: {
                format: info.formats[0],
                hook: info.hooks[0],
                example: info.example,
                duration: '15-30 seconds',
                platform: 'Facebook & Instagram'
            },
            avoidBecause: avoidBecause.length > 0 ? avoidBecause : undefined
        });
    });

    // Sort by priority and predicted score
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.predictedScore - a.predictedScore;
    });

    return suggestions;
}

// ============================================
// FAILURE AVOIDANCE SUGGESTIONS
// ============================================

export interface AvoidanceAdvice {
    pattern: string;
    reason: string;
    failureRate: number;
    examples: string[];
}

export function getAvoidanceAdvice(ads: AdEntry[]): AvoidanceAdvice[] {
    const advice: AvoidanceAdvice[] = [];
    const failurePatterns = new Map<string, { count: number; failCount: number }>();

    ads.forEach(ad => {
        const score = calculatePerformanceScore(ad);
        const content = ad.extractedContent;
        if (!content) return;

        const trackPattern = (pattern: string) => {
            if (!failurePatterns.has(pattern)) {
                failurePatterns.set(pattern, { count: 0, failCount: 0 });
            }
            const stats = failurePatterns.get(pattern)!;
            stats.count++;
            if (score < 50) stats.failCount++;
        };

        // Track failure-prone patterns
        if (!content.hasSubtitles && content.mediaType === 'video') {
            trackPattern('video_no_subtitles');
        }
        if (content.durationCategory === 'long' || (content.duration && content.duration > 60)) {
            trackPattern('long_video');
        }
        if (!content.hookType || content.hookType === 'none') {
            trackPattern('weak_hook');
        }
    });

    failurePatterns.forEach((stats, pattern) => {
        if (stats.count >= 2 && (stats.failCount / stats.count) > 0.5) {
            const failureRate = Math.round((stats.failCount / stats.count) * 100);

            let reason = '';
            let examples: string[] = [];

            switch (pattern) {
                case 'video_no_subtitles':
                    reason = '85% of users watch with sound off. Videos without subtitles lose most viewers.';
                    examples = ['Add captions', 'Use text overlays', 'Show key message visually'];
                    break;
                case 'long_video':
                    reason = 'Attention spans are short. Videos over 60s see significant drop-off.';
                    examples = ['Keep under 30 seconds', 'Front-load the hook', 'Cut to the point'];
                    break;
                case 'weak_hook':
                    reason = 'Without a strong hook in the first 3 seconds, viewers scroll past.';
                    examples = ['Start with a question', 'Use pattern interrupt', 'Lead with benefit'];
                    break;
            }

            advice.push({
                pattern: pattern.replace(/_/g, ' '),
                reason,
                failureRate,
                examples
            });
        }
    });

    return advice.sort((a, b) => b.failureRate - a.failureRate);
}

// ============================================
// EXPORT SUMMARY
// ============================================

export function getCreativeIntelligenceSummary(ads: AdEntry[]) {
    const portfolio = analyzePortfolio(ads);
    const suggestions = generateSuggestions(ads);
    const avoidance = getAvoidanceAdvice(ads);
    const patterns = analyzeHistoricalPatterns(ads);

    return {
        portfolio,
        suggestions,
        avoidance,
        patterns,
        summary: {
            totalAds: portfolio.totalAds,
            balanceScore: portfolio.balanceScore,
            topSuggestion: suggestions[0],
            topPattern: patterns[0],
            topWarning: avoidance[0]
        }
    };
}
