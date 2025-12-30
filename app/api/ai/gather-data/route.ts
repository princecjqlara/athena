// AI Data Gathering API - Conversational data collection with step-by-step questions
import { NextRequest, NextResponse } from 'next/server';

interface GatheringState {
    phase: 'initial' | 'questioning' | 'complete';
    initialQuery: string;
    currentQuestionIndex: number;
    questions: string[];
    answers: Record<string, string>;
    compiledData: CompiledData | null;
}

interface CompiledData {
    targetAudience: {
        demographics: string[];
        interests: string[];
        behaviors: string[];
        painPoints: string[];
    };
    adPreferences: {
        platforms: string[];
        contentTypes: string[];
        tones: string[];
        hooks: string[];
    };
    businessContext: {
        industry: string;
        products: string[];
        uniqueValue: string;
        competitors: string[];
    };
    goals: {
        objectives: string[];
        metrics: string[];
        timeline: string;
    };
}

// Dynamic question generator based on context
function generateQuestions(initialQuery: string, previousAnswers: Record<string, string>): string[] {
    const query = initialQuery.toLowerCase();
    const questions: string[] = [];

    // Base questions for all queries
    questions.push("What industry or niche are you targeting?");
    questions.push("What specific products or services are you promoting?");

    // Audience-focused questions
    if (query.includes('business owner') || query.includes('b2b')) {
        questions.push("What is the typical company size of your target audience? (e.g., solo, small team, enterprise)");
        questions.push("What are the main pain points these business owners face?");
        questions.push("What platforms do these business owners actively use? (e.g., LinkedIn, Facebook, YouTube)");
    } else if (query.includes('consumer') || query.includes('b2c')) {
        questions.push("What age range is your target audience?");
        questions.push("What hobbies or interests does your audience have?");
        questions.push("Where does your audience spend time online? (e.g., TikTok, Instagram, YouTube)");
    } else {
        questions.push("Who is your ideal customer? Describe them briefly.");
        questions.push("What age range and demographics are you targeting?");
        questions.push("Which social platforms does your audience use most?");
    }

    // Content preferences
    questions.push("What type of ad content works best for your audience? (e.g., UGC, testimonials, demos)");
    questions.push("What emotional tone should your ads convey? (e.g., exciting, trustworthy, educational)");

    // Goals and metrics
    questions.push("What is your primary advertising objective? (e.g., awareness, leads, sales)");
    questions.push("What metrics matter most to you? (e.g., CTR, ROAS, engagement)");

    return questions;
}

// Compile answers into structured data
function compileAnswers(initialQuery: string, answers: Record<string, string>): CompiledData {
    const demographics: string[] = [];
    const interests: string[] = [];
    const behaviors: string[] = [];
    const painPoints: string[] = [];
    const platforms: string[] = [];
    const contentTypes: string[] = [];
    const tones: string[] = [];
    const hooks: string[] = [];
    let industry = '';
    const products: string[] = [];
    let uniqueValue = '';
    const competitors: string[] = [];
    const objectives: string[] = [];
    const metrics: string[] = [];
    let timeline = '';

    // Parse answers based on question context
    Object.entries(answers).forEach(([question, answer]) => {
        const q = question.toLowerCase();
        const a = answer.toLowerCase();

        if (q.includes('industry') || q.includes('niche')) {
            industry = answer;
        }
        if (q.includes('product') || q.includes('service')) {
            products.push(answer);
        }
        if (q.includes('age') || q.includes('demographic')) {
            demographics.push(answer);
        }
        if (q.includes('company size')) {
            demographics.push(`Company size: ${answer}`);
        }
        if (q.includes('pain point')) {
            painPoints.push(...answer.split(/[,;]/));
        }
        if (q.includes('platform')) {
            const platformKeywords = ['tiktok', 'facebook', 'instagram', 'linkedin', 'youtube', 'twitter'];
            platformKeywords.forEach(p => {
                if (a.includes(p)) platforms.push(p.charAt(0).toUpperCase() + p.slice(1));
            });
            if (platforms.length === 0) platforms.push(answer);
        }
        if (q.includes('hobby') || q.includes('interest')) {
            interests.push(...answer.split(/[,;]/));
        }
        if (q.includes('ideal customer') || q.includes('describe')) {
            behaviors.push(answer);
        }
        if (q.includes('content') || q.includes('type')) {
            const types = ['ugc', 'testimonial', 'demo', 'educational', 'entertaining'];
            types.forEach(t => {
                if (a.includes(t)) contentTypes.push(t);
            });
            if (contentTypes.length === 0) contentTypes.push(answer);
        }
        if (q.includes('tone') || q.includes('emotional')) {
            tones.push(...answer.split(/[,;]/));
        }
        if (q.includes('objective')) {
            const objKeywords = ['awareness', 'leads', 'sales', 'engagement', 'traffic'];
            objKeywords.forEach(o => {
                if (a.includes(o)) objectives.push(o);
            });
            if (objectives.length === 0) objectives.push(answer);
        }
        if (q.includes('metric')) {
            const metricKeywords = ['ctr', 'roas', 'cpm', 'cpc', 'engagement', 'conversion'];
            metricKeywords.forEach(m => {
                if (a.includes(m)) metrics.push(m.toUpperCase());
            });
            if (metrics.length === 0) metrics.push(answer);
        }
    });

    // Generate hook suggestions based on tone
    if (tones.some(t => t.includes('excit'))) hooks.push('Curiosity', 'Shock');
    if (tones.some(t => t.includes('trust') || t.includes('credib'))) hooks.push('Testimonial', 'Social Proof');
    if (tones.some(t => t.includes('educat'))) hooks.push('Question', 'Problem-Solution');

    return {
        targetAudience: {
            demographics: demographics.map(d => d.trim()).filter(Boolean),
            interests: interests.map(i => i.trim()).filter(Boolean),
            behaviors: behaviors.map(b => b.trim()).filter(Boolean),
            painPoints: painPoints.map(p => p.trim()).filter(Boolean),
        },
        adPreferences: {
            platforms: platforms.filter(Boolean),
            contentTypes: contentTypes.filter(Boolean),
            tones: tones.map(t => t.trim()).filter(Boolean),
            hooks: hooks.filter(Boolean),
        },
        businessContext: {
            industry,
            products: products.filter(Boolean),
            uniqueValue,
            competitors,
        },
        goals: {
            objectives: objectives.filter(Boolean),
            metrics: metrics.filter(Boolean),
            timeline,
        }
    };
}

