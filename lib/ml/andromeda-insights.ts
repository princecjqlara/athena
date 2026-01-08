/**
 * Andromeda Insights Generator
 * 
 * Uses the Meta Andromeda Strategy from facebookadscreatives.json to:
 * - Analyze why winning ads performed well
 * - Generate "Why This Worked" explanations based on traits
 * - Provide actionable suggestions for new creatives
 * - Only suggest when actual traits exist (no guessing)
 */

import andromedaStrategy from '@/facebookadscreatives.json';

// ============================================
// TYPES
// ============================================

export interface WinningInsight {
    adId: string;
    score: number;
    winningTraits: string[];
    creativeType: CreativeTypeMatch;
    whyItWorked: string;
    replicateSuggestion: string;
    confidenceLevel: 'high' | 'medium' | 'low';
    traitContributions: TraitContribution[];
}

export interface TraitContribution {
    trait: string;
    impact: 'positive' | 'negative' | 'neutral';
    reason: string;
    weight: number;
}

export interface CreativeTypeMatch {
    type: string;
    purpose: string;
    matchScore: number;
    matchedTraits: string[];
}

// Extract creative types from the strategy
const CREATIVE_TYPES = andromedaStrategy.meta_strategy_documentation.creative_mix_requirements;

// Trait patterns that indicate good performance
const POSITIVE_TRAIT_PATTERNS: Record<string, { weight: number; reason: string }> = {
    // Visual elements
    'isUGCStyle': { weight: 15, reason: 'UGC style builds authenticity and trust' },
    'hasSubtitles': { weight: 12, reason: '85% watch with sound off - subtitles keep attention' },
    'hasTextOverlays': { weight: 8, reason: 'Text overlays reinforce key messages' },
    'hasVoiceover': { weight: 10, reason: 'Voiceover guides viewer through the story' },
    'facePresence': { weight: 12, reason: 'Human faces create emotional connection' },

    // Hook types
    'hookType:curiosity': { weight: 15, reason: 'Curiosity hooks create pattern interrupt' },
    'hookType:problem_solution': { weight: 14, reason: 'Problem-solution addresses user pain points' },
    'hookType:transformation': { weight: 13, reason: 'Transformation shows tangible results' },
    'hookType:testimonial': { weight: 12, reason: 'Testimonials provide social proof' },
    'hookType:question': { weight: 10, reason: 'Questions engage viewers mentally' },

    // Content categories that work
    'contentCategory:testimonial': { weight: 14, reason: 'Social proof validates purchase decisions' },
    'contentCategory:product_demo': { weight: 12, reason: 'Demos show product value clearly' },
    'contentCategory:ugc': { weight: 14, reason: 'UGC feels authentic and relatable' },
    'contentCategory:behind_the_scenes': { weight: 10, reason: 'BTS builds brand trust and affinity' },

    // Format optimizations
    'aspectRatio:9:16': { weight: 8, reason: 'Vertical fills mobile screen - higher engagement' },
    'aspectRatio:4:5': { weight: 6, reason: '4:5 works well in feed placement' },

    // CTA strength
    'ctaStrength:strong': { weight: 10, reason: 'Strong CTAs drive action' },

    // Pattern types
    'patternType:social_proof': { weight: 12, reason: 'Social proof reduces purchase anxiety' },
    'patternType:fomo': { weight: 10, reason: 'FOMO creates urgency to act' },
    'patternType:problem_solution': { weight: 14, reason: 'Problem-solution targets unaware users' },
};

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Extract traits from ad data
 */
