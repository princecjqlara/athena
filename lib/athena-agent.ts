/**
 * Athena Agent - Agentic AI System
 * Enables Athena to execute tasks, not just answer questions
 */

export type ActionName =
    | 'import_ads'
    | 'analyze_ad'
    | 'predict_score'
    | 'create_pipeline'
    | 'move_lead'
    | 'add_result'
    | 'sync_data'
    | 'export_data'
    | 'show_insights'
    | 'show_patterns'
    | 'recommend_creative'
    | 'create_trait'
    | 'search_trends'
    | 'research_topic';

export interface AgentAction {
    name: ActionName;
    description: string;
    requiresConfirmation: boolean;
    parameters: { name: string; type: string; required: boolean; description: string }[];
    execute: (params: Record<string, unknown>) => Promise<ActionResult>;
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
}

export interface ParsedIntent {
    action: ActionName | null;
    parameters: Record<string, unknown>;
    confidence: number;
    requiresConfirmation: boolean;
    confirmationMessage?: string;
}

// Action Registry
export const AGENT_ACTIONS: Record<ActionName, Omit<AgentAction, 'execute'>> = {
    import_ads: {
        name: 'import_ads',
        description: 'Import ads from Facebook to analyze',
        requiresConfirmation: false,
        parameters: [
            { name: 'datePreset', type: 'string', required: false, description: 'Date range like last_7d, last_30d' }
        ]
    },
    analyze_ad: {
        name: 'analyze_ad',
        description: 'Analyze a specific ad for insights',
        requiresConfirmation: false,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to analyze' }
        ]
    },
    predict_score: {
        name: 'predict_score',
        description: 'Predict success score for an ad',
        requiresConfirmation: false,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to predict' }
        ]
    },
    create_pipeline: {
        name: 'create_pipeline',
        description: 'Create a new sales pipeline',
        requiresConfirmation: true,
        parameters: [
            { name: 'name', type: 'string', required: true, description: 'Name of the pipeline' },
            { name: 'stages', type: 'array', required: false, description: 'Pipeline stages' }
        ]
    },
    move_lead: {
        name: 'move_lead',
        description: 'Move a lead to a different pipeline stage',
        requiresConfirmation: true,
        parameters: [
            { name: 'leadId', type: 'string', required: true, description: 'The lead ID' },
            { name: 'stageId', type: 'string', required: true, description: 'Target stage ID' }
        ]
    },
    add_result: {
        name: 'add_result',
        description: 'Add performance results to an ad',
        requiresConfirmation: true,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ad ID' },
            { name: 'metrics', type: 'object', required: true, description: 'Performance metrics' }
        ]
    },
    sync_data: {
        name: 'sync_data',
        description: 'Sync local data to cloud',
        requiresConfirmation: false,
        parameters: []
    },
    export_data: {
        name: 'export_data',
        description: 'Export ads or analytics data',
        requiresConfirmation: false,
        parameters: [
            { name: 'type', type: 'string', required: true, description: 'Type: ads, analytics, pipelines' }
        ]
    },
    show_insights: {
        name: 'show_insights',
        description: 'Show insights about ads or performance',
        requiresConfirmation: false,
        parameters: [
            { name: 'topic', type: 'string', required: false, description: 'Specific topic to analyze' }
        ]
    },
    show_patterns: {
        name: 'show_patterns',
        description: 'Show learned patterns from ad performance',
        requiresConfirmation: false,
        parameters: []
    },
    recommend_creative: {
        name: 'recommend_creative',
        description: 'Recommend creative elements for new ads',
        requiresConfirmation: false,
        parameters: [
            { name: 'objective', type: 'string', required: false, description: 'Campaign objective' }
        ]
    },
    create_trait: {
        name: 'create_trait',
        description: 'Create a custom trait or trait group for ad categorization',
        requiresConfirmation: false,
        parameters: [
            { name: 'name', type: 'string', required: true, description: 'Name of the trait' },
            { name: 'group', type: 'string', required: false, description: 'Trait group (e.g. Custom, Visual Style)' },
            { name: 'description', type: 'string', required: false, description: 'Description of the trait' },
            { name: 'emoji', type: 'string', required: false, description: 'Emoji icon for the trait' }
        ]
    },
    search_trends: {
        name: 'search_trends',
        description: 'Search the web for current advertising and marketing trends',
        requiresConfirmation: false,
        parameters: [
            { name: 'query', type: 'string', required: true, description: 'Search query for trends' },
            { name: 'platform', type: 'string', required: false, description: 'Platform like TikTok, Instagram, Facebook' }
        ]
    },
    research_topic: {
        name: 'research_topic',
        description: 'Research a specific advertising topic and provide insights',
        requiresConfirmation: false,
        parameters: [
            { name: 'topic', type: 'string', required: true, description: 'Topic to research' }
        ]
    }
};

