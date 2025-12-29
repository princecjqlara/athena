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
    const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'galaxy' | 'marketplace' | 'prompts' | 'traits' | 'ai-traits' | 'messages'>('users');
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

    // AI-generated traits state (from public_traits table)
    const [aiTraits, setAiTraits] = useState<Array<{
        id: string;
        name: string;
        group_name: string;
        emoji: string;
        description: string;
        created_by_ai: boolean;
        status: string;
        created_at: string;
    }>>([]);

    // Messaging state
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
    const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
    const [showSendMessage, setShowSendMessage] = useState(false);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', targetAudience: 'all', priority: 'normal' });
    const [newMessage, setNewMessage] = useState({ toUserId: '', subject: '', content: '' });
    const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);

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
        if (activeTab === 'ai-traits') {
            fetchAiTraits();
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

    const deleteTrait = async (id: string) => {
        if (!confirm('Delete this learned trait?')) return;
        try {
            await fetch(`/api/ai/learned-traits?id=${id}`, { method: 'DELETE' });
            fetchLearnedTraits();
        } catch (error) {
            console.error('Error deleting trait:', error);
        }
    };

    // AI-Generated Traits Functions (from public_traits table)
    const fetchAiTraits = async () => {
        try {
            const res = await fetch('/api/traits?includeAll=true');
            if (res.ok) {
                const data = await res.json();
                setAiTraits(data.traits || []);
            }
        } catch (error) {
            console.error('Error fetching AI traits:', error);
        }
    };

    const moderateTrait = async (id: string, status: 'approved' | 'rejected') => {
        try {
            const userId = localStorage.getItem('athena_user_id');
            const res = await fetch('/api/traits', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, reviewedBy: userId })
            });
            if (res.ok) {
                fetchAiTraits();
            }
        } catch (error) {
            console.error('Error moderating trait:', error);
        }
    };

    const deleteAiTrait = async (id: string) => {
        if (!confirm('Delete this AI-generated trait permanently?')) return;
        try {
            await fetch(`/api/traits?id=${id}`, { method: 'DELETE' });
            fetchAiTraits();
        } catch (error) {
            console.error('Error deleting AI trait:', error);
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
                body: JSON.stringify({ roleType: selectedCodeRole })
            });
            const data = await res.json();
            console.log('Invite code response:', data);

            if (data.success && data.code) {
                setInviteCode(data.code);
                setGeneratedCodeType(data.codeType || selectedCodeRole);
            } else if (data.code) {
                // Handle case where success might not be set but code is returned
                setInviteCode(data.code);
                setGeneratedCodeType(data.codeType || selectedCodeRole);
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
                    <button
                        onClick={generateInviteCode}
                        className="generate-btn"
                        disabled={isGeneratingCode}
                        style={{ opacity: isGeneratingCode ? 0.7 : 1 }}
                    >
                        {isGeneratingCode ? 'Generating...' : 'Generate Code'}
                    </button>
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
                >
                    🧬 Traits
                </button>
                <button
                    className={`tab ${activeTab === 'ai-traits' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai-traits')}
                >
                    🤖 AI Traits
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
                            <button
                                className="create-btn"
                                onClick={() => setShowAddTrait(!showAddTrait)}
                                style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
                            >
                                {showAddTrait ? '✕ Cancel' : '+ Add Trait'}
                            </button>
                        </div>

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

                {activeTab === 'ai-traits' && (
                    <div className="ai-traits-panel">
                        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2>🤖 AI-Generated Traits</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                                    Review and moderate traits created by AI. Approve to make public, reject to hide.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '0.85rem', color: '#f59e0b' }}>
                                    ⏳ Pending: {aiTraits.filter(t => t.status === 'pending').length}
                                </span>
                                <span style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.2)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--success)' }}>
                                    ✅ Approved: {aiTraits.filter(t => t.status === 'approved').length}
                                </span>
                            </div>
                        </div>

                        {/* Pending Traits Section */}
                        {aiTraits.filter(t => t.status === 'pending').length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#f59e0b' }}>⏳ Pending Review</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {aiTraits.filter(t => t.status === 'pending').map(trait => (
                                        <div key={trait.id} style={{
                                            padding: '16px',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            border: '2px solid rgba(245,158,11,0.3)',
                                            animation: 'pulse 2s infinite'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '1.2rem' }}>{trait.emoji}</span>
                                                        <strong>{trait.name}</strong>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(139,92,246,0.2)', borderRadius: '12px', color: '#8B5CF6' }}>
                                                            {trait.group_name}
                                                        </span>
                                                        {trait.created_by_ai && (
                                                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(59,130,246,0.2)', borderRadius: '12px', color: '#3b82f6' }}>
                                                                🤖 AI Generated
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                        {trait.description}
                                                    </p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => moderateTrait(trait.id, 'approved')}
                                                        style={{ background: 'var(--success)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: '600' }}
                                                    >
                                                        ✓ Approve
                                                    </button>
                                                    <button
                                                        onClick={() => moderateTrait(trait.id, 'rejected')}
                                                        style={{ background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px' }}
                                                    >
                                                        ✕ Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Approved Traits Section */}
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--success)' }}>✅ Approved Traits</h3>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {aiTraits.filter(t => t.status === 'approved').length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                        No approved traits yet
                                    </div>
                                ) : (
                                    aiTraits.filter(t => t.status === 'approved').map(trait => (
                                        <div key={trait.id} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '1.2rem' }}>{trait.emoji}</span>
                                                        <strong>{trait.name}</strong>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(139,92,246,0.2)', borderRadius: '12px', color: '#8B5CF6' }}>
                                                            {trait.group_name}
                                                        </span>
                                                        {trait.created_by_ai && (
                                                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(59,130,246,0.2)', borderRadius: '12px', color: '#3b82f6' }}>
                                                                🤖 AI Generated
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                        {trait.description}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => deleteAiTrait(trait.id)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px' }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Rejected Traits Section */}
                        {aiTraits.filter(t => t.status === 'rejected').length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>❌ Rejected Traits</h3>
                                <div style={{ display: 'grid', gap: '12px', opacity: 0.6 }}>
                                    {aiTraits.filter(t => t.status === 'rejected').map(trait => (
                                        <div key={trait.id} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '1.2rem' }}>{trait.emoji}</span>
                                                        <strong style={{ textDecoration: 'line-through' }}>{trait.name}</strong>
                                                        {trait.created_by_ai && (
                                                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(59,130,246,0.2)', borderRadius: '12px', color: '#3b82f6' }}>
                                                                🤖 AI Generated
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => moderateTrait(trait.id, 'approved')}
                                                        style={{ background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)', cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                                                    >
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => deleteAiTrait(trait.id)}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
