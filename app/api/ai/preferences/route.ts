/**
 * User AI Preferences API
 * Manage KPI preferences, constraints, and alert settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Get user preferences
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('user_ai_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // Not found is ok
            console.error('Error fetching preferences:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Return defaults if not found
        const preferences = data || {
            user_id: userId,
            primary_kpi: 'roas',
            secondary_kpis: ['cpa', 'ctr'],
            kpi_targets: { roas: 3.0, cpa: 30.0 },
            min_budget: null,
            max_budget: null,
            never_pause_entities: [],
            never_recommend_actions: [],
            alert_thresholds: {},
            notification_channels: ['in_app']
        };

        return NextResponse.json({ success: true, preferences });
    } catch (error) {
        console.error('Preferences API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
    }
}

// POST - Create or update user preferences
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const {
            userId,
            orgId,
            primaryKpi,
            secondaryKpis,
            kpiTargets,
            minBudget,
            maxBudget,
            neverPauseEntities,
            neverRecommendActions,
            alertThresholds,
            notificationChannels
        } = body;

        if (!userId || !orgId) {
            return NextResponse.json({
                success: false,
                error: 'userId and orgId are required'
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('user_ai_preferences')
            .upsert({
                user_id: userId,
                org_id: orgId,
                primary_kpi: primaryKpi || 'roas',
                secondary_kpis: secondaryKpis || ['cpa', 'ctr'],
                kpi_targets: kpiTargets || {},
                min_budget: minBudget,
                max_budget: maxBudget,
                never_pause_entities: neverPauseEntities || [],
                never_recommend_actions: neverRecommendActions || [],
                alert_thresholds: alertThresholds || {},
                notification_channels: notificationChannels || ['in_app'],
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving preferences:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, preferences: data });
    } catch (error) {
        console.error('Save preferences error:', error);
        return NextResponse.json({ success: false, error: 'Failed to save preferences' }, { status: 500 });
    }
}
