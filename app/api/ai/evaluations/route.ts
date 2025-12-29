/**
 * Recommendation Evaluation API
 * Run before/after impact analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST - Run evaluation for a recommendation
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { recommendationId, primaryMetric } = body;

        if (!recommendationId) {
            return NextResponse.json({
                success: false,
                error: 'recommendationId is required'
            }, { status: 400 });
        }

        // Get recommendation
        const { data: rec, error: recError } = await supabase
            .from('athena_recommendations')
            .select('*')
            .eq('id', recommendationId)
            .single();

        if (recError || !rec) {
            return NextResponse.json({
                success: false,
                error: 'Recommendation not found'
            }, { status: 404 });
        }

        if (!rec.applied_at) {
            return NextResponse.json({
                success: false,
                error: 'Recommendation has not been applied yet'
            }, { status: 400 });
        }

        // Import and run evaluation
        const { runEvaluation } = await import('@/lib/ai/evaluation');

        const result = await runEvaluation(
            recommendationId,
            rec.entity_id,
            rec.entity_type,
            rec.applied_at,
            primaryMetric || 'roas'
        );

        if (!result) {
            return NextResponse.json({
                success: false,
                error: 'Not enough time has passed for evaluation (7 days required)'
            }, { status: 400 });
        }

        // Save evaluation
        const { data, error } = await supabase
            .from('evaluation_runs')
            .insert({
                recommendation_id: recommendationId,
                before_start: result.before_start,
                before_end: result.before_end,
                after_start: result.after_start,
                after_end: result.after_end,
                before_metrics: result.before_metrics,
                after_metrics: result.after_metrics,
                lift_pct: result.lift_pct,
                p_value: result.p_value,
                is_significant: result.is_significant,
                sample_size_before: result.sample_size_before,
                sample_size_after: result.sample_size_after,
                outcome: result.outcome,
                notes: result.notes
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving evaluation:', error);
        }

        // Log evaluation event
        await supabase.from('recommendation_events').insert({
            recommendation_id: recommendationId,
            event_type: 'evaluated',
            event_data: {
                outcome: result.outcome,
                lift_pct: result.lift_pct,
                is_significant: result.is_significant
            }
        });

        return NextResponse.json({
            success: true,
            evaluation: result,
            saved: data
        });

    } catch (error) {
        console.error('Evaluation error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to run evaluation'
        }, { status: 500 });
    }
}

// GET - Get evaluations for a recommendation
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const recommendationId = searchParams.get('recommendationId');
        const orgId = searchParams.get('orgId');

        let query = supabase
            .from('evaluation_runs')
            .select('*, athena_recommendations(title, recommendation_type, entity_id)')
            .order('created_at', { ascending: false });

        if (recommendationId) {
            query = query.eq('recommendation_id', recommendationId);
        }

        const { data, error } = await query.limit(50);

        if (error) {
            console.error('Error fetching evaluations:', error);
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        // Calculate success rate
        const evaluations = data || [];
        const stats = {
            total: evaluations.length,
            positive: evaluations.filter(e => e.outcome === 'positive').length,
            negative: evaluations.filter(e => e.outcome === 'negative').length,
            neutral: evaluations.filter(e => e.outcome === 'neutral').length,
            insufficient: evaluations.filter(e => e.outcome === 'insufficient_data').length,
            success_rate: evaluations.length > 0
                ? (evaluations.filter(e => e.outcome === 'positive').length / evaluations.length * 100).toFixed(1)
                : 0
        };

        return NextResponse.json({
            success: true,
            evaluations,
            stats
        });

    } catch (error) {
        console.error('Evaluations API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch evaluations'
        }, { status: 500 });
    }
}