// Intent patterns for natural language matching
const INTENT_PATTERNS: { pattern: RegExp; action: ActionName; extractParams?: (match: RegExpMatchArray) => Record<string, unknown> }[] = [
    { pattern: /import|fetch|get|pull.*ads?.*facebook|fb/i, action: 'import_ads' },
    { pattern: /sync|backup|save.*cloud/i, action: 'sync_data' },
    { pattern: /analyze|examine|look at.*ad/i, action: 'analyze_ad' },
    { pattern: /predict|score|forecast.*ad/i, action: 'predict_score' },
    { pattern: /create.*pipeline/i, action: 'create_pipeline' },
    { pattern: /move.*lead/i, action: 'move_lead' },
    { pattern: /add.*result|update.*result/i, action: 'add_result' },
    { pattern: /export|download.*data/i, action: 'export_data' },
    { pattern: /show.*pattern|what.*work|best.*perform/i, action: 'show_patterns' },
    { pattern: /insight|analytic|stat/i, action: 'show_insights' },
    { pattern: /recommend|suggest|what.*create|next.*ad/i, action: 'recommend_creative' },
    { pattern: /create.*trait|add.*trait|new.*trait|custom.*trait/i, action: 'create_trait' },
    { pattern: /trend|trending|what.*hot|popular.*now/i, action: 'search_trends' },
    { pattern: /research|deep.*dive|learn.*about|study/i, action: 'research_topic' },
];

/**
 * Parse user message to detect intent and extract parameters
 */
export function parseIntent(message: string): ParsedIntent {
    const lowerMessage = message.toLowerCase();

    for (const { pattern, action, extractParams } of INTENT_PATTERNS) {
        if (pattern.test(lowerMessage)) {
            const match = lowerMessage.match(pattern);
            const actionDef = AGENT_ACTIONS[action];

            return {
                action,
                parameters: extractParams && match ? extractParams(match) : {},
                confidence: 0.8,
                requiresConfirmation: actionDef.requiresConfirmation,
                confirmationMessage: actionDef.requiresConfirmation
                    ? `I'll ${actionDef.description.toLowerCase()}. Should I proceed?`
                    : undefined
            };
        }
    }

    // No action detected - just a question
    return {
        action: null,
        parameters: {},
        confidence: 0,
        requiresConfirmation: false
    };
}

/**
 * Format available actions for AI context
 */
export function getActionsContext(): string {
    const actions = Object.values(AGENT_ACTIONS).map(a =>
        `- ${a.name}: ${a.description}${a.requiresConfirmation ? ' (requires confirmation)' : ''}`
    ).join('\n');

    return `You can execute the following actions when the user asks:
${actions}

When you detect that the user wants to perform an action, respond with:
[ACTION: action_name]
[PARAMS: {"param": "value"}]
[MESSAGE: Your explanation to the user]

If the action requires confirmation, ask the user first. If you're just answering a question, respond normally without action tags.`;
}

/**
 * Parse AI response for action commands
 */
