import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Sync Trigger Check API
 * 
 * GET /api/sync/check-trigger?accountId=xxx
 * 
 * Checks if there are pending sync triggers from webhooks.
 * This enables webhook-triggered sync without requiring cron jobs.
 * 
 * Flow:
 * 1. Facebook webhook fires → stores trigger in `ad_sync_triggers` table
 * 2. Frontend polls this endpoint every 1-2 minutes
 * 3. If trigger found → frontend runs sync → clears trigger
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface SyncTrigger {
    account_id: string;
    last_change: string;
    change_type: string;
    affected_ad_id?: string;
    affected_campaign_id?: string;
    requires_sync: boolean;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountId = searchParams.get('accountId');

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: 'accountId is required' },
                { status: 400 }
            );
        }

        // If Supabase is not configured, return no trigger
        if (!supabase) {
            console.log('[SyncTrigger] Supabase not configured, returning no trigger');
            return NextResponse.json({
                success: true,
                hasTrigger: false,
                message: 'Supabase not configured'
            });
        }

        // Check for pending sync trigger
        const { data: trigger, error } = await supabase
            .from('ad_sync_triggers')
            .select('*')
            .eq('account_id', accountId)
            .eq('requires_sync', true)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is fine
            console.error('[SyncTrigger] Error checking trigger:', error);
            return NextResponse.json({
                success: true,
                hasTrigger: false,
                error: error.message
            });
        }

        if (trigger) {
            console.log('[SyncTrigger] Found pending trigger:', {
                accountId,
                changeType: trigger.change_type,
                lastChange: trigger.last_change
            });

            return NextResponse.json({
                success: true,
                hasTrigger: true,
                triggerData: {
                    lastChange: trigger.last_change,
                    changeType: trigger.change_type,
                    affectedAdId: trigger.affected_ad_id,
                    affectedCampaignId: trigger.affected_campaign_id
                }
            });
        }

        return NextResponse.json({
            success: true,
            hasTrigger: false
        });

    } catch (error) {
        console.error('[SyncTrigger] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/sync/check-trigger
 * 
 * Clear a sync trigger after sync is complete
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accountId, action } = body;

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: 'accountId is required' },
                { status: 400 }
            );
        }

        if (!supabase) {
            return NextResponse.json({
                success: true,
                message: 'Supabase not configured'
            });
        }

        if (action === 'clear') {
            // Clear the sync trigger after sync is complete
            const { error } = await supabase
                .from('ad_sync_triggers')
                .update({ requires_sync: false })
                .eq('account_id', accountId);

            if (error) {
                console.error('[SyncTrigger] Error clearing trigger:', error);
                return NextResponse.json({
                    success: false,
                    error: error.message
                });
            }

            console.log('[SyncTrigger] Cleared trigger for account:', accountId);
            return NextResponse.json({
                success: true,
                message: 'Trigger cleared'
            });
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action. Use "clear" to clear a trigger.'
        }, { status: 400 });

    } catch (error) {
        console.error('[SyncTrigger] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
