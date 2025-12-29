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
    structure: 'CBO' | 'ABO';
    confidence: number;
    reasoning: string;
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

export interface CampaignRecommendations {
    objective: ObjectiveRecommendation;
    budget: BudgetRecommendation;
    targeting: TargetingRecommendation;
    timing: TimingRecommendation;
    overallConfidence: number;
    dataQuality: 'low' | 'medium' | 'high';
    warnings: string[];
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
    const estimatedConversions = monthlyBudget / targetCPA;
    const estimatedRevenue = estimatedConversions * (targetCPA * targetROAS);
    const optimalDaily = Math.min(
        Math.max(range.min, Math.round(monthlyBudget / 30)),
        range.max
    );

    // Determine CBO vs ABO
    // CBO is better for: multiple ad sets, testing phase
    // ABO is better for: proven winners, scaling
    const hasEnoughData = historicalAds.length >= 10;
    const structure: 'CBO' | 'ABO' = hasEnoughData ? 'ABO' : 'CBO';

    const confidence = Math.min(90, 40 + (Object.keys(budgetPerformance).length * 15));

    let reasoning = `Based on ${bestTier} budget tier performance`;
    if (bestROAS > 0) reasoning += ` (avg ROAS: ${Math.round(bestROAS * 100) / 100}x)`;
    reasoning += `. ${structure === 'CBO' ? 'Campaign Budget Optimization recommended for testing phase.' : 'Ad Set Budget Optimization recommended for scaling proven ads.'}`;

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
        structure,
        confidence,
        reasoning,
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
        segments: topSegments,
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

    // Calculate overall confidence
    const overallConfidence = Math.round(
        (objective.confidence * 0.3) +
        (budget.confidence * 0.25) +
        (targeting.confidence * 0.25) +
        (timing.confidence * 0.2)
    );

    // Determine data quality
    const historicalAds = getHistoricalAds();
    let dataQuality: 'low' | 'medium' | 'high';
    if (historicalAds.length >= 50) dataQuality = 'high';
    else if (historicalAds.length >= 20) dataQuality = 'medium';
    else dataQuality = 'low';

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

    return {
        objective,
        budget,
        targeting,
        timing,
        overallConfidence,
        dataQuality,
        warnings,
    };
}

// Export all functions
export default {
    recommendObjective,
    recommendBudget,
    recommendTargeting,
    recommendTiming,
    getFullCampaignRecommendations,
};
