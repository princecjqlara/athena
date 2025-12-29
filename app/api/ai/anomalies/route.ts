/**
 * Anomalies API
 * Detect and manage anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - List anomalies
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const orgId = searchParams.get('orgId');
        const status = searchParams.get('status');
        const severity = searchParams.get('severity');
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!orgId) {
            return NextResponse.json({ success: false, error: 'orgId is required' }, { status: 400 });
        }

        let query = supabase
            .from('anomalies')
            .select('*')
            .eq('org_id', orgId)
            .order('detected_at', { ascending: false })
            .limit(limit);

        if (status) query = query.eq('status', status);
        if (severity) query = query.eq('severity', severity);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching anomalies:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Calculate summary
        const anomalies = data || [];
        const summary = {
            total: anomalies.length,
            open: anomalies.filter(a => a.status === 'open').length,
            critical: anomalies.filter(a => a.severity === 'critical' && a.status === 'open').length,
            high: anomalies.filter(a => a.severity === 'high' && a.status === 'open').length,
            medium: anomalies.filter(a => a.severity === 'medium' && a.status === 'open').length,
            low: anomalies.filter(a => a.severity === 'low' && a.status === 'open').length
        };

        return NextResponse.json({
            success: true,
            anomalies,
            summary
        });
    } catch (error) {
        console.error('Anomalies API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch anomalies' }, { status: 500 });
    }
}

// POST - Run detection and save anomalies
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        const { orgId, anomalies } = body;

        if (!orgId) {
            return NextResponse.json({ success: false, error: 'orgId is required' }, { status: 400 });
        }

        // If anomalies provided, save them
        if (anomalies && anomalies.length > 0) {
            const toInsert = anomalies.map((a: Record<string, unknown>) => ({
                org_id: orgId,
                anomaly_type: a.anomaly_type,
                entity_type: a.entity_type,
                entity_id: a.entity_id,
                metric_name: a.metric_name,
                expected_value: a.expected_value,
                actual_value: a.actual_value,
                deviation_pct: a.deviation_pct,
                severity: a.severity,
                baseline_json: a.baseline_json,
                context_json: a.context_json,
                status: 'open',
                detected_at: a.detected_at || new Date().toISOString()
            }));

            const { data, error } = await supabase
                .from('anomalies')
                .insert(toInsert)
                .select();

            if (error) {
                console.error('Error saving anomalies:', error);
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                saved: data?.length || 0,
                anomalies: data
            });
        }

        return NextResponse.json({
            success: true,
            saved: 0,
            message: 'No anomalies to save'
        });
    } catch (error) {
        console.error('Anomaly detection error:', error);
        return NextResponse.json({ success: false, error: 'Failed to run detection' }, { status: 500 });
    }
}

// PATCH - Update anomaly status (acknowledge/resolve)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        const { id, status, acknowledgedBy } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Anomaly ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (acknowledgedBy) updateData.acknowledged_by = acknowledgedBy;
        if (status === 'resolved') updateData.resolved_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('anomalies')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating anomaly:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, anomaly: data });
    } catch (error) {
        console.error('Update anomaly error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update anomaly' }, { status: 500 });
    }
}
