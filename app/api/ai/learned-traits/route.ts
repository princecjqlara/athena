import { NextRequest, NextResponse } from 'next/server';

/**
 * Self-Adding Prompts API
 * Stores and retrieves user-defined custom traits that are learned over time
 * When users add custom traits, they get stored here and can be suggested to similar users
 */

// In-memory storage for learned traits (in production, use Supabase)
let learnedTraits: Array<{
    id: string;
    traitName: string;
    traitCategory: string;
    definition: string;
    businessType?: string;
    addedBy: string;
    addedAt: string;
    usageCount: number;
}> = [];

/**
 * GET /api/ai/learned-traits
 * Get all learned traits, optionally filtered by business type
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const businessType = searchParams.get('businessType');

        let filtered = learnedTraits;

        // Filter by business type if provided (fuzzy match)
        if (businessType) {
            const searchLower = businessType.toLowerCase();
            filtered = learnedTraits.filter(t =>
                !t.businessType ||
                t.businessType.toLowerCase().includes(searchLower) ||
                searchLower.includes(t.businessType.toLowerCase())
            );
        }

        // Sort by usage count (most popular first)
        filtered.sort((a, b) => b.usageCount - a.usageCount);

        return NextResponse.json({
            success: true,
            traits: filtered,
            total: filtered.length
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

        // Check if trait already exists (case-insensitive)
        const existing = learnedTraits.find(
            t => t.traitName.toLowerCase() === traitName.toLowerCase()
        );

        if (existing) {
            // Increment usage count
            existing.usageCount++;
            return NextResponse.json({
                success: true,
                trait: existing,
                message: 'Trait already exists, incremented usage count'
            });
        }

        // Create new trait
        const newTrait = {
            id: `trait_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            traitName: traitName.trim(),
            traitCategory: traitCategory || 'Custom',
            definition: definition.trim(),
            businessType: businessType || undefined,
            addedBy: addedBy || 'anonymous',
            addedAt: new Date().toISOString(),
            usageCount: 1
        };

        learnedTraits.push(newTrait);

        return NextResponse.json({
            success: true,
            trait: newTrait,
            message: 'Trait added successfully'
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

        const initialLength = learnedTraits.length;
        learnedTraits = learnedTraits.filter(t => t.id !== id);

        if (learnedTraits.length === initialLength) {
            return NextResponse.json({ error: 'Trait not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Trait deleted'
        });
    } catch (error) {
        console.error('[Learned Traits] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete trait' }, { status: 500 });
    }
}
