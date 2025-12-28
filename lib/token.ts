/**
 * Token Management Utility
 * Handles Facebook token expiry validation and refresh warnings
 */

export interface TokenStatus {
    isValid: boolean;
    isExpired: boolean;
    expiresAt: Date | null;
    expiresIn: number | null; // minutes until expiry
    type: 'short_lived' | 'long_lived' | 'unknown';
    warning: string | null;
}

/**
 * Check if Facebook token is still valid
 */
export function checkTokenStatus(): TokenStatus {
    if (typeof window === 'undefined') {
        return { isValid: false, isExpired: true, expiresAt: null, expiresIn: null, type: 'unknown', warning: 'Not in browser' };
    }

    const token = localStorage.getItem('fb_access_token');
    const expiresAtStr = localStorage.getItem('fb_token_expires_at');
    const tokenType = localStorage.getItem('fb_token_type') as 'short_lived' | 'long_lived' | null;

    if (!token) {
        return {
            isValid: false,
            isExpired: true,
            expiresAt: null,
            expiresIn: null,
            type: 'unknown',
            warning: 'No Facebook token found. Please connect your account.'
        };
    }

    if (!expiresAtStr) {
        // Token exists but no expiry - treat as valid but unknown
        return {
            isValid: true,
            isExpired: false,
            expiresAt: null,
            expiresIn: null,
            type: tokenType || 'unknown',
            warning: 'Token expiry unknown. Consider reconnecting.'
        };
    }

    const expiresAt = new Date(expiresAtStr);
    const now = new Date();
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    if (minutesUntilExpiry <= 0) {
        return {
            isValid: false,
            isExpired: true,
            expiresAt,
            expiresIn: minutesUntilExpiry,
            type: tokenType || 'unknown',
            warning: '⚠️ Your Facebook token has expired. Please reconnect your account.'
        };
    }

    if (minutesUntilExpiry <= 60) { // Less than 1 hour
        return {
            isValid: true,
            isExpired: false,
            expiresAt,
            expiresIn: minutesUntilExpiry,
            type: tokenType || 'unknown',
            warning: `⚠️ Token expires in ${minutesUntilExpiry} minutes. Consider refreshing.`
        };
    }

    if (minutesUntilExpiry <= 1440) { // Less than 24 hours
        const hours = Math.floor(minutesUntilExpiry / 60);
        return {
            isValid: true,
            isExpired: false,
            expiresAt,
            expiresIn: minutesUntilExpiry,
            type: tokenType || 'unknown',
            warning: `Token expires in ${hours} hours.`
        };
    }

    // Token is valid with plenty of time
    const days = Math.floor(minutesUntilExpiry / 1440);
    return {
        isValid: true,
        isExpired: false,
        expiresAt,
        expiresIn: minutesUntilExpiry,
        type: tokenType || 'unknown',
        warning: null
    };
}

/**
 * Get formatted time until token expires
 */
export function getTokenExpiryDisplay(): string {
    const status = checkTokenStatus();

    if (!status.expiresAt) {
        return 'Unknown';
    }

    if (status.isExpired) {
        return 'Expired';
    }

    if (status.expiresIn === null) {
        return 'Unknown';
    }

    if (status.expiresIn < 60) {
        return `${status.expiresIn} minutes`;
    }

    if (status.expiresIn < 1440) {
        const hours = Math.floor(status.expiresIn / 60);
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    const days = Math.floor(status.expiresIn / 1440);
    return `${days} day${days > 1 ? 's' : ''}`;
}

/**
 * Validate token before making Facebook API call
 * Returns true if token is valid, false if expired
 */
export function validateTokenBeforeApiCall(): { valid: boolean; message?: string } {
    const status = checkTokenStatus();

    if (!status.isValid || status.isExpired) {
        return {
            valid: false,
            message: status.warning || 'Facebook token is expired or invalid. Please reconnect your account in Settings.'
        };
    }

    return { valid: true };
}

/**
 * Clear all Facebook tokens from localStorage
 */
export function clearFacebookTokens(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('fb_access_token');
    localStorage.removeItem('fb_token_expires_at');
    localStorage.removeItem('fb_token_type');
    localStorage.removeItem('fb_user_id');
    localStorage.removeItem('fb_user_name');
    localStorage.removeItem('fb_ad_accounts');
    localStorage.removeItem('fb_pages');
    localStorage.removeItem('fb_selected_page_id');
}

// Alias for clearFacebookTokens
export const clearTokens = clearFacebookTokens;

