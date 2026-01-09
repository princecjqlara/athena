/**
 * Facet-Based Intelligence System
 * 
 * Provides ML-powered insights from facet/trait data:
 * - Co-occurrence Analysis: Find winning trait combinations
 * - Contrastive Analysis: Compare winners vs losers
 * - Next Best Creative: Suggest untested high-potential combinations
 */

// ============================================
// TYPES
// ============================================

export interface FacetAd {
    id: string;
    facets: Record<string, string[]>;  // e.g., { content_hook: ['curiosity'], platform: ['tiktok'] }
    successScore: number;  // 0-100
}

export interface TraitEffect {
    trait: string;
    category: string;
    avgScoreWith: number;
    avgScoreWithout: number;
    lift: number;           // avgWith - avgWithout
    countWith: number;
    countWithout: number;
    confidence: number;     // 0-1 based on sample size
    isSignificant: boolean; // lift > 5 and confidence > 0.6
}

export interface CoOccurrence {
    traits: [string, string];
    categories: [string, string];
    avgScore: number;
    count: number;
    confidence: number;
    liftOverIndividual: number; // How much better than individual trait avg
}

export interface ContrastiveResult {
    threshold: { top: number; bottom: number };
    topCount: number;
    bottomCount: number;
    topTraits: TraitEffect[];      // Traits that winners have more
    bottomTraits: TraitEffect[];   // Traits that losers have more
    differentiators: TraitEffect[]; // Biggest absolute differences
}

export interface CreativeSuggestion {
    id: string;
    facets: Record<string, string[]>;
    flatTraits: string[];
    predictedScore: number;
    confidence: number;
    basedOn: string[];
    isNovel: boolean;        // Never tested before
    riskLevel: 'low' | 'medium' | 'high';
}