export function extractTraitsFromAd(ad: Record<string, unknown>): string[] {
    const traits: string[] = [];
    const content = ad.extractedContent as Record<string, unknown> | undefined;

    if (!content) return traits;

    // Boolean traits
    if (content.isUGCStyle) traits.push('isUGCStyle');
    if (content.hasSubtitles) traits.push('hasSubtitles');
    if (content.hasTextOverlays) traits.push('hasTextOverlays');
    if (content.hasVoiceover) traits.push('hasVoiceover');
    if (content.facePresence) traits.push('facePresence');
    if (content.curiosityGap) traits.push('curiosityGap');
    if (content.painPointAddressing) traits.push('painPointAddressing');

    // Typed traits
    if (content.hookType && content.hookType !== 'other') {
        traits.push(`hookType:${content.hookType}`);
    }
    if (content.contentCategory && content.contentCategory !== 'other') {
        traits.push(`contentCategory:${content.contentCategory}`);
    }
    if (content.aspectRatio && content.aspectRatio !== 'other') {
        traits.push(`aspectRatio:${content.aspectRatio}`);
    }
    if (content.patternType) {
        traits.push(`patternType:${content.patternType}`);
    }
    if (content.ctaStrength) {
        traits.push(`ctaStrength:${content.ctaStrength}`);
    }
    if (content.colorScheme && content.colorScheme !== 'other') {
        traits.push(`colorScheme:${content.colorScheme}`);
    }
    if (content.editingStyle && content.editingStyle !== 'other') {
        traits.push(`editingStyle:${content.editingStyle}`);
    }
    if (content.musicType && content.musicType !== 'other') {
        traits.push(`musicType:${content.musicType}`);
    }
    if (content.mediaType) {
        traits.push(`mediaType:${content.mediaType}`);
    }

    // Custom traits
    if (Array.isArray(content.customTraits)) {
        content.customTraits.forEach((t: string) => traits.push(`custom:${t}`));
    }

    return traits;
}

/**
 * Match ad to Andromeda creative type
 */
export function matchCreativeType(traits: string[]): CreativeTypeMatch {
    const typeScores: { type: typeof CREATIVE_TYPES[0]; score: number; matchedTraits: string[] }[] = [];

    for (const creativeType of CREATIVE_TYPES) {
        const matchedTraits: string[] = [];
        let score = 0;

        switch (creativeType.type) {
            case 'Problem_Solution':
                if (traits.includes('patternType:problem_solution')) { score += 30; matchedTraits.push('problem_solution pattern'); }
                if (traits.includes('hookType:problem_solution')) { score += 25; matchedTraits.push('problem/solution hook'); }
                if (traits.includes('painPointAddressing')) { score += 20; matchedTraits.push('addresses pain points'); }
                break;

            case 'Us_Vs_Them':
                if (traits.includes('patternType:comparison')) { score += 35; matchedTraits.push('comparison pattern'); }
                if (traits.some(t => t.includes('comparison'))) { score += 25; matchedTraits.push('comparison elements'); }
                break;

            case 'Founder_Story_BTS':
                if (traits.includes('contentCategory:behind_the_scenes')) { score += 35; matchedTraits.push('behind the scenes'); }
                if (traits.includes('hookType:story')) { score += 20; matchedTraits.push('story hook'); }
                if (traits.includes('facePresence')) { score += 15; matchedTraits.push('person visible'); }
                break;

            case 'UGC_Testimonial':
                if (traits.includes('isUGCStyle')) { score += 30; matchedTraits.push('UGC style'); }
                if (traits.includes('contentCategory:testimonial')) { score += 25; matchedTraits.push('testimonial content'); }
                if (traits.includes('hookType:testimonial')) { score += 20; matchedTraits.push('testimonial hook'); }
                if (traits.includes('patternType:social_proof')) { score += 15; matchedTraits.push('social proof'); }
                break;

            case 'Direct_Offer_Static':
                if (traits.includes('mediaType:photo')) { score += 25; matchedTraits.push('static image'); }
                if (traits.includes('ctaStrength:strong')) { score += 25; matchedTraits.push('strong CTA'); }
                if (traits.includes('patternType:fomo')) { score += 20; matchedTraits.push('urgency/FOMO'); }
                break;
        }

        if (score > 0) {
            typeScores.push({ type: creativeType, score, matchedTraits });
        }
    }

    // Sort by score and return best match
    typeScores.sort((a, b) => b.score - a.score);

    if (typeScores.length > 0) {
        const best = typeScores[0];
        return {
            type: best.type.type,
            purpose: best.type.purpose,
            matchScore: Math.min(100, best.score),
            matchedTraits: best.matchedTraits
        };
    }

    return {
        type: 'Unknown',
        purpose: 'Creative type could not be determined',
        matchScore: 0,
        matchedTraits: []
    };
}

/**
 * Calculate trait contributions to success
 */
