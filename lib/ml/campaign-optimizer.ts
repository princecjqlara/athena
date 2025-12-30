/**
 * Campaign Optimizer ML Module
 * Provides ML-powered recommendations for campaign settings based on historical performance
 */

import { ExtractedAdData, Platform, ObjectiveType, AudienceType, BudgetTier, TargetAgeGroup, DayOfWeek, TimeOfDay } from '@/types';
import { getHistoricalAds, findSimilarAds } from './historical-performance';
import { getAllSegmentScores, findBestSegment, getAudienceSegments } from './audience-segmentation';
import { getFeatureWeights } from './weight-adjustment';

// ===== TYPES =====

export interface CampaignGoals {
    targetROAS?: number;
    targetCPA?: number;
    monthlyBudget?: number;
    objective?: string;
}

export interface ObjectiveRecommendation {
    recommended: string;
    confidence: number;
    reasoning: string;
    alternatives: string[];
    historicalPerformance: {
        objective: string;
        avgROAS: number;
        avgCTR: number;
        sampleSize: number;
    }[];
}

export interface BudgetRecommendation {
    dailyBudget: { min: number; max: number; optimal: number };
    lifetimeBudget: { min: number; max: number; optimal: number };
    budgetType: 'daily' | 'lifetime';
    budgetTypeReasoning: string;
    structure: 'CBO' | 'ABO';
    confidence: number;
    reasoning: string;
    historicalBudgetData: { tier: string; avgROAS: number; sampleSize: number }[];
}

export interface TargetingRecommendation {
    ageRange: { min: number; max: number };
    gender: 'male' | 'female' | 'all';
    interests: string[];
    platforms: string[];
    confidence: number;
    reasoning: string;
    segments: { id: string; name: string; score: number }[];
}

export interface TimingRecommendation {
    bestLaunchDay: DayOfWeek;
    bestLaunchTime: TimeOfDay;
    confidence: number;
    reasoning: string;
}

export interface PlacementRecommendation {
    placements: string[];
    excludedPlacements: string[];
    automaticPlacements: boolean;
    confidence: number;
    reasoning: string;
    placementBreakdown: { placement: string; score: number; reason: string }[];
}

export interface AdCopyRecommendation {
    primaryText: string;
    headline: string;
    description: string;
    callToAction: string;
    confidence: number;
    reasoning: string;
    alternatives: {
        primaryText: string;
        headline: string;
    }[];
}

export interface FlexibleAdsRecommendation {
    useFlexibleAds: boolean;  // Advantage+ Creative
    enhancements: {
        textOptimization: boolean;
        imageBrightness: boolean;
        musicGeneration: boolean;
        imageTemplates: boolean;
    };
    confidence: number;
    reasoning: string;
}

export interface CampaignRecommendations {
    objective: ObjectiveRecommendation;
    budget: BudgetRecommendation;
    targeting: TargetingRecommendation;
    timing: TimingRecommendation;
    placements: PlacementRecommendation;
    adCopy: AdCopyRecommendation;
    flexibleAds: FlexibleAdsRecommendation;
    overallConfidence: number;
    dataQuality: 'low' | 'medium' | 'high';
    warnings: string[];
    dataPoints: {
        totalAdsAnalyzed: number;
        avgROAS: number;
        avgCTR: number;
        topPerformingTraits: string[];
    };
}

// ===== OBJECTIVE PERFORMANCE MAPPING =====

// Maps Facebook objectives to internal objective types
const FB_OBJECTIVE_MAP: Record<string, ObjectiveType> = {
    'OUTCOME_AWARENESS': 'awareness',
    'OUTCOME_ENGAGEMENT': 'engagement',
    'OUTCOME_LEADS': 'leads',
    'OUTCOME_SALES': 'conversions',
    'OUTCOME_TRAFFIC': 'traffic',
    'OUTCOME_APP_PROMOTION': 'awareness',
};

// Reverse map for recommendations
const OBJECTIVE_TO_FB: Record<ObjectiveType, string> = {
    'awareness': 'OUTCOME_AWARENESS',
    'traffic': 'OUTCOME_TRAFFIC',
    'engagement': 'OUTCOME_ENGAGEMENT',
    'leads': 'OUTCOME_LEADS',
    'conversions': 'OUTCOME_SALES',
    'messages': 'OUTCOME_ENGAGEMENT',
    'video_views': 'OUTCOME_AWARENESS',
};

