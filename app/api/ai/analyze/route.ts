import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ai/analyze
 * Analyze conversations with AI to extract:
 * - Contact info (email, phone, name)
 * - Sentiment (positive, neutral, negative)
 * - Intent (buying, inquiry, complaint, etc.)
 * - Lead score (1-100)
 * - Suggested stage
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

        // Analyze each conversation
        const analyzedLeads = await Promise.all(conversations.map(async (conv: any) => {
            const messages = conv.messages || [];
            const allText = messages.map((m: any) => m.content || '').join('\n');

            // Extract contact info from messages
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
            const positiveWords = ['love', 'great', 'amazing', 'excellent', 'thank', 'interested', 'want', 'buy', 'order', 'yes', 'please'];
            const negativeWords = ['hate', 'terrible', 'awful', 'never', 'no', 'cancel', 'refund', 'complaint', 'problem', 'issue'];

            const textLower = allText.toLowerCase();
            let positiveCount = positiveWords.filter(w => textLower.includes(w)).length;
            let negativeCount = negativeWords.filter(w => textLower.includes(w)).length;

            let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
            if (positiveCount > negativeCount + 1) sentiment = 'positive';
            if (negativeCount > positiveCount + 1) sentiment = 'negative';

            // Determine intent
            const intents = {
                'buying': ['buy', 'purchase', 'order', 'how much', 'price', 'cost', 'want to get'],
                'inquiry': ['question', 'ask', 'wondering', 'info', 'details', 'learn more'],
                'complaint': ['problem', 'issue', 'broken', 'refund', 'not working'],
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
            if (sentiment === 'positive') leadScore += 20;
            if (sentiment === 'negative') leadScore -= 20;
            if (intent === 'buying') leadScore += 25;
            if (intent === 'inquiry') leadScore += 10;
            if (intent === 'complaint') leadScore -= 15;
            if (emailMatch) leadScore += 5;
            if (phoneMatch) leadScore += 5;
            if (messages.length > 3) leadScore += 10;
            leadScore = Math.max(0, Math.min(100, leadScore));

            // Suggest stage based on intent and sentiment
            let suggestedStage = 'new-lead';
            if (pipelineStages && pipelineStages.length > 0) {
                if (intent === 'buying' && sentiment === 'positive') {
                    // Look for a "qualified" or "interested" stage
                    const qualifiedStage = pipelineStages.find((s: any) =>
                        s.name.toLowerCase().includes('qualified') ||
                        s.name.toLowerCase().includes('interested') ||
                        s.name.toLowerCase().includes('hot')
                    );
                    if (qualifiedStage) suggestedStage = qualifiedStage.id;
                }
            }

            // Generate summary
            let summary = '';
            if (messages.length > 0) {
                if (intent === 'buying') {
                    summary = `Interested in purchasing. ${sentiment === 'positive' ? 'Very engaged.' : ''}`;
                } else if (intent === 'inquiry') {
                    summary = `Asking questions. Needs more information.`;
                } else if (intent === 'complaint') {
                    summary = `Has a concern or complaint that needs addressing.`;
                } else {
                    summary = `${messages.length} messages exchanged. ${sentiment === 'positive' ? 'Positive interaction.' : sentiment === 'negative' ? 'May need attention.' : 'Standard inquiry.'}`;
                }
            }

            return {
                ...conv,
                // Override with extracted data if found
                name: extractedName || conv.name || 'Unknown',
                email: emailMatch ? emailMatch[0] : conv.email,
                phone: phoneMatch ? phoneMatch[0] : conv.phone,
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

        return NextResponse.json({
            success: true,
            leads: analyzedLeads,
            count: analyzedLeads.length,
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
