'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './admin.css';

interface User {
    id: string;
    full_name: string;
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

export default function AdminDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'logs'>('users');

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
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
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

    const pendingRequests = requests.filter(r => r.status === 'pending');

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h1>🛡️ Admin Dashboard</h1>
                <p>Manage users, access requests, and organization settings</p>
            </div>

            <div className="admin-tabs">
                <button
                    className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users ({users.length})
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
                            <p className="no-data">No users found</p>
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
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
