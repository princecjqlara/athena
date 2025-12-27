'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { DEFAULT_CATEGORIES } from '@/types/extended-ad';

interface FacebookMetrics {
    // Core
    impressions: number;
    reach: number;
    clicks: number;
    uniqueClicks?: number;
    ctr: number;
    uniqueCtr?: number;
    cpc: number;
    cpm: number;
    cpp?: number;
    spend: number;
    frequency: number;
    // Results
    resultType?: string;
    results?: number;
    costPerResult?: number;
    // Links
    linkClicks?: number;
    uniqueLinkClicks?: number;
    inlineLinkClicks?: number;
    landingPageViews?: number;
    outboundClicks?: number;
    costPerLinkClick?: number;
    costPerLandingPageView?: number;
    // Engagement
    pageEngagement?: number;
    postEngagement?: number;
    inlinePostEngagement?: number;
    postReactions?: number;
    postComments?: number;
    postShares?: number;
    postSaves?: number;
    pageLikes?: number;
    // Messages
    messages?: number;
    messagesStarted?: number;
    newMessagingContacts?: number;
    totalMessagingContacts?: number;
    costPerMessage?: number;
    costPerMessageStarted?: number;
    costPerOutboundClick?: number;
    // Conversions
    leads?: number;
    purchases?: number;
    addToCart?: number;
    initiateCheckout?: number;
    contentViews?: number;
    completeRegistration?: number;
    phoneCalls?: number;
    costPerLead?: number;
    costPerPurchase?: number;
    costPerAddToCart?: number;
    costPerContentView?: number;
    purchaseRoas?: number;
    // Video
    videoViews?: number;
    videoPlays?: number;
    videoThruPlays?: number;
    video2SecViews?: number;
    video25Watched?: number;
    video50Watched?: number;
    video75Watched?: number;
    video95Watched?: number;
    video100Watched?: number;
    videoAvgWatchTime?: number;
    costPerThruPlay?: number;
    // Quality Rankings
    qualityRanking?: string;
    engagementRateRanking?: string;
    conversionRateRanking?: string;
    // Ad Recall
    estimatedAdRecallers?: number;
    estimatedAdRecallRate?: number;
    // Raw Facebook data for debugging
    rawActions?: { type: string; value: number }[];
    rawCostPerAction?: { type: string; cost: number }[];
}

interface FacebookAd {
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
    configuredStatus?: string;
    createdAt: string;
    updatedAt?: string;
    startTime?: string;
    endTime?: string | null;
    dailyBudget?: number | null;
    lifetimeBudget?: number | null;
    mediaType: string;
    thumbnailUrl: string;
    creativeId?: string;
    metrics: FacebookMetrics | null;
    demographics?: { age?: string; gender?: string; impressions?: number }[];
    placements?: { platform?: string; position?: string; impressions?: number; spend?: number }[];
    regions?: { country?: string; impressions?: number; spend?: number }[];
    byDevice?: { device: string; impressions: number; clicks: number; spend: number }[];
    byPlatform?: { platform: string; impressions: number; clicks: number; spend: number }[];
}

interface StoredAd {
    id: string;
    facebookAdId?: string;
    name?: string;
    adInsights?: FacebookMetrics;
    demographics?: { age?: string; gender?: string; impressions?: number }[];
    placements?: { platform?: string; position?: string; impressions?: number; spend?: number }[];
    regions?: { country?: string; impressions?: number; spend?: number }[];
    successScore?: number;
    hasResults?: boolean;
    lastSyncedAt?: string;
}

