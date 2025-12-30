/**
 * Orb Storage Module
 * 
 * LocalStorage-based storage for AdOrbs with embedding caching.
 * Compatible with existing localStorage patterns in the app.
 */

import { AdOrb, StoredOrb, OrbStoreState } from './types';
import { orbHasResults } from './ad-orb';

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEY = 'rag_orb_store';
const STORAGE_META_KEY = 'rag_orb_store_meta';

// ============================================
// INTERNAL STATE
// ============================================

let orbCache: Map<string, StoredOrb> = new Map();
let isLoaded = false;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
    try {
        if (typeof window === 'undefined') return false;
        const test = '__storage_test__';
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Load orbs from localStorage into cache
 */
function loadFromStorage(): void {
    if (!isLocalStorageAvailable()) {
        isLoaded = true;
        return;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored) as Record<string, StoredOrb>;
            orbCache = new Map(Object.entries(data));
        }
    } catch (error) {
        console.error('Failed to load orb store from localStorage:', error);
    }

    isLoaded = true;
}

/**
 * Save orbs cache to localStorage
 */
function saveToStorage(): void {
    if (!isLocalStorageAvailable()) return;

    try {
        const data = Object.fromEntries(orbCache.entries());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // Update metadata
        const meta: OrbStoreState = {
            orbs: {},
            lastUpdated: new Date().toISOString(),
            totalOrbs: orbCache.size,
            orbsWithEmbeddings: [...orbCache.values()].filter(s => s.orb.embedding).length,
            orbsWithResults: [...orbCache.values()].filter(s => orbHasResults(s.orb)).length,
        };
        localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    } catch (error) {
        console.error('Failed to save orb store to localStorage:', error);
    }
}

/**
 * Ensure store is loaded
 */
function ensureLoaded(): void {
    if (!isLoaded) {
        loadFromStorage();
    }
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Save or update an orb in the store
 */
export function saveOrb(orb: AdOrb): void {
    ensureLoaded();

    const stored: StoredOrb = {
        orb,
        embeddingGeneratedAt: orb.embedding ? new Date().toISOString() : undefined,
        lastAccessedAt: new Date().toISOString(),
    };

    orbCache.set(orb.id, stored);
    saveToStorage();
}

/**
 * Save multiple orbs
 */
export function saveOrbs(orbs: AdOrb[]): void {
    ensureLoaded();

    const now = new Date().toISOString();
    for (const orb of orbs) {
        const stored: StoredOrb = {
            orb,
            embeddingGeneratedAt: orb.embedding ? now : undefined,
            lastAccessedAt: now,
        };
        orbCache.set(orb.id, stored);
    }

    saveToStorage();
}

/**
 * Get an orb by ID
 */
export function getOrb(id: string): AdOrb | undefined {
    ensureLoaded();

    const stored = orbCache.get(id);
    if (stored) {
        // Update last accessed time
        stored.lastAccessedAt = new Date().toISOString();
        return stored.orb;
    }

    return undefined;
}

/**
 * Get all orbs
 */
export function getAllOrbs(): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()].map(s => s.orb);
}

/**
 * Get orbs that have results
 */
export function getOrbsWithResults(): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()]
        .filter(s => orbHasResults(s.orb))
        .map(s => s.orb);
}

/**
 * Get orbs that have embeddings
 */
export function getOrbsWithEmbeddings(): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()]
        .filter(s => s.orb.embedding !== undefined)
        .map(s => s.orb);
}

/**
 * Get orbs that need embeddings generated
 */
export function getOrbsNeedingEmbeddings(): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()]
        .filter(s => s.orb.embedding === undefined)
        .map(s => s.orb);
}

/**
 * Delete an orb from the store
 */
export function deleteOrb(id: string): boolean {
    ensureLoaded();

    const deleted = orbCache.delete(id);
    if (deleted) {
        saveToStorage();
    }

    return deleted;
}

/**
 * Clear all orbs from the store
 */
export function clearOrbStore(): void {
    orbCache.clear();
    if (isLocalStorageAvailable()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_META_KEY);
    }
    isLoaded = true;
}

// ============================================
// STORE STATISTICS
// ============================================

/**
 * Get store state/statistics
 */
export function getOrbStoreState(): OrbStoreState {
    ensureLoaded();

    return {
        orbs: {},
        lastUpdated: new Date().toISOString(),
        totalOrbs: orbCache.size,
        orbsWithEmbeddings: [...orbCache.values()].filter(s => s.orb.embedding).length,
        orbsWithResults: [...orbCache.values()].filter(s => orbHasResults(s.orb)).length,
    };
}

/**
 * Check if store has any orbs
 */
export function hasOrbs(): boolean {
    ensureLoaded();
    return orbCache.size > 0;
}

/**
 * Get count of orbs
 */
export function getOrbCount(): number {
    ensureLoaded();
    return orbCache.size;
}

// ============================================
// EMBEDDING MANAGEMENT
// ============================================

/**
 * Update embedding for an orb
 */
export function updateOrbEmbedding(id: string, embedding: number[], canonicalText?: string): boolean {
    ensureLoaded();

    const stored = orbCache.get(id);
    if (!stored) {
        return false;
    }

    stored.orb.embedding = embedding;
    stored.orb.canonicalText = canonicalText;
    stored.embeddingGeneratedAt = new Date().toISOString();

    saveToStorage();
    return true;
}

/**
 * Check if orb has valid embedding
 */
export function orbHasEmbedding(id: string): boolean {
    ensureLoaded();

    const stored = orbCache.get(id);
    return stored?.orb.embedding !== undefined;
}

// ============================================
// SEARCH & FILTER
// ============================================

/**
 * Get orbs by platform
 */
export function getOrbsByPlatform(platform: string): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()]
        .filter(s => s.orb.metadata.platform === platform)
        .map(s => s.orb);
}

/**
 * Get orbs created within date range
 */
export function getOrbsByDateRange(startDate: Date, endDate: Date): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()]
        .filter(s => {
            const createdAt = new Date(s.orb.metadata.createdAt);
            return createdAt >= startDate && createdAt <= endDate;
        })
        .map(s => s.orb);
}

/**
 * Get orbs with success score above threshold
 */
export function getOrbsByMinSuccessScore(minScore: number): AdOrb[] {
    ensureLoaded();
    return [...orbCache.values()]
        .filter(s => {
            const score = s.orb.results?.successScore;
            return score !== undefined && score >= minScore;
        })
        .map(s => s.orb);
}
