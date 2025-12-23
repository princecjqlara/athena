// NVIDIA AI API integration for GPT-powered predictions
// Using NVIDIA NIM API with GPT OSS 120B model

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

interface AdAnalysisRequest {
    hookType: string;
    contentCategory: string;
    editingStyle: string;
    platform: string;
    features: {
        hasSubtitles: boolean;
        hasTextOverlays: boolean;
        isUGC: boolean;
        hasVoiceover: boolean;
    };
    historicalData?: {
        totalVideos: number;
        avgCtr: number;
        avgRoas: number;
        topPatterns: string[];
    };
}

interface PredictionResponse {
    successProbability: number;
    confidence: number;
    keyFactors: {
        name: string;
        impact: 'positive' | 'negative' | 'neutral';
        weight: number;
    }[];
    recommendations: string[];
    reasoning: string;
}

interface PatternAnalysis {
    patterns: {
        pattern: string;
        successRate: number;
        frequency: number;
        description: string;
    }[];
    insights: string[];
}

// Get prediction from NVIDIA AI
export async function getAIPrediction(
    request: AdAnalysisRequest
): Promise<PredictionResponse> {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
        console.warn('NVIDIA API key not configured, using heuristic prediction');
        return getHeuristicPrediction(request);
    }

    const prompt = buildPredictionPrompt(request);

    try {
        const response = await fetch(NVIDIA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'nvidia/llama-3.1-nemotron-70b-instruct',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert AI advertising analyst specializing in video ad performance prediction. 
            You analyze ad characteristics and predict success rates based on industry data and patterns.
            Always respond with valid JSON in the exact format requested.
            Base your predictions on proven advertising principles and platform-specific best practices.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            throw new Error(`NVIDIA API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error('Empty response from AI');
        }

        // Parse the JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('AI prediction error:', error);
        return getHeuristicPrediction(request);
    }
}

// Analyze patterns from historical data
export async function analyzePatterns(
    videos: Array<{
        hookType: string;
        contentCategory: string;
        editingStyle: string;
        platform: string;
        ctr: number;
        roas: number;
        successScore: number;
    }>
): Promise<PatternAnalysis> {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey || videos.length < 3) {
        return {
            patterns: [],
            insights: ['Upload more videos to discover winning patterns'],
        };
    }

    const prompt = `Analyze these video ad performance data and identify winning patterns:

${JSON.stringify(videos, null, 2)}

Return a JSON object with this exact structure:
{
  "patterns": [
    {
      "pattern": "Pattern description (e.g., 'UGC + Curiosity Hook')",
      "successRate": 85,
      "frequency": 5,
      "description": "Why this pattern works"
    }
  ],
  "insights": ["Key insight 1", "Key insight 2"]
}`;

    try {
        const response = await fetch(NVIDIA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'nvidia/llama-3.1-nemotron-70b-instruct',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert advertising analyst. Analyze video ad data and identify winning patterns. Respond only with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            throw new Error(`NVIDIA API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        const jsonMatch = content?.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Pattern analysis error:', error);
        return {
            patterns: [],
            insights: ['Unable to analyze patterns at this time'],
        };
    }
}

// Generate recommendations for a new video
export async function getVideoRecommendations(
    currentConfig: AdAnalysisRequest,
    historicalData: Array<{ hookType: string; ctr: number; roas: number }>
): Promise<string[]> {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
        return getDefaultRecommendations(currentConfig);
    }

    const prompt = `Based on this planned video configuration and historical data, provide specific recommendations:

Planned Video:
- Hook Type: ${currentConfig.hookType}
- Content Category: ${currentConfig.contentCategory}
- Editing Style: ${currentConfig.editingStyle}
- Platform: ${currentConfig.platform}
- Features: ${JSON.stringify(currentConfig.features)}

Historical Performance (top performers):
${JSON.stringify(historicalData.slice(0, 5), null, 2)}

Return a JSON array of 4-5 specific, actionable recommendations. Example:
["Use trending audio for higher engagement", "Add subtitles - 80% of viewers watch without sound"]`;

    try {
        const response = await fetch(NVIDIA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'nvidia/llama-3.1-nemotron-70b-instruct',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert video advertising consultant. Provide specific, actionable recommendations. Respond only with a JSON array of strings.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.5,
                max_tokens: 512,
            }),
        });

        if (!response.ok) {
            throw new Error(`NVIDIA API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        const jsonMatch = content?.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return getDefaultRecommendations(currentConfig);
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Recommendations error:', error);
        return getDefaultRecommendations(currentConfig);
    }
}

// Fallback heuristic prediction when API is unavailable
function getHeuristicPrediction(request: AdAnalysisRequest): PredictionResponse {
    let score = 50;
    const factors: PredictionResponse['keyFactors'] = [];

    // Hook type scoring
    const hookScores: Record<string, number> = {
        curiosity: 15,
        shock: 12,
        question: 10,
        'before-after': 14,
        story: 8,
        testimonial: 11,
    };
    const hookBonus = hookScores[request.hookType.toLowerCase()] || 8;
    score += hookBonus;
    factors.push({
        name: `${request.hookType} Hook`,
        impact: hookBonus > 10 ? 'positive' : 'neutral',
        weight: hookBonus / 20,
    });

    // Platform scoring
    const platformScores: Record<string, number> = {
        tiktok: 12,
        instagram: 10,
        youtube: 8,
        facebook: 6,
    };
    const platformBonus = platformScores[request.platform.toLowerCase()] || 7;
    score += platformBonus;
    factors.push({
        name: `${request.platform} Platform`,
        impact: platformBonus > 8 ? 'positive' : 'neutral',
        weight: platformBonus / 15,
    });

    // Feature bonuses
    if (request.features.hasSubtitles) {
        score += 8;
        factors.push({ name: 'Subtitles', impact: 'positive', weight: 0.4 });
    }
    if (request.features.isUGC) {
        score += 10;
        factors.push({ name: 'UGC Style', impact: 'positive', weight: 0.5 });
    }
    if (request.features.hasTextOverlays) {
        score += 5;
        factors.push({ name: 'Text Overlays', impact: 'positive', weight: 0.25 });
    }

    // Cap score
    score = Math.min(95, Math.max(20, score));

    return {
        successProbability: score,
        confidence: request.historicalData ? 70 : 40,
        keyFactors: factors,
        recommendations: getDefaultRecommendations(request),
        reasoning: 'Prediction based on industry benchmarks and selected features.',
    };
}

function getDefaultRecommendations(request: AdAnalysisRequest): string[] {
    const recommendations: string[] = [];

    if (!request.features.hasSubtitles) {
        recommendations.push('Add subtitles - 85% of social media videos are watched without sound');
    }
    if (!request.features.isUGC) {
        recommendations.push('Consider UGC-style content for higher authenticity and engagement');
    }
    if (request.platform.toLowerCase() === 'tiktok' && request.editingStyle !== 'fast-cuts') {
        recommendations.push('Use fast-paced editing with quick cuts for better TikTok performance');
    }
    if (request.hookType === 'story') {
        recommendations.push('Front-load the most engaging content - viewers decide in first 3 seconds');
    }

    recommendations.push('Test multiple hook variations to find the best performer');
    recommendations.push('Launch during evening hours (6-9 PM) for optimal engagement');

    return recommendations.slice(0, 5);
}

function buildPredictionPrompt(request: AdAnalysisRequest): string {
    return `Analyze this video ad configuration and predict its success probability:

Video Configuration:
- Hook Type: ${request.hookType}
- Content Category: ${request.contentCategory}
- Editing Style: ${request.editingStyle}
- Target Platform: ${request.platform}
- Has Subtitles: ${request.features.hasSubtitles}
- Has Text Overlays: ${request.features.hasTextOverlays}
- UGC Style: ${request.features.isUGC}
- Has Voiceover: ${request.features.hasVoiceover}

${request.historicalData ? `Historical Performance Data:
- Total Videos Analyzed: ${request.historicalData.totalVideos}
- Average CTR: ${request.historicalData.avgCtr}%
- Average ROAS: ${request.historicalData.avgRoas}x
- Top Performing Patterns: ${request.historicalData.topPatterns.join(', ')}` : 'No historical data available yet.'}

Return a JSON object with exactly this structure:
{
  "successProbability": <number 0-100>,
  "confidence": <number 0-100>,
  "keyFactors": [
    {"name": "<factor name>", "impact": "<positive|negative|neutral>", "weight": <0-1>}
  ],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],
  "reasoning": "<brief explanation of the prediction>"
}`;
}
