'use client';

import { useState } from 'react';
import styles from './SyncIndicator.module.css';
import { SyncState } from '@/hooks/useFacebookSync';

interface SyncIndicatorProps {
    syncState: SyncState;
    onSync: () => void;
    onToggleAutoSync: () => void;
    onSetInterval: (minutes: number) => void;
    formatLastSynced: () => string;
    compact?: boolean;
}

export default function SyncIndicator({
    syncState,
    onSync,
    onToggleAutoSync,
    onSetInterval,
    formatLastSynced,
    compact = false
}: SyncIndicatorProps) {
    const [showSettings, setShowSettings] = useState(false);

    const intervalOptions = [
        { value: 1, label: '1 min' },
        { value: 2, label: '2 min' },
        { value: 5, label: '5 min' },
        { value: 10, label: '10 min' },
        { value: 15, label: '15 min' },
        { value: 30, label: '30 min' },
    ];

    if (compact) {
        return (
            <div className={styles.compactContainer}>
                <button
                    className={`${styles.syncButton} ${syncState.isSyncing ? styles.syncing : ''}`}
                    onClick={onSync}
                    disabled={syncState.isSyncing}
                    title={`Last synced: ${formatLastSynced()}`}
                >
                    <svg
                        className={`${styles.syncIcon} ${syncState.isSyncing ? styles.spinning : ''}`}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M23 4v6h-6" />
                        <path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    {!syncState.isSyncing && (
                        <span className={styles.lastSyncedCompact}>{formatLastSynced()}</span>
                    )}
                </button>
                {syncState.autoSyncEnabled && (
                    <span className={styles.autoIndicator} title="Auto-sync enabled">
                        ⚡
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.mainRow}>
                <button
                    className={`${styles.syncButton} ${syncState.isSyncing ? styles.syncing : ''}`}
                    onClick={onSync}
                    disabled={syncState.isSyncing}
                >
                    <svg
                        className={`${styles.syncIcon} ${syncState.isSyncing ? styles.spinning : ''}`}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M23 4v6h-6" />
                        <path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    {syncState.isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>

                <div className={styles.statusInfo}>
                    <span className={styles.lastSynced}>
                        {syncState.lastSyncError ? (
                            <span className={styles.syncError}>⚠️ {syncState.lastSyncError}</span>
                        ) : (
                            <>
                                <span className={styles.statusDot}></span>
                                Last synced: {formatLastSynced()}
                            </>
                        )}
                    </span>
                    {syncState.autoSyncEnabled && (
                        <span className={styles.autoSyncBadge}>
                            ⚡ Auto-sync every {syncState.syncIntervalMinutes}m
                        </span>
                    )}
                </div>

                <button
                    className={styles.settingsButton}
                    onClick={() => setShowSettings(!showSettings)}
                    title="Sync settings"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                </button>
            </div>

            {showSettings && (
                <div className={styles.settingsPanel}>
                    <div className={styles.settingRow}>
                        <label className={styles.settingLabel}>
                            <input
                                type="checkbox"
                                checked={syncState.autoSyncEnabled}
                                onChange={onToggleAutoSync}
                            />
                            <span className={styles.checkboxLabel}>Enable auto-sync</span>
                        </label>
                    </div>

                    {syncState.autoSyncEnabled && (
                        <div className={styles.settingRow}>
                            <label className={styles.settingLabel}>Sync interval:</label>
                            <div className={styles.intervalButtons}>
                                {intervalOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`${styles.intervalButton} ${syncState.syncIntervalMinutes === opt.value ? styles.intervalActive : ''}`}
                                        onClick={() => onSetInterval(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={styles.settingInfo}>
                        <p>💡 Auto-sync keeps your ad data up-to-date with Facebook</p>
                        {syncState.syncCount > 0 && (
                            <p className={styles.syncCountInfo}>
                                Total syncs this session: {syncState.syncCount}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
