'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { getStoredAds } from '@/lib/contacts-store';

// Predefined Facebook events for CAPI integration
const FACEBOOK_EVENTS = [
    { id: 'Lead', name: 'Lead', description: 'Initial contact or inquiry' },
    { id: 'Contact', name: 'Contact', description: 'Customer reached out' },
    { id: 'ViewContent', name: 'View Content', description: 'Showed interest in product/service' },
    { id: 'InitiateCheckout', name: 'Initiate Checkout', description: 'Started purchase process' },
    { id: 'AddToCart', name: 'Add to Cart', description: 'Added product to cart' },
    { id: 'Purchase', name: 'Purchase', description: 'Completed sale' },
    { id: 'CompleteRegistration', name: 'Complete Registration', description: 'Signed up or registered' },
    { id: 'Schedule', name: 'Schedule', description: 'Booked appointment or scheduled call' },
    { id: 'Custom', name: 'Custom Event', description: 'User-defined event' },
];

interface Stage {
    id: string;
    name: string;
    description?: string;       // Stage purpose/use description
    facebookEvent?: string;     // Connected Facebook CAPI event
    isGoal: boolean;
    isAutoCreated: boolean;
    leadCount: number;
}

interface StoredAd {
    id: string;
    facebookAdId?: string;
    name?: string;
    thumbnailUrl?: string;
}

interface Lead {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    stageId: string;
    createdAt: string;
    lastActivity: string;
    source: string;
    notes?: string;
    conversionValue?: number;
    convertedAt?: string;
    facebookLeadId?: string;  // From Facebook webhook for CAPI matching
    facebookPsid?: string;    // Page-scoped user ID from Messenger
    sourceAdId?: string;      // Facebook Ad ID that generated this lead
    sourceAdName?: string;    // Name of the ad that generated this lead
    isPlaceholder?: boolean;  // True if this is placeholder data without real details
    isRealLead?: boolean;     // True if this has actual lead form data
    lastMessage?: string;     // Preview of last message
    city?: string;
    state?: string;
    country?: string;
    // AI Analysis results
    aiAnalysis?: {
        sentiment?: 'positive' | 'neutral' | 'negative';
        intent?: string;
        leadScore?: number;
        suggestedStage?: string;
        summary?: string;
        extractedName?: string;
        extractedEmail?: string;
        extractedPhone?: string;
        analyzedAt?: string;
    };
    // Full conversation messages
    messages?: Array<{
        id: string;
        content: string;
        from: string;
        fromId?: string;
        timestamp: string;
    }>;
}

interface Pipeline {
    id: string;
    name: string;
    goal: string;
    stages: Stage[];
    leads: Lead[];
    leadCount: number;
    createdAt: string;
}