/**
 * POST /api/ai/gather-data
 * Conversational AI data gathering - processes user queries and questions
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, initialQuery, currentState, userAnswer } = body;

        if (action === 'start') {
            // Start new gathering session
            if (!initialQuery) {
                return NextResponse.json({
                    error: 'Initial query is required'
                }, { status: 400 });
            }

            const questions = generateQuestions(initialQuery, {});

            return NextResponse.json({
                success: true,
                state: {
                    phase: 'questioning',
                    initialQuery,
                    currentQuestionIndex: 0,
                    questions,
                    answers: {},
                    compiledData: null
                },
                currentQuestion: questions[0],
                totalQuestions: questions.length,
                progress: 0
            });
        }

        if (action === 'answer') {
            // Process user answer and return next question
            if (!currentState || !userAnswer) {
                return NextResponse.json({
                    error: 'Current state and answer are required'
                }, { status: 400 });
            }

            const state: GatheringState = currentState;
            const currentQuestion = state.questions[state.currentQuestionIndex];

            // Store answer
            state.answers[currentQuestion] = userAnswer;
            state.currentQuestionIndex++;

            // Check if done
            if (state.currentQuestionIndex >= state.questions.length) {
                // Compile all answers
                const compiledData = compileAnswers(state.initialQuery, state.answers);

                return NextResponse.json({
                    success: true,
                    state: {
                        ...state,
                        phase: 'complete',
                        compiledData
                    },
                    isComplete: true,
                    compiledData,
                    summary: generateSummary(compiledData)
                });
            }

            // Return next question
            return NextResponse.json({
                success: true,
                state,
                currentQuestion: state.questions[state.currentQuestionIndex],
                totalQuestions: state.questions.length,
                progress: Math.round((state.currentQuestionIndex / state.questions.length) * 100),
                isComplete: false
            });
        }

        if (action === 'skip') {
            // Skip current question
            if (!currentState) {
                return NextResponse.json({
                    error: 'Current state is required'
                }, { status: 400 });
            }

            const state: GatheringState = currentState;
            state.currentQuestionIndex++;

            if (state.currentQuestionIndex >= state.questions.length) {
                const compiledData = compileAnswers(state.initialQuery, state.answers);

                return NextResponse.json({
                    success: true,
                    state: { ...state, phase: 'complete', compiledData },
                    isComplete: true,
                    compiledData,
                    summary: generateSummary(compiledData)
                });
            }

            return NextResponse.json({
                success: true,
                state,
                currentQuestion: state.questions[state.currentQuestionIndex],
                totalQuestions: state.questions.length,
                progress: Math.round((state.currentQuestionIndex / state.questions.length) * 100),
                isComplete: false
            });
        }

        return NextResponse.json({
            error: 'Invalid action. Use: start, answer, or skip'
        }, { status: 400 });

    } catch (error) {
        console.error('[AI Gather Data] Error:', error);
        return NextResponse.json({
            error: 'Failed to process request'
        }, { status: 500 });
    }
}

function generateSummary(data: CompiledData): string {
    const parts: string[] = [];

    if (data.businessContext.industry) {
        parts.push(`Industry: ${data.businessContext.industry}`);
    }
    if (data.targetAudience.demographics.length > 0) {
        parts.push(`Target: ${data.targetAudience.demographics.join(', ')}`);
    }
    if (data.adPreferences.platforms.length > 0) {
        parts.push(`Platforms: ${data.adPreferences.platforms.join(', ')}`);
    }
    if (data.goals.objectives.length > 0) {
        parts.push(`Goals: ${data.goals.objectives.join(', ')}`);
    }

    return parts.join(' • ') || 'Data gathered successfully';
}
