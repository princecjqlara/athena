import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

interface Message {
    content: string;
    direction: 'inbound' | 'outbound';
    timestamp: string;
}

interface AnalysisResult {
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: string;
    leadScore: number;
    summary: string;
    suggestedAction?: string;
}

export async function POST(request: NextRequest) {
    if (!apiKey) {
        return NextResponse.json(
            { success: false, error: 'GEMINI_API_KEY not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { messages, contactName, pipelineGoal } = body as {
            messages: Message[];
            contactName: string;
            pipelineGoal?: string;
        };

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No messages provided' },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Format messages for analysis
        const conversationText = messages.map(m =>
            `${m.direction === 'inbound' ? contactName : 'Agent'}: ${m.content}`
        ).join('\n');

        const prompt = `Analyze this conversation with a potential lead named "${contactName}". 
${pipelineGoal ? `The business goal is: ${pipelineGoal}` : ''}

CONVERSATION:
${conversationText}

Provide analysis in the following JSON format (respond ONLY with valid JSON, no markdown):
{
    "sentiment": "positive" | "neutral" | "negative",
    "intent": "brief description of what the customer wants",
    "leadScore": number between 0-100 representing likelihood to convert,
    "summary": "2-3 sentence summary of the conversation",
    "suggestedAction": "recommended next step for the sales team"
}

Consider these factors for lead score:
- High (70-100): Expressed strong interest, asked about pricing, ready to buy
- Medium (40-69): Engaged in conversation, asked questions, but hasn't committed
- Low (0-39): Just browsing, not responsive, or expressed disinterest`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse the JSON response
        let analysis: AnalysisResult;
        try {
            // Clean up potential markdown code blocks
            const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText);
            // Fallback analysis
            analysis = {
                sentiment: 'neutral',
                intent: 'Unable to determine',
                leadScore: 50,
                summary: 'Analysis could not be completed.',
                suggestedAction: 'Review conversation manually'
            };
        }

        // Validate and sanitize the response
        analysis = {
            sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment)
                ? analysis.sentiment : 'neutral',
            intent: String(analysis.intent || 'Unknown'),
            leadScore: Math.max(0, Math.min(100, Number(analysis.leadScore) || 50)),
            summary: String(analysis.summary || 'No summary available'),
            suggestedAction: analysis.suggestedAction ? String(analysis.suggestedAction) : undefined
        };

        return NextResponse.json({
            success: true,
            data: analysis
        });

    } catch (error) {
        console.error('Conversation analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to analyze conversation' },
            { status: 500 }
        );
    }
}