// Content type to objective affinity
const CONTENT_OBJECTIVE_AFFINITY: Record<string, ObjectiveType[]> = {
    'ugc': ['leads', 'conversions', 'engagement'],
    'product_demo': ['conversions', 'traffic', 'leads'],
    'testimonial': ['leads', 'conversions'],
    'lifestyle': ['awareness', 'engagement', 'traffic'],
    'educational': ['leads', 'traffic', 'awareness'],
    'entertainment': ['engagement', 'awareness', 'video_views'],
    'tutorial': ['leads', 'traffic'],
    'influencer': ['engagement', 'awareness', 'conversions'],
    'brand_story': ['awareness', 'engagement'],
};

// Platform to objective performance (based on industry benchmarks)
const PLATFORM_OBJECTIVE_STRENGTH: Record<Platform, Record<ObjectiveType, number>> = {
    'facebook': { awareness: 0.8, traffic: 0.85, engagement: 0.7, leads: 0.9, conversions: 0.85, messages: 0.8, video_views: 0.7 },
    'instagram': { awareness: 0.9, traffic: 0.75, engagement: 0.95, leads: 0.7, conversions: 0.75, messages: 0.85, video_views: 0.9 },
    'tiktok': { awareness: 0.95, traffic: 0.6, engagement: 0.95, leads: 0.5, conversions: 0.6, messages: 0.4, video_views: 0.95 },
    'youtube': { awareness: 0.85, traffic: 0.8, engagement: 0.7, leads: 0.6, conversions: 0.7, messages: 0.3, video_views: 0.95 },
    'snapchat': { awareness: 0.8, traffic: 0.5, engagement: 0.85, leads: 0.4, conversions: 0.5, messages: 0.3, video_views: 0.8 },
    'pinterest': { awareness: 0.7, traffic: 0.85, engagement: 0.6, leads: 0.5, conversions: 0.7, messages: 0.2, video_views: 0.4 },
    'twitter': { awareness: 0.75, traffic: 0.8, engagement: 0.7, leads: 0.4, conversions: 0.5, messages: 0.3, video_views: 0.5 },
    'linkedin': { awareness: 0.6, traffic: 0.75, engagement: 0.5, leads: 0.85, conversions: 0.6, messages: 0.7, video_views: 0.4 },
    'other': { awareness: 0.5, traffic: 0.5, engagement: 0.5, leads: 0.5, conversions: 0.5, messages: 0.5, video_views: 0.5 },
};

// ===== HISTORICAL DATA ANALYSIS =====

interface HistoricalObjectiveData {
    objective: ObjectiveType;
    campaigns: number;
    avgROAS: number;
    avgCTR: number;
    avgConversionRate: number;
    avgSuccessScore: number;
}

function analyzeHistoricalObjectives(): HistoricalObjectiveData[] {
    const historicalAds = getHistoricalAds();
    const objectiveStats: Record<ObjectiveType, { count: number; totalROAS: number; totalCTR: number; totalConv: number; totalScore: number }> = {
        awareness: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
        traffic: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
        engagement: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
        leads: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
        conversions: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
        messages: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
        video_views: { count: 0, totalROAS: 0, totalCTR: 0, totalConv: 0, totalScore: 0 },
    };

    historicalAds.forEach(ad => {
        if (ad.adData.objectiveType && ad.results) {
            const obj = ad.adData.objectiveType as ObjectiveType;
            objectiveStats[obj].count++;
            objectiveStats[obj].totalROAS += ad.results.roas || 0;
            objectiveStats[obj].totalCTR += ad.results.ctr || 0;
            objectiveStats[obj].totalConv += ad.results.conversionRate || 0;
            objectiveStats[obj].totalScore += ad.successScore || 0;
        }
    });

    return Object.entries(objectiveStats)
        .filter(([, stats]) => stats.count > 0)
        .map(([objective, stats]) => ({
            objective: objective as ObjectiveType,
            campaigns: stats.count,
            avgROAS: stats.count > 0 ? stats.totalROAS / stats.count : 0,
            avgCTR: stats.count > 0 ? stats.totalCTR / stats.count : 0,
            avgConversionRate: stats.count > 0 ? stats.totalConv / stats.count : 0,
            avgSuccessScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
        }))
        .sort((a, b) => b.avgSuccessScore - a.avgSuccessScore);
}

