/**
 * Marketplace Module Index
 * 
 * Exports all marketplace data safety functionality.
 */

// Data sanitization
export {
    sanitizeTraitEffect,
    sanitizeObject,
    validateMarketplaceDataset,
    createMarketplaceDataset,
    isBlockedField,
} from './data-sanitizer';

export type {
    SanitizedMarketplaceData,
    MarketplaceDataset,
} from './data-sanitizer';

// Privacy filtering
export {
    getPrivacySettings,
    updatePrivacySettings,
    detectDataGaps,
    datasetFillsGaps,
    validateSuggestion,
    applyMarketplaceDataset,
    getMarketplaceSuggestions,
} from './privacy-filter';

export type {
    DataGap,
    MarketplaceSuggestion,
    SuggestionValidation,
    PrivacySettings,
} from './privacy-filter';
