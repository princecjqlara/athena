/**
 * Public Traits API
 * CRUD operations for shared traits with moderation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Fetch public traits
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'approved';
        const includeAll = searchParams.get('includeAll') === 'true';

        let query = supabase
            .from('public_traits')
            .select('*')
            .order('created_at', { ascending: false });

        if (!includeAll) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

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

// POST - Create new trait
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        const { name, group, emoji, description, userId, createdByAi } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
        }

        // Check if trait already exists
        const { data: existing } = await supabase
            .from('public_traits')
            .select('id')
            .ilike('name', name)
            .single();

        if (existing) {
            return NextResponse.json({
                success: false,
                error: 'Trait already exists',
                existing: true
            }, { status: 409 });
        }

        // Insert new trait
        const { data, error } = await supabase
            .from('public_traits')
            .insert({
                name,
                group_name: group || 'Custom',
                emoji: emoji || '✨',
                description: description || `Custom trait: ${name}`,
                created_by: userId || null,
                created_by_ai: createdByAi || false,
                status: 'pending'
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

// PATCH - Update trait (organizer only)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        const { id, name, group, emoji, description, status, reviewedBy } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Trait ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (group) updateData.group_name = group;
        if (emoji) updateData.emoji = emoji;
        if (description) updateData.description = description;
        if (status) {
            updateData.status = status;
            updateData.reviewed_by = reviewedBy;
            updateData.reviewed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('public_traits')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating trait:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, trait: data });
    } catch (error) {
        console.error('Update trait error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update trait' }, { status: 500 });
    }
}

// DELETE - Delete trait (organizer only)
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Trait ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('public_traits')
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
