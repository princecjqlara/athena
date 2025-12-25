// Public Pool - Data Anonymizer
// Converts local data to privacy-preserving Z-scores for sharing

import { AdEntry, ExtractedResultsData, Platform } from '@/types';
import { getAccountBaseline, calculateZScore, AccountBaseline } from '../ml/success-normalization';

// ============================================
// TYPES
// ============================================

export interface AnonymizedInsight {
    // Categorical traits only (no text content)
    traits: string[];

    // Normalized performance (Z-score, not raw metrics)
    zScore: number;

    // Optional context (user can opt-out)
    industry?: string;
    platform?: Platform;
    spendTier?: 'low' | 'medium' | 'high';

    // Anonymized contributor (rotates monthly)
    contributorHash: string;

    // Timestamp (date only, no time for privacy)
    contributedDate: string;
}

export interface AnonymizationResult {
    insight: AnonymizedInsight;
    strippedFields: string[];  // Fields that were removed for privacy
    zScoreExplanation: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a rotating anonymous hash for contributor
 * Rotates monthly to prevent long-term tracking
 */
export function generateContributorHash(userId: string): string {
    if (typeof window === 'undefined') return 'server';

    // Get current month for rotation
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    // Create hash from userId + monthKey
    const input = `${userId}-${monthKey}`;

    // Simple hash function (in production, use crypto.subtle)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return `anon-${Math.abs(hash).toString(16)}`;
}

/**
 * Determine spend tier without revealing exact amounts
 */
function getSpendTier(spend: number | undefined): 'low' | 'medium' | 'high' {
    if (!spend) return 'low';
    if (spend < 100) return 'low';
    if (spend < 1000) return 'medium';
    return 'high';
}

/**
 * Extract categorical traits from ad data
 * Only includes non-identifying categorical values
 */
function extractTraits(ad: AdEntry): string[] {
    const traits: string[] = [];
    const content = ad.extractedContent;

    if (!content) return traits;

    // Add categorical traits
    if (content.hookType) traits.push(`hook:${content.hookType}`);
    if (content.platform) traits.push(`platform:${content.platform}`);
    if (content.contentCategory) traits.push(`content:${content.contentCategory}`);
    if (content.editingStyle) traits.push(`editing:${content.editingStyle}`);
    if (content.colorScheme) traits.push(`color:${content.colorScheme}`);
    if (content.musicType) traits.push(`music:${content.musicType}`);
    if (content.mediaType) traits.push(`media:${content.mediaType}`);

    // Add boolean traits
    if (content.hasSubtitles) traits.push('subtitles:yes');
    if (content.hasTextOverlays) traits.push('textOverlays:yes');
    if (content.hasVoiceover) traits.push('voiceover:yes');
    if (content.isUGCStyle) traits.push('ugc:yes');

    // Add CTA type if present
    if (content.cta) traits.push(`cta:${content.cta}`);

    return traits;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Anonymize a single ad insight for sharing
 */
export function anonymizeAdInsight(
    ad: AdEntry,
    results: ExtractedResultsData,
    userId: string,
    options: {
        includeIndustry?: boolean;
        includePlatform?: boolean;
        includeSpendTier?: boolean;
    } = {}
): AnonymizationResult {
    const baseline = getAccountBaseline();

    // Calculate Z-score from success score
    const zScore = calculateZScore(
        results.successScore,
        baseline.avgSuccessRating,
        baseline.stdSuccessRating
    );

    // Extract traits (categorical only)
    const traits = extractTraits(ad);

    // Build anonymized insight
    const insight: AnonymizedInsight = {
        traits,
        zScore: Math.round(zScore * 100) / 100, // Round to 2 decimals
        contributorHash: generateContributorHash(userId),
        contributedDate: new Date().toISOString().split('T')[0], // Date only
    };

    // Add optional context based on user preferences
    if (options.includePlatform && ad.extractedContent?.platform) {
        insight.platform = ad.extractedContent.platform;
    }
    if (options.includeSpendTier) {
        insight.spendTier = getSpendTier(results.adSpend);
    }
    if (options.includeIndustry) {
        insight.industry = ad.extractedContent?.industryVertical;
    }

    // List fields that were stripped for transparency
    const strippedFields = [
        'Ad copy/text',
        'URLs',
        'Exact spend amounts',
        'Revenue figures',
        'User identifiers',
        'Timestamps (time portion)',
    ];

    // Explain the Z-score
    let zScoreExplanation: string;
    if (zScore > 1) {
        zScoreExplanation = `This ad performed ${zScore.toFixed(2)} standard deviations ABOVE your average.`;
    } else if (zScore < -1) {
        zScoreExplanation = `This ad performed ${Math.abs(zScore).toFixed(2)} standard deviations BELOW your average.`;
    } else {
        zScoreExplanation = `This ad performed close to your average (Z-score: ${zScore.toFixed(2)}).`;
    }

    return {
        insight,
        strippedFields,
        zScoreExplanation,
    };
}

/**
 * Anonymize multiple ads for batch contribution
 */
export function anonymizeMultipleAds(
    adsWithResults: Array<{ ad: AdEntry; results: ExtractedResultsData }>,
    userId: string,
    options: {
        includeIndustry?: boolean;
        includePlatform?: boolean;
        includeSpendTier?: boolean;
    } = {}
): AnonymizedInsight[] {
    return adsWithResults.map(({ ad, results }) =>
        anonymizeAdInsight(ad, results, userId, options).insight
    );
}

/**
 * Validate that an insight is properly anonymized
 */
export function validateAnonymization(insight: AnonymizedInsight): {
    isValid: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    // Check for PII patterns
    if (insight.contributorHash && !insight.contributorHash.startsWith('anon-')) {
        issues.push('Contributor hash does not appear to be anonymized');
    }

    // Check traits don't contain free text
    insight.traits.forEach(trait => {
        if (trait.length > 50) {
            issues.push(`Trait "${trait.substring(0, 20)}..." appears to be free text`);
        }
        if (!trait.includes(':')) {
            issues.push(`Trait "${trait}" should be in category:value format`);
        }
    });

    // Check date is date-only (no time)
    if (insight.contributedDate && insight.contributedDate.includes('T')) {
        issues.push('Contributed date should not include time');
    }

    return {
        isValid: issues.length === 0,
        issues,
    };
}

/**
 * Get opt-in status from localStorage
 */
export function getPoolOptInStatus(): {
    optedIn: boolean;
    preferences: {
        includeIndustry: boolean;
        includePlatform: boolean;
        includeSpendTier: boolean;
    };
} {
    if (typeof window === 'undefined') {
        return {
            optedIn: false,
            preferences: {
                includeIndustry: false,
                includePlatform: true,
                includeSpendTier: true,
            },
        };
    }

    const stored = localStorage.getItem('pool_opt_in');
    if (!stored) {
        return {
            optedIn: false,
            preferences: {
                includeIndustry: false,
                includePlatform: true,
                includeSpendTier: true,
            },
        };
    }

    return JSON.parse(stored);
}

/**
 * Set opt-in status
 */
export function setPoolOptInStatus(
    optedIn: boolean,
    preferences?: {
        includeIndustry?: boolean;
        includePlatform?: boolean;
        includeSpendTier?: boolean;
    }
): void {
    if (typeof window === 'undefined') return;

    const current = getPoolOptInStatus();
    const updated = {
        optedIn,
        preferences: {
            ...current.preferences,
            ...preferences,
        },
    };

    localStorage.setItem('pool_opt_in', JSON.stringify(updated));
}
