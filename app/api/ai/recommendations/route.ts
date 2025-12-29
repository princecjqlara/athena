/**
 * Athena Recommendations API
 * CRUD operations for AI recommendations with feedback tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - List recommendations
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const orgId = searchParams.get('orgId');
        const status = searchParams.get('status');
        const entityType = searchParams.get('entityType');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query = supabase
            .from('athena_recommendations')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (orgId) query = query.eq('org_id', orgId);
        if (status) query = query.eq('status', status);
        if (entityType) query = query.eq('entity_type', entityType);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching recommendations:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            recommendations: data || [],
            total: count,
            limit,
            offset
        });
    } catch (error) {
        console.error('Recommendations API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch recommendations' }, { status: 500 });
    }
}

// POST - Create recommendation
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const {
            orgId,
            userId,
            recommendationType,
            entityType,
            entityId,
            title,
            description,
            action,
            confidenceScore,
            evidence,
            reasoningSteps,
            baselineMetrics,
            agentRunId,
            promptVersion,
            expiresAt
        } = body;

        // Validate required fields
        if (!orgId || !userId || !recommendationType || !entityType || !entityId || !title || !action) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields'
            }, { status: 400 });
        }

        // Insert recommendation
        const { data: rec, error: recError } = await supabase
            .from('athena_recommendations')
            .insert({
                org_id: orgId,
                user_id: userId,
                recommendation_type: recommendationType,
                entity_type: entityType,
                entity_id: entityId,
                title,
                description,
                action_json: action,
                confidence_score: confidenceScore,
                evidence_json: evidence,
                reasoning_steps: reasoningSteps,
                baseline_metrics: baselineMetrics,
                agent_run_id: agentRunId,
                prompt_version: promptVersion,
                expires_at: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days default
            })
            .select()
            .single();

        if (recError) {
            console.error('Error creating recommendation:', recError);
            return NextResponse.json({ success: false, error: recError.message }, { status: 500 });
        }

        // Log creation event
        await supabase.from('recommendation_events').insert({
            recommendation_id: rec.id,
            event_type: 'created',
            event_data: { confidence_score: confidenceScore },
            user_id: userId
        });

        return NextResponse.json({ success: true, recommendation: rec });
    } catch (error) {
        console.error('Create recommendation error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create recommendation' }, { status: 500 });
    }
}

// PATCH - Update recommendation status
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { id, status, userFeedback, userId, appliedAt, evaluationWindowStart, evaluationWindowEnd } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing recommendation ID' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (userFeedback) updateData.user_feedback = userFeedback;
        if (appliedAt) updateData.applied_at = appliedAt;
        if (evaluationWindowStart) updateData.evaluation_window_start = evaluationWindowStart;
        if (evaluationWindowEnd) updateData.evaluation_window_end = evaluationWindowEnd;

        const { data, error } = await supabase
            .from('athena_recommendations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating recommendation:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Log status change event
        if (status) {
            await supabase.from('recommendation_events').insert({
                recommendation_id: id,
                event_type: status,
                event_data: { feedback: userFeedback },
                user_id: userId
            });
        }

        return NextResponse.json({ success: true, recommendation: data });
    } catch (error) {
        console.error('Update recommendation error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update recommendation' }, { status: 500 });
    }
}
