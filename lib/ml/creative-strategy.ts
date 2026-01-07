// Creative Strategy Analyzer
// ML-powered classification and analysis based on Facebook Ads Creatives strategy

import { ExtractedAdData } from '@/types';

// Extended AdEntry that includes runtime Facebook insights data
// This is used because localStorage data includes additional fields from Facebook imports
interface AdEntryWithInsights {
    id: string;
    extractedContent?: Partial<ExtractedAdData> & {
        title?: string;
        description?: string;
        platform?: string;
        hookType?: string;
        hookText?: string;
        contentCategory?: string;
        patternType?: string;
        isUGCStyle?: boolean;
        hasSubtitles?: boolean;
        mediaType?: string;
        adFormat?: string;
    };
    adInsights?: {
        impressions?: number;
        reach?: number;
        clicks?: number;
        ctr?: number;
        spend?: number;
        cpc?: number;
        cpm?: number;
        frequency?: number;
        results?: number;
        costPerResult?: number;
        postReactions?: number;
        postComments?: number;
        postShares?: number;
        qualityRanking?: string;
    };
}

// Use extended type for this module
type AdEntry = AdEntryWithInsights;

export type CreativeType =
    | 'Problem_Solution'
    | 'Us_Vs_Them'
    | 'Founder_Story_BTS'
    | 'UGC_Testimonial'
    | 'Direct_Offer_Static'
    | 'Unknown';

export type PerformanceStatus = 'excellent' | 'good' | 'neutral' | 'opportunity' | 'poor';

export interface CreativeAnalysis {
    creativeType: CreativeType;
    score: number;
    status: PerformanceStatus;
    whyItWorked: string[];
    whyItFailed: string[];
    shouldScaleUp: boolean;
    shouldKill: boolean;
    recommendations: string[];
    killRuleViolations: string[];
    scaleRuleMatches: string[];
}

export interface StrategyTreeNode {
    id: string;
    label: string;
    type: 'root' | 'platform' | 'creative_type' | 'ad';
    score: number;
    adsCount: number;
    status: PerformanceStatus;
    children: StrategyTreeNode[];
    insights?: CreativeAnalysis;
    avgCTR?: number;
    totalSpend?: number;
    totalResults?: number;
}

// Strategy document structure
interface StrategyDocument {
    meta_strategy_documentation: {
        creative_mix_requirements: Array<{
            type: string;
            purpose: string;
            example: string;
        }>;
        optimization_rules: {
            kill_rules: Array<{ condition: string; action: string }>;
            scale_rules: Array<{ condition: string; action: string }>;
        };
        creative_execution_workflow: {
            step_4_portfolio_balance: {
                safe_creatives: { percentage: string; description: string };
                wild_creatives: { percentage: string; description: string };
            };
        };
    };
}

// ============================================
// STRATEGY DOCUMENT LOADER
// ============================================

let strategyDoc: StrategyDocument | null = null;

export function loadStrategyDocument(doc: StrategyDocument): void {
    strategyDoc = doc;
}

export function getStrategyDocument(): StrategyDocument | null {
    return strategyDoc;
}

// ============================================
// CREATIVE TYPE CLASSIFICATION (ML-like)
// ============================================

