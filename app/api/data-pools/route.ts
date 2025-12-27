import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { autoCategorizePool } from '@/lib/ai/nvidia-ai';

// GET /api/data-pools - List available data pools with filtering
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        // Get filter parameters
        const industry = searchParams.get('industry');
        const platform = searchParams.get('platform');
        const audience = searchParams.get('audience');
        const format = searchParams.get('format');
        const userId = searchParams.get('userId'); // To check access status

        // Build query
        let query = supabase
            .from('data_pools')
            .select('*')
            .eq('is_public', true)
            .order('data_points', { ascending: false });

        // Apply filters
        if (industry) {
            query = query.eq('industry', industry);
        }
        if (platform) {
            query = query.eq('platform', platform);
        }
        if (audience) {
            query = query.eq('target_audience', audience);
        }
        if (format) {
            query = query.eq('creative_format', format);
        }

        const { data: pools, error } = await query;

        if (error) {
            console.error('Error fetching data pools:', error);
            return NextResponse.json({ error: 'Failed to fetch data pools' }, { status: 500 });
        }

        // If userId provided, fetch their access requests to show status
        let accessRequests: Record<string, { status: string; expiresAt: string | null }> = {};

        if (userId) {
            const { data: requests } = await supabase
                .from('data_access_requests')
                .select('pool_id, status, expires_at')
                .eq('user_id', userId);

            if (requests) {
                requests.forEach(req => {
                    accessRequests[req.pool_id] = {
                        status: req.status,
                        expiresAt: req.expires_at
                    };
                });
            }
        }

        // Enhance pools with access status
        const enhancedPools = pools?.map(pool => ({
            ...pool,
            accessStatus: accessRequests[pool.id]?.status || 'none',
            accessExpiresAt: accessRequests[pool.id]?.expiresAt || null
        }));

        return NextResponse.json({
            success: true,
            data: enhancedPools,
            count: enhancedPools?.length || 0
        });

    } catch (error) {
        console.error('Data pools API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/data-pools - Create a new data pool (admin only)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            name,
            slug,
            description,
            industry,
            targetAudience,
            platform,
            creativeFormat,
            isPublic = true,
            requiresApproval = true,
            accessTier = 'standard'
        } = body;

        if (!name || !slug) {
            return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
        }

        // AI Auto-categorization for missing fields
        let finalIndustry = industry;
        let finalPlatform = platform;
        let finalAudience = targetAudience;
        let finalFormat = creativeFormat;
        let aiSuggestedCategories = null;

        // If any category is missing, use AI to suggest them
        if (!industry || !platform || !targetAudience || !creativeFormat) {
            console.log('[Data Pools] Auto-categorizing pool:', name);
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
            finalAudience = targetAudience || aiCategories.target_audience;
            finalFormat = creativeFormat || aiCategories.creative_format;

            console.log('[Data Pools] AI suggested categories:', aiSuggestedCategories);
        }

        const { data, error } = await supabase
            .from('data_pools')
            .insert({
                name,
                slug,
                description,
                industry: finalIndustry,
                target_audience: finalAudience,
                platform: finalPlatform,
                creative_format: finalFormat,
                is_public: isPublic,
                requires_approval: requiresApproval,
                access_tier: accessTier
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating data pool:', error);
            return NextResponse.json({ error: 'Failed to create data pool' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data,
            aiSuggested: aiSuggestedCategories, // Return AI suggestions info
        });

    } catch (error) {
        console.error('Create data pool error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

