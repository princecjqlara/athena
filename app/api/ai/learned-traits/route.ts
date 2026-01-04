import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Self-Adding Prompts API
 * Stores and retrieves user-defined custom traits that are learned over time
 * 
 * Uses Supabase for persistence, with in-memory fallback
 */

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// In-memory fallback for when Supabase is not configured
let learnedTraitsCache: Array<{
    id: string;
    trait_name: string;
    trait_category: string;
    definition: string;
    business_type?: string;
    added_by: string;
    created_at: string;
    usage_count: number;
}> = [];

/**
 * GET /api/ai/learned-traits
 * Get all learned traits, optionally filtered by business type
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const businessType = searchParams.get('businessType');

        // Try Supabase first
        if (supabase) {
            let query = supabase
                .from('learned_traits')
                .select('*')
                .order('usage_count', { ascending: false });

            if (businessType) {
                // Fuzzy match on business_type
                query = query.or(`business_type.ilike.%${businessType}%,business_type.is.null`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[Learned Traits] Supabase error, using cache:', error.message);
                // Fall through to cache
            } else {
                return NextResponse.json({
                    success: true,
                    traits: data || [],
                    total: data?.length || 0,
                    source: 'supabase'
                });
            }
        }

        // Fallback to in-memory cache
        let filtered = learnedTraitsCache;

        if (businessType) {
            const searchLower = businessType.toLowerCase();
            filtered = learnedTraitsCache.filter(t =>
                !t.business_type ||
                t.business_type.toLowerCase().includes(searchLower) ||
                searchLower.includes(t.business_type.toLowerCase())
            );
        }

        filtered.sort((a, b) => b.usage_count - a.usage_count);

        return NextResponse.json({
            success: true,
            traits: filtered,
            total: filtered.length,
            source: 'memory'
        });
    } catch (error) {
        console.error('[Learned Traits] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch traits' }, { status: 500 });
    }
}

/**
 * Normalize trait name for comparison
 * Removes special chars, spaces, and converts to lowercase
 */
function normalizeForComparison(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '') // Remove special chars
        .replace(/\s+/g, ''); // Remove spaces
}

/**
 * Check if two trait names are similar (for deduplication)
 * Uses normalized comparison and checks for common variations
 */
