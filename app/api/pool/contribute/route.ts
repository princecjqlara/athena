// POST /api/pool/contribute
// Upload anonymized ad insights to the public pool

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Rate limiting (simple in-memory for demo)
const contributionCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_CONTRIBUTIONS_PER_HOUR = 100;

function checkRateLimit(contributorHash: string): boolean {
    const now = Date.now();
    const record = contributionCounts.get(contributorHash);

    if (!record || record.resetAt < now) {
        contributionCounts.set(contributorHash, { count: 1, resetAt: now + 3600000 });
        return true;
    }

    if (record.count >= MAX_CONTRIBUTIONS_PER_HOUR) {
        return false;
    }

    record.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { insights, contributorHash } = body;

        // Validation
        if (!insights || !Array.isArray(insights) || insights.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Insights array is required' },
                { status: 400 }
            );
        }

        if (!contributorHash || typeof contributorHash !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Contributor hash is required' },
                { status: 400 }
            );
        }

        // Rate limiting
        if (!checkRateLimit(contributorHash)) {
            return NextResponse.json(
                { success: false, error: 'Rate limit exceeded. Max 100 contributions per hour.' },
                { status: 429 }
            );
        }

        // Validate each insight
        for (const insight of insights) {
            if (!insight.traits || !Array.isArray(insight.traits)) {
                return NextResponse.json(
                    { success: false, error: 'Each insight must have a traits array' },
                    { status: 400 }
                );
            }
            if (typeof insight.zScore !== 'number') {
                return NextResponse.json(
                    { success: false, error: 'Each insight must have a numeric zScore' },
                    { status: 400 }
                );
            }
            // Validate Z-score range (reasonable bounds)
            if (insight.zScore < -5 || insight.zScore > 5) {
                return NextResponse.json(
                    { success: false, error: 'Z-score must be between -5 and 5' },
                    { status: 400 }
                );
            }
        }

        // Connect to Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { success: false, error: 'Database not configured' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Transform insights to database format
        const records = insights.map((insight: {
            traits: string[];
            zScore: number;
            industry?: string;
        }) => ({
            contributor_hash: contributorHash,
            feature_name: insight.traits.join(','),
            weight_delta: insight.zScore,
            outcome_positive: insight.zScore > 0,
            confidence: Math.min(1, Math.abs(insight.zScore) / 2),
            category: insight.industry || 'general',
            is_surprise: Math.abs(insight.zScore) > 1.5,
            surprise_magnitude: Math.abs(insight.zScore) > 1.5 ? insight.zScore : null,
            contributed_at: new Date().toISOString().split('T')[0],
        }));

        // Insert into database
        const { error, count } = await supabase
            .from('user_contributions')
            .insert(records);

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to save contributions' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Contributions saved successfully',
            count: count || insights.length,
        });

    } catch (error) {
        console.error('Error in contribute API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Return API info
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/pool/contribute',
        method: 'POST',
        description: 'Upload anonymized ad insights to the public pool',
        body: {
            insights: [
                {
                    traits: ['hook:curiosity', 'platform:tiktok', 'ugc:yes'],
                    zScore: 1.2,
                    industry: 'ecommerce',
                }
            ],
            contributorHash: 'anon-abc123',
        },
        rateLimit: '100 contributions per hour per contributor',
    });
}
