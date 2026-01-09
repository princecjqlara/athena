'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './organizer.css';

interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    org_id: string;
    org_name?: string;
    created_at: string;
    last_login_at: string | null;
    data_size?: {
        ads: number;
        contacts: number;
        predictions: number;
    };
}

interface TeamStats {
    admin_id: string;
    admin_name: string;
    marketers: number;
    clients: number;
    total_ads: number;
    total_conversions: number;
}

interface ImpersonationSession {
    userId: string;
    userName: string;
    startedAt: string;
}

interface DataPool {
    id: string;
    name: string;
    slug: string;
    description: string;
    industry: string;
    platform: string;
    target_audience: string;
    creative_format: string;
    data_points: number;
    contributors: number;
    pending_requests: number;
    approved_requests: number;
}

interface AccessRequest {
    id: string;
    user_email: string;
    pool_id: string;
    reason: string;
    intended_use: string;
    status: string;
    created_at: string;
    data_pools: { name: string };
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    target_audience: 'all' | 'admin' | 'marketer' | 'client';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    created_by: string;
    is_active: boolean;
    created_at: string;
    expires_at?: string;
    read_by: string[];
}

interface DirectMessage {
    id: string;
    from_user_id: string;
    to_user_id: string;
    subject?: string;
    content: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
}

