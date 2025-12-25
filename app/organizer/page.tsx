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

export default function OrganizerDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<TeamStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState<ImpersonationSession | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'galaxy'>('users');
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
        checkImpersonation();
    }, []);

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

    const generateAdminCode = async () => {
        try {
            const res = await fetch('/api/invite-codes', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setInviteCode(data.code);
            }
        } catch (error) {
            console.error('Error generating code:', error);
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
                    <span className="stat-value">{totalDataSize}</span>
                    <span className="stat-label">Total Ads</span>
                </div>
            </div>

            {/* Admin Code Generator */}
            <div className="code-generator">
                <h3>Generate Admin Invite Code</h3>
                <button onClick={generateAdminCode} className="generate-btn">
                    🔑 Generate Code
                </button>
                {inviteCode && (
                    <div className="code-display">
                        <code>{inviteCode}</code>
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
                    className={`tab ${activeTab === 'galaxy' ? 'active' : ''}`}
                    onClick={() => setActiveTab('galaxy')}
                >
                    🌌 Collective Galaxy
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
                        <h2>🌌 Collective Intelligence Galaxy</h2>
                        <p className="galaxy-desc">
                            View aggregated, anonymized insights from all public data contributions.
                        </p>
                        <Link href="/settings/collective" className="galaxy-link">
                            View Collective Intelligence →
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
            </div>

            <div className="footer">
                <Link href="/" className="back-link">← Back to Dashboard</Link>
            </div>
        </div>
    );
}