export function parseAIResponse(response: string): {
    action: ActionName | null;
    params: Record<string, unknown>;
    message: string;
} {
    const actionMatch = response.match(/\[ACTION:\s*(\w+)\]/i);
    const paramsMatch = response.match(/\[PARAMS:\s*(\{[\s\S]*?\})\]/i);
    const messageMatch = response.match(/\[MESSAGE:\s*([\s\S]*?)(?:\[|$)/i);

    if (!actionMatch) {
        // No action, just a response
        return {
            action: null,
            params: {},
            message: response.replace(/\[.*?\]/g, '').trim()
        };
    }

    const actionName = actionMatch[1] as ActionName;
    let params = {};

    if (paramsMatch) {
        try {
            params = JSON.parse(paramsMatch[1]);
        } catch {
            params = {};
        }
    }

    const message = messageMatch
        ? messageMatch[1].trim()
        : response.replace(/\[.*?\]/g, '').trim();

    return {
        action: actionName in AGENT_ACTIONS ? actionName : null,
        params,
        message
    };
}

/**
 * Execute action on client side
 * Returns result to display to user
 */
export async function executeAction(
    action: ActionName,
    params: Record<string, unknown>
): Promise<ActionResult> {
    switch (action) {
        case 'import_ads':
            return executeImportAds(params);
        case 'sync_data':
            return executeSyncData();
        case 'show_patterns':
            return executeShowPatterns();
        case 'show_insights':
            return executeShowInsights(params);
        case 'recommend_creative':
            return executeRecommendCreative(params);
        case 'export_data':
            return executeExportData(params);
        case 'create_pipeline':
            return executeCreatePipeline(params);
        case 'create_trait':
            return executeCreateTrait(params);
        case 'search_trends':
            return executeSearchTrends(params);
        case 'research_topic':
            return executeResearchTopic(params);
        default:
            return {
                success: false,
                message: `Action ${action} is not yet implemented`,
                error: 'Not implemented'
            };
    }
}

// Action implementations
async function executeImportAds(params: Record<string, unknown>): Promise<ActionResult> {
    try {
        const token = localStorage.getItem('fb_access_token');
        const adAccountId = localStorage.getItem('fb_selected_ad_account');

        if (!token || !adAccountId) {
            return {
                success: false,
                message: 'Please connect your Facebook account first in Settings',
                error: 'Not authenticated'
            };
        }

        const datePreset = (params.datePreset as string) || 'last_30d';
        const response = await fetch(`/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${token}&datePreset=${datePreset}`);
        const data = await response.json();

        if (data.success && data.data) {
            return {
                success: true,
                message: `✅ Imported ${data.data.length} ads from Facebook!`,
                data: data.data
            };
        }

        return {
            success: false,
            message: data.error || 'Failed to import ads',
            error: data.error
        };
    } catch (error) {
        return {
            success: false,
            message: 'Error importing ads. Please check your connection.',
            error: String(error)
        };
    }
}

async function executeSyncData(): Promise<ActionResult> {
    try {
        const userId = localStorage.getItem('athena_user_id');
        if (!userId) {
            return {
                success: false,
                message: 'Please log in first to sync data',
                error: 'Not authenticated'
            };
        }

        const ads = JSON.parse(localStorage.getItem('ads') || '[]');
        const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');

        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ads, pipelines })
        });

        const data = await response.json();

        return {
            success: data.success,
            message: data.success ? '✅ Data synced to cloud!' : 'Sync failed',
            data: data
        };
    } catch (error) {
        return {
            success: false,
            message: 'Error syncing data',
            error: String(error)
        };
    }
}

function executeShowPatterns(): ActionResult {
    try {
        const patterns = localStorage.getItem('ml_trait_patterns');
        if (!patterns) {
            return {
                success: true,
                message: 'No patterns learned yet. Add more ads with results to discover patterns!',
                data: []
            };
        }

        const parsed = JSON.parse(patterns);
        const topPatterns = Object.values(parsed)
            .filter((p: any) => p.occurrences >= 3)
            .sort((a: any, b: any) => b.avgSuccessScore - a.avgSuccessScore)
            .slice(0, 5);

        if (topPatterns.length === 0) {
            return {
                success: true,
                message: 'Need more data to identify reliable patterns. Keep adding ads!',
                data: []
            };
        }

        const message = '📊 Top performing patterns:\n' +
            topPatterns.map((p: any, i: number) =>
                `${i + 1}. ${p.traits.join(' + ')}: ${p.avgSuccessScore.toFixed(1)}% success (${p.occurrences} ads)`
            ).join('\n');

        return {
            success: true,
            message,
            data: topPatterns
        };
    } catch {
        return {
            success: false,
            message: 'Error loading patterns',
            error: 'Parse error'
        };
    }
}

