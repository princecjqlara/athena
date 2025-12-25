/**
 * Collective Intelligence Library
 * 
 * Provides opt-in shared learning across users while preserving privacy.
 * Only abstracted feature signals are shared - never raw creatives or advertiser identity.
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// INTERFACES
// ============================================

export interface CollectivePrior {
    feature_name: string;
    category: string;
    avg_weight: number;
    confidence: number;
    contribution_count: number;
    lift_percentage: number;
}

export interface UserContribution {
    feature_name: string;
    weight_delta: number;
    outcome_positive: boolean;
    confidence: number;
    category?: string;
    is_surprise?: boolean;
    surprise_magnitude?: number;
}

export interface CISettings {
    user_id: string;
    opted_in: boolean;
    participation_mode: 'private' | 'contribute_receive' | 'receive_only';
    local_data_points: number;
    local_conversions: number;
    share_category: boolean;
    contributor_hash?: string;
}

export interface BlendedWeight {
    feature_name: string;
    local_weight: number;
    collective_weight: number;
    blended_weight: number;
    blend_ratio: number; // 0 = all collective, 1 = all local
}

// ============================================
// CONSTANTS
// ============================================

const MIN_CONTRIBUTIONS_FOR_PRIOR = 10; // Minimum contributions before a prior is used
const DATA_POINTS_FOR_FULL_LOCAL = 100; // After this many data points, local dominates
const BASE_COLLECTIVE_WEIGHT = 0.8; // Starting collective influence for cold-start

// ============================================
// COLLECTIVE PRIORS
// ============================================

export const collectivePriors = {
    /**
     * Get all collective priors, optionally filtered by category
     */
    async getAll(category?: string): Promise<CollectivePrior[]> {
        if (!isSupabaseConfigured()) return [];

        let query = supabase
            .from('collective_priors')
            .select('*')
            .gte('contribution_count', MIN_CONTRIBUTIONS_FOR_PRIOR);

        if (category && category !== 'general') {
            query = query.or(`category.eq.${category},category.eq.general`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[CI] Error fetching priors:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Get prior for a specific feature
     */
    async getByFeature(featureName: string, category?: string): Promise<CollectivePrior | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('collective_priors')
            .select('*')
            .eq('feature_name', featureName)
            .gte('contribution_count', MIN_CONTRIBUTIONS_FOR_PRIOR)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[CI] Error fetching prior:', error);
        }

        return data || null;
    },

    /**
     * Get top performing features from collective
     */
    async getTopFeatures(limit: number = 10, category?: string): Promise<CollectivePrior[]> {
        if (!isSupabaseConfigured()) return [];

        let query = supabase
            .from('collective_priors')
            .select('*')
            .gte('contribution_count', MIN_CONTRIBUTIONS_FOR_PRIOR)
            .order('lift_percentage', { ascending: false })
            .limit(limit);

        if (category && category !== 'general') {
            query = query.or(`category.eq.${category},category.eq.general`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[CI] Error fetching top features:', error);
            return [];
        }

        return data || [];
    },
};

// ============================================
// WEIGHT BLENDING
// ============================================

/**
 * Calculate the blend ratio based on local data points
 * Returns a value between 0 (all collective) and 1 (all local)
 */
export function calculateBlendRatio(localDataPoints: number): number {
    // Linear interpolation from BASE_COLLECTIVE_WEIGHT to 0.95 (always keep 5% collective)
    const alpha = Math.min(localDataPoints / DATA_POINTS_FOR_FULL_LOCAL, 1);
    return alpha * 0.95 + (1 - alpha) * (1 - BASE_COLLECTIVE_WEIGHT);
}

/**
 * Blend local weight with collective prior
 */
export function blendWeight(
    localWeight: number,
    collectiveWeight: number,
    localDataPoints: number
): BlendedWeight {
    const blendRatio = calculateBlendRatio(localDataPoints);
    const blended = (blendRatio * localWeight) + ((1 - blendRatio) * collectiveWeight);

    return {
        feature_name: '', // Set by caller
        local_weight: localWeight,
        collective_weight: collectiveWeight,
        blended_weight: blended,
        blend_ratio: blendRatio,
    };
}

/**
 * Get blended weights for all features
 */
export async function getBlendedWeights(
    localWeights: Record<string, number>,
    localDataPoints: number,
    category?: string
): Promise<Record<string, BlendedWeight>> {
    const priors = await collectivePriors.getAll(category);
    const priorsMap = new Map(priors.map(p => [p.feature_name, p.avg_weight]));
    const blendedWeights: Record<string, BlendedWeight> = {};

    // Blend each local weight
    for (const [feature, localWeight] of Object.entries(localWeights)) {
        const collectiveWeight = priorsMap.get(feature) ?? localWeight; // Default to local if no prior
        const blended = blendWeight(localWeight, collectiveWeight, localDataPoints);
        blended.feature_name = feature;
        blendedWeights[feature] = blended;
    }

    // Add any priors that aren't in local weights (for cold-start)
    for (const prior of priors) {
        if (!blendedWeights[prior.feature_name]) {
            const blended = blendWeight(0, prior.avg_weight, localDataPoints);
            blended.feature_name = prior.feature_name;
            blendedWeights[prior.feature_name] = blended;
        }
    }

    return blendedWeights;
}

// ============================================
// CONTRIBUTIONS
// ============================================

/**
 * Generate an anonymized contributor hash
 * Rotates periodically for enhanced privacy
 */
function generateContributorHash(): string {
    const random = Math.random().toString(36).substring(2, 15);
    const time = Date.now().toString(36);
    return `anon_${random}_${time}`;
}

/**
 * Submit a contribution (anonymized)
 */
export async function submitContribution(
    contributorHash: string,
    contribution: UserContribution
): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase.from('user_contributions').insert({
        contributor_hash: contributorHash,
        feature_name: contribution.feature_name,
        weight_delta: contribution.weight_delta,
        outcome_positive: contribution.outcome_positive,
        confidence: contribution.confidence,
        category: contribution.category || 'general',
        is_surprise: contribution.is_surprise || false,
        surprise_magnitude: contribution.surprise_magnitude,
    });

    if (error) {
        console.error('[CI] Error submitting contribution:', error);
        return false;
    }

    // Update the collective prior
    await updateCollectivePrior(contribution);

    return true;
}

