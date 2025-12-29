/**
 * Agent Run API
 * Execute and log multi-step agent workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST - Execute agent run
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, orgId, userId, entityIds, context } = body;

        if (!orgId || !userId) {
            return NextResponse.json({
                success: false,
                error: 'orgId and userId are required'
            }, { status: 400 });
        }

        // Import and run agent (dynamic import to avoid SSR issues)
        const { runAgent, logAgentRun } = await import('@/lib/ai/agent-runner');

        const result = await runAgent({
            query: query || 'Generate recommendations',
            orgId,
            userId,
            entityIds: entityIds || [],
            context
        });

        // Log to database
        await logAgentRun(result, { query, orgId, userId, entityIds, context });

        return NextResponse.json({
            success: true,
            run: result
        });

    } catch (error) {
        console.error('Agent run error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to execute agent run'
        }, { status: 500 });
    }
}

// GET - List agent runs
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const orgId = searchParams.get('orgId');
        const limit = parseInt(searchParams.get('limit') || '20');

        if (!orgId) {
            return NextResponse.json({
                success: false,
                error: 'orgId is required'
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('agent_runs')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching agent runs:', error);
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            runs: data || []
        });

    } catch (error) {
        console.error('Agent runs API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch agent runs'
        }, { status: 500 });
    }
}
