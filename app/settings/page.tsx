'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import UndoPanel from '@/components/UndoPanel';
import FacebookLogin from '@/components/FacebookLogin';

// Facebook App ID - set in environment variable
const FB_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';

interface AdAccount {
    id: string;
    name: string;
    account_id: string;
}

export default function SettingsPage() {
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Meta Marketing API Settings
    const [adAccountId, setAdAccountId] = useState('');
    const [marketingAccessToken, setMarketingAccessToken] = useState('');
    const [marketingConnectionStatus, setMarketingConnectionStatus] = useState<'untested' | 'testing' | 'connected' | 'failed'>('untested');
    const [fbAdAccounts, setFbAdAccounts] = useState<AdAccount[]>([]);
    const [showManualInput, setShowManualInput] = useState(false);

    // Meta Conversions API (CAPI) Settings
    const [datasetId, setDatasetId] = useState('');
    const [capiAccessToken, setCapiAccessToken] = useState('');
    const [capiConnectionStatus, setCapiConnectionStatus] = useState<'untested' | 'testing' | 'connected' | 'failed'>('untested');

    const [modelStats, setModelStats] = useState({
        dataPoints: 0,
        accuracy: 0,
        lastTrained: '-',
    });

    // Load saved API settings from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedAdAccount = localStorage.getItem('meta_ad_account_id');
            const savedMarketingToken = localStorage.getItem('meta_marketing_token');
            const savedDatasetId = localStorage.getItem('meta_dataset_id');
            const savedCapiToken = localStorage.getItem('meta_capi_token');
            const savedFbAdAccounts = localStorage.getItem('fb_ad_accounts');
            if (savedAdAccount) setAdAccountId(savedAdAccount);
            if (savedMarketingToken) setMarketingAccessToken(savedMarketingToken);
            if (savedDatasetId) setDatasetId(savedDatasetId);
            if (savedCapiToken) setCapiAccessToken(savedCapiToken);
            if (savedFbAdAccounts) {
                try {
                    setFbAdAccounts(JSON.parse(savedFbAdAccounts));
                } catch (e) {
                    console.error('Error parsing ad accounts:', e);
                }
            }
        }
    }, []);

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

    // Save Marketing API settings
    const handleSaveMarketingSettings = () => {
        localStorage.setItem('meta_ad_account_id', adAccountId);
        localStorage.setItem('meta_marketing_token', marketingAccessToken);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    // Test Marketing API connection
    const handleTestMarketingConnection = async () => {
        if (!adAccountId || !marketingAccessToken) {
            alert('Please enter both Ad Account ID and Access Token');
            return;
        }

        setMarketingConnectionStatus('testing');

        try {
            const response = await fetch(
                `https://graph.facebook.com/v24.0/act_${adAccountId}?fields=name,account_status&access_token=${marketingAccessToken}`
            );

            const data = await response.json();

            if (data.error) {
                console.error('Marketing API Error:', data.error);
                setMarketingConnectionStatus('failed');
            } else {
                setMarketingConnectionStatus('connected');
                handleSaveMarketingSettings();
            }
        } catch (error) {
            console.error('Marketing API connection error:', error);
            setMarketingConnectionStatus('failed');
        }
    };

    // Save CAPI settings
    const handleSaveCapiSettings = () => {
        localStorage.setItem('meta_dataset_id', datasetId);
        localStorage.setItem('meta_capi_token', capiAccessToken);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    // Test CAPI connection
    const handleTestCapiConnection = async () => {
        if (!datasetId || !capiAccessToken) {
            alert('Please enter both Dataset ID and CAPI Access Token');
            return;
        }

        setCapiConnectionStatus('testing');

        try {
            // Test connection by fetching dataset info
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${datasetId}?fields=name,id&access_token=${capiAccessToken}`
            );

            const data = await response.json();

            if (data.error) {
                console.error('CAPI Error:', data.error);
                setCapiConnectionStatus('failed');
            } else {
                setCapiConnectionStatus('connected');
                handleSaveCapiSettings();
            }
        } catch (error) {
            console.error('CAPI connection error:', error);
            setCapiConnectionStatus('failed');
        }
    };

    // Handle Facebook OAuth success
    const handleFacebookSuccess = (response: any) => {
        console.log('Facebook login success:', response);
        setMarketingAccessToken(response.accessToken);
        setFbAdAccounts(response.adAccounts || []);

        // Auto-select first ad account if available
        if (response.adAccounts && response.adAccounts.length > 0) {
            const firstAccount = response.adAccounts[0];
            setAdAccountId(firstAccount.account_id);
            localStorage.setItem('meta_ad_account_id', firstAccount.account_id);
            localStorage.setItem('meta_marketing_token', response.accessToken);
            setMarketingConnectionStatus('connected');
        }

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    // Handle ad account selection
    const handleAdAccountSelect = (accountId: string) => {
        setAdAccountId(accountId);
        localStorage.setItem('meta_ad_account_id', accountId);
        setMarketingConnectionStatus('connected');
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

                {/* Meta Marketing API Settings */}
                <div className={`glass-card ${styles.settingsCard}`} style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    gridColumn: '1 / -1'
                }}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #1877F2, #42B72A)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                            </svg>
                        </div>
                        <div>
                            <h3>Meta Marketing API</h3>
                            <p>Connect to fetch ad results automatically</p>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            {marketingConnectionStatus === 'connected' && (
                                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
                                    Connected
                                </span>
                            )}
                            {marketingConnectionStatus === 'failed' && (
                                <span style={{ color: 'var(--error)' }}>❌ Connection Failed</span>
                            )}
                        </div>
                    </div>

                    {/* Facebook OAuth Login Button */}
                    {FB_APP_ID ? (
                        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <FacebookLogin
                                appId={FB_APP_ID}
                                onSuccess={handleFacebookSuccess}
                                onError={(error) => console.error('FB Login Error:', error)}
                            />

                            {/* Ad Account Selector */}
                            {fbAdAccounts.length > 0 && (
                                <div style={{ marginTop: 'var(--spacing-md)' }}>
                                    <label className="form-label">Select Ad Account</label>
                                    <select
                                        className="form-input"
                                        value={adAccountId}
                                        onChange={(e) => handleAdAccountSelect(e.target.value)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <option value="">Choose an ad account...</option>
                                        {fbAdAccounts.map((account) => (
                                            <option key={account.id} value={account.account_id}>
                                                {account.name} ({account.account_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{
                                marginTop: 'var(--spacing-md)',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem'
                            }}>
                                <span style={{ opacity: 0.7 }}>— or —</span>
                                <button
                                    onClick={() => setShowManualInput(!showManualInput)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--primary)',
                                        cursor: 'pointer',
                                        marginLeft: '8px',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    {showManualInput ? 'Hide manual input' : 'Enter manually'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: 'var(--spacing-md)',
                            background: 'rgba(251, 191, 36, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--spacing-md)',
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)'
                        }}>
                            ⚠️ To enable Facebook login, add <code>NEXT_PUBLIC_FACEBOOK_APP_ID</code> to your environment variables.
                        </div>
                    )}

                    {/* Manual Input Fields */}
                    {(showManualInput || !FB_APP_ID) && (
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
                                        setMarketingConnectionStatus('untested');
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
                                    placeholder="Your Meta Marketing API token"
                                    value={marketingAccessToken}
                                    onChange={(e) => {
                                        setMarketingAccessToken(e.target.value);
                                        setMarketingConnectionStatus('untested');
                                    }}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    Generate at developers.facebook.com → Tools → Access Token
                                </small>
                            </div>
                        </div>
                    )}

                    {(showManualInput || !FB_APP_ID) && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleTestMarketingConnection}
                                disabled={marketingConnectionStatus === 'testing' || !adAccountId || !marketingAccessToken}
                            >
                                {marketingConnectionStatus === 'testing' ? '🔄 Testing...' : '🔗 Test Connection'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleSaveMarketingSettings}
                                disabled={!adAccountId || !marketingAccessToken}
                            >
                                💾 Save Settings
                            </button>
                        </div>
                    )}

                    {marketingConnectionStatus === 'connected' && (
                        <div style={{
                            marginTop: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}>
                            ✅ Connected! Ad results will auto-fetch when you enter an Ad ID during upload.
                        </div>
                    )}
                </div>

                {/* Meta Conversions API (CAPI) Settings */}
                <div className={`glass-card ${styles.settingsCard}`} style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                }}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </div>
                        <div>
                            <h3>Conversions API (CAPI)</h3>
                            <p>Send conversion events & receive webhooks</p>
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
                            <label className="form-label">Dataset ID</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., 1234567890123456"
                                value={datasetId}
                                onChange={(e) => {
                                    setDatasetId(e.target.value);
                                    setCapiConnectionStatus('untested');
                                }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Find in Events Manager → Data Sources → Your Offline Dataset
                            </small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">CAPI Access Token</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Generate in Events Manager → Settings"
                                value={capiAccessToken}
                                onChange={(e) => {
                                    setCapiAccessToken(e.target.value);
                                    setCapiConnectionStatus('untested');
                                }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Generate in Events Manager → Settings → Generate Access Token
                            </small>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleTestCapiConnection}
                            disabled={capiConnectionStatus === 'testing' || !datasetId || !capiAccessToken}
                        >
                            {capiConnectionStatus === 'testing' ? '🔄 Testing...' : '🔗 Test Connection'}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleSaveCapiSettings}
                            disabled={!datasetId || !capiAccessToken}
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
                            ✅ CAPI Connected! You can now send conversion events and receive webhook data.
                        </div>
                    )}
                </div>

                {/* Collective Intelligence */}
                <Link href="/settings/collective" style={{ textDecoration: 'none' }}>
                    <div className={`glass-card ${styles.settingsCard}`} style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #10B981, #3B82F6)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4" />
                                    <path d="M12 8h.01" />
                                </svg>
                            </div>
                            <div>
                                <h3>🧠 Collective Intelligence</h3>
                                <p>Share anonymized insights & learn from the community</p>
                            </div>
                            <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 'var(--spacing-sm)' }}>
                            Configure your participation mode: Private Only, Contribute & Receive, or Receive Only.
                            Improve predictions by learning from anonymized patterns across all Athena users.
                        </p>
                    </div>
                </Link>

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
                            {modelStats.dataPoints === 0
                                ? 'Start adding videos to train the AI model'
                                : `${modelStats.dataPoints} videos analyzed - model continuously improving!`}
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
