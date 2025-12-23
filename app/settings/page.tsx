'use client';

import { useState } from 'react';
import styles from './page.module.css';
import UndoPanel from '@/components/UndoPanel';

export default function SettingsPage() {
    const [cloudinaryName, setCloudinaryName] = useState('');
    const [cloudinaryPreset, setCloudinaryPreset] = useState('');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Meta CAPI Settings
    const [adAccountId, setAdAccountId] = useState('');
    const [capiAccessToken, setCapiAccessToken] = useState('');
    const [metaPixelId, setMetaPixelId] = useState('');
    const [facebookAppId, setFacebookAppId] = useState('');
    const [capiConnectionStatus, setCapiConnectionStatus] = useState<'untested' | 'testing' | 'connected' | 'failed'>('untested');

    const [modelStats, setModelStats] = useState({
        dataPoints: 0,
        accuracy: 0,
        lastTrained: '-',
    });

    // Load saved CAPI settings from localStorage
    useState(() => {
        if (typeof window !== 'undefined') {
            const savedAdAccount = localStorage.getItem('meta_ad_account_id');
            const savedToken = localStorage.getItem('meta_capi_token');
            const savedPixelId = localStorage.getItem('meta_pixel_id');
            const savedFacebookAppId = localStorage.getItem('facebook_app_id');
            if (savedAdAccount) setAdAccountId(savedAdAccount);
            if (savedToken) setCapiAccessToken(savedToken);
            if (savedPixelId) setMetaPixelId(savedPixelId);
            if (savedFacebookAppId) setFacebookAppId(savedFacebookAppId);
        }
    });

    const handleSaveConfig = async () => {
        setIsSaving(true);
        // In production, save to localStorage or environment
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    const handleResetModel = async () => {
        if (confirm('Are you sure you want to reset the AI model? This will clear all training data.')) {
            // In production: resetModel() from ml/model.ts
            setModelStats({ dataPoints: 0, accuracy: 0, lastTrained: '-' });
        }
    };

    const handleExportData = () => {
        // Export all ads data from localStorage
        const ads = JSON.parse(localStorage.getItem('ads') || '[]');
        const exportData = {
            ads: ads,
            exportDate: new Date().toISOString(),
            totalAds: ads.length,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `athena-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDeleteAllData = () => {
        const ads = JSON.parse(localStorage.getItem('ads') || '[]');
        if (ads.length === 0) {
            alert('No data to delete. The Algorithm is already empty.');
            return;
        }

        if (confirm(`⚠️ DELETE ALL DATA?\n\nThis will permanently delete:\n• ${ads.length} ad(s)\n• All trait connections\n• All prediction data\n\nThis action cannot be undone!`)) {
            localStorage.removeItem('ads');
            localStorage.removeItem('undoHistory');
            alert('✅ All Algorithm data has been deleted.');
            window.location.reload();
        }
    };

    // Save CAPI settings
    const handleSaveCapiSettings = () => {
        localStorage.setItem('meta_ad_account_id', adAccountId);
        localStorage.setItem('meta_capi_token', capiAccessToken);
        localStorage.setItem('meta_pixel_id', metaPixelId);
        localStorage.setItem('facebook_app_id', facebookAppId);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    // Test CAPI connection
    const handleTestCapiConnection = async () => {
        if (!adAccountId || !capiAccessToken) {
            alert('Please enter both Ad Account ID and Access Token');
            return;
        }

        setCapiConnectionStatus('testing');

        try {
            // Test connection by fetching ad account info
            const response = await fetch(
                `https://graph.facebook.com/v24.0/act_${adAccountId}?fields=name,account_status&access_token=${capiAccessToken}`
            );

            const data = await response.json();

            if (data.error) {
                console.error('CAPI Error:', data.error);
                setCapiConnectionStatus('failed');
            } else {
                setCapiConnectionStatus('connected');
                // Save on successful connection
                handleSaveCapiSettings();
            }
        } catch (error) {
            console.error('CAPI connection error:', error);
            setCapiConnectionStatus('failed');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
                <p className={styles.subtitle}>Configure your Athena system</p>
            </header>

            {showSuccess && (
                <div className={styles.successToast}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Settings saved successfully!
                </div>
            )}

            <div className={styles.settingsGrid}>
                {/* Undo / History Panel */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <UndoPanel />
                </div>

                {/* Meta Conversions API Settings */}
                <div className={`glass-card ${styles.settingsCard}`} style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #1877F2, #42B72A)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                            </svg>
                        </div>
                        <div>
                            <h3>Meta Conversions API</h3>
                            <p>Connect to fetch ad results automatically</p>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            {capiConnectionStatus === 'connected' && (
                                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
                                    Connected
                                </span>
                            )}
                            {capiConnectionStatus === 'failed' && (
                                <span style={{ color: 'var(--error)' }}>❌ Connection Failed</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <div className="form-group">
                            <label className="form-label">Ad Account ID</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 123456789012345"
                                value={adAccountId}
                                onChange={(e) => {
                                    setAdAccountId(e.target.value);
                                    setCapiConnectionStatus('untested');
                                }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Find in Ads Manager → Settings → Account ID
                            </small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Access Token</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Your Meta access token"
                                value={capiAccessToken}
                                onChange={(e) => {
                                    setCapiAccessToken(e.target.value);
                                    setCapiConnectionStatus('untested');
                                }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Generate at developers.facebook.com → Tools → Access Token
                            </small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Meta Pixel ID</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 1234567890123456"
                                value={metaPixelId}
                                onChange={(e) => setMetaPixelId(e.target.value)}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Find in Events Manager → Data Sources → Pixel ID
                            </small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Facebook App ID</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 123456789012345"
                                value={facebookAppId}
                                onChange={(e) => setFacebookAppId(e.target.value)}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Find at developers.facebook.com → Your App → App ID
                            </small>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleTestCapiConnection}
                            disabled={capiConnectionStatus === 'testing' || !adAccountId || !capiAccessToken}
                        >
                            {capiConnectionStatus === 'testing' ? '🔄 Testing...' : '🔗 Test Connection'}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleSaveCapiSettings}
                            disabled={!adAccountId || !capiAccessToken}
                        >
                            💾 Save Settings
                        </button>
                    </div>

                    {capiConnectionStatus === 'connected' && (
                        <div style={{
                            marginTop: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}>
                            ✅ Connection successful! Ad results will now auto-fetch when you enter an Ad ID during upload.
                        </div>
                    )}
                </div>

                {/* Cloudinary Settings */}
                <div className={`glass-card ${styles.settingsCard}`}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.5 19H9a7 7 0 117-7h1.5a4.5 4.5 0 110 9z" />
                            </svg>
                        </div>
                        <div>
                            <h3>Cloudinary</h3>
                            <p>Video storage configuration</p>
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <div className="form-group">
                            <label className="form-label">Cloud Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="your-cloud-name"
                                value={cloudinaryName}
                                onChange={(e) => setCloudinaryName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Upload Preset</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="ads_algorithm"
                                value={cloudinaryPreset}
                                onChange={(e) => setCloudinaryPreset(e.target.value)}
                            />
                        </div>
                    </div>

                    <a
                        href="https://cloudinary.com/console"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.helpLink}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Get your Cloudinary credentials
                    </a>
                </div>

                {/* Supabase Settings */}
                <div className={`glass-card ${styles.settingsCard}`}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                            </svg>
                        </div>
                        <div>
                            <h3>Supabase</h3>
                            <p>Database configuration</p>
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <div className="form-group">
                            <label className="form-label">Project URL</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="https://your-project.supabase.co"
                                value={supabaseUrl}
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Anon Key</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="your-anon-key"
                                value={supabaseKey}
                                onChange={(e) => setSupabaseKey(e.target.value)}
                            />
                        </div>
                    </div>

                    <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.helpLink}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Get your Supabase credentials
                    </a>
                </div>

                {/* AI Model Settings */}
                <div className={`glass-card ${styles.settingsCard}`}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00-1.32 4.24 3 3 0 00.34 5.58 2.5 2.5 0 002.96 3.08A2.5 2.5 0 0012 19.5" />
                                <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0112 19.5" />
                            </svg>
                        </div>
                        <div>
                            <h3>AI Model</h3>
                            <p>Machine learning settings</p>
                        </div>
                    </div>

                    <div className={styles.modelStats}>
                        <div className={styles.modelStat}>
                            <span className={styles.modelStatValue}>{modelStats.dataPoints}</span>
                            <span className={styles.modelStatLabel}>Data Points</span>
                        </div>
                        <div className={styles.modelStat}>
                            <span className={styles.modelStatValue}>{modelStats.accuracy}%</span>
                            <span className={styles.modelStatLabel}>Accuracy</span>
                        </div>
                        <div className={styles.modelStat}>
                            <span className={styles.modelStatValue}>{modelStats.lastTrained}</span>
                            <span className={styles.modelStatLabel}>Last Trained</span>
                        </div>
                    </div>

                    <div className={styles.modelProgress}>
                        <div className={styles.progressLabel}>
                            <span>Training Progress</span>
                            <span>{Math.min(modelStats.dataPoints * 2, 100)}%</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.min(modelStats.dataPoints * 2, 100)}%` }}></div>
                        </div>
                        <p className={styles.progressHint}>
                            {modelStats.dataPoints < 50
                                ? `Add ${50 - modelStats.dataPoints} more videos for optimal predictions`
                                : 'Model is well-trained!'}
                        </p>
                    </div>

                    <div className={styles.modelActions}>
                        <button className="btn btn-secondary" onClick={handleResetModel}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="1 4 1 10 7 10" />
                                <polyline points="23 20 23 14 17 14" />
                                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                            </svg>
                            Reset Model
                        </button>
                    </div>
                </div>

                {/* Data Export */}
                <div className={`glass-card ${styles.settingsCard}`}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </div>
                        <div>
                            <h3>Data Export</h3>
                            <p>Download your data</p>
                        </div>
                    </div>

                    <p className={styles.exportDescription}>
                        Export all your videos, metadata, and performance data as a JSON file for backup or analysis.
                    </p>

                    <button className="btn btn-secondary" onClick={handleExportData}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export All Data
                    </button>
                </div>

                {/* Danger Zone - Delete All Data */}
                <div className={`glass-card ${styles.settingsCard}`} style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ color: '#ef4444' }}>Danger Zone</h3>
                            <p>Delete all Algorithm data</p>
                        </div>
                    </div>

                    <p className={styles.exportDescription} style={{ color: 'var(--text-muted)' }}>
                        ⚠️ This will permanently delete all your ads, trait connections, and prediction data.
                        Make sure to export your data first if you want to keep a backup.
                    </p>

                    <button
                        className="btn"
                        onClick={handleDeleteAllData}
                        style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ef4444'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                        Delete All Algorithm Data
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div className={styles.saveSection}>
                <button
                    className="btn btn-primary btn-lg"
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <>
                            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-6.219-8.56" />
                            </svg>
                            Saving...
                        </>
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            Save Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
