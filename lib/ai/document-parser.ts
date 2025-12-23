// AI-Powered Document Parser
// Uses GPT to extract structured data from user's natural language descriptions

import {
    ExtractedAdData,
    ExtractedResultsData,
    MediaType,
    AspectRatio,
    AdPlacement,
    Platform,
    HookType,
    ContentCategory,
    EditingStyle,
    ColorScheme,
    MusicType,
    CTAType,
    DayOfWeek,
    TimeOfDay
} from '@/types';

// Prompts for GPT extraction
const CONTENT_EXTRACTION_PROMPT = `You are an expert ad analyst. Extract all ad attributes from the user's description.

Analyze the text and extract:
- Media type (video, photo, or carousel)
- Aspect ratio (9:16, 1:1, 4:5, 16:9, 4:3, or other)
- Platform (tiktok, instagram, facebook, youtube, snapchat, pinterest, twitter, linkedin, other)
- Placement (feed, stories, reels, explore, in-stream, pre-roll, mid-roll, banner, sponsored, other)
- Hook type (curiosity, shock, question, story, statistic, controversy, transformation, before_after, problem_solution, testimonial, unboxing, challenge, other)
- Content category (product_demo, lifestyle, testimonial, educational, entertainment, behind_the_scenes, comparison, tutorial, ugc, influencer, brand_story, other)
- Editing style (fast_cuts, cinematic, raw_authentic, animated, mixed_media, minimal, dynamic, slow_motion, other)
- Color scheme (vibrant, muted, monochrome, warm, cool, pastel, dark, neon, natural, other)
- Music type (trending, original, voiceover_only, no_music, licensed, cinematic, upbeat, emotional, other)
- CTA type (shop_now, learn_more, sign_up, download, contact_us, swipe_up, link_in_bio, book_now, get_offer, none, other)
- Script/copy text
- Visual features (text overlays, subtitles)
- Audio features (voiceover)
- Talent info (number of actors, UGC style, talent type)
- Any other notable traits or characteristics

Return a JSON object with this EXACT structure:
{
  "title": "Brief title for this ad",
  "description": "One sentence description",
  "mediaType": "video|photo|carousel",
  "aspectRatio": "9:16|1:1|4:5|16:9|4:3|other",
  "duration": <seconds if mentioned, null otherwise>,
  "durationCategory": "under_15s|15_30s|30_60s|over_60s|null",
  "platform": "<platform>",
  "placement": "<placement>",
  "hookType": "<hook_type>",
  "hookText": "The actual hook text if mentioned",
  "contentCategory": "<category>",
  "editingStyle": "<style>",
  "script": "Full script if provided",
  "cta": "<cta_type>",
  "ctaText": "Actual CTA text if mentioned",
  "headlines": ["headline 1", "headline 2"],
  "colorScheme": "<color>",
  "hasTextOverlays": true|false,
  "hasSubtitles": true|false,
  "visualStyle": ["fast cuts", "transitions", "etc"],
  "musicType": "<music>",
  "hasVoiceover": true|false,
  "audioDescription": "description of audio if any",
  "numberOfActors": <number>,
  "talentType": "ugc_creator|influencer|model|none|multiple",
  "isUGCStyle": true|false,
  "customTraits": ["any other notable traits discovered"],
  "extractionConfidence": <0-100>
}

If a field cannot be determined, use sensible defaults or make your best inference based on context. Always provide a valid JSON response.`;

const RESULTS_EXTRACTION_PROMPT = `You are an expert ad analyst. Extract all performance metrics from the user's results description.

Analyze the text and extract:
- Platform
- Date range (start/end dates)
- Launch day and time
- Ad spend
- Impressions and reach
- Clicks and CTR
- Conversions and conversion rate
- Revenue and ROAS
- Engagement metrics (likes, comments, shares, saves)
- Any observations or insights

Calculate a success score (0-100) based on:
- CTR (above 2% is good, above 4% is excellent)
- ROAS (above 1 is break-even, above 2 is good, above 3 is excellent)
- Engagement rate
- User notes about performance

Return a JSON object with this EXACT structure:
{
  "platform": "<platform>",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "launchDay": "monday|tuesday|wednesday|thursday|friday|saturday|sunday|null",
  "launchTime": "early_morning|morning|afternoon|evening|night|null",
  "adSpend": <number>,
  "impressions": <number>,
  "reach": <number or null>,
  "clicks": <number>,
  "ctr": <percentage as decimal, e.g. 4.5 for 4.5%>,
  "conversions": <number or null>,
  "conversionRate": <percentage or null>,
  "revenue": <number or null>,
  "roas": <number or null>,
  "likes": <number or null>,
  "comments": <number or null>,
  "shares": <number or null>,
  "saves": <number or null>,
  "notes": "summary of any observations",
  "bestPerformingDay": "if mentioned",
  "bestPerformingTime": "if mentioned",
  "audienceInsights": ["insight 1", "insight 2"],
  "successScore": <0-100>,
  "extractionConfidence": <0-100>
}

If metrics are missing, calculate them if possible (e.g., CTR = clicks/impressions * 100).
Always provide valid numbers, use 0 if truly unknown.`;

