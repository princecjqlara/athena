'use client';

import { useState, useEffect } from 'react';
import {
    getHistory,
    getUndoableEntries,
    getRedoableEntries,
    undoChange,
    redoChange,
    undoLast,
    redoLast,
    getSnapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    clearHistory,
    formatHistoryEntry,
    HistoryEntry
} from '@/lib/ml/history';

interface UndoPanelProps {
    onUpdate?: () => void;
}

export default function UndoPanel({ onUpdate }: UndoPanelProps) {
    const [undoableEntries, setUndoableEntries] = useState<HistoryEntry[]>([]);
    const [redoableEntries, setRedoableEntries] = useState<HistoryEntry[]>([]);
    const [snapshots, setSnapshots] = useState<{ id: string; name: string; timestamp: string }[]>([]);
    const [snapshotName, setSnapshotName] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const loadData = () => {
        setUndoableEntries(getUndoableEntries().slice(0, 10));
        setRedoableEntries(getRedoableEntries().slice(0, 5));
        setSnapshots(getSnapshots().map(s => ({ id: s.id, name: s.name, timestamp: s.timestamp })));
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleUndo = (id: string) => {
        undoChange(id);
        loadData();
        onUpdate?.();
    };

    const handleRedo = (id: string) => {
        redoChange(id);
        loadData();
        onUpdate?.();
    };

    const handleUndoLast = () => {
        undoLast();
        loadData();
        onUpdate?.();
    };

    const handleRedoLast = () => {
        redoLast();
        loadData();
        onUpdate?.();
    };

    const handleCreateSnapshot = () => {
        if (snapshotName.trim()) {
            createSnapshot(snapshotName.trim());
            setSnapshotName('');
            loadData();
        }
    };

    const handleRestoreSnapshot = (id: string) => {
        if (confirm('Restore this snapshot? Your current state will be backed up first.')) {
            restoreSnapshot(id);
            loadData();
            onUpdate?.();
        }
    };

    const handleClearHistory = () => {
        if (confirm('Clear all history? This cannot be undone.')) {
            clearHistory();
            loadData();
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'weight_adjustment': return '⚖️';
            case 'feature_discovered': return '🔍';
            case 'feature_deleted': return '🗑️';
            case 'segment_created': return '👥';
            case 'ad_saved': return '📤';
            case 'results_added': return '📊';
            case 'config_changed': return '⚙️';
            default: return '📝';
        }
    };

    return (
        <div className="undo-panel glass-card" style={{ padding: 'var(--spacing-lg)' }}>
            <div
                className="undo-header"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                }}
            >
                <h3 style={{ margin: 0 }}>↩️ Undo / History</h3>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleUndoLast(); }}
                        disabled={undoableEntries.length === 0}
                    >
                        ↩️ Undo
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleRedoLast(); }}
                        disabled={redoableEntries.length === 0}
                    >
                        ↪️ Redo
                    </button>
                    <span style={{ fontSize: '1.5rem' }}>{isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>

            {isExpanded && (
                <div style={{ marginTop: 'var(--spacing-lg)' }}>
                    {/* Recent Changes */}
                    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                        <h4 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Recent Changes ({undoableEntries.length})
                        </h4>
                        {undoableEntries.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No changes to undo</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {undoableEntries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        <div>
                                            <span style={{ marginRight: 'var(--spacing-sm)' }}>{getTypeIcon(entry.type)}</span>
                                            <span>{entry.description}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--spacing-sm)' }}>
                                                {formatTime(entry.timestamp)}
                                            </span>
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleUndo(entry.id)}
                                        >
                                            Undo
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Undone Changes (Redoable) */}
                    {redoableEntries.length > 0 && (
                        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                            <h4 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Undone ({redoableEntries.length})
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {redoableEntries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: '0.75rem',
                                            opacity: 0.7
                                        }}
                                    >
                                        <div>
                                            <span style={{ marginRight: 'var(--spacing-sm)' }}>{getTypeIcon(entry.type)}</span>
                                            <span style={{ textDecoration: 'line-through' }}>{entry.description}</span>
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleRedo(entry.id)}
                                        >
                                            Redo
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Snapshots */}
                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <h4 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            📸 Snapshots (Full Backups)
                        </h4>

                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                            <input
                                type="text"
                                placeholder="Snapshot name..."
                                value={snapshotName}
                                onChange={(e) => setSnapshotName(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem'
                                }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleCreateSnapshot}
                                disabled={!snapshotName.trim()}
                            >
                                Create
                            </button>
                        </div>

                        {snapshots.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No snapshots saved</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {snapshots.map((snapshot) => (
                                    <div
                                        key={snapshot.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        <div>
                                            <span style={{ fontWeight: 600 }}>{snapshot.name}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--spacing-sm)' }}>
                                                {formatTime(snapshot.timestamp)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleRestoreSnapshot(snapshot.id)}
                                            >
                                                Restore
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => { deleteSnapshot(snapshot.id); loadData(); }}
                                                style={{ color: 'var(--error)' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clear History */}
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleClearHistory}
                        style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                    >
                        🗑️ Clear All History
                    </button>
                </div>
            )}
        </div>
    );
}
