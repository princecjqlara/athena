'use client';

import { useState, useEffect, useRef } from 'react';

interface Notification {
    id: string;
    type: 'announcement' | 'message';
    title?: string;
    content: string;
    priority?: string;
    from?: string;
    subject?: string;
    created_at: string;
    is_read?: boolean;
}

interface NotificationBellProps {
    userId: string;
    userRole: string;
}

export default function NotificationBell({ userId, userRole }: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [userId, userRole]);

    useEffect(() => {
        // Close dropdown when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/notifications?userId=${userId}&userRole=${userRole}`);
            if (res.ok) {
                const data = await res.json();
                const combined: Notification[] = [
                    ...(data.notifications?.announcements || []).map((a: { id: string; title: string; content: string; priority: string; created_at: string }) => ({
                        ...a,
                        type: 'announcement' as const
                    })),
                    ...(data.notifications?.messages || []).map((m: { id: string; subject?: string; content: string; from_user_id: string; created_at: string }) => ({
                        ...m,
                        type: 'message' as const,
                        title: m.subject || 'Direct Message',
                        from: m.from_user_id
                    }))
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setNotifications(combined);
                setUnreadCount(data.notifications?.counts?.total || 0);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const markAsRead = async (notification: Notification) => {
        try {
            const body: { userId: string; announcementIds?: string[]; messageIds?: string[] } = { userId };
            if (notification.type === 'announcement') {
                body.announcementIds = [notification.id];
            } else {
                body.messageIds = [notification.id];
            }

            await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            // Update local state
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        if (notifications.length === 0) return;
        setLoading(true);
        try {
            await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, markAllRead: true })
            });
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'urgent': return '#ef4444';
            case 'high': return '#f59e0b';
            case 'normal': return '#10b981';
            default: return '#6b7280';
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '8px',
                    fontSize: '1.25rem'
                }}
                title="Notifications"
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        borderRadius: '50%',
                        minWidth: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px'
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '360px',
                    maxHeight: '480px',
                    overflow: 'auto',
                    background: 'var(--bg-secondary, #1a1a2e)',
                    border: '1px solid var(--border, rgba(255,255,255,0.1))',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    zIndex: 1000
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontWeight: 600 }}>Notifications</span>
                        {notifications.length > 0 && (
                            <button
                                onClick={markAllAsRead}
                                disabled={loading}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--primary, #6366f1)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                {loading ? '...' : 'Mark all read'}
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    {notifications.length === 0 ? (
                        <div style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            color: 'var(--text-muted, #888)'
                        }}>
                            <p style={{ margin: 0 }}>No new notifications</p>
                        </div>
                    ) : (
                        <div>
                            {notifications.map(notification => (
                                <div
                                    key={`${notification.type}-${notification.id}`}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border, rgba(255,255,255,0.05))',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        borderLeft: notification.type === 'announcement'
                                            ? `3px solid ${getPriorityColor(notification.priority)}`
                                            : '3px solid #10b981'
                                    }}
                                    onClick={() => markAsRead(notification)}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.05))'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '1rem' }}>
                                            {notification.type === 'announcement' ? '📢' : '💬'}
                                        </span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{
                                                margin: '0 0 4px',
                                                fontWeight: 500,
                                                fontSize: '0.9rem'
                                            }}>
                                                {notification.title || 'Notification'}
                                            </p>
                                            <p style={{
                                                margin: '0 0 4px',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-secondary, #aaa)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}>
                                                {notification.content}
                                            </p>
                                            <p style={{
                                                margin: 0,
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted, #666)'
                                            }}>
                                                {new Date(notification.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
