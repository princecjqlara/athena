import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Data Sync API
 * Syncs user data between localStorage and Supabase to prevent data loss
 * 
 * POST /api/sync - Save data to cloud
 * GET /api/sync - Load data from cloud
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface SyncData {
    userId: string;
    ads?: any[];
    pipelines?: any[];
    leads?: { pipelineId: string; leads: any[] }[];
    contacts?: any[];
    settings?: Record<string, any>;
}

/**
 * GET /api/sync - Load all user data from Supabase
 */
export async function GET(request: NextRequest) {
    if (!supabase) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured',
            message: 'Data stored in localStorage only'
        }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    try {
        // Fetch all user data in parallel
        const [adsResult, pipelinesResult, leadsResult, contactsResult, settingsResult] = await Promise.all([
            supabase.from('user_ads').select('ad_id, ad_data').eq('user_id', userId),
            supabase.from('user_pipelines').select('pipeline_id, name, stages').eq('user_id', userId),
            supabase.from('user_leads').select('lead_id, pipeline_id, lead_data, stage_id').eq('user_id', userId),
            supabase.from('user_contacts').select('contact_id, contact_data').eq('user_id', userId),
            supabase.from('user_settings').select('settings_data, ml_weights, ml_training_data').eq('user_id', userId).single()
        ]);

        // Transform data back to localStorage format
        const ads = adsResult.data?.map(row => ({
            ...row.ad_data,
            id: row.ad_id
        })) || [];

        const pipelines = pipelinesResult.data?.map(row => ({
            id: row.pipeline_id,
            name: row.name,
            stages: row.stages
        })) || [];

        // Group leads by pipeline
        const leadsByPipeline: Record<string, any[]> = {};
        leadsResult.data?.forEach(row => {
            if (!leadsByPipeline[row.pipeline_id]) {
                leadsByPipeline[row.pipeline_id] = [];
            }
            leadsByPipeline[row.pipeline_id].push({
                ...row.lead_data,
                id: row.lead_id,
                stageId: row.stage_id
            });
        });

        const contacts = contactsResult.data?.map(row => ({
            ...row.contact_data,
            id: row.contact_id
        })) || [];

        // Type the settings data with proper structure
        const settings = (settingsResult.data || {}) as {
            settings_data?: Record<string, any>;
            ml_weights?: any;
            ml_training_data?: any;
        };

        return NextResponse.json({
            success: true,
            data: {
                ads,
                pipelines,
                leadsByPipeline,
                contacts,
                settings: settings.settings_data || {},
                mlWeights: settings.ml_weights,
                mlTrainingData: settings.ml_training_data
            },
            lastSync: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Sync] GET error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to load data from cloud'
        }, { status: 500 });
    }
}

/**
 * POST /api/sync - Save all user data to Supabase
 */
export async function POST(request: NextRequest) {
    if (!supabase) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured',
            message: 'Data stored in localStorage only'
        }, { status: 200 });
    }

    try {
        const body: SyncData = await request.json();
        const { userId, ads, pipelines, leads, contacts, settings } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        const results: Record<string, { success: boolean; count?: number; error?: string }> = {};

        // Sync Ads
        if (ads && ads.length > 0) {
            const adsToUpsert = ads.map(ad => ({
                user_id: userId,
                ad_id: ad.id,
                ad_data: ad
            }));

            const { error } = await supabase
                .from('user_ads')
                .upsert(adsToUpsert, { onConflict: 'user_id,ad_id' });

            results.ads = error
                ? { success: false, error: error.message }
                : { success: true, count: ads.length };
        }

        // Sync Pipelines
        if (pipelines && pipelines.length > 0) {
            const pipelinesToUpsert = pipelines.map(p => ({
                user_id: userId,
                pipeline_id: p.id,
                name: p.name || 'Unnamed Pipeline',
                stages: p.stages || []
            }));

            const { error } = await supabase
                .from('user_pipelines')
                .upsert(pipelinesToUpsert, { onConflict: 'user_id,pipeline_id' });

            results.pipelines = error
                ? { success: false, error: error.message }
                : { success: true, count: pipelines.length };
        }

        // Sync Leads
        if (leads && leads.length > 0) {
            const leadsToUpsert: any[] = [];
            leads.forEach(({ pipelineId, leads: pipelineLeads }) => {
                pipelineLeads.forEach(lead => {
                    leadsToUpsert.push({
                        user_id: userId,
                        pipeline_id: pipelineId,
                        lead_id: lead.id,
                        lead_data: lead,
                        stage_id: lead.stageId || null
                    });
                });
            });

            if (leadsToUpsert.length > 0) {
                const { error } = await supabase
                    .from('user_leads')
                    .upsert(leadsToUpsert, { onConflict: 'user_id,lead_id' });

                results.leads = error
                    ? { success: false, error: error.message }
                    : { success: true, count: leadsToUpsert.length };
            }
        }

        // Sync Contacts
        if (contacts && contacts.length > 0) {
            const contactsToUpsert = contacts.map(c => ({
                user_id: userId,
                contact_id: c.id,
                contact_data: c
            }));

            const { error } = await supabase
                .from('user_contacts')
                .upsert(contactsToUpsert, { onConflict: 'user_id,contact_id' });

            results.contacts = error
                ? { success: false, error: error.message }
                : { success: true, count: contacts.length };
        }

        // Sync Settings
        if (settings) {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    settings_data: settings.general || {},
                    ml_weights: settings.mlWeights || null,
                    ml_training_data: settings.mlTrainingData || null
                }, { onConflict: 'user_id' });

            results.settings = error
                ? { success: false, error: error.message }
                : { success: true };
        }

        return NextResponse.json({
            success: true,
            results,
            lastSync: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Sync] POST error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to save data to cloud'
        }, { status: 500 });
    }
}

/**
 * DELETE /api/sync - Clear user data from cloud
 */
export async function DELETE(request: NextRequest) {
    if (!supabase) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dataType = searchParams.get('type'); // 'ads', 'pipelines', 'leads', 'contacts', 'all'

    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    try {
        if (dataType === 'all' || !dataType) {
            // Delete all user data
            await Promise.all([
                supabase.from('user_ads').delete().eq('user_id', userId),
                supabase.from('user_pipelines').delete().eq('user_id', userId),
                supabase.from('user_leads').delete().eq('user_id', userId),
                supabase.from('user_contacts').delete().eq('user_id', userId),
                supabase.from('user_settings').delete().eq('user_id', userId)
            ]);
        } else {
            // Delete specific data type
            const tableMap: Record<string, string> = {
                ads: 'user_ads',
                pipelines: 'user_pipelines',
                leads: 'user_leads',
                contacts: 'user_contacts',
                settings: 'user_settings'
            };
            const table = tableMap[dataType];
            if (table) {
                await supabase.from(table).delete().eq('user_id', userId);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Deleted ${dataType || 'all'} data for user`
        });

    } catch (error) {
        console.error('[Sync] DELETE error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to delete data from cloud'
        }, { status: 500 });
    }
}
