'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface DataAccessRequest {
    id: string;
    user_id: string;
    user_email: string;
    pool_id: string;
    reason: string;
    intended_use: string;
    status: 'pending' | 'approved' | 'denied' | 'revoked';
    reviewed_by: string | null;
    reviewed_at: string | null;
    denial_reason: string | null;
    created_at: string;
    data_pools: {
        id: string;
        name: string;
        slug: string;
        industry: string;
        platform: string;
        access_tier: string;
    };
}

interface RequestCounts {
    pending: number;
    approved: number;
    denied: number;
    revoked: number;
    total: number;
}

export default function AdminDataRequestsPage() {
    const [requests, setRequests] = useState<DataAccessRequest[]>([]);
    const [counts, setCounts] = useState<RequestCounts>({ pending: 0, approved: 0, denied: 0, revoked: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Denial modal state
    const [showDenialModal, setShowDenialModal] = useState(false);
    const [denialTarget, setDenialTarget] = useState<DataAccessRequest | null>(null);
    const [denialReason, setDenialReason] = useState('');

    // Get admin ID (in real app, this would come from auth)
    const getAdminId = () => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('athena_user_id') || 'admin';
    };

    useEffect(() => {
        fetchRequests();
    }, [statusFilter]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/data-requests?status=${statusFilter}`);
            const data = await response.json();

            if (data.success) {
                setRequests(data.data || []);
                setCounts(data.counts || { pending: 0, approved: 0, denied: 0, revoked: 0, total: 0 });
            }
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (requestId: string, action: 'approve' | 'deny' | 'revoke', reason?: string) => {
        setProcessingId(requestId);
        try {
            const adminId = getAdminId();

            const response = await fetch('/api/admin/data-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    action,
                    adminId,
                    denialReason: reason,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Refresh the list
                await fetchRequests();
                setShowDenialModal(false);
                setDenialTarget(null);
                setDenialReason('');
            } else {
                alert(data.error || 'Action failed');
            }
        } catch (error) {
            console.error('Action failed:', error);
            alert('Action failed. Please try again.');
        } finally {
            setProcessingId(null);
        }
    };

    const openDenialModal = (request: DataAccessRequest) => {
        setDenialTarget(request);
        setDenialReason('');
        setShowDenialModal(true);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusClass = (status: string) => {
        const classes: Record<string, string> = {
            pending: styles.statusPending,
            approved: styles.statusApproved,
            denied: styles.statusDenied,
            revoked: styles.statusRevoked,
        };
        return classes[status] || '';
    };

    return (
        <main className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>Data Access Requests</h1>
                    <p className={styles.subtitle}>Manage user requests for public data pool access</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${statusFilter === 'pending' ? styles.statActive : ''}`}
                    onClick={() => setStatusFilter('pending')}>
                    <span className={styles.statValue}>{counts.pending}</span>
                    <span className={styles.statLabel}>Pending</span>
                </div>
                <div className={`${styles.statCard} ${statusFilter === 'approved' ? styles.statActive : ''}`}
                    onClick={() => setStatusFilter('approved')}>
                    <span className={styles.statValue}>{counts.approved}</span>
                    <span className={styles.statLabel}>Approved</span>
                </div>
                <div className={`${styles.statCard} ${statusFilter === 'denied' ? styles.statActive : ''}`}
                    onClick={() => setStatusFilter('denied')}>
                    <span className={styles.statValue}>{counts.denied}</span>
                    <span className={styles.statLabel}>Denied</span>
                </div>
                <div className={`${styles.statCard} ${statusFilter === 'all' ? styles.statActive : ''}`}
                    onClick={() => setStatusFilter('all')}>
                    <span className={styles.statValue}>{counts.total}</span>
                    <span className={styles.statLabel}>Total</span>
                </div>
            </div>

            {/* Requests Table */}
            <div className={styles.tableContainer}>
                {loading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <span>Loading requests...</span>
                    </div>
                ) : requests.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No {statusFilter !== 'all' ? statusFilter : ''} requests found.</p>
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Data Pool</th>
                                <th>Intended Use</th>
                                <th>Reason</th>
                                <th>Submitted</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((request) => (
                                <tr key={request.id}>
                                    <td>
                                        <div className={styles.userCell}>
                                            <span className={styles.userEmail}>{request.user_email || 'Unknown'}</span>
                                            <span className={styles.userId}>{request.user_id.slice(0, 12)}...</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.poolCell}>
                                            <span className={styles.poolName}>{request.data_pools?.name || 'Unknown'}</span>
                                            <div className={styles.poolMeta}>
                                                <span className={styles.poolTag}>{request.data_pools?.industry}</span>
                                                <span className={styles.poolTag}>{request.data_pools?.platform}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={styles.intendedUse}>{request.intended_use || '-'}</span>
                                    </td>
                                    <td>
                                        <span className={styles.reason}>{request.reason || '-'}</span>
                                    </td>
                                    <td>
                                        <span className={styles.date}>{formatDate(request.created_at)}</span>
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${getStatusClass(request.status)}`}>
                                            {request.status}
                                        </span>
                                        {request.denial_reason && (
                                            <div className={styles.denialReason} title={request.denial_reason}>
                                                {request.denial_reason.slice(0, 30)}...
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            {request.status === 'pending' && (
                                                <>
                                                    <button
                                                        className={styles.approveBtn}
                                                        onClick={() => handleAction(request.id, 'approve')}
                                                        disabled={processingId === request.id}
                                                    >
                                                        {processingId === request.id ? '...' : 'Approve'}
                                                    </button>
                                                    <button
                                                        className={styles.denyBtn}
                                                        onClick={() => openDenialModal(request)}
                                                        disabled={processingId === request.id}
                                                    >
                                                        Deny
                                                    </button>
                                                </>
                                            )}
                                            {request.status === 'approved' && (
                                                <button
                                                    className={styles.revokeBtn}
                                                    onClick={() => handleAction(request.id, 'revoke')}
                                                    disabled={processingId === request.id}
                                                >
                                                    {processingId === request.id ? '...' : 'Revoke'}
                                                </button>
                                            )}
                                            {(request.status === 'denied' || request.status === 'revoked') && (
                                                <span className={styles.noAction}>-</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Denial Modal */}
            {showDenialModal && denialTarget && (
                <div className={styles.modalOverlay} onClick={() => setShowDenialModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Deny Request</h2>
                            <button className={styles.closeBtn} onClick={() => setShowDenialModal(false)}>×</button>
                        </div>

                        <div className={styles.modalBody}>
                            <p>
                                Deny access request from <strong>{denialTarget.user_email || denialTarget.user_id}</strong> for{' '}
                                <strong>{denialTarget.data_pools?.name}</strong>?
                            </p>

                            <div className={styles.formGroup}>
                                <label>Denial Reason (Optional)</label>
                                <textarea
                                    value={denialReason}
                                    onChange={(e) => setDenialReason(e.target.value)}
                                    placeholder="Provide a reason for denial..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowDenialModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmDenyBtn}
                                onClick={() => handleAction(denialTarget.id, 'deny', denialReason)}
                                disabled={processingId === denialTarget.id}
                            >
                                {processingId === denialTarget.id ? 'Processing...' : 'Confirm Denial'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
