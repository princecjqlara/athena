import { NextRequest, NextResponse } from 'next/server';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'NVIDIA API key not configured', fallback: true },
        { status: 200 }
      );
    }

    let prompt = '';
    let systemMessage = '';

    switch (action) {
      case 'predict':
        systemMessage = `You are an expert AI advertising analyst specializing in video ad performance prediction. 
        Analyze ad characteristics and predict success rates based on industry data and patterns.
        Always respond with valid JSON in the exact format requested.`;
        prompt = buildPredictionPrompt(data);
        break;

      case 'parse_ad_traits':
        systemMessage = `You are an expert AI advertising analyst. Extract ad traits from natural language descriptions.
        Identify the hook type, editing style, content category, platform, and various features from user descriptions.
        Always respond with valid JSON. Be thorough in your analysis and make reasonable inferences.`;
        prompt = buildTraitExtractionPrompt(data.description);
        break;

      case 'analyze-patterns':
        systemMessage = 'You are an expert advertising analyst. Analyze video ad data and identify winning patterns. Respond only with valid JSON.';
        prompt = buildPatternPrompt(data);
        break;

      case 'recommendations':
        systemMessage = 'You are an expert video advertising consultant. Provide specific, actionable recommendations. Respond only with a JSON array of strings.';
        prompt = buildRecommendationsPrompt(data);
        break;

      case 'parse-content':
        // Use custom prompt if provided (from organizer prompts), otherwise use default
        // Also include learned traits if provided
        const learnedTraitsSection = data.learnedTraits?.length > 0
          ? `\n\nADDITIONAL COMMUNITY LEARNED TRAITS TO EXTRACT:\n${data.learnedTraits.map((t: { trait_name: string; definition: string }) => `- ${t.trait_name}: ${t.definition}`).join('\n')}\n`
          : '';

        if (data.customPrompt) {
          systemMessage = `You are an expert ad analyst. Extract all ad attributes from user descriptions using the provided prompt template.
          Always respond with valid JSON containing all identified attributes.
          Be thorough - extract every detail mentioned and infer reasonable defaults for missing fields.`;
          prompt = `${data.customPrompt}${learnedTraitsSection}

Ad/Content to analyze:
"${data.rawText}"

Respond with valid JSON only.`;
        } else {
          systemMessage = `You are an expert ad analyst. Extract all ad attributes from user descriptions.
          Always respond with valid JSON containing all identified attributes.
          Be thorough - extract every detail mentioned and infer reasonable defaults for missing fields.`;
          prompt = buildContentParsingPrompt(data.rawText) + learnedTraitsSection;
        }
        break;

      case 'parse-results':
        systemMessage = `You are an expert ad performance analyst. Extract all metrics from performance descriptions.
        Calculate CTR, ROAS, and success scores. Always respond with valid JSON.`;
        prompt = buildResultsParsingPrompt(data.rawText);
        break;

      case 'analyze-mindmap':
        systemMessage = `You are an expert data analyst specializing in ad performance patterns.
        Analyze all ads and generate a categorized mind map structure showing patterns and correlations.
        Identify which trait combinations lead to success.`;
        prompt = buildMindMapPrompt(data.ads);
        break;

      case 'discover-features':
        systemMessage = `You are an expert at finding hidden patterns in successful ads.
        Analyze this ad that performed unexpectedly well (or poorly) and discover NEW patterns or features
        that weren't explicitly tracked. Look for subtle elements that might have contributed to success.
        Be creative - look for color patterns, timing patterns, word choices, visual compositions, etc.`;
        prompt = buildFeatureDiscoveryPrompt(data.adContent, data.adResults, data.reason);
        break;

      case 'chat':
        // Enhanced agentic AI system prompt with full management capabilities
        systemMessage = `You are Athena AI, an expert advertising strategist and analyst assistant with FULL MANAGEMENT CAPABILITIES.
You have access to the user's complete ad database and can help them:
- Analyze what's working and what's not
- Recommend what type of creatives to make next
- Explain performance patterns
- Answer questions about their ads
- **Execute ANY task** - add, remove, edit, sort, filter, manage EVERYTHING

## 🚀 FULL AGENTIC CAPABILITIES

### 📊 AD MANAGEMENT
- import_ads: Import ads from Facebook (datePreset: last_7d, last_30d, etc.)
- list_ads: List all ads with filtering/sorting (limit, sortBy: date/score/platform/title)
- get_ad_details: Get details of a specific ad (adId required)
- edit_ad: Update an ad's properties (adId, updates object)
- delete_ad: Delete a specific ad (adId required) ⚠️
- delete_ads_bulk: Delete multiple ads (adIds array or filter criteria) ⚠️
- duplicate_ad: Create a copy of an ad (adId required)
- archive_ad: Archive an ad (adId required) ⚠️
- restore_ad: Restore an archived ad (adId required)
- sort_ads: Sort ads by criteria (sortBy: date/score/platform/spend/impressions, order: asc/desc)
- filter_ads: Filter ads (platform, hookType, minScore, maxScore, hasResults, dateRange)
- bulk_update_ads: Update multiple ads at once (adIds, updates) ⚠️
- refresh_predictions: Recalculate AI predictions (adIds optional)
- analyze_ad: Analyze a specific ad for insights
- predict_score: Predict success score for an ad

### 📈 PIPELINE MANAGEMENT
- create_pipeline: Create new pipeline (name, stages array) ⚠️
- list_pipelines: List all pipelines
- get_pipeline_details: Get pipeline details (pipelineId)
- edit_pipeline: Rename/update pipeline (pipelineId, name) ⚠️
- delete_pipeline: Delete a pipeline (pipelineId) ⚠️
- add_pipeline_stage: Add stage to pipeline (pipelineId, stageName, position)
- remove_pipeline_stage: Remove stage (pipelineId, stageName) ⚠️
- reorder_pipeline_stages: Reorder stages (pipelineId, stages array) ⚠️

### 👥 LEAD MANAGEMENT
- list_leads: List leads (pipelineId, stage, limit)
- edit_lead: Update lead info (leadId, updates) ⚠️
- delete_lead: Delete a lead (leadId) ⚠️
- move_lead: Move lead to different stage (leadId, stageId) ⚠️
- bulk_move_leads: Move multiple leads (leadIds, targetStage) ⚠️

### 🏷️ TRAIT MANAGEMENT
- create_trait: Create custom trait (name, group, emoji, description)
- list_traits: List all custom traits (group filter optional)
- edit_trait: Update trait (traitId or traitName, updates)
- delete_trait: Delete custom trait (traitId or traitName) ⚠️

### 🔧 SYSTEM ACTIONS
- sync_data: Sync local data to cloud
- export_data: Export data (type: ads, pipelines, patterns)
- show_insights: Show insights about ads/performance
- show_patterns: Show learned patterns
- recommend_creative: Recommend creative elements
- search_trends: Search current advertising trends (query, platform)
- research_topic: Research specific advertising topic (topic)
- clear_all_data: Clear all data (confirm: "DELETE ALL", dataTypes) ⚠️⚠️⚠️

## 📝 HOW TO RESPOND

1. **For questions**: Answer normally with specific insights from their data.

2. **For action requests**: When the user wants you to DO something, respond with:
   [ACTION: action_name]
   [PARAMS: {"param": "value"}]
   [MESSAGE: Your explanation to the user]

3. **For ⚠️ actions**: These are destructive/critical. Ask for confirmation first unless the user explicitly confirms.

## 💡 EXAMPLES

User: "Delete all my low-performing ads"
Response:
[ACTION: delete_ads_bulk]
[PARAMS: {"filter": {"maxScore": 30}}]
[MESSAGE: I'll delete all ads with a success score below 30%. This will affect X ads. Should I proceed?

User: "Sort my ads by score"
Response:
[ACTION: sort_ads]
[PARAMS: {"sortBy": "score", "order": "desc"}]
[MESSAGE: 📊 Sorting your ads by success score from highest to lowest.

User: "Show me my pipelines"
Response:
[ACTION: list_pipelines]
[PARAMS: {}]
[MESSAGE: Here are your sales pipelines:

Be conversational, helpful, and reference their actual data. You have FULL CONTROL - you can do ANYTHING they ask!`;
        prompt = buildChatPrompt(data.message, data.context, data.history);
        return await handleChatResponse(prompt, systemMessage, apiKey);

      case 'search-orbs':
        // AI-powered semantic search for orbs/ads
        systemMessage = `You are an intelligent ad search assistant. Analyze the user's natural language query and find matching ads/orbs.
        Understand intent like: "high CTR ads", "video content", "UGC style", "best performing", "low cost", etc.
        Return matching node IDs ranked by relevance with explanations.`;
        prompt = buildOrbSearchPrompt(data.query, data.nodes);
        break;

      case 'analyze-metrics':
        systemMessage = `You are an expert Facebook advertising analyst. Analyze raw Facebook metrics and provide:
        - Human-readable labels for every action type
        - Performance assessments (good/average/poor) based on industry benchmarks
        - A clear summary of what's working and what needs improvement
        Always respond with valid JSON.`;
        prompt = buildMetricsAnalysisPrompt(data.metrics, data.adName);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NVIDIA API error:', errorText);
      return NextResponse.json(
        { error: 'AI service error', fallback: true },
        { status: 200 }
      );
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'Empty AI response', fallback: true },
        { status: 200 }
      );
    }

    // Extract JSON from response
    const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Invalid AI response format', fallback: true },
        { status: 200 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, data: parsed });

  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: 'AI service error', fallback: true },
      { status: 200 }
    );
  }
}

