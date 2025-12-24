/**
 * Contacts Store - Client-side storage for contacts and messages
 * Uses localStorage for persistence (consistent with existing pipeline/leads storage)
 */

// ============================================
// INTERFACES
// ============================================

export interface Message {
    id: string;
    contactId: string;
    content: string;
    direction: 'inbound' | 'outbound';
    timestamp: string;
    messageId?: string; // Facebook message ID
}

export interface Contact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    // Source tracking
    sourceAdId?: string;       // Facebook Ad ID that generated this contact
    sourceAdName?: string;     // Ad name for display
    facebookLeadId?: string;   // Lead ID from Facebook webhook
    facebookPsid?: string;     // Page-Scoped User ID for Messenger
    // Pipeline tracking
    pipelineId?: string;
    stageId?: string;
    // Conversation
    messages: Message[];
    lastMessageAt?: string;
    // AI Analysis
    aiAnalysis?: {
        sentiment: 'positive' | 'neutral' | 'negative';
        intent: string;
        leadScore: number;      // 0-100
        summary: string;
        suggestedAction?: string;
        analyzedAt: string;
    };
    // Timestamps
    createdAt: string;
    updatedAt: string;
}

export interface AdPipelineLink {
    adId: string;
    adName: string;
    pipelineId: string;
    stageId: string;
    linkedAt: string;
}

// ============================================
// STORAGE KEYS
// ============================================

const CONTACTS_KEY = 'pipeline_contacts';
const AD_LINKS_KEY = 'ad_pipeline_links';

// ============================================
// CONTACTS OPERATIONS
// ============================================

export const contactsStore = {
    // Get all contacts
    getAll(): Contact[] {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(CONTACTS_KEY);
        return data ? JSON.parse(data) : [];
    },

    // Get contacts by pipeline ID
    getByPipeline(pipelineId: string): Contact[] {
        return this.getAll().filter(c => c.pipelineId === pipelineId);
    },

    // Get contacts by source ad ID
    getBySourceAd(adId: string): Contact[] {
        return this.getAll().filter(c => c.sourceAdId === adId);
    },

    // Get contacts by pipeline stage
    getByStage(pipelineId: string, stageId: string): Contact[] {
        return this.getAll().filter(c => c.pipelineId === pipelineId && c.stageId === stageId);
    },

    // Get single contact by ID
    getById(id: string): Contact | undefined {
        return this.getAll().find(c => c.id === id);
    },

    // Find contact by Facebook identifiers
    findByFacebookId(leadId?: string, psid?: string): Contact | undefined {
        return this.getAll().find(c =>
            (leadId && c.facebookLeadId === leadId) ||
            (psid && c.facebookPsid === psid)
        );
    },

    // Create new contact
    create(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'messages'>): Contact {
        const contacts = this.getAll();
        const newContact: Contact = {
            ...contact,
            id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        contacts.push(newContact);
        this.saveAll(contacts);
        return newContact;
    },

    // Update contact
    update(id: string, updates: Partial<Contact>): Contact | null {
        const contacts = this.getAll();
        const index = contacts.findIndex(c => c.id === id);
        if (index === -1) return null;

        contacts[index] = {
            ...contacts[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.saveAll(contacts);
        return contacts[index];
    },

    // Delete contact
    delete(id: string): boolean {
        const contacts = this.getAll();
        const filtered = contacts.filter(c => c.id !== id);
        if (filtered.length === contacts.length) return false;
        this.saveAll(filtered);
        return true;
    },

    // Add message to contact
    addMessage(contactId: string, message: Omit<Message, 'id' | 'contactId'>): Message | null {
        const contacts = this.getAll();
        const index = contacts.findIndex(c => c.id === contactId);
        if (index === -1) return null;

        const newMessage: Message = {
            ...message,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            contactId,
        };

        contacts[index].messages.push(newMessage);
        contacts[index].lastMessageAt = message.timestamp;
        contacts[index].updatedAt = new Date().toISOString();
        this.saveAll(contacts);
        return newMessage;
    },

    // Update AI analysis for contact
    updateAiAnalysis(contactId: string, analysis: Contact['aiAnalysis']): boolean {
        const contact = this.update(contactId, { aiAnalysis: analysis });
        return contact !== null;
    },

    // Move contact to different stage
    moveToStage(contactId: string, stageId: string): boolean {
        const contact = this.update(contactId, { stageId });
        return contact !== null;
    },

    // Save all contacts
    saveAll(contacts: Contact[]): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    },

    // Get contacts grouped by source ad
    groupBySourceAd(pipelineId: string): Map<string, Contact[]> {
        const contacts = this.getByPipeline(pipelineId);
        const grouped = new Map<string, Contact[]>();

        contacts.forEach(contact => {
            const key = contact.sourceAdId || 'unknown';
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(contact);
        });

        return grouped;
    },
};

// ============================================
// AD-PIPELINE LINKS OPERATIONS
// ============================================

export const adLinksStore = {
    // Get all links
    getAll(): AdPipelineLink[] {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(AD_LINKS_KEY);
        return data ? JSON.parse(data) : [];
    },

    // Get links for a specific pipeline
    getByPipeline(pipelineId: string): AdPipelineLink[] {
        return this.getAll().filter(l => l.pipelineId === pipelineId);
    },

    // Get links for a specific stage
    getByStage(pipelineId: string, stageId: string): AdPipelineLink[] {
        return this.getAll().filter(l => l.pipelineId === pipelineId && l.stageId === stageId);
    },

    // Get link by ad ID
    getByAdId(adId: string): AdPipelineLink | undefined {
        return this.getAll().find(l => l.adId === adId);
    },

    // Create link (ad can only be linked to one pipeline/stage)
    create(link: Omit<AdPipelineLink, 'linkedAt'>): AdPipelineLink {
        const links = this.getAll();
        // Remove existing link for this ad
        const filtered = links.filter(l => l.adId !== link.adId);

        const newLink: AdPipelineLink = {
            ...link,
            linkedAt: new Date().toISOString(),
        };
        filtered.push(newLink);
        this.saveAll(filtered);
        return newLink;
    },

    // Remove link
    delete(adId: string): boolean {
        const links = this.getAll();
        const filtered = links.filter(l => l.adId !== adId);
        if (filtered.length === links.length) return false;
        this.saveAll(filtered);
        return true;
    },

    // Save all links
    saveAll(links: AdPipelineLink[]): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(AD_LINKS_KEY, JSON.stringify(links));
    },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get stored ads from localStorage (imported Facebook ads)
 */
export function getStoredAds(): Array<{
    id: string;
    facebookAdId?: string;
    name?: string;
    thumbnailUrl?: string;
}> {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('ads');
    return data ? JSON.parse(data) : [];
}

/**
 * Find or create a contact from webhook data
 */
export function findOrCreateContact(data: {
    name: string;
    email?: string;
    phone?: string;
    sourceAdId?: string;
    sourceAdName?: string;
    facebookLeadId?: string;
    facebookPsid?: string;
    pipelineId?: string;
    stageId?: string;
}): Contact {
    // Try to find existing contact
    const existing = contactsStore.findByFacebookId(data.facebookLeadId, data.facebookPsid);
    if (existing) {
        // Update with any new info
        contactsStore.update(existing.id, {
            email: data.email || existing.email,
            phone: data.phone || existing.phone,
            sourceAdId: data.sourceAdId || existing.sourceAdId,
            sourceAdName: data.sourceAdName || existing.sourceAdName,
        });
        return contactsStore.getById(existing.id)!;
    }

    // Create new contact
    return contactsStore.create(data);
}
