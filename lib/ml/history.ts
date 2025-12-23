// Undo/History System
// Tracks all ML changes and allows reverting them

export type ChangeType =
    | 'weight_adjustment'
    | 'feature_discovered'
    | 'feature_deleted'
    | 'segment_created'
    | 'segment_updated'
    | 'config_changed'
    | 'prediction_recorded'
    | 'ad_saved'
    | 'results_added';

export interface HistoryEntry {
    id: string;
    timestamp: string;
    type: ChangeType;
    description: string;

    // Before state (for undo)
    beforeState: string; // JSON stringified

    // After state (for redo)
    afterState: string; // JSON stringified

    // Metadata
    storageKey: string; // Which localStorage key was affected
    isUndone: boolean;
    undoneAt?: string;
}

const HISTORY_KEY = 'ml_history';
const MAX_HISTORY = 50;

// Get full history
export function getHistory(): HistoryEntry[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Save history
function saveHistory(history: HistoryEntry[]): void {
    if (typeof window === 'undefined') return;
    // Keep only last MAX_HISTORY entries
    const trimmed = history.slice(-MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

// Record a change
export function recordChange(
    type: ChangeType,
    description: string,
    storageKey: string,
    beforeState: unknown,
    afterState: unknown
): HistoryEntry {
    const entry: HistoryEntry = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type,
        description,
        beforeState: JSON.stringify(beforeState),
        afterState: JSON.stringify(afterState),
        storageKey,
        isUndone: false,
    };

    const history = getHistory();
    history.push(entry);
    saveHistory(history);

    console.log(`[HISTORY] Recorded: ${type} - ${description}`);
    return entry;
}

// Undo a specific change
export function undoChange(entryId: string): boolean {
    const history = getHistory();
    const entry = history.find(h => h.id === entryId);

    if (!entry || entry.isUndone) {
        console.log(`[HISTORY] Cannot undo: ${entryId}`);
        return false;
    }

    try {
        // Restore the before state
        const beforeState = JSON.parse(entry.beforeState);
        localStorage.setItem(entry.storageKey, JSON.stringify(beforeState));

        // Mark as undone
        entry.isUndone = true;
        entry.undoneAt = new Date().toISOString();
        saveHistory(history);

        console.log(`[HISTORY] Undone: ${entry.type} - ${entry.description}`);
        return true;
    } catch (error) {
        console.error('[HISTORY] Undo failed:', error);
        return false;
    }
}

// Redo a specific change
export function redoChange(entryId: string): boolean {
    const history = getHistory();
    const entry = history.find(h => h.id === entryId);

    if (!entry || !entry.isUndone) {
        console.log(`[HISTORY] Cannot redo: ${entryId}`);
        return false;
    }

    try {
        // Restore the after state
        const afterState = JSON.parse(entry.afterState);
        localStorage.setItem(entry.storageKey, JSON.stringify(afterState));

        // Mark as not undone
        entry.isUndone = false;
        entry.undoneAt = undefined;
        saveHistory(history);

        console.log(`[HISTORY] Redone: ${entry.type} - ${entry.description}`);
        return true;
    } catch (error) {
        console.error('[HISTORY] Redo failed:', error);
        return false;
    }
}

// Undo the last change
export function undoLast(): HistoryEntry | null {
    const history = getHistory();

    // Find the last non-undone change
    for (let i = history.length - 1; i >= 0; i--) {
        if (!history[i].isUndone) {
            undoChange(history[i].id);
            return history[i];
        }
    }

    return null;
}

// Redo the last undone change
export function redoLast(): HistoryEntry | null {
    const history = getHistory();

    // Find the most recent undone change
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].isUndone) {
            redoChange(history[i].id);
            return history[i];
        }
    }

    return null;
}

// Get undoable entries
export function getUndoableEntries(): HistoryEntry[] {
    return getHistory().filter(h => !h.isUndone).reverse();
}

// Get redoable entries
export function getRedoableEntries(): HistoryEntry[] {
    return getHistory().filter(h => h.isUndone).reverse();
}

// Clear all history
export function clearHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(HISTORY_KEY);
    console.log('[HISTORY] Cleared all history');
}

// Get history summary
export function getHistorySummary(): {
    total: number;
    undoable: number;
    redoable: number;
    byType: Record<ChangeType, number>;
} {
    const history = getHistory();

    const byType: Record<string, number> = {};
    history.forEach(h => {
        byType[h.type] = (byType[h.type] || 0) + 1;
    });

    return {
        total: history.length,
        undoable: history.filter(h => !h.isUndone).length,
        redoable: history.filter(h => h.isUndone).length,
        byType: byType as Record<ChangeType, number>,
    };
}

// Snapshot current state (for bulk undo)
export function createSnapshot(name: string): string {
    const keys = [
        'ml_feature_weights',
        'ml_discovered_features',
        'ml_audience_segments',
        'ml_predictions',
        'ads',
    ];

    const snapshot: Record<string, unknown> = {};
    keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) snapshot[key] = JSON.parse(value);
    });

    const snapshotId = `snapshot-${Date.now()}`;
    const snapshotData = {
        id: snapshotId,
        name,
        timestamp: new Date().toISOString(),
        data: snapshot,
    };

    // Store snapshots
    const snapshots = getSnapshots();
    snapshots.push(snapshotData);
    // Keep last 10 snapshots
    if (snapshots.length > 10) snapshots.shift();
    localStorage.setItem('ml_snapshots', JSON.stringify(snapshots));

    console.log(`[HISTORY] Created snapshot: ${name}`);
    return snapshotId;
}

// Get all snapshots
export function getSnapshots(): { id: string; name: string; timestamp: string; data: Record<string, unknown> }[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('ml_snapshots');
    return stored ? JSON.parse(stored) : [];
}

// Restore from snapshot
export function restoreSnapshot(snapshotId: string): boolean {
    const snapshots = getSnapshots();
    const snapshot = snapshots.find(s => s.id === snapshotId);

    if (!snapshot) {
        console.log(`[HISTORY] Snapshot not found: ${snapshotId}`);
        return false;
    }

    try {
        // Record current state before restoring (so user can undo the restore)
        createSnapshot('Auto-backup before restore');

        // Restore each key
        Object.entries(snapshot.data).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
        });

        console.log(`[HISTORY] Restored snapshot: ${snapshot.name}`);
        return true;
    } catch (error) {
        console.error('[HISTORY] Restore failed:', error);
        return false;
    }
}

// Delete a snapshot
export function deleteSnapshot(snapshotId: string): boolean {
    const snapshots = getSnapshots();
    const filtered = snapshots.filter(s => s.id !== snapshotId);
    localStorage.setItem('ml_snapshots', JSON.stringify(filtered));
    return filtered.length < snapshots.length;
}

// Helper to format history entry for display
export function formatHistoryEntry(entry: HistoryEntry): string {
    const date = new Date(entry.timestamp);
    const time = date.toLocaleTimeString();
    const status = entry.isUndone ? '↩️ Undone' : '✓ Active';
    return `[${time}] ${entry.type}: ${entry.description} (${status})`;
}
