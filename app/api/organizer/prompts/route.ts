import { NextRequest, NextResponse } from 'next/server';

/**
 * Organizer Prompts API
 * Manages custom JSON prompts for AI trait extraction
 */

// Default prompts for photo and video analysis
const DEFAULT_PROMPTS = [
    {
        id: 'default-video',
        name: 'Video Ad Analysis',
        description: 'Default prompt for analyzing video advertisements',
        mediaType: 'video',
        isDefault: true,
        schema: {
            hookType: 'string - The opening technique (curiosity, shock, question, transformation, story)',
            platform: 'string - Target platform (tiktok, instagram, facebook, youtube)',
            contentCategory: 'string - Content format (ugc, testimonial, product_demo, educational)',
            editingStyle: 'string - Editing approach (fast_cuts, cinematic, raw_authentic)',
            musicType: 'string - Audio style (trending, original, voiceover_only)',
            colorScheme: 'string - Color palette (vibrant, warm, cool, dark)',
            hasSubtitles: 'boolean - Whether subtitles are present',
            isUGCStyle: 'boolean - Whether content appears user-generated',
            patternType: 'string - Persuasion pattern (problem_solution, social_proof, fomo)',
            emotionalTone: 'string - Emotional feel (exciting, inspiring, calming)',
            cta: 'string - Call to action type (shop_now, learn_more, link_in_bio)',
            talentType: 'string - Person type (ugc_creator, influencer, actor, founder)'
        },
        promptText: `Analyze this video advertisement and extract the following traits in JSON format:
{
  "hookType": "the opening hook technique used",
  "platform": "the target social platform",
  "contentCategory": "the content format/style",
  "editingStyle": "the editing approach",
  "musicType": "the audio/music style",
  "colorScheme": "the color palette mood",
  "hasSubtitles": true/false,
  "isUGCStyle": true/false,
  "patternType": "the persuasion pattern",
  "emotionalTone": "the emotional feel",
  "cta": "the call to action type",
  "talentType": "the type of person featured"
}`
    },
    {
        id: 'default-photo',
        name: 'Photo Ad Analysis',
        description: 'Default prompt for analyzing static image advertisements',
        mediaType: 'photo',
        isDefault: true,
        schema: {
            platform: 'string - Target platform',
            colorScheme: 'string - Color palette',
            hasTextOverlay: 'boolean - Whether text is overlaid',
            textContent: 'string - Main text message',
            productVisibility: 'string - How product is shown (hero, lifestyle, comparison)',
            cta: 'string - Call to action',
            emotionalTone: 'string - Emotional feel',
            brandVisibility: 'string - Brand presence (subtle, prominent, none)'
        },
        promptText: `Analyze this image advertisement and extract the following traits in JSON format:
{
  "platform": "the target social platform",
  "colorScheme": "the color palette mood",
  "hasTextOverlay": true/false,
  "textContent": "main text message if present",
  "productVisibility": "how the product is displayed",
  "cta": "call to action if visible",
  "emotionalTone": "the emotional feel",
  "brandVisibility": "how prominent the brand is"
}`
    }
];

/**
 * GET /api/organizer/prompts
 * List all prompts (default + custom)
 */
export async function GET() {
    try {
        // Get custom prompts from storage
        // In production, this would be from Supabase
        const customPrompts = getCustomPromptsFromStorage();

        return NextResponse.json({
            success: true,
            prompts: [...DEFAULT_PROMPTS, ...customPrompts]
        });
    } catch (error) {
        console.error('[Prompts] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
    }
}

/**
 * POST /api/organizer/prompts
 * Create a new custom prompt
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, description, mediaType, schema, promptText } = body;

        if (!name || !promptText) {
            return NextResponse.json({
                error: 'Name and prompt text are required'
            }, { status: 400 });
        }

        const newPrompt = {
            id: `custom-${Date.now()}`,
            name,
            description: description || '',
            mediaType: mediaType || 'video',
            isDefault: false,
            schema: schema || {},
            promptText,
            createdAt: new Date().toISOString()
        };

        // Save to storage
        saveCustomPrompt(newPrompt);

        return NextResponse.json({
            success: true,
            prompt: newPrompt
        });
    } catch (error) {
        console.error('[Prompts] POST error:', error);
        return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 });
    }
}

/**
 * PUT /api/organizer/prompts
 * Update an existing prompt
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, name, description, mediaType, schema, promptText } = body;

        if (!id) {
            return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
        }

        // Can't edit default prompts
        if (id.startsWith('default-')) {
            return NextResponse.json({
                error: 'Cannot edit default prompts. Create a custom prompt instead.'
            }, { status: 403 });
        }

        const updatedPrompt = {
            id,
            name,
            description,
            mediaType,
            schema,
            promptText,
            updatedAt: new Date().toISOString()
        };

        updateCustomPrompt(updatedPrompt);

        return NextResponse.json({
            success: true,
            prompt: updatedPrompt
        });
    } catch (error) {
        console.error('[Prompts] PUT error:', error);
        return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 });
    }
}

/**
 * DELETE /api/organizer/prompts
 * Delete a custom prompt
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
        }

        if (id.startsWith('default-')) {
            return NextResponse.json({
                error: 'Cannot delete default prompts'
            }, { status: 403 });
        }

        deleteCustomPrompt(id);

        return NextResponse.json({
            success: true,
            message: 'Prompt deleted'
        });
    } catch (error) {
        console.error('[Prompts] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 });
    }
}

// ===== Storage helpers (using global variable for server-side) =====
// In production, replace with Supabase calls

let customPromptsCache: any[] = [];

function getCustomPromptsFromStorage(): any[] {
    return customPromptsCache;
}

function saveCustomPrompt(prompt: any) {
    customPromptsCache.push(prompt);
}

function updateCustomPrompt(prompt: any) {
    const idx = customPromptsCache.findIndex(p => p.id === prompt.id);
    if (idx >= 0) {
        customPromptsCache[idx] = { ...customPromptsCache[idx], ...prompt };
    }
}

function deleteCustomPrompt(id: string) {
    customPromptsCache = customPromptsCache.filter(p => p.id !== id);
}
