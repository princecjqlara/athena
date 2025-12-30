import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Facebook Ad Account Webhook
 * Receives notifications when ads are created, updated, or status changes
 * This reduces API polling by knowing when to fetch new data
 * 
 * Webhook Events:
 * - ad_account: Ad account level changes
 * - campaign: Campaign status changes
 * - adset: Ad set status changes
 * - ad: Ad status changes
 */

const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || 'athena_ads_webhook_2024';

// Supabase for storing webhook events
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface AdWebhookChange {
    field: string;
    value: {
        ad_id?: string;
        adset_id?: string;
        campaign_id?: string;
        account_id?: string;
        old_value?: string;
        new_value?: string;
        time?: number;
        actor_id?: string;
    };
}

interface AdWebhookEntry {
    id: string; // Ad Account ID
    time: number;
    changes: AdWebhookChange[];
}

interface AdWebhookPayload {
    object: string;
    entry: AdWebhookEntry[];
}

/**
 * GET - Webhook verification (required by Facebook)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log('[Ad Webhook] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Ad Webhook] ✅ Verification successful');
        return new NextResponse(challenge, { status: 200 });
    }

    console.log('[Ad Webhook] ❌ Verification failed');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST - Receive webhook events for ad changes
 */
export async function POST(request: NextRequest) {
    try {
        const payload: AdWebhookPayload = await request.json();

        console.log('[Ad Webhook] 📥 Received event:', JSON.stringify(payload, null, 2));

        // Validate payload
        if (payload.object !== 'ad_account') {
            console.log('[Ad Webhook] Ignoring non-ad_account event:', payload.object);
            return NextResponse.json({ received: true });
        }

        // Process each entry
        for (const entry of payload.entry) {
            const accountId = entry.id;
            const timestamp = new Date(entry.time * 1000);

            console.log(`[Ad Webhook] Processing changes for account ${accountId} at ${timestamp.toISOString()}`);

            for (const change of entry.changes) {
                await processAdChange(accountId, change, timestamp);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Ad Webhook] Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}

/**
 * Process individual ad change events
 */
async function processAdChange(accountId: string, change: AdWebhookChange, timestamp: Date) {
    const { field, value } = change;

    console.log(`[Ad Webhook] Change: ${field}`, value);

    // Store the event in Supabase for tracking
    if (supabase) {
        try {
            await supabase.from('ad_webhook_events').insert({
                account_id: accountId,
                event_type: field,
                ad_id: value.ad_id,
                adset_id: value.adset_id,
                campaign_id: value.campaign_id,
                old_value: value.old_value,
                new_value: value.new_value,
                actor_id: value.actor_id,
                event_time: timestamp.toISOString(),
                created_at: new Date().toISOString()
            });
        } catch (dbError) {
            console.error('[Ad Webhook] Error storing event:', dbError);
        }
    }

    // Determine if this is a status change that should trigger a sync
    const shouldTriggerSync = [
        'effective_status',
        'status',
        'configured_status',
        'budget',
        'spend',
        'ad_created',
        'ad_updated'
    ].includes(field);

    if (shouldTriggerSync) {
        // Store a sync trigger in localStorage via Supabase
        // This will be checked by the frontend to know when to refresh
        if (supabase) {
            try {
                await supabase.from('ad_sync_triggers').upsert({
                    account_id: accountId,
                    last_change: timestamp.toISOString(),
                    change_type: field,
                    affected_ad_id: value.ad_id,
                    affected_campaign_id: value.campaign_id,
                    requires_sync: true
                }, {
                    onConflict: 'account_id'
                });
                console.log(`[Ad Webhook] ✅ Sync trigger created for account ${accountId}`);
            } catch (dbError) {
                console.error('[Ad Webhook] Error creating sync trigger:', dbError);
            }
        }

        // Trigger quality analysis for new/updated ads
        if (field === 'ad_created' || field === 'ad_updated') {
            await triggerQualityAnalysis(value.ad_id, accountId);
        }
    }
}

/**
 * Trigger quality analysis for an ad
 * Fetches ad data and sends to quality scoring API
 */
async function triggerQualityAnalysis(adId: string | undefined, accountId: string) {
    if (!adId) return;

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

        // Fetch ad data and trigger quality analysis
        const response = await fetch(`${baseUrl}/api/ai/ad-quality-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adId,
                accountId,
                source: 'webhook',
                // Basic data - frontend will enrich with full ad details during sync
                mediaType: 'video',
                platform: 'facebook',
            })
        });

        if (response.ok) {
            const analysis = await response.json();
            console.log(`[Ad Webhook] ✅ Quality analysis triggered for ad ${adId}:`, {
                score: analysis.overallScore,
                grade: analysis.grade,
                issues: analysis.issues?.length || 0,
            });

            // Store analysis result in Supabase for later retrieval
            if (supabase) {
                try {
                    await supabase.from('ad_quality_scores').upsert({
                        ad_id: adId,
                        account_id: accountId,
                        overall_score: analysis.overallScore,
                        grade: analysis.grade,
                        victory_chance: analysis.victoryChance,
                        blunder_count: analysis.blunderCount,
                        mistake_count: analysis.mistakeCount,
                        inaccuracy_count: analysis.inaccuracyCount,
                        analysis_json: analysis,
                        analyzed_at: analysis.analyzedAt,
                    }, {
                        onConflict: 'ad_id'
                    });
                } catch (dbError) {
                    console.error('[Ad Webhook] Error storing quality analysis:', dbError);
                }
            }
        } else {
            console.error('[Ad Webhook] Quality analysis failed:', response.status);
        }
    } catch (error) {
        console.error('[Ad Webhook] Error triggering quality analysis:', error);
    }
}
