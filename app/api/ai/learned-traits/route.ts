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
 * POST /api/ai/learned-traits
 * Add a new learned trait from user input
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

        const normalizedName = traitName.trim().toLowerCase();

        // Try Supabase first
        if (supabase) {
            // Check if trait exists
            const { data: existing } = await supabase
                .from('learned_traits')
                .select('*')
                .ilike('trait_name', normalizedName)
                .single();

            if (existing) {
                // Increment usage count
                const { data: updated, error } = await supabase
                    .from('learned_traits')
                    .update({ usage_count: existing.usage_count + 1 })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) {
                    console.error('[Learned Traits] Update error:', error.message);
                } else {
                    return NextResponse.json({
                        success: true,
                        trait: updated,
                        message: 'Trait already exists, incremented usage count',
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
        const existing = learnedTraitsCache.find(
            t => t.trait_name.toLowerCase() === normalizedName
        );

        if (existing) {
            existing.usage_count++;
            return NextResponse.json({
                success: true,
                trait: existing,
                message: 'Trait already exists, incremented usage count',
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
