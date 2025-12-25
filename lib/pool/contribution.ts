// Public Pool - Contribution Module
// Push anonymized data to Supabase public pool

import { createClient } from '@supabase/supabase-js';
import { AnonymizedInsight, getPoolOptInStatus, anonymizeAdInsight } from './anonymizer';
import { AdEntry, ExtractedResultsData } from '@/types';

// ============================================
// TYPES
// ============================================

export interface ContributionResult {
    success: boolean;
    contributedCount: number;
    errors?: string[];
    contributionId?: string;
}

export interface ContributionStats {
    totalContributed: number;
    lastContributedAt: string | null;
    contributionHistory: Array<{
        date: string;
        count: number;
    }>;
}

// ============================================
// STORAGE
// ============================================

const CONTRIBUTION_STATS_KEY = 'pool_contribution_stats';

function getContributionStats(): ContributionStats {
    if (typeof window === 'undefined') {
        return { totalContributed: 0, lastContributedAt: null, contributionHistory: [] };
    }
    const stored = localStorage.getItem(CONTRIBUTION_STATS_KEY);
    return stored ? JSON.parse(stored) : { totalContributed: 0, lastContributedAt: null, contributionHistory: [] };
}

function saveContributionStats(stats: ContributionStats): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONTRIBUTION_STATS_KEY, JSON.stringify(stats));
}

// ============================================
// SUPABASE CLIENT
// ============================================

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
}

// ============================================
// CONTRIBUTION FUNCTIONS
// ============================================

/**
 * Contribute a single anonymized insight to the public pool
 */
export async function contributeInsight(
    insight: AnonymizedInsight
): Promise<ContributionResult> {
    try {
        const supabase = getSupabaseClient();

        // Insert into user_contributions table
        const { error } = await supabase
            .from('user_contributions')
            .insert({
                contributor_hash: insight.contributorHash,
                feature_name: insight.traits.join(','),
                weight_delta: insight.zScore,
                outcome_positive: insight.zScore > 0,
                confidence: Math.min(1, Math.abs(insight.zScore) / 2),
                category: insight.industry || 'general',
                is_surprise: Math.abs(insight.zScore) > 1.5,
                surprise_magnitude: Math.abs(insight.zScore) > 1.5 ? insight.zScore : null,
                contributed_at: insight.contributedDate,
            });

        if (error) {
            return { success: false, contributedCount: 0, errors: [error.message] };
        }

        // Update local stats
        const stats = getContributionStats();
        stats.totalContributed += 1;
        stats.lastContributedAt = new Date().toISOString();

        // Add to history
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = stats.contributionHistory.find(h => h.date === today);
        if (todayEntry) {
            todayEntry.count += 1;
        } else {
            stats.contributionHistory.push({ date: today, count: 1 });
        }

        saveContributionStats(stats);

        return { success: true, contributedCount: 1 };
    } catch (err) {
        return {
            success: false,
            contributedCount: 0,
            errors: [err instanceof Error ? err.message : 'Unknown error']
        };
    }
}

/**
 * Contribute multiple insights in batch
 */
export async function contributeMultipleInsights(
    insights: AnonymizedInsight[]
): Promise<ContributionResult> {
    try {
        const supabase = getSupabaseClient();

        // Transform insights to database format
        const records = insights.map(insight => ({
            contributor_hash: insight.contributorHash,
            feature_name: insight.traits.join(','),
            weight_delta: insight.zScore,
            outcome_positive: insight.zScore > 0,
            confidence: Math.min(1, Math.abs(insight.zScore) / 2),
            category: insight.industry || 'general',
            is_surprise: Math.abs(insight.zScore) > 1.5,
            surprise_magnitude: Math.abs(insight.zScore) > 1.5 ? insight.zScore : null,
            contributed_at: insight.contributedDate,
        }));

        // Batch insert
        const { error, count } = await supabase
            .from('user_contributions')
            .insert(records);

        if (error) {
            return { success: false, contributedCount: 0, errors: [error.message] };
        }

        // Update local stats
        const stats = getContributionStats();
        stats.totalContributed += insights.length;
        stats.lastContributedAt = new Date().toISOString();

        const today = new Date().toISOString().split('T')[0];
        const todayEntry = stats.contributionHistory.find(h => h.date === today);
        if (todayEntry) {
            todayEntry.count += insights.length;
        } else {
            stats.contributionHistory.push({ date: today, count: insights.length });
        }

        saveContributionStats(stats);

        return { success: true, contributedCount: count || insights.length };
    } catch (err) {
        return {
            success: false,
            contributedCount: 0,
            errors: [err instanceof Error ? err.message : 'Unknown error']
        };
    }
}

/**
 * Contribute an ad with results (handles anonymization internally)
 */
export async function contributeAd(
    ad: AdEntry,
    results: ExtractedResultsData,
    userId: string
): Promise<ContributionResult> {
    // Check opt-in status
    const { optedIn, preferences } = getPoolOptInStatus();

    if (!optedIn) {
        return {
            success: false,
            contributedCount: 0,
            errors: ['User has not opted in to public pool']
        };
    }

    // Anonymize the ad
    const { insight } = anonymizeAdInsight(ad, results, userId, {
        includeIndustry: preferences.includeIndustry,
        includePlatform: preferences.includePlatform,
        includeSpendTier: preferences.includeSpendTier,
    });

    // Contribute
    return contributeInsight(insight);
}

/**
 * Get user's contribution statistics
 */
export function getUserContributionStats(): ContributionStats {
    return getContributionStats();
}

/**
 * Update collective priors based on contributions
 * This would typically be run server-side on a schedule
 */
export async function updateCollectivePriors(): Promise<{
    success: boolean;
    priorsUpdated: number;
}> {
    try {
        const supabase = getSupabaseClient();

        // Get all unique features from recent contributions
        const { data: contributions, error: fetchError } = await supabase
            .from('user_contributions')
            .select('feature_name, weight_delta, outcome_positive')
            .gte('contributed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (fetchError || !contributions) {
            return { success: false, priorsUpdated: 0 };
        }

        // Aggregate by feature
        const featureAggregates = new Map<string, {
            sum: number;
            count: number;
            positive: number;
            negative: number;
        }>();

        contributions.forEach(c => {
            // Each contribution can have multiple comma-separated features
            const features = c.feature_name.split(',');
            features.forEach((feature: string) => {
                if (!feature.trim()) return;

                const existing = featureAggregates.get(feature) || {
                    sum: 0, count: 0, positive: 0, negative: 0
                };
                existing.sum += c.weight_delta;
                existing.count += 1;
                if (c.outcome_positive) existing.positive += 1;
                else existing.negative += 1;

                featureAggregates.set(feature, existing);
            });
        });

        // Update collective_priors table
        let updatedCount = 0;
        for (const [feature, agg] of featureAggregates) {
            const avgWeight = agg.sum / agg.count;
            const confidence = Math.min(1, agg.count / 100);

            const { error } = await supabase
                .from('collective_priors')
                .upsert({
                    feature_name: feature,
                    weight_sum: agg.sum,
                    contribution_count: agg.count,
                    avg_weight: avgWeight,
                    confidence,
                    positive_outcomes: agg.positive,
                    negative_outcomes: agg.negative,
                    last_updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'feature_name'
                });

            if (!error) updatedCount++;
        }

        return { success: true, priorsUpdated: updatedCount };
    } catch (err) {
        console.error('Error updating collective priors:', err);
        return { success: false, priorsUpdated: 0 };
    }
}