function areSimilarTraits(name1: string, name2: string): boolean {
    const n1 = normalizeForComparison(name1);
    const n2 = normalizeForComparison(name2);
    
    // Exact match after normalization
    if (n1 === n2) return true;
    
    // One contains the other (for variations like "ugc" vs "ugcStyle")
    if (n1.includes(n2) || n2.includes(n1)) {
        // Only if the shorter one is at least 4 chars to avoid false positives
        const shorter = n1.length < n2.length ? n1 : n2;
        if (shorter.length >= 4) return true;
    }
    
    // Check common prefixes (hasX vs hasXStyle)
    const commonPrefixes = ['has', 'is', 'uses', 'includes', 'shows'];
    for (const prefix of commonPrefixes) {
        if (n1.startsWith(prefix) && n2.startsWith(prefix)) {
            const rest1 = n1.slice(prefix.length);
            const rest2 = n2.slice(prefix.length);
            if (rest1 === rest2 || rest1.includes(rest2) || rest2.includes(rest1)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * POST /api/ai/learned-traits
 * Add a new learned trait from user input with smart deduplication
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { traitName, traitCategory, definition, businessType, addedBy } = body;

        if (!traitName || !definition) {
            return NextResponse.json({
                error: 'Trait name and definition are required'
            }, { status: 400 });
        }

        const normalizedName = normalizeForComparison(traitName);

        // Try Supabase first
        if (supabase) {
            // Get all existing traits for smart matching
            const { data: allTraits } = await supabase
                .from('learned_traits')
                .select('*');

            // Find exact or similar matches
            let existingTrait = null;
            let matchType: 'exact' | 'similar' | null = null;

            if (allTraits) {
                // First check for exact match
                existingTrait = allTraits.find(
                    t => normalizeForComparison(t.trait_name) === normalizedName
                );
                if (existingTrait) matchType = 'exact';

                // If no exact match, check for similar traits
                if (!existingTrait) {
                    existingTrait = allTraits.find(
                        t => areSimilarTraits(t.trait_name, traitName)
                    );
                    if (existingTrait) matchType = 'similar';
                }
            }

            if (existingTrait) {
                // Increment usage count for existing/similar trait
                const { data: updated, error } = await supabase
                    .from('learned_traits')
                    .update({ 
                        usage_count: existingTrait.usage_count + 1,
                        // Optionally merge definitions if different
                        definition: existingTrait.definition.length < definition.length 
                            ? definition.trim() 
                            : existingTrait.definition
                    })
                    .eq('id', existingTrait.id)
                    .select()
                    .single();

                if (error) {
                    console.error('[Learned Traits] Update error:', error.message);
                } else {
                    return NextResponse.json({
                        success: true,
                        trait: updated,
                        message: matchType === 'similar' 
                            ? `Similar trait "${existingTrait.trait_name}" found, merged and incremented usage count`
                            : 'Trait already exists, incremented usage count',
                        matchType,
                        existing: true,
                        source: 'supabase'
                    });
                }
            } else {
                // Create new trait
                const { data: created, error } = await supabase
                    .from('learned_traits')
                    .insert({
                        trait_name: traitName.trim(),
                        trait_category: traitCategory || 'Custom',
                        definition: definition.trim(),
                        business_type: businessType || null,
                        added_by: addedBy || 'anonymous',
                        usage_count: 1
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('[Learned Traits] Insert error:', error.message);
                } else {
                    return NextResponse.json({
                        success: true,
                        trait: created,
                        message: 'Trait added successfully',
                        source: 'supabase'
                    });
                }
            }
        }

        // Fallback to in-memory
        // Check for exact match first
        let existing = learnedTraitsCache.find(
            t => normalizeForComparison(t.trait_name) === normalizedName
        );
        
        // Check for similar match
        if (!existing) {
            existing = learnedTraitsCache.find(
                t => areSimilarTraits(t.trait_name, traitName)
            );
        }

        if (existing) {
            existing.usage_count++;
            // Update definition if new one is longer/better
            if (definition.length > existing.definition.length) {
                existing.definition = definition.trim();
            }
            return NextResponse.json({
                success: true,
                trait: existing,
                message: 'Trait already exists or similar found, incremented usage count',
                existing: true,
                source: 'memory'
            });
        }

        const newTrait = {
            id: `trait_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            trait_name: traitName.trim(),
            trait_category: traitCategory || 'Custom',
            definition: definition.trim(),
            business_type: businessType || undefined,
            added_by: addedBy || 'anonymous',
            created_at: new Date().toISOString(),
            usage_count: 1
        };

        learnedTraitsCache.push(newTrait);

        return NextResponse.json({
            success: true,
            trait: newTrait,
            message: 'Trait added successfully',
            source: 'memory'
        });
    } catch (error) {
        console.error('[Learned Traits] POST error:', error);
        return NextResponse.json({ error: 'Failed to add trait' }, { status: 500 });
    }
}

/**
 * DELETE /api/ai/learned-traits
 * Remove a learned trait by ID
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Trait ID required' }, { status: 400 });
        }

        // Try Supabase first
        if (supabase) {
            const { error } = await supabase
                .from('learned_traits')
                .delete()
                .eq('id', id);

            if (!error) {
                return NextResponse.json({
                    success: true,
                    message: 'Trait deleted',
                    source: 'supabase'
                });
            }
            console.error('[Learned Traits] Delete error:', error.message);
        }

        // Fallback to in-memory
        const initialLength = learnedTraitsCache.length;
        learnedTraitsCache = learnedTraitsCache.filter(t => t.id !== id);

        if (learnedTraitsCache.length === initialLength) {
            return NextResponse.json({ error: 'Trait not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Trait deleted',
            source: 'memory'
        });
    } catch (error) {
        console.error('[Learned Traits] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete trait' }, { status: 500 });
    }
}
