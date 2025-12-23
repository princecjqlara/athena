import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database operations
export const db = {
    // Videos
    async createVideo(data: {
        cloudinary_url: string;
        cloudinary_public_id: string;
        thumbnail_url?: string;
        duration_seconds?: number;
    }) {
        const { data: video, error } = await supabase
            .from('videos')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return video;
    },

    async getVideos() {
        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getVideoById(id: string) {
        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    // Video Metadata
    async createMetadata(data: {
        video_id: string;
        script?: string;
        hook_type: string;
        content_category: string;
        editing_style: string;
        color_scheme: string;
        text_overlays: boolean;
        subtitles: boolean;
        character_codes: string[];
        number_of_actors: number;
        influencer_used: boolean;
        ugc_style: boolean;
        music_type: string;
        voiceover: boolean;
        custom_tags: string[];
    }) {
        const { data: metadata, error } = await supabase
            .from('video_metadata')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return metadata;
    },

    async getMetadataByVideoId(videoId: string) {
        const { data, error } = await supabase
            .from('video_metadata')
            .select('*')
            .eq('video_id', videoId)
            .single();

        if (error) throw error;
        return data;
    },

    // Ad Performance
    async createPerformance(data: {
        video_id: string;
        platform: string;
        launch_date: string;
        launch_day: string;
        launch_time: string;
        ad_spend: number;
        impressions: number;
        reach: number;
        clicks: number;
        ctr: number;
        conversions: number;
        conversion_rate: number;
        revenue: number;
        roas: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        success_rating: number;
        notes?: string;
    }) {
        const { data: performance, error } = await supabase
            .from('ad_performance')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return performance;
    },

    async getPerformanceByVideoId(videoId: string) {
        const { data, error } = await supabase
            .from('ad_performance')
            .select('*')
            .eq('video_id', videoId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getAllPerformance() {
        const { data, error } = await supabase
            .from('ad_performance')
            .select('*, videos(*), video_metadata(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Full video data with joins
    async getFullVideoData(videoId: string) {
        const { data, error } = await supabase
            .from('videos')
            .select(`
        *,
        video_metadata(*),
        ad_performance(*)
      `)
            .eq('id', videoId)
            .single();

        if (error) throw error;
        return data;
    },

    async getAllFullVideoData() {
        const { data, error } = await supabase
            .from('videos')
            .select(`
        *,
        video_metadata(*),
        ad_performance(*)
      `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Dashboard stats
    async getDashboardStats() {
        const { data: performance, error } = await supabase
            .from('ad_performance')
            .select('*');

        if (error) throw error;

        if (!performance || performance.length === 0) {
            return {
                total_videos: 0,
                total_ads: 0,
                average_ctr: 0,
                average_roas: 0,
                total_spend: 0,
                total_revenue: 0,
            };
        }

        const totalSpend = performance.reduce((sum, p) => sum + (p.ad_spend || 0), 0);
        const totalRevenue = performance.reduce((sum, p) => sum + (p.revenue || 0), 0);
        const avgCtr = performance.reduce((sum, p) => sum + (p.ctr || 0), 0) / performance.length;
        const avgRoas = performance.reduce((sum, p) => sum + (p.roas || 0), 0) / performance.length;

        return {
            total_videos: performance.length,
            total_ads: performance.length,
            average_ctr: avgCtr,
            average_roas: avgRoas,
            total_spend: totalSpend,
            total_revenue: totalRevenue,
        };
    }
};
