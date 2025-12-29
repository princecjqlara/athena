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
    | 'research_topic'
    // New management actions
    | 'delete_ad'
    | 'delete_ads_bulk'
    | 'edit_ad'
    | 'delete_pipeline'
    | 'edit_pipeline'
    | 'add_pipeline_stage'
    | 'remove_pipeline_stage'
    | 'delete_lead'
    | 'edit_lead'
    | 'delete_trait'
    | 'edit_trait'
    | 'sort_ads'
    | 'filter_ads'
    | 'clear_all_data'
    | 'list_ads'
    | 'list_pipelines'
    | 'list_leads'
    | 'list_traits'
    | 'duplicate_ad'
    | 'archive_ad'
    | 'restore_ad'
    | 'reorder_pipeline_stages'
    | 'bulk_move_leads'
    | 'bulk_update_ads'
    | 'get_ad_details'
    | 'get_pipeline_details'
    | 'refresh_predictions';

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
    },
    // ============ NEW MANAGEMENT ACTIONS ============
    // Ad Management
    delete_ad: {
        name: 'delete_ad',
        description: 'Delete a specific ad from the system',
        requiresConfirmation: true,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to delete' }
        ]
    },
    delete_ads_bulk: {
        name: 'delete_ads_bulk',
        description: 'Delete multiple ads at once',
        requiresConfirmation: true,
        parameters: [
            { name: 'adIds', type: 'array', required: false, description: 'Array of ad IDs to delete' },
            { name: 'filter', type: 'object', required: false, description: 'Filter criteria (platform, dateRange, minScore, maxScore)' }
        ]
    },
    edit_ad: {
        name: 'edit_ad',
        description: 'Edit/update an existing ad properties',
        requiresConfirmation: true,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to edit' },
            { name: 'updates', type: 'object', required: true, description: 'Fields to update (title, description, traits, tags, etc.)' }
        ]
    },
    list_ads: {
        name: 'list_ads',
        description: 'List all ads with optional filtering',
        requiresConfirmation: false,
        parameters: [
            { name: 'limit', type: 'number', required: false, description: 'Max number of ads to return' },
            { name: 'filter', type: 'object', required: false, description: 'Filter by platform, hookType, score range, etc.' },
            { name: 'sortBy', type: 'string', required: false, description: 'Sort by: date, score, platform, title' }
        ]
    },
    get_ad_details: {
        name: 'get_ad_details',
        description: 'Get detailed information about a specific ad',
        requiresConfirmation: false,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad' }
        ]
    },
    duplicate_ad: {
        name: 'duplicate_ad',
        description: 'Create a copy of an existing ad',
        requiresConfirmation: false,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to duplicate' }
        ]
    },
    archive_ad: {
        name: 'archive_ad',
        description: 'Archive an ad (hide but not delete)',
        requiresConfirmation: true,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to archive' }
        ]
    },
    restore_ad: {
        name: 'restore_ad',
        description: 'Restore an archived ad',
        requiresConfirmation: false,
        parameters: [
            { name: 'adId', type: 'string', required: true, description: 'The ID of the ad to restore' }
        ]
    },
    sort_ads: {
        name: 'sort_ads',
        description: 'Sort ads by specified criteria',
        requiresConfirmation: false,
        parameters: [
            { name: 'sortBy', type: 'string', required: true, description: 'Field: date, score, platform, title, spend, impressions' },
            { name: 'order', type: 'string', required: false, description: 'asc or desc (default: desc)' }
        ]
    },
    filter_ads: {
        name: 'filter_ads',
        description: 'Filter ads by specific criteria',
        requiresConfirmation: false,
        parameters: [
            { name: 'platform', type: 'string', required: false, description: 'Filter by platform' },
            { name: 'hookType', type: 'string', required: false, description: 'Filter by hook type' },
            { name: 'minScore', type: 'number', required: false, description: 'Minimum success score' },
            { name: 'maxScore', type: 'number', required: false, description: 'Maximum success score' },
            { name: 'hasResults', type: 'boolean', required: false, description: 'Only ads with results' },
            { name: 'dateRange', type: 'string', required: false, description: 'last_7d, last_30d, last_90d' }
        ]
    },
    bulk_update_ads: {
        name: 'bulk_update_ads',
        description: 'Update multiple ads at once',
        requiresConfirmation: true,
        parameters: [
            { name: 'adIds', type: 'array', required: true, description: 'Array of ad IDs to update' },
            { name: 'updates', type: 'object', required: true, description: 'Fields to update on all selected ads' }
        ]
    },
    refresh_predictions: {
        name: 'refresh_predictions',
        description: 'Refresh AI predictions for all ads or specific ads',
        requiresConfirmation: false,
        parameters: [
            { name: 'adIds', type: 'array', required: false, description: 'Specific ad IDs (empty for all)' }
        ]
    },
    // Pipeline Management
    delete_pipeline: {
        name: 'delete_pipeline',
        description: 'Delete a sales pipeline',
        requiresConfirmation: true,
        parameters: [
            { name: 'pipelineId', type: 'string', required: true, description: 'The ID of the pipeline to delete' }
        ]
    },
    edit_pipeline: {
        name: 'edit_pipeline',
        description: 'Edit/rename a pipeline',
        requiresConfirmation: true,
        parameters: [
            { name: 'pipelineId', type: 'string', required: true, description: 'The ID of the pipeline' },
            { name: 'name', type: 'string', required: false, description: 'New name for the pipeline' }
        ]
    },
    add_pipeline_stage: {
        name: 'add_pipeline_stage',
        description: 'Add a new stage to a pipeline',
        requiresConfirmation: false,
        parameters: [
            { name: 'pipelineId', type: 'string', required: true, description: 'The pipeline ID' },
            { name: 'stageName', type: 'string', required: true, description: 'Name of the new stage' },
            { name: 'position', type: 'number', required: false, description: 'Position in the pipeline (0-based)' }
        ]
    },
    remove_pipeline_stage: {
        name: 'remove_pipeline_stage',
        description: 'Remove a stage from a pipeline',
        requiresConfirmation: true,
        parameters: [
            { name: 'pipelineId', type: 'string', required: true, description: 'The pipeline ID' },
            { name: 'stageName', type: 'string', required: true, description: 'Name of the stage to remove' }
        ]
    },
    reorder_pipeline_stages: {
        name: 'reorder_pipeline_stages',
        description: 'Reorder stages in a pipeline',
        requiresConfirmation: true,
        parameters: [
            { name: 'pipelineId', type: 'string', required: true, description: 'The pipeline ID' },
            { name: 'stages', type: 'array', required: true, description: 'Array of stage names in new order' }
        ]
    },
    list_pipelines: {
        name: 'list_pipelines',
        description: 'List all pipelines with their stages',
        requiresConfirmation: false,
        parameters: []
    },
    get_pipeline_details: {
        name: 'get_pipeline_details',
        description: 'Get details of a specific pipeline including leads count',
        requiresConfirmation: false,
        parameters: [
            { name: 'pipelineId', type: 'string', required: true, description: 'The pipeline ID' }
        ]
    },
    // Lead Management
    delete_lead: {
        name: 'delete_lead',
        description: 'Delete a lead from a pipeline',
        requiresConfirmation: true,
        parameters: [
            { name: 'leadId', type: 'string', required: true, description: 'The lead ID to delete' }
        ]
    },
    edit_lead: {
        name: 'edit_lead',
        description: 'Edit lead information',
        requiresConfirmation: true,
        parameters: [
            { name: 'leadId', type: 'string', required: true, description: 'The lead ID' },
            { name: 'updates', type: 'object', required: true, description: 'Fields to update (name, email, phone, notes, etc.)' }
        ]
    },
    list_leads: {
        name: 'list_leads',
        description: 'List all leads with optional filtering',
        requiresConfirmation: false,
        parameters: [
            { name: 'pipelineId', type: 'string', required: false, description: 'Filter by pipeline' },
            { name: 'stage', type: 'string', required: false, description: 'Filter by stage' },
            { name: 'limit', type: 'number', required: false, description: 'Max number to return' }
        ]
    },
    bulk_move_leads: {
        name: 'bulk_move_leads',
        description: 'Move multiple leads to a different stage',
        requiresConfirmation: true,
        parameters: [
            { name: 'leadIds', type: 'array', required: true, description: 'Array of lead IDs' },
            { name: 'targetStage', type: 'string', required: true, description: 'Target stage name or ID' }
        ]
    },
    // Trait Management
    delete_trait: {
        name: 'delete_trait',
        description: 'Delete a custom trait',
        requiresConfirmation: true,
        parameters: [
            { name: 'traitId', type: 'string', required: false, description: 'The trait ID' },
            { name: 'traitName', type: 'string', required: false, description: 'Or the trait name' }
        ]
    },
    edit_trait: {
        name: 'edit_trait',
        description: 'Edit a custom trait',
        requiresConfirmation: false,
        parameters: [
            { name: 'traitId', type: 'string', required: false, description: 'The trait ID' },
            { name: 'traitName', type: 'string', required: false, description: 'Or the trait name' },
            { name: 'updates', type: 'object', required: true, description: 'Fields to update (name, emoji, group, description)' }
        ]
    },
    list_traits: {
        name: 'list_traits',
        description: 'List all custom traits',
        requiresConfirmation: false,
        parameters: [
            { name: 'group', type: 'string', required: false, description: 'Filter by trait group' }
        ]
    },
    // System Actions
    clear_all_data: {
        name: 'clear_all_data',
        description: 'Clear all local data (ads, pipelines, patterns) - DANGEROUS',
        requiresConfirmation: true,
        parameters: [
            { name: 'confirm', type: 'string', required: true, description: 'Must type "DELETE ALL" to confirm' },
            { name: 'dataTypes', type: 'array', required: false, description: 'Specific types: ads, pipelines, traits, patterns (empty for all)' }
        ]
    }
};

