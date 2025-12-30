// Public Pool API - Fetch community patterns for all users (no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { fetchCommunityPatterns, getTopPatterns, getWorstPatterns } from '@/lib/pool/patterns';

/**
 * GET /api/pool/public
 * Fetch anonymized public pool patterns for Galaxy Orbs visualization
 * Available to all users without authentication
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Query parameters
        const industry = searchParams.get('industry') || undefined;
        const minSampleSize = parseInt(searchParams.get('minSampleSize') || '5');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sortBy = searchParams.get('sortBy') as 'avgZScore' | 'sampleSize' | 'confidence' | 'lastUpdated' || 'avgZScore';
        const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';

        // Fetch community patterns
        const result = await fetchCommunityPatterns({
            industry,
            minSampleSize,
            limit,
            sortBy,
            sortOrder,
        });

        // Also get top and worst patterns for insights
        const [topPatterns, worstPatterns] = await Promise.all([
            getTopPatterns(10),
            getWorstPatterns(5)
        ]);

        return NextResponse.json({
            success: true,
            patterns: result.patterns,
            total: result.total,
            hasMore: result.hasMore,
            insights: {
                topPatterns,
                patternsToAvoid: worstPatterns,
                summary: {
                    totalPatterns: result.total,
                    avgConfidence: result.patterns.length > 0
                        ? Math.round(result.patterns.reduce((sum, p) => sum + p.confidence, 0) / result.patterns.length * 100)
                        : 0,
                    totalSampleSize: result.patterns.reduce((sum, p) => sum + p.sampleSize, 0)
                }
            }
        });

    } catch (error) {
        console.error('[Public Pool API] Error:', error);

        // Return empty data on error (graceful degradation)
        return NextResponse.json({
            success: true,
            patterns: [],
            total: 0,
            hasMore: false,
            insights: {
                topPatterns: [],
                patternsToAvoid: [],
                summary: { totalPatterns: 0, avgConfidence: 0, totalSampleSize: 0 }
            },
            warning: 'Unable to fetch live data. Showing cached results.'
        });
    }
}

/**
 * POST /api/pool/public
 * Search patterns by specific criteria or traits
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { traits, industry, platform, audience, format } = body;

        // Build search criteria
        const searchIndustry = industry || undefined;

        // Fetch patterns with filters
        const result = await fetchCommunityPatterns({
            industry: searchIndustry,
            minSampleSize: 5,
            limit: 100,
            sortBy: 'avgZScore',
            sortOrder: 'desc',
        });

        // Filter by additional criteria if provided
        let filteredPatterns = result.patterns;

        if (traits && traits.length > 0) {
            filteredPatterns = filteredPatterns.filter(pattern =>
                traits.some((trait: string) =>
                    pattern.traitLabels.some(label =>
                        label.toLowerCase().includes(trait.toLowerCase())
                    )
                )
            );
        }

        // If platform/audience/format filters provided, filter client-side
        if (platform) {
            filteredPatterns = filteredPatterns.filter(pattern =>
                pattern.traits.some(t => t.toLowerCase().includes(platform.toLowerCase()))
            );
        }

        if (audience) {
            filteredPatterns = filteredPatterns.filter(pattern =>
                pattern.traits.some(t =>
                    t.toLowerCase().includes(audience.toLowerCase()) ||
                    pattern.traitLabels.some(label => label.toLowerCase().includes(audience.toLowerCase()))
                )
            );
        }

        return NextResponse.json({
            success: true,
            patterns: filteredPatterns,
            total: filteredPatterns.length,
            searchCriteria: { traits, industry, platform, audience, format }
        });

    } catch (error) {
        console.error('[Public Pool Search] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to search patterns'
        }, { status: 500 });
    }
}
