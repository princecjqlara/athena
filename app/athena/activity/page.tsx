'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AgentRun {
    id: string;
    org_id: string;
    user_id: string;
    trigger_type: string;
    input_query: string;
    steps_json: { step: string; reasoning: string; tool?: string }[];
    tools_used: string[];
    total_duration_ms: number;
    recommendations_generated: number;
    final_output: string;
    status: 'completed' | 'failed' | 'running';
    error_message?: string;
    prompt_version?: string;
    model_version?: string;
    created_at: string;
    completed_at?: string;
}

export default function ActivityPage() {
    const [runs, setRuns] = useState<AgentRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [triggerFilter, setTriggerFilter] = useState<string>('all');
    const [expandedRun, setExpandedRun] = useState<string | null>(null);

    useEffect(() => {
        loadRuns();
    }, []);

    const loadRuns = async () => {
        try {
            const response = await fetch('/api/ai/agent/runs');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setRuns(data.runs || []);
                }
            }
        } catch (error) {
            console.error('Failed to load agent runs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return '#10b981';
            case 'failed': return '#ef4444';
            case 'running': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return '✓';
            case 'failed': return '✗';
            case 'running': return '⏳';
            default: return '•';
        }
    };

    const getTriggerIcon = (trigger: string) => {
        switch (trigger) {
            case 'user_query': return '💬';
            case 'scheduled': return '🕐';
            case 'webhook': return '🔗';
            case 'auto': return '🤖';
            default: return '▶';
        }
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    };

    const filteredRuns = runs.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (triggerFilter !== 'all' && r.trigger_type !== triggerFilter) return false;
        return true;
    });

    const triggerTypes = [...new Set(runs.map(r => r.trigger_type))];

    return (
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Link href="/athena" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: 'var(--spacing-sm)', display: 'inline-block' }}>
                    ← Back to Athena
                </Link>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    🤖 Agent Activity
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    View the history of AI agent runs and their reasoning chains
                </p>
            </header>

            {/* Stats Overview */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-lg)'
            }}>
                <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{runs.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Runs</div>
                </div>
                <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                        {runs.filter(r => r.status === 'completed').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed</div>
                </div>
                <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                        {runs.filter(r => r.status === 'failed').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Failed</div>
                </div>
                <div className="glass-card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>
                        {runs.reduce((sum, r) => sum + (r.recommendations_generated || 0), 0)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recommendations</div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">All</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="running">Running</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>Trigger</label>
                    <select
                        value={triggerFilter}
                        onChange={(e) => setTriggerFilter(e.target.value)}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">All Triggers</option>
                        {triggerTypes.map(type => (
                            <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
                    <button onClick={loadRuns} className="btn btn-secondary" style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                    Loading agent activity...
                </div>
            ) : filteredRuns.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🤖</div>
                    <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No Agent Runs Yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-lg)' }}>
                        Agent runs will appear here as you interact with Athena AI.
                    </p>
                    <Link href="/" className="btn btn-primary">
                        Start Chatting with Athena
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {filteredRuns.map(run => (
                        <div key={run.id} className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                            <div
                                style={{ cursor: 'pointer' }}
                                onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                            <span style={{
                                                fontSize: '1rem',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                background: `${getStatusColor(run.status)}20`,
                                                color: getStatusColor(run.status),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {getStatusIcon(run.status)}
                                            </span>
                                            <span style={{ fontSize: '1rem' }}>{getTriggerIcon(run.trigger_type)}</span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: `${getStatusColor(run.status)}20`,
                                                color: getStatusColor(run.status),
                                                fontWeight: 600,
                                                textTransform: 'uppercase'
                                            }}>
                                                {run.status}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '1rem', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {run.input_query || 'No input query'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                            {formatDuration(run.total_duration_ms || 0)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duration</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    <span>📅 {new Date(run.created_at).toLocaleString()}</span>
                                    {run.tools_used && run.tools_used.length > 0 && (
                                        <span>🔧 {run.tools_used.length} tool{run.tools_used.length !== 1 ? 's' : ''}</span>
                                    )}
                                    {run.recommendations_generated > 0 && (
                                        <span>💡 {run.recommendations_generated} recommendation{run.recommendations_generated !== 1 ? 's' : ''}</span>
                                    )}
                                    <span style={{ marginLeft: 'auto' }}>
                                        {expandedRun === run.id ? '▲ Collapse' : '▼ Expand'}
                                    </span>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedRun === run.id && (
                                <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--border)', paddingTop: 'var(--spacing-lg)' }}>
                                    {/* Full Query */}
                                    {run.input_query && (
                                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Input Query</div>
                                            <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                                                {run.input_query}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tools Used */}
                                    {run.tools_used && run.tools_used.length > 0 && (
                                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Tools Used</div>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                                {run.tools_used.map((tool, i) => (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            padding: '4px 12px',
                                                            background: 'var(--bg-tertiary)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '0.75rem',
                                                            fontFamily: 'monospace'
                                                        }}
                                                    >
                                                        {tool}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Reasoning Steps */}
                                    {run.steps_json && run.steps_json.length > 0 && (
                                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Reasoning Chain</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                                {run.steps_json.map((step, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            display: 'flex',
                                                            gap: 'var(--spacing-md)',
                                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                                            background: 'var(--bg-tertiary)',
                                                            borderRadius: 'var(--radius-md)',
                                                            borderLeft: '3px solid #8b5cf6'
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 600, color: '#8b5cf6', minWidth: '24px' }}>{i + 1}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 500 }}>{step.step}</div>
                                                            {step.reasoning && (
                                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                                    {step.reasoning}
                                                                </div>
                                                            )}
                                                            {step.tool && (
                                                                <span style={{
                                                                    fontSize: '0.75rem',
                                                                    background: '#8b5cf620',
                                                                    color: '#8b5cf6',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    marginTop: '4px',
                                                                    display: 'inline-block'
                                                                }}>
                                                                    🔧 {step.tool}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Final Output */}
                                    {run.final_output && (
                                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>Final Output</div>
                                            <div style={{
                                                background: 'var(--bg-tertiary)',
                                                padding: 'var(--spacing-md)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: '0.875rem',
                                                maxHeight: '200px',
                                                overflow: 'auto'
                                            }}>
                                                {run.final_output}
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {run.error_message && (
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: '#ef444420',
                                            borderRadius: 'var(--radius-md)',
                                            borderLeft: '3px solid #ef4444'
                                        }}>
                                            <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 'var(--spacing-xs)' }}>Error</div>
                                            <div style={{ fontSize: '0.875rem' }}>{run.error_message}</div>
                                        </div>
                                    )}

                                    {/* Metadata */}
                                    <div style={{
                                        display: 'flex',
                                        gap: 'var(--spacing-lg)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        marginTop: 'var(--spacing-md)',
                                        paddingTop: 'var(--spacing-md)',
                                        borderTop: '1px solid var(--border)'
                                    }}>
                                        <span>ID: {run.id.slice(0, 8)}...</span>
                                        {run.prompt_version && <span>Prompt: {run.prompt_version}</span>}
                                        {run.model_version && <span>Model: {run.model_version}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
