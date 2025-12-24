import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
    return !!(supabaseUrl && supabaseAnonKey);
};

// Type definitions for ads tables
export interface DbAd {
    id: string;
    user_id?: string;
    facebook_ad_id?: string;
    name?: string;
    media_url?: string;
    thumbnail_url?: string;
    media_type?: string;
    status?: string;
    user_status?: string;
    effective_status?: string;
    imported_from_facebook?: boolean;
    has_results?: boolean;
    success_score?: number;
    extracted_content?: Record<string, unknown>;
    categories?: string[];
    traits?: string[];
    created_at?: string;
    updated_at?: string;
    imported_at?: string;
    last_synced_at?: string;
}

export interface DbAdInsights {
    id: string;
    ad_id: string;
    impressions?: number;
    reach?: number;
    frequency?: number;
    spend?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    link_clicks?: number;
    landing_page_views?: number;
    page_engagement?: number;
    post_engagement?: number;
    messages?: number;
    leads?: number;
    purchases?: number;
    cost_per_result?: number;
    result_type?: string;
    results?: number;
    video_views?: number;
    purchase_roas?: number;
    quality_ranking?: string;
    synced_at?: string;
}

export interface DbAdBreakdown {
    id: string;
    ad_id: string;
    breakdown_type: string;
    device?: string;
    platform?: string;
    position?: string;
    age?: string;
    gender?: string;
    country?: string;
    region?: string;
    impressions?: number;
    clicks?: number;
    spend?: number;
}

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
    },

    // ============================================
    // ADS TABLE OPERATIONS
    // ============================================

    async createAd(data: Omit<DbAd, 'id'>) {
        const { data: ad, error } = await supabase
            .from('ads')
            .insert(data)
            .select()
            .single();
        if (error) throw error;
        return ad;
    },

    async getAds(userId?: string) {
        let query = supabase
            .from('ads')
            .select('*')
            .order('created_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getAdById(id: string) {
        const { data, error } = await supabase
            .from('ads')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    async getAdByFacebookId(facebookAdId: string) {
        const { data, error } = await supabase
            .from('ads')
            .select('*')
            .eq('facebook_ad_id', facebookAdId)
            .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        return data;
    },

    async updateAd(id: string, updates: Partial<DbAd>) {
        const { data, error } = await supabase
            .from('ads')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteAd(id: string) {
        const { error } = await supabase
            .from('ads')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    // ============================================
    // AD INSIGHTS OPERATIONS
    // ============================================

    async upsertInsights(adId: string, insights: Omit<DbAdInsights, 'id' | 'ad_id'>) {
        // Check if insights exist
        const { data: existing } = await supabase
            .from('ad_insights')
            .select('id')
            .eq('ad_id', adId)
            .single();

        if (existing) {
            // Update
            const { data, error } = await supabase
                .from('ad_insights')
                .update({ ...insights, synced_at: new Date().toISOString() })
                .eq('ad_id', adId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            // Insert
            const { data, error } = await supabase
                .from('ad_insights')
                .insert({ ad_id: adId, ...insights, synced_at: new Date().toISOString() })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    async getInsightsByAdId(adId: string) {
        const { data, error } = await supabase
            .from('ad_insights')
            .select('*')
            .eq('ad_id', adId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    // ============================================
    // AD BREAKDOWNS OPERATIONS
    // ============================================

    async upsertBreakdowns(adId: string, breakdowns: {
        byDevice?: { device: string; impressions: number; clicks: number; spend: number }[];
        byPlatform?: { platform: string; impressions: number; clicks: number; spend: number }[];
        demographics?: { age: string; gender: string; impressions: number; clicks: number; spend: number }[];
        byCountry?: { country: string; impressions: number; clicks: number; spend: number }[];
        byRegion?: { region: string; impressions: number; clicks: number; spend: number }[];
        placements?: { platform: string; position: string; impressions: number; spend: number }[];
    }) {
        // Delete existing breakdowns for this ad
        await supabase.from('ad_breakdowns').delete().eq('ad_id', adId);

        const rows: Omit<DbAdBreakdown, 'id'>[] = [];

        // Device breakdowns
        if (breakdowns.byDevice) {
            breakdowns.byDevice.forEach(d => {
                rows.push({ ad_id: adId, breakdown_type: 'device', device: d.device, impressions: d.impressions, clicks: d.clicks, spend: d.spend });
            });
        }

        // Platform breakdowns
        if (breakdowns.byPlatform) {
            breakdowns.byPlatform.forEach(p => {
                rows.push({ ad_id: adId, breakdown_type: 'platform', platform: p.platform, impressions: p.impressions, clicks: p.clicks, spend: p.spend });
            });
        }

        // Demographics
        if (breakdowns.demographics) {
            breakdowns.demographics.forEach(d => {
                rows.push({ ad_id: adId, breakdown_type: 'demographic', age: d.age, gender: d.gender, impressions: d.impressions, clicks: d.clicks, spend: d.spend });
            });
        }

        // Country
        if (breakdowns.byCountry) {
            breakdowns.byCountry.forEach(c => {
                rows.push({ ad_id: adId, breakdown_type: 'country', country: c.country, impressions: c.impressions, clicks: c.clicks, spend: c.spend });
            });
        }

        // Region
        if (breakdowns.byRegion) {
            breakdowns.byRegion.forEach(r => {
                rows.push({ ad_id: adId, breakdown_type: 'region', region: r.region, impressions: r.impressions, clicks: r.clicks, spend: r.spend });
            });
        }

        // Placements
        if (breakdowns.placements) {
            breakdowns.placements.forEach(p => {
                rows.push({ ad_id: adId, breakdown_type: 'placement', platform: p.platform, position: p.position, impressions: p.impressions, spend: p.spend });
            });
        }

        if (rows.length > 0) {
            const { error } = await supabase.from('ad_breakdowns').insert(rows);
            if (error) throw error;
        }

        return rows.length;
    },

    async getBreakdownsByAdId(adId: string) {
        const { data, error } = await supabase
            .from('ad_breakdowns')
            .select('*')
            .eq('ad_id', adId);
        if (error) throw error;
        return data;
    },

    // ============================================
    // FULL AD DATA WITH JOINS
    // ============================================

    async getFullAdData(adId: string) {
        const ad = await this.getAdById(adId);
        const insights = await this.getInsightsByAdId(adId);
        const breakdowns = await this.getBreakdownsByAdId(adId);
        return { ...ad, insights, breakdowns };
    },

    async getAllAdsWithInsights(userId?: string) {
        const ads = await this.getAds(userId);
        const adsWithInsights = await Promise.all(
            ads.map(async (ad: DbAd) => {
                const insights = await this.getInsightsByAdId(ad.id);
                return { ...ad, adInsights: insights };
            })
        );
        return adsWithInsights;
    }
};
