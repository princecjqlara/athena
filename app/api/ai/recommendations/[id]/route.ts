/**
 * Single Recommendation API
 * Get single recommendation and add feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Get single recommendation with events
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch recommendation
        const { data: rec, error: recError } = await supabase
            .from('athena_recommendations')
            .select('*')
            .eq('id', id)
            .single();

        if (recError) {
            return NextResponse.json({ success: false, error: 'Recommendation not found' }, { status: 404 });
        }

        // Fetch events
        const { data: events } = await supabase
            .from('recommendation_events')
            .select('*')
            .eq('recommendation_id', id)
            .order('created_at', { ascending: true });

        // Fetch evaluation if exists
        const { data: evaluation } = await supabase
            .from('evaluation_runs')
            .select('*')
            .eq('recommendation_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Log view event
        await supabase.from('recommendation_events').insert({
            recommendation_id: id,
            event_type: 'viewed',
            event_data: {}
        });

        return NextResponse.json({
            success: true,
            recommendation: rec,
            events: events || [],
            evaluation: evaluation || null
        });
    } catch (error) {
        console.error('Get recommendation error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get recommendation' }, { status: 500 });
    }
}

// POST - Submit feedback (accept/reject with reason)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { action, feedback, userId } = body;

        if (!action || !['accept', 'reject', 'apply'].includes(action)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid action. Must be: accept, reject, or apply'
            }, { status: 400 });
        }

        // Map action to status
        const statusMap: Record<string, string> = {
            accept: 'accepted',
            reject: 'rejected',
            apply: 'applied'
        };

        const updateData: Record<string, unknown> = {
            status: statusMap[action]
        };

        if (feedback) {
            updateData.user_feedback = feedback;
        }

        if (action === 'apply') {
            updateData.applied_at = new Date().toISOString();
            // Set evaluation window (7 days from now)
            updateData.evaluation_window_start = new Date().toISOString();
            updateData.evaluation_window_end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }

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

        // Log event
        await supabase.from('recommendation_events').insert({
            recommendation_id: id,
            event_type: statusMap[action],
            event_data: {
                feedback,
                action
            },
            user_id: userId
        });

        return NextResponse.json({
            success: true,
            recommendation: data,
            message: `Recommendation ${statusMap[action]}`
        });
    } catch (error) {
        console.error('Feedback submission error:', error);
        return NextResponse.json({ success: false, error: 'Failed to submit feedback' }, { status: 500 });
    }
}