// ===== RECOMMENDATION FUNCTIONS =====

/**
 * Recommend best objective based on ad content and historical performance
 */
export function recommendObjective(adTraits: ExtractedAdData): ObjectiveRecommendation {
    const platform = adTraits.platform || 'facebook';
    const contentType = adTraits.contentCategory || 'other';
    const historicalData = analyzeHistoricalObjectives();

    // Get content-based affinity
    const contentAffinity = CONTENT_OBJECTIVE_AFFINITY[contentType] || ['traffic', 'awareness'];

    // Get platform strengths
    const platformStrengths = PLATFORM_OBJECTIVE_STRENGTH[platform] || PLATFORM_OBJECTIVE_STRENGTH.other;

    // Score each objective
    const objectiveScores: { objective: ObjectiveType; score: number; reasons: string[] }[] = [];

    const allObjectives: ObjectiveType[] = ['awareness', 'traffic', 'engagement', 'leads', 'conversions', 'messages', 'video_views'];

    allObjectives.forEach(objective => {
        let score = 0;
        const reasons: string[] = [];

        // Content affinity (30%)
        const affinityIndex = contentAffinity.indexOf(objective);
        if (affinityIndex !== -1) {
            const affinityScore = (contentAffinity.length - affinityIndex) / contentAffinity.length;
            score += affinityScore * 30;
            if (affinityIndex === 0) reasons.push(`${contentType} content performs best with ${objective}`);
        }

        // Platform strength (25%)
        const platformScore = platformStrengths[objective] || 0.5;
        score += platformScore * 25;
        if (platformScore >= 0.85) reasons.push(`${platform} excels at ${objective} campaigns`);

        // Historical performance (35%)
        const historical = historicalData.find(h => h.objective === objective);
        if (historical && historical.campaigns >= 3) {
            const histScore = historical.avgSuccessScore / 100;
            score += histScore * 35;
            if (histScore >= 0.7) reasons.push(`Historical ${objective} campaigns average ${Math.round(historical.avgSuccessScore)}% success`);
        } else {
            score += 15; // Neutral score if no history
        }

        // UGC bonus for leads/conversions (10%)
        if (adTraits.isUGCStyle && (objective === 'leads' || objective === 'conversions')) {
            score += 10;
            reasons.push('UGC content converts well for lead/sales campaigns');
        }

        objectiveScores.push({ objective, score, reasons });
    });

    // Sort by score
    objectiveScores.sort((a, b) => b.score - a.score);

    const recommended = objectiveScores[0];
    const alternatives = objectiveScores.slice(1, 4).map(o => OBJECTIVE_TO_FB[o.objective]);

    // Calculate confidence
    const scoreDiff = recommended.score - (objectiveScores[1]?.score || 0);
    const hasHistoricalData = historicalData.length >= 3;
    const confidence = Math.min(95, Math.round(50 + scoreDiff + (hasHistoricalData ? 20 : 0)));

    return {
        recommended: OBJECTIVE_TO_FB[recommended.objective],
        confidence,
        reasoning: recommended.reasons.slice(0, 3).join('. ') || `${recommended.objective} is recommended based on content and platform analysis.`,
        alternatives,
        historicalPerformance: historicalData.slice(0, 5).map(h => ({
            objective: OBJECTIVE_TO_FB[h.objective],
            avgROAS: Math.round(h.avgROAS * 100) / 100,
            avgCTR: Math.round(h.avgCTR * 10000) / 100, // Convert to percentage
            sampleSize: h.campaigns,
        })),
    };
}

/**
 * Recommend budget based on objective and historical ROAS
 */
