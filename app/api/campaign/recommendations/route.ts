import { NextRequest, NextResponse } from 'next/server';
import {
    getFullCampaignRecommendations,
    recommendObjective,
    recommendBudget,
    recommendTargeting,
    recommendTiming,
    CampaignGoals,
} from '@/lib/ml/campaign-optimizer';
import { ExtractedAdData } from '@/types';

/**
 * POST /api/campaign/recommendations
 * Get ML-powered campaign setting recommendations based on ad traits
 * 
 * Request body:
 * {
 *   adTraits: ExtractedAdData,  // Required - the ad content traits
 *   goals?: CampaignGoals,      // Optional - campaign goals (targetROAS, targetCPA, etc.)
 *   type?: 'full' | 'objective' | 'budget' | 'targeting' | 'timing'  // Optional - specific recommendation type
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { adTraits, goals, type = 'full' } = body;

        // Validate required fields
        if (!adTraits) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing adTraits. Provide ad content traits for recommendations.'
                },
                { status: 400 }
            );
        }

        // Ensure minimum ad traits are present
        if (!adTraits.platform && !adTraits.contentCategory && !adTraits.hookType) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Insufficient ad traits. Provide at least platform, contentCategory, or hookType.'
                },
                { status: 400 }
            );
        }

        // Set defaults for missing traits
        const normalizedTraits: ExtractedAdData = {
            platform: adTraits.platform || 'facebook',
            contentCategory: adTraits.contentCategory || 'other',
            hookType: adTraits.hookType || 'other',
            editingStyle: adTraits.editingStyle || 'other',
            colorScheme: adTraits.colorScheme || 'other',
            musicType: adTraits.musicType || 'other',
            mediaType: adTraits.mediaType || 'video',
            aspectRatio: adTraits.aspectRatio || '9:16',
            placement: adTraits.placement || 'feed',
            hasTextOverlays: adTraits.hasTextOverlays || false,
            hasSubtitles: adTraits.hasSubtitles || false,
            hasVoiceover: adTraits.hasVoiceover || false,
            isUGCStyle: adTraits.isUGCStyle || false,
            numberOfActors: adTraits.numberOfActors || 1,
            customTraits: adTraits.customTraits || [],
            extractionConfidence: adTraits.extractionConfidence || 80,
            ...adTraits,
        };

        const campaignGoals: CampaignGoals = {
            targetROAS: goals?.targetROAS || 2.5,
            targetCPA: goals?.targetCPA || 50,
            monthlyBudget: goals?.monthlyBudget || 5000,
            objective: goals?.objective,
        };

        // Return specific recommendation type or full recommendations
        let result;
        switch (type) {
            case 'objective':
                result = recommendObjective(normalizedTraits);
                break;
            case 'budget':
                const objective = recommendObjective(normalizedTraits);
                result = recommendBudget(objective.recommended, campaignGoals);
                break;
            case 'targeting':
                result = recommendTargeting(normalizedTraits);
                break;
            case 'timing':
                result = recommendTiming();
                break;
            case 'full':
            default:
                result = getFullCampaignRecommendations(normalizedTraits, campaignGoals);
                break;
        }

        return NextResponse.json({
            success: true,
            type,
            recommendations: result,
            adTraitsUsed: {
                platform: normalizedTraits.platform,
                contentCategory: normalizedTraits.contentCategory,
                hookType: normalizedTraits.hookType,
                isUGCStyle: normalizedTraits.isUGCStyle,
                editingStyle: normalizedTraits.editingStyle,
            },
            goalsUsed: campaignGoals,
        });

    } catch (error) {
        console.error('Campaign recommendations error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate campaign recommendations'
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/campaign/recommendations
 * Get recommendation types and API documentation
 */
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Campaign Recommendations API',
        documentation: {
            method: 'POST',
            endpoint: '/api/campaign/recommendations',
            description: 'Get ML-powered campaign setting recommendations based on ad traits',
            requestBody: {
                adTraits: {
                    type: 'ExtractedAdData',
                    required: true,
                    description: 'Ad content traits including platform, contentCategory, hookType, etc.',
                    minimumFields: ['platform', 'contentCategory', 'hookType'],
                },
                goals: {
                    type: 'CampaignGoals',
                    required: false,
                    description: 'Optional campaign goals',
                    fields: {
                        targetROAS: 'Target ROAS (default: 2.5)',
                        targetCPA: 'Target CPA in currency units (default: 50)',
                        monthlyBudget: 'Monthly budget in currency units (default: 5000)',
                    },
                },
                type: {
                    type: 'string',
                    required: false,
                    description: 'Type of recommendation to return',
                    options: ['full', 'objective', 'budget', 'targeting', 'timing'],
                    default: 'full',
                },
            },
            response: {
                success: 'boolean',
                type: 'Recommendation type requested',
                recommendations: {
                    objective: 'Recommended campaign objective with confidence and reasoning',
                    budget: 'Recommended budget ranges and CBO/ABO structure',
                    targeting: 'Recommended age, gender, interests, and platforms',
                    timing: 'Recommended launch day and time',
                    overallConfidence: 'Overall confidence score (0-100)',
                    dataQuality: 'Quality of historical data (low/medium/high)',
                    warnings: 'Any warnings or suggestions',
                },
            },
        },
        exampleRequest: {
            adTraits: {
                platform: 'tiktok',
                contentCategory: 'ugc',
                hookType: 'curiosity',
                isUGCStyle: true,
                editingStyle: 'raw_authentic',
            },
            goals: {
                targetROAS: 3.0,
                targetCPA: 40,
                monthlyBudget: 10000,
            },
            type: 'full',
        },
    });
}
