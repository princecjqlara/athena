/**
 * Log Agent Runs API
 * Save agent run logs to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST - Log agent run
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const {
            runId,
            orgId,
            userId,
            triggerType,
            inputQuery,
            steps,
            toolsUsed,
            totalDurationMs,
            recommendationsGenerated,
            finalOutput,
            status,
            errorMessage,
            promptVersion,
            modelVersion
        } = body;

        const { data, error } = await supabase
            .from('agent_runs')
            .insert({
                id: runId,
                org_id: orgId,
                user_id: userId,
                trigger_type: triggerType || 'user_query',
                input_query: inputQuery,
                steps_json: steps,
                tools_used: toolsUsed,
                total_duration_ms: totalDurationMs,
                recommendations_generated: recommendationsGenerated || 0,
                final_output: finalOutput,
                status: status || 'completed',
                error_message: errorMessage,
                prompt_version: promptVersion,
                model_version: modelVersion,
                completed_at: status === 'completed' ? new Date().toISOString() : null
            })
            .select()
            .single();

        if (error) {
            // If duplicate key, just return success
            if (error.code === '23505') {
                return NextResponse.json({ success: true, message: 'Already logged' });
            }
            console.error('Error logging agent run:', error);
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            run: data
        });

    } catch (error) {
        console.error('Agent runs log error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to log agent run'
        }, { status: 500 });
    }
}
