// Extended Ad Data Types for comprehensive Facebook metrics and custom fields

export interface ExtendedAdInsights {
    // Basic Metrics
    basic: {
        impressions: number;
        reach: number;
        frequency: number;
        clicks: number;
        ctr: number;
        cpc: number;
        cpm: number;
        spend: number;
        linkClicks: number;
        postEngagement: number;

        // Video metrics
        videoViews25: number;
        videoViews50: number;
        videoViews75: number;
        videoViews100: number;

        // Conversions
        leads: number;
        purchases: number;
        registrations: number;
    };

    // Demographics
    demographics: {
        age: Record<string, { impressions: number; clicks: number; percent: number }>;
        gender: {
            male: { impressions: number; clicks: number; percent: number };
            female: { impressions: number; clicks: number; percent: number };
            unknown: { impressions: number; clicks: number; percent: number };
        };
    };

    // Geographic
    geographic: {
        countries: Array<{
            country: string;
            impressions: number;
            clicks: number;
            spend: number;
        }>;
    };

    // Distribution
    distribution: {
        platforms: Record<string, number>;  // facebook: 60, instagram: 40
        placements: Record<string, number>; // feed: 50, stories: 30, reels: 20
        devices: Record<string, number>;    // mobile: 80, desktop: 20
    };

    // Time Analysis
    timeAnalysis: {
        mostActiveHour: number;
        hourlyData: Array<{ hour: number; impressions: number; clicks: number }>;
    };
}

export interface CustomCategory {
    id: string;
    userId: string;
    categoryType: 'category' | 'subcategory' | 'trait' | 'script_chunk_type';
    name: string;
    parentId?: string;
    createdAt: string;
}

export interface ScriptChunk {
    id: string;
    adId: string;
    chunkType: string;  // 'hook', 'problem', 'solution', 'cta', etc.
    content: string;
    position: number;
    durationSeconds?: number;
}

export interface ExtendedAdData {
    // Basic ad info
    id: string;
    mediaUrl: string;
    thumbnailUrl: string;
    mediaType: 'video' | 'photo';
    adFormat: string;

    // Ad Copy
    primaryText: string;
    headline: string;
    description?: string;

    // Custom Categories (user-defined)
    categories: string[];
    subcategories: string[];
    traits: string[];

    // Script breakdown
    scriptChunks: ScriptChunk[];

    // Extracted content from AI
    extractedContent: {
        hookType: string;
        contentCategory: string;
        editingStyle: string;
        colorScheme: string;
        musicType: string;
        hasSubtitles: boolean;
        hasTextOverlays: boolean;
        hasVoiceover: boolean;
        isUGCStyle: boolean;
        platform: string;
        placement: string;
        aspectRatio: string;
        customTraits: string[];
    };

    // Extended Facebook Insights
    extendedInsights?: ExtendedAdInsights;

    // Performance
    predictedScore: number;
    actualSuccessScore?: number;
    conversions: number;
    totalConversionValue: number;

    // Facebook linking
    facebookAdId?: string;
    autoSyncResults: boolean;

    // Timestamps
    createdAt: string;
    updatedAt: string;
    lastConversionAt?: string;
}

// Default categories for new users
export const DEFAULT_CATEGORIES = {
    categories: [
        'Product Demo',
        'Testimonial',
        'UGC',
        'Educational',
        'Behind The Scenes',
        'Before/After',
        'Unboxing',
        'Tutorial',
        'Story-based',
        'Comparison',
        'Lifestyle',
        'Problem/Solution'
    ],
    subcategories: [
        'Quick Tips',
        'Full Tutorial',
        'Day in Life',
        'Transformation',
        'Review',
        'Haul',
        'Challenge'
    ],
    traits: [
        'Emotional',
        'Urgent',
        'Luxury',
        'Casual',
        'Professional',
        'Funny',
        'Inspirational',
        'Fear-based',
        'Social Proof',
        'Scarcity',
        'FOMO',
        'Curiosity-driven',
        'Shock value',
        'Relatable'
    ],
    scriptChunkTypes: [
        'Hook',
        'Problem Statement',
        'Agitation',
        'Solution',
        'Features',
        'Benefits',
        'Testimonial Quote',
        'Social Proof',
        'Objection Handler',
        'CTA',
        'Urgency',
        'Guarantee',
        'Bonus Offer'
    ]
};