/**
 * Update collective prior based on new contribution
 */
async function updateCollectivePrior(contribution: UserContribution): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { feature_name, weight_delta, outcome_positive, category } = contribution;

    // Check if prior exists
    const { data: existing } = await supabase
        .from('collective_priors')
        .select('*')
        .eq('feature_name', feature_name)
        .single();

    if (existing) {
        // Update existing prior
        const newCount = existing.contribution_count + 1;
        const newWeightSum = existing.weight_sum + weight_delta;
        const newAvgWeight = newWeightSum / newCount;
        const newPositive = existing.positive_outcomes + (outcome_positive ? 1 : 0);
        const newNegative = existing.negative_outcomes + (outcome_positive ? 0 : 1);
        const totalOutcomes = newPositive + newNegative;
        const newLift = totalOutcomes > 0 ? ((newPositive / totalOutcomes) - 0.5) * 100 : 0;
        const newConfidence = Math.min(newCount / 100, 1); // Confidence grows with contributions

        await supabase
            .from('collective_priors')
            .update({
                weight_sum: newWeightSum,
                contribution_count: newCount,
                avg_weight: newAvgWeight,
                positive_outcomes: newPositive,
                negative_outcomes: newNegative,
                lift_percentage: newLift,
                confidence: newConfidence,
                last_updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
    } else {
        // Create new prior
        await supabase.from('collective_priors').insert({
            feature_name,
            category: category || 'general',
            weight_sum: weight_delta,
            contribution_count: 1,
            avg_weight: weight_delta,
            positive_outcomes: outcome_positive ? 1 : 0,
            negative_outcomes: outcome_positive ? 0 : 1,
            lift_percentage: outcome_positive ? 50 : -50,
            confidence: 0.01,
        });
    }
}

// ============================================
// USER SETTINGS
// ============================================

export const ciSettings = {
    /**
     * Get user's CI settings
     */
    async get(userId: string): Promise<CISettings | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('user_ci_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[CI] Error fetching settings:', error);
        }

        return data || null;
    },

    /**
     * Create or update user's CI settings
     */
    async upsert(settings: Partial<CISettings> & { user_id: string }): Promise<CISettings | null> {
        if (!isSupabaseConfigured()) return null;

        // Generate hash if opting in and no hash exists
        if (settings.opted_in && !settings.contributor_hash) {
            settings.contributor_hash = generateContributorHash();
        }

        const { data, error } = await supabase
            .from('user_ci_settings')
            .upsert({
                ...settings,
                opted_in_at: settings.opted_in ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[CI] Error upserting settings:', error);
            return null;
        }

        return data;
    },

    /**
     * Increment local data points count
     */
    async incrementDataPoints(userId: string, isConversion: boolean = false): Promise<void> {
        if (!isSupabaseConfigured()) return;

        const current = await this.get(userId);
        if (!current) return;

        await supabase
            .from('user_ci_settings')
            .update({
                local_data_points: current.local_data_points + 1,
                local_conversions: current.local_conversions + (isConversion ? 1 : 0),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
    },
};

// ============================================
// STATISTICS
// ============================================

export const ciStats = {
    /**
     * Get collective intelligence statistics
     */
    async getStats(): Promise<{
        totalContributions: number;
        totalFeatures: number;
        topFeatures: CollectivePrior[];
        avgConfidence: number;
    }> {
        if (!isSupabaseConfigured()) {
            return { totalContributions: 0, totalFeatures: 0, topFeatures: [], avgConfidence: 0 };
        }

        // Get total contributions
        const { count: totalContributions } = await supabase
            .from('user_contributions')
            .select('*', { count: 'exact', head: true });

        // Get priors stats
        const { data: priors } = await supabase
            .from('collective_priors')
            .select('*')
            .gte('contribution_count', MIN_CONTRIBUTIONS_FOR_PRIOR);

        const topFeatures = await collectivePriors.getTopFeatures(5);
        const avgConfidence = priors && priors.length > 0
            ? priors.reduce((sum, p) => sum + (p.confidence || 0), 0) / priors.length
            : 0;

        return {
            totalContributions: totalContributions || 0,
            totalFeatures: priors?.length || 0,
            topFeatures,
            avgConfidence,
        };
    },
};