export function analyzeTraitContributions(traits: string[]): TraitContribution[] {
    const contributions: TraitContribution[] = [];

    for (const trait of traits) {
        const pattern = POSITIVE_TRAIT_PATTERNS[trait];
        if (pattern) {
            contributions.push({
                trait: trait.replace(/_/g, ' ').replace(/:/g, ': '),
                impact: 'positive',
                reason: pattern.reason,
                weight: pattern.weight
            });
        }
    }

    // Sort by weight
    contributions.sort((a, b) => b.weight - a.weight);

    return contributions;
}

/**
 * Generate "Why This Worked" explanation
 */
export function generateWhyItWorked(
    traits: string[],
    creativeType: CreativeTypeMatch,
    contributions: TraitContribution[]
): string {
    if (traits.length === 0 || contributions.length === 0) {
        return '';
    }

    const topContributions = contributions.slice(0, 3);
    const traitList = topContributions.map(c => c.trait.split(':').pop() || c.trait).join(' + ');

    let explanation = `This ${creativeType.type.replace(/_/g, ' ')} ad worked because: `;
    explanation += traitList;

    if (topContributions[0]) {
        explanation += `. ${topContributions[0].reason}`;
    }

    return explanation;
}

/**
 * Generate replication suggestion
 */
export function generateReplicateSuggestion(
    creativeType: CreativeTypeMatch,
    contributions: TraitContribution[]
): string {
    if (contributions.length === 0) return '';

    const topTraits = contributions.slice(0, 2).map(c =>
        c.trait.split(':').pop() || c.trait
    ).join(' and ');

    return `Try: Create another ${creativeType.type.replace(/_/g, ' ')} with ${topTraits}`;
}

// ============================================
// MAIN INSIGHT GENERATOR
// ============================================

/**
 * Generate winning insight for an ad
 * Returns null if ad has no traits or score is too low
 */
export function generateWinningInsight(
    ad: Record<string, unknown>,
    minScore: number = 70
): WinningInsight | null {
    const score = (ad.successScore as number) ?? (ad.score as number) ?? 0;

    // Only analyze high-performing ads
    if (score < minScore) {
        return null;
    }

    // Extract traits - if no traits, return null (no guessing)
    const traits = extractTraitsFromAd(ad);
    if (traits.length === 0) {
        return null;
    }

    // Analyze
    const creativeType = matchCreativeType(traits);
    const contributions = analyzeTraitContributions(traits);

    // Need at least some positive contributions to explain
    if (contributions.length === 0) {
        return null;
    }

    const whyItWorked = generateWhyItWorked(traits, creativeType, contributions);
    const replicateSuggestion = generateReplicateSuggestion(creativeType, contributions);

    // Determine confidence
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (contributions.length >= 4 && creativeType.matchScore >= 50) {
        confidenceLevel = 'high';
    } else if (contributions.length >= 2 || creativeType.matchScore >= 30) {
        confidenceLevel = 'medium';
    }

    return {
        adId: ad.id as string,
        score,
        winningTraits: traits.map(t => t.replace(/_/g, ' ').replace(/:/g, ': ')),
        creativeType,
        whyItWorked,
        replicateSuggestion,
        confidenceLevel,
        traitContributions: contributions
    };
}

/**
 * Analyze all ads and generate insights for winners
 */
export function analyzeWinningAds(
    ads: Record<string, unknown>[],
    minScore: number = 70
): WinningInsight[] {
    const insights: WinningInsight[] = [];

    for (const ad of ads) {
        const insight = generateWinningInsight(ad, minScore);
        if (insight) {
            insights.push(insight);
        }
    }

    // Sort by score descending
    insights.sort((a, b) => b.score - a.score);

    return insights;
}

/**
 * Get Andromeda strategy info (for display)
 */
export function getAndromedaStrategyInfo() {
    const doc = andromedaStrategy.meta_strategy_documentation;
    return {
        title: doc.title,
        source: doc.source_reference,
        philosophy: doc.core_philosophy,
        creativeTypes: doc.creative_mix_requirements,
        portfolioBalance: doc.creative_execution_workflow.step_4_portfolio_balance,
        optimizationRules: doc.optimization_rules
    };
}