function executeShowInsights(params: Record<string, unknown>): ActionResult {
    const ads = JSON.parse(localStorage.getItem('ads') || '[]');

    if (ads.length === 0) {
        return {
            success: true,
            message: 'No ads yet. Import or upload ads to see insights!',
            data: {}
        };
    }

    // Calculate basic insights
    const platforms: Record<string, number> = {};
    const hookTypes: Record<string, { count: number; totalScore: number }> = {};
    let totalScore = 0;
    let scoredAds = 0;

    ads.forEach((ad: any) => {
        const content = ad.extractedContent || {};
        if (content.platform) {
            platforms[content.platform] = (platforms[content.platform] || 0) + 1;
        }
        if (content.hookType) {
            if (!hookTypes[content.hookType]) {
                hookTypes[content.hookType] = { count: 0, totalScore: 0 };
            }
            hookTypes[content.hookType].count++;
            if (ad.successScore) {
                hookTypes[content.hookType].totalScore += ad.successScore;
            }
        }
        if (ad.successScore) {
            totalScore += ad.successScore;
            scoredAds++;
        }
    });

    const avgScore = scoredAds > 0 ? (totalScore / scoredAds).toFixed(1) : 'N/A';

    const message = `📈 Quick Insights:
• Total ads: ${ads.length}
• Average success score: ${avgScore}%
• Top platform: ${Object.entries(platforms).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
• Most used hook: ${Object.entries(hookTypes).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || 'N/A'}`;

    return {
        success: true,
        message,
        data: { platforms, hookTypes, avgScore, totalAds: ads.length }
    };
}

function executeRecommendCreative(params: Record<string, unknown>): ActionResult {
    const patterns = localStorage.getItem('ml_trait_patterns');
    const ads = JSON.parse(localStorage.getItem('ads') || '[]');

    // Get top patterns
    let topPatterns: string[] = [];
    if (patterns) {
        const parsed = JSON.parse(patterns);
        topPatterns = Object.values(parsed)
            .filter((p: any) => p.occurrences >= 3 && p.avgSuccessScore >= 70)
            .sort((a: any, b: any) => b.avgSuccessScore - a.avgSuccessScore)
            .slice(0, 3)
            .flatMap((p: any) => p.traits);
    }

    const recommendations = [
        '🎯 Based on your data, here are recommendations:',
        '',
        topPatterns.length > 0
            ? `✅ **Winning traits**: ${[...new Set(topPatterns)].join(', ')}`
            : '💡 Add more ads with results to get personalized recommendations',
        '',
        '📱 **Platform**: TikTok/Instagram Reels tend to perform well',
        '🎬 **Hook**: Curiosity or Problem-Solution hooks convert best',
        '🎨 **Style**: UGC/authentic content outperforms polished ads',
        '⏱️ **Duration**: 15-30 seconds is the sweet spot',
    ];

    return {
        success: true,
        message: recommendations.join('\n'),
        data: { topPatterns }
    };
}

function executeExportData(params: Record<string, unknown>): ActionResult {
    const type = (params.type as string) || 'ads';

    let data: unknown;
    let filename: string;

    switch (type) {
        case 'ads':
            data = JSON.parse(localStorage.getItem('ads') || '[]');
            filename = 'athena_ads_export.json';
            break;
        case 'pipelines':
            data = JSON.parse(localStorage.getItem('pipelines') || '[]');
            filename = 'athena_pipelines_export.json';
            break;
        case 'patterns':
            data = JSON.parse(localStorage.getItem('ml_trait_patterns') || '{}');
            filename = 'athena_patterns_export.json';
            break;
        default:
            return {
                success: false,
                message: 'Unknown export type. Use: ads, pipelines, or patterns',
                error: 'Invalid type'
            };
    }

    // Trigger download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    return {
        success: true,
        message: `✅ Exported ${type} data to ${filename}`,
        data: { filename, recordCount: Array.isArray(data) ? data.length : Object.keys(data as object).length }
    };
}

