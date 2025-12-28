/**
 * Data Sync Utility
 * Provides functions to sync localStorage data with Supabase
 */

// Get user ID from localStorage or auth
export function getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('athena_user_id') || localStorage.getItem('fb_user_id') || null;
}

// Check if sync is available
export function isSyncAvailable(): boolean {
    return typeof window !== 'undefined' && !!getUserId();
}

/**
 * Save all localStorage data to Supabase
 */
export async function saveToCloud(): Promise<{ success: boolean; message: string }> {
    const userId = getUserId();
    if (!userId) {
        return { success: false, message: 'No user ID found. Please login first.' };
    }

    try {
        // Collect all localStorage data
        const ads = JSON.parse(localStorage.getItem('ads') || '[]');
        const pipelines = JSON.parse(localStorage.getItem('pipelines') || '[]');
        const contacts = JSON.parse(localStorage.getItem('pipeline_contacts') || '[]');

        // Collect leads for each pipeline
        const leads: { pipelineId: string; leads: any[] }[] = [];
        pipelines.forEach((pipeline: any) => {
            const pipelineLeads = JSON.parse(localStorage.getItem(`pipeline_leads_${pipeline.id}`) || '[]');
            if (pipelineLeads.length > 0) {
                leads.push({ pipelineId: pipeline.id, leads: pipelineLeads });
            }
        });

        // Collect settings and ML data
        const settings = {
            general: {
                meta_ad_account_id: localStorage.getItem('meta_ad_account_id'),
                meta_marketing_token: localStorage.getItem('meta_marketing_token'),
                meta_dataset_id: localStorage.getItem('meta_dataset_id'),
                meta_capi_token: localStorage.getItem('meta_capi_token'),
                fb_pages: localStorage.getItem('fb_pages'),
                fb_selected_page_id: localStorage.getItem('fb_selected_page_id'),
            },
            mlWeights: JSON.parse(localStorage.getItem('ml_feature_weights') || 'null'),
            mlTrainingData: JSON.parse(localStorage.getItem('ads-algorithm-training-data') || 'null'),
        };

        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                ads,
                pipelines,
                leads,
                contacts,
                settings
            })
        });

        const result = await response.json();
        if (result.success) {
            localStorage.setItem('last_cloud_sync', new Date().toISOString());
            return { success: true, message: `Synced to cloud: ${ads.length} ads, ${pipelines.length} pipelines` };
        } else {
            return { success: false, message: result.error || 'Sync failed' };
        }

    } catch (error) {
        console.error('[Sync] Save error:', error);
        return { success: false, message: 'Failed to save to cloud' };
    }
}

/**
 * Load all data from Supabase to localStorage
 */
export async function loadFromCloud(): Promise<{ success: boolean; message: string }> {
    const userId = getUserId();
    if (!userId) {
        return { success: false, message: 'No user ID found. Please login first.' };
    }

    try {
        const response = await fetch(`/api/sync?userId=${encodeURIComponent(userId)}`);
        const result = await response.json();

        if (!result.success) {
            return { success: false, message: result.error || 'Load failed' };
        }

        const { ads, pipelines, leadsByPipeline, contacts, settings, mlWeights, mlTrainingData } = result.data;

        // Restore ads
        if (ads && ads.length > 0) {
            localStorage.setItem('ads', JSON.stringify(ads));
        }

        // Restore pipelines
        if (pipelines && pipelines.length > 0) {
            localStorage.setItem('pipelines', JSON.stringify(pipelines));
        }

        // Restore leads for each pipeline
        if (leadsByPipeline) {
            Object.entries(leadsByPipeline).forEach(([pipelineId, leads]) => {
                localStorage.setItem(`pipeline_leads_${pipelineId}`, JSON.stringify(leads));
            });
        }

        // Restore contacts
        if (contacts && contacts.length > 0) {
            localStorage.setItem('pipeline_contacts', JSON.stringify(contacts));
        }

        // Restore settings
        if (settings) {
            Object.entries(settings).forEach(([key, value]) => {
                if (value) localStorage.setItem(key, String(value));
            });
        }

        // Restore ML data
        if (mlWeights) {
            localStorage.setItem('ml_feature_weights', JSON.stringify(mlWeights));
        }
        if (mlTrainingData) {
            localStorage.setItem('ads-algorithm-training-data', JSON.stringify(mlTrainingData));
        }

        localStorage.setItem('last_cloud_sync', new Date().toISOString());
        return {
            success: true,
            message: `Loaded from cloud: ${ads?.length || 0} ads, ${pipelines?.length || 0} pipelines`
        };

    } catch (error) {
        console.error('[Sync] Load error:', error);
        return { success: false, message: 'Failed to load from cloud' };
    }
}

/**
 * Export all localStorage data to JSON file
 */
export function exportBackup(): void {
    const backup: Record<string, any> = {};

    // Collect all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            try {
                backup[key] = JSON.parse(localStorage.getItem(key) || '');
            } catch {
                backup[key] = localStorage.getItem(key);
            }
        }
    }

    // Create and download file
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athena-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import localStorage data from JSON file
 */
export async function importBackup(file: File): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target?.result as string);
                let count = 0;

                Object.entries(backup).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        localStorage.setItem(key, value);
                    } else {
                        localStorage.setItem(key, JSON.stringify(value));
                    }
                    count++;
                });

                resolve({ success: true, message: `Restored ${count} items from backup` });
            } catch (error) {
                resolve({ success: false, message: 'Invalid backup file format' });
            }
        };
        reader.onerror = () => resolve({ success: false, message: 'Failed to read backup file' });
        reader.readAsText(file);
    });
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('last_cloud_sync');
}
