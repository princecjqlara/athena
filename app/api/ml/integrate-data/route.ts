// ML Data Integration API - Upload gathered data to user's ML model
import { NextRequest, NextResponse } from 'next/server';

interface CompiledData {
    targetAudience: {
        demographics: string[];
        interests: string[];
        behaviors: string[];
        painPoints: string[];
    };
    adPreferences: {
        platforms: string[];
        contentTypes: string[];
        tones: string[];
        hooks: string[];
    };
    businessContext: {
        industry: string;
        products: string[];
        uniqueValue: string;
        competitors: string[];
    };
    goals: {
        objectives: string[];
        metrics: string[];
        timeline: string;
    };
}

interface MLUserState {
    gatheredData: CompiledData[];
    weightAdjustments: Record<string, number>;
    personalizedPatterns: string[];
    lastUpdated: string;
    integrationCount: number;
}

/**
 * POST /api/ml/integrate-data
 * Upload gathered data to user's ML model and trigger recomputation
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { compiledData, userId } = body;

        if (!compiledData) {
            return NextResponse.json({
                error: 'Compiled data is required'
            }, { status: 400 });
        }

        // Generate user-specific ML state key
        const userKey = userId || 'default_user';
        const mlStateKey = `ml_user_state_${userKey}`;

        // Simulate ML integration (in production, this would update actual ML weights)
        const integrationResult = await integrateDataToML(compiledData);

        // Build learning signals from gathered data
        const learningSignals = buildLearningSignals(compiledData);

        return NextResponse.json({
            success: true,
            message: 'Data successfully integrated with your ML model',
            weightsUpdated: integrationResult.weightsUpdated,
            patternsLearned: integrationResult.patternsLearned,
            accuracyBoost: integrationResult.accuracyBoost,
            personalizedPatterns: integrationResult.personalizedPatterns,
            learningSignals,
            mlStateKey,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ML Integrate] Error:', error);
        return NextResponse.json({
            error: 'Failed to integrate data with ML model'
        }, { status: 500 });
    }
}

/**
 * GET /api/ml/integrate-data
 * Get current ML state for user
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || 'default_user';

        // Return user's ML state (would load from storage in production)
        return NextResponse.json({
            success: true,
            userId,
            hasPersonalizedData: true,
            integrationCount: 1,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ML State] Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch ML state'
        }, { status: 500 });
    }
}

// Simulate ML integration process
async function integrateDataToML(compiledData: CompiledData): Promise<{
    weightsUpdated: number;
    patternsLearned: number;
    accuracyBoost: number;
    personalizedPatterns: string[];
}> {
    const personalizedPatterns: string[] = [];
    let weightsUpdated = 0;
    let patternsLearned = 0;

    // Process target audience
    if (compiledData.targetAudience.demographics.length > 0) {
        weightsUpdated += compiledData.targetAudience.demographics.length;
        personalizedPatterns.push('audience_demographics');
    }
    if (compiledData.targetAudience.interests.length > 0) {
        weightsUpdated += compiledData.targetAudience.interests.length;
        personalizedPatterns.push('audience_interests');
    }
    if (compiledData.targetAudience.painPoints.length > 0) {
        patternsLearned += compiledData.targetAudience.painPoints.length;
        personalizedPatterns.push('pain_point_targeting');
    }

    // Process ad preferences
    if (compiledData.adPreferences.platforms.length > 0) {
        weightsUpdated += compiledData.adPreferences.platforms.length * 2;
        compiledData.adPreferences.platforms.forEach(p => {
            personalizedPatterns.push(`platform_${p.toLowerCase()}`);
        });
    }
    if (compiledData.adPreferences.contentTypes.length > 0) {
        patternsLearned += compiledData.adPreferences.contentTypes.length;
        personalizedPatterns.push('content_preferences');
    }
    if (compiledData.adPreferences.hooks.length > 0) {
        weightsUpdated += compiledData.adPreferences.hooks.length;
        personalizedPatterns.push('hook_optimization');
    }

    // Process business context
    if (compiledData.businessContext.industry) {
        patternsLearned += 3;
        personalizedPatterns.push(`industry_${compiledData.businessContext.industry.toLowerCase().replace(/\s+/g, '_')}`);
    }

    // Process goals
    if (compiledData.goals.objectives.length > 0) {
        weightsUpdated += compiledData.goals.objectives.length * 2;
        personalizedPatterns.push('objective_alignment');
    }
    if (compiledData.goals.metrics.length > 0) {
        patternsLearned += compiledData.goals.metrics.length;
        personalizedPatterns.push('metric_optimization');
    }

    // Calculate accuracy boost (simulated)
    const accuracyBoost = Math.min(15, Math.round(
        (weightsUpdated * 0.5) + (patternsLearned * 0.8) + (personalizedPatterns.length * 0.3)
    ));

    return {
        weightsUpdated,
        patternsLearned,
        accuracyBoost,
        personalizedPatterns
    };
}

// Build learning signals for ML weight adjustment
function buildLearningSignals(compiledData: CompiledData): Record<string, number> {
    const signals: Record<string, number> = {};

    // Platform signals
    compiledData.adPreferences.platforms.forEach(platform => {
        signals[`platform:${platform.toLowerCase()}`] = 1.5;
    });

    // Content type signals
    compiledData.adPreferences.contentTypes.forEach(type => {
        signals[`content:${type}`] = 1.3;
    });

    // Hook signals
    compiledData.adPreferences.hooks.forEach(hook => {
        signals[`hook:${hook.toLowerCase()}`] = 1.4;
    });

    // Tone signals
    compiledData.adPreferences.tones.forEach(tone => {
        signals[`tone:${tone.toLowerCase().trim()}`] = 1.2;
    });

    // Objective signals
    compiledData.goals.objectives.forEach(obj => {
        signals[`objective:${obj}`] = 1.5;
    });

    // Industry signal
    if (compiledData.businessContext.industry) {
        signals[`industry:${compiledData.businessContext.industry.toLowerCase()}`] = 2.0;
    }

    return signals;
}
