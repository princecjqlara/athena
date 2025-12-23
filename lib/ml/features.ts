import {
    HookType,
    EditingStyle,
    ContentCategory,
    ColorScheme,
    MusicType,
    Platform,
    DayOfWeek,
    TimeOfDay,
    VideoMetadata,
    AdPerformance
} from '@/types';

// Encoding maps for categorical features
const hookTypeMap: Record<HookType, number> = {
    curiosity: 0.9,
    shock: 0.85,
    question: 0.8,
    story: 0.75,
    statistic: 0.7,
    controversy: 0.65,
    transformation: 0.8,
    before_after: 0.85,
    problem_solution: 0.75,
    testimonial: 0.7,
    unboxing: 0.6,
    challenge: 0.65,
    other: 0.5,
};

const editingStyleMap: Record<EditingStyle, number> = {
    fast_cuts: 0.85,
    cinematic: 0.7,
    raw_authentic: 0.9,
    animated: 0.6,
    mixed_media: 0.75,
    minimal: 0.5,
    dynamic: 0.8,
    slow_motion: 0.55,
    other: 0.5,
};

const contentCategoryMap: Record<ContentCategory, number> = {
    product_demo: 0.75,
    lifestyle: 0.8,
    testimonial: 0.85,
    educational: 0.7,
    entertainment: 0.75,
    behind_the_scenes: 0.65,
    comparison: 0.7,
    tutorial: 0.65,
    ugc: 0.9,
    influencer: 0.8,
    brand_story: 0.6,
    other: 0.5,
};

const colorSchemeMap: Record<ColorScheme, number> = {
    vibrant: 0.85,
    muted: 0.5,
    monochrome: 0.4,
    warm: 0.75,
    cool: 0.6,
    pastel: 0.55,
    dark: 0.65,
    neon: 0.7,
    natural: 0.8,
    other: 0.5,
};

const musicTypeMap: Record<MusicType, number> = {
    trending: 0.95,
    original: 0.6,
    voiceover_only: 0.7,
    no_music: 0.4,
    licensed: 0.5,
    cinematic: 0.55,
    upbeat: 0.8,
    emotional: 0.75,
    other: 0.5,
};

const platformMap: Record<Platform, number> = {
    tiktok: 0.9,
    instagram: 0.85,
    facebook: 0.7,
    youtube: 0.75,
    snapchat: 0.6,
    pinterest: 0.5,
    twitter: 0.55,
    linkedin: 0.4,
    other: 0.5,
};

const dayOfWeekMap: Record<DayOfWeek, number> = {
    monday: 0.7,
    tuesday: 0.75,
    wednesday: 0.8,
    thursday: 0.85,
    friday: 0.7,
    saturday: 0.6,
    sunday: 0.65,
};

const timeOfDayMap: Record<TimeOfDay, number> = {
    early_morning: 0.5,
    morning: 0.7,
    afternoon: 0.75,
    evening: 0.9,
    night: 0.8,
};

// Extract numerical features from metadata
export const extractMetadataFeatures = (metadata: Partial<VideoMetadata>): number[] => {
    return [
        hookTypeMap[metadata.hook_type as HookType] || 0.5,
        editingStyleMap[metadata.editing_style as EditingStyle] || 0.5,
        contentCategoryMap[metadata.content_category as ContentCategory] || 0.5,
        colorSchemeMap[metadata.color_scheme as ColorScheme] || 0.5,
        musicTypeMap[metadata.music_type as MusicType] || 0.5,
        metadata.text_overlays ? 0.8 : 0.3,
        metadata.subtitles ? 0.9 : 0.4,
        metadata.ugc_style ? 0.95 : 0.5,
        metadata.influencer_used ? 0.85 : 0.5,
        metadata.voiceover ? 0.75 : 0.5,
        Math.min((metadata.number_of_actors || 1) / 5, 1),
        Math.min((metadata.character_codes?.length || 0) / 5, 1),
        Math.min((metadata.custom_tags?.length || 0) / 10, 1),
        metadata.script ? Math.min(metadata.script.length / 1000, 1) : 0.3,
    ];
};

// Extract campaign features from performance data
export const extractCampaignFeatures = (performance: Partial<AdPerformance>): number[] => {
    return [
        platformMap[performance.platform as Platform] || 0.5,
        dayOfWeekMap[performance.launch_day as DayOfWeek] || 0.5,
        timeOfDayMap[performance.launch_time as TimeOfDay] || 0.5,
    ];
};

// Combine all features into a single vector
export const extractAllFeatures = (
    metadata: Partial<VideoMetadata>,
    performance?: Partial<AdPerformance>
): number[] => {
    const metadataFeatures = extractMetadataFeatures(metadata);
    const campaignFeatures = performance
        ? extractCampaignFeatures(performance)
        : [0.5, 0.5, 0.5];

    return [...metadataFeatures, ...campaignFeatures];
};

// Get feature names for interpretability
export const getFeatureNames = (): string[] => {
    return [
        'Hook Type',
        'Editing Style',
        'Content Category',
        'Color Scheme',
        'Music Type',
        'Text Overlays',
        'Subtitles',
        'UGC Style',
        'Influencer Used',
        'Voiceover',
        'Number of Actors',
        'Character Variety',
        'Tag Richness',
        'Script Length',
        'Platform',
        'Launch Day',
        'Launch Time',
    ];
};

// Normalize features to 0-1 range
export const normalizeFeatures = (features: number[]): number[] => {
    return features.map(f => Math.max(0, Math.min(1, f)));
};

// Calculate success score from performance metrics
export const calculateSuccessScore = (performance: AdPerformance): number => {
    // Weighted combination of key metrics
    const weights = {
        ctr: 0.2,
        conversion_rate: 0.25,
        roas: 0.25,
        success_rating: 0.3,
    };

    // Normalize each metric
    const normalizedCtr = Math.min(performance.ctr / 0.1, 1); // Assuming 10% CTR is excellent
    const normalizedConversion = Math.min(performance.conversion_rate / 0.05, 1); // 5% conversion is excellent
    const normalizedRoas = Math.min(performance.roas / 5, 1); // 5x ROAS is excellent
    const normalizedRating = performance.success_rating / 10;

    return (
        normalizedCtr * weights.ctr +
        normalizedConversion * weights.conversion_rate +
        normalizedRoas * weights.roas +
        normalizedRating * weights.success_rating
    );
};
