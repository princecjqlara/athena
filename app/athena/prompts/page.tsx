'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PromptVersion {
    id: string;
    prompt_name: string;
    version: string;
    prompt_text: string;
    tool_definitions?: Record<string, unknown>;
    is_active: boolean;
    is_default: boolean;
    total_runs: number;
    avg_confidence: number;
    avg_accept_rate: number;
    avg_positive_outcome_rate: number;
    created_by?: string;
    created_at: string;
}

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<PromptVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeOnly, setActiveOnly] = useState(false);
    const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newPrompt, setNewPrompt] = useState({
        promptName: '',
        version: '',
        promptText: '',
        setAsDefault: false
    });

    useEffect(() => {
        loadPrompts();
    }, [activeOnly]);

    const loadPrompts = async () => {
        try {
            const url = activeOnly ? '/api/ai/prompts?activeOnly=true' : '/api/ai/prompts';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setPrompts(data.prompts || []);
                }
            }
        } catch (error) {
            console.error('Failed to load prompts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            const response = await fetch('/api/ai/prompts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !isActive })
            });
            if (response.ok) {
                setPrompts(prev =>
                    prev.map(p => p.id === id ? { ...p, is_active: !isActive } : p)
                );
            }
        } catch (error) {
            console.error('Failed to toggle prompt active state:', error);
        }
    };

    const setAsDefault = async (id: string, promptName: string) => {
        try {
            const response = await fetch('/api/ai/prompts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isDefault: true })
            });
            if (response.ok) {
                setPrompts(prev =>
                    prev.map(p => ({
                        ...p,
                        is_default: p.id === id ? true : (p.prompt_name === promptName ? false : p.is_default)
                    }))
                );
            }
        } catch (error) {
            console.error('Failed to set prompt as default:', error);
        }
    };

    const createPrompt = async () => {
        if (!newPrompt.promptName || !newPrompt.version || !newPrompt.promptText) return;

        try {
            const response = await fetch('/api/ai/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPrompt)
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setPrompts(prev => [data.prompt, ...prev]);
                    setIsCreating(false);
                    setNewPrompt({ promptName: '', version: '', promptText: '', setAsDefault: false });
                }
            }
        } catch (error) {
            console.error('Failed to create prompt:', error);
        }
    };

    const getPerformanceColor = (value: number) => {
        if (value >= 0.8) return '#10b981';
        if (value >= 0.6) return '#f59e0b';
        return '#ef4444';
    };

    const promptGroups = prompts.reduce((groups, prompt) => {
        const name = prompt.prompt_name;
        if (!groups[name]) groups[name] = [];
        groups[name].push(prompt);
        return groups;
    }, {} as Record<string, PromptVersion[]>);

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Link href="/athena" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: 'var(--spacing-sm)', display: 'inline-block' }}>
                    ← Back to Athena
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            📝 Prompt Versions
                        </h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Manage and A/B test AI prompt configurations
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="btn btn-primary"
                    >
                        + New Prompt Version
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={activeOnly}
                        onChange={(e) => setActiveOnly(e.target.checked)}
                        style={{ width: '18px', height: '18px' }}
                    />
                    <span>Active only</span>
                </label>
                <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {prompts.length} prompt version{prompts.length !== 1 ? 's' : ''} in {Object.keys(promptGroups).length} group{Object.keys(promptGroups).length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Create New Prompt Modal */}
            {isCreating && (
                <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Create New Prompt Version</h3>
                    <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                                    Prompt Name
                                </label>
                                <input
                                    type="text"
                                    value={newPrompt.promptName}
                                    onChange={(e) => setNewPrompt(prev => ({ ...prev, promptName: e.target.value }))}
                                    placeholder="e.g., athena_agent, recommendation_generator"
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                                    Version
                                </label>
                                <input
                                    type="text"
                                    value={newPrompt.version}
                                    onChange={(e) => setNewPrompt(prev => ({ ...prev, version: e.target.value }))}
                                    placeholder="e.g., 1.0.0, 2.1.0-beta"
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                                Prompt Text
                            </label>
                            <textarea
                                value={newPrompt.promptText}
                                onChange={(e) => setNewPrompt(prev => ({ ...prev, promptText: e.target.value }))}
                                placeholder="Enter the prompt text..."
                                rows={8}
                                style={{
                                    width: '100%',
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={newPrompt.setAsDefault}
                                onChange={(e) => setNewPrompt(prev => ({ ...prev, setAsDefault: e.target.checked }))}
                                style={{ width: '18px', height: '18px' }}
                            />
                            <span>Set as default for this prompt name</span>
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                            <button onClick={() => setIsCreating(false)} className="btn btn-ghost">
                                Cancel
                            </button>
                            <button
                                onClick={createPrompt}
                                disabled={!newPrompt.promptName || !newPrompt.version || !newPrompt.promptText}
                                className="btn btn-primary"
                            >
                                Create Prompt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                    Loading prompts...
                </div>
            ) : prompts.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>📝</div>
                    <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No Prompts Yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-lg)' }}>
                        Create your first prompt version to start A/B testing AI configurations.
                    </p>
                    <button onClick={() => setIsCreating(true)} className="btn btn-primary">
                        Create First Prompt
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                    {Object.entries(promptGroups).map(([name, versions]) => (
                        <div key={name}>
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                marginBottom: 'var(--spacing-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)'
                            }}>
                                <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{name}</span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 8px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-muted)'
                                }}>
                                    {versions.length} version{versions.length !== 1 ? 's' : ''}
                                </span>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                {versions.map(prompt => (
                                    <div key={prompt.id} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>v{prompt.version}</span>
                                                    {prompt.is_default && (
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            padding: '2px 8px',
                                                            background: '#10b98120',
                                                            color: '#10b981',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontWeight: 600
                                                        }}>
                                                            DEFAULT
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        padding: '2px 8px',
                                                        background: prompt.is_active ? '#3b82f620' : '#6b728020',
                                                        color: prompt.is_active ? '#3b82f6' : '#6b7280',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontWeight: 600
                                                    }}>
                                                        {prompt.is_active ? 'ACTIVE' : 'INACTIVE'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                    Created: {new Date(prompt.created_at).toLocaleDateString()}
                                                    {prompt.created_by && ` by ${prompt.created_by}`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    onClick={() => toggleActive(prompt.id, prompt.is_active)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                                                >
                                                    {prompt.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                {!prompt.is_default && prompt.is_active && (
                                                    <button
                                                        onClick={() => setAsDefault(prompt.id, prompt.prompt_name)}
                                                        className="btn btn-secondary"
                                                        style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
                                                    >
                                                        Set Default
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Performance Stats */}
                                        {(prompt.total_runs > 0) && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, 1fr)',
                                                gap: 'var(--spacing-md)',
                                                padding: 'var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                marginBottom: 'var(--spacing-md)'
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{prompt.total_runs}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Runs</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: getPerformanceColor(prompt.avg_confidence) }}>
                                                        {Math.round((prompt.avg_confidence || 0) * 100)}%
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Confidence</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: getPerformanceColor(prompt.avg_accept_rate) }}>
                                                        {Math.round((prompt.avg_accept_rate || 0) * 100)}%
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accept Rate</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: getPerformanceColor(prompt.avg_positive_outcome_rate) }}>
                                                        {Math.round((prompt.avg_positive_outcome_rate || 0) * 100)}%
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Positive Outcomes</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Prompt Text Preview */}
                                        <div
                                            onClick={() => setExpandedPrompt(expandedPrompt === prompt.id ? null : prompt.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)' }}>
                                                Prompt Text {expandedPrompt === prompt.id ? '▲' : '▼'}
                                            </div>
                                            <div style={{
                                                background: 'var(--bg-secondary)',
                                                padding: 'var(--spacing-md)',
                                                borderRadius: 'var(--radius-md)',
                                                fontFamily: 'monospace',
                                                fontSize: '0.875rem',
                                                maxHeight: expandedPrompt === prompt.id ? 'none' : '100px',
                                                overflow: 'hidden',
                                                whiteSpace: 'pre-wrap',
                                                position: 'relative'
                                            }}>
                                                {prompt.prompt_text}
                                                {expandedPrompt !== prompt.id && prompt.prompt_text.length > 200 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: 0,
                                                        left: 0,
                                                        right: 0,
                                                        height: '40px',
                                                        background: 'linear-gradient(transparent, var(--bg-secondary))'
                                                    }} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
