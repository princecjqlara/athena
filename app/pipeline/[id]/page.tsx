'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { adLinksStore, getStoredAds, AdPipelineLink } from '@/lib/contacts-store';

interface Stage {
    id: string;
    name: string;
    isGoal: boolean;
    isAutoCreated: boolean;
    leadCount: number;
    linkedAdIds?: string[];  // Facebook Ad IDs linked to this stage
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

    // Ad linking state
    const [storedAds, setStoredAds] = useState<StoredAd[]>([]);
    const [adLinks, setAdLinks] = useState<AdPipelineLink[]>([]);
    const [showLinkAdModal, setShowLinkAdModal] = useState(false);
    const [selectedStageForLinking, setSelectedStageForLinking] = useState<string | null>(null);
    const [selectedAdToLink, setSelectedAdToLink] = useState<string>('');

    useEffect(() => {
        // Load pipeline from localStorage
        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            const pipelines = JSON.parse(savedPipelines);
            const found = pipelines.find((p: Pipeline) => p.id === params.id);
            if (found) {
                setPipeline(found);
                // Load leads for this pipeline
                const savedLeads = localStorage.getItem(`leads_${params.id}`);
                if (savedLeads) {
                    setLeads(JSON.parse(savedLeads));
                }
            }
        }

        // Load stored ads and ad-pipeline links
        setStoredAds(getStoredAds());
        setAdLinks(adLinksStore.getByPipeline(params.id as string));
    }, [params.id]);

    // Handle linking an ad to a stage
    const handleLinkAd = () => {
        if (!selectedStageForLinking || !selectedAdToLink) return;

        const ad = storedAds.find(a => a.id === selectedAdToLink);
        if (!ad) return;

        const newLink = adLinksStore.create({
            adId: ad.facebookAdId || ad.id,
            adName: ad.name || 'Unnamed Ad',
            pipelineId: params.id as string,
            stageId: selectedStageForLinking,
        });

        setAdLinks([...adLinks.filter(l => l.adId !== newLink.adId), newLink]);
        setShowLinkAdModal(false);
        setSelectedStageForLinking(null);
        setSelectedAdToLink('');
    };

    // Handle unlinking an ad
    const handleUnlinkAd = (adId: string) => {
        adLinksStore.delete(adId);
        setAdLinks(adLinks.filter(l => l.adId !== adId));
    };

    // Get linked ads for a stage
    const getLinkedAdsForStage = (stageId: string) => {
        return adLinks.filter(l => l.stageId === stageId);
    };

    // Open link ad modal
    const openLinkAdModal = (stageId: string) => {
        setSelectedStageForLinking(stageId);
        setSelectedAdToLink('');
        setShowLinkAdModal(true);
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
    const handleDeleteLead = (leadId: string, leadName: string) => {
        if (!confirm(`Delete "${leadName}"?\n\nThis will permanently remove this lead.`)) return;

        const updatedLeads = leads.filter(l => l.id !== leadId);
        saveLeads(updatedLeads);
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
                    console.log('✅ CAPI event sent:', result);
                } else {
                    console.error('❌ CAPI error:', result.error);
                }
            } else {
                console.log('⚠️ CAPI not configured - skipping event send');
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
                console.log('📊 Ad results updated:', savedAds[adIndex]);
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
            console.log('🤖 AI algorithm updated with conversion data');

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
                                ${leads.reduce((sum, l) => sum + (l.conversionValue || 0), 0).toLocaleString()}
                            </span>
                            <span className={styles.statLabel}>Revenue</span>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowAddLeadModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Lead
                    </button>
                </div>
            </header>

            {/* AI Insight Banner */}
            <div className={styles.aiInsight}>
                <span className={styles.aiIcon}>🤖</span>
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
                                {stage.isAutoCreated && <span className={styles.aiBadge}>🤖</span>}
                                {stage.name}
                                {stage.isGoal && <span className={styles.goalBadge}>✓</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={styles.columnCount}>{getLeadsForStage(stage.id).length}</span>
                                <button
                                    className={styles.linkAdBtn}
                                    onClick={(e) => { e.stopPropagation(); openLinkAdModal(stage.id); }}
                                    title="Link an ad to this stage"
                                >
                                    🔗
                                </button>
                            </div>
                        </div>
                        {/* Linked Ads */}
                        {getLinkedAdsForStage(stage.id).length > 0 && (
                            <div className={styles.linkedAds}>
                                {getLinkedAdsForStage(stage.id).map(link => (
                                    <div key={link.adId} className={styles.linkedAdBadge}>
                                        <span>📊 {link.adName.length > 15 ? link.adName.slice(0, 15) + '...' : link.adName}</span>
                                        <button
                                            className={styles.unlinkBtn}
                                            onClick={() => handleUnlinkAd(link.adId)}
                                            title="Unlink this ad"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.columnContent}>
                            {getLeadsForStage(stage.id).map(lead => (
                                <div
                                    key={lead.id}
                                    className={styles.leadCard}
                                    draggable
                                    onDragStart={() => handleDragStart(lead)}
                                >
                                    <div className={styles.leadHeader}>
                                        <span className={styles.leadName}>{lead.name}</span>
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
                                            💰 ${lead.conversionValue.toLocaleString()}
                                        </div>
                                    )}
                                    <div className={styles.leadMeta}>
                                        <span className={styles.leadSource}>{lead.source}</span>
                                        <span className={styles.leadTime}>{getTimeAgo(lead.lastActivity)}</span>
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
            {showAddLeadModal && (
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
            )}

            {/* Conversion Value Modal */}
            {showConversionModal && draggedLead && (
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
                                <label className="form-label">💰 Purchase Value (for Meta ROAS)</label>
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
                                {sendingCapi ? '📡 Sending to Facebook...' : '💰 Save & Send to Facebook'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Ad Modal */}
            {showLinkAdModal && (
                <div className={styles.modalOverlay} onClick={() => setShowLinkAdModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>🔗 Link Ad to Stage</h2>
                            <button className={styles.closeBtn} onClick={() => setShowLinkAdModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                                Link a Facebook ad to track contacts from that ad in this pipeline stage.
                            </p>

                            {storedAds.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-muted)' }}>
                                    <p>No ads imported yet.</p>
                                    <Link href="/import" className="btn btn-primary" style={{ marginTop: 'var(--spacing-md)' }}>
                                        📥 Import Ads First
                                    </Link>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">Select Ad</label>
                                    <select
                                        className="form-input"
                                        value={selectedAdToLink}
                                        onChange={e => setSelectedAdToLink(e.target.value)}
                                    >
                                        <option value="">-- Select an ad --</option>
                                        {storedAds.map(ad => {
                                            const isLinked = adLinks.some(l => l.adId === (ad.facebookAdId || ad.id));
                                            return (
                                                <option
                                                    key={ad.id}
                                                    value={ad.id}
                                                    disabled={isLinked}
                                                >
                                                    {ad.name || 'Unnamed Ad'} {isLinked ? '(already linked)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            <button className="btn btn-secondary" onClick={() => setShowLinkAdModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleLinkAd}
                                disabled={!selectedAdToLink}
                            >
                                🔗 Link Ad
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Contacts Button - fixed position */}
            <Link
                href={`/pipeline/${params.id}/contacts`}
                className={styles.viewContactsBtn}
            >
                👥 View Contacts
            </Link>
        </div>
    );
}

