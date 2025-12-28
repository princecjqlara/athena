/**
 * Activity Logging Utility
 * Tracks user actions for audit trail and analytics
 */

export interface ActivityLog {
    id: string;
    timestamp: string;
    userId: string;
    action: string;
    category: 'auth' | 'ads' | 'pipeline' | 'sync' | 'settings' | 'ai' | 'api';
    details?: Record<string, any>;
    metadata?: {
        ip?: string;
        userAgent?: string;
        page?: string;
    };
}

// In-memory log buffer
const logBuffer: ActivityLog[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Log an activity
 */
export function logActivity(
    action: string,
    category: ActivityLog['category'],
    details?: Record<string, any>
): void {
    if (typeof window === 'undefined') return;

    const userId = localStorage.getItem('athena_user_id') ||
        localStorage.getItem('fb_user_id') ||
        'anonymous';

    const log: ActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId,
        action,
        category,
        details,
        metadata: {
            userAgent: navigator.userAgent,
            page: window.location.pathname
        }
    };

    // Add to buffer
    logBuffer.push(log);

    // Trim if over limit
    if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift();
    }

    // Save to localStorage
    try {
        const stored = JSON.parse(localStorage.getItem('activity_logs') || '[]');
        stored.push(log);
        // Keep last 500 logs
        if (stored.length > 500) {
            stored.splice(0, stored.length - 500);
        }
        localStorage.setItem('activity_logs', JSON.stringify(stored));
    } catch (e) {
        console.warn('Failed to save activity log:', e);
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Activity] ${category}:${action}`, details);
    }
}

/**
 * Get recent activity logs
 */
export function getActivityLogs(limit: number = 50): ActivityLog[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = JSON.parse(localStorage.getItem('activity_logs') || '[]');
        return stored.slice(-limit).reverse();
    } catch {
        return [];
    }
}

/**
 * Get logs by category
 */
export function getLogsByCategory(category: ActivityLog['category'], limit: number = 50): ActivityLog[] {
    return getActivityLogs(limit * 2).filter(log => log.category === category).slice(0, limit);
}

/**
 * Clear all activity logs
 */
export function clearActivityLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('activity_logs');
    logBuffer.length = 0;
}

/**
 * Export logs as JSON file
 */
export function exportActivityLogs(): void {
    const logs = getActivityLogs(500);
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Pre-built log helpers
export const activity = {
    // Auth
    login: (email: string) => logActivity('login', 'auth', { email }),
    logout: () => logActivity('logout', 'auth'),
    signup: (email: string, role: string) => logActivity('signup', 'auth', { email, role }),

    // Ads
    importAd: (adId: string, source: string) => logActivity('import_ad', 'ads', { adId, source }),
    deleteAd: (adId: string) => logActivity('delete_ad', 'ads', { adId }),
    analyzeAd: (adId: string) => logActivity('analyze_ad', 'ads', { adId }),

    // Pipeline
    createPipeline: (pipelineId: string, name: string) => logActivity('create_pipeline', 'pipeline', { pipelineId, name }),
    addLead: (pipelineId: string, leadId: string) => logActivity('add_lead', 'pipeline', { pipelineId, leadId }),
    moveLead: (leadId: string, fromStage: string, toStage: string) => logActivity('move_lead', 'pipeline', { leadId, fromStage, toStage }),

    // Sync
    syncToCloud: (itemCount: number) => logActivity('sync_to_cloud', 'sync', { itemCount }),
    loadFromCloud: (itemCount: number) => logActivity('load_from_cloud', 'sync', { itemCount }),

    // Settings
    updateSettings: (setting: string, value: any) => logActivity('update_settings', 'settings', { setting, value }),

    // AI
    aiChat: (messageLength: number) => logActivity('ai_chat', 'ai', { messageLength }),
    aiAnalyze: (action: string) => logActivity('ai_analyze', 'ai', { action }),
};

export default activity;
