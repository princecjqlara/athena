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

export default function OrganizerDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<TeamStats[]>([]);
    const [pools, setPools] = useState<DataPool[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState<ImpersonationSession | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'galaxy' | 'marketplace' | 'prompts'>('users');
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

    const generateInviteCode = async () => {
        try {
            const res = await fetch('/api/invite-codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleType: selectedCodeRole })
            });
            const data = await res.json();
            if (data.success) {
                setInviteCode(data.code);
                setGeneratedCodeType(data.codeType);
            }
        } catch (error) {
            console.error('Error generating code:', error);
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


            {/* Invite Code Generator */}
            <div className="code-generator">
                <h3>Generate Invite Codes</h3>
                <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '12px' }}>
                    Create invite codes for new users. Select the role to assign.
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={selectedCodeRole}
                        onChange={(e) => setSelectedCodeRole(e.target.value as 'admin' | 'marketer' | 'client')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: 'var(--bg-secondary, #1a1a2e)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'inherit',
                            fontSize: '0.95rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="admin" style={{ background: 'var(--bg-secondary, #1a1a2e)', color: 'inherit' }}>Admin (can create marketers)</option>
                        <option value="marketer" style={{ background: 'var(--bg-secondary, #1a1a2e)', color: 'inherit' }}>Marketer (can create clients)</option>
                        <option value="client" style={{ background: 'var(--bg-secondary, #1a1a2e)', color: 'inherit' }}>Client (end user)</option>
                    </select>
                    <button onClick={generateInviteCode} className="generate-btn">
                        Generate Code
                    </button>
                </div>
                {inviteCode && (
                    <div className="code-display" style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <code style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{inviteCode}</code>
                            <span style={{
                                background: generatedCodeType === 'admin' ? '#8b5cf6' :
                                    generatedCodeType === 'marketer' ? '#3b82f6' : '#10b981',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                            }}>
                                {generatedCodeType}
                            </span>
                        </div>
                        <span className="code-timer">Expires in 10 minutes</span>
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
                                                    {user.role}
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
                                            placeholder="e.g., TikTok UGC Analyzer"
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
                                            {!prompt.isDefault && (
                                                <button
                                                    onClick={() => deletePrompt(prompt.id)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px' }}
                                                >
                                                    🗑️
                                                </button>
                                            )}
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
                                            placeholder="e.g., TikTok UGC for Gen Z E-commerce"
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
                                                <option value="tiktok">TikTok</option>
                                                <option value="youtube">YouTube</option>
                                                <option value="multi">Multi-platform</option>
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
            </div>

            <div className="footer">
                <Link href="/" className="back-link">← Back to Dashboard</Link>
            </div>
        </div>
    );
}
