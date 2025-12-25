// GET /api/pool/patterns
// Fetch community patterns from the public pool

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const industry = searchParams.get('industry') || undefined;
        const minSampleSize = parseInt(searchParams.get('minSampleSize') || '10');
        const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.3');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        const sortBy = searchParams.get('sortBy') || 'avg_weight';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const traits = searchParams.get('traits'); // Comma-separated traits to search

        // Connect to Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { success: false, error: 'Database not configured' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Build query
        let query = supabase
            .from('collective_priors')
            .select('*', { count: 'exact' })
            .gte('contribution_count', minSampleSize)
            .gte('confidence', minConfidence);

        if (industry) {
            query = query.eq('category', industry);
        }

        if (traits) {
            // Search for patterns containing specific traits
            const traitList = traits.split(',');
            query = query.or(traitList.map(t => `feature_name.ilike.%${t.trim()}%`).join(','));
        }

        // Map sortBy to column names
        const validColumns = ['avg_weight', 'contribution_count', 'confidence', 'last_updated_at'];
        const sortColumn = validColumns.includes(sortBy) ? sortBy : 'avg_weight';

        query = query
            .order(sortColumn, { ascending: sortOrder === 'asc' })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch patterns' },
                { status: 500 }
            );
        }

        // Transform to response format
        const patterns = (data || []).map(row => ({
            traits: row.feature_name.split(',').filter(Boolean),
            avgZScore: row.avg_weight,
            sampleSize: row.contribution_count,
            confidence: row.confidence,
            positiveOutcomes: row.positive_outcomes,
            negativeOutcomes: row.negative_outcomes,
            trendDirection: getTrendDirection(row.positive_outcomes, row.negative_outcomes),
            category: row.category,
            lastUpdated: row.last_updated_at,
        }));

        return NextResponse.json({
            success: true,
            patterns,
            pagination: {
                total: count || 0,
                offset,
                limit,
                hasMore: (offset + limit) < (count || 0),
            },
        });

    } catch (error) {
        console.error('Error in patterns API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function getTrendDirection(positive: number, negative: number): 'rising' | 'falling' | 'stable' {
    const total = positive + negative;
    if (total < 10) return 'stable';

    const positiveRatio = positive / total;
    if (positiveRatio > 0.6) return 'rising';
    if (positiveRatio < 0.4) return 'falling';
    return 'stable';
}
