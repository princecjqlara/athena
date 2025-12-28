/**
 * AI Web Search API
 * Provides web search capabilities for Athena AI
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { query, type } = await request.json();

        if (!query) {
            return NextResponse.json({
                success: false,
                error: 'Query is required'
            }, { status: 400 });
        }

        // Try to use SerpAPI if available
        const serpApiKey = process.env.SERP_API_KEY;

        if (serpApiKey) {
            try {
                const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=5`;
                const response = await fetch(searchUrl);
                const data = await response.json();

                if (data.organic_results) {
                    const results = data.organic_results.slice(0, 5).map((r: { title: string; snippet: string; link: string }) => ({
                        title: r.title,
                        snippet: r.snippet,
                        url: r.link
                    }));

                    // Generate summary for research type
                    let summary = '';
                    if (type === 'research') {
                        summary = results.map((r: { title: string; snippet: string }) =>
                            `**${r.title}**: ${r.snippet}`
                        ).join('\n\n');
                    }

                    return NextResponse.json({
                        success: true,
                        results,
                        summary,
                        source: 'serpapi'
                    });
                }
            } catch (error) {
                console.error('SerpAPI error:', error);
                // Fall through to AI-based response
            }
        }

        // Use NVIDIA AI to generate trend/research content
        const nvidiaApiKey = process.env.NVIDIA_API_KEY;

        if (nvidiaApiKey) {
            try {
                const systemPrompt = type === 'trends'
                    ? 'You are an advertising trends expert. Provide 5 current trends based on the query. Format as numbered list with bold titles.'
                    : 'You are an advertising research expert. Provide comprehensive insights on the topic. Include best practices, statistics if known, and actionable recommendations.';

                const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${nvidiaApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'nvidia/llama-3.1-nemotron-70b-instruct',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: query }
                        ],
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                });

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || '';

                return NextResponse.json({
                    success: true,
                    summary: content,
                    results: [],
                    source: 'nvidia-ai'
                });
            } catch (error) {
                console.error('NVIDIA AI error:', error);
            }
        }

        // Fallback response
        return NextResponse.json({
            success: true,
            results: [],
            summary: `Research on "${query}" - Please configure SERP_API_KEY or NVIDIA_API_KEY for live search results.`,
            source: 'fallback'
        });

    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Search failed'
        }, { status: 500 });
    }
}
