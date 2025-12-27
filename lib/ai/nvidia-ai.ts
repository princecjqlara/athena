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

// ============================================
// POOL AUTO-CATEGORIZATION
// ============================================

export interface PoolCategorizationResult {
    industry: string | null;
    platform: string | null;
    target_audience: string | null;
    creative_format: string | null;
    confidence: number;
}

// Valid category values (must match marketplace filters)
const VALID_INDUSTRIES = ['ecommerce', 'saas', 'finance', 'health', 'local_services'];
const VALID_PLATFORMS = ['tiktok', 'facebook', 'instagram', 'youtube', 'multi'];
const VALID_AUDIENCES = ['gen_z', 'millennials', 'b2b', 'high_income', 'parents'];
const VALID_FORMATS = ['ugc', 'testimonial', 'product_demo', 'founder_led', 'meme'];

/**
 * Auto-categorize a data pool based on its name and description
 * Uses NVIDIA AI to intelligently suggest categories
 */
export async function autoCategorizePool(
    name: string,
    description?: string
): Promise<PoolCategorizationResult> {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
        console.warn('NVIDIA API key not configured, using heuristic categorization');
        return heuristicCategorization(name, description);
    }

    const prompt = `Analyze this data pool and categorize it for an advertising insights marketplace.

Data Pool Name: "${name}"
${description ? `Description: "${description}"` : ''}

Based on the name and description, determine the most appropriate categories. You MUST use ONLY these exact values:

Industries (choose one): ${VALID_INDUSTRIES.join(', ')}
Platforms (choose one): ${VALID_PLATFORMS.join(', ')}
Target Audiences (choose one): ${VALID_AUDIENCES.join(', ')}
Creative Formats (choose one): ${VALID_FORMATS.join(', ')}

Return a JSON object with this exact structure:
{
  "industry": "<industry value or null if unclear>",
  "platform": "<platform value or null if unclear>",
  "target_audience": "<audience value or null if unclear>",
  "creative_format": "<format value or null if unclear>",
  "confidence": <number 0-100 indicating how confident you are in these categorizations>
}

If the name/description doesn't clearly indicate a category, use null for that field.`;

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
                        content: 'You are an expert at categorizing advertising and marketing content. Analyze data pool names and descriptions to determine their industry, platform, audience, and creative format. Always respond with valid JSON using only the allowed category values.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 256,
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

        const result = JSON.parse(jsonMatch[0]);

        // Validate and sanitize the results
        return {
            industry: VALID_INDUSTRIES.includes(result.industry) ? result.industry : null,
            platform: VALID_PLATFORMS.includes(result.platform) ? result.platform : null,
            target_audience: VALID_AUDIENCES.includes(result.target_audience) ? result.target_audience : null,
            creative_format: VALID_FORMATS.includes(result.creative_format) ? result.creative_format : null,
            confidence: typeof result.confidence === 'number' ? Math.min(100, Math.max(0, result.confidence)) : 50,
        };
    } catch (error) {
        console.error('AI categorization error:', error);
        return heuristicCategorization(name, description);
    }
}

/**
 * Fallback heuristic categorization when AI is unavailable
 */
function heuristicCategorization(name: string, description?: string): PoolCategorizationResult {
    const text = `${name} ${description || ''}`.toLowerCase();

    // Industry detection
    let industry: string | null = null;
    if (text.includes('ecommerce') || text.includes('e-commerce') || text.includes('shop') || text.includes('store') || text.includes('retail')) {
        industry = 'ecommerce';
    } else if (text.includes('saas') || text.includes('software') || text.includes('app') || text.includes('tech')) {
        industry = 'saas';
    } else if (text.includes('finance') || text.includes('bank') || text.includes('invest') || text.includes('money') || text.includes('crypto')) {
        industry = 'finance';
    } else if (text.includes('health') || text.includes('wellness') || text.includes('fitness') || text.includes('medical') || text.includes('supplement')) {
        industry = 'health';
    } else if (text.includes('local') || text.includes('service') || text.includes('restaurant') || text.includes('plumber') || text.includes('contractor')) {
        industry = 'local_services';
    }

    // Platform detection
    let platform: string | null = null;
    if (text.includes('tiktok') || text.includes('tik tok')) {
        platform = 'tiktok';
    } else if (text.includes('facebook') || text.includes('fb') || text.includes('meta')) {
        platform = 'facebook';
    } else if (text.includes('instagram') || text.includes('ig ') || text.includes('insta')) {
        platform = 'instagram';
    } else if (text.includes('youtube') || text.includes('yt ')) {
        platform = 'youtube';
    } else if (text.includes('multi') || text.includes('cross-platform') || text.includes('all platform')) {
        platform = 'multi';
    }

    // Audience detection
    let target_audience: string | null = null;
    if (text.includes('gen z') || text.includes('genz') || text.includes('18-25') || text.includes('young')) {
        target_audience = 'gen_z';
    } else if (text.includes('millennial') || text.includes('26-40')) {
        target_audience = 'millennials';
    } else if (text.includes('b2b') || text.includes('business') || text.includes('enterprise') || text.includes('professional')) {
        target_audience = 'b2b';
    } else if (text.includes('high income') || text.includes('luxury') || text.includes('premium') || text.includes('affluent')) {
        target_audience = 'high_income';
    } else if (text.includes('parent') || text.includes('mom') || text.includes('dad') || text.includes('family') || text.includes('kid')) {
        target_audience = 'parents';
    }

    // Format detection
    let creative_format: string | null = null;
    if (text.includes('ugc') || text.includes('user generated') || text.includes('creator')) {
        creative_format = 'ugc';
    } else if (text.includes('testimonial') || text.includes('review') || text.includes('customer story')) {
        creative_format = 'testimonial';
    } else if (text.includes('demo') || text.includes('product') || text.includes('showcase') || text.includes('how to')) {
        creative_format = 'product_demo';
    } else if (text.includes('founder') || text.includes('ceo') || text.includes('owner') || text.includes('personal brand')) {
        creative_format = 'founder_led';
    } else if (text.includes('meme') || text.includes('trend') || text.includes('viral') || text.includes('funny')) {
        creative_format = 'meme';
    }

    // Calculate confidence based on how many categories were detected
    const detectedCount = [industry, platform, target_audience, creative_format].filter(Boolean).length;
    const confidence = detectedCount * 20 + 10; // 10-90 based on detections

    return {
        industry,
        platform,
        target_audience,
        creative_format,
        confidence,
    };
}
