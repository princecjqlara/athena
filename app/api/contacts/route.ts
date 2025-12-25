import { NextRequest, NextResponse } from 'next/server';
import { supabaseContactsStore, supabaseMessagesStore, SupabaseContact } from '@/lib/supabase-contacts';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/contacts
 * Fetch contacts from Supabase
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const pipelineId = searchParams.get('pipelineId');
    const adId = searchParams.get('adId');

    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured',
            data: []
        }, { status: 500 });
    }

    try {
        let contacts: SupabaseContact[];

        if (pipelineId) {
            contacts = await supabaseContactsStore.getByPipeline(pipelineId);
        } else if (adId) {
            contacts = await supabaseContactsStore.getBySourceAd(adId);
        } else {
            contacts = await supabaseContactsStore.getAll();
        }

        return NextResponse.json({
            success: true,
            data: contacts,
            total: contacts.length
        });

    } catch (error) {
        console.error('Error fetching contacts:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch contacts'
        }, { status: 500 });
    }
}

/**
 * DELETE /api/contacts
 * Delete a contact or all contacts
 */
export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    if (!isSupabaseConfigured()) {
        return NextResponse.json({
            success: false,
            error: 'Supabase not configured'
        }, { status: 500 });
    }

    try {
        if (deleteAll) {
            const success = await supabaseContactsStore.deleteAll();
            return NextResponse.json({ success, message: 'All contacts deleted' });
        }

        if (!contactId) {
            return NextResponse.json({
                success: false,
                error: 'Contact ID required'
            }, { status: 400 });
        }

        const success = await supabaseContactsStore.delete(contactId);
        return NextResponse.json({ success, message: 'Contact deleted' });

    } catch (error) {
        console.error('Error deleting contact:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to delete contact'
        }, { status: 500 });
    }
}

/**
 * GET /api/contacts?contactId=xxx/messages
 * This is handled by a separate route
 */