// Client-side parsing function (calls API)
export async function parseContentDocument(rawText: string): Promise<ExtractedAdData | null> {
    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'parse-content',
                data: { rawText }
            })
        });

        const result = await response.json();

        if (result.success && result.data) {
            return result.data as ExtractedAdData;
        }

        // Fallback to basic extraction
        return extractBasicContentData(rawText);
    } catch (error) {
        console.error('Content parsing error:', error);
        return extractBasicContentData(rawText);
    }
}

export async function parseResultsDocument(rawText: string): Promise<ExtractedResultsData | null> {
    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'parse-results',
                data: { rawText }
            })
        });

        const result = await response.json();

        if (result.success && result.data) {
            return result.data as ExtractedResultsData;
        }

        return extractBasicResultsData(rawText);
    } catch (error) {
        console.error('Results parsing error:', error);
        return extractBasicResultsData(rawText);
    }
}

// Basic fallback extraction using regex patterns
function extractBasicContentData(text: string): ExtractedAdData {
    const lowerText = text.toLowerCase();

    // Detect media type
    let mediaType: MediaType = 'video';
    if (lowerText.includes('photo') || lowerText.includes('image') || lowerText.includes('static')) {
        mediaType = 'photo';
    } else if (lowerText.includes('carousel') || lowerText.includes('slideshow')) {
        mediaType = 'carousel';
    }

    // Detect aspect ratio
    let aspectRatio: AspectRatio = '9:16';
    if (lowerText.includes('9:16') || lowerText.includes('vertical') || lowerText.includes('tiktok') || lowerText.includes('reels')) {
        aspectRatio = '9:16';
    } else if (lowerText.includes('1:1') || lowerText.includes('square')) {
        aspectRatio = '1:1';
    } else if (lowerText.includes('4:5')) {
        aspectRatio = '4:5';
    } else if (lowerText.includes('16:9') || lowerText.includes('horizontal') || lowerText.includes('youtube')) {
        aspectRatio = '16:9';
    }

    // Detect platform
    let platform: Platform = 'other';
    if (lowerText.includes('tiktok')) platform = 'tiktok';
    else if (lowerText.includes('instagram') || lowerText.includes('ig ')) platform = 'instagram';
    else if (lowerText.includes('facebook') || lowerText.includes('fb ')) platform = 'facebook';
    else if (lowerText.includes('youtube')) platform = 'youtube';
    else if (lowerText.includes('snapchat')) platform = 'snapchat';

    // Detect placement
    let placement: AdPlacement = 'feed';
    if (lowerText.includes('stories') || lowerText.includes('story')) placement = 'stories';
    else if (lowerText.includes('reels') || lowerText.includes('reel')) placement = 'reels';
    else if (lowerText.includes('explore')) placement = 'explore';

    // Detect hook type
    let hookType: HookType = 'other';
    if (lowerText.includes('curiosity') || lowerText.includes('you won\'t believe')) hookType = 'curiosity';
    else if (lowerText.includes('shock') || lowerText.includes('shocking')) hookType = 'shock';
    else if (lowerText.includes('question') || lowerText.includes('did you know')) hookType = 'question';
    else if (lowerText.includes('before') && lowerText.includes('after')) hookType = 'before_after';
    else if (lowerText.includes('testimonial') || lowerText.includes('review')) hookType = 'testimonial';
    else if (lowerText.includes('story') || lowerText.includes('storytime')) hookType = 'story';

    // Detect content category
    let contentCategory: ContentCategory = 'other';
    if (lowerText.includes('ugc') || lowerText.includes('user generated')) contentCategory = 'ugc';
    else if (lowerText.includes('testimonial')) contentCategory = 'testimonial';
    else if (lowerText.includes('demo') || lowerText.includes('demonstration')) contentCategory = 'product_demo';
    else if (lowerText.includes('lifestyle')) contentCategory = 'lifestyle';
    else if (lowerText.includes('tutorial') || lowerText.includes('how to')) contentCategory = 'tutorial';

    // Detect editing style
    let editingStyle: EditingStyle = 'other';
    if (lowerText.includes('fast cut') || lowerText.includes('quick cut')) editingStyle = 'fast_cuts';
    else if (lowerText.includes('cinematic')) editingStyle = 'cinematic';
    else if (lowerText.includes('raw') || lowerText.includes('authentic')) editingStyle = 'raw_authentic';
    else if (lowerText.includes('dynamic')) editingStyle = 'dynamic';

    return {
        title: 'Untitled Ad',
        description: text.slice(0, 100),
        mediaType,
        aspectRatio,
        platform,
        placement,
        hookType,
        hookText: undefined,
        contentCategory,
        editingStyle,
        colorScheme: 'other',
        hasTextOverlays: lowerText.includes('text overlay') || lowerText.includes('text on screen'),
        hasSubtitles: lowerText.includes('subtitle') || lowerText.includes('caption'),
        musicType: lowerText.includes('trending') ? 'trending' : lowerText.includes('voiceover') ? 'voiceover_only' : 'other',
        hasVoiceover: lowerText.includes('voiceover') || lowerText.includes('voice over') || lowerText.includes('narration'),
        numberOfActors: 1,
        talentType: lowerText.includes('ugc') ? 'ugc_creator' : lowerText.includes('influencer') ? 'influencer' : 'none',
        isUGCStyle: lowerText.includes('ugc') || lowerText.includes('user generated') || lowerText.includes('authentic'),
        customTraits: [],
        extractionConfidence: 30
    };
}

