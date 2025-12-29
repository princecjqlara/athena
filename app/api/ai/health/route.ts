/**
 * Data Health API
 * Calculate and retrieve data quality scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Get health scores for an org
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);

        const orgId = searchParams.get('orgId');
        const entityType = searchParams.get('entityType');
        const entityId = searchParams.get('entityId');

        if (!orgId) {
            return NextResponse.json({ success: false, error: 'orgId is required' }, { status: 400 });
        }

        let query = supabase
            .from('data_health_scores')
            .select('*')
            .eq('org_id', orgId)
            .order('overall_score', { ascending: true });

        if (entityType) query = query.eq('entity_type', entityType);
        if (entityId) query = query.eq('entity_id', entityId);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching health scores:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Calculate summary
        const scores = data || [];
        const summary = {
            total_entities: scores.length,
            healthy: scores.filter(s => s.overall_score >= 80).length,
            warning: scores.filter(s => s.overall_score >= 50 && s.overall_score < 80).length,
            critical: scores.filter(s => s.overall_score < 50).length,
            average_score: scores.length > 0
                ? Math.round(scores.reduce((sum, s) => sum + (s.overall_score || 0), 0) / scores.length)
                : 0
        };

        return NextResponse.json({
            success: true,
            scores: data || [],
            summary
        });
    } catch (error) {
        console.error('Health API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch health scores' }, { status: 500 });
    }
}

// POST - Calculate/recalculate health scores
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        const { orgId, entityType, entityId, forceRecalculate } = body;

        if (!orgId) {
            return NextResponse.json({ success: false, error: 'orgId is required' }, { status: 400 });
        }

        // Get existing ads data for the org
        const { data: ads } = await supabase
            .from('user_ads')
            .select('ad_data')
            .eq('user_id', orgId);

        // Calculate health scores based on data completeness
        const healthScores = calculateHealthScores(ads || [], entityId);

        // Upsert health scores
        for (const score of healthScores) {
            await supabase
                .from('data_health_scores')
                .upsert({
                    org_id: orgId,
                    entity_type: score.entity_type,
                    entity_id: score.entity_id,
                    overall_score: score.overall_score,
                    completeness_score: score.completeness_score,
                    freshness_score: score.freshness_score,
                    attribution_score: score.attribution_score,
                    schema_score: score.schema_score,
                    issues_json: score.issues,
                    calculated_at: new Date().toISOString()
                }, {
                    onConflict: 'org_id,entity_type,entity_id'
                });
        }

        return NextResponse.json({
            success: true,
            message: `Calculated ${healthScores.length} health scores`,
            scores: healthScores
        });
    } catch (error) {
        console.error('Health calculation error:', error);
        return NextResponse.json({ success: false, error: 'Failed to calculate health scores' }, { status: 500 });
    }
}

interface HealthScore {
    entity_type: string;
    entity_id: string;
    overall_score: number;
    completeness_score: number;
    freshness_score: number;
    attribution_score: number;
    schema_score: number;
    issues: Array<{ type: string; severity: string; description: string }>;
}

function calculateHealthScores(ads: Array<{ ad_data: Record<string, unknown> }>, specificEntityId?: string): HealthScore[] {
    const scores: HealthScore[] = [];

    // Group ads by campaign
    const campaigns = new Map<string, Array<Record<string, unknown>>>();

    for (const ad of ads) {
        const data = ad.ad_data as Record<string, unknown>;
        const campaignId = (data.campaign_id as string) || 'unknown';

        if (specificEntityId && campaignId !== specificEntityId) continue;

        if (!campaigns.has(campaignId)) {
            campaigns.set(campaignId, []);
        }
        campaigns.get(campaignId)!.push(data);
    }

    // Calculate score for each campaign
    for (const [campaignId, campaignAds] of campaigns) {
        const issues: Array<{ type: string; severity: string; description: string }> = [];

        // Completeness: Check for required fields
        const requiredFields = ['name', 'status', 'spend', 'impressions', 'clicks'];
        let completenessScore = 100;
        for (const field of requiredFields) {
            const hasField = campaignAds.every(ad => ad[field] !== undefined && ad[field] !== null);
            if (!hasField) {
                completenessScore -= 15;
                issues.push({
                    type: 'missing_field',
                    severity: 'medium',
                    description: `Missing ${field} data in some ads`
                });
            }
        }
        completenessScore = Math.max(0, completenessScore);

        // Freshness: Check last update time
        let freshnessScore = 100;
        const lastUpdates = campaignAds
            .map(ad => ad.updated_time || ad.created_time)
            .filter(Boolean) as string[];

        if (lastUpdates.length > 0) {
            const mostRecent = new Date(Math.max(...lastUpdates.map(d => new Date(d).getTime())));
            const daysSinceUpdate = (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceUpdate > 7) {
                freshnessScore = 50;
                issues.push({
                    type: 'stale_data',
                    severity: 'medium',
                    description: `Data not updated in ${Math.round(daysSinceUpdate)} days`
                });
            } else if (daysSinceUpdate > 1) {
                freshnessScore = 80;
            }
        } else {
            freshnessScore = 60;
        }

        // Attribution: Check for conversion data
        let attributionScore = 100;
        const hasConversions = campaignAds.some(ad =>
            (ad.conversions as number) > 0 ||
            (ad.actions as unknown[])?.length > 0
        );

        if (!hasConversions) {
            attributionScore = 70;
            issues.push({
                type: 'no_conversions',
                severity: 'low',
                description: 'No conversion data available'
            });
        }

        // Schema: Check for expected structure
        let schemaScore = 100;
        const hasInsights = campaignAds.some(ad => ad.insights || ad.metrics);
        if (!hasInsights) {
            schemaScore = 80;
        }

        // Overall score (weighted average)
        const overallScore = Math.round(
            completenessScore * 0.35 +
            freshnessScore * 0.25 +
            attributionScore * 0.25 +
            schemaScore * 0.15
        );

        scores.push({
            entity_type: 'campaign',
            entity_id: campaignId,
            overall_score: overallScore,
            completeness_score: completenessScore,
            freshness_score: freshnessScore,
            attribution_score: attributionScore,
            schema_score: schemaScore,
            issues
        });
    }

    return scores;
}
