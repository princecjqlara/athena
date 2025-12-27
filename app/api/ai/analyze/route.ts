import { NextRequest, NextResponse } from 'next/server';

// Comprehensive sales funnel stages - AI will suggest these if pipeline has few stages
const COMPREHENSIVE_SALES_STAGES = [
    { id: 'new-lead', name: 'New Lead', isGoal: false, description: 'Just received, not yet contacted' },
    { id: 'contacted', name: 'Contacted', isGoal: false, description: 'Initial contact made, awaiting response' },
    { id: 'engaged', name: 'Engaged', isGoal: false, description: 'Customer responded, conversation started' },
    { id: 'qualified', name: 'Qualified', isGoal: false, description: 'Customer fits target profile, shows genuine interest' },
    { id: 'product-aware', name: 'Product Aware', isGoal: false, description: 'Customer knows product details and pricing' },
    { id: 'considering', name: 'Considering', isGoal: false, description: 'Customer is evaluating, may have questions' },
    { id: 'negotiating', name: 'Negotiating', isGoal: false, description: 'Discussing terms, price, or conditions' },
    { id: 'ready-to-buy', name: 'Ready to Buy', isGoal: false, description: 'Customer confirmed intent to purchase' },
    { id: 'closed-won', name: 'Closed Won', isGoal: true, description: 'Successfully converted to customer' },
];

/**
 * POST /api/ai/analyze
 * Analyze conversations with AI to extract:
 * - Contact info (email, phone, name) - ONLY from customer messages
 * - Sentiment (positive, neutral, negative)
 * - Intent based on detailed conversation analysis
 * - Lead score (1-100)
 * - Suggested stage based on ACTUAL conversation content and customer journey
 */
