/**
 * Supabase Contacts Store - Server-side storage for webhook contacts
 * This works on both server and client side
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// INTERFACES
// ============================================

export interface SupabaseContact {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    source_ad_id?: string;
    source_ad_name?: string;
    facebook_lead_id?: string;
    facebook_psid?: string;
    pipeline_id?: string;
    stage_id?: string;
    ai_analysis?: {
        sentiment?: 'positive' | 'neutral' | 'negative';
        intent?: string;
        lead_score?: number;
        summary?: string;
    };
    last_message_at?: string;
    created_at?: string;
    updated_at?: string;
}

export interface SupabaseMessage {
    id?: string;
    contact_id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    message_id?: string;
    timestamp?: string;
}

// ============================================
// CONTACTS OPERATIONS
// ============================================

export const supabaseContactsStore = {
    // Get all contacts
    async getAll(): Promise<SupabaseContact[]> {
        if (!isSupabaseConfigured()) {
            console.log('[SupabaseContacts] Supabase not configured');
            return [];
        }

        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[SupabaseContacts] Error fetching contacts:', error);
            return [];
        }

        return data || [];
    },

    // Get contacts by pipeline
    async getByPipeline(pipelineId: string): Promise<SupabaseContact[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[SupabaseContacts] Error:', error);
            return [];
        }

        return data || [];
    },

    // Get contacts by source ad
    async getBySourceAd(adId: string): Promise<SupabaseContact[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('source_ad_id', adId);

        if (error) {
            console.error('[SupabaseContacts] Error:', error);
            return [];
        }

        return data || [];
    },

    // Find by Facebook ID (lead ID or PSID)
    async findByFacebookId(leadId?: string, psid?: string): Promise<SupabaseContact | null> {
        if (!isSupabaseConfigured()) return null;

        let query = supabase.from('contacts').select('*');

        if (leadId) {
            query = query.eq('facebook_lead_id', leadId);
        } else if (psid) {
            query = query.eq('facebook_psid', psid);
        } else {
            return null;
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('[SupabaseContacts] Error:', error);
        }

        return data || null;
    },

    // Create new contact
    async create(contact: Omit<SupabaseContact, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseContact | null> {
        if (!isSupabaseConfigured()) {
            console.log('[SupabaseContacts] Supabase not configured, cannot create contact');
            return null;
        }

        const { data, error } = await supabase
            .from('contacts')
            .insert({
                ...contact,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[SupabaseContacts] Error creating contact:', error);
            return null;
        }

        console.log('[SupabaseContacts] Created contact:', data?.id, data?.name);
        return data;
    },

    // Update contact
    async update(id: string, updates: Partial<SupabaseContact>): Promise<SupabaseContact | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('contacts')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[SupabaseContacts] Error updating contact:', error);
            return null;
        }

        return data;
    },

    // Delete contact
    async delete(id: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[SupabaseContacts] Error deleting contact:', error);
            return false;
        }

        return true;
    },

    // Delete all contacts
    async deleteAll(): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('contacts')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            console.error('[SupabaseContacts] Error deleting all contacts:', error);
            return false;
        }

        return true;
    },
};

// ============================================
// MESSAGES OPERATIONS
// ============================================

export const supabaseMessagesStore = {
    // Get messages for a contact
    async getByContact(contactId: string): Promise<SupabaseMessage[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('contact_id', contactId)
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('[SupabaseMessages] Error:', error);
            return [];
        }

        return data || [];
    },

    // Add message
    async add(message: Omit<SupabaseMessage, 'id'>): Promise<SupabaseMessage | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('messages')
            .insert({
                ...message,
                timestamp: message.timestamp || new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[SupabaseMessages] Error adding message:', error);
            return null;
        }

        console.log('[SupabaseMessages] Added message for contact:', message.contact_id);
        return data;
    },
};

// ============================================
// HELPER: Find or create contact
// ============================================

export async function findOrCreateSupabaseContact(data: {
    name: string;
    email?: string;
    phone?: string;
    facebookLeadId?: string;
    facebookPsid?: string;
    sourceAdId?: string;
    sourceAdName?: string;
    pipelineId?: string;
    stageId?: string;
}): Promise<SupabaseContact | null> {
    // Try to find existing contact
    const existing = await supabaseContactsStore.findByFacebookId(
        data.facebookLeadId,
        data.facebookPsid
    );

    if (existing) {
        // Update with any new data
        const updated = await supabaseContactsStore.update(existing.id!, {
            name: data.name || existing.name,
            email: data.email || existing.email,
            phone: data.phone || existing.phone,
            source_ad_id: data.sourceAdId || existing.source_ad_id,
            source_ad_name: data.sourceAdName || existing.source_ad_name,
        });
        return updated || existing;
    }

    // Create new contact
    return await supabaseContactsStore.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        facebook_lead_id: data.facebookLeadId,
        facebook_psid: data.facebookPsid,
        source_ad_id: data.sourceAdId,
        source_ad_name: data.sourceAdName,
        pipeline_id: data.pipelineId,
        stage_id: data.stageId || 'new-lead',
    });
}
