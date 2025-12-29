'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './page.module.css';
import { useTheme } from '@/components/ThemeProvider';

// Category color palettes (variations for related traits) - EXPANDED for 30+ categories
const CATEGORY_COLORS: Record<string, { primary: string; light: string; dark: string }> = {
    // Core Categories
    Hook: { primary: '#EF4444', light: '#FCA5A5', dark: '#991B1B' },
    Platform: { primary: '#3B82F6', light: '#93C5FD', dark: '#1D4ED8' },
    Category: { primary: '#8B5CF6', light: '#C4B5FD', dark: '#5B21B6' },
    Editing: { primary: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
    Color: { primary: '#EC4899', light: '#F9A8D4', dark: '#9D174D' },
    Music: { primary: '#10B981', light: '#6EE7B7', dark: '#047857' },
    Feature: { primary: '#06B6D4', light: '#67E8F9', dark: '#0E7490' },
    Style: { primary: '#F97316', light: '#FDBA74', dark: '#C2410C' },
    Custom: { primary: '#6366F1', light: '#A5B4FC', dark: '#3730A3' },
    Ad: { primary: '#A855F7', light: '#D8B4FE', dark: '#6B21A8' },
    // New Categories
    Placement: { primary: '#14B8A6', light: '#5EEAD4', dark: '#0F766E' },
    Aspect: { primary: '#84CC16', light: '#BEF264', dark: '#4D7C0F' },
    CTA: { primary: '#F43F5E', light: '#FDA4AF', dark: '#BE123C' },
    Duration: { primary: '#8B5CF6', light: '#C4B5FD', dark: '#5B21B6' },
    Voice: { primary: '#0EA5E9', light: '#7DD3FC', dark: '#0369A1' },
    Pattern: { primary: '#D946EF', light: '#F0ABFC', dark: '#A21CAF' },
    Emotion: { primary: '#FB923C', light: '#FDBA74', dark: '#C2410C' },
    Sentiment: { primary: '#22C55E', light: '#86EFAC', dark: '#166534' },
    Face: { primary: '#E879F9', light: '#F5D0FE', dark: '#A21CAF' },
    Text: { primary: '#A3E635', light: '#D9F99D', dark: '#65A30D' },
    Audio: { primary: '#38BDF8', light: '#7DD3FC', dark: '#0284C7' },
    Shot: { primary: '#FB7185', light: '#FECDD3', dark: '#BE123C' },
    Talent: { primary: '#C084FC', light: '#E9D5FF', dark: '#7C3AED' },
    Logo: { primary: '#2DD4BF', light: '#99F6E4', dark: '#0D9488' },
    Trigger: { primary: '#FACC15', light: '#FEF08A', dark: '#CA8A04' },
    Media: { primary: '#818CF8', light: '#C7D2FE', dark: '#4338CA' },
    Scene: { primary: '#34D399', light: '#6EE7B7', dark: '#059669' },
    Brand: { primary: '#F472B6', light: '#FBCFE8', dark: '#DB2777' },
    // Metric orbs for performance visualization
    Metric: { primary: '#22C55E', light: '#86EFAC', dark: '#166534' },
    Impressions: { primary: '#3B82F6', light: '#93C5FD', dark: '#1D4ED8' },
    Reach: { primary: '#10B981', light: '#6EE7B7', dark: '#047857' },
    Clicks: { primary: '#8B5CF6', light: '#C4B5FD', dark: '#5B21B6' },
    CTR: { primary: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
    Spend: { primary: '#EC4899', light: '#F9A8D4', dark: '#9D174D' },
};

// ===== PARENT GROUP HIERARCHY =====
// This maps each category to a parent group for organized visualization
const CATEGORY_TO_PARENT_GROUP: Record<string, string> = {
    // 📱 Platform & Placement
    Platform: '📱 Platform & Placement',
    Placement: '📱 Platform & Placement',

    // 📐 Media Format
    Media: '📐 Media Format',
    Aspect: '📐 Media Format',
    Duration: '📐 Media Format',

    // 🎣 Content & Hook
    Hook: '🎣 Content & Hook',
    Category: '🎣 Content & Hook',
    Pattern: '🎣 Content & Hook',

    // 🎨 Visual Style
    Editing: '🎨 Visual Style',
    Color: '🎨 Visual Style',
    Style: '🎨 Visual Style',
    Shot: '🎨 Visual Style',
    Scene: '🎨 Visual Style',

    // 🎵 Audio & Voice
    Music: '🎵 Audio & Voice',
    Audio: '🎵 Audio & Voice',
    Voice: '🎵 Audio & Voice',

    // 📝 Text & Features
    Text: '📝 Text & Features',
    Feature: '📝 Text & Features',

    // 👤 Talent & Face
    Talent: '👤 Talent & Face',
    Face: '👤 Talent & Face',

    // 💡 Emotion & Sentiment
    Emotion: '💡 Emotion & Sentiment',
    Sentiment: '💡 Emotion & Sentiment',

    // 🎯 CTA & Engagement
    CTA: '🎯 CTA & Engagement',
    Trigger: '🎯 CTA & Engagement',

    // 🏷️ Brand & Logo
    Brand: '🏷️ Brand & Logo',
    Logo: '🏷️ Brand & Logo',

    // ✨ Custom
    Custom: '✨ Custom',

    // Ads (internal)
    Ad: 'Ad',
};

// Parent group colors for the legend and grouping
const PARENT_GROUP_COLORS: Record<string, string> = {
    '📱 Platform & Placement': '#3B82F6',
    '📐 Media Format': '#818CF8',
    '🎣 Content & Hook': '#EF4444',
    '🎨 Visual Style': '#F59E0B',
    '🎵 Audio & Voice': '#10B981',
    '📝 Text & Features': '#06B6D4',
    '👤 Talent & Face': '#C084FC',
    '💡 Emotion & Sentiment': '#FB923C',
    '🎯 CTA & Engagement': '#F43F5E',
    '🏷️ Brand & Logo': '#2DD4BF',
    '✨ Custom': '#6366F1',
    '📊 Results & Metrics': '#22C55E',
};

// ===== DETAILED DESCRIPTIONS FOR CATEGORIES =====
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    // Platform & Placement
    Platform: 'The social media platform where the ad runs. Different platforms have unique audiences and content expectations.',
    Placement: 'Where the ad appears within the platform (Feed, Stories, Reels, etc.). Placement affects visibility and engagement.',

    // Media Format
    Media: 'The type of media content (video, photo, carousel). Video typically drives higher engagement on social platforms.',
    Aspect: 'The aspect ratio of the content. 9:16 is optimal for mobile-first platforms like TikTok and Stories.',
    Duration: 'How long the video runs. Shorter videos (15-30s) often perform best for attention retention.',

    // Content & Hook
    Hook: 'The opening technique used to grab attention in the first 3 seconds. Strong hooks dramatically improve view-through rates.',
    Category: 'The content format or style (UGC, testimonial, demo, etc.). This affects audience trust and relatability.',
    Pattern: 'The persuasion pattern used (problem/solution, social proof, FOMO, etc.). Patterns drive conversion behavior.',

    // Visual Style
    Editing: 'The editing style and pacing. Fast cuts work well for younger audiences; cinematic for premium products.',
    Color: 'The color palette and mood. Vibrant colors grab attention; warm tones feel approachable.',
    Style: 'The overall visual approach. UGC style builds authenticity; polished looks convey quality.',
    Shot: 'Camera composition and framing. Close-ups create intimacy; wide shots show context.',
    Scene: 'The pace of scene changes. Fast scenes keep attention; slower builds emotion.',

    // Audio & Voice
    Music: 'The type of audio used. Trending sounds boost discoverability; original music builds brand.',
    Audio: 'Audio characteristics like tempo and energy level. Upbeat audio drives engagement.',
    Voice: 'Voiceover characteristics. Voice adds personality and guides the viewer through content.',

    // Text & Features
    Text: 'On-screen text overlays for messaging. Help viewers understand content without sound.',
    Feature: 'Special features like subtitles. Subtitles increase accessibility and watch time by 80%.',

    // Talent & Face
    Talent: 'The type of person in the ad. UGC creators feel authentic; influencers add credibility.',
    Face: 'Face presence and expressions. Faces grab attention and create emotional connection.',

    // Emotion & Sentiment
    Emotion: 'The emotional tone conveyed. Excitement drives shares; inspiration drives action.',
    Sentiment: 'Overall positive/negative feeling. Positive sentiment generally performs better.',

    // CTA & Engagement
    CTA: 'The call-to-action type. Clear CTAs drive conversions; weak CTAs waste ad spend.',
    Trigger: 'Psychological triggers used (urgency, social proof, curiosity). Triggers motivate action.',

    // Brand & Logo
    Brand: 'Brand color and identity usage. Consistent branding builds recognition over time.',
    Logo: 'Logo placement and timing. Early logos can hurt; end logos improve recall.',

    // Custom
    Custom: 'Custom traits you\'ve defined for your specific analysis needs.',
};

// ===== DETAILED DESCRIPTIONS FOR SPECIFIC TRAIT VALUES =====
const TRAIT_DESCRIPTIONS: Record<string, string> = {
    // Platforms
    'Platform:Tiktok': 'TikTok ads reach Gen Z and millennials with authentic, trend-driven content. Best for virality and discovery.',
    'Platform:Instagram': 'Instagram ads reach diverse demographics through visual storytelling. Strong for brand awareness and shopping.',
    'Platform:Facebook': 'Facebook ads reach older demographics with detailed targeting. Best for retargeting and conversions.',
    'Platform:Youtube': 'YouTube ads reach intent-driven viewers with longer content. Great for education and consideration.',
    'Platform:Snapchat': 'Snapchat ads reach younger users with playful, AR-enhanced content.',

    // Placements
    'Placement:Feed': 'In-feed placement offers maximum reach but competes for attention in a scrollable environment.',
    'Placement:Stories': 'Stories placement provides full-screen immersion with 24-hour urgency.',
    'Placement:Reels': 'Reels placement leverages algorithm discovery for organic reach potential.',

    // Hook Types
    'Hook:Curiosity': 'Uses questions or mysteries to make viewers want to see what happens next. "You won\'t believe..."',
    'Hook:Shock': 'Opens with surprising or unexpected content to stop the scroll immediately.',
    'Hook:Question': 'Directly asks the viewer a relatable question to create engagement.',
    'Hook:Transformation': 'Shows a before/after or journey to demonstrate clear results.',
    'Hook:Problem Solution': 'Presents a pain point then shows how the product solves it.',
    'Hook:Story': 'Opens with narrative elements to draw viewers into a story arc.',

    // Content Categories
    'Category:Ugc': 'User-generated content style feels authentic and relatable, building trust with viewers.',
    'Category:Testimonial': 'Real customer testimonials provide social proof and credibility.',
    'Category:Product Demo': 'Shows the product in action, demonstrating features and benefits clearly.',
    'Category:Educational': 'Teaches something valuable while subtly promoting the product.',
    'Category:Entertainment': 'Prioritizes entertainment value to maximize shares and virality.',

    // Editing Styles
    'Editing:Fast Cuts': 'Quick cuts (under 2s each) maintain attention for younger, mobile-first audiences.',
    'Editing:Cinematic': 'Polished, movie-like quality conveys premium positioning.',
    'Editing:Raw Authentic': 'Unpolished, phone-filmed style builds authenticity and trust.',
    'Editing:Slow Motion': 'Dramatic slow-mo highlights product details or emotional moments.',

    // Colors
    'Color:Vibrant': 'Bright, saturated colors grab attention in busy feeds.',
    'Color:Warm': 'Orange/yellow tones feel friendly and approachable.',
    'Color:Cool': 'Blue/green tones feel professional and trustworthy.',
    'Color:Dark': 'Dark aesthetics convey luxury, exclusivity, or edge.',

    // Music
    'Music:Trending': 'Using trending sounds boosts algorithm discovery and cultural relevance.',
    'Music:Original': 'Original music builds unique brand audio identity.',
    'Music:Voiceover Only': 'No music focuses attention on the message and feels more personal.',

    // Features
    'Feature:Subtitles': 'Subtitles increase watch time by 80% as most users watch without sound.',
    'Feature:Text Overlays': 'On-screen text reinforces key messages for sound-off viewing.',

    // Style
    'Style:Ugc Style': 'UGC style content performs 4x better than traditional ads for Gen Z.',

    // CTA
    'CTA:Shop Now': 'Direct purchase CTA works best for retargeting warm audiences.',
    'CTA:Learn More': 'Softer CTA works well for cold audiences in discovery phase.',
    'CTA:Link In Bio': 'Platform-native CTA that feels organic to social media users.',

    // Voice
    'Voice:Voiceover': 'Voiceover adds personality and guides viewers through the content narrative.',
    'Voice:Female': 'Female voices often test better for lifestyle and beauty products.',
    'Voice:Male': 'Male voices often test better for tech and finance products.',

    // Talent
    'Talent:Ugc Creator': 'Real creators add authenticity and relatability to the message.',
    'Talent:Solo': 'Single person creates intimate, personal connection with viewers.',

    // Triggers
    'Trigger:Curiosity Gap': 'Creating an information gap that makes viewers want to know more.',

    // Sentiment
    'Sentiment:Positive': 'Positive sentiment content generally sees higher engagement and shares.',

    // Emotion  
    'Emotion:Exciting': 'High-energy content drives shares and creates memorable impressions.',

    // Aspect
    'Aspect:9:16': 'Vertical format optimized for mobile-first platforms. Maximum screen real estate.',
    'Aspect:1:1': 'Square format works across all placements but less immersive than vertical.',
    'Aspect:16:9': 'Horizontal format for YouTube and desktop viewing.',

    // Duration
    'Duration:15 30S': '15-30 second videos hit the sweet spot for attention and message delivery.',
    'Duration:Under 15S': 'Ultra-short ads work for simple, punchy messages.',

    // Face
    'Face:Face Present': 'Faces in thumbnails and openings grab attention 30% more than no faces.',
    'Face:Happy': 'Happy expressions create positive association with the brand/product.',

    // Pattern
    'Pattern:Problem Solution': 'Classic persuasion: show the pain, then reveal your product as the cure.',
    'Pattern:Social Proof': 'Using testimonials, numbers, or reviews to build credibility.',
    'Pattern:Fomo': 'Fear of missing out drives urgency through scarcity or time limits.',
};

interface Node3D {
    id: string;
    label: string;
    category: string;
    parentGroup: string; // Parent group for organized hierarchy
    type: 'trait' | 'ad' | 'category' | 'metric' | 'daily';
    x: number;
    y: number;
    z: number;
    size: number;
    color: string;
    colorLight: string;
    colorDark: string;
    connections: string[];
    successRate: number;
    frequency: number;
    // Ad-specific fields
    predictedScore?: number;
    actualScore?: number;
    thumbnailUrl?: string;
    traits?: string[];
    // Facebook metrics for Results orb
    adInsights?: AdEntry['adInsights'];
    resultsDescription?: string;
    status?: string;
}

// Extended AdEntry interface to support all ExtractedAdData fields
interface AdEntry {
    id: string;
    extractedContent: {
        // Basic
        title?: string;
        description?: string;
        // Media
        mediaType?: string;
        aspectRatio?: string;
        duration?: number;
        durationCategory?: string;
        adFormat?: string;
        // Platform
        platform?: string;
        placement?: string;
        industryVertical?: string;
        // Creative
        hookType?: string;
        hookText?: string;
        hookVelocity?: string;
        hookKeywords?: string[];
        contentCategory?: string;
        editingStyle?: string;
        // Patterns
        patternType?: string;
        overallSentiment?: string;
        emotionalTone?: string;
        // Face
        facePresence?: boolean;
        numberOfFaces?: number;
        facialEmotion?: string;
        // Text
        hasTextOverlays?: boolean;
        textOverlayRatio?: string;
        textReadability?: string;
        // Color & Visual
        colorScheme?: string;
        colorTemperature?: string;
        hasSubtitles?: boolean;
        subtitleStyle?: string;
        shotComposition?: string;
        sceneVelocity?: string;
        // Audio
        musicType?: string;
        bpm?: string;
        hasVoiceover?: boolean;
        voiceoverStyle?: string;
        voiceGender?: string;
        speechPace?: string;
        // CTA
        cta?: string;
        ctaStrength?: string;
        // Talent
        numberOfActors?: number;
        talentType?: string;
        isUGCStyle?: boolean;
        // Brand
        logoConsistency?: string;
        logoTiming?: string;
        brandColorUsage?: string;
        // Triggers
        curiosityGap?: boolean;
        socialProofElements?: string[];
        urgencyTriggers?: string[];
        trustSignals?: string[];
        // Custom
        customTraits?: string[];
        visualStyle?: string[];
        aiInsights?: string[];
    };
    thumbnailUrl?: string;
    successScore?: number;
    predictedScore?: number;
    // Facebook insights data
    adInsights?: {
        impressions?: number;
        reach?: number;
        clicks?: number;
        ctr?: number;
        spend?: number;
        cpc?: number;
        cpm?: number;
        frequency?: number;
        resultType?: string;
        results?: number;
        costPerResult?: number;
        linkClicks?: number;
        landingPageViews?: number;
        pageEngagement?: number;
        postReactions?: number;
        postComments?: number;
        postShares?: number;
        leads?: number;
        purchases?: number;
        messagesStarted?: number;
        costPerMessage?: number;
        videoViews?: number;
        videoThruPlays?: number;
        qualityRanking?: string;
        engagementRateRanking?: string;
        conversionRateRanking?: string;
    };
    // Daily breakdown data for day-by-day orbs
    dailyReports?: Array<{
        date: string;
        impressions: number;
        reach: number;
        clicks: number;
        ctr: number;
        spend: number;
    }>;
    resultsDescription?: string;
    status?: string;
}

export default function MindMapPage() {
    const [ads, setAds] = useState<AdEntry[]>([]);
    const [nodes, setNodes] = useState<Node3D[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isAutoRotate, setIsAutoRotate] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [viewMode, setViewMode] = useState<'all' | 'ads' | 'traits' | 'metrics' | 'daily'>('all');
    const [viewDimension, setViewDimension] = useState<'3d' | '2d'>('3d');

    // Theme detection for light/dark mode styling
    const { resolvedTheme } = useTheme();
    const isLightMode = resolvedTheme === 'light';

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editPlatform, setEditPlatform] = useState('');
    const [editHookType, setEditHookType] = useState('');
    const [editContentCategory, setEditContentCategory] = useState('');
    const [editPredictedScore, setEditPredictedScore] = useState('');
    const [editActualScore, setEditActualScore] = useState('');

    // Legend state
    const [legendCollapsed, setLegendCollapsed] = useState(false);
    const [customTraitGroups, setCustomTraitGroups] = useState<Array<{ name: string, color: string, traits: string[] }>>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // Load ads and custom trait groups from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('ads');
        if (stored) {
            const parsed = JSON.parse(stored);
            setAds(parsed);
            generateNodes(parsed);
        }

        // Load custom trait groups
        const storedGroups = localStorage.getItem('custom_trait_groups');
        if (storedGroups) {
            setCustomTraitGroups(JSON.parse(storedGroups));
        }
    }, []);

    // Generate 3D nodes from ads - EXPANDED to extract 30+ trait categories
    const generateNodes = (adsData: AdEntry[]) => {
        // Filter out unfinished/draft ads - must have extractedContent with meaningful data
        const completeAds = adsData.filter(ad => {
            if (!ad.extractedContent) return false;
            const c = ad.extractedContent;
            // Consider complete if has at least one meaningful trait
            return c.hookType || c.platform || c.contentCategory || c.editingStyle ||
                c.musicType || c.hasSubtitles || c.isUGCStyle || c.title;
        });

        const traitMap = new Map<string, { count: number; successSum: number; category: string; adIds: string[] }>();
        const nodesList: Node3D[] = [];

        // Count traits and collect ad IDs from complete ads only
        completeAds.forEach((ad) => {
            const content = ad.extractedContent;
            const successScore = ad.successScore || 50;

            const addTrait = (trait: string | undefined, category: string) => {
                // Skip undefined, null, empty, or 'other' values
                if (!trait || trait === 'other' || trait === 'null' || trait === 'undefined' || trait.trim() === '') return;

                // Clean up the label for display
                let cleanLabel = trait
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());

                const key = `${category}:${cleanLabel}`;
                const existing = traitMap.get(key) || { count: 0, successSum: 0, category, adIds: [] };
                existing.count++;
                existing.successSum += successScore;
                existing.adIds.push(ad.id);
                traitMap.set(key, existing);
            };

            // Helper for boolean traits
            const addBoolTrait = (value: boolean | undefined, trueLabel: string, category: string) => {
                if (value === true) addTrait(trueLabel, category);
            };

            // Helper for array traits
            const addArrayTraits = (arr: string[] | undefined, category: string) => {
                arr?.forEach(t => addTrait(t, category));
            };

            // ===== CORE TRAITS (original 8) =====
            addTrait(content.hookType, 'Hook');
            addTrait(content.platform, 'Platform');
            addTrait(content.contentCategory, 'Category');
            addTrait(content.editingStyle, 'Editing');
            addTrait(content.colorScheme, 'Color');
            addTrait(content.musicType, 'Music');
            addBoolTrait(content.hasSubtitles, 'Subtitles', 'Feature');
            addBoolTrait(content.isUGCStyle, 'UGC Style', 'Style');

            // ===== EXPANDED TRAITS (22+ new categories) =====

            // Media & Format
            addTrait(content.mediaType, 'Media');
            addTrait(content.aspectRatio, 'Aspect');
            addTrait(content.durationCategory, 'Duration');
            addTrait(content.adFormat, 'Media');

            // Platform & Placement
            addTrait(content.placement, 'Placement');
            addTrait(content.industryVertical, 'Category');

            // Hook Details
            addTrait(content.hookVelocity, 'Hook');
            addArrayTraits(content.hookKeywords, 'Hook');

            // Pattern & Sentiment
            addTrait(content.patternType, 'Pattern');
            addTrait(content.overallSentiment, 'Sentiment');
            addTrait(content.emotionalTone, 'Emotion');

            // Face & Talent
            addBoolTrait(content.facePresence, 'Face Present', 'Face');
            addTrait(content.facialEmotion, 'Face');
            addTrait(content.talentType, 'Talent');
            if (content.numberOfActors && content.numberOfActors > 0) {
                addTrait(content.numberOfActors === 1 ? 'Solo' : content.numberOfActors + ' People', 'Talent');
            }

            // Text & Overlays
            addBoolTrait(content.hasTextOverlays, 'Text Overlays', 'Text');
            addTrait(content.textOverlayRatio, 'Text');
            addTrait(content.textReadability, 'Text');
            addTrait(content.subtitleStyle, 'Feature');

            // Visual Style
            addTrait(content.colorTemperature, 'Color');
            addTrait(content.shotComposition, 'Shot');
            addTrait(content.sceneVelocity, 'Scene');
            addArrayTraits(content.visualStyle, 'Style');

            // Audio & Voice
            addTrait(content.bpm, 'Audio');
            addBoolTrait(content.hasVoiceover, 'Voiceover', 'Voice');
            addTrait(content.voiceoverStyle, 'Voice');
            addTrait(content.voiceGender, 'Voice');
            addTrait(content.speechPace, 'Voice');

            // CTA
            addTrait(content.cta, 'CTA');
            addTrait(content.ctaStrength, 'CTA');

            // Brand & Logo
            addTrait(content.logoConsistency, 'Logo');
            addTrait(content.logoTiming, 'Logo');
            addTrait(content.brandColorUsage, 'Brand');

            // Engagement Triggers
            addBoolTrait(content.curiosityGap, 'Curiosity Gap', 'Trigger');
            addArrayTraits(content.socialProofElements, 'Trigger');
            addArrayTraits(content.urgencyTriggers, 'Trigger');
            addArrayTraits(content.trustSignals, 'Trigger');

            // Custom & AI-Discovered
            addArrayTraits(content.customTraits, 'Custom');
            addArrayTraits(content.aiInsights, 'Custom');
        });

        // ===== STEP 1: Create CATEGORY nodes in MIDDLE ring =====
        // Collect unique categories and their trait children
        const categoryMap = new Map<string, { traitIds: string[]; adIds: Set<string>; successSum: number; count: number }>();

        traitMap.forEach((value, key) => {
            const [category] = key.split(':');
            if (!categoryMap.has(category)) {
                categoryMap.set(category, { traitIds: [], adIds: new Set(), successSum: 0, count: 0 });
            }
            const catData = categoryMap.get(category)!;
            catData.traitIds.push(key);
            value.adIds.forEach(id => catData.adIds.add(id));
            catData.successSum += value.successSum;
            catData.count += value.count;
        });

        // Create category nodes
        let categoryIndex = 0;
        const categoryPositions = new Map<string, { x: number; y: number; z: number }>();

        categoryMap.forEach((value, category) => {
            const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Custom;
            const parentGroup = CATEGORY_TO_PARENT_GROUP[category] || '✨ Custom';
            const avgSuccess = value.count > 0 ? value.successSum / value.count : 50;

            // Position categories in middle ring sphere
            const phi = Math.acos(-1 + (2 * categoryIndex) / Math.max(categoryMap.size, 1));
            const theta = Math.sqrt(categoryMap.size * Math.PI) * phi;
            const radius = 140; // Middle ring between ads (~90) and traits (~220)

            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);

            categoryPositions.set(category, { x, y, z });

            nodesList.push({
                id: `category:${category}`,
                label: category,
                category: category,
                parentGroup,
                type: 'category',
                x,
                y,
                z,
                size: 45, // Larger than traits
                color: colors.primary,
                colorLight: colors.light,
                colorDark: colors.dark,
                connections: [...value.traitIds, ...Array.from(value.adIds)], // Connect to traits AND ads
                successRate: Math.round(avgSuccess),
                frequency: value.traitIds.length, // Number of trait children
            });

            categoryIndex++;
        });

        // ===== STEP 2: Create TRAIT nodes in OUTER ring - branching from categories =====
        let traitIndex = 0;
        traitMap.forEach((value, key) => {
            const [category, label] = key.split(':');
            const avgSuccess = value.count > 0 ? value.successSum / value.count : 50;
            const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Custom;
            const parentGroup = CATEGORY_TO_PARENT_GROUP[category] || '✨ Custom';

            // Get parent category position
            const catPos = categoryPositions.get(category) || { x: 0, y: 0, z: 0 };

            // Position traits branching outward from their category
            // Calculate offset angle within the category's trait group
            const categoryData = categoryMap.get(category);
            const traitsInCategory = categoryData?.traitIds || [];
            const indexInCategory = traitsInCategory.indexOf(key);
            const spreadAngle = (Math.PI * 0.6) / Math.max(traitsInCategory.length, 1); // Spread within ~108 degrees
            const offsetAngle = (indexInCategory - traitsInCategory.length / 2) * spreadAngle;

            // Extend outward from category position
            const baseRadius = Math.sqrt(catPos.x ** 2 + catPos.y ** 2 + catPos.z ** 2);
            const traitRadius = 220 + Math.random() * 30; // Outer sphere
            const extensionRatio = traitRadius / (baseRadius || 1);

            // Add angular offset for branching effect
            const x = catPos.x * extensionRatio + Math.cos(offsetAngle) * 30;
            const y = catPos.y * extensionRatio + Math.sin(offsetAngle) * 30;
            const z = catPos.z * extensionRatio + (Math.random() - 0.5) * 20;

            nodesList.push({
                id: key,
                label,
                category,
                parentGroup,
                type: 'trait',
                x,
                y,
                z,
                size: Math.min(35, 12 + value.count * 6),
                color: colors.primary,
                colorLight: colors.light,
                colorDark: colors.dark,
                connections: [`category:${category}`, ...value.adIds], // Connect to parent category AND ads
                successRate: Math.round(avgSuccess),
                frequency: value.count,
            });

            traitIndex++;
        });

        // Create ad nodes in inner sphere from complete ads only
        completeAds.forEach((ad, adIndex) => {
            const content = ad.extractedContent;
            const colors = CATEGORY_COLORS.Ad;

            // Collect ALL traits for this ad (matching the expanded trait extraction above)
            const adTraits: string[] = [];

            const addAdTrait = (trait: string | undefined, category: string) => {
                if (!trait || trait === 'other' || trait === 'null' || trait === 'undefined' || trait.trim() === '') return;
                const cleanLabel = trait.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                adTraits.push(`${category}:${cleanLabel}`);
            };

            const addBoolAdTrait = (value: boolean | undefined, trueLabel: string, category: string) => {
                if (value === true) addAdTrait(trueLabel, category);
            };

            const addArrayAdTraits = (arr: string[] | undefined, category: string) => {
                arr?.forEach(t => addAdTrait(t, category));
            };

            // ===== CORE TRAITS =====
            addAdTrait(content.hookType, 'Hook');
            addAdTrait(content.platform, 'Platform');
            addAdTrait(content.contentCategory, 'Category');
            addAdTrait(content.editingStyle, 'Editing');
            addAdTrait(content.colorScheme, 'Color');
            addAdTrait(content.musicType, 'Music');
            addBoolAdTrait(content.hasSubtitles, 'Subtitles', 'Feature');
            addBoolAdTrait(content.isUGCStyle, 'UGC Style', 'Style');

            // ===== EXPANDED TRAITS =====
            // Media & Format
            addAdTrait(content.mediaType, 'Media');
            addAdTrait(content.aspectRatio, 'Aspect');
            addAdTrait(content.durationCategory, 'Duration');
            addAdTrait(content.adFormat, 'Media');

            // Platform & Placement
            addAdTrait(content.placement, 'Placement');
            addAdTrait(content.industryVertical, 'Category');

            // Hook Details
            addAdTrait(content.hookVelocity, 'Hook');
            addArrayAdTraits(content.hookKeywords, 'Hook');

            // Pattern & Sentiment
            addAdTrait(content.patternType, 'Pattern');
            addAdTrait(content.overallSentiment, 'Sentiment');
            addAdTrait(content.emotionalTone, 'Emotion');

            // Face & Talent
            addBoolAdTrait(content.facePresence, 'Face Present', 'Face');
            addAdTrait(content.facialEmotion, 'Face');
            addAdTrait(content.talentType, 'Talent');
            if (content.numberOfActors && content.numberOfActors > 0) {
                addAdTrait(content.numberOfActors === 1 ? 'Solo' : content.numberOfActors + ' People', 'Talent');
            }

            // Text & Overlays
            addBoolAdTrait(content.hasTextOverlays, 'Text Overlays', 'Text');
            addAdTrait(content.textOverlayRatio, 'Text');
            addAdTrait(content.textReadability, 'Text');
            addAdTrait(content.subtitleStyle, 'Feature');

            // Visual Style
            addAdTrait(content.colorTemperature, 'Color');
            addAdTrait(content.shotComposition, 'Shot');
            addAdTrait(content.sceneVelocity, 'Scene');
            addArrayAdTraits(content.visualStyle, 'Style');

            // Audio & Voice
            addAdTrait(content.bpm, 'Audio');
            addBoolAdTrait(content.hasVoiceover, 'Voiceover', 'Voice');
            addAdTrait(content.voiceoverStyle, 'Voice');
            addAdTrait(content.voiceGender, 'Voice');
            addAdTrait(content.speechPace, 'Voice');

            // CTA
            addAdTrait(content.cta, 'CTA');
            addAdTrait(content.ctaStrength, 'CTA');

            // Brand & Logo
            addAdTrait(content.logoConsistency, 'Logo');
            addAdTrait(content.logoTiming, 'Logo');
            addAdTrait(content.brandColorUsage, 'Brand');

            // Engagement Triggers
            addBoolAdTrait(content.curiosityGap, 'Curiosity Gap', 'Trigger');
            addArrayAdTraits(content.socialProofElements, 'Trigger');
            addArrayAdTraits(content.urgencyTriggers, 'Trigger');
            addArrayAdTraits(content.trustSignals, 'Trigger');

            // Custom & AI-Discovered
            addArrayAdTraits(content.customTraits, 'Custom');
            addArrayAdTraits(content.aiInsights, 'Custom');

            // Position ads in inner sphere with better spacing
            const phi = Math.acos(-1 + (2 * adIndex) / Math.max(completeAds.length, 1));
            const theta = Math.sqrt(completeAds.length * Math.PI) * phi;
            // Larger base radius + more random variation = more spread
            const radius = 60 + (adIndex * 15) % 40 + Math.random() * 10;

            // Only use REAL data - no simulated scores
            const predictedScore = ad.predictedScore; // undefined if not predicted
            const actualScore = ad.successScore; // undefined if no results
            const hasResults = actualScore !== undefined && actualScore !== null;

            nodesList.push({
                id: ad.id,
                label: content.title || `Ad ${adIndex + 1}`,
                category: 'Ad',
                parentGroup: 'Ad',
                type: 'ad',
                x: radius * Math.cos(theta) * Math.sin(phi),
                y: radius * Math.sin(theta) * Math.sin(phi),
                z: radius * Math.cos(phi),
                size: 35,
                // Use neutral gray if no results, otherwise color by score
                color: !hasResults ? '#6B7280' :
                    (actualScore ?? 0) >= 70 ? '#10B981' :
                        (actualScore ?? 0) >= 50 ? '#F59E0B' : '#EF4444',
                colorLight: colors.light,
                colorDark: colors.dark,
                connections: adTraits,
                successRate: actualScore ?? 0, // Default to 0 if undefined
                frequency: 1,
                predictedScore,
                actualScore,
                thumbnailUrl: ad.thumbnailUrl,
                traits: adTraits,
                // Facebook metrics for Results orb
                adInsights: ad.adInsights,
                resultsDescription: ad.resultsDescription,
                status: ad.status,
            });

            // ===== Generate METRIC ORBS for ads with adInsights =====
            if (ad.adInsights) {
                const insights = ad.adInsights;
                const adNodeX = radius * Math.cos(theta) * Math.sin(phi);
                const adNodeY = radius * Math.sin(theta) * Math.sin(phi);
                const adNodeZ = radius * Math.cos(phi);
                const metricRadius = 35; // Distance from ad node

                const metricTypes = [
                    { key: 'impressions', label: 'Impressions', value: insights.impressions, icon: '👁️' },
                    { key: 'reach', label: 'Reach', value: insights.reach, icon: '📣' },
                    { key: 'clicks', label: 'Clicks', value: insights.clicks, icon: '👆' },
                    { key: 'ctr', label: 'CTR', value: insights.ctr, suffix: '%', icon: '📈' },
                    { key: 'spend', label: 'Spend', value: insights.spend, prefix: '₱', icon: '💰' },
                ];

                metricTypes.forEach((metric, metricIdx) => {
                    if (metric.value !== undefined && metric.value !== null) {
                        const metricAngle = (metricIdx / metricTypes.length) * Math.PI * 2;
                        const colors = CATEGORY_COLORS[metric.label] || CATEGORY_COLORS.Metric;

                        // Format the display value
                        let displayValue = metric.value.toLocaleString();
                        if (metric.prefix) displayValue = metric.prefix + displayValue;
                        if (metric.suffix) displayValue = displayValue + metric.suffix;

                        nodesList.push({
                            id: `metric:${ad.id}:${metric.key}`,
                            label: `${metric.icon} ${displayValue}`,
                            category: metric.label,
                            parentGroup: '📊 Results & Metrics',
                            type: 'metric' as 'trait' | 'ad' | 'category',
                            x: adNodeX + metricRadius * Math.cos(metricAngle),
                            y: adNodeY + metricRadius * Math.sin(metricAngle),
                            z: adNodeZ + (metricIdx - 2) * 8, // Slight z offset
                            size: 20,
                            color: colors.primary,
                            colorLight: colors.light,
                            colorDark: colors.dark,
                            connections: [ad.id],
                            successRate: typeof metric.value === 'number' ? Math.min(100, metric.value / 10) : 50,
                            frequency: 1,
                        });
                    }
                });
            }

            // ===== Generate DAILY ORBS for ads with dailyReports =====
            if (ad.dailyReports && ad.dailyReports.length > 0) {
                const adNodeX = radius * Math.cos(theta) * Math.sin(phi);
                const adNodeY = radius * Math.sin(theta) * Math.sin(phi);
                const adNodeZ = radius * Math.cos(phi);
                const dailyRadius = 50; // Distance from ad node

                ad.dailyReports.forEach((day, dayIdx) => {
                    // Arrange days in a timeline arc
                    const totalDays = ad.dailyReports!.length;
                    const arcAngle = (dayIdx / Math.max(totalDays - 1, 1)) * Math.PI - Math.PI / 2;

                    // Create orbs for key metrics of each day
                    const dailyMetrics = [
                        { key: 'impressions', value: day.impressions, icon: '👁️', color: CATEGORY_COLORS.Impressions },
                        { key: 'clicks', value: day.clicks, icon: '👆', color: CATEGORY_COLORS.Clicks },
                        { key: 'ctr', value: day.ctr, suffix: '%', icon: '📈', color: CATEGORY_COLORS.CTR },
                        { key: 'spend', value: day.spend, prefix: '₱', icon: '💰', color: CATEGORY_COLORS.Spend },
                    ];

                    // Create a parent "day" orb
                    const dayX = adNodeX + dailyRadius * Math.cos(arcAngle);
                    const dayY = adNodeY + dailyRadius * Math.sin(arcAngle);
                    const dayZ = adNodeZ + dayIdx * 5;
                    const dateStr = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const colors = CATEGORY_COLORS.Metric;

                    nodesList.push({
                        id: `daily:${ad.id}:${day.date}`,
                        label: `📅 ${dateStr}`,
                        category: 'Daily',
                        parentGroup: '📊 Results & Metrics',
                        type: 'daily' as 'trait' | 'ad' | 'category' | 'metric' | 'daily',
                        x: dayX,
                        y: dayY,
                        z: dayZ,
                        size: 25,
                        color: colors.primary,
                        colorLight: colors.light,
                        colorDark: colors.dark,
                        connections: [ad.id],
                        successRate: day.ctr * 10, // Scale CTR for visualization
                        frequency: 1,
                    });

                    // Create child metric orbs around each day
                    dailyMetrics.forEach((metric, metricIdx) => {
                        if (metric.value !== undefined && metric.value > 0) {
                            const metricAngle = (metricIdx / dailyMetrics.length) * Math.PI * 2;
                            const metricRadius = 15;

                            let displayValue = metric.value.toLocaleString();
                            if (metric.prefix) displayValue = metric.prefix + displayValue;
                            if (metric.suffix) displayValue = displayValue + metric.suffix;

                            nodesList.push({
                                id: `daily-metric:${ad.id}:${day.date}:${metric.key}`,
                                label: `${metric.icon} ${displayValue}`,
                                category: metric.key,
                                parentGroup: '📊 Results & Metrics',
                                type: 'daily' as 'trait' | 'ad' | 'category' | 'metric' | 'daily',
                                x: dayX + metricRadius * Math.cos(metricAngle),
                                y: dayY + metricRadius * Math.sin(metricAngle),
                                z: dayZ,
                                size: 14,
                                color: metric.color.primary,
                                colorLight: metric.color.light,
                                colorDark: metric.color.dark,
                                connections: [`daily:${ad.id}:${day.date}`],
                                successRate: 50,
                                frequency: 1,
                            });
                        }
                    });
                });
            }
        });

        setNodes(nodesList);
    };

    // Delete an ad from storage and refresh
    const deleteAd = (adId: string) => {
        console.log('=== DELETE AD CALLED ===');
        console.log('Attempting to delete ID:', adId);
        console.log('ID type:', typeof adId);

        const stored = localStorage.getItem('ads');
        if (!stored) {
            console.log('ERROR: No ads in localStorage');
            alert('Error: No ads found in storage');
            return;
        }

        const allAds = JSON.parse(stored);
        console.log('Total ads in storage:', allAds.length);
        console.log('Ad IDs in storage:', allAds.map((a: AdEntry) => a.id));

        // Check if the ID exists
        const adExists = allAds.find((a: AdEntry) => a.id === adId);
        console.log('Ad found in storage:', adExists ? 'YES' : 'NO');

        if (!adExists) {
            console.log('ERROR: Ad ID not found in storage!');
            alert('Error: Could not find this ad in storage. ID: ' + adId);
            return;
        }

        const confirmDelete = window.confirm('Delete "' + (adExists.extractedContent?.title || 'this ad') + '"? This cannot be undone.');
        if (!confirmDelete) {
            console.log('Delete cancelled by user');
            return;
        }

        console.log('User confirmed deletion');
        const filtered = allAds.filter((ad: AdEntry) => ad.id !== adId);
        console.log('After filter count:', filtered.length);

        localStorage.setItem('ads', JSON.stringify(filtered));
        setAds(filtered);
        generateNodes(filtered);
        setSelectedNode(null);
        setHighlightedNodes(new Set());

        console.log('=== AD DELETED SUCCESSFULLY ===');
        alert('Ad deleted successfully!');
    };

    // Start editing an ad
    const startEditAd = (node: Node3D) => {
        const ad = ads.find(a => a.id === node.id);
        if (!ad) return;

        setEditTitle(ad.extractedContent?.title || '');
        setEditPlatform(ad.extractedContent?.platform || '');
        setEditHookType(ad.extractedContent?.hookType || '');
        setEditContentCategory(ad.extractedContent?.contentCategory || '');
        setEditPredictedScore(ad.predictedScore?.toString() || '');
        setEditActualScore(ad.successScore?.toString() || '');
        setIsEditMode(true);
    };

    // Save edited ad
    const saveAdEdit = () => {
        if (!selectedNode) return;

        const updatedAds = ads.map(ad => {
            if (ad.id === selectedNode.id) {
                return {
                    ...ad,
                    predictedScore: editPredictedScore ? parseInt(editPredictedScore) : ad.predictedScore,
                    successScore: editActualScore ? parseInt(editActualScore) : ad.successScore,
                    extractedContent: {
                        ...ad.extractedContent,
                        title: editTitle || ad.extractedContent?.title,
                        platform: editPlatform || ad.extractedContent?.platform,
                        hookType: editHookType || ad.extractedContent?.hookType,
                        contentCategory: editContentCategory || ad.extractedContent?.contentCategory,
                    }
                };
            }
            return ad;
        });

        localStorage.setItem('ads', JSON.stringify(updatedAds));
        setAds(updatedAds);
        generateNodes(updatedAds);
        setIsEditMode(false);

        // Refresh selected node with updated data
        const updatedAd = updatedAds.find(a => a.id === selectedNode.id);
        if (updatedAd) {
            const updatedNode = nodes.find(n => n.id === selectedNode.id);
            if (updatedNode) {
                setSelectedNode({
                    ...updatedNode,
                    label: editTitle || updatedNode.label,
                });
            }
        }

        alert('Ad updated successfully!');
    };

    // Cancel edit mode
    const cancelEdit = () => {
        setIsEditMode(false);
        setEditTitle('');
        setEditPlatform('');
        setEditHookType('');
        setEditContentCategory('');
        setEditPredictedScore('');
        setEditActualScore('');
    };

    // Auto-rotation - slower interval for better performance
    useEffect(() => {
        if (!isAutoRotate) return;
        const interval = setInterval(() => {
            setRotation((prev) => ({ x: prev.x, y: prev.y + 0.5 }));
        }, 100); // Slower interval, bigger step for smooth motion
        return () => clearInterval(interval);
    }, [isAutoRotate]);

    // Search functionality
    useEffect(() => {
        if (!searchQuery.trim()) {
            setHighlightedNodes(new Set());
            return;
        }

        const query = searchQuery.toLowerCase();
        const matches = new Set<string>();

        nodes.forEach((node) => {
            if (
                node.label.toLowerCase().includes(query) ||
                node.category.toLowerCase().includes(query)
            ) {
                matches.add(node.id);
                // Also highlight connected nodes
                node.connections.forEach(c => matches.add(c));
            }
        });

        setHighlightedNodes(matches);
    }, [searchQuery, nodes]);

    // Mouse handlers for rotation
    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        setIsAutoRotate(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        setRotation((prev) => ({
            x: prev.x + dy * 0.5,
            y: prev.y + dx * 0.5,
        }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((prev) => Math.max(0.5, Math.min(2, prev - e.deltaY * 0.001)));
    };

    // Project 3D to 2D with rotation
    const project = (x: number, y: number, z: number) => {
        const radX = (rotation.x * Math.PI) / 180;
        const radY = (rotation.y * Math.PI) / 180;

        let y1 = y * Math.cos(radX) - z * Math.sin(radX);
        let z1 = y * Math.sin(radX) + z * Math.cos(radX);
        let x1 = x * Math.cos(radY) + z1 * Math.sin(radY);
        z1 = -x * Math.sin(radY) + z1 * Math.cos(radY);

        const perspective = 500;
        const scale = perspective / (perspective + z1);

        return { x: x1 * scale * zoom, y: y1 * scale * zoom, z: z1, scale: scale * zoom };
    };

    // Project to flat 2D (no rotation, use x/y only)
    const project2D = (x: number, y: number, z: number) => {
        // Flatten z-axis: use it to offset x slightly for depth feel
        const flatX = x + z * 0.2;
        const flatY = y;
        return { x: flatX * zoom * 1.2, y: flatY * zoom * 1.2, z: 0, scale: zoom };
    };

    // Filter and sort nodes - use 2D or 3D projection based on viewDimension
    const sortedNodes = useMemo(() => {
        let filtered = nodes;
        if (viewMode === 'ads') filtered = nodes.filter(n => n.type === 'ad');
        if (viewMode === 'traits') filtered = nodes.filter(n => n.type === 'trait' || n.type === 'category');
        if (viewMode === 'metrics') filtered = nodes.filter(n => n.type === 'ad' || n.type === 'metric');
        if (viewMode === 'daily') filtered = nodes.filter(n => n.type === 'ad' || n.type === 'daily');

        const projectFn = viewDimension === '2d' ? project2D : project;

        return filtered
            .map((node) => ({ ...node, projected: projectFn(node.x, node.y, node.z) }))
            .sort((a, b) => a.projected.z - b.projected.z);
    }, [nodes, rotation, zoom, viewMode, viewDimension]);

    // Get connection lines - optimized for performance
    // Only show ALL connections when highlighting, otherwise just category→trait
    const connections = useMemo(() => {
        const lines: { from: Node3D & { projected: ReturnType<typeof project> }; to: Node3D & { projected: ReturnType<typeof project> }; color: string }[] = [];
        const showAllConnections = highlightedNodes.size > 0 || selectedNode !== null;

        sortedNodes.forEach(node => {
            // Category nodes connect to their traits (always show these)
            if (node.type === 'category') {
                // Limit to first 8 trait connections when not highlighting
                const traitConns = node.connections.filter(id => id.includes(':') && !id.startsWith('category:'));
                const maxConns = showAllConnections ? traitConns.length : Math.min(5, traitConns.length);

                traitConns.slice(0, maxConns).forEach(connId => {
                    const connNode = sortedNodes.find(n => n.id === connId);
                    if (connNode && connNode.type === 'trait') {
                        lines.push({
                            from: node,
                            to: connNode,
                            color: node.color,
                        });
                    }
                });
            }
            // Ad nodes connect to categories - only when selected/highlighted
            if (node.type === 'ad' && (highlightedNodes.has(node.id) || selectedNode?.id === node.id)) {
                const adCategories = new Set<string>();
                node.connections.forEach(traitId => {
                    if (traitId.includes(':')) {
                        const [category] = traitId.split(':');
                        adCategories.add(`category:${category}`);
                    }
                });
                adCategories.forEach(catId => {
                    const catNode = sortedNodes.find(n => n.id === catId);
                    if (catNode) {
                        lines.push({
                            from: node,
                            to: catNode,
                            color: catNode.color,
                        });
                    }
                });
            }
        });

        return lines;
    }, [sortedNodes, highlightedNodes, selectedNode]);

    // Search results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return nodes.filter(
            (n) =>
                n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, nodes]);

    const adNodes = nodes.filter(n => n.type === 'ad');
    const traitNodes = nodes.filter(n => n.type === 'trait');
    const categoryNodes = nodes.filter(n => n.type === 'category');

    // Calculate metrics for the dashboard
    const metrics = useMemo(() => {
        if (ads.length === 0) return null;

        // Prediction accuracy
        const adsWithResults = ads.filter(a => a.successScore !== undefined && a.predictedScore !== undefined);
        const avgPredictionError = adsWithResults.length > 0
            ? adsWithResults.reduce((acc, a) => acc + Math.abs((a.successScore || 0) - (a.predictedScore || 0)), 0) / adsWithResults.length
            : 0;
        const predictionAccuracy = Math.max(0, 100 - avgPredictionError);

        // Top performing traits (by success rate)
        const topTraits = traitNodes
            .filter(t => t.successRate > 0)
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5)
            .map(t => ({ label: t.label, category: t.category, rate: t.successRate }));

        // Platform performance
        const platformStats: Record<string, { count: number; totalScore: number }> = {};
        ads.forEach(ad => {
            const platform = ad.extractedContent?.platform || 'unknown';
            if (!platformStats[platform]) platformStats[platform] = { count: 0, totalScore: 0 };
            platformStats[platform].count++;
            if (ad.successScore) platformStats[platform].totalScore += ad.successScore;
        });
        const platforms = Object.entries(platformStats).map(([name, data]) => ({
            name,
            count: data.count,
            avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0
        })).sort((a, b) => b.avgScore - a.avgScore);

        // Hook type performance
        const hookStats: Record<string, { count: number; totalScore: number }> = {};
        ads.forEach(ad => {
            const hook = ad.extractedContent?.hookType || 'unknown';
            if (!hookStats[hook]) hookStats[hook] = { count: 0, totalScore: 0 };
            hookStats[hook].count++;
            if (ad.successScore) hookStats[hook].totalScore += ad.successScore;
        });
        const hooks = Object.entries(hookStats).map(([name, data]) => ({
            name: name.replace(/_/g, ' '),
            count: data.count,
            avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0
        })).sort((a, b) => b.avgScore - a.avgScore);

        return {
            totalAds: ads.length,
            adsWithResults: adsWithResults.length,
            predictionAccuracy: Math.round(predictionAccuracy),
            topTraits,
            platforms,
            hooks
        };
    }, [ads, traitNodes]);

    // Show/hide metrics panel
    const [showMetrics, setShowMetrics] = useState(false);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>🧠 Algorithm</h1>
                <p className={styles.subtitle}>
                    Ads (inner orbs) connected to their traits (outer orbs) • Prediction vs Reality
                </p>
            </header>

            {/* Search Bar */}
            <div className={styles.searchContainer}>
                <div className={styles.searchBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search ads or traits..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                    {searchQuery && (
                        <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>×</button>
                    )}
                </div>

                {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                        {searchResults.slice(0, 8).map((node) => (
                            <button
                                key={node.id}
                                className={styles.searchResult}
                                onClick={() => {
                                    setSelectedNode(node);
                                    const allConnected = new Set([node.id, ...node.connections]);
                                    setHighlightedNodes(allConnected);
                                }}
                            >
                                <span className={styles.resultType} style={{ background: node.color }}>
                                    {node.type === 'ad' ? '📹' : node.type === 'category' ? '📁' : '🏷️'}
                                </span>
                                <span className={styles.resultLabel}>{node.label}</span>
                                {node.type === 'ad' && node.predictedScore !== undefined && (
                                    <span className={styles.resultPrediction}>
                                        P:{node.predictedScore}% → A:{node.actualScore}%
                                    </span>
                                )}
                                {node.type === 'category' && (
                                    <span className={styles.resultPrediction}>
                                        {node.frequency} traits
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                {/* 2D/3D Toggle */}
                <div className={styles.viewToggle}>
                    <button
                        className={`btn btn-sm ${viewDimension === '3d' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewDimension('3d')}
                    >🌐 3D</button>
                    <button
                        className={`btn btn-sm ${viewDimension === '2d' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewDimension('2d')}
                    >📊 2D</button>
                </div>

                {/* Node Filter */}
                <div className={styles.viewToggle}>
                    <button
                        className={`btn btn-sm ${viewMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('all')}
                    >All ({nodes.length})</button>
                    <button
                        className={`btn btn-sm ${viewMode === 'ads' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('ads')}
                    >📹 Ads ({adNodes.length})</button>
                    <button
                        className={`btn btn-sm ${viewMode === 'traits' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('traits')}
                    >🏷️ Traits</button>
                    <button
                        className={`btn btn-sm ${viewMode === 'metrics' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('metrics')}
                    >📊 Metrics</button>
                    <button
                        className={`btn btn-sm ${viewMode === 'daily' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('daily')}
                    >📅 Daily</button>
                </div>

                {viewDimension === '3d' && (
                    <button
                        className={`btn btn-sm ${isAutoRotate ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setIsAutoRotate(!isAutoRotate)}
                    >
                        {isAutoRotate ? '⏸️ Stop' : '▶️ Rotate'}
                    </button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => setZoom(1)}>🔍 Reset</button>
                <button
                    className={`btn btn-sm ${showMetrics ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowMetrics(!showMetrics)}
                >
                    📊 Metrics
                </button>
            </div>

            {/* 3D Canvas */}
            <div
                ref={containerRef}
                className={styles.canvas3d}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {nodes.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🌌</div>
                        <h3>Your Algorithm Awaits</h3>
                        <p>Upload ads to see your pattern universe</p>
                        <a href="/upload" className="btn btn-primary">📤 Upload First Ad</a>
                    </div>
                ) : (
                    <svg width="100%" height="100%" viewBox="-400 -300 800 600" className={styles.svg3d}>
                        {/* Connections from ads to traits */}
                        {connections.map((conn, i) => {
                            const isHighlighted = highlightedNodes.size === 0 ||
                                (highlightedNodes.has(conn.from.id) && highlightedNodes.has(conn.to.id));
                            return (
                                <line
                                    key={i}
                                    x1={conn.from.projected.x}
                                    y1={conn.from.projected.y}
                                    x2={conn.to.projected.x}
                                    y2={conn.to.projected.y}
                                    stroke={conn.color}
                                    strokeWidth={isHighlighted ? 2 : 1}
                                    opacity={isHighlighted ? 0.6 : 0.15}
                                />
                            );
                        })}

                        {/* Nodes */}
                        {sortedNodes.map((node) => {
                            const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(node.id);
                            const isSelected = selectedNode?.id === node.id;

                            return (
                                <g
                                    key={node.id}
                                    transform={`translate(${node.projected.x}, ${node.projected.y})`}
                                    onClick={() => {
                                        setSelectedNode(node);
                                        const allConnected = new Set([node.id, ...node.connections]);
                                        setHighlightedNodes(allConnected);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                    opacity={isHighlighted ? 1 : 0.2}
                                >
                                    {/* Glow for selected */}
                                    {isSelected && (
                                        <circle
                                            r={node.size * node.projected.scale + 12}
                                            fill="none"
                                            stroke="#fff"
                                            strokeWidth={3}
                                            opacity={0.8}
                                        />
                                    )}

                                    {/* Outer ring (category color variation) */}
                                    <circle
                                        r={node.size * node.projected.scale + 4}
                                        fill={node.colorDark}
                                        opacity={0.5}
                                    />

                                    {/* Main orb */}
                                    <circle
                                        r={node.size * node.projected.scale}
                                        fill={`url(#gradient-${node.id.replace(/[^a-zA-Z0-9]/g, '')})`}
                                        stroke={node.type === 'ad' ? '#fff' : node.type === 'category' ? 'rgba(255,255,255,0.6)' : 'none'}
                                        strokeWidth={node.type === 'ad' ? 2 : node.type === 'category' ? 3 : 0}
                                        strokeDasharray={node.type === 'category' ? '8,4' : 'none'}
                                    />

                                    {/* Gradient definition */}
                                    <defs>
                                        <radialGradient id={`gradient-${node.id.replace(/[^a-zA-Z0-9]/g, '')}`}>
                                            <stop offset="0%" stopColor={node.colorLight} />
                                            <stop offset="70%" stopColor={node.color} />
                                            <stop offset="100%" stopColor={node.colorDark} />
                                        </radialGradient>
                                    </defs>

                                    {/* Ad indicator icon */}
                                    {node.type === 'ad' && node.projected.scale > 0.5 && (
                                        <text
                                            y={3}
                                            textAnchor="middle"
                                            fontSize={14 * node.projected.scale}
                                        >
                                            📹
                                        </text>
                                    )}

                                    {/* Category indicator icon */}
                                    {node.type === 'category' && node.projected.scale > 0.5 && (
                                        <text
                                            y={4}
                                            textAnchor="middle"
                                            fontSize={16 * node.projected.scale}
                                        >
                                            📁
                                        </text>
                                    )}

                                    {/* Trait label */}
                                    {node.type === 'trait' && node.projected.scale > 0.6 && (
                                        <>
                                            <text
                                                y={4}
                                                textAnchor="middle"
                                                fill={isLightMode ? "#1f2937" : "white"}
                                                fontSize={10 * node.projected.scale}
                                                fontWeight="600"
                                                style={{ textShadow: isLightMode ? '0 0 3px rgba(255,255,255,0.8)' : 'none' }}
                                            >
                                                {node.label.slice(0, 8)}
                                            </text>
                                            <text
                                                y={node.size * node.projected.scale + 12}
                                                textAnchor="middle"
                                                fill={isLightMode ? "#374151" : "white"}
                                                fontSize={8 * node.projected.scale}
                                                opacity={isLightMode ? 0.85 : 0.7}
                                                style={{ textShadow: isLightMode ? '0 0 3px rgba(255,255,255,0.8)' : 'none' }}
                                            >
                                                {node.category}
                                            </text>
                                        </>
                                    )}

                                    {/* Prediction vs Actual badge for ads */}
                                    {node.type === 'ad' && node.projected.scale > 0.7 && (
                                        <g transform={`translate(${node.size * node.projected.scale + 5}, -10)`}>
                                            <rect
                                                x={0}
                                                y={0}
                                                width={50 * node.projected.scale}
                                                height={24 * node.projected.scale}
                                                rx={4}
                                                fill={isLightMode ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.8)"}
                                                stroke={isLightMode ? "rgba(0,0,0,0.1)" : "none"}
                                                strokeWidth={isLightMode ? 1 : 0}
                                            />
                                            <text
                                                x={25 * node.projected.scale}
                                                y={10 * node.projected.scale}
                                                textAnchor="middle"
                                                fill={node.predictedScore! > node.actualScore! ? '#EF4444' : '#10B981'}
                                                fontSize={7 * node.projected.scale}
                                            >
                                                P:{node.predictedScore}%
                                            </text>
                                            <text
                                                x={25 * node.projected.scale}
                                                y={20 * node.projected.scale}
                                                textAnchor="middle"
                                                fill={isLightMode ? "#374151" : "#fff"}
                                                fontSize={7 * node.projected.scale}
                                            >
                                                A:{node.actualScore}%
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                )}

                <div className={styles.dragHint}>
                    {viewDimension === '3d'
                        ? '🖱️ Drag to rotate • Scroll to zoom • Click orbs for details'
                        : '🖱️ Drag to pan • Scroll to zoom • Click orbs for details'}
                </div>
            </div>

            {/* Selected Node Details */}
            {selectedNode && (
                <div className={`glass-card ${styles.nodeDetails}`}>
                    <button className={styles.closeDetails} onClick={() => { setSelectedNode(null); setHighlightedNodes(new Set()); }}>×</button>

                    <div className={styles.nodeHeader}>
                        <div
                            className={styles.nodeIcon}
                            style={{ background: `linear-gradient(135deg, ${selectedNode.colorLight}, ${selectedNode.colorDark})` }}
                        >
                            {selectedNode.type === 'ad' ? '📹' : '🏷️'}
                        </div>
                        <div>
                            <h3>{selectedNode.label}</h3>
                            {selectedNode.type === 'trait' ? (
                                <div className={styles.categoryHierarchy}>
                                    <span className={styles.parentGroup} style={{ color: PARENT_GROUP_COLORS[selectedNode.parentGroup] || '#6366F1' }}>
                                        {selectedNode.parentGroup}
                                    </span>
                                    <span className={styles.hierarchyArrow}>→</span>
                                    <span className={styles.nodeCategory}>{selectedNode.category}</span>
                                </div>
                            ) : (
                                <span className={styles.nodeCategory}>{selectedNode.category}</span>
                            )}
                        </div>
                    </div>

                    {/* Trait Description */}
                    {selectedNode.type === 'trait' && (
                        <div className={styles.traitDescription}>
                            <p>
                                {TRAIT_DESCRIPTIONS[selectedNode.id] ||
                                    CATEGORY_DESCRIPTIONS[selectedNode.category] ||
                                    `This trait represents "${selectedNode.label}" characteristics in your ads.`}
                            </p>
                        </div>
                    )}

                    {/* Prediction vs Actual for ads */}
                    {selectedNode.type === 'ad' && (
                        <div className={styles.predictionComparison}>
                            <div className={styles.predictionBox}>
                                <span className={styles.predictionLabel}>🤖 Predicted</span>
                                <span className={styles.predictionValue} style={{
                                    color: selectedNode.predictedScore! >= 70 ? 'var(--success)' :
                                        selectedNode.predictedScore! >= 50 ? 'var(--warning)' : 'var(--error)'
                                }}>
                                    {selectedNode.predictedScore}%
                                </span>
                            </div>
                            <div className={styles.predictionArrow}>
                                {selectedNode.predictedScore! > selectedNode.actualScore! ? '📉' : '📈'}
                            </div>
                            <div className={styles.predictionBox}>
                                <span className={styles.predictionLabel}>📊 Actual</span>
                                <span className={styles.predictionValue} style={{
                                    color: selectedNode.actualScore! >= 70 ? 'var(--success)' :
                                        selectedNode.actualScore! >= 50 ? 'var(--warning)' : 'var(--error)'
                                }}>
                                    {selectedNode.actualScore}%
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className={styles.detailsGrid}>
                        {selectedNode.type === 'trait' && (
                            <>
                                <div className={styles.detailItem}>
                                    <span>Used In</span>
                                    <strong>{selectedNode.frequency} ads</strong>
                                </div>
                                <div className={styles.detailItem}>
                                    <span>Avg Success</span>
                                    <strong style={{ color: selectedNode.color }}>{selectedNode.successRate}%</strong>
                                </div>
                            </>
                        )}
                        <div className={styles.detailItem}>
                            <span>Connections</span>
                            <strong>{selectedNode.connections.length}</strong>
                        </div>
                    </div>

                    {/* Connected traits for ads */}
                    {selectedNode.type === 'ad' && selectedNode.traits && (
                        <div className={styles.connectedTraits}>
                            <h4>🔗 Connected Traits</h4>
                            <div className={styles.traitList}>
                                {selectedNode.traits.slice(0, 12).map(traitId => {
                                    const [category, label] = traitId.split(':');
                                    const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Custom;
                                    return (
                                        <span
                                            key={traitId}
                                            className={styles.traitBadge}
                                            style={{
                                                background: `linear-gradient(135deg, ${colors.light}, ${colors.dark})`,
                                                color: '#fff'
                                            }}
                                        >
                                            {label}
                                        </span>
                                    );
                                })}
                                {selectedNode.traits.length > 12 && (
                                    <span className={styles.traitBadge} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                        +{selectedNode.traits.length - 12} more
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 📊 Results Orb - Facebook Metrics Display */}
                    {selectedNode.type === 'ad' && selectedNode.adInsights && (
                        <div className={styles.resultsOrb}>
                            <h4 style={{ color: '#c8f560', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📊 Results Orb
                                {selectedNode.status && (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        background: selectedNode.status === 'ACTIVE' ? '#22c55e' :
                                            selectedNode.status === 'PAUSED' ? '#f59e0b' : '#6b7280',
                                        color: '#000'
                                    }}>
                                        {selectedNode.status}
                                    </span>
                                )}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
                                {/* Spend */}
                                <div style={{ background: 'rgba(200, 245, 96, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#c8f560', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                        ₱{(selectedNode.adInsights.spend || 0).toFixed(2)}
                                    </div>
                                    <div style={{ color: '#888' }}>Spend</div>
                                </div>
                                {/* Results */}
                                <div style={{ background: 'rgba(200, 245, 96, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                        {selectedNode.adInsights.results || 0}
                                    </div>
                                    <div style={{ color: '#888' }}>{selectedNode.adInsights.resultType || 'Results'}</div>
                                </div>
                                {/* CTR */}
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#3b82f6', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                        {(selectedNode.adInsights.ctr || 0).toFixed(2)}%
                                    </div>
                                    <div style={{ color: '#888' }}>CTR</div>
                                </div>
                                {/* Cost per Result */}
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                        ₱{(selectedNode.adInsights.costPerResult || 0).toFixed(2)}
                                    </div>
                                    <div style={{ color: '#888' }}>Cost/Result</div>
                                </div>
                                {/* Impressions */}
                                <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#8b5cf6', fontSize: '1rem', fontWeight: 'bold' }}>
                                        {(selectedNode.adInsights.impressions || 0).toLocaleString()}
                                    </div>
                                    <div style={{ color: '#888' }}>Impressions</div>
                                </div>
                                {/* Reach */}
                                <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#ec4899', fontSize: '1rem', fontWeight: 'bold' }}>
                                        {(selectedNode.adInsights.reach || 0).toLocaleString()}
                                    </div>
                                    <div style={{ color: '#888' }}>Reach</div>
                                </div>
                                {/* Clicks */}
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#f59e0b', fontSize: '1rem', fontWeight: 'bold' }}>
                                        {selectedNode.adInsights.clicks || 0}
                                    </div>
                                    <div style={{ color: '#888' }}>Clicks</div>
                                </div>
                                {/* Engagement */}
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#22c55e', fontSize: '1rem', fontWeight: 'bold' }}>
                                        {selectedNode.adInsights.pageEngagement || 0}
                                    </div>
                                    <div style={{ color: '#888' }}>Engagement</div>
                                </div>
                            </div>
                            {/* Additional metrics row */}
                            {(selectedNode.adInsights.messagesStarted || selectedNode.adInsights.leads || selectedNode.adInsights.videoViews) && (
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                    {selectedNode.adInsights.messagesStarted && (
                                        <span style={{ background: '#1e40af', color: '#93c5fd', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>
                                            💬 {selectedNode.adInsights.messagesStarted} messages
                                        </span>
                                    )}
                                    {selectedNode.adInsights.leads && (
                                        <span style={{ background: '#065f46', color: '#6ee7b7', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>
                                            📋 {selectedNode.adInsights.leads} leads
                                        </span>
                                    )}
                                    {selectedNode.adInsights.videoViews && (
                                        <span style={{ background: '#7c2d12', color: '#fdba74', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>
                                            ▶️ {selectedNode.adInsights.videoViews} views
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Detailed Ad Information */}
                    {selectedNode.type === 'ad' && (() => {
                        const adData = ads.find(a => a.id === selectedNode.id);
                        const content = adData?.extractedContent;
                        if (!content) return null;

                        return (
                            <div className={styles.adDetailsExpanded}>
                                {/* Hook & First 3 Seconds Section */}
                                {(content.hookType || content.hookText || content.hookVelocity) && (
                                    <div className={styles.detailSection}>
                                        <h4>🎣 Hook & First 3 Seconds</h4>
                                        <div className={styles.detailGrid}>
                                            {content.hookType && (
                                                <div className={styles.detailRow}>
                                                    <span>Hook Type</span>
                                                    <strong>{content.hookType.replace(/_/g, ' ')}</strong>
                                                </div>
                                            )}
                                            {content.hookVelocity && (
                                                <div className={styles.detailRow}>
                                                    <span>Hook Speed</span>
                                                    <strong>{content.hookVelocity}</strong>
                                                </div>
                                            )}
                                            {content.hookText && (
                                                <div className={styles.detailRow} style={{ gridColumn: '1 / -1' }}>
                                                    <span>Opening Line</span>
                                                    <strong style={{ fontStyle: 'italic' }}>"{content.hookText}"</strong>
                                                </div>
                                            )}
                                            {content.hookKeywords && content.hookKeywords.length > 0 && (
                                                <div className={styles.detailRow} style={{ gridColumn: '1 / -1' }}>
                                                    <span>Hook Keywords</span>
                                                    <strong>{content.hookKeywords.join(', ')}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Duration & Format */}
                                {(content.duration || content.durationCategory || content.aspectRatio) && (
                                    <div className={styles.detailSection}>
                                        <h4>⏱️ Duration & Format</h4>
                                        <div className={styles.detailGrid}>
                                            {content.duration && (
                                                <div className={styles.detailRow}>
                                                    <span>Duration</span>
                                                    <strong>{content.duration}s</strong>
                                                </div>
                                            )}
                                            {content.durationCategory && (
                                                <div className={styles.detailRow}>
                                                    <span>Category</span>
                                                    <strong>{content.durationCategory}</strong>
                                                </div>
                                            )}
                                            {content.aspectRatio && (
                                                <div className={styles.detailRow}>
                                                    <span>Aspect Ratio</span>
                                                    <strong>{content.aspectRatio}</strong>
                                                </div>
                                            )}
                                            {content.adFormat && (
                                                <div className={styles.detailRow}>
                                                    <span>Format</span>
                                                    <strong>{content.adFormat}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Visual Style */}
                                {(content.editingStyle || content.colorScheme || content.shotComposition) && (
                                    <div className={styles.detailSection}>
                                        <h4>🎨 Visual Style</h4>
                                        <div className={styles.detailGrid}>
                                            {content.editingStyle && (
                                                <div className={styles.detailRow}>
                                                    <span>Editing</span>
                                                    <strong>{content.editingStyle.replace(/_/g, ' ')}</strong>
                                                </div>
                                            )}
                                            {content.colorScheme && (
                                                <div className={styles.detailRow}>
                                                    <span>Color</span>
                                                    <strong>{content.colorScheme}</strong>
                                                </div>
                                            )}
                                            {content.shotComposition && (
                                                <div className={styles.detailRow}>
                                                    <span>Shots</span>
                                                    <strong>{content.shotComposition}</strong>
                                                </div>
                                            )}
                                            {content.sceneVelocity && (
                                                <div className={styles.detailRow}>
                                                    <span>Pace</span>
                                                    <strong>{content.sceneVelocity}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Audio & Voice */}
                                {(content.musicType || content.hasVoiceover || content.voiceoverStyle) && (
                                    <div className={styles.detailSection}>
                                        <h4>🎵 Audio & Voice</h4>
                                        <div className={styles.detailGrid}>
                                            {content.musicType && (
                                                <div className={styles.detailRow}>
                                                    <span>Music</span>
                                                    <strong>{content.musicType}</strong>
                                                </div>
                                            )}
                                            {content.bpm && (
                                                <div className={styles.detailRow}>
                                                    <span>BPM</span>
                                                    <strong>{content.bpm}</strong>
                                                </div>
                                            )}
                                            {content.hasVoiceover !== undefined && (
                                                <div className={styles.detailRow}>
                                                    <span>Voiceover</span>
                                                    <strong>{content.hasVoiceover ? '✅ Yes' : '❌ No'}</strong>
                                                </div>
                                            )}
                                            {content.voiceGender && (
                                                <div className={styles.detailRow}>
                                                    <span>Voice</span>
                                                    <strong>{content.voiceGender}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Text & Overlays */}
                                {(content.hasSubtitles !== undefined || content.hasTextOverlays !== undefined) && (
                                    <div className={styles.detailSection}>
                                        <h4>📝 Text Features</h4>
                                        <div className={styles.featureFlags}>
                                            {content.hasSubtitles && <span className={styles.featureOn}>✅ Subtitles</span>}
                                            {content.hasTextOverlays && <span className={styles.featureOn}>✅ Text Overlays</span>}
                                            {content.isUGCStyle && <span className={styles.featureOn}>✅ UGC Style</span>}
                                            {content.facePresence && <span className={styles.featureOn}>✅ Face Present</span>}
                                            {content.curiosityGap && <span className={styles.featureOn}>✅ Curiosity Gap</span>}
                                        </div>
                                    </div>
                                )}

                                {/* CTA */}
                                {(content.cta || content.ctaStrength) && (
                                    <div className={styles.detailSection}>
                                        <h4>💡 Call to Action</h4>
                                        <div className={styles.detailGrid}>
                                            {content.cta && (
                                                <div className={styles.detailRow}>
                                                    <span>CTA</span>
                                                    <strong>{content.cta}</strong>
                                                </div>
                                            )}
                                            {content.ctaStrength && (
                                                <div className={styles.detailRow}>
                                                    <span>Strength</span>
                                                    <strong>{content.ctaStrength}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Why it worked/failed analysis */}
                    {selectedNode.type === 'ad' && (
                        <div className={styles.analysisBox}>
                            <h4>
                                {selectedNode.predictedScore! > selectedNode.actualScore!
                                    ? '❌ Why It Underperformed'
                                    : '✅ Why It Worked'}
                            </h4>
                            <p>
                                {selectedNode.predictedScore! > selectedNode.actualScore!
                                    ? `Predicted ${selectedNode.predictedScore}% but only achieved ${selectedNode.actualScore}%. Check if traits are trending down or audience mismatch.`
                                    : `Exceeded prediction by ${(selectedNode.actualScore || 0) - (selectedNode.predictedScore || 0)}%! These traits are working well for your audience.`
                                }
                            </p>
                        </div>
                    )}

                    {/* Edit Form for ads (shown when in edit mode) */}
                    {selectedNode.type === 'ad' && isEditMode && (
                        <div className={styles.editForm}>
                            <h4>✏️ Edit Ad Details</h4>

                            <div className={styles.editField}>
                                <label>Title</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Ad title..."
                                />
                            </div>

                            <div className={styles.editField}>
                                <label>Platform</label>
                                <select value={editPlatform} onChange={(e) => setEditPlatform(e.target.value)}>
                                    <option value="">Select Platform</option>
                                    <option value="tiktok">TikTok</option>
                                    <option value="instagram">Instagram</option>
                                    <option value="facebook">Facebook</option>
                                    <option value="youtube">YouTube</option>
                                    <option value="snapchat">Snapchat</option>
                                </select>
                            </div>

                            <div className={styles.editField}>
                                <label>Hook Type</label>
                                <select value={editHookType} onChange={(e) => setEditHookType(e.target.value)}>
                                    <option value="">Select Hook</option>
                                    <option value="curiosity">Curiosity</option>
                                    <option value="question">Question</option>
                                    <option value="shock">Shock</option>
                                    <option value="transformation">Transformation</option>
                                    <option value="problem_solution">Problem/Solution</option>
                                    <option value="story">Story</option>
                                </select>
                            </div>

                            <div className={styles.editField}>
                                <label>Content Category</label>
                                <select value={editContentCategory} onChange={(e) => setEditContentCategory(e.target.value)}>
                                    <option value="">Select Category</option>
                                    <option value="ugc">UGC</option>
                                    <option value="testimonial">Testimonial</option>
                                    <option value="product_demo">Product Demo</option>
                                    <option value="educational">Educational</option>
                                    <option value="entertainment">Entertainment</option>
                                </select>
                            </div>

                            <div className={styles.editFieldRow}>
                                <div className={styles.editField}>
                                    <label>Predicted Score</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editPredictedScore}
                                        onChange={(e) => setEditPredictedScore(e.target.value)}
                                        placeholder="0-100"
                                    />
                                </div>
                                <div className={styles.editField}>
                                    <label>Actual Score</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editActualScore}
                                        onChange={(e) => setEditActualScore(e.target.value)}
                                        placeholder="0-100"
                                    />
                                </div>
                            </div>

                            <div className={styles.editActions}>
                                <button className={styles.saveButton} onClick={saveAdEdit}>
                                    💾 Save Changes
                                </button>
                                <button className={styles.cancelButton} onClick={cancelEdit}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Action buttons for ads (shown when NOT in edit mode) */}
                    {selectedNode.type === 'ad' && !isEditMode && (
                        <div className={styles.adActions}>
                            <button
                                className={styles.editButton}
                                onClick={() => startEditAd(selectedNode)}
                            >
                                ✏️ Edit Ad
                            </button>
                            <button
                                className={styles.deleteButton}
                                onClick={() => deleteAd(selectedNode.id)}
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Metrics Panel */}
            {showMetrics && metrics && (
                <div className={`glass-card ${styles.metricsPanel}`}>
                    <div className={styles.metricsPanelHeader}>
                        <h3>📊 Algorithm Metrics</h3>
                        <button className={styles.closeDetails} onClick={() => setShowMetrics(false)}>×</button>
                    </div>

                    {/* Quick Stats */}
                    <div className={styles.metricsQuickStats}>
                        <div className={styles.metricStat}>
                            <span className={styles.metricValue}>{metrics.totalAds}</span>
                            <span className={styles.metricLabel}>Total Ads</span>
                        </div>
                        <div className={styles.metricStat}>
                            <span className={styles.metricValue}>{metrics.adsWithResults}</span>
                            <span className={styles.metricLabel}>With Results</span>
                        </div>
                        <div className={styles.metricStat}>
                            <span className={styles.metricValue} style={{
                                color: metrics.predictionAccuracy >= 70 ? 'var(--success)' :
                                    metrics.predictionAccuracy >= 50 ? 'var(--warning)' : 'var(--error)'
                            }}>
                                {metrics.predictionAccuracy}%
                            </span>
                            <span className={styles.metricLabel}>AI Accuracy</span>
                        </div>
                    </div>

                    {/* Top Performing Traits */}
                    {metrics.topTraits.length > 0 && (
                        <div className={styles.metricsSection}>
                            <h4>🏆 Top Performing Traits</h4>
                            {metrics.topTraits.map((trait, i) => (
                                <div key={i} className={styles.metricRow}>
                                    <span>{trait.label}</span>
                                    <span className={styles.metricScore} style={{
                                        color: trait.rate >= 70 ? 'var(--success)' :
                                            trait.rate >= 50 ? 'var(--warning)' : 'var(--error)'
                                    }}>{trait.rate}%</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Platform Performance */}
                    {metrics.platforms.length > 0 && (
                        <div className={styles.metricsSection}>
                            <h4>📱 Platform Performance</h4>
                            {metrics.platforms.slice(0, 4).map((p, i) => (
                                <div key={i} className={styles.metricRow}>
                                    <span>{p.name} ({p.count})</span>
                                    <span className={styles.metricScore} style={{
                                        color: p.avgScore >= 70 ? 'var(--success)' :
                                            p.avgScore >= 50 ? 'var(--warning)' : 'var(--error)'
                                    }}>{p.avgScore || '-'}%</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Hook Effectiveness */}
                    {metrics.hooks.length > 0 && (
                        <div className={styles.metricsSection}>
                            <h4>🎣 Hook Effectiveness</h4>
                            {metrics.hooks.slice(0, 4).map((h, i) => (
                                <div key={i} className={styles.metricRow}>
                                    <span>{h.name} ({h.count})</span>
                                    <span className={styles.metricScore} style={{
                                        color: h.avgScore >= 70 ? 'var(--success)' :
                                            h.avgScore >= 50 ? 'var(--warning)' : 'var(--error)'
                                    }}>{h.avgScore || '-'}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Parent Group Legend - Collapsible */}
            <div className={styles.legend} style={{
                width: legendCollapsed ? 'auto' : '220px',
                padding: legendCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-lg)'
            }}>
                <div
                    className={styles.legendTitle}
                    onClick={() => setLegendCollapsed(!legendCollapsed)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                >
                    {legendCollapsed ? '📊' : 'Trait Groups'}
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {legendCollapsed ? '▶' : '◀'}
                    </span>
                </div>

                {!legendCollapsed && (
                    <>
                        {/* Predefined trait groups */}
                        {Object.entries(PARENT_GROUP_COLORS).map(([group, color]) => (
                            <div key={group} className={styles.legendItem}>
                                <span
                                    className={styles.legendDot}
                                    style={{ background: color }}
                                />
                                {group}
                            </div>
                        ))}

                        {/* AI Generated Custom Groups */}
                        {customTraitGroups.length > 0 && (
                            <>
                                <div style={{
                                    marginTop: 'var(--spacing-md)',
                                    paddingTop: 'var(--spacing-sm)',
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px'
                                }}>
                                    🤖 AI Generated
                                </div>
                                {customTraitGroups.map((group, idx) => (
                                    <div key={idx} className={styles.legendItem}>
                                        <span
                                            className={styles.legendDot}
                                            style={{ background: group.color }}
                                        />
                                        {group.name}
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Add Custom Trait Button */}
                        <button
                            onClick={() => {
                                const name = prompt('Enter custom trait group name:');
                                if (name) {
                                    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
                                    const newGroup = {
                                        name: `✨ ${name}`,
                                        color: colors[customTraitGroups.length % colors.length],
                                        traits: []
                                    };
                                    setCustomTraitGroups([...customTraitGroups, newGroup]);
                                    // Save to localStorage
                                    localStorage.setItem('custom_trait_groups', JSON.stringify([...customTraitGroups, newGroup]));
                                }
                            }}
                            style={{
                                marginTop: 'var(--spacing-md)',
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '0.75rem',
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px dashed rgba(99, 102, 241, 0.3)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            + Add Custom Group
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
