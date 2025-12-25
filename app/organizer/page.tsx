'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../admin/admin.css';

interface Organization {
    id: string;
    name: string;
    slug: string;
    user_count: number;
    created_at: string;
}

interface ImpersonationSession {
    userId: string;
    userName: string;
    startedAt: string;
}

export default function OrganizerDashboard() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState<ImpersonationSession | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchOrganizations();
        checkImpersonation();
    }, []);

    const fetchOrganizations = async () => {
        try {
            const res = await fetch('/api/organizer/organizations');
            if (res.ok) {
                const data = await res.json();
                setOrganizations(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkImpersonation = () => {
        const stored = localStorage.getItem('athena_impersonation');
        if (stored) {
            try {
                setImpersonating(JSON.parse(stored));
            } catch {
                // Invalid data
            }
        }
    };

    const handleImpersonate = async (userId: string, userName: string) => {
        // Log the impersonation action
        await fetch('/api/organizer/impersonate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: userId }),
        });

        // Set local impersonation state
        const session: ImpersonationSession = {
            userId,
            userName,
            startedAt: new Date().toISOString(),
        };
        localStorage.setItem('athena_impersonation', JSON.stringify(session));
        setImpersonating(session);

        // Redirect to user's view
        window.location.href = '/';
    };

    const handleEndImpersonation = async () => {
        await fetch('/api/organizer/impersonate', {
            method: 'DELETE',
        });

        localStorage.removeItem('athena_impersonation');
        setImpersonating(null);
        window.location.href = '/organizer';
    };

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="admin-page">
            {/* Impersonation Banner */}
            {impersonating && (
                <div className="impersonation-banner">
                    ⚠️ You are viewing as <strong>{impersonating.userName}</strong>
                    <button onClick={handleEndImpersonation}>End Session</button>
                </div>
            )}

            <div className="admin-header">
                <h1>🌐 Organizer Console</h1>
                <p>Platform-level administration and support tools</p>
            </div>

            <div className="organizer-stats">
                <div className="stat-card">
                    <span className="stat-value">{organizations.length}</span>
                    <span className="stat-label">Organizations</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">-</span>
                    <span className="stat-label">Active Users</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">-</span>
                    <span className="stat-label">Today's Actions</span>
                </div>
            </div>

            <div className="admin-content">
                <div className="content-header">
                    <h2>All Organizations</h2>
                    <input
                        type="search"
                        placeholder="Search organizations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                {loading ? (
                    <div className="admin-loading">Loading organizations...</div>
                ) : filteredOrgs.length === 0 ? (
                    <p className="no-data">No organizations found</p>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Organization</th>
                                <th>Slug</th>
                                <th>Users</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrgs.map(org => (
                                <tr key={org.id}>
                                    <td>{org.name}</td>
                                    <td><code>{org.slug}</code></td>
                                    <td>{org.user_count || 0}</td>
                                    <td>{new Date(org.created_at).toLocaleDateString()}</td>
                                    <td className="actions">
                                        <Link href={`/organizer/org/${org.id}`} className="btn-view">
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="admin-footer">
                <Link href="/" className="back-link">← Back to Dashboard</Link>
            </div>
        </div>
    );
}