export function recommendBudget(
    objective: string,
    goals: CampaignGoals = {}
): BudgetRecommendation {
    const { targetROAS = 2.5, monthlyBudget = 5000, targetCPA = 50 } = goals;

    // Analyze historical budget performance
    const historicalAds = getHistoricalAds();
    const budgetPerformance: Record<string, { count: number; totalROAS: number; avgSpend: number }> = {};

    historicalAds.forEach(ad => {
        if (ad.adData.budgetTier && ad.results) {
            const tier = ad.adData.budgetTier;
            if (!budgetPerformance[tier]) budgetPerformance[tier] = { count: 0, totalROAS: 0, avgSpend: 0 };
            budgetPerformance[tier].count++;
            budgetPerformance[tier].totalROAS += ad.results.roas || 0;
            budgetPerformance[tier].avgSpend += ad.results.adSpend || 0;
        }
    });

    // Find best performing budget tier
    let bestTier: BudgetTier = 'medium';
    let bestROAS = 0;
    Object.entries(budgetPerformance).forEach(([tier, data]) => {
        const avgROAS = data.count > 0 ? data.totalROAS / data.count : 0;
        if (avgROAS > bestROAS) {
            bestROAS = avgROAS;
            bestTier = tier as BudgetTier;
        }
    });

    // Budget tier ranges (in Pesos)
    const tierRanges: Record<BudgetTier, { min: number; max: number }> = {
        micro: { min: 200, max: 500 },
        small: { min: 500, max: 1500 },
        medium: { min: 1500, max: 5000 },
        large: { min: 5000, max: 20000 },
        enterprise: { min: 20000, max: 100000 },
    };

    const range = tierRanges[bestTier];

    // Calculate optimal based on target ROAS and CPA
    const optimalDaily = Math.min(
        Math.max(range.min, Math.round(monthlyBudget / 30)),
        range.max
    );

    // Determine CBO vs ABO
    const hasEnoughData = historicalAds.length >= 10;
    const structure: 'CBO' | 'ABO' = hasEnoughData ? 'ABO' : 'CBO';

    // Determine budget type (daily vs lifetime)
    // Lifetime is better for: short campaigns, fixed duration promos
    // Daily is better for: ongoing campaigns, flexible testing
    const budgetType: 'daily' | 'lifetime' = monthlyBudget < 10000 ? 'daily' : 'lifetime';
    const budgetTypeReasoning = budgetType === 'daily'
        ? 'Daily budget recommended for flexibility and easier optimization. Allows you to adjust spend based on performance.'
        : 'Lifetime budget recommended for larger campaigns. Facebook optimizes spend across the campaign duration for better results.';

    const confidence = Math.min(90, 40 + (Object.keys(budgetPerformance).length * 15));

    let reasoning = `Based on ${bestTier} budget tier performance`;
    if (bestROAS > 0) reasoning += ` (avg ROAS: ${Math.round(bestROAS * 100) / 100}x)`;
    reasoning += `. ${structure === 'CBO' ? 'Campaign Budget Optimization recommended for testing phase.' : 'Ad Set Budget Optimization recommended for scaling proven ads.'}`;

    // Build historical data for display
    const historicalBudgetData = Object.entries(budgetPerformance).map(([tier, data]) => ({
        tier,
        avgROAS: data.count > 0 ? Math.round((data.totalROAS / data.count) * 100) / 100 : 0,
        sampleSize: data.count
    })).sort((a, b) => b.avgROAS - a.avgROAS);

    return {
        dailyBudget: {
            min: range.min,
            max: range.max,
            optimal: optimalDaily,
        },
        lifetimeBudget: {
            min: range.min * 7,
            max: range.max * 30,
            optimal: optimalDaily * 14,
        },
        budgetType,
        budgetTypeReasoning,
        structure,
        confidence,
        reasoning,
        historicalBudgetData,
    };
}

/**
 * Recommend targeting based on audience segmentation
 */
