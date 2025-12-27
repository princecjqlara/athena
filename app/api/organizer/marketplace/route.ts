import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { autoCategorizePool } from '@/lib/ai/nvidia-ai';

/**
 * GET /api/organizer/marketplace
 * Get all data pools for organizer management
 */
export async function GET(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    try {
        // Get all data pools with stats
        const { data: pools, error } = await supabase
            .from('data_pools')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get pending request counts for each pool
        const { data: requestCounts } = await supabase
            .from('data_access_requests')
            .select('pool_id, status');

        const poolsWithCounts = (pools || []).map(pool => {
            const poolRequests = (requestCounts || []).filter(r => r.pool_id === pool.id);
            return {
                ...pool,
                pending_requests: poolRequests.filter(r => r.status === 'pending').length,
                approved_requests: poolRequests.filter(r => r.status === 'approved').length,
                total_requests: poolRequests.length,
            };
        });

        return NextResponse.json({
            success: true,
            data: poolsWithCounts,
        });
    } catch (error) {
        console.error('[Organizer] Error fetching marketplace data:', error);
        return NextResponse.json({ error: 'Failed to fetch marketplace data' }, { status: 500 });
    }
}

/**
 * POST /api/organizer/marketplace
 * Create a new data pool with AI auto-categorization
 */
export async function POST(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { name, description, industry, target_audience, platform, creative_format, access_tier } = body;

        if (!name) {
            return NextResponse.json({ error: 'Pool name is required' }, { status: 400 });
        }

        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // AI Auto-categorization for missing fields
        let finalIndustry = industry;
        let finalPlatform = platform;
        let finalAudience = target_audience;
        let finalFormat = creative_format;
        let aiSuggestedCategories = null;

        // If any category is missing, use AI to suggest them
        if (!industry || !platform || !target_audience || !creative_format) {
            console.log('[Organizer Marketplace] Auto-categorizing pool:', name);
            const aiCategories = await autoCategorizePool(name, description);

            aiSuggestedCategories = {
                industry: aiCategories.industry,
                platform: aiCategories.platform,
                target_audience: aiCategories.target_audience,
                creative_format: aiCategories.creative_format,
                confidence: aiCategories.confidence,
            };

            // Use AI suggestions for missing fields only
            finalIndustry = industry || aiCategories.industry;
            finalPlatform = platform || aiCategories.platform;
            finalAudience = target_audience || aiCategories.target_audience;
            finalFormat = creative_format || aiCategories.creative_format;

            console.log('[Organizer Marketplace] AI suggested categories:', aiSuggestedCategories);
        }

        const { data: pool, error } = await supabase
            .from('data_pools')
            .insert({
                name,
                slug,
                description,
                industry: finalIndustry,
                target_audience: finalAudience,
                platform: finalPlatform,
                creative_format: finalFormat,
                access_tier: access_tier || 'standard',
                is_public: true,
                requires_approval: true,
                data_points: 0,
                contributors: 0,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: pool,
            aiSuggested: aiSuggestedCategories, // Return AI suggestions info
            message: aiSuggestedCategories
                ? `Data pool created. AI auto-filled categories with ${aiSuggestedCategories.confidence}% confidence.`
                : 'Data pool created successfully',
        });
    } catch (error) {
        console.error('[Organizer] Error creating data pool:', error);
        return NextResponse.json({ error: 'Failed to create data pool' }, { status: 500 });
    }
}

/**
 * DELETE /api/organizer/marketplace
 * Delete a data pool
 */
export async function DELETE(request: NextRequest) {
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const poolId = searchParams.get('poolId');

        if (!poolId) {
            return NextResponse.json({ error: 'Pool ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('data_pools')
            .delete()
            .eq('id', poolId);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: 'Data pool deleted successfully',
        });
    } catch (error) {
        console.error('[Organizer] Error deleting data pool:', error);
        return NextResponse.json({ error: 'Failed to delete data pool' }, { status: 500 });
    }
}
