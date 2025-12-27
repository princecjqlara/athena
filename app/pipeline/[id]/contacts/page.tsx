'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { contactsStore, adLinksStore, Contact, AdPipelineLink } from '@/lib/contacts-store';

interface Pipeline {
    id: string;
    name: string;
    goal: string;
    stages: { id: string; name: string; }[];
}

export default function ContactsPage() {
    const params = useParams();
    const router = useRouter();
    const [pipeline, setPipeline] = useState<Pipeline | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [adLinks, setAdLinks] = useState<AdPipelineLink[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'stage' | 'ad'>('stage');

    useEffect(() => {
        // Load pipeline
        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            const pipelines = JSON.parse(savedPipelines);
            const found = pipelines.find((p: Pipeline) => p.id === params.id);
            if (found) {
                setPipeline(found);
            }
        }

        // Load contacts and ad links
        setContacts(contactsStore.getByPipeline(params.id as string));
        setAdLinks(adLinksStore.getByPipeline(params.id as string));
    }, [params.id]);

    const getStageName = (stageId: string) => {
        return pipeline?.stages.find(s => s.id === stageId)?.name || 'Unknown Stage';
    };

    const getAdName = (adId: string) => {
        return adLinks.find(l => l.adId === adId)?.adName || 'Unknown Ad';
    };

    const handleAnalyzeConversation = async (contact: Contact) => {
        if (!contact.messages || contact.messages.length === 0) {
            alert('No messages to analyze');
            return;
        }

        setAnalyzingId(contact.id);

        try {
            const response = await fetch('/api/ai/analyze-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: contact.messages,
                    contactName: contact.name,
                    pipelineGoal: pipeline?.goal
                })
            });

            const result = await response.json();

            if (result.success && result.data) {
                // Update contact with AI analysis
                const updated = contactsStore.update(contact.id, {
                    aiAnalysis: {
                        ...result.data,
                        analyzedAt: new Date().toISOString()
                    }
                });

                if (updated) {
                    setContacts(contactsStore.getByPipeline(params.id as string));
                    setSelectedContact(updated);
                }
            } else {
                alert('Analysis failed: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Failed to analyze conversation');
        } finally {
            setAnalyzingId(null);
        }
    };

    const handleMoveContact = (contactId: string, newStageId: string) => {
        contactsStore.moveToStage(contactId, newStageId);
        setContacts(contactsStore.getByPipeline(params.id as string));
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

    const groupedContacts = () => {
        if (groupBy === 'stage') {
            const groups: Record<string, Contact[]> = {};
            pipeline?.stages.forEach(stage => {
                groups[stage.id] = contacts.filter(c => c.stageId === stage.id);
            });
            // Add ungrouped contacts
            groups['unassigned'] = contacts.filter(c => !c.stageId);
            return groups;
        } else {
            const groups: Record<string, Contact[]> = {};
            adLinks.forEach(link => {
                groups[link.adId] = contacts.filter(c => c.sourceAdId === link.adId);
            });
            // Add contacts without source ad
            groups['unknown'] = contacts.filter(c => !c.sourceAdId);
            return groups;
        }
    };

    if (!pipeline) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>Loading...</div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button className={styles.backBtn} onClick={() => router.push(`/pipeline/${params.id}`)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className={styles.title}>👥 Contacts</h1>
                        <p className={styles.subtitle}>
                            {pipeline.name} • {contacts.length} contacts
                        </p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.groupToggle}>
                        <button
                            className={`${styles.toggleBtn} ${groupBy === 'stage' ? styles.active : ''}`}
                            onClick={() => setGroupBy('stage')}
                        >
                            By Stage
                        </button>
                        <button
                            className={`${styles.toggleBtn} ${groupBy === 'ad' ? styles.active : ''}`}
                            onClick={() => setGroupBy('ad')}
                        >
                            By Ad
                        </button>
                    </div>
                </div>
            </header>

            {contacts.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>👥</div>
                    <h3>No Contacts Yet</h3>
                    <p>Contacts will appear here when leads come in from linked ads or webhooks.</p>
                    <Link href={`/pipeline/${params.id}`} className="btn btn-primary">
                        ← Back to Pipeline
                    </Link>
                </div>
            ) : (
                <div className={styles.content}>
                    {/* Contact Groups */}
                    <div className={styles.contactsPanel}>
                        {Object.entries(groupedContacts()).map(([groupId, groupContacts]) => {
                            if (groupContacts.length === 0 && groupId !== 'unassigned' && groupId !== 'unknown') return null;

                            return (
                                <div key={groupId} className={styles.group}>
                                    <div className={styles.groupHeader}>
                                        <h3>
                                            {groupBy === 'stage'
                                                ? (groupId === 'unassigned' ? 'Unassigned' : getStageName(groupId))
                                                : (groupId === 'unknown' ? 'Unknown Source' : `Ad: ${getAdName(groupId)}`)
                                            }
                                        </h3>
                                        <span className={styles.groupCount}>{groupContacts.length}</span>
                                    </div>

                                    <div className={styles.contactsList}>
                                        {groupContacts.map(contact => (
                                            <div
                                                key={contact.id}
                                                className={`${styles.contactCard} ${selectedContact?.id === contact.id ? styles.selected : ''}`}
                                                onClick={() => setSelectedContact(contact)}
                                            >
                                                <div className={styles.contactInfo}>
                                                    <div className={styles.contactName}>{contact.name}</div>
                                                    {contact.email && <div className={styles.contactDetail}>{contact.email}</div>}
                                                    {contact.phone && <div className={styles.contactDetail}>{contact.phone}</div>}
                                                </div>
                                                <div className={styles.contactMeta}>
                                                    {contact.messages?.length > 0 && (
                                                        <span className={styles.messageBadge}>
                                                            {contact.messages.length} msgs
                                                        </span>
                                                    )}
                                                    {contact.aiAnalysis && (
                                                        <span className={`${styles.scoreBadge} ${contact.aiAnalysis.leadScore >= 70 ? styles.high :
                                                            contact.aiAnalysis.leadScore >= 40 ? styles.medium : styles.low
                                                            }`}>
                                                            🎯 {contact.aiAnalysis.leadScore}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {groupContacts.length === 0 && (
                                            <div className={styles.emptyGroup}>No contacts</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detail Panel */}
                    {selectedContact && (
                        <div className={styles.detailPanel}>
                            <div className={styles.detailHeader}>
                                <h2>{selectedContact.name}</h2>
                                <button className={styles.closeDetail} onClick={() => setSelectedContact(null)}>×</button>
                            </div>

                            <div className={styles.detailBody}>
                                {/* Contact Info */}
                                <div className={styles.detailSection}>
                                    <h4>Contact Info</h4>
                                    {selectedContact.email && <p>{selectedContact.email}</p>}
                                    {selectedContact.phone && <p>{selectedContact.phone}</p>}
                                    <p>Created {getTimeAgo(selectedContact.createdAt)}</p>
                                    {selectedContact.sourceAdName && (
                                        <p>From: {selectedContact.sourceAdName}</p>
                                    )}
                                </div>

                                {/* Stage Selector */}
                                <div className={styles.detailSection}>
                                    <h4>Pipeline Stage</h4>
                                    <select
                                        className="form-input"
                                        value={selectedContact.stageId || ''}
                                        onChange={(e) => handleMoveContact(selectedContact.id, e.target.value)}
                                    >
                                        <option value="">Select Stage</option>
                                        {pipeline.stages.map(stage => (
                                            <option key={stage.id} value={stage.id}>{stage.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* AI Analysis */}
                                {selectedContact.aiAnalysis ? (
                                    <div className={styles.detailSection}>
                                        <h4>AI Analysis</h4>
                                        <div className={styles.aiResult}>
                                            <div className={styles.aiScore}>
                                                <span className={styles.scoreLabel}>Lead Score</span>
                                                <span className={`${styles.scoreValue} ${selectedContact.aiAnalysis.leadScore >= 70 ? styles.high :
                                                    selectedContact.aiAnalysis.leadScore >= 40 ? styles.medium : styles.low
                                                    }`}>
                                                    {selectedContact.aiAnalysis.leadScore}/100
                                                </span>
                                            </div>
                                            <div className={styles.aiDetail}>
                                                <strong>Sentiment:</strong> {selectedContact.aiAnalysis.sentiment}
                                            </div>
                                            <div className={styles.aiDetail}>
                                                <strong>Intent:</strong> {selectedContact.aiAnalysis.intent}
                                            </div>
                                            <div className={styles.aiDetail}>
                                                <strong>Summary:</strong> {selectedContact.aiAnalysis.summary}
                                            </div>
                                            {selectedContact.aiAnalysis.suggestedAction && (
                                                <div className={styles.aiSuggestion}>
                                                    💡 {selectedContact.aiAnalysis.suggestedAction}
                                                </div>
                                            )}
                                            <p className={styles.analyzedAt}>
                                                Analyzed {getTimeAgo(selectedContact.aiAnalysis.analyzedAt)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.detailSection}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleAnalyzeConversation(selectedContact)}
                                            disabled={analyzingId === selectedContact.id || !selectedContact.messages?.length}
                                        >
                                            {analyzingId === selectedContact.id ? 'Analyzing...' : 'Analyze Conversation'}
                                        </button>
                                        {!selectedContact.messages?.length && (
                                            <p className={styles.noMessages}>No messages to analyze yet</p>
                                        )}
                                    </div>
                                )}

                                {/* Messages */}
                                {selectedContact.messages && selectedContact.messages.length > 0 && (
                                    <div className={styles.detailSection}>
                                        <h4>Conversation ({selectedContact.messages.length} messages)</h4>
                                        <div className={styles.messages}>
                                            {selectedContact.messages.map(msg => (
                                                <div
                                                    key={msg.id}
                                                    className={`${styles.message} ${msg.direction === 'outbound' ? styles.outbound : styles.inbound}`}
                                                >
                                                    <div className={styles.messageContent}>{msg.content}</div>
                                                    <div className={styles.messageTime}>{getTimeAgo(msg.timestamp)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