export function recommendTargeting(adTraits: ExtractedAdData): TargetingRecommendation {
    // Build feature list for segment scoring
    const features = [
        { feature: adTraits.hookType, present: true },
        { feature: 'ugc_style', present: adTraits.isUGCStyle },
        { feature: 'subtitles', present: adTraits.hasSubtitles },
        { feature: adTraits.editingStyle, present: true },
        { feature: adTraits.platform, present: true },
        { feature: 'voiceover', present: adTraits.hasVoiceover },
    ];

    // Get segment scores
    const segmentScores = getAllSegmentScores(features);
    const bestSegment = findBestSegment(features);
    const allSegments = getAudienceSegments();

    // Find top 3 performing segments
    const topSegments = segmentScores.slice(0, 3);

    // Derive targeting from best segment
    let ageMin = 18;
    let ageMax = 65;
    let gender: 'male' | 'female' | 'all' = 'all';
    const interests: string[] = [];
    const platforms: string[] = [];

    if (bestSegment) {
        const segment = allSegments.find(s => s.id === bestSegment.segment.id);
        if (segment) {
            ageMin = segment.ageRange?.min || 18;
            ageMax = segment.ageRange?.max || 65;
            gender = segment.gender || 'all';
            interests.push(...(segment.interests || []));
            platforms.push(...(segment.platforms || []));
        }
    }

    // Content-based interest additions
    const contentInterests: Record<string, string[]> = {
        'ugc': ['online shopping', 'social media', 'trends'],
        'product_demo': ['technology', 'gadgets', 'shopping'],
        'lifestyle': ['fitness', 'wellness', 'lifestyle'],
        'educational': ['education', 'self-improvement', 'learning'],
        'testimonial': ['reviews', 'recommendations'],
    };

    const additionalInterests = contentInterests[adTraits.contentCategory] || [];
    interests.push(...additionalInterests);

    // Deduplicate
    const uniqueInterests = [...new Set(interests)];
    const uniquePlatforms = platforms.length > 0 ? [...new Set(platforms)] : [adTraits.platform];

    const confidence = bestSegment ? Math.round(bestSegment.score) : 50;

    let reasoning = '';
    if (bestSegment) {
        reasoning = `${bestSegment.segment.name} segment shows highest affinity (score: ${Math.round(bestSegment.score)}). `;
    }
    reasoning += `Targeting ages ${ageMin}-${ageMax}`;
    if (gender !== 'all') reasoning += `, ${gender}s`;
    if (uniqueInterests.length > 0) reasoning += ` with interests in ${uniqueInterests.slice(0, 3).join(', ')}`;

    return {
        ageRange: { min: ageMin, max: ageMax },
        gender,
        interests: uniqueInterests.slice(0, 10),
        platforms: uniquePlatforms,
        confidence,
        reasoning,
        segments: topSegments.map(s => ({ id: s.segmentId, name: s.segmentName, score: s.score })),
    };
}

/**
 * Recommend best launch timing based on historical data
 */
export function recommendTiming(): TimingRecommendation {
    const historicalAds = getHistoricalAds();

    // Analyze day performance
    const dayStats: Record<DayOfWeek, { count: number; totalScore: number }> = {
        monday: { count: 0, totalScore: 0 },
        tuesday: { count: 0, totalScore: 0 },
        wednesday: { count: 0, totalScore: 0 },
        thursday: { count: 0, totalScore: 0 },
        friday: { count: 0, totalScore: 0 },
        saturday: { count: 0, totalScore: 0 },
        sunday: { count: 0, totalScore: 0 },
    };

    const timeStats: Record<TimeOfDay, { count: number; totalScore: number }> = {
        early_morning: { count: 0, totalScore: 0 },
        morning: { count: 0, totalScore: 0 },
        afternoon: { count: 0, totalScore: 0 },
        evening: { count: 0, totalScore: 0 },
        night: { count: 0, totalScore: 0 },
    };

    historicalAds.forEach(ad => {
        if (ad.results && ad.successScore) {
            const day = ad.results.launchDay as DayOfWeek;
            const time = ad.results.launchTime as TimeOfDay;

            if (day && dayStats[day]) {
                dayStats[day].count++;
                dayStats[day].totalScore += ad.successScore;
            }
            if (time && timeStats[time]) {
                timeStats[time].count++;
                timeStats[time].totalScore += ad.successScore;
            }
        }
    });

    // Find best day
    let bestDay: DayOfWeek = 'tuesday';
    let bestDayScore = 0;
    Object.entries(dayStats).forEach(([day, stats]) => {
        const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
        if (avgScore > bestDayScore) {
            bestDayScore = avgScore;
            bestDay = day as DayOfWeek;
        }
    });

    // Find best time
    let bestTime: TimeOfDay = 'evening';
    let bestTimeScore = 0;
    Object.entries(timeStats).forEach(([time, stats]) => {
        const avgScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
        if (avgScore > bestTimeScore) {
            bestTimeScore = avgScore;
            bestTime = time as TimeOfDay;
        }
    });

    // Default to industry benchmarks if no data
    if (bestDayScore === 0) {
        bestDay = 'tuesday';
        bestDayScore = 70;
    }
    if (bestTimeScore === 0) {
        bestTime = 'evening';
        bestTimeScore = 75;
    }

    const hasEnoughDayData = Object.values(dayStats).some(s => s.count >= 3);
    const confidence = hasEnoughDayData ? Math.round((bestDayScore + bestTimeScore) / 2) : 60;

    let reasoning = '';
    if (hasEnoughDayData) {
        reasoning = `${bestDay.charAt(0).toUpperCase() + bestDay.slice(1)} ${bestTime} shows best historical performance. `;
        const dayCount = dayStats[bestDay].count;
        reasoning += `Based on ${dayCount} campaigns launched on ${bestDay}s.`;
    } else {
        reasoning = `${bestDay.charAt(0).toUpperCase() + bestDay.slice(1)} ${bestTime} recommended based on industry benchmarks. Collect more data for personalized recommendations.`;
    }

    return {
        bestLaunchDay: bestDay,
        bestLaunchTime: bestTime,
        confidence,
        reasoning,
    };
}

