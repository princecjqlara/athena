// Public Pool - Patterns Module
// Pull community patterns and convert to user's scale

import { createClient } from '@supabase/supabase-js';
import { Platform } from '@/types';
import { getAccountBaseline, zScoreToPercentile } from '../ml/success-normalization';

// ============================================
// TYPES
// ============================================

export interface CommunityPattern {
    // Pattern identification
    traits: string[];
    traitLabels: string[];  // Human-readable labels

    // Performance metrics (from community)
    avgZScore: number;
    sampleSize: number;
    confidence: number;

    // Converted to user's baseline
    convertedScore?: number;
    convertedPercentile?: number;

    // Trend information
    trendDirection?: 'rising' | 'falling' | 'stable';
    trendStrength?: number;

    // Metadata
    lastUpdated: string;
    category?: string;
}

export interface PatternQuery {
    // Filters
    industry?: string;
    platform?: Platform;
    minSampleSize?: number;
    minConfidence?: number;

    // Pagination
    limit?: number;
    offset?: number;

    // Sorting
    sortBy?: 'avgZScore' | 'sampleSize' | 'confidence' | 'lastUpdated';
    sortOrder?: 'asc' | 'desc';
}

export interface PatternFetchResult {
    patterns: CommunityPattern[];
    total: number;
    hasMore: boolean;
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
// HELPER FUNCTIONS
// ============================================

/**
 * Convert a Z-score to user's local scale
 */
export function convertZScoreToLocalScale(zScore: number): {
    score: number;
    percentile: number;
    interpretation: string;
} {
    const baseline = getAccountBaseline();

    // Convert Z-score to raw score using user's baseline
    const score = baseline.avgSuccessRating + (zScore * baseline.stdSuccessRating);
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

    // Get percentile
    const percentile = Math.round(zScoreToPercentile(zScore));

    // Generate interpretation
    let interpretation: string;
    if (zScore > 1.5) {
        interpretation = 'Significantly above average - Top performer';
    } else if (zScore > 0.5) {
        interpretation = 'Above average - Good performer';
    } else if (zScore > -0.5) {
        interpretation = 'Around average - Typical performance';
    } else if (zScore > -1.5) {
        interpretation = 'Below average - Underperformer';
    } else {
        interpretation = 'Significantly below average - Poor performer';
    }

    return { score: boundedScore, percentile, interpretation };
}

/**
 * Parse trait string into human-readable label
 */
function traitToLabel(trait: string): string {
    const [category, value] = trait.split(':');

    const categoryLabels: Record<string, string> = {
        'hook': 'Hook Type',
        'platform': 'Platform',
        'content': 'Content Type',
        'editing': 'Editing Style',
        'color': 'Color Scheme',
        'music': 'Music',
        'media': 'Media Type',
        'subtitles': 'Subtitles',
        'textOverlays': 'Text Overlays',
        'voiceover': 'Voiceover',
        'ugc': 'UGC Style',
        'cta': 'Call to Action',
    };

    const valueLabels: Record<string, string> = {
        'yes': 'Enabled',
        'no': 'Disabled',
        'curiosity': 'Curiosity Hook',
        'shock': 'Shock Hook',
        'question': 'Question Hook',
        'fast_cuts': 'Fast Cuts',
        'cinematic': 'Cinematic',
        'raw_authentic': 'Raw/Authentic',
    };

    const catLabel = categoryLabels[category] || category;
    const valLabel = valueLabels[value] || value?.replace(/_/g, ' ');

    return `${catLabel}: ${valLabel}`;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Fetch community patterns from the public pool
 */
export async function fetchCommunityPatterns(
    query: PatternQuery = {}
): Promise<PatternFetchResult> {
    try {
        const supabase = getSupabaseClient();

        const {
            industry,
            minSampleSize = 10,
            minConfidence = 0.3,
            limit = 20,
            offset = 0,
            sortBy = 'avgZScore',
            sortOrder = 'desc',
        } = query;

        // Build query
        let dbQuery = supabase
            .from('collective_priors')
            .select('*', { count: 'exact' })
            .gte('contribution_count', minSampleSize)
            .gte('confidence', minConfidence);

        if (industry) {
            dbQuery = dbQuery.eq('category', industry);
        }

        // Map sortBy to column names
        const columnMap: Record<string, string> = {
            'avgZScore': 'avg_weight',
            'sampleSize': 'contribution_count',
            'confidence': 'confidence',
            'lastUpdated': 'last_updated_at',
        };

        dbQuery = dbQuery
            .order(columnMap[sortBy] || 'avg_weight', { ascending: sortOrder === 'asc' })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await dbQuery;

        if (error || !data) {
            console.error('Error fetching patterns:', error);
            return { patterns: [], total: 0, hasMore: false };
        }

        // Transform to CommunityPattern format
        const patterns: CommunityPattern[] = data.map(row => {
            const traits = row.feature_name.split(',').filter(Boolean);
            const converted = convertZScoreToLocalScale(row.avg_weight);

            return {
                traits,
                traitLabels: traits.map(traitToLabel),
                avgZScore: row.avg_weight,
                sampleSize: row.contribution_count,
                confidence: row.confidence,
                convertedScore: converted.score,
                convertedPercentile: converted.percentile,
                trendDirection: detectTrend(row),
                lastUpdated: row.last_updated_at,
                category: row.category,
            };
        });

        return {
            patterns,
            total: count || 0,
            hasMore: (offset + limit) < (count || 0),
        };
    } catch (err) {
        console.error('Error in fetchCommunityPatterns:', err);
        return { patterns: [], total: 0, hasMore: false };
    }
}

/**
 * Detect trend from positive/negative ratio changes
 */
function detectTrend(row: { positive_outcomes: number; negative_outcomes: number }): 'rising' | 'falling' | 'stable' {
    const total = row.positive_outcomes + row.negative_outcomes;
    if (total < 10) return 'stable';

    const positiveRatio = row.positive_outcomes / total;

    if (positiveRatio > 0.6) return 'rising';
    if (positiveRatio < 0.4) return 'falling';
    return 'stable';
}

/**
 * Get top performing patterns
 */
export async function getTopPatterns(limit: number = 10): Promise<CommunityPattern[]> {
    const result = await fetchCommunityPatterns({
        sortBy: 'avgZScore',
        sortOrder: 'desc',
        limit,
        minSampleSize: 20,
        minConfidence: 0.5,
    });
    return result.patterns;
}

/**
 * Get worst performing patterns (to avoid)
 */
export async function getWorstPatterns(limit: number = 10): Promise<CommunityPattern[]> {
    const result = await fetchCommunityPatterns({
        sortBy: 'avgZScore',
        sortOrder: 'asc',
        limit,
        minSampleSize: 20,
        minConfidence: 0.5,
    });
    return result.patterns;
}

/**
 * Search for specific trait patterns
 */
export async function searchPatternsByTraits(
    traits: string[],
    exactMatch: boolean = false
): Promise<CommunityPattern[]> {
    try {
        const supabase = getSupabaseClient();

        // For exact match, join traits and search
        // For partial match, search each trait
        if (exactMatch) {
            const searchString = traits.sort().join(',');
            const { data, error } = await supabase
                .from('collective_priors')
                .select('*')
                .eq('feature_name', searchString);

            if (error || !data) return [];

            return data.map(row => {
                const converted = convertZScoreToLocalScale(row.avg_weight);
                return {
                    traits: row.feature_name.split(','),
                    traitLabels: row.feature_name.split(',').map(traitToLabel),
                    avgZScore: row.avg_weight,
                    sampleSize: row.contribution_count,
                    confidence: row.confidence,
                    convertedScore: converted.score,
                    convertedPercentile: converted.percentile,
                    lastUpdated: row.last_updated_at,
                    category: row.category,
                };
            });
        } else {
            // Partial match - find patterns containing any of the traits
            const { data, error } = await supabase
                .from('collective_priors')
                .select('*')
                .or(traits.map(t => `feature_name.ilike.%${t}%`).join(','));

            if (error || !data) return [];

            return data.map(row => {
                const converted = convertZScoreToLocalScale(row.avg_weight);
                return {
                    traits: row.feature_name.split(','),
                    traitLabels: row.feature_name.split(',').map(traitToLabel),
                    avgZScore: row.avg_weight,
                    sampleSize: row.contribution_count,
                    confidence: row.confidence,
                    convertedScore: converted.score,
                    convertedPercentile: converted.percentile,
                    lastUpdated: row.last_updated_at,
                    category: row.category,
                };
            });
        }
    } catch (err) {
        console.error('Error searching patterns:', err);
        return [];
    }
}

/**
 * Get pattern recommendations based on user's current traits
 */
export async function getPatternRecommendations(
    currentTraits: string[]
): Promise<{
    similar: CommunityPattern[];
    complementary: CommunityPattern[];
    avoid: CommunityPattern[];
}> {
    // Get patterns containing similar traits
    const similar = await searchPatternsByTraits(currentTraits, false);

    // Get top patterns that might complement
    const topPatterns = await getTopPatterns(20);
    const complementary = topPatterns.filter(p =>
        !p.traits.every(t => currentTraits.includes(t))
    ).slice(0, 5);

    // Get patterns to avoid
    const avoid = await getWorstPatterns(5);

    return {
        similar: similar.slice(0, 5),
        complementary,
        avoid,
    };
}
