/**
 * AIPreferencesPanel Component
 * User settings for AI recommendations
 */

'use client';

import { useState, useEffect } from 'react';
import styles from './AIPreferencesPanel.module.css';

interface AIPreferences {
    user_id: string;
    primary_kpi: string;
    secondary_kpis: string[];
    kpi_targets: Record<string, number>;
    min_budget: number | null;
    max_budget: number | null;
    never_pause_entities: string[];
    never_recommend_actions: string[];
    alert_thresholds: Record<string, number>;
    notification_channels: string[];
}

interface AIPreferencesPanelProps {
    userId: string;
    orgId: string;
    onSave?: () => void;
}

const KPI_OPTIONS = [
    { value: 'roas', label: 'ROAS (Return on Ad Spend)' },
    { value: 'cpa', label: 'CPA (Cost per Acquisition)' },
    { value: 'ctr', label: 'CTR (Click-through Rate)' },
    { value: 'cvr', label: 'CVR (Conversion Rate)' },
    { value: 'spend', label: 'Total Spend' },
    { value: 'conversions', label: 'Total Conversions' }
];

const ACTION_OPTIONS = [
    { value: 'pause', label: 'Pause ads' },
    { value: 'budget_increase', label: 'Increase budget' },
    { value: 'budget_decrease', label: 'Decrease budget' },
    { value: 'scale', label: 'Scale campaigns' },
    { value: 'creative_refresh', label: 'Refresh creatives' }
];

export default function AIPreferencesPanel({ userId, orgId, onSave }: AIPreferencesPanelProps) {
    const [preferences, setPreferences] = useState<AIPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchPreferences();
    }, [userId]);

    const fetchPreferences = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/ai/preferences?userId=${userId}`);
            const data = await res.json();

            if (data.success) {
                setPreferences(data.preferences);
            }
        } catch (error) {
            console.error('Error fetching preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async () => {
        if (!preferences) return;

        try {
            setSaving(true);

            const res = await fetch('/api/ai/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    orgId,
                    primaryKpi: preferences.primary_kpi,
                    secondaryKpis: preferences.secondary_kpis,
                    kpiTargets: preferences.kpi_targets,
                    minBudget: preferences.min_budget,
                    maxBudget: preferences.max_budget,
                    neverPauseEntities: preferences.never_pause_entities,
                    neverRecommendActions: preferences.never_recommend_actions,
                    alertThresholds: preferences.alert_thresholds,
                    notificationChannels: preferences.notification_channels
                })
            });

            const data = await res.json();

            if (data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                if (onSave) onSave();
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
        } finally {
            setSaving(false);
        }
    };

    const updatePreference = <K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) => {
        if (preferences) {
            setPreferences({ ...preferences, [key]: value });
        }
    };

    const toggleSecondaryKpi = (kpi: string) => {
        if (!preferences) return;

        const current = preferences.secondary_kpis || [];
        const updated = current.includes(kpi)
            ? current.filter(k => k !== kpi)
            : [...current, kpi];

        updatePreference('secondary_kpis', updated);
    };

    const toggleNeverRecommend = (action: string) => {
        if (!preferences) return;

        const current = preferences.never_recommend_actions || [];
        const updated = current.includes(action)
            ? current.filter(a => a !== action)
            : [...current, action];

        updatePreference('never_recommend_actions', updated);
    };

    if (loading) {
        return <div className={styles.loading}>Loading preferences...</div>;
    }

    if (!preferences) {
        return <div className={styles.error}>Failed to load preferences</div>;
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h2 className={styles.title}>⚙️ AI Preferences</h2>
                <p className={styles.subtitle}>
                    Customize how Athena generates recommendations
                </p>
            </div>

            {/* Primary KPI */}
            <div className={styles.section}>
                <h3>Primary KPI</h3>
                <p className={styles.hint}>The main metric Athena will optimize for</p>
                <select
                    value={preferences.primary_kpi}
                    onChange={(e) => updatePreference('primary_kpi', e.target.value)}
                    className={styles.select}
                >
                    {KPI_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Secondary KPIs */}
            <div className={styles.section}>
                <h3>Secondary KPIs</h3>
                <p className={styles.hint}>Additional metrics to consider</p>
                <div className={styles.checkboxGroup}>
                    {KPI_OPTIONS.filter(k => k.value !== preferences.primary_kpi).map(opt => (
                        <label key={opt.value} className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={preferences.secondary_kpis?.includes(opt.value)}
                                onChange={() => toggleSecondaryKpi(opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </div>

            {/* KPI Targets */}
            <div className={styles.section}>
                <h3>KPI Targets</h3>
                <p className={styles.hint}>Your goal values for key metrics</p>
                <div className={styles.targetInputs}>
                    <div className={styles.targetInput}>
                        <label>Target ROAS</label>
                        <input
                            type="number"
                            step="0.1"
                            value={preferences.kpi_targets?.roas || ''}
                            onChange={(e) => updatePreference('kpi_targets', {
                                ...preferences.kpi_targets,
                                roas: parseFloat(e.target.value) || 0
                            })}
                        />
                    </div>
                    <div className={styles.targetInput}>
                        <label>Target CPA (₱)</label>
                        <input
                            type="number"
                            step="1"
                            value={preferences.kpi_targets?.cpa || ''}
                            onChange={(e) => updatePreference('kpi_targets', {
                                ...preferences.kpi_targets,
                                cpa: parseFloat(e.target.value) || 0
                            })}
                        />
                    </div>
                </div>
            </div>

            {/* Budget Constraints */}
            <div className={styles.section}>
                <h3>Budget Constraints</h3>
                <p className={styles.hint}>Min/max daily budget limits</p>
                <div className={styles.targetInputs}>
                    <div className={styles.targetInput}>
                        <label>Min Budget (₱)</label>
                        <input
                            type="number"
                            value={preferences.min_budget || ''}
                            onChange={(e) => updatePreference('min_budget', parseFloat(e.target.value) || null)}
                        />
                    </div>
                    <div className={styles.targetInput}>
                        <label>Max Budget (₱)</label>
                        <input
                            type="number"
                            value={preferences.max_budget || ''}
                            onChange={(e) => updatePreference('max_budget', parseFloat(e.target.value) || null)}
                        />
                    </div>
                </div>
            </div>

            {/* Never Recommend */}
            <div className={styles.section}>
                <h3>Never Recommend</h3>
                <p className={styles.hint}>Actions Athena should never suggest</p>
                <div className={styles.checkboxGroup}>
                    {ACTION_OPTIONS.map(opt => (
                        <label key={opt.value} className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={preferences.never_recommend_actions?.includes(opt.value)}
                                onChange={() => toggleNeverRecommend(opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <div className={styles.footer}>
                <button
                    className={styles.saveBtn}
                    onClick={savePreferences}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Preferences'}
                </button>
            </div>
        </div>
    );
}
