/**
 * Prompt Versioning & A/B Testing API
 * Manage prompt versions and track performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - List prompt versions
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const promptName = searchParams.get('name');
        const activeOnly = searchParams.get('activeOnly') === 'true';

        let query = supabase
            .from('prompt_versions')
            .select('*')
            .order('created_at', { ascending: false });

        if (promptName) query = query.eq('prompt_name', promptName);
        if (activeOnly) query = query.eq('is_active', true);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching prompts:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            prompts: data || []
        });
    } catch (error) {
        console.error('Prompts API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch prompts' }, { status: 500 });
    }
}

// POST - Create new prompt version
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { promptName, version, promptText, toolDefinitions, createdBy, setAsDefault } = body;

        if (!promptName || !version || !promptText) {
            return NextResponse.json({
                success: false,
                error: 'promptName, version, and promptText are required'
            }, { status: 400 });
        }

        // If setting as default, unset other defaults first
        if (setAsDefault) {
            await supabase
                .from('prompt_versions')
                .update({ is_default: false })
                .eq('prompt_name', promptName);
        }

        const { data, error } = await supabase
            .from('prompt_versions')
            .insert({
                prompt_name: promptName,
                version,
                prompt_text: promptText,
                tool_definitions: toolDefinitions,
                is_active: true,
                is_default: setAsDefault || false,
                created_by: createdBy
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating prompt:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, prompt: data });
    } catch (error) {
        console.error('Create prompt error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create prompt' }, { status: 500 });
    }
}

// PATCH - Update prompt version stats or status
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { id, isActive, isDefault, updateStats } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Prompt ID required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};

        if (typeof isActive === 'boolean') updateData.is_active = isActive;
        if (typeof isDefault === 'boolean') {
            updateData.is_default = isDefault;

            // If setting as default, unset others first
            if (isDefault) {
                const { data: prompt } = await supabase
                    .from('prompt_versions')
                    .select('prompt_name')
                    .eq('id', id)
                    .single();

                if (prompt) {
                    await supabase
                        .from('prompt_versions')
                        .update({ is_default: false })
                        .eq('prompt_name', prompt.prompt_name)
                        .neq('id', id);
                }
            }
        }

        // Update performance stats (called after each run)
        if (updateStats) {
            const { totalRuns, avgConfidence, avgAcceptRate, avgPositiveOutcomeRate } = updateStats;
            if (totalRuns !== undefined) updateData.total_runs = totalRuns;
            if (avgConfidence !== undefined) updateData.avg_confidence = avgConfidence;
            if (avgAcceptRate !== undefined) updateData.avg_accept_rate = avgAcceptRate;
            if (avgPositiveOutcomeRate !== undefined) updateData.avg_positive_outcome_rate = avgPositiveOutcomeRate;
        }

        const { data, error } = await supabase
            .from('prompt_versions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating prompt:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, prompt: data });
    } catch (error) {
        console.error('Update prompt error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update prompt' }, { status: 500 });
    }
}
