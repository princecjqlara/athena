/**
 * Athena Stats API
 * Returns overall Athena Intelligence statistics
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch counts in parallel
        const [recommendationsRes, anomaliesRes, runsRes, healthRes] = await Promise.all([
            supabase
                .from('athena_recommendations')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending'),
            supabase
                .from('anomalies')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'open'),
            supabase
                .from('agent_runs')
                .select('id', { count: 'exact', head: true }),
            supabase
                .from('data_health_scores')
                .select('overall_score')
                .order('calculated_at', { ascending: false })
                .limit(1)
        ]);

        // Calculate data health score
        let dataHealthScore = 85; // Default
        if (healthRes.data && healthRes.data.length > 0) {
            dataHealthScore = Math.round(healthRes.data[0].overall_score);
        }

        return NextResponse.json({
            success: true,
            stats: {
                recommendations: recommendationsRes.count || 0,
                anomalies: anomaliesRes.count || 0,
                dataHealthScore,
                agentRuns: runsRes.count || 0
            }
        });
    } catch (error) {
        console.error('Athena stats API error:', error);

        // Return default stats on error
        return NextResponse.json({
            success: true,
            stats: {
                recommendations: 0,
                anomalies: 0,
                dataHealthScore: 85,
                agentRuns: 0
            }
        });
    }
}