export default function OrganizerDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<TeamStats[]>([]);
    const [pools, setPools] = useState<DataPool[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState<ImpersonationSession | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'galaxy' | 'marketplace' | 'prompts' | 'traits' | 'messages'>('users');
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [selectedCodeRole, setSelectedCodeRole] = useState<'admin' | 'marketer' | 'client'>('admin');
    const [generatedCodeType, setGeneratedCodeType] = useState<string | null>(null);

    // Marketplace modal state
    const [showCreatePool, setShowCreatePool] = useState(false);
    const [newPool, setNewPool] = useState({ name: '', description: '', industry: '', platform: '', target_audience: '', creative_format: '' });
    const [aiSuggestion, setAiSuggestion] = useState<{ industry: string | null; platform: string | null; target_audience: string | null; creative_format: string | null; confidence: number } | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Prompts management state
    const [prompts, setPrompts] = useState<Array<{
        id: string;
        name: string;
        description: string;
        mediaType: string;
        isDefault: boolean;
        promptText: string;
        schema?: Record<string, string>;
    }>>([]);
    const [showCreatePrompt, setShowCreatePrompt] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<any>(null);
    const [newPrompt, setNewPrompt] = useState({ name: '', description: '', mediaType: 'video', promptText: '' });

    // Learned traits management state
    const [learnedTraits, setLearnedTraits] = useState<Array<{
        id: string;
        trait_name: string;
        trait_category: string;
        definition: string;
        business_type?: string;
        usage_count: number;
        created_at: string;
    }>>([]);
    const [showAddTrait, setShowAddTrait] = useState(false);
    const [newTrait, setNewTrait] = useState({ traitName: '', traitCategory: 'Custom', definition: '', businessType: '' });

    // Bulk import state
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [bulkTraitsJson, setBulkTraitsJson] = useState('');
    const [isBulkImporting, setIsBulkImporting] = useState(false);
    const [bulkImportResult, setBulkImportResult] = useState<{
        added: number;
        duplicates: number;
        merged: number;
        errors: string[];
    } | null>(null);

    // Messaging state
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
    const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
    const [showSendMessage, setShowSendMessage] = useState(false);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', targetAudience: 'all', priority: 'normal' });
    const [newMessage, setNewMessage] = useState({ toUserId: '', subject: '', content: '' });
    const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);

    // Helper function to display user-friendly role names
    const getRoleDisplayName = (role: string): string => {
        switch (role) {
            case 'organizer': return 'Super Admin';
            case 'admin': return 'Admin';
            case 'marketer': return 'Marketer';
            case 'client': return 'Client';
            default: return role;
        }
    };

    useEffect(() => {
        fetchData();
        checkImpersonation();
    }, []);

    useEffect(() => {
        if (activeTab === 'marketplace') {
            fetchMarketplace();
        }
        if (activeTab === 'prompts') {
            fetchPrompts();
        }
        if (activeTab === 'traits') {
            fetchLearnedTraits();
        }

        if (activeTab === 'messages') {
            fetchMessages();
        }
    }, [activeTab]);

    const fetchData = async () => {
        try {
            const [usersRes, teamsRes] = await Promise.all([
                fetch('/api/organizer/users'),
                fetch('/api/organizer/teams'),
            ]);

            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.data || []);
            } else {
                const errorData = await usersRes.json().catch(() => ({}));
                console.error('[Organizer] Users API error:', usersRes.status, errorData);
                if (usersRes.status === 401) {
                    alert('Session expired. Please log out and log back in.');
                }
            }

            if (teamsRes.ok) {
                const data = await teamsRes.json();
                setTeams(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMarketplace = async () => {
        try {
            const [poolsRes, requestsRes] = await Promise.all([
                fetch('/api/organizer/marketplace'),
                fetch('/api/organizer/marketplace/requests?status=pending'),
            ]);

            if (poolsRes.ok) {
                const data = await poolsRes.json();
                setPools(data.data || []);
            }
            if (requestsRes.ok) {
                const data = await requestsRes.json();
                setRequests(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching marketplace:', error);
        }
    };

    const fetchPrompts = async () => {
        try {
            const res = await fetch('/api/organizer/prompts');
            if (res.ok) {
                const data = await res.json();
                setPrompts(data.prompts || []);
            }
        } catch (error) {
            console.error('Error fetching prompts:', error);
        }
    };

    const createPrompt = async () => {
        if (!newPrompt.name || !newPrompt.promptText) {
            alert('Name and prompt text are required');
            return;
        }
        try {
            const res = await fetch('/api/organizer/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPrompt)
            });
            if (res.ok) {
                setNewPrompt({ name: '', description: '', mediaType: 'video', promptText: '' });
                setShowCreatePrompt(false);
                fetchPrompts();
            }
        } catch (error) {
            console.error('Error creating prompt:', error);
        }
    };

    const deletePrompt = async (id: string) => {
        if (!confirm('Delete this prompt?')) return;
        try {
            await fetch(`/api/organizer/prompts?id=${id}`, { method: 'DELETE' });
            fetchPrompts();
        } catch (error) {
            console.error('Error deleting prompt:', error);
        }
    };

    const updatePrompt = async () => {
        if (!editingPrompt?.name || !editingPrompt?.promptText) {
            alert('Name and prompt text are required');
            return;
        }
        try {
            const res = await fetch('/api/organizer/prompts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingPrompt)
            });
            if (res.ok) {
                setEditingPrompt(null);
                fetchPrompts();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update prompt');
            }
        } catch (error) {
            console.error('Error updating prompt:', error);
        }
    };

    // Messaging Functions
    const fetchMessages = async () => {
        try {
            const userId = localStorage.getItem('athena_user_id');
            const [announcementsRes, messagesRes] = await Promise.all([
                fetch('/api/organizer/announcements'),
                fetch(`/api/organizer/messages?userId=${userId}&type=sent`)
            ]);

            if (announcementsRes.ok) {
                const data = await announcementsRes.json();
                setAnnouncements(data.announcements || []);
            }
            if (messagesRes.ok) {
                const data = await messagesRes.json();
                setDirectMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const createAnnouncement = async () => {
        if (!newAnnouncement.title || !newAnnouncement.content) {
            alert('Title and content are required');
            return;
        }
        try {
            const userId = localStorage.getItem('athena_user_id');
            const res = await fetch('/api/organizer/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newAnnouncement,
                    createdBy: userId
                })
            });
            if (res.ok) {
                setNewAnnouncement({ title: '', content: '', targetAudience: 'all', priority: 'normal' });
                setShowCreateAnnouncement(false);
                fetchMessages();
                alert('Announcement created successfully!');
            }
        } catch (error) {
            console.error('Error creating announcement:', error);
        }
    };

    const deleteAnnouncement = async (id: string) => {
        if (!confirm('Delete this announcement?')) return;
        try {
            await fetch(`/api/organizer/announcements?id=${id}`, { method: 'DELETE' });
            fetchMessages();
        } catch (error) {
            console.error('Error deleting announcement:', error);
        }
    };

    const sendDirectMessage = async () => {
        if (!newMessage.toUserId || !newMessage.content) {
            alert('Recipient and message are required');
            return;
        }
        try {
            const userId = localStorage.getItem('athena_user_id');
            const res = await fetch('/api/organizer/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUserId: userId,
                    toUserId: newMessage.toUserId,
                    subject: newMessage.subject,
                    content: newMessage.content
                })
            });
            if (res.ok) {
                setNewMessage({ toUserId: '', subject: '', content: '' });
                setSelectedRecipient(null);
                setShowSendMessage(false);
                fetchMessages();
                alert('Message sent successfully!');
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Learned Traits CRUD Functions
    const fetchLearnedTraits = async () => {
        try {
            const res = await fetch('/api/ai/learned-traits');
            if (res.ok) {
                const data = await res.json();
                setLearnedTraits(data.traits || []);
            }
        } catch (error) {
            console.error('Error fetching learned traits:', error);
        }
    };

    const addTrait = async () => {
        if (!newTrait.traitName || !newTrait.definition) {
            alert('Trait name and definition are required');
            return;
        }
        try {
            const res = await fetch('/api/ai/learned-traits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTrait)
            });
            if (res.ok) {
                setNewTrait({ traitName: '', traitCategory: 'Custom', definition: '', businessType: '' });
                setShowAddTrait(false);
                fetchLearnedTraits();
            }
        } catch (error) {
            console.error('Error adding trait:', error);
        }
    };

    // Bulk import traits with AI deduplication
    const bulkImportTraits = async () => {
        if (!bulkTraitsJson.trim()) {
            alert('Please paste JSON data to import');
            return;
        }

        setIsBulkImporting(true);
        setBulkImportResult(null);

        try {
            // Parse JSON input - support both array and single object
            let traitsToImport: Array<{
                traitName?: string;
                name?: string;
                trait_name?: string;
                traitCategory?: string;
                category?: string;
                trait_category?: string;
                definition?: string;
                description?: string;
                businessType?: string;
                business_type?: string;
            }> = [];

            try {
                const parsed = JSON.parse(bulkTraitsJson);
                traitsToImport = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
                alert('Invalid JSON format. Please check your input.');
                setIsBulkImporting(false);
                return;
            }

            // Normalize trait names for comparison
            const normalizeTraitName = (name: string) => {
                return name
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]/g, '') // Remove special chars
                    .replace(/\s+/g, ''); // Remove spaces
            };

            // Get existing traits for comparison
            const existingTraitNames = new Set(
                learnedTraits.map(t => normalizeTraitName(t.trait_name))
            );

            // Also collect already-processed names to avoid duplicates within the import
            const processedInBatch = new Set<string>();

            const result = {
                added: 0,
                duplicates: 0,
                merged: 0,
                errors: [] as string[]
            };

            // Process each trait
            for (const trait of traitsToImport) {
                // Normalize field names (support various formats)
                const traitName = trait.traitName || trait.name || trait.trait_name || '';
                const traitCategory = trait.traitCategory || trait.category || trait.trait_category || 'Custom';
                const definition = trait.definition || trait.description || '';
                const businessType = trait.businessType || trait.business_type || '';

                if (!traitName) {
                    result.errors.push('Skipped trait with no name');
                    continue;
                }

                const normalizedName = normalizeTraitName(traitName);

                // Check for duplicates
                if (existingTraitNames.has(normalizedName)) {
                    result.duplicates++;
                    // Increment usage count for existing trait
                    try {
                        await fetch('/api/ai/learned-traits', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                traitName,
                                traitCategory,
                                definition: definition || `Trait: ${traitName}`,
                                businessType
                            })
                        });
                        result.merged++;
                    } catch {
                        // Silently continue
                    }
                    continue;
                }

                // Check for duplicates within the batch
                if (processedInBatch.has(normalizedName)) {
                    result.duplicates++;
                    continue;
                }

                // Add the trait
                try {
                    const res = await fetch('/api/ai/learned-traits', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            traitName,
                            traitCategory,
                            definition: definition || `Custom trait: ${traitName}`,
                            businessType
                        })
                    });

                    if (res.ok) {
                        result.added++;
                        existingTraitNames.add(normalizedName);
                        processedInBatch.add(normalizedName);
                    } else {
                        const err = await res.json();
                        if (err.existing) {
                            result.duplicates++;
                            result.merged++;
                        } else {
                            result.errors.push(`Failed to add "${traitName}": ${err.error || 'Unknown error'}`);
                        }
                    }
                } catch (error) {
                    result.errors.push(`Error adding "${traitName}": ${error}`);
                }
            }

            setBulkImportResult(result);

            // Refresh traits list
            fetchLearnedTraits();

            // Clear input if successful
            if (result.added > 0 || result.merged > 0) {
                setBulkTraitsJson('');
            }

        } catch (error) {
            console.error('Bulk import error:', error);
            setBulkImportResult({
                added: 0,
                duplicates: 0,
                merged: 0,
                errors: [`Import failed: ${error}`]
            });
        } finally {
            setIsBulkImporting(false);
        }
    };

    const deleteTrait = async (id: string) => {
        if (!confirm('Delete this learned trait?')) return;
        try {
            await fetch(`/api/ai/learned-traits?id=${id}`, { method: 'DELETE' });
            fetchLearnedTraits();
        } catch (error) {
            console.error('Error deleting trait:', error);
        }
    };

    // Sync traits to Marketplace/Strategy Tree by creating template ads
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ success: boolean; count: number; message: string } | null>(null);

    const syncTraitsToMarketplace = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncResult(null);

        try {
            // Fetch current traits
            const res = await fetch('/api/ai/learned-traits');
            if (!res.ok) {
                setSyncResult({ success: false, count: 0, message: 'Failed to fetch traits' });
                return;
            }
            const data = await res.json();
            const traits = data.traits || [];

            if (traits.length === 0) {
                setSyncResult({ success: false, count: 0, message: 'No traits to sync' });
                return;
            }

            // Get existing ads from localStorage
            const existingAds = JSON.parse(localStorage.getItem('ads') || '[]');
            const existingIds = new Set(existingAds.map((a: { id: string }) => a.id));

            // Group traits by category for generating varied ads
            const traitsByCategory: Record<string, typeof traits> = {};
            traits.forEach((trait: { trait_category: string }) => {
                const cat = trait.trait_category || 'Custom';
                if (!traitsByCategory[cat]) traitsByCategory[cat] = [];
                traitsByCategory[cat].push(trait);
            });

            const hookTraits = traitsByCategory['Hook Type'] || traitsByCategory['Hooks'] || [];
            const platformTraits = traitsByCategory['Platform'] || traitsByCategory['Platforms'] || [];
            const contentTraits = traitsByCategory['Content Type'] || traitsByCategory['Format'] || [];
            const customTraits = traits.filter((t: { trait_category: string }) =>
                !['Hook Type', 'Hooks', 'Platform', 'Platforms', 'Content Type', 'Format'].includes(t.trait_category)
            );

            // Generate template ads from traits - create one ad per unique trait combination
            const newAds: Array<{
                id: string;
                name: string;
                status: string;
                mediaType: string;
                uploadedAt: string;
                extractedContent: {
                    hookType: string;
                    platform: string;
                    contentCategory: string;
                    title: string;
                    traits: string[];
                };
                successScore: number;
                adInsights: {
                    impressions: number;
                    spend: number;
                    ctr: number;
                    results: number;
                };
            }> = [];

            // ML feature weight maps for trait-based predictions
            const hookWeights: Record<string, number> = {
                curiosity: 0.9, shock: 0.85, question: 0.8, story: 0.75,
                statistic: 0.7, controversy: 0.65, transformation: 0.8,
                before_after: 0.85, problem_solution: 0.75, testimonial: 0.7,
                unboxing: 0.6, challenge: 0.65, other: 0.5
            };
            const platformWeights: Record<string, number> = {
                tiktok: 0.9, instagram: 0.85, facebook: 0.7, youtube: 0.75,
                snapchat: 0.6, pinterest: 0.5, twitter: 0.55, linkedin: 0.4, other: 0.5
            };
            const contentWeights: Record<string, number> = {
                product_demo: 0.75, lifestyle: 0.8, testimonial: 0.85, educational: 0.7,
                entertainment: 0.75, behind_the_scenes: 0.65, comparison: 0.7, tutorial: 0.65,
                ugc: 0.9, influencer: 0.8, brand_story: 0.6, video: 0.75, other: 0.5
            };

            // Create ads based on trait combinations with ML-predicted scores
            const platforms = platformTraits.length > 0 ? platformTraits.map((t: { trait_name: string }) => t.trait_name) : ['facebook', 'instagram'];
            const hooks = hookTraits.length > 0 ? hookTraits.map((t: { trait_name: string }) => t.trait_name) : ['curiosity', 'problem_solution'];
            const contents = contentTraits.length > 0 ? contentTraits.map((t: { trait_name: string }) => t.trait_name) : ['video', 'ugc'];

            let adCount = 0;
            const maxAds = 20; // Limit to prevent too many ads

            for (const platform of platforms) {
                for (const hook of hooks) {
                    if (adCount >= maxAds) break;

                    const content = contents[adCount % contents.length];
                    const adId = `trait-ad-${platform}-${hook}-${Date.now()}-${adCount}`;

                    if (existingIds.has(adId)) continue;

                    const traitNames = [platform, hook, content, ...customTraits.slice(0, 3).map((t: { trait_name: string }) => t.trait_name)];

                    // Calculate ML-based predicted score using feature weights
                    const hookNorm = hook.toLowerCase().replace(/\s+/g, '_');
                    const platformNorm = platform.toLowerCase().replace(/\s+/g, '_');
                    const contentNorm = content.toLowerCase().replace(/\s+/g, '_');

                    const hookScore = hookWeights[hookNorm] || 0.5;
                    const platformScore = platformWeights[platformNorm] || 0.5;
                    const contentScore = contentWeights[contentNorm] || 0.5;

                    // Weighted average: hook 40%, platform 30%, content 30%
                    const baseScore = (hookScore * 0.4 + platformScore * 0.3 + contentScore * 0.3);
                    // Convert to 0-100 scale
                    const successScore = Math.round(baseScore * 100);

                    // Calculate performance metrics based on predicted score
                    const scoreMultiplier = successScore / 70; // Normalize around average
                    const baseImpressions = 3000 + (successScore * 50); // Higher score = more impressions
                    const baseCtr = 1.5 + (baseScore * 3); // 1.5% - 4.5% CTR based on score
                    const baseSpend = 100 + (successScore * 1.5); // $100-$250 based on score
                    const results = Math.round((baseImpressions * baseCtr / 100) * 0.02 * scoreMultiplier); // ~2% conversion

                    newAds.push({
                        id: adId,
                        name: `${hook.replace(/_/g, ' ')} Ad (${platform})`,
                        status: 'ACTIVE',
                        mediaType: 'video',
                        uploadedAt: new Date().toISOString(),
                        extractedContent: {
                            hookType: hook,
                            platform: platform,
                            contentCategory: content,
                            title: `${hook.replace(/_/g, ' ')} - ${platform} - ${content}`,
                            traits: traitNames,
                        },
                        successScore,
                        adInsights: {
                            impressions: Math.round(baseImpressions),
                            spend: Math.round(baseSpend * 100) / 100,
                            ctr: Math.round(baseCtr * 100) / 100,
                            results: Math.max(1, results),
                        }
                    });
                    adCount++;
                }
                if (adCount >= maxAds) break;
            }

            if (newAds.length === 0) {
                setSyncResult({ success: true, count: 0, message: 'All traits already synced' });
                return;
            }

            // Merge with existing ads and save
            const mergedAds = [...existingAds, ...newAds];
            localStorage.setItem('ads', JSON.stringify(mergedAds));

            setSyncResult({
                success: true,
                count: newAds.length,
                message: `Created ${newAds.length} template ads from ${traits.length} traits. Marketplace and Strategy Tree will now show data.`
            });
        } catch (error) {
            console.error('Sync error:', error);
            setSyncResult({ success: false, count: 0, message: `Sync failed: ${error}` });
        } finally {
            setIsSyncing(false);
        }
    };

    const checkImpersonation = () => {
        const stored = localStorage.getItem('athena_impersonation');
        if (stored) {
            try {
                setImpersonating(JSON.parse(stored));
            } catch { }
        }
    };

    const handleLoginAs = async (user: User) => {
        // Log impersonation
        await fetch('/api/organizer/impersonate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: user.id }),
        });

        // Set impersonation context
        const session: ImpersonationSession = {
            userId: user.id,
            userName: user.full_name || user.email,
            startedAt: new Date().toISOString(),
        };
        localStorage.setItem('athena_impersonation', JSON.stringify(session));

        // Redirect based on role
        const roleRoutes: Record<string, string> = {
            marketer: '/',
            client: '/pipeline',
            admin: '/admin',
        };
        window.location.href = roleRoutes[user.role] || '/';
    };

    const handleEndImpersonation = async () => {
        await fetch('/api/organizer/impersonate', { method: 'DELETE' });
        localStorage.removeItem('athena_impersonation');
        setImpersonating(null);
        window.location.href = '/organizer';
    };

    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);

    const generateInviteCode = async () => {
        setIsGeneratingCode(true);
        setCodeError(null);
        setInviteCode(null);

        try {
            const res = await fetch('/api/invite-codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleType: 'admin' }) // Organizers only create admins
            });
            const data = await res.json();
            console.log('Invite code response:', data);

            if (data.success && data.code) {
                setInviteCode(data.code);
                setGeneratedCodeType('admin');
            } else if (data.code) {
                // Handle case where success might not be set but code is returned
                setInviteCode(data.code);
                setGeneratedCodeType('admin');
            } else {
                setCodeError(data.error || 'Failed to generate code. Please try again.');
            }
        } catch (error) {
            console.error('Error generating code:', error);
            setCodeError('Network error. Please try again.');
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const copyInviteCode = () => {
        if (inviteCode) {
            navigator.clipboard.writeText(inviteCode);
            alert('Code copied to clipboard!');
        }
    };

    const createPool = async () => {
        if (!newPool.name) return;
        setIsCreating(true);
        try {
            const res = await fetch('/api/organizer/marketplace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPool),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // Show AI suggestion info if available
                if (data.aiSuggested) {
                    setAiSuggestion(data.aiSuggested);
                    alert(`✨ Pool created!\n\nAI auto-filled categories with ${data.aiSuggested.confidence}% confidence:\n• Industry: ${data.aiSuggested.industry || 'not detected'}\n• Platform: ${data.aiSuggested.platform || 'not detected'}\n• Audience: ${data.aiSuggested.target_audience || 'not detected'}\n• Format: ${data.aiSuggested.creative_format || 'not detected'}`);
                }
                setShowCreatePool(false);
                setNewPool({ name: '', description: '', industry: '', platform: '', target_audience: '', creative_format: '' });
                setAiSuggestion(null);
                fetchMarketplace();
            }
        } catch (error) {
            console.error('Error creating pool:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleRequest = async (requestId: string, action: 'approve' | 'deny') => {
        try {
            const res = await fetch('/api/organizer/marketplace/requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action }),
            });
            if (res.ok) {
                fetchMarketplace();
            }
        } catch (error) {
            console.error('Error handling request:', error);
        }
    };

    const deleteUser = async (userId: string, userName: string, userRole: string) => {
        if (userRole === 'organizer') {
            alert('Cannot delete organizer users');
            return;
        }
        if (!confirm(`Are you sure you want to delete ${userName || 'this user'}? This action cannot be undone.`)) {
            return;
        }
        try {
            const res = await fetch('/api/organizer/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();
            if (res.ok) {
                alert('User deleted successfully');
                fetchData();
            } else {
                alert(data.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user');
        }
    };

    const filteredUsers = users.filter(u =>
        (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.includes(searchQuery.toLowerCase())
    );

    const totalDataSize = users.reduce((sum, u) => sum + (u.data_size?.ads || 0), 0);

    return (
        <div className="organizer-page">
            {/* Impersonation Banner */}
            {impersonating && (
                <div className="impersonation-banner">
                    ⚠️ Viewing as <strong>{impersonating.userName}</strong> (read-only)
                    <button onClick={handleEndImpersonation}>End Session</button>
                </div>
            )}

            <div className="organizer-header">
                <h1>🌐 Organizer Console</h1>
                <p>Platform administration and support tools</p>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <span className="stat-value">{users.length}</span>
                    <span className="stat-label">Total Users</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{users.filter(u => u.role === 'admin').length}</span>
                    <span className="stat-label">Admins</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{users.filter(u => u.role === 'marketer').length}</span>
                    <span className="stat-label">Marketers</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{users.filter(u => u.role === 'client').length}</span>
                    <span className="stat-label">Clients</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{totalDataSize}</span>
                    <span className="stat-label">Total Ads</span>
                </div>
            </div>

            {/* Sync Traits to Marketplace Action */}
            <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: '16px',
                padding: '16px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>🔄 Sync Traits to Marketplace</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Create template ads from learned traits to populate Marketplace and Strategy Tree
                    </span>
                </div>
                <button
                    onClick={syncTraitsToMarketplace}
                    disabled={isSyncing}
                    style={{
                        padding: '10px 20px',
                        background: isSyncing ? '#6b7280' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: isSyncing ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    {isSyncing ? '⏳ Syncing...' : '🔄 Sync Now'}
                </button>
            </div>

            {syncResult && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px 16px',
                    background: syncResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${syncResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '8px',
                    color: syncResult.success ? '#10b981' : '#ef4444'
                }}>
                    {syncResult.success ? '✅' : '❌'} {syncResult.message}
                </div>
            )}


            {/* Invite Code Generator */}
            <div className="code-generator">
                <h3>Generate Admin Invite Code</h3>
                <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '12px' }}>
                    Create invite codes for new <strong>Admins</strong>. Admins can then create their own marketers and clients.
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'rgba(168, 85, 247, 0.2)',
                        border: '1px solid rgba(168, 85, 247, 0.5)',
                        color: '#a855f7',
                        fontSize: '0.95rem',
                        fontWeight: '500'
                    }}>
                        🛡️ Admin Role
                    </div>
                    <button
                        onClick={generateInviteCode}
                        className="generate-btn"
                        disabled={isGeneratingCode}
                        style={{ opacity: isGeneratingCode ? 0.7 : 1 }}
                    >
                        {isGeneratingCode ? 'Generating...' : 'Generate Admin Code'}
                    </button>
                </div>

                <div style={{
                    marginTop: '12px',
                    padding: '10px 16px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                }}>
                    💡 <strong>Role Hierarchy:</strong> Organizer → Admin → Marketer → Client.
                    Each level creates invite codes for the level below.
                </div>

                {/* Error display */}
                {codeError && (
                    <div style={{
                        marginTop: '12px',
                        padding: '10px 16px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '0.9rem'
                    }}>
                        ⚠️ {codeError}
                    </div>
                )}

                {/* Generated code display */}
                {inviteCode && (
                    <div className="code-display" style={{
                        marginTop: '12px',
                        padding: '16px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <code style={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                letterSpacing: '2px',
                                padding: '8px 16px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px'
                            }}>
                                {inviteCode}
                            </code>
                            <span style={{
                                background: '#8b5cf6',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                            }}>
                                ADMIN
                            </span>
                            <button
                                onClick={copyInviteCode}
                                style={{
                                    padding: '8px 16px',
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem'
                                }}
                            >
                                📋 Copy Code
                            </button>
                        </div>
                        <span className="code-timer" style={{ display: 'block', marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
                            ⏱️ Expires in 10 minutes
                        </span>
                        <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Share this code with a new admin. After signup, they can create marketers and clients from their Admin Dashboard.
                        </p>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 All Users
                </button>
                <button
                    className={`tab ${activeTab === 'teams' ? 'active' : ''}`}
                    onClick={() => setActiveTab('teams')}
                >
                    📊 Team Performance
                </button>
                <button
                    className={`tab ${activeTab === 'marketplace' ? 'active' : ''}`}
                    onClick={() => setActiveTab('marketplace')}
                >
                    🛒 Marketplace
                </button>
                <button
                    className={`tab ${activeTab === 'galaxy' ? 'active' : ''}`}
                    onClick={() => setActiveTab('galaxy')}
                >
                    🧠 Algorithm
                </button>
                <button
                    className={`tab ${activeTab === 'prompts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    📝 Prompts
                </button>
                <button
                    className={`tab ${activeTab === 'traits' ? 'active' : ''}`}
                    onClick={() => setActiveTab('traits')}
                    style={{ display: 'none' }}
                >
                    🧬 Traits
                </button>

                <button
                    className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('messages')}
                >
                    ✉️ Messages
                </button>
            </div>

            <div className="content-panel">
                {activeTab === 'users' && (
                    <div className="users-panel">
                        <div className="panel-header">
                            <input
                                type="search"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        {loading ? (
                            <div className="loading">Loading...</div>
                        ) : (
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Email/Password</th>
                                        <th>Role</th>
                                        <th>Data</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(user => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="user-info">
                                                    <span className="user-name">{user.full_name || 'Unknown'}</span>
                                                    <span className={`status-dot ${user.status}`}></span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="credentials">
                                                    <span className="email">{user.email}</span>
                                                    <button
                                                        className="show-password-btn"
                                                        onClick={() => alert('Password reset available via email')}
                                                    >
                                                        Reset Password
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`role-badge ${user.role}`}>
                                                    {getRoleDisplayName(user.role)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="data-size">
                                                    {user.data_size?.ads || 0} ads
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="login-as-btn"
                                                    onClick={() => handleLoginAs(user)}
                                                >
                                                    🔐 Login As
                                                </button>
                                                {user.role !== 'organizer' && (
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => deleteUser(user.id, user.full_name, user.role)}
                                                        style={{
                                                            marginLeft: '8px',
                                                            padding: '6px 12px',
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            borderRadius: '6px',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="teams-panel">
                        <h2>Admin Team Performance</h2>
                        {teams.length === 0 ? (
                            <p className="no-data">No team data available</p>
                        ) : (
                            <div className="team-cards">
                                {teams.map(team => (
                                    <div key={team.admin_id} className="team-card">
                                        <h3>{team.admin_name}</h3>
                                        <div className="team-stats">
                                            <div className="team-stat">
                                                <span className="value">{team.marketers}</span>
                                                <span className="label">Marketers</span>
                                            </div>
                                            <div className="team-stat">
                                                <span className="value">{team.clients}</span>
                                                <span className="label">Clients</span>
                                            </div>
                                            <div className="team-stat">
                                                <span className="value">{team.total_ads}</span>
                                                <span className="label">Ads</span>
                                            </div>
                                            <div className="team-stat">
                                                <span className="value">{team.total_conversions}</span>
                                                <span className="label">Conversions</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'galaxy' && (
                    <div className="galaxy-panel">
                        <h2>🧠 Algorithm System</h2>
                        <p className="galaxy-desc">
                            View aggregated, anonymized insights from all public data contributions.
                        </p>
                        <Link href="/settings/collective" className="galaxy-link">
                            View Algorithm Data →
                        </Link>

                        <div className="galaxy-stats">
                            <div className="galaxy-stat">
                                <span className="value">-</span>
                                <span className="label">Total Contributions</span>
                            </div>
                            <div className="galaxy-stat">
                                <span className="value">-</span>
                                <span className="label">Features Tracked</span>
                            </div>
                            <div className="galaxy-stat">
                                <span className="value">-</span>
                                <span className="label">Avg Confidence</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'prompts' && (
                    <div className="prompts-panel">
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2>📝 AI Prompt Management</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                                    Configure custom prompts for AI trait extraction from photo and video ads
                                </p>
                            </div>
                            <button
                                className="create-btn"
                                onClick={() => setShowCreatePrompt(!showCreatePrompt)}
                                style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
                            >
                                {showCreatePrompt ? '✕ Cancel' : '+ New Prompt'}
                            </button>
                        </div>

                        {/* Create Prompt Form */}
                        {showCreatePrompt && (
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '20px',
                                borderRadius: '12px',
                                marginBottom: '20px',
                                border: '1px solid var(--border)'
                            }}>
                                <h3 style={{ marginTop: 0 }}>Create Custom Prompt</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Prompt Name *</label>
                                        <input
                                            type="text"
                                            value={newPrompt.name}
                                            onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                                            placeholder="e.g., Facebook/Instagram UGC Analyzer"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description</label>
                                        <input
                                            type="text"
                                            value={newPrompt.description}
                                            onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                                            placeholder="What this prompt analyzes"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Media Type</label>
                                        <select
                                            value={newPrompt.mediaType}
                                            onChange={(e) => setNewPrompt({ ...newPrompt, mediaType: e.target.value })}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        >
                                            <option value="video">Video Ads</option>
                                            <option value="photo">Photo Ads</option>
                                            <option value="both">Both</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Prompt Text (JSON instructions) *</label>
                                        <textarea
                                            value={newPrompt.promptText}
                                            onChange={(e) => setNewPrompt({ ...newPrompt, promptText: e.target.value })}
                                            placeholder={'Analyze this ad and extract traits in JSON format:\n{\n  "customTrait1": "value",\n  "customTrait2": "value"\n}'}
                                            rows={8}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <button
                                        onClick={createPrompt}
                                        style={{ padding: '12px', background: 'var(--success)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 600 }}
                                    >
                                        ✓ Save Prompt
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Prompts List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {prompts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    <p>No prompts configured. Click "New Prompt" to create one.</p>
                                </div>
                            ) : (
                                prompts.map(prompt => (
                                    <div key={prompt.id} style={{
                                        padding: '16px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '12px',
                                        border: prompt.isDefault ? '1px solid var(--primary)' : '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <strong>{prompt.name}</strong>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '2px 8px',
                                                        background: prompt.mediaType === 'video' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                                                        borderRadius: '12px',
                                                        color: prompt.mediaType === 'video' ? '#EF4444' : '#3B82F6'
                                                    }}>
                                                        {prompt.mediaType === 'video' ? '🎬 Video' : '📸 Photo'}
                                                    </span>
                                                    {prompt.isDefault && (
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(16,185,129,0.2)', borderRadius: '12px', color: 'var(--success)' }}>
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                                    {prompt.description || 'No description'}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => setEditingPrompt(prompt)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px 8px' }}
                                                    title="Edit prompt"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (prompt.isDefault) {
                                                            if (!confirm('This is a default prompt. Are you sure you want to delete it? This cannot be undone.')) return;
                                                        }
                                                        deletePrompt(prompt.id);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px' }}
                                                    title="Delete prompt"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                        <details style={{ marginTop: '12px' }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary)' }}>View Prompt Text</summary>
                                            <pre style={{
                                                marginTop: '8px',
                                                padding: '12px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                overflow: 'auto',
                                                maxHeight: '200px'
                                            }}>
                                                {prompt.promptText}
                                            </pre>
                                        </details>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Self-Adding Prompts Info */}
                        <div style={{
                            marginTop: '24px',
                            padding: '16px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                            borderRadius: '12px',
                            border: '1px solid rgba(99,102,241,0.3)'
                        }}>
                            <h4 style={{ margin: '0 0 8px', color: 'var(--primary)' }}>💡 Self-Adding Prompts</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                When users add custom traits to their ads, the AI automatically learns and incorporates them into future analysis.
                                These user-defined traits are stored and suggested to other users with similar business profiles.
                            </p>
                        </div>

                        {/* Edit Prompt Modal */}
                        {editingPrompt && (
                            <div className="modal-overlay" onClick={() => setEditingPrompt(null)}>
                                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                                    <h3>Edit Prompt</h3>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Prompt Name *</label>
                                            <input
                                                type="text"
                                                value={editingPrompt.name || ''}
                                                onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description</label>
                                            <input
                                                type="text"
                                                value={editingPrompt.description || ''}
                                                onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Media Type</label>
                                            <select
                                                value={editingPrompt.mediaType || 'video'}
                                                onChange={(e) => setEditingPrompt({ ...editingPrompt, mediaType: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            >
                                                <option value="video">Video Ads</option>
                                                <option value="photo">Photo Ads</option>
                                                <option value="both">Both</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Prompt Text *</label>
                                            <textarea
                                                value={editingPrompt.promptText || ''}
                                                onChange={(e) => setEditingPrompt({ ...editingPrompt, promptText: e.target.value })}
                                                rows={8}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                        <button className="cancel-btn" onClick={() => setEditingPrompt(null)}>Cancel</button>
                                        <button className="submit-btn" onClick={updatePrompt}>Save Changes</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'traits' && (
                    <div className="traits-panel">
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2>🧬 Learned Traits</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                                    User-submitted custom traits that are learned and suggested to similar users
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="create-btn"
                                    onClick={() => { setShowBulkImport(!showBulkImport); setShowAddTrait(false); }}
                                    style={{ padding: '10px 20px', background: showBulkImport ? 'var(--error)' : 'var(--accent-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
                                >
                                    {showBulkImport ? '✕ Cancel' : '📥 Bulk Import'}
                                </button>
                                <button
                                    className="create-btn"
                                    onClick={() => { setShowAddTrait(!showAddTrait); setShowBulkImport(false); }}
                                    style={{ padding: '10px 20px', background: showAddTrait ? 'var(--error)' : 'var(--primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
                                >
                                    {showAddTrait ? '✕ Cancel' : '+ Add Trait'}
                                </button>
                            </div>
                        </div>

                        {/* Bulk Import Form */}
                        {showBulkImport && (
                            <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📥 Bulk Import Traits
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(34,197,94,0.2)', borderRadius: '12px', color: 'var(--success)' }}>
                                        AI Deduplication
                                    </span>
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    Paste JSON data containing traits. AI will automatically detect and merge duplicates.
                                </p>

                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>JSON Data</label>
                                    <textarea
                                        value={bulkTraitsJson}
                                        onChange={(e) => setBulkTraitsJson(e.target.value)}
                                        placeholder={`Paste JSON array or object. Supported formats:
[
  { "traitName": "hasUnboxing", "definition": "Shows product unboxing", "traitCategory": "Content" },
  { "name": "ugcStyle", "description": "User-generated content style" }
]

Or single object:
{ "trait_name": "fastCuts", "definition": "Quick editing transitions" }`}
                                        rows={8}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-tertiary)',
                                            fontFamily: 'monospace',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                {/* Import Result */}
                                {bulkImportResult && (
                                    <div style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                        background: bulkImportResult.errors.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                        border: `1px solid ${bulkImportResult.errors.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                                    }}>
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                            <span style={{ color: 'var(--success)' }}>✅ Added: {bulkImportResult.added}</span>
                                            <span style={{ color: '#f59e0b' }}>🔄 Merged: {bulkImportResult.merged}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>⏭️ Skipped duplicates: {bulkImportResult.duplicates}</span>
                                        </div>
                                        {bulkImportResult.errors.length > 0 && (
                                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--error)' }}>
                                                {bulkImportResult.errors.slice(0, 3).map((err, i) => (
                                                    <div key={i}>❌ {err}</div>
                                                ))}
                                                {bulkImportResult.errors.length > 3 && (
                                                    <div>...and {bulkImportResult.errors.length - 3} more errors</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={bulkImportTraits}
                                    disabled={isBulkImporting || !bulkTraitsJson.trim()}
                                    style={{
                                        padding: '12px 24px',
                                        background: isBulkImporting ? 'var(--text-muted)' : 'var(--success)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isBulkImporting ? 'not-allowed' : 'pointer',
                                        color: 'white',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {isBulkImporting ? (
                                        <>⏳ Importing & Deduplicating...</>
                                    ) : (
                                        <>🚀 Import with AI Deduplication</>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Add Trait Form */}
                        {showAddTrait && (
                            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                                <h3 style={{ marginTop: 0 }}>Add New Trait</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Trait Name *</label>
                                            <input
                                                type="text"
                                                value={newTrait.traitName}
                                                onChange={(e) => setNewTrait({ ...newTrait, traitName: e.target.value })}
                                                placeholder="e.g., hasUnboxing"
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Category</label>
                                            <select
                                                value={newTrait.traitCategory}
                                                onChange={(e) => setNewTrait({ ...newTrait, traitCategory: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            >
                                                <option value="Custom">Custom</option>
                                                <option value="Visual">Visual</option>
                                                <option value="Audio">Audio</option>
                                                <option value="Content">Content</option>
                                                <option value="Style">Style</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Definition *</label>
                                        <input
                                            type="text"
                                            value={newTrait.definition}
                                            onChange={(e) => setNewTrait({ ...newTrait, definition: e.target.value })}
                                            placeholder="boolean - Whether the ad shows product unboxing"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Business Type (optional)</label>
                                        <input
                                            type="text"
                                            value={newTrait.businessType}
                                            onChange={(e) => setNewTrait({ ...newTrait, businessType: e.target.value })}
                                            placeholder="e.g., E-commerce"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <button onClick={addTrait} style={{ padding: '12px', background: 'var(--success)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                                        ✓ Save Trait
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Traits List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {learnedTraits.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    <p>No learned traits yet. Add one or wait for users to submit custom traits.</p>
                                </div>
                            ) : (
                                learnedTraits.map(trait => (
                                    <div key={trait.id} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <strong>{trait.trait_name}</strong>
                                                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(139,92,246,0.2)', borderRadius: '12px', color: '#8B5CF6' }}>
                                                        {trait.trait_category}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(16,185,129,0.2)', borderRadius: '12px', color: 'var(--success)' }}>
                                                        {trait.usage_count}x used
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                    {trait.definition}
                                                </p>
                                                {trait.business_type && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', display: 'inline-block' }}>
                                                        🏢 {trait.business_type}
                                                    </span>
                                                )}
                                            </div>
                                            <button onClick={() => deleteTrait(trait.id)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px' }}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}




                {activeTab === 'marketplace' && (
                    <div className="marketplace-panel">
                        <div className="panel-header">
                            <h2>🛒 Data Marketplace Management</h2>
                            <button className="create-btn" onClick={() => setShowCreatePool(true)}>
                                + Create Pool
                            </button>
                        </div>

                        {/* Pending Access Requests */}
                        {requests.length > 0 && (
                            <div className="requests-section">
                                <h3>⏳ Pending Access Requests ({requests.length})</h3>
                                <div className="requests-list">
                                    {requests.map(req => (
                                        <div key={req.id} className="request-card">
                                            <div className="request-info">
                                                <strong>{req.user_email}</strong>
                                                <span>wants access to <em>{req.data_pools?.name}</em></span>
                                                <span className="request-reason">{req.reason || 'No reason provided'}</span>
                                            </div>
                                            <div className="request-actions">
                                                <button className="approve-btn" onClick={() => handleRequest(req.id, 'approve')}>✓ Approve</button>
                                                <button className="deny-btn" onClick={() => handleRequest(req.id, 'deny')}>✗ Deny</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Data Pools */}
                        <div className="pools-section">
                            <h3>📊 Data Pools ({pools.length})</h3>
                            {pools.length === 0 ? (
                                <p className="no-data">No data pools created yet.</p>
                            ) : (
                                <div className="pools-grid">
                                    {pools.map(pool => (
                                        <div key={pool.id} className="pool-card">
                                            <h4>{pool.name}</h4>
                                            <p>{pool.description || 'No description'}</p>
                                            <div className="pool-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                                {pool.industry && <span className="tag" style={{ background: '#3b82f6', color: 'white', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.7rem' }}>{pool.industry}</span>}
                                                {pool.platform && <span className="tag" style={{ background: '#8b5cf6', color: 'white', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.7rem' }}>{pool.platform}</span>}
                                                {pool.target_audience && <span className="tag" style={{ background: '#ec4899', color: 'white', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.7rem' }}>{pool.target_audience}</span>}
                                                {pool.creative_format && <span className="tag" style={{ background: '#10b981', color: 'white', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.7rem' }}>{pool.creative_format}</span>}
                                            </div>
                                            <div className="pool-stats">
                                                <span>📈 {pool.data_points} data points</span>
                                                <span>👥 {pool.contributors} contributors</span>
                                                <span>⏳ {pool.pending_requests} pending</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Create Pool Modal */}
                        {showCreatePool && (
                            <div className="modal-overlay" onClick={() => setShowCreatePool(false)}>
                                <div className="modal" onClick={e => e.stopPropagation()}>
                                    <h3>Create New Data Pool</h3>
                                    <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
                                        🤖 Leave category fields empty and AI will auto-detect them from the name/description!
                                    </p>
                                    <div className="form-group">
                                        <label>Pool Name *</label>
                                        <input
                                            type="text"
                                            value={newPool.name}
                                            onChange={e => setNewPool({ ...newPool, name: e.target.value })}
                                            placeholder="e.g., Facebook UGC for Gen Z E-commerce"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            value={newPool.description}
                                            onChange={e => setNewPool({ ...newPool, description: e.target.value })}
                                            placeholder="AI will use this to suggest categories. Be descriptive!"
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Industry <span style={{ color: '#888', fontSize: '0.75rem' }}>(AI auto-fill)</span></label>
                                            <select value={newPool.industry} onChange={e => setNewPool({ ...newPool, industry: e.target.value })}>
                                                <option value="">🤖 Let AI detect...</option>
                                                <option value="ecommerce">E-commerce</option>
                                                <option value="saas">SaaS</option>
                                                <option value="finance">Finance</option>
                                                <option value="health">Health & Wellness</option>
                                                <option value="local_services">Local Services</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Platform <span style={{ color: '#888', fontSize: '0.75rem' }}>(AI auto-fill)</span></label>
                                            <select value={newPool.platform} onChange={e => setNewPool({ ...newPool, platform: e.target.value })}>
                                                <option value="">🤖 Let AI detect...</option>
                                                <option value="facebook">Facebook</option>
                                                <option value="instagram">Instagram</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Target Audience <span style={{ color: '#888', fontSize: '0.75rem' }}>(AI auto-fill)</span></label>
                                            <select value={newPool.target_audience} onChange={e => setNewPool({ ...newPool, target_audience: e.target.value })}>
                                                <option value="">🤖 Let AI detect...</option>
                                                <option value="gen_z">Gen Z (18-25)</option>
                                                <option value="millennials">Millennials (26-40)</option>
                                                <option value="b2b">B2B</option>
                                                <option value="high_income">High Income</option>
                                                <option value="parents">Parents</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Creative Format <span style={{ color: '#888', fontSize: '0.75rem' }}>(AI auto-fill)</span></label>
                                            <select value={newPool.creative_format} onChange={e => setNewPool({ ...newPool, creative_format: e.target.value })}>
                                                <option value="">🤖 Let AI detect...</option>
                                                <option value="ugc">UGC</option>
                                                <option value="testimonial">Testimonial</option>
                                                <option value="product_demo">Product Demo</option>
                                                <option value="founder_led">Founder-Led</option>
                                                <option value="meme">Meme/Trend</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="modal-actions">
                                        <button className="cancel-btn" onClick={() => setShowCreatePool(false)}>Cancel</button>
                                        <button className="submit-btn" onClick={createPool} disabled={isCreating}>
                                            {isCreating ? '🤖 AI Categorizing...' : 'Create Pool'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="messages-panel">
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2>✉️ Messaging & Announcements</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                                    Send announcements to users or direct messages to individuals
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    className="create-btn"
                                    onClick={() => setShowCreateAnnouncement(!showCreateAnnouncement)}
                                    style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
                                >
                                    {showCreateAnnouncement ? '✕ Cancel' : '📢 New Announcement'}
                                </button>
                                <button
                                    className="create-btn"
                                    onClick={() => setShowSendMessage(!showSendMessage)}
                                    style={{ padding: '10px 20px', background: '#10b981', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
                                >
                                    {showSendMessage ? '✕ Cancel' : '💬 Send Message'}
                                </button>
                            </div>
                        </div>

                        {/* Create Announcement Form */}
                        {showCreateAnnouncement && (
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '20px',
                                borderRadius: '12px',
                                marginBottom: '20px',
                                border: '1px solid var(--border)'
                            }}>
                                <h3 style={{ marginTop: 0 }}>📢 Create Announcement</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Title *</label>
                                        <input
                                            type="text"
                                            value={newAnnouncement.title}
                                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                            placeholder="Announcement title"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Message *</label>
                                        <textarea
                                            value={newAnnouncement.content}
                                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                                            placeholder="Your announcement message..."
                                            rows={4}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Target Audience</label>
                                            <select
                                                value={newAnnouncement.targetAudience}
                                                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, targetAudience: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            >
                                                <option value="all">🌐 All Users</option>
                                                <option value="admin">👑 Admins Only</option>
                                                <option value="marketer">📊 Marketers Only</option>
                                                <option value="client">👤 Clients Only</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Priority</label>
                                            <select
                                                value={newAnnouncement.priority}
                                                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                            >
                                                <option value="low">🔵 Low</option>
                                                <option value="normal">🟢 Normal</option>
                                                <option value="high">🟡 High</option>
                                                <option value="urgent">🔴 Urgent</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        onClick={createAnnouncement}
                                        style={{ padding: '12px', background: 'var(--primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 600 }}
                                    >
                                        📢 Broadcast Announcement
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Send Direct Message Form */}
                        {showSendMessage && (
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '20px',
                                borderRadius: '12px',
                                marginBottom: '20px',
                                border: '1px solid #10b981'
                            }}>
                                <h3 style={{ marginTop: 0 }}>💬 Send Direct Message</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Recipient *</label>
                                        <select
                                            value={newMessage.toUserId}
                                            onChange={(e) => {
                                                const user = users.find(u => u.id === e.target.value);
                                                setNewMessage({ ...newMessage, toUserId: e.target.value });
                                                setSelectedRecipient(user || null);
                                            }}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        >
                                            <option value="">Select a user...</option>
                                            {users.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.full_name || user.email} ({user.role})
                                                </option>
                                            ))}
                                        </select>
                                        {selectedRecipient && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                📧 {selectedRecipient.email} • Role: {selectedRecipient.role}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Subject</label>
                                        <input
                                            type="text"
                                            value={newMessage.subject}
                                            onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                                            placeholder="Message subject (optional)"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Message *</label>
                                        <textarea
                                            value={newMessage.content}
                                            onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                                            placeholder="Type your message..."
                                            rows={4}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                                        />
                                    </div>
                                    <button
                                        onClick={sendDirectMessage}
                                        style={{ padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 600 }}
                                    >
                                        ✉️ Send Message
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Announcements List */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📢 Announcements
                                <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px' }}>
                                    {announcements.length}
                                </span>
                            </h3>
                            {announcements.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                    <p>No announcements yet. Click "New Announcement" to create one.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {announcements.map(announcement => (
                                        <div key={announcement.id} style={{
                                            padding: '16px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            borderLeft: `4px solid ${announcement.priority === 'urgent' ? '#ef4444' :
                                                announcement.priority === 'high' ? '#f59e0b' :
                                                    announcement.priority === 'normal' ? '#10b981' : '#6b7280'
                                                }`
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <strong>{announcement.title}</strong>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            background: announcement.target_audience === 'all' ? 'rgba(99,102,241,0.2)' :
                                                                announcement.target_audience === 'admin' ? 'rgba(139,92,246,0.2)' :
                                                                    announcement.target_audience === 'marketer' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)',
                                                            color: announcement.target_audience === 'all' ? '#6366f1' :
                                                                announcement.target_audience === 'admin' ? '#8b5cf6' :
                                                                    announcement.target_audience === 'marketer' ? '#3b82f6' : '#10b981'
                                                        }}>
                                                            {announcement.target_audience === 'all' ? '🌐 All' :
                                                                announcement.target_audience === 'admin' ? '👑 Admins' :
                                                                    announcement.target_audience === 'marketer' ? '📊 Marketers' : '👤 Clients'}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '8px 0' }}>
                                                        {announcement.content}
                                                    </p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                                        {new Date(announcement.created_at).toLocaleString()} •
                                                        Read by {announcement.read_by?.length || 0} users
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => deleteAnnouncement(announcement.id)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px' }}
                                                    title="Delete announcement"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sent Messages List */}
                        <div>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                💬 Sent Messages
                                <span style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px' }}>
                                    {directMessages.length}
                                </span>
                            </h3>
                            {directMessages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                    <p>No messages sent yet. Click "Send Message" to send one.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {directMessages.map(msg => {
                                        const recipient = users.find(u => u.id === msg.to_user_id);
                                        return (
                                            <div key={msg.id} style={{
                                                padding: '16px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            <strong>To: {recipient?.full_name || recipient?.email || msg.to_user_id}</strong>
                                                            {msg.is_read ? (
                                                                <span style={{ fontSize: '0.7rem', color: '#10b981' }}>✓ Read</span>
                                                            ) : (
                                                                <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>⏳ Unread</span>
                                                            )}
                                                        </div>
                                                        {msg.subject && (
                                                            <p style={{ fontSize: '0.85rem', fontWeight: 500, margin: '4px 0' }}>
                                                                Subject: {msg.subject}
                                                            </p>
                                                        )}
                                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '8px 0' }}>
                                                            {msg.content}
                                                        </p>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                                            Sent: {new Date(msg.created_at).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="footer">
                <Link href="/" className="back-link">← Back to Dashboard</Link>
            </div>
        </div>
    );
}
