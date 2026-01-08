/**
 * Unified Traits API
 * Simple CRUD operations for traits (JSON import-based)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Validate environment variables at module load
function getSupabaseConfig() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return null;
    }

    return { supabaseUrl, supabaseServiceKey };
}

// GET - Fetch all traits
export async function GET() {
    try {
        const config = getSupabaseConfig();
        if (!config) {
            console.error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined');
            return NextResponse.json({
                success: false,
                error: 'Server configuration error: Missing database credentials'
            }, { status: 500 });
        }

        const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

        const { data, error } = await supabase
            .from('learned_traits')
            .select('*')
            .order('usage_count', { ascending: false });

        if (error) {
            console.error('Error fetching traits:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, traits: data || [] });
    } catch (error) {
        console.error('Traits API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch traits' }, { status: 500 });
    }
}

// POST - Create new trait (or increment usage if exists)
export async function POST(request: NextRequest) {
    try {
        const config = getSupabaseConfig();
        if (!config) {
            console.error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined');
            return NextResponse.json({
                success: false,
                error: 'Server configuration error: Missing database credentials'
            }, { status: 500 });
        }

        const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
        const body = await request.json();
        const { traitName, name, traitCategory, category, definition, description, businessType, business_type } = body;

        // Support multiple field name formats
        const finalName = traitName || name;
        const finalCategory = traitCategory || category || 'Custom';
        const finalDefinition = definition || description || `Custom trait: ${finalName}`;
        const finalBusinessType = businessType || business_type || '';

        if (!finalName) {
            return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
        }

        // Check if trait already exists (using maybeSingle to handle 0 or 1 result gracefully)
        const { data: existingRows, error: lookupError } = await supabase
            .from('learned_traits')
            .select('id, usage_count')
            .ilike('trait_name', finalName);

        if (lookupError) {
            console.error('Error checking for existing trait:', lookupError);
            return NextResponse.json({ success: false, error: lookupError.message }, { status: 500 });
        }

        // Handle case where trait already exists (one or more rows)
        if (existingRows && existingRows.length > 0) {
            // Use the first matching row (canonical)
            const existing = existingRows[0];

            if (existingRows.length > 1) {
                console.warn(`Multiple traits found matching "${finalName}" (case-insensitive), using first match with id: ${existing.id}`);
            }

            // Increment usage count for existing trait
            const { error: updateError } = await supabase
                .from('learned_traits')
                .update({ usage_count: (existing.usage_count || 0) + 1 })
                .eq('id', existing.id);

            if (updateError) {
                console.error('Error updating trait usage count:', updateError);
                return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                existing: true,
                message: 'Trait already exists, usage count incremented'
            });
        }

        // Insert new trait
        const { data, error } = await supabase
            .from('learned_traits')
            .insert({
                trait_name: finalName,
                trait_category: finalCategory,
                definition: finalDefinition,
                business_type: finalBusinessType,
                usage_count: 1
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating trait:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, trait: data });
    } catch (error) {
        console.error('Create trait error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create trait' }, { status: 500 });
    }
}

// DELETE - Delete trait
export async function DELETE(request: NextRequest) {
    try {
        const config = getSupabaseConfig();
        if (!config) {
            console.error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined');
            return NextResponse.json({
                success: false,
                error: 'Server configuration error: Missing database credentials'
            }, { status: 500 });
        }

        const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Trait ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('learned_traits')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting trait:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Trait deleted' });
    } catch (error) {
        console.error('Delete trait error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete trait' }, { status: 500 });
    }
}