export interface FacetInsights {
    coOccurrences: CoOccurrence[];
    contrastive: ContrastiveResult;
    suggestions: CreativeSuggestion[];
    traitEffects: TraitEffect[];
    summary: {
        totalAds: number;
        avgScore: number;
        topTraits: string[];
        avoidTraits: string[];
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Flatten facets into a single array of traits
 */
function flattenFacets(facets: Record<string, string[]>): string[] {
    const traits: string[] = [];
    for (const category of Object.keys(facets)) {
        for (const trait of facets[category] || []) {
            traits.push(`${category}:${trait}`);
        }
    }
    return traits;
}

/**
 * Check if ad has a specific trait
 */
function adHasTrait(ad: FacetAd, trait: string): boolean {
    const [category, value] = trait.split(':');
    return ad.facets[category]?.includes(value) ?? false;
}

/**
 * Check if ad has all specified traits
 */
function adHasAllTraits(ad: FacetAd, traits: string[]): boolean {
    return traits.every(trait => adHasTrait(ad, trait));
}

/**
 * Calculate confidence from sample size
 */
function calculateConfidence(sampleSize: number): number {
    // Confidence increases with sample size, max at ~20 samples
    if (sampleSize < 2) return 0.1;
    if (sampleSize < 5) return 0.3;
    if (sampleSize < 10) return 0.6;
    if (sampleSize < 20) return 0.8;
    return 0.95;
}

/**
 * Get all unique traits from ads
 */
function getAllTraits(ads: FacetAd[]): string[] {
    const traitSet = new Set<string>();
    for (const ad of ads) {
        const traits = flattenFacets(ad.facets);
        traits.forEach(t => traitSet.add(t));
    }
    return Array.from(traitSet);
}

// ============================================
// TRAIT EFFECT ANALYSIS
// ============================================

/**
 * Calculate the effect (lift) of each individual trait
 */
export function calculateTraitEffects(ads: FacetAd[]): TraitEffect[] {
    if (ads.length < 3) return [];

    const allTraits = getAllTraits(ads);
    const effects: TraitEffect[] = [];

    for (const trait of allTraits) {
        const [category] = trait.split(':');

        const adsWithTrait = ads.filter(ad => adHasTrait(ad, trait));
        const adsWithoutTrait = ads.filter(ad => !adHasTrait(ad, trait));

        if (adsWithTrait.length === 0 || adsWithoutTrait.length === 0) continue;

        const avgWith = adsWithTrait.reduce((s, a) => s + a.successScore, 0) / adsWithTrait.length;
        const avgWithout = adsWithoutTrait.reduce((s, a) => s + a.successScore, 0) / adsWithoutTrait.length;
        const lift = avgWith - avgWithout;
        const confidence = calculateConfidence(Math.min(adsWithTrait.length, adsWithoutTrait.length));

        effects.push({
            trait,
            category,
            avgScoreWith: Math.round(avgWith * 10) / 10,
            avgScoreWithout: Math.round(avgWithout * 10) / 10,
            lift: Math.round(lift * 10) / 10,
            countWith: adsWithTrait.length,
            countWithout: adsWithoutTrait.length,
            confidence,
            isSignificant: Math.abs(lift) > 5 && confidence > 0.5,
        });
    }

    // Sort by absolute lift
    effects.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
    return effects;
}

// ============================================
// CO-OCCURRENCE ANALYSIS
// ============================================

/**
 * Find trait pairs that frequently occur together and their combined success rate
 */
export function analyzeCoOccurrence(ads: FacetAd[], minCount: number = 3): CoOccurrence[] {
    if (ads.length < 5) return [];

    const allTraits = getAllTraits(ads);
    const coOccurrences: CoOccurrence[] = [];

    // Get individual trait averages for comparison
    const traitAvgs = new Map<string, number>();
    for (const trait of allTraits) {
        const adsWithTrait = ads.filter(ad => adHasTrait(ad, trait));
        if (adsWithTrait.length > 0) {
            traitAvgs.set(trait, adsWithTrait.reduce((s, a) => s + a.successScore, 0) / adsWithTrait.length);
        }
    }

    // Check each pair
    for (let i = 0; i < allTraits.length; i++) {
        for (let j = i + 1; j < allTraits.length; j++) {
            const trait1 = allTraits[i];
            const trait2 = allTraits[j];

            // Skip pairs from same category
            const [cat1] = trait1.split(':');
            const [cat2] = trait2.split(':');
            if (cat1 === cat2) continue;

            const adsWithBoth = ads.filter(ad => adHasTrait(ad, trait1) && adHasTrait(ad, trait2));

            if (adsWithBoth.length >= minCount) {
                const avgScore = adsWithBoth.reduce((s, a) => s + a.successScore, 0) / adsWithBoth.length;
                const individualAvg = ((traitAvgs.get(trait1) || 50) + (traitAvgs.get(trait2) || 50)) / 2;
                const liftOverIndividual = avgScore - individualAvg;

                coOccurrences.push({
                    traits: [trait1, trait2],
                    categories: [cat1, cat2],
                    avgScore: Math.round(avgScore * 10) / 10,
                    count: adsWithBoth.length,
                    confidence: calculateConfidence(adsWithBoth.length),
                    liftOverIndividual: Math.round(liftOverIndividual * 10) / 10,
                });
            }
        }
    }

    // Sort by avgScore descending
    coOccurrences.sort((a, b) => b.avgScore - a.avgScore);
    return coOccurrences.slice(0, 20); // Top 20
}

// ============================================
// CONTRASTIVE ANALYSIS
// ============================================

/**
 * Compare top performers vs bottom performers
 * Returns traits that differentiate winners from losers
 */
export function runContrastiveAnalysis(
    ads: FacetAd[],
    topPercentile: number = 25,
    bottomPercentile: number = 25
): ContrastiveResult {
    if (ads.length < 8) {
        return {
            threshold: { top: 0, bottom: 0 },
            topCount: 0,
            bottomCount: 0,
            topTraits: [],
            bottomTraits: [],
            differentiators: [],
        };
    }

    // Sort ads by score
    const sorted = [...ads].sort((a, b) => b.successScore - a.successScore);

    const topCount = Math.max(2, Math.floor(ads.length * (topPercentile / 100)));
    const bottomCount = Math.max(2, Math.floor(ads.length * (bottomPercentile / 100)));

    const topAds = sorted.slice(0, topCount);
    const bottomAds = sorted.slice(-bottomCount);

    const topThreshold = topAds[topAds.length - 1]?.successScore || 0;
    const bottomThreshold = bottomAds[0]?.successScore || 0;

    const allTraits = getAllTraits(ads);
    const traitComparison: TraitEffect[] = [];

    for (const trait of allTraits) {
        const [category] = trait.split(':');

        const topHasTrait = topAds.filter(ad => adHasTrait(ad, trait)).length;
        const bottomHasTrait = bottomAds.filter(ad => adHasTrait(ad, trait)).length;

        const topRate = topHasTrait / topAds.length;
        const bottomRate = bottomHasTrait / bottomAds.length;
        const lift = (topRate - bottomRate) * 100; // Percentage points difference

        // Calculate average scores
        const adsWithTrait = ads.filter(ad => adHasTrait(ad, trait));
        const adsWithoutTrait = ads.filter(ad => !adHasTrait(ad, trait));
        const avgWith = adsWithTrait.length > 0
            ? adsWithTrait.reduce((s, a) => s + a.successScore, 0) / adsWithTrait.length
            : 50;
        const avgWithout = adsWithoutTrait.length > 0
            ? adsWithoutTrait.reduce((s, a) => s + a.successScore, 0) / adsWithoutTrait.length
            : 50;

        const confidence = calculateConfidence(Math.min(topHasTrait + bottomHasTrait, 10));

        traitComparison.push({
            trait,
            category,
            avgScoreWith: Math.round(avgWith * 10) / 10,
            avgScoreWithout: Math.round(avgWithout * 10) / 10,
            lift: Math.round(lift * 10) / 10,
            countWith: adsWithTrait.length,
            countWithout: adsWithoutTrait.length,
            confidence,
            isSignificant: Math.abs(lift) > 20 && confidence > 0.4,
        });
    }

    // Sort by lift
    const sorted_traits = [...traitComparison].sort((a, b) => b.lift - a.lift);

    return {
        threshold: { top: topThreshold, bottom: bottomThreshold },
        topCount: topAds.length,
        bottomCount: bottomAds.length,
        topTraits: sorted_traits.filter(t => t.lift > 15).slice(0, 10),
        bottomTraits: sorted_traits.filter(t => t.lift < -15).slice(-10).reverse(),
        differentiators: sorted_traits.filter(t => t.isSignificant).slice(0, 10),
    };
}

// ============================================
// NEXT BEST CREATIVE SUGGESTIONS
// ============================================

/**
 * Generate suggestions for next creative to test
 * Based on untested but promising trait combinations
 */
export function suggestNextCreative(ads: FacetAd[], maxSuggestions: number = 5): CreativeSuggestion[] {
    if (ads.length < 5) return [];

    const traitEffects = calculateTraitEffects(ads);
    const coOccurrences = analyzeCoOccurrence(ads, 2);

    // Get proven positive traits
    const positiveTraits = traitEffects
        .filter(t => t.lift > 5 && t.confidence > 0.4)
        .slice(0, 10);

    // Get existing trait combinations (to avoid suggesting what's already tested)
    const existingCombos = new Set<string>();
    for (const ad of ads) {
        const traits = flattenFacets(ad.facets).sort().join('|');
        existingCombos.add(traits);
    }

    // Group positive traits by category
    const traitsByCategory = new Map<string, string[]>();
    for (const effect of positiveTraits) {
        const [category, value] = effect.trait.split(':');
        if (!traitsByCategory.has(category)) {
            traitsByCategory.set(category, []);
        }
        traitsByCategory.get(category)!.push(value);
    }

    const suggestions: CreativeSuggestion[] = [];
    const categories = Array.from(traitsByCategory.keys());

    // Generate combinations from proven traits
    // For simplicity, we'll create combinations by picking one trait from each category
    function generateCombinations(
        catIndex: number,
        currentFacets: Record<string, string[]>,
        currentTraits: string[]
    ) {
        if (catIndex >= categories.length) {
            if (currentTraits.length >= 2) {
                const comboKey = currentTraits.sort().join('|');
                const isNovel = !existingCombos.has(comboKey);

                // Calculate predicted score from individual lifts and co-occurrence bonuses
                let baseScore = 50;
                let totalConfidence = 0;
                const basedOn: string[] = [];

                for (const trait of currentTraits) {
                    const effect = traitEffects.find(e => e.trait === trait);
                    if (effect) {
                        baseScore += effect.lift * 0.5; // Half the individual lift
                        totalConfidence += effect.confidence;
                        if (effect.lift > 10) {
                            basedOn.push(`${trait.split(':')[1]}: +${effect.lift.toFixed(0)} lift`);
                        }
                    }
                }

                // Add co-occurrence bonus
                for (const coOcc of coOccurrences) {
                    if (currentTraits.includes(coOcc.traits[0]) && currentTraits.includes(coOcc.traits[1])) {
                        baseScore += coOcc.liftOverIndividual * 0.3;
                        if (coOcc.liftOverIndividual > 5) {
                            basedOn.push(`${coOcc.traits[0].split(':')[1]} + ${coOcc.traits[1].split(':')[1]} synergy`);
                        }
                    }
                }

                const avgConfidence = totalConfidence / currentTraits.length;
                const predictedScore = Math.min(95, Math.max(20, baseScore));

                suggestions.push({
                    id: `suggestion-${suggestions.length + 1}`,
                    facets: { ...currentFacets },
                    flatTraits: [...currentTraits],
                    predictedScore: Math.round(predictedScore),
                    confidence: Math.round(avgConfidence * 100) / 100,
                    basedOn,
                    isNovel,
                    riskLevel: avgConfidence > 0.7 ? 'low' : avgConfidence > 0.4 ? 'medium' : 'high',
                });
            }
            return;
        }

        const category = categories[catIndex];
        const values = traitsByCategory.get(category) || [];

        // Option 1: Skip this category
        generateCombinations(catIndex + 1, currentFacets, currentTraits);

        // Option 2: Include each value from this category
        for (const value of values.slice(0, 2)) { // Limit to top 2 per category
            const newFacets = { ...currentFacets, [category]: [value] };
            const newTraits = [...currentTraits, `${category}:${value}`];
            generateCombinations(catIndex + 1, newFacets, newTraits);
        }
    }

    generateCombinations(0, {}, []);

    // Sort by predicted score and novelty
    suggestions.sort((a, b) => {
        // Prioritize novel combinations
        if (a.isNovel !== b.isNovel) return a.isNovel ? -1 : 1;
        // Then by predicted score
        return b.predictedScore - a.predictedScore;
    });

    return suggestions.slice(0, maxSuggestions);
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Run full facet intelligence analysis
 * Returns comprehensive insights from facet data
 */
export function analyzeFacets(ads: FacetAd[]): FacetInsights {
    if (ads.length === 0) {
        return {
            coOccurrences: [],
            contrastive: {
                threshold: { top: 0, bottom: 0 },
                topCount: 0,
                bottomCount: 0,
                topTraits: [],
                bottomTraits: [],
                differentiators: [],
            },
            suggestions: [],
            traitEffects: [],
            summary: {
                totalAds: 0,
                avgScore: 0,
                topTraits: [],
                avoidTraits: [],
            },
        };
    }

    const traitEffects = calculateTraitEffects(ads);
    const coOccurrences = analyzeCoOccurrence(ads);
    const contrastive = runContrastiveAnalysis(ads);
    const suggestions = suggestNextCreative(ads);

    const avgScore = ads.reduce((s, a) => s + a.successScore, 0) / ads.length;
    const topTraits = traitEffects
        .filter(t => t.lift > 10 && t.isSignificant)
        .slice(0, 5)
        .map(t => t.trait.split(':')[1]);
    const avoidTraits = traitEffects
        .filter(t => t.lift < -10 && t.isSignificant)
        .slice(0, 5)
        .map(t => t.trait.split(':')[1]);

    return {
        coOccurrences,
        contrastive,
        suggestions,
        traitEffects,
        summary: {
            totalAds: ads.length,
            avgScore: Math.round(avgScore),
            topTraits,
            avoidTraits,
        },
    };
}

// ============================================
// PREDICTION FUNCTION
// ============================================

/**
 * Predict success score for a given facet combination
 */
export function predictFromFacets(
    facets: Record<string, string[]>,
    traitEffects: TraitEffect[],
    coOccurrences: CoOccurrence[]
): { score: number; confidence: number; breakdown: string[] } {
    const traits = flattenFacets(facets);
    let baseScore = 50;
    let totalConfidence = 0;
    let traitCount = 0;
    const breakdown: string[] = [];

    // Add individual trait effects
    for (const trait of traits) {
        const effect = traitEffects.find(e => e.trait === trait);
        if (effect) {
            const contribution = effect.lift * 0.6;
            baseScore += contribution;
            totalConfidence += effect.confidence;
            traitCount++;
            breakdown.push(`${trait.split(':')[1]}: ${contribution > 0 ? '+' : ''}${contribution.toFixed(1)}`);
        }
    }

    // Add co-occurrence bonuses
    for (const coOcc of coOccurrences) {
        if (traits.includes(coOcc.traits[0]) && traits.includes(coOcc.traits[1])) {
            const bonus = coOcc.liftOverIndividual * 0.4;
            if (Math.abs(bonus) > 2) {
                baseScore += bonus;
                breakdown.push(`Synergy (${coOcc.traits[0].split(':')[1]} + ${coOcc.traits[1].split(':')[1]}): ${bonus > 0 ? '+' : ''}${bonus.toFixed(1)}`);
            }
        }
    }

    const avgConfidence = traitCount > 0 ? totalConfidence / traitCount : 0.3;
    const score = Math.min(95, Math.max(20, baseScore));

    return {
        score: Math.round(score),
        confidence: Math.round(avgConfidence * 100) / 100,
        breakdown,
    };
}