// Pattern matching weights for classification
const CREATIVE_TYPE_PATTERNS: Record<CreativeType, {
    keywords: string[];
    hookTypes: string[];
    contentCategories: string[];
    patterns: string[];
    weight: number;
}> = {
    Problem_Solution: {
        keywords: ['pain', 'problem', 'solution', 'struggle', 'tired', 'frustrated', 'finally'],
        hookTypes: ['problem_solution', 'pain_point', 'transformation'],
        contentCategories: ['educational', 'demo', 'explainer'],
        patterns: ['problem_solution'],
        weight: 1.0
    },
    Us_Vs_Them: {
        keywords: ['vs', 'versus', 'compare', 'comparison', 'better', 'unlike', 'competitor'],
        hookTypes: ['comparison', 'challenge'],
        contentCategories: ['comparison', 'demonstration'],
        patterns: ['comparison', 'contrast'],
        weight: 1.0
    },
    Founder_Story_BTS: {
        keywords: ['founder', 'story', 'journey', 'behind', 'why', 'started', 'mission'],
        hookTypes: ['story', 'narrative', 'personal'],
        contentCategories: ['behind_the_scenes', 'brand_story', 'founder'],
        patterns: ['story', 'authenticity'],
        weight: 1.0
    },
    UGC_Testimonial: {
        keywords: ['review', 'testimonial', 'customer', 'real', 'honest', 'unboxing', 'tried'],
        hookTypes: ['testimonial', 'social_proof'],
        contentCategories: ['ugc', 'testimonial', 'review'],
        patterns: ['social_proof', 'testimonial'],
        weight: 1.0
    },
    Direct_Offer_Static: {
        keywords: ['sale', 'discount', 'off', 'deal', 'limited', 'offer', 'now', 'today'],
        hookTypes: ['offer', 'urgency', 'discount'],
        contentCategories: ['promotional', 'offer', 'static'],
        patterns: ['urgency', 'fomo', 'scarcity'],
        weight: 1.0
    },
    Unknown: {
        keywords: [],
        hookTypes: [],
        contentCategories: [],
        patterns: [],
        weight: 0
    }
};

export function classifyCreativeType(ad: AdEntry): { type: CreativeType; confidence: number; signals: string[] } {
    const content = ad.extractedContent;
    if (!content) return { type: 'Unknown', confidence: 0, signals: [] };

    const scores: Record<CreativeType, { score: number; signals: string[] }> = {
        Problem_Solution: { score: 0, signals: [] },
        Us_Vs_Them: { score: 0, signals: [] },
        Founder_Story_BTS: { score: 0, signals: [] },
        UGC_Testimonial: { score: 0, signals: [] },
        Direct_Offer_Static: { score: 0, signals: [] },
        Unknown: { score: 0, signals: [] }
    };

    // Analyze hook type
    const hookType = content.hookType?.toLowerCase() || '';
    Object.entries(CREATIVE_TYPE_PATTERNS).forEach(([type, patterns]) => {
        if (type === 'Unknown') return;
        patterns.hookTypes.forEach(h => {
            if (hookType.includes(h.replace('_', ' ')) || hookType.includes(h)) {
                scores[type as CreativeType].score += 3;
                scores[type as CreativeType].signals.push(`Hook: ${hookType}`);
            }
        });
    });

    // Analyze content category
    const category = content.contentCategory?.toLowerCase() || '';
    Object.entries(CREATIVE_TYPE_PATTERNS).forEach(([type, patterns]) => {
        if (type === 'Unknown') return;
        patterns.contentCategories.forEach(c => {
            if (category.includes(c.replace('_', ' ')) || category.includes(c)) {
                scores[type as CreativeType].score += 3;
                scores[type as CreativeType].signals.push(`Category: ${category}`);
            }
        });
    });

    // Analyze pattern type
    const pattern = content.patternType?.toLowerCase() || '';
    Object.entries(CREATIVE_TYPE_PATTERNS).forEach(([type, patterns]) => {
        if (type === 'Unknown') return;
        patterns.patterns.forEach(p => {
            if (pattern.includes(p.replace('_', ' ')) || pattern.includes(p)) {
                scores[type as CreativeType].score += 2;
                scores[type as CreativeType].signals.push(`Pattern: ${pattern}`);
            }
        });
    });

    // Analyze title/description keywords
    const text = `${content.title || ''} ${content.description || ''} ${content.hookText || ''}`.toLowerCase();
    Object.entries(CREATIVE_TYPE_PATTERNS).forEach(([type, patterns]) => {
        if (type === 'Unknown') return;
        patterns.keywords.forEach(keyword => {
            if (text.includes(keyword)) {
                scores[type as CreativeType].score += 1;
                scores[type as CreativeType].signals.push(`Keyword: "${keyword}"`);
            }
        });
    });

    // Special indicators
    if (content.isUGCStyle) {
        scores.UGC_Testimonial.score += 2;
        scores.UGC_Testimonial.signals.push('UGC Style detected');
    }

    if (content.mediaType === 'photo' || content.adFormat === 'static') {
        scores.Direct_Offer_Static.score += 1;
        scores.Direct_Offer_Static.signals.push('Static format');
    }

    // Find the best match
    let bestType: CreativeType = 'Unknown';
    let bestScore = 0;
    let bestSignals: string[] = [];

    Object.entries(scores).forEach(([type, data]) => {
        if (type !== 'Unknown' && data.score > bestScore) {
            bestScore = data.score;
            bestType = type as CreativeType;
            bestSignals = data.signals;
        }
    });

    // Calculate confidence (max theoretical score is ~15)
    const confidence = Math.min(100, Math.round((bestScore / 8) * 100));

    return { type: bestType, confidence, signals: bestSignals };
}