function buildPredictionPrompt(data: {
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
}): string {
  return `Analyze this video ad configuration and predict its success probability:

Video Configuration:
- Hook Type: ${data.hookType}
- Content Category: ${data.contentCategory}
- Editing Style: ${data.editingStyle}
- Target Platform: ${data.platform}
- Has Subtitles: ${data.features.hasSubtitles}
- Has Text Overlays: ${data.features.hasTextOverlays}
- UGC Style: ${data.features.isUGC}
- Has Voiceover: ${data.features.hasVoiceover}

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

function buildTraitExtractionPrompt(description: string): string {
  return `Extract ad traits from this natural language description of an ad:

"${description}"

Analyze the description and identify all relevant ad traits. Make reasonable inferences based on context clues.

Return a JSON object with exactly this structure (use the most appropriate value for each field):
{
  "hookType": "curiosity" | "shock" | "before_after" | "question" | "story",
  "editingStyle": "raw_authentic" | "fast_cuts" | "dynamic" | "cinematic",
  "contentCategory": "ugc" | "testimonial" | "lifestyle" | "product_demo",
  "platform": "tiktok" | "instagram" | "youtube" | "facebook",
  "hasSubtitles": true | false,
  "hasTextOverlays": true | false,
  "isUGCStyle": true | false,
  "hasVoiceover": true | false,
  "musicType": "trending" | "upbeat" | "emotional" | "voiceover_only" | "original",
  "colorScheme": "vibrant" | "muted" | "dark" | "bright" | "natural",
  "numberOfActors": <number>,
  "confidence": <0-100 how confident you are in the extraction>,
  "reasoning": "<brief explanation of your analysis>"
}

Important guidelines:
- "hookType": What grabs attention first (curiosity = makes viewer want to know more, shock = surprising/unexpected, before_after = transformation, question = asks a question, story = narrative-driven)
- "editingStyle": How the video is cut (raw_authentic = minimal editing, fast_cuts = quick transitions, dynamic = energetic with effects, cinematic = polished/professional)
- "contentCategory": Type of content (ugc = user-generated content, testimonial = customer review/story, lifestyle = aspirational, product_demo = showing how product works)
- Default to common high-performing traits if unclear (tiktok, ugc, curiosity, raw_authentic, subtitles: true)`;
}

function buildPatternPrompt(videos: Array<{
  hookType: string;
  ctr: number;
  roas: number;
  successScore: number;
}>): string {
  return `Analyze these video ad performance data and identify winning patterns:

${JSON.stringify(videos, null, 2)}

Return a JSON object with this exact structure:
{
  "patterns": [
    {
      "pattern": "Pattern description",
      "successRate": 85,
      "frequency": 5,
      "description": "Why this pattern works"
    }
  ],
  "insights": ["Key insight 1", "Key insight 2"]
}`;
}

function buildRecommendationsPrompt(data: {
  config: { hookType: string; platform: string; features: Record<string, boolean> };
  history: Array<{ hookType: string; ctr: number }>;
}): string {
  return `Based on this planned video configuration and historical data, provide specific recommendations:

Planned Video:
${JSON.stringify(data.config, null, 2)}

Historical Performance:
${JSON.stringify(data.history?.slice(0, 5) || [], null, 2)}

Return a JSON array of 4-5 specific, actionable recommendations.`;
}

function buildContentParsingPrompt(rawText: string): string {
  return `You are an expert ad analyst. Extract ALL attributes from this ad description and identify MISSING DATA that would improve analysis.

"${rawText}"

EXTRACT ALL OF THESE METRICS (use null if not mentioned, infer when possible):

BASIC INFO:
- title, description, mediaType (video/photo/carousel), aspectRatio, duration, adFormat, industryVertical

CREATIVE INTELLIGENCE:
- hookType, hookText, hookVelocity (instant/gradual/delayed), hookKeywords (attention-grabbing words)
- contentCategory, editingStyle
- patternType (problem_solution/social_proof/fomo/authority/storytelling/comparison/demonstration)

SENTIMENT ANALYSIS:
- overallSentiment (positive/negative/neutral/mixed)
- emotionalTone (inspiring/urgent/calm/exciting/serious/humorous)

VISUAL ANALYSIS:
- facePresence, numberOfFaces, facialEmotion (happy/neutral/surprised/serious/excited)
- hasTextOverlays, textOverlayRatio (minimal/moderate/heavy), textReadability
- colorScheme, colorTemperature (warm/cool/neutral)
- brandVisualTiming (early/middle/end/throughout), safeZoneAdherence
- visualAudioMismatch, hasSubtitles, subtitleStyle

AUDIO ANALYSIS:
- musicType, bpm (slow/medium/fast/variable)
- hasVoiceover, voiceoverStyle (professional/casual/energetic/calm)
- silenceDetection (intentional silence?), audioPeakTiming (hook/middle/cta/throughout)

SCRIPT & COPY:
- script, painPointAddressing, painPoints[], cta, ctaText, ctaStrength (weak/moderate/strong)
- headlines[], readabilityScore (simple/moderate/complex)

PERFORMANCE PREDICTORS:
- retentionCurveSlope (steep_drop/gradual_decline/flat/hook_spike)
- preFlightScore (0-100 optimization score), preFlightNotes[]
- conceptDrift (has creative deviated from proven patterns?)

ADVANCED VISUAL ANALYTICS:
- saliencyMapScore (0-100 - how well key elements draw attention)
- sceneVelocity (static/slow/moderate/fast/chaotic - pace of scene changes)
- textToBackgroundContrast (poor/adequate/good/excellent)
- shotComposition (rule_of_thirds/centered/symmetrical/dynamic/close_up/wide/mixed)
- semanticCongruence (do visuals match the message?)
- moodMatching (does audio mood match visual mood?)

BRAND CONSISTENCY:
- logoConsistency (absent/subtle/prominent/intrusive)
- logoTiming (intro/throughout/outro/none)
- brandColorUsage (none/accent/dominant)

VOICE & AUDIO AUTHORITY:
- voiceAuthorityScore (0-100 - confidence/authority of voiceover)
- voiceGender (male/female/neutral/multiple/none)
- voiceAge (young/middle/mature/varied)
- speechPace (slow/moderate/fast/varied)

ENGAGEMENT TRIGGERS:
- curiosityGap (creates desire to know more?)
- socialProofElements[] (testimonials, reviews, numbers)
- urgencyTriggers[] (limited time, scarcity)
- trustSignals[] (guarantees, certifications)

TALENT:
- numberOfActors, talentType, isUGCStyle

AI-DISCOVERED INSIGHTS:
- Look for ANY other patterns, traits, or insights not covered above
- Add your own discovered metrics with name, value, importance (low/medium/high), and description
- Be creative and thorough - discover what makes this ad unique!

IMPORTANT: Identify what's MISSING for better analysis!

Return JSON:
{
  "title": "Brief title",
  "description": "One sentence",
  "mediaType": "video|photo|carousel",
  "aspectRatio": "9:16|1:1|4:5|16:9|other",
  "duration": null,
  "durationCategory": "under_15s|15_30s|30_60s|over_60s|null",
  "adFormat": "static|video|carousel|story",
  "platform": "<platform>",
  "placement": "<placement>",
  "industryVertical": "e.g. beauty, tech, fitness",
  "hookType": "<hook_type>",
  "hookText": "The hook text",
  "hookVelocity": "instant|gradual|delayed",
  "hookKeywords": ["attention", "grabbing", "words"],
  "contentCategory": "<category>",
  "editingStyle": "<style>",
  "patternType": "<pattern>",
  "overallSentiment": "positive|negative|neutral|mixed",
  "emotionalTone": "<tone>",
  "facePresence": true|false,
  "numberOfFaces": 1,
  "facialEmotion": "<emotion>",
  "hasTextOverlays": true|false,
  "textOverlayRatio": "minimal|moderate|heavy",
  "textReadability": "easy|moderate|difficult",
  "colorScheme": "<color>",
  "colorTemperature": "warm|cool|neutral",
  "brandVisualTiming": "early|middle|end|throughout",
  "safeZoneAdherence": true|false,
  "visualAudioMismatch": false,
  "visualStyle": [],
  "hasSubtitles": true|false,
  "subtitleStyle": "default|animated|highlighted|minimal",
  "musicType": "<music>",
  "bpm": "slow|medium|fast|variable",
  "hasVoiceover": true|false,
  "voiceoverStyle": "professional|casual|energetic|calm",
  "silenceDetection": false,
  "audioPeakTiming": "hook|middle|cta|throughout",
  "audioDescription": "",
  "script": "Full script if provided",
  "painPointAddressing": true|false,
  "painPoints": ["pain point 1"],
  "cta": "<cta_type>",
  "ctaText": "CTA text",
  "ctaStrength": "weak|moderate|strong",
  "headlines": [],
  "readabilityScore": "simple|moderate|complex",
  "retentionCurveSlope": "steep_drop|gradual_decline|flat|hook_spike",
  "preFlightScore": 75,
  "preFlightNotes": ["Strong hook", "Missing subtitles"],
  "conceptDrift": false,
  "saliencyMapScore": 75,
  "sceneVelocity": "static|slow|moderate|fast|chaotic",
  "textToBackgroundContrast": "poor|adequate|good|excellent",
  "shotComposition": "rule_of_thirds|centered|symmetrical|dynamic|close_up|wide|mixed",
  "semanticCongruence": true,
  "moodMatching": true,
  "logoConsistency": "absent|subtle|prominent|intrusive",
  "logoTiming": "intro|throughout|outro|none",
  "brandColorUsage": "none|accent|dominant",
  "voiceAuthorityScore": 70,
  "voiceGender": "male|female|neutral|multiple|none",
  "voiceAge": "young|middle|mature|varied",
  "speechPace": "slow|moderate|fast|varied",
  "curiosityGap": true,
  "socialProofElements": ["testimonials", "reviews", "statistics"],
  "urgencyTriggers": ["limited time", "scarcity"],
  "trustSignals": ["guarantee", "certification"],
  "numberOfActors": 1,
  "talentType": "ugc_creator|influencer|model|none|multiple",
  "isUGCStyle": true|false,
  "customTraits": ["any other notable traits"],
  "aiDiscoveredMetrics": [{"name": "unique_metric_name", "value": "value", "importance": "high", "description": "Why this matters"}],
  "aiInsights": ["Unique AI observations about this ad not covered by standard metrics"],
  "missingDataFields": ["List fields user should provide for better analysis"],
  "suggestions": ["Specific suggestions for user to improve their data"],
  "extractionConfidence": <0-100>
}`;
}


function buildResultsParsingPrompt(rawText: string): string {
  return `Extract all performance metrics from this results description:

"${rawText}"

Calculate:
- CTR = clicks / impressions * 100
- ROAS = revenue / spend
- Success score (0-100): based on CTR (>4% is excellent), ROAS (>3 is excellent), engagement

Return JSON:
{
  "platform": "<platform>",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "launchDay": "monday|tuesday|...|sunday|null",
  "launchTime": "early_morning|morning|afternoon|evening|night|null",
  "adSpend": <number>,
  "impressions": <number>,
  "reach": <number or null>,
  "clicks": <number>,
  "ctr": <percentage>,
  "conversions": <number or null>,
  "conversionRate": <percentage or null>,
  "revenue": <number or null>,
  "roas": <number or null>,
  "likes": <number or null>,
  "comments": <number or null>,
  "shares": <number or null>,
  "saves": <number or null>,
  "notes": "summary of observations",
  "bestPerformingDay": "if mentioned",
  "bestPerformingTime": "if mentioned",
  "audienceInsights": [],
  "successScore": <0-100>,
  "extractionConfidence": <0-100>
}`;
}

interface AdForMindMap {
  id: string;
  extractedContent: {
    mediaType: string;
    aspectRatio: string;
    platform: string;
    placement: string;
    hookType: string;
    contentCategory: string;
    editingStyle: string;
    colorScheme: string;
    musicType: string;
    hasSubtitles: boolean;
    isUGCStyle: boolean;
    customTraits: string[];
  };
  extractedResults?: {
    successScore: number;
    ctr: number;
    roas: number;
  };
}

function buildMindMapPrompt(ads: AdForMindMap[]): string {
  return `Analyze these ${ads.length} ads and generate a mind map structure showing patterns and correlations:

${JSON.stringify(ads, null, 2)}

Group traits by category and identify:
1. Which traits appear most frequently
2. Which trait combinations lead to high success scores
3. Correlations between traits

Return JSON:
{
  "categories": [
    {
      "id": "hook_type",
      "label": "🎣 Hook Types",
      "traits": [
        {
          "id": "curiosity",
          "label": "Curiosity",
          "frequency": 5,
          "avgSuccessScore": 85,
          "adIds": ["ad1", "ad2"]
        }
      ]
    }
  ],
  "patterns": [
    {
      "traits": ["ugc", "curiosity", "tiktok"],
      "frequency": 3,
      "avgSuccessRate": 90,
      "description": "UGC + Curiosity on TikTok performs exceptionally well"
    }
  ],
  "correlations": [
    {
      "trait1": "subtitles",
      "trait2": "high_ctr",
      "strength": 0.85,
      "insight": "Ads with subtitles have 85% higher CTR"
    }
  ]
}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFeatureDiscoveryPrompt(adContent: any, adResults: any, reason: string): string {
  return `Analyze this ad that had a ${reason === 'surprise_success' ? 'SURPRISE SUCCESS' : 'SURPRISE FAILURE'}.

AD CONTENT:
${JSON.stringify(adContent, null, 2)}

AD RESULTS:
${JSON.stringify(adResults, null, 2)}

Your task: Discover NEW FEATURES or PATTERNS that might explain why this ad performed ${reason === 'surprise_success' ? 'better' : 'worse'} than expected.

Look for subtle patterns like:
- Specific colors used (e.g., "Neon Magenta in first 2 seconds")
- Timing patterns (e.g., "CTA appears at exactly 0:07")
- Word patterns (e.g., "Uses the word 'free' in captions")
- Visual compositions (e.g., "Face in upper-right quadrant")
- Audio patterns (e.g., "Bass drop at hook point")
- Emotional patterns (e.g., "Contrast between serious opening and humorous middle")

Return JSON with discovered features:
{
  "discoveredFeatures": [
    {
      "name": "feature_name_in_snake_case",
      "description": "What the AI discovered",
      "type": "visual|audio|script|timing|engagement|other",
      "criteria": "How to detect this feature in other ads",
      "correlation": 75,
      "exampleValue": "specific example from this ad"
    }
  ],
  "insights": [
    "Natural language insights about why this ad worked/failed"
  ],
  "recommendedWeightChanges": [
    {
      "feature": "existing_feature_name",
      "direction": "increase|decrease",
      "reason": "why adjust this weight"
    }
  ]
}`;
}

// Chat helper functions
interface ChatContext {
  totalAds: number;
  platforms: Record<string, number>;
  hookTypes: Record<string, number>;
  avgPredictedScore: number;
  avgActualScore: number;
  adsWithResults: number;
  topTraits: string[];
  recentAds: Array<{
    title: string;
    platform: string;
    hookType: string;
    predicted: number;
    actual: number;
  }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildChatPrompt(
  message: string,
  context: ChatContext,
  history: ChatMessage[]
): string {
  const historyText = history
    .map(m => `${m.role === 'user' ? 'User' : 'Athena'}: ${m.content}`)
    .join('\n');

  return `USER'S AD DATA CONTEXT:
- Total Ads: ${context.totalAds}
- Ads with Results: ${context.adsWithResults}
- Average Predicted Score: ${context.avgPredictedScore}%
- Average Actual Score: ${context.avgActualScore}%

Platform Breakdown:
${Object.entries(context.platforms).map(([p, c]) => `- ${p}: ${c} ads`).join('\n')}

Hook Type Breakdown:
${Object.entries(context.hookTypes).map(([h, c]) => `- ${h}: ${c} ads`).join('\n')}

Recent Ads:
${context.recentAds.map(a => `- "${a.title || 'Untitled'}" (${a.platform || 'unknown'}) - Predicted: ${a.predicted || 'N/A'}%, Actual: ${a.actual || 'N/A'}%`).join('\n')}

CONVERSATION HISTORY:
${historyText}

USER'S MESSAGE:
${message}

Respond helpfully based on their data. Be specific and reference their actual numbers when relevant. Keep response under 200 words.`;
}

async function handleChatResponse(
  prompt: string,
  systemMessage: string,
  apiKey: string
): Promise<NextResponse> {
  try {
    console.log('[Athena Chat] Sending request to NVIDIA API...');

    const response = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    console.log('[Athena Chat] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Athena Chat] NVIDIA API error:', response.status, errorText);
      return NextResponse.json({
        success: true,
        data: { response: `I'm having trouble connecting to the AI service (${response.status}). Please try again!` }
      });
    }

    const result = await response.json();
    console.log('[Athena Chat] Response received, choices:', result.choices?.length || 0);

    const content = result.choices?.[0]?.message?.content;

    // Debug: log if content is empty
    if (!content || content.trim() === '') {
      console.warn('[Athena Chat] Empty content received from API');
      console.log('[Athena Chat] Full result:', JSON.stringify(result, null, 2));
    }

    // Ensure we always return a non-empty response
    const finalResponse = content && content.trim() !== ''
      ? content
      : "I received your message but couldn't formulate a response. Please try again or rephrase your question.";

    return NextResponse.json({
      success: true,
      data: { response: finalResponse }
    });
  } catch (error) {
    console.error('[Athena Chat] Exception:', error);
    return NextResponse.json({
      success: true,
      data: { response: "Sorry, I encountered an error. Please try again." }
    });
  }
}

interface RawAction {
  type: string;
  value: number;
}

interface RawCostPerAction {
  type: string;
  cost: number;
}

interface MetricsData {
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  frequency: number;
  results?: number;
  resultType?: string;
  costPerResult?: number;
  rawActions?: RawAction[];
  rawCostPerAction?: RawCostPerAction[];
}

function buildMetricsAnalysisPrompt(metrics: MetricsData, adName: string): string {
  return `Analyze these Facebook ad metrics for "${adName}" and provide intelligent labeling:

CORE METRICS:
- Impressions: ${metrics.impressions?.toLocaleString() || 0}
- Reach: ${metrics.reach?.toLocaleString() || 0}
- Clicks: ${metrics.clicks?.toLocaleString() || 0}
- CTR: ${metrics.ctr?.toFixed(2) || 0}%
- CPC: ₱${metrics.cpc?.toFixed(2) || 0}
- CPM: ₱${metrics.cpm?.toFixed(2) || 0}
- Total Spent: ₱${metrics.spend?.toFixed(2) || 0}
- Frequency: ${metrics.frequency?.toFixed(2) || 0}
${metrics.results ? `- Results: ${metrics.results} (${metrics.resultType || 'unknown'})` : ''}
${metrics.costPerResult ? `- Cost per Result: ₱${metrics.costPerResult.toFixed(2)}` : ''}

RAW FACEBOOK ACTIONS:
${metrics.rawActions?.map(a => `- ${a.type}: ${a.value}`).join('\n') || 'None'}

COST PER ACTION:
${metrics.rawCostPerAction?.map(a => `- ${a.type}: ₱${a.cost.toFixed(2)}`).join('\n') || 'None'}

Provide a JSON response with:
1. Human-readable labels for each raw action (translate Facebook's internal names to user-friendly labels)
2. Performance assessment for key metrics
3. Summary and recommendations

Return JSON:
{
  "summary": "One-line performance summary",
  "overallScore": <0-100>,
  "labeledMetrics": [
    {
      "rawName": "original_action_type",
      "label": "User-Friendly Label",
      "value": <number>,
      "cost": <number or null>,
      "assessment": "good|average|poor",
      "emoji": "relevant emoji",
      "explanation": "Brief explanation of what this metric means"
    }
  ],
  "keyInsights": [
    {
      "metric": "CTR",
      "label": "Click-Through Rate",
      "value": "3.5%",
      "assessment": "good",
      "benchmark": "Industry average is 0.9-2%"
    }
  ],
  "recommendations": ["Actionable improvement suggestions"],
  "warnings": ["Any concerning metrics"]
}`;
}

// Interface for search node data
interface SearchNodeData {
  id: string;
  label: string;
  category: string;
  type: string;
  successRate?: number;
  predictedScore?: number;
  actualScore?: number;
  metrics?: {
    impressions?: number;
    reach?: number;
    clicks?: number;
    ctr?: number;
    spend?: number;
    results?: number;
    costPerResult?: number;
  };
  traits?: string[];
}

function buildOrbSearchPrompt(query: string, nodes: SearchNodeData[]): string {
  // Compress node data to reduce token usage
  const compressedNodes = nodes.slice(0, 50).map(n => ({
    id: n.id,
    label: n.label,
    type: n.type,
    category: n.category,
    score: n.actualScore || n.predictedScore || n.successRate || 0,
    ctr: n.metrics?.ctr || 0,
    spend: n.metrics?.spend || 0,
    results: n.metrics?.results || 0,
    traits: (n.traits || []).slice(0, 5)
  }));

  return `User's search query: "${query}"

Available nodes (ads, traits, categories, metrics):
${JSON.stringify(compressedNodes, null, 1)}

Analyze the user's intent and find matching nodes. Understand queries like:
- "high CTR ads" → find ads with ctr > 2
- "best performing" → find ads with highest scores
- "video content" → find ads with video-related traits
- "UGC style" → find ads with UGC traits
- "low cost" → find ads with low spend or costPerResult
- "failing ads" → find ads with low scores
- Trait searches like "curiosity hook", "tiktok", "subtitles"

Return JSON with matched node IDs ranked by relevance:
{
  "matches": [
    {
      "id": "node_id",
      "relevance": <0-100>,
      "reason": "Brief reason why this matches"
    }
  ],
  "searchIntent": "What the user is looking for",
  "suggestedFilters": ["Additional suggestions for refining search"]
}`;
}
