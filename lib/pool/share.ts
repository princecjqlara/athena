// Pool Sharing Module
// Share ad data to marketplace pools with auto-recalculation

import { supabase } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export interface ShareResult {
    success: boolean;
    message: string;
    contributionId?: string;
    poolStats?: {
        dataPoints: number;
        contributors: number;
        avgSuccessRate: number | null;
        avgCtr: number | null;
        avgRoas: number | null;
    };
}

export interface PoolContribution {
    id: string;
    userId: string;
    poolId: string;
    adId: string;
    successScore: number | null;
    ctr: number | null;
    roas: number | null;
    impressions: number | null;
    spend: number | null;
    conversions: number | null;
    traits: string[];
    industry: string | null;
    platform: string | null;
    creativeFormat: string | null;
    sharedAt: string;
}

// ============================================
// SHARE FUNCTIONS
// ============================================

/**
 * Share an ad to a data pool
 * Fetches ad data, inserts contribution, and recalculates pool stats
 */
export async function shareAdToPool(
    userId: string,
    poolId: string,
    adId: string
): Promise<ShareResult> {
    try {
        // 1. Fetch the ad data
        const { data: ad, error: adError } = await supabase
            .from('ads')
            .select('*')
            .eq('id', adId)
            .single();

        if (adError || !ad) {
            return { success: false, message: 'Ad not found' };
        }

        // 2. Fetch ad insights
        const { data: insights } = await supabase
            .from('ad_insights')
            .select('*')
            .eq('ad_id', adId)
            .single();

        // 3. Build contribution data
        const extractedContent = ad.extracted_content || {};
        const traits = [
            ...(ad.traits || []),
            extractedContent.hookType ? `hook:${extractedContent.hookType}` : null,
            extractedContent.platform ? `platform:${extractedContent.platform}` : null,
            extractedContent.contentCategory ? `category:${extractedContent.contentCategory}` : null,
            extractedContent.editingStyle ? `style:${extractedContent.editingStyle}` : null,
            extractedContent.isUGC ? 'ugc:yes' : null,
            extractedContent.hasSubtitles ? 'subtitles:yes' : null,
            extractedContent.hasVoiceover ? 'voiceover:yes' : null,
        ].filter(Boolean);

        const contribution = {
            user_id: userId,
            pool_id: poolId,
            ad_id: adId,
            success_score: ad.success_score || null,
            ctr: insights?.ctr || null,
            roas: insights?.purchase_roas || null,
            impressions: insights?.impressions || null,
            spend: insights?.spend || null,
            conversions: insights?.conversions || insights?.purchases || null,
            traits: traits,
            industry: extractedContent.industry || null,
            platform: extractedContent.platform || null,
            creative_format: extractedContent.contentCategory || null,
        };

        // 4. Insert contribution
        const { data: insertedContribution, error: insertError } = await supabase
            .from('pool_contributions')
            .insert(contribution)
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') { // Unique constraint violation
                return { success: false, message: 'Ad already shared to this pool' };
            }
            console.error('Insert error:', insertError);
            return { success: false, message: 'Failed to share ad' };
        }

        // 5. Recalculate pool stats
        const { error: recalcError } = await supabase.rpc('recalculate_pool_stats', {
            p_pool_id: poolId
        });

        if (recalcError) {
            console.error('Recalculation error:', recalcError);
            // Don't fail - contribution was saved
        }

        // 6. Fetch updated pool stats
        const { data: pool } = await supabase
            .from('data_pools')
            .select('data_points, contributors, avg_success_rate, avg_ctr, avg_roas')
            .eq('id', poolId)
            .single();

        return {
            success: true,
            message: 'Ad shared successfully',
            contributionId: insertedContribution.id,
            poolStats: pool ? {
                dataPoints: pool.data_points,
                contributors: pool.contributors,
                avgSuccessRate: pool.avg_success_rate,
                avgCtr: pool.avg_ctr,
                avgRoas: pool.avg_roas,
            } : undefined,
        };

    } catch (error) {
        console.error('Share error:', error);
        return { success: false, message: 'Internal error sharing ad' };
    }
}

/**
 * Remove an ad share from a pool (with recalculation)
 */
export async function unshareFromPool(
    userId: string,
    poolId: string,
    adId: string
): Promise<ShareResult> {
    try {
        // 1. Delete the contribution
        const { error: deleteError } = await supabase
            .from('pool_contributions')
            .delete()
            .eq('user_id', userId)
            .eq('pool_id', poolId)
            .eq('ad_id', adId);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return { success: false, message: 'Failed to remove share' };
        }

        // 2. Recalculate pool stats
        await supabase.rpc('recalculate_pool_stats', { p_pool_id: poolId });

        return { success: true, message: 'Share removed successfully' };

    } catch (error) {
        console.error('Unshare error:', error);
        return { success: false, message: 'Internal error removing share' };
    }
}

/**
 * Get all shares by a user
 */
export async function getUserShares(userId: string): Promise<{
    success: boolean;
    shares: PoolContribution[];
}> {
    try {
        const { data, error } = await supabase
            .from('pool_contributions')
            .select('*')
            .eq('user_id', userId)
            .order('shared_at', { ascending: false });

        if (error) {
            console.error('Get shares error:', error);
            return { success: false, shares: [] };
        }

        const shares: PoolContribution[] = (data || []).map(c => ({
            id: c.id,
            userId: c.user_id,
            poolId: c.pool_id,
            adId: c.ad_id,
            successScore: c.success_score,
            ctr: c.ctr,
            roas: c.roas,
            impressions: c.impressions,
            spend: c.spend,
            conversions: c.conversions,
            traits: c.traits || [],
            industry: c.industry,
            platform: c.platform,
            creativeFormat: c.creative_format,
            sharedAt: c.shared_at,
        }));

        return { success: true, shares };

    } catch (error) {
        console.error('Get shares error:', error);
        return { success: false, shares: [] };
    }
}

/**
 * Get all contributions to a pool
 */
export async function getPoolContributions(poolId: string): Promise<{
    success: boolean;
    contributions: PoolContribution[];
    count: number;
}> {
    try {
        const { data, error, count } = await supabase
            .from('pool_contributions')
            .select('*', { count: 'exact' })
            .eq('pool_id', poolId)
            .order('shared_at', { ascending: false });

        if (error) {
            console.error('Get pool contributions error:', error);
            return { success: false, contributions: [], count: 0 };
        }

        const contributions: PoolContribution[] = (data || []).map(c => ({
            id: c.id,
            userId: c.user_id,
            poolId: c.pool_id,
            adId: c.ad_id,
            successScore: c.success_score,
            ctr: c.ctr,
            roas: c.roas,
            impressions: c.impressions,
            spend: c.spend,
            conversions: c.conversions,
            traits: c.traits || [],
            industry: c.industry,
            platform: c.platform,
            creativeFormat: c.creative_format,
            sharedAt: c.shared_at,
        }));

        return { success: true, contributions, count: count || 0 };

    } catch (error) {
        console.error('Get pool contributions error:', error);
        return { success: false, contributions: [], count: 0 };
    }
}

/**
 * Check if user has shared a specific ad to a pool
 */
export async function hasSharedAd(
    userId: string,
    poolId: string,
    adId: string
): Promise<boolean> {
    try {
        const { data } = await supabase
            .from('pool_contributions')
            .select('id')
            .eq('user_id', userId)
            .eq('pool_id', poolId)
            .eq('ad_id', adId)
            .single();

        return !!data;
    } catch {
        return false;
    }
}