export default function ImportPage() {
    const [adAccountId, setAdAccountId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');
    const [datePreset, setDatePreset] = useState<string>('last_30d');

    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const [facebookAds, setFacebookAds] = useState<FacebookAd[]>([]);
    const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());

    // Pipeline selection for importing leads
    const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

    // Traits for each selected ad
    const [adTraits, setAdTraits] = useState<Record<string, {
        categories: string[];
        traits: string[];
    }>>({});

    const [importProgress, setImportProgress] = useState<{ total: number; imported: number } | null>(null);

    // Debug mode to show raw data
    const [showDebug, setShowDebug] = useState(false);

    // Metric Insight Modal State
    const [metricModal, setMetricModal] = useState<{
        open: boolean;
        metric: string;
        value: number | string;
        adName: string;
    } | null>(null);

    // AI Analysis State
    const [aiAnalysis, setAiAnalysis] = useState<Record<string, {
        loading: boolean;
        data: {
            summary: string;
            overallScore: number;
            labeledMetrics: { rawName: string; label: string; value: number; cost: number | null; assessment: string; emoji: string; explanation: string }[];
            keyInsights: { metric: string; label: string; value: string; assessment: string; benchmark: string }[];
            recommendations: string[];
            warnings: string[];
        } | null;
    }>>({});

    // Leads State - stores fetched leads per ad
    interface Lead {
        id: string;
        createdAt: string;
        email: string | null;
        phone: string | null;
        fullName: string | null;
        firstName: string | null;
        lastName: string | null;
        rawFields: Record<string, string>;
    }
    const [adLeads, setAdLeads] = useState<Record<string, { loading: boolean; leads: Lead[]; error: string | null }>>({});

    // Function to fetch leads for an ad
    const fetchLeadsForAd = async (adId: string) => {
        setAdLeads(prev => ({ ...prev, [adId]: { loading: true, leads: [], error: null } }));

        try {
            const response = await fetch(`/api/facebook/leads?adId=${adId}&accessToken=${accessToken}`);
            const data = await response.json();

            if (data.success) {
                setAdLeads(prev => ({
                    ...prev,
                    [adId]: { loading: false, leads: data.data || [], error: null }
                }));
            } else {
                setAdLeads(prev => ({
                    ...prev,
                    [adId]: { loading: false, leads: [], error: data.error || 'Failed to fetch leads' }
                }));
            }
        } catch (err) {
            setAdLeads(prev => ({
                ...prev,
                [adId]: { loading: false, leads: [], error: 'Network error' }
            }));
        }
    };

    // Function to analyze metrics with AI
    const analyzeWithAI = async (adId: string, adName: string, metrics: FacebookMetrics) => {
        setAiAnalysis(prev => ({ ...prev, [adId]: { loading: true, data: null } }));

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'analyze-metrics',
                    data: { metrics, adName }
                })
            });

            const result = await response.json();
            if (result.success && result.data) {
                setAiAnalysis(prev => ({ ...prev, [adId]: { loading: false, data: result.data } }));
            } else {
                setAiAnalysis(prev => ({ ...prev, [adId]: { loading: false, data: null } }));
            }
        } catch (err) {
            console.error('AI analysis error:', err);
            setAiAnalysis(prev => ({ ...prev, [adId]: { loading: false, data: null } }));
        }
    };

    // Metric definitions with benchmarks
    const metricInfo: Record<string, { name: string; description: string; good: string; average: string; poor: string; benchmark: (v: number) => 'good' | 'average' | 'poor' }> = {
        ctr: {
            name: 'Click-Through Rate (CTR)',
            description: 'The percentage of people who clicked your ad after seeing it. CTR = (Clicks ÷ Impressions) × 100',
            good: 'Above 2% is excellent for most industries',
            average: 'Between 0.9% - 2% is typical',
            poor: 'Below 0.9% may need creative optimization',
            benchmark: (v) => v >= 2 ? 'good' : v >= 0.9 ? 'average' : 'poor'
        },
        cpc: {
            name: 'Cost Per Click (CPC)',
            description: 'The average amount you pay for each click on your ad.',
            good: 'Below ₱10 is great for Philippine market',
            average: 'Between ₱10 - ₱30 is typical',
            poor: 'Above ₱30 may need audience refinement',
            benchmark: (v) => v < 10 ? 'good' : v < 30 ? 'average' : 'poor'
        },
        cpm: {
            name: 'Cost Per 1,000 Impressions (CPM)',
            description: 'The cost to show your ad 1,000 times. Lower CPM means more efficient reach.',
            good: 'Below ₱100 is efficient',
            average: 'Between ₱100 - ₱300 is typical',
            poor: 'Above ₱300 may indicate high competition',
            benchmark: (v) => v < 100 ? 'good' : v < 300 ? 'average' : 'poor'
        },
        costPerResult: {
            name: 'Cost Per Result (CPR)',
            description: 'The average cost for each conversion/result from your ad. This depends on your campaign objective.',
            good: 'Below ₱50 for messages/leads is excellent',
            average: 'Between ₱50 - ₱150 is typical',
            poor: 'Above ₱150 may need optimization',
            benchmark: (v) => v < 50 ? 'good' : v < 150 ? 'average' : 'poor'
        },
        frequency: {
            name: 'Frequency',
            description: 'Average number of times each person has seen your ad. High frequency can cause ad fatigue.',
            good: 'Between 1 - 2 is ideal for awareness',
            average: 'Between 2 - 4 is acceptable',
            poor: 'Above 4 may cause ad fatigue',
            benchmark: (v) => v < 2 ? 'good' : v < 4 ? 'average' : 'poor'
        },
        results: {
            name: 'Results',
            description: 'The number of times people took the action your campaign was optimized for (messages, leads, purchases, etc.)',
            good: 'More results = better performance',
            average: 'Compare with your historical average',
            poor: 'Zero results may indicate targeting issues',
            benchmark: (v) => v > 10 ? 'good' : v > 0 ? 'average' : 'poor'
        }
    };

    const showMetricInsight = (metric: string, value: number | string, adName: string) => {
        setMetricModal({ open: true, metric, value, adName });
    };

    // Messenger Contacts State
    const [isFetchingContacts, setIsFetchingContacts] = useState(false);
    const [messengerContacts, setMessengerContacts] = useState<Array<{
        conversationId: string;
        facebookPsid: string;
        name: string;
        isFromAd: boolean;
        messageCount: number;
        lastMessage?: string;
        messages: Array<{ id: string; content: string; from: string; fromId: string; timestamp: string }>;
    }>>([]);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [contactsError, setContactsError] = useState('');

    // Fetch Messenger contacts from Facebook
    const handleFetchMessengerContacts = async () => {
        setIsFetchingContacts(true);
        setContactsError('');

        try {
            // First get pages
            const pagesResponse = await fetch(`/api/facebook/pages?access_token=${accessToken}`);
            const pagesData = await pagesResponse.json();

            if (!pagesData.success || !pagesData.pages?.length) {
                setContactsError('No Facebook pages found. Make sure your token has pages_messaging permission.');
                setIsFetchingContacts(false);
                return;
            }

            // Use first page
            const page = pagesData.pages[0];

            // Fetch conversations
            const convResponse = await fetch(
                `/api/facebook/conversations?page_id=${page.id}&page_access_token=${page.accessToken}&limit=100`
            );
            const convData = await convResponse.json();

            if (!convData.success) {
                setContactsError(convData.error || 'Failed to fetch conversations. Make sure you have pages_messaging permission.');
                setIsFetchingContacts(false);
                return;
            }

            setMessengerContacts(convData.contacts || []);
            setShowContactsModal(true);
        } catch (err) {
            console.error('Error fetching contacts:', err);
            setContactsError('Error: ' + String(err));
        }

        setIsFetchingContacts(false);
    };

    // Import Messenger contacts to localStorage
    const handleImportMessengerContacts = (contacts: typeof messengerContacts) => {
        const existingContactsStr = localStorage.getItem('pipeline_contacts');
        const existingContacts = existingContactsStr ? JSON.parse(existingContactsStr) : [];

        let importedCount = 0;
        contacts.forEach(contact => {
            const exists = existingContacts.find((c: any) => c.facebookPsid === contact.facebookPsid);
            if (!exists) {
                existingContacts.push({
                    id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: contact.name,
                    facebookPsid: contact.facebookPsid,
                    source: contact.isFromAd ? 'ad' : 'organic',
                    sourceAdId: contact.isFromAd ? 'messenger_ad' : undefined,
                    messages: contact.messages?.map(m => ({
                        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        contactId: '',
                        content: m.content,
                        direction: 'inbound',
                        timestamp: m.timestamp,
                        messageId: m.id
                    })) || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                importedCount++;
            }
        });

        localStorage.setItem('pipeline_contacts', JSON.stringify(existingContacts));
        setShowContactsModal(false);
        setMessengerContacts([]);
        alert(`✅ Imported ${importedCount} new contacts! (${contacts.length - importedCount} already existed)`);
    };

    // Load saved credentials
    useEffect(() => {
        const savedAccountId = localStorage.getItem('meta_ad_account_id');
        const savedToken = localStorage.getItem('meta_marketing_token');
        if (savedAccountId) setAdAccountId(savedAccountId);
        if (savedToken) setAccessToken(savedToken);

        // Load pipelines
        const savedPipelines = localStorage.getItem('pipelines');
        if (savedPipelines) {
            setPipelines(JSON.parse(savedPipelines));
        }
    }, []);

    // Fetch ads from Facebook
    const handleFetchAds = async () => {
        if (!adAccountId || !accessToken) {
            setError('Please enter Ad Account ID and Access Token');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // First, check if we need to exchange for a long-lived token
            let tokenToUse = accessToken;

            // Check token validity
            const tokenCheckResponse = await fetch(`/api/facebook/exchange-token?token=${accessToken}`);
            const tokenCheck = await tokenCheckResponse.json();

            // If token is valid but short-lived, exchange it
            if (tokenCheck.success && tokenCheck.isValid && !tokenCheck.isLongLived) {
                console.log('Token is short-lived, exchanging for long-lived token...');
                const exchangeResponse = await fetch('/api/facebook/exchange-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shortLivedToken: accessToken })
                });
                const exchangeData = await exchangeResponse.json();

                if (exchangeData.success && exchangeData.accessToken) {
                    console.log('Token exchanged successfully! Expires:', exchangeData.expiresAt);
                    tokenToUse = exchangeData.accessToken;
                    // Save the new long-lived token
                    setAccessToken(tokenToUse);
                    localStorage.setItem('meta_marketing_token', tokenToUse);
                } else {
                    console.warn('Token exchange failed:', exchangeData.error);
                    // Continue with original token
                }
            } else if (!tokenCheck.isValid) {
                // Token is completely invalid
                setError('Access token is invalid or expired. Please get a new token from Facebook.');
                setIsLoading(false);
                return;
            }

            const response = await fetch(
                `/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${tokenToUse}&status=${statusFilter}&datePreset=${datePreset}`
            );
            const data = await response.json();

            if (data.success) {
                setFacebookAds(data.data);
                // Save credentials for future use
                localStorage.setItem('meta_ad_account_id', adAccountId);
                localStorage.setItem('meta_marketing_token', tokenToUse);
            } else {
                setError(data.error || 'Failed to fetch ads');
            }
        } catch (err) {
            setError('Failed to connect to Facebook API');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-sync all imported ads with latest results from Facebook
    const handleSyncAllResults = useCallback(async () => {
        if (!adAccountId || !accessToken) {
            setError('Please enter Ad Account ID and Access Token to sync');
            return;
        }

        setIsSyncing(true);
        setSyncMessage('🔄 Syncing results from Facebook...');
        setError(null);

        try {
            // Fetch fresh data from Facebook
            const response = await fetch(
                `/api/facebook/ads?adAccountId=${adAccountId}&accessToken=${accessToken}&status=all`
            );
            const data = await response.json();

            if (!data.success) {
                setError(data.error || 'Failed to sync ads');
                setSyncMessage(null);
                return;
            }

            const facebookAdsMap = new Map<string, FacebookAd>();
            data.data.forEach((ad: FacebookAd) => {
                facebookAdsMap.set(ad.id, ad);
            });

            // Get stored ads and update their results
            const storedAds: StoredAd[] = JSON.parse(localStorage.getItem('ads') || '[]');
            let updatedCount = 0;

            const updatedAds = storedAds.map((ad: StoredAd) => {
                if (ad.facebookAdId && facebookAdsMap.has(ad.facebookAdId)) {
                    const fbAd = facebookAdsMap.get(ad.facebookAdId)!;

                    if (fbAd.metrics) {
                        updatedCount++;

                        // Calculate success score based on multiple metrics
                        const m = fbAd.metrics;
                        let score = 0, factors = 0;
                        if (m.ctr && m.ctr > 0) { score += Math.min(40, m.ctr * 10); factors++; }
                        if (m.results && m.results > 0 && m.impressions && m.impressions > 0) {
                            score += Math.min(40, (m.results / m.impressions) * 1000); factors++;
                        } else if (m.messagesStarted && m.messagesStarted > 0) {
                            score += Math.min(40, m.messagesStarted * 4); factors++;
                        }
                        if (m.pageEngagement && m.pageEngagement > 0 && m.impressions && m.impressions > 0) {
                            score += Math.min(20, (m.pageEngagement / m.impressions) * 500); factors++;
                        }
                        const successScore = factors > 0 ? Math.round(Math.min(100, score)) : undefined;

                        // Generate updated results description
                        const resultsDescription = `📊 Facebook Ad Performance Report (Updated: ${new Date().toLocaleString()})

📅 Status: ${fbAd.effectiveStatus}
💰 Total Spend: ₱${(m.spend || 0).toFixed(2)}

📈 REACH & IMPRESSIONS
• Impressions: ${(m.impressions || 0).toLocaleString()}
• Reach: ${(m.reach || 0).toLocaleString()}
• Frequency: ${(m.frequency || 0).toFixed(2)}

🔗 CLICKS & ENGAGEMENT
• Total Clicks: ${m.clicks || 0}
• Link Clicks: ${m.linkClicks || 0}
• CTR: ${(m.ctr || 0).toFixed(2)}%
• CPC: ₱${(m.cpc || 0).toFixed(2)}
• CPM: ₱${(m.cpm || 0).toFixed(2)}

🎯 RESULTS & CONVERSIONS
• Result Type: ${m.resultType || 'N/A'}
• Results: ${m.results || 0}
• Cost per Result: ₱${(m.costPerResult || 0).toFixed(2)}
${m.leads ? `• Leads: ${m.leads}` : ''}
${m.purchases ? `• Purchases: ${m.purchases}` : ''}
${m.messagesStarted ? `• Messages Started: ${m.messagesStarted}` : ''}

👍 ENGAGEMENT
• Page Engagement: ${m.pageEngagement || 0}
• Post Reactions: ${m.postReactions || 0}
• Comments: ${m.postComments || 0}
• Shares: ${m.postShares || 0}`;

                        return {
                            ...ad,
                            adInsights: {
                                impressions: m.impressions,
                                reach: m.reach,
                                clicks: m.clicks,
                                ctr: m.ctr,
                                spend: m.spend,
                                cpc: m.cpc,
                                cpm: m.cpm,
                                frequency: m.frequency,
                                resultType: m.resultType,
                                results: m.results,
                                costPerResult: m.costPerResult,
                                linkClicks: m.linkClicks,
                                landingPageViews: m.landingPageViews,
                                pageEngagement: m.pageEngagement,
                                postReactions: m.postReactions,
                                postComments: m.postComments,
                                postShares: m.postShares,
                                leads: m.leads,
                                purchases: m.purchases,
                                messagesStarted: m.messagesStarted,
                                costPerMessage: m.costPerMessage,
                                videoViews: m.videoViews,
                                videoThruPlays: m.videoThruPlays,
                                qualityRanking: m.qualityRanking,
                                engagementRateRanking: m.engagementRateRanking,
                                conversionRateRanking: m.conversionRateRanking,
                            },
                            hasResults: true,
                            successScore: successScore || ad.successScore,
                            resultsDescription,
                            status: fbAd.effectiveStatus,
                            lastSyncedAt: new Date().toISOString(),
                        };
                    }
                }
                return ad;
            });

            // Save updated ads
            localStorage.setItem('ads', JSON.stringify(updatedAds));
            setSyncMessage(`✅ Synced ${updatedCount} ads with latest results from Facebook!`);

            // Clear message after 3 seconds
            setTimeout(() => setSyncMessage(null), 3000);

        } catch (err) {
            setError('Failed to sync with Facebook');
            console.error(err);
        } finally {
            setIsSyncing(false);
        }
    }, [adAccountId, accessToken]);

    // Toggle ad selection
    const toggleAdSelection = (adId: string) => {
        const newSelected = new Set(selectedAds);
        if (newSelected.has(adId)) {
            newSelected.delete(adId);
        } else {
            newSelected.add(adId);
            // Initialize traits for this ad if not exists
            if (!adTraits[adId]) {
                setAdTraits(prev => ({
                    ...prev,
                    [adId]: { categories: [], traits: [] }
                }));
            }
        }
        setSelectedAds(newSelected);
    };

    // Select all ads
    const selectAllAds = () => {
        const allIds = new Set(facebookAds.map(ad => ad.id));
        setSelectedAds(allIds);
        // Initialize traits for all ads
        const newTraits: Record<string, { categories: string[], traits: string[] }> = {};
        facebookAds.forEach(ad => {
            if (!adTraits[ad.id]) {
                newTraits[ad.id] = { categories: [], traits: [] };
            }
        });
        setAdTraits(prev => ({ ...prev, ...newTraits }));
    };

    // Toggle trait for an ad
    const toggleTrait = (adId: string, traitType: 'categories' | 'traits', trait: string) => {
        setAdTraits(prev => {
            const current = prev[adId] || { categories: [], traits: [] };
            const list = current[traitType];
            const newList = list.includes(trait)
                ? list.filter(t => t !== trait)
                : [...list, trait];
            return {
                ...prev,
                [adId]: { ...current, [traitType]: newList }
            };
        });
    };

    // Import selected ads
    const handleImportAds = async () => {
        if (selectedAds.size === 0) {
            setError('Please select at least one ad to import');
            return;
        }

        setImportProgress({ total: selectedAds.size, imported: 0 });

        // Get existing ads
        const existingAds = JSON.parse(localStorage.getItem('ads') || '[]');
        const existingFbIds = new Set(existingAds.map((a: { facebookAdId?: string }) => a.facebookAdId));

        let imported = 0;
        const newAds: Array<Record<string, unknown>> = [];

        selectedAds.forEach(adId => {
            // Skip if already imported
            if (existingFbIds.has(adId)) {
                imported++;
                setImportProgress({ total: selectedAds.size, imported });
                return;
            }

            const fbAd = facebookAds.find(a => a.id === adId);
            if (!fbAd) return;

            const traits = adTraits[adId] || { categories: [], traits: [] };

            // Calculate success score based on multiple metrics
            // Score is 0-100 based on CTR, conversion rate, and overall performance
            let successScore: number | undefined = undefined;
            if (fbAd.metrics) {
                const m = fbAd.metrics;
                let score = 0;
                let factors = 0;

                // CTR contribution (0-40 points)
                if (m.ctr && m.ctr > 0) {
                    // CTR of 2% = 20 points, 5% = 50 points (capped at 40)
                    score += Math.min(40, m.ctr * 10);
                    factors++;
                }

                // Results/Conversions contribution (0-40 points)
                if (m.results && m.results > 0 && m.impressions && m.impressions > 0) {
                    // Conversion rate: results / impressions * 1000
                    const convRate = (m.results / m.impressions) * 100;
                    score += Math.min(40, convRate * 10);
                    factors++;
                } else if (m.leads && m.leads > 0) {
                    score += Math.min(40, m.leads * 5);
                    factors++;
                } else if (m.messagesStarted && m.messagesStarted > 0) {
                    score += Math.min(40, m.messagesStarted * 4);
                    factors++;
                }

                // Engagement contribution (0-20 points)
                if (m.pageEngagement && m.pageEngagement > 0 && m.impressions && m.impressions > 0) {
                    const engRate = (m.pageEngagement / m.impressions) * 100;
                    score += Math.min(20, engRate * 5);
                    factors++;
                }

                // Normalize: if we have metrics, calculate average
                successScore = factors > 0 ? Math.round(Math.min(100, score)) : undefined;
            }

            // Create extractedContent for Algorithm/mindmap compatibility
            const extractedContent = {
                title: fbAd.name,
                platform: 'Facebook',
                placement: 'Feed',
                mediaType: fbAd.mediaType || 'video',
                // Map user-selected categories and traits
                contentCategory: traits.categories[0] || 'other',
                hookType: traits.traits.find((t: string) => ['curiosity', 'shock', 'question', 'transformation', 'story'].includes(t.toLowerCase())) || 'other',
                editingStyle: traits.traits.find((t: string) => ['fast_cuts', 'cinematic', 'raw_authentic', 'ugc'].includes(t.toLowerCase())) || 'other',
                isUGCStyle: traits.traits.some((t: string) => t.toLowerCase().includes('ugc')),
                hasSubtitles: traits.traits.some((t: string) => t.toLowerCase().includes('subtitle')),
                hasVoiceover: traits.traits.some((t: string) => t.toLowerCase().includes('voiceover')),
                customTraits: [...traits.categories, ...traits.traits],
            };

            const newAd = {
                id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                facebookAdId: fbAd.id,
                name: fbAd.name,
                mediaUrl: fbAd.thumbnailUrl,
                thumbnailUrl: fbAd.thumbnailUrl,
                mediaType: fbAd.mediaType,
                // Add extractedContent for Algorithm compatibility
                extractedContent,
                // Traits from user selection
                categories: traits.categories,
                traits: traits.traits,
                // Comprehensive Facebook Insights
                adInsights: fbAd.metrics ? {
                    // Core metrics
                    impressions: fbAd.metrics.impressions,
                    reach: fbAd.metrics.reach,
                    clicks: fbAd.metrics.clicks,
                    uniqueClicks: fbAd.metrics.uniqueClicks,
                    ctr: fbAd.metrics.ctr,
                    uniqueCtr: fbAd.metrics.uniqueCtr,
                    cpc: fbAd.metrics.cpc,
                    cpm: fbAd.metrics.cpm,
                    cpp: fbAd.metrics.cpp,
                    spend: fbAd.metrics.spend,
                    frequency: fbAd.metrics.frequency,
                    // Results
                    resultType: fbAd.metrics.resultType,
                    results: fbAd.metrics.results,
                    costPerResult: fbAd.metrics.costPerResult,
                    // Links
                    linkClicks: fbAd.metrics.linkClicks,
                    inlineLinkClicks: fbAd.metrics.inlineLinkClicks,
                    landingPageViews: fbAd.metrics.landingPageViews,
                    outboundClicks: fbAd.metrics.outboundClicks,
                    // Engagement
                    pageEngagement: fbAd.metrics.pageEngagement,
                    postEngagement: fbAd.metrics.postEngagement,
                    inlinePostEngagement: fbAd.metrics.inlinePostEngagement,
                    postReactions: fbAd.metrics.postReactions,
                    postComments: fbAd.metrics.postComments,
                    postShares: fbAd.metrics.postShares,
                    // Messages
                    messages: fbAd.metrics.messages,
                    messagesStarted: fbAd.metrics.messagesStarted,
                    costPerMessage: fbAd.metrics.costPerMessage,
                    // Conversions
                    leads: fbAd.metrics.leads,
                    purchases: fbAd.metrics.purchases,
                    addToCart: fbAd.metrics.addToCart,
                    initiateCheckout: fbAd.metrics.initiateCheckout,
                    costPerLead: fbAd.metrics.costPerLead,
                    costPerPurchase: fbAd.metrics.costPerPurchase,
                    // Video
                    videoViews: fbAd.metrics.videoViews,
                    videoPlays: fbAd.metrics.videoPlays,
                    video25Watched: fbAd.metrics.video25Watched,
                    video50Watched: fbAd.metrics.video50Watched,
                    video75Watched: fbAd.metrics.video75Watched,
                    video100Watched: fbAd.metrics.video100Watched,
                } : null,
                // Breakdown data
                demographics: fbAd.demographics || [],
                placements: fbAd.placements || [],
                regions: fbAd.regions || [],
                // Status flags
                hasResults: !!fbAd.metrics && (fbAd.metrics.impressions > 0 || fbAd.metrics.clicks > 0),
                successScore,
                status: fbAd.effectiveStatus,
                importedFromFacebook: true,
                createdAt: fbAd.createdAt,
                importedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastSyncedAt: new Date().toISOString(),
                // Auto-generated results description from Facebook metrics
                resultsDescription: fbAd.metrics ? `📊 Facebook Ad Performance Report

📅 Status: ${fbAd.effectiveStatus}
💰 Total Spend: ₱${(fbAd.metrics.spend || 0).toFixed(2)}

📈 REACH & IMPRESSIONS
• Impressions: ${(fbAd.metrics.impressions || 0).toLocaleString()}
• Reach: ${(fbAd.metrics.reach || 0).toLocaleString()}
• Frequency: ${(fbAd.metrics.frequency || 0).toFixed(2)}

🔗 CLICKS & ENGAGEMENT
• Total Clicks: ${fbAd.metrics.clicks || 0}
• Link Clicks: ${fbAd.metrics.linkClicks || 0}
• CTR: ${(fbAd.metrics.ctr || 0).toFixed(2)}%
• CPC: ₱${(fbAd.metrics.cpc || 0).toFixed(2)}
• CPM: ₱${(fbAd.metrics.cpm || 0).toFixed(2)}

🎯 RESULTS & CONVERSIONS
• Result Type: ${fbAd.metrics.resultType || 'N/A'}
• Results: ${fbAd.metrics.results || 0}
• Cost per Result: ₱${(fbAd.metrics.costPerResult || 0).toFixed(2)}
${fbAd.metrics.leads ? `• Leads: ${fbAd.metrics.leads}` : ''}
${fbAd.metrics.purchases ? `• Purchases: ${fbAd.metrics.purchases}` : ''}
${fbAd.metrics.messagesStarted ? `• Messages Started: ${fbAd.metrics.messagesStarted}` : ''}

👍 ENGAGEMENT
• Page Engagement: ${fbAd.metrics.pageEngagement || 0}
• Post Reactions: ${fbAd.metrics.postReactions || 0}
• Comments: ${fbAd.metrics.postComments || 0}
• Shares: ${fbAd.metrics.postShares || 0}

🎬 VIDEO (if applicable)
• Video Views: ${fbAd.metrics.videoViews || 0}
• ThruPlays: ${fbAd.metrics.videoThruPlays || 0}

⭐ QUALITY RANKINGS
• Quality: ${fbAd.metrics.qualityRanking || 'N/A'}
• Engagement Rate: ${fbAd.metrics.engagementRateRanking || 'N/A'}
• Conversion Rate: ${fbAd.metrics.conversionRateRanking || 'N/A'}` : '',
            };

            newAds.push(newAd);
            imported++;
            setImportProgress({ total: selectedAds.size, imported });
        });

        // Save to localStorage
        const allAds = [...existingAds, ...newAds];
        localStorage.setItem('ads', JSON.stringify(allAds));

        // Auto-create leads from ads - try to fetch actual lead data first
        let leadsCreated = 0;
        let realLeadsCount = 0;
        let placeholderLeadsCount = 0;

        // For each ad, try to fetch actual leads from Facebook Lead Ads API
        for (const ad of newAds) {
            const metrics = (ad as any).adInsights;
            const messagesStarted = metrics?.messagesStarted || 0;
            const leadCount = metrics?.leads || 0;
            const adName = (ad as any).name || 'Unknown Ad';
            const adId = (ad as any).facebookAdId || (ad as any).id;
            const adCreatedAt = (ad as any).createdAt;

            // Try to fetch actual lead data from Facebook Lead Ads API
            try {
                console.log(`[Import] Fetching leads for ad: ${adName} (${adId})`);
                const leadsResponse = await fetch(`/api/facebook/leads?adId=${adId}&accessToken=${accessToken}`);
                const leadsData = await leadsResponse.json();

                console.log(`[Import] Leads API response:`, {
                    success: leadsData.success,
                    count: leadsData.data?.length || 0,
                    isLeadAd: leadsData.isLeadAd,
                    message: leadsData.message
                });

                if (leadsData.success && leadsData.data && leadsData.data.length > 0) {
                    // We have actual leads with names!
                    for (const fbLead of leadsData.data) {
                        const leadId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                        // Build best possible name
                        let leadName = fbLead.fullName;
                        if (!leadName && fbLead.firstName) {
                            leadName = fbLead.lastName ? `${fbLead.firstName} ${fbLead.lastName}` : fbLead.firstName;
                        }
                        if (!leadName && fbLead.email) {
                            // Use email username as name
                            leadName = fbLead.email.split('@')[0].replace(/[._-]/g, ' ');
                            // Capitalize first letter of each word
                            leadName = leadName.replace(/\b\w/g, (c: string) => c.toUpperCase());
                        }
                        if (!leadName) {
                            // Use ad name + timestamp as last resort
                            const leadTime = new Date(fbLead.createdAt || Date.now());
                            leadName = `${adName.substring(0, 15)} - ${leadTime.toLocaleDateString()}`;
                        }

                        const leadData = {
                            id: leadId,
                            name: leadName,
                            email: fbLead.email,
                            phone: fbLead.phone,
                            city: fbLead.city,
                            state: fbLead.state,
                            country: fbLead.country,
                            sourceAdId: adId,
                            sourceAdName: adName,
                            facebookLeadId: fbLead.id,
                            facebookAdId: adId,
                            campaignId: fbLead.campaignId,
                            formId: fbLead.formId,
                            source: 'Facebook Lead Ad',
                            stageId: 'new-lead',
                            pipelineId: selectedPipelineId || undefined,
                            createdAt: fbLead.createdAt || new Date().toISOString(),
                            lastActivity: new Date().toISOString(),
                            isPlaceholder: false,
                            isRealLead: true,
                            rawFields: fbLead.rawFields,
                        };

                        // Save to appropriate storage
                        if (selectedPipelineId) {
                            const pipelineLeadsKey = `leads_${selectedPipelineId}`;
                            const existingLeads = JSON.parse(localStorage.getItem(pipelineLeadsKey) || '[]');
                            existingLeads.push(leadData);
                            localStorage.setItem(pipelineLeadsKey, JSON.stringify(existingLeads));

                            const pipelinesData = JSON.parse(localStorage.getItem('pipelines') || '[]');
                            const pIndex = pipelinesData.findIndex((p: any) => p.id === selectedPipelineId);
                            if (pIndex !== -1) {
                                pipelinesData[pIndex].leadCount = (pipelinesData[pIndex].leadCount || 0) + 1;
                                localStorage.setItem('pipelines', JSON.stringify(pipelinesData));
                            }
                        } else {
                            const existingContacts = JSON.parse(localStorage.getItem('pipeline_contacts') || '[]');
                            existingContacts.push(leadData);
                            localStorage.setItem('pipeline_contacts', JSON.stringify(existingContacts));
                        }
                        leadsCreated++;
                        realLeadsCount++;
                    }
                    console.log(`[Import] Created ${leadsData.data.length} real leads from ad: ${adName}`);
                    continue; // Skip placeholder creation since we got real leads
                }

                // If this is a Messages/Messenger ad (not a Lead Ad), try to fetch conversations
                if (leadsData.isLeadAd === false && messagesStarted > 0) {
                    console.log(`[Import] ${adName} is a Messages ad - fetching conversations...`);

                    // First get the user's pages to find the right one
                    try {
                        const pagesResponse = await fetch(`/api/facebook/conversations?get_pages=true&access_token=${accessToken}`);
                        const pagesData = await pagesResponse.json();

                        if (pagesData.success && pagesData.pages?.length > 0) {
                            // Use the first page (could let user select if multiple)
                            const page = pagesData.pages[0];
                            const pageId = page.id;
                            const pageToken = page.access_token; // Use page token for profile fetching
                            console.log(`[Import] Using page: ${page.name} (${pageId}), has token: ${!!pageToken}`);

                            // Fetch ALL conversations for this page (not filtered by ad_id)
                            // Facebook doesn't reliably include ad_id in conversation links
                            // We limit to messagesStarted count to get recent contacts
                            // Use page_access_token for better profile fetching
                            const convoResponse = await fetch(
                                `/api/facebook/conversations?page_id=${pageId}&page_access_token=${pageToken || ''}&access_token=${accessToken}&limit=${Math.min(messagesStarted, 50)}`
                            );
                            const convoData = await convoResponse.json();

                            if (convoData.success && convoData.contacts?.length > 0) {
                                console.log(`[Import] Found ${convoData.contacts.length} real conversations!`);

                                // Take up to messagesStarted contacts and associate them with this ad
                                const contactsToImport = convoData.contacts.slice(0, messagesStarted);

                                for (const contact of contactsToImport) {
                                    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                    const leadData = {
                                        id: leadId,
                                        name: contact.name || 'Unknown',
                                        email: contact.email,
                                        phone: contact.phone,
                                        sourceAdId: adId,
                                        sourceAdName: adName,
                                        facebookPsid: contact.facebookPsid,
                                        facebookAdId: adId,
                                        source: 'Facebook Messenger',
                                        stageId: 'new-lead',
                                        pipelineId: selectedPipelineId || undefined,
                                        createdAt: contact.firstMessageAt || new Date().toISOString(),
                                        lastActivity: contact.lastMessageAt || new Date().toISOString(),
                                        isPlaceholder: false,
                                        isRealLead: true,
                                        lastMessage: contact.lastMessage,
                                    };

                                    if (selectedPipelineId) {
                                        const pipelineLeadsKey = `leads_${selectedPipelineId}`;
                                        const existingLeads = JSON.parse(localStorage.getItem(pipelineLeadsKey) || '[]');
                                        existingLeads.push(leadData);
                                        localStorage.setItem(pipelineLeadsKey, JSON.stringify(existingLeads));

                                        const pipelinesData = JSON.parse(localStorage.getItem('pipelines') || '[]');
                                        const pIndex = pipelinesData.findIndex((p: any) => p.id === selectedPipelineId);
                                        if (pIndex !== -1) {
                                            pipelinesData[pIndex].leadCount = (pipelinesData[pIndex].leadCount || 0) + 1;
                                            localStorage.setItem('pipelines', JSON.stringify(pipelinesData));
                                        }
                                    } else {
                                        const existingContacts = JSON.parse(localStorage.getItem('pipeline_contacts') || '[]');
                                        existingContacts.push(leadData);
                                        localStorage.setItem('pipeline_contacts', JSON.stringify(existingContacts));
                                    }
                                    leadsCreated++;
                                    realLeadsCount++;
                                }
                                console.log(`[Import] Created ${contactsToImport.length} real leads from conversations`);
                                continue; // Skip placeholder creation
                            } else {
                                console.log(`[Import] ⚠️ No conversations found. Response:`, {
                                    success: convoData.success,
                                    error: convoData.error,
                                    contactsCount: convoData.contacts?.length,
                                    details: convoData.details
                                });
                            }
                        } else {
                            console.log(`[Import] ⚠️ No pages found or failed:`, pagesData);
                        }
                    } catch (convoErr) {
                        console.log('[Import] ❌ Error fetching conversations:', convoErr);
                    }
                }
            } catch (err) {
                console.log('[Import] Could not fetch leads for ad:', adName, err);
            }

            // Fallback: Create placeholder leads based on metrics count
            // Only if we couldn't get real data from Lead Forms or Conversations API
            const totalLeads = Math.max(messagesStarted, leadCount);
            if (totalLeads > 0) {
                console.log(`[Import] Creating ${Math.min(totalLeads, 50)} placeholder leads for ad: ${adName}`);

                for (let i = 0; i < Math.min(totalLeads, 50); i++) {
                    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                    // Create a more descriptive placeholder name
                    // Format: "AdName Lead 1" or "Contact from AdName"
                    const shortAdName = adName.length > 20 ? adName.substring(0, 20) + '...' : adName;
                    const leadData = {
                        id: leadId,
                        name: `${shortAdName} - Contact ${i + 1}`,
                        sourceAdId: adId,
                        sourceAdName: adName,
                        facebookAdId: adId,
                        source: messagesStarted > 0 ? 'Facebook Messenger' : 'Facebook Ad',
                        stageId: 'new-lead',
                        pipelineId: selectedPipelineId || undefined,
                        createdAt: adCreatedAt || new Date().toISOString(),
                        lastActivity: new Date().toISOString(),
                        isPlaceholder: true, // Mark as placeholder (no real data from API)
                        isRealLead: false,
                        needsDataFetch: true, // Flag that this needs real data
                    };

                    if (selectedPipelineId) {
                        const pipelineLeadsKey = `leads_${selectedPipelineId}`;
                        const existingLeads = JSON.parse(localStorage.getItem(pipelineLeadsKey) || '[]');
                        existingLeads.push(leadData);
                        localStorage.setItem(pipelineLeadsKey, JSON.stringify(existingLeads));

                        const pipelinesData = JSON.parse(localStorage.getItem('pipelines') || '[]');
                        const pIndex = pipelinesData.findIndex((p: any) => p.id === selectedPipelineId);
                        if (pIndex !== -1) {
                            pipelinesData[pIndex].leadCount = (pipelinesData[pIndex].leadCount || 0) + 1;
                            localStorage.setItem('pipelines', JSON.stringify(pipelinesData));
                        }
                    } else {
                        const existingContacts = JSON.parse(localStorage.getItem('pipeline_contacts') || '[]');
                        existingContacts.push(leadData);
                        localStorage.setItem('pipeline_contacts', JSON.stringify(existingContacts));
                    }
                    leadsCreated++;
                    placeholderLeadsCount++;
                }
            }
        }

        // Reset state
        setTimeout(() => {
            setImportProgress(null);
            setSelectedAds(new Set());
            setFacebookAds([]);

            let message = `✅ Successfully imported ${newAds.length} ads!`;
            if (leadsCreated > 0) {
                const pipelineName = pipelines.find(p => p.id === selectedPipelineId)?.name;
                if (pipelineName) {
                    message += `\n📱 Added ${leadsCreated} leads to "${pipelineName}" pipeline!`;
                } else {
                    message += `\n📱 Created ${leadsCreated} leads (no pipeline selected)`;
                }

                // Show breakdown of real vs placeholder leads
                if (realLeadsCount > 0) {
                    message += `\n   ✨ ${realLeadsCount} leads with full details (name, email, phone)`;
                }
                if (placeholderLeadsCount > 0) {
                    message += `\n   ⏳ ${placeholderLeadsCount} placeholder leads (awaiting webhook data)`;
                    message += `\n\n💡 Tip: For Messages/Messenger ads, lead details arrive via webhooks when contacts message your page.`;
                }
            }
            message += '\n\nYour ads are now available in the Algorithm and My Ads pages.';
            if (leadsCreated > 0 && selectedPipelineId) {
                message += '\nGo to Pipeline page to view your leads!';
            }
            alert(message);
        }, 500);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#22c55e';
            case 'PAUSED': return '#F59E0B';
            case 'ARCHIVED': return '#6B7280';
            default: return '#8B5CF6';
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>📥 Import from Facebook</h1>
                <p className={styles.subtitle}>
                    Import existing ads with auto-filled results • Tag traits for AI learning
                </p>
            </header>

            {/* Connection Section */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)' }}>🔗 Connect to Ad Account</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Ad Account ID</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="123456789"
                            value={adAccountId}
                            onChange={(e) => setAdAccountId(e.target.value.replace('act_', ''))}
                        />
                        <small style={{ color: 'var(--text-muted)' }}>Without &quot;act_&quot; prefix</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Marketing Access Token</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="EAAxxxxxxx..."
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Filter by Status</label>
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused' | 'archived')}
                        >
                            <option value="all">All Ads</option>
                            <option value="active">Active Only</option>
                            <option value="paused">Paused Only</option>
                            <option value="archived">Archived Only</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Date Range</label>
                        <select
                            className="form-select"
                            value={datePreset}
                            onChange={(e) => setDatePreset(e.target.value)}
                        >
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="this_week_sun_today">This Week</option>
                            <option value="last_7d">Last 7 Days</option>
                            <option value="last_14d">Last 14 Days</option>
                            <option value="last_30d">Last 30 Days</option>
                            <option value="last_90d">Last 90 Days</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="maximum">All Time (Lifetime)</option>
                        </select>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleFetchAds}
                        disabled={isLoading}
                        style={{ marginTop: '24px' }}
                    >
                        {isLoading ? '🔄 Fetching...' : '📥 Fetch Ads to Import'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleSyncAllResults}
                        disabled={isSyncing || !adAccountId || !accessToken}
                        style={{ marginTop: '24px' }}
                    >
                        {isSyncing ? '🔄 Syncing...' : '🔄 Sync All Results'}
                    </button>
                </div>

                {syncMessage && (
                    <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--success)'
                    }}>
                        {syncMessage}
                    </div>
                )}

                {error && (
                    <div style={{
                        marginTop: 'var(--spacing-md)',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--error)'
                    }}>
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* Sync Info */}
            <div className="glass-card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', background: 'rgba(200, 245, 96, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span>💡</span>
                    <span style={{ fontSize: '0.875rem' }}>
                        <strong>New ads may show 0 results</strong> - Facebook takes time to report metrics.
                        Use <strong>&quot;Sync All Results&quot;</strong> to update your imported ads with the latest data.
                    </span>
                </div>
            </div>

            {/* Ads List */}
            {facebookAds.length > 0 && (
                <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0 }}>📊 Found {facebookAds.length} Ads</h3>
                            <div style={{
                                background: 'rgba(200, 245, 96, 0.15)',
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(200, 245, 96, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '1.25rem' }}>💰</span>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Spent</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        ₱{facebookAds.reduce((sum, ad) => sum + (ad.metrics?.spend || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                fontSize: '0.75rem',
                                color: '#a5b4fc'
                            }}>
                                📅 {datePreset === 'today' ? 'Today' :
                                    datePreset === 'yesterday' ? 'Yesterday' :
                                        datePreset === 'last_7d' ? 'Last 7 Days' :
                                            datePreset === 'last_14d' ? 'Last 14 Days' :
                                                datePreset === 'last_30d' ? 'Last 30 Days' :
                                                    datePreset === 'last_90d' ? 'Last 90 Days' :
                                                        datePreset === 'this_month' ? 'This Month' :
                                                            datePreset === 'last_month' ? 'Last Month' :
                                                                datePreset === 'maximum' ? 'All Time' :
                                                                    datePreset}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={selectAllAds}>
                                ✓ Select All
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAds(new Set())}>
                                ✗ Clear Selection
                            </button>

                            {/* Pipeline Selector */}
                            <select
                                className="form-select"
                                value={selectedPipelineId}
                                onChange={(e) => setSelectedPipelineId(e.target.value)}
                                style={{
                                    minWidth: '200px',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-primary)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="">📋 Select Pipeline for Leads...</option>
                                {pipelines.map(p => (
                                    <option key={p.id} value={p.id}>🎯 {p.name}</option>
                                ))}
                            </select>

                            <button
                                className="btn btn-primary"
                                onClick={handleImportAds}
                                disabled={selectedAds.size === 0}
                            >
                                📥 Import {selectedAds.size} Selected
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowDebug(!showDebug)}
                                style={{
                                    background: showDebug ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                    border: showDebug ? '1px solid rgba(239, 68, 68, 0.5)' : undefined
                                }}
                            >
                                🐛 {showDebug ? 'Hide' : 'Show'} Raw Data
                            </button>
                        </div>
                    </div>

                    {/* Import Progress */}
                    {importProgress && (
                        <div style={{
                            marginBottom: 'var(--spacing-lg)',
                            padding: 'var(--spacing-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ marginBottom: '8px' }}>
                                Importing... {importProgress.imported} / {importProgress.total}
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(importProgress.imported / importProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Ads Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {facebookAds.map(ad => (
                            <div
                                key={ad.id}
                                style={{
                                    border: selectedAds.has(ad.id) ? '2px solid var(--primary)' : '1px solid var(--border-primary)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--spacing-md)',
                                    background: selectedAds.has(ad.id) ? 'rgba(200, 245, 96, 0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                    {/* Checkbox + Thumbnail */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAds.has(ad.id)}
                                            onChange={() => toggleAdSelection(ad.id)}
                                            style={{ width: 20, height: 20, marginTop: 4 }}
                                        />
                                        <div style={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: 'var(--radius-md)',
                                            background: ad.thumbnailUrl ? `url(${ad.thumbnailUrl}) center/cover` : 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem'
                                        }}>
                                            {!ad.thumbnailUrl && (ad.mediaType === 'video' ? '🎬' : '📷')}
                                        </div>
                                    </div>

                                    {/* Ad Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '4px' }}>
                                            <h4 style={{ margin: 0 }}>{ad.name}</h4>
                                            <span
                                                className="tag"
                                                style={{
                                                    background: getStatusColor(ad.effectiveStatus),
                                                    color: 'white',
                                                    fontSize: '0.6875rem'
                                                }}
                                            >
                                                {ad.effectiveStatus}
                                            </span>
                                        </div>

                                        {/* Ad Timeline and Spend Summary */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '8px',
                                            flexWrap: 'wrap'
                                        }}>
                                            <span title="When this ad started running">
                                                📅 Started: {ad.startTime ? new Date(ad.startTime).toLocaleDateString() : 'N/A'}
                                            </span>
                                            {ad.endTime && (
                                                <span title="When this ad stopped/will stop">
                                                    🏁 Ended: {new Date(ad.endTime).toLocaleDateString()}
                                                </span>
                                            )}
                                            {ad.metrics?.spend !== undefined && ad.metrics.spend > 0 && (
                                                <span title="Total amount spent on this ad" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                    💰 ₱{ad.metrics.spend.toFixed(2)} spent
                                                </span>
                                            )}
                                            {ad.dailyBudget && (
                                                <span title="Daily budget">📊 ₱{ad.dailyBudget.toFixed(2)}/day</span>
                                            )}
                                        </div>

                                        {/* Dynamic Metrics Display */}
                                        {ad.metrics ? (
                                            <div style={{ fontSize: '0.75rem' }}>
                                                {/* Core Metrics - Always visible */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '6px',
                                                    flexWrap: 'wrap',
                                                    marginBottom: '8px'
                                                }}>
                                                    {ad.metrics.impressions > 0 && (
                                                        <span title="Total number of times your ad was shown" style={{ background: '#2a2a3e', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                            <strong>{ad.metrics.impressions.toLocaleString()}</strong> impressions
                                                        </span>
                                                    )}
                                                    {(ad.metrics.reach ?? 0) > 0 && (
                                                        <span title="Number of unique people who saw your ad" style={{ background: '#2a2a3e', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                            <strong>{ad.metrics.reach?.toLocaleString()}</strong> reach
                                                        </span>
                                                    )}
                                                    {ad.metrics.clicks > 0 && (
                                                        <span title="Total clicks on your ad (all click types)" style={{ background: '#2a2a3e', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                            <strong>{ad.metrics.clicks.toLocaleString()}</strong> clicks
                                                        </span>
                                                    )}
                                                    {ad.metrics.ctr > 0 && (
                                                        <span
                                                            onClick={() => showMetricInsight('ctr', ad.metrics?.ctr || 0, ad.name)}
                                                            title="Click for details"
                                                            style={{ background: '#22c55e', color: '#000', padding: '3px 10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            {ad.metrics.ctr.toFixed(2)}% CTR
                                                        </span>
                                                    )}
                                                    {ad.metrics.spend > 0 && (
                                                        <span title="Total amount spent on this ad" style={{ background: '#2a2a3e', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                            <strong>₱{ad.metrics.spend.toFixed(2)}</strong> spent
                                                        </span>
                                                    )}
                                                    {(ad.metrics.frequency ?? 0) > 1 && (
                                                        <span title="Average times each person saw your ad" style={{ background: '#2a2a3e', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                            <strong>{ad.metrics.frequency?.toFixed(2)}</strong> freq
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Debug: Raw Data Display */}
                                                {showDebug && ad.metrics && (
                                                    <div style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: '6px',
                                                        padding: '8px',
                                                        marginBottom: '8px',
                                                        fontSize: '0.65rem',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🐛 RAW API DATA:</div>
                                                        <div>impressions: {ad.metrics.impressions}</div>
                                                        <div>clicks: {ad.metrics.clicks}</div>
                                                        <div>ctr: {ad.metrics.ctr}</div>
                                                        <div>spend: {ad.metrics.spend}</div>
                                                        <div>reach: {ad.metrics.reach}</div>
                                                        <div>results: {ad.metrics.results} ({ad.metrics.resultType})</div>
                                                        <div>costPerResult: {ad.metrics.costPerResult}</div>
                                                        <div>linkClicks: {ad.metrics.linkClicks}</div>
                                                        <div>messages: {ad.metrics.messages}</div>
                                                        <div>leads: {ad.metrics.leads}</div>
                                                    </div>
                                                )}

                                                {/* Results Row - Primary conversion metrics */}
                                                {((ad.metrics.results ?? 0) > 0 || ((ad.metrics.messages ?? 0) > 0 && ad.metrics.resultType !== 'messages') || (ad.metrics.leads ?? 0) > 0 || (ad.metrics.purchases ?? 0) > 0) && (
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        flexWrap: 'wrap',
                                                        marginBottom: '8px'
                                                    }}>
                                                        {(ad.metrics.results ?? 0) > 0 && (
                                                            <span
                                                                onClick={() => showMetricInsight('results', ad.metrics?.results || 0, ad.name)}
                                                                title="Click for details"
                                                                style={{ background: '#8b5cf6', color: '#fff', padding: '3px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                                            >
                                                                <strong>{ad.metrics.results}</strong> {ad.metrics.resultType || 'results'}
                                                            </span>
                                                        )}
                                                        {(ad.metrics.costPerResult ?? 0) > 0 && (
                                                            <span
                                                                onClick={() => showMetricInsight('costPerResult', ad.metrics?.costPerResult || 0, ad.name)}
                                                                title="Click for details"
                                                                style={{ background: '#8b5cf6', color: '#fff', padding: '3px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                                            >
                                                                <strong>₱{ad.metrics.costPerResult?.toFixed(2)}</strong> CPR
                                                            </span>
                                                        )}
                                                        {/* Only show separate messages if resultType is NOT messages (to avoid duplication) */}
                                                        {(ad.metrics.messages ?? 0) > 0 && ad.metrics.resultType !== 'messages' && (
                                                            <span title="New messaging conversations started" style={{ background: '#3b82f6', color: '#fff', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                                💬 <strong>{ad.metrics.messages}</strong> messages
                                                            </span>
                                                        )}
                                                        {/* Only show separate leads if resultType is NOT leads */}
                                                        {(ad.metrics.leads ?? 0) > 0 && ad.metrics.resultType !== 'leads' && (
                                                            <span title="Leads generated from your ad" style={{ background: '#f59e0b', color: '#000', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                                🎯 <strong>{ad.metrics.leads}</strong> leads
                                                            </span>
                                                        )}
                                                        {/* Fetch Leads Button - shows when there are leads */}
                                                        {((ad.metrics.leads ?? 0) > 0 || ad.metrics.resultType === 'leads') && (
                                                            <button
                                                                onClick={() => fetchLeadsForAd(ad.id)}
                                                                disabled={adLeads[ad.id]?.loading}
                                                                style={{
                                                                    background: 'rgba(245, 158, 11, 0.2)',
                                                                    border: '1px solid #f59e0b',
                                                                    color: '#f59e0b',
                                                                    padding: '3px 10px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.7rem'
                                                                }}
                                                            >
                                                                {adLeads[ad.id]?.loading ? '⏳ Fetching...' : '📥 Fetch Leads'}
                                                            </button>
                                                        )}
                                                        {/* Only show separate purchases if resultType is NOT purchases */}
                                                        {(ad.metrics.purchases ?? 0) > 0 && ad.metrics.resultType !== 'purchases' && (
                                                            <span title="Completed purchases attributed to your ad" style={{ background: '#22c55e', color: '#000', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                                🛒 <strong>{ad.metrics.purchases}</strong> purchases
                                                            </span>
                                                        )}
                                                        {(ad.metrics.purchaseRoas ?? 0) > 0 && (
                                                            <span title="Return on Ad Spend = Revenue / Ad Spend" style={{ background: '#22c55e', color: '#000', padding: '3px 10px', borderRadius: '6px', cursor: 'help' }}>
                                                                📈 <strong>{ad.metrics.purchaseRoas?.toFixed(2)}x</strong> ROAS
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Fetched Leads Display */}
                                                {adLeads[ad.id] && (adLeads[ad.id].leads.length > 0 || adLeads[ad.id].error) && (
                                                    <div style={{
                                                        background: 'rgba(245, 158, 11, 0.1)',
                                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '8px',
                                                        marginTop: '8px'
                                                    }}>
                                                        {adLeads[ad.id].error ? (
                                                            <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                                                                ❌ {adLeads[ad.id].error}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#f59e0b' }}>
                                                                    📋 {adLeads[ad.id].leads.length} Lead{adLeads[ad.id].leads.length !== 1 ? 's' : ''} Found
                                                                </div>
                                                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                    {adLeads[ad.id].leads.map((lead, idx) => (
                                                                        <div key={lead.id || idx} style={{
                                                                            background: 'var(--bg-secondary)',
                                                                            padding: '6px 8px',
                                                                            borderRadius: '4px',
                                                                            marginBottom: '4px',
                                                                            fontSize: '0.7rem'
                                                                        }}>
                                                                            <div style={{ fontWeight: 600 }}>
                                                                                {lead.fullName || lead.firstName || 'Unknown Name'}
                                                                            </div>
                                                                            {lead.email && <div>📧 {lead.email}</div>}
                                                                            {lead.phone && <div>📱 {lead.phone}</div>}
                                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                                                                {new Date(lead.createdAt).toLocaleDateString()}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Expandable ALL METRICS section */}
                                                <details style={{ marginTop: '8px' }}>
                                                    <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '8px', fontWeight: 600 }}>
                                                        📊 Show ALL Metrics (Complete Data)
                                                    </summary>
                                                    <div style={{
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: '8px',
                                                        padding: '12px',
                                                        marginTop: '4px',
                                                        fontSize: '0.7rem'
                                                    }}>
                                                        {/* Core Metrics */}
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>📈 Core Metrics</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px' }}>
                                                                <div>Impressions: <strong>{ad.metrics.impressions?.toLocaleString() ?? 0}</strong></div>
                                                                <div>Reach: <strong>{ad.metrics.reach?.toLocaleString() ?? 0}</strong></div>
                                                                <div>Frequency: <strong>{(ad.metrics.frequency ?? 0).toFixed(2)}</strong></div>
                                                                <div>Spend: <strong>₱{(ad.metrics.spend ?? 0).toFixed(2)}</strong></div>
                                                                <div>CTR (all): <strong>{(ad.metrics.ctr ?? 0).toFixed(2)}%</strong></div>
                                                                <div>CPM: <strong>₱{(ad.metrics.cpm ?? 0).toFixed(2)}</strong></div>
                                                            </div>
                                                        </div>

                                                        {/* Clicks & Links */}
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>🔗 Clicks & Links</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px' }}>
                                                                <div>Clicks (all): <strong>{ad.metrics.clicks ?? 0}</strong></div>
                                                                <div>Link Clicks: <strong>{ad.metrics.linkClicks ?? 0}</strong></div>
                                                                <div>Unique Clicks: <strong>{ad.metrics.uniqueClicks ?? 0}</strong></div>
                                                                <div>Outbound Clicks: <strong>{ad.metrics.outboundClicks ?? 0}</strong></div>
                                                                <div>Landing Page Views: <strong>{ad.metrics.landingPageViews ?? 0}</strong></div>
                                                                <div>CPC (all): <strong>₱{(ad.metrics.cpc ?? 0).toFixed(2)}</strong></div>
                                                            </div>
                                                        </div>

                                                        {/* Results & Conversions */}
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>🎯 Results & Conversions</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px' }}>
                                                                <div>Results: <strong>{ad.metrics.results ?? 0}</strong> ({ad.metrics.resultType ?? 'none'})</div>
                                                                <div>Cost per Result: <strong>₱{(ad.metrics.costPerResult ?? 0).toFixed(2)}</strong></div>
                                                                <div>Leads: <strong>{ad.metrics.leads ?? 0}</strong></div>
                                                                <div>Cost per Lead: <strong>₱{(ad.metrics.costPerLead ?? 0).toFixed(2)}</strong></div>
                                                                <div>Purchases: <strong>{ad.metrics.purchases ?? 0}</strong></div>
                                                                <div>Cost per Purchase: <strong>₱{(ad.metrics.costPerPurchase ?? 0).toFixed(2)}</strong></div>
                                                                <div>Add to Cart: <strong>{ad.metrics.addToCart ?? 0}</strong></div>
                                                                <div>Initiate Checkout: <strong>{ad.metrics.initiateCheckout ?? 0}</strong></div>
                                                                <div>ROAS: <strong>{(ad.metrics.purchaseRoas ?? 0).toFixed(2)}x</strong></div>
                                                            </div>
                                                        </div>

                                                        {/* Messaging */}
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>💬 Messaging</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '4px' }}>
                                                                <div>Messages Started: <strong>{ad.metrics.messagesStarted ?? 0}</strong></div>
                                                                <div>Cost per Msg Started: <strong>₱{(ad.metrics.costPerMessageStarted ?? 0).toFixed(2)}</strong></div>
                                                                <div>Messages (First Reply): <strong>{ad.metrics.messages ?? 0}</strong></div>
                                                                <div>Cost per Message: <strong>₱{(ad.metrics.costPerMessage ?? 0).toFixed(2)}</strong></div>
                                                                <div>New Messaging Contacts: <strong>{ad.metrics.newMessagingContacts ?? 0}</strong></div>
                                                                <div>Total Msging Contacts: <strong>{ad.metrics.totalMessagingContacts ?? 0}</strong></div>
                                                            </div>
                                                        </div>

                                                        {/* Engagement */}
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>👍 Engagement</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px' }}>
                                                                <div>Page Engagement: <strong>{ad.metrics.pageEngagement ?? 0}</strong></div>
                                                                <div>Post Engagement: <strong>{ad.metrics.postEngagement ?? 0}</strong></div>
                                                                <div>Post Reactions: <strong>{ad.metrics.postReactions ?? 0}</strong></div>
                                                                <div>Post Comments: <strong>{ad.metrics.postComments ?? 0}</strong></div>
                                                                <div>Post Shares: <strong>{ad.metrics.postShares ?? 0}</strong></div>
                                                            </div>
                                                        </div>

                                                        {/* Video Metrics */}
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>🎬 Video Metrics</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px' }}>
                                                                <div>Video Views: <strong>{ad.metrics.videoViews ?? 0}</strong></div>
                                                                <div>Video Plays: <strong>{ad.metrics.videoPlays ?? 0}</strong></div>
                                                                <div>ThruPlays: <strong>{ad.metrics.videoThruPlays ?? 0}</strong></div>
                                                                <div>2-Sec Views: <strong>{ad.metrics.video2SecViews ?? 0}</strong></div>
                                                                <div>25% Watched: <strong>{ad.metrics.video25Watched ?? 0}</strong></div>
                                                                <div>50% Watched: <strong>{ad.metrics.video50Watched ?? 0}</strong></div>
                                                                <div>75% Watched: <strong>{ad.metrics.video75Watched ?? 0}</strong></div>
                                                                <div>95% Watched: <strong>{ad.metrics.video95Watched ?? 0}</strong></div>
                                                                <div>100% Watched: <strong>{ad.metrics.video100Watched ?? 0}</strong></div>
                                                                <div>Avg Watch Time: <strong>{ad.metrics.videoAvgWatchTime ?? 0}s</strong></div>
                                                                <div>Cost/ThruPlay: <strong>₱{(ad.metrics.costPerThruPlay ?? 0).toFixed(2)}</strong></div>
                                                            </div>
                                                        </div>

                                                        {/* Quality Rankings */}
                                                        <div>
                                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--primary)' }}>⭐ Quality Rankings</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px' }}>
                                                                <div>Quality: <strong>{ad.metrics.qualityRanking ?? '-'}</strong></div>
                                                                <div>Engagement Rate: <strong>{ad.metrics.engagementRateRanking ?? '-'}</strong></div>
                                                                <div>Conversion Rate: <strong>{ad.metrics.conversionRateRanking ?? '-'}</strong></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </details>

                                                {/* AI-Powered Metrics Analysis */}
                                                {(ad.metrics.rawActions?.length ?? 0) > 0 && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        {!aiAnalysis[ad.id]?.data && (
                                                            <button
                                                                onClick={() => analyzeWithAI(ad.id, ad.name, ad.metrics!)}
                                                                disabled={aiAnalysis[ad.id]?.loading}
                                                                style={{
                                                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.75rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px'
                                                                }}
                                                            >
                                                                {aiAnalysis[ad.id]?.loading ? '🔄 Analyzing...' : '🤖 AI Analyze Metrics'}
                                                            </button>
                                                        )}

                                                        {/* AI Analysis Results */}
                                                        {aiAnalysis[ad.id]?.data && (
                                                            <div style={{
                                                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1))',
                                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                                borderRadius: '8px',
                                                                padding: '12px',
                                                                marginTop: '8px'
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                    <span style={{ fontSize: '1rem' }}>🤖</span>
                                                                    <strong style={{ fontSize: '0.875rem', color: '#a78bfa' }}>AI Analysis</strong>
                                                                    <span style={{
                                                                        background: aiAnalysis[ad.id]!.data!.overallScore >= 70 ? '#22c55e' : aiAnalysis[ad.id]!.data!.overallScore >= 50 ? '#f59e0b' : '#ef4444',
                                                                        color: '#000',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '10px',
                                                                        fontSize: '0.6875rem',
                                                                        fontWeight: 600
                                                                    }}>
                                                                        Score: {aiAnalysis[ad.id]!.data!.overallScore}
                                                                    </span>
                                                                </div>
                                                                <p style={{ fontSize: '0.8125rem', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                                                                    {aiAnalysis[ad.id]!.data!.summary}
                                                                </p>

                                                                {/* AI Labeled Metrics */}
                                                                <div style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                                    gap: '6px',
                                                                    marginBottom: '10px'
                                                                }}>
                                                                    {aiAnalysis[ad.id]!.data!.labeledMetrics?.slice(0, 8).map((m, idx) => (
                                                                        <div key={idx} style={{
                                                                            background: m.assessment === 'good' ? 'rgba(34, 197, 94, 0.1)' : m.assessment === 'poor' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                                            border: `1px solid ${m.assessment === 'good' ? 'rgba(34, 197, 94, 0.3)' : m.assessment === 'poor' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                                                            borderRadius: '6px',
                                                                            padding: '6px 8px',
                                                                            fontSize: '0.6875rem'
                                                                        }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span>{m.emoji} {m.label}</span>
                                                                                <strong>{m.value}</strong>
                                                                            </div>
                                                                            {m.cost !== null && <div style={{ color: '#22c55e', fontSize: '0.625rem' }}>₱{m.cost.toFixed(2)} each</div>}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Recommendations */}
                                                                {aiAnalysis[ad.id]!.data!.recommendations?.length > 0 && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                        <strong style={{ color: 'var(--primary)' }}>💡 Recommendations:</strong>
                                                                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                                                            {aiAnalysis[ad.id]!.data!.recommendations.slice(0, 3).map((r, i) => (
                                                                                <li key={i}>{r}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Fallback: Raw Actions (collapsible) */}
                                                        <details style={{ marginTop: '8px' }}>
                                                            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.625rem' }}>
                                                                📋 Raw Facebook Actions ({ad.metrics.rawActions?.length} types)
                                                            </summary>
                                                            <div style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                                gap: '4px',
                                                                padding: '8px',
                                                                background: '#1a1a2e',
                                                                borderRadius: '8px',
                                                                marginTop: '4px',
                                                                fontSize: '0.625rem'
                                                            }}>
                                                                {ad.metrics.rawActions?.map((action, idx) => {
                                                                    const costData = ad.metrics?.rawCostPerAction?.find(c => c.type === action.type);
                                                                    return (
                                                                        <div key={idx} style={{
                                                                            background: '#2a2a3e',
                                                                            padding: '4px 8px',
                                                                            borderRadius: '4px',
                                                                            display: 'flex',
                                                                            justifyContent: 'space-between'
                                                                        }}>
                                                                            <span style={{ color: '#888' }}>{action.type.replace(/_/g, ' ')}</span>
                                                                            <span>
                                                                                <strong>{action.value}</strong>
                                                                                {costData && <span style={{ color: '#22c55e', marginLeft: '4px' }}>₱{costData.cost.toFixed(2)}</span>}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}

                                                {/* Breakdowns - simplified */}
                                                {((ad.byPlatform?.length ?? 0) > 0 || (ad.byDevice?.length ?? 0) > 0) && (
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        flexWrap: 'wrap',
                                                        marginTop: '6px',
                                                        fontSize: '0.6875rem'
                                                    }}>
                                                        {(ad.byPlatform?.length ?? 0) > 0 && (
                                                            <span style={{ background: '#1e1e2e', padding: '2px 8px', borderRadius: '4px', border: '1px solid #3a3a4e' }}>
                                                                📱 {ad.byPlatform?.map((p) => p.platform).join(', ')}
                                                            </span>
                                                        )}
                                                        {(ad.byDevice?.length ?? 0) > 0 && (
                                                            <span style={{ background: '#1e1e2e', padding: '2px 8px', borderRadius: '4px', border: '1px solid #3a3a4e' }}>
                                                                💻 {ad.byDevice?.map((d) => d.device).join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                No metrics available yet
                                            </div>
                                        )}

                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            ID: {ad.id} • Created: {new Date(ad.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Trait Selection (only for selected ads) */}
                                {selectedAds.has(ad.id) && (
                                    <div style={{
                                        marginTop: 'var(--spacing-md)',
                                        paddingTop: 'var(--spacing-md)',
                                        borderTop: '1px solid var(--border-primary)'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                            🏷️ Tag traits for AI learning:
                                        </div>

                                        {/* Categories */}
                                        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                            <span style={{ fontSize: '0.75rem', marginRight: '8px' }}>Categories:</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                {DEFAULT_CATEGORIES.categories.slice(0, 8).map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTrait(ad.id, 'categories', cat);
                                                        }}
                                                        style={{
                                                            padding: '2px 8px',
                                                            fontSize: '0.6875rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: adTraits[ad.id]?.categories.includes(cat)
                                                                ? '1px solid var(--primary)'
                                                                : '1px solid var(--border-primary)',
                                                            background: adTraits[ad.id]?.categories.includes(cat)
                                                                ? 'var(--primary)'
                                                                : 'transparent',
                                                            color: adTraits[ad.id]?.categories.includes(cat)
                                                                ? '#120a1c'
                                                                : 'var(--text-secondary)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Traits */}
                                        <div>
                                            <span style={{ fontSize: '0.75rem', marginRight: '8px' }}>Traits:</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                {DEFAULT_CATEGORIES.traits.slice(0, 10).map(trait => (
                                                    <button
                                                        key={trait}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTrait(ad.id, 'traits', trait);
                                                        }}
                                                        style={{
                                                            padding: '2px 8px',
                                                            fontSize: '0.6875rem',
                                                            borderRadius: 'var(--radius-full)',
                                                            border: adTraits[ad.id]?.traits.includes(trait)
                                                                ? '1px solid var(--accent)'
                                                                : '1px solid var(--border-primary)',
                                                            background: adTraits[ad.id]?.traits.includes(trait)
                                                                ? 'var(--accent)'
                                                                : 'transparent',
                                                            color: adTraits[ad.id]?.traits.includes(trait)
                                                                ? '#120a1c'
                                                                : 'var(--text-secondary)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {trait}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div >
            )
            }

            {/* Empty State */}
            {
                facebookAds.length === 0 && !isLoading && (
                    <div className="glass-card" style={{
                        padding: 'var(--spacing-xl)',
                        textAlign: 'center',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>📥</div>
                        <h3>Import Existing Ads</h3>
                        <p>Connect your Facebook Ad Account to import ads with auto-filled results</p>
                        <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto', marginTop: 'var(--spacing-md)' }}>
                            <li>✅ Auto-fetch impressions, clicks, CTR, conversions</li>
                            <li>✅ Import active, paused, or archived ads</li>
                            <li>✅ Tag traits for AI learning</li>
                            <li>✅ Sync results anytime to update algorithm</li>
                        </ul>
                    </div>
                )
            }

            {/* Metric Insight Modal */}
            {
                metricModal && metricModal.open && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}
                        onClick={() => setMetricModal(null)}
                    >
                        <div
                            style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: '16px',
                                padding: '24px',
                                maxWidth: '500px',
                                width: '90%',
                                border: '1px solid var(--border-primary)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {(() => {
                                const info = metricInfo[metricModal.metric];
                                const numValue = typeof metricModal.value === 'number' ? metricModal.value : parseFloat(metricModal.value) || 0;
                                const rating = info?.benchmark(numValue);
                                const ratingColor = rating === 'good' ? '#22c55e' : rating === 'average' ? '#f59e0b' : '#ef4444';
                                const ratingEmoji = rating === 'good' ? '✅' : rating === 'average' ? '⚡' : '⚠️';

                                return info ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <h3 style={{ margin: 0 }}>{info.name}</h3>
                                            <button
                                                onClick={() => setMetricModal(null)}
                                                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                                            >×</button>
                                        </div>

                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                            {info.description}
                                        </p>

                                        <div style={{
                                            background: 'var(--bg-tertiary)',
                                            padding: '16px',
                                            borderRadius: '12px',
                                            marginBottom: '16px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                Current Value for &quot;{metricModal.adName}&quot;
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                                                {typeof metricModal.value === 'number'
                                                    ? (metricModal.metric.includes('ctr') || metricModal.metric.includes('frequency')
                                                        ? `${metricModal.value.toFixed(2)}${metricModal.metric === 'ctr' ? '%' : ''}`
                                                        : `₱${metricModal.value.toFixed(2)}`)
                                                    : metricModal.value
                                                }
                                            </div>
                                            <div style={{
                                                display: 'inline-block',
                                                marginTop: '8px',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                background: ratingColor,
                                                color: '#000',
                                                fontWeight: 600,
                                                fontSize: '0.875rem'
                                            }}>
                                                {ratingEmoji} {rating?.toUpperCase()} PERFORMANCE
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '0.875rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></span>
                                                <span><strong>Good:</strong> {info.good}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></span>
                                                <span><strong>Average:</strong> {info.average}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></span>
                                                <span><strong>Needs Work:</strong> {info.poor}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <h3>{metricModal.metric}</h3>
                                        <p>Value: {metricModal.value}</p>
                                        <button onClick={() => setMetricModal(null)} className="btn">Close</button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
