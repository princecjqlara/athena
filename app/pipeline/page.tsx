'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { contactsStore } from '@/lib/contacts-store';

interface Pipeline {
    id: string;
    name: string;
    goal: string;
    stages: Stage[];
    leadCount: number;
    createdAt: string;
}

interface Stage {
    id: string;
    name: string;
    isGoal: boolean;
    isAutoCreated: boolean;
    leadCount: number;
}

interface FetchedContact {
    conversationId: string;
    facebookPsid: string;
    name: string;
    email?: string;
    isFromAd: boolean;
    messageCount: number;
    firstMessageAt?: string;
    lastMessageAt?: string;
    lastMessage?: string;
    messages: Array<{
        id: string;
        content: string;
        from: string;
        fromId: string;
        timestamp: string;
    }>;
}

const GOAL_PRESETS = [
    { id: 'appointment', name: 'Appointment Booked', icon: '📅', description: 'Track leads until they book an appointment' },
    { id: 'purchase', name: 'Purchase Made', icon: '💰', description: 'Track leads until they make a purchase' },
    { id: 'signup', name: 'Signed Up', icon: '✅', description: 'Track leads until they sign up' },
    { id: 'demo', name: 'Demo Scheduled', icon: '🎯', description: 'Track leads until they schedule a demo' },
    { id: 'quote', name: 'Quote Requested', icon: '📝', description: 'Track leads until they request a quote' },
    { id: 'custom', name: 'Custom Goal', icon: '⚙️', description: 'Define your own conversion goal' },
];