function executeCreatePipeline(params: Record<string, unknown>): ActionResult {
    const name = params.name as string;
    if (!name) {
        return {
            success: false,
            message: 'Please provide a name for the pipeline',
            error: 'Missing name'
        };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const newPipeline = {
        id: `pipeline_${Date.now()}`,
        name,
        stages: (params.stages as string[]) || ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'],
        createdAt: new Date().toISOString()
    };

    pipelines.push(newPipeline);
    localStorage.setItem('pipelines', JSON.stringify(pipelines));

    return {
        success: true,
        message: `✅ Created pipeline "${name}" with ${newPipeline.stages.length} stages`,
        data: newPipeline
    };
}

// Create custom trait
function executeCreateTrait(params: Record<string, unknown>): ActionResult {
    const name = params.name as string;
    if (!name) {
        return {
            success: false,
            message: 'Please provide a name for the trait',
            error: 'Missing name'
        };
    }

    const group = (params.group as string) || 'Custom';
    const description = (params.description as string) || `Custom trait: ${name}`;
    const emoji = (params.emoji as string) || '✨';

    // Get existing custom traits from localStorage
    const customTraits = JSON.parse(localStorage.getItem('custom_traits') || '[]');

    // Check if trait already exists
    const exists = customTraits.some((t: { name: string }) =>
        t.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
        return {
            success: false,
            message: `Trait "${name}" already exists`,
            error: 'Duplicate trait'
        };
    }

    const newTrait = {
        id: `trait_${Date.now()}`,
        name,
        group,
        description,
        emoji,
        createdAt: new Date().toISOString()
    };

    customTraits.push(newTrait);
    localStorage.setItem('custom_traits', JSON.stringify(customTraits));

    return {
        success: true,
        message: `✅ Created custom trait "${emoji} ${name}" in group "${group}"`,
        data: newTrait
    };
}

// Search web for ad trends
async function executeSearchTrends(params: Record<string, unknown>): Promise<ActionResult> {
    const query = params.query as string;
    const platform = params.platform as string;

    if (!query) {
        return {
            success: false,
            message: 'Please specify what trends you want to search for',
            error: 'Missing query'
        };
    }

    try {
        const searchQuery = platform
            ? `${query} ${platform} advertising trends 2024`
            : `${query} digital advertising trends 2024`;

        const response = await fetch('/api/ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery, type: 'trends' })
        });

        const data = await response.json();

        if (data.success && data.results) {
            const trendsSummary = data.results.slice(0, 5).map((r: { title: string; snippet: string }, i: number) =>
                `${i + 1}. **${r.title}**: ${r.snippet}`
            ).join('\n\n');

            return {
                success: true,
                message: `🔥 **Trending in ${platform || 'Digital Advertising'}:**\n\n${trendsSummary}`,
                data: data.results
            };
        }

        // Fallback with general knowledge
        return {
            success: true,
            message: `📊 **Current Trends for "${query}":**\n\n` +
                `1. **Short-form Video**: TikTok and Reels dominating engagement\n` +
                `2. **UGC Content**: User-generated content outperforming polished ads\n` +
                `3. **AI-Generated**: AI tools for ad creation growing 300%\n` +
                `4. **Interactive Ads**: Polls, quizzes increasing CTR by 40%\n` +
                `5. **Authenticity**: Raw, unfiltered content resonating more`,
            data: { query, fallback: true }
        };
    } catch (error) {
        // Return general trends knowledge
        return {
            success: true,
            message: `📊 **General Ad Trends for "${query}":**\n\n` +
                `• Short-form video content is king (15-30 seconds)\n` +
                `• UGC and authentic content outperforms polished ads\n` +
                `• Hook within first 3 seconds is critical\n` +
                `• Mobile-first design is essential\n` +
                `• Emotional storytelling drives conversions`,
            data: { query, error: String(error) }
        };
    }
}

// Research a specific advertising topic
async function executeResearchTopic(params: Record<string, unknown>): Promise<ActionResult> {
    const topic = params.topic as string;

    if (!topic) {
        return {
            success: false,
            message: 'Please specify what topic you want to research',
            error: 'Missing topic'
        };
    }

    try {
        const response = await fetch('/api/ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `${topic} advertising best practices strategy`, type: 'research' })
        });

        const data = await response.json();

        if (data.success && data.summary) {
            return {
                success: true,
                message: `📚 **Research: ${topic}**\n\n${data.summary}`,
                data: data
            };
        }

        // Fallback with AI-generated research
        return {
            success: true,
            message: `📚 **Research: ${topic}**\n\n` +
                `Based on advertising industry knowledge:\n\n` +
                `• **Best Practices**: Test multiple creatives, A/B test messaging\n` +
                `• **Audience**: Define clear buyer personas before launching\n` +
                `• **Budget**: Start with small tests, scale winners aggressively\n` +
                `• **Metrics**: Focus on ROAS, not just engagement metrics\n` +
                `• **Creative**: Refresh creatives every 2-3 weeks to avoid fatigue`,
            data: { topic, fallback: true }
        };
    } catch (error) {
        return {
            success: true,
            message: `📚 **Research: ${topic}**\n\n` +
                `Key considerations:\n` +
                `• Test multiple angles and hooks\n` +
                `• Match creative to platform norms\n` +
                `• Build social proof in ads\n` +
                `• Use clear CTAs`,
            data: { topic, error: String(error) }
        };
    }
}

export default {
    AGENT_ACTIONS,
    parseIntent,
    getActionsContext,
    parseAIResponse,
    executeAction
};