// Intent patterns for natural language matching
const INTENT_PATTERNS: { pattern: RegExp; action: ActionName; extractParams?: (match: RegExpMatchArray) => Record<string, unknown> }[] = [
    // Existing patterns
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

    // Ad Management patterns
    { pattern: /delete.*ad(?!s)|remove.*ad(?!s)|trash.*ad/i, action: 'delete_ad' },
    { pattern: /delete.*ads|remove.*ads|delete.*all.*ads|bulk.*delete/i, action: 'delete_ads_bulk' },
    { pattern: /edit.*ad|update.*ad|change.*ad|modify.*ad/i, action: 'edit_ad' },
    { pattern: /list.*ads|show.*ads|all.*ads|my.*ads/i, action: 'list_ads' },
    { pattern: /ad.*details|details.*ad|get.*ad.*info/i, action: 'get_ad_details' },
    { pattern: /duplicate.*ad|copy.*ad|clone.*ad/i, action: 'duplicate_ad' },
    { pattern: /archive.*ad|hide.*ad/i, action: 'archive_ad' },
    { pattern: /restore.*ad|unarchive.*ad|unhide.*ad/i, action: 'restore_ad' },
    { pattern: /sort.*ads?|order.*ads?|arrange.*ads?/i, action: 'sort_ads' },
    { pattern: /filter.*ads?|find.*ads?|search.*ads?/i, action: 'filter_ads' },
    { pattern: /bulk.*update|update.*multiple|update.*all.*ads/i, action: 'bulk_update_ads' },
    { pattern: /refresh.*predict|recalculate.*score|update.*predict/i, action: 'refresh_predictions' },

    // Pipeline Management patterns
    { pattern: /delete.*pipeline|remove.*pipeline/i, action: 'delete_pipeline' },
    { pattern: /edit.*pipeline|rename.*pipeline|update.*pipeline/i, action: 'edit_pipeline' },
    { pattern: /add.*stage|new.*stage|create.*stage/i, action: 'add_pipeline_stage' },
    { pattern: /remove.*stage|delete.*stage/i, action: 'remove_pipeline_stage' },
    { pattern: /reorder.*stage|move.*stage|rearrange.*stage/i, action: 'reorder_pipeline_stages' },
    { pattern: /list.*pipeline|show.*pipeline|all.*pipeline/i, action: 'list_pipelines' },
    { pattern: /pipeline.*details|details.*pipeline/i, action: 'get_pipeline_details' },

    // Lead Management patterns
    { pattern: /delete.*lead|remove.*lead/i, action: 'delete_lead' },
    { pattern: /edit.*lead|update.*lead|change.*lead/i, action: 'edit_lead' },
    { pattern: /list.*lead|show.*lead|all.*lead/i, action: 'list_leads' },
    { pattern: /bulk.*move.*lead|move.*multiple.*lead/i, action: 'bulk_move_leads' },

    // Trait Management patterns
    { pattern: /delete.*trait|remove.*trait/i, action: 'delete_trait' },
    { pattern: /edit.*trait|update.*trait|modify.*trait/i, action: 'edit_trait' },
    { pattern: /list.*trait|show.*trait|all.*trait/i, action: 'list_traits' },

    // System patterns
    { pattern: /clear.*all|delete.*everything|reset.*data|wipe.*data/i, action: 'clear_all_data' },
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
    // Handle null, undefined, or empty responses
    if (!response || typeof response !== 'string' || response.trim() === '') {
        return {
            action: null,
            params: {},
            message: "I'm having trouble generating a response right now. Please try again!"
        };
    }

    const actionMatch = response.match(/\[ACTION:\s*(\w+)\]/i);
    const paramsMatch = response.match(/\[PARAMS:\s*(\{[\s\S]*?\})\]/i);
    const messageMatch = response.match(/\[MESSAGE:\s*([\s\S]*?)(?:\[|$)/i);

    if (!actionMatch) {
        // No action, just a response
        const cleanedMessage = response.replace(/\[.*?\]/g, '').trim();
        return {
            action: null,
            params: {},
            message: cleanedMessage || "I received your message but couldn't formulate a proper response. Please try asking again!"
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

    let message = messageMatch
        ? messageMatch[1].trim()
        : response.replace(/\[.*?\]/g, '').trim();

    // Ensure message is never empty
    if (!message) {
        message = `Executing ${actionName}...`;
    }

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
        // Original actions
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

        // Ad Management
        case 'delete_ad':
            return executeDeleteAd(params);
        case 'delete_ads_bulk':
            return executeDeleteAdsBulk(params);
        case 'edit_ad':
            return executeEditAd(params);
        case 'list_ads':
            return executeListAds(params);
        case 'get_ad_details':
            return executeGetAdDetails(params);
        case 'duplicate_ad':
            return executeDuplicateAd(params);
        case 'archive_ad':
            return executeArchiveAd(params);
        case 'restore_ad':
            return executeRestoreAd(params);
        case 'sort_ads':
            return executeSortAds(params);
        case 'filter_ads':
            return executeFilterAds(params);
        case 'bulk_update_ads':
            return executeBulkUpdateAds(params);
        case 'refresh_predictions':
            return executeRefreshPredictions(params);

        // Pipeline Management
        case 'delete_pipeline':
            return executeDeletePipeline(params);
        case 'edit_pipeline':
            return executeEditPipeline(params);
        case 'add_pipeline_stage':
            return executeAddPipelineStage(params);
        case 'remove_pipeline_stage':
            return executeRemovePipelineStage(params);
        case 'reorder_pipeline_stages':
            return executeReorderPipelineStages(params);
        case 'list_pipelines':
            return executeListPipelines();
        case 'get_pipeline_details':
            return executeGetPipelineDetails(params);

        // Lead Management
        case 'delete_lead':
            return executeDeleteLead(params);
        case 'edit_lead':
            return executeEditLead(params);
        case 'list_leads':
            return executeListLeads(params);
        case 'bulk_move_leads':
            return executeBulkMoveLeads(params);
        case 'move_lead':
            return executeMoveLead(params);

        // Trait Management
        case 'delete_trait':
            return executeDeleteTrait(params);
        case 'edit_trait':
            return executeEditTrait(params);
        case 'list_traits':
            return executeListTraits(params);

        // System
        case 'clear_all_data':
            return executeClearAllData(params);

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

// Create custom trait - syncs to both localStorage AND Supabase
async function executeCreateTrait(params: Record<string, unknown>): Promise<ActionResult> {
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
    const createdByAi = (params.createdByAi as boolean) ?? true;

    // Get existing custom traits from localStorage
    const customTraits = JSON.parse(localStorage.getItem('custom_traits') || '[]');

    // Check if trait already exists locally
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
        createdByAi,
        createdAt: new Date().toISOString()
    };

    // Save to localStorage first
    customTraits.push(newTrait);
    localStorage.setItem('custom_traits', JSON.stringify(customTraits));

    // Also sync to Supabase for public sharing
    try {
        const userId = localStorage.getItem('athena_user_id');
        await fetch('/api/traits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                group,
                emoji,
                description,
                userId,
                createdByAi
            })
        });
    } catch (error) {
        console.warn('Failed to sync trait to cloud:', error);
        // Continue - local save was successful
    }

    const aiLabel = createdByAi ? ' (🤖 AI Generated)' : '';
    return {
        success: true,
        message: `✅ Created custom trait "${emoji} ${name}" in group "${group}"${aiLabel}\n\n_Trait shared publicly and pending organizer approval._`,
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

// ============ NEW MANAGEMENT ACTION IMPLEMENTATIONS ============

// Ad Management Actions
function executeDeleteAd(params: Record<string, unknown>): ActionResult {
    const adId = params.adId as string;
    if (!adId) {
        return { success: false, message: 'Please provide an ad ID to delete', error: 'Missing adId' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const adIndex = ads.findIndex((a: { id: string }) => a.id === adId);

    if (adIndex === -1) {
        return { success: false, message: `Ad with ID "${adId}" not found`, error: 'Not found' };
    }

    const deletedAd = ads[adIndex];
    ads.splice(adIndex, 1);
    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `🗑️ Deleted ad "${deletedAd.extractedContent?.title || adId}"`,
        data: { deletedAd }
    };
}

function executeDeleteAdsBulk(params: Record<string, unknown>): ActionResult {
    const adIds = params.adIds as string[] | undefined;
    const filter = params.filter as { platform?: string; minScore?: number; maxScore?: number } | undefined;

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    let toDelete: string[] = [];

    if (adIds && adIds.length > 0) {
        toDelete = adIds;
    } else if (filter) {
        toDelete = ads
            .filter((ad: { id: string; extractedContent?: { platform?: string }; successScore?: number }) => {
                if (filter.platform && ad.extractedContent?.platform !== filter.platform) return false;
                if (filter.minScore !== undefined && (ad.successScore || 0) < filter.minScore) return false;
                if (filter.maxScore !== undefined && (ad.successScore || 0) > filter.maxScore) return false;
                return true;
            })
            .map((ad: { id: string }) => ad.id);
    }

    if (toDelete.length === 0) {
        return { success: false, message: 'No ads match the criteria for deletion', error: 'No matches' };
    }

    const remainingAds = ads.filter((ad: { id: string }) => !toDelete.includes(ad.id));
    localStorage.setItem('ads', JSON.stringify(remainingAds));

    return {
        success: true,
        message: `🗑️ Deleted ${toDelete.length} ads`,
        data: { deletedCount: toDelete.length, deletedIds: toDelete }
    };
}

function executeEditAd(params: Record<string, unknown>): ActionResult {
    const adId = params.adId as string;
    const updates = params.updates as Record<string, unknown>;

    if (!adId) {
        return { success: false, message: 'Please provide an ad ID to edit', error: 'Missing adId' };
    }
    if (!updates || Object.keys(updates).length === 0) {
        return { success: false, message: 'Please provide fields to update', error: 'Missing updates' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const adIndex = ads.findIndex((a: { id: string }) => a.id === adId);

    if (adIndex === -1) {
        return { success: false, message: `Ad with ID "${adId}" not found`, error: 'Not found' };
    }

    // Merge updates
    const ad = ads[adIndex];
    if (updates.title || updates.description) {
        ad.extractedContent = { ...ad.extractedContent, ...updates };
    }
    if (updates.tags) ad.tags = updates.tags;
    if (updates.notes) ad.notes = updates.notes;
    ad.updatedAt = new Date().toISOString();

    ads[adIndex] = ad;
    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `✏️ Updated ad "${ad.extractedContent?.title || adId}"`,
        data: { updatedAd: ad }
    };
}

function executeListAds(params: Record<string, unknown>): ActionResult {
    const limit = (params.limit as number) || 10;
    const sortBy = (params.sortBy as string) || 'date';

    let ads = JSON.parse(localStorage.getItem('ads') || '[]');

    // Sort
    ads.sort((a: { createdAt?: string; successScore?: number; extractedContent?: { title?: string; platform?: string } }, b: { createdAt?: string; successScore?: number; extractedContent?: { title?: string; platform?: string } }) => {
        switch (sortBy) {
            case 'score':
                return (b.successScore || 0) - (a.successScore || 0);
            case 'title':
                return (a.extractedContent?.title || '').localeCompare(b.extractedContent?.title || '');
            case 'platform':
                return (a.extractedContent?.platform || '').localeCompare(b.extractedContent?.platform || '');
            default:
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
    });

    const displayed = ads.slice(0, limit);
    const message = displayed.length > 0
        ? `📋 **Your Ads (${displayed.length} of ${ads.length}):**\n\n` +
        displayed.map((ad: { id: string; extractedContent?: { title?: string; platform?: string }; successScore?: number }, i: number) =>
            `${i + 1}. **${ad.extractedContent?.title || 'Untitled'}** (${ad.extractedContent?.platform || 'Unknown'}) - Score: ${ad.successScore || 'N/A'}%`
        ).join('\n')
        : '📋 No ads found. Import or upload ads to get started!';

    return { success: true, message, data: { ads: displayed, total: ads.length } };
}

function executeGetAdDetails(params: Record<string, unknown>): ActionResult {
    const adId = params.adId as string;
    if (!adId) {
        return { success: false, message: 'Please provide an ad ID', error: 'Missing adId' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const ad = ads.find((a: { id: string }) => a.id === adId);

    if (!ad) {
        return { success: false, message: `Ad with ID "${adId}" not found`, error: 'Not found' };
    }

    const content = ad.extractedContent || {};
    const message = `📊 **Ad Details: ${content.title || 'Untitled'}**\n\n` +
        `• **Platform:** ${content.platform || 'Unknown'}\n` +
        `• **Hook Type:** ${content.hookType || 'Unknown'}\n` +
        `• **Predicted Score:** ${ad.predictedScore || 'N/A'}%\n` +
        `• **Actual Score:** ${ad.successScore || 'N/A'}%\n` +
        `• **Created:** ${ad.createdAt || 'Unknown'}\n` +
        (content.customTraits?.length > 0 ? `• **Traits:** ${content.customTraits.join(', ')}\n` : '');

    return { success: true, message, data: { ad } };
}

function executeDuplicateAd(params: Record<string, unknown>): ActionResult {
    const adId = params.adId as string;
    if (!adId) {
        return { success: false, message: 'Please provide an ad ID to duplicate', error: 'Missing adId' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const originalAd = ads.find((a: { id: string }) => a.id === adId);

    if (!originalAd) {
        return { success: false, message: `Ad with ID "${adId}" not found`, error: 'Not found' };
    }

    const newAd = {
        ...JSON.parse(JSON.stringify(originalAd)),
        id: `ad_${Date.now()}`,
        createdAt: new Date().toISOString(),
        extractedContent: {
            ...originalAd.extractedContent,
            title: `${originalAd.extractedContent?.title || 'Untitled'} (Copy)`
        }
    };

    ads.push(newAd);
    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `📋 Duplicated ad as "${newAd.extractedContent.title}"`,
        data: { newAd }
    };
}

function executeArchiveAd(params: Record<string, unknown>): ActionResult {
    const adId = params.adId as string;
    if (!adId) {
        return { success: false, message: 'Please provide an ad ID to archive', error: 'Missing adId' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const adIndex = ads.findIndex((a: { id: string }) => a.id === adId);

    if (adIndex === -1) {
        return { success: false, message: `Ad with ID "${adId}" not found`, error: 'Not found' };
    }

    ads[adIndex].archived = true;
    ads[adIndex].archivedAt = new Date().toISOString();
    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `📦 Archived ad "${ads[adIndex].extractedContent?.title || adId}"`,
        data: { archivedAd: ads[adIndex] }
    };
}

function executeRestoreAd(params: Record<string, unknown>): ActionResult {
    const adId = params.adId as string;
    if (!adId) {
        return { success: false, message: 'Please provide an ad ID to restore', error: 'Missing adId' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const adIndex = ads.findIndex((a: { id: string }) => a.id === adId);

    if (adIndex === -1) {
        return { success: false, message: `Ad with ID "${adId}" not found`, error: 'Not found' };
    }

    delete ads[adIndex].archived;
    delete ads[adIndex].archivedAt;
    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `♻️ Restored ad "${ads[adIndex].extractedContent?.title || adId}"`,
        data: { restoredAd: ads[adIndex] }
    };
}

function executeSortAds(params: Record<string, unknown>): ActionResult {
    const sortBy = params.sortBy as string || 'date';
    const order = params.order as string || 'desc';

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');

    ads.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        let aVal: unknown, bVal: unknown;

        switch (sortBy) {
            case 'score':
                aVal = a.successScore || a.predictedScore || 0;
                bVal = b.successScore || b.predictedScore || 0;
                break;
            case 'platform':
                aVal = (a.extractedContent as Record<string, unknown>)?.platform || '';
                bVal = (b.extractedContent as Record<string, unknown>)?.platform || '';
                break;
            case 'title':
                aVal = (a.extractedContent as Record<string, unknown>)?.title || '';
                bVal = (b.extractedContent as Record<string, unknown>)?.title || '';
                break;
            case 'spend':
                aVal = a.spend || 0;
                bVal = b.spend || 0;
                break;
            case 'impressions':
                aVal = a.impressions || 0;
                bVal = b.impressions || 0;
                break;
            default:
                aVal = a.createdAt || '';
                bVal = b.createdAt || '';
        }

        if (typeof aVal === 'string') {
            const cmp = (aVal as string).localeCompare(bVal as string);
            return order === 'asc' ? cmp : -cmp;
        }
        return order === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `📊 Sorted ${ads.length} ads by ${sortBy} (${order})`,
        data: { sortedCount: ads.length }
    };
}

function executeFilterAds(params: Record<string, unknown>): ActionResult {
    const { platform, hookType, minScore, maxScore, hasResults, dateRange } = params as {
        platform?: string;
        hookType?: string;
        minScore?: number;
        maxScore?: number;
        hasResults?: boolean;
        dateRange?: string;
    };

    let ads = JSON.parse(localStorage.getItem('ads') || '[]');
    const originalCount = ads.length;

    ads = ads.filter((ad: Record<string, unknown>) => {
        const content = ad.extractedContent as Record<string, unknown> || {};

        if (platform && content.platform !== platform) return false;
        if (hookType && content.hookType !== hookType) return false;
        if (minScore !== undefined && ((ad.successScore as number) || 0) < minScore) return false;
        if (maxScore !== undefined && ((ad.successScore as number) || 0) > maxScore) return false;
        if (hasResults && !ad.successScore) return false;

        if (dateRange) {
            const now = new Date();
            const adDate = new Date(ad.createdAt as string);
            const days = { last_7d: 7, last_30d: 30, last_90d: 90 }[dateRange] || 30;
            const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            if (adDate < cutoff) return false;
        }

        return true;
    });

    const message = `🔍 Found ${ads.length} ads matching your criteria (out of ${originalCount}):\n\n` +
        ads.slice(0, 5).map((ad: Record<string, unknown>, i: number) => {
            const content = ad.extractedContent as Record<string, unknown> || {};
            return `${i + 1}. **${content.title || 'Untitled'}** - ${content.platform || 'Unknown'} (${ad.successScore || 'N/A'}%)`;
        }).join('\n') +
        (ads.length > 5 ? `\n...and ${ads.length - 5} more` : '');

    return { success: true, message, data: { filteredAds: ads, count: ads.length } };
}

function executeBulkUpdateAds(params: Record<string, unknown>): ActionResult {
    const adIds = params.adIds as string[];
    const updates = params.updates as Record<string, unknown>;

    if (!adIds || adIds.length === 0) {
        return { success: false, message: 'Please provide ad IDs to update', error: 'Missing adIds' };
    }
    if (!updates || Object.keys(updates).length === 0) {
        return { success: false, message: 'Please provide fields to update', error: 'Missing updates' };
    }

    const ads = JSON.parse(localStorage.getItem('ads') || '[]');
    let updatedCount = 0;

    ads.forEach((ad: Record<string, unknown>) => {
        if (adIds.includes(ad.id as string)) {
            if (updates.tags) ad.tags = updates.tags;
            if (updates.notes) ad.notes = updates.notes;
            ad.updatedAt = new Date().toISOString();
            updatedCount++;
        }
    });

    localStorage.setItem('ads', JSON.stringify(ads));

    return {
        success: true,
        message: `✏️ Updated ${updatedCount} ads`,
        data: { updatedCount }
    };
}

async function executeRefreshPredictions(params: Record<string, unknown>): Promise<ActionResult> {
    const adIds = params.adIds as string[] | undefined;
    const ads = JSON.parse(localStorage.getItem('ads') || '[]');

    const toRefresh = adIds
        ? ads.filter((ad: { id: string }) => adIds.includes(ad.id))
        : ads;

    return {
        success: true,
        message: `🔄 Prediction refresh queued for ${toRefresh.length} ads. This may take a moment...`,
        data: { queuedCount: toRefresh.length }
    };
}

// Pipeline Management Actions
function executeDeletePipeline(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string;
    if (!pipelineId) {
        return { success: false, message: 'Please provide a pipeline ID', error: 'Missing pipelineId' };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const pipelineIndex = pipelines.findIndex((p: { id: string }) => p.id === pipelineId);

    if (pipelineIndex === -1) {
        return { success: false, message: `Pipeline "${pipelineId}" not found`, error: 'Not found' };
    }

    const deleted = pipelines[pipelineIndex];
    pipelines.splice(pipelineIndex, 1);
    localStorage.setItem('pipelines', JSON.stringify(pipelines));

    return {
        success: true,
        message: `🗑️ Deleted pipeline "${deleted.name}"`,
        data: { deletedPipeline: deleted }
    };
}

function executeEditPipeline(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string;
    const newName = params.name as string;

    if (!pipelineId) {
        return { success: false, message: 'Please provide a pipeline ID', error: 'Missing pipelineId' };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const pipelineIndex = pipelines.findIndex((p: { id: string }) => p.id === pipelineId);

    if (pipelineIndex === -1) {
        return { success: false, message: `Pipeline "${pipelineId}" not found`, error: 'Not found' };
    }

    if (newName) pipelines[pipelineIndex].name = newName;
    pipelines[pipelineIndex].updatedAt = new Date().toISOString();
    localStorage.setItem('pipelines', JSON.stringify(pipelines));

    return {
        success: true,
        message: `✏️ Updated pipeline to "${pipelines[pipelineIndex].name}"`,
        data: { updatedPipeline: pipelines[pipelineIndex] }
    };
}

function executeAddPipelineStage(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string;
    const stageName = params.stageName as string;
    const position = params.position as number | undefined;

    if (!pipelineId || !stageName) {
        return { success: false, message: 'Please provide pipeline ID and stage name', error: 'Missing required params' };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const pipelineIndex = pipelines.findIndex((p: { id: string }) => p.id === pipelineId);

    if (pipelineIndex === -1) {
        return { success: false, message: `Pipeline "${pipelineId}" not found`, error: 'Not found' };
    }

    const pipeline = pipelines[pipelineIndex];
    if (!pipeline.stages) pipeline.stages = [];

    if (position !== undefined && position >= 0 && position <= pipeline.stages.length) {
        pipeline.stages.splice(position, 0, stageName);
    } else {
        pipeline.stages.push(stageName);
    }

    localStorage.setItem('pipelines', JSON.stringify(pipelines));

    return {
        success: true,
        message: `➕ Added stage "${stageName}" to pipeline "${pipeline.name}"`,
        data: { pipeline }
    };
}

function executeRemovePipelineStage(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string;
    const stageName = params.stageName as string;

    if (!pipelineId || !stageName) {
        return { success: false, message: 'Please provide pipeline ID and stage name', error: 'Missing required params' };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const pipelineIndex = pipelines.findIndex((p: { id: string }) => p.id === pipelineId);

    if (pipelineIndex === -1) {
        return { success: false, message: `Pipeline "${pipelineId}" not found`, error: 'Not found' };
    }

    const pipeline = pipelines[pipelineIndex];
    const stageIndex = pipeline.stages?.indexOf(stageName);

    if (stageIndex === -1 || stageIndex === undefined) {
        return { success: false, message: `Stage "${stageName}" not found in pipeline`, error: 'Not found' };
    }

    pipeline.stages.splice(stageIndex, 1);
    localStorage.setItem('pipelines', JSON.stringify(pipelines));

    return {
        success: true,
        message: `➖ Removed stage "${stageName}" from pipeline "${pipeline.name}"`,
        data: { pipeline }
    };
}

function executeReorderPipelineStages(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string;
    const stages = params.stages as string[];

    if (!pipelineId || !stages) {
        return { success: false, message: 'Please provide pipeline ID and new stage order', error: 'Missing required params' };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const pipelineIndex = pipelines.findIndex((p: { id: string }) => p.id === pipelineId);

    if (pipelineIndex === -1) {
        return { success: false, message: `Pipeline "${pipelineId}" not found`, error: 'Not found' };
    }

    pipelines[pipelineIndex].stages = stages;
    localStorage.setItem('pipelines', JSON.stringify(pipelines));

    return {
        success: true,
        message: `🔄 Reordered stages in pipeline "${pipelines[pipelineIndex].name}"`,
        data: { pipeline: pipelines[pipelineIndex] }
    };
}

function executeListPipelines(): ActionResult {
    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');

    if (pipelines.length === 0) {
        return { success: true, message: '📋 No pipelines found. Create one to get started!', data: { pipelines: [] } };
    }

    const message = `📋 **Your Pipelines (${pipelines.length}):**\n\n` +
        pipelines.map((p: { name: string; stages?: string[]; id: string }, i: number) =>
            `${i + 1}. **${p.name}** - ${p.stages?.length || 0} stages`
        ).join('\n');

    return { success: true, message, data: { pipelines } };
}

function executeGetPipelineDetails(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string;
    if (!pipelineId) {
        return { success: false, message: 'Please provide a pipeline ID', error: 'Missing pipelineId' };
    }

    const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
    const pipeline = pipelines.find((p: { id: string }) => p.id === pipelineId);

    if (!pipeline) {
        return { success: false, message: `Pipeline "${pipelineId}" not found`, error: 'Not found' };
    }

    const message = `📊 **Pipeline: ${pipeline.name}**\n\n` +
        `**Stages:**\n${pipeline.stages?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') || 'No stages'}\n\n` +
        `**Created:** ${pipeline.createdAt || 'Unknown'}`;

    return { success: true, message, data: { pipeline } };
}

// Lead Management Actions
function executeDeleteLead(params: Record<string, unknown>): ActionResult {
    const leadId = params.leadId as string;
    if (!leadId) {
        return { success: false, message: 'Please provide a lead ID', error: 'Missing leadId' };
    }

    const leads = JSON.parse(localStorage.getItem('leads') || '[]');
    const leadIndex = leads.findIndex((l: { id: string }) => l.id === leadId);

    if (leadIndex === -1) {
        return { success: false, message: `Lead "${leadId}" not found`, error: 'Not found' };
    }

    const deleted = leads[leadIndex];
    leads.splice(leadIndex, 1);
    localStorage.setItem('leads', JSON.stringify(leads));

    return {
        success: true,
        message: `🗑️ Deleted lead "${deleted.name || leadId}"`,
        data: { deletedLead: deleted }
    };
}

function executeEditLead(params: Record<string, unknown>): ActionResult {
    const leadId = params.leadId as string;
    const updates = params.updates as Record<string, unknown>;

    if (!leadId) {
        return { success: false, message: 'Please provide a lead ID', error: 'Missing leadId' };
    }

    const leads = JSON.parse(localStorage.getItem('leads') || '[]');
    const leadIndex = leads.findIndex((l: { id: string }) => l.id === leadId);

    if (leadIndex === -1) {
        return { success: false, message: `Lead "${leadId}" not found`, error: 'Not found' };
    }

    leads[leadIndex] = { ...leads[leadIndex], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem('leads', JSON.stringify(leads));

    return {
        success: true,
        message: `✏️ Updated lead "${leads[leadIndex].name || leadId}"`,
        data: { updatedLead: leads[leadIndex] }
    };
}

function executeListLeads(params: Record<string, unknown>): ActionResult {
    const pipelineId = params.pipelineId as string | undefined;
    const stage = params.stage as string | undefined;
    const limit = (params.limit as number) || 20;

    let leads = JSON.parse(localStorage.getItem('leads') || '[]');

    if (pipelineId) {
        leads = leads.filter((l: { pipelineId?: string }) => l.pipelineId === pipelineId);
    }
    if (stage) {
        leads = leads.filter((l: { stage?: string }) => l.stage === stage);
    }

    const displayed = leads.slice(0, limit);
    const message = displayed.length > 0
        ? `📋 **Leads (${displayed.length} of ${leads.length}):**\n\n` +
        displayed.map((l: { name?: string; email?: string; stage?: string }, i: number) =>
            `${i + 1}. **${l.name || 'Unknown'}** - ${l.email || 'No email'} (${l.stage || 'Unknown stage'})`
        ).join('\n')
        : '📋 No leads found.';

    return { success: true, message, data: { leads: displayed, total: leads.length } };
}

function executeBulkMoveLeads(params: Record<string, unknown>): ActionResult {
    const leadIds = params.leadIds as string[];
    const targetStage = params.targetStage as string;

    if (!leadIds || leadIds.length === 0) {
        return { success: false, message: 'Please provide lead IDs', error: 'Missing leadIds' };
    }
    if (!targetStage) {
        return { success: false, message: 'Please provide target stage', error: 'Missing targetStage' };
    }

    const leads = JSON.parse(localStorage.getItem('leads') || '[]');
    let movedCount = 0;

    leads.forEach((lead: { id: string; stage?: string }) => {
        if (leadIds.includes(lead.id)) {
            lead.stage = targetStage;
            movedCount++;
        }
    });

    localStorage.setItem('leads', JSON.stringify(leads));

    return {
        success: true,
        message: `📦 Moved ${movedCount} leads to "${targetStage}"`,
        data: { movedCount }
    };
}

function executeMoveLead(params: Record<string, unknown>): ActionResult {
    const leadId = params.leadId as string;
    const stageId = params.stageId as string;

    if (!leadId || !stageId) {
        return { success: false, message: 'Please provide lead ID and target stage', error: 'Missing params' };
    }

    const leads = JSON.parse(localStorage.getItem('leads') || '[]');
    const leadIndex = leads.findIndex((l: { id: string }) => l.id === leadId);

    if (leadIndex === -1) {
        return { success: false, message: `Lead "${leadId}" not found`, error: 'Not found' };
    }

    leads[leadIndex].stage = stageId;
    leads[leadIndex].updatedAt = new Date().toISOString();
    localStorage.setItem('leads', JSON.stringify(leads));

    return {
        success: true,
        message: `📦 Moved lead "${leads[leadIndex].name || leadId}" to "${stageId}"`,
        data: { lead: leads[leadIndex] }
    };
}

// Trait Management Actions
function executeDeleteTrait(params: Record<string, unknown>): ActionResult {
    const traitId = params.traitId as string | undefined;
    const traitName = params.traitName as string | undefined;

    if (!traitId && !traitName) {
        return { success: false, message: 'Please provide trait ID or name', error: 'Missing identifier' };
    }

    const traits = JSON.parse(localStorage.getItem('custom_traits') || '[]');
    const traitIndex = traits.findIndex((t: { id: string; name: string }) =>
        t.id === traitId || t.name.toLowerCase() === traitName?.toLowerCase()
    );

    if (traitIndex === -1) {
        return { success: false, message: 'Trait not found', error: 'Not found' };
    }

    const deleted = traits[traitIndex];
    traits.splice(traitIndex, 1);
    localStorage.setItem('custom_traits', JSON.stringify(traits));

    return {
        success: true,
        message: `🗑️ Deleted trait "${deleted.emoji || ''} ${deleted.name}"`,
        data: { deletedTrait: deleted }
    };
}

function executeEditTrait(params: Record<string, unknown>): ActionResult {
    const traitId = params.traitId as string | undefined;
    const traitName = params.traitName as string | undefined;
    const updates = params.updates as Record<string, unknown>;

    if (!traitId && !traitName) {
        return { success: false, message: 'Please provide trait ID or name', error: 'Missing identifier' };
    }

    const traits = JSON.parse(localStorage.getItem('custom_traits') || '[]');
    const traitIndex = traits.findIndex((t: { id: string; name: string }) =>
        t.id === traitId || t.name.toLowerCase() === traitName?.toLowerCase()
    );

    if (traitIndex === -1) {
        return { success: false, message: 'Trait not found', error: 'Not found' };
    }

    traits[traitIndex] = { ...traits[traitIndex], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem('custom_traits', JSON.stringify(traits));

    return {
        success: true,
        message: `✏️ Updated trait "${traits[traitIndex].emoji || ''} ${traits[traitIndex].name}"`,
        data: { updatedTrait: traits[traitIndex] }
    };
}

function executeListTraits(params: Record<string, unknown>): ActionResult {
    const group = params.group as string | undefined;
    let traits = JSON.parse(localStorage.getItem('custom_traits') || '[]');

    if (group) {
        traits = traits.filter((t: { group?: string }) => t.group?.toLowerCase() === group.toLowerCase());
    }

    if (traits.length === 0) {
        return { success: true, message: '📋 No custom traits found.', data: { traits: [] } };
    }

    const message = `📋 **Custom Traits (${traits.length}):**\n\n` +
        traits.map((t: { emoji?: string; name: string; group?: string }, i: number) =>
            `${i + 1}. ${t.emoji || '✨'} **${t.name}** (${t.group || 'Custom'})`
        ).join('\n');

    return { success: true, message, data: { traits } };
}

// System Actions
function executeClearAllData(params: Record<string, unknown>): ActionResult {
    const confirm = params.confirm as string;
    const dataTypes = params.dataTypes as string[] | undefined;

    if (confirm !== 'DELETE ALL') {
        return {
            success: false,
            message: '⚠️ This action requires confirmation. Please say "DELETE ALL" to confirm.',
            error: 'Confirmation required'
        };
    }

    const typesToClear = dataTypes || ['ads', 'pipelines', 'leads', 'traits', 'patterns'];
    const cleared: string[] = [];

    if (typesToClear.includes('ads')) {
        localStorage.removeItem('ads');
        cleared.push('ads');
    }
    if (typesToClear.includes('pipelines')) {
        localStorage.removeItem('pipelines');
        cleared.push('pipelines');
    }
    if (typesToClear.includes('leads')) {
        localStorage.removeItem('leads');
        cleared.push('leads');
    }
    if (typesToClear.includes('traits')) {
        localStorage.removeItem('custom_traits');
        cleared.push('traits');
    }
    if (typesToClear.includes('patterns')) {
        localStorage.removeItem('ml_trait_patterns');
        cleared.push('patterns');
    }

    return {
        success: true,
        message: `🗑️ Cleared all data: ${cleared.join(', ')}`,
        data: { clearedTypes: cleared }
    };
}

export default {
    AGENT_ACTIONS,
    parseIntent,
    getActionsContext,
    parseAIResponse,
    executeAction
};