/**
 * Recommend placements based on platform and content type
 */
export function recommendPlacements(adTraits: ExtractedAdData): PlacementRecommendation {
    const platform = adTraits.platform || 'facebook';
    const aspectRatio = adTraits.aspectRatio || '9:16';
    const isVideo = adTraits.mediaType === 'video';

    // All available Facebook placements
    const allPlacements = [
        'facebook_feed', 'facebook_stories', 'facebook_reels', 'facebook_right_column',
        'instagram_feed', 'instagram_stories', 'instagram_reels', 'instagram_explore',
        'audience_network', 'messenger_inbox', 'messenger_stories'
    ];

    // Score each placement
    const placementScores: { placement: string; score: number; reason: string }[] = [];

    allPlacements.forEach(placement => {
        let score = 50;
        let reason = '';

        // Aspect ratio match
        if (aspectRatio === '9:16' && (placement.includes('stories') || placement.includes('reels'))) {
            score += 30;
            reason = 'Vertical format optimized';
        } else if (aspectRatio === '1:1' && placement.includes('feed')) {
            score += 20;
            reason = 'Square format works well';
        } else if (aspectRatio === '16:9' && !placement.includes('stories')) {
            score += 15;
            reason = 'Horizontal format supported';
        }

        // Video bonus for reels/stories
        if (isVideo && (placement.includes('reels') || placement.includes('stories'))) {
            score += 20;
            reason = reason ? `${reason}, video content optimal` : 'Video content optimal';
        }

        // UGC style bonus for certain placements
        if (adTraits.isUGCStyle && (placement.includes('reels') || placement.includes('feed'))) {
            score += 15;
            reason = reason ? `${reason}, UGC performs well` : 'UGC performs well';
        }

        // Platform match bonus
        if (platform === 'facebook' && placement.startsWith('facebook')) {
            score += 10;
        } else if (platform === 'instagram' && placement.startsWith('instagram')) {
            score += 10;
        }

        placementScores.push({ placement, score, reason: reason || 'Standard placement' });
    });

    // Sort by score
    placementScores.sort((a, b) => b.score - a.score);

    // Top placements (score > 60)
    const recommendedPlacements = placementScores.filter(p => p.score >= 60).map(p => p.placement);
    const excludedPlacements = placementScores.filter(p => p.score < 40).map(p => p.placement);

    // If vertical video, recommend automatic placements for stories/reels
    const automaticPlacements = recommendedPlacements.length < 3;

    const confidence = recommendedPlacements.length > 0 ? Math.min(85, 50 + recommendedPlacements.length * 10) : 50;

    let reasoning = '';
    if (recommendedPlacements.length > 0) {
        reasoning = `Recommending ${recommendedPlacements.slice(0, 3).join(', ')} based on ${aspectRatio} aspect ratio and ${isVideo ? 'video' : 'image'} content.`;
    } else {
        reasoning = 'Using automatic placements. Facebook will optimize delivery across placements.';
    }

    return {
        placements: recommendedPlacements.slice(0, 6),
        excludedPlacements: excludedPlacements.slice(0, 4),
        automaticPlacements,
        confidence,
        reasoning,
        placementBreakdown: placementScores.slice(0, 8),
    };
}

