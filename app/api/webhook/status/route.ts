import { NextRequest, NextResponse } from 'next/server';
import { supabaseContactsStore, supabaseMessagesStore } from '@/lib/supabase-contacts';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/webhook/status
 * Check webhook status and recent contacts
 */
export async function GET(request: NextRequest) {
    const result: any = {
        timestamp: new Date().toISOString(),
        supabaseConfigured: isSupabaseConfigured(),
        webhookEndpoint: '/api/webhook/facebook',
        status: 'checking...'
    };

    if (!isSupabaseConfigured()) {
        result.status = 'error';
        result.error = 'Supabase not configured';
        return NextResponse.json(result);
    }

    try {
        // Get recent contacts
        const contacts = await supabaseContactsStore.getAll();

        result.status = 'ok';
        result.totalContacts = contacts.length;
        result.recentContacts = contacts.slice(0, 5).map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            source_ad_id: c.source_ad_id,
            created_at: c.created_at,
        }));

        if (contacts.length === 0) {
            result.message = 'No contacts in Supabase yet. Send a message to your Facebook Page to test the webhook.';
        } else {
            result.message = `Found ${contacts.length} contacts from webhook!`;
        }

        return NextResponse.json(result);

    } catch (error) {
        result.status = 'error';
        result.error = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(result, { status: 500 });
    }
}
