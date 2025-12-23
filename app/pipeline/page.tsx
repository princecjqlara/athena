'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

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

    // Load pipelines from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('pipelines');
        if (saved) {
            setPipelines(JSON.parse(saved));
        }
    }, []);

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
            </header>

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
        </div>
    );
}
