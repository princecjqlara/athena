// POST /api/pool/seed
// Seed the collective_priors table with ad trait patterns from localStorage ads
// This populates the Galaxy Orbs visualization

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AdTrait {
    feature_name: string;
    weight_delta: number;
    outcome_positive: boolean;
    category: string;
}

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ads, contributorHash } = body;

        if (!ads || !Array.isArray(ads) || ads.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Ads array is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseClient();
        const contributions: AdTrait[] = [];
        const today = new Date().toISOString().split('T')[0];

        // Extract traits from each ad
        for (const ad of ads) {
            const content = ad.extractedContent || {};
            const insights = ad.adInsights || {};
            
            // Calculate success score (0-100 scale, converted to z-score)
            const successScore = ad.successScore || 
                (insights.ctr ? Math.min(100, Math.round(insights.ctr * 20)) : 50);
            
            // Convert success score to z-score (-2 to +2 range)
            const zScore = ((successScore - 50) / 25);

            // Extract traits from extractedContent
            const traits: string[] = [];

            // Core traits
            if (content.hookType) traits.push(`hook:${content.hookType}`);
            if (content.platform) traits.push(`platform:${content.platform}`);
            if (content.contentCategory) traits.push(`category:${content.contentCategory}`);
            if (content.editingStyle) traits.push(`editing:${content.editingStyle}`);
            if (content.colorScheme) traits.push(`color:${content.colorScheme}`);
            if (content.musicType) traits.push(`music:${content.musicType}`);
            if (content.hasSubtitles) traits.push('subtitles:yes');
            if (content.isUGCStyle) traits.push('ugc:yes');
            if (content.hasVoiceover) traits.push('voiceover:yes');
            if (content.mediaType) traits.push(`media:${content.mediaType}`);
            
            // Extended traits
            if (content.ctaType) traits.push(`cta:${content.ctaType}`);
            if (content.pacing) traits.push(`pacing:${content.pacing}`);
            if (content.tone) traits.push(`tone:${content.tone}`);
            if (content.visualStyle) traits.push(`visual:${content.visualStyle}`);

            // Add custom traits
            if (ad.traits && Array.isArray(ad.traits)) {
                ad.traits.forEach((t: string) => {
                    if (t && !traits.includes(t)) traits.push(t);
                });
            }

            // Add categories as traits
            if (ad.categories && Array.isArray(ad.categories)) {
                ad.categories.forEach((c: string) => {
                    if (c) traits.push(`category:${c.toLowerCase()}`);
                });
            }

            // Create contribution for combined traits (the pattern)
            if (traits.length > 0) {
                contributions.push({
                    feature_name: traits.slice(0, 5).join(','), // Limit to 5 traits per pattern
                    weight_delta: zScore,
                    outcome_positive: zScore > 0,
                    category: content.industry || 'general',
                });

                // Also contribute individual traits
                traits.forEach(trait => {
                    contributions.push({
                        feature_name: trait,
                        weight_delta: zScore,
                        outcome_positive: zScore > 0,
                        category: content.industry || 'general',
                    });
                });
            }
        }

        if (contributions.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No traits could be extracted from ads' },
                { status: 400 }
            );
        }

        // Insert contributions to user_contributions table
        const records = contributions.map(c => ({
            contributor_hash: contributorHash || `anon_${Date.now()}`,
            feature_name: c.feature_name,
            weight_delta: c.weight_delta,
            outcome_positive: c.outcome_positive,
            confidence: Math.min(1, Math.abs(c.weight_delta) / 2),
            category: c.category,
            is_surprise: Math.abs(c.weight_delta) > 1.5,
            surprise_magnitude: Math.abs(c.weight_delta) > 1.5 ? c.weight_delta : null,
            contributed_at: today,
        }));

        const { error: insertError } = await supabase
            .from('user_contributions')
            .insert(records);

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json(
                { success: false, error: 'Failed to insert contributions: ' + insertError.message },
                { status: 500 }
            );
        }

        // Now aggregate into collective_priors
        const featureAggregates = new Map<string, {
            sum: number;
            count: number;
            positive: number;
            negative: number;
            category: string;
        }>();

        contributions.forEach(c => {
            const existing = featureAggregates.get(c.feature_name) || {
                sum: 0, count: 0, positive: 0, negative: 0, category: c.category
            };
            existing.sum += c.weight_delta;
            existing.count += 1;
            if (c.outcome_positive) existing.positive += 1;
            else existing.negative += 1;
            featureAggregates.set(c.feature_name, existing);
        });

        // Upsert to collective_priors
        let priorsUpdated = 0;
        for (const [feature, agg] of featureAggregates) {
            // First check if exists
            const { data: existing } = await supabase
                .from('collective_priors')
                .select('*')
                .eq('feature_name', feature)
                .single();

            if (existing) {
                // Update existing
                const newCount = existing.contribution_count + agg.count;
                const newSum = existing.weight_sum + agg.sum;
                const { error } = await supabase
                    .from('collective_priors')
                    .update({
                        weight_sum: newSum,
                        contribution_count: newCount,
                        avg_weight: newSum / newCount,
                        confidence: Math.min(1, newCount / 50), // Faster confidence buildup for demo
                        positive_outcomes: existing.positive_outcomes + agg.positive,
                        negative_outcomes: existing.negative_outcomes + agg.negative,
                        last_updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (!error) priorsUpdated++;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('collective_priors')
                    .insert({
                        feature_name: feature,
                        category: agg.category,
                        weight_sum: agg.sum,
                        contribution_count: agg.count,
                        avg_weight: agg.sum / agg.count,
                        confidence: Math.min(1, agg.count / 50),
                        positive_outcomes: agg.positive,
                        negative_outcomes: agg.negative,
                        last_updated_at: new Date().toISOString(),
                    });

                if (!error) priorsUpdated++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Seeded ${priorsUpdated} patterns from ${ads.length} ads`,
            stats: {
                adsProcessed: ads.length,
                contributionsCreated: contributions.length,
                patternsSeeded: priorsUpdated,
            }
        });

    } catch (error) {
        console.error('Seed API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        endpoint: '/api/pool/seed',
        method: 'POST',
        description: 'Seed the collective_priors table with ad trait patterns',
        body: {
            ads: '[array of ad objects from localStorage]',
            contributorHash: 'optional anonymous identifier',
        },
    });
}