export async function POST(request: NextRequest) {
    try {
        const { conversations, pipelineStages } = await request.json();

        if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No conversations provided'
            }, { status: 400 });
        }

        // Get existing stages
        let stagesToUse = pipelineStages || [];
        const suggestedNewStages: Array<{ id: string; name: string; isGoal: boolean }> = [];

        // Check if pipeline already has a goal
        const hasGoal = stagesToUse.some((s: any) => s.isGoal);

        // Suggest comprehensive stages if pipeline has fewer than 5 stages
        if (stagesToUse.length < 5) {
            console.log(`[AI] Pipeline has ${stagesToUse.length} stages, suggesting more comprehensive funnel`);
            for (const stage of COMPREHENSIVE_SALES_STAGES) {
                const exists = stagesToUse.some((s: any) =>
                    s.name.toLowerCase() === stage.name.toLowerCase() ||
                    s.id === stage.id
                );
                if (!exists) {
                    // Skip goal stage if one exists
                    if (stage.isGoal && hasGoal) continue;
                    suggestedNewStages.push({
                        id: stage.id,
                        name: stage.name,
                        isGoal: stage.isGoal && !hasGoal
                    });
                }
            }
        }

        const allAvailableStages = [...stagesToUse, ...suggestedNewStages];

        // Analyze each conversation INDIVIDUALLY
        const analyzedLeads = await Promise.all(conversations.map(async (conv: any) => {
            const messages = conv.messages || [];

            // Get ONLY customer messages (not page responses)
            const customerPsid = conv.facebookPsid;
            const customerMessages = messages.filter((m: any) => m.fromId === customerPsid);
            const customerText = customerMessages.map((m: any) => m.content || '').join('\n').toLowerCase();
            const allText = messages.map((m: any) => m.content || '').join('\n').toLowerCase();

            // Count customer messages vs page messages
            const customerMsgCount = customerMessages.length;
            const pageMsgCount = messages.length - customerMsgCount;

            // Extract contact info from CUSTOMER messages only
            const emailMatch = customerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = customerText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

            // Sentiment analysis
            const positiveWords = ['thank', 'thanks', 'great', 'perfect', 'love', 'excellent', 'yes', 'sure', 'okay', 'ok'];
            const negativeWords = ['no', 'not', 'cancel', 'refund', 'problem', 'issue', 'wrong', 'bad'];

            let positiveCount = positiveWords.filter(w => customerText.includes(w)).length;
            let negativeCount = negativeWords.filter(w => customerText.includes(w)).length;

            let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
            if (positiveCount > negativeCount) sentiment = 'positive';
            if (negativeCount > positiveCount) sentiment = 'negative';

            // Determine conversation stage based on ACTUAL content
            // Be conservative - don't assume high intent without evidence
            let stage: 'new' | 'contacted' | 'interested' | 'negotiating' | 'ready' = 'new';
            let intent = 'inquiry';

            // Check for STRONG buying signals - includes common Filipino/Taglish expressions
            const buyingPhrases = [
                'i want to buy', 'i will buy', 'ill take', "i'll take", 'i want to order',
                'place order', 'confirm order', 'proceed with', 'ready to pay',
                'order na', 'bibili', 'gusto ko', 'kukunin ko', 'bili na', 'yes order',
                'order ko', 'take ko', 'i want', 'can i order', 'pwede ba', 'g na'
            ];
            const negotiatingPhrases = [
                'discount', 'lower price', 'best price', 'final price', 'deal',
                'negotiate', 'can you give', 'mas mura', 'tawad', 'bawas',
                'last price', 'meron discount', 'pwede discount', 'budget', 'afford'
            ];
            const interestedPhrases = [
                'interested', 'tell me more', 'how does it work', 'more info',
                'send details', 'im interested', "i'm interested", 'interisado',
                'pano', 'paano', 'ano meron', 'pwede', 'saan', 'may', 'san',
                'can you send', 'details please', 'info please', 'yes please'
            ];
            const inquiryPhrases = [
                'how much', 'price', 'cost', 'available', 'what is', 'do you have',
                'magkano', 'presyo', 'meron ba', 'available ba', 'asking', 'rate'
            ];

            // Check customer text for intent signals
            const hasBuyingSignal = buyingPhrases.some(p => customerText.includes(p));
            const hasNegotiating = negotiatingPhrases.some(p => customerText.includes(p));
            const hasInterested = interestedPhrases.some(p => customerText.includes(p));
            const hasInquiry = inquiryPhrases.some(p => customerText.includes(p));

            // Log what we found for debugging
            console.log(`[AI] Lead "${conv.name}" (${customerMsgCount} msgs):`, {
                customerText: customerText.substring(0, 200) + (customerText.length > 200 ? '...' : ''),
                signals: { hasBuyingSignal, hasNegotiating, hasInterested, hasInquiry }
            });

            // Determine stage based on strongest signal
            if (hasBuyingSignal) {
                stage = 'ready';
                intent = 'buying';
            } else if (hasNegotiating) {
                stage = 'negotiating';
                intent = 'negotiating';
            } else if (hasInterested) {
                stage = 'interested';
                intent = 'interested';
            } else if (hasInquiry || customerMsgCount >= 1) {
                stage = 'contacted';
                intent = 'inquiry';
            }
            // If no customer messages at all, stays as 'new'

            // Calculate lead score based on actual engagement
            let leadScore = 30; // Base score
            leadScore += customerMsgCount * 5; // +5 per customer message
            leadScore += Math.min(pageMsgCount * 2, 10); // +2 per page response, max +10
            if (sentiment === 'positive') leadScore += 10;
            if (sentiment === 'negative') leadScore -= 10;
            if (hasBuyingSignal) leadScore += 30;
            if (hasNegotiating) leadScore += 20;
            if (hasInterested) leadScore += 15;
            if (hasInquiry) leadScore += 5;
            if (emailMatch) leadScore += 5;
            if (phoneMatch) leadScore += 5;
            leadScore = Math.max(0, Math.min(100, leadScore));

            // Map stage to actual pipeline stage ID
            let suggestedStageId = 'new-lead';

            // Map detected stage to comprehensive funnel
            if (stage === 'ready') {
                const match = allAvailableStages.find((s: any) =>
                    s.name.toLowerCase().includes('ready') ||
                    s.name.toLowerCase().includes('closed') ||
                    s.name.toLowerCase().includes('won')
                );
                suggestedStageId = match?.id || 'ready-to-buy';
            } else if (stage === 'negotiating') {
                const match = allAvailableStages.find((s: any) =>
                    s.name.toLowerCase().includes('negotiat') ||
                    s.name.toLowerCase().includes('considering') ||
                    s.name.toLowerCase().includes('quote')
                );
                suggestedStageId = match?.id || 'negotiating';
            } else if (stage === 'interested') {
                // Check if they know about the product
                const knowsProduct = customerText.includes('price') ||
                    customerText.includes('cost') ||
                    customerText.includes('magkano') ||
                    customerText.includes('presyo');
                if (knowsProduct) {
                    const match = allAvailableStages.find((s: any) =>
                        s.name.toLowerCase().includes('product') ||
                        s.name.toLowerCase().includes('aware') ||
                        s.name.toLowerCase().includes('qualified')
                    );
                    suggestedStageId = match?.id || 'product-aware';
                } else {
                    const match = allAvailableStages.find((s: any) =>
                        s.name.toLowerCase().includes('qualified') ||
                        s.name.toLowerCase().includes('interest') ||
                        s.name.toLowerCase().includes('engaged')
                    );
                    suggestedStageId = match?.id || 'qualified';
                }
            } else if (stage === 'contacted') {
                // Check if customer engaged (responded) or just contacted
                if (customerMsgCount >= 2) {
                    const match = allAvailableStages.find((s: any) =>
                        s.name.toLowerCase().includes('engaged') ||
                        s.name.toLowerCase().includes('qualified')
                    );
                    suggestedStageId = match?.id || 'engaged';
                } else if (customerMsgCount >= 1) {
                    const match = allAvailableStages.find((s: any) =>
                        s.name.toLowerCase().includes('contacted') ||
                        s.name.toLowerCase().includes('engaged')
                    );
                    suggestedStageId = match?.id || 'contacted';
                }
            }

            // Generate summary
            let summary = '';
            if (customerMsgCount === 0) {
                summary = 'No customer messages yet.';
            } else if (hasBuyingSignal) {
                summary = `Ready to buy. ${customerMsgCount} messages from customer.`;
            } else if (hasNegotiating) {
                summary = `Discussing pricing/terms. ${customerMsgCount} messages.`;
            } else if (hasInterested) {
                summary = `Showing interest. ${customerMsgCount} messages.`;
            } else {
                summary = `Initial inquiry. ${customerMsgCount} customer messages.`;
            }

            console.log(`[AI] Lead "${conv.name}": stage=${stage}, intent=${intent}, score=${leadScore}, customerMsgs=${customerMsgCount}`);

            return {
                ...conv,
                // ONLY use extracted values - NULL if not found
                name: conv.name || 'Unknown',
                email: emailMatch ? emailMatch[0] : null,
                phone: phoneMatch ? phoneMatch[0] : null,
                aiAnalysis: {
                    sentiment,
                    intent,
                    stage,
                    leadScore,
                    suggestedStage: suggestedStageId,
                    summary,
                    customerMessageCount: customerMsgCount,
                    extractedEmail: emailMatch ? emailMatch[0] : null,
                    extractedPhone: phoneMatch ? phoneMatch[0] : null,
                    analyzedAt: new Date().toISOString()
                }
            };
        }));

        // Log distribution
        const stageDistribution = analyzedLeads.reduce((acc: any, l) => {
            const stage = l.aiAnalysis?.stage || 'unknown';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
        }, {});
        console.log(`[AI Analysis] Stage distribution:`, stageDistribution);

        return NextResponse.json({
            success: true,
            leads: analyzedLeads,
            count: analyzedLeads.length,
            suggestedStages: suggestedNewStages,
            summary: {
                positive: analyzedLeads.filter(l => l.aiAnalysis?.sentiment === 'positive').length,
                neutral: analyzedLeads.filter(l => l.aiAnalysis?.sentiment === 'neutral').length,
                negative: analyzedLeads.filter(l => l.aiAnalysis?.sentiment === 'negative').length,
                avgScore: Math.round(analyzedLeads.reduce((sum, l) => sum + (l.aiAnalysis?.leadScore || 0), 0) / analyzedLeads.length),
                stageDistribution
            }
        });

    } catch (error) {
        console.error('[AI Analysis] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Analysis failed'
        }, { status: 500 });
    }
}