function extractBasicResultsData(text: string): ExtractedResultsData {
    const lowerText = text.toLowerCase();

    // Extract numbers with patterns
    const spendMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:spent|spend|budget)/i);
    const impressionsMatch = text.match(/([\d,]+)k?\s*(?:impressions|impr)/i);
    const clicksMatch = text.match(/([\d,]+)\s*(?:clicks|click)/i);
    const ctrMatch = text.match(/([\d.]+)%?\s*(?:ctr|click.?through)/i);
    const conversionsMatch = text.match(/([\d,]+)\s*(?:conversions|conv|sales)/i);
    const revenueMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:revenue|earned|made)/i);
    const roasMatch = text.match(/([\d.]+)x?\s*(?:roas|return)/i);

    const adSpend = spendMatch ? parseFloat(spendMatch[1].replace(/,/g, '')) : 0;
    const impressions = impressionsMatch ?
        (impressionsMatch[0].includes('k') ? parseFloat(impressionsMatch[1]) * 1000 : parseFloat(impressionsMatch[1])) : 0;
    const clicks = clicksMatch ? parseFloat(clicksMatch[1].replace(/,/g, '')) : 0;
    const ctr = ctrMatch ? parseFloat(ctrMatch[1]) : (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const conversions = conversionsMatch ? parseFloat(conversionsMatch[1].replace(/,/g, '')) : undefined;
    const revenue = revenueMatch ? parseFloat(revenueMatch[1].replace(/,/g, '')) : undefined;
    const roas = roasMatch ? parseFloat(roasMatch[1]) : (revenue && adSpend > 0 ? revenue / adSpend : undefined);

    // Calculate success score
    let successScore = 50;
    if (ctr > 4) successScore += 20;
    else if (ctr > 2) successScore += 10;
    if (roas && roas > 3) successScore += 25;
    else if (roas && roas > 2) successScore += 15;
    else if (roas && roas > 1) successScore += 5;

    // Detect platform
    let platform: Platform = 'other';
    if (lowerText.includes('tiktok')) platform = 'tiktok';
    else if (lowerText.includes('instagram')) platform = 'instagram';
    else if (lowerText.includes('facebook')) platform = 'facebook';
    else if (lowerText.includes('youtube')) platform = 'youtube';

    return {
        platform,
        adSpend,
        impressions,
        clicks,
        ctr,
        conversions,
        revenue,
        roas,
        successScore: Math.min(100, successScore),
        extractionConfidence: 30
    };
}

// Export prompts for API use
export const PROMPTS = {
    CONTENT_EXTRACTION: CONTENT_EXTRACTION_PROMPT,
    RESULTS_EXTRACTION: RESULTS_EXTRACTION_PROMPT
};