/**
 * Recommend ad copy based on content traits
 */
export function recommendAdCopy(adTraits: ExtractedAdData): AdCopyRecommendation {
    const contentCategory = adTraits.contentCategory || 'other';
    const hookType = adTraits.hookType || 'curiosity';
    const platform = adTraits.platform || 'facebook';

    // CTA mapping based on objective affinity
    const ctaMap: Record<string, string> = {
        'ugc': 'SHOP_NOW',
        'testimonial': 'LEARN_MORE',
        'product_demo': 'SHOP_NOW',
        'lifestyle': 'LEARN_MORE',
        'educational': 'SIGN_UP',
        'entertainment': 'WATCH_MORE',
    };

    // Hook-based primary text templates
    const hookTemplates: Record<string, string[]> = {
        'curiosity': [
            '🤔 Ever wondered why everyone is talking about this?',
            '👀 The secret that changed everything...',
            '⚡ What happens when you finally try this?',
        ],
        'shock': [
            '🔥 You won\'t believe this actually works!',
            '😱 This completely changed my mind about...',
            '💥 I never expected this result!',
        ],
        'question': [
            '❓ Are you making this common mistake?',
            '🤷 Why are so many people switching?',
            '💭 Have you tried this yet?',
        ],
        'transformation': [
            '✨ Before vs After: The results speak for themselves',
            '🚀 See the transformation in just...',
            '💯 Real results from real people',
        ],
    };

    // Headline templates  
    const headlineTemplates: Record<string, string[]> = {
        'ugc': ['Try it for yourself', 'See why everyone loves this', 'Real people, real results'],
        'testimonial': ['Hear their story', 'Join thousands of happy customers', 'See what they\'re saying'],
        'product_demo': ['Watch how it works', 'See it in action', 'Discover the difference'],
        'lifestyle': ['Live your best life', 'Transform your routine', 'Upgrade today'],
    };

    const hookTexts = hookTemplates[hookType] || hookTemplates['curiosity'];
    const headlines = headlineTemplates[contentCategory] || ['Learn More', 'Shop Now', 'Get Started'];

    const primaryText = hookTexts[0];
    const headline = headlines[0];
    const description = `Discover why ${platform} users are loving this. Limited time offer available.`;
    const callToAction = ctaMap[contentCategory] || 'LEARN_MORE';

    const alternatives = [
        { primaryText: hookTexts[1] || hookTexts[0], headline: headlines[1] || headlines[0] },
        { primaryText: hookTexts[2] || hookTexts[0], headline: headlines[2] || headlines[0] },
    ];

    const reasoning = `Primary text uses ${hookType} hook style which aligns with your content. Headline emphasizes ${contentCategory} content benefits. CTA optimized for conversion.`;

    return {
        primaryText,
        headline,
        description,
        callToAction,
        confidence: 70,
        reasoning,
        alternatives,
    };
}

/**
 * Recommend Flexible Ads (Advantage+ Creative) settings
 */
