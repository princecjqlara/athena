import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ai/suggest-data
 * AI-powered data pool suggestions based on user's business profile
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { businessType, targetAudience, products, currentAds } = body;

        if (!businessType) {
            return NextResponse.json({
                error: 'Business type is required'
            }, { status: 400 });
        }

        // Build AI prompt for suggestions
        const prompt = `You are an AI marketing advisor. Based on the following business profile, suggest the most relevant data pools and explain why.

Business Profile:
- Business Type: ${businessType}
- Target Audience: ${targetAudience || 'Not specified'}
- Products/Services: ${products || 'Not specified'}
- Current Ads Count: ${currentAds || 0}

Suggest 3-5 data pool categories that would be most valuable for this business. For each suggestion, provide:
1. Pool Name (e.g., "E-commerce UGC Ads", "B2B SaaS Demo Videos")
2. Relevance Score (1-100)
3. Reasoning (1-2 sentences why this pool matches their needs)
4. Expected insights they'll gain

Return as JSON array with format:
[
  {
    "poolName": "string",
    "industry": "string",
    "platform": "string",
    "audience": "string",
    "format": "string",
    "relevanceScore": number,
    "reasoning": "string",
    "expectedInsights": ["insight1", "insight2"]
  }
]`;

        // Call AI API (using the existing analyze endpoint pattern)
        const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                type: 'data-suggestion'
            })
        });

        const aiData = await aiResponse.json();

        // Parse AI response
        let suggestions = [];
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiData.response?.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            }
        } catch (parseError) {
            console.error('Failed to parse AI suggestions:', parseError);
            // Fallback to rule-based suggestions
            suggestions = generateFallbackSuggestions(businessType, targetAudience, products);
        }

        return NextResponse.json({
            success: true,
            suggestions,
            businessProfile: { businessType, targetAudience, products }
        });

    } catch (error) {
        console.error('[AI Suggest] Error:', error);
        return NextResponse.json({
            error: 'Failed to generate suggestions'
        }, { status: 500 });
    }
}

// Fallback rule-based suggestions if AI fails
function generateFallbackSuggestions(businessType: string, targetAudience?: string, products?: string) {
    const suggestions = [];
    const type = businessType.toLowerCase();

    if (type.includes('ecommerce') || type.includes('e-commerce') || type.includes('shop')) {
        suggestions.push({
            poolName: 'E-commerce UGC Ads',
            industry: 'ecommerce',
            platform: 'tiktok',
            audience: 'gen_z',
            format: 'ugc',
            relevanceScore: 95,
            reasoning: 'UGC content performs best for e-commerce conversions on TikTok and Instagram.',
            expectedInsights: ['Best hook types for product reveals', 'Optimal video length for conversions', 'Top-performing CTA styles']
        });
        suggestions.push({
            poolName: 'Product Demo Videos',
            industry: 'ecommerce',
            platform: 'facebook',
            audience: 'millennials',
            format: 'product_demo',
            relevanceScore: 85,
            reasoning: 'Product demos help showcase features and build buyer confidence.',
            expectedInsights: ['Feature highlighting techniques', 'Before/after presentation styles']
        });
    }

    if (type.includes('saas') || type.includes('software') || type.includes('tech')) {
        suggestions.push({
            poolName: 'SaaS Demo Videos',
            industry: 'saas',
            platform: 'youtube',
            audience: 'b2b',
            format: 'product_demo',
            relevanceScore: 92,
            reasoning: 'B2B SaaS buyers need to see the product in action before committing.',
            expectedInsights: ['Screen recording best practices', 'Feature tour structures', 'CTA timing for demos']
        });
        suggestions.push({
            poolName: 'Founder-Led Content',
            industry: 'saas',
            platform: 'linkedin',
            audience: 'b2b',
            format: 'founder_led',
            relevanceScore: 88,
            reasoning: 'Founder credibility drives trust in B2B software decisions.',
            expectedInsights: ['Authentic storytelling patterns', 'Problem-solution framing']
        });
    }

    if (type.includes('service') || type.includes('local') || type.includes('consulting')) {
        suggestions.push({
            poolName: 'Testimonial Ads',
            industry: 'local_services',
            platform: 'facebook',
            audience: 'high_income',
            format: 'testimonial',
            relevanceScore: 90,
            reasoning: 'Social proof is critical for service businesses to build trust.',
            expectedInsights: ['Customer story structures', 'Trust signal placement', 'Emotional appeal techniques']
        });
    }

    // Default suggestion if nothing matches
    if (suggestions.length === 0) {
        suggestions.push({
            poolName: 'General High-Performing Ads',
            industry: '',
            platform: 'multi',
            audience: '',
            format: '',
            relevanceScore: 70,
            reasoning: 'Learn from top-performing ads across multiple industries and formats.',
            expectedInsights: ['Universal hook patterns', 'Cross-industry best practices']
        });
    }

    return suggestions;
}