// ============================================
// PERFORMANCE SCORING
// ============================================

export function calculatePerformanceScore(ad: AdEntry): number {
    const insights = ad.adInsights;
    if (!insights) return 50; // Default neutral score

    let score = 50; // Start neutral
    let factors = 0;

    // CTR scoring (30% weight)
    if (insights.ctr !== undefined) {
        factors++;
        if (insights.ctr >= 5) score += 15;
        else if (insights.ctr >= 3) score += 10;
        else if (insights.ctr >= 2) score += 5;
        else if (insights.ctr >= 1) score += 0;
        else score -= 10;
    }

    // Cost efficiency scoring (25% weight)
    if (insights.costPerResult !== undefined && insights.costPerResult > 0) {
        factors++;
        // Lower is better - this is relative
        if (insights.costPerResult <= 5) score += 12;
        else if (insights.costPerResult <= 10) score += 8;
        else if (insights.costPerResult <= 20) score += 4;
        else if (insights.costPerResult <= 50) score += 0;
        else score -= 8;
    }

    // Results scoring (25% weight)
    if (insights.results !== undefined) {
        factors++;
        if (insights.results >= 10) score += 12;
        else if (insights.results >= 5) score += 8;
        else if (insights.results >= 3) score += 4;
        else if (insights.results >= 1) score += 0;
        else score -= 10;
    }

    // Engagement scoring (20% weight)
    const engagement = (insights.postReactions || 0) + (insights.postComments || 0) * 2 + (insights.postShares || 0) * 3;
    if (engagement > 0) {
        factors++;
        if (engagement >= 100) score += 10;
        else if (engagement >= 50) score += 6;
        else if (engagement >= 20) score += 3;
        else score += 1;
    }

    // Quality ranking bonus
    if (insights.qualityRanking === 'above_average') score += 5;
    else if (insights.qualityRanking === 'average') score += 0;
    else if (insights.qualityRanking === 'below_average') score -= 5;

    // Clamp score
    return Math.max(0, Math.min(100, score));
}

export function getPerformanceStatus(score: number): PerformanceStatus {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 50) return 'neutral';
    if (score >= 35) return 'opportunity';
    return 'poor';
}

export function getStatusColor(status: PerformanceStatus): string {
    switch (status) {
        case 'excellent': return '#22c55e';
        case 'good': return '#4ade80';
        case 'neutral': return '#9ca3af';
        case 'opportunity': return '#f59e0b';
        case 'poor': return '#ef4444';
    }
}

// ============================================
// KILL & SCALE RULES EVALUATION
// ============================================

export interface KillRuleResult {
    violated: boolean;
    rule: string;
    reason: string;
}

export interface ScaleRuleResult {
    matched: boolean;
    rule: string;
    reason: string;
}

export function evaluateKillRules(ad: AdEntry, targetCPA: number = 20): KillRuleResult[] {
    const insights = ad.adInsights;
    if (!insights) return [];

    const violations: KillRuleResult[] = [];
    const spend = insights.spend || 0;
    const results = insights.results || 0;
    const ctr = insights.ctr || 0;
    const cpc = insights.cpc || 0;

    // Rule 1: Spend > 1x Target CPA AND 0 Sales
    if (spend > targetCPA && results === 0) {
        violations.push({
            violated: true,
            rule: 'Spend > 1x CPA with 0 Sales',
            reason: `Spent $${spend.toFixed(2)} (>${targetCPA} target) with no results. Turn off this ad.`
        });
    }

    // Rule 2: High CPC AND Low CTR (creative not stopping scroll)
    const avgCPC = 2.0; // Baseline
    const avgCTR = 2.0; // Baseline
    if (cpc > avgCPC * 1.5 && ctr < avgCTR * 0.5) {
        violations.push({
            violated: true,
            rule: 'High CPC + Low CTR',
            reason: `CPC ($${cpc.toFixed(2)}) too high and CTR (${ctr.toFixed(2)}%) too low. Creative isn't stopping the scroll.`
        });
    }

    return violations;
}