export default function PipelinePage() {
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPipelineName, setNewPipelineName] = useState('');
    const [selectedGoal, setSelectedGoal] = useState('');
    const [customGoal, setCustomGoal] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Fetch contacts state
    const [isFetchingContacts, setIsFetchingContacts] = useState(false);
    const [fetchedContacts, setFetchedContacts] = useState<FetchedContact[]>([]);
    const [showFetchModal, setShowFetchModal] = useState(false);
    const [fetchError, setFetchError] = useState('');

    // All contacts from pipeline_contacts
    const [allContacts, setAllContacts] = useState<Array<{
        id: string;
        name: string;
        email?: string;
        phone?: string;
        sourceAdName?: string;
        sourceAdId?: string;
        facebookAdId?: string;
        source?: string;
        createdAt: string;
        isPlaceholder?: boolean;
    }>>([]);

    // Load pipelines from localStorage and contacts from Supabase
    useEffect(() => {
        const saved = localStorage.getItem('pipelines');
        if (saved) {
            setPipelines(JSON.parse(saved));
        }

        // Load contacts from Supabase API (or fallback to localStorage)
        const fetchContacts = async () => {
            try {
                const response = await fetch('/api/contacts');
                const data = await response.json();

                if (data.success && data.data.length > 0) {
                    // Map Supabase snake_case to camelCase for display
                    const mappedContacts = data.data.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        email: c.email,
                        phone: c.phone,
                        sourceAdName: c.source_ad_name,
                        sourceAdId: c.source_ad_id,
                        facebookAdId: c.source_ad_id, // Same as sourceAdId for display
                        source: c.source_ad_id ? 'ad' : 'organic',
                        createdAt: c.created_at,
                        isPlaceholder: false, // From Supabase = real data
                    }));
                    setAllContacts(mappedContacts);
                    console.log('[Pipeline] Loaded', mappedContacts.length, 'contacts from Supabase');
                } else {
                    // Fallback to localStorage for existing data
                    const savedContacts = localStorage.getItem('pipeline_contacts');
                    if (savedContacts) {
                        setAllContacts(JSON.parse(savedContacts));
                        console.log('[Pipeline] Loaded contacts from localStorage (fallback)');
                    }
                }
            } catch (err) {
                console.error('[Pipeline] Error fetching contacts:', err);
                // Fallback to localStorage
                const savedContacts = localStorage.getItem('pipeline_contacts');
                if (savedContacts) {
                    setAllContacts(JSON.parse(savedContacts));
                }
            }
        };

        fetchContacts();
    }, []);

    // Fetch Messenger contacts from Facebook
    const handleFetchContacts = async () => {
        setIsFetchingContacts(true);
        setFetchError('');

        try {
            // Get user's access token from localStorage
            const accessToken = localStorage.getItem('fb_access_token');
            if (!accessToken) {
                setFetchError('Please connect your Facebook account first. Go to Import page and connect with Facebook.');
                setIsFetchingContacts(false);
                return;
            }

            // First, get pages
            const pagesResponse = await fetch(`/api/facebook/pages?access_token=${accessToken}`);
            const pagesData = await pagesResponse.json();

            if (!pagesData.success || !pagesData.pages?.length) {
                setFetchError('No Facebook pages found. Make sure you have pages_messaging permission.');
                setIsFetchingContacts(false);
                return;
            }

            // Use first page for now (could add page selector later)
            const page = pagesData.pages[0];

            // Fetch conversations using page token
            const convResponse = await fetch(
                `/api/facebook/conversations?page_id=${page.id}&page_access_token=${page.accessToken}&limit=50`
            );
            const convData = await convResponse.json();

            if (!convData.success) {
                setFetchError(convData.error || 'Failed to fetch conversations');
                setIsFetchingContacts(false);
                return;
            }

            setFetchedContacts(convData.contacts);
            setShowFetchModal(true);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            setFetchError('Error fetching contacts: ' + String(error));
        }

        setIsFetchingContacts(false);
    };

    // Import selected contacts
    const handleImportContacts = (contacts: FetchedContact[], pipelineId?: string, stageId?: string) => {
        // Import to contacts store
        contacts.forEach(contact => {
            const newContact = {
                id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: contact.name,
                email: contact.email,
                facebookPsid: contact.facebookPsid,
                sourceAdId: contact.isFromAd ? 'messenger_ad' : undefined,
                source: contact.isFromAd ? 'ad' as const : 'organic' as const,
                pipelineId: pipelineId,
                stageId: stageId || 'new-lead',
                messages: contact.messages?.map(m => ({
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    contactId: '',
                    content: m.content,
                    direction: 'inbound' as const,
                    timestamp: m.timestamp,
                    messageId: m.id
                })) || [],
                firstMessageAt: contact.firstMessageAt,
                lastMessageAt: contact.lastMessageAt,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Save to existing contacts
            const existingContacts = contactsStore.getAll();
            const exists = existingContacts.find(c => c.facebookPsid === contact.facebookPsid);
            if (!exists) {
                existingContacts.push(newContact as any);
                contactsStore.saveAll(existingContacts);
            }
        });

        // Update pipeline lead count
        if (pipelineId) {
            const updated = pipelines.map(p => {
                if (p.id === pipelineId) {
                    return { ...p, leadCount: p.leadCount + contacts.length };
                }
                return p;
            });
            setPipelines(updated);
            localStorage.setItem('pipelines', JSON.stringify(updated));
        }

        setShowFetchModal(false);
        setFetchedContacts([]);
        alert(`✅ Imported ${contacts.length} contacts!`);
    };

    // Delete a contact from the Imported Leads section
    const handleDeleteContact = (contactId: string, contactName: string) => {
        if (!confirm(`Delete "${contactName}"?\n\nThis will permanently remove this lead.`)) return;

        const updated = allContacts.filter(c => c.id !== contactId);
        setAllContacts(updated);
        localStorage.setItem('pipeline_contacts', JSON.stringify(updated));
    };

    // Delete all imported contacts
    const handleDeleteAllContacts = () => {
        if (!confirm(`Delete ALL ${allContacts.length} imported leads?\n\nThis cannot be undone.`)) return;

        setAllContacts([]);
        localStorage.setItem('pipeline_contacts', JSON.stringify([]));
    };

    const handleCreatePipeline = () => {
        if (!newPipelineName || !selectedGoal) return;

        setIsCreating(true);

        const goalName = selectedGoal === 'custom'
            ? customGoal
            : GOAL_PRESETS.find(g => g.id === selectedGoal)?.name || selectedGoal;

        const newPipeline: Pipeline = {
            id: Date.now().toString(),
            name: newPipelineName,
            goal: goalName,
            stages: [
                { id: 'new-lead', name: 'New Lead', isGoal: false, isAutoCreated: false, leadCount: 0 },
                { id: 'goal', name: goalName, isGoal: true, isAutoCreated: false, leadCount: 0 },
            ],
            leadCount: 0,
            createdAt: new Date().toISOString(),
        };

        const updated = [...pipelines, newPipeline];
        setPipelines(updated);
        localStorage.setItem('pipelines', JSON.stringify(updated));

        // Reset form
        setShowCreateModal(false);
        setNewPipelineName('');
        setSelectedGoal('');
        setCustomGoal('');
        setIsCreating(false);
    };

    const handleDeletePipeline = (id: string) => {
        if (confirm('Are you sure you want to delete this pipeline?')) {
            const updated = pipelines.filter(p => p.id !== id);
            setPipelines(updated);
            localStorage.setItem('pipelines', JSON.stringify(updated));
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <span className={styles.aiIcon}>🤖</span>
                        AI Pipeline
                    </h1>
                    <p className={styles.subtitle}>
                        Let AI build your sales pipeline based on real customer behavior
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleFetchContacts}
                        disabled={isFetchingContacts}
                    >
                        {isFetchingContacts ? (
                            <>⏳ Fetching...</>
                        ) : (
                            <>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Fetch Messenger Contacts
                            </>
                        )}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create Pipeline
                    </button>
                </div>
            </header>

            {/* Error message */}
            {fetchError && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-lg)',
                    color: '#ef4444'
                }}>
                    ⚠️ {fetchError}
                </div>
            )}

            {/* How It Works */}
            <div className={`glass-card ${styles.howItWorks}`}>
                <h3>How AI Pipeline Works</h3>
                <div className={styles.steps}>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>1</div>
                        <div className={styles.stepContent}>
                            <h4>Set Your Goal</h4>
                            <p>Choose what success looks like (e.g., Appointment Booked)</p>
                        </div>
                    </div>
                    <div className={styles.stepArrow}>→</div>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>2</div>
                        <div className={styles.stepContent}>
                            <h4>AI Observes</h4>
                            <p>Leads come in, AI watches their behavior patterns</p>
                        </div>
                    </div>
                    <div className={styles.stepArrow}>→</div>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>3</div>
                        <div className={styles.stepContent}>
                            <h4>Stages Emerge</h4>
                            <p>AI creates stages like "Interested" or "Cold" automatically</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* All Imported Contacts */}
            {allContacts.length > 0 && (
                <div className="glass-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            📱 Imported Leads ({allContacts.length})
                        </h3>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={handleDeleteAllContacts}
                            style={{ color: 'var(--error)' }}
                        >
                            🗑️ Clear All
                        </button>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 'var(--spacing-md)'
                    }}>
                        {allContacts.slice(0, 20).map(contact => (
                            <div
                                key={contact.id}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-primary)',
                                    position: 'relative'
                                }}
                            >
                                <button
                                    onClick={() => handleDeleteContact(contact.id, contact.name)}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        fontSize: '1.2rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Delete lead"
                                >
                                    ×
                                </button>
                                <div style={{ fontWeight: 600, paddingRight: '20px' }}>{contact.name}</div>
                                {contact.email && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        📧 {contact.email}
                                    </div>
                                )}
                                {contact.phone && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        📱 {contact.phone}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {contact.sourceAdName && `Ad: ${contact.sourceAdName.substring(0, 25)}...`}
                                </div>
                                {contact.facebookAdId && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                                        ID: {contact.facebookAdId}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {contact.isPlaceholder ? (
                                        <span style={{ background: 'rgba(156, 163, 175, 0.3)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '10px' }}>⏳ Placeholder</span>
                                    ) : (
                                        <span style={{ background: 'var(--accent-gradient)', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>📣 Real Lead</span>
                                    )}
                                    {new Date(contact.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                    {allContacts.length > 20 && (
                        <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Showing 20 of {allContacts.length} leads
                        </p>
                    )}
                </div>
            )}

            {/* Pipelines Grid */}
            {pipelines.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🎯</div>
                    <h3>No Pipelines Yet</h3>
                    <p>Create your first AI-powered pipeline to start tracking leads</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        Create Your First Pipeline
                    </button>
                </div>
            ) : (
                <div className={styles.pipelinesGrid}>
                    {pipelines.map(pipeline => (
                        <Link
                            href={`/pipeline/${pipeline.id}`}
                            key={pipeline.id}
                            className={`glass-card ${styles.pipelineCard}`}
                        >
                            <div className={styles.pipelineHeader}>
                                <h3>{pipeline.name}</h3>
                                <button
                                    className={styles.deleteBtn}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleDeletePipeline(pipeline.id);
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                </button>
                            </div>
                            <div className={styles.pipelineGoal}>
                                <span className={styles.goalLabel}>Goal:</span>
                                <span className={styles.goalValue}>{pipeline.goal}</span>
                            </div>
                            <div className={styles.pipelineStats}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{pipeline.stages.length}</span>
                                    <span className={styles.statLabel}>Stages</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{pipeline.leadCount}</span>
                                    <span className={styles.statLabel}>Leads</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>
                                        {pipeline.stages.filter(s => s.isAutoCreated).length}
                                    </span>
                                    <span className={styles.statLabel}>AI Created</span>
                                </div>
                            </div>
                            <div className={styles.pipelineStages}>
                                {pipeline.stages.map((stage, idx) => (
                                    <span
                                        key={stage.id}
                                        className={`${styles.stageTag} ${stage.isGoal ? styles.goalStage : ''} ${stage.isAutoCreated ? styles.aiStage : ''}`}
                                    >
                                        {stage.isAutoCreated && '🤖 '}
                                        {stage.name}
                                    </span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Pipeline Modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Create AI Pipeline</h2>
                            <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className="form-group">
                                <label className="form-label">Pipeline Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Facebook Leads, Instagram DMs"
                                    value={newPipelineName}
                                    onChange={e => setNewPipelineName(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">What's Your Goal?</label>
                                <p className={styles.formHint}>
                                    AI will track leads until they reach this goal
                                </p>
                                <div className={styles.goalGrid}>
                                    {GOAL_PRESETS.map(goal => (
                                        <button
                                            key={goal.id}
                                            className={`${styles.goalOption} ${selectedGoal === goal.id ? styles.selected : ''}`}
                                            onClick={() => setSelectedGoal(goal.id)}
                                        >
                                            <span className={styles.goalIcon}>{goal.icon}</span>
                                            <span className={styles.goalName}>{goal.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedGoal === 'custom' && (
                                <div className="form-group">
                                    <label className="form-label">Custom Goal Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., Contract Signed, Free Trial Started"
                                        value={customGoal}
                                        onChange={e => setCustomGoal(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className={styles.previewSection}>
                                <label className="form-label">Pipeline Preview</label>
                                <div className={styles.pipelinePreview}>
                                    <div className={styles.previewStage}>
                                        <div className={styles.stageNode}>New Lead</div>
                                    </div>
                                    <div className={styles.previewArrow}>
                                        <span>AI adds stages here</span>
                                        <svg width="40" height="20" viewBox="0 0 40 20">
                                            <path d="M0 10 L30 10 M25 5 L30 10 L25 15" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 2" />
                                        </svg>
                                    </div>
                                    <div className={`${styles.previewStage} ${styles.goalPreview}`}>
                                        <div className={styles.stageNode}>
                                            {selectedGoal === 'custom'
                                                ? (customGoal || 'Your Goal')
                                                : (GOAL_PRESETS.find(g => g.id === selectedGoal)?.name || 'Select a Goal')
                                            }
                                            <span className={styles.goalBadge}>✓ Goal</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreatePipeline}
                                disabled={!newPipelineName || !selectedGoal || (selectedGoal === 'custom' && !customGoal) || isCreating}
                            >
                                {isCreating ? 'Creating...' : '🤖 Create AI Pipeline'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fetch Contacts Modal */}
            {showFetchModal && (
                <div className={styles.modalOverlay} onClick={() => setShowFetchModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className={styles.modalHeader}>
                            <h2>📱 Messenger Contacts ({fetchedContacts.length})</h2>
                            <button className={styles.closeBtn} onClick={() => setShowFetchModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.modalBody} style={{ maxHeight: '400px', overflow: 'auto' }}>
                            {fetchedContacts.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No conversations found on this page.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {fetchedContacts.map(contact => (
                                        <div
                                            key={contact.conversationId}
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                padding: 'var(--spacing-md)',
                                                borderRadius: 'var(--radius-lg)',
                                                border: '1px solid var(--border-primary)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <strong>{contact.name}</strong>
                                                    {contact.isFromAd && (
                                                        <span style={{
                                                            marginLeft: '8px',
                                                            background: 'var(--accent-gradient)',
                                                            color: 'white',
                                                            padding: '2px 8px',
                                                            borderRadius: '20px',
                                                            fontSize: '0.7rem'
                                                        }}>📣 From Ad</span>
                                                    )}
                                                </div>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                    {contact.messageCount} messages
                                                </span>
                                            </div>
                                            {contact.lastMessage && (
                                                <p style={{
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.85rem',
                                                    marginTop: '4px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    "{contact.lastMessage}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowFetchModal(false)}
                            >
                                Cancel
                            </button>
                            {pipelines.length > 0 ? (
                                <select
                                    className="form-select"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleImportContacts(fetchedContacts, e.target.value, 'new-lead');
                                        }
                                    }}
                                    defaultValue=""
                                    style={{ width: 'auto' }}
                                >
                                    <option value="">Import to Pipeline...</option>
                                    {pipelines.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleImportContacts(fetchedContacts)}
                                >
                                    💾 Import {fetchedContacts.length} Contacts
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
