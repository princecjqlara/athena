import { NextRequest, NextResponse } from 'next/server';

// Default stages to create if pipeline has minimal stages
const DEFAULT_JOURNEY_STAGES = [
    { id: 'new-lead', name: 'New Lead', isGoal: false },
    { id: 'contacted', name: 'Contacted', isGoal: false },
    { id: 'interested', name: 'Interested', isGoal: false },
    { id: 'negotiating', name: 'Negotiating', isGoal: false },
    { id: 'converted', name: 'Converted', isGoal: true },
];

/**
 * POST /api/ai/analyze
 * Analyze conversations with AI to extract:
 * - Contact info (email, phone, name) - ONLY from messages, never from page
 * - Sentiment (positive, neutral, negative)
 * - Intent (buying, inquiry, complaint, etc.)
 * - Lead score (1-100)
 * - Suggested stage based on conversation journey
 * - Create missing stages if needed
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

        // Determine stages to use (existing or create suggestions)
        let stagesToUse = pipelineStages || [];
        const suggestedNewStages: Array<{ id: string; name: string; isGoal: boolean }> = [];

        // If pipeline has minimal stages, suggest adding journey stages
        if (stagesToUse.length < 4) {
            for (const defaultStage of DEFAULT_JOURNEY_STAGES) {
                const exists = stagesToUse.some((s: any) =>
                    s.name.toLowerCase() === defaultStage.name.toLowerCase() ||
                    s.id === defaultStage.id
                );
                if (!exists) {
                    suggestedNewStages.push(defaultStage);
                }
            }
        }

        // Combine existing + suggested stages for assignment
        const allAvailableStages = [...stagesToUse, ...suggestedNewStages];

        // Analyze each conversation
        const analyzedLeads = await Promise.all(conversations.map(async (conv: any) => {
            const messages = conv.messages || [];
            const allText = messages.map((m: any) => m.content || '').join('\n');

            // ONLY extract contact info from messages - NEVER use conv.email/phone
            const emailMatch = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = allText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

            // Try to extract name if mentioned
            const namePatterns = [
                /(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
                /(?:name:?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
            ];
            let extractedName = null;
            for (const pattern of namePatterns) {
                const match = allText.match(pattern);
                if (match) {
                    extractedName = match[1];
                    break;
                }
            }

            // Simple sentiment analysis based on keywords
            const positiveWords = ['love', 'great', 'amazing', 'excellent', 'thank', 'interested', 'want', 'buy', 'order', 'yes', 'please', 'good', 'perfect', 'nice'];
            const negativeWords = ['hate', 'terrible', 'awful', 'never', 'no', 'cancel', 'refund', 'complaint', 'problem', 'issue', 'bad', 'wrong'];

            const textLower = allText.toLowerCase();
            let positiveCount = positiveWords.filter(w => textLower.includes(w)).length;
            let negativeCount = negativeWords.filter(w => textLower.includes(w)).length;

            let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
            if (positiveCount > negativeCount) sentiment = 'positive';
            if (negativeCount > positiveCount) sentiment = 'negative';

            // Determine intent with better keywords
            const intents = {
                'buying': ['buy', 'purchase', 'order', 'how much', 'price', 'cost', 'payment', 'pay', 'checkout', 'delivery', 'ship'],
                'interested': ['interested', 'want to know', 'tell me more', 'learn more', 'information', 'details', 'yes', 'please'],
                'inquiry': ['question', 'ask', 'wondering', 'info', 'what is', 'how does'],
                'negotiating': ['discount', 'deal', 'offer', 'lower price', 'negotiate', 'budget'],
                'complaint': ['problem', 'issue', 'broken', 'refund', 'not working', 'bad'],
                'support': ['help', 'support', 'assist', 'having trouble']
            };

            let intent = 'general';
            let maxMatches = 0;
            for (const [key, keywords] of Object.entries(intents)) {
                const matches = keywords.filter(k => textLower.includes(k)).length;
                if (matches > maxMatches) {
                    maxMatches = matches;
                    intent = key;
                }
            }

            // Calculate lead score (basic heuristic)
            let leadScore = 50;
            if (sentiment === 'positive') leadScore += 15;
            if (sentiment === 'negative') leadScore -= 15;
            if (intent === 'buying') leadScore += 30;
            if (intent === 'interested') leadScore += 20;
            if (intent === 'negotiating') leadScore += 25;
            if (intent === 'inquiry') leadScore += 10;
            if (intent === 'complaint') leadScore -= 15;
            if (emailMatch) leadScore += 5;
            if (phoneMatch) leadScore += 5;
            if (messages.length > 3) leadScore += 5;
            if (messages.length > 6) leadScore += 5;
            leadScore = Math.max(0, Math.min(100, leadScore));

            // Suggest stage based on conversation journey
            let suggestedStage = 'new-lead';

            // Determine stage based on intent and score
            if (intent === 'buying' || leadScore >= 80) {
                const convStage = allAvailableStages.find((s: any) =>
                    s.name.toLowerCase().includes('negotiat') ||
                    s.name.toLowerCase().includes('hot') ||
                    s.name.toLowerCase().includes('ready')
                );
                suggestedStage = convStage?.id || 'negotiating';
            } else if (intent === 'negotiating') {
                const negStage = allAvailableStages.find((s: any) =>
                    s.name.toLowerCase().includes('negotiat')
                );
                suggestedStage = negStage?.id || 'negotiating';
            } else if (intent === 'interested' || leadScore >= 60) {
                const intStage = allAvailableStages.find((s: any) =>
                    s.name.toLowerCase().includes('interest') ||
                    s.name.toLowerCase().includes('qualif') ||
                    s.name.toLowerCase().includes('warm')
                );
                suggestedStage = intStage?.id || 'interested';
            } else if (messages.length > 2 || leadScore >= 40) {
                const contStage = allAvailableStages.find((s: any) =>
                    s.name.toLowerCase().includes('contact') ||
                    s.name.toLowerCase().includes('engaged')
                );
                suggestedStage = contStage?.id || 'contacted';
            }

            // Generate summary
            let summary = '';
            if (messages.length > 0) {
                if (intent === 'buying') {
                    summary = `Ready to buy. ${sentiment === 'positive' ? 'Very engaged.' : 'May need follow-up.'}`;
                } else if (intent === 'negotiating') {
                    summary = `Negotiating terms. Close to conversion.`;
                } else if (intent === 'interested') {
                    summary = `Showing interest. Good lead potential.`;
                } else if (intent === 'inquiry') {
                    summary = `Asking questions. Needs more information.`;
                } else if (intent === 'complaint') {
                    summary = `Has a concern that needs addressing.`;
                } else {
                    summary = `${messages.length} messages. ${sentiment === 'positive' ? 'Positive interaction.' : 'Standard inquiry.'}`;
                }
            }

            return {
                ...conv,
                // IMPORTANT: Only use extracted data - NEVER fall back to conv.email/phone
                name: extractedName || conv.name || 'Unknown',
                email: emailMatch ? emailMatch[0] : null, // NULL if not found, never page email
                phone: phoneMatch ? phoneMatch[0] : null, // NULL if not found, never page phone
                // AI analysis results
                aiAnalysis: {
                    sentiment,
                    intent,
                    leadScore,
                    suggestedStage,
                    summary,
                    extractedName,
                    extractedEmail: emailMatch ? emailMatch[0] : null,
                    extractedPhone: phoneMatch ? phoneMatch[0] : null,
                    analyzedAt: new Date().toISOString()
                }
            };
        }));

        console.log(`[AI Analysis] Analyzed ${analyzedLeads.length} conversations`);
        console.log(`[AI Analysis] Suggested new stages:`, suggestedNewStages.map(s => s.name));

        return NextResponse.json({
            success: true,
            leads: analyzedLeads,
            count: analyzedLeads.length,
            // Return suggested stages to create
            suggestedStages: suggestedNewStages,
            summary: {
                positive: analyzedLeads.filter(l => l.aiAnalysis?.sentiment === 'positive').length,
                neutral: analyzedLeads.filter(l => l.aiAnalysis?.sentiment === 'neutral').length,
                negative: analyzedLeads.filter(l => l.aiAnalysis?.sentiment === 'negative').length,
                avgScore: Math.round(analyzedLeads.reduce((sum, l) => sum + (l.aiAnalysis?.leadScore || 0), 0) / analyzedLeads.length)
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
