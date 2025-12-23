import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for development (replace with Supabase in production)
let customCategories: Array<{
    id: string;
    userId: string;
    categoryType: 'category' | 'subcategory' | 'trait' | 'script_chunk_type';
    name: string;
    parentId?: string;
    createdAt: string;
}> = [];

/**
 * GET /api/categories
 * Get all custom categories for a user
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'default';
    const categoryType = searchParams.get('type');

    let filtered = customCategories.filter(c => c.userId === userId);

    if (categoryType) {
        filtered = filtered.filter(c => c.categoryType === categoryType);
    }

    // Also load from localStorage via client (this is server-side, so we return what we have)
    return NextResponse.json({
        success: true,
        data: filtered
    });
}

/**
 * POST /api/categories
 * Create a new custom category
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId = 'default', categoryType, name, parentId } = body;

        if (!categoryType || !name) {
            return NextResponse.json(
                { success: false, error: 'categoryType and name are required' },
                { status: 400 }
            );
        }

        // Check for duplicates
        const exists = customCategories.find(
            c => c.userId === userId && c.categoryType === categoryType && c.name.toLowerCase() === name.toLowerCase()
        );

        if (exists) {
            return NextResponse.json(
                { success: false, error: 'Category already exists' },
                { status: 409 }
            );
        }

        const newCategory = {
            id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            categoryType,
            name,
            parentId,
            createdAt: new Date().toISOString()
        };

        customCategories.push(newCategory);

        return NextResponse.json({
            success: true,
            data: newCategory
        });

    } catch (error) {
        console.error('Create category error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create category' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/categories
 * Delete a custom category
 */
export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('id');

    if (!categoryId) {
        return NextResponse.json(
            { success: false, error: 'Category ID is required' },
            { status: 400 }
        );
    }

    const index = customCategories.findIndex(c => c.id === categoryId);

    if (index === -1) {
        return NextResponse.json(
            { success: false, error: 'Category not found' },
            { status: 404 }
        );
    }

    customCategories.splice(index, 1);

    return NextResponse.json({
        success: true,
        message: 'Category deleted'
    });
}

// Default categories to seed
export const DEFAULT_CATEGORIES = {
    categories: [
        'Product Demo', 'Testimonial', 'UGC', 'Educational', 'Behind The Scenes',
        'Before/After', 'Unboxing', 'Tutorial', 'Story-based', 'Comparison'
    ],
    traits: [
        'Emotional', 'Urgent', 'Luxury', 'Casual', 'Professional', 'Funny',
        'Inspirational', 'Fear-based', 'Social Proof', 'Scarcity'
    ],
    scriptChunkTypes: [
        'Hook', 'Problem Statement', 'Solution', 'Features', 'Benefits',
        'Testimonial Quote', 'Social Proof', 'CTA', 'Urgency', 'Guarantee'
    ]
};