export function recommendFlexibleAds(adTraits: ExtractedAdData): FlexibleAdsRecommendation {
    const isUGC = adTraits.isUGCStyle;
    const isVideo = adTraits.mediaType === 'video';
    const hasSubtitles = adTraits.hasSubtitles;
    const historicalAds = getHistoricalAds();

    // Advantage+ Creative is generally good for testing, but may hurt UGC authenticity
    const useFlexibleAds = !isUGC && historicalAds.length < 20;

    const enhancements = {
        textOptimization: !isUGC, // Don't auto-optimize UGC text
        imageBrightness: !isVideo, // Only for images
        musicGeneration: isVideo && !hasSubtitles, // Only if no existing audio focus
        imageTemplates: !isUGC && !isVideo, // Templates for static images
    };

    let reasoning = '';
    if (useFlexibleAds) {
        reasoning = 'Advantage+ Creative recommended for testing phase. Facebook will automatically test variations of your ad to find what works best.';
    } else if (isUGC) {
        reasoning = 'Advantage+ Creative disabled for UGC content. Authenticity is key - auto-enhancements may reduce trust.';
    } else {
        reasoning = 'Advantage+ Creative disabled. Your ad content is optimized and doesn\'t need automatic variations.';
    }

    const enabledCount = Object.values(enhancements).filter(Boolean).length;
    const confidence = 65 + (enabledCount * 5);

    return {
        useFlexibleAds,
        enhancements,
        confidence,
        reasoning,
    };
}

/**
 * Get full campaign recommendations combining all analyses
 */
export function getFullCampaignRecommendations(
    adTraits: ExtractedAdData,
    goals: CampaignGoals = {}
): CampaignRecommendations {
    const objective = recommendObjective(adTraits);
    const budget = recommendBudget(objective.recommended, goals);
    const targeting = recommendTargeting(adTraits);
    const timing = recommendTiming();
    const placements = recommendPlacements(adTraits);
    const adCopy = recommendAdCopy(adTraits);
    const flexibleAds = recommendFlexibleAds(adTraits);

    // Calculate overall confidence
    const overallConfidence = Math.round(
        (objective.confidence * 0.2) +
        (budget.confidence * 0.15) +
        (targeting.confidence * 0.2) +
        (timing.confidence * 0.1) +
        (placements.confidence * 0.15) +
        (adCopy.confidence * 0.1) +
        (flexibleAds.confidence * 0.1)
    );

    // Determine data quality
    const historicalAds = getHistoricalAds();
    let dataQuality: 'low' | 'medium' | 'high';
    if (historicalAds.length >= 50) dataQuality = 'high';
    else if (historicalAds.length >= 20) dataQuality = 'medium';
    else dataQuality = 'low';

    // Calculate aggregate stats
    let totalROAS = 0;
    let totalCTR = 0;
    const traitCounts: Record<string, number> = {};

    historicalAds.forEach(ad => {
        if (ad.results) {
            totalROAS += ad.results.roas || 0;
            totalCTR += ad.results.ctr || 0;
        }
        // Count traits
        if (ad.adData.hookType) traitCounts[ad.adData.hookType] = (traitCounts[ad.adData.hookType] || 0) + 1;
        if (ad.adData.contentCategory) traitCounts[ad.adData.contentCategory] = (traitCounts[ad.adData.contentCategory] || 0) + 1;
    });

    const topPerformingTraits = Object.entries(traitCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([trait]) => trait);

    // Generate warnings
    const warnings: string[] = [];
    if (dataQuality === 'low') {
        warnings.push('Limited historical data available. Recommendations are based partially on industry benchmarks.');
    }
    if (objective.confidence < 60) {
        warnings.push('Objective recommendation has low confidence. Consider A/B testing multiple objectives.');
    }
    if (targeting.confidence < 50) {
        warnings.push('Targeting recommendation needs more data. Consider broad targeting initially.');
    }
    if (placements.automaticPlacements) {
        warnings.push('Using automatic placements. Monitor placement breakdown after launch.');
    }

    return {
        objective,
        budget,
        targeting,
        timing,
        placements,
        adCopy,
        flexibleAds,
        overallConfidence,
        dataQuality,
        warnings,
        dataPoints: {
            totalAdsAnalyzed: historicalAds.length,
            avgROAS: historicalAds.length > 0 ? Math.round((totalROAS / historicalAds.length) * 100) / 100 : 0,
            avgCTR: historicalAds.length > 0 ? Math.round((totalCTR / historicalAds.length) * 100) / 100 : 0,
            topPerformingTraits,
        },
    };
}

// Export all functions
export default {
    recommendObjective,
    recommendBudget,
    recommendTargeting,
    recommendTiming,
    recommendPlacements,
    recommendAdCopy,
    recommendFlexibleAds,
    getFullCampaignRecommendations,
};
