'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './admin.css';

interface User {
    id: string;
    full_name: string;
    email?: string;
    role: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
}

interface AccessRequest {
    id: string;
    user_id: string;
    requested_role: string;
    status: string;
    created_at: string;
}

interface InviteCode {
    id: string;
    code: string;
    code_type: string;
    is_used: boolean;
    used_by?: string;
    expires_at: string;
    created_at: string;
}

export default function AdminDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'invites' | 'logs'>('users');

    // Invite code generation state
    const [selectedRole, setSelectedRole] = useState<'marketer' | 'client'>('marketer');
    const [generatedCode, setGeneratedCode] = useState<string>('');
    const [codeExpiry, setCodeExpiry] = useState<string>('');
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, requestsRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/requests'),
            ]);

            if (usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(usersData.data || []);
            }

            if (requestsRes.ok) {
                const requestsData = await requestsRes.json();
                setRequests(requestsData.data || []);
            }

            // Fetch invite codes
            await fetchInviteCodes();
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInviteCodes = async () => {
        try {
            const res = await fetch('/api/invite-codes', {
                headers: {
                    'x-user-role': 'admin',
                    'x-user-id': localStorage.getItem('athena_user_id') || '',
                }
            });
            if (res.ok) {
                const data = await res.json();
                setInviteCodes(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching invite codes:', error);
        }
    };

    const handleStatusChange = async (userId: string, newStatus: string) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: newStatus }),
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    };

    const handleRequestAction = async (requestId: string, action: 'approve' | 'deny') => {
        try {
            const res = await fetch('/api/admin/requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action }),
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error processing request:', error);
        }
    };

    const generateInviteCode = async () => {
        setGenerating(true);
        setGeneratedCode('');
        setCopied(false);

        try {
            const res = await fetch('/api/invite-codes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': 'admin',
                    'x-user-id': localStorage.getItem('athena_user_id') || '',
                },
                body: JSON.stringify({
                    roleType: selectedRole,
                    userRole: 'admin'
                }),
            });

            const data = await res.json();

            if (data.success && data.code) {
                setGeneratedCode(data.code);
                setCodeExpiry(data.expiresAt);
                // Refresh invite codes list
                await fetchInviteCodes();
            } else {
                console.error('Failed to generate code:', data.error);
            }
        } catch (error) {
            console.error('Error generating invite code:', error);
        } finally {
            setGenerating(false);
        }
    };

    const copyCode = async () => {
        if (generatedCode) {
            await navigator.clipboard.writeText(generatedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const deleteUser = async (userId: string, userName: string, userRole: string) => {
        // Admins can only delete marketers and clients
        if (userRole === 'admin' || userRole === 'organizer') {
            alert('Cannot delete admin or organizer users');
            return;
        }
        if (!confirm(`Are you sure you want to delete ${userName || 'this user'}? This action cannot be undone.`)) {
            return;
        }
        try {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();
            if (res.ok) {
                alert('User deleted successfully');
                fetchData();
            } else {
                alert(data.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user');
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const activeInviteCodes = inviteCodes.filter(c => !c.is_used && new Date(c.expires_at) > new Date());

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h1>🛡️ Admin Dashboard</h1>
                <p>Manage users, invite team members, and organization settings</p>
            </div>

            <div className="admin-tabs">
                <button
                    className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users ({users.length})
                </button>
                <button
                    className={`tab ${activeTab === 'invites' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invites')}
                >
                    🎟️ Invite Codes {activeInviteCodes.length > 0 && <span className="badge">{activeInviteCodes.length}</span>}
                </button>
                <button
                    className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    📩 Requests {pendingRequests.length > 0 && <span className="badge">{pendingRequests.length}</span>}
                </button>
                <button
                    className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('logs')}
                >
                    📋 Audit Logs
                </button>
            </div>

            <div className="admin-content">
                {loading ? (
                    <div className="admin-loading">Loading...</div>
                ) : activeTab === 'users' ? (
                    <div className="users-list">
                        <h2>Organization Users</h2>
                        {users.length === 0 ? (
                            <div className="no-data">
                                <p>No users found</p>
                                <p className="hint">Generate invite codes to add team members</p>
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Last Login</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td>{user.full_name || 'Unknown'}</td>
                                            <td>
                                                <span className={`role-badge ${user.role}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${user.status}`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td>
                                                {user.last_login_at
                                                    ? new Date(user.last_login_at).toLocaleDateString()
                                                    : 'Never'}
                                            </td>
                                            <td className="actions">
                                                {user.status === 'pending' && (
                                                    <button
                                                        className="btn-activate"
                                                        onClick={() => handleStatusChange(user.id, 'active')}
                                                    >
                                                        Activate
                                                    </button>
                                                )}
                                                {user.status === 'active' && (
                                                    <button
                                                        className="btn-suspend"
                                                        onClick={() => handleStatusChange(user.id, 'suspended')}
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                {user.status === 'suspended' && (
                                                    <button
                                                        className="btn-activate"
                                                        onClick={() => handleStatusChange(user.id, 'active')}
                                                    >
                                                        Reactivate
                                                    </button>
                                                )}
                                                {(user.role === 'marketer' || user.role === 'client') && (
                                                    <button
                                                        className="btn-delete"
                                                        onClick={() => deleteUser(user.id, user.full_name, user.role)}
                                                        style={{
                                                            marginLeft: '8px',
                                                            padding: '6px 12px',
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            borderRadius: '6px',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : activeTab === 'invites' ? (
                    <div className="invites-section">
                        <h2>Invite Team Members</h2>
                        <p className="section-desc">Generate invite codes for marketers and clients to join your organization</p>

                        <div className="invite-generator">
                            <div className="role-selector">
                                <label>Select Role:</label>
                                <div className="role-options">
                                    <button
                                        className={`role-option ${selectedRole === 'marketer' ? 'selected' : ''}`}
                                        onClick={() => setSelectedRole('marketer')}
                                    >
                                        <span className="role-icon">📊</span>
                                        <span className="role-name">Marketer</span>
                                        <span className="role-desc">Full access to ads, predictions, pipelines</span>
                                    </button>
                                    <button
                                        className={`role-option ${selectedRole === 'client' ? 'selected' : ''}`}
                                        onClick={() => setSelectedRole('client')}
                                    >
                                        <span className="role-icon">👤</span>
                                        <span className="role-name">Client</span>
                                        <span className="role-desc">View pipelines and analytics only</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                className="generate-btn"
                                onClick={generateInviteCode}
                                disabled={generating}
                            >
                                {generating ? 'Generating...' : `Generate ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Invite Code`}
                            </button>

                            {generatedCode && (
                                <div className="generated-code">
                                    <div className="code-display">
                                        <span className="code">{generatedCode}</span>
                                        <button className="copy-btn" onClick={copyCode}>
                                            {copied ? '✓ Copied!' : '📋 Copy'}
                                        </button>
                                    </div>
                                    <p className="code-expiry">
                                        Expires: {new Date(codeExpiry).toLocaleString()}
                                    </p>
                                    <p className="code-instructions">
                                        Share this code with your {selectedRole}. They'll use it during signup.
                                    </p>
                                </div>
                            )}
                        </div>

                        {activeInviteCodes.length > 0 && (
                            <div className="active-codes">
                                <h3>Active Invite Codes</h3>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>Role</th>
                                            <th>Expires</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeInviteCodes.map(code => (
                                            <tr key={code.id}>
                                                <td className="code-cell">{code.code}</td>
                                                <td>
                                                    <span className={`role-badge ${code.code_type}`}>
                                                        {code.code_type}
                                                    </span>
                                                </td>
                                                <td>{new Date(code.expires_at).toLocaleString()}</td>
                                                <td>
                                                    <span className="status-badge active">Available</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'requests' ? (
                    <div className="requests-list">
                        <h2>Access Requests</h2>
                        {pendingRequests.length === 0 ? (
                            <p className="no-data">No pending requests</p>
                        ) : (
                            <div className="request-cards">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="request-card">
                                        <div className="request-info">
                                            <span className="request-user">User ID: {req.user_id.slice(0, 8)}...</span>
                                            <span className="request-role">Requested: {req.requested_role}</span>
                                            <span className="request-date">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="request-actions">
                                            <button
                                                className="btn-approve"
                                                onClick={() => handleRequestAction(req.id, 'approve')}
                                            >
                                                ✓ Approve
                                            </button>
                                            <button
                                                className="btn-deny"
                                                onClick={() => handleRequestAction(req.id, 'deny')}
                                            >
                                                ✗ Deny
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="audit-logs">
                        <h2>Audit Logs</h2>
                        <p className="no-data">Audit logs will be displayed here (coming soon)</p>
                    </div>
                )}
            </div>

            <div className="admin-footer">
                <Link href="/" className="back-link">← Back to Dashboard</Link>
            </div>
        </div>
    );
}