export function evaluateScaleRules(ad: AdEntry, targetCPA: number = 20): ScaleRuleResult[] {
    const insights = ad.adInsights;
    if (!insights) return [];

    const matches: ScaleRuleResult[] = [];
    const results = insights.results || 0;
    const costPerResult = insights.costPerResult || Infinity;

    // Rule 1: 3+ Sales at or below Target CPA
    if (results >= 3 && costPerResult <= targetCPA) {
        matches.push({
            matched: true,
            rule: '3+ Sales at Target CPA',
            reason: `${results} results at $${costPerResult.toFixed(2)}/result (≤$${targetCPA} target). Move to scaling campaign!`
        });
    }

    return matches;
}

// ============================================
// FULL CREATIVE ANALYSIS
// ============================================

export function analyzeCreative(ad: AdEntry, targetCPA: number = 20): CreativeAnalysis {
    const { type: creativeType } = classifyCreativeType(ad);
    const score = calculatePerformanceScore(ad);
    const status = getPerformanceStatus(score);
    const killRules = evaluateKillRules(ad, targetCPA);
    const scaleRules = evaluateScaleRules(ad, targetCPA);

    const whyItWorked: string[] = [];
    const whyItFailed: string[] = [];
    const recommendations: string[] = [];

    const insights = ad.adInsights;
    const content = ad.extractedContent;

    // Analyze WHY it worked
    if (score >= 65) {
        if (insights?.ctr && insights.ctr >= 3) {
            whyItWorked.push(`Strong CTR of ${insights.ctr.toFixed(2)}% indicates compelling creative`);
        }
        if (content?.hasSubtitles) {
            whyItWorked.push('Subtitles improved watch time (85% view with sound off)');
        }
        if (content?.isUGCStyle) {
            whyItWorked.push('UGC style builds authenticity and trust');
        }
        if (content?.hookType) {
            whyItWorked.push(`"${content.hookType}" hook type resonated with audience`);
        }
        if (scaleRules.length > 0) {
            whyItWorked.push('Hit scaling criteria - ready for Winners Circle campaign');
        }
    }

    // Analyze WHY it failed
    if (score < 50) {
        if (insights?.ctr && insights.ctr < 1) {
            whyItFailed.push(`Low CTR of ${insights.ctr.toFixed(2)}% - creative not stopping the scroll`);
        }
        if (!content?.hasSubtitles && content?.mediaType === 'video') {
            whyItFailed.push('Missing subtitles - losing 85% of sound-off viewers');
            recommendations.push('Add subtitles to improve watch time');
        }
        if (insights?.qualityRanking === 'below_average') {
            whyItFailed.push('Facebook quality ranking below average');
            recommendations.push('Improve creative quality or relevance');
        }
        killRules.forEach(rule => {
            whyItFailed.push(rule.reason);
        });
    }

    // Generate recommendations
    if (score >= 65 && score < 80) {
        recommendations.push('Test 3-5 variations of this winning concept');
        recommendations.push('Try different hooks with same core message');
    }
    if (score < 50 && creativeType !== 'Unknown') {
        recommendations.push(`Try a different approach within ${creativeType.replace('_', ' ')}`);
    }

    return {
        creativeType,
        score,
        status,
        whyItWorked,
        whyItFailed,
        shouldScaleUp: scaleRules.length > 0,
        shouldKill: killRules.length > 0,
        recommendations,
        killRuleViolations: killRules.map(r => r.rule),
        scaleRuleMatches: scaleRules.map(r => r.rule)
    };
}

// ============================================
// STRATEGY TREE BUILDER
// ============================================