export default function PipelineDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [pipeline, setPipeline] = useState<Pipeline | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);
    const [showConversionModal, setShowConversionModal] = useState(false);
    const [conversionValue, setConversionValue] = useState('');
    const [conversionDate, setConversionDate] = useState('');  // Empty = NOW, or ISO date string
    const [sendingCapi, setSendingCapi] = useState(false);
    const [newLead, setNewLead] = useState({ name: '', email: '', phone: '', source: 'Manual' });
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
    const [pendingGoalStageId, setPendingGoalStageId] = useState<string | null>(null);

    // Bulk selection state
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
    const [bulkMoveTargetStage, setBulkMoveTargetStage] = useState<string>('');

    // Stored ads for auto-linking display
    const [storedAds, setStoredAds] = useState<StoredAd[]>([]);

    // Lead detail modal state
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);

    // Stage editing state - includes new fields for description and facebookEvent
    const [editingStage, setEditingStage] = useState<{ id: string; name: string; description?: string; facebookEvent?: string; isGoal: boolean } | null>(null);
    const [showStageEditModal, setShowStageEditModal] = useState(false);
    const [showAddStageModal, setShowAddStageModal] = useState(false);
    const [newStageName, setNewStageName] = useState('');

    // Re-analyze state
    const [isReanalyzing, setIsReanalyzing] = useState(false);

    useEffect(() => {
        // Load pipeline from localStorage
        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            const pipelines = JSON.parse(savedPipelines);
            const found = pipelines.find((p: Pipeline) => p.id === params.id);
            if (found) {
                setPipeline(found);
                // Load leads for this pipeline from localStorage
                const savedLeads = localStorage.getItem(`leads_${params.id}`);
                const localLeads: Lead[] = savedLeads ? JSON.parse(savedLeads) : [];

                // Also fetch contacts from Supabase (from webhooks)
                fetch(`/api/contacts?pipelineId=${params.id}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.data && Array.isArray(data.data)) {
                            // Convert Supabase contacts to Lead format
                            const supabaseLeads: Lead[] = data.data.map((c: any) => ({
                                id: c.id,
                                name: c.name || 'Unknown',
                                email: c.email,
                                phone: c.phone,
                                stageId: c.stage_id || 'new-lead',
                                createdAt: c.created_at || new Date().toISOString(),
                                lastActivity: c.last_message_at || c.created_at || new Date().toISOString(),
                                source: c.source_ad_id ? 'Facebook Messenger' : 'Webhook',
                                sourceAdId: c.source_ad_id,
                                sourceAdName: c.source_ad_name,
                                facebookLeadId: c.facebook_lead_id,
                                isPlaceholder: false,
                                isRealLead: true,
                            }));

                            // Merge: real leads from Supabase + placeholders that haven't been replaced
                            const supabaseAdIds = new Set(supabaseLeads.map(l => l.sourceAdId).filter(Boolean));

                            // Keep placeholders that don't have matching real leads
                            const remainingPlaceholders = localLeads.filter(local => {
                                // Keep if it's not a placeholder
                                if (!local.isPlaceholder) return true;
                                // Keep placeholder if there's no Supabase lead from the same ad
                                return !supabaseAdIds.has(local.sourceAdId);
                            });

                            // Combine: Supabase leads first (real), then remaining placeholders
                            const mergedLeads = [...supabaseLeads, ...remainingPlaceholders];

                            console.log(`[Pipeline] Merged ${supabaseLeads.length} real leads + ${remainingPlaceholders.filter(l => l.isPlaceholder).length} placeholders`);
                            setLeads(mergedLeads);
                        } else {
                            // No Supabase contacts, use local only
                            setLeads(localLeads);
                        }
                    })
                    .catch(err => {
                        console.log('[Pipeline] Could not fetch Supabase contacts:', err);
                        // Fall back to local leads only
                        setLeads(localLeads);
                    });
            }
        }

        // Load stored ads for auto-linking display (based on lead sourceAdId)
        setStoredAds(getStoredAds());
    }, [params.id]);

    // Get ads automatically linked to a stage based on leads' sourceAdId
    const getAutoLinkedAdsForStage = (stageId: string): { adId: string; adName: string }[] => {
        const stageLeads = leads.filter(l => l.stageId === stageId && l.sourceAdId);
        const adMap = new Map<string, string>();

        for (const lead of stageLeads) {
            if (lead.sourceAdId && !adMap.has(lead.sourceAdId)) {
                // Find ad name from stored ads
                const storedAd = storedAds.find(a =>
                    a.facebookAdId === lead.sourceAdId || a.id === lead.sourceAdId
                );
                adMap.set(lead.sourceAdId, lead.sourceAdName || storedAd?.name || 'Unknown Ad');
            }
        }

        return Array.from(adMap.entries()).map(([adId, adName]) => ({ adId, adName }));
    };

    const saveLeads = (updatedLeads: Lead[]) => {
        setLeads(updatedLeads);
        localStorage.setItem(`leads_${params.id}`, JSON.stringify(updatedLeads));

        // Update pipeline lead counts
        if (pipeline) {
            const updatedStages = pipeline.stages.map(stage => ({
                ...stage,
                leadCount: updatedLeads.filter(l => l.stageId === stage.id).length
            }));
            const updatedPipeline = {
                ...pipeline,
                stages: updatedStages,
                leadCount: updatedLeads.length
            };
            setPipeline(updatedPipeline);

            // Update in pipelines array
            const savedPipelines = localStorage.getItem('pipelines');
            if (savedPipelines) {
                const pipelines = JSON.parse(savedPipelines);
                const idx = pipelines.findIndex((p: Pipeline) => p.id === params.id);
                if (idx !== -1) {
                    pipelines[idx] = updatedPipeline;
                    localStorage.setItem('pipelines', JSON.stringify(pipelines));
                }
            }
        }
    };

    // Stage editing handlers
    const saveStageEdit = () => {
        if (!editingStage || !pipeline) return;

        const updatedStages = pipeline.stages.map(stage => {
            if (stage.id === editingStage.id) {
                return {
                    ...stage,
                    name: editingStage.name,
                    description: editingStage.description,
                    facebookEvent: editingStage.facebookEvent,
                    isGoal: editingStage.isGoal
                };
            }
            // Only one goal stage allowed
            if (editingStage.isGoal && stage.isGoal && stage.id !== editingStage.id) {
                return { ...stage, isGoal: false };
            }
            return stage;
        });

        const updatedPipeline = { ...pipeline, stages: updatedStages };
        setPipeline(updatedPipeline);

        // Save to localStorage
        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            const pipelines = JSON.parse(savedPipelines);
            const idx = pipelines.findIndex((p: Pipeline) => p.id === params.id);
            if (idx !== -1) {
                pipelines[idx] = updatedPipeline;
                localStorage.setItem('pipelines', JSON.stringify(pipelines));
            }
        }

        setShowStageEditModal(false);
        setEditingStage(null);
    };

    const addNewStage = () => {
        if (!newStageName.trim() || !pipeline) return;

        const newStage = {
            id: `stage-${Date.now()}`,
            name: newStageName.trim(),
            isGoal: false,
            isAutoCreated: false,
            leadCount: 0
        };

        const updatedPipeline = {
            ...pipeline,
            stages: [...pipeline.stages, newStage]
        };
        setPipeline(updatedPipeline);

        // Save to localStorage
        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            const pipelines = JSON.parse(savedPipelines);
            const idx = pipelines.findIndex((p: Pipeline) => p.id === params.id);
            if (idx !== -1) {
                pipelines[idx] = updatedPipeline;
                localStorage.setItem('pipelines', JSON.stringify(pipelines));
            }
        }

        setShowAddStageModal(false);
        setNewStageName('');
    };

    const deleteStage = (stageId: string) => {
        if (!pipeline) return;
        if (pipeline.stages.length <= 2) {
            alert('Pipeline must have at least 2 stages');
            return;
        }

        const stageName = pipeline.stages.find(s => s.id === stageId)?.name;
        if (!confirm(`Delete stage "${stageName}"?\n\nLeads in this stage will be moved to the first stage.`)) return;

        // Move leads from deleted stage to first stage
        const firstStageId = pipeline.stages.find(s => s.id !== stageId)?.id || pipeline.stages[0].id;
        const updatedLeads = leads.map(lead =>
            lead.stageId === stageId ? { ...lead, stageId: firstStageId } : lead
        );
        saveLeads(updatedLeads);

        const updatedStages = pipeline.stages.filter(s => s.id !== stageId);
        const updatedPipeline = { ...pipeline, stages: updatedStages };
        setPipeline(updatedPipeline);

        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            const pipelines = JSON.parse(savedPipelines);
            const idx = pipelines.findIndex((p: Pipeline) => p.id === params.id);
            if (idx !== -1) {
                pipelines[idx] = updatedPipeline;
                localStorage.setItem('pipelines', JSON.stringify(pipelines));
            }
        }
    };

    // Re-analyze all leads with AI
    const handleReanalyzeLeads = async () => {
        if (!pipeline || leads.length === 0) return;

        setIsReanalyzing(true);
        try {
            // Convert leads to conversation format for AI
            const conversations = leads.map(lead => ({
                id: lead.id,
                name: lead.name,
                facebookPsid: lead.facebookPsid,
                messages: lead.messages || [],
                firstMessageAt: lead.createdAt,
                lastMessageAt: lead.lastActivity
            }));

            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversations,
                    pipelineStages: pipeline.stages
                })
            });

            const data = await response.json();

            if (data.success && data.leads?.length > 0) {
                console.log('[Reanalyze] AI analysis complete:', data.summary);

                // Update leads with new suggested stages
                const updatedLeads = leads.map(lead => {
                    const analyzed = data.leads.find((a: any) => a.id === lead.id || a.facebookPsid === lead.facebookPsid);
                    if (analyzed?.aiAnalysis?.suggestedStage) {
                        return {
                            ...lead,
                            stageId: analyzed.aiAnalysis.suggestedStage,
                            aiAnalysis: analyzed.aiAnalysis
                        };
                    }
                    return lead;
                });

                saveLeads(updatedLeads);
                alert(`Re-analyzed ${data.leads.length} leads!\n\nStage distribution: ${JSON.stringify(data.summary?.stageDistribution || {})}`);
            } else {
                alert('No leads were analyzed. Try importing conversations first.');
            }
        } catch (err) {
            console.error('[Reanalyze] Error:', err);
            alert('Failed to re-analyze leads. Check console for details.');
        } finally {
            setIsReanalyzing(false);
        }
    };

    const handleAddLead = () => {
        if (!newLead.name || !pipeline) return;

        const lead: Lead = {
            id: Date.now().toString(),
            name: newLead.name,
            email: newLead.email,
            phone: newLead.phone,
            stageId: pipeline.stages[0].id, // First stage (New Lead)
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            source: newLead.source,
        };

        const updatedLeads = [...leads, lead];
        saveLeads(updatedLeads);

        setShowAddLeadModal(false);
        setNewLead({ name: '', email: '', phone: '', source: 'Manual' });
    };

    // Delete a lead
    const handleDeleteLead = async (leadId: string, leadName: string) => {
        if (!confirm(`Delete "${leadName}"?\n\nThis will permanently remove this lead from all data sources.`)) return;

        // Delete from localStorage
        const updatedLeads = leads.filter(l => l.id !== leadId);
        saveLeads(updatedLeads);

        // Also delete from Supabase if it exists there
        try {
            await fetch(`/api/contacts?id=${leadId}`, {
                method: 'DELETE'
            });
            console.log(`[Pipeline] Deleted lead ${leadId} from Supabase`);
        } catch (err) {
            console.log('[Pipeline] Lead not in Supabase or delete failed:', err);
        }
    };

    // Bulk selection handlers
    const toggleLeadSelection = (leadId: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(leadId)) {
            newSelected.delete(leadId);
        } else {
            newSelected.add(leadId);
        }
        setSelectedLeads(newSelected);
    };

    const toggleAllInStage = (stageId: string) => {
        const stageLeads = leads.filter(l => l.stageId === stageId);
        const stageLeadIds = stageLeads.map(l => l.id);
        const allSelected = stageLeadIds.every(id => selectedLeads.has(id));

        const newSelected = new Set(selectedLeads);
        if (allSelected) {
            stageLeadIds.forEach(id => newSelected.delete(id));
        } else {
            stageLeadIds.forEach(id => newSelected.add(id));
        }
        setSelectedLeads(newSelected);
    };

    const selectAllLeads = () => {
        if (selectedLeads.size === leads.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(leads.map(l => l.id)));
        }
    };

    const clearSelection = () => {
        setSelectedLeads(new Set());
    };

    const handleBulkDelete = () => {
        if (selectedLeads.size === 0) return;
        if (!confirm(`Delete ${selectedLeads.size} selected lead(s)?\n\nThis will permanently remove them.`)) return;

        const updatedLeads = leads.filter(l => !selectedLeads.has(l.id));
        saveLeads(updatedLeads);
        setSelectedLeads(new Set());
    };

    const handleBulkMove = () => {
        if (selectedLeads.size === 0 || !bulkMoveTargetStage || !pipeline) return;

        // Check if moving to goal stage
        const targetStage = pipeline.stages.find(s => s.id === bulkMoveTargetStage);
        if (targetStage?.isGoal) {
            // For goal stages, we'll move without conversion value for bulk operations
            if (!confirm(`Move ${selectedLeads.size} lead(s) to "${targetStage.name}" (Goal)?\n\nNote: For bulk moves to goal stages, conversion values will default to $0. You can update them individually later.`)) return;
        }

        const updatedLeads = leads.map(lead => {
            if (selectedLeads.has(lead.id)) {
                return {
                    ...lead,
                    stageId: bulkMoveTargetStage,
                    lastActivity: new Date().toISOString(),
                    ...(targetStage?.isGoal && {
                        conversionValue: lead.conversionValue || 0,
                        convertedAt: new Date().toISOString()
                    })
                };
            }
            return lead;
        });

        saveLeads(updatedLeads);
        setSelectedLeads(new Set());
        setShowBulkMoveModal(false);
        setBulkMoveTargetStage('');
    };

    const handleDragStart = (lead: Lead) => {
        setDraggedLead(lead);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (stageId: string) => {
        if (!draggedLead) return;

        // Check if moving to goal stage - prompt for conversion value
        const stage = pipeline?.stages.find(s => s.id === stageId);
        if (stage?.isGoal) {
            setPendingGoalStageId(stageId);
            setShowConversionModal(true);
            return;
        }

        // Normal stage move
        moveLead(draggedLead.id, stageId);
    };

    const moveLead = (leadId: string, stageId: string, convValue?: number, convertedAt?: string) => {
        const updatedLeads = leads.map(lead =>
            lead.id === leadId
                ? {
                    ...lead,
                    stageId,
                    lastActivity: new Date().toISOString(),
                    ...(convValue !== undefined && {
                        conversionValue: convValue,
                        convertedAt: convertedAt || new Date().toISOString()
                    })
                }
                : lead
        );

        saveLeads(updatedLeads);
        setDraggedLead(null);
    };

    const handleConversionSubmit = async () => {
        if (!draggedLead || !pendingGoalStageId) return;

        const value = parseFloat(conversionValue) || 0;

        // Use conversion date if provided, otherwise NOW
        // This is the ACTUAL time the conversion happened (for Meta attribution)
        const actualConversionTime = conversionDate
            ? new Date(conversionDate).toISOString()
            : new Date().toISOString();

        // Move lead with the actual conversion time
        moveLead(draggedLead.id, pendingGoalStageId, value, actualConversionTime);

        // Send to Facebook CAPI
        setSendingCapi(true);
        try {
            const datasetId = localStorage.getItem('meta_dataset_id');
            const capiToken = localStorage.getItem('meta_capi_token');

            if (datasetId && capiToken) {
                // event_time = when the conversion ACTUALLY happened (not when we send it)
                // Meta uses this for attribution - must be Unix timestamp in seconds
                const eventTime = Math.floor(new Date(actualConversionTime).getTime() / 1000);

                // event_id = unique ID for deduplication (required by CAPI)
                const eventId = `conv_${draggedLead.id}_${Date.now()}`;

                const response = await fetch('/api/capi/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        datasetId,
                        accessToken: capiToken,
                        eventName: pipeline?.goal || 'Purchase',
                        eventTime: eventTime, // When conversion HAPPENED
                        eventId: eventId, // Required for deduplication
                        leadId: draggedLead.facebookLeadId,
                        email: draggedLead.email,
                        phone: draggedLead.phone,
                        firstName: draggedLead.name.split(' ')[0],
                        lastName: draggedLead.name.split(' ').slice(1).join(' '),
                        value: value,
                        currency: 'USD'
                    })
                });

                const result = await response.json();
                if (result.success) {
                    console.log('[SUCCESS] CAPI event sent:', result);
                } else {
                    console.error('[ERROR] CAPI error:', result.error);
                }
            } else {
                console.log('[WARN] CAPI not configured - skipping event send');
            }

            // === AUTO-UPDATE AD RESULTS & AI ALGORITHM ===
            // Update the ad's conversion stats in localStorage
            const savedAds = JSON.parse(localStorage.getItem('ads') || '[]');
            const leadSource = draggedLead.source; // e.g., "Facebook Ad: 123456789"

            // Find the ad that generated this lead (by source or Facebook Ad ID)
            const adIndex = savedAds.findIndex((ad: { facebookAdId?: string; id: string }) =>
                leadSource?.includes(ad.facebookAdId || '') || leadSource?.includes(ad.id)
            );

            if (adIndex !== -1) {
                // Update the ad's conversion count and total value
                savedAds[adIndex].conversions = (savedAds[adIndex].conversions || 0) + 1;
                savedAds[adIndex].totalConversionValue = (savedAds[adIndex].totalConversionValue || 0) + value;
                savedAds[adIndex].lastConversionAt = new Date().toISOString();
                savedAds[adIndex].updatedAt = new Date().toISOString();

                // Calculate actual success score based on conversions
                if (savedAds[adIndex].adInsights?.impressions) {
                    const conversionRate = (savedAds[adIndex].conversions / savedAds[adIndex].adInsights.impressions) * 100;
                    savedAds[adIndex].actualSuccessScore = Math.min(100, Math.round(conversionRate * 1000));
                }

                localStorage.setItem('ads', JSON.stringify(savedAds));
                console.log('[AD] Results updated:', savedAds[adIndex]);
            }

            // Feed conversion data to AI algorithm for learning
            const modelStats = JSON.parse(localStorage.getItem('ai_model_stats') || '{"dataPoints": 0, "patterns": []}');
            modelStats.dataPoints += 1;
            modelStats.lastTrainingAt = new Date().toISOString();

            // Store conversion pattern for learning
            const conversionPattern = {
                timestamp: new Date().toISOString(),
                pipelineId: params.id,
                pipelineGoal: pipeline?.goal,
                conversionValue: value,
                leadSource: draggedLead.source,
                stagesVisited: draggedLead.stageId,
                // Track what ad characteristics led to conversion
                adId: adIndex !== -1 ? savedAds[adIndex].id : null,
                adFeatures: adIndex !== -1 ? savedAds[adIndex].extractedContent : null
            };

            const conversionHistory = JSON.parse(localStorage.getItem('conversion_history') || '[]');
            conversionHistory.push(conversionPattern);
            // Keep last 1000 conversions for training
            if (conversionHistory.length > 1000) conversionHistory.shift();
            localStorage.setItem('conversion_history', JSON.stringify(conversionHistory));

            localStorage.setItem('ai_model_stats', JSON.stringify(modelStats));
            console.log('[AI] Algorithm updated with conversion data');

        } catch (error) {
            console.error('CAPI send error:', error);
        } finally {
            setSendingCapi(false);
        }

        setShowConversionModal(false);
        setConversionValue('');
        setConversionDate('');
        setPendingGoalStageId(null);
    };

    const handleSkipConversion = () => {
        if (!draggedLead || !pendingGoalStageId) return;
        moveLead(draggedLead.id, pendingGoalStageId, 0);
        setShowConversionModal(false);
        setConversionValue('');
        setPendingGoalStageId(null);
    };

    const getLeadsForStage = (stageId: string) => {
        return leads.filter(lead => lead.stageId === stageId);
    };

    const isStageFullySelected = (stageId: string) => {
        const stageLeads = getLeadsForStage(stageId);
        return stageLeads.length > 0 && stageLeads.every(l => selectedLeads.has(l.id));
    };

    const isStagePartiallySelected = (stageId: string) => {
        const stageLeads = getLeadsForStage(stageId);
        const selectedCount = stageLeads.filter(l => selectedLeads.has(l.id)).length;
        return selectedCount > 0 && selectedCount < stageLeads.length;
    };

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    };

    if (!pipeline) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>Loading pipeline...</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => router.push('/pipeline')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className={styles.title}>{pipeline.name}</h1>
                        <p className={styles.subtitle}>
                            Goal: <span className={styles.goalText}>{pipeline.goal}</span>
                        </p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>{leads.length}</span>
                            <span className={styles.statLabel}>Total Leads</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>
                                {leads.filter(l => l.stageId === pipeline.stages.find(s => s.isGoal)?.id).length}
                            </span>
                            <span className={styles.statLabel}>Converted</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statValue} style={{ color: 'var(--success)' }}>
                                ₱{leads.reduce((sum, l) => sum + (l.conversionValue || 0), 0).toLocaleString()}
                            </span>
                            <span className={styles.statLabel}>Revenue</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <button
                            className="btn btn-ghost"
                            onClick={handleReanalyzeLeads}
                            disabled={isReanalyzing || leads.length === 0}
                            title="Re-analyze all leads with AI"
                        >
                            {isReanalyzing ? 'Analyzing...' : 'Re-analyze Leads'}
                        </button>
                        <button className="btn btn-primary" onClick={() => setShowAddLeadModal(true)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Lead
                        </button>
                    </div>
                </div>
            </header>

            {/* AI Insight Banner */}
            <div className={styles.aiInsight}>
                <span className={styles.aiIcon}>AI</span>
                <span>AI is observing lead behavior. New stages will be suggested when patterns emerge.</span>
            </div>

            {/* Kanban Board */}
            <div className={styles.kanban}>
                {pipeline.stages.map((stage, idx) => (
                    <div
                        key={stage.id}
                        className={`${styles.column} ${stage.isGoal ? styles.goalColumn : ''} ${stage.isAutoCreated ? styles.aiColumn : ''}`}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(stage.id)}
                    >
                        <div className={styles.columnHeader}>
                            <div className={styles.columnTitle}>
                                {stage.isAutoCreated && <span className={styles.aiBadge}>AI</span>}
                                {stage.name}
                                {stage.isGoal && <span className={styles.goalBadge}>✓</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {getLeadsForStage(stage.id).length > 0 && (
                                    <label
                                        className={styles.stageCheckbox}
                                        onClick={(e) => e.stopPropagation()}
                                        title={isStageFullySelected(stage.id) ? 'Deselect all in stage' : 'Select all in stage'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isStageFullySelected(stage.id)}
                                            ref={(el) => {
                                                if (el) el.indeterminate = isStagePartiallySelected(stage.id);
                                            }}
                                            onChange={() => toggleAllInStage(stage.id)}
                                        />
                                    </label>
                                )}
                                <span className={styles.columnCount}>{getLeadsForStage(stage.id).length}</span>
                                <button
                                    className={styles.linkAdBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingStage({
                                            id: stage.id,
                                            name: stage.name,
                                            description: stage.description,
                                            facebookEvent: stage.facebookEvent,
                                            isGoal: stage.isGoal
                                        });
                                        setShowStageEditModal(true);
                                    }}
                                    title="Edit stage"
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                        {/* Facebook Event Badge */}
                        {stage.facebookEvent && (
                            <div style={{
                                padding: '4px 8px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                color: '#a5b4fc',
                                marginBottom: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                FB: {FACEBOOK_EVENTS.find(e => e.id === stage.facebookEvent)?.name || stage.facebookEvent}
                            </div>
                        )}
                        {/* Auto-Linked Ads based on lead sources */}
                        {getAutoLinkedAdsForStage(stage.id).length > 0 && (
                            <div className={styles.linkedAds}>
                                {getAutoLinkedAdsForStage(stage.id).map(link => (
                                    <div key={link.adId} className={styles.linkedAdBadge}>
                                        <span>Ad: {link.adName.length > 15 ? link.adName.slice(0, 15) + '...' : link.adName}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.columnContent}>
                            {getLeadsForStage(stage.id).map(lead => (
                                <div
                                    key={lead.id}
                                    className={`${styles.leadCard} ${selectedLeads.has(lead.id) ? styles.leadCardSelected : ''}`}
                                    draggable={selectedLeads.size === 0}
                                    onDragStart={() => selectedLeads.size === 0 && handleDragStart(lead)}
                                    onClick={() => {
                                        setSelectedLead(lead);
                                        setShowLeadDetailModal(true);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.leadHeader}>
                                        <div className={styles.leadHeaderLeft}>
                                            <label
                                                className={styles.leadCheckbox}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLeads.has(lead.id)}
                                                    onChange={() => toggleLeadSelection(lead.id)}
                                                />
                                            </label>
                                            <span className={styles.leadName}>{lead.name}</span>
                                        </div>
                                        <button
                                            className={styles.leadDelete}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteLead(lead.id, lead.name);
                                            }}
                                            title="Delete lead"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    {lead.email && (
                                        <div className={styles.leadContact}>📧 {lead.email}</div>
                                    )}
                                    {lead.phone && (
                                        <div className={styles.leadContact}>📱 {lead.phone}</div>
                                    )}
                                    {/* Source Ad Info */}
                                    {(lead.sourceAdName || lead.sourceAdId) && (
                                        <div style={{
                                            marginTop: '4px',
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px'
                                        }}>
                                            {lead.sourceAdName && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Ad: <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {lead.sourceAdName.length > 20 ? lead.sourceAdName.substring(0, 20) + '...' : lead.sourceAdName}
                                                    </span>
                                                </div>
                                            )}
                                            {lead.sourceAdId && (
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                                                    ID: {lead.sourceAdId}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {lead.conversionValue !== undefined && lead.conversionValue > 0 && (
                                        <div style={{
                                            marginTop: '4px',
                                            padding: '4px 8px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            borderRadius: '4px',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: 'var(--success)'
                                        }}>
                                            P{lead.conversionValue.toLocaleString()}
                                        </div>
                                    )}
                                    <div className={styles.leadMeta}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            {lead.isPlaceholder ? (
                                                <span style={{
                                                    background: 'rgba(156, 163, 175, 0.3)',
                                                    color: 'var(--text-muted)',
                                                    padding: '1px 6px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem'
                                                }}>⏳ Pending</span>
                                            ) : lead.isRealLead ? (
                                                <span style={{
                                                    background: 'rgba(16, 185, 129, 0.2)',
                                                    color: 'var(--success)',
                                                    padding: '1px 6px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem'
                                                }}>✓ Verified</span>
                                            ) : null}
                                            <span className={styles.leadSource}>{lead.source}</span>
                                        </div>
                                        <span className={styles.leadTime} title={`Created: ${new Date(lead.createdAt).toLocaleString()}`}>
                                            {getTimeAgo(lead.lastActivity)}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {getLeadsForStage(stage.id).length === 0 && (
                                <div className={styles.emptyColumn}>
                                    Drag leads here
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Lead Modal */}
            {
                showAddLeadModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowAddLeadModal(false)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h2>Add New Lead</h2>
                                <button className={styles.closeBtn} onClick={() => setShowAddLeadModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className={styles.modalBody}>
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Lead name"
                                        value={newLead.name}
                                        onChange={e => setNewLead({ ...newLead, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        placeholder="email@example.com"
                                        value={newLead.email}
                                        onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder="+1 234 567 8900"
                                        value={newLead.phone}
                                        onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Source</label>
                                    <select
                                        className="form-input"
                                        value={newLead.source}
                                        onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                                    >
                                        <option value="Manual">Manual Entry</option>
                                        <option value="Facebook Ads">Facebook Ads</option>
                                        <option value="Instagram Ads">Instagram Ads</option>
                                        <option value="Messenger">Messenger</option>
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Webhook">Webhook</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button className="btn btn-secondary" onClick={() => setShowAddLeadModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleAddLead}
                                    disabled={!newLead.name}
                                >
                                    Add Lead
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Conversion Value Modal */}
            {
                showConversionModal && draggedLead && (
                    <div className={styles.modalOverlay} onClick={() => {
                        setShowConversionModal(false);
                        setDraggedLead(null);
                        setPendingGoalStageId(null);
                    }}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader} style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))' }}>
                                <h2>🎯 Lead Converted!</h2>
                                <button className={styles.closeBtn} onClick={() => {
                                    setShowConversionModal(false);
                                    setDraggedLead(null);
                                    setPendingGoalStageId(null);
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className={styles.modalBody}>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                    <strong>{draggedLead.name}</strong> has reached <strong>{pipeline?.goal}</strong>
                                </p>

                                <div className="form-group">
                                    <label className="form-label">Purchase Value (for Meta ROAS)</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)',
                                            fontSize: '1.25rem'
                                        }}>$</span>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="0.00"
                                            value={conversionValue}
                                            onChange={e => setConversionValue(e.target.value)}
                                            style={{ paddingLeft: '32px', fontSize: '1.25rem' }}
                                            autoFocus
                                        />
                                    </div>
                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        This value is sent to Meta for ROAS calculation (Return on Ad Spend)
                                    </small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Conversion Date (optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={conversionDate}
                                        onChange={e => setConversionDate(e.target.value)}
                                        max={new Date().toISOString().slice(0, 16)}
                                    />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        Leave empty for NOW, or select past date for backdated conversions
                                    </small>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button className="btn btn-secondary" onClick={handleSkipConversion} disabled={sendingCapi}>
                                    Skip (No Value)
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleConversionSubmit}
                                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                                    disabled={sendingCapi}
                                >
                                    {sendingCapi ? 'Sending to Facebook...' : 'Save & Send to Facebook'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Bulk Move Modal */}
            {
                showBulkMoveModal && pipeline && (
                    <div className={styles.modalOverlay} onClick={() => setShowBulkMoveModal(false)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h2>Move {selectedLeads.size} Lead(s)</h2>
                                <button className={styles.closeBtn} onClick={() => setShowBulkMoveModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className={styles.modalBody}>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                    Select a stage to move the selected leads to:
                                </p>

                                <div className="form-group">
                                    <label className="form-label">Target Stage</label>
                                    <select
                                        className="form-input"
                                        value={bulkMoveTargetStage}
                                        onChange={e => setBulkMoveTargetStage(e.target.value)}
                                    >
                                        <option value="">-- Select a stage --</option>
                                        {pipeline.stages.map(stage => (
                                            <option key={stage.id} value={stage.id}>
                                                {stage.name} {stage.isGoal ? '(Goal)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button className="btn btn-secondary" onClick={() => setShowBulkMoveModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleBulkMove}
                                    disabled={!bulkMoveTargetStage}
                                >
                                    Move Leads
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Bulk Actions Bar */}
            {
                selectedLeads.size > 0 && (
                    <div className={styles.bulkActionsBar}>
                        <div className={styles.bulkActionsLeft}>
                            <label className={styles.selectAllCheckbox}>
                                <input
                                    type="checkbox"
                                    checked={selectedLeads.size === leads.length}
                                    onChange={selectAllLeads}
                                />
                                <span>Select All</span>
                            </label>
                            <span className={styles.selectedCount}>
                                {selectedLeads.size} selected
                            </span>
                        </div>
                        <div className={styles.bulkActionsRight}>
                            <button
                                className={styles.bulkActionBtn}
                                onClick={() => setShowBulkMoveModal(true)}
                            >
                                Move to Stage
                            </button>
                            <button
                                className={`${styles.bulkActionBtn} ${styles.bulkActionBtnDanger}`}
                                onClick={handleBulkDelete}
                            >
                                Delete Selected
                            </button>
                            <button
                                className={styles.bulkActionBtnClear}
                                onClick={clearSelection}
                            >
                                ✕ Clear
                            </button>
                        </div>
                    </div>
                )
            }

            <Link
                href={`/pipeline/${params.id}/contacts`}
                className={styles.viewContactsBtn}
                style={{ bottom: selectedLeads.size > 0 ? '80px' : 'var(--spacing-lg)' }}
            >
                👥 View Contacts
            </Link>

            {/* Lead Detail Modal */}
            {
                showLeadDetailModal && selectedLead && (
                    <div className={styles.modalOverlay} onClick={() => setShowLeadDetailModal(false)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
                            <div className={styles.modalHeader}>
                                <h2>{selectedLead.name}</h2>
                                <button className={styles.closeBtn} onClick={() => setShowLeadDetailModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className={styles.modalBody}>
                                {/* Contact Info */}
                                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                    <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Contact Info</h4>
                                    {selectedLead.email && <p><strong>Email:</strong> {selectedLead.email}</p>}
                                    {selectedLead.phone && <p><strong>Phone:</strong> {selectedLead.phone}</p>}
                                    {selectedLead.facebookPsid && <p><strong>Facebook ID:</strong> {selectedLead.facebookPsid}</p>}
                                    {selectedLead.source && <p><strong>Source:</strong> {selectedLead.source}</p>}
                                    {selectedLead.sourceAdName && <p><strong>Ad:</strong> {selectedLead.sourceAdName}</p>}
                                    <p><strong>Created:</strong> {new Date(selectedLead.createdAt).toLocaleString()}</p>
                                </div>

                                {/* AI Analysis */}
                                {selectedLead.aiAnalysis && (
                                    <div style={{
                                        marginBottom: 'var(--spacing-lg)',
                                        padding: 'var(--spacing-md)',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}>
                                        <h4 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            AI Analysis
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                background: selectedLead.aiAnalysis.sentiment === 'positive' ? 'rgba(16, 185, 129, 0.2)' :
                                                    selectedLead.aiAnalysis.sentiment === 'negative' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                                                color: selectedLead.aiAnalysis.sentiment === 'positive' ? 'var(--success)' :
                                                    selectedLead.aiAnalysis.sentiment === 'negative' ? 'var(--error)' : 'var(--text-secondary)'
                                            }}>
                                                {selectedLead.aiAnalysis.sentiment}
                                            </span>
                                        </h4>
                                        {selectedLead.aiAnalysis.summary && <p style={{ marginBottom: '8px' }}>{selectedLead.aiAnalysis.summary}</p>}
                                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                            {selectedLead.aiAnalysis.intent && <span>Intent: <strong>{selectedLead.aiAnalysis.intent}</strong></span>}
                                            {selectedLead.aiAnalysis.leadScore !== undefined && (
                                                <span>Score: <strong style={{
                                                    color:
                                                        selectedLead.aiAnalysis.leadScore >= 70 ? 'var(--success)' :
                                                            selectedLead.aiAnalysis.leadScore >= 40 ? 'var(--warning)' : 'var(--error)'
                                                }}>{selectedLead.aiAnalysis.leadScore}</strong>/100</span>
                                            )}
                                        </div>
                                        {selectedLead.aiAnalysis.extractedEmail && <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Extracted Email: {selectedLead.aiAnalysis.extractedEmail}</p>}
                                        {selectedLead.aiAnalysis.extractedPhone && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Extracted Phone: {selectedLead.aiAnalysis.extractedPhone}</p>}
                                    </div>
                                )}

                                {/* Messages */}
                                {selectedLead.messages && selectedLead.messages.length > 0 && (
                                    <div>
                                        <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>
                                            Messages ({selectedLead.messages.length})
                                        </h4>
                                        <div style={{
                                            maxHeight: '300px',
                                            overflow: 'auto',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-sm)'
                                        }}>
                                            {selectedLead.messages.map((msg, idx) => (
                                                <div key={msg.id || idx} style={{
                                                    marginBottom: 'var(--spacing-sm)',
                                                    padding: 'var(--spacing-sm)',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: 'var(--radius-sm)'
                                                }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                        <strong>{msg.from}</strong> • {new Date(msg.timestamp).toLocaleString()}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem' }}>{msg.content || '(No content)'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No messages fallback */}
                                {(!selectedLead.messages || selectedLead.messages.length === 0) && selectedLead.lastMessage && (
                                    <div>
                                        <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>Last Message</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selectedLead.lastMessage}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            {/* Stage Edit Modal */}
            {showStageEditModal && editingStage && (
                <div className={styles.modalOverlay} onClick={() => setShowStageEditModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className={styles.modalHeader}>
                            <h2>Edit Stage</h2>
                            <button className={styles.closeBtn} onClick={() => setShowStageEditModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className="form-group">
                                <label className="form-label">Stage Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={editingStage.name}
                                    onChange={e => setEditingStage({ ...editingStage, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Stage Description / Use</label>
                                <textarea
                                    className="form-input"
                                    placeholder="e.g., Leads actively inquiring about pricing, or customers who have scheduled a call..."
                                    value={editingStage.description || ''}
                                    onChange={e => setEditingStage({ ...editingStage, description: e.target.value })}
                                    rows={2}
                                    style={{ resize: 'vertical', minHeight: '60px' }}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    Describe the purpose of this stage
                                </small>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Facebook Event (CAPI)</label>
                                <select
                                    className="form-input"
                                    value={editingStage.facebookEvent || ''}
                                    onChange={e => setEditingStage({ ...editingStage, facebookEvent: e.target.value })}
                                >
                                    <option value="">-- Select Facebook Event --</option>
                                    {FACEBOOK_EVENTS.map(event => (
                                        <option key={event.id} value={event.id}>
                                            {event.name} - {event.description}
                                        </option>
                                    ))}
                                </select>
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    This event will be sent to Facebook when leads reach this stage
                                </small>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editingStage.isGoal}
                                        onChange={e => setEditingStage({ ...editingStage, isGoal: e.target.checked })}
                                    />
                                    <span>This is the Goal stage (conversions)</span>
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                                <button className="btn btn-primary" onClick={saveStageEdit} style={{ flex: 1 }}>
                                    Save Changes
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => { setShowStageEditModal(false); deleteStage(editingStage.id); }}
                                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Add Stage Modal */}
            {
                showAddStageModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowAddStageModal(false)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                            <div className={styles.modalHeader}>
                                <h2>Add New Stage</h2>
                                <button className={styles.closeBtn} onClick={() => setShowAddStageModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className="form-group">
                                    <label className="form-label">Stage Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., Negotiation, Follow-up..."
                                        value={newStageName}
                                        onChange={e => setNewStageName(e.target.value)}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={addNewStage} style={{ width: '100%', marginTop: 'var(--spacing-md)' }}>
                                    Add Stage
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Stage Button */}
            <button
                onClick={() => setShowAddStageModal(true)}
                style={{
                    position: 'fixed',
                    bottom: 'var(--spacing-lg)',
                    right: '100px',
                    background: 'var(--bg-secondary)',
                    border: '2px dashed var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                ➕ Add Stage
            </button>
        </div >
    );
}