export function buildStrategyTree(ads: AdEntry[]): StrategyTreeNode {
    // Filter to complete ads only
    const completeAds = ads.filter(ad => ad.extractedContent && (
        ad.extractedContent.hookType ||
        ad.extractedContent.platform ||
        ad.extractedContent.contentCategory
    ));

    // Group by platform
    const platformGroups = new Map<string, AdEntry[]>();
    completeAds.forEach(ad => {
        const platform = ad.extractedContent?.platform || 'Unknown';
        if (!platformGroups.has(platform)) {
            platformGroups.set(platform, []);
        }
        platformGroups.get(platform)!.push(ad);
    });

    // Build platform nodes
    const platformNodes: StrategyTreeNode[] = [];
    let totalScore = 0;
    let totalCTR = 0;
    let totalAds = 0;

    platformGroups.forEach((platformAds, platform) => {
        // Group by creative type within platform
        const typeGroups = new Map<CreativeType, AdEntry[]>();
        platformAds.forEach(ad => {
            const { type } = classifyCreativeType(ad);
            if (!typeGroups.has(type)) {
                typeGroups.set(type, []);
            }
            typeGroups.get(type)!.push(ad);
        });

        // Build creative type nodes
        const typeNodes: StrategyTreeNode[] = [];
        let platformScoreSum = 0;
        let platformCTRSum = 0;

        typeGroups.forEach((typeAds, creativeType) => {
            // Build ad nodes
            const adNodes: StrategyTreeNode[] = typeAds.map(ad => {
                const analysis = analyzeCreative(ad);
                return {
                    id: ad.id,
                    label: ad.extractedContent?.title || `Ad ${ad.id.slice(0, 8)}`,
                    type: 'ad' as const,
                    score: analysis.score,
                    adsCount: 1,
                    status: analysis.status,
                    children: [],
                    insights: analysis,
                    avgCTR: ad.adInsights?.ctr,
                    totalSpend: ad.adInsights?.spend,
                    totalResults: ad.adInsights?.results
                };
            });

            const typeScoreSum = adNodes.reduce((sum, n) => sum + n.score, 0);
            const typeCTRSum = adNodes.reduce((sum, n) => sum + (n.avgCTR || 0), 0);
            const avgTypeScore = typeAds.length > 0 ? typeScoreSum / typeAds.length : 50;
            const avgTypeCTR = typeAds.length > 0 ? typeCTRSum / typeAds.length : 0;

            typeNodes.push({
                id: `${platform}-${creativeType}`,
                label: creativeType.replace(/_/g, ' '),
                type: 'creative_type',
                score: Math.round(avgTypeScore),
                adsCount: typeAds.length,
                status: getPerformanceStatus(avgTypeScore),
                children: adNodes,
                avgCTR: avgTypeCTR,
                totalSpend: typeAds.reduce((sum, ad) => sum + (ad.adInsights?.spend || 0), 0),
                totalResults: typeAds.reduce((sum, ad) => sum + (ad.adInsights?.results || 0), 0)
            });

            platformScoreSum += typeScoreSum;
            platformCTRSum += typeCTRSum;
        });

        const avgPlatformScore = platformAds.length > 0 ? platformScoreSum / platformAds.length : 50;
        const avgPlatformCTR = platformAds.length > 0 ? platformCTRSum / platformAds.length : 0;

        platformNodes.push({
            id: `platform-${platform}`,
            label: platform,
            type: 'platform',
            score: Math.round(avgPlatformScore),
            adsCount: platformAds.length,
            status: getPerformanceStatus(avgPlatformScore),
            children: typeNodes,
            avgCTR: avgPlatformCTR,
            totalSpend: platformAds.reduce((sum, ad) => sum + (ad.adInsights?.spend || 0), 0),
            totalResults: platformAds.reduce((sum, ad) => sum + (ad.adInsights?.results || 0), 0)
        });

        totalScore += platformScoreSum;
        totalCTR += platformCTRSum;
        totalAds += platformAds.length;
    });

    const avgRootScore = totalAds > 0 ? totalScore / totalAds : 50;

    return {
        id: 'strategy-root',
        label: 'Your Ad Strategy',
        type: 'root',
        score: Math.round(avgRootScore),
        adsCount: totalAds,
        status: getPerformanceStatus(avgRootScore),
        children: platformNodes,
        avgCTR: totalAds > 0 ? totalCTR / totalAds : 0,
        totalSpend: completeAds.reduce((sum, ad) => sum + (ad.adInsights?.spend || 0), 0),
        totalResults: completeAds.reduce((sum, ad) => sum + (ad.adInsights?.results || 0), 0)
    };
}
